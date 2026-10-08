import { describe, it, expect } from 'vitest';
import { splitLinks } from '../../timeline-scratch/src/components/Tour/tourLinks.js';

describe('splitLinks (tour copy links)', () => {
  it('turns [words](https://…) into a link part', () => {
    expect(splitLinks('according to [Irenaeus](https://www.newadvent.org/fathers/0134.htm), writing later.')).toEqual([
      'according to ',
      { text: 'Irenaeus', href: 'https://www.newadvent.org/fathers/0134.htm' },
      ', writing later.',
    ]);
  });

  it('leaves a non-web address as written', () => {
    const text = 'see [this](javascript:alert(1)) here';
    expect(splitLinks(text)).toEqual([text]);
  });

  it('returns plain text whole, square brackets and all', () => {
    const text = 'No links: "Polycarp having thus received [them]".';
    expect(splitLinks(text)).toEqual([text]);
  });
});
