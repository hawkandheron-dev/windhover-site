/**
 * Where each harp string's dot goes (config.pointStyle === 'string').
 *
 * A dot is the string's handle: the thing to hover or tap, and the mark that
 * says "here". Two rules (owner's decision, M3):
 *
 * 1. A landmark linked to a figure (CH_EventConnections → point.connectedPeople)
 *    who was alive that year puts its dot on that figure's bar, at the year:
 *    the Council of Nicaea sits on Athanasius. It sits on the bar's lower
 *    edge, like a bead, so it doesn't cover the name written on the bar. If
 *    several linked figures are alive, the bar nearest the axis wins.
 * 2. Anything else goes in open space, never on a bar, because a dot on a
 *    bar reads as "this person was involved". At its x, the dot takes the
 *    free spot nearest the axis on its own side that clears every bar, every
 *    label, and every dot already placed. With nowhere free, it sits on the
 *    axis.
 *
 * All coordinates are screen pixels. Pure and deterministic: the same input
 * always gives the same placement.
 *
 * @param {Array<{id, x, side: 'above'|'below', connectedPeople?: string[], needsDot?: boolean}>} items
 * @param {Object} env
 * @param {Array<{id, x0, x1, y0, y1}>} env.bars      figure bars on screen
 * @param {Array<{x0, x1, y0, y1}>}     [env.labels]  labels to keep clear of
 * @param {number} env.axisY   the axis line
 * @param {number} env.top     highest y a dot may take
 * @param {number} env.bottom  lowest y a dot may take
 * @param {number} [env.gap=14]   minimum distance between two dots
 * @param {number} [env.radius=6] half a dot, plus a little air
 * @returns {Map<id, {x, y, personId?: string}>}
 */
export function placeStringDots(items, { bars, labels = [], axisY, top, bottom, gap = 14, radius = 6 }) {
  const placed = new Map();
  const dots = [];
  const sorted = [...items].sort((a, b) => a.x - b.x || String(a.id).localeCompare(String(b.id)));

  const clearOfDots = (x, y) => dots.every(d => Math.hypot(d.x - x, d.y - y) >= gap);
  const crosses = (rect, x, y) =>
    x + radius > rect.x0 && x - radius < rect.x1 && y + radius > rect.y0 && y - radius < rect.y1;

  for (const item of sorted) {
    if (item.needsDot === false) continue;
    const { x } = item;

    // Rule 1: on a linked figure's bar.
    const linked = new Set(item.connectedPeople || []);
    let best = null;
    if (linked.size) {
      for (const bar of bars) {
        if (!linked.has(bar.id) || x < bar.x0 || x > bar.x1) continue;
        const nearness = Math.abs((bar.y0 + bar.y1) / 2 - axisY);
        if (!best || nearness < best.nearness) best = { bar, nearness };
      }
    }
    if (best) {
      const y = best.bar.y1;
      placed.set(item.id, { x, y, personId: best.bar.id });
      dots.push({ x, y });
      continue;
    }

    // Rule 2: the free spot nearest the axis, on the item's side.
    const dir = item.side === 'below' ? 1 : -1;
    const limit = dir < 0 ? top : bottom;
    let y = null;
    for (let cand = axisY + dir * (radius + 4); dir < 0 ? cand >= limit : cand <= limit; cand += dir * 2) {
      if (bars.some(b => crosses(b, x, cand))) continue;
      if (labels.some(l => crosses(l, x, cand))) continue;
      if (!clearOfDots(x, cand)) continue;
      y = cand;
      break;
    }
    if (y == null) y = axisY;
    placed.set(item.id, { x, y });
    dots.push({ x, y });
  }
  return placed;
}
