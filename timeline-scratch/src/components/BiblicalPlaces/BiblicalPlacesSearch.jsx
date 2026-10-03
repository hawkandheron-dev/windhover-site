import { useState, useRef, useEffect, useMemo } from 'react';
import './BiblicalPlacesSearch.css';

const LOGO_PATH = new URL('../../../../../resources/logos/Windhover_BLK.png', import.meta.url).href;

/**
 * Search bar for places, people, and events.
 */
export function BiblicalPlacesSearch({ data, onSelect, homeHref = '/home.html' }) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  // Build flat searchable index
  const searchIndex = useMemo(() => {
    if (!data) return [];
    const items = [];
    data.places.forEach(p => items.push({
      id: p.place_id, name: p.name, type: 'place',
      subtitle: p.region || 'Place',
    }));
    data.people.forEach(p => {
      const ages = data.personAgesMap.get(p.person_id) || [];
      const primaryAge = ages.find(a => a.is_primary) || ages[0];
      items.push({
        id: p.person_id, name: p.name, type: 'person',
        subtitle: primaryAge ? primaryAge.name : 'Person',
      });
    });
    data.events.forEach(e => {
      const age = data.ageMap.get(e.narrative_age_id);
      items.push({
        id: e.event_id, name: e.name, type: 'event',
        subtitle: age ? age.name : 'Event',
      });
    });
    return items;
  }, [data]);

  // Filter results
  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return searchIndex.filter(item =>
      item.name.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [query, searchIndex]);

  // Group results by type
  const grouped = useMemo(() => {
    const groups = { place: [], person: [], event: [] };
    results.forEach(r => {
      if (groups[r.type]) groups[r.type].push(r);
    });
    return groups;
  }, [results]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const handleSelect = (type, id) => {
    setQuery('');
    setIsOpen(false);
    onSelect(type, id);
  };

  const hasResults = results.length > 0;

  return (
    <div className="bp-search" ref={containerRef}>
      <div className="bp-search-input-wrap">
        <a href={homeHref} className="bp-search-home-link" title="Back to Windhover">
          <img src={LOGO_PATH} alt="Windhover" className="bp-search-bird-logo" />
        </a>
        <input
          ref={inputRef}
          type="text"
          className="bp-search-input"
          placeholder="Search atlas..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
        />
        <svg className="bp-search-icon" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" fill="none" />
          <path d="M20 20L16.6 16.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
      {isOpen && query.trim() && (
        <div className="bp-search-dropdown">
          {!hasResults && (
            <div className="bp-search-empty">No results for &ldquo;{query}&rdquo;</div>
          )}
          {grouped.place.length > 0 && (
            <div className="bp-search-group">
              <div className="bp-search-group-label">Places</div>
              {grouped.place.map(r => (
                <button key={r.id} className="bp-search-result" onClick={() => handleSelect('place', r.id)}>
                  <span className="bp-search-name">{r.name}</span>
                  <span className="bp-search-subtitle">{r.subtitle}</span>
                </button>
              ))}
            </div>
          )}
          {grouped.person.length > 0 && (
            <div className="bp-search-group">
              <div className="bp-search-group-label">People</div>
              {grouped.person.map(r => (
                <button key={r.id} className="bp-search-result" onClick={() => handleSelect('person', r.id)}>
                  <span className="bp-search-name">{r.name}</span>
                  <span className="bp-search-subtitle">{r.subtitle}</span>
                </button>
              ))}
            </div>
          )}
          {grouped.event.length > 0 && (
            <div className="bp-search-group">
              <div className="bp-search-group-label">Events</div>
              {grouped.event.map(r => (
                <button key={r.id} className="bp-search-result" onClick={() => handleSelect('event', r.id)}>
                  <span className="bp-search-name">{r.name}</span>
                  <span className="bp-search-subtitle">{r.subtitle}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
