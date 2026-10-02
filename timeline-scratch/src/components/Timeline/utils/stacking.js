/**
 * Stacking algorithms for laying out overlapping timeline items
 */

import { getYear, getYearRange, rangesOverlap } from './dateUtils.js';

/**
 * Stack people using stair-step ascending pattern
 * Sorted by birth date, then alphabetically
 * Placed in lowest available row, ascending vertically (earliest births higher up)
 * Emperors use forced cascading through 5 rows for visual clarity
 *
 * @param {Array} people - Array of person items
 * @returns {Array} People with row assignments
 */
export function stackPeople(people, yearsPerPixel = 0) {
  if (!people || people.length === 0) return [];

  // Separate emperors from other people for different stacking strategies
  const emperors = people.filter(p => p.isMonarch);
  const nonEmperors = people.filter(p => !p.isMonarch);

  // Sort emperors by reign start (fall back to startDate/birth for monarchs without reign data)
  const sortedEmperors = [...emperors].sort((a, b) => {
    const aStart = a.reignStartYear ?? getYear(a.startDate);
    const bStart = b.reignStartYear ?? getYear(b.startDate);
    if (aStart !== bStart) return aStart - bStart;
    return (a.name || '').localeCompare(b.name || '');
  });

  // Minimum display width is 60px (see TimelineCanvas renderPeople).
  // When zoomed out, 60px can span many years, so we must ensure the
  // overlap ranges used for stacking are at least that wide.
  const minDisplayYears = 60 * yearsPerPixel;

  // Assign emperors to rows using full lifespan for overlap detection
  // (the rendered bar spans birth–death, so collisions must use that range)
  const emperorRows = [];
  const emperorsWithRows = sortedEmperors.map(emperor => {
    const start = getYear(emperor.startDate);
    const end = getYear(emperor.endDate);

    // Extend range to account for minimum display width
    const span = end - start;
    const displayEnd = span < minDisplayYears ? start + minDisplayYears : end;

    let rowIndex = 0;
    let foundRow = false;

    for (let i = 0; i < emperorRows.length; i++) {
      const overlaps = emperorRows[i].some(item => rangesOverlap(start, displayEnd, item.start, item.end));
      if (!overlaps) {
        rowIndex = i;
        foundRow = true;
        break;
      }
    }

    if (!foundRow) {
      rowIndex = emperorRows.length;
      emperorRows.push([]);
    }

    emperorRows[rowIndex].push({ start, end: displayEnd, emperor });

    return {
      ...emperor,
      row: rowIndex
    };
  });

  // Sort non-emperors by start date, then alphabetically
  const sortedNonEmperors = [...nonEmperors].sort((a, b) => {
    const aStart = getYear(a.startDate);
    const bStart = getYear(b.startDate);

    if (aStart !== bStart) return aStart - bStart;

    // Alphabetical tiebreaker
    return (a.name || '').localeCompare(b.name || '');
  });

  // Track occupied rows: array of arrays, each containing year ranges
  const rows = [];

  // Assign each non-emperor person to a row using overlap detection
  const nonEmperorsWithRows = sortedNonEmperors.map(person => {
    const { start, end } = getYearRange(person.startDate, person.endDate);

    // Extend range to account for minimum display width
    const span = end - start;
    const displayEnd = span < minDisplayYears ? start + minDisplayYears : end;

    // Find the first (lowest index = visually higher) row where this person fits
    let rowIndex = 0;
    let foundRow = false;

    for (let i = 0; i < rows.length; i++) {
      // Check if person overlaps with any item in this row
      const overlaps = rows[i].some(item => rangesOverlap(start, displayEnd, item.start, item.end));

      if (!overlaps) {
        // Found a row with no overlap
        rowIndex = i;
        foundRow = true;
        break;
      }
    }

    // If no existing row works, create a new one
    if (!foundRow) {
      rowIndex = rows.length;
      rows.push([]);
    }

    // Add this person to the row
    rows[rowIndex].push({ start, end: displayEnd, person });

    return {
      ...person,
      row: rowIndex
    };
  });

  return [...nonEmperorsWithRows, ...emperorsWithRows];
}

/**
 * Estimate the pixel width of a point callout based on its text content
 * @param {Object} point - Point item with name, date, endDate
 * @param {number} fontSize - Font size in pixels (default 14)
 * @returns {number} Estimated width in pixels
 */
function estimatePointCalloutWidth(point, fontSize = 14) {
  const name = point.name || '';
  // Approximate character width at 14px font: ~8.5px average for proportional font
  const charWidth = fontSize * 0.6;
  const nameWidth = name.length * charWidth;
  // Icon (12px) + gap (3px) + name + gap (3px) + date text (~40-80px) + padding (12px)
  const dateWidth = 50;
  return 12 + nameWidth + 6 + dateWidth + 12;
}

/**
 * Stack points vertically when they overlap in time
 * Uses per-point estimated widths for accurate collision detection
 * Points extend rightward from their date position (left-aligned)
 *
 * @param {Array} points - Array of point items
 * @param {number} pointWidth - Unused, kept for API compatibility
 * @param {number} yearsPerPixel - Current zoom scale
 * @param {number|null} markerWidth - Collision width in px when the layer
 *   draws bare markers instead of HTML callouts. A callout is sized by its
 *   label (~200px), so estimating one for a layer that has no labels stacks
 *   near-simultaneous points into dozens of rows. CH Timeline 2.0's
 *   background layer passes the marker's own width instead.
 * @returns {Array} Points with row assignments
 */
export function stackPoints(points, pointWidth = 150, yearsPerPixel = 1, markerWidth = null) {
  if (!points || points.length === 0) return [];

  // Sort by date, then alphabetically
  const sorted = [...points].sort((a, b) => {
    const aYear = getYear(a.date);
    const bYear = getYear(b.date);

    if (aYear !== bYear) return aYear - bYear;

    return (a.name || '').localeCompare(b.name || '');
  });

  const rows = [];

  const withRows = sorted.map(point => {
    const year = getYear(point.date);
    // Left-aligned: callout extends rightward from the date position
    const estimatedWidth = markerWidth ?? estimatePointCalloutWidth(point);
    const widthInYears = estimatedWidth * yearsPerPixel;
    const start = year;
    const end = year + widthInYears;

    // Find first row where point fits
    let rowIndex = 0;
    let foundRow = false;

    for (let i = 0; i < rows.length; i++) {
      const overlaps = rows[i].some(item => rangesOverlap(start, end, item.start, item.end));

      if (!overlaps) {
        rowIndex = i;
        foundRow = true;
        break;
      }
    }

    if (!foundRow) {
      rowIndex = rows.length;
      rows.push([]);
    }

    rows[rowIndex].push({ start, end, point });

    return {
      ...point,
      row: rowIndex
    };
  });

  return withRows;
}

/**
 * Stack periods (brackets) vertically when they overlap
 * No specific sort order required, just avoid visual overlap
 *
 * @param {Array} periods - Array of period items
 * @returns {Array} Periods with row assignments
 */
export function stackPeriods(periods) {
  if (!periods || periods.length === 0) return [];

  // Sort by start date for consistency
  const sorted = [...periods].sort((a, b) => {
    const aStart = getYear(a.startDate);
    const bStart = getYear(b.startDate);
    return aStart - bStart;
  });

  const rows = [];

  const withRows = sorted.map(period => {
    const { start, end } = getYearRange(period.startDate, period.endDate);

    // Find first row where period fits
    let rowIndex = 0;
    let foundRow = false;

    for (let i = 0; i < rows.length; i++) {
      const overlaps = rows[i].some(item => rangesOverlap(start, end, item.start, item.end));

      if (!overlaps) {
        rowIndex = i;
        foundRow = true;
        break;
      }
    }

    if (!foundRow) {
      rowIndex = rows.length;
      rows.push([]);
    }

    rows[rowIndex].push({ start, end, period });

    return {
      ...period,
      row: rowIndex
    };
  });

  return withRows;
}

/**
 * Calculate total height needed for a lane based on stacked items
 * @param {Array} items - Items with row assignments
 * @param {number} rowHeight - Height per row in pixels
 * @param {number} padding - Padding in pixels
 * @returns {number} Total height in pixels
 */
export function calculateLaneHeight(items, rowHeight, padding = 10) {
  if (!items || items.length === 0) return 0;

  const maxRow = Math.max(...items.map(item => item.row));
  return (maxRow + 1) * rowHeight + padding * 2;
}

/**
 * Stack people and points together in shared lanes
 * They use the same overlap detection with margin buffer
 *
 * @param {Array} people - Array of person items
 * @param {Array} points - Array of point items
 * @param {number} pointWidth - Width of point label in pixels
 * @param {number} yearsPerPixel - Current zoom scale
 * @param {number} marginYears - Margin buffer in years to prevent overlaps
 * @returns {Object} { people: [...], points: [...] } with row assignments
 */
export function stackPeopleAndPoints(people, points, pointWidth = 150, yearsPerPixel = 1, marginYears = 5) {
  const allItems = [];

  // Add people to items array
  if (people && people.length > 0) {
    people.forEach(person => {
      const { start, end } = getYearRange(person.startDate, person.endDate);
      allItems.push({
        type: 'person',
        data: person,
        start: start - marginYears,
        end: end + marginYears,
        sortKey: start
      });
    });
  }

  // Add points to items array
  if (points && points.length > 0) {
    const pointYearWidth = pointWidth * yearsPerPixel;
    points.forEach(point => {
      const year = getYear(point.date);
      allItems.push({
        type: 'point',
        data: point,
        start: year - pointYearWidth / 2 - marginYears,
        end: year + pointYearWidth / 2 + marginYears,
        sortKey: year
      });
    });
  }

  // Sort by chronological order, then by type (people first)
  allItems.sort((a, b) => {
    if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
    if (a.type === 'person' && b.type === 'point') return -1;
    if (a.type === 'point' && b.type === 'person') return 1;
    return (a.data.name || '').localeCompare(b.data.name || '');
  });

  const rows = [];

  // Assign each item to a row
  allItems.forEach(item => {
    let rowIndex = 0;
    let foundRow = false;

    for (let i = 0; i < rows.length; i++) {
      const overlaps = rows[i].some(rowItem =>
        rangesOverlap(item.start, item.end, rowItem.start, rowItem.end)
      );

      if (!overlaps) {
        rowIndex = i;
        foundRow = true;
        break;
      }
    }

    if (!foundRow) {
      rowIndex = rows.length;
      rows.push([]);
    }

    rows[rowIndex].push(item);
    item.data.row = rowIndex;
  });

  // Separate back into people and points
  const stackedPeople = allItems
    .filter(item => item.type === 'person')
    .map(item => item.data);

  const stackedPoints = allItems
    .filter(item => item.type === 'point')
    .map(item => item.data);

  return { people: stackedPeople, points: stackedPoints };
}

/**
 * Stack all timeline items with above/below timeline separation
 * Layout from axis: Periods (with points inside) → People further out
 * Points are placed within the period bracket area
 *
 * @param {Object} data - Timeline data { people, points, periods }
 * @param {number} pointWidth - Width for point collision detection
 * @param {number} yearsPerPixel - Current zoom scale
 * @returns {Object} Stacked items separated by above/below: { above: {...}, below: {...} }
 */
export function stackTimelineItems(data, pointWidth = 150, yearsPerPixel = 1, options = {}) {
  const { pointMarkerWidth = null } = options;
  const { people = [], points = [], periods = [] } = data;

  // Split items by aboveTimeline (default to true)
  const abovePeople = people.filter(p => p.aboveTimeline !== false);
  const belowPeople = people.filter(p => p.aboveTimeline === false);

  const abovePoints = points.filter(p => p.aboveTimeline !== false);
  const belowPoints = points.filter(p => p.aboveTimeline === false);

  const abovePeriods = periods.filter(p => p.aboveTimeline !== false);
  const belowPeriods = periods.filter(p => p.aboveTimeline === false);

  // Stack each type separately
  // Points will be positioned within the period area in the layout hook
  const abovePeriodsStacked = stackPeriods(abovePeriods);
  const belowPeriodsStacked = stackPeriods(belowPeriods);

  const abovePeopleStacked = stackPeople(abovePeople, yearsPerPixel);
  const belowPeopleStacked = stackPeople(belowPeople, yearsPerPixel);

  const abovePointsStacked = stackPoints(abovePoints, pointWidth, yearsPerPixel, pointMarkerWidth);
  const belowPointsStacked = stackPoints(belowPoints, pointWidth, yearsPerPixel, pointMarkerWidth);

  return {
    above: {
      periods: abovePeriodsStacked,
      people: abovePeopleStacked,
      points: abovePointsStacked
    },
    below: {
      periods: belowPeriodsStacked,
      people: belowPeopleStacked,
      points: belowPointsStacked
    }
  };
}
