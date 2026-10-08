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
