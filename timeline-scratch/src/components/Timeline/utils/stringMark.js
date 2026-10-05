/**
 * Which mark a harp string carries (StringMark.jsx): a diamond for a
 * council, a square for a text, a dot for anything else.
 */
export function markForPoint(point) {
  const kind = point?.itemType || point?.filterKey;
  if (kind === 'councils') return 'diamond';
  if (kind === 'documents') return 'square';
  return 'dot';
}
