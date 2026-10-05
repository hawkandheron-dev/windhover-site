import { describe, it, expect } from 'vitest';
import { sizedImageUrl } from '../../timeline-scratch/src/components/Tour/sizedImageUrl.js';

describe('sizedImageUrl', () => {
  it('asks Commons for a thumbnail of a Special:FilePath link', () => {
    expect(sizedImageUrl('https://commons.wikimedia.org/wiki/Special:FilePath/Augustine_Lateran.jpg', 960))
      .toBe('https://commons.wikimedia.org/wiki/Special:FilePath/Augustine_Lateran.jpg?width=960');
  });

  it('keeps a width that is already there', () => {
    const url = 'https://commons.wikimedia.org/wiki/Special:FilePath/X.jpg?width=300';
    expect(sizedImageUrl(url, 960)).toBe(url);
  });

  it('leaves other hosts and paths alone', () => {
    expect(sizedImageUrl('https://example.org/a.jpg', 960)).toBe('https://example.org/a.jpg');
    expect(sizedImageUrl('https://upload.wikimedia.org/wikipedia/commons/a/ab/X.jpg', 960))
      .toBe('https://upload.wikimedia.org/wikipedia/commons/a/ab/X.jpg');
  });

  it('passes through empty and malformed input', () => {
    expect(sizedImageUrl('', 960)).toBe('');
    expect(sizedImageUrl(null, 960)).toBe(null);
    expect(sizedImageUrl('not a url', 960)).toBe('not a url');
  });
});
