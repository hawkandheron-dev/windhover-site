/**
 * Supabase data adapter for the Church History Timeline.
 * Fetches data from CH_ tables and transforms it into
 * the same format as churchHistoryData.js exports.
 */
import {
  getSupabase,
  formatReignYears,
  yearToIsoDate,
  buildConnectionMap,
  buildSourceMap,
  buildWorksMap,
  buildEventConnectionMap
} from './churchHistoryShared.js';

// ── Color maps (same as JSON version) ─────────────────────────────────────

const colorMap = {
  person: '#5b7ee8',
  council: '#4caf50',
  emperor: '#d32f2f',
  document: '#f9a825',
  event: '#ff6f00'
};

// Colors for emperor/monarch types by empire/location
const monarchColorMap = {
  'roman-unified':  '#9C27B0', // Purple
  'roman-western':  '#C62828', // Red
  'roman-eastern':  '#1565C0', // Blue
  'frankish':       '#F57F17', // Amber/Gold
  'hre':            '#E65100', // Deep Orange
  'english':        '#00695C', // Teal
  'spanish':        '#AD1457', // Pink/Maroon
  'french':         '#283593', // Indigo
  'russian':        '#4E342E', // Brown
};

const shapeMap = {
  council: 'cross',
  document: 'book',
  event: 'reference'
};

// ── Data fetching ─────────────────────────────────────────────────────────

export async function fetchChurchHistoryData() {
  const supabase = await getSupabase();

  // Fetch all tables in parallel
  const [
    { data: eras, error: erasErr },
    { data: people, error: peopleErr },
    { data: events, error: eventsErr },
    { data: connections, error: connErr },
    { data: sources, error: srcErr },
    { data: sourceFigures, error: sfErr },
    { data: works, error: worksErr },
  ] = await Promise.all([
    supabase.from('CH_Eras').select('*').order('start_year'),
    supabase.from('CH_People').select('*').order('birth_year'),
    supabase.from('CH_Events').select('*').order('event_date'),
    supabase.from('CH_Connections').select('*'),
    supabase.from('CH_Sources').select('*'),
    supabase.from('CH_Source_Figures').select('*'),
    supabase.from('CH_Works').select('*').order('person_id'),
  ]);

  const errors = [erasErr, peopleErr, eventsErr, connErr, srcErr, sfErr, worksErr].filter(Boolean);
  if (errors.length) {
    throw new Error(`Supabase fetch errors: ${errors.map(e => e.message).join('; ')}`);
  }

  // CH_EventConnections may not exist yet — fetch separately and swallow errors
  let eventConnections = [];
  const ecResult = await supabase.from('CH_EventConnections').select('*');
  if (!ecResult.error) {
    eventConnections = ecResult.data || [];
  }

  return transformToTimelineFormat(
    eras || [],
    people || [],
    events || [],
    connections || [],
    sources || [],
    sourceFigures || [],
    works || [],
    eventConnections
  );
}

// ── Transform Supabase data → Timeline component format ──────────────────

function transformToTimelineFormat(eras, dbPeople, dbEvents, dbConnections, dbSources, dbSourceFigures, dbWorks, dbEventConnections) {
  // Build era color map from DB
  const eraColorMap = {};
  eras.forEach(era => {
    if (era.color) eraColorMap[era.era_id] = era.color;
  });

  // Build era info map
  const eraInfoMap = {};
  eras.forEach(era => {
    eraInfoMap[era.era_id] = { name: era.name, start: era.start_year, end: era.end_year };
  });

  const connectionMap = buildConnectionMap(dbConnections);
  const sourceMap = buildSourceMap(dbSources, dbSourceFigures);
  const worksMap = buildWorksMap(dbWorks);
  const eventConnectionMap = buildEventConnectionMap(dbEventConnections);

  // Helper: determine era for a date
  function getEraForBirthYear(year) {
    if (year < 100) return 'era-apostolic';
    if (year < 325) return 'era-ante-nicene';
    if (year < 451) return 'era-first-four-councils';
    if (year < 1000) return 'era-monks-missionaries';
    if (year < 1300) return 'era-scholastics';
    if (year < 1500) return 'era-proto-reformers';
    if (year < 1650) return 'era-reformers';
    return 'era-dissent-discovery';
  }

  // ── Transform people ──────────────────────────────────────────────────
  const timelinePeople = [];

  dbPeople.forEach(p => {
    if (p.is_monarch) {
      // Emperor/monarch - below timeline, colored by monarch_type
      const reignPreview = formatReignYears(
        p.reign_start_year ?? p.birth_year,
        p.reign_end_year ?? p.death_year
      );
      const monarchColor = (p.monarch_type && monarchColorMap[p.monarch_type])
        || colorMap.emperor;
      timelinePeople.push({
        id: p.person_id,
        name: p.name,
        startDate: p.birth_date,
        endDate: p.death_date,
        dateCertainty: 'year only',
        periodId: 'roman-emperors',
        preview: reignPreview,
        color: monarchColor,
        aboveTimeline: false,
        isMonarch: true,
        location: p.location,
        description: p.description || null,
        monarchType: p.monarch_type || null,
        referenceUrl: p.reference_url || null,
        reignStart: p.reign_start || null,
        reignEnd: p.reign_end || null,
        reignStartYear: p.reign_start_year ?? null,
        reignEndYear: p.reign_end_year ?? null
      });
    } else {
      // Regular person - above timeline
      const eraId = p.era_id || getEraForBirthYear(p.birth_year);
      const eraInfo = eraInfoMap[eraId] || { name: 'Unknown Era' };
      timelinePeople.push({
        id: p.person_id,
        name: p.name,
        startDate: p.birth_date,
        endDate: p.death_date,
        dateCertainty: 'year only',
        periodId: eraId,
        periodName: eraInfo.name,
        preview: p.name,
        color: eraColorMap[eraId] || '#5b7ee8',
        aboveTimeline: true,
        location: p.location,
        description: p.description || null,
        connections: connectionMap.get(p.person_id) || [],
        sources: sourceMap.get(p.person_id) || [],
        works: worksMap.get(p.person_id) || [],
        referenceUrl: p.reference_url || null
      });
    }
  });

  // ── Transform events → points ─────────────────────────────────────────
  const timelinePoints = [];

  dbEvents.forEach(ev => {
    timelinePoints.push({
      id: ev.event_id,
      name: ev.name,
      date: ev.event_date,
      endDate: ev.end_date || null,
      dateCertainty: 'year only',
      shape: shapeMap[ev.event_type] || 'circle',
      color: colorMap[ev.event_type] || '#888888',
      preview: ev.name,
      aboveTimeline: ev.event_type !== 'document',
      itemType: ev.event_type === 'council' ? 'councils' : ev.event_type === 'document' ? 'documents' : 'events',
      location: ev.location,
      description: ev.description || null,
      referenceUrl: ev.reference_url || null,
      connectedPeople: eventConnectionMap.get(ev.event_id) || [],
      sources: sourceMap.get(ev.event_id) || []
    });
  });

  // ── Transform eras → periods ──────────────────────────────────────────
  const timelinePeriods = [];

  eras.forEach(era => {
    // Convert year integers to ISO date strings for the Timeline component
    const startDate = yearToIsoDate(era.start_year);
    const endDate = yearToIsoDate(era.end_year);

    timelinePeriods.push({
      id: era.era_id,
      name: era.name,
      startDate,
      endDate,
      dateCertainty: 'year only',
      color: era.color || '#00acc1',
      preview: era.name,
      // Cluniac reforms go below; all others above
      aboveTimeline: era.era_id !== 'era-cluniac-reforms',
      referenceUrl: era.reference_url || null
    });
  });

  return {
    data: {
      people: timelinePeople,
      points: timelinePoints,
      periods: timelinePeriods
    },
    // Provide raw tables for potential table-view usage
    raw: {
      eras,
      people: dbPeople,
      events: dbEvents,
      connections: dbConnections,
      sources: dbSources,
      sourceFigures: dbSourceFigures,
      works: dbWorks
    }
  };
}

// ── Fetch tour scenes ─────────────────────────────────────────────────────

export async function fetchTourScenes() {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('CH_TourScenes')
    .select('*')
    .order('scene_order');

  if (error) throw new Error(`Failed to fetch tour scenes: ${error.message}`);
  if (!data || data.length === 0) return null; // fallback to static scenes

  return data.map(row => {
    const scene = {
      id: row.scene_id,
      personIds: row.person_ids, // null for build-out, array otherwise
      title: row.title,
      narrative: row.narrative,
    };
    if (row.additional_narrative) scene.additionalNarrative = row.additional_narrative;
    if (row.additional_narrative_style) scene.additionalNarrativeStyle = row.additional_narrative_style;
    if (row.third_narrative) scene.thirdNarrative = row.third_narrative;
    if (row.open_person_id) scene.openPersonId = row.open_person_id;
    if (row.highlight_connection_id) scene.highlightConnectionId = row.highlight_connection_id;
    if (row.keep_modal_open) scene.keepModalOpen = true;
    if (row.map_from) scene.mapFrom = row.map_from;
    if (row.open_year_summary != null) scene.openYearSummary = row.open_year_summary;
    if (row.point_ids && row.point_ids.length > 0) scene.pointIds = row.point_ids;
    if (row.include_periods_and_points) scene.includePeriodsAndPoints = true;
    if (row.is_build_out) scene.isBuildOut = true;
    if (row.stagger_ids && row.stagger_ids.length > 0) scene.staggerIds = row.stagger_ids;
    if (row.stagger_point_ids && row.stagger_point_ids.length > 0) scene.staggerPointIds = row.stagger_point_ids;
    if (row.stagger_interval != null) scene.staggerInterval = row.stagger_interval;
    if (row.stagger_person_interval != null) scene.staggerPersonInterval = row.stagger_person_interval;
    if (row.stagger_point_interval != null) scene.staggerPointInterval = row.stagger_point_interval;
    return scene;
  });
}

// ── Fetch linked media ────────────────────────────────────────────────────

export async function fetchLinkedMedia(entityType, entityIds) {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('CH_LinkedMedia')
    .select('*')
    .eq('entity_type', entityType)
    .in('entity_id', entityIds)
    .order('sort_order');

  if (error) {
    console.warn('Failed to fetch linked media:', error.message);
    return new Map();
  }

  // Return a Map keyed by entity_id (first media per entity for now)
  const mediaMap = new Map();
  for (const row of data || []) {
    if (!mediaMap.has(row.entity_id)) {
      mediaMap.set(row.entity_id, {
        mediaId: row.media_id,
        mediaUrl: row.media_url,
        sourcePageUrl: row.source_page_url,
        altText: row.alt_text,
        attribution: row.attribution,
        cropPositionX: row.crop_position_x,
        cropPositionY: row.crop_position_y,
        cropScale: row.crop_scale,
      });
    }
  }
  return mediaMap;
}

// ── Update linked media crop (admin only) ─────────────────────────────────

export async function updateLinkedMediaCrop(mediaId, posX, posY, getToken) {
  const { makeSupabaseClient } = await import('../lib/supabase.ts');
  const supabase = makeSupabaseClient(getToken);

  const { error } = await supabase
    .from('CH_LinkedMedia')
    .update({
      crop_position_x: Math.round(posX),
      crop_position_y: Math.round(posY),
      updated_at: new Date().toISOString(),
    })
    .eq('media_id', mediaId);

  if (error) throw new Error(`Failed to update media crop: ${error.message}`);
}
