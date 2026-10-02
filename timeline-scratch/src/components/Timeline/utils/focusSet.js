/**
 * Which background items belong to a foreground person.
 *
 * CH Timeline 2.0 keeps emperors, heresiarchs, movements and events on a
 * blurred layer behind the main figures. Focusing a person is what brings
 * *their* background — and only theirs — into focus. This computes that set.
 *
 * Four sources of belonging, in rough order of how directly the data asserts
 * them:
 *
 *   1. CH_Connections   — a named tie to a heresiarch or a contested figure
 *   2. CH_Movement_Figures — the controversies they were party to
 *   3. CH_EventConnections — the councils and texts tied to them
 *   4. reign overlap    — who was on the throne while they lived
 *
 * (4) is the loose one, and the reason the whole feature earns its keep: it is
 * how "who was emperor when Athanasius was writing" gets answered without the
 * reader leaving the page. It is also the only one not asserted by an editor,
 * so it is kept last and is easy to drop if it proves noisy.
 */

/**
 * @param {string|null} personId          foreground person to focus on
 * @param {object} index                  the `index` block from churchHistory2Adapter
 * @param {Map} index.connectionMap       person_id → [{ id, type }]
 * @param {Map} index.eventConnectionMap  event_id → [person_id]
 * @param {Map} index.movementsByPerson   person_id → [{ movement, role }]
 * @param {Array} index.reigns            [{ id, start, end }] sorted by start
 * @param {Map} index.personById          person_id → raw CH_People row
 * @param {Map} index.backItemById        id → transformed back-layer item
 * @returns {Set<string>} ids of background items; empty when personId is null
 */
export function computeFocusSet(personId, index) {
  const focus = new Set();
  if (!personId || !index) return focus;

  const {
    connectionMap,
    eventConnectionMap,
    movementsByPerson,
    reigns,
    personById,
    backItemById,
  } = index;

  // 1. Direct connections that land on the background layer.
  for (const conn of connectionMap?.get(personId) || []) {
    if (backItemById?.has(conn.id)) focus.add(conn.id);
  }

  // 2. Movements they belong to.
  for (const affiliation of movementsByPerson?.get(personId) || []) {
    focus.add(affiliation.movement.movement_id);
  }

  // 3. Events, councils and texts tied to them. eventConnectionMap is keyed by
  //    event, so this is a scan — 85 events, once per focus change.
  if (eventConnectionMap) {
    for (const [eventId, peopleIds] of eventConnectionMap) {
      if (peopleIds.includes(personId)) focus.add(eventId);
    }
  }

  // 4. Reigns overlapping their lifespan.
  const person = personById?.get(personId);
  const birth = person?.birth_year ?? null;
  const death = person?.death_year ?? null;
  if (birth !== null && death !== null && Array.isArray(reigns)) {
    for (const reign of reigns) {
      // Sorted by start, so once a reign begins after the death there are no
      // more overlaps to find.
      if (reign.start > death) break;
      if (reign.end >= birth) focus.add(reign.id);
    }
  }

  return focus;
}
