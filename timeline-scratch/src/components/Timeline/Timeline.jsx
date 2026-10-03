/**
 * Main Timeline component
 * Combines Canvas rendering, overlays, and interactivity
 */

import { useState, useRef, useCallback, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import { useZoomPan } from './hooks/useZoomPan.js';
import { useTimelineLayout } from './hooks/useTimelineLayout.js';
import { useMobileDetect } from './hooks/useMobileDetect.js';
import { useSmoothPan } from './hooks/useSmoothPan.js';
import { TimelineCanvas } from './components/TimelineCanvas.jsx';
import { TimelineOverlay } from './components/TimelineOverlay.jsx';
import { TimelineModal } from './components/TimelineModal.jsx';
import { YearSummaryModal } from './components/YearSummaryModal.jsx';
import { TimelineLegend } from './components/TimelineLegend.jsx';
import { MobileTimeline } from './components/MobileTimeline.jsx';
import { Icon } from './components/Icon.jsx';
import { DepthLayers } from './components/DepthLayers.jsx';
import { getYear, formatYear, formatYearSpan } from './utils/dateUtils.js';
import { applyFilters, buildInitialFilters } from './utils/filters.js';
import bgManuscript from '../../assets/bg-manuscript.jpg';
import './Timeline.css';

/**
 * "300–700 AD": the years across the canvas, rounded to a step that suits the
 * span, so the readout says where the reader is rather than an abstract ratio.
 */
function visibleSpanLabel(startYear, yearsPerPixel, width, eraLabels) {
  const span = width * yearsPerPixel;
  const step = span > 1500 ? 100 : span > 400 ? 50 : span > 100 ? 10 : span > 30 ? 5 : 1;
  // Year 0 is only an axis position; a window opening there starts at AD 1.
  const round = y => Math.round(y / step) * step || 1;
  return formatYearSpan(round(startYear), round(startYear + span), eraLabels);
}

/** Stable empty dataset, so the background layout hook keeps a steady identity. */
const EMPTY_LAYER_DATA = { people: [], points: [], periods: [] };

/** The three resting states of the background layer (CH Timeline 2.0). */
const DEPTH_MODES = [
  { id: 'hidden',      label: 'Off',    title: 'Hide the background layer' },
  { id: 'watercolour', label: 'Soft',   title: 'Background as a watercolour wash (default)' },
  { id: 'forward',     label: 'Front',  title: 'Bring the whole background into focus — or hold Alt' },
];

export const Timeline = forwardRef(function Timeline({ data, config, onViewportChange, onItemClick, suppressModal = false, authContext, allPeople, adminContext, contributorContext, onEntityUpdated, onDataChanged, showBackgroundImage = false, layoutSizes, animatingIds, animatingPointIds, hideLegend = false, isTourMode = false, backData, focusIds, depthMode, isFocusPreview = false, detailVariant = 'modal', onPersonHover, onPersonSelect, onDepthModeChange, layout, layoutToggle, animationWave }, ref) {
  const isMobile = useMobileDetect();

  // Which timeline to draw. By default the vertical one on small screens and
  // the horizontal one otherwise; a page may choose (layout: 'vertical' |
  // 'horizontal', Lifelines' layout toggle). The horizontal timeline on a
  // phone opens its detail as a modal rather than a side panel.
  const vertical = layout ? layout === 'vertical' : isMobile;
  const horizontalOnPhone = isMobile && !vertical;
  if (vertical) {
    return (
      <MobileTimeline
        ref={ref}
        layoutToggle={layoutToggle}
        data={data}
        config={config}
        onItemClick={onItemClick}
        authContext={authContext}
        allPeople={allPeople}
        adminContext={adminContext}
        contributorContext={contributorContext}
        onEntityUpdated={onEntityUpdated}
        onDataChanged={onDataChanged}
      />
    );
  }

  return (
    <DesktopTimeline
      ref={ref}
      data={data}
      // config.phone overrides keys on a phone (the opening span, say).
      config={horizontalOnPhone && config.phone ? { ...config, ...config.phone } : config}
      phoneLayout={horizontalOnPhone}
      layoutToggle={layoutToggle}
      animationWave={animationWave}
      onViewportChange={onViewportChange}
      onItemClick={onItemClick}
      suppressModal={suppressModal}
      authContext={authContext}
      allPeople={allPeople}
      adminContext={adminContext}
      contributorContext={contributorContext}
      onEntityUpdated={onEntityUpdated}
      onDataChanged={onDataChanged}
      showBackgroundImage={showBackgroundImage}
      layoutSizes={layoutSizes}
      animatingIds={animatingIds}
      animatingPointIds={animatingPointIds}
      hideLegend={hideLegend}
      isTourMode={isTourMode}
      backData={backData}
      focusIds={focusIds}
      depthMode={depthMode}
      isFocusPreview={isFocusPreview}
      detailVariant={horizontalOnPhone ? 'modal' : detailVariant}
      onPersonHover={onPersonHover}
      onPersonSelect={onPersonSelect}
      onDepthModeChange={onDepthModeChange}
    />
  );
});

// True on a screen with no hover-capable pointer (a phone, an iPad without a
// trackpad). Checked per event: an iPad gains hover when a trackpad connects.
const noHover = () => typeof window !== 'undefined' && window.matchMedia?.('(hover: none)').matches;

const DesktopTimeline = forwardRef(function DesktopTimeline({ data, config, onViewportChange, onItemClick, suppressModal = false, authContext, allPeople, adminContext, contributorContext, onEntityUpdated, onDataChanged, showBackgroundImage = false, layoutSizes, animatingIds, animatingPointIds, hideLegend = false, isTourMode = false, backData, focusIds, depthMode = 'watercolour', isFocusPreview = false, detailVariant = 'modal', onPersonHover, onPersonSelect, onDepthModeChange, phoneLayout = false, layoutToggle, animationWave }, ref) {
  const containerRef = useRef(null);
  const wasDraggingRef = useRef(false);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  // False until the ResizeObserver reports the container's real size; the
  // initial vertical placement waits for it (see below).
  const [measured, setMeasured] = useState(false);
  const [hoveredItem, setHoveredItem] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  // The cursor line and year chip follow the pointer only while it is over the
  // timeline; otherwise they froze at the last position, often under the header.
  const [pointerInside, setPointerInside] = useState(false);
  const [filters, setFilters] = useState(() => buildInitialFilters(config));
  // Cursor line and year summary state
  const [pinnedYear, setPinnedYear] = useState(null);
  const [yearSummaryOpen, setYearSummaryOpen] = useState(false);
  const [isOverControls, setIsOverControls] = useState(false);
  // Search highlight state: { matches: [], currentIdx: number, query: string } | null
  const [searchHighlight, setSearchHighlight] = useState(null);

  // Default config
  const defaultConfig = {
    initialViewport: {
      startDate: '0001-01-01',
      endDate: '0200-12-31'
    },
    eraLabels: 'BC/AD',
    maxTimeSpan: 6000,
    laneOrder: ['people', 'periods', 'points'],
    legend: [],
    ...config
  };

  // Parse initial viewport — keep zoom level from config, and centre on year
  // 1000 unless the config names its own centre. Datasets that don't span the
  // middle ages (the heresies timeline stops at Chalcedon) need to say where
  // to open, or they land on empty canvas.
  const initialStartYear = getYear(defaultConfig.initialViewport.startDate);
  const initialEndYear = getYear(defaultConfig.initialViewport.endDate);
  const initialYearsPerPixel = (initialEndYear - initialStartYear) / dimensions.width;
  const initialCenterYear = defaultConfig.initialCenterYear ?? 1000;
  const centeredViewportStart = initialCenterYear - (dimensions.width / 2 * initialYearsPerPixel);

  // Derive min/max year from actual data extent (not just initial viewport)
  const dataExtent = useMemo(() => {
    let min = initialStartYear;
    let max = initialEndYear;
    // The background counts towards the extent too: an emperor reigning
    // outside the foreground's span still has to be reachable by panning.
    const allItems = [
      ...(data.people || []),
      ...(data.periods || []),
      ...(backData?.people || []),
      ...(backData?.periods || []),
    ];
    for (const item of allItems) {
      const s = getYear(item.startDate);
      const e = getYear(item.endDate);
      if (s < min) min = s;
      if (e > max) max = e;
    }
    for (const point of [...(data.points || []), ...(backData?.points || [])]) {
      const y = getYear(point.date);
      if (y < min) min = y;
      if (y > max) max = y;
      if (point.endDate) {
        const e = getYear(point.endDate);
        if (e > max) max = e;
      }
    }
    return { min, max };
  }, [data, backData, initialStartYear, initialEndYear]);

  const yearPadding = Math.max((dataExtent.max - dataExtent.min) * 0.1, 200);
  const derivedMinYear = Math.floor(dataExtent.min - yearPadding);
  const derivedMaxYear = Math.ceil(dataExtent.max + yearPadding);

  // Zoom and pan state
  const {
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
    isPanning
  } = useZoomPan({
    initialViewportStartYear: centeredViewportStart,
    initialYearsPerPixel: initialYearsPerPixel,
    minYearsPerPixel: 0.1,
    maxYearsPerPixel: 50,
    minYear: derivedMinYear,
    maxYear: derivedMaxYear
  });

  // Filter data based on active filters
  const filteredData = useMemo(() => applyFilters(data, filters), [data, filters]);

  // The background layer runs through the same legend filters — its rows just
  // declare their own filterKeys — so toggling "Emperors" off empties it the
  // same way toggling an era empties the foreground.
  const filteredBackData = useMemo(
    () => (backData ? applyFilters(backData, filters) : null),
    [backData, filters]
  );

  const itemIndex = useMemo(() => {
    const map = new Map();
    // Background items are indexed alongside foreground ones so the detail
    // panel can still resolve a connection to an emperor or a heresiarch —
    // they are only *drawn* on another layer, not held apart from the data.
    const layers = backData ? [data, backData] : [data];
    for (const layer of layers) {
      layer.people?.forEach(person => {
        map.set(person.id, { type: 'person', item: person });
      });
      layer.points?.forEach(point => {
        map.set(point.id, { type: 'point', item: point });
      });
      layer.periods?.forEach(period => {
        map.set(period.id, { type: 'period', item: period });
      });
    }
    return map;
  }, [data, backData]);

  // Re-select the current item from fresh data after a refetch
  useEffect(() => {
    if (selectedItem && itemIndex) {
      const fresh = itemIndex.get(selectedItem.item?.id);
      if (fresh) {
        setSelectedItem({ type: fresh.type, item: fresh.item });
      }
    }
  }, [itemIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Landmarks carry their full pin-and-flag card when there is room for it,
  // and collapse to a bare pin when zoomed out. Without this the sixty
  // councils and texts stack by label width into a wall of cards that buries
  // the people lane — the cost of promoting them to the foreground, paid only
  // where it buys legibility.
  const showPointLabels = yearsPerPixel <= (defaultConfig.pointLabelMaxYearsPerPixel ?? Infinity);

  // Layout calculation
  const layout = useTimelineLayout(
    filteredData,
    defaultConfig.laneOrder,
    yearsPerPixel,
    {
      personRowHeight: 34,
      pointRowHeight: 20,
      periodRowHeight: 40,
      lanePadding: 8,
      axisHeight: 30,
      // Bare pins collide at the pin's own width, not a label's. Harp strings
      // (config.pointStyle === 'string') need no stacking at all: one row on
      // each side of the axis holds their labels.
      pointMarkerWidth: defaultConfig.pointStyle === 'string' ? 0 : (showPointLabels ? null : 24),
      ...layoutSizes,
    }
  );

  // The background gets its own stacking pass — it has its own row counts, so
  // it cannot share the foreground's layout. DepthLayers registers the two
  // against a single axis afterwards.
  // Deliberately tighter than the foreground. The background is read as mass,
  // not as a list: bare markers rather than labelled callouts, and rows close
  // enough that eighty-five events form a band beside the axis instead of a
  // cascade running off the bottom of the screen.
  const backLayout = useTimelineLayout(
    filteredBackData || EMPTY_LAYER_DATA,
    defaultConfig.laneOrder,
    yearsPerPixel,
    {
      personRowHeight: 20,
      pointRowHeight: 13,
      periodRowHeight: 24,
      periodBracketHeight: 11,
      lanePadding: 6,
      axisHeight: 30,
      pointMarkerWidth: 16,
      ...layoutSizes,
      ...(defaultConfig.backLayoutSizes || {}),
    }
  );

  // Frame the opening window against the measured width, once.
  //
  // useZoomPan keeps the scale it is first handed, and on first render that
  // scale comes from the placeholder 800px — so a 1440px canvas opened showing
  // 1.8x the configured span, centred wherever that landed (Lifelines' 1–500
  // window opened on AD 750–1650). Reset already used the real width, which is
  // why the bug only showed on load. Opt-in, so the pages that have been tuned
  // around the old opening keep it.
  const initialFrameDone = useRef(false);
  useEffect(() => {
    if (!defaultConfig.fitInitialViewport || !measured || initialFrameDone.current) return;
    initialFrameDone.current = true;
    setYearsPerPixel(initialYearsPerPixel);
    setViewportStartYear(centeredViewportStart);
  }, [defaultConfig.fitInitialViewport, measured, initialYearsPerPixel, centeredViewportStart, setYearsPerPixel, setViewportStartYear]);

  // Center the axis vertically on initial load, then hold it steady.
  //
  // axisY is measured from the top of the virtual world, so it moves whenever
  // the lanes above it change height — which happens every time a legend
  // filter is toggled. Without the follow-up adjustment the whole world jumps
  // by that delta and can leave the viewport entirely.
  //
  // The initial placement waits for `measured`: `dimensions` starts at a
  // placeholder 800x600 and the ResizeObserver reports the real size a tick
  // later. Placing the axis against the placeholder would apply the fraction
  // to the wrong height — a 900px canvas would keep the 600px-derived offset,
  // since the follow-up branch below only reacts to axisY, not to height.
  const initialCenterDone = useRef(false);
  const lastAxisY = useRef(null);
  useEffect(() => {
    if (!measured || layout.axisY <= 0 || dimensions.height <= 0) return;

    const maxOffset = Math.max(0, layout.totalHeight - dimensions.height);

    if (!initialCenterDone.current) {
      initialCenterDone.current = true;
      lastAxisY.current = layout.axisY;
      // Where the axis sits on first paint, as a fraction of viewport height.
      // Centre by default; datasets with a deep people lane (the heresies
      // timeline) can push the axis down to give the figures more room.
      const axisFraction = defaultConfig.initialAxisFraction ?? 0.5;
      const targetOffset = Math.max(0, layout.axisY - dimensions.height * axisFraction);
      setVerticalOffset(Math.min(targetOffset, maxOffset));
      return;
    }

    // Keep the axis where the user last had it as lanes grow and shrink.
    const delta = layout.axisY - lastAxisY.current;
    if (delta !== 0) {
      lastAxisY.current = layout.axisY;
      setVerticalOffset(prev => {
        const next = (typeof prev === 'number' ? prev : 0) + delta;
        return Math.max(0, Math.min(next, maxOffset));
      });
    }
  }, [measured, layout.axisY, layout.totalHeight, dimensions.height, setVerticalOffset, defaultConfig.initialAxisFraction]);

  // Handle container resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
        if (width > 0 && height > 0) setMeasured(true);
      }
    });

    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  // A docked detail panel sits *beside* the timeline rather than over it, so
  // unlike a centred modal it must not freeze panning and zooming — reading
  // the detail against the background is the whole reason it is docked.
  const isModalOpen = (selectedItem !== null && detailVariant !== 'panel') || yearSummaryOpen;

  // Handle wheel/trackpad: pinch → zoom, two-finger scroll → pan
  // Touch: drag to pan, pinch to zoom about the fingers (config.touchGestures,
  // Lifelines). The timeline otherwise only knew the mouse, so on an iPad,
  // which gets this desktop timeline, a finger drag did nothing at all. Taps
  // are left to the browser's synthesised click, which the item and
  // empty-timeline click handling already serve. Needs touch-action: none on
  // the container (ChurchHistory2App.css), so the page doesn't scroll instead.
  const touchRef = useRef({});
  useEffect(() => {
    touchRef.current = {
      width: dimensions.width,
      maxOffsetY: Math.max(0, layout.totalHeight - dimensions.height),
      handlePanX, handlePanY, handleZoom,
    };
  });
  useEffect(() => {
    if (!defaultConfig.touchGestures) return;
    const el = containerRef.current;
    if (!el) return;
    let last = null;
    let moved = 0;
    const point = (t) => {
      const r = el.getBoundingClientRect();
      return { x: t.clientX - r.left, y: t.clientY - r.top };
    };
    const snapshot = (touches) => {
      if (touches.length === 1) {
        last = { mode: 'pan', ...point(touches[0]) };
      } else if (touches.length >= 2) {
        const a = point(touches[0]);
        const b = point(touches[1]);
        last = { mode: 'pinch', dist: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      } else {
        last = null;
      }
    };
    const onStart = (e) => {
      // Controls, the legend, dialogs and links keep their own touch.
      if (e.target.closest?.('.timeline-controls, .timeline-legend, .timeline-modal, button, a, input, label')) {
        last = null;
        return;
      }
      moved = 0;
      snapshot(e.touches);
    };
    const onMove = (e) => {
      if (!last) return;
      const { width, maxOffsetY, handlePanX: panX, handlePanY: panY, handleZoom: zoom } = touchRef.current;
      if (e.touches.length >= 2) {
        const a = point(e.touches[0]);
        const b = point(e.touches[1]);
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        if (last.mode !== 'pinch' || last.dist === 0) { snapshot(e.touches); return; }
        // Zoom scales years-per-pixel by 1.1^delta; a spread of ratio r
        // should divide it by r.
        zoom(-Math.log(dist / last.dist) / Math.log(1.1), mid.x, width);
        panX(mid.x - last.x, width);
        panY(mid.y - last.y, maxOffsetY);
        moved += Math.abs(mid.x - last.x) + Math.abs(mid.y - last.y) + Math.abs(dist - last.dist);
        last = { mode: 'pinch', dist, ...mid };
      } else if (e.touches.length === 1) {
        const p = point(e.touches[0]);
        if (last.mode !== 'pan') { snapshot(e.touches); return; }
        panX(p.x - last.x, width);
        panY(p.y - last.y, maxOffsetY);
        moved += Math.abs(p.x - last.x) + Math.abs(p.y - last.y);
        last = { mode: 'pan', ...p };
      }
    };
    const onEnd = (e) => {
      // A gesture that moved is not a tap: suppress the click it may synthesise.
      if (moved > 8) {
        wasDraggingRef.current = true;
        setTimeout(() => { wasDraggingRef.current = false; }, 400);
      }
      snapshot(e.touches);
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [defaultConfig.touchGestures]);

  const handleWheel = useCallback((e) => {
    if (isModalOpen) {
      return; // Let the modal handle its own scrolling
    }
    // The page itself is zoomed in (a pinch over the header, say): leave the
    // wheel and pinch to the browser, or the reader can't scroll back out to
    // the header, or pinch the page back out, while over the timeline.
    if ((window.visualViewport?.scale ?? 1) > 1.01) return;
    e.preventDefault();

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;

    // Pinch-to-zoom: browsers set ctrlKey for trackpad pinch gestures
    if (e.ctrlKey) {
      handleZoom(e.deltaY / 100, mouseX, dimensions.width);
      return;
    }

    // Two-finger scroll → pan
    const maxOffsetY = Math.max(0, layout.totalHeight - dimensions.height);
    if (e.deltaX !== 0) {
      handlePanX(-e.deltaX, dimensions.width);
    }
    if (e.deltaY !== 0) {
      handlePanY(-e.deltaY, maxOffsetY);
    }
  }, [handleZoom, handlePanX, handlePanY, dimensions.width, dimensions.height, layout.totalHeight, isModalOpen]);

  // Attach wheel listener as non-passive so preventDefault() works
  // (prevents browser back/forward on horizontal swipe)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // Safari reports a trackpad pinch as gesture events, not a ctrl+wheel, so
  // over the timeline it zoomed the whole page instead of the timeline.
  const gestureRef = useRef({});
  useEffect(() => {
    gestureRef.current = { handleZoom, width: dimensions.width, isModalOpen };
  });
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !('GestureEvent' in window)) return;
    let lastScale = 1;
    const start = (e) => {
      if (gestureRef.current.isModalOpen || (window.visualViewport?.scale ?? 1) > 1.01) return;
      e.preventDefault();
      lastScale = e.scale || 1;
    };
    const change = (e) => {
      if (gestureRef.current.isModalOpen || (window.visualViewport?.scale ?? 1) > 1.01) return;
      e.preventDefault();
      const { handleZoom: zoom, width } = gestureRef.current;
      const rect = el.getBoundingClientRect();
      const scale = e.scale || 1;
      // A spread of ratio r divides years-per-pixel by r; zoom takes 1.1^delta.
      zoom(-Math.log(scale / lastScale) / Math.log(1.1), e.clientX - rect.left, width);
      lastScale = scale;
    };
    el.addEventListener('gesturestart', start, { passive: false });
    el.addEventListener('gesturechange', change, { passive: false });
    return () => {
      el.removeEventListener('gesturestart', start);
      el.removeEventListener('gesturechange', change);
    };
  }, []);

  // Handle mouse down for pan or blank click
  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return; // Only left click
    if (isModalOpen) return;

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Store click position to detect if it was a click vs drag
    containerRef.current._clickStart = { x, y, time: Date.now() };

    startPan(x, y);
    container.style.cursor = 'grabbing';
  }, [isModalOpen, startPan]);

  // Handle mouse move
  const handleMouseMove = useCallback((e) => {
    const container = containerRef.current;
    if (!container) return;
    if (isModalOpen) return;

    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setMousePos({ x, y });
    // A touch screen has no hover: the mouse events a tap synthesises would
    // leave the cursor line, year chip and hover card stuck where the finger was.
    if (!(defaultConfig.touchGestures && noHover())) setPointerInside(true);

    if (isPanning) {
      const maxOffsetY = Math.max(0, layout.totalHeight - dimensions.height);
      updatePan(x, y, dimensions.width, maxOffsetY);
    }
  }, [isModalOpen, isPanning, updatePan, dimensions, layout.totalHeight, defaultConfig.touchGestures]);

  // Calculate cursor year from mouse X position (needs to be before handleMouseUp)
  const cursorYear = useMemo(() => {
    return Math.round(viewportStartYear + mousePos.x * yearsPerPixel);
  }, [viewportStartYear, mousePos.x, yearsPerPixel]);

  const pendingYearSummaryRef = useRef(null);

  // Handle mouse up
  const handleMouseUp = useCallback((e) => {
    const container = containerRef.current;
    if (!container) return;
    if (isModalOpen) return;

    // Where the pointer was released, from the event itself. mousePos is
    // state, as fresh as the last render; mousedown already reads the event,
    // so comparing the two called a stale mousePos a drag. A tap (no move
    // before it, as on a touch screen) or a quick click after a move was
    // then swallowed as a drag, and a landmark card's click opened nothing.
    const rect = container.getBoundingClientRect();
    const upX = e?.clientX != null ? e.clientX - rect.left : mousePos.x;
    const upY = e?.clientY != null ? e.clientY - rect.top : mousePos.y;

    // A click on empty timeline opens that year's summary. "Empty" is judged
    // from the event, not from hover state, which has the same freshness
    // problem: the click has to land on a canvas (not a button, the legend or
    // a label), and the summary waits a frame so that a click which opened an
    // item (the canvas's own click, or a label's) cancels it.
    const clickStart = container._clickStart;
    const onCanvas = e?.target?.tagName === 'CANVAS';
    // hoveredItem and isOverControls are deliberately not consulted: they are
    // state, stale for a click that follows a move too quickly. The target
    // rules out controls and labels, and an item hit on the canvas cancels
    // the pending summary through handleItemClickInternal.
    if (clickStart && onCanvas && !selectedItem && !yearSummaryOpen) {
      const dx = Math.abs(upX - clickStart.x);
      const dy = Math.abs(upY - clickStart.y);
      const duration = Date.now() - clickStart.time;

      // If minimal movement and short duration, treat as click
      if (dx < 5 && dy < 5 && duration < 300) {
        const year = Math.round(viewportStartYear + upX * yearsPerPixel);
        pendingYearSummaryRef.current = year;
        requestAnimationFrame(() => {
          if (pendingYearSummaryRef.current === year) {
            pendingYearSummaryRef.current = null;
            setPinnedYear(year);
            setYearSummaryOpen(true);
          }
        });
      }
    }
    container._clickStart = null;

    endPan();
    container.style.cursor = 'grab';

    // If any significant movement happened, suppress the next canvas click
    if (clickStart) {
      const dx = Math.abs(upX - clickStart.x);
      const dy = Math.abs(upY - clickStart.y);
      if (dx >= 5 || dy >= 5) {
        wasDraggingRef.current = true;
        requestAnimationFrame(() => { wasDraggingRef.current = false; });
      }
    }
  }, [endPan, isModalOpen, mousePos, viewportStartYear, yearsPerPixel, selectedItem, yearSummaryOpen]);

  // Handle item hover
  const handleItemHover = useCallback((type, item) => {
    if (type && item && !(defaultConfig.touchGestures && noHover())) {
      setHoveredItem({ type, item, mouseX: mousePos.x, mouseY: mousePos.y });
    } else {
      setHoveredItem(null);
    }
    // Depth preview: hovering a figure lifts their background, and only theirs.
    onPersonHover?.(type === 'person' ? item?.id ?? null : null);
  }, [mousePos, onPersonHover, defaultConfig.touchGestures]);

  // The legend gives way when space is short (config.legendCollapsible): it
  // folds to a "Key" button while the detail panel is open or the timeline is
  // narrower than 1100px, so it never sits over the figures being read. A
  // reader's own open/close wins until that situation changes, e.g. the panel
  // closes, and then the automatic choice applies again.
  const legendAutoCollapsed = !!defaultConfig.legendCollapsible
    && (!!selectedItem || (measured && dimensions.width < 1100));
  const [legendChoice, setLegendChoice] = useState(null);
  useEffect(() => { setLegendChoice(null); }, [legendAutoCollapsed]);
  const legendCollapsed = legendChoice ?? legendAutoCollapsed;
  const toggleLegend = useCallback(() => setLegendChoice(!legendCollapsed), [legendCollapsed]);

  // Leaving the timeline ends any hover as well as any drag. Canvas items only
  // clear their hover on a mousemove over empty canvas, so a pointer that left
  // straight into the header kept the last hover card on screen indefinitely.
  const handleContainerLeave = useCallback((e) => {
    handleMouseUp(e);
    setHoveredItem(null);
    setPointerInside(false);
    onPersonHover?.(null);
  }, [handleMouseUp, onPersonHover]);

  // Handle item click
  const handleItemClickInternal = useCallback((type, item) => {
    // This click opened an item, so it was not a click on empty timeline.
    pendingYearSummaryRef.current = null;
    setHoveredItem(null);
    if (!suppressModal) {
      setSelectedItem({ type, item });
    }
    onPersonSelect?.(type === 'person' ? item?.id ?? null : null, type, item);
    onItemClick?.(type, item);
  }, [onItemClick, suppressModal, onPersonSelect]);

  const handleModalItemSelect = useCallback((type, item) => {
    setSelectedItem({ type, item });
    onItemClick?.(type, item);
  }, [onItemClick]);

  // Handle modal close
  const handleModalClose = useCallback(() => {
    setSelectedItem(null);
    onPersonSelect?.(null, null, null);
  }, [onPersonSelect]);

  // Handle filter toggle
  const handleFilterToggle = useCallback((filterKey) => {
    setFilters(prev => ({
      ...prev,
      [filterKey]: !prev[filterKey]
    }));
  }, []);

  // --- Search handlers ---
  // Find an item's Y position in the layout for vertical centering
  const getItemY = useCallback((type, itemId) => {
    if (type === 'person') {
      const found = layout.stackedPeople?.find(p => p.id === itemId);
      return found ? found.y + (found.height || 0) / 2 : null;
    }
    if (type === 'point') {
      const found = layout.stackedPoints?.find(p => p.id === itemId);
      return found ? found.y : null;
    }
    if (type === 'period') {
      const found = layout.stackedPeriods?.find(p => p.id === itemId);
      return found ? found.y + (found.bracketHeight || 0) / 2 : null;
    }
    return null;
  }, [layout]);

  // Handle search autocomplete selection — scroll to item and open modal
  const handleSearchSelect = useCallback((type, item) => {
    // Clear any find highlights
    setSearchHighlight(null);

    // Get the item's year and scroll horizontally
    const year = type === 'point' ? getYear(item.date) : getYear(item.startDate);
    if (year != null) {
      jumpToYear(year, dimensions.width);
    }

    // Calculate vertical offset to center the item
    const itemY = getItemY(type, item.id);
    if (itemY != null) {
      const targetOffset = Math.max(0, itemY - dimensions.height / 2);
      const maxOffset = Math.max(0, layout.totalHeight - dimensions.height);
      setVerticalOffset(Math.min(targetOffset, maxOffset));
    }

    // Open the modal
    if (!suppressModal) {
      setSelectedItem({ type, item });
    }
    // Arriving at a figure through search is the same act as clicking them, so
    // it focuses their background the same way.
    onPersonSelect?.(type === 'person' ? item?.id ?? null : null, type, item);
    onItemClick?.(type, item);
  }, [jumpToYear, dimensions, getItemY, layout.totalHeight, setVerticalOffset, suppressModal, onItemClick, onPersonSelect]);

  // Handle search find mode — highlight matches and scroll to current
  const handleSearchHighlight = useCallback((matches, currentIdx, query) => {
    setSearchHighlight({ matches, currentIdx, query });

    // Scroll to the current match
    if (matches.length > 0 && currentIdx >= 0 && currentIdx < matches.length) {
      const match = matches[currentIdx];
      const year = match.type === 'point' ? getYear(match.item.date) : getYear(match.item.startDate);
      if (year != null) {
        jumpToYear(year, dimensions.width);
      }
      const itemY = getItemY(match.type, match.item.id);
      if (itemY != null) {
        const targetOffset = Math.max(0, itemY - dimensions.height / 2);
        const maxOffset = Math.max(0, layout.totalHeight - dimensions.height);
        setVerticalOffset(Math.min(targetOffset, maxOffset));
      }
    }
  }, [jumpToYear, dimensions, getItemY, layout.totalHeight, setVerticalOffset]);

  // Clear search highlights
  const handleSearchClearHighlight = useCallback(() => {
    setSearchHighlight(null);
  }, []);

  // Expose search methods to parent via ref
  useImperativeHandle(ref, () => ({
    selectItem: handleSearchSelect,
    highlight: handleSearchHighlight,
    clearHighlight: handleSearchClearHighlight,
    // Tour support: viewport control
    jumpToYear: (year) => jumpToYear(year, dimensions.width),
    setYearsPerPixel,
    setViewportStartYear,
    setVerticalOffset,
    animateViewport,
    // Back to the opening view: its span, centre and axis height, framed on
    // the real width. Animated, it glides there (Lifelines' tour exit).
    resetView: ({ animate = false, duration = 1000 } = {}) => {
      const fraction = defaultConfig.initialAxisFraction ?? 0.5;
      const maxOffset = Math.max(0, layout.totalHeight - dimensions.height);
      const offset = Math.min(Math.max(0, layout.axisY - dimensions.height * fraction), maxOffset);
      if (animate) {
        animateViewport(centeredViewportStart, initialYearsPerPixel, offset, duration);
      } else {
        setYearsPerPixel(initialYearsPerPixel);
        setViewportStartYear(centeredViewportStart);
        setVerticalOffset(offset);
      }
    },
    closeModal: handleModalClose,
    openYearSummary: (year) => {
      setSelectedItem(null); // close any person modal first
      setPinnedYear(year);
      setYearSummaryOpen(true);
    },
    closeYearSummary: () => setYearSummaryOpen(false),
    getViewportInfo: () => ({ width: dimensions.width, height: dimensions.height, yearsPerPixel, viewportStartYear, axisY: layout.axisY, totalHeight: layout.totalHeight }),
  }), [handleSearchSelect, handleSearchHighlight, handleSearchClearHighlight, handleModalClose, jumpToYear, dimensions.width, dimensions.height, setYearsPerPixel, setViewportStartYear, setVerticalOffset, animateViewport, yearsPerPixel, viewportStartYear, layout.axisY, layout.totalHeight, centeredViewportStart, initialYearsPerPixel, defaultConfig.initialAxisFraction]);

  // Compute set of highlighted item IDs for rendering
  const highlightedItemIds = useMemo(() => {
    if (!searchHighlight || searchHighlight.matches.length === 0) return new Set();
    return new Set(searchHighlight.matches.map(m => m.id));
  }, [searchHighlight]);

  const currentHighlightId = useMemo(() => {
    if (!searchHighlight || searchHighlight.matches.length === 0) return null;
    return searchHighlight.matches[searchHighlight.currentIdx]?.id ?? null;
  }, [searchHighlight]);

  // Check if cursor is over an item (to hide the year line)
  const isOverItem = hoveredItem !== null;

  // Get the hovered period (for highlighting related items)
  const hoveredPeriod = useMemo(() => {
    if (hoveredItem?.type === 'period') {
      return hoveredItem.item;
    }
    return null;
  }, [hoveredItem]);

  // Calculate year summary data for a given year
  const getYearSummary = useCallback((year) => {
    const { people = [], points = [], periods = [] } = filteredData;

    // Find periods that contain this year
    const activePeriods = periods.filter(p => {
      const start = getYear(p.startDate);
      const end = getYear(p.endDate);
      return year >= start && year <= end;
    });

    // Find people alive in this year
    // For monarchs, filter by reign dates so only actually reigning
    // emperors appear under "Reigning Emperor(s)"
    const alivePeople = people.filter(p => {
      if (p.isMonarch && p.reignStartYear != null && p.reignEndYear != null) {
        return year >= p.reignStartYear && year <= p.reignEndYear;
      }
      const start = getYear(p.startDate);
      const end = getYear(p.endDate);
      return year >= start && year <= end;
    });

    // Find points that occurred in this exact year
    const yearPoints = points.filter(p => {
      const pointYear = getYear(p.date);
      return pointYear === year;
    });

    // Find events and texts within ±25 years (50-year window)
    const nearbyPoints = points
      .filter(p => {
        const pointYear = getYear(p.date);
        return pointYear >= year - 25 && pointYear <= year + 25;
      })
      .map(p => ({
        ...p,
        pointYear: getYear(p.date),
        yearDelta: getYear(p.date) - year
      }))
      .sort((a, b) => a.pointYear - b.pointYear);

    return { year, activePeriods, alivePeople, yearPoints, nearbyPoints };
  }, [filteredData]);

  // Handle click on blank space (for year summary)
  const handleBlankClick = useCallback((e) => {
    // Only handle if not over an item and not panning
    if (!hoveredItem && !isPanning) {
      setPinnedYear(cursorYear);
      setYearSummaryOpen(true);
    }
  }, [hoveredItem, isPanning, cursorYear]);

  // Close year summary modal
  const handleYearSummaryClose = useCallback(() => {
    setYearSummaryOpen(false);
    // Clear pinned year only if cursor has moved to a different position
    // This is handled by checking in the render
  }, []);

  // Handle zoom buttons
  const handleZoomIn = useCallback(() => {
    const centerX = dimensions.width / 2;
    handleZoom(-2, centerX, dimensions.width); // Negative delta = zoom in
  }, [handleZoom, dimensions.width]);

  const handleZoomOut = useCallback(() => {
    const centerX = dimensions.width / 2;
    handleZoom(2, centerX, dimensions.width); // Positive delta = zoom out
  }, [handleZoom, dimensions.width]);

  // Smooth accelerating directional navigation (arrow keys + compass rose)
  const { startDirection, stopDirection, activeDirections } = useSmoothPan({
    handlePanX,
    handlePanY,
    dimensions,
    layoutTotalHeight: layout.totalHeight,
  });

  // Keyboard arrow key navigation with hold-to-accelerate
  useEffect(() => {
    const keyToDir = {
      ArrowLeft: 'left',
      ArrowRight: 'right',
      ArrowUp: 'up',
      ArrowDown: 'down',
    };

    const handleKeyDown = (e) => {
      if (isModalOpen) return;
      const dir = keyToDir[e.key];
      if (dir) {
        e.preventDefault();
        startDirection(dir);
      }
    };

    const handleKeyUp = (e) => {
      const dir = keyToDir[e.key];
      if (dir) stopDirection(dir);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isModalOpen, startDirection, stopDirection]);

  // Notify viewport changes
  useEffect(() => {
    if (onViewportChange) {
      const endYear = viewportStartYear + (dimensions.width * yearsPerPixel);
      onViewportChange({
        startYear: viewportStartYear,
        endYear: endYear,
        yearsPerPixel: yearsPerPixel
      });
    }
  }, [viewportStartYear, yearsPerPixel, dimensions.width, onViewportChange]);

  const detail = (
    <TimelineModal
      isOpen={selectedItem !== null}
      variant={detailVariant}
      item={selectedItem?.item}
      itemType={selectedItem?.type}
      config={defaultConfig}
      onClose={handleModalClose}
      itemIndex={itemIndex}
      onSelectItem={handleModalItemSelect}
      authContext={authContext}
      allPeople={allPeople}
      adminContext={adminContext}
      contributorContext={contributorContext}
      onEntityUpdated={onEntityUpdated}
      onItemDeleted={() => {
        setSelectedItem(null);
      }}
      onDataChanged={onDataChanged}
    />
  );

  const timelineBody = (
    <div
      ref={containerRef}
      className={`timeline-container${phoneLayout ? ' timeline-container--phone' : ''}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleContainerLeave}
    >
      {/* Background manuscript image with parallax */}
      {showBackgroundImage && (
        <>
          <div
            className="timeline-bg-image"
            style={{
              backgroundImage: `url(${bgManuscript})`,
              transform: `translate(${-33.33 + viewportStartYear * -0.002}%, ${-33.33 + panOffsetY * -0.008}%)`,
            }}
          />
          {/* Semi-transparent overlay on top of background */}
          <div className="timeline-bg-overlay" />
        </>
      )}



      {/* Cursor year line - behind all elements */}
      {pointerInside && !isOverItem && !isPanning && !yearSummaryOpen && !isOverControls && (
        <div
          className="cursor-year-line"
          style={{
            position: 'absolute',
            left: `${mousePos.x}px`,
            top: 0,
            width: '1px',
            height: '100%',
            backgroundColor: 'rgba(100, 100, 100, 0.5)',
            pointerEvents: 'none',
            zIndex: 1
          }}
        />
      )}

      {/* Pinned year line - stays visible when modal open */}
      {yearSummaryOpen && pinnedYear !== null && (
        <div
          className="pinned-year-line"
          style={{
            position: 'absolute',
            left: `${(pinnedYear - viewportStartYear) / yearsPerPixel}px`,
            top: 0,
            width: '2px',
            height: '100%',
            backgroundColor: 'rgba(25, 118, 210, 0.7)',
            pointerEvents: 'none',
            zIndex: 1
          }}
        />
      )}

      {/* CH 2.0: the watercolour background and its focus overlay, behind the
          main figures but above the parallax field. */}
      {filteredBackData && (
        <DepthLayers
          width={dimensions.width}
          height={dimensions.height}
          viewportStartYear={viewportStartYear}
          yearsPerPixel={yearsPerPixel}
          panOffsetY={panOffsetY}
          layout={backLayout}
          frontAxisY={layout.axisY}
          config={defaultConfig}
          focusIds={focusIds}
          depthMode={depthMode}
          isPreview={isFocusPreview}
          showLabels={showPointLabels}
        />
      )}

      <TimelineCanvas
        width={dimensions.width}
        height={dimensions.height}
        viewportStartYear={viewportStartYear}
        yearsPerPixel={yearsPerPixel}
        panOffsetY={panOffsetY}
        layout={layout}
        config={defaultConfig}
        palette={defaultConfig.palette}
        hoveredItem={hoveredItem}
        hoveredPeriod={hoveredPeriod}
        onItemHover={handleItemHover}
        onItemClick={handleItemClickInternal}
        wasDraggingRef={wasDraggingRef}
        highlightedItemIds={highlightedItemIds}
        currentHighlightId={currentHighlightId}
        animatingIds={animatingIds}
        animationWave={animationWave}
        stringsDimmed={Boolean(focusIds && focusIds.size > 0)}
      />

      <TimelineOverlay
        width={dimensions.width}
        height={dimensions.height}
        viewportStartYear={viewportStartYear}
        yearsPerPixel={yearsPerPixel}
        panOffsetY={panOffsetY}
        layout={layout}
        config={defaultConfig}
        hoveredItem={hoveredItem}
        hoveredPeriod={hoveredPeriod}
        highlightedItemIds={highlightedItemIds}
        currentHighlightId={currentHighlightId}
        onItemHover={handleItemHover}
        onItemClick={handleItemClickInternal}
        wasDraggingRef={wasDraggingRef}
        animatingPointIds={animatingPointIds}
        revealIds={animationWave ? animatingIds : undefined}
        revealWave={animationWave}
        isTourMode={isTourMode}
        palette={defaultConfig.palette}
        showPointLabels={showPointLabels}
        focusIds={focusIds}
      />

      {/* Cursor year display - follows cursor */}
      {pointerInside && !isOverItem && !isPanning && !yearSummaryOpen && !isOverControls && (
        <div
          className="cursor-year-display"
          style={{
            position: 'absolute',
            left: `${mousePos.x + 12}px`,
            top: `${mousePos.y - 10}px`,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: '#fff',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: '500',
            pointerEvents: 'none',
            zIndex: 200,
            whiteSpace: 'nowrap'
          }}
        >
          {formatYear(cursorYear, defaultConfig.eraLabels)}
        </div>
      )}

      {!hideLegend && (
        <TimelineLegend
          collapsed={legendCollapsed}
          onToggleCollapsed={defaultConfig.legendCollapsible ? toggleLegend : undefined}
          legend={defaultConfig.legend}
          isVisible={true}
          filters={filters}
          onFilterToggle={handleFilterToggle}
          onMouseEnter={() => setIsOverControls(true)}
          onMouseLeave={() => setIsOverControls(false)}
          siteTitle={defaultConfig.siteTitle}
          siteSubtitle={defaultConfig.siteSubtitle}
          config={defaultConfig}
        />
      )}

      {/* The detail view is rendered outside this container — see the return
          below — so the docked panel variant can be a sibling of the timeline
          rather than an overlay on top of it. */}

      {/* Year Summary Modal */}
      {yearSummaryOpen && pinnedYear !== null && (
        <YearSummaryModal
          year={pinnedYear}
          summary={getYearSummary(pinnedYear)}
          config={defaultConfig}
          onClose={handleYearSummaryClose}
          itemIndex={itemIndex}
          onSelectItem={handleModalItemSelect}
        />
      )}

      {/* Controls */}
      <div
        className="timeline-controls"
        onMouseEnter={() => setIsOverControls(true)}
        onMouseLeave={() => setIsOverControls(false)}
      >
        {/* Compass rose — self-contained cross of 4 arrows + center */}
        <div className="compass-rose">
          <button
            onMouseDown={() => startDirection('up')}
            onMouseUp={() => stopDirection('up')}
            onMouseLeave={() => stopDirection('up')}
            title="Scroll up"
            className={`btn btn-icon compass-btn compass-up${activeDirections.has('up') ? ' active' : ''}`}
          >
            <Icon name="arrow-up" size={12} />
          </button>
          <div className="compass-middle-row">
            <button
              onMouseDown={() => startDirection('left')}
              onMouseUp={() => stopDirection('left')}
              onMouseLeave={() => stopDirection('left')}
              title="Scroll left"
              className={`btn btn-icon compass-btn compass-left${activeDirections.has('left') ? ' active' : ''}`}
            >
              <Icon name="arrow-left" size={12} />
            </button>
            <button onClick={reset} title="Reset view" className="btn btn-icon compass-btn compass-center">
              <Icon name="quatrefoil" size={12} />
            </button>
            <button
              onMouseDown={() => startDirection('right')}
              onMouseUp={() => stopDirection('right')}
              onMouseLeave={() => stopDirection('right')}
              title="Scroll right"
              className={`btn btn-icon compass-btn compass-right${activeDirections.has('right') ? ' active' : ''}`}
            >
              <Icon name="arrow-right" size={12} />
            </button>
          </div>
          <button
            onMouseDown={() => startDirection('down')}
            onMouseUp={() => stopDirection('down')}
            onMouseLeave={() => stopDirection('down')}
            title="Scroll down"
            className={`btn btn-icon compass-btn compass-down${activeDirections.has('down') ? ' active' : ''}`}
          >
            <Icon name="arrow-down" size={12} />
          </button>
        </div>

        {/* Zoom controls — aligned to compass middle row */}
        <div className="zoom-controls">
          <button onClick={handleZoomIn} title="Zoom in" className="btn btn-sm">
            <Icon name="plus" size={14} />
            <span>Zoom in</span>
          </button>
          <button onClick={handleZoomOut} title="Zoom out" className="btn btn-sm">
            <Icon name="minus" size={14} />
            <span>Zoom out</span>
          </button>
          {defaultConfig.zoomReadout === 'years' ? (
            <span className="zoom-info" title="Years in view">
              {visibleSpanLabel(viewportStartYear, yearsPerPixel, dimensions.width, defaultConfig.eraLabels)}
            </span>
          ) : (
            <span className="zoom-info">
              {yearsPerPixel > 0 ? (1 / yearsPerPixel).toFixed(1) : '1.0'}x
            </span>
          )}
        </div>

        {/* A page's own control, e.g. Lifelines' layout toggle. */}
        {layoutToggle}

        {/* Depth control — only where there is a background layer to lift */}
        {filteredBackData && onDepthModeChange && (
          <div
            className="depth-controls"
            role="group"
            aria-label={defaultConfig.depthControl?.heading ?? 'Background layer'}
          >
            {defaultConfig.depthControl?.heading && (
              <span className="depth-controls-heading" aria-hidden="true">{defaultConfig.depthControl.heading}</span>
            )}
            {DEPTH_MODES.map(mode => {
              // config.depthControl renames the modes in the reader's terms
              // ("Rulers: Hide / Faint / Clear") without changing what they do.
              const own = defaultConfig.depthControl?.modes?.[mode.id];
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => onDepthModeChange(mode.id)}
                  title={own?.title ?? mode.title}
                  className={`btn btn-sm depth-btn${depthMode === mode.id ? ' active' : ''}`}
                  aria-pressed={depthMode === mode.id}
                >
                  {own?.label ?? mode.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  // One wrapper for both variants, always.
  //
  // Returning a different root per variant (a flex div for the docked panel, a
  // fragment for the modal) makes React tear the whole timeline down and
  // rebuild it whenever the variant flips — which CH Timeline 2.0 does every
  // time a tour starts or ends, since the tour panel owns the right rail and
  // the detail falls back to a centred modal. The remount resets the
  // ResizeObserver measurement along with zoom and pan, and the canvases come
  // back sized 0×0, so a tour scene renders its DOM labels and none of its
  // bars. Keeping the root stable is what keeps that state alive.
  //
  // The modal variant is unaffected by the flex row: `.timeline-modal` is
  // position-fixed, so it is out of flow and takes no space in it.
  return (
    <div className="timeline-with-panel">
      {timelineBody}
      {detailVariant === 'panel' ? (selectedItem !== null && detail) : detail}
    </div>
  );
});
