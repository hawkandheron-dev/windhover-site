/**
 * Monarch labels for the background layer.
 *
 * The background canvas draws its bars but no text — blurred labels are noise,
 * so it only labels items that are in focus. That left the reigns anonymous: a
 * band of coloured bars with no way to tell Constantine from Valens without
 * clicking through.
 *
 * These labels are DOM rather than canvas, which buys three things the canvas
 * could not give cheaply: they stay crisp while the bars behind them stay
 * washed, they can be hovered (the background canvas is `pointer-events: none`
 * and sits under the foreground canvas, so it never sees a pointer), and they
 * expand on hover without a repaint.
 *
 * Compact form is the name and the reign — "Constantine 306–337" — which is
 * what a reign band is for. The birth year joins it on hover, where there is
 * room for it.
 */

import { memo } from 'react';
import { Icon } from './Icon.jsx';
import { yearToPixel } from '../utils/coordinates.js';
import { getYearRange } from '../utils/dateUtils.js';
import './MonarchLabels.css';

/**
 * Years are stored as signed integers, so Augustus reigns from -27. Printing
 * that raw gives "Augustus -27–14", which reads as a typo rather than a date.
 */
function formatYear(year) {
  if (year === null || year === undefined) return '';
  return year < 0 ? `${Math.abs(year)} BC` : `${year}`;
}

/** "Constantine 306–337 (b. 272)" — the full form, used as the tooltip. */
function formatMonarchLabel(person) {
  const reign = formatReign(person);
  const birth = person.birthYear ?? null;
  const parts = [person.name];
  if (reign) parts.push(reign);
  const base = parts.join(' ');
  return birth !== null ? `${base} (b. ${formatYear(birth)})` : base;
}

function formatReign(person) {
  const start = person.reignStartYear ?? null;
  const end = person.reignEndYear ?? null;
  if (start === null || end === null) return '';
  // Only the first year carries the era marker unless they differ, so a reign
  // that straddles the turn reads "27 BC–14" rather than "27 BC–14 AD".
  return `${formatYear(start)}–${formatYear(end)}`;
}

/**
 * Memoised, and it has to be: the timeline container tracks the cursor in
 * state, so every mouse move re-renders this subtree. Rebuilding the label
 * nodes under the pointer destroys the :hover that the expansion depends on —
 * the birth year would never appear. None of these props change on a mouse
 * move, so the memo holds the DOM still.
 */
export const MonarchLabels = memo(function MonarchLabels({
  people,
  viewportStartYear,
  yearsPerPixel,
  panOffsetY,
  yOffset = 0,
  width,
  height,
}) {
  if (!people || people.length === 0) return null;

  return (
    <div className="ch2-monarch-labels" aria-hidden="true">
      {people.map(person => {
        if (!person.isMonarch) return null;

        const { start, end } = getYearRange(person.startDate, person.endDate);
        const x = yearToPixel(start, viewportStartYear, yearsPerPixel);
        const barWidth = Math.max(
          yearToPixel(end, viewportStartYear, yearsPerPixel) - x,
          60
        );
        const y = person.y - panOffsetY + yOffset;

        // Cheap cull: anything fully off-screen costs nothing to skip, and the
        // reign band runs the whole two thousand years.
        if (x + barWidth < -40 || x > width + 40) return null;
        if (y < -40 || y > height + 40) return null;

        const reign = formatReign(person);
        const birth = person.birthYear ?? null;

        return (
          <span
            key={person.id}
            className="ch2-monarch-label"
            style={{ left: `${x + 4}px`, top: `${y}px`, maxWidth: `${Math.max(barWidth - 8, 48)}px` }}
            title={formatMonarchLabel(person)}
          >
            <Icon name="crown" size={11} color="#8a6d3b" />
            <span className="ch2-monarch-name">{person.name}</span>
            {reign && <span className="ch2-monarch-reign">{reign}</span>}
            {birth !== null && <span className="ch2-monarch-birth">(b. {formatYear(birth)})</span>}
          </span>
        );
      })}
    </div>
  );
});
