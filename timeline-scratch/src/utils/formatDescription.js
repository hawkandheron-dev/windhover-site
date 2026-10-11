/**
 * Plain-text descriptions as HTML (config.descriptionText, Lifelines).
 *
 * Descriptions are typed or pasted into the database as plain text — often a
 * quotation, a prayer or a poem. HTML collapses their line breaks, so a
 * stanza ran together into one paragraph. This keeps the shape the author
 * gave it:
 *
 *   - a blank line starts a new paragraph;
 *   - a single line break stays a line break (verse keeps its lines); each
 *     line of such a paragraph is its own span, so CSS can give it a hanging
 *     indent and a line that wraps on a phone still reads as one line;
 *   - [words](https://…) becomes a link reading "words";
 *   - a bare https://… address becomes a link reading the address without
 *     "https://www.", so it's shorter but still says where it goes.
 *
 * Everything else is escaped, so stray < or & in a quotation show as typed.
 * Only http(s) addresses are linked. Links open in a new tab.
 */

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ESCAPES[c]);

// A markdown link, or a bare address. A bare address stops before trailing
// punctuation that ends a sentence or closes a bracket around it.
const LINK = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<]*[^\s<.,;:!?)\]'"])/g;

const anchor = (href, text) =>
  `<a class="modal-description-link" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`;

export function shortUrl(url) {
  return url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
}

function formatLine(line) {
  let out = '';
  let last = 0;
  for (const m of line.matchAll(LINK)) {
    out += escapeHtml(line.slice(last, m.index));
    out += m[3] ? anchor(m[3], shortUrl(m[3])) : anchor(m[2], m[1]);
    last = m.index + m[0].length;
  }
  return out + escapeHtml(line.slice(last));
}

export function formatDescriptionHtml(text) {
  if (typeof text !== 'string' || !text.trim()) return '';
  return text
    .replace(/\r\n?/g, '\n')
    .trim()
    .split(/\n[ \t]*\n+/)
    .map((para) => {
      const lines = para.split('\n').map((l) => formatLine(l.trim()));
      return lines.length === 1
        ? `<p>${lines[0]}</p>`
        : `<p class="modal-description-verse">${lines.map((l) => `<span>${l}</span>`).join('')}</p>`;
    })
    .join('');
}
