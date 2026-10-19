/**
 * Shared plumbing for the Supabase-backed church-history timelines.
 *
 * The main Church History Timeline and the Heresies & Christological
 * Controversies timeline read the same CH_ tables and need the same lookup
 * maps (sources by figure, works by person, connections both ways). Those
 * builders live here so the two adapters stay in step rather than drifting.
 */
import { createClient } from '@supabase/supabase-js';

// ── Supabase client ───────────────────────────────────────────────────────

let supabaseClient = null;

export async function getSupabase() {
  if (supabaseClient) return supabaseClient;

  // Config is set on window by the <script src="/api/supabase-config"> tag
  // in the HTML entry point before React boots.
  const url = window.SUPABASE_URL || '';
  const key = window.SUPABASE_ANON_KEY || '';

  if (!url || !key) {
    throw new Error('Supabase configuration not found. Ensure the config script has loaded.');
  }

  supabaseClient = createClient(url, key);
  return supabaseClient;
}

// ── Date helpers ──────────────────────────────────────────────────────────

export function formatReignYears(startYear, endYear) {
  if (startYear === null || endYear === null) return '';

  const startIsBC = startYear < 0;
  const endIsBC = endYear < 0;
  const hasBC = startIsBC || endIsBC;

  const formatYear = (year, forceEra = false) => {
    if (year < 0) return `${Math.abs(year)} BC`;
    if (forceEra) return `${year} AD`;
    return `${year}`;
  };

  const startStr = formatYear(startYear, hasBC && !startIsBC);
  const endStr = formatYear(endYear, hasBC && !endIsBC);
  return `Reigned ${startStr}-${endStr}`;
}

/** Year integer → the zero-padded ISO date string the Timeline expects. */
export function yearToIsoDate(year) {
  return year >= 0
    ? `${String(year).padStart(4, '0')}-01-01`
    : `-${String(Math.abs(year)).padStart(4, '0')}-01-01`;
}

// ── Lookup maps ───────────────────────────────────────────────────────────

/** person_id → [{ id, type }], recorded in both directions. */
export function buildConnectionMap(dbConnections) {
  const connectionMap = new Map();
  dbConnections.forEach(conn => {
    const add = (from, to, type) => {
      if (!connectionMap.has(from)) connectionMap.set(from, []);
      const entries = connectionMap.get(from);
      if (!entries.some(e => e.id === to && e.type === type)) {
        entries.push({ id: to, type: type || 'known' });
      }
    };
    add(conn.person_id_1, conn.person_id_2, conn.connection_type);
    add(conn.person_id_2, conn.person_id_1, conn.connection_type);
  });
  return connectionMap;
}

/** person_id or event_id → [{ id, source, title, year, url, notes, linkStatus }]. */
export function buildSourceMap(dbSources, dbSourceFigures) {
  const sourceMap = new Map();
  const sourceById = new Map();
  dbSources.forEach(s => sourceById.set(s.source_id, s));

  dbSourceFigures.forEach(sf => {
    const src = sourceById.get(sf.source_id);
    if (!src) return;
    const key = sf.person_id || sf.event_id;
    if (!key) return;
    if (!sourceMap.has(key)) sourceMap.set(key, []);
    const entries = sourceMap.get(key);
    // Avoid duplicates
    if (!entries.some(e => e.id === src.source_id)) {
      entries.push({
        id: src.source_id,
        source: src.source_name,
        title: src.title,
        year: src.year,
        url: src.url,
        notes: src.notes,
        linkStatus: src.link_status
      });
    }
  });
  return sourceMap;
}

/** person_id → [{ name, textUrl, linkStatus }]. */
export function buildWorksMap(dbWorks) {
  const worksMap = new Map();
  dbWorks.forEach(w => {
    if (!w.person_id) return;
    if (!worksMap.has(w.person_id)) worksMap.set(w.person_id, []);
    worksMap.get(w.person_id).push({
      name: w.name,
      textUrl: w.text_url,
      linkStatus: w.link_status
    });
  });
  return worksMap;
}

/** event_id → [person_id]. */
export function buildEventConnectionMap(dbEventConnections) {
  const eventConnectionMap = new Map();
  (dbEventConnections || []).forEach(ec => {
    if (!ec.event_id || !ec.person_id) return;
    if (!eventConnectionMap.has(ec.event_id)) eventConnectionMap.set(ec.event_id, []);
    eventConnectionMap.get(ec.event_id).push(ec.person_id);
  });
  return eventConnectionMap;
}
