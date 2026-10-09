/**
 * SVG/HTML overlay layer for labels and previews
 */

import { yearToPixel } from '../utils/coordinates.js';
import { getYear, getYearRange, formatYear } from '../utils/dateUtils.js';
import { Icon, ShapeIcon } from './Icon.jsx';
import { useState } from 'react';
import './TimelineOverlay.css';
import { placeStringDots } from '../utils/stringDots.js';
import { StringMark } from './StringMark.jsx';
import { markForPoint } from '../utils/stringMark.js';
import { usePointer } from '../hooks/usePointer.js';
import { LABEL_GAP, LABEL_PADDING, MIN_LABEL_ROOM, measureLabel, nextBarStartInRow, stringLabelWidth, STRING_LABEL_GAP } from '../utils/labelFit.js';

// A string's label starts so that its mark (8px, after the label's 4px
// padding) sits centred on the line: the mark reads as the string's own
// marker at its year (owner, 2026-10-08: the Crucifixion's mark sat ~12px
// right of the line, so it looked later than the end of Jesus' bar).
const LABEL_OFFSET = -8;

export function TimelineOverlay({
  width,
  height,
  viewportStartYear,
  yearsPerPixel,
  panOffsetY,
  layout,
  config,
  hoveredItem,
  /** Pointer store (utils/pointerStore.js): the hover card follows it. */
  pointer,
  hoveredPeriod,
  onItemHover,
  onItemClick,
  wasDraggingRef,
  animatingPointIds,
  isTourMode,
  // Optional colour overrides. Absent means the light-on-dark labels every
  // timeline before CH 2.0 used; that page reads on a white ground instead.
  palette = {},
  // When false, points draw as a bare pin rather than a pin-and-flag card.
  // A labelled callout is sized by its text, so a few dozen of them zoomed out
  // stack into a wall; the pin alone keeps the landmark visible at a width the
  // layout can collapse. Defaults true, so every other timeline is unchanged.
  showPointLabels = true,
  // The focus set (CH Timeline 2.0): with harp strings, a focused figure's
  // councils and texts darken and the rest recede.
  focusIds = null,
  /** With revealWave (ms), these people and animatingPointIds' landmarks fade
   *  in as the canvas's grow wave reaches them (Lifelines' tour exit). */
  revealIds,
  revealWave,
  /** The rulers' band below the axis ({ layout, yOffset }): texts' dots
   *  keep clear of its bars and names. */
  backObstacles = null,
  /** The open figure (Lifelines, config.selectedRing): their bar keeps a
   *  gold ring, the same one a hovered string gives its people. */
  selectedPersonId = null,
}) {
  // A label's reveal: a fade that starts when the wave reaches its x.
  const revealStyle = (id, ids, x) => {
    if (!revealWave || !ids?.has(id)) return null;
    const delay = Math.round(revealWave * Math.min(Math.max(x / Math.max(width, 1), 0), 1)) + 250;
    return { animation: `timeline-reveal 450ms ease-out ${delay}ms both` };
  };
  // The harp string under the pointer (string, label or dot): it turns gold.
  const [hoverStringId, setHoverStringId] = useState(null);
  // Get hovered period date range for highlighting
  const hoveredPeriodRange = hoveredPeriod ? getYearRange(hoveredPeriod.startDate, hoveredPeriod.endDate) : null;

  // Check if an item falls within the hovered period
  const isInHoveredPeriod = (startYear, endYear) => {
    if (!hoveredPeriodRange) return true; // No period hovered, all items are "in"
    return startYear <= hoveredPeriodRange.end && endYear >= hoveredPeriodRange.start;
  };

  // Get opacity for a person based on period highlighting and monarch dimming
  const getPersonOpacity = (person) => {
    if (hoveredPeriod) {
      const { start, end } = getYearRange(person.startDate, person.endDate);
      return isInHoveredPeriod(start, end) ? 1 : 0.3;
    }
    // Monarchs are dimmed unless hovered
    if (person.isMonarch) {
      return (hoveredItem?.item?.id === person.id && hoveredItem?.type === 'person') ? 1 : 0.4;
    }
    return 1;
  };

  // Get opacity for a point based on period highlighting
  const getPointOpacity = (point) => {
    if (!hoveredPeriod) return 1;
    const year = getYearRange(point.date).start;
    return isInHoveredPeriod(year, year) ? 1 : 0.3;
  };

  // Get opacity for a period label
  const getPeriodOpacity = (period) => {
    if (!hoveredPeriod) return 1;
    return hoveredPeriod.id === period.id ? 1 : 0.3;
  };
  const parseColor = (color) => {
    if (!color) return null;

    const normalized = color.trim().toLowerCase();
    let r, g, b;

    if (normalized.startsWith('#')) {
      let hex = normalized.slice(1);
      if (hex.length === 3) {
        hex = hex.split('').map((value) => value + value).join('');
      }
      if (hex.length === 6) {
        r = parseInt(hex.slice(0, 2), 16);
        g = parseInt(hex.slice(2, 4), 16);
        b = parseInt(hex.slice(4, 6), 16);
      }
    } else if (normalized.startsWith('rgb')) {
      const matches = normalized.match(/\d+(\.\d+)?/g);
      if (matches && matches.length >= 3) {
        r = Number(matches[0]);
        g = Number(matches[1]);
        b = Number(matches[2]);
      }
    }

    if ([r, g, b].some((value) => Number.isNaN(value) || value === undefined)) {
      return null;
    }

    return { r, g, b };
  };

  const getLabelTextColor = (backgroundColor) => {
    const rgb = parseColor(backgroundColor);
    if (!rgb) return '#fff';

    const toLinear = (value) => {
      const channel = value / 255;
      return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
    };

    const luminance = 0.2126 * toLinear(rgb.r) + 0.7152 * toLinear(rgb.g) + 0.0722 * toLinear(rgb.b);

    return luminance > 0.6 ? '#000' : '#fff';
  };

  const getLabelBackground = (backgroundColor, alpha = 0.85) => {
    const rgb = parseColor(backgroundColor);
    if (!rgb) return backgroundColor || `rgba(0, 0, 0, ${alpha})`;

    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
  };

  return (
    <div
      className="timeline-overlay"
      style={{
        width: `${width}px`,
        height: `${height}px`,
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none'
      }}
    >
      {/* Render people labels (sticky) */}
      {renderPeopleLabels()}

      {/* Render period labels */}
      {renderPeriodLabels()}

      {/* Render point callouts */}
      {config.pointStyle === 'string' ? renderPointStrings() : renderPointCallouts()}
      {selectedPersonId && renderSelectedRing()}

      {/* Render hover preview */}
      {hoveredItem?.item && (
        <HoverPreview item={hoveredItem.item} pointer={pointer} width={width} eraLabels={config.eraLabels} />
      )}
    </div>
  );

  function renderPeopleLabels() {
    const people = layout.stackedPeople || [];
    // config.labelFit === 'fit' (Lifelines): a label may run on into empty
    // space but never into the next bar of its row, where the neighbour's
    // label would cover it ("lement of Rome", "Thomas Bradwar").
    const fit = config.labelFit === 'fit';
    const nextStartById = fit ? nextBarStartInRow(people, viewportStartYear, yearsPerPixel) : null;

    return people.map(person => {
      const { start, end } = getYearRange(person.startDate, person.endDate);

      const startX = yearToPixel(start, viewportStartYear, yearsPerPixel);
      const endX = yearToPixel(end, viewportStartYear, yearsPerPixel);
      const boxY = person.y - panOffsetY;

      // Position label at left of the box, vertically centered
      let labelX = startX + 4;
      const labelY = boxY + 3;

      // Sticky behavior: stick to left edge if box extends left of viewport
      const isSticky = startX < 0 && endX > 0;
      if (isSticky) {
        labelX = 10; // Stick to left edge with padding
      }

      // Hide if completely off screen
      if (endX < 0 || startX > width) {
        return null;
      }

      // Bare years unless BC is involved, when both ends carry their era.
      const showAD = start <= 0 || end <= 0;
      const startText = formatYear(start, config.eraLabels, { showAD });
      const endText = formatYear(end, config.eraLabels, { showAD });
      let yearRange = startText !== endText ? `${startText}–${endText}` : startText;

      // Fitting: drop the dates first, then end the name in an ellipsis, and
      // give up on a label with no real room; hovering still names the bar.
      let maxWidth;
      if (fit) {
        const nextStart = nextStartById.get(person.id);
        const room = (nextStart ?? Infinity) - labelX - LABEL_GAP;
        const crown = person.isMonarch ? 16 : 0;
        const nameWidth = crown + measureLabel(person.name, '600 14px') + LABEL_PADDING;
        const fullWidth = nameWidth + 4 + measureLabel(yearRange, '500 11px');
        if (fullWidth > room) yearRange = null;
        if (nameWidth > room) {
          if (room < MIN_LABEL_ROOM) return null;
          maxWidth = room;
        }
      }

      return (
        <div
          key={person.id}
          className="person-label"
          style={{
            position: 'absolute',
            left: `${labelX}px`,
            top: `${labelY}px`,
            pointerEvents: 'none',
            fontSize: '14px',
            fontWeight: '600',
            color: palette.labelText || '#fff',
            backgroundColor: palette.labelBg || 'rgba(0, 0, 0, 0.75)',
            padding: '2px 6px',
            borderRadius: '3px',
            whiteSpace: 'nowrap',
            zIndex: isSticky ? 10 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            opacity: getPersonOpacity(person),
            transition: 'opacity 0.15s ease',
            lineHeight: '1.3',
            ...revealStyle(person.id, revealIds, startX),
            ...(maxWidth !== undefined && { maxWidth: `${maxWidth}px`, boxSizing: 'border-box' }),
          }}
        >
          {person.isMonarch && (
            <Icon name="crown" size={12} color="#ffd700" />
          )}
          <span style={maxWidth !== undefined ? { overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 } : undefined}>
            {person.name}
          </span>
          {yearRange && (
            <span style={{ opacity: 0.7, fontSize: '11px', fontWeight: '500' }}>
              {yearRange}
            </span>
          )}
        </div>
      );
    });
  }

  function renderPeriodLabels() {
    const periods = layout.stackedPeriods || [];

    return periods.map(period => {
      const { start, end } = getYearRange(period.startDate, period.endDate);

      const startX = yearToPixel(start, viewportStartYear, yearsPerPixel);
      const endX = yearToPixel(end, viewportStartYear, yearsPerPixel);
      const centerX = (startX + endX) / 2;
      const bracketY = period.y - panOffsetY;
      const bracketHeight = period.bracketHeight ?? period.height;

      // Hide if completely off screen
      if (endX < 0 || startX > width) {
        return null;
      }

      // Label position: on outer side of bracket, with margin from bracket point
      // For above timeline, label goes above bracket; for below, label goes below
      const labelMargin = 1;  // Margin between label and bracket point
      const bracketPointY = period.aboveTimeline
        ? bracketY
        : bracketY + bracketHeight;
      const labelOffsetY = period.aboveTimeline ? -labelMargin : labelMargin;

      let labelX = centerX;

      // Sticky behavior: when center point scrolls off viewport, stick label to edge
      // but keep it within the bracket bounds
      const isLeftSticky = centerX < 0 && endX > 0;
      const isRightSticky = centerX > width && startX < width;

      if (isLeftSticky) {
        labelX = Math.max(10, startX); // Stick to left edge but not before start
      } else if (isRightSticky) {
        labelX = Math.min(width - 10, endX); // Stick to right edge but not after end
      }

      const labelBackground = period.color || '#00838f';
      const labelTextColor = getLabelTextColor(labelBackground);
      const labelBackgroundColor = getLabelBackground(labelBackground);

      return (
        <div
          key={period.id}
          className="period-label"
          style={{
            position: 'absolute',
            left: `${labelX}px`,
            top: `${bracketPointY + labelOffsetY}px`,
            transform: period.aboveTimeline ? 'translate(-50%, -100%)' : 'translateX(-50%)',
            pointerEvents: 'none',
            fontSize: '14px',
            fontWeight: '600',
            color: labelTextColor,
            backgroundColor: labelBackgroundColor,
            padding: '1px 6px',
            borderRadius: '2px',
            whiteSpace: 'nowrap',
            zIndex: (isLeftSticky || isRightSticky) ? 10 : 1,
            textShadow: '0 0 2px rgba(0, 0, 0, 0.3)',
            opacity: getPeriodOpacity(period),
            transition: 'opacity 0.15s ease'
          }}
        >
          {period.name}
        </div>
      );
    });
  }

  /**
   * Harp strings (config.pointStyle === 'string', Lifelines). Each landmark
   * is a thin line through the whole timeline at its year, so it reads
   * against every life it crosses, with a label beside the axis: councils
   * and events above, texts below, in config.pointLabelRows rows a side (the
   * layout stacks them by width; see stringLabelWidth). A label that still
   * collides with the one before it in its row is dropped. Each string also has a dot, its handle:
   * on a linked figure's bar, or in open space (utils/stringDots.js). The
   * line, label and dot all hover gold together and open the landmark.
   */
  function renderPointStrings() {
    const points = layout.stackedPoints || [];
    const focusActive = focusIds && focusIds.size > 0;
    // Right edge of the last label placed, per side and row.
    const lastRight = new Map();
    const axisScreenY = (layout.axisY ?? 0) - panOffsetY;
    const visible = points
      .map(point => ({ point, x: yearToPixel(getYearRange(point.date).start, viewportStartYear, yearsPerPixel) }))
      .filter(({ x }) => x >= -20 && x <= width + 20)
      .sort((a, b) => a.x - b.x);

    // Labels first, in the rows the layout gave them; one that would still
    // collide with its neighbour (more labels than rows) is dropped.
    const labelled = visible.map(({ point, x }) => {
      const side = point.aboveTimeline === false ? 'below' : 'above';
      const rowY = point.y - panOffsetY + point.height / 2;
      const labelWidth = stringLabelWidth(point) - 4;
      const rowKey = `${side}:${point.row ?? 0}`;
      const left = x + LABEL_OFFSET;
      const showLabel = left >= (lastRight.get(rowKey) ?? -Infinity) + STRING_LABEL_GAP && left + labelWidth <= width;
      if (showLabel) lastRight.set(rowKey, left + labelWidth);
      return { point, x, side, rowY, showLabel, labelRect: showLabel ? { x0: left, x1: left + labelWidth, y0: rowY - 11, y1: rowY + 11 } : null };
    });

    // Then the dots (utils/stringDots.js): on a linked figure's bar, or in
    // open space. A labelled landmark with no living linked figure needs no
    // dot; its label already marks the spot.
    const bars = (layout.stackedPeople || []).map(person => {
      const { start, end } = getYearRange(person.startDate, person.endDate);
      const x0 = yearToPixel(start, viewportStartYear, yearsPerPixel);
      const x1 = Math.max(yearToPixel(end, viewportStartYear, yearsPerPixel), x0 + 60);
      const y0 = person.y - panOffsetY;
      return { id: person.id, x0, x1, y0, y1: y0 + person.height - 6 };
    });
    const dots = placeStringDots(
      labelled.map(({ point, x, side, showLabel }) => {
        const alive = (point.connectedPeople || []).some(id => bars.some(b => b.id === id && x >= b.x0 && x <= b.x1));
        return { id: point.id, x, side, connectedPeople: point.connectedPeople, needsDot: !showLabel || alive };
      }),
      {
        bars,
        labels: [
          ...labelled.filter(l => l.labelRect).map(l => l.labelRect),
          // The axis's year labels.
          { x0: -Infinity, x1: Infinity, y0: axisScreenY, y1: axisScreenY + (layout.sizes?.axisHeight ?? 30) },
          // The rulers' bars and names, so texts' dots don't land on them.
          ...(backObstacles?.layout?.stackedPeople || []).map(ruler => {
            const { start, end } = getYearRange(ruler.startDate, ruler.endDate);
            const rx0 = yearToPixel(start, viewportStartYear, yearsPerPixel);
            const rx1 = Math.max(yearToPixel(end, viewportStartYear, yearsPerPixel), rx0 + 16 + measureLabel(ruler.name, '600 11px') + 40);
            const ry0 = ruler.y - panOffsetY + backObstacles.yOffset;
            return { x0: rx0, x1: rx1, y0: ry0, y1: ry0 + ruler.height - 2 };
          }),
        ],
        axisY: axisScreenY,
        top: 0,
        // Below the axis a dot stays within the texts' label rows; past them,
        // it would float among the rulers or below them, far from its line.
        bottom: axisScreenY + (layout.sizes?.axisHeight ?? 30) + 24
          + (layout.sizes?.pointRowHeight ?? 20) * Math.max(1, ...visible.filter(v => v.point.aboveTimeline === false).map(v => (v.point.row ?? 0) + 1)),
      },
    );

    // Vertical runs at x that no bar covers, for the strings' hit strips.
    const openRuns = (x) => {
      const covered = bars.filter(b => x >= b.x0 - 4 && x <= b.x1 + 4).map(b => [b.y0, b.y1]).sort((a, b) => a[0] - b[0]);
      const runs = [];
      let y = 0;
      for (const [y0, y1] of covered) {
        if (y0 > y) runs.push([y, y0]);
        y = Math.max(y, y1);
      }
      if (y < height) runs.push([y, height]);
      return runs.filter(([a, b]) => b - a >= 4);
    };

    return labelled.map(({ point, x, rowY, showLabel }) => {
      const inFocus = focusActive && focusIds.has(point.id);
      const hovered = hoverStringId === point.id;
      const mark = markForPoint(point);
      const open = (e) => { e.stopPropagation(); if (!wasDraggingRef?.current) onItemClick?.('point', point); };
      const enter = () => { setHoverStringId(point.id); onItemHover?.('point', point); };
      const leave = () => { setHoverStringId(id => (id === point.id ? null : id)); onItemHover?.(null, null); };
      const handlers = { onMouseEnter: enter, onMouseLeave: leave, onClick: open };
      const pointDots = dots.get(point.id) || [];

      return (
        <div key={point.id} style={revealStyle(point.id, animatingPointIds, x) || undefined}>
          {/* The line is drawn on the canvas, behind every bar, including
              when its figure is in focus (TimelineCanvas, pointStyle
              'string'). Only the hovered one is drawn here, over everything. */}
          {hovered && (
            <div className="point-string is-hover" data-point-id={point.id} style={{ left: `${x}px` }} />
          )}
          {/* While a string is hovered, the figures linked to it light up: a
              gold ring around each one's bar (owner's call, round 5). */}
          {hovered && bars
            .filter(b => (point.connectedPeople || []).includes(b.id) && b.x1 > 0 && b.x0 < width)
            .map(b => (
              <div
                key={`ring-${b.id}`}
                className="point-string-person-ring"
                data-person-id={b.id}
                style={{ left: `${b.x0 - 3}px`, top: `${b.y0 - 3}px`, width: `${b.x1 - b.x0 + 6}px`, height: `${b.y1 - b.y0 + 6}px` }}
              />
            ))}
          {/* The line itself is a target too: a strip a few pixels wide, but
              only between bars. Over a bar, the bar keeps the pointer. */}
          {openRuns(x).map(([y0, y1]) => (
            <div key={y0} className="point-string-hit" data-point-id={point.id} style={{ left: `${x}px`, top: `${y0}px`, height: `${y1 - y0}px` }} aria-hidden="true" {...handlers} />
          ))}
          {showLabel && (
            <div
              className={`point-string-label${inFocus ? ' is-focus' : ''}${hovered ? ' is-hover' : ''}`}
              style={{ left: `${x + LABEL_OFFSET}px`, top: `${rowY}px`, opacity: focusActive && !inFocus ? 0.5 : 1 }}
              {...handlers}
            >
              <StringMark mark={mark} color={point.color} size={8} />
              {/* The full name, the same at rest and on hover (owner's call,
                  round 4: a label that changed under the pointer was odd). */}
              <span>{point.name}</span>
            </div>
          )}
          {pointDots.map(dot => (
            <div
              key={dot.personId || 'open'}
              className={`point-string-dot point-string-dot--${mark}${hovered ? ' is-hover' : ''}${dot.personId ? ' is-linked' : ''}`}
              style={{ left: `${dot.x}px`, top: `${dot.y}px`, background: point.color }}
              data-point-id={point.id}
              data-person-id={dot.personId}
              {...handlers}
            />
          ))}
        </div>
      );
    });
  }

  function renderSelectedRing() {
    const person = (layout.stackedPeople || []).find(p => p.id === selectedPersonId);
    if (!person) return null;
    const { start, end } = getYearRange(person.startDate, person.endDate);
    const x0 = yearToPixel(start, viewportStartYear, yearsPerPixel);
    const x1 = Math.max(yearToPixel(end, viewportStartYear, yearsPerPixel), x0 + 60);
    const y0 = person.y - panOffsetY;
    const y1 = y0 + person.height - 6;
    if (x1 < 0 || x0 > width) return null;
    return (
      <div
        className="point-string-person-ring is-selected"
        data-person-id={person.id}
        style={{ left: `${x0 - 3}px`, top: `${y0 - 3}px`, width: `${x1 - x0 + 6}px`, height: `${y1 - y0 + 6}px` }}
      />
    );
  }

  function renderPointCallouts() {
    const points = layout.stackedPoints || [];

    return points.map(point => {
      const year = getYearRange(point.date).start;

      const x = yearToPixel(year, viewportStartYear, yearsPerPixel);
      const y = point.y - panOffsetY + (point.height / 2);

      // Hide if off screen
      if (x < -50 || x > width + 50) {
        return null;
      }

      // Format date display - support date ranges for documents
      let dateDisplay;
      if (point.endDate) {
        // Date range (e.g., documents with early/late dates); BC marked, AD bare.
        const endYear = getYearRange(point.endDate).start;
        const bare = { showAD: false };
        dateDisplay = `${formatYear(year, config.eraLabels, bare)}-${formatYear(endYear, config.eraLabels, bare)}`;
      } else {
        dateDisplay = formatYear(year, config.eraLabels);
      }

      const isNewPoint = animatingPointIds?.has(point.id);
      const pointAnimClass = isNewPoint
        ? (isTourMode ? ' point-drop-in' : ' point-pop-in')
        : '';

      // One card style at both detail levels. Collapsed, the CSS strips the
      // background and clips the width to the icon; the padding and the 1px
      // border stay (transparent) so the icon does not jump when the label
      // slides out on hover.
      const flagStyle = {
        color: '#333',
        backgroundColor: 'rgba(255, 255, 255, 0.92)',
        padding: '2px 6px',
        border: '1px solid #ccc',
        boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
      };

      return (
        <div
          key={point.id}
          className={`point-callout${pointAnimClass}${showPointLabels ? '' : ' point-callout--collapsed'}`}
          style={{
            position: 'absolute',
            left: `${x}px`,
            top: `${y - 18}px`,
            zIndex: Math.round(y),
            overflow: 'visible',
            pointerEvents: 'auto',
            cursor: 'pointer',
            borderRadius: '2px',
            whiteSpace: 'nowrap',
            opacity: getPointOpacity(point),
            transition: 'opacity 0.15s ease',
            lineHeight: '1.2',
            ...flagStyle,
          }}
          onMouseEnter={() => onItemHover?.('point', point)}
          onMouseLeave={() => onItemHover?.(null, null)}
          onClick={(e) => { e.stopPropagation(); if (!wasDraggingRef?.current) onItemClick?.('point', point); }}
        >
          <div className="point-callout-body" style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            <ShapeIcon shape={point.shape || 'circle'} color={point.color || '#ff6f00'} size={12} />
            <span style={{ fontSize: '14px', fontWeight: '600' }}>{point.name}</span>
            <span style={{ fontSize: '10px', opacity: 0.5 }}>{dateDisplay}</span>
          </div>
        </div>
      );
    });
  }
}

/** The card beside the pointer while it rests on an item; it follows the
 *  pointer without the overlay re-rendering. */
function HoverPreview({ item, pointer, width, eraLabels }) {
  const { x: mouseX, y: mouseY } = usePointer(pointer);

  // Position preview near mouse
  const previewX = Math.min(mouseX + 15, width - 250);
  const previewY = mouseY + 15;

  return (
    <div
      className="hover-preview"
      style={{
        position: 'absolute',
        left: `${previewX}px`,
        top: `${previewY}px`,
        width: '240px',
        backgroundColor: '#fff',
        border: '1px solid #ccc',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        padding: '12px',
        pointerEvents: 'none',
        zIndex: 10000,
        fontSize: '13px',
        lineHeight: '1.5'
      }}
    >
      {item.image && (
        <img
          src={item.image}
          alt={item.name}
          style={{
            width: '100%',
            height: '120px',
            objectFit: 'cover',
            borderRadius: '4px',
            marginBottom: '8px'
          }}
        />
      )}
      <div style={{ fontWeight: '600', fontSize: '16px', marginBottom: '4px' }}>
        {item.name}
      </div>
      {(item.date || item.location) && (
        <div style={{ fontSize: '12px', color: '#666' }}>
          {[
            item.date ? formatYear(getYear(item.date), eraLabels) : null,
            item.location || null,
          ].filter(Boolean).join(' · ')}
        </div>
      )}
    </div>
  );
}
