import { describe, it, expect, vi } from 'vitest';

// jsdom has no canvas to measure text with; six pixels a character will do.
vi.mock('../../timeline-scratch/src/components/Timeline/utils/labelFit.js', () => ({
  measureLabel: (text) => String(text).length * 6,
}));
import { packRulerRows } from '../../timeline-scratch/src/components/Timeline/utils/rulerStrip.js';

const ruler = (id, start, end) => ({ id, name: id, reignStartYear: start, reignEndYear: end });

describe('packRulerRows', () => {
  it('gives each name the room up to the next reign in its row', () => {
    // Six overlapping reigns in five rows: the sixth shares the row that
    // frees first, so the name before it there is cut, not written over.
    const people = [1, 2, 3, 4, 5, 6].map(i => ruler(`r${i}`, i, i + 100));
    const out = packRulerRows(people, 0.1);
    expect(Math.max(...out.map(r => r.row))).toBe(4);
    const shared = out.filter(r => r.row === out.find(o => o.person.id === 'r6').row);
    expect(shared).toHaveLength(2);
    expect(shared[0].room).toBe(shared[1].start - shared[0].start);
    expect(shared[1].room).toBe(Infinity);
  });
});
