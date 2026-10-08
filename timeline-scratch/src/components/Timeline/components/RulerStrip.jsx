/**
 * The rulers as a strip pinned to the bottom of the timeline
 * (config.rulerStyle === 'strip', Lifelines).
 *
 * The rulers otherwise sit in a band just below the axis, where they share
 * the space with the texts' labels and dots and read as clutter. Here they
 * get their own few rows at the foot of the screen: a reign bar and a name
 * each, panning sideways with the timeline but never up or down. Hovering
 * names the ruler; clicking opens them, as anywhere else.
 *
 * A tab on its top edge folds it to a single line of reign bars, for a
 * reader who wants the room (`folded`, remembered by the parent); the Key's
 * switch still hides it outright.
 */
import { useMemo } from 'react';
import { yearToPixel } from '../utils/coordinates.js';
import {
  packRulerRows, RULER_ROW_HEIGHT, RULER_STRIP_PAD as PAD, RULER_NAME_FONT, RULER_FOLDED_HEIGHT,
} from '../utils/rulerStrip.js';
import { Icon } from './Icon.jsx';
import './RulerStrip.css';

export function RulerStrip({ people, viewportStartYear, yearsPerPixel, width, color, focusIds, onItemHover, onItemClick, wasDraggingRef, folded = false, onToggleFold }) {
  const packed = useMemo(() => packRulerRows(people || [], yearsPerPixel, undefined, RULER_NAME_FONT), [people, yearsPerPixel]);
  if (!packed.length) return null;
  const rows = Math.max(...packed.map(r => r.row)) + 1;
  const height = folded ? RULER_FOLDED_HEIGHT : rows * RULER_ROW_HEIGHT + PAD * 2;

  return (
    <div className={`ruler-strip-wrap${folded ? ' is-folded' : ''}`} style={{ height, '--ruler-color': color }}>
      {onToggleFold && (
        <button
          type="button"
          className="ruler-strip-tab"
          onClick={(e) => { e.stopPropagation(); onToggleFold(); }}
          aria-expanded={!folded}
          title={folded ? 'Show the emperors and monarchs' : 'Fold the emperors and monarchs to a line'}
        >
          <Icon name="crown" size={11} color={color} />
          Emperors
          <span className="ruler-strip-tab-chevron" aria-hidden="true">{folded ? '▸' : '▾'}</span>
        </button>
      )}
      <div className="ruler-strip" aria-label="Emperors and monarchs">
        {packed.map(({ person, row, start, end, room }) => {
          const x0 = yearToPixel(start, viewportStartYear, yearsPerPixel);
          const x1 = yearToPixel(end, viewportStartYear, yearsPerPixel);
          if (x1 < -200 || x0 > width + 10) return null;
          const focused = focusIds?.has(person.id);
          // Under 28px of room there is no name; hovering still names it.
          const roomPx = room / yearsPerPixel - 4;
          const showName = !folded && roomPx >= 28;
          return (
            <div
              key={person.id}
              className={`ruler-strip-item${focused ? ' is-focus' : ''}`}
              style={{ left: `${x0}px`, top: folded ? '4px' : `${PAD + row * RULER_ROW_HEIGHT}px` }}
              onMouseEnter={() => onItemHover?.('person', person)}
              onMouseLeave={() => onItemHover?.(null, null)}
              onClick={(e) => { e.stopPropagation(); if (!wasDraggingRef?.current) onItemClick?.('person', person); }}
            >
              <span className="ruler-strip-bar" style={{ width: `${Math.max(x1 - x0, 3)}px` }} />
              {showName && (
                <span className="ruler-strip-name" style={Number.isFinite(roomPx) ? { maxWidth: `${roomPx}px` } : undefined}>
                  <Icon name="crown" size={12} color={color} />
                  <span className="ruler-strip-name-text">{person.name}</span>
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
