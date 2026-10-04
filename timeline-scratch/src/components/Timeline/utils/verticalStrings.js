/**
 * Harp-string labels for the vertical (phone) timeline.
 *
 * Each landmark is a horizontal string at its year; its label sits in a
 * column beside the year axis, its first line level with the string. Labels
 * are kept in year order and a label that would run into the one above it is
 * dropped (DESIGN.md §7: "A label that would collide with the one before it
 * is dropped"). Its string and mark stay, so it can still be tapped; zooming
 * in spreads the years and brings the label back.
 *
 * Marks sit at the column's inner edge, where the string starts. Marks closer
 * than `markGap` px to one already placed step sideways onto the string
 * (`markSlot` 1, 2, …) so two landmarks in the same year are both tappable.
 *
 * Heights are estimated from the name's length rather than measured, so the
 * layout is pure and the same on every render: `charsPerLine` characters to a
 * line, wrapping at spaces, at most `maxLines` lines (the label clamps to
 * that in CSS). It errs long: a label given too much room only drops a
 * neighbour, one given too little overlaps it.
 */
export function placeVerticalLabels(points, yearToY, {
  charsPerLine = 14,
  lineHeight = 14,
  maxLines = 3,
  padding = 4,
  gap = 3,
  firstLineOffset = 8,
  markGap = 11,
  maxSlots = 4,
} = {}) {
  const placed = points
    .map(point => ({ point, y: yearToY(point.year) }))
    .filter(entry => Number.isFinite(entry.y))
    .sort((a, b) => a.y - b.y || String(a.point.id).localeCompare(String(b.point.id)));

  let lastBottom = -Infinity;
  const slotLastY = [];
  return placed.map(({ point, y }) => {
    let markSlot = 0;
    while (markSlot < maxSlots - 1 && slotLastY[markSlot] != null && y - slotLastY[markSlot] < markGap) markSlot++;
    slotLastY[markSlot] = y;
    const lines = Math.min(maxLines, wrappedLines(point.name, charsPerLine));
    const labelHeight = lines * lineHeight + padding;
    const labelTop = y - firstLineOffset;
    const showLabel = labelTop >= lastBottom + gap;
    if (showLabel) lastBottom = labelTop + labelHeight;
    return { id: point.id, y, labelTop, labelHeight, lines, showLabel, markSlot };
  });
}

/** Lines a name takes when wrapped at spaces, `width` characters to a line. */
export function wrappedLines(name, width) {
  let lines = 1;
  let used = 0;
  for (const word of String(name || '').split(/\s+/).filter(Boolean)) {
    const len = word.length;
    if (used === 0) {
      lines += Math.floor(Math.max(0, len - 1) / width);
      used = len % width || width;
    } else if (used + 1 + len <= width) {
      used += 1 + len;
    } else {
      lines += 1 + Math.floor(Math.max(0, len - 1) / width);
      used = len % width || width;
    }
  }
  return lines;
}
