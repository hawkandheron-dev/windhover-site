import { describe, it, expect } from 'vitest';
import { sizedImageUrl, commonsFilePage } from '../../timeline-scratch/src/components/Tour/sizedImageUrl.js';

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

describe('commonsFilePage', () => {
  it('turns a Special:FilePath link into the file page', () => {
    expect(commonsFilePage('https://commons.wikimedia.org/wiki/Special:FilePath/Augustine_Lateran.jpg'))
      .toBe('https://commons.wikimedia.org/wiki/File:Augustine_Lateran.jpg');
  });

  it('keeps the file name as stored, encoded characters included', () => {
    expect(commonsFilePage('https://commons.wikimedia.org/wiki/Special:FilePath/Sacello_di_san_vittore_in_ciel_d%27oro.jpg?width=960'))
      .toBe('https://commons.wikimedia.org/wiki/File:Sacello_di_san_vittore_in_ciel_d%27oro.jpg');
  });

  it('returns null for anything that is not a Commons FilePath link', () => {
    expect(commonsFilePage('https://example.org/a.jpg')).toBeNull();
    expect(commonsFilePage('https://en.wikipedia.org/wiki/Polycarp')).toBeNull();
    expect(commonsFilePage('not a url')).toBeNull();
    expect(commonsFilePage(null)).toBeNull();
  });
});
