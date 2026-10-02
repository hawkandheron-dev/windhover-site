/**
 * Eras for CH Timeline 2.0.
 *
 * The 1.0 timeline drew eras as bracket spans across the canvas and stored the
 * assignment on CH_People.era_id. Here the eras survive only as *colour* on a
 * person's lifespan bar — there are no brackets — and the assignment is derived
 * from dates rather than read from the row, so the scheme can change without a
 * migration.
 *
 * The scheme keeps the three church-specific ages up to Chalcedon, then hands
 * over to the conventional historical periods. The correspondence with the old
 * CH_Eras rows is very nearly one-to-one, so almost nobody moves:
 *
 *   era-monks-missionaries (450–1000)  → Early Middle Ages
 *   era-scholastics        (1000–1300) → High Middle Ages
 *   era-proto-reformers    (1300–1500) → Late Middle Ages
 *   era-reformers          (1500–1650) → Renaissance & Reformation
 *   era-dissent-discovery  (1650–1800) → Age of Enlightenment
 *
 * era-cluniac-reforms had no people assigned to it and simply disappears.
 */

/**
 * Ordered, contiguous and half-open: a year belongs to the first era whose
 * `end` it falls short of. `start` is documentation for the legend; only `end`
 * participates in the lookup.
 *
 * The palette is tuned for a white ground — the nine sit at a similar
 * luminance so no single era shouts, and they run cool → warm across time.
 */
export const CH2_ERAS = [
  { id: 'era-apostolic',      name: 'The Apostolic Age',         start: 1,    end: 100,  color: '#5b7ee8', referenceUrl: 'https://en.wikipedia.org/wiki/Apostolic_Age' },
  { id: 'era-ante-nicene',    name: 'The Ante-Nicene Age',       start: 100,  end: 325,  color: '#7b5ea8', referenceUrl: 'https://en.wikipedia.org/wiki/Ante-Nicene_period' },
  { id: 'era-first-councils', name: 'The First Four Councils',   start: 325,  end: 451,  color: '#b0507a', referenceUrl: 'https://en.wikipedia.org/wiki/First_seven_ecumenical_councils' },
  { id: 'era-early-medieval', name: 'Early Middle Ages',         start: 451,  end: 1000, color: '#3f8f6d', referenceUrl: 'https://en.wikipedia.org/wiki/Early_Middle_Ages' },
  { id: 'era-high-medieval',  name: 'High Middle Ages',          start: 1000, end: 1300, color: '#2f7f9e', referenceUrl: 'https://en.wikipedia.org/wiki/High_Middle_Ages' },
  { id: 'era-late-medieval',  name: 'Late Middle Ages',          start: 1300, end: 1500, color: '#7a6a4a', referenceUrl: 'https://en.wikipedia.org/wiki/Late_Middle_Ages' },
  { id: 'era-renaissance',    name: 'Renaissance & Reformation', start: 1500, end: 1650, color: '#c07a2a', referenceUrl: 'https://en.wikipedia.org/wiki/Reformation' },
  { id: 'era-enlightenment',  name: 'Age of Enlightenment',      start: 1650, end: 1800, color: '#9b4a3a', referenceUrl: 'https://en.wikipedia.org/wiki/Age_of_Enlightenment' },
  { id: 'era-modern',         name: 'Modern Era',                start: 1800, end: null, color: '#4a5560', referenceUrl: 'https://en.wikipedia.org/wiki/Modern_history' },
];

const ERA_BY_ID = new Map(CH2_ERAS.map(era => [era.id, era]));

/** Fallback for rows with no usable date at all. */
const UNDATED_ERA = CH2_ERAS[0];

/**
 * The era a year belongs to.
 *
 * Years before the scheme starts (a handful of emperors are born BC) fall into
 * the first era rather than off the end of the list.
 *
 * @param {number|null|undefined} year
 * @returns {{id: string, name: string, color: string}} never null
 */
export function eraForYear(year) {
  if (year === null || year === undefined || Number.isNaN(year)) return UNDATED_ERA;
  for (const era of CH2_ERAS) {
    if (era.end === null || year < era.end) return era;
  }
  return CH2_ERAS[CH2_ERAS.length - 1];
}

/** @param {string} id @returns {object|null} */
export function eraById(id) {
  return ERA_BY_ID.get(id) || null;
}
