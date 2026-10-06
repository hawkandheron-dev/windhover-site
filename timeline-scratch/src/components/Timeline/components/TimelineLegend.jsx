/**
 * Legend component for timeline with toggle filters
 */

import { Icon, ShapeIcon } from './Icon.jsx';
import { StringMark } from './StringMark.jsx';
import './TimelineLegend.css';

// The mark is drawn at 18-22px; the small copy (96px tall) stays sharp at 3x
// and is 3 KB, where the 2570px original is 66 KB.
const LOGO_PATH = new URL('../../../../../../resources/logos/Windhover_BLK-small.png', import.meta.url).href;

export function TimelineLegend({ legend, isVisible = true, filters = {}, onFilterToggle, onMouseEnter, onMouseLeave, siteTitle, siteSubtitle, config, collapsed = false, onToggleCollapsed }) {
  if (!isVisible || !legend || legend.length === 0) return null;

  const handleToggle = (filterKey) => {
    if (onFilterToggle && filterKey) {
      onFilterToggle(filterKey);
    }
  };

  if (config?.legendLayout === 'slim') {
    return (
      <SlimLegend
        legend={legend}
        filters={filters}
        onToggle={handleToggle}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        siteTitle={siteTitle}
        siteSubtitle={siteSubtitle}
        publisherStrapline={config.publisherStrapline}
        collapsed={collapsed}
        onToggleCollapsed={onToggleCollapsed}
      />
    );
  }

  return (
    <div className="timeline-legend" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <div className="legend-brand">
        <img className="legend-brand-logo" src={LOGO_PATH} alt="Windhover" />
        <span className="legend-brand-title">Windhover</span>
      </div>
      {siteTitle && (
        <h1 className="legend-site-title">
          {siteTitle}
          {/* The strapline sits inside the heading so the two read as one name,
              but at a size that does not compete with it. */}
          {siteSubtitle && <span className="legend-site-subtitle">{siteSubtitle}</span>}
        </h1>
      )}
      <h3 className="legend-title">Legend</h3>
      <div className="legend-items">
        {legend.map(item => {
          const isActive = item.filterKey ? filters[item.filterKey] !== false : true;

          // A legend long enough to need sections can declare them. CH 2.0
          // uses two — the eras in front, the background behind.
          if (item.type === 'heading') {
            return (
              <div key={item.id} className="legend-section-heading">
                {item.name}
              </div>
            );
          }

          // A ramp, not a set of categories. Sixteen century checkboxes would
          // be a worse legend than the eras they replace, so the strip just
          // says "colour means when" and offers nothing to toggle.
          if (item.type === 'century-ramp') {
            const ramp = config?.centuryRamp;
            if (!ramp) return null;
            return (
              <div key={item.id} className="legend-century-ramp">
                <div
                  className="legend-century-bar"
                  style={{ backgroundImage: `linear-gradient(to right, ${ramp.colors.join(', ')})` }}
                />
                <div className="legend-century-ticks">
                  {ramp.ticks.map(t => (
                    <span key={t.century}>{t.label}</span>
                  ))}
                </div>
              </div>
            );
          }

          return (
            <div
              key={item.id}
              className={`legend-item ${!isActive ? 'legend-item-inactive' : ''}`}
              onClick={() => handleToggle(item.filterKey)}
              style={{ cursor: item.filterKey ? 'pointer' : 'default' }}
            >
              {/* Toggle checkbox */}
              {item.filterKey && (
                <span className="legend-toggle">
                  <input
                    type="checkbox"
                    checked={isActive}
                    // The visible name sits in a sibling span, not a <label>,
                    // so without this a screen reader announces "checkbox".
                    aria-label={`Show ${item.name}`}
                    onChange={() => handleToggle(item.filterKey)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </span>
              )}

              {/* People type - color box */}
              {item.type === 'people' && (
                <span
                  className="legend-color-box"
                  style={{
                    backgroundColor: item.color,
                    opacity: isActive ? 1 : 0.4
                  }}
                />
              )}

              {/* Bracket type - small bracket visual */}
              {item.type === 'bracket' && (
                <span className="legend-bracket" style={{ opacity: isActive ? 1 : 0.4 }}>
                  <svg width="20" height="20" viewBox="0 0 20 20">
                    <path
                      d="M 2 4 Q 4 4 4 8 Q 4 10 10 10 Q 4 10 4 12 Q 4 16 2 16"
                      fill="none"
                      stroke={item.color}
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              )}

              {/* Period type - color box (backwards compatibility) */}
              {item.type === 'period' && (
                <span
                  className="legend-color-box"
                  style={{
                    backgroundColor: item.color,
                    opacity: isActive ? 1 : 0.4
                  }}
                />
              )}

              {/* Point type - shape icon */}
              {item.type === 'point' && (
                <span className="legend-icon" style={{ opacity: isActive ? 1 : 0.4 }}>
                  <ShapeIcon shape={item.shape} color={item.color} size={18} />
                </span>
              )}

              {/* Icon type */}
              {item.type === 'icon' && (
                <span className="legend-icon" style={{ opacity: isActive ? 1 : 0.4 }}>
                  {item.icon}
                </span>
              )}

              {/* Emperor crown icon */}
              {item.isMonarch && (
                <span className="legend-emperor-icon" style={{ marginLeft: '-4px', opacity: isActive ? 1 : 0.4 }}>
                  <Icon name="crown" size={14} color={item.color} />
                </span>
              )}

              <span
                className="legend-label"
                style={{ opacity: isActive ? 1 : 0.5 }}
              >
                {item.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Lifelines' legend (config.legendLayout = 'slim'). The product's name leads,
 * the publisher signs off at the foot, and in between are only the things a
 * reader can switch: no colour key, no section headings for four rows.
 * Councils and texts keep their shapes and reigns their crown, so each row
 * still says what it governs on the canvas.
 *
 * It collapses to a single "Key" button so it never sits over figures; the
 * parent decides when (see Timeline.jsx).
 */
function SlimLegend({ legend, filters, onToggle, onMouseEnter, onMouseLeave, siteTitle, siteSubtitle, publisherStrapline, collapsed, onToggleCollapsed }) {
  if (collapsed) {
    return (
      <div className="timeline-legend timeline-legend--slim timeline-legend--collapsed" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
        <button
          type="button"
          className="btn legend-expand"
          onClick={onToggleCollapsed}
          aria-expanded="false"
          aria-controls="lifelines-legend"
        >
          Key
        </button>
      </div>
    );
  }

  const rows = legend.filter(item => item.filterKey);
  return (
    <div
      id="lifelines-legend"
      className="timeline-legend timeline-legend--slim"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="legend-slim-head">
        {siteTitle && (
          <h1 className="legend-site-title">
            {siteTitle}
            {siteSubtitle && <span className="legend-site-subtitle">{siteSubtitle}</span>}
          </h1>
        )}
        {onToggleCollapsed && (
          <button
            type="button"
            className="legend-collapse"
            onClick={onToggleCollapsed}
            aria-expanded="true"
            aria-controls="lifelines-legend"
            aria-label="Hide the key"
            title="Hide the key"
          >
            <Icon name="close" size={12} />
          </button>
        )}
      </div>

      <ul className="legend-slim-rows">
        {rows.map(item => {
          const isActive = filters[item.filterKey] !== false;
          return (
            <li key={item.id}>
              <label className={`legend-slim-row${isActive ? '' : ' is-off'}`}>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={() => onToggle(item.filterKey)}
                />
                <span className="legend-slim-mark" aria-hidden="true">
                  {item.type === 'point' && (item.mark
                    ? <StringMark mark={item.mark} color={item.color} size={10} />
                    : <ShapeIcon shape={item.shape} color={item.color} size={16} />)}
                  {item.isMonarch && <Icon name="crown" size={14} color={item.color} />}
                  {item.type === 'people' && !item.isMonarch && <span className="legend-slim-bar" />}
                </span>
                <span className="legend-slim-label">{item.name}</span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="legend-publisher">
        <img className="legend-brand-logo" src={LOGO_PATH} alt="" />
        <span className="legend-publisher-text">
          <span className="legend-brand-title">Windhover</span>
          {publisherStrapline && <span className="legend-publisher-strapline">{publisherStrapline}</span>}
        </span>
      </div>
    </div>
  );
}

