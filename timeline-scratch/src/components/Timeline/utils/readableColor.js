/**
 * Colour contrast helpers for text set on a coloured ground.
 *
 * Lifelines' detail frame carries a band in the entry's own colour with white
 * text on it. Some of those colours (the texts' gold, the greens of the
 * middle centuries) are too light for white text, so the band uses the same
 * hue, darkened just enough to reach the contrast WCAG asks of body text.
 */

function channels(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  return [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16));
}

function toHex(rgb) {
  return `#${rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}

function luminance(rgb) {
  const [r, g, b] = rgb.map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio of white text on `hex`. */
export function contrastWithWhite(hex) {
  return 1.05 / (luminance(channels(hex)) + 0.05);
}

/**
 * `hex`, or the least-darkened version of it that white text reads on at
 * `min` contrast (4.5:1 by default). Darkening keeps the hue, so the band
 * still matches its bar.
 */
export function readableOnWhite(hex, min = 4.5) {
  if (typeof hex !== 'string' || !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) return hex;
  const rgb = channels(hex);
  for (let k = 1; k >= 0; k -= 0.02) {
    const scaled = rgb.map(v => v * k);
    if (1.05 / (luminance(scaled) + 0.05) >= min) return k === 1 ? hex.toLowerCase() : toHex(scaled);
  }
  return '#000000';
}
