/**
 * Canvas layer for timeline rendering
 */

import { useRef, useEffect, useState } from 'react';
import { yearToPixel, getYearLabelInterval } from '../utils/coordinates.js';
import { getYearRange } from '../utils/dateUtils.js';
import {
  clearCanvas,
  drawRoundedRect,
  drawTimeAxis,
  drawVerticalGuideLines,
  drawPersonBox,
  drawPeriodBracket,
  getCurlyBracePath,
  drawPointMarker,
  drawChainLink
} from '../utils/rendering.js';

export function TimelineCanvas({
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
  highlightedItemIds = new Set(),
  currentHighlightId = null,
  animatingIds,
  // ── CH Timeline 2.0 additions. Every one defaults to the behaviour the
  // other five timelines already have, so this file renders them unchanged.
  /** Canvas colour overrides; absent means the parchment palette. */
  palette = {},
  /** Vertical shift, used to register a second layout against a shared axis. */
  yOffset = 0,
  /** When set, only these ids are drawn — this is the focus layer. */
  onlyIds = null,
  /** False for decorative layers: no hit map, no cursor, no pointer events. */
  interactive = true,
  /** 'front' draws the axis and leaves points to the overlay; 'back' draws
   *  point markers itself and renders movement spans as soft washes. */
  layerMode = 'front',
}) {
  const canvasRef = useRef(null);
  const hitMapRef = useRef(new Map()); // For click detection
  const isBackLayer = layerMode === 'back';
  const showLabels = isBackLayer && Boolean(onlyIds);

  // Grow animation state — progress 0→1 drives a clip on newly added bars
  const [animProgress, setAnimProgress] = useState(1);
  const animFrameRef = useRef(null);

  useEffect(() => {
    if (animatingIds && animatingIds.size > 0) {
      const start = performance.now();
      const duration = 1200; // ms

      const tick = (now) => {
        const t = Math.min((now - start) / duration, 1);
        // ease-out cubic
        setAnimProgress(1 - Math.pow(1 - t, 3));
        if (t < 1) {
          animFrameRef.current = requestAnimationFrame(tick);
        }
      };

      setAnimProgress(0);
      animFrameRef.current = requestAnimationFrame(tick);
      return () => {
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      };
    } else {
      setAnimProgress(1);
    }
  }, [animatingIds]);

  // Get hovered period date range for highlighting
  const hoveredPeriodRange = hoveredPeriod ? getYearRange(hoveredPeriod.startDate, hoveredPeriod.endDate) : null;

  // Check if an item falls within the hovered period
  const isInHoveredPeriod = (startYear, endYear) => {
    if (!hoveredPeriodRange) return true; // No period hovered, all items are "in"
    // Item overlaps with period if item start <= period end AND item end >= period start
    return startYear <= hoveredPeriodRange.end && endYear >= hoveredPeriodRange.start;
  };

  // Render canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    clearCanvas(ctx, width, height);

    // Clear hit map
    hitMapRef.current.clear();

    // Draw time axis
    const labelInterval = getYearLabelInterval(yearsPerPixel);
    const axisY = layout.axisY - panOffsetY + yOffset;

    // A background layer sits behind a foreground one that already draws the
    // axis and the guide rules; drawing them twice would double their weight.
    if (!isBackLayer) {
      // Draw vertical guide lines behind everything for parallax depth
      drawVerticalGuideLines(ctx, width, height, viewportStartYear, yearsPerPixel, labelInterval, palette);
    }

    // Render periods BEFORE axis so year labels appear on top of period fills
    renderPeriods(ctx, visible(layout.stackedPeriods), axisY);

    if (!isBackLayer) {
      drawTimeAxis(
        ctx,
        width,
        height,
        axisY,
        viewportStartYear,
        yearsPerPixel,
        labelInterval,
        config.eraLabels,
        palette
      );
    }

    // Render all other items (they already have y positions calculated)
    renderPeople(ctx, visible(layout.stackedPeople));
    renderPoints(ctx, visible(layout.stackedPoints));

    // Draw configured chains (e.g. the Nicene line) over the people lane
    renderChains(ctx, layout.stackedPeople);

    // Draw search highlights on top
    renderSearchHighlights(ctx, layout);
  }, [width, height, viewportStartYear, yearsPerPixel, panOffsetY, layout, config, hoveredItem, hoveredPeriod, highlightedItemIds, currentHighlightId, animatingIds, animProgress, palette, yOffset, onlyIds, layerMode]);

  /** The focus layer draws a subset; every other layer draws everything. */
  function visible(items) {
    if (!onlyIds) return items || [];
    return (items || []).filter(item => onlyIds.has(item.id));
  }

  // Render people
  function renderPeople(ctx, people) {
    people.forEach(person => {
      const { start, end } = getYearRange(person.startDate, person.endDate);

      const x = yearToPixel(start, viewportStartYear, yearsPerPixel);
      const boxWidth = yearToPixel(end, viewportStartYear, yearsPerPixel) - x;
      const y = person.y - panOffsetY + yOffset;
      const boxHeight = person.height - 6;

      // Min width for readability
      const displayWidth = Math.max(boxWidth, 60);

      // Get color
      const color = getPersonColor(person, config);

      // Check if hovered
      const isHovered = hoveredItem?.item?.id === person.id && hoveredItem?.type === 'person';

      // Apply opacity based on period highlighting and monarch dimming
      const inPeriod = isInHoveredPeriod(start, end);
      let opacity = hoveredPeriod ? (inPeriod ? 1.0 : 0.3) : 1.0;
      // Monarchs are dimmed unless hovered — but not on a background layer,
      // which is already dimmed as a whole and would double the fade.
      if (person.isMonarch && !isHovered && !hoveredPeriod && !isBackLayer) {
        opacity = 0.4;
      }

      // Check if this person is animating (grow from left to right)
      const isAnimating = animatingIds && animatingIds.has(person.id) && animProgress < 1;

      // Save context state for opacity
      ctx.save();
      ctx.globalAlpha = opacity;

      // Apply clip for grow animation
      if (isAnimating) {
        const clipWidth = displayWidth * animProgress;
        ctx.beginPath();
        ctx.rect(x, y - 2, clipWidth, boxHeight + 4);
        ctx.clip();
      }

      // Figures the dataset marks as emphasised (e.g. the defenders of
      // orthodoxy) get a ring in their own colour around the bar.
      const emphasis = person.emphasis
        ? { color: person.emphasisColor || color }
        : null;

      // Monarchs: draw lifespan in lighter shade, reign in full color
      if (person.isMonarch && person.reignStartYear != null && person.reignEndYear != null) {
        const lifespanColor = lightenColor(color, 0.55);

        // Draw full lifespan bar in light shade
        drawPersonBox(ctx, x, displayWidth, y, boxHeight, lifespanColor, false);

        // Calculate reign segment within the lifespan bar
        const reignX = yearToPixel(person.reignStartYear, viewportStartYear, yearsPerPixel);
        const reignEndX = yearToPixel(person.reignEndYear, viewportStartYear, yearsPerPixel);
        const reignWidth = Math.max(reignEndX - reignX, 4);

        // Draw reign segment in full color
        drawPersonBox(ctx, reignX, reignWidth, y, boxHeight, color, isHovered, emphasis);
      } else {
        // Regular person or monarch without reign data: single color box
        drawPersonBox(ctx, x, displayWidth, y, boxHeight, color, isHovered, emphasis, person.gradient || null);
      }

      // The focus layer is the only place a background figure gets a name —
      // blurred labels on the resting layer are noise, not information.
      if (showLabels) {
        drawLayerLabel(ctx, person.name, x + 4, y + boxHeight / 2, color);
      }

      // Restore context
      ctx.restore();

      // Store in hit map for click detection
      if (interactive) {
        hitMapRef.current.set(person.id, {
          type: 'person',
          item: person,
          bounds: { x, y, width: displayWidth, height: boxHeight }
        });
      }
    });
  }

  /**
   * A short label drawn straight onto the canvas, used only by the focus
   * layer. Front-layer labels come from TimelineOverlay as HTML, which is what
   * gives them their hover behaviour; the focus layer has none, so canvas text
   * is enough and avoids a second DOM tree.
   */
  function drawLayerLabel(ctx, text, x, centerY, color) {
    if (!text) return;
    ctx.save();
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const metrics = ctx.measureText(text);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
    ctx.beginPath();
    ctx.roundRect(x - 3, centerY - 8, metrics.width + 6, 16, 3);
    ctx.fill();
    ctx.fillStyle = color || '#333';
    ctx.fillText(text, x, centerY);
    ctx.restore();
  }

  // Render chains — successions the config asks to be drawn as a continuous
  // line through the people lane (config.chains). No-op when unconfigured, so
  // timelines that don't use chains are unaffected.
  function renderChains(ctx, people) {
    const chains = config.chains;
    if (!chains || chains.length === 0 || !people || people.length === 0) return;

    for (const chain of chains) {
      if (!chain?.memberIds?.length) continue;

      // Only members that survived filtering are on screen; skip the rest, so
      // toggling a category off takes its links out of the chain with it.
      const boxes = chain.memberIds
        .map(id => hitMapRef.current.get(id))
        .filter(entry => entry && entry.type === 'person')
        .map(entry => entry.bounds);

      drawChainLink(ctx, boxes, chain.color || '#c9a227');
    }
  }

  // Render periods
  // Periods now have bracketHeight (for the curly brace) and height (total including points area)
  function renderPeriods(ctx, periods, axisY) {
    periods.forEach(period => {
      const { start, end } = getYearRange(period.startDate, period.endDate);

      const x = yearToPixel(start, viewportStartYear, yearsPerPixel);
      const periodWidth = yearToPixel(end, viewportStartYear, yearsPerPixel) - x;
      const y = period.y - panOffsetY + yOffset;
      // Use bracketHeight for the actual bracket, falling back to height for backwards compatibility
      const bracketHeight = period.bracketHeight || period.height;

      // Get color
      const color = period.color || '#00838f';

      // Apply opacity based on period highlighting
      const isThisPeriodHovered = hoveredPeriod?.id === period.id;
      const opacity = hoveredPeriod ? (isThisPeriodHovered ? 1.0 : 0.3) : 1.0;

      // On a background layer a span is a wash of colour, not a labelled
      // bracket — the curly braces are exactly the ornament 2.0 sheds.
      if (isBackLayer) {
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.fillStyle = hexToRgba(color, showLabels ? 0.4 : 0.55);
        drawRoundedRect(ctx, x, y, Math.max(periodWidth, 3), bracketHeight, 5);
        ctx.fill();
        if (showLabels) {
          drawLayerLabel(ctx, period.name, x + 5, y + bracketHeight / 2, color);
        }
        ctx.restore();
        if (interactive) {
          hitMapRef.current.set(period.id, {
            type: 'period',
            item: period,
            bounds: { x, y, width: periodWidth, height: bracketHeight }
          });
        }
        return;
      }

      ctx.save();
      ctx.globalAlpha = opacity;

      // Convert color to rgba for fill (slightly stronger when hovered)
      const fillAlpha = isThisPeriodHovered ? 0.35 : 0.25;
      const fillColor = hexToRgba(color, fillAlpha);

      const braceY = period.aboveTimeline ? y + bracketHeight : y;
      const braceHeight = period.aboveTimeline ? -bracketHeight : bracketHeight;

      // Get the curly brace path
      const path = getCurlyBracePath(x, periodWidth, braceY, braceHeight);

      // Draw filled area between bracket and axis using the curly brace curve
      ctx.fillStyle = fillColor;
      ctx.beginPath();

      if (period.aboveTimeline) {
        // Above timeline: bracket points up, fill from bracket to axis below
        // Start at left top corner
        ctx.moveTo(path.x1, path.y1);
        // Draw left side of bracket curve
        ctx.quadraticCurveTo(path.qx1, path.qy1, path.qx2, path.qy2);
        ctx.quadraticCurveTo(path.tc1x, path.tc1y, path.tx1, path.ty1);
        // Draw right side of bracket curve (reverse direction from center to right)
        ctx.quadraticCurveTo(path.tc2x, path.tc2y, path.qx4, path.qy4);
        ctx.quadraticCurveTo(path.qx3, path.qy3, path.x2, path.y2);
        // Draw line down to axis
        ctx.lineTo(path.x2, axisY);
        // Draw along axis
        ctx.lineTo(path.x1, axisY);
        // Close path back to start
        ctx.closePath();
      } else {
        // Below timeline: bracket points down, fill from axis line to bracket
        // The fill reaches the axis line itself (behind year labels)
        // Start at left edge of axis line
        ctx.moveTo(path.x1, axisY);
        // Draw down to bracket left edge
        ctx.lineTo(path.x1, path.y1);
        // Draw left side of bracket curve
        ctx.quadraticCurveTo(path.qx1, path.qy1, path.qx2, path.qy2);
        ctx.quadraticCurveTo(path.tc1x, path.tc1y, path.tx1, path.ty1);
        // Draw right side of bracket curve (reverse direction from center to right)
        ctx.quadraticCurveTo(path.tc2x, path.tc2y, path.qx4, path.qy4);
        ctx.quadraticCurveTo(path.qx3, path.qy3, path.x2, path.y2);
        // Draw line back up to axis
        ctx.lineTo(path.x2, axisY);
        // Draw along axis
        ctx.lineTo(path.x1, axisY);
        // Close path
        ctx.closePath();
      }

      ctx.fill();

      // Draw bracket
      drawPeriodBracket(ctx, x, periodWidth, braceY, braceHeight, color);

      // Restore context
      ctx.restore();

      // Store in hit map - cover the entire highlighted area (from bracket to axis)
      // Use the path coordinates to get accurate bounds that match the drawn fill
      // For above: fill goes from y (bracket top) to axisY
      // For below: fill goes from axisY to y + bracketHeight (bracket bottom)
      const fillMinY = Math.min(y, axisY);
      const fillMaxY = Math.max(y + bracketHeight, axisY);

      if (interactive) {
        hitMapRef.current.set(period.id, {
          type: 'period',
          item: period,
          bounds: { x, y: fillMinY, width: periodWidth, height: fillMaxY - fillMinY }
        });
      }
    });
  }

  // Render points
  function renderPoints(ctx, points) {
    points.forEach(point => {
      const year = getYearRange(point.date).start;

      const x = yearToPixel(year, viewportStartYear, yearsPerPixel);
      const y = point.y - panOffsetY + yOffset + (point.height / 2);

      // On the foreground layer, markers are drawn inside the HTML labels that
      // TimelineOverlay renders, so there is nothing to paint here. A
      // background layer has no overlay of its own — it draws its own markers.
      if (isBackLayer) {
        ctx.save();
        drawPointMarker(ctx, x, y - 9, 9, point.shape, point.color || '#888');
        if (showLabels) {
          drawLayerLabel(ctx, point.name, x + 9, y - 9, point.color);
        }
        ctx.restore();
      }

      // Store in hit map for clicking (left-aligned from date position)
      const hitWidth = 120;
      if (interactive) {
        hitMapRef.current.set(point.id, {
          type: 'point',
          item: point,
          bounds: { x: x, y: y - 18, width: hitWidth, height: 20 }
        });
      }
    });
  }

  // Render search highlight overlays
  function renderSearchHighlights(ctx, layout) {
    if (highlightedItemIds.size === 0) return;

    const highlightColor = '#c4a050'; // Gold/amber for highlight
    const currentColor = '#d4b060';   // Brighter gold for current

    // Helper to draw highlight ring around an item
    const drawHighlightRing = (x, y, w, h, isCurrent) => {
      ctx.save();
      ctx.strokeStyle = isCurrent ? currentColor : highlightColor;
      ctx.lineWidth = isCurrent ? 4 : 2;
      ctx.shadowColor = isCurrent ? currentColor : highlightColor;
      ctx.shadowBlur = isCurrent ? 12 : 6;
      ctx.beginPath();
      ctx.roundRect(x - 2, y - 2, w + 4, h + 4, 6);
      ctx.stroke();
      ctx.restore();
    };

    // Highlight people
    for (const person of layout.stackedPeople || []) {
      if (!highlightedItemIds.has(person.id)) continue;
      const { start, end } = getYearRange(person.startDate, person.endDate);
      const x = yearToPixel(start, viewportStartYear, yearsPerPixel);
      const boxWidth = Math.max(yearToPixel(end, viewportStartYear, yearsPerPixel) - x, 60);
      const y = person.y - panOffsetY;
      const boxHeight = person.height - 6;
      const isCurrent = person.id === currentHighlightId;
      drawHighlightRing(x, y, boxWidth, boxHeight, isCurrent);
    }

    // Highlight periods
    for (const period of layout.stackedPeriods || []) {
      if (!highlightedItemIds.has(period.id)) continue;
      const { start, end } = getYearRange(period.startDate, period.endDate);
      const x = yearToPixel(start, viewportStartYear, yearsPerPixel);
      const periodWidth = yearToPixel(end, viewportStartYear, yearsPerPixel) - x;
      const y = period.y - panOffsetY;
      const bracketHeight = period.bracketHeight || period.height;
      const isCurrent = period.id === currentHighlightId;
      drawHighlightRing(x, y, periodWidth, bracketHeight, isCurrent);
    }

    // Highlight points (small circle around point marker area)
    for (const point of layout.stackedPoints || []) {
      if (!highlightedItemIds.has(point.id)) continue;
      const year = getYearRange(point.date).start;
      const x = yearToPixel(year, viewportStartYear, yearsPerPixel);
      const y = point.y - panOffsetY + (point.height / 2);
      const isCurrent = point.id === currentHighlightId;
      ctx.save();
      ctx.strokeStyle = isCurrent ? currentColor : highlightColor;
      ctx.lineWidth = isCurrent ? 3 : 2;
      ctx.shadowColor = isCurrent ? currentColor : highlightColor;
      ctx.shadowBlur = isCurrent ? 10 : 5;
      ctx.beginPath();
      ctx.arc(x, y - 9, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Lighten a hex color by mixing with white. Amount 0 = original, 1 = white.
  function lightenColor(hex, amount) {
    hex = hex.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const lr = Math.round(r + (255 - r) * amount);
    const lg = Math.round(g + (255 - g) * amount);
    const lb = Math.round(b + (255 - b) * amount);
    return `#${lr.toString(16).padStart(2, '0')}${lg.toString(16).padStart(2, '0')}${lb.toString(16).padStart(2, '0')}`;
  }

  // Convert hex color to rgba
  function hexToRgba(hex, alpha) {
    // Remove # if present
    hex = hex.replace('#', '');

    // Parse hex values
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // Get person color based on period mapping
  function getPersonColor(person, config) {
    if (person.color) return person.color;

    // Find period color from legend
    const periodId = person.periodId;
    if (periodId && config.legend) {
      const legendItem = config.legend.find(item => item.id === periodId);
      if (legendItem?.color) return legendItem.color;
    }

    // Default color
    return '#5b7ee8';
  }

  // Handle mouse move for hover detection
  function handleMouseMove(e) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check hit map - prioritize points/people over periods
    const hoverPriority = { point: 0, person: 1, period: 2 };
    let foundItem = null;

    for (const [id, hitData] of hitMapRef.current) {
      const { bounds } = hitData;

      if (
        x >= bounds.x &&
        x <= bounds.x + bounds.width &&
        y >= bounds.y &&
        y <= bounds.y + bounds.height
      ) {
        if (!foundItem || hoverPriority[hitData.type] < hoverPriority[foundItem.type]) {
          foundItem = hitData;
        }
      }
    }

    if (foundItem) {
      canvas.style.cursor = 'pointer';
      onItemHover?.(foundItem.type, foundItem.item);
    } else {
      canvas.style.cursor = 'grab';
      onItemHover?.(null, null);
    }
  }

  // Handle click
  function handleClick(e) {
    // Ignore clicks that end a drag gesture
    if (wasDraggingRef?.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check hit map - collect all matches and prioritize points/people over periods
    const typePriority = { point: 0, person: 1, period: 2 };
    let bestMatch = null;

    for (const [id, hitData] of hitMapRef.current) {
      const { bounds } = hitData;

      if (
        x >= bounds.x &&
        x <= bounds.x + bounds.width &&
        y >= bounds.y &&
        y <= bounds.y + bounds.height
      ) {
        if (!bestMatch || typePriority[hitData.type] < typePriority[bestMatch.type]) {
          bestMatch = hitData;
        }
      }
    }

    if (bestMatch) {
      onItemClick?.(bestMatch.type, bestMatch.item);
    }
  }

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onMouseMove={interactive ? handleMouseMove : undefined}
      onClick={interactive ? handleClick : undefined}
      style={{
        display: 'block',
        position: 'absolute',
        top: 0,
        left: 0,
        ...(interactive ? null : { pointerEvents: 'none' }),
      }}
    />
  );
}
