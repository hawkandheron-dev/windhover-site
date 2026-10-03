import { describe, it, expect } from 'vitest';
import { placeStringDots } from '../../timeline-scratch/src/components/Timeline/utils/stringDots.js';

// Screen y grows downward; the axis at 500, figures above it.
const env = (bars, extra = {}) => ({ bars, axisY: 500, top: 0, bottom: 900, ...extra });
const bar = (id, x0, x1, y0) => ({ id, x0, x1, y0, y1: y0 + 28 });
const inside = (b, p) => p.x >= b.x0 && p.x <= b.x1 && p.y >= b.y0 && p.y <= b.y1;

describe('placeStringDots', () => {
  it('puts a linked landmark on its figure, at the year', () => {
    const athanasius = bar('athanasius', 100, 400, 300);
    const out = placeStringDots([{ id: 'nicaea', x: 250, side: 'above', connectedPeople: ['athanasius'] }], env([athanasius]));
    // On the bar's lower edge, clear of the name written on it.
    expect(out.get('nicaea')).toEqual({ x: 250, y: 328, personId: 'athanasius' });
  });

  it('prefers the linked bar nearest the axis', () => {
    const far = bar('a', 0, 400, 100);
    const near = bar('b', 0, 400, 400);
    const out = placeStringDots([{ id: 'p', x: 200, side: 'above', connectedPeople: ['a', 'b'] }], env([far, near]));
    expect(out.get('p').personId).toBe('b');
  });

  it('ignores a linked figure who was not alive at that year', () => {
    const dead = bar('a', 0, 100, 400);
    const out = placeStringDots([{ id: 'p', x: 300, side: 'above', connectedPeople: ['a'] }], env([dead]));
    expect(out.get('p').personId).toBeUndefined();
  });

  it('never puts an unlinked dot on a bar', () => {
    // A wall of bars from the axis up, with one gap.
    const bars = [bar('a', 0, 999, 470), bar('b', 0, 999, 440), bar('c', 0, 999, 380)];
    const out = placeStringDots([{ id: 'p', x: 50, side: 'above' }], env(bars));
    const dot = out.get('p');
    expect(bars.some(b => inside(b, dot))).toBe(false);
    expect(dot.y).toBeLessThan(440);
    expect(dot.y).toBeGreaterThan(408);
  });

  it('keeps clear of labels', () => {
    const label = { x0: 0, x1: 300, y0: 470, y1: 492 };
    const out = placeStringDots([{ id: 'p', x: 100, side: 'above' }], env([], { labels: [label] }));
    expect(out.get('p').y).toBeLessThanOrEqual(470 - 6);
  });

  it('spreads neighbouring dots apart', () => {
    const items = [0, 4, 8, 12].map(i => ({ id: `p${i}`, x: 100 + i, side: 'above' }));
    const out = [...placeStringDots(items, env([])).values()];
    for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) {
      expect(Math.hypot(out[i].x - out[j].x, out[i].y - out[j].y)).toBeGreaterThanOrEqual(14);
    }
  });

  it('places texts below the axis', () => {
    const out = placeStringDots([{ id: 't', x: 100, side: 'below' }], env([]));
    expect(out.get('t').y).toBeGreaterThan(500);
  });

  it('falls back to the axis with nowhere free', () => {
    const wall = { id: 'w', x0: 0, x1: 999, y0: 0, y1: 499 };
    const out = placeStringDots([{ id: 'p', x: 10, side: 'above' }], env([wall]));
    expect(out.get('p').y).toBe(500);
  });

  it('skips items that do not want a dot, and is deterministic', () => {
    const items = [{ id: 'a', x: 10, side: 'above', needsDot: false }, { id: 'b', x: 10, side: 'above' }];
    const one = placeStringDots(items, env([]));
    expect(one.has('a')).toBe(false);
    expect([...placeStringDots([...items].reverse(), env([])).entries()]).toEqual([...one.entries()]);
  });
});
