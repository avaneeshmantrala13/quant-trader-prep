/**
 * leaderboard/rescore.ts — the PURE, server-authoritative re-scoring logic for
 * a ranked Speed Arena submission (Phase 6).
 *
 * This is the trust boundary of the leaderboard: a ranked client sends only its
 * ANSWERS (`{id, value, rtMs}[]`) plus the `seed`/`preset` it was issued. The
 * server never trusts a client-reported score — it regenerates the exact
 * question stream from `(seed, preset)` via the SHARED `arenaQuestionStream`,
 * re-grades every answer, re-scores with the SHARED scorer, and applies
 * plausibility caps to reject impossible runs. The Lambda
 * (`infra/lambda/leaderboard/index.mjs`) is a line-for-line port of this file;
 * a shared JSON fixture (`scoring.fixture.json`) pins their agreement.
 *
 * The plausibility caps (PLAUSIBILITY.*) are documented, TUNABLE anti-cheat
 * defaults — the leaderboard is framed as "for fun", so they aim to reject the
 * obviously-impossible, not to be a hardened adversarial system.
 */
import type { ArenaPreset } from "@/lib/arena/config";
import { scoreRun, type AnsweredItem } from "@/lib/arena/scoring";
import { median } from "@/lib/arena/analytics";
import { arenaQuestionStream } from "./seed";

export interface RankedAnswer {
  id: string;
  /** The typed value, or `null` for a skip. */
  value: number | null;
  rtMs: number;
}

export interface RescoreInput {
  board: "zetamac" | "optiver";
  seed: number;
  preset: ArenaPreset;
  answers: RankedAnswer[];
  /** Elapsed wall-clock the client reported (ms). */
  clientElapsedMs: number;
  /** Elapsed the server measured between issue + submit (ms), if available. */
  serverElapsedMs?: number;
}

export interface RescoreResult {
  ok: boolean;
  /** Authoritative score (only meaningful when `ok`). */
  score: number;
  /** Number of non-skip answers that were graded correct. */
  correct: number;
  attempts: number;
  /** Present when `ok` is false: which plausibility cap rejected the run. */
  reason?: string;
}

/** Tunable anti-cheat caps (see module doc). */
export const PLAUSIBILITY = {
  /** Sustained attempts/sec above this are rejected (~2.5 q/s is superhuman). */
  MAX_QPS: 2.5,
  /** With ≥ this many attempts, a tiny median rt + high accuracy is rejected. */
  MIN_ATTEMPTS_FOR_SPEED_CHECK: 20,
  /** Median rt (ms) below which a high-accuracy run is implausible. */
  IMPLAUSIBLE_MEDIAN_MS: 250,
  /** Accuracy above which the tiny-median check trips. */
  IMPLAUSIBLE_ACCURACY: 0.8,
  /** clientElapsed may exceed the window by at most this factor. */
  MAX_ELAPSED_OVER_WINDOW: 1.25,
  /** Allowed |client − server| elapsed divergence (ms) before rejecting. */
  ELAPSED_DIVERGENCE_MS: 5000,
} as const;

/**
 * Convert a ranked submission into graded `AnsweredItem`s using the SHARED
 * deterministic stream. Answers referencing an unknown id are dropped. This is
 * the exact grading the Lambda performs.
 */
export function gradeRankedAnswers(
  seed: number,
  preset: ArenaPreset,
  answers: RankedAnswer[],
): AnsweredItem[] {
  const stream = arenaQuestionStream(seed, preset);
  const byId = new Map(stream.map((s) => [s.id, s]));
  const graded: AnsweredItem[] = [];
  for (const ans of answers) {
    const q = byId.get(ans.id);
    if (!q) continue; // unknown id → ignore (can't be trusted)
    const skipped = ans.value === null || ans.value === undefined;
    graded.push({
      id: ans.id,
      correct: !skipped && ans.value === q.answer,
      skipped,
      rtMs: ans.rtMs,
      op: q.op,
    });
  }
  return graded;
}

/** Apply the plausibility caps; returns a rejection reason or `null` if clean. */
export function checkPlausibility(
  graded: AnsweredItem[],
  input: RescoreInput,
): string | null {
  const attempted = graded.filter((g) => !g.skipped);
  const windowMs = input.preset.durationSec * 1000;

  // 1) Elapsed sanity: can't have played much longer than the window.
  if (input.clientElapsedMs > windowMs * PLAUSIBILITY.MAX_ELAPSED_OVER_WINDOW) {
    return "elapsed>window";
  }
  // 2) Client vs server divergence (when the server measured it).
  if (
    input.serverElapsedMs !== undefined &&
    Math.abs(input.clientElapsedMs - input.serverElapsedMs) >
      PLAUSIBILITY.ELAPSED_DIVERGENCE_MS
  ) {
    return "elapsed-divergence";
  }
  // 3) Sustained throughput cap (attempts per second over the elapsed window).
  const elapsedSec = Math.max(1, input.clientElapsedMs) / 1000;
  const qps = attempted.length / elapsedSec;
  if (qps > PLAUSIBILITY.MAX_QPS) return "qps>max";
  // 4) Impossible accuracy at impossible speed.
  if (attempted.length >= PLAUSIBILITY.MIN_ATTEMPTS_FOR_SPEED_CHECK) {
    const medianRt = median(attempted.map((a) => a.rtMs));
    const accuracy =
      attempted.filter((a) => a.correct).length / attempted.length;
    if (
      medianRt < PLAUSIBILITY.IMPLAUSIBLE_MEDIAN_MS &&
      accuracy > PLAUSIBILITY.IMPLAUSIBLE_ACCURACY
    ) {
      return "speed-accuracy";
    }
  }
  return null;
}

/**
 * The full server-authoritative re-score: grade → plausibility → score. On a
 * cap violation returns `{ ok:false, reason }` (the run is not ranked); else
 * `{ ok:true, score }` with the authoritative score.
 */
export function rescore(input: RescoreInput): RescoreResult {
  const graded = gradeRankedAnswers(input.seed, input.preset, input.answers);
  const attempts = graded.filter((g) => !g.skipped).length;
  const correct = graded.filter((g) => !g.skipped && g.correct).length;
  const reason = checkPlausibility(graded, input);
  if (reason) return { ok: false, score: 0, correct, attempts, reason };
  return { ok: true, score: scoreRun(graded, input.preset), correct, attempts };
}
