import { describe, it, expect } from 'vitest';
import { rulerDropFor } from '../../timeline-scratch/src/components/Timeline/utils/rulerDrop.js';

describe('rulerDropFor', () => {
  const layout = (points) => ({ axisY: 500, sizes: { axisHeight: 30 }, stackedPoints: points });

  it('lowers the rulers to just below the deepest landmark under the axis', () => {
    const points = [
      { aboveTimeline: false, y: 538, height: 20 },
      { aboveTimeline: false, y: 558, height: 20 }, // a second row
      { aboveTimeline: true, y: 400, height: 20 },  // above the axis: ignored
    ];
    // Bottom 578, axis band ends at 530, plus 8px of air.
    expect(rulerDropFor(layout(points))).toBe(56);
  });

  it('is zero with nothing below the axis, and never negative', () => {
    expect(rulerDropFor(layout([{ aboveTimeline: true, y: 400, height: 20 }]))).toBe(0);
    expect(rulerDropFor(layout([{ aboveTimeline: false, y: 500, height: 10 }]), 0)).toBe(0);
    expect(rulerDropFor(null)).toBe(0);
  });
});
