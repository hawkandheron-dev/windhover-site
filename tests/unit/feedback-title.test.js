/**
 * Public feedback gives the reader one box, but App_Issues.title is NOT NULL
 * and the insert policy bounds it to 120 characters. So the title is derived,
 * and it has to be derived safely: a value that fails the bound is not a
 * cosmetic problem, it is a submission the reader loses.
 */
import { describe, it, expect } from 'vitest';
import { deriveTitle, FEEDBACK_MAX_LENGTH } from '../../timeline-scratch/src/services/feedbackService.js';

const LIMIT = 120;

describe('deriveTitle', () => {
  it('uses a short note whole', () => {
    expect(deriveTitle('Aquinas is in the wrong century')).toBe('Aquinas is in the wrong century');
  });

  it('takes the first line when there are several', () => {
    expect(deriveTitle('Wrong dates for Alcuin\n\nAlso: lovely tour, thank you'))
      .toBe('Wrong dates for Alcuin');
  });

  it('trims surrounding whitespace', () => {
    expect(deriveTitle('   padded   \n more')).toBe('padded');
  });

  it('never exceeds the policy bound, however long the first line', () => {
    const long = 'word '.repeat(200);
    expect(deriveTitle(long).length).toBeLessThanOrEqual(LIMIT);
  });

  it('breaks on a word boundary and marks the clip', () => {
    const title = deriveTitle(`${'alpha '.repeat(40)}omega`);
    expect(title.length).toBeLessThanOrEqual(LIMIT);
    expect(title.endsWith('…')).toBe(true);
    // A clean break, not a severed word.
    expect(title).not.toMatch(/\balph…$/);
  });

  it('still clips when the first line has no spaces at all', () => {
    // A pasted URL or a wall of characters has no word boundary to break on.
    const title = deriveTitle('x'.repeat(400));
    expect(title.length).toBeLessThanOrEqual(LIMIT);
  });

  it('exposes a max length matching the policy bound', () => {
    expect(FEEDBACK_MAX_LENGTH).toBe(4000);
  });
});
