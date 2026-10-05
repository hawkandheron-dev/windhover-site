import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { filterByDate } from '@openhistoricalmap/maplibre-gl-dates';
import MaplibreLanguage from '@openhistoricalmap/maplibre-gl-language';
import { getCoordinatesForLocation } from '../../../data/locationCoordinates.js';
import { formatYear } from '../utils/dateUtils.js';

const OHM_STYLE_URL = 'https://www.openhistoricalmap.org/map-styles/main/main.json';

/**
 * Renders an Open Historical Map centered on a person's location,
 * filtered to their birth year, with a marker pin.
 */
export function HistoricalMap({ location, birthYear, title = 'Historical Map' }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const coords = getCoordinatesForLocation(location);
  const noCoords = !coords;
  const lat = coords?.[0];
  const lng = coords?.[1];

  useEffect(() => {
    if (lat == null || lng == null || !mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: OHM_STYLE_URL,
      center: [lng, lat],
      zoom: 6,
      attributionControl: true,
    });

    mapRef.current = map;

    // Use English labels on the map
    map.addControl(new MaplibreLanguage({ defaultLanguage: 'en' }));

    // Add navigation controls (zoom in/out, compass)
    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    // Add marker at the person's location
    new maplibregl.Marker({ color: '#c0392b' })
      .setLngLat([lng, lat])
      .addTo(map);

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
      mapRef.current = null;
      map.remove();
    };
  }, [lat, lng, birthYear]);

  if (!location) return null;

  if (noCoords) {
    return null;
  }

  return (
    <div className="historical-map-section">
      <h3>{title}</h3>
      <div className="historical-map-container" ref={mapContainerRef} />
      {birthYear != null && (
        <p className="historical-map-date">
          Showing borders c. {formatDisplayYear(birthYear)}
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
