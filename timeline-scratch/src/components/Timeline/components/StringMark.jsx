import './StringMark.css';

/**
 * The small mark a harp string carries (config.pointStyle === 'string'):
 * a diamond for a council, a square for a text, a dot for anything else, all
 * the same size (owner's call, M3 round 3). The same mark appears on the
 * string's dot, in its label, in the Key and in search, so a reader learns
 * it once.
 */
export function markForPoint(point) {
  const kind = point?.itemType || point?.filterKey;
  if (kind === 'councils') return 'diamond';
  if (kind === 'documents') return 'square';
  return 'dot';
}

export function StringMark({ mark = 'dot', color, size = 9, className = '' }) {
  return (
    <span
      className={`string-mark string-mark--${mark} ${className}`.trim()}
      style={{ '--mark-color': color, '--mark-size': `${size}px` }}
      aria-hidden="true"
    />
  );
}
