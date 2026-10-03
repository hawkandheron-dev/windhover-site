/**
 * Lifelines' search lists results by how well the name matches, then people
 * before landmarks. Alphabetical order put "Athanasian canon" above
 * Athanasius himself when a reader typed "Atha".
 */
import { describe, it, expect } from 'vitest';
import { matchRank } from '../../timeline-scratch/src/components/Timeline/utils/searchRank.js';

const rank = (entries, q) =>
  [...entries].sort((a, b) => matchRank(a, q) - matchRank(b, q) || a.name.localeCompare(b.name)).map(e => e.name);

describe('matchRank', () => {
  it('puts the person above events that match as well', () => {
    const entries = [
      { name: 'Athanasian canon', type: 'point' },
      { name: 'Athanasius writes On the Incarnation', type: 'point' },
      { name: 'Athanasius', type: 'person' },
    ];
    expect(rank(entries, 'atha')[0]).toBe('Athanasius');
  });

  it('ranks exact, then prefix, then word-start, then anywhere', () => {
    const entries = [
      { name: 'Council of Nicaea', type: 'point' },   // word-start
      { name: 'Nicaean fragment', type: 'point' },    // prefix
      { name: 'Antinicaea', type: 'point' },          // anywhere
      { name: 'Nicaea', type: 'point' },              // exact
    ];
    expect(rank(entries, 'nicaea')).toEqual(['Nicaea', 'Nicaean fragment', 'Council of Nicaea', 'Antinicaea']);
  });
});
