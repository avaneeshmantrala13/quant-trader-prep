/**
 * lib/evTimed/persist.ts — a SELF-CONTAINED, localStorage-namespaced persistence
 * shim for the EV-under-time drill's single in-progress session.
 *
 * WHY THIS EXISTS. `EvTimedPage` is a disjoint practice surface that never
 * touches `UserProgress`/mastery, so it can't ride the shared `ResumeState`
 * (that shape only fits quiz/numeric question sets keyed by `levelId`). Instead
 * we durably persist the whole `EvTimedSessionState` here, mirroring the OA
 * store's philosophy: the session already carries ABSOLUTE epoch-ms deadlines
 * (`questionDeadlineTs`), so a leave/reload/re-enter resumes the drill exactly —
 * an expired question simply auto-times-out on return.
 *
 * Only ONE resumable session is kept, and only while it is RUNNING; finishing or
 * restarting clears it (so re-entering after completion starts fresh). All I/O
 * is guarded and JSON-serializable; a `StorageLike` can be injected for tests.
 */
import type { EvTimedSessionState } from "./engine";

/** localStorage key (device-level; this drill is disjoint from per-user progress). */
export const EV_TIMED_STORAGE_KEY = "qtp.evTimed.session";

/** The minimal surface of `Storage` we use — injectable for tests. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** The persisted envelope (versioned so future migrations stay safe). */
export interface EvTimedPersisted {
  version: 1;
  session: EvTimedSessionState;
}

function resolveStore(store?: StorageLike): StorageLike | null {
  if (store) return store;
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

/** Persist the in-progress session (overwrites any prior one). Non-fatal on failure. */
export function saveEvTimedSession(
  session: EvTimedSessionState,
  store?: StorageLike,
): void {
  const s = resolveStore(store);
  if (!s) return;
  try {
    const payload: EvTimedPersisted = { version: 1, session };
    s.setItem(EV_TIMED_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* storage full / unavailable — non-fatal */
  }
}

/**
 * Read the persisted session, or `undefined` when absent/corrupt. Performs a
 * light structural check (items + answers arrays) so a malformed blob is treated
 * as "no resume" rather than crashing the drill.
 */
export function loadEvTimedSession(
  store?: StorageLike,
): EvTimedSessionState | undefined {
  const s = resolveStore(store);
  if (!s) return undefined;
  try {
    const raw = s.getItem(EV_TIMED_STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as EvTimedPersisted | null;
    const session = parsed?.session;
    if (
      !session ||
      !Array.isArray(session.items) ||
      !Array.isArray(session.answers) ||
      typeof session.index !== "number"
    ) {
      return undefined;
    }
    return session;
  } catch {
    return undefined;
  }
}

/** Clear the persisted session (on finish or explicit restart). Non-fatal. */
export function clearEvTimedSession(store?: StorageLike): void {
  const s = resolveStore(store);
  if (!s) return;
  try {
    s.removeItem(EV_TIMED_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
