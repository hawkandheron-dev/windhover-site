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

/**
 * The Commons page for an image stored as a `Special:FilePath/<File>` link:
 * `commons.wikimedia.org/wiki/File:<File>`, where its author and licence are
 * recorded. The tour's `source_page_url` often points at an article or a
 * category instead, so the credit links here and falls back to it only for
 * images that aren't on Commons.
 */
export function commonsFilePage(url) {
  if (!url) return null;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!/(^|\.)wikimedia\.org$/.test(parsed.hostname)) return null;
  const match = parsed.pathname.match(/\/Special:FilePath\/(.+)$/i);
  if (!match) return null;
  return `https://commons.wikimedia.org/wiki/File:${match[1]}`;
}
