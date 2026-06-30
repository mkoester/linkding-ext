// Flip to true while developing to re-enable the verbose per-bookmark / per-sync
// tracing. Shipped builds keep it off so the extension never logs the user's
// bookmark collection to the console. `console.error` is intentionally NOT routed
// through here — real errors should always surface.
export const DEBUG = false;

export function debugLog(...args: unknown[]): void {
  if (DEBUG) console.log(...args);
}

export function debugWarn(...args: unknown[]): void {
  if (DEBUG) console.warn(...args);
}
