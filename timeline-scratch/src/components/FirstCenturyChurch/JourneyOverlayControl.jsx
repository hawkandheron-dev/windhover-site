/**
 * Bottom control bar: the site title, the four missionary-journey toggles,
 * the connection-style toggle (only when a city is focused), the "see the
 * whole web" button, and a reset button.
 */

const WEB_STYLES = [
  { id: 'spokes', label: 'Spokes', title: 'People connect to the city as spokes on a wheel.' },
  { id: 'web',    label: 'Network', title: 'People at the same city link to each other in a faint mesh.' },
  { id: 'hidden', label: 'Just dots', title: 'Hide structural lines — only the dots and active connections show.' },
];

export function JourneyOverlayControl({
  journeys, activeJourney, onJourneySelect,
  onShowGlobalGraph, showReset, onReset,
  webStyle = 'spokes', onWebStyleChange, showWebStyle = false,
}) {
  return (
    <div className="fcc-controls">
      <div className="fcc-controls-title">
        <a className="fcc-home-link" href="/home.html" title="Back to Windhover">‹</a>
        <span>First Century Church Directory</span>
      </div>

      <div className="fcc-journey-toggles">
        <span className="fcc-controls-label">Paul&rsquo;s journeys</span>
        {journeys.map(j => (
          <button
            key={j.journey_id}
            className={`fcc-journey-btn${activeJourney === j.journey_id ? ' fcc-journey-btn--active' : ''}`}
            style={{ '--journey-color': j.color || '#b05ca0' }}
            onClick={() => onJourneySelect(j.journey_id)}
            title={j.description || j.name}
          >
            <span className="fcc-journey-dot" />
            {j.name.replace("Paul's ", '')}
          </button>
        ))}
      </div>

      {showWebStyle && (
        <div className="fcc-web-style-toggles" role="group" aria-label="Connection style">
          <span className="fcc-controls-label">Connections</span>
          {WEB_STYLES.map(s => (
            <button
              key={s.id}
              type="button"
              className={`fcc-web-style-btn${webStyle === s.id ? ' fcc-web-style-btn--active' : ''}`}
              onClick={() => onWebStyleChange?.(s.id)}
              title={s.title}
              aria-pressed={webStyle === s.id}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      <div className="fcc-controls-actions">
        <button className="fcc-global-btn" onClick={onShowGlobalGraph}>
          See the whole web
        </button>
        {showReset && (
          <button className="fcc-reset-btn" onClick={onReset}>Reset</button>
        )}
      </div>
    </div>
  );
}
