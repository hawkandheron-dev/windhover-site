/** Row packing for the rulers' strip (components/RulerStrip.jsx). */
import { getYear } from './dateUtils.js';
import { measureLabel } from './labelFit.js';

export const RULER_ROW_HEIGHT = 18;
const MAX_ROWS = 5;
export const RULER_STRIP_PAD = 6;

const reignOf = (p) => ({
  start: p.reignStartYear ?? getYear(p.startDate),
  end: p.reignEndYear ?? getYear(p.endDate),
});

/** Greedy rows by reign start; a reign takes room for its name too. */
export function packRulerRows(people, yearsPerPixel, maxRows = MAX_ROWS) {
  const sorted = [...people].sort((a, b) => reignOf(a).start - reignOf(b).start || a.name.localeCompare(b.name));
  const rowEnds = [];
  const packed = sorted.map(person => {
    const { start, end } = reignOf(person);
    const nameYears = (measureLabel(person.name, '600 11px') + 24) * yearsPerPixel;
    const reach = Math.max(end, start + nameYears);
    let row = rowEnds.findIndex(e => e + 4 * yearsPerPixel <= start);
    if (row === -1 && rowEnds.length < maxRows) row = rowEnds.length;
    // Every row full here: share the row that frees up first; the name may
    // then be cut by the next reign, as a label is anywhere else.
    if (row === -1) row = rowEnds.indexOf(Math.min(...rowEnds));
    rowEnds[row] = Math.max(rowEnds[row] ?? -Infinity, reach);
    return { person, row, start, end };
  });
  // Room for each name: up to the next reign that starts in its row. A
  // shared row (all five full) cuts the name there rather than writing it
  // over the next one (DESIGN §7: labels never overlap).
  const nextStart = new Map();
  for (let i = packed.length - 1; i >= 0; i--) {
    const item = packed[i];
    item.room = nextStart.has(item.row) ? nextStart.get(item.row) - item.start : Infinity;
    nextStart.set(item.row, item.start);
  }
  return packed;
}

export function rulerStripHeight(people, yearsPerPixel) {
  if (!people?.length) return 0;
  const rows = Math.max(...packRulerRows(people, yearsPerPixel).map(r => r.row)) + 1;
  return rows * RULER_ROW_HEIGHT + RULER_STRIP_PAD * 2;
}

