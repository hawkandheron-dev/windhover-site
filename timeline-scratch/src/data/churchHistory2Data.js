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
import { CENTURY_COLORS } from './churchHistory2Centuries.js';

/**
 * Back-layer colours. The background is reigns only now — heresiarchs are
 * hidden, contested figures came forward as ordinary figures, movements are
 * deactivated, and councils and texts were promoted to foreground pins.
 */
export const BACK_STYLES = {
  emperors: { color: '#6d4c41', label: 'Emperors & monarchs' },
};

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
  /** Drag to pan and pinch to zoom on touch screens (iPads get this desktop
   *  timeline). */
  touchGestures: true,
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
  depth: {
    blur: 2.6,
    opacity: 0.46,
    saturate: 0.55,
    scale: 0.965,
    // Partial lift on hover, full lift on click or Alt-hold.
    hoverBlur: 1.1,
    hoverOpacity: 0.8,
    transitionMs: 220,
  },

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

    // No row for plain events: they are all deactivated, and a checkbox that
    // filters nothing is clutter. Restore this line if they come back.
    { type: 'point', id: 'councils',  name: POINT_STYLES.councils.label,  color: POINT_STYLES.councils.color,  shape: 'cross',     filterKey: 'councils' },
    { type: 'point', id: 'documents', name: POINT_STYLES.documents.label, color: POINT_STYLES.documents.color, shape: 'book',      filterKey: 'documents' },

    { type: 'people', id: 'back-emperors', name: BACK_STYLES.emperors.label, color: BACK_STYLES.emperors.color, filterKey: 'emperors', isMonarch: true },
  ],
};
