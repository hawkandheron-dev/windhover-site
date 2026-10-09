import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { filterByDate } from '@openhistoricalmap/maplibre-gl-dates';
import MaplibreLanguage from '@openhistoricalmap/maplibre-gl-language';
import { getCoordinatesForLocation } from '../../../data/locationCoordinates.js';
import { formatYear } from '../utils/dateUtils.js';
import { canUseWebGL } from '../utils/webgl.js';

const OHM_STYLE_URL = 'https://www.openhistoricalmap.org/map-styles/main/main.json';

/**
 * Renders an Open Historical Map centered on a person's location,
 * filtered to their birth year, with a marker pin.
 */
/**
 * @param {boolean} [credit] - A plain credit line under the map, readable at
 *   any size; MapLibre's own control folds to an (i) button on narrow maps.
 */
/**
 * @param {string} [fromLocation] - Start here and fly to `location` (opt-in;
 *   Lifelines' tour moves Irenaeus from Smyrna to Lyons). Read once, when the
 *   map is made: a later change, or none, leaves the map where it is.
 */
export function HistoricalMap({ location, birthYear, title = 'Historical Map', credit = false, fromLocation = null }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const fromRef = useRef(fromLocation);
  const coords = getCoordinatesForLocation(location);
  const noCoords = !coords;
  const lat = coords?.[0];
  const lng = coords?.[1];
  const mapsWork = canUseWebGL();

  useEffect(() => {
    if (!mapsWork || lat == null || lng == null || !mapContainerRef.current) return;

    // The journey: start at fromLocation and fly home, unless the reader
    // asked for less motion (then it simply starts at home).
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const from = !reduce ? getCoordinatesForLocation(fromRef.current) : null;
    const start = from ? [from[1], from[0]] : [lng, lat];
    const container = mapContainerRef.current;

    let map;
    try {
      map = new maplibregl.Map({
        container,
        style: OHM_STYLE_URL,
        center: start,
        zoom: 6,
        attributionControl: true,
      });
    } catch (err) {
      // Never let the map take the panel (or the page) down with it.
      console.warn('Historical map could not start:', err);
      return;
    }

    mapRef.current = map;

    // Use English labels on the map
    map.addControl(new MaplibreLanguage({ defaultLanguage: 'en' }));

    // Add navigation controls (zoom in/out, compass)
    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    // Add marker at the person's location (or where their journey starts)
    const marker = new maplibregl.Marker({ color: '#c0392b' })
      .setLngLat(start)
      .addTo(map);

    let flight = null;
    let landing = null;
    if (from) {
      container.dataset.mapAt = 'from';
      const FLIGHT_MS = 2500;
      // The pin lands with the camera. If the map never animates (its style
      // failed to load, say) it still lands, at the flight's end.
      const land = () => {
        clearTimeout(landing);
        if (container.dataset.mapAt === 'to') return;
        marker.setLngLat([lng, lat]);
        map.jumpTo({ center: [lng, lat] });
        container.dataset.mapAt = 'to';
      };
      // A beat to see where they began, then the flight. Timed rather than
      // on 'load', so it runs while tiles are still arriving.
      flight = setTimeout(() => {
        map.once('moveend', land);
        landing = setTimeout(land, FLIGHT_MS + 300);
        map.flyTo({ center: [lng, lat], zoom: 6, duration: FLIGHT_MS, essential: true });
      }, 900);
    }

    // Filter map to the historical date as soon as the style is parsed,
    // BEFORE tiles are fetched — so the first tiles already reflect the correct year.
    map.once('style.load', () => {
      if (birthYear != null) {
        const yearStr = formatYearForOHM(birthYear);
        try {
          filterByDate(map, yearStr);
        } catch {
          // Some styles may not support date filtering; silently ignore
        }
      }
    });

    return () => {
      clearTimeout(flight);
      clearTimeout(landing);
      mapRef.current = null;
      map.remove();
    };
  }, [mapsWork, lat, lng, birthYear]);

  if (!location) return null;

  if (noCoords) {
    return null;
  }

  return (
    <div className="historical-map-section">
      {title && <h3>{title}</h3>}
      {mapsWork ? (
        <div className="historical-map-container" ref={mapContainerRef} />
      ) : (
        <div className="historical-map-container historical-map-container--unavailable">
          <p>The map can't be shown in this browser.</p>
        </div>
      )}
      {birthYear != null && (
        <p className="historical-map-date">
          Showing borders c. {formatDisplayYear(birthYear)}
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

/** Format a year integer into an OHM-compatible date string */
function formatYearForOHM(year) {
  if (year < 0) {
    // OHM uses negative years for BCE (e.g., "-0003")
    return '-' + String(Math.abs(year)).padStart(4, '0');
  }
  return String(year).padStart(4, '0');
}

/** Format a year for display (e.g., "3 BC", "100 AD") */
function formatDisplayYear(year) {
  return formatYear(year);
}
