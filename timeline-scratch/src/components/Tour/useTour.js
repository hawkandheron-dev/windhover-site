/**
 * Hook for managing the Getting Started Tour.
 *
 * Handles scene progression, data filtering, viewport auto-framing,
 * and the final build-out animation.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { TOUR_SCENES as FALLBACK_SCENES } from './tourScenes.js';
import { getYear } from '../Timeline/utils/dateUtils.js';
import { fetchLinkedMedia } from '../../data/churchHistorySupabaseAdapter.js';
import { sizedImageUrl, TOUR_IMAGE_WIDTH } from './sizedImageUrl.js';

const DEFAULT_STORAGE_KEY = 'windhover-timeline-tour-completed';

/**
 * @param {Object}  opts
 * @param {Object}  opts.fullData       – the complete timeline data { people, points, periods }
 * @param {Object}  opts.timelineRef    – React ref to Timeline (imperative handle)
 * @param {Array}   [opts.scenes]       – scene definitions from Supabase (falls back to static)
 * @param {string}  [opts.storageKey]   – where "tour seen" is remembered. Pages that
 *   share the default share the memory, so a reader who finished one page's tour
 *   never sees another's welcome.
 * @returns tour state and controls
 */
export function useTour({ fullData, timelineRef, scenes, storageKey = DEFAULT_STORAGE_KEY }) {
  const TOUR_SCENES = scenes ?? FALLBACK_SCENES;

  // Compute the set of all person IDs featured in the tour (for build-out filtering)
  const tourPersonIds = useMemo(() => new Set(
    TOUR_SCENES.filter(s => s.personIds && s.personIds.length > 0)
      .flatMap(s => s.personIds)
  ), [TOUR_SCENES]);
  const [tourActive, setTourActive] = useState(false);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [showWelcome, setShowWelcome] = useState(false);

  // Track IDs that are newly added this scene (for grow animation)
  const [newlyAddedIds, setNewlyAddedIds] = useState(new Set());

  // Track point IDs that are newly added this scene (for pop-in animation)
  const [newlyAddedPointIds, setNewlyAddedPointIds] = useState(new Set());

  // Build-out animation state: list of IDs revealed so far during scene 15
  const [buildOutIds, setBuildOutIds] = useState(null);
  const buildOutTimerRef = useRef(null);

  // Stagger animation state: progressively reveal IDs in scenes with staggerIds/staggerPointIds
  const [staggerRevealedIds, setStaggerRevealedIds] = useState(new Set());
  const [staggerRevealedPointIds, setStaggerRevealedPointIds] = useState(new Set());
  const staggerTimerRef = useRef(null);
  const staggerPointTimerRef = useRef(null);

  // Linked media for tour scenes
  const [mediaMap, setMediaMap] = useState(new Map());

  // On mount, check localStorage to decide whether to show the welcome dialog
  useEffect(() => {
    try {
      if (!localStorage.getItem(storageKey)) {
        setShowWelcome(true);
      }
    } catch {
      // localStorage unavailable — show welcome anyway
      setShowWelcome(true);
    }
  }, [storageKey]);

  // Fetch linked media for all tour scene IDs on mount. Keyed on the ids, not
  // the array: the static fallback and the database scenes share ids, so the
  // database scenes arriving shouldn't fetch the same media a second time.
  const sceneIdKey = TOUR_SCENES.map(s => s.id).join(',');
  useEffect(() => {
    fetchLinkedMedia('tour_scene', sceneIdKey.split(','))
      .then(map => setMediaMap(map))
      .catch(() => setMediaMap(new Map()));
  }, [sceneIdKey]);

  const currentScene = TOUR_SCENES[sceneIndex];
  const sceneMedia = mediaMap.get(currentScene?.id) || null;

  // Warm the browser cache with this scene's and the next scene's images, so
  // pressing Next shows a picture rather than an empty box.
  useEffect(() => {
    if (typeof Image === 'undefined') return;
    for (const scene of [TOUR_SCENES[sceneIndex], TOUR_SCENES[sceneIndex + 1]]) {
      const url = scene && mediaMap.get(scene.id)?.mediaUrl;
      if (url) new Image().src = sizedImageUrl(url, TOUR_IMAGE_WIDTH);
    }
  }, [mediaMap, sceneIndex, TOUR_SCENES]);

  // ── Auto-frame viewport when scene changes ───────────────────────────
  const frameVisiblePeople = useCallback((personIds, animate = false) => {
    if (!timelineRef?.current || !fullData?.people || !personIds || personIds.length === 0) return;

    const people = fullData.people.filter(p => personIds.includes(p.id));
    if (people.length === 0) return;

    let minYear = Infinity;
    let maxYear = -Infinity;
    for (const p of people) {
      const s = getYear(p.startDate);
      const e = getYear(p.endDate);
      if (s < minYear) minYear = s;
      if (e > maxYear) maxYear = e;
    }

    const range = maxYear - minYear;
    const padding = Math.max(range * 0.15, 20);
    const framedMin = minYear - padding;
    const framedMax = maxYear + padding;

    const ref = timelineRef.current;
    // The vertical (phone) timeline frames by years itself.
    if (ref?.frameYears) {
      ref.frameYears(framedMin, framedMax, { animate });
      return;
    }
    const info = ref.getViewportInfo?.();
    if (!info) return;

    const newYPP = (framedMax - framedMin) / info.width;

    // Compute target vertical offset
    let targetOffsetY = 0;
    if (info.axisY != null && info.height) {
      const raw = Math.max(0, info.axisY - info.height / 2);
      const maxOffset = Math.max(0, (info.totalHeight || 0) - info.height);
      targetOffsetY = Math.min(raw, maxOffset);
    }

    if (animate && ref.animateViewport) {
      ref.animateViewport(framedMin, newYPP, targetOffsetY, 800);
    } else {
      ref.setYearsPerPixel?.(newYPP);
      ref.setViewportStartYear?.(framedMin);
      ref.setVerticalOffset?.(targetOffsetY);
    }
  }, [fullData, timelineRef]);

  // Compute newly added IDs when scene changes
  // Scene 0: no animation — people just appear (nothing to "grow from")
  // Scenes with staggerIds are handled by the stagger effect below
  useEffect(() => {
    if (!tourActive || !currentScene || sceneIndex === 0) {
      setNewlyAddedIds(new Set());
      return;
    }
    // Skip normal bulk computation for stagger scenes — the stagger effect handles it
    if (currentScene.staggerIds) return;

    const prevScene = TOUR_SCENES[sceneIndex - 1];
    const prevIds = new Set(prevScene?.personIds || []);
    const currIds = currentScene.personIds || [];
    const added = new Set(currIds.filter(id => !prevIds.has(id)));
    setNewlyAddedIds(added);
  }, [tourActive, sceneIndex, currentScene]);

  // Compute newly added point IDs when scene changes (for pop-in animation)
  // Scenes with staggerPointIds are handled by the stagger effect below
  useEffect(() => {
    if (!tourActive || !currentScene || sceneIndex === 0) {
      setNewlyAddedPointIds(new Set());
      return;
    }
    if (currentScene.staggerPointIds) return;

    const prevScene = TOUR_SCENES[sceneIndex - 1];
    const prevPointIds = new Set(prevScene?.pointIds || []);
    const currPointIds = currentScene.pointIds || [];
    const added = new Set(currPointIds.filter(id => !prevPointIds.has(id)));
    setNewlyAddedPointIds(added);
  }, [tourActive, sceneIndex, currentScene]);

  // Stagger effect: reveal people then points with separate intervals
  useEffect(() => {
    const hasStagger = currentScene?.staggerIds || currentScene?.staggerPointIds;
    if (!tourActive || !hasStagger) {
      if (staggerTimerRef.current) {
        clearInterval(staggerTimerRef.current);
        staggerTimerRef.current = null;
      }
      if (staggerPointTimerRef.current) {
        clearInterval(staggerPointTimerRef.current);
        staggerPointTimerRef.current = null;
      }
      setStaggerRevealedIds(new Set());
      setStaggerRevealedPointIds(new Set());
      return;
    }

    const personIds = currentScene.staggerIds || [];
    const pointIds = currentScene.staggerPointIds || [];
    const defaultInterval = currentScene.staggerInterval || 1200;
    const personInterval = currentScene.staggerPersonInterval || defaultInterval;
    const pointInterval = currentScene.staggerPointInterval || defaultInterval;

    setStaggerRevealedIds(new Set());
    setStaggerRevealedPointIds(new Set());

    // Reveal people first
    let pIdx = 0;
    if (personIds.length > 0) {
      setStaggerRevealedIds(new Set([personIds[0]]));
      setNewlyAddedIds(new Set([personIds[0]]));
      pIdx = 1;
    }

    const startPointStagger = () => {
      if (pointIds.length === 0) return;
      let ptIdx = 0;
      // Reveal first point immediately
      setStaggerRevealedPointIds(new Set([pointIds[0]]));
      setNewlyAddedPointIds(new Set([pointIds[0]]));
      ptIdx = 1;

      if (pointIds.length <= 1) return;
      const ptInterval = setInterval(() => {
        if (ptIdx >= pointIds.length) {
          clearInterval(ptInterval);
          staggerPointTimerRef.current = null;
          return;
        }
        setStaggerRevealedPointIds(prev => new Set([...prev, pointIds[ptIdx]]));
        setNewlyAddedPointIds(new Set([pointIds[ptIdx]]));
        ptIdx++;
      }, pointInterval);
      staggerPointTimerRef.current = ptInterval;
    };

    if (personIds.length <= 1) {
      // No more people to reveal — start points immediately
      startPointStagger();
    } else {
      const pInterval = setInterval(() => {
        if (pIdx >= personIds.length) {
          clearInterval(pInterval);
          staggerTimerRef.current = null;
          // People done — start point stagger
          startPointStagger();
          return;
        }
        setStaggerRevealedIds(prev => new Set([...prev, personIds[pIdx]]));
        setNewlyAddedIds(new Set([personIds[pIdx]]));
        pIdx++;
      }, personInterval);
      staggerTimerRef.current = pInterval;
    }

    return () => {
      if (staggerTimerRef.current) {
        clearInterval(staggerTimerRef.current);
        staggerTimerRef.current = null;
      }
      if (staggerPointTimerRef.current) {
        clearInterval(staggerPointTimerRef.current);
        staggerPointTimerRef.current = null;
      }
    };
  }, [tourActive, sceneIndex, currentScene]);

  // Frame viewport whenever scene changes (but not during build-out)
  useEffect(() => {
    if (!tourActive || !currentScene) return;
    if (currentScene.isBuildOut) return;

    // Delay so Timeline has re-rendered with new data and layout has settled
    // (ResizeObserver and layout recomputation must complete first)
    // Scene 0: instant (no prior position to animate from); others: smooth pan
    const animate = sceneIndex > 0;
    const timer = setTimeout(() => {
      frameVisiblePeople(currentScene.personIds, animate);
    }, 50);
    return () => clearTimeout(timer);
  }, [tourActive, sceneIndex, currentScene, frameVisiblePeople]);

  // Auto-open person modal when scene has openPersonId
  useEffect(() => {
    if (!tourActive || !currentScene?.openPersonId || !fullData?.people) return;

    // Delay slightly so the narration panel renders first
    const timer = setTimeout(() => {
      const person = fullData.people.find(p => p.id === currentScene.openPersonId);
      if (person && timelineRef?.current?.selectItem) {
        timelineRef.current.selectItem('person', person);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [tourActive, sceneIndex, currentScene, fullData, timelineRef]);

  // Highlight a connection pill in the modal when scene has highlightConnectionId
  useEffect(() => {
    if (!tourActive || !currentScene?.highlightConnectionId) return;

    const timer = setTimeout(() => {
      const pill = document.querySelector(
        `.modal-pill[data-item-id="${currentScene.highlightConnectionId}"]`
      );
      if (pill) {
        pill.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        pill.classList.add('tour-highlight-pill');
      }
    }, 800);
    return () => {
      clearTimeout(timer);
      // Clean up highlight when leaving this scene
      const highlighted = document.querySelector('.tour-highlight-pill');
      if (highlighted) highlighted.classList.remove('tour-highlight-pill');
    };
  }, [tourActive, sceneIndex, currentScene]);

  // Auto-open year summary modal when scene has openYearSummary
  useEffect(() => {
    if (!tourActive || !currentScene?.openYearSummary) return;

    const timer = setTimeout(() => {
      timelineRef?.current?.openYearSummary?.(currentScene.openYearSummary);
    }, 600);
    return () => clearTimeout(timer);
  }, [tourActive, sceneIndex, currentScene, timelineRef]);

  // ── Build-out animation (scene 15) ───────────────────────────────────
  useEffect(() => {
    if (!tourActive || !currentScene?.isBuildOut || !fullData) return;

    // Gather all IDs not yet shown, grouped by type
    const remainingPeople = (fullData.people || [])
      .filter(p => !tourPersonIds.has(p.id))
      .map(p => p.id);

    const allPointIds = (fullData.points || []).map(p => p.id);
    const allPeriodIds = (fullData.periods || []).map(p => p.id);

    // Combine into batches: people first, then periods, then points
    const batches = [];
    const BATCH_SIZE = 8;
    for (let i = 0; i < remainingPeople.length; i += BATCH_SIZE) {
      batches.push({ type: 'people', ids: remainingPeople.slice(i, i + BATCH_SIZE) });
    }
    batches.push({ type: 'periods', ids: allPeriodIds });
    for (let i = 0; i < allPointIds.length; i += BATCH_SIZE) {
      batches.push({ type: 'points', ids: allPointIds.slice(i, i + BATCH_SIZE) });
    }

    // Start with tour people already visible
    let revealedPeople = new Set(tourPersonIds);
    let revealedPeriods = new Set();
    let revealedPoints = new Set();
    let batchIdx = 0;

    setBuildOutIds({
      people: new Set(revealedPeople),
      periods: new Set(),
      points: new Set(),
    });

    const interval = setInterval(() => {
      if (batchIdx >= batches.length) {
        clearInterval(interval);
        // Final: show everything
        setBuildOutIds(null); // null = no filter, show all
        return;
      }

      const batch = batches[batchIdx];
      if (batch.type === 'people') {
        batch.ids.forEach(id => revealedPeople.add(id));
      } else if (batch.type === 'periods') {
        batch.ids.forEach(id => revealedPeriods.add(id));
      } else if (batch.type === 'points') {
        batch.ids.forEach(id => revealedPoints.add(id));
      }

      setBuildOutIds({
        people: new Set(revealedPeople),
        periods: new Set(revealedPeriods),
        points: new Set(revealedPoints),
      });

      batchIdx++;
    }, 120);

    buildOutTimerRef.current = interval;
    return () => clearInterval(interval);
  }, [tourActive, sceneIndex, currentScene, fullData]);

  // ── Compute filtered data for the timeline ───────────────────────────
  const tourData = useMemo(() => {
    if (!tourActive || !fullData) return fullData;

    // Build-out scene with animation in progress
    if (currentScene?.isBuildOut && buildOutIds) {
      return {
        people: (fullData.people || []).filter(p => buildOutIds.people.has(p.id)),
        periods: (fullData.periods || []).filter(p => buildOutIds.periods.has(p.id)),
        points: (fullData.points || []).filter(p => buildOutIds.points.has(p.id)),
      };
    }

    // Build-out complete (buildOutIds is null) — show everything
    if (currentScene?.isBuildOut && buildOutIds === null) {
      return fullData;
    }

    // Normal tour scene — filter to only the scene's people
    const visibleIds = new Set(currentScene?.personIds || []);
    // Hide stagger IDs that haven't been revealed yet
    if (currentScene?.staggerIds) {
      for (const id of currentScene.staggerIds) {
        if (!staggerRevealedIds.has(id)) visibleIds.delete(id);
      }
    }
    // Points: filter by pointIds, or show all if includePeriodsAndPoints
    const visiblePointIds = new Set(currentScene?.pointIds || []);
    // Hide stagger point IDs that haven't been revealed yet
    if (currentScene?.staggerPointIds) {
      for (const id of currentScene.staggerPointIds) {
        if (!staggerRevealedPointIds.has(id)) visiblePointIds.delete(id);
      }
    }
    return {
      people: (fullData.people || []).filter(p => visibleIds.has(p.id)),
      periods: currentScene?.includePeriodsAndPoints ? (fullData.periods || []) : [],
      points: currentScene?.includePeriodsAndPoints
        ? (fullData.points || [])
        : (fullData.points || []).filter(p => visiblePointIds.has(p.id)),
    };
  }, [tourActive, fullData, currentScene, buildOutIds, staggerRevealedIds, staggerRevealedPointIds]);

  // ── Controls ─────────────────────────────────────────────────────────
  const clearStaggerTimer = useCallback(() => {
    if (staggerTimerRef.current) {
      clearInterval(staggerTimerRef.current);
      staggerTimerRef.current = null;
    }
    if (staggerPointTimerRef.current) {
      clearInterval(staggerPointTimerRef.current);
      staggerPointTimerRef.current = null;
    }
  }, []);

  const startTour = useCallback(() => {
    setShowWelcome(false);
    setSceneIndex(0);
    setBuildOutIds(null);
    clearStaggerTimer();
    setStaggerRevealedIds(new Set());
    setStaggerRevealedPointIds(new Set());
    setTourActive(true);
  }, [clearStaggerTimer]);

  const nextScene = useCallback(() => {
    const nextSceneDef = TOUR_SCENES[sceneIndex + 1];
    // Keep modal open if the next scene wants it (e.g. irenaeus-2 → irenaeus-3)
    if (!nextSceneDef?.keepModalOpen) {
      timelineRef?.current?.closeModal?.();
    }
    timelineRef?.current?.closeYearSummary?.();
    if (sceneIndex < TOUR_SCENES.length - 1) {
      setSceneIndex(i => i + 1);
    }
  }, [sceneIndex, timelineRef]);

  const prevScene = useCallback(() => {
    timelineRef?.current?.closeModal?.();
    timelineRef?.current?.closeYearSummary?.();
    if (sceneIndex > 0) {
      // If going back from build-out, cancel animation
      if (currentScene?.isBuildOut && buildOutTimerRef.current) {
        clearInterval(buildOutTimerRef.current);
        setBuildOutIds(null);
      }
      setSceneIndex(i => i - 1);
    }
  }, [sceneIndex, currentScene, timelineRef]);

  const completeTour = useCallback(() => {
    timelineRef?.current?.closeModal?.();
    timelineRef?.current?.closeYearSummary?.();
    if (buildOutTimerRef.current) {
      clearInterval(buildOutTimerRef.current);
    }
    clearStaggerTimer();
    setBuildOutIds(null);
    setTourActive(false);
    try {
      localStorage.setItem(storageKey, 'true');
    } catch {
      // ignore
    }
  }, [timelineRef, clearStaggerTimer, storageKey]);

  const skipTour = useCallback(() => {
    timelineRef?.current?.closeModal?.();
    timelineRef?.current?.closeYearSummary?.();
    if (buildOutTimerRef.current) {
      clearInterval(buildOutTimerRef.current);
    }
    clearStaggerTimer();
    setBuildOutIds(null);
    setTourActive(false);
    setShowWelcome(false);
    try {
      localStorage.setItem(storageKey, 'true');
    } catch {
      // ignore
    }
  }, [timelineRef, clearStaggerTimer, storageKey]);

  const dismissWelcome = useCallback(() => {
    setShowWelcome(false);
    try {
      localStorage.setItem(storageKey, 'true');
    } catch {
      // ignore
    }
  }, [storageKey]);

  return {
    // State
    tourActive,
    showWelcome,
    currentScene,
    sceneIndex,
    totalScenes: TOUR_SCENES.length,
    tourData,
    newlyAddedIds,
    newlyAddedPointIds,
    sceneMedia,

    // Controls
    startTour,
    nextScene,
    prevScene,
    completeTour,
    skipTour,
    dismissWelcome,
  };
}
