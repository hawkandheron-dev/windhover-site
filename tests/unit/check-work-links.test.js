import { describe, it, expect } from 'vitest';
import {
  norm, tokens, tokenEq, nameVariants, sim, bestSim, addressKind, sameAuthor, sourceSubject, newAdventCandidates2,
} from '../../scripts/check-work-links.mjs';

describe('work-link audit: matching names', () => {
  it('ignores case, accents, ordinals and filler words', () => {
    expect(norm('Æneid — Vita Nuova')).toBe('aeneid vita nuova');
    expect(tokens('First Epistle of Clement')).toEqual(['1', 'clement']);
  });

  it('treats spelling variants as the same word', () => {
    expect(tokenEq('proslogion', 'proslogium')).toBe(true);
    expect(tokenEq('antony', 'anthony')).toBe(true);
    expect(tokenEq('trinity', 'virtues')).toBe(false);
  });

  it('splits a name from its bracketed alternative', () => {
    expect(nameVariants('On the Mysteries (De Mysteriis)')).toEqual(['On the Mysteries', 'De Mysteriis']);
  });

  it('scores a work against a page title, in either of its names', () => {
    expect(bestSim('On the Holy Spirit (De Spiritu Sancto)', 'De Spiritu Sancto')).toBe(1);
    expect(bestSim('Orations Against the Arians', 'Four Discourses Against the Arians')).toBeGreaterThan(0.7);
    expect(sim('On Truth', 'Truth and Reconciliation')).toBeLessThan(0.8);
  });
});

describe('work-link audit: which author is whose', () => {
  it('matches one distinctive name, but not a bare common first name', () => {
    expect(sameAuthor('Ambrose of Milan', 'Ambrose (340-397)')).toBe(true);
    expect(sameAuthor('Gregory of Nyssa', 'Gregory Nazianzen')).toBe(false);
    expect(sameAuthor('John', 'John Chrysostom')).toBe(false);
    expect(sameAuthor('Pope Gregory the Great', 'Gregory the Great, Pope (c. 540-604)')).toBe(true);
    expect(sameAuthor('Basil the Great', 'Gregory the Great, Pope (c. 540-604)')).toBe(false);
  });
});

describe('work-link audit: what kind of address is it', () => {
  it('spots author pages and whole volumes, which are not the work', () => {
    expect(addressKind('https://ccel.org/ccel/anselm')).toBe('author');
    expect(addressKind('https://www.ccel.org/ccel/ambrose')).toBe('author');
    expect(addressKind('https://en.wikisource.org/wiki/Author:Alcuin')).toBe('author');
    expect(addressKind('https://ccel.org/ccel/schaff/anf-series/anf-series')).toBe('volume');
    expect(addressKind('https://ccel.org/ccel/schaff/anf02.html')).toBe('volume');
    expect(addressKind('https://www.newadvent.org/fathers/3401.htm')).toBe('unknown');
  });
});

describe('work-link audit: sources and catalogue', () => {
  it('reads what a source is about', () => {
    expect(sourceSubject('Athanasius – De Decretis (Defence of the Nicene Definition)')).toBe('De Decretis');
    expect(sourceSubject('Alcuin (adviser to Charlemagne)')).toBe('Alcuin');
  });

  it('finds a New Advent page for a work by the right author only', () => {
    const catalogue = [
      { name: 'Ambrose (340-397)', works: [{ title: 'On the Holy Spirit', url: 'https://www.newadvent.org/fathers/3402.htm' }] },
      { name: 'Basil the Great', works: [{ title: 'On the Holy Spirit', url: 'https://www.newadvent.org/fathers/3203.htm' }] },
    ];
    const hit = newAdventCandidates2({ name: 'Ambrose of Milan' }, { name: 'On the Holy Spirit (De Spiritu Sancto)' }, catalogue);
    expect(hit.map((h) => h.url)).toEqual(['https://www.newadvent.org/fathers/3402.htm']);
  });
});
