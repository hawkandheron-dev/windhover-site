/**
 * The screen's device pixel ratio (2 on most Retina displays), kept current
 * when a window moves between screens or the page is zoomed. Returns 1 when
 * `enabled` is false, so a caller can make HiDPI drawing opt-in.
 */
import { useSyncExternalStore } from 'react';

function subscribe(onChange) {
  // A resolution query matches only the current ratio, so it fires once the
  // ratio changes; re-subscribing then watches the new value.
  let mql = null;
  const watch = () => {
    mql?.removeEventListener('change', handle);
    mql = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    mql.addEventListener('change', handle);
  };
  function handle() { watch(); onChange(); }
  watch();
  return () => mql?.removeEventListener('change', handle);
}
const getSnapshot = () => window.devicePixelRatio || 1;
const getServerSnapshot = () => 1;

export function useDevicePixelRatio(enabled = true) {
  const ratio = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return enabled ? ratio : 1;
}
