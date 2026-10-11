import { describe, it, expect } from 'vitest';
import { formatDescriptionHtml, shortUrl } from '../../timeline-scratch/src/utils/formatDescription.js';

describe('formatDescriptionHtml (plain-text descriptions)', () => {
  it('keeps a poem\'s lines and stanzas', () => {
    const poem = '"Christ, protect me today\nAgainst every poison,\n\nChrist with me,\nChrist before me."';
    expect(formatDescriptionHtml(poem)).toBe(
      '<p class="modal-description-verse"><span>&quot;Christ, protect me today</span><span>Against every poison,</span></p>'
      + '<p class="modal-description-verse"><span>Christ with me,</span><span>Christ before me.&quot;</span></p>',
    );
  });

  it('treats blank lines with spaces, and Windows line ends, the same', () => {
    expect(formatDescriptionHtml('One \r\n \r\nTwo')).toBe('<p>One</p><p>Two</p>');
  });

  it('links a bare address, without trailing punctuation', () => {
    const html = formatDescriptionHtml('Written by Athanasius: https://www.newadvent.org/fathers/2811.htm.');
    expect(html).toBe(
      '<p>Written by Athanasius: <a class="modal-description-link" href="https://www.newadvent.org/fathers/2811.htm"'
      + ' target="_blank" rel="noopener noreferrer">newadvent.org/fathers/2811.htm</a>.</p>',
    );
  });

  it('links [words](address) as the words', () => {
    expect(formatDescriptionHtml('See [the Life](https://example.org/life) here'))
      .toContain('>the Life</a> here');
  });

  it('escapes markup and never links other schemes', () => {
    const html = formatDescriptionHtml('a < b & [x](javascript:alert(1)) <script>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('href="javascript');
    expect(html).toContain('a &lt; b &amp;');
  });

  it('shortUrl drops the scheme, www and a trailing slash', () => {
    expect(shortUrl('https://www.example.org/a/')).toBe('example.org/a');
  });
});
