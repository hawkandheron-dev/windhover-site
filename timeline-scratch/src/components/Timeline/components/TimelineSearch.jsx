/**
 * TimelineSearch — autocomplete search + free-text find for the timeline.
 *
 * Two modes:
 *  1. Autocomplete — pick a specific entry → scroll to it & open its modal.
 *  2. Free-text   — press Enter without selecting → Ctrl-F style highlighting
 *     with a match count badge and prev/next navigation.
 */

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { getYear } from '../utils/dateUtils.js';
import { Icon, ShapeIcon } from './Icon.jsx';
import './TimelineSearch.css';
import { matchRank } from '../utils/searchRank.js';

/**
 * Build a flat search index from timeline data.
 * Each entry: { id, name, type ('person'|'point'|'period'), year, item }
 */
function buildIndex(data) {
  const entries = [];
  for (const person of data.people || []) {
    entries.push({
      id: person.id,
      name: person.name,
      type: 'person',
      year: getYear(person.startDate),
      item: person,
    });
  }
  for (const point of data.points || []) {
    entries.push({
      id: point.id,
      name: point.name,
      type: 'point',
      year: getYear(point.date),
      item: point,
    });
  }
  for (const period of data.periods || []) {
    entries.push({
      id: period.id,
      name: period.name,
      type: 'period',
      year: getYear(period.startDate),
      item: period,
    });
  }
  // Sort alphabetically for the autocomplete list
  entries.sort((a, b) => a.name.localeCompare(b.name));
  return entries;
}

const TYPE_LABELS = { person: 'Person', point: 'Event', period: 'Period' };

/**
 * `describeKind(entry)` lets a page name its results in its own terms, e.g.
 * { label: 'Council', shape: 'cross', color }. Without it the generic
 * coloured chips (PERSON / EVENT) remain.
 */
export function TimelineSearch({ data, onSelectItem, onHighlight, onClearHighlight, homeLink, ranked = false, describeKind }) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  // Free-text find state
  const [findResults, setFindResults] = useState(null); // { matches[], currentIdx }
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const index = useMemo(() => buildIndex(data), [data]);

  // Filtered autocomplete results
  const filtered = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const matches = index.filter(e => e.name.toLowerCase().includes(q));
    if (ranked) matches.sort((a, b) => matchRank(a, q) - matchRank(b, q) || a.name.localeCompare(b.name));
    return matches.slice(0, 12);
  }, [query, index, ranked]);

  // Keep activeIdx in bounds when results change
  useEffect(() => {
    setActiveIdx(-1);
  }, [filtered]);

  // Scroll active item into view inside the dropdown
  useEffect(() => {
    if (activeIdx >= 0 && listRef.current) {
      const el = listRef.current.children[activeIdx];
      if (el) el.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIdx]);

  // Select an autocomplete entry
  const selectEntry = useCallback((entry) => {
    setQuery('');
    setIsOpen(false);
    setFindResults(null);
    onClearHighlight?.();
    onSelectItem?.(entry.type, entry.item);
  }, [onSelectItem, onClearHighlight]);

  // Free-text find: highlight all matches for the current query
  const performFind = useCallback((q) => {
    if (!q.trim()) {
      setFindResults(null);
      onClearHighlight?.();
      return;
    }
    const lower = q.toLowerCase();
    const matches = index.filter(e => e.name.toLowerCase().includes(lower));
    if (matches.length === 0) {
      setFindResults({ matches: [], currentIdx: -1, query: q });
      onHighlight?.([], -1, q);
    } else {
      setFindResults({ matches, currentIdx: 0, query: q });
      onHighlight?.(matches, 0, q);
    }
    setIsOpen(false);
  }, [index, onHighlight, onClearHighlight]);

  // Navigate between find results
  const navigateFind = useCallback((delta) => {
    if (!findResults || findResults.matches.length === 0) return;
    const nextIdx = (findResults.currentIdx + delta + findResults.matches.length) % findResults.matches.length;
    setFindResults(prev => ({ ...prev, currentIdx: nextIdx }));
    onHighlight?.(findResults.matches, nextIdx, findResults.query);
  }, [findResults, onHighlight]);

  const clearFind = useCallback(() => {
    setQuery('');
    setFindResults(null);
    onClearHighlight?.();
    inputRef.current?.focus();
  }, [onClearHighlight]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      if (findResults) {
        clearFind();
      } else {
        setIsOpen(false);
        setQuery('');
        inputRef.current?.blur();
      }
      return;
    }

    // Autocomplete navigation
    if (isOpen && filtered.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx(prev => Math.min(prev + 1, filtered.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx(prev => Math.max(prev - 1, -1));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (activeIdx >= 0 && filtered[activeIdx]) {
          selectEntry(filtered[activeIdx]);
        } else {
          // No selection — switch to free-text find mode
          performFind(query);
        }
        return;
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (findResults) {
        // Already in find mode — navigate to next
        navigateFind(1);
      } else {
        performFind(query);
      }
    }
  }, [isOpen, filtered, activeIdx, query, findResults, selectEntry, performFind, navigateFind, clearFind]);

  const handleChange = useCallback((e) => {
    const val = e.target.value;
    setQuery(val);
    setIsOpen(val.trim().length > 0);
    // If we were in find mode and the user edits, clear highlights
    if (findResults) {
      setFindResults(null);
      onClearHighlight?.();
    }
  }, [findResults, onClearHighlight]);

  const handleFocus = useCallback(() => {
    if (query.trim()) setIsOpen(true);
  }, [query]);

  const handleBlur = useCallback((e) => {
    // Delay close so click on dropdown item registers first
    setTimeout(() => setIsOpen(false), 180);
  }, []);

  const isFindMode = findResults !== null;

  return (
    <div className="timeline-search">
      <div className={`timeline-search-input-wrap ${isFindMode ? 'find-mode' : ''}`}>
        {homeLink}
        <input
          ref={inputRef}
          type="text"
          className="timeline-search-input"
          placeholder="Search timeline…"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          autoComplete="off"
          spellCheck={false}
        />
        <Icon name="search" size={14} />
        {isFindMode && (
          <div className="timeline-search-find-nav">
            <span className="timeline-search-find-count">
              {findResults.matches.length === 0
                ? 'No matches'
                : `${findResults.currentIdx + 1} / ${findResults.matches.length}`}
            </span>
            <button
              className="timeline-search-find-btn"
              onClick={() => navigateFind(-1)}
              disabled={findResults.matches.length === 0}
              title="Previous match"
            >
              &#8249;
            </button>
            <button
              className="timeline-search-find-btn"
              onClick={() => navigateFind(1)}
              disabled={findResults.matches.length === 0}
              title="Next match"
            >
              &#8250;
            </button>
            <button
              className="timeline-search-find-btn close"
              onClick={clearFind}
              title="Clear search"
            >
              &#215;
            </button>
          </div>
        )}
        {!isFindMode && query && (
          <button className="timeline-search-clear" onClick={clearFind} title="Clear">
            &#215;
          </button>
        )}
      </div>

      {/* Autocomplete dropdown */}
      {isOpen && filtered.length > 0 && !isFindMode && (
        <ul ref={listRef} className="timeline-search-dropdown" role="listbox">
          {filtered.map((entry, i) => (
            <li
              key={entry.id}
              role="option"
              aria-selected={i === activeIdx}
              className={`timeline-search-option ${i === activeIdx ? 'active' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); selectEntry(entry); }}
            >
              <span className="timeline-search-option-name">
                {highlightMatch(entry.name, query)}
              </span>
              {describeKind ? (() => {
                const kind = describeKind(entry);
                return (
                  <span className="timeline-search-option-kind">
                    {kind.icon === 'crown'
                      ? <Icon name="crown" size={12} color={kind.color} />
                      : kind.shape && <ShapeIcon shape={kind.shape} color={kind.color} size={12} />}
                    {kind.label}
                  </span>
                );
              })() : (
                <span className={`timeline-search-option-type type-${entry.type}`}>
                  {TYPE_LABELS[entry.type] || entry.type}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Highlight matched substring in bold */
function highlightMatch(text, query) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <strong>{text.slice(idx, idx + query.length)}</strong>
      {text.slice(idx + query.length)}
    </>
  );
}
