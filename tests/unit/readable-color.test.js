import { describe, it, expect } from 'vitest';
import { readableOnWhite, contrastWithWhite } from '../../timeline-scratch/src/components/Timeline/utils/readableColor.js';

describe('readableOnWhite', () => {
  it('leaves a colour that already reads alone', () => {
    expect(readableOnWhite('#7a1f2b')).toBe('#7a1f2b');
  });

  it('darkens a light colour just enough for white text at 4.5:1', () => {
    const out = readableOnWhite('#9a7b1f'); // the texts' gold, 4.0:1
    expect(out).not.toBe('#9a7b1f');
    expect(contrastWithWhite(out)).toBeGreaterThanOrEqual(4.5);
    expect(contrastWithWhite(out)).toBeLessThan(5);
  });

  it('keeps the hue (channels scale together)', () => {
    const out = readableOnWhite('#5c9159');
    const [r, g, b] = [1, 3, 5].map(i => parseInt(out.slice(i, i + 2), 16));
    expect(g).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(b);
  });

  it('passes anything that is not a hex colour through', () => {
    expect(readableOnWhite('rgb(1,2,3)')).toBe('rgb(1,2,3)');
    expect(readableOnWhite(undefined)).toBe(undefined);
  });
});
