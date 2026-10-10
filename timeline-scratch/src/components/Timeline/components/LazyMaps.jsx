/**
 * The detail maps, loaded on first use.
 *
 * maplibre is about a megabyte of JavaScript (and its own stylesheet) and is
 * only needed once a reader opens a detail or a year summary. Imported
 * directly, it sat in front of the first paint of every timeline page. The
 * placeholder holds the map's box so the panel doesn't jump when it arrives.
 */
import { lazy, Suspense } from 'react';

const HistoricalMapImpl = lazy(() => import('./HistoricalMap.jsx').then(m => ({ default: m.HistoricalMap })));
const YearDetailMapImpl = lazy(() => import('./YearDetailMap.jsx').then(m => ({ default: m.YearDetailMap })));

function MapPlaceholder({ title, extraClass = '' }) {
  return (
    <div className="historical-map-section">
      {title && <h3>{title}</h3>}
      <div className={`historical-map-container ${extraClass}`.trim()} aria-busy="true" />
    </div>
  );
}

export function HistoricalMap(props) {
  if (!props.location) return null;
  return (
    <Suspense fallback={<MapPlaceholder title={props.title === undefined ? 'Historical Map' : props.title} />}>
      <HistoricalMapImpl {...props} />
    </Suspense>
  );
}

export function YearDetailMap(props) {
  return (
    <Suspense fallback={<MapPlaceholder title={props.title === undefined ? 'Historical Map' : props.title} extraClass="year-detail-map-container" />}>
      <YearDetailMapImpl {...props} />
    </Suspense>
  );
}
