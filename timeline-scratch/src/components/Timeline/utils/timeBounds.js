/**
 * How far a timeline can be panned and zoomed out (config.timeBounds,
 * Lifelines; owner 2026-10-10). It starts `before` years ahead of the
 * earliest entry, rounded to `roundTo`, so the floor follows the data as
 * entries are added. It ends at `end` (AD 2100: readers want to see how far
 * the story is from now), or `before` years past the latest entry if that is
 * later.
 *
 * @param {{earliest: number, latest: number, before?: number, roundTo?: number, end?: number}} p
 * @returns {{minYear: number, maxYear: number}}
 */
export function timeBounds({ earliest, latest, before = 100, roundTo = 50, end = 2100 }) {
  const minYear = Math.round((earliest - before) / roundTo) * roundTo;
  const maxYear = Math.max(end, Math.ceil((latest + before) / roundTo) * roundTo);
  return { minYear, maxYear };
}

/** The earliest and latest years among a dataset's people and points. */
export function dataYearExtent(data, getYear) {
  let earliest = Infinity;
  let latest = -Infinity;
  for (const p of data?.people || []) {
    const s = getYear(p.startDate);
    const e = getYear(p.endDate);
    if (s != null && s < earliest) earliest = s;
    if (e != null && e > latest) latest = e;
  }
  for (const pt of data?.points || []) {
    const y = getYear(pt.date);
    const e = pt.endDate ? getYear(pt.endDate) : y;
    if (y != null && y < earliest) earliest = y;
    if (e != null && e > latest) latest = e;
  }
  return { earliest, latest };
}
