/**
 * Lifelines' pan and zoom bounds follow the data at the start and stop at
 * AD 2100 (owner, 2026-10-10).
 */
import { describe, it, expect } from 'vitest';
import { timeBounds, dataYearExtent } from '../../timeline-scratch/src/components/Timeline/utils/timeBounds.js';

describe('timeBounds', () => {
  it('starts 100 years before the earliest entry, to the nearest 50', () => {
    expect(timeBounds({ earliest: -3, latest: 1700 }).minYear).toBe(-100);
    expect(timeBounds({ earliest: -30, latest: 1700 }).minYear).toBe(-150);
    expect(timeBounds({ earliest: 120, latest: 1700 }).minYear).toBe(0);
  });

  it('ends at 2100, or later when the data runs past 2000', () => {
    expect(timeBounds({ earliest: -3, latest: 1700 }).maxYear).toBe(2100);
    expect(timeBounds({ earliest: -3, latest: 2040 }).maxYear).toBe(2150);
  });
});

describe('dataYearExtent', () => {
  it('reads people and points', () => {
    const getYear = (d) => (d == null ? null : Number(d));
    const data = { people: [{ startDate: '-3', endDate: '33' }], points: [{ date: '1517', endDate: '1521' }] };
    expect(dataYearExtent(data, getYear)).toEqual({ earliest: -3, latest: 1521 });
  });
});
