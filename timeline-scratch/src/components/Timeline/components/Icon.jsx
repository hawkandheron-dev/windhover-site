/**
 * Icon component for loading SVG icons from the Antiquarian icon set
 */

import { useState, useEffect } from 'react';
import { sanitizeHtml } from '../../../utils/sanitize.js';

// Map of icon names to their collection and file
const iconMap = {
  // Shapes (from universal)
  'diamond': { collection: 'universal', id: 'diamond' },
  'square': { collection: 'universal', id: 'square' },
  'circle': { collection: 'universal', id: 'circle' },
  'triangle': { collection: 'universal', id: 'triangle' },
  // UI icons
  'plus': { collection: 'universal', id: 'plus' },
  'minus': { collection: 'universal', id: 'minus' },
  'close': { collection: 'universal', id: 'close-x' },
  'arrow-left': { collection: 'universal', id: 'arrow-left' },
  'arrow-right': { collection: 'universal', id: 'arrow-right' },
  'arrow-up': { collection: 'universal', id: 'arrow-up' },
  'arrow-down': { collection: 'universal', id: 'arrow-down' },
  'book': { collection: 'universal', id: 'book' },
  'menu': { collection: 'universal', id: 'menu' },
  'search': { collection: 'universal', id: 'search' },
  // Period-themed icons
  'crown': { collection: 'medieval', id: 'crown' },
  'sword': { collection: 'medieval', id: 'sword' },
  'shield': { collection: 'medieval', id: 'shield-heater' },
  'tower': { collection: 'medieval', id: 'tower' },
  'chalice': { collection: 'medieval', id: 'chalice' },
  'amphora': { collection: 'classical', id: 'amphora' },
  'olive-branch': { collection: 'classical', id: 'olive-branch' },
  'quatrefoil': { collection: 'medieval', id: 'quatrefoil' },
  'trefoil': { collection: 'medieval', id: 'trefoil' },
  'dagger': { collection: 'renaissance', id: 'dagger' },
  'reference': { collection: 'renaissance', id: 'reference-mark' },
  'cross': { collection: 'medieval', id: 'cross-maltese' },
};

// Cache for loaded SVG content
const svgCache = new Map();

/**
 * An icon's SVG text: straight from the cache when it has been loaded
 * before, otherwise fetched once and kept. Only the fetch's reply sets
 * state, so a cached icon draws on the first render.
 */
function useIconSvg(iconInfo, label) {
  const cacheKey = iconInfo ? `${iconInfo.collection}/${iconInfo.id}` : null;
  const [loaded, setLoaded] = useState({ key: null, text: null });

  useEffect(() => {
    if (!cacheKey || svgCache.has(cacheKey)) return;
    let cancelled = false;
    fetch(`/icons/${cacheKey}.svg`)
      .then(res => res.text())
      .then(text => {
        svgCache.set(cacheKey, text);
        if (!cancelled) setLoaded({ key: cacheKey, text });
      })
      .catch(err => console.error(`Failed to load icon: ${label}`, err));
    return () => { cancelled = true; };
  }, [cacheKey, label]);

  if (!cacheKey) return null;
  return svgCache.get(cacheKey) ?? (loaded.key === cacheKey ? loaded.text : null);
}

export function Icon({ name, size = 24, color = 'currentColor', className = '' }) {
  const iconInfo = iconMap[name];
  useEffect(() => {
    if (!iconInfo) console.warn(`Icon "${name}" not found in icon map`);
  }, [iconInfo, name]);
  const svgContent = useIconSvg(iconInfo, name);

  if (!svgContent) {
    return <span className={`icon icon-placeholder ${className}`} style={{ width: size, height: size }} />;
  }

  // Process SVG to apply size and color
  // Insert width/height after <svg tag, replace currentColor
  const processedSvg = svgContent
    .replace(/<svg([^>]*)>/, `<svg$1 width="${size}" height="${size}">`)
    .replace(/currentColor/g, color);

  return (
    <span
      className={`icon ${className}`}
      style={{ display: 'inline-flex', width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(processedSvg) }}
    />
  );
}

// Render an icon for legend shapes with proper fill
export function ShapeIcon({ shape, color, size = 18 }) {
  const iconInfo = iconMap[shape];
  const svgContent = useIconSvg(iconInfo, shape);

  if (!svgContent || !iconInfo) {
    // Fallback to simple colored shape
    return (
      <svg width={size} height={size} viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" fill={color} stroke="#333" strokeWidth="1" />
      </svg>
    );
  }

  // Process SVG to use fill instead of stroke for colored shapes
  const processedSvg = svgContent
    .replace(/<svg([^>]*)>/, `<svg$1 width="${size}" height="${size}">`)
    .replace(/fill="none"/g, `fill="${color}"`)
    .replace(/stroke="currentColor"/g, `stroke="#333"`)
    .replace(/stroke-width="[^"]*"/g, `stroke-width="1"`);

  return (
    <span
      className="shape-icon"
      style={{ display: 'inline-flex', width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(processedSvg) }}
    />
  );
}
