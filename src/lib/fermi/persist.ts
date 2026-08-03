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

/** localStorage key (device-level; this drill is disjoint from per-user progress). */
export const FERMI_STORAGE_KEY = "qtp.fermi.run";

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

/** Persist the in-progress run (overwrites any prior one). Non-fatal on failure. */
export function saveFermiRun(run: FermiRunState, store?: StorageLike): void {
  const s = resolveStore(store);
  if (!s) return;
  try {
    s.setItem(FERMI_STORAGE_KEY, JSON.stringify(run));
  } catch {
    /* storage full / unavailable — non-fatal */
  }
}

/**
 * Read the persisted run, or `undefined` when absent/corrupt. Performs a light
 * structural check so a malformed blob is treated as "no resume".
 */
export function loadFermiRun(store?: StorageLike): FermiRunState | undefined {
  const s = resolveStore(store);
  if (!s) return undefined;
  try {
    const raw = s.getItem(FERMI_STORAGE_KEY);
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

/** Clear the persisted run (on finish or explicit restart). Non-fatal. */
export function clearFermiRun(store?: StorageLike): void {
  const s = resolveStore(store);
  if (!s) return;
  try {
    s.removeItem(FERMI_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
