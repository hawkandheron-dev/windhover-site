/**
 * Custom hook for calculating timeline layout with above/below axis support
 */

import { useMemo } from 'react';
import { stackTimelineItems } from '../utils/stacking.js';

/**
 * Hook for timeline layout calculations
 * Layout structure: Periods closest to axis, then people/points further out
 * Items can be above or below the timeline axis
 *
 * @param {Object} data - Timeline data
 * @param {Array} data.people - Person items
 * @param {Array} data.points - Point items
 * @param {Array} data.periods - Period items
 * @param {Array} laneOrder - Deprecated, kept for compatibility
 * @param {number} yearsPerPixel - Current zoom scale
 * @param {Object} sizes - Size configuration
 * @returns {Object} Layout information
 */
export function useTimelineLayout(data, laneOrder, yearsPerPixel, sizes = {}) {
  const {
    personRowHeight = 34,
    pointRowHeight = 20,
    periodRowHeight = 40,
    periodBracketHeight = 10,
    lanePadding = 8,
    axisHeight = 30,
    peopleInsidePeriods = false,
    // Layers that draw bare markers rather than HTML callouts say so here, so
    // point collisions are sized by the marker instead of by a label they
    // never render (see stackPoints).
    pointMarkerWidth = null,
  } = sizes;

  // Stack all items with above/below separation
  const stacked = useMemo(() => {
    return stackTimelineItems(data, 120, yearsPerPixel, { pointMarkerWidth });
  }, [data, yearsPerPixel, pointMarkerWidth]);

  // Calculate layout with positions
  // Layout: People (outer) → Period brackets → Points inside period area → Axis
  const layout = useMemo(() => {
    const above = stacked.above;
    const below = stacked.below;

    // Calculate row counts for each section
    const abovePeriodRows = above.periods.length > 0 ? Math.max(...above.periods.map(p => p.row)) + 1 : 0;
    const abovePeopleRows = above.people.length > 0 ? Math.max(...above.people.map(p => p.row)) + 1 : 0;
    const abovePointRows = above.points.length > 0 ? Math.max(...above.points.map(p => p.row)) + 1 : 0;

    const belowPeriodRows = below.periods.length > 0 ? Math.max(...below.periods.map(p => p.row)) + 1 : 0;
    const belowPeopleRows = below.people.length > 0 ? Math.max(...below.people.map(p => p.row)) + 1 : 0;
    const belowPointRows = below.points.length > 0 ? Math.max(...below.points.map(p => p.row)) + 1 : 0;

    // Points live inside the period area, so period height includes space for points
    // Period area = bracket height + points area
    const abovePointsAreaHeight = abovePointRows * pointRowHeight;
    const belowPointsAreaHeight = belowPointRows * pointRowHeight;

    // People area height
    const abovePeopleHeight = abovePeopleRows * personRowHeight + (abovePeopleRows > 0 ? lanePadding : 0);
    const belowPeopleHeight = belowPeopleRows * personRowHeight + (belowPeopleRows > 0 ? lanePadding : 0);

    // Total period area height depends on whether people sit inside the period area
    // Default (peopleInsidePeriods=false): bracket + points
    // With peopleInsidePeriods: bracket + people + points
    const aboveInnerHeight = abovePointsAreaHeight + (peopleInsidePeriods ? abovePeopleHeight : 0);
    const belowInnerHeight = belowPointsAreaHeight + (peopleInsidePeriods ? belowPeopleHeight : 0);

    const abovePeriodTotalHeight = abovePeriodRows * periodBracketHeight + aboveInnerHeight + (abovePeriodRows > 0 ? lanePadding : 0);
    const belowPeriodTotalHeight = belowPeriodRows * periodBracketHeight + belowInnerHeight + (belowPeriodRows > 0 ? lanePadding : 0);

    // Total heights
    const aboveHeight = abovePeriodTotalHeight + (peopleInsidePeriods ? 0 : abovePeopleHeight);
    const belowHeight = belowPeriodTotalHeight + (peopleInsidePeriods ? 0 : belowPeopleHeight);

    // Virtual padding above and below all entries for comfortable panning
    const worldPadding = 600;

    // Axis position (shifted down by worldPadding)
    const axisY = worldPadding + aboveHeight + lanePadding;
    const totalHeight = worldPadding + aboveHeight + axisHeight + belowHeight + lanePadding * 2 + worldPadding;

    // Calculate Y positions for each section
    let abovePointsY, abovePeriodY, abovePeopleY;
    let belowPointsY, belowPeriodY, belowPeopleY;

    if (peopleInsidePeriods) {
      // Above timeline (from axis going up): points → people → period brackets
      abovePointsY = axisY - abovePointsAreaHeight;
      abovePeopleY = abovePointsY - abovePeopleHeight;
      abovePeriodY = abovePeopleY - (abovePeriodRows * periodBracketHeight);

      // Below timeline (from axis going down): points → people → period brackets
      belowPointsY = axisY + axisHeight;
      belowPeopleY = belowPointsY + belowPointsAreaHeight;
      belowPeriodY = belowPeopleY + abovePeopleHeight;
    } else {
      // Default: Above timeline (from axis going up): points → period brackets → people
      abovePointsY = axisY - abovePointsAreaHeight;
      abovePeriodY = axisY - abovePointsAreaHeight - (abovePeriodRows * periodBracketHeight);
      abovePeopleY = abovePeriodY - abovePeopleHeight;

      // Below timeline (from axis going down): points → period brackets → people
      belowPointsY = axisY + axisHeight;
      belowPeriodY = belowPointsY + belowPointsAreaHeight;
      belowPeopleY = belowPeriodY + (belowPeriodRows * periodBracketHeight) + lanePadding;
    }

    // Calculate max rows for reversing above-timeline items
    const maxAbovePeopleRow = above.people.length > 0 ? Math.max(...above.people.map(p => p.row)) : 0;
    const maxAbovePointsRow = above.points.length > 0 ? Math.max(...above.points.map(p => p.row)) : 0;
    const maxAbovePeriodsRow = above.periods.length > 0 ? Math.max(...above.periods.map(p => p.row)) : 0;

    // Add y positions to items
    // Above timeline: reverse stacking so row 0 is at bottom (closest to axis)
    // Below timeline: row 0 is at top (closest to axis), stacking downward
    const peopleWithY = [
      ...above.people.map(p => ({
        ...p,
        y: abovePeopleY + (maxAbovePeopleRow - p.row) * personRowHeight,
        height: personRowHeight,
        aboveTimeline: true
      })),
      ...below.people.map(p => ({
        ...p,
        y: belowPeopleY + p.row * personRowHeight,
        height: personRowHeight,
        aboveTimeline: false
      }))
    ];

    // Points are positioned within the period area (between bracket and axis)
    const pointsWithY = [
      ...above.points.map(p => ({
        ...p,
        y: abovePointsY + (maxAbovePointsRow - p.row) * pointRowHeight,
        height: pointRowHeight,
        aboveTimeline: true
      })),
      ...below.points.map(p => ({
        ...p,
        y: belowPointsY + p.row * pointRowHeight,
        height: pointRowHeight,
        aboveTimeline: false
      }))
    ];

    // Periods - the bracket is positioned at the outer edge
    // but the total height includes the points area
    const periodsWithY = [
      ...above.periods.map(p => ({
        ...p,
        y: abovePeriodY + (maxAbovePeriodsRow - p.row) * periodBracketHeight,
        height: periodBracketHeight + aboveInnerHeight, // Extended to include points (and optionally people)
        bracketHeight: periodBracketHeight, // Original bracket height for drawing
        aboveTimeline: true
      })),
      ...below.periods.map(p => ({
        ...p,
        y: belowPeriodY + p.row * periodBracketHeight,
        height: periodBracketHeight + belowInnerHeight, // Extended to include points (and optionally people)
        bracketHeight: periodBracketHeight, // Original bracket height for drawing
        aboveTimeline: false
      }))
    ];

    return {
      stackedPeople: peopleWithY,
      stackedPoints: pointsWithY,
      stackedPeriods: periodsWithY,
      axisY,
      totalHeight,
      sizes: {
        personRowHeight,
        pointRowHeight,
        periodRowHeight,
        periodBracketHeight,
        lanePadding,
        axisHeight
      }
    };
  }, [stacked, personRowHeight, pointRowHeight, periodRowHeight, periodBracketHeight, lanePadding, axisHeight, peopleInsidePeriods]);

  return layout;
}
