import { describe, it, expect } from 'vitest';
import { placeVerticalLabels } from '../../timeline-scratch/src/components/Timeline/utils/verticalStrings.js';

const yearToY = (year) => year * 8;
const point = (id, year, name = 'Short') => ({ id, year, name });

describe('placeVerticalLabels', () => {
  it('labels landmarks with room, in year order, first line on the string', () => {
    const out = placeVerticalLabels([point('b', 60), point('a', 20)], yearToY);
    expect(out.map(p => p.id)).toEqual(['a', 'b']);
    expect(out.every(p => p.showLabel)).toBe(true);
    expect(out[0]).toMatchObject({ y: 160, labelTop: 152, lines: 1 });
  });

  it('drops a label that would run into the one above, but keeps its mark', () => {
    const out = placeVerticalLabels([
      point('long', 30, 'Crucifixion and Resurrection of Jesus'),
      point('next', 33, 'Pentecost'),
      point('later', 48, 'Galatians'),
    ], yearToY);
    const byId = Object.fromEntries(out.map(p => [p.id, p]));
    expect(byId.long.lines).toBe(3);
    expect(byId.next.showLabel).toBe(false);
    expect(byId.later.showLabel).toBe(true);
  });

  it('never lets two shown labels overlap', () => {
    const points = Array.from({ length: 40 }, (_, i) => point(`p${i}`, i * 2.5, 'x'.repeat(5 + (i * 7) % 40)));
    const shown = placeVerticalLabels(points, yearToY).filter(p => p.showLabel);
    for (let i = 1; i < shown.length; i++) {
      expect(shown[i].labelTop).toBeGreaterThanOrEqual(shown[i - 1].labelTop + shown[i - 1].labelHeight);
    }
  });

  it('steps a second mark in the same year sideways so both can be tapped', () => {
    const out = placeVerticalLabels([point('a', 33), point('b', 33), point('c', 33), point('d', 50)], yearToY);
    expect(out.map(p => p.markSlot)).toEqual([0, 1, 2, 0]);
  });
});

describe('wrappedLines', () => {
  it('wraps at spaces, as the label does', async () => {
    const { wrappedLines } = await import('../../timeline-scratch/src/components/Timeline/utils/verticalStrings.js');
    expect(wrappedLines('Pentecost', 14)).toBe(1);
    // "Epiphanius" / "writes the" / "Panarion": three lines, not 30/14 → 2.
    expect(wrappedLines('Epiphanius writes the Panarion', 14)).toBe(3);
    expect(wrappedLines('', 14)).toBe(1);
  });
});
