/**
 * The rulers as a strip pinned to the bottom of the timeline
 * (config.rulerStyle === 'strip', a Lifelines prototype, M3 round 3).
 *
 * The rulers otherwise sit in a band just below the axis, where they share
 * the space with the texts' labels and dots and read as clutter. Here they
 * get their own few rows at the foot of the screen: a thin reign bar and a
 * small name each, panning sideways with the timeline but never up or down.
 * Hovering names the ruler; clicking opens them, as anywhere else.
 */
import { useMemo } from 'react';
import { yearToPixel } from '../utils/coordinates.js';
import { packRulerRows, RULER_ROW_HEIGHT, RULER_STRIP_PAD as PAD } from '../utils/rulerStrip.js';
import { Icon } from './Icon.jsx';
import './RulerStrip.css';

export function RulerStrip({ people, viewportStartYear, yearsPerPixel, width, color, focusIds, onItemHover, onItemClick, wasDraggingRef }) {
  const packed = useMemo(() => packRulerRows(people || [], yearsPerPixel), [people, yearsPerPixel]);
  if (!packed.length) return null;
  const rows = Math.max(...packed.map(r => r.row)) + 1;

  return (
    <div
      className="ruler-strip"
      style={{ height: rows * RULER_ROW_HEIGHT + PAD * 2, '--ruler-color': color }}
      aria-label="Emperors and monarchs"
    >
      {packed.map(({ person, row, start, end, room }) => {
        const x0 = yearToPixel(start, viewportStartYear, yearsPerPixel);
        const x1 = yearToPixel(end, viewportStartYear, yearsPerPixel);
        if (x1 < -200 || x0 > width + 10) return null;
        const focused = focusIds?.has(person.id);
        // Under 28px of room there is no name; hovering still names it.
        const roomPx = room / yearsPerPixel - 4;
        const showName = roomPx >= 28;
        return (
          <div
            key={person.id}
            className={`ruler-strip-item${focused ? ' is-focus' : ''}`}
            style={{ left: `${x0}px`, top: `${PAD + row * RULER_ROW_HEIGHT}px` }}
            onMouseEnter={() => onItemHover?.('person', person)}
            onMouseLeave={() => onItemHover?.(null, null)}
            onClick={(e) => { e.stopPropagation(); if (!wasDraggingRef?.current) onItemClick?.('person', person); }}
          >
            <span className="ruler-strip-bar" style={{ width: `${Math.max(x1 - x0, 3)}px` }} />
            {showName && (
              <span className="ruler-strip-name" style={Number.isFinite(roomPx) ? { maxWidth: `${roomPx}px` } : undefined}>
                <Icon name="crown" size={10} color={color} />
                <span className="ruler-strip-name-text">{person.name}</span>
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
