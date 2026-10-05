/**
 * Hook to detect mobile viewport and orientation
 * Uses matchMedia for reliable detection with SSR safety
 */

import { useSyncExternalStore } from 'react';

const MOBILE_BREAKPOINT = 768;
const QUERY = `(max-width: ${MOBILE_BREAKPOINT}px)`;

// The media query is the external store: React reads it during render and
// re-renders when it changes, with no effect and no first-frame mismatch.
function subscribe(onChange) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}
const getSnapshot = () => window.matchMedia(QUERY).matches;
const getServerSnapshot = () => false;

export function useMobileDetect() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
