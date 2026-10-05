/**
 * Custom hook for smooth, accelerating directional panning.
 *
 * On first press (keyboard or mousedown on a compass button) it does one
 * discrete "step".  If the key/button stays held, it ramps up speed over
 * time using requestAnimationFrame.
 *
 * Returns per-direction { start, stop } pairs plus an "active" set so
 * callers can show visual feedback.
 */

import { useRef, useCallback, useEffect, useState } from 'react';

const INITIAL_STEP = 16;       // px for the first discrete tap
const BASE_SPEED   = 120;      // px/s when continuous scroll begins
const MAX_SPEED    = 1200;      // px/s cap
const ACCEL_TIME   = 1800;      // ms to reach max speed from base
const HOLD_DELAY   = 220;       // ms before continuous scroll kicks in

export function useSmoothPan({ handlePanX, handlePanY, dimensions, layoutTotalHeight }) {
  // Set of currently-active direction names, for visual feedback
  const [activeDirections, setActiveDirections] = useState(new Set());

  // Internal refs – one per direction
  const dirs = useRef({
    left:  { active: false, startTime: 0, raf: 0, lastFrame: 0, holdTimer: 0, continuous: false },
    right: { active: false, startTime: 0, raf: 0, lastFrame: 0, holdTimer: 0, continuous: false },
    up:    { active: false, startTime: 0, raf: 0, lastFrame: 0, holdTimer: 0, continuous: false },
    down:  { active: false, startTime: 0, raf: 0, lastFrame: 0, holdTimer: 0, continuous: false },
  });

  // Mutable copies so RAF callbacks always see latest values
  const dimsRef = useRef(dimensions);
  const layoutRef = useRef(layoutTotalHeight);
  useEffect(() => { dimsRef.current = dimensions; }, [dimensions]);
  useEffect(() => { layoutRef.current = layoutTotalHeight; }, [layoutTotalHeight]);
  const panXRef = useRef(handlePanX);
  const panYRef = useRef(handlePanY);
  useEffect(() => { panXRef.current = handlePanX; }, [handlePanX]);
  useEffect(() => { panYRef.current = handlePanY; }, [handlePanY]);

  const applyPan = useCallback((direction, px) => {
    const maxOffsetY = Math.max(0, layoutRef.current - dimsRef.current.height);
    switch (direction) {
      case 'left':  panXRef.current(px, dimsRef.current.width); break;
      case 'right': panXRef.current(-px, dimsRef.current.width); break;
      case 'up':    panYRef.current(px, maxOffsetY); break;
      case 'down':  panYRef.current(-px, maxOffsetY); break;
    }
  }, []);

  const tick = useCallback((direction) => {
    const d = dirs.current[direction];
    // One frame of continuous scrolling; it schedules the next itself.
    const frame = () => {
      if (!d.active || !d.continuous) return;

      const now = performance.now();
      const dt = (now - d.lastFrame) / 1000; // seconds
      d.lastFrame = now;

      // Accelerate linearly from BASE_SPEED to MAX_SPEED over ACCEL_TIME
      const elapsed = now - d.startTime;
      const t = Math.min(elapsed / ACCEL_TIME, 1);
      const speed = BASE_SPEED + (MAX_SPEED - BASE_SPEED) * t;

      applyPan(direction, speed * dt);

      d.raf = requestAnimationFrame(frame);
    };
    frame();
  }, [applyPan]);

  const startDirection = useCallback((direction) => {
    const d = dirs.current[direction];
    if (d.active) return; // already scrolling this direction

    d.active = true;

    // Immediate discrete step
    applyPan(direction, INITIAL_STEP);

    // After HOLD_DELAY, begin continuous scrolling
    d.holdTimer = setTimeout(() => {
      if (!d.active) return;
      d.continuous = true;
      d.startTime = performance.now();
      d.lastFrame = performance.now();
      d.raf = requestAnimationFrame(() => tick(direction));
    }, HOLD_DELAY);

    setActiveDirections(prev => {
      const next = new Set(prev);
      next.add(direction);
      return next;
    });
  }, [applyPan, tick]);

  const stopDirection = useCallback((direction) => {
    const d = dirs.current[direction];
    if (!d.active) return;

    d.active = false;
    d.continuous = false;
    clearTimeout(d.holdTimer);
    if (d.raf) cancelAnimationFrame(d.raf);

    setActiveDirections(prev => {
      const next = new Set(prev);
      next.delete(direction);
      return next;
    });
  }, []);

  // Clean up all on unmount
  useEffect(() => {
    const all = dirs.current;
    return () => {
      for (const dir of Object.keys(all)) {
        const d = all[dir];
        clearTimeout(d.holdTimer);
        if (d.raf) cancelAnimationFrame(d.raf);
      }
    };
  }, []);

  return {
    startDirection,
    stopDirection,
    activeDirections,
  };
}
