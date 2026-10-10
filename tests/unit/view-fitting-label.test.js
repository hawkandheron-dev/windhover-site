/**
 * Selecting a figure whose name is longer than their bar zooms in until the
 * name fits (owner, 2026-10-09: a gold ring round bar and overhanging name
 * read badly). These pin the arithmetic.
 */
import { describe, it, expect } from 'vitest';
import { viewFittingLabel } from '../../timeline-scratch/src/components/Timeline/utils/labelFit.js';

const base = { start: 210, end: 264, viewportStartYear: 0, width: 1000 };

describe('viewFittingLabel', () => {
  it('leaves the view alone when the label already fits', () => {
    // 54 years at 0.25 years/px is 216px, room for a 150px label.
    expect(viewFittingLabel({ ...base, labelWidth: 150, yearsPerPixel: 0.25 })).toBeNull();
  });

  it('zooms in just enough for the label, keeping the bar where it was', () => {
    // 54 years at 1 year/px is 54px; a 150px label needs 158px.
    const v = viewFittingLabel({ ...base, labelWidth: 150, yearsPerPixel: 1 });
    expect(v.yearsPerPixel).toBeCloseTo(54 / 158);
    const mid = 237;
    expect((mid - v.startYear) / v.yearsPerPixel).toBeCloseTo(237);
  });

  it('pulls a bar near the edge back on screen', () => {
    const v = viewFittingLabel({ ...base, labelWidth: 150, yearsPerPixel: 1, viewportStartYear: -750 });
    const x0 = (210 - v.startYear) / v.yearsPerPixel;
    const x1 = (264 - v.startYear) / v.yearsPerPixel;
    expect(x0).toBeGreaterThanOrEqual(24 - 1e-6);
    expect(x1).toBeLessThanOrEqual(1000 - 24 + 1e-6);
  });

  it('never zooms past the limit', () => {
    const v = viewFittingLabel({ start: 100, end: 101, labelWidth: 300, yearsPerPixel: 1, viewportStartYear: 0, width: 1000, minYearsPerPixel: 0.1 });
    expect(v.yearsPerPixel).toBe(0.1);
  });
});
