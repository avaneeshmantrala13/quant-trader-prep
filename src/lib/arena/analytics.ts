/**
 * arena/analytics.ts — pure post-run analytics for the Speed Arena (Phase 6).
 *
 * Everything here is O(n) over the (≤ ~200) answered items and takes explicit
 * inputs (no clock, no network), so it is fully deterministic and unit-tested.
 *
 * Research justification (build-specs/DESIGN_TIMING_LEADERBOARD.md §4A):
 *  - The speed-accuracy tradeoff means "fast + wrong" is a distinct failure mode
 *    from "slow + wrong". The RUSHING DETECTOR flags wrong answers that came in
 *    implausibly fast for the user (`wrong && rt < max(800ms, 0.5×median[op])`),
 *    and the aggregate `carelessSignal` fires when rush errors dominate the
 *    error mix (≥ 40%) — the cue to slow down rather than study harder.
 *  - Optiver EV coaching: since a wrong answer is −1, low-confidence guessing is
 *    −EV; skipping (0) preserves EV.
 *
 * Thresholds (RUSH_FLOOR_MS / RUSH_RATIO / CARELESS_RATIO) are tunable design
 * defaults — see `config.ts`.
 */
import {
  CARELESS_RATIO,
  RUSH_FLOOR_MS,
  RUSH_RATIO,
  type ArenaPreset,
} from "./config";
import { scoreRun, type AnsweredItem } from "./scoring";

export interface RunReport {
  score: number;
  /** correct / attempted (0 when nothing was attempted). */
  accuracy: number;
  /** attempted / total items presented. */
  attemptRate: number;
  meanMs: number;
  medianMs: number;
  p90Ms: number;
  perQuestion: { id: string; rtMs: number; correct: boolean; op: string }[];
  /** ids of the top-3 slowest attempted questions (desc by rt). */
  slowest: string[];
  /** ids flagged as rush errors. */
  rushErrors: string[];
  /** rushErrors / totalErrors ≥ CARELESS_RATIO. */
  carelessSignal: boolean;
  byOp: Record<string, { attempts: number; wrong: number; avgMs: number }>;
  pacing: { requiredMsPerQ: number; actualMsPerQ: number; projected: number };
  /** Optiver-only skip-vs-guess EV nudge. */
  evCoaching?: string;
}

/* --------------------------------- stats ---------------------------------- */

/** Mean of a numeric array (0 for empty). */
export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

/**
 * Percentile via linear interpolation on the sorted array (`p` in [0,1]).
 * `percentile(xs, 0.5)` is the median (mean of the two central values for even
 * n). Empty ⇒ 0.
 */
export function percentile(xs: number[], p: number): number {
  if (xs.length === 0) return 0;
  if (xs.length === 1) return xs[0];
  const sorted = [...xs].sort((a, b) => a - b);
  const clamped = Math.min(1, Math.max(0, p));
  const idx = clamped * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const frac = idx - lo;
  return sorted[lo] + (sorted[hi] - sorted[lo]) * frac;
}

/** Median = 50th percentile. */
export function median(xs: number[]): number {
  return percentile(xs, 0.5);
}

/* ----------------------------- rushing detector --------------------------- */

/**
 * A rush error ⇔ the answer was WRONG and its response time was below
 * `max(RUSH_FLOOR_MS, RUSH_RATIO × userMedianMs)`. Skipped and correct answers
 * are never rush errors. `userMedianMs` is the user's rolling median for THIS
 * op (pass a global/overall median when the per-op sample is thin).
 */
export function isRushError(item: AnsweredItem, userMedianMs: number): boolean {
  if (item.skipped || item.correct) return false;
  const threshold = Math.max(RUSH_FLOOR_MS, RUSH_RATIO * userMedianMs);
  return item.rtMs < threshold;
}

/* -------------------------------- the report ------------------------------ */

/**
 * Build the full post-run report. `userMedianByOp` carries the learner's
 * rolling per-op median rt (from prior runs); an op missing from it falls back
 * to this run's overall median so a first-ever run still flags obvious rushes.
 */
export function buildReport(
  items: AnsweredItem[],
  preset: ArenaPreset,
  userMedianByOp: Record<string, number>,
): RunReport {
  const attempted = items.filter((it) => !it.skipped);
  const attemptedRts = attempted.map((it) => it.rtMs);
  const correctCount = attempted.filter((it) => it.correct).length;
  const overallMedian = median(attemptedRts);

  const perQuestion = attempted.map((it) => ({
    id: it.id,
    rtMs: it.rtMs,
    correct: it.correct,
    op: it.op,
  }));

  const slowest = [...attempted]
    .sort((a, b) => b.rtMs - a.rtMs)
    .slice(0, 3)
    .map((it) => it.id);

  const medianFor = (op: string): number =>
    userMedianByOp[op] ?? overallMedian;

  const rushErrors = items
    .filter((it) => isRushError(it, medianFor(it.op)))
    .map((it) => it.id);

  const totalErrors = attempted.filter((it) => !it.correct).length;
  const carelessSignal =
    totalErrors > 0 && rushErrors.length / totalErrors >= CARELESS_RATIO;

  const byOp: Record<string, { attempts: number; wrong: number; avgMs: number }> =
    {};
  for (const it of attempted) {
    const b = (byOp[it.op] ??= { attempts: 0, wrong: 0, avgMs: 0 });
    b.attempts += 1;
    if (!it.correct) b.wrong += 1;
    b.avgMs += it.rtMs;
  }
  for (const op of Object.keys(byOp)) {
    byOp[op].avgMs = byOp[op].attempts ? byOp[op].avgMs / byOp[op].attempts : 0;
  }

  // Pacing: how fast you'd need to go to answer every target question in the
  // window vs how fast you actually went, and the count that pace projects to.
  const windowMs = preset.durationSec * 1000;
  const target = preset.questionCap ?? attempted.length;
  const requiredMsPerQ = target > 0 ? windowMs / target : 0;
  const actualMsPerQ = mean(attemptedRts);
  const projected = actualMsPerQ > 0 ? Math.floor(windowMs / actualMsPerQ) : 0;

  return {
    score: scoreRun(items, preset),
    accuracy: attempted.length ? correctCount / attempted.length : 0,
    attemptRate: items.length ? attempted.length / items.length : 0,
    meanMs: mean(attemptedRts),
    medianMs: overallMedian,
    p90Ms: percentile(attemptedRts, 0.9),
    perQuestion,
    slowest,
    rushErrors,
    carelessSignal,
    byOp,
    pacing: { requiredMsPerQ, actualMsPerQ, projected },
    evCoaching: preset.penalty
      ? "Each wrong answer is −1, so a low-confidence guess is −EV. When you're unsure, SKIP — skips preserve your expected value."
      : undefined,
  };
}
