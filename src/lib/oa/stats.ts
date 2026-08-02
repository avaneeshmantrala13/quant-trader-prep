/**
 * lib/oa/stats.ts — PURE session summary + cross-session aggregation for the
 * Timed OA dashboard.
 *
 * `summarizeSession` freezes a finished (or expired) `OaSessionState` into the
 * durable `OaSessionResult` the dashboard reads: score/accuracy from
 * `scoring.ts`, and all TIME stats delegated to the arena's `speedStats` so the
 * OA report and the Speed Arena report agree on "median solve time" and
 * "% within budget". We map each OA answer to the arena `AnsweredItem` shape and
 * reuse that battle-tested computation rather than re-deriving it here.
 *
 * IMPORTANT alignment: `speedStats` counts only NON-skipped items as attempted
 * (skips were never "solved"), which is exactly `countAttempted` (chosen != null)
 * — so the two agree by construction, and skipped/unanswered items are excluded
 * from the time stats.
 *
 * Everything is deterministic (no clock, no I/O) and O(n) over the answers.
 */
import { median } from "@/lib/arena/analytics";
import type { AnsweredItem } from "@/lib/arena/scoring";
import { speedStats } from "@/lib/arena/speedStats";
import {
  countAttempted,
  countCorrect,
  isCorrect,
  maxOaScore,
  scoreOaSession,
} from "./scoring";
import type { OaFormatKind, OaSessionResult, OaSessionState } from "./types";

/**
 * Map a session's parallel questions/answers to the arena `AnsweredItem[]` so we
 * can reuse `speedStats`. Iterates the shared (min) length to stay safe under a
 * length mismatch, matching `scoring.ts`.
 */
function toAnsweredItems(state: OaSessionState): AnsweredItem[] {
  const n = Math.min(state.questions.length, state.answers.length);
  const items: AnsweredItem[] = [];
  for (let i = 0; i < n; i++) {
    const q = state.questions[i];
    const a = state.answers[i];
    items.push({
      id: a.questionId,
      correct: isCorrect(q, a),
      skipped: a.chosen === null,
      rtMs: a.elapsedMs,
      op: "oa",
    });
  }
  return items;
}

/**
 * Summarize a finished session into a durable `OaSessionResult`. Score/accuracy
 * come from `scoring.ts`; time stats delegate to `speedStats` (attempted =
 * non-skipped, so it lines up with `countAttempted`). When nothing was attempted
 * the time stats are all 0 (no NaN).
 */
export function summarizeSession(state: OaSessionState): OaSessionResult {
  const speed = speedStats(toAnsweredItems(state), state.budgetMs);

  const attempted = countAttempted(state.questions, state.answers);
  const correct = countCorrect(state.questions, state.answers);
  const total = state.questions.length;

  return {
    id: state.id,
    formatId: state.formatId,
    kind: state.kind,
    startedAtTs: state.startedAtTs,
    completedAtTs: state.completedAtTs ?? state.startedAtTs,
    outcome: state.status === "expired" ? "expired" : "submitted",
    score: scoreOaSession(state),
    maxScore: maxOaScore(total, state.scoring),
    total,
    attempted,
    correct,
    accuracy: attempted > 0 ? correct / attempted : 0,
    medianMsPerQuestion: speed.medianSolveMs,
    avgMsPerQuestion: speed.meanSolveMs,
    budgetMs: state.budgetMs,
    withinBudget: speed.withinBudget,
    pctWithinBudget: speed.pctWithinBudget,
    hardMode: state.hardMode,
  };
}

/** Cross-session rollup for the dashboard headline numbers. */
export interface OaAggregateStats {
  sessions: number;
  totalAttempted: number;
  totalCorrect: number;
  accuracy: number;
  medianMsPerQuestion: number;
  avgMsPerQuestion: number;
  pctWithinBudget: number;
}

/**
 * Aggregate many finished sessions.
 *
 * Because each `OaSessionResult` only stores its OWN per-session median/avg (not
 * the raw per-question times), we cannot pool the true per-question times. So:
 *  - `avgMsPerQuestion` is the attempted-WEIGHTED mean of the per-session
 *    averages (Σ avg_i · attempted_i / Σ attempted_i) — the correct pooled mean.
 *  - `medianMsPerQuestion` is the (unweighted) median of the per-session medians
 *    — an approximation of the pooled median given the data we retain.
 *  - `pctWithinBudget` = Σ withinBudget / Σ attempted.
 * All ratios are 0 (never NaN) when nothing was attempted.
 */
export function aggregateOaStats(results: OaSessionResult[]): OaAggregateStats {
  let totalAttempted = 0;
  let totalCorrect = 0;
  let totalWithinBudget = 0;
  let weightedAvgSum = 0;
  const perSessionMedians: number[] = [];

  for (const r of results) {
    totalAttempted += r.attempted;
    totalCorrect += r.correct;
    totalWithinBudget += r.withinBudget;
    weightedAvgSum += r.avgMsPerQuestion * r.attempted;
    // Only sessions with time data contribute a median.
    if (r.attempted > 0) perSessionMedians.push(r.medianMsPerQuestion);
  }

  return {
    sessions: results.length,
    totalAttempted,
    totalCorrect,
    accuracy: totalAttempted > 0 ? totalCorrect / totalAttempted : 0,
    medianMsPerQuestion: median(perSessionMedians),
    avgMsPerQuestion: totalAttempted > 0 ? weightedAvgSum / totalAttempted : 0,
    pctWithinBudget: totalAttempted > 0 ? totalWithinBudget / totalAttempted : 0,
  };
}

/** A per-format rollup: the aggregate stats for one format id, plus its id. */
export interface OaFormatStats extends OaAggregateStats {
  formatId: string;
}

/**
 * Group finished results BY FORMAT and aggregate each group, so the dashboard
 * can show a per-format breakdown (attempts, accuracy, median/avg time,
 * % within budget) across ALL formats. Groups are returned in first-seen order
 * (by earliest completion), and each group reuses `aggregateOaStats` so the
 * per-format numbers agree with the overall rollup by construction. Empty in ⇒
 * empty out (never NaN).
 */
export function aggregateByFormat(results: OaSessionResult[]): OaFormatStats[] {
  const order: string[] = [];
  const groups = new Map<string, OaSessionResult[]>();
  for (const r of results) {
    let g = groups.get(r.formatId);
    if (!g) {
      g = [];
      groups.set(r.formatId, g);
      order.push(r.formatId);
    }
    g.push(r);
  }
  return order.map((formatId) => ({
    formatId,
    ...aggregateOaStats(groups.get(formatId) as OaSessionResult[]),
  }));
}

/** One point on the dashboard "average time per question over time" line graph. */
export interface OaAvgTimePoint {
  at: number;
  avgMsPerQuestion: number;
  kind: OaFormatKind;
}

/**
 * Build the average-time-per-question time series across sessions (ascending by
 * completion time). Includes ALL kinds (measured + timed) and excludes sessions
 * with `attempted === 0` (they carry no time data).
 */
export function avgTimeSeries(results: OaSessionResult[]): OaAvgTimePoint[] {
  return results
    .filter((r) => r.attempted > 0)
    .slice()
    .sort((a, b) => a.completedAtTs - b.completedAtTs)
    .map((r) => ({
      at: r.completedAtTs,
      avgMsPerQuestion: r.avgMsPerQuestion,
      kind: r.kind,
    }));
}
