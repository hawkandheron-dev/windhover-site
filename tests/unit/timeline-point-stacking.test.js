/**
 * Point stacking sizes its collision boxes for the HTML callout each point
 * renders — icon, name and date, around 200px wide. CH Timeline 2.0's
 * background layer draws bare markers instead, and inheriting the callout
 * width there stacked eighty-five events into dozens of rows: a diagonal
 * cascade running off the bottom of the screen rather than a band beside the
 * axis. `markerWidth` is what lets a label-less layer say so.
 */
import { describe, it, expect } from 'vitest';
import { stackPoints } from '../../timeline-scratch/src/components/Timeline/utils/stacking.js';

/** Twelve events spread eight years apart across a century. */
const CLUSTER = Array.from({ length: 12 }, (_, i) => ({
  id: `ev-${i}`,
  name: `A Council With A Fairly Long Name ${i}`,
  date: `0${325 + i * 8}-01-01`,
}));

const rowCount = (stacked) => new Set(stacked.map(p => p.row)).size;

describe('stackPoints', () => {
  it('gives every point a row', () => {
    const stacked = stackPoints(CLUSTER, 150, 1);
    expect(stacked).toHaveLength(CLUSTER.length);
    for (const p of stacked) expect(Number.isInteger(p.row)).toBe(true);
  });

  it('stacks a tight cluster deeply when sizing for callout labels', () => {
    // One year per pixel: a callout for a name this long spans ~360 years, so
    // every event in the century collides with every other.
    expect(rowCount(stackPoints(CLUSTER, 150, 1))).toBe(CLUSTER.length);
  });

  it('collapses that cluster when the layer draws bare markers', () => {
    const bare = rowCount(stackPoints(CLUSTER, 150, 1, 16));
    expect(bare).toBeLessThan(CLUSTER.length);
    // A 16px marker at one year per pixel spans 16 years, and the events sit
    // eight years apart, so each only collides with its neighbour: two rows,
    // a band rather than a cascade.
    expect(bare).toBeLessThanOrEqual(3);
  });

  it('still separates points that genuinely collide as markers', () => {
    const sameYear = [
      { id: 'a', name: 'A', date: '0325-01-01' },
      { id: 'b', name: 'B', date: '0325-01-01' },
      { id: 'c', name: 'C', date: '0325-01-01' },
    ];
    expect(rowCount(stackPoints(sameYear, 150, 1, 16))).toBe(3);
  });

  it('leaves well-separated points on one row', () => {
    const spread = [
      { id: 'a', name: 'A', date: '0100-01-01' },
      { id: 'b', name: 'B', date: '0500-01-01' },
      { id: 'c', name: 'C', date: '0900-01-01' },
    ];
    expect(rowCount(stackPoints(spread, 150, 1, 16))).toBe(1);
  });

  it('defaults to the callout estimate, so existing timelines are unchanged', () => {
    expect(rowCount(stackPoints(CLUSTER, 150, 1, null)))
      .toBe(rowCount(stackPoints(CLUSTER, 150, 1)));
  });

  it('handles an empty layer', () => {
    expect(stackPoints([], 150, 1, 16)).toEqual([]);
    expect(stackPoints(null, 150, 1, 16)).toEqual([]);
  });
});
