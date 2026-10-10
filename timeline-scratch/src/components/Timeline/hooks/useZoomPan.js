/**
 * Custom hook for managing zoom and pan state
 */

import { useState, useCallback, useRef } from 'react';
import { calculateZoomAroundPoint, clamp } from '../utils/coordinates.js';

/**
 * Clamp a viewport start year to the pannable range.
 *
 * `clamp` is min-then-max, so when the visible span is wider than the whole
 * allowed range — zoomed right out, or on a dataset covering only a century or
 * two — `maxYear - span` falls BELOW `minYear` and the ceiling wins, dumping
 * the viewport hundreds of years off the data. Collapsing the range to minYear
 * in that case shows everything from the start, which is what the reader wants.
 */
function clampStart(start, minYear, maxYear, viewportYearSpan) {
  return clamp(start, minYear, Math.max(minYear, maxYear - viewportYearSpan));
}

/**
 * Hook for zoom and pan functionality
 * @param {Object} config - Configuration
 * @param {number} config.initialViewportStartYear - Initial viewport start year
 * @param {number} config.initialYearsPerPixel - Initial scale
 * @param {number} config.minYearsPerPixel - Minimum zoom (most zoomed in)
 * @param {number} config.maxYearsPerPixel - Maximum zoom (most zoomed out)
 * @param {number} config.minYear - Minimum allowed year
 * @param {number} config.maxYear - Maximum allowed year
 * @returns {Object} Zoom/pan state and controls
 */
export function useZoomPan({
  initialViewportStartYear = 1,
  initialYearsPerPixel = 1,
  minYearsPerPixel = 0.01, // Very zoomed in
  maxYearsPerPixel = 50, // Very zoomed out
  // Never zoom out past the whole allowed range (Lifelines' timeBounds).
  fitRange = false,
  minYear = -3000,
  maxYear = 2100
}) {
  // The start year and the scale are one piece of state, not two.
  //
  // A zoom has to change both together: the new start is derived from the new
  // scale so the year under the cursor stays put. Splitting them across two
  // setters meant the zoom handler had to nest one inside the other and return
  // a stale closed-over value from the outer one, which a trackpad pinch (dozens
  // of events batched into one React pass) would then make the last write —
  // throwing the viewport back to wherever it started while the zoom carried on.
  // Holding them together makes every update a single pure function of the
  // previous pair, so batched events compose instead of fighting.
  const [viewport, setViewport] = useState({
    startYear: initialViewportStartYear,
    yearsPerPixel: initialYearsPerPixel,
  });
  const { startYear: viewportStartYear, yearsPerPixel } = viewport;
  const [panOffsetY, setPanOffsetY] = useState(0);

  // Kept so callers can still set one value on its own, updater form included.
  const setViewportStartYear = useCallback(value => {
    setViewport(prev => ({
      ...prev,
      startYear: typeof value === 'function' ? value(prev.startYear) : value,
    }));
  }, []);

  const setYearsPerPixel = useCallback(value => {
    setViewport(prev => ({
      ...prev,
      yearsPerPixel: typeof value === 'function' ? value(prev.yearsPerPixel) : value,
    }));
  }, []);

  // Track if currently panning
  const isPanning = useRef(false);
  // The same flag as state, for what renders from it (the cursor guide hides
  // during a drag). The ref stays for the per-move checks, which must not
  // wait for a render.
  const [panning, setPanning] = useState(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  // Viewport animation ref (for smooth tour transitions)
  const viewportAnimRef = useRef(null);

  /**
   * Handle zoom centered on a point
   */
  const handleZoom = useCallback((zoomDelta, mouseX, canvasWidth) => {
    setViewport(({ startYear: prevStart, yearsPerPixel: prevYPP }) => {
      const { viewportStartYear: newStart, yearsPerPixel: newYPP } =
        calculateZoomAroundPoint(zoomDelta, mouseX, prevStart, prevYPP);

      const ceiling = fitRange && canvasWidth > 0
        ? Math.max(minYearsPerPixel, Math.min(maxYearsPerPixel, (maxYear - minYear) / canvasWidth))
        : maxYearsPerPixel;
      const clampedYPP = clamp(newYPP, minYearsPerPixel, ceiling);

      // At a zoom limit the scale stops moving, so the start has to be
      // re-derived from the clamped scale — otherwise the year under the
      // cursor drifts on every further nudge against the stop.
      const unclampedStart = clampedYPP === newYPP
        ? newStart
        : (prevStart + mouseX * prevYPP) - (mouseX * clampedYPP);

      const viewportYearSpan = canvasWidth * clampedYPP;

      return {
        startYear: clampStart(unclampedStart, minYear, maxYear, viewportYearSpan),
        yearsPerPixel: clampedYPP,
      };
    });
  }, [minYearsPerPixel, maxYearsPerPixel, minYear, maxYear, fitRange]);

  /**
   * Handle horizontal pan (time scrolling)
   */
  const handlePanX = useCallback((deltaPixels, canvasWidth) => {
    setViewport(prev => {
      const deltaYears = deltaPixels * prev.yearsPerPixel;
      const viewportYearSpan = canvasWidth * prev.yearsPerPixel;

      return {
        ...prev,
        startYear: clampStart(prev.startYear - deltaYears, minYear, maxYear, viewportYearSpan),
      };
    });
  }, [minYear, maxYear]);

  /**
   * Handle vertical pan (lane scrolling)
   */
  const handlePanY = useCallback((deltaPixels, maxOffset = 0) => {
    setPanOffsetY(prev => {
      const newOffset = prev - deltaPixels;
      // Clamp to valid range (0 to maxOffset)
      return clamp(newOffset, 0, maxOffset);
    });
  }, []);

  /**
   * Start panning
   */
  const startPan = useCallback((x, y) => {
    isPanning.current = true;
    setPanning(true);
    lastMousePos.current = { x, y };
  }, []);

  /**
   * Update pan position
   */
  const updatePan = useCallback((x, y, canvasWidth, maxOffsetY = 0) => {
    if (!isPanning.current) return;

    const deltaX = x - lastMousePos.current.x;
    const deltaY = y - lastMousePos.current.y;

    handlePanX(deltaX, canvasWidth);
    handlePanY(deltaY, maxOffsetY);

    lastMousePos.current = { x, y };
  }, [handlePanX, handlePanY]);

  /**
   * End panning
   */
  const endPan = useCallback(() => {
    isPanning.current = false;
    setPanning(false);
  }, []);

  /**
   * Reset to initial viewport
   */
  const reset = useCallback(() => {
    setViewport({ startYear: initialViewportStartYear, yearsPerPixel: initialYearsPerPixel });
    setPanOffsetY(0);
  }, [initialViewportStartYear, initialYearsPerPixel]);

  /**
   * Jump to a specific year
   */
  const jumpToYear = useCallback((year, canvasWidth) => {
    setViewport(prev => {
      // Center the viewport on the target year, at whatever the scale is now.
      const viewportYearSpan = canvasWidth * prev.yearsPerPixel;

      return {
        ...prev,
        startYear: clampStart(year - (viewportYearSpan / 2), minYear, maxYear, viewportYearSpan),
      };
    });
  }, [minYear, maxYear]);

  /**
   * Set vertical pan offset directly (for search centering)
   */
  const setVerticalOffset = useCallback((offset) => {
    setPanOffsetY(offset);
  }, []);

  /**
   * Smoothly animate viewport to target position/zoom/offset
   */
  const animateViewport = useCallback((targetStartYear, targetYPP, targetOffsetY, duration = 800) => {
    // Cancel any in-progress animation
    if (viewportAnimRef.current) {
      cancelAnimationFrame(viewportAnimRef.current);
      viewportAnimRef.current = null;
    }

    // A reader who has asked the OS for less motion gets the destination
    // without the 800ms glide.
    const reduceMotion = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      setViewport({ startYear: targetStartYear, yearsPerPixel: targetYPP });
      setPanOffsetY(targetOffsetY);
      return;
    }

    // Capture current values at animation start
    const fromStart = viewportStartYear;
    const fromYPP = yearsPerPixel;
    const fromOffsetY = panOffsetY;
    const startTime = performance.now();

    // Ease-in-out cubic
    const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const tick = (now) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const p = ease(t);

      // Both in one write: a frame that moved the start but not yet the scale
      // would paint a viewport that never existed.
      setViewport({
        startYear: fromStart + (targetStartYear - fromStart) * p,
        yearsPerPixel: fromYPP + (targetYPP - fromYPP) * p,
      });
      setPanOffsetY(fromOffsetY + (targetOffsetY - fromOffsetY) * p);

      if (t < 1) {
        viewportAnimRef.current = requestAnimationFrame(tick);
      } else {
        viewportAnimRef.current = null;
      }
    };

    viewportAnimRef.current = requestAnimationFrame(tick);
  }, [viewportStartYear, yearsPerPixel, panOffsetY]);

  return {
    viewportStartYear,
    yearsPerPixel,
    panOffsetY,
    handleZoom,
    handlePanX,
    handlePanY,
    startPan,
    updatePan,
    endPan,
    reset,
    jumpToYear,
    setVerticalOffset,
    setYearsPerPixel,
    setViewportStartYear,
    animateViewport,
    isPanning: panning
  };
}
