import { formatYear } from '../utils/dateUtils.js';
import { usePointer } from '../hooks/usePointer.js';

/** The thin vertical line under the pointer, behind everything. */
export function CursorLine({ store }) {
  const { x } = usePointer(store);
  return (
    <div
      className="cursor-year-line"
      style={{
        position: 'absolute',
        left: `${x}px`,
        top: 0,
        width: '1px',
        height: '100%',
        backgroundColor: 'rgba(100, 100, 100, 0.5)',
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
