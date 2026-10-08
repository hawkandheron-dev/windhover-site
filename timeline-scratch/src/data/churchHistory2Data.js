/**
 * Presentation config for CH Timeline 2.0.
 *
 * Same shape as churchHistoryConfig in churchHistoryData.js, plus three blocks
 * the 1.0 timeline has no use for:
 *
 *   palette — canvas colours, so the shared renderer can draw on white instead
 *             of parchment without the other five apps changing
 *   depth   — how far "back" the background layer sits, and how it comes forward
 *
 * Data comes from churchHistory2Adapter.js; the bars' century colours come
 * from churchHistory2Centuries.js. The legend no longer explains them: it is
 * a slim panel of the four things a reader can switch (legendLayout below).
 */
import { CENTURY_COLORS, centuryOf, colorForCentury } from './churchHistory2Centuries.js';
import { readableOnWhite } from '../components/Timeline/utils/readableColor.js';

/**
 * Back-layer colours. The background is reigns only now — heresiarchs are
 * hidden, contested figures came forward as ordinary figures, movements are
 * deactivated, and councils and texts were promoted to foreground pins.
 */
export const BACK_STYLES = {
  emperors: { color: '#6d4c41', label: 'Emperors & monarchs' },
};

/**
 * Reigns are coloured by realm (owner, 2026-10-08): the unified Roman Empire
 * in maroon, the Eastern (Byzantine) emperors in purple, the Western in rust,
 * and every later kingdom in slate. All four take white text at 6:1 or more,
 * so the detail band can sit on them unaltered. The band names the realm,
 * which is where a reader learns what the colour means.
 */
export const REALM_STYLES = {
  'roman-unified': { color: '#7a1f2b', label: 'Roman Empire' },
  'roman-eastern': { color: '#5b3a86', label: 'Eastern Roman Empire' },
  'roman-western': { color: '#9a4a1e', label: 'Western Roman Empire' },
  frankish: { color: '#4a5a6a', label: 'Franks' },
  hre:      { color: '#4a5a6a', label: 'Holy Roman Empire' },
  english:  { color: '#4a5a6a', label: 'England' },
  spanish:  { color: '#4a5a6a', label: 'Spain' },
  french:   { color: '#4a5a6a', label: 'France' },
  russian:  { color: '#4a5a6a', label: 'Russia' },
};

const POINT_TYPE_LABELS = { councils: 'Council', documents: 'Text', events: 'Event' };

/**
 * The band across the top of a detail dialog: what kind of entry this is, in
 * the colour of its bar or mark (owner, 2026-10-08). White text, so the colour
 * is darkened where it is too light for that (the texts' gold, the middle
 * centuries' greens). Returns null for anything it does not know.
 */
export function detailTypeBand(item, itemType) {
  if (!item) return null;
  if (itemType === 'person' && item.isMonarch) {
    const realm = REALM_STYLES[item.monarchType];
    return {
      label: BACK_STYLES.emperors.label,
      detail: realm?.label || null,
      color: readableOnWhite(realm?.color || BACK_STYLES.emperors.color),
    };
  }
  if (itemType === 'person') return { label: 'Church figure', color: readableOnWhite(item.color) };
  if (itemType === 'point' && POINT_TYPE_LABELS[item.itemType]) {
    return { label: POINT_TYPE_LABELS[item.itemType], color: readableOnWhite(item.color) };
  }
  if (itemType === 'year') return { label: 'Year', color: readableOnWhite(colorForCentury(centuryOf(item.year))) };
  return null;
}

/** Foreground point styling, drawn as 1.0's pin-and-flag callouts. */
export const POINT_STYLES = {
  councils:  { color: '#3f7d46', label: 'Councils' },
  documents: { color: '#9a7b1f', label: 'Texts & creeds' },
  events:    { color: '#b2622c', label: 'Events' },
};

export const churchHistory2Config = {
  siteTitle: 'Lifelines',
  siteSubtitle: 'A church history timeline by lifespans',
  initialViewport: {
    startDate: '0001-01-01',
    endDate: '0500-12-31',
  },
  // Open on the early church: the window above, centred on its middle, framed
  // against the canvas's real width rather than the first-render placeholder.
  // Without these the shared defaults centre on AD 1000.
  initialCenterYear: 250,
  fitInitialViewport: true,
  /** Nothing before 100 BC: the earliest figures are a generation either
   *  side of Jesus, and panning further only showed empty canvas (round 6). */
  minYear: -100,
  /** Overrides on a phone (mobileLayout: 'horizontal'). 500 years in 390px
   *  leaves every name a stub, so a phone opens on the apostolic age. */
  phone: {
    initialViewport: { startDate: '0001-01-01', endDate: '0160-12-31' },
    initialCenterYear: 80,
  },
  // The zoom readout names the years on screen ("300–700 AD"), not a ratio.
  zoomReadout: 'years',
  eraLabels: 'BC/AD',
  maxTimeSpan: 2000,
  laneOrder: ['people', 'points', 'periods'],

  /** Detail panel: one "Works & Sources" section rather than two. */
  mergeWorksAndSources: true,
  /** Detail panel: description first, a smaller map after it, sentence-case
   *  headings (DESIGN.md §6). */
  panelLayout: 'compact',
  /** Landmarks as harp strings: a line through the timeline at each year,
   *  with a dot on a linked figure or in open space (owner's pick, M3). */
  pointStyle: 'string',
  /** Rows of string labels on each side of the axis, so every event,
   *  council and text can carry its title, not only one in each crowded
   *  stretch (owner, 2026-10-08). Texts are the densest and below the axis
   *  there is room, so they get more. Each band keeps its height at every
   *  zoom, so the figures don't jump as rows fill. */
  pointLabelRows: { above: 3, below: 5 },
  /** Draw the canvas at the screen's pixel density, so names and lines are
   *  sharp on Retina screens (M4). */
  hiDpiCanvas: true,
  /** Under a Wikipedia excerpt, the licence it is shared under (CC BY-SA
   *  4.0), as that licence asks (M7). */
  wikiLicenceNote: true,
  /** A plain "Map © OpenHistoricalMap contributors (ODbL)" line under every
   *  map, readable at any size (M7). */
  mapCreditLine: true,
  /** Drag to pan and pinch to zoom on touch screens (iPads get this desktop
   *  timeline). */
  touchGestures: true,
  /** On a phone, a figure a tour step opens shows as a short card above the
   *  tour sheet: no map or pictures, the rest one tap away (round 6c). */
  tourDetailOnPhone: 'brief',
  /** Opening the panel moves focus to its title; closing returns it
   *  (DESIGN.md §8). */
  manageFocus: true,

  /**
   * Above this zoom-out level a landmark drops its flag and shows only its
   * pin. One year per pixel is roughly where sixty labelled cards stop fitting
   * between the people lane and the axis; past it they cascade.
   */
  pointLabelMaxYearsPerPixel: 1.0,

  /**
   * Name labels may run into empty space but never into the next bar of their
   * row: dates drop first, then the name ends in an ellipsis (DESIGN.md §7).
   */
  labelFit: 'fit',

  /**
   * Canvas colours for a white ground. Passed through Timeline → TimelineCanvas
   * → rendering.js; every draw function defaults to the parchment values when
   * this is absent, which is how the 1.0 pages stay pixel-identical.
   */
  palette: {
    ground: '#ffffff',
    axis: '#c9c4bc',
    axisText: '#5a5a55',
    guide: 'rgba(30, 28, 24, 0.07)',
    // The 1.0 pages label figures in white on near-black, which reads as a
    // wall of dark blocks once the parchment is gone. On white the bar's own
    // colour should carry, so the label backs off to a light scrim.
    labelText: '#1e1c18',
    labelBg: 'rgba(255, 255, 255, 0.86)',
  },

  /**
   * The background layer's resting state, and what "in focus" means.
   * `scale` is applied about the shared axis, never on X — the back layer has
   * to stay time-true or a reign lands under the wrong year the moment it
   * sharpens. That same scale is the vertical foreshortening; there is no
   * separate pan multiplier, which would unregister the two axes.
   */
  /** The rulers live in a strip pinned to the foot of the timeline, not in a
   *  band below the axis (owner's pick, M3 round 6: "exactly what we need"). */
  rulerStyle: 'strip',
  /** The strip's fold tab, and where this device remembers it (2026-10-08). */
  rulerFoldKey: 'lifelines-rulers-folded',
  /** A figure's detail dialog grows out of their bar, edged in their colour,
   *  so a reader sees where it came from (owner, 2026-10-08, after the tour's
   *  first dialog, Irenaeus, appeared from nowhere). Not the docked panel. */
  detailGrowFromBar: true,
  rulerColor: BACK_STYLES.emperors.color,
  /** Each reign in the strip and the phone column takes its realm's colour
   *  (REALM_STYLES, set on the item by the adapter), not rulerColor. */
  rulerColorByRealm: true,
  /** Detail dialogs are framed in the entry's colour, with a band naming the
   *  kind of entry; the band replaces the "Era:" line (owner, 2026-10-08). */
  detailTypeBand,
  /** The line under the pointer takes the colour of the century it marks and
   *  is 3px wide (owner, 2026-10-08), so it reads as a year to click. */
  cursorLine: { width: 3, color: (year) => colorForCentury(centuryOf(year)) },

  /**
   * The legend (DESIGN.md §6): Lifelines' name at the top, the four switches,
   * and Windhover signing off at the foot. No colour key. It collapses to a
   * "Key" button while the detail panel is open or the timeline is narrow.
   */
  legendLayout: 'slim',
  legendCollapsible: true,
  publisherStrapline: "Get a bird's eye view",

  legend: [
    { type: 'people', id: 'people', name: 'Church figures', color: CENTURY_COLORS[3], filterKey: 'people' },

    { type: 'point', id: 'councils',  name: POINT_STYLES.councils.label,  color: POINT_STYLES.councils.color,  shape: 'cross', mark: 'diamond', filterKey: 'councils' },
    // The major events, back since M3 round 5; a dot, like their strings.
    { type: 'point', id: 'events',    name: POINT_STYLES.events.label,    color: POINT_STYLES.events.color,    shape: 'reference', mark: 'dot', filterKey: 'events' },
    { type: 'point', id: 'documents', name: POINT_STYLES.documents.label, color: POINT_STYLES.documents.color, shape: 'book',  mark: 'square',  filterKey: 'documents' },

    { type: 'people', id: 'back-emperors', name: BACK_STYLES.emperors.label, color: REALM_STYLES['roman-unified'].color, filterKey: 'emperors', isMonarch: true },
  ],
};
