/**
 * Label fitting for names drawn over bars (config.labelFit === 'fit').
 *
 * A label may run on into empty space but never into the next bar of its row,
 * where the neighbour's own label would cover it. When it doesn't fit, the
 * dates go first, then the name ends in an ellipsis, and below a minimum there
 * is no label at all; hovering the bar still names it.
 */
import { yearToPixel } from './coordinates.js';
import { getYearRange } from './dateUtils.js';

export const LABEL_GAP = 6;        // clear space kept before the next bar
export const LABEL_PADDING = 12;   // a label's own horizontal padding
export const MIN_LABEL_ROOM = 28;  // narrower than this, show no label

let measureCtx = null;
/** Width in px of `text` in Alegreya Sans at e.g. '600 14px'. Cached canvas. */
export function measureLabel(text, weightAndSize) {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  measureCtx.font = `${weightAndSize} 'Alegreya Sans', sans-serif`;
  return measureCtx.measureText(text).width;
}

/**
 * For each person, the x where the next bar in the same row begins, or
 * undefined if nothing follows. Rows are identified by their y, which the
 * layout assigns per row on both sides of the axis.
 */
export function nextBarStartInRow(people, viewportStartYear, yearsPerPixel) {
  const byRow = new Map();
  for (const p of people) {
    const startX = yearToPixel(getYearRange(p.startDate, p.endDate).start, viewportStartYear, yearsPerPixel);
    if (!byRow.has(p.y)) byRow.set(p.y, []);
    byRow.get(p.y).push({ id: p.id, startX });
  }
  const next = new Map();
  for (const row of byRow.values()) {
    row.sort((a, b) => a.startX - b.startX);
    for (let i = 0; i < row.length; i++) next.set(row[i].id, row[i + 1]?.startX);
  }
  return next;
}

/**
 * Room a harp string's label takes beside its line (pointStyle 'string'):
 * 4px off the line, the 8px mark and its gap (22px with the label's padding),
 * then the name at 600 12px. The layout stacks labels by this, and the
 * overlay places them by it, so the two agree about what collides.
 */
export function stringLabelWidth(point) {
  return 4 + 22 + measureLabel(point.name || '', '600 12px');
}

/** Clear space between one string label and the next in its row. */
export const STRING_LABEL_GAP = 8;

/** stringLabelWidth plus the gap: what one label claims in its row. */
export function stringLabelSpan(point) {
  return stringLabelWidth(point) + STRING_LABEL_GAP;
}

/**
 * The view that fits a selected figure's whole label inside their bar
 * (config.selectFitsName, owner 2026-10-09), or null when it already fits.
 * Only ever zooms in, never past minYearsPerPixel. The bar's middle stays
 * where it is on screen, nudged in so the whole bar shows within `margin`.
 *
 * @param {{start: number, end: number, labelWidth: number, yearsPerPixel: number,
 *   viewportStartYear: number, width: number, minYearsPerPixel?: number, margin?: number}} p
 * @returns {{yearsPerPixel: number, startYear: number} | null}
 */
export function viewFittingLabel({ start, end, labelWidth, yearsPerPixel, viewportStartYear, width, minYearsPerPixel = 0.1, margin = 24 }) {
  const span = Math.max(end - start, 1);
  // The label sits 4px in from the bar's start; leave as much again after it.
  const need = labelWidth + 8;
  if (span / yearsPerPixel >= need) return null;
  const ypp = Math.max(span / need, minYearsPerPixel);
  if (ypp >= yearsPerPixel) return null;
  const mid = (start + end) / 2;
  const half = span / ypp / 2;
  const x = Math.min(Math.max((mid - viewportStartYear) / yearsPerPixel, margin + half), width - margin - half);
  return { yearsPerPixel: ypp, startYear: mid - x * ypp };
}
