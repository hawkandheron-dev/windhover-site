/**
 * Tour copy with links (TourPanel's `textLinks`, opt-in): a markdown-style
 * [words](https://…) in a scene's text becomes a link. Only http(s)
 * addresses are linked; anything else stays as written.
 *
 * Returns the text as parts: strings, and { text, href } for each link.
 */
const LINK = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

export function splitLinks(text) {
  if (typeof text !== 'string' || !text.includes('](')) return [text];
  const parts = [];
  let last = 0;
  for (const m of text.matchAll(LINK)) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push({ text: m[1], href: m[2] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
