/**
 * How far to lower the background (rulers) band so it starts below the
 * foreground's landmarks under the axis, not in their row.
 *
 * The two layouts are stacked separately and registered on one axis, so the
 * first ruler row and the first row of below-axis landmarks (texts) both sat
 * straight under the axis, one over the other. The drop is the depth of that
 * landmark band below the axis's own year row, plus a little air.
 *
 * @param {{ axisY: number, stackedPoints?: Array, sizes?: { axisHeight?: number } }} layout
 * @param {number} [air=8]
 * @returns {number} px, never negative
 */
export function rulerDropFor(layout, air = 8) {
  const below = (layout?.stackedPoints || []).filter(p => p.aboveTimeline === false);
  if (!below.length) return 0;
  const bottom = Math.max(...below.map(p => p.y + p.height));
  const axisBand = layout.axisY + (layout.sizes?.axisHeight ?? 30);
  return Math.max(0, bottom - axisBand + air);
}
