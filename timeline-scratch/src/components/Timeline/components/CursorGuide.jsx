import { formatYear } from '../utils/dateUtils.js';
import { usePointer } from '../hooks/usePointer.js';

/**
 * The thin vertical line under the pointer, behind everything.
 *
 * `style` (config.cursorLine, opt-in) sets a width in px and a colour for the
 * year under the pointer; Lifelines colours it by century. Without it, the
 * line is the old 1px grey.
 */
export function CursorLine({ store, style: lineStyle, viewportStartYear = 0, yearsPerPixel = 1 }) {
  const { x } = usePointer(store);
  const width = lineStyle?.width || 1;
  const color = lineStyle?.color
    ? lineStyle.color(Math.round(viewportStartYear + x * yearsPerPixel))
    : 'rgba(100, 100, 100, 0.5)';
  return (
    <div
      className="cursor-year-line"
      style={{
        position: 'absolute',
        left: `${x - (width - 1) / 2}px`,
        top: 0,
        width: `${width}px`,
        height: '100%',
        backgroundColor: color,
        opacity: lineStyle?.color ? 0.75 : undefined,
        pointerEvents: 'none',
        zIndex: 1
      }}
    />
  );
}

/** The year under the pointer, in a chip beside it. */
export function CursorYearChip({ store, viewportStartYear, yearsPerPixel, eraLabels, minTop = 0 }) {
  const { x, y } = usePointer(store);
  const year = Math.round(viewportStartYear + x * yearsPerPixel);
  return (
    <div
      className="cursor-year-display"
      style={{
        position: 'absolute',
        left: `${x + 12}px`,
        top: `${Math.max(minTop, y - 10)}px`,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        color: '#fff',
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: '500',
        pointerEvents: 'none',
        zIndex: 200,
        whiteSpace: 'nowrap'
      }}
    >
      {formatYear(year, eraLabels)}
    </div>
  );
}
