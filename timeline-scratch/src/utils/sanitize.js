import DOMPurify from 'dompurify';

const SVG_ATTRS = ['viewBox', 'fill', 'stroke', 'stroke-width', 'd', 'cx', 'cy', 'r', 'x', 'y', 'width', 'height', 'transform', 'points', 'xmlns', 'clip-path'];

/**
 * Sanitize HTML, allowing SVG elements for icon rendering.
 *
 * `allowTarget` (opt-in) keeps target="_blank" on links, so a link opens in a
 * new tab rather than taking the reader away; DOMPurify drops it by default.
 */
export function sanitizeHtml(html, { allowTarget = false } = {}) {
  return DOMPurify.sanitize(html, {
    ADD_TAGS: ['svg', 'path', 'g', 'circle', 'rect', 'line', 'polyline', 'polygon', 'text', 'use', 'defs', 'clipPath'],
    ADD_ATTR: allowTarget ? [...SVG_ATTRS, 'target'] : SVG_ATTRS,
  });
}
