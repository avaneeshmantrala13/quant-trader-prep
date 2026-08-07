/**
 * lib/fermi/persist.ts — a SELF-CONTAINED, localStorage-namespaced persistence
 * shim for the Fermi estimation drill's single in-progress run.
 *
 * WHY THIS EXISTS. `FermiPage` is a disjoint practice surface that never touches
 * `UserProgress`/mastery, and its in-progress state (the chosen mode plus the
 * two parallel per-item grade arrays) doesn't fit the shared `ResumeState`
 * (which only models quiz/numeric answer indices keyed by `levelId`). So we
 * durably persist a small, JSON-serializable snapshot here, mirroring the OA
 * store's durable style.
 *
 * Only the CURRENT run is kept, and only while it is in progress; finishing
 * (reaching the summary) or restarting clears it, so re-entering after a
 * completed run starts fresh. The persisted grade objects are plain data, so a
 * leave/reload/re-enter restores the exact verdicts already earned.
 */
import type { FermiGrade, FermiIntervalGrade } from "./grader";
import { userScopedKey } from "@/lib/userScope";

/**
 * BASE localStorage key. The real key is per-user (see {@link fermiRunKey}) so
 * two accounts on the same browser never resume each other's in-progress run.
 */
export const FERMI_STORAGE_KEY = "qtp.fermi.run";

/** Per-user storage key for the in-progress run (anon namespace when logged out). */
export function fermiRunKey(userId: string | null | undefined): string {
  return userScopedKey(FERMI_STORAGE_KEY, userId);
}

/** The minimal surface of `Storage` we use — injectable for tests. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type FermiMode = "point" | "ci";

/** The persisted in-progress run (versioned for safe future migrations). */
export interface FermiRunState {
  version: 1;
  mode: FermiMode;
  index: number;
  /** Point-estimate verdicts, parallel to the item list; null = unanswered. */
  grades: (FermiGrade | null)[];
  /** 90% CI verdicts, parallel to the item list; null = unanswered. */
  intervalGrades: (FermiIntervalGrade | null)[];
}

function resolveStore(store?: StorageLike): StorageLike | null {
  if (store) return store;
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

/** Persist the CURRENT user's in-progress run (overwrites any prior one). Non-fatal. */
export function saveFermiRun(
  run: FermiRunState,
  userId: string | null | undefined,
  store?: StorageLike,
): void {
  const s = resolveStore(store);
  if (!s) return;
  try {
    s.setItem(fermiRunKey(userId), JSON.stringify(run));
  } catch {
    /* storage full / unavailable — non-fatal */
  }
}

/**
 * Read the CURRENT user's persisted run, or `undefined` when absent/corrupt. The
 * key is user-scoped, so one account never reads another account's run. Performs
 * a light structural check so a malformed blob is treated as "no resume".
 */
export function loadFermiRun(
  userId: string | null | undefined,
  store?: StorageLike,
): FermiRunState | undefined {
  const s = resolveStore(store);
  if (!s) return undefined;
  try {
    const raw = s.getItem(fermiRunKey(userId));
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as FermiRunState | null;
    if (
      !parsed ||
      (parsed.mode !== "point" && parsed.mode !== "ci") ||
      typeof parsed.index !== "number" ||
      !Array.isArray(parsed.grades) ||
      !Array.isArray(parsed.intervalGrades)
    ) {
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
}

/** Clear the CURRENT user's persisted run (on finish or explicit restart). Non-fatal. */
export function clearFermiRun(
  userId: string | null | undefined,
  store?: StorageLike,
): void {
  const s = resolveStore(store);
  if (!s) return;
  try {
    s.removeItem(fermiRunKey(userId));
  } catch {
    /* ignore */
  }
}
