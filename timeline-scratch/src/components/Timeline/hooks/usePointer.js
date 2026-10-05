import { useSyncExternalStore } from 'react';

/** The pointer's position from a pointer store (utils/pointerStore.js). */
export function usePointer(store) {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
