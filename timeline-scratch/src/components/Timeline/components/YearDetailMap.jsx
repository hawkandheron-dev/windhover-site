import { useEffect, useMemo, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { filterByDate } from '@openhistoricalmap/maplibre-gl-dates';
import MaplibreLanguage from '@openhistoricalmap/maplibre-gl-language';
import { getCoordinatesForLocation } from '../../../data/locationCoordinates.js';
import { formatYear } from '../utils/dateUtils.js';
import { canUseWebGL } from '../utils/webgl.js';

const OHM_STYLE_URL = 'https://www.openhistoricalmap.org/map-styles/main/main.json';

/**
 * Renders an Open Historical Map with pins for all people alive in a given year,
 * supporting bidirectional hover highlighting with external pill list.
 */
/** Bounds that fit every pin; none for zero or one pin (a single pin is centred). */
function boundsFor(peopleWithCoords) {
  if (peopleWithCoords.length < 2) return null;
  const lngs = peopleWithCoords.map(p => p.coords[1]);
  const lats = peopleWithCoords.map(p => p.coords[0]);
  return new maplibregl.LngLatBounds(
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)]
  );
}

export function YearDetailMap({ people, year, hoveredPersonId, onHoverPerson, credit = false }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(new Map()); // personId -> { marker, el }

  // Resolve people to those with valid coordinates
  const peopleWithCoords = useMemo(() => people
    .map(p => {
      const coords = getCoordinatesForLocation(p.location);
      if (!coords) return null;
      return { ...p, coords };
    })
    .filter(Boolean), [people]);

  // The map is rebuilt only when the set of pins changes, not every time the
  // parent hands over a new array of the same people. The latest people and
  // hover callback are read through refs when it is.
  const pinsKey = peopleWithCoords.map(p => `${p.id}@${p.coords.join(',')}`).join('|');
  const peopleRef = useRef(peopleWithCoords);
  const onHoverRef = useRef(onHoverPerson);
  useEffect(() => {
    peopleRef.current = peopleWithCoords;
    onHoverRef.current = onHoverPerson;
  });

  const mapsWork = canUseWebGL();

  useEffect(() => {
    const peopleWithCoords = peopleRef.current;
    if (!mapsWork || peopleWithCoords.length === 0 || !mapContainerRef.current) return;

    const bounds = boundsFor(peopleWithCoords);
    const firstPerson = peopleWithCoords[0];

    let map;
    try {
      map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: OHM_STYLE_URL,
        center: bounds
          ? bounds.getCenter().toArray()
          : [firstPerson.coords[1], firstPerson.coords[0]],
        zoom: 5,
        attributionControl: true,
      });
    } catch (err) {
      // Never let the map take the year summary (or the page) down with it.
      console.warn('Year map could not start:', err);
      return;
    }

    mapRef.current = map;

    // Use English labels on the map
    map.addControl(new MaplibreLanguage({ defaultLanguage: 'en' }));

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    // Add markers for each person
    for (const person of peopleWithCoords) {
      const [lat, lng] = person.coords;

      const el = document.createElement('div');
      el.className = 'year-map-pin';
      el.style.setProperty('--pin-color', person.color || '#c0392b');
      el.setAttribute('data-person-id', person.id);

      // Tooltip popup (shown on hover)
      const tooltipLabel = person.location
        ? `<strong>${person.name}</strong> in <em>${person.location}</em>`
        : `<strong>${person.name}</strong>`;
      const popup = new maplibregl.Popup({
        offset: 12,
        closeButton: false,
        closeOnClick: false,
        className: 'year-map-tooltip',
      }).setHTML(tooltipLabel);

      // Hover events on the pin
      el.addEventListener('mouseenter', () => {
        popup.setLngLat([lng, lat]).addTo(map);
        onHoverRef.current?.(person.id, 'map');
      });
      el.addEventListener('mouseleave', () => {
        popup.remove();
        onHoverRef.current?.(null);
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([lng, lat])
        .addTo(map);

      markersRef.current.set(person.id, { marker, el, popup });
    }

    // Filter map to the historical date as soon as the style is parsed,
    // BEFORE tiles are fetched — so the first tiles already reflect the correct year.
    map.once('style.load', () => {
      if (bounds) {
        map.fitBounds(bounds, { padding: 50, maxZoom: 8 });
      }

      if (year != null) {
        const yearStr = formatYearForOHM(year);
        try {
          filterByDate(map, yearStr);
        } catch {
          // silently ignore if style doesn't support date filtering
        }
      }
    });

    const markers = markersRef.current;
    return () => {
      markers.clear();
      mapRef.current = null;
      map.remove();
    };
  }, [mapsWork, pinsKey, year]);

  // Update highlight state on markers when hoveredPersonId changes
  useEffect(() => {
    const map = mapRef.current;
    for (const [id, { el, popup, marker }] of markersRef.current) {
      if (hoveredPersonId && id === hoveredPersonId) {
        el.classList.add('year-map-pin-highlighted');
        el.classList.remove('year-map-pin-dimmed');
        // Show tooltip when highlighted from pill hover too
        if (map && popup && !popup.isOpen()) {
          const lngLat = marker.getLngLat();
          popup.setLngLat(lngLat).addTo(map);
        }
      } else if (hoveredPersonId && id !== hoveredPersonId) {
        el.classList.add('year-map-pin-dimmed');
        el.classList.remove('year-map-pin-highlighted');
        if (popup?.isOpen()) popup.remove();
      } else {
        el.classList.remove('year-map-pin-highlighted', 'year-map-pin-dimmed');
        if (popup?.isOpen()) popup.remove();
      }
    }
  }, [hoveredPersonId]);

  if (peopleWithCoords.length === 0) return null;

  return (
    <div className="historical-map-section">
      <h3>Historical Map</h3>
      {mapsWork ? (
        <div className="historical-map-container year-detail-map-container" ref={mapContainerRef} />
      ) : (
        <div className="historical-map-container year-detail-map-container historical-map-container--unavailable">
          <p>The map can't be shown in this browser.</p>
        </div>
      )}
      {year != null && (
        <p className="historical-map-date">
          Showing borders c. {formatDisplayYear(year)}
        </p>
      )}
      {credit && (
        <p className="historical-map-credit">
          Map ©{' '}
          <a href="https://www.openhistoricalmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenHistoricalMap</a>
          {' '}contributors (ODbL)
        </p>
      )}
    </div>
  );
}

function formatYearForOHM(year) {
  if (year < 0) {
    return '-' + String(Math.abs(year)).padStart(4, '0');
  }
  return String(year).padStart(4, '0');
}

function formatDisplayYear(year) {
  return formatYear(year);
}
