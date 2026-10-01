/**
 * Century colouring replaced eras as CH Timeline 2.0's colour model. A century
 * is a fact about a date rather than an editorial judgement, so these pin the
 * arithmetic and the one case that is easy to get wrong: a lifespan that
 * crosses a boundary, which is most of them.
 */
import { describe, it, expect } from 'vitest';
import {
  CENTURY_COLORS,
  centuryOf,
  colorForCentury,
  colorForLifespan,
  centuryLegendTicks,
  ordinal,
} from '../../timeline-scratch/src/data/churchHistory2Centuries.js';

describe('centuryOf', () => {
  it('puts a year in its century, counting from 1', () => {
    const cases = [
      [1, 1], [100, 1],      // the 1st century is 1–100, not 0–99
      [101, 2], [200, 2],
      [296, 3],              // Athanasius, born in the 3rd
      [325, 4],              // Nicaea
      [451, 5],              // Chalcedon
      [1225, 13],            // Aquinas
      [1483, 15],            // Luther
      [1517, 16],
    ];
    for (const [year, century] of cases) {
      expect(centuryOf(year), `year ${year}`).toBe(century);
    }
  });

  it('clamps BC years to the first century rather than going negative', () => {
    // Augustus is in the data at -63. A "century -1" would be arithmetically
    // right and useless: there is no colour for it and no bar before year 1.
    expect(centuryOf(-63)).toBe(1);
    expect(centuryOf(-5)).toBe(1);
    expect(centuryOf(0)).toBe(1);
  });

  it('survives a missing date', () => {
    for (const bad of [null, undefined, NaN]) {
      expect(centuryOf(bad)).toBe(1);
    }
  });
});

describe('colorForCentury', () => {
  it('returns a distinct colour for each century in the ramp', () => {
    const seen = new Set(CENTURY_COLORS.map((_, i) => colorForCentury(i + 1)));
    expect(seen.size).toBe(CENTURY_COLORS.length);
  });

  it('starts in blue, as Jesus anchors the first century', () => {
    expect(colorForCentury(1)).toBe(CENTURY_COLORS[0]);
    // Blue: the blue channel dominates.
    const [, r, g, b] = /#(..)(..)(..)/.exec(colorForCentury(1));
    expect(parseInt(b, 16)).toBeGreaterThan(parseInt(r, 16));
    expect(parseInt(b, 16)).toBeGreaterThan(parseInt(g, 16));
  });

  it('ends warm, so the ramp reads as a direction', () => {
    const [, r, , b] = /#(..)(..)(..)/.exec(colorForCentury(CENTURY_COLORS.length));
    expect(parseInt(r, 16)).toBeGreaterThan(parseInt(b, 16));
  });

  it('keeps giving a colour past the end of the ramp', () => {
    expect(colorForCentury(99)).toMatch(/^#[0-9a-f]{6}$/i);
    expect(colorForCentury(0)).toBe(CENTURY_COLORS[0]);
  });
});

describe('colorForLifespan', () => {
  it('gives a life inside one century a flat colour', () => {
    const fill = colorForLifespan(1225, 1274); // Aquinas, both 13th
    expect(fill.color).toBe(colorForCentury(13));
    expect(fill.gradient).toBeUndefined();
  });

  it('gives a life across a boundary a gradient between the two', () => {
    const fill = colorForLifespan(296, 373); // Athanasius, 3rd into 4th
    expect(fill.gradient).toEqual({
      from: colorForCentury(3),
      to: colorForCentury(4),
    });
    // `color` is still set: it is the fallback for anything that cannot paint
    // a gradient — the legend, search results, the mobile swimlane.
    expect(fill.color).toBe(colorForCentury(3));
  });

  it('spans more than two centuries from first to last, not stepwise', () => {
    const fill = colorForLifespan(150, 390);
    expect(fill.gradient).toEqual({ from: colorForCentury(2), to: colorForCentury(4) });
  });

  it('treats a missing death year as dying in the century of birth', () => {
    const fill = colorForLifespan(1100, null);
    expect(fill.gradient).toBeUndefined();
    expect(fill.color).toBe(colorForCentury(11));
  });
});

describe('legend ticks', () => {
  it('starts at the first century and ends at the last', () => {
    const ticks = centuryLegendTicks();
    expect(ticks[0]).toBe(1);
    expect(ticks[ticks.length - 1]).toBe(CENTURY_COLORS.length);
  });

  it('stays short enough to fit the strip', () => {
    expect(centuryLegendTicks().length).toBeLessThanOrEqual(7);
  });
});

describe('ordinal', () => {
  it('handles the regular cases', () => {
    expect(ordinal(1)).toBe('1st');
    expect(ordinal(2)).toBe('2nd');
    expect(ordinal(3)).toBe('3rd');
    expect(ordinal(4)).toBe('4th');
    expect(ordinal(16)).toBe('16th');
  });

  it('handles the teens, which break the rule', () => {
    expect(ordinal(11)).toBe('11th');
    expect(ordinal(12)).toBe('12th');
    expect(ordinal(13)).toBe('13th');
  });
});
