/**
 * arena/speedProfile.ts — persisted, per-config SPEED profile for the interview
 * overlay: the rolling record that (a) surfaces speed stats across runs and
 * (b) drives adaptive time-pressure tightening between runs.
 *
 * Mirrors `localPb.ts` exactly: pure by construction over an injected
 * key→value store, so it is unit-tested with an in-memory map (no real
 * `localStorage`, no clock). The React layer passes `window.localStorage`.
 *
 * It is deliberately SEPARATE from the personal-best/leaderboard store — this is
 * a private practice aid (your pace over time), never a ranked artifact, so it
 * never touches scoring or the leaderboard bucket. Case A never reads it.
 */
import type { KeyValueStore } from "./localPb";
import {
  DEFAULT_ADAPTIVE,
  nextAdaptiveBudgetMs,
  type AdaptiveConfig,
} from "./adaptive";

const PROFILE_PREFIX = "qtp.arena.speed.";
const HISTORY_LIMIT = 50;

export interface SpeedRun {
  /** Median solve time (ms) for the run. */
  medianSolveMs: number;
  /** Accuracy (0–1) for the run. */
  accuracy: number;
  /** Attempted count for the run. */
  attempted: number;
  /** Per-question budget (ms) the run was paced against. */
  budgetMs: number;
  atMs: number;
}

export interface SpeedProfile {
  /** The current (possibly adaptively-tightened) per-question budget (ms). */
  budgetMs: number;
  /** Rolling recent runs (oldest first, capped). */
  runs: SpeedRun[];
}

function key(board: string, configHash: string): string {
  return `${PROFILE_PREFIX}${board}.${configHash}`;
}

function readJson<T>(store: KeyValueStore, k: string): T | null {
  const raw = store.getItem(k);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Current speed profile for a board+config, or `null` if none recorded. */
export function readSpeedProfile(
  store: KeyValueStore,
  board: string,
  configHash: string,
): SpeedProfile | null {
  return readJson<SpeedProfile>(store, key(board, configHash));
}

/** Median-of-medians solve time across a profile's runs (ms), or null. */
export function medianSolveAcross(profile: SpeedProfile | null): number | null {
  if (!profile || profile.runs.length === 0) return null;
  const xs = profile.runs.map((r) => r.medianSolveMs).sort((a, b) => a - b);
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 === 1 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

/**
 * Record a finished interview-overlay run and return the updated profile. The
 * next budget is tightened (via `nextAdaptiveBudgetMs`) ONLY when `adaptive` is
 * on and this run's accuracy has stabilized high — otherwise the budget holds.
 * The current budget starts from the last profile's budget (or this run's).
 */
export function recordSpeedRun(
  store: KeyValueStore,
  board: string,
  configHash: string,
  run: SpeedRun,
  opts: { adaptive: boolean; config?: AdaptiveConfig } = { adaptive: false },
): SpeedProfile {
  const prev = readSpeedProfile(store, board, configHash);
  const currentBudget = prev?.budgetMs ?? run.budgetMs;
  const cfg = opts.config ?? DEFAULT_ADAPTIVE;

  const nextBudget = opts.adaptive
    ? nextAdaptiveBudgetMs(currentBudget, run.accuracy, run.attempted, cfg)
    : currentBudget;

  const runs = [...(prev?.runs ?? []), run].slice(-HISTORY_LIMIT);
  const profile: SpeedProfile = { budgetMs: nextBudget, runs };
  store.setItem(key(board, configHash), JSON.stringify(profile));
  return profile;
}
