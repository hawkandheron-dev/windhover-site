/**
 * CH Timeline 2.0 derives a person's era from their dates rather than reading
 * CH_People.era_id, which is what let the scheme change without a migration.
 * These pin the boundaries, since getting one wrong silently recolours a slab
 * of the timeline rather than throwing.
 */
import { describe, it, expect } from 'vitest';
import { CH2_ERAS, eraForYear, eraById } from '../../timeline-scratch/src/data/churchHistory2Eras.js';

describe('CH2_ERAS', () => {
  it('is contiguous — each era starts where the previous one ends', () => {
    for (let i = 1; i < CH2_ERAS.length; i++) {
      expect(CH2_ERAS[i].start).toBe(CH2_ERAS[i - 1].end);
    }
  });

  it('is open-ended, so future additions land somewhere', () => {
    expect(CH2_ERAS[CH2_ERAS.length - 1].end).toBeNull();
  });

  it('has a unique id and colour per era', () => {
    expect(new Set(CH2_ERAS.map(e => e.id)).size).toBe(CH2_ERAS.length);
    expect(new Set(CH2_ERAS.map(e => e.color)).size).toBe(CH2_ERAS.length);
  });
});

describe('eraForYear', () => {
  it('places a year in the era whose range contains it', () => {
    const cases = [
      [1, 'era-apostolic'],
      [99, 'era-apostolic'],
      [100, 'era-ante-nicene'],      // boundary belongs to the later era
      [296, 'era-ante-nicene'],      // Athanasius
      [325, 'era-first-councils'],
      [450, 'era-first-councils'],
      [451, 'era-early-medieval'],
      [999, 'era-early-medieval'],
      [1000, 'era-high-medieval'],
      [1225, 'era-high-medieval'],   // Aquinas
      [1299, 'era-high-medieval'],
      [1300, 'era-late-medieval'],
      [1483, 'era-late-medieval'],   // Luther, born before the cut
      [1500, 'era-renaissance'],
      [1649, 'era-renaissance'],
      [1650, 'era-enlightenment'],
      [1703, 'era-enlightenment'],   // Wesley
      [1799, 'era-enlightenment'],
      [1800, 'era-modern'],
      [2026, 'era-modern'],
    ];
    for (const [year, expected] of cases) {
      expect(eraForYear(year).id, `year ${year}`).toBe(expected);
    }
  });

  it('puts BC births in the first era rather than off the end of the list', () => {
    // Augustus is in CH_People with birth_year -63; he is a background figure,
    // but the lookup still has to return something rather than undefined.
    expect(eraForYear(-63).id).toBe('era-apostolic');
    expect(eraForYear(0).id).toBe('era-apostolic');
  });

  it('never returns null, even for a person with no dates', () => {
    for (const year of [null, undefined, NaN]) {
      expect(eraForYear(year)).toBeTruthy();
      expect(eraForYear(year).color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe('eraById', () => {
  it('round-trips every era', () => {
    for (const era of CH2_ERAS) {
      expect(eraById(era.id)).toBe(era);
    }
  });

  it('returns null for the 1.0 era ids it replaced', () => {
    expect(eraById('era-monks-missionaries')).toBeNull();
    expect(eraById('era-cluniac-reforms')).toBeNull();
  });
});
