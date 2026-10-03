/**
 * Ask Wikimedia Commons for an image at display size instead of the original.
 *
 * Tour images are stored as `commons.wikimedia.org/wiki/Special:FilePath/<File>`
 * links, which redirect to the full-resolution upload — often several
 * megabytes and thousands of pixels wide, for a panel about 400px across. A
 * baseline JPEG that size paints top to bottom as it arrives. `?width=` makes
 * Commons serve a scaled thumbnail instead. Other URLs pass through unchanged.
 */
export function sizedImageUrl(url, width) {
  if (!url || !width) return url;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  const isFilePath = /(^|\.)wikimedia\.org$/.test(parsed.hostname)
    && /\/Special:FilePath\//i.test(parsed.pathname);
  if (!isFilePath || parsed.searchParams.has('width')) return url;
  parsed.searchParams.set('width', String(Math.round(width)));
  return parsed.toString();
}

/** Width to request for the tour panel: its widest layout, at 2x for sharp screens. */
export const TOUR_IMAGE_WIDTH = 960;
