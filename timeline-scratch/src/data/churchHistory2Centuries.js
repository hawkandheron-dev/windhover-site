/**
 * Century colouring for CH Timeline 2.0.
 *
 * Replaces the era scheme as the colour model. A century is a fact about a
 * date — it needs no editorial judgement, no lookup table of boundaries, and
 * no migration when the periodisation changes its mind. Eras remain in
 * churchHistory2Eras.js, dormant, if we want them back.
 *
 * The ramp runs cool to warm across the sixteen centuries the data covers,
 * held near one luminance so no century shouts over its neighbours. Jesus sits
 * in the first, in blue.
 *
 * A lifespan inside one century takes that century's colour. One that crosses
 * a boundary — most of them — is drawn as a gradient from the century it began
 * in to the century it ended in, so the bar itself shows the crossing.
 */

/**
 * Index 0 is the 1st century (years 1–100). Deliberately muted: these sit
 * behind labels and beside a blurred background layer, and a saturated ramp at
 * this density reads as noise.
 */
export const CENTURY_COLORS = [
  '#4a72c4', // 1st  — Jesus, the apostles
  '#4f6ab8', // 2nd
  '#5463ab', // 3rd
  '#59609d', // 4th  — Nicaea, the Cappadocians
  '#4f6f96', // 5th  — Chalcedon, Augustine
  '#44808f', // 6th
  '#3d8a84', // 7th
  '#3f8f77', // 8th
  '#4a9268', // 9th
  '#5c9159', // 10th
  '#718d4e', // 11th
  '#8a8747', // 12th
  '#a07d42', // 13th — the scholastics
  '#b06e3f', // 14th
  '#b85c3d', // 15th
  '#b84a3f', // 16th — the Reformation
];

/** Later centuries keep walking warm, in case the cull is ever reversed. */
const OVERFLOW_COLOR = '#a8413f';

/**
 * The century a year belongs to, 1-based: year 1–100 → 1, 101–200 → 2.
 *
 * Years before AD 1 clamp to the first century. A handful of emperors are born
 * BC, and "century −1" would be both correct and useless here.
 */
export function centuryOf(year) {
  if (year === null || year === undefined || Number.isNaN(year)) return 1;
  if (year < 1) return 1;
  return Math.floor((year - 1) / 100) + 1;
}

/** @param {number} century 1-based @returns {string} hex */
export function colorForCentury(century) {
  if (century < 1) return CENTURY_COLORS[0];
  return CENTURY_COLORS[century - 1] || OVERFLOW_COLOR;
}

/**
 * The fill for one lifespan.
 *
 * @returns {{color: string, gradient?: {from: string, to: string}}}
 *   `color` is always set — it is what a renderer without gradient support
 *   falls back to, and what the legend and search results use. `gradient` is
 *   present only when the life crosses a century boundary.
 */
export function colorForLifespan(birthYear, deathYear) {
  const from = colorForCentury(centuryOf(birthYear));
  const to = colorForCentury(centuryOf(deathYear ?? birthYear));
  if (from === to) return { color: from };
  return { color: from, gradient: { from, to } };
}

/** Ticks for the legend's ramp strip: every other century, plus the last. */
export function centuryLegendTicks() {
  const ticks = [];
  for (let c = 1; c <= CENTURY_COLORS.length; c += 3) ticks.push(c);
  if (ticks[ticks.length - 1] !== CENTURY_COLORS.length) ticks.push(CENTURY_COLORS.length);
  return ticks;
}

/** "4th", "11th", "22nd" — for legend ticks and the detail panel. */
export function ordinal(n) {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}
