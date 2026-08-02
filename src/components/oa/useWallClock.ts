import { useEffect, useState } from "react";

/**
 * useWallClock — the SINGLE real clock driving the Timed OA runner's DISPLAY.
 *
 * The pure session engine (`lib/oa/timedSession.ts`) is wall-clock / deadline
 * based and never calls `Date.now()` itself; this hook owns the one timer that
 * feeds it a fresh `nowTs`. It:
 *  - ticks on an interval (only while `active`) so countdowns/stopwatches update,
 *  - AND re-reads the clock IMMEDIATELY on `document` "visibilitychange" and
 *    window "focus" so returning to a backgrounded tab reconciles the deadline
 *    at once (the interval is throttled/paused while hidden), rather than
 *    waiting for the next tick.
 *
 * Returns the current epoch-ms (`Date.now()`). Listeners + interval are cleaned
 * up on unmount and re-established when `active` / `intervalMs` change.
 */
export function useWallClock(active: boolean, intervalMs = 250): number {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const sync = () => setNow(Date.now());

    // Returning to the tab (visibility) or window focus must reconcile the
    // wall clock instantly — timers are unreliable while the tab is hidden.
    const onVisibility = () => {
      if (document.visibilityState === "visible") sync();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", sync);

    let id: ReturnType<typeof setInterval> | undefined;
    if (active) {
      // Read once on (re)activation so the first paint is current.
      sync();
      id = setInterval(sync, intervalMs);
    }

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", sync);
      if (id) clearInterval(id);
    };
  }, [active, intervalMs]);

  return now;
}
