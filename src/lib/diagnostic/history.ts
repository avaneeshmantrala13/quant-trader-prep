import type { Difficulty } from "@/types/content";
import type { DiagnosticResult } from "@/types/progress";
import type { DiagnosticOutcome } from "./diagnosticSeed";

/**
 * ============================================================================
 *  DIAGNOSTIC HISTORY — pure scoring / append / trend helpers (unit-tested)
 * ============================================================================
 * The Recalibrate flow records one {@link DiagnosticResult} per completed
 * attempt so the summary can chart improvement over time. All of the logic —
 * folding graded outcomes into an overall + per-topic score, appending to the
 * history immutably, and summarizing the first-vs-latest trend for the graph —
 * lives here as pure functions (no React, no storage) so it is trivially
 * testable and reused by both `ProgressContext` and the summary chart.
 */

/** Default cap on stored attempts (keeps the newest, drops the oldest). */
export const DEFAULT_HISTORY_CAP = 50;

/** Tier weights used when `tierWeighted` scoring is requested (harder = more). */
const TIER_WEIGHT: Record<Difficulty, number> = {
  intro: 1,
  easy: 1,
  medium: 2,
  hard: 3,
  expert: 4,
};

export interface ComputeResultOptions {
  /** Weight each item by its tier (harder items count more). Default false. */
  tierWeighted?: boolean;
}

/**
 * Fold graded diagnostic outcomes into a {@link DiagnosticResult}: the overall
 * score is the fraction correct (optionally tier-weighted), `itemsAnswered` is
 * the outcome count, and `perTopic` is the per-topic fraction correct. An empty
 * outcome list yields a zeroed result with an empty `perTopic` map.
 */
export function computeDiagnosticResult(
  outcomes: DiagnosticOutcome[],
  at: string,
  opts: ComputeResultOptions = {},
): DiagnosticResult {
  const tierWeighted = opts.tierWeighted ?? false;

  let weightSum = 0;
  let correctWeight = 0;
  // Per-topic tallies (always simple fraction correct, tier-independent).
  const topicTotals = new Map<string, { correct: number; total: number }>();

  for (const o of outcomes) {
    const w = tierWeighted ? TIER_WEIGHT[o.tier] : 1;
    weightSum += w;
    if (o.correct) correctWeight += w;

    const t = topicTotals.get(o.topicKey) ?? { correct: 0, total: 0 };
    t.total += 1;
    if (o.correct) t.correct += 1;
    topicTotals.set(o.topicKey, t);
  }

  const overallScore = weightSum > 0 ? correctWeight / weightSum : 0;

  const perTopic: Record<string, number> = {};
  for (const [topicKey, t] of topicTotals) {
    perTopic[topicKey] = t.total > 0 ? t.correct / t.total : 0;
  }

  return {
    at,
    overallScore,
    itemsAnswered: outcomes.length,
    perTopic,
  };
}

/**
 * Return a NEW history array with `result` appended (oldest → newest), never
 * mutating the input. When the array would exceed `cap`, the oldest entries are
 * dropped so only the most recent `cap` remain. An undefined history starts a
 * fresh single-element array.
 */
export function appendDiagnosticResult(
  history: DiagnosticResult[] | undefined,
  result: DiagnosticResult,
  cap: number = DEFAULT_HISTORY_CAP,
): DiagnosticResult[] {
  const next = [...(history ?? []), result];
  if (cap > 0 && next.length > cap) {
    return next.slice(next.length - cap);
  }
  return next;
}

export interface DiagnosticTrendPoint {
  /** 1-based attempt index. */
  attempt: number;
  /** Overall score (0..1) for that attempt. */
  score: number;
  /** The attempt's ISO timestamp. */
  at: string;
}

export interface DiagnosticTrend {
  count: number;
  first?: DiagnosticResult;
  latest?: DiagnosticResult;
  /** latest.overallScore − first.overallScore (0 with < 2 attempts). */
  delta: number;
  /** True only when there are ≥ 2 attempts and the delta is positive. */
  improving: boolean;
  /** Points for the improvement chart (attempt index → overall score). */
  points: DiagnosticTrendPoint[];
}

/**
 * Summarize a history for the improvement graph: first/latest attempts, the
 * first-vs-latest delta, an `improving` flag, and the per-attempt point series.
 * Safe for empty (count 0) and single-attempt (delta 0, not improving) inputs.
 */
export function diagnosticTrend(
  history: DiagnosticResult[] | undefined,
): DiagnosticTrend {
  const h = history ?? [];
  const count = h.length;
  const points: DiagnosticTrendPoint[] = h.map((r, i) => ({
    attempt: i + 1,
    score: r.overallScore,
    at: r.at,
  }));

  if (count === 0) {
    return { count: 0, delta: 0, improving: false, points };
  }

  const first = h[0];
  const latest = h[count - 1];
  const delta = count >= 2 ? latest.overallScore - first.overallScore : 0;

  return {
    count,
    first,
    latest,
    delta,
    improving: count >= 2 && delta > 0,
    points,
  };
}
