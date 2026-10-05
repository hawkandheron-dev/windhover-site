/**
 * Where the pointer is over the timeline, as a tiny external store.
 *
 * The position changes on every mouse move. Held as Timeline state it
 * re-rendered the whole timeline (and redrew both canvases while over a
 * figure) dozens of times a second. Held here, only the few things that
 * follow the pointer (the cursor line, the year chip, the hover card)
 * subscribe and re-render.
 */
export function createPointerStore() {
  let position = { x: 0, y: 0 };
  const listeners = new Set();
  return {
    get: () => position,
    set(x, y) {
      if (x === position.x && y === position.y) return;
      position = { x, y };
      listeners.forEach(fn => fn());
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
