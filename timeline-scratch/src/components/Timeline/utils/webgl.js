/**
 * Whether this browser can draw a MapLibre map. MapLibre needs WebGL; without
 * it (an old machine, a blocked GPU, some headless browsers) `new Map()`
 * throws, and a throw inside an effect with no error boundary took the whole
 * page down. Checked once and cached.
 */
let cached = null;
export function canUseWebGL() {
  if (cached !== null) return cached;
  try {
    const canvas = document.createElement('canvas');
    cached = Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    cached = false;
  }
  return cached;
}
