/**
 * Date utility functions for timeline
 * Handles ISO 8601 dates with BCE/CE (BC/AD) support
 */

/**
 * Parse ISO 8601 date string
 * Negative years represent BCE (year 0 = 1 BCE, year -1 = 2 BCE)
 * @param {string} dateString - ISO 8601 date string (e.g., "-0099-07-12", "0476-01-01")
 * @returns {Date} JavaScript Date object
 */
export function parseISODate(dateString) {
  if (!dateString) return null;

  const match = dateString.match(/^(-?\d{1,4})(?:-(\d{2}))?(?:-(\d{2}))?/);
  if (!match) return null;

  let year = parseInt(match[1], 10);
  const month = match[2] ? parseInt(match[2], 10) - 1 : 0; // JS months are 0-indexed
  const day = match[3] ? parseInt(match[3], 10) : 1;

  // Handle PostgreSQL BC suffix
  if (year > 0 && /\bBC\b/i.test(dateString)) {
    year = -year;
  }

  // JavaScript Date doesn't handle negative years well, so we'll use year 0 as 1 BCE
  // and work around this in our coordinate system
  return new Date(year, month, day);
}

/**
 * Get year from ISO date string
 * Handles both ISO format (-0042-01-01) and PostgreSQL BC format (0042-01-01 BC)
 * @param {string} dateString - ISO 8601 date string
 * @returns {number} Year (negative for BCE)
 */
export function getYear(dateString) {
  if (!dateString) return null;

  const match = dateString.match(/^(-?\d{1,4})/);
  if (!match) return null;

  let year = parseInt(match[1], 10);

  // Handle PostgreSQL BC suffix: "0042-01-01 BC" → -42
  if (year > 0 && /\bBC\b/i.test(dateString)) {
    year = -year;
  }

  return year;
}

/**
 * Format a signed year for display. The one place a year becomes text.
 *
 * Years are historical, not astronomical: -63 is 63 BC, as the CH_ tables store
 * it (birth_year -63 for Augustus) and as getYear reads a Postgres "0063 BC".
 * There is no year zero in that reckoning; 0 only occurs as a position on the
 * axis, between 1 BC and AD 1, and is labelled 1 BC.
 *
 * Five call sites used to do this inline, with `Math.abs(year - 1) + 1` — an
 * astronomical correction applied to historical years, and off by one even for
 * that — so the detail panel gave Augustus a birth in 65 BC.
 *
 * @param {number} year
 * @param {string} [eraLabels] "BC/AD" or "BCE/CE"
 * @param {object} [opts]
 * @param {boolean} [opts.showAD=true] false prints AD years bare ("325"), for
 *   labels where BC is the exception worth marking
 * @returns {string} e.g. "63 BC", "325 AD", "325"
 */
export function formatYear(year, eraLabels = 'BC/AD', { showAD = true } = {}) {
  if (year === null || year === undefined || Number.isNaN(year)) return '';
  const [bcLabel, adLabel] = eraLabels === 'BCE/CE' ? ['BCE', 'CE'] : ['BC', 'AD'];
  const y = Math.round(year);
  if (y <= 0) return `${Math.max(1, -y)} ${bcLabel}`;
  return showAD ? `${y} ${adLabel}` : `${y}`;
}

/**
 * A span of years as a reader would write it: "300–700 AD", "50 BC – 200 AD".
 * The era is printed once when both ends share it.
 *
 * @param {number} start
 * @param {number} end
 * @param {string} [eraLabels]
 * @returns {string}
 */
export function formatYearSpan(start, end, eraLabels = 'BC/AD') {
  const a = Math.round(start);
  const b = Math.round(end);
  if (a <= 0 && b <= 0) return `${formatYear(a, eraLabels).split(' ')[0]}–${formatYear(b, eraLabels)}`;
  if (a > 0 && b > 0) return `${a}–${formatYear(b, eraLabels)}`;
  return `${formatYear(a, eraLabels)} – ${formatYear(b, eraLabels)}`;
}

/**
 * Format date for display
 * @param {string} dateString - ISO 8601 date string
 * @param {string} dateCertainty - "complete date", "year only", or "circa"
 * @param {string} eraLabels - "BC/AD" or "BCE/CE"
 * @returns {string} Formatted date string
 */
export function formatDate(dateString, dateCertainty = 'year only', eraLabels = 'BC/AD') {
  if (!dateString) return '';

  const match = dateString.match(/^(-?\d{1,4})(?:-(\d{2}))?(?:-(\d{2}))?/);
  if (!match) return '';

  let year = parseInt(match[1], 10);
  // Handle PostgreSQL BC suffix
  if (year > 0 && /\bBC\b/i.test(dateString)) {
    year = -year;
  }
  const month = match[2] ? parseInt(match[2], 10) : null;
  const day = match[3] ? parseInt(match[3], 10) : null;

  const yearText = formatYear(year, eraLabels);

  // Add circa prefix if needed
  const circaPrefix = dateCertainty === 'circa' ? 'c. ' : '';

  // Year only
  if (dateCertainty === 'year only' || dateCertainty === 'circa' || !month) {
    return `${circaPrefix}${yearText}`;
  }

  // Month names
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  const monthName = monthNames[month - 1];

  // Month and year
  if (!day) {
    return `${monthName} ${yearText}`;
  }

  // Full date
  return `${monthName} ${day}, ${yearText}`;
}

/**
 * Format date range for display
 * @param {string} startDate - ISO 8601 start date
 * @param {string} endDate - ISO 8601 end date
 * @param {string} startCertainty - Date certainty for start
 * @param {string} endCertainty - Date certainty for end
 * @param {string} eraLabels - "BC/AD" or "BCE/CE"
 * @returns {string} Formatted date range
 */
export function formatDateRange(startDate, endDate, startCertainty = 'year only', endCertainty = 'year only', eraLabels = 'BC/AD') {
  if (!startDate) return '';

  const start = formatDate(startDate, startCertainty, eraLabels);

  if (!endDate) return start;

  const end = formatDate(endDate, endCertainty, eraLabels);

  return `${start} – ${end}`;
}

/**
 * Get year range from date strings
 * @param {string} startDate - ISO 8601 start date
 * @param {string} endDate - ISO 8601 end date (optional)
 * @returns {{start: number, end: number}} Year range
 */
export function getYearRange(startDate, endDate) {
  const start = getYear(startDate);
  const end = endDate ? getYear(endDate) : start;

  return { start, end };
}

/**
 * Check if two date ranges overlap
 * @param {number} start1 - First range start year
 * @param {number} end1 - First range end year
 * @param {number} start2 - Second range start year
 * @param {number} end2 - Second range end year
 * @returns {boolean} True if ranges overlap
 */
export function rangesOverlap(start1, end1, start2, end2) {
  return start1 <= end2 && start2 <= end1;
}
