/**
 * Timeline item CRUD service for Church History Timeline.
 * Handles delete, and editing of works, sources, connections,
 * and point-person connections (CH_EventConnections).
 *
 * Uses the Clerk-aware Supabase client for RLS-protected operations.
 */
import { makeSupabaseClient } from '../lib/supabase.ts';

// ── Helpers ──────────────────────────────────────────────────────────────

function getClient(getToken) {
  if (!getToken) throw new Error('Auth token provider required');
  return makeSupabaseClient(getToken);
}

// ── Delete ───────────────────────────────────────────────────────────────

/**
 * Delete a person and their related data (connections, works, source links).
 */
export async function deletePerson(personId, getToken) {
  const supabase = getClient(getToken);

  // Delete works for this person
  await supabase
    .from('CH_Works')
    .delete()
    .eq('person_id', personId);

  // Delete source-figure links
  await supabase
    .from('CH_Source_Figures')
    .delete()
    .eq('person_id', personId);

  // Delete connections (both directions)
  await supabase
    .from('CH_Connections')
    .delete()
    .eq('person_id_1', personId);
  await supabase
    .from('CH_Connections')
    .delete()
    .eq('person_id_2', personId);

  // Delete event connections
  await supabase
    .from('CH_EventConnections')
    .delete()
    .eq('person_id', personId);

  // Delete note connections
  await supabase
    .from('CH_NoteConnections')
    .delete()
    .eq('person_id', personId);

  // Delete the person
  const { error } = await supabase
    .from('CH_People')
    .delete()
    .eq('person_id', personId);

  if (error) throw error;
}

/**
 * Delete an event/point and its related data.
 */
export async function deletePoint(eventId, getToken) {
  const supabase = getClient(getToken);

  // Delete source-figure links
  await supabase
    .from('CH_Source_Figures')
    .delete()
    .eq('event_id', eventId);

  // Delete event connections
  await supabase
    .from('CH_EventConnections')
    .delete()
    .eq('event_id', eventId);

  // Delete the event
  const { error } = await supabase
    .from('CH_Events')
    .delete()
    .eq('event_id', eventId);

  if (error) throw error;
}

// ── Works CRUD ───────────────────────────────────────────────────────────

/**
 * Replace all works for a person with the given array.
 * Each work: { name, textUrl }
 */
export async function updateWorksForPerson(personId, works, getToken) {
  const supabase = getClient(getToken);

  // Delete existing works
  const { error: delErr } = await supabase
    .from('CH_Works')
    .delete()
    .eq('person_id', personId);
  if (delErr) throw delErr;

  // Insert new works
  if (works.length > 0) {
    const rows = works.map(w => ({
      person_id: personId,
      name: w.name,
      text_url: w.textUrl || null,
      // Unverified until someone confirms the link (CH_Works.link_status).
      link_status: w.linkStatus || 'Unverified',
    }));
    const { error: insErr } = await supabase
      .from('CH_Works')
      .insert(rows);
    if (insErr) throw insErr;
  }
}

// ── Sources CRUD ─────────────────────────────────────────────────────────

/**
 * Replace source-figure links for a person.
 * Each source: { id, source, title, year, url, notes, linkStatus }
 * Creates new CH_Sources rows for any source without an id,
 * then links them via CH_Source_Figures.
 */
export async function updateSourcesForPerson(personId, sources, getToken) {
  const supabase = getClient(getToken);

  // Remove existing source-figure links for this person
  const { error: delErr } = await supabase
    .from('CH_Source_Figures')
    .delete()
    .eq('person_id', personId);
  if (delErr) throw delErr;

  if (sources.length === 0) return;

  // Ensure all sources exist in CH_Sources, create new ones as needed
  const sourceIds = [];
  for (const src of sources) {
    if (src.id) {
      // Update existing source
      await supabase
        .from('CH_Sources')
        .update({
          source_name: src.source || null,
          title: src.title,
          year: src.year || null,
          url: src.url || null,
          notes: src.notes || null,
          link_status: src.linkStatus || 'Unverified',
        })
        .eq('source_id', src.id);
      sourceIds.push(src.id);
    } else {
      // Create new source
      const { data: newSrc, error: srcErr } = await supabase
        .from('CH_Sources')
        .insert({
          source_name: src.source || null,
          title: src.title,
          year: src.year || null,
          url: src.url || null,
          notes: src.notes || null,
          link_status: src.linkStatus || 'Unverified',
        })
        .select()
        .single();
      if (srcErr) throw srcErr;
      sourceIds.push(newSrc.source_id);
    }
  }

  // Create source-figure links
  const rows = sourceIds.map(sid => ({
    source_id: sid,
    person_id: personId,
  }));
  const { error: linkErr } = await supabase
    .from('CH_Source_Figures')
    .insert(rows);
  if (linkErr) throw linkErr;
}

// ── Connections CRUD ─────────────────────────────────────────────────────

/**
 * Replace person-to-person connections for a person.
 * Each connection: { id (other person id), type }
 */
export async function updateConnectionsForPerson(personId, connections, getToken) {
  const supabase = getClient(getToken);

  // Delete existing connections (both directions)
  await supabase
    .from('CH_Connections')
    .delete()
    .eq('person_id_1', personId);
  await supabase
    .from('CH_Connections')
    .delete()
    .eq('person_id_2', personId);

  if (connections.length === 0) return;

  // Insert new connections (single direction; adapter builds both)
  const rows = connections.map(c => ({
    person_id_1: personId,
    person_id_2: c.id,
    connection_type: c.type || 'known',
  }));
  const { error: insErr } = await supabase
    .from('CH_Connections')
    .insert(rows);
  if (insErr) throw insErr;
}

// ── Point ↔ Person Connections (CH_EventConnections) ─────────────────────

/**
 * Fetch person connections for an event/point.
 * Returns array of { person_id }.
 */
export async function fetchEventConnections(eventId, getToken) {
  const supabase = getClient(getToken);

  const { data, error } = await supabase
    .from('CH_EventConnections')
    .select('person_id')
    .eq('event_id', eventId);

  if (error) {
    // Table might not exist yet — return empty gracefully
    if (error.code === '42P01') return [];
    throw error;
  }
  return data || [];
}

/**
 * Replace person connections for an event/point.
 * personIds: array of person_id strings
 */
export async function updateEventConnections(eventId, personIds, getToken) {
  const supabase = getClient(getToken);

  // Delete existing
  await supabase
    .from('CH_EventConnections')
    .delete()
    .eq('event_id', eventId);

  if (personIds.length === 0) return;

  const rows = personIds.map(pid => ({
    event_id: eventId,
    person_id: pid,
  }));
  const { error } = await supabase
    .from('CH_EventConnections')
    .insert(rows);
  if (error) throw error;
}
