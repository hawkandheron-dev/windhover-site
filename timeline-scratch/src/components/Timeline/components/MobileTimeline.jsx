/**
 * Mobile-optimized vertical timeline component
 * Swimlane / Gantt layout: year axis pinned left, person lanes scroll horizontally
 * Each person gets a fixed-width column so bars never overlap or truncate
 */

import { useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import { getYear, getYearRange, formatYear, formatYearSpan } from '../utils/dateUtils.js';
import { getYearLabelInterval } from '../utils/coordinates.js';
import { Icon, ShapeIcon } from './Icon.jsx';
import { TimelineModal } from './TimelineModal.jsx';
import { YearSummaryModal } from './YearSummaryModal.jsx';
import { applyFilters, buildInitialFilters } from '../utils/filters.js';
import { StringMark } from './StringMark.jsx';
import { markForPoint } from '../utils/stringMark.js';
import { placeVerticalLabels } from '../utils/verticalStrings.js';
import { packRulerRows } from '../utils/rulerStrip.js';
import './MobileTimeline.css';

const DEFAULT_PIXELS_PER_YEAR = 8;
const MIN_PIXELS_PER_YEAR = 1.5;
const MAX_PIXELS_PER_YEAR = 40;
const LANE_WIDTH = 100;
const LANE_GAP = 4;
const GUTTER_WIDTH = 60;
// Harp strings (config.pointStyle === 'string'): the landmarks' labels get a
// column of their own between the year axis and the lanes, so they never sit
// on a figure's bar.
const STRING_LABEL_COLUMN = 116;
// Rulers (config.rulerStyle === 'strip'): the bottom strip's vertical twin, a
// column pinned to the right edge. Each sub-column holds a thin reign bar
// with the name running down beside it.
const RULER_SUBCOLUMN = 16;
const RULER_SUBCOLUMNS = 4;
const RULER_COLUMN = RULER_SUBCOLUMN * RULER_SUBCOLUMNS + 8;

/** Lighten a hex color for readability on dark backgrounds */
function lightenColor(hex, floor = 160) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  // Boost each channel so the minimum is `floor`
  const lr = Math.min(255, Math.max(r, floor) + Math.round((255 - Math.max(r, floor)) * 0.3));
  const lg = Math.min(255, Math.max(g, floor) + Math.round((255 - Math.max(g, floor)) * 0.3));
  const lb = Math.min(255, Math.max(b, floor) + Math.round((255 - Math.max(b, floor)) * 0.3));
  return `rgb(${lr}, ${lg}, ${lb})`;
}

export const MobileTimeline = forwardRef(function MobileTimeline({ data, config, onItemClick, authContext, allPeople, adminContext, contributorContext, onEntityUpdated, onDataChanged, layoutToggle, detailBrief = false, backData, newRulerIds }, ref) {
  const scrollRef = useRef(null);
  const [pixelsPerYear, setPixelsPerYear] = useState(DEFAULT_PIXELS_PER_YEAR);
  // The years currently on screen, for the 'years' zoom readout. Read from the
  // scroll position on scroll (one update per frame) and after zooming.
  const [visibleYears, setVisibleYears] = useState(null);
  const readoutFrame = useRef(0);
  const [selectedItem, setSelectedItem] = useState(null);
  const [yearSummaryOpen, setYearSummaryOpen] = useState(false);
  const [pinnedYear, setPinnedYear] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState(() => buildInitialFilters(config));
  // Search highlight state
  const [searchHighlight, setSearchHighlight] = useState(null);

  const pinchRef = useRef({ active: false, startDist: 0, startPPY: 0 });

  const defaultConfig = useMemo(() => ({
    initialViewport: { startDate: '0001-01-01', endDate: '0200-12-31' },
    eraLabels: 'BC/AD',
    legend: [],
    ...config
  }), [config]);

  // Chain membership, keyed by person id.
  //
  // The desktop canvas draws config.chains as a connected line. This layout is
  // a vertical swimlane with one column per person, where diagonal connectors
  // across a scrolling container would read as clutter — so the succession is
  // shown as an ordinal on each member instead ("3/8"), which keeps both the
  // membership and its order without a second rendering path.
  const chainMembership = useMemo(() => {
    const map = new Map();
    for (const chain of defaultConfig.chains || []) {
      const members = chain.memberIds || [];
      members.forEach((id, i) => {
        map.set(id, {
          color: chain.color || '#c9a227',
          name: chain.name || 'Chain',
          position: i + 1,
          total: members.length,
        });
      });
    }
    return map;
  }, [defaultConfig.chains]);

  const dataBounds = useMemo(() => {
    const { people = [], points = [], periods = [] } = data;
    let minYear = Infinity, maxYear = -Infinity;
    for (const p of people) {
      const s = getYear(p.startDate), e = getYear(p.endDate);
      if (s != null && s < minYear) minYear = s;
      if (e != null && e > maxYear) maxYear = e;
    }
    for (const p of points) {
      const y = getYear(p.date);
      if (y != null) { if (y < minYear) minYear = y; if (y > maxYear) maxYear = y; }
    }
    for (const p of periods) {
      const s = getYear(p.startDate), e = getYear(p.endDate);
      if (s != null && s < minYear) minYear = s;
      if (e != null && e > maxYear) maxYear = e;
    }
    // The rulers' column (rulerStyle 'strip') counts too: in the tour,
    // Augustus's reign began before anyone else on screen was born, and
    // his reign was out of reach above the top (found 2026-10-08).
    if (config?.rulerStyle === 'strip') {
      for (const p of backData?.people || []) {
        const s = p.reignStartYear ?? getYear(p.startDate), e = p.reignEndYear ?? getYear(p.endDate);
        if (s != null && s < minYear) minYear = s;
        if (e != null && e > maxYear) maxYear = e;
      }
    }
    if (!isFinite(minYear)) { minYear = 0; maxYear = 200; }
    const span = maxYear - minYear;
    const pad = Math.max(span * 0.05, 10);
    // A page may set its own floor (Lifelines starts at 100 BC).
    const floor = config?.minYear ?? -Infinity;
    return { minYear: Math.max(Math.floor(minYear - pad), floor), maxYear: Math.ceil(maxYear + pad) };
  }, [data, backData, config?.minYear, config?.rulerStyle]);

  const filteredData = useMemo(() => applyFilters(data, filters), [data, filters]);
  const stringStyle = defaultConfig.pointStyle === 'string';
  // No landmarks on screen (early tour scenes, or all filtered out): no column.
  const labelColumn = stringStyle && filteredData.points.length ? STRING_LABEL_COLUMN : 0;
  const lanesLeft = GUTTER_WIDTH + labelColumn;
  const rulerPeople = useMemo(
    () => (defaultConfig.rulerStyle === 'strip' && backData ? applyFilters(backData, filters).people || [] : []),
    [defaultConfig.rulerStyle, backData, filters]
  );
  const rulerColumn = rulerPeople.length ? RULER_COLUMN : 0;

  const itemIndex = useMemo(() => {
    const map = new Map();
    data.people?.forEach(p => map.set(p.id, { type: 'person', item: p }));
    data.points?.forEach(p => map.set(p.id, { type: 'point', item: p }));
    data.periods?.forEach(p => map.set(p.id, { type: 'period', item: p }));
    return map;
  }, [data]);

  const yearToY = useCallback((year) => {
    return (year - dataBounds.minYear) * pixelsPerYear;
  }, [dataBounds.minYear, pixelsPerYear]);

  const totalHeight = useMemo(() => {
    return (dataBounds.maxYear - dataBounds.minYear) * pixelsPerYear;
  }, [dataBounds, pixelsPerYear]);

  const yearMarkers = useMemo(() => {
    const yearsPerPixel = 1 / pixelsPerYear;
    const interval = getYearLabelInterval(yearsPerPixel, 80);
    const markers = [];
    const firstYear = Math.ceil(dataBounds.minYear / interval) * interval;
    for (let year = firstYear; year <= dataBounds.maxYear; year += interval) {
      markers.push({ year, y: yearToY(year), label: formatYear(year, defaultConfig.eraLabels) });
    }
    return markers;
  }, [dataBounds, pixelsPerYear, yearToY, defaultConfig.eraLabels]);

  const { peopleLayout, numColumns } = useMemo(() => {
    const people = [...filteredData.people].sort((a, b) => getYear(a.startDate) - getYear(b.startDate));
    const columnEnds = [];
    const laid = people.map(person => {
      const { start, end } = getYearRange(person.startDate, person.endDate);
      let col = -1;
      for (let i = 0; i < columnEnds.length; i++) {
        if (start > columnEnds[i] + 2) { col = i; break; }
      }
      if (col === -1) { col = columnEnds.length; columnEnds.push(0); }
      columnEnds[col] = end;
      return { ...person, column: col };
    });
    return { peopleLayout: laid, numColumns: columnEnds.length };
  }, [filteredData.people]);

  const contentWidth = useMemo(() => {
    return Math.max(numColumns * (LANE_WIDTH + LANE_GAP) + LANE_GAP, 300);
  }, [numColumns]);

  useEffect(() => {
    const startYear = getYear(defaultConfig.initialViewport.startDate);
    if (scrollRef.current && startYear != null) {
      scrollRef.current.scrollTop = Math.max(0, yearToY(startYear) - 40);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Zooming keeps a year where it is on screen: the middle for the buttons,
  // the point between the fingers for a pinch. Without this the scroll offset
  // stayed put in pixels, so zooming in slid the view back towards the first
  // year (on Lifelines, empty years BC).
  const zoomAnchor = useRef(null);
  const anchorAt = useCallback((offset) => {
    const el = scrollRef.current;
    if (!el) return;
    const at = offset ?? el.clientHeight / 2;
    zoomAnchor.current = { year: dataBounds.minYear + (el.scrollTop + at) / pixelsPerYear, offset: at };
  }, [dataBounds.minYear, pixelsPerYear]);
  useLayoutEffect(() => {
    const anchor = zoomAnchor.current;
    const el = scrollRef.current;
    if (!anchor || !el) return;
    el.scrollTop = Math.max(0, (anchor.year - dataBounds.minYear) * pixelsPerYear - anchor.offset);
    if (!pinchRef.current.active) zoomAnchor.current = null;
  }, [pixelsPerYear, dataBounds.minYear]);

  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const rect = scrollRef.current?.getBoundingClientRect();
      if (rect) anchorAt((e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top);
      pinchRef.current = { active: true, startDist: Math.sqrt(dx * dx + dy * dy), startPPY: pixelsPerYear };
    }
  }, [pixelsPerYear, anchorAt]);

  const handleTouchMove = useCallback((e) => {
    if (pinchRef.current.active && e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const scale = dist / pinchRef.current.startDist;
      setPixelsPerYear(Math.min(MAX_PIXELS_PER_YEAR, Math.max(MIN_PIXELS_PER_YEAR, pinchRef.current.startPPY * scale)));
    }
  }, []);

  const handleTouchEnd = useCallback(() => { pinchRef.current.active = false; zoomAnchor.current = null; }, []);

  const handleItemClick = useCallback((type, item) => {
    setSelectedItem({ type, item });
    onItemClick?.(type, item);
  }, [onItemClick]);

  const handleModalClose = useCallback(() => setSelectedItem(null), []);

  const handleModalItemSelect = useCallback((type, item) => {
    setSelectedItem({ type, item });
    onItemClick?.(type, item);
  }, [onItemClick]);

  const getYearSummary = useCallback((year) => {
    const { people = [], points = [], periods = [] } = filteredData;
    return {
      year,
      activePeriods: periods.filter(p => { const s = getYear(p.startDate), e = getYear(p.endDate); return year >= s && year <= e; }),
      alivePeople: people.filter(p => { const s = getYear(p.startDate), e = getYear(p.endDate); return year >= s && year <= e; }),
      yearPoints: points.filter(p => getYear(p.date) === year),
      nearbyPoints: points
        .filter(p => { const py = getYear(p.date); return py >= year - 25 && py <= year + 25; })
        .map(p => ({ ...p, pointYear: getYear(p.date), yearDelta: getYear(p.date) - year }))
        .sort((a, b) => a.pointYear - b.pointYear)
    };
  }, [filteredData]);

  const handleYearMarkerClick = useCallback((year) => { setPinnedYear(year); setYearSummaryOpen(true); }, []);
  const handleYearSummaryClose = useCallback(() => setYearSummaryOpen(false), []);
  const handleFilterToggle = useCallback((key) => setFilters(prev => ({ ...prev, [key]: !prev[key] })), []);

  // --- Search handlers ---
  // Handle search autocomplete selection — scroll to item and open modal
  const handleSearchSelect = useCallback((type, item) => {
    setSearchHighlight(null);
    // Get the item's year
    const year = type === 'point' ? getYear(item.date) : getYear(item.startDate);
    if (year != null && scrollRef.current) {
      // Scroll to the year, centered vertically
      const targetY = yearToY(year);
      const viewportHeight = scrollRef.current.clientHeight;
      scrollRef.current.scrollTop = Math.max(0, targetY - viewportHeight / 2);
    }
    // Open the modal
    setSelectedItem({ type, item });
    onItemClick?.(type, item);
  }, [yearToY, onItemClick]);

  // Handle search find mode — highlight matches and scroll to current
  const handleSearchHighlight = useCallback((matches, currentIdx, query) => {
    setSearchHighlight({ matches, currentIdx, query });
    if (matches.length > 0 && currentIdx >= 0 && currentIdx < matches.length) {
      const match = matches[currentIdx];
      const year = match.type === 'point' ? getYear(match.item.date) : getYear(match.item.startDate);
      if (year != null && scrollRef.current) {
        const targetY = yearToY(year);
        const viewportHeight = scrollRef.current.clientHeight;
        scrollRef.current.scrollTop = Math.max(0, targetY - viewportHeight / 2);
      }
    }
  }, [yearToY]);

  // Clear search highlights
  const handleSearchClearHighlight = useCallback(() => {
    setSearchHighlight(null);
  }, []);

  // Expose search methods to parent via ref
  // Tour framing: bring a span of years into view. The tour's framing drove
  // only the horizontal timeline's viewport, so on a phone every scene stayed
  // wherever the reader last scrolled ("15 BC – 30 AD" for scene after
  // scene). The span is fitted to the visible height within the zoom limits;
  // if it still won't fit, the latest years stay in view, since that is where
  // a scene's new figures are. A request lapses after a second so a later
  // zoom by the reader isn't pulled back to it.
  const [frameRequest, setFrameRequest] = useState(null);
  const frameYears = useCallback((minYear, maxYear) => {
    const el = scrollRef.current;
    if (!el || !(maxYear > minYear)) return;
    const fit = (el.clientHeight * 0.9) / (maxYear - minYear);
    setPixelsPerYear(Math.min(MAX_PIXELS_PER_YEAR, Math.max(MIN_PIXELS_PER_YEAR, fit)));
    setFrameRequest({ minYear, maxYear, at: Date.now() });
  }, []);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !frameRequest || Date.now() - frameRequest.at > 1000) return;
    const { minYear, maxYear } = frameRequest;
    const height = el.clientHeight;
    const spanPx = (maxYear - minYear) * pixelsPerYear;
    const top = spanPx <= height
      ? yearToY(minYear) - (height - spanPx) / 2
      : yearToY(maxYear) - height + 24;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ top: Math.max(0, top), behavior: reduce ? 'auto' : 'smooth' });
  }, [frameRequest, yearToY, pixelsPerYear]);

  useImperativeHandle(ref, () => ({
    selectItem: handleSearchSelect,
    highlight: handleSearchHighlight,
    clearHighlight: handleSearchClearHighlight,
    frameYears,
  }), [handleSearchSelect, handleSearchHighlight, handleSearchClearHighlight, frameYears]);

  // Compute highlighted item IDs
  const highlightedItemIds = useMemo(() => {
    if (!searchHighlight || searchHighlight.matches.length === 0) return new Set();
    return new Set(searchHighlight.matches.map(m => m.id));
  }, [searchHighlight]);

  const currentHighlightId = useMemo(() => {
    if (!searchHighlight || searchHighlight.matches.length === 0) return null;
    return searchHighlight.matches[searchHighlight.currentIdx]?.id ?? null;
  }, [searchHighlight]);

  const handleBackgroundClick = useCallback((e) => {
    // Don't handle clicks on interactive elements (buttons, links) — those have their own handlers
    if (e.target.closest('button, a')) return;
    // The scroll container is the parent; use its viewport rect + scrollTop
    // to convert the click's clientY into a position within the content.
    const scrollEl = e.currentTarget.parentElement;
    const scrollRect = scrollEl.getBoundingClientRect();
    const y = e.clientY - scrollRect.top + scrollEl.scrollTop;
    const year = Math.round(dataBounds.minYear + y / pixelsPerYear);
    setPinnedYear(year);
    setYearSummaryOpen(true);
  }, [dataBounds.minYear, pixelsPerYear]);

  const handleZoomIn = useCallback(() => { anchorAt(); setPixelsPerYear(p => Math.min(MAX_PIXELS_PER_YEAR, p * 1.5)); }, [anchorAt]);
  const handleZoomOut = useCallback(() => { anchorAt(); setPixelsPerYear(p => Math.max(MIN_PIXELS_PER_YEAR, p / 1.5)); }, [anchorAt]);
  const handleZoomReset = useCallback(() => { anchorAt(); setPixelsPerYear(DEFAULT_PIXELS_PER_YEAR); }, [anchorAt]);

  const showYearReadout = defaultConfig.zoomReadout === 'years';
  const updateVisibleYears = useCallback(() => {
    if (!showYearReadout || readoutFrame.current) return;
    readoutFrame.current = requestAnimationFrame(() => {
      readoutFrame.current = 0;
      const el = scrollRef.current;
      if (!el) return;
      const top = dataBounds.minYear + el.scrollTop / pixelsPerYear;
      setVisibleYears({ start: top, end: top + el.clientHeight / pixelsPerYear });
    });
  }, [showYearReadout, dataBounds.minYear, pixelsPerYear]);
  useEffect(() => {
    updateVisibleYears();
    return () => {
      // Clear the marker as well as the frame, or the next call would think a
      // frame was still pending and the readout would never update again.
      cancelAnimationFrame(readoutFrame.current);
      readoutFrame.current = 0;
    };
  }, [updateVisibleYears]);

  const formatEraYear = useCallback(
    (year) => formatYear(year, defaultConfig.eraLabels),
    [defaultConfig.eraLabels]
  );

  const getPersonColor = useCallback((person) => {
    if (person.color) return person.color;
    if (person.periodId && defaultConfig.legend) {
      const leg = defaultConfig.legend.find(l => l.id === person.periodId);
      if (leg?.color) return leg.color;
    }
    return '#5b7ee8';
  }, [defaultConfig.legend]);

  // The rulers' column sits outside the scroller (so it stays pinned right
  // while the lanes scroll sideways) and follows its vertical scroll.
  const rulerInnerRef = useRef(null);
  const [scrollBox, setScrollBox] = useState({ top: 0, scrollbar: 0, height: 0 });
  const syncRulers = useCallback(() => {
    const el = scrollRef.current;
    if (el && rulerInnerRef.current) rulerInnerRef.current.style.transform = `translateY(${-el.scrollTop}px)`;
  }, []);
  const handleScroll = useCallback(() => { updateVisibleYears(); syncRulers(); }, [updateVisibleYears, syncRulers]);
  // Where the scroller sits, so the column lines up with it: re-measured
  // when the filter drawer opens or the window resizes.
  const measureScrollBox = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const next = { top: el.offsetTop, scrollbar: el.offsetWidth - el.clientWidth, height: el.clientHeight };
    setScrollBox(prev => (prev.top === next.top && prev.scrollbar === next.scrollbar && prev.height === next.height ? prev : next));
  }, []);
  useLayoutEffect(() => {
    measureScrollBox();
    syncRulers();
  }, [measureScrollBox, syncRulers, filtersOpen, pixelsPerYear, rulerColumn]);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measureScrollBox);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measureScrollBox]);
  const packedRulers = useMemo(
    () => (rulerPeople.length ? packRulerRows(rulerPeople, 1 / pixelsPerYear, RULER_SUBCOLUMNS) : []),
    [rulerPeople, pixelsPerYear]
  );

  // Harp strings: where each landmark's line, label and mark go.
  const stringLayout = useMemo(() => {
    if (!stringStyle) return [];
    const points = filteredData.points
      .map(point => ({ ...point, year: getYear(point.date) }))
      .filter(point => point.year != null);
    const byId = new Map(points.map(point => [point.id, point]));
    return placeVerticalLabels(points, yearToY).map(entry => ({ ...entry, point: byId.get(entry.id) }));
  }, [stringStyle, filteredData.points, yearToY]);

  function renderStrings() {
    return stringLayout.map(({ point, y, labelTop, showLabel, markSlot }) => {
      const mark = markForPoint(point);
      const color = point.color || '#888';
      const name = `${point.name}, ${formatEraYear(point.year)}`;
      // A dot on each linked figure alive that year, as on the horizontal
      // timeline: "this person was involved".
      const linked = (point.connectedPeople || []).length
        ? peopleLayout.filter(person => {
          if (!point.connectedPeople.includes(person.id)) return false;
          const { start, end } = getYearRange(person.startDate, person.endDate);
          return point.year >= start && point.year <= end;
        })
        : [];
      // The mark sits at the column's inner edge, on the string; a second
      // landmark in the same few pixels steps sideways along it.
      const markX = lanesLeft - 14 + markSlot * 12;
      return (
        <div key={point.id} className="mobile-string" data-point-id={point.id} style={{ '--string-color': color }}>
          <span
            className="mobile-string-line"
            style={{ top: `${y}px`, left: `${lanesLeft - 10}px`, width: `${contentWidth + 10}px` }}
          />
          {showLabel && (
            <button
              type="button"
              className="mobile-string-label"
              style={{ top: `${labelTop}px`, left: `${GUTTER_WIDTH + 4}px`, width: `${labelColumn - 22}px` }}
              aria-label={name}
              onClick={() => handleItemClick('point', point)}
            >
              <span className="mobile-string-name">{point.name}</span>
            </button>
          )}
          <button
            type="button"
            className="mobile-string-mark"
            style={{ top: `${y}px`, left: `${markX - 6}px` }}
            aria-label={name}
            tabIndex={showLabel ? -1 : 0}
            onClick={() => handleItemClick('point', point)}
          >
            <StringMark mark={mark} color={color} />
          </button>
          {linked.map(person => (
            <button
              key={person.id}
              type="button"
              className="mobile-string-dot"
              style={{ top: `${y}px`, left: `${lanesLeft + person.column * (LANE_WIDTH + LANE_GAP) + LANE_GAP + LANE_WIDTH - 14}px` }}
              aria-label={name}
              onClick={() => handleItemClick('point', point)}
            >
              <StringMark mark={mark} color={color} />
            </button>
          ))}
        </div>
      );
    });
  }

  // Where the open figure's lane is on screen, for the detail to grow out of
  // (config.detailGrowFromBar, TimelineModal growFrom); null when it's off
  // screen or the item isn't a figure.
  const growFromLane = () => {
    if (selectedItem?.type !== 'person') return null;
    const lane = document.querySelector(`.mobile-person-lane[data-person-id="${CSS.escape(String(selectedItem.item.id))}"]`);
    const r = lane?.getBoundingClientRect();
    if (!r || r.bottom < 0 || r.top > window.innerHeight || r.width === 0) return null;
    return { left: r.left, top: r.top, width: r.width, height: r.height, color: selectedItem.item.color || '#5b7ee8' };
  };

  return (
    <div className="mobile-timeline">
      {/* Toolbar */}
      <div className="mobile-timeline-toolbar">
        <button className="mobile-toolbar-btn" onClick={() => setFiltersOpen(p => !p)}>
          <Icon name="diamond" size={14} />
          <span>Filter</span>
        </button>
        <div className="mobile-zoom-controls">
          <button className="mobile-toolbar-btn" onClick={handleZoomOut}><Icon name="minus" size={14} /></button>
          <span className="mobile-zoom-label">
            {showYearReadout
              ? (visibleYears ? formatYearSpan(Math.round(visibleYears.start / 5) * 5, Math.round(visibleYears.end / 5) * 5, defaultConfig.eraLabels) : '')
              : `${pixelsPerYear.toFixed(1)}px/yr`}
          </span>
          <button className="mobile-toolbar-btn" onClick={handleZoomIn}><Icon name="plus" size={14} /></button>
          <button className="mobile-toolbar-btn" onClick={handleZoomReset}><Icon name="quatrefoil" size={14} /></button>
        </div>
        {layoutToggle}
      </div>

      {/* Filter drawer */}
      {filtersOpen && (
        <div className="mobile-filter-drawer">
          {defaultConfig.legend.map(item => {
            const isActive = item.filterKey ? filters[item.filterKey] !== false : true;
            return (
              <label key={item.id} className={`mobile-filter-item ${!isActive ? 'inactive' : ''}`}>
                {item.filterKey && (
                  <input type="checkbox" checked={isActive} onChange={() => handleFilterToggle(item.filterKey)} />
                )}
                {(item.type === 'people' || item.type === 'bracket') && (
                  <span className="mobile-filter-swatch" style={{ backgroundColor: item.color }} />
                )}
                {item.type === 'point' && (item.mark
                  ? <StringMark mark={item.mark} color={item.color} />
                  : <ShapeIcon shape={item.shape} color={item.color} size={14} />)}
                {item.isMonarch && <Icon name="crown" size={12} color={item.color} />}
                <span>{item.name}</span>
              </label>
            );
          })}
        </div>
      )}

      {/* Main scroll area */}
      <div
        ref={scrollRef}
        className="mobile-timeline-scroll"
        onScroll={handleScroll}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="mobile-timeline-content"
          style={{ height: `${totalHeight + 80}px`, width: `${contentWidth + lanesLeft + rulerColumn}px` }}
          onClick={handleBackgroundClick}
        >
          {/* Horizontal gridlines (behind everything) */}
          {yearMarkers.map(m => (
            <div
              key={`grid-${m.year}`}
              className="mobile-gridline"
              style={{ top: `${m.y}px`, width: `${contentWidth + lanesLeft}px` }}
            />
          ))}

          {/* ── Lanes area (people + periods, scrolls with content) ── */}
          <div className="mobile-lanes-area" style={{ left: `${lanesLeft}px`, width: `${contentWidth}px` }}>
            {/* Person lane columns */}
            {peopleLayout.map(person => {
              const { start, end } = getYearRange(person.startDate, person.endDate);
              const topY = yearToY(start);
              const height = yearToY(end) - topY;
              const color = getPersonColor(person);
              const x = person.column * (LANE_WIDTH + LANE_GAP) + LANE_GAP;
              const isHighlighted = highlightedItemIds.has(person.id);
              const isCurrent = person.id === currentHighlightId;

              return (
                <button
                  key={person.id}
                  className={`mobile-person-lane${isHighlighted ? ' highlighted' : ''}${isCurrent ? ' current-highlight' : ''}${person.emphasis ? ' emphasised' : ''}`}
                  data-person-id={person.id}
                  style={{
                    top: `${topY}px`,
                    height: `${Math.max(height, 28)}px`,
                    left: `${x}px`,
                    width: `${LANE_WIDTH}px`,
                    '--person-color': color,
                    '--emphasis-color': person.emphasisColor || color
                  }}
                  onClick={() => handleItemClick('person', person)}
                >
                  <span className="mobile-person-header">
                    {person.isMonarch && <Icon name="crown" size={10} color="#ffd700" />}
                    <span className="mobile-person-name">{person.name}</span>
                    {chainMembership.has(person.id) && (() => {
                      const link = chainMembership.get(person.id);
                      return (
                        <span
                          className="mobile-chain-badge"
                          style={{ '--chain-color': link.color }}
                          title={`${link.name}: ${link.position} of ${link.total}`}
                          aria-label={`${link.name}, ${link.position} of ${link.total}`}
                        >
                          {link.position}/{link.total}
                        </span>
                      );
                    })()}
                  </span>
                  <span className="mobile-person-dates">
                    {formatEraYear(start)} – {formatEraYear(end)}
                  </span>
                </button>
              );
            })}
          </div>

          {stringStyle && renderStrings()}

          {/* ── Point markers (positioned at gutter edge, sticky label) ── */}
          {!stringStyle && filteredData.points.map(point => {
            const year = getYear(point.date);
            const topY = yearToY(year);
            return (
              <button
                key={point.id}
                className="mobile-point-marker"
                style={{ top: `${topY}px`, left: `${GUTTER_WIDTH + 2}px` }}
                onClick={() => handleItemClick('point', point)}
              >
                <span className="mobile-point-content">
                  <span className="mobile-point-icon">
                    <ShapeIcon shape={point.shape || 'circle'} color={point.color || '#ff6f00'} size={14} />
                  </span>
                  <span className="mobile-point-text">
                    <span className="mobile-point-name">{point.name}</span>
                    <span className="mobile-point-year">{formatEraYear(year)}</span>
                  </span>
                </span>
              </button>
            );
          })}

          {/* ── Year gutter overlay (dark bg, sticky left, in front of lanes) ── */}
          <div className="mobile-year-gutter">
            <div className="mobile-axis-line" />
            {yearMarkers.map(m => (
              <button
                key={m.year}
                className="mobile-year-marker"
                style={{ top: `${m.y}px` }}
                onClick={() => handleYearMarkerClick(m.year)}
              >
                <span className="mobile-year-label">{m.label}</span>
                <span className="mobile-year-tick" />
              </button>
            ))}
          </div>

          {/* ── Period banners (in front of year gutter, sticky in both axes) ── */}
          {/* Container is pointer-events:none so taps pass through to background;
              only the label itself is clickable. */}
          {filteredData.periods.map(period => {
            const { start, end } = getYearRange(period.startDate, period.endDate);
            const topY = yearToY(start);
            const height = yearToY(end) - topY;
            const color = period.color || '#00838f';
            const lightColor = lightenColor(color);
            return (
              <div
                key={period.id}
                className="mobile-period-banner"
                style={{
                  top: `${topY}px`,
                  height: `${Math.max(height, 4)}px`
                }}
              >
                <button
                  className="mobile-period-banner-label"
                  style={{ borderLeftColor: lightColor, color: lightColor }}
                  onClick={() => handleItemClick('period', period)}
                >
                  {period.name}
                  <span className="mobile-period-banner-dates">
                    {formatEraYear(start)} – {formatEraYear(end)}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {rulerColumn > 0 && (
        <div
          className="mobile-ruler-column"
          style={{ width: `${RULER_COLUMN}px`, top: `${scrollBox.top}px`, height: `${scrollBox.height}px`, right: `${scrollBox.scrollbar}px`, '--ruler-color': defaultConfig.rulerColor }}
          aria-label="Emperors and monarchs"
        >
          <div ref={rulerInnerRef} className="mobile-ruler-column-inner" style={{ height: `${totalHeight + 80}px` }}>
            {packedRulers.map(({ person, row, start, end, room }) => {
              const top = yearToY(start);
              const height = Math.max(yearToY(end) - top, 3);
              // The name runs down beside the bar, until the next reign in
              // its sub-column; under 28px of room it is left off.
              const roomPx = room * pixelsPerYear - 4;
              return (
                <button
                  key={person.id}
                  type="button"
                  // A ruler the tour just brought in grows and glows for a
                  // moment, as in the horizontal strip (RulerStrip.css).
                  className={`mobile-ruler${newRulerIds?.has(person.id) ? ' is-new' : ''}`}
                  style={{
                    top: `${top}px`, left: `${4 + row * RULER_SUBCOLUMN}px`, width: `${RULER_SUBCOLUMN}px`,
                    // rulerColorByRealm (Lifelines): each reign in its realm's colour.
                    ...(defaultConfig.rulerColorByRealm === true && person.color && { '--ruler-color': person.color }),
                  }}
                  aria-label={`${person.name}, ${formatEraYear(start)} – ${formatEraYear(end)}`}
                  onClick={() => handleItemClick('person', person)}
                >
                  <span className="mobile-ruler-bar" style={{ height: `${height}px` }} />
                  {roomPx >= 28 && (
                    <span className="mobile-ruler-name" style={Number.isFinite(roomPx) ? { maxHeight: `${roomPx}px` } : undefined}>
                      {person.name}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Modals */}
      <TimelineModal
        isOpen={selectedItem !== null}
        growFrom={defaultConfig.detailGrowFromBar ? growFromLane : null}
        item={selectedItem?.item}
        itemType={selectedItem?.type}
        config={defaultConfig}
        brief={detailBrief}
        onClose={handleModalClose}
        itemIndex={itemIndex}
        onSelectItem={handleModalItemSelect}
        authContext={authContext}
        allPeople={allPeople}
        adminContext={adminContext}
        contributorContext={contributorContext}
        onEntityUpdated={onEntityUpdated}
        onItemDeleted={() => setSelectedItem(null)}
        onDataChanged={onDataChanged}
      />
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
    </div>
  );
});
