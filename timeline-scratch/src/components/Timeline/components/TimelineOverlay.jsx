/**
 * SVG/HTML overlay layer for labels and previews
 */

import { yearToPixel } from '../utils/coordinates.js';
import { getYearRange } from '../utils/dateUtils.js';
import { Icon, ShapeIcon } from './Icon.jsx';
import './TimelineOverlay.css';

export function TimelineOverlay({
  width,
  height,
  viewportStartYear,
  yearsPerPixel,
  panOffsetY,
  layout,
  config,
  hoveredItem,
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
}) {
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
      {renderPointCallouts()}

      {/* Render hover preview */}
      {hoveredItem && renderHoverPreview()}
    </div>
  );

  function renderPeopleLabels() {
    const people = layout.stackedPeople || [];

    return people.map(person => {
      const { start, end } = getYearRange(person.startDate, person.endDate);

      const startX = yearToPixel(start, viewportStartYear, yearsPerPixel);
      const endX = yearToPixel(end, viewportStartYear, yearsPerPixel);
      const boxWidth = Math.max(endX - startX, 60); // Min width for readability
      const boxHeight = person.height - 6;
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

      const startYear = start <= 0 ? Math.abs(start - 1) + 1 : start;
      const endYear = end <= 0 ? Math.abs(end - 1) + 1 : end;
      const bcLabel = config.eraLabels === 'BC/AD' ? 'BC' : 'BCE';
      const startIsBC = start <= 0;
      const endIsBC = end <= 0;
      const hasBC = startIsBC || endIsBC;
      const startSuffix = startIsBC ? ` ${bcLabel}` : hasBC ? ' AD' : '';
      const endSuffix = endIsBC ? ` ${bcLabel}` : hasBC ? ' AD' : '';
      const yearRange = startYear !== endYear
        ? `${startYear}${startSuffix}–${endYear}${endSuffix}`
        : `${startYear}${startSuffix}`;

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
            lineHeight: '1.3'
          }}
        >
          {person.isMonarch && (
            <Icon name="crown" size={12} color="#ffd700" />
          )}
          <span>{person.name}</span>
          <span style={{ opacity: 0.7, fontSize: '11px', fontWeight: '500' }}>
            {yearRange}
          </span>
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
      const bracketWidth = endX - startX;
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
      const [bcLabel, adLabel] = config.eraLabels === 'BC/AD' ? ['BC', 'AD'] : ['BCE', 'CE'];
      const formatYear = (yr) => {
        const displayYr = yr <= 0 ? Math.abs(yr - 1) + 1 : yr;
        const era = yr <= 0 ? bcLabel : adLabel;
        // Only show era label for BC years
        return yr <= 0 ? `${displayYr} ${era}` : `${displayYr}`;
      };

      let dateDisplay;
      if (point.endDate) {
        // Date range (e.g., documents with early/late dates)
        const endYear = getYearRange(point.endDate).start;
        dateDisplay = `${formatYear(year)}-${formatYear(endYear)}`;
      } else {
        // Single date
        const displayYear = year <= 0 ? Math.abs(year - 1) + 1 : year;
        const era = year <= 0 ? bcLabel : adLabel;
        dateDisplay = `${displayYear} ${era}`;
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

  function renderHoverPreview() {
    const { type, item, mouseX, mouseY } = hoveredItem;

    if (!item) return null;

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
            {(() => {
              const parts = [];
              if (item.date) {
                const year = parseInt(item.date.replace(/^-/, ''));
                const bc = item.date.startsWith('-');
                parts.push(bc ? `${year} BC` : `${year} AD`);
              }
              if (item.location) parts.push(item.location);
              return parts.join(' · ');
            })()}
          </div>
        )}
      </div>
    );
  }
}
