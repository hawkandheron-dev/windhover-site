/**
 * Lower is better. The index is alphabetical, so "Atha" listed "Athanasian
 * canon" above Athanasius himself; a reader typing a name is usually after
 * the person. Exact, then prefix, then word-start, then anywhere; on a tie,
 * people before landmarks.
 */
const TYPE_RANK = { person: 0, point: 1, period: 2 };
export function matchRank(entry, q) {
  const name = entry.name.toLowerCase();
  const where = name === q ? 0
    : name.startsWith(q) ? 1
    : name.split(/[\s,/()-]+/).some(w => w.startsWith(q)) ? 2
    : 3;
  return where * 10 + (TYPE_RANK[entry.type] ?? 3);
}
