/**
 * Legend component for timeline with toggle filters
 */

import { Icon, ShapeIcon } from './Icon.jsx';
import './TimelineLegend.css';

const LOGO_PATH = new URL('../../../../../../resources/logos/Windhover_BLK.png', import.meta.url).href;

export function TimelineLegend({ legend, isVisible = true, filters = {}, onFilterToggle, onMouseEnter, onMouseLeave, siteTitle, config }) {
  if (!isVisible || !legend || legend.length === 0) return null;

  const handleToggle = (filterKey) => {
    if (onFilterToggle && filterKey) {
      onFilterToggle(filterKey);
    }
  };

  return (
    <div className="timeline-legend" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <div className="legend-brand">
        <img className="legend-brand-logo" src={LOGO_PATH} alt="Windhover" />
        <span className="legend-brand-title">Windhover</span>
      </div>
      {siteTitle && (
        <h1 className="legend-site-title">{siteTitle}</h1>
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
