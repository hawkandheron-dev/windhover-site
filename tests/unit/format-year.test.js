/**
 * BC years are stored historically: Augustus is born -63 and reigns from -27,
 * and getYear reads a Postgres "0063-01-01 BC" the same way. Every display
 * path used to apply `Math.abs(year - 1) + 1`, an astronomical correction (and
 * off by one even for that), so the detail panel said Augustus was born in
 * 65 BC. These pin the real figures that were wrong, through the same entry
 * points the panel, axis and labels use.
 */
import { describe, it, expect } from 'vitest';
import {
  formatYear,
  formatYearSpan,
  formatDate,
  formatDateRange,
} from '../../timeline-scratch/src/components/Timeline/utils/dateUtils.js';

describe('formatYear', () => {
  it('prints a stored BC year as itself', () => {
    expect(formatYear(-63)).toBe('63 BC');
    expect(formatYear(-27)).toBe('27 BC');
    expect(formatYear(-1)).toBe('1 BC');
  });

  it('prints AD years with or without the era', () => {
    expect(formatYear(325)).toBe('325 AD');
    expect(formatYear(325, 'BC/AD', { showAD: false })).toBe('325');
    // BC is always marked, even when AD is bare.
    expect(formatYear(-63, 'BC/AD', { showAD: false })).toBe('63 BC');
  });

  it('labels the axis position 0 as 1 BC, there being no year zero', () => {
    expect(formatYear(0)).toBe('1 BC');
  });

  it('honours BCE/CE', () => {
    expect(formatYear(-63, 'BCE/CE')).toBe('63 BCE');
    expect(formatYear(325, 'BCE/CE')).toBe('325 CE');
  });

  it('returns empty for a missing year rather than "NaN BC"', () => {
    expect(formatYear(null)).toBe('');
    expect(formatYear(undefined)).toBe('');
    expect(formatYear(NaN)).toBe('');
  });
});

describe('formatYearSpan', () => {
  it('prints the era once when both ends share it', () => {
    expect(formatYearSpan(300, 700)).toBe('300–700 AD');
    expect(formatYearSpan(-300, -100)).toBe('300–100 BC');
  });

  it('marks both ends when the span crosses the turn', () => {
    expect(formatYearSpan(-50, 200)).toBe('50 BC – 200 AD');
  });
});

describe('formatDate on the stored strings the panel receives', () => {
  it('gives Augustus the dates he actually has', () => {
    expect(formatDate('0063-01-01 BC')).toBe('63 BC');
    expect(formatDate('0027-01-01 BC')).toBe('27 BC');
  });

  it('formats a range that crosses the turn (Claudius)', () => {
    expect(formatDateRange('0010-01-01 BC', '0054-01-01')).toBe('10 BC – 54 AD');
  });

  it('keeps month and day forms working', () => {
    expect(formatDate('0325-06-19', 'complete date')).toBe('Jun 19, 325 AD');
  });
});
