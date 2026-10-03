/**
 * Canvas rendering utilities for timeline
 */

import { formatYear } from './dateUtils.js';

/**
 * Draw a rounded rectangle
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} width - Width
 * @param {number} height - Height
 * @param {number} radius - Corner radius
 */
export function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Draw a medievalized diamond (with slightly convex sides)
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} cx - Center X
 * @param {number} cy - Center Y
 * @param {number} size - Size
 */
export function drawMedievalDiamond(ctx, cx, cy, size) {
  const half = size / 2;
  const curve = size * 0.1; // Curvature amount

  ctx.beginPath();
  // Top point
  ctx.moveTo(cx, cy - half);
  // Top-right to right point (convex curve)
  ctx.quadraticCurveTo(cx + curve, cy - curve, cx + half, cy);
  // Right to bottom point (convex curve)
  ctx.quadraticCurveTo(cx + curve, cy + curve, cx, cy + half);
  // Bottom to left point (convex curve)
  ctx.quadraticCurveTo(cx - curve, cy + curve, cx - half, cy);
  // Left to top point (convex curve)
  ctx.quadraticCurveTo(cx - curve, cy - curve, cx, cy - half);
  ctx.closePath();
}

/**
 * Draw a medievalized square (with slightly convex sides)
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} cx - Center X
 * @param {number} cy - Center Y
 * @param {number} size - Size
 */
export function drawMedievalSquare(ctx, cx, cy, size) {
  const half = size / 2;
  const curve = size * 0.08;

  ctx.beginPath();
  // Top-left corner
  ctx.moveTo(cx - half, cy - half + curve);
  // Top edge (convex)
  ctx.quadraticCurveTo(cx, cy - half - curve, cx + half - curve, cy - half);
  // Right edge (convex)
  ctx.quadraticCurveTo(cx + half + curve, cy, cx + half - curve, cy + half);
  // Bottom edge (convex)
  ctx.quadraticCurveTo(cx, cy + half + curve, cx - half + curve, cy + half);
  // Left edge (convex)
  ctx.quadraticCurveTo(cx - half - curve, cy, cx - half, cy - half + curve);
  ctx.closePath();
}

/**
 * Draw a circle
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} cx - Center X
 * @param {number} cy - Center Y
 * @param {number} radius - Radius
 */
export function drawCircle(ctx, cx, cy, radius) {
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.closePath();
}

/**
 * Draw a medievalized triangle (with slightly convex sides)
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} cx - Center X
 * @param {number} cy - Center Y
 * @param {number} size - Size
 */
export function drawMedievalTriangle(ctx, cx, cy, size) {
  const half = size / 2;
  const height = (Math.sqrt(3) / 2) * size;
  const curve = size * 0.1;

  ctx.beginPath();
  // Top point
  ctx.moveTo(cx, cy - height / 2);
  // Top to bottom-right (convex)
  ctx.quadraticCurveTo(
    cx + half / 2 + curve,
    cy,
    cx + half,
    cy + height / 2
  );
  // Bottom-right to bottom-left (convex)
  ctx.quadraticCurveTo(
    cx,
    cy + height / 2 + curve,
    cx - half,
    cy + height / 2
  );
  // Bottom-left to top (convex)
  ctx.quadraticCurveTo(
    cx - half / 2 - curve,
    cy,
    cx,
    cy - height / 2
  );
  ctx.closePath();
}

/**
 * Draw a point marker based on shape type
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} size - Size
 * @param {string} shape - Shape type ("diamond", "square", "circle", "triangle")
 * @param {string} color - Fill color
 */
export function drawPointMarker(ctx, x, y, size, shape, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;

  switch (shape) {
    case 'diamond':
      drawMedievalDiamond(ctx, x, y, size);
      break;
    case 'square':
      drawMedievalSquare(ctx, x, y, size);
      break;
    case 'circle':
      drawCircle(ctx, x, y, size / 2);
      break;
    case 'triangle':
      drawMedievalTriangle(ctx, x, y, size);
      break;
    default:
      drawCircle(ctx, x, y, size / 2);
  }

  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/**
 * Calculate curly brace path data
 * Uses the mathematical formula from https://gist.github.com/alexhornbake/6005176
 * @param {number} x - Start X position
 * @param {number} width - Width
 * @param {number} y - Y position (top of bracket)
 * @param {number} height - Bracket height
 * @returns {Object} Path data with control points and center point
 */
export function getCurlyBracePath(x, width, y, height) {
  // Endpoints: left edge (x1,y1) to right edge (x2,y2) at top
  const x1 = x;
  const y1 = y;
  const x2 = x + width;
  const y2 = y;
  const w = height;  // Perpendicular width of the brace
  const q = 0.6;     // Quality/expressiveness factor

  // Calculate direction vector
  const dx = x1 - x2;
  const dy = y1 - y2;
  const len = Math.sqrt(dx * dx + dy * dy);
  const dxn = dx / len;  // Normalized
  const dyn = dy / len;

  // Calculate control points using perpendicular offsets
  // First curve (left side)
  const qx1 = x1 + q * w * dyn;
  const qy1 = y1 - q * w * dxn;
  const qx2 = (x1 - 0.25 * len * dxn) + (1 - q) * w * dyn;
  const qy2 = (y1 - 0.25 * len * dyn) - (1 - q) * w * dxn;

  // Center point
  const tx1 = (x1 - 0.5 * len * dxn) + w * dyn;
  const ty1 = (y1 - 0.5 * len * dyn) - w * dxn;

  // Second curve (right side)
  const qx3 = x2 + q * w * dyn;
  const qy3 = y2 - q * w * dxn;
  const qx4 = (x1 - 0.75 * len * dxn) + (1 - q) * w * dyn;
  const qy4 = (y1 - 0.75 * len * dyn) - (1 - q) * w * dxn;

  // T command control points
  const tc1x = 2 * qx2 - qx1;
  const tc1y = 2 * qy2 - qy1;
  const tc2x = 2 * qx4 - qx3;
  const tc2y = 2 * qy4 - qy3;

  return {
    x1, y1, x2, y2,
    qx1, qy1, qx2, qy2,
    qx3, qy3, qx4, qy4,
    tc1x, tc1y, tc2x, tc2y,
    tx1, ty1  // Center point
  };
}

/**
 * Draw a period bracket (single } rotated 90° clockwise)
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} x - Start X position
 * @param {number} width - Width
 * @param {number} y - Y position (top of bracket)
 * @param {number} height - Bracket height
 * @param {string} color - Color
 */
export function drawPeriodBracket(ctx, x, width, y, height, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const path = getCurlyBracePath(x, width, y, height);

  ctx.beginPath();

  // First half: left edge to center point
  ctx.moveTo(path.x1, path.y1);
  ctx.quadraticCurveTo(path.qx1, path.qy1, path.qx2, path.qy2);
  ctx.quadraticCurveTo(path.tc1x, path.tc1y, path.tx1, path.ty1);

  // Second half: right edge to center point
  ctx.moveTo(path.x2, path.y2);
  ctx.quadraticCurveTo(path.qx3, path.qy3, path.qx4, path.qy4);
  ctx.quadraticCurveTo(path.tc2x, path.tc2y, path.tx1, path.ty1);

  ctx.stroke();

  ctx.restore();
}

/**
 * Draw a person lifespan box
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} x - Start X position
 * @param {number} width - Width
 * @param {number} y - Y position
 * @param {number} height - Height
 * @param {string} color - Fill color
 * @param {boolean} isHovered - Whether this item is hovered
 * @param {object} [emphasis] - Optional emphasis ring, e.g. the defenders of
 *   orthodoxy on the heresies timeline: { color }. Omit for normal figures.
 */
export function drawPersonBox(ctx, x, width, y, height, color, isHovered = false, emphasis = null, gradient = null) {
  ctx.save();

  // Shadow for hovered state
  if (isHovered) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;
  }

  // Draw box. A lifespan that crosses a century boundary is filled left to
  // right between the two centuries' colours, so the bar shows the crossing
  // rather than having to pick one side of it.
  if (gradient) {
    const fill = ctx.createLinearGradient(x, 0, x + width, 0);
    fill.addColorStop(0, gradient.from);
    fill.addColorStop(1, gradient.to);
    ctx.fillStyle = fill;
  } else {
    ctx.fillStyle = color;
  }
  drawRoundedRect(ctx, x, y, width, height, 3);
  ctx.fill();

  // Border
  ctx.strokeStyle = isHovered ? '#000' : 'rgba(0, 0, 0, 0.25)';
  ctx.lineWidth = isHovered ? 1.5 : 0.5;
  ctx.stroke();

  ctx.restore();

  // Emphasis ring, drawn outside the box so it reads as a setting around it
  if (emphasis) {
    ctx.save();
    ctx.shadowColor = emphasis.color;
    ctx.shadowBlur = 6;
    ctx.strokeStyle = emphasis.color;
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, x - 2, y - 2, width + 4, height + 4, 4);
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * Draw the connecting line of a "chain" of people — a succession the timeline
 * wants to show as continuous, such as the line of Nicene defenders running
 * from Alexander of Alexandria to Leo the Great.
 *
 * Members are joined right-edge to left-edge in the order given. Where two
 * members overlap in time (the common case for a teacher and his pupil) the
 * link is drawn between their midpoints instead, so the line never doubles
 * back on itself.
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Array<{x:number,y:number,width:number,height:number}>} boxes -
 *   Laid-out boxes of the chain members, already in draw order
 * @param {string} color - Line colour
 */
export function drawChainLink(ctx, boxes, color) {
  if (!boxes || boxes.length < 2) return;

  // Chain members are usually emphasised in the same colour as the chain, so a
  // plain line would be invisible where it crosses their bars. Draw a pale
  // casing first, then a darker line on top — legible over the bars and over
  // the parchment background alike.
  const casing = 'rgba(255, 250, 235, 0.85)';
  const line = darkenColor(color, 0.55);

  const jointFor = (a, b, useA) => {
    const overlaps = a.x + a.width > b.x;
    const box = useA ? a : b;
    let x;
    if (useA) x = overlaps ? a.x + a.width / 2 : a.x + a.width;
    else x = overlaps ? b.x + b.width / 2 : b.x;
    return { x, y: box.y + box.height / 2 };
  };

  const segments = [];
  for (let i = 0; i < boxes.length - 1; i++) {
    segments.push([
      jointFor(boxes[i], boxes[i + 1], true),
      jointFor(boxes[i], boxes[i + 1], false)
    ]);
  }

  // Two passes: casing underneath, then the dashed line on top.
  const strokeSegments = (stroke, width, dash) => {
    ctx.save();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.setLineDash(dash);

    for (const [from, to] of segments) {
      const midX = (from.x + to.x) / 2;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.bezierCurveTo(midX, from.y, midX, to.y, to.x, to.y);
      ctx.stroke();
    }
    ctx.restore();
  };

  strokeSegments(casing, 4.5, []);
  strokeSegments(line, 1.8, [5, 4]);

  // Node dots at every joint, cased the same way
  const joints = [segments[0][0], ...segments.map(s => s[1])];
  ctx.save();
  for (const j of joints) {
    ctx.beginPath();
    ctx.arc(j.x, j.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = casing;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(j.x, j.y, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = line;
    ctx.fill();
  }
  ctx.restore();
}

/** Mix a hex colour towards black by `amount` (0–1). */
function darkenColor(hex, amount) {
  const h = String(hex).replace('#', '');
  if (h.length !== 6) return hex;
  const r = Math.round(parseInt(h.slice(0, 2), 16) * (1 - amount));
  const g = Math.round(parseInt(h.slice(2, 4), 16) * (1 - amount));
  const b = Math.round(parseInt(h.slice(4, 6), 16) * (1 - amount));
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Clear canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 */
export function clearCanvas(ctx, width, height) {
  ctx.clearRect(0, 0, width, height);
}

/**
 * Draw vertical guide lines aligned with tick marks for parallax depth
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {number} viewportStartYear - Starting year of viewport
 * @param {number} yearsPerPixel - Scale factor
 * @param {number} labelInterval - Year interval between labels
 * @param {Object} [palette] - Optional colour overrides; defaults to parchment
 */
export function drawVerticalGuideLines(ctx, width, height, viewportStartYear, yearsPerPixel, labelInterval, palette = {}) {
  ctx.save();

  // Primary lines at major tick intervals - subtle vertical rules
  const firstLabelYear = Math.ceil(viewportStartYear / labelInterval) * labelInterval;

  ctx.strokeStyle = palette.guide || 'rgba(120, 100, 70, 0.16)';
  ctx.lineWidth = 1;

  for (let year = firstLabelYear; year < viewportStartYear + (width * yearsPerPixel); year += labelInterval) {
    const x = (year - viewportStartYear) / yearsPerPixel;
    if (x < 0 || x > width) continue;

    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Draw the time axis with year labels
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height (for reference)
 * @param {number} axisY - Y position of axis
 * @param {number} viewportStartYear - Starting year of viewport
 * @param {number} yearsPerPixel - Scale factor
 * @param {number} labelInterval - Year interval between labels
 * @param {string} eraLabels - "BC/AD" or "BCE/CE"
 * @param {Object} [palette] - Optional colour overrides; defaults to parchment
 */
export function drawTimeAxis(ctx, width, height, axisY, viewportStartYear, yearsPerPixel, labelInterval, eraLabels = 'BC/AD', palette = {}) {
  ctx.save();
  ctx.strokeStyle = palette.axis || '#bbb0a0';
  ctx.fillStyle = palette.axisText || '#5a4e3a';
  ctx.font = '14px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  // Draw axis line
  ctx.beginPath();
  ctx.moveTo(0, axisY);
  ctx.lineTo(width, axisY);
  ctx.stroke();

  // Calculate first label year (rounded to interval)
  const firstLabelYear = Math.ceil(viewportStartYear / labelInterval) * labelInterval;

  // Draw year labels
  for (let year = firstLabelYear; year < viewportStartYear + (width * yearsPerPixel); year += labelInterval) {
    const x = (year - viewportStartYear) / yearsPerPixel;

    if (x < 0 || x > width) continue;

    // Draw tick mark
    ctx.beginPath();
    ctx.moveTo(x, axisY);
    ctx.lineTo(x, axisY + 6);
    ctx.stroke();

    // Format year label
    const label = formatYear(year, eraLabels);

    // Draw label
    ctx.fillText(label, x, axisY + 8);
  }

  ctx.restore();
}
