/**
 * Supabase data adapter for CH Timeline 2.0.
 *
 * This is the union of the two 1.0 adapters — it reads the same CH_ tables as
 * churchHistorySupabaseAdapter.js plus the CH_Movements set that
 * heresiesSupabaseAdapter.js reads — and unlike the heresies page it scopes
 * *nothing* out. Every person, event and movement is returned.
 *
 * What manages the density instead is the layer split:
 *
 *   front — the ~158 church figures whose lifespans are the point of the page
 *   back  — emperors, heresiarchs, contested figures, movements and every
 *           event, drawn behind the front layer as a blurred wash until the
 *           reader focuses a person or lifts the whole layer
 *
 * Eras are derived from dates (churchHistory2Eras.js), not read from
 * CH_People.era_id, so the scheme changed without a migration. CH_Eras is not
 * fetched at all.
 */
import {
  getSupabase,
  formatReignYears,
  yearToIsoDate,
  buildConnectionMap,
  buildSourceMap,
  buildWorksMap,
  buildEventConnectionMap,
} from './churchHistoryShared.js';
import { colorForLifespan, centuryOf, ordinal } from './churchHistory2Centuries.js';
import { BACK_STYLES, POINT_STYLES } from './churchHistory2Data.js';

// Tour scenes, linked media and the media-crop mutation are identical to 1.0;
// re-export rather than duplicate so there is one implementation to maintain.
export { fetchTourScenes, fetchLinkedMedia, updateLinkedMediaCrop } from './churchHistorySupabaseAdapter.js';

// ── Layer assignment ──────────────────────────────────────────────────────

/**
 * Doctrinal roles kept off the timeline entirely for now.
 *
 * Heresiarchs only. Contested figures used to sit here too, but several of
 * them — Origen, Tertullian, Eusebius of Caesarea, John Cassian — are
 * principals by any reading, and burying them in the background wash was
 * wrong. They are ordinary foreground figures now; any individual who does not
 * earn a place comes off through the `active` flag instead, which is a
 * judgement about a person rather than about a category.
 */
const HIDDEN_ROLES = new Set(['heresiarch']);

/** Whether a CH_People row belongs behind the main figures. Monarchs only. */
export function isBackgroundPerson(person) {
  return Boolean(person.is_monarch);
}

/**
 * Rows carry `active` since the 20261001 migration. `!== false` rather than
 * `=== true` so fixtures and any row predating the column still count as
 * active rather than silently vanishing.
 */
const isActive = (row) => row.active !== false;

// ── Presentation ──────────────────────────────────────────────────────────

/** Emperors keep the per-empire colouring from the 1.0 timeline. */
const monarchColorMap = {
  'roman-unified': '#7b4a8e',
  'roman-western': '#a1443a',
  'roman-eastern': '#3a6ea1',
  'frankish':      '#b07a2a',
  'hre':           '#a35a2a',
  'english':       '#2f7a6a',
  'spanish':       '#9c3a63',
  'french':        '#43509b',
  'russian':       '#6b4a3a',
};

const EVENT_STYLES = {
  council:  { color: POINT_STYLES.councils.color,  shape: 'cross',     filterKey: 'councils',  itemType: 'councils' },
  document: { color: POINT_STYLES.documents.color, shape: 'book',      filterKey: 'documents', itemType: 'documents' },
  event:    { color: POINT_STYLES.events.color,    shape: 'reference', filterKey: 'events',    itemType: 'events' },
};

const MOVEMENT_KIND_LABELS = {
  heresy: 'Heresy',
  schism: 'Schism',
  controversy: 'Controversy',
  school: 'School of thought',
};

const MOVEMENT_ROLE_LABELS = {
  founder: 'originated by',
  proponent: 'advanced by',
  opponent: 'opposed by',
  associated: 'associated with',
};

const DOCTRINAL_ROLE_LABELS = {
  defender: 'Defender of orthodoxy',
  heresiarch: 'Heresiarch',
  contested: 'Contested figure',
  'emperor-pagan': 'Pagan emperor',
  'emperor-arianizing': 'Emperor backing the Arian party',
  'emperor-christian': 'Nicene Christian emperor',
};

// ── Data fetching ─────────────────────────────────────────────────────────

export async function fetchChurchHistory2Data() {
  const supabase = await getSupabase();

  const [
    { data: people, error: peopleErr },
    { data: events, error: eventsErr },
    { data: connections, error: connErr },
    { data: sources, error: srcErr },
    { data: sourceFigures, error: sfErr },
    { data: works, error: worksErr },
    { data: movements, error: movErr },
    { data: movementFigures, error: mfErr },
    { data: movementEvents, error: meErr },
    { data: eventConnections, error: ecErr },
  ] = await Promise.all([
    supabase.from('CH_People').select('*').order('birth_year'),
    supabase.from('CH_Events').select('*').order('event_date'),
    supabase.from('CH_Connections').select('*'),
    supabase.from('CH_Sources').select('*'),
    supabase.from('CH_Source_Figures').select('*'),
    supabase.from('CH_Works').select('*').order('person_id'),
    supabase.from('CH_Movements').select('*').order('start_year'),
    supabase.from('CH_Movement_Figures').select('*'),
    supabase.from('CH_Movement_Events').select('*'),
    supabase.from('CH_EventConnections').select('*'),
  ]);

  const errors = [peopleErr, eventsErr, connErr, srcErr, sfErr, worksErr, movErr, mfErr, meErr, ecErr]
    .filter(Boolean);
  if (errors.length) {
    throw new Error(`Supabase fetch errors: ${errors.map(e => e.message).join('; ')}`);
  }

  return transformToTimelineFormat({
    people: people || [],
    events: events || [],
    connections: connections || [],
    sources: sources || [],
    sourceFigures: sourceFigures || [],
    works: works || [],
    movements: movements || [],
    movementFigures: movementFigures || [],
    movementEvents: movementEvents || [],
    eventConnections: eventConnections || [],
  });
}

// ── Transform ─────────────────────────────────────────────────────────────

export function transformToTimelineFormat(db) {
  // Who survives the `active` flag and the hidden roles. Every relationship
  // below is filtered against this, so nothing points at a figure the timeline
  // no longer draws — a connection pill that opens nothing is worse than an
  // absent one.
  const keptPersonIds = new Set(
    db.people
      .filter(p => isActive(p) && !HIDDEN_ROLES.has(p.doctrinal_role))
      .map(p => p.person_id)
  );
  const keptEventIds = new Set(db.events.filter(isActive).map(e => e.event_id));

  const connectionMap = buildConnectionMap(db.connections);
  const sourceMap = buildSourceMap(db.sources, db.sourceFigures);
  const worksMap = buildWorksMap(db.works);
  const eventConnectionMap = buildEventConnectionMap(db.eventConnections);
  for (const [eventId, personIds] of eventConnectionMap) {
    if (!keptEventIds.has(eventId)) { eventConnectionMap.delete(eventId); continue; }
    eventConnectionMap.set(eventId, personIds.filter(id => keptPersonIds.has(id)));
  }

  /** A person's connections, minus anyone who is no longer on the timeline. */
  const connectionsFor = (personId) =>
    (connectionMap.get(personId) || []).filter(c => keptPersonIds.has(c.id));

  // Only active movements are indexed, so an affiliation can never name a
  // movement that is switched off.
  const movementById = new Map(
    db.movements.filter(isActive).map(m => [m.movement_id, m])
  );

  /** person_id → [{ movement, role }] */
  const movementsByPerson = new Map();
  for (const mf of db.movementFigures) {
    const movement = movementById.get(mf.movement_id);
    if (!movement || !keptPersonIds.has(mf.person_id)) continue;
    if (!movementsByPerson.has(mf.person_id)) movementsByPerson.set(mf.person_id, []);
    movementsByPerson.get(mf.person_id).push({ movement, role: mf.role });
  }

  /** event_id → [{ movement, relation }] */
  const movementsByEvent = new Map();
  for (const me of db.movementEvents) {
    const movement = movementById.get(me.movement_id);
    if (!movement || !keptEventIds.has(me.event_id)) continue;
    if (!movementsByEvent.has(me.event_id)) movementsByEvent.set(me.event_id, []);
    movementsByEvent.get(me.event_id).push({ movement, relation: me.relation });
  }

  const affiliationsFor = (personId) =>
    (movementsByPerson.get(personId) || []).map(a => ({
      id: a.movement.movement_id,
      name: a.movement.name,
      role: a.role,
      roleLabel: MOVEMENT_ROLE_LABELS[a.role] || a.role,
    }));

  // ── People, split by layer ──────────────────────────────────────────────
  const frontPeople = [];
  const backPeople = [];
  /** Emperor reigns, for "who was on the throne during this lifespan". */
  const reigns = [];

  for (const p of db.people) {
    if (!isActive(p) || HIDDEN_ROLES.has(p.doctrinal_role)) continue;

    const shared = {
      id: p.person_id,
      name: p.name,
      startDate: p.birth_date,
      endDate: p.death_date,
      dateCertainty: 'year only',
      birthYear: p.birth_year ?? null,
      deathYear: p.death_year ?? null,
      location: p.location,
      description: p.description || null,
      referenceUrl: p.reference_url || null,
      doctrinalRole: p.doctrinal_role || null,
      doctrinalRoleLabel: DOCTRINAL_ROLE_LABELS[p.doctrinal_role] || null,
      movements: affiliationsFor(p.person_id),
      connections: connectionsFor(p.person_id),
      sources: sourceMap.get(p.person_id) || [],
      works: worksMap.get(p.person_id) || [],
    };

    if (p.is_monarch) {
      const reignStart = p.reign_start_year ?? p.birth_year;
      const reignEnd = p.reign_end_year ?? p.death_year;
      if (reignStart !== null && reignStart !== undefined && reignEnd !== null && reignEnd !== undefined) {
        reigns.push({ id: p.person_id, start: reignStart, end: reignEnd });
      }
      backPeople.push({
        ...shared,
        layer: 'back',
        periodId: 'roman-emperors',
        periodName: BACK_STYLES.emperors.label,
        preview: formatReignYears(reignStart, reignEnd),
        color: monarchColorMap[p.monarch_type] || BACK_STYLES.emperors.color,
        aboveTimeline: false,
        isMonarch: true,
        filterKey: 'emperors',
        monarchType: p.monarch_type || null,
        reignStart: p.reign_start || null,
        reignEnd: p.reign_end || null,
        reignStartYear: reignStart ?? null,
        reignEndYear: reignEnd ?? null,
      });
      continue;
    }

    // Front layer: coloured by the century their life falls in, nothing else.
    // No periodId or periodName — their absence is what removes the "Era:"
    // line from the shared detail panel without touching that component.
    const fill = colorForLifespan(p.birth_year, p.death_year);
    frontPeople.push({
      ...shared,
      layer: 'front',
      preview: p.name,
      color: fill.color,
      gradient: fill.gradient,
      century: centuryOf(p.birth_year),
      centuryLabel: `${ordinal(centuryOf(p.birth_year))} century`,
      aboveTimeline: true,
      filterKey: 'people',
    });
  }

  // ── Events → foreground points ─────────────────────────────────────────
  // Councils, creeds and texts are landmarks, not background: they belong on
  // the main layer with the pin-and-flag callout the 1.0 timeline used, where
  // they are always labelled. Plain `event` rows are deactivated for now and
  // fall out with the `active` filter rather than being special-cased here.
  const frontPoints = db.events.filter(isActive).map(ev => {
    const style = EVENT_STYLES[ev.event_type] || EVENT_STYLES.event;
    return {
      id: ev.event_id,
      name: ev.name,
      date: ev.event_date,
      endDate: ev.end_date || null,
      dateCertainty: 'year only',
      layer: 'front',
      shape: style.shape,
      color: style.color,
      preview: ev.name,
      // A short resting label for harp strings, when the table carries one
      // (shortLabel.js derives it otherwise).
      shortName: ev.short_name || null,
      aboveTimeline: ev.event_type !== 'document',
      itemType: style.itemType,
      filterKey: style.filterKey,
      location: ev.location,
      description: ev.description || null,
      referenceUrl: ev.reference_url || null,
      connectedPeople: (eventConnectionMap.get(ev.event_id) || []).filter(id => keptPersonIds.has(id)),
      sources: sourceMap.get(ev.event_id) || [],
      movements: (movementsByEvent.get(ev.event_id) || []).map(l => ({
        id: l.movement.movement_id,
        name: l.movement.name,
        relation: l.relation,
      })),
    };
  });

  // ── Movements → back-layer bands ───────────────────────────────────────
  // Above the axis, behind the figures — a movement is a current the people
  // were caught in, so it belongs among them rather than down with the
  // emperors. Keeping it below would also strand an empty band between the
  // axis and the reigns everywhere outside the fourth century, since all
  // twenty movements fall between 48 and 451.
  const backPeriods = db.movements.filter(isActive).map(m => ({
    id: m.movement_id,
    name: m.name,
    startDate: yearToIsoDate(m.start_year),
    endDate: yearToIsoDate(m.end_year),
    dateCertainty: 'year only',
    layer: 'back',
    color: m.color || '#8e5a8e',
    preview: MOVEMENT_KIND_LABELS[m.kind] || m.kind,
    aboveTimeline: true,
    filterKey: 'movements',
    kind: m.kind,
    description: m.description || null,
    referenceUrl: m.reference_url || null,
  }));

  // The focus set resolves ids across both layers — a figure's councils and
  // texts are foreground now, but they are still part of their background in
  // the sense the focus interaction means.
  const backItemById = new Map();
  for (const item of backPeople) backItemById.set(item.id, item);
  for (const item of frontPoints) backItemById.set(item.id, item);
  for (const item of backPeriods) backItemById.set(item.id, item);

  return {
    // The front layer has no periods — that is the whole point of 2.0.
    // The background is reigns and nothing else: heresiarchs are hidden,
    // contested figures came forward, movements are deactivated, and the
    // councils and texts were promoted to pins and flags.
    data: { people: frontPeople, points: frontPoints, periods: [] },
    backData: { people: backPeople, points: [], periods: backPeriods },
    index: {
      connectionMap,
      eventConnectionMap,
      movementsByPerson,
      movementsByEvent,
      reigns: reigns.sort((a, b) => a.start - b.start),
      personById: new Map(db.people.map(p => [p.person_id, p])),
      backItemById,
    },
    raw: {
      people: db.people,
      events: db.events,
      movements: db.movements,
      movementFigures: db.movementFigures,
      movementEvents: db.movementEvents,
      connections: db.connections,
      sources: db.sources,
      sourceFigures: db.sourceFigures,
      works: db.works,
      eventConnections: db.eventConnections,
    },
  };
}
