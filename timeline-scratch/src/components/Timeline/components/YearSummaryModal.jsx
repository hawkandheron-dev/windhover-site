/**
 * Modal component for displaying year summary (people alive, periods active, points)
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import { Icon } from './Icon.jsx';
import { YearDetailMap } from './YearDetailMap.jsx';
import './TimelineModal.css';
import { formatYear as formatEraYear } from '../utils/dateUtils.js';

export function YearSummaryModal({ year, summary, config, onClose, itemIndex, onSelectItem }) {
  // Handle escape key
  useEffect(() => {
    function handleEscape(e) {
      if (e.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const { activePeriods, alivePeople, yearPoints, nearbyPoints = [] } = summary;

  // Format year for display
  const formatYear = (yr) => formatEraYear(yr);

  const [hoveredPersonId, setHoveredPersonId] = useState(null);
  const hoverSourceRef = useRef(null); // 'map' | 'pill' | null
  const pillRefs = useRef(new Map()); // personId -> DOM element

  // When a pin is hovered on the map, scroll the matching pill into view
  const handleHoverPerson = useCallback((personId, source) => {
    hoverSourceRef.current = source || null;
    setHoveredPersonId(personId);
  }, []);

  useEffect(() => {
    if (hoveredPersonId && hoverSourceRef.current === 'map') {
      const el = pillRefs.current.get(hoveredPersonId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [hoveredPersonId]);

  // Separate emperors from other people
  const emperors = alivePeople.filter(p => p.isMonarch);
  const otherPeople = alivePeople.filter(p => !p.isMonarch);

  const handleReferenceClick = useCallback((event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const button = target.closest('[data-item-id]');
    if (!button || !itemIndex) return;
    const id = button.getAttribute('data-item-id');
    if (!id) return;
    const entry = itemIndex.get(id);
    if (!entry) return;
    onSelectItem?.(entry.type, entry.item);
    onClose();
  }, [itemIndex, onSelectItem, onClose]);

  return (
    <div className="timeline-modal" onClick={onClose}>
      <div className="modal-backdrop" />
      <div className="modal-content year-summary-modal" onClick={e => e.stopPropagation()}>
        <button
          className="modal-close"
          onClick={onClose}
          aria-label="Close modal"
        >
          &times;
        </button>

        <h2 className="modal-title">
          {formatYear(year)}
        </h2>

        {/* Historical Map with pins for all people */}
        {otherPeople.length > 0 && (
          <YearDetailMap
            people={otherPeople}
            year={year}
            hoveredPersonId={hoveredPersonId}
            onHoverPerson={handleHoverPerson}
          />
        )}

        {/* Active Periods */}
        {activePeriods.length > 0 && (
          <div className="summary-section">
            <h3 className="summary-section-title">Active Periods</h3>
            <ul className="summary-list">
              {activePeriods.map(period => (
                <li key={period.id} className="summary-item">
                  <span
                    className="summary-color-dot"
                    style={{ backgroundColor: period.color }}
                  />
                  {period.name}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Emperors */}
        {emperors.length > 0 && (
          <div className="summary-section">
            <h3 className="summary-section-title">
              <Icon name="crown" size={16} color="#ffd700" />
              <span style={{ marginLeft: '6px' }}>Reigning Emperor(s)</span>
            </h3>
            <ul className="summary-list">
              {emperors.map(person => (
                <li key={person.id} className="summary-item">
                  <Icon name="crown" size={12} color="#ffd700" />
                  <span style={{ marginLeft: '6px' }}><strong>{person.name}</strong>{person.location && <span>{'\u00A0'}in <em>{person.location}</em></span>}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* People Alive */}
        {otherPeople.length > 0 && (
          <div className="summary-section">
            <h3 className="summary-section-title">Who's where? ({otherPeople.length})</h3>
            <ul className="summary-list summary-list-compact">
              {otherPeople.map(person => {
                const isHighlighted = hoveredPersonId === person.id;
                const isDimmed = hoveredPersonId && hoveredPersonId !== person.id;
                return (
                  <li
                    key={person.id}
                    ref={el => {
                      if (el) pillRefs.current.set(person.id, el);
                      else pillRefs.current.delete(person.id);
                    }}
                    className={
                      'summary-item' +
                      (isHighlighted ? ' summary-pill-highlighted' : '') +
                      (isDimmed ? ' summary-pill-dimmed' : '')
                    }
                    onMouseEnter={() => handleHoverPerson(person.id, 'pill')}
                    onMouseLeave={() => handleHoverPerson(null)}
                  >
                    <button
                      type="button"
                      className="summary-pill"
                      data-item-id={person.id}
                      data-item-type="person"
                      onClick={handleReferenceClick}
                    >
                      <span
                        className="summary-color-dot"
                        style={{ backgroundColor: person.color }}
                      />
                      <strong>{person.name}</strong>{person.location && <span>{'\u00A0'}in <em>{person.location}</em></span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Points/Events */}
        {yearPoints.length > 0 && (
          <div className="summary-section">
            <h3 className="summary-section-title">Events This Year</h3>
            <ul className="summary-list">
              {yearPoints.map(point => (
                <li key={point.id} className="summary-item">
                  <span
                    className="summary-color-dot"
                    style={{ backgroundColor: point.color }}
                  />
                  {point.name}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Nearby events and texts (±25 years) */}
        {nearbyPoints.length > 0 && (
          <div className="summary-section">
            <h3 className="summary-section-title">Notable events and texts around {formatYear(year)}</h3>
            <ul className="summary-list summary-nearby-list">
              {nearbyPoints.map(point => {
                const delta = point.yearDelta;
                let relativeLabel;
                if (delta === 0) {
                  relativeLabel = 'This year';
                } else if (delta < 0) {
                  relativeLabel = `${Math.abs(delta)} year${Math.abs(delta) !== 1 ? 's' : ''} before`;
                } else {
                  relativeLabel = `${delta} year${delta !== 1 ? 's' : ''} after`;
                }
                const displayYear = formatEraYear(point.pointYear, 'BC/AD', { showAD: false });
                return (
                  <li key={point.id} className="summary-item summary-nearby-item">
                    <span className="summary-nearby-label">{relativeLabel}</span>
                    <span className="summary-nearby-event">
                      <span
                        className="summary-color-dot"
                        style={{ backgroundColor: point.color }}
                      />
                      <button
                        type="button"
                        className="summary-nearby-link"
                        data-item-id={point.id}
                        data-item-type="point"
                        onClick={handleReferenceClick}
                      >
                        {point.name} ({displayYear})
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Empty state */}
        {activePeriods.length === 0 && alivePeople.length === 0 && yearPoints.length === 0 && nearbyPoints.length === 0 && (
          <p className="summary-empty">No data for this year.</p>
        )}
      </div>
    </div>
  );
}
