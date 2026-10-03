/**
 * The background layer of CH Timeline 2.0.
 *
 * Emperors, heresiarchs, contested figures, movements and every event live
 * here rather than among the main figures. At rest the whole layer is a
 * watercolour wash — blurred, desaturated, unlabelled — which is what lets the
 * merged dataset sit on one screen without the density doubling.
 *
 * It comes into focus two ways, and they compose:
 *
 *   focusIds  — the background belonging to one person, drawn crisp on a
 *               second canvas above the wash
 *   depthMode — 'hidden' | 'watercolour' | 'forward', a global lift
 *
 * Two canvases rather than one because the crisp subset has to sit *above* the
 * blur: a CSS filter applies to a whole element, so there is no way to exempt
 * part of one canvas from it. The second canvas is cheap — it draws only the
 * dozen or so items in the focus set.
 */

import { TimelineCanvas } from './TimelineCanvas.jsx';
import { MonarchLabels } from './MonarchLabels.jsx';

const DEFAULT_DEPTH = {
  blur: 2.6,
  opacity: 0.46,
  saturate: 0.55,
  scale: 0.965,
  hoverBlur: 1.1,
  hoverOpacity: 0.8,
  transitionMs: 220,
};

export function DepthLayers({
  width,
  height,
  viewportStartYear,
  yearsPerPixel,
  panOffsetY,
  /** Layout built from the background data. */
  layout,
  /** The foreground layout, so both can share one axis. */
  frontAxisY,
  config,
  /** Set of background ids to draw crisp, or null. */
  focusIds = null,
  /** 'hidden' | 'watercolour' | 'forward' */
  depthMode = 'watercolour',
  /** True while the focus comes from a hover rather than a click. */
  isPreview = false,
  /** False when zoomed too far out for names to be readable. */
  showLabels = true,
}) {
  const depth = { ...DEFAULT_DEPTH, ...(config?.depth || {}) };

  if (depthMode === 'hidden') return null;

  // Register the two layouts against a single axis. Each is stacked
  // independently — the background has its own row count — so their axes land
  // at different Y positions and the background needs shifting onto the
  // foreground's.
  const yOffset = (frontAxisY ?? layout.axisY) - layout.axisY;

  // The layer is scaled about the shared axis, so a bar's distance from the
  // axis shrinks but its position on it does not. transform-origin can't
  // express "the axis" directly, so it is given in pixels.
  const axisScreenY = (frontAxisY ?? layout.axisY) - panOffsetY;

  const forward = depthMode === 'forward';
  const blur = forward ? 0 : (isPreview ? depth.hoverBlur : depth.blur);
  const opacity = forward ? 1 : (isPreview ? depth.hoverOpacity : depth.opacity);
  const saturate = forward ? 1 : depth.saturate;
  const scale = forward ? 1 : depth.scale;

  const washStyle = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    filter: `blur(${blur}px) saturate(${saturate})`,
    opacity,
    transform: `scale(${scale})`,
    transformOrigin: `50% ${axisScreenY}px`,
    transition: `filter ${depth.transitionMs}ms ease-out, opacity ${depth.transitionMs}ms ease-out, transform ${depth.transitionMs}ms ease-out`,
    willChange: 'filter, opacity, transform',
  };

  // Same geometry as the wash, so a name sits on its bar; no blur, and it
  // keeps pointer events so the hover expansion works.
  const labelStyle = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    transform: `scale(${scale})`,
    transformOrigin: `50% ${axisScreenY}px`,
    opacity: forward ? 1 : 0.9,
    transition: `opacity ${depth.transitionMs}ms ease-out, transform ${depth.transitionMs}ms ease-out`,
  };

  const focusStyle = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    transform: `scale(${scale})`,
    transformOrigin: `50% ${axisScreenY}px`,
    transition: `opacity ${depth.transitionMs}ms ease-out, transform ${depth.transitionMs}ms ease-out`,
    willChange: 'opacity, transform',
  };

  // The background pans with the foreground, one for one.
  //
  // Scaling the pan instead — the obvious way to write a parallax — silently
  // unregisters the two axes: the canvas puts its axis at
  // `axisY - panOffsetY*k + yOffset`, so any k below 1 slides the background's
  // axis `(1-k) * panOffsetY` away from the foreground's, which at a normal
  // scroll depth is a gap of a few hundred pixels. The vertical foreshortening
  // is already carried honestly by the CSS scale about the shared axis, which
  // shrinks each bar's distance from the axis while pinning the axis itself.
  const backPanOffsetY = panOffsetY;

  const shared = {
    width,
    height,
    viewportStartYear,
    yearsPerPixel,
    panOffsetY: backPanOffsetY,
    layout,
    config,
    yOffset,
    interactive: false,
    layerMode: 'back',
  };

  return (
    <>
      <div className="ch2-layer ch2-layer-wash" style={washStyle}>
        <TimelineCanvas {...shared} />
      </div>

      {focusIds && focusIds.size > 0 && !forward && (
        <div className="ch2-layer ch2-layer-focus" style={focusStyle}>
          <TimelineCanvas {...shared} onlyIds={focusIds} suppressMonarchNames={showLabels} />
        </div>
      )}

      {/* Names for the reign band. Outside the washed layer on purpose — these
          stay crisp and hoverable while the bars behind them stay soft. */}
      {showLabels && (
      <div className="ch2-layer ch2-layer-labels" style={labelStyle}>
        <MonarchLabels
          people={layout.stackedPeople}
          viewportStartYear={viewportStartYear}
          yearsPerPixel={yearsPerPixel}
          panOffsetY={backPanOffsetY}
          yOffset={yOffset}
          width={width}
          height={height}
          fit={config?.labelFit === 'fit'}
        />
      </div>
      )}
    </>
  );
}
