import { describe, expect, it } from "vitest";
import { SPRINT_FORMAT } from "./config";
import {
  aggregateByFormat,
  aggregateOaStats,
  avgTimeSeries,
  summarizeSession,
} from "./stats";
import type {
  OaAnswer,
  OaQuestion,
  OaSessionResult,
  OaSessionState,
} from "./types";

const q = (id: string, correctIndex = 0): OaQuestion => ({
  id,
  prompt: `prompt ${id}`,
  choices: ["a", "b", "c", "d"],
  correctIndex,
  explanation: "because",
  difficulty: "medium",
});

const ans = (questionId: string, chosen: number | null, elapsedMs: number): OaAnswer => ({
  questionId,
  chosen,
  elapsedMs,
});

/** Build an OaSessionState from parts (defaults to a sprint-like +1/-1/0 rule). */
const makeState = (over: Partial<OaSessionState> = {}): OaSessionState => ({
  id: "sess-1",
  formatId: SPRINT_FORMAT.id,
  kind: "sprint",
  startedAtTs: 1_000,
  questions: [],
  answers: [],
  index: 0,
  status: "submitted",
  scoring: { correct: 1, wrong: -1, skip: 0 },
  budgetMs: 6000,
  hardMode: false,
  ...over,
});

describe("summarizeSession", () => {
  // q1 correct @2000, q2 wrong @4000, q3 skip @8000, q4 correct(over budget) @9000
  const state = makeState({
    completedAtTs: 5_000,
    questions: [q("q1", 0), q("q2", 1), q("q3", 2), q("q4", 3)],
    answers: [
      ans("q1", 0, 2000),
      ans("q2", 0, 4000),
      ans("q3", null, 8000),
      ans("q4", 3, 9000),
    ],
  });

  const r = summarizeSession(state);

  it("carries session identity + timestamps", () => {
    expect(r.id).toBe("sess-1");
    expect(r.formatId).toBe(SPRINT_FORMAT.id);
    expect(r.kind).toBe("sprint");
    expect(r.startedAtTs).toBe(1_000);
    expect(r.completedAtTs).toBe(5_000);
    expect(r.budgetMs).toBe(6000);
    expect(r.hardMode).toBe(false);
  });

  it("computes score and maxScore (sprint +1/-1/0)", () => {
    // +1 (q1) -1 (q2) +0 (q3 skip) +1 (q4) = 1
    expect(r.score).toBe(1);
    expect(r.maxScore).toBe(4); // 4 questions × 1
  });

  it("counts total / attempted (excludes skip) / correct + accuracy", () => {
    expect(r.total).toBe(4);
    expect(r.attempted).toBe(3); // q1, q2, q4 (q3 skipped)
    expect(r.correct).toBe(2); // q1, q4
    expect(r.accuracy).toBeCloseTo(2 / 3, 6);
  });

  it("computes time stats over attempted items only (skip excluded)", () => {
    // attempted rts [2000, 4000, 9000]
    expect(r.medianMsPerQuestion).toBe(4000);
    expect(r.avgMsPerQuestion).toBe(5000);
    // within budget (≤6000): 2000, 4000 ⇒ 2 of 3
    expect(r.withinBudget).toBe(2);
    expect(r.pctWithinBudget).toBeCloseTo(2 / 3, 6);
  });

  it("marks outcome submitted for a submitted session", () => {
    expect(r.outcome).toBe("submitted");
  });

  it("falls back completedAtTs → startedAtTs when absent", () => {
    const noCompletion = makeState({
      completedAtTs: undefined,
      startedAtTs: 42,
      questions: [q("q1", 0)],
      answers: [ans("q1", 0, 1000)],
    });
    expect(summarizeSession(noCompletion).completedAtTs).toBe(42);
  });

  it("marks outcome expired for an expired session", () => {
    const expired = makeState({
      status: "expired",
      questions: [q("q1", 0)],
      answers: [ans("q1", 0, 1000)],
    });
    expect(summarizeSession(expired).outcome).toBe("expired");
  });

  it("yields zero time stats + zero accuracy for an all-skipped session (no NaN)", () => {
    const skipped = summarizeSession(
      makeState({
        questions: [q("q1", 0), q("q2", 1)],
        answers: [ans("q1", null, 3000), ans("q2", null, 4000)],
      }),
    );
    expect(skipped.attempted).toBe(0);
    expect(skipped.correct).toBe(0);
    expect(skipped.accuracy).toBe(0);
    expect(skipped.medianMsPerQuestion).toBe(0);
    expect(skipped.avgMsPerQuestion).toBe(0);
    expect(skipped.withinBudget).toBe(0);
    expect(skipped.pctWithinBudget).toBe(0);
  });
});

/** Build an OaSessionResult from parts for the aggregation tests. */
const makeResult = (over: Partial<OaSessionResult> = {}): OaSessionResult => ({
  id: "r",
  formatId: "sprint-default",
  kind: "sprint",
  startedAtTs: 0,
  completedAtTs: 0,
  outcome: "submitted",
  score: 0,
  maxScore: 0,
  total: 0,
  attempted: 0,
  correct: 0,
  accuracy: 0,
  medianMsPerQuestion: 0,
  avgMsPerQuestion: 0,
  budgetMs: 6000,
  withinBudget: 0,
  pctWithinBudget: 0,
  hardMode: false,
  ...over,
});

describe("aggregateOaStats", () => {
  it("computes weighted avg, median-of-medians, and pooled ratios", () => {
    const results = [
      makeResult({
        attempted: 3,
        correct: 2,
        avgMsPerQuestion: 5000,
        medianMsPerQuestion: 4000,
        withinBudget: 2,
      }),
      makeResult({
        attempted: 2,
        correct: 1,
        avgMsPerQuestion: 3000,
        medianMsPerQuestion: 3000,
        withinBudget: 1,
      }),
    ];
    const agg = aggregateOaStats(results);
    expect(agg.sessions).toBe(2);
    expect(agg.totalAttempted).toBe(5);
    expect(agg.totalCorrect).toBe(3);
    expect(agg.accuracy).toBeCloseTo(3 / 5, 6);
    // attempted-weighted mean: (5000*3 + 3000*2) / 5 = 4200
    expect(agg.avgMsPerQuestion).toBe(4200);
    // median of per-session medians [4000, 3000] = 3500
    expect(agg.medianMsPerQuestion).toBe(3500);
    // pooled within-budget: (2 + 1) / 5
    expect(agg.pctWithinBudget).toBeCloseTo(3 / 5, 6);
  });

  it("excludes attempted===0 sessions from the median-of-medians", () => {
    const results = [
      makeResult({ attempted: 2, medianMsPerQuestion: 2000, avgMsPerQuestion: 2000 }),
      // Empty session: its stale 0-median must not drag the aggregate down.
      makeResult({ attempted: 0, medianMsPerQuestion: 0, avgMsPerQuestion: 0 }),
    ];
    expect(aggregateOaStats(results).medianMsPerQuestion).toBe(2000);
  });

  it("returns all zeros (never NaN) for empty results", () => {
    const agg = aggregateOaStats([]);
    expect(agg).toEqual({
      sessions: 0,
      totalAttempted: 0,
      totalCorrect: 0,
      accuracy: 0,
      medianMsPerQuestion: 0,
      avgMsPerQuestion: 0,
      pctWithinBudget: 0,
    });
  });
});

describe("avgTimeSeries", () => {
  it("sorts ascending by completedAtTs, keeps all kinds, drops attempted===0", () => {
    const results = [
      makeResult({ completedAtTs: 300, avgMsPerQuestion: 3000, attempted: 2, kind: "section" }),
      makeResult({ completedAtTs: 100, avgMsPerQuestion: 1000, attempted: 1, kind: "sprint" }),
      makeResult({ completedAtTs: 200, avgMsPerQuestion: 2000, attempted: 0, kind: "measured" }), // dropped
      makeResult({ completedAtTs: 400, avgMsPerQuestion: 4000, attempted: 3, kind: "measured" }),
    ];
    const series = avgTimeSeries(results);
    expect(series).toEqual([
      { at: 100, avgMsPerQuestion: 1000, kind: "sprint" },
      { at: 300, avgMsPerQuestion: 3000, kind: "section" },
      { at: 400, avgMsPerQuestion: 4000, kind: "measured" },
    ]);
  });

  it("does not mutate the input array order", () => {
    const results = [
      makeResult({ completedAtTs: 300, attempted: 1 }),
      makeResult({ completedAtTs: 100, attempted: 1 }),
    ];
    avgTimeSeries(results);
    expect(results[0].completedAtTs).toBe(300); // original order preserved
  });

  it("is empty for no results", () => {
    expect(avgTimeSeries([])).toEqual([]);
  });
});

describe("aggregateByFormat", () => {
  it("groups results by formatId (first-seen order) and aggregates each group", () => {
    const results = [
      makeResult({ formatId: "blitz", attempted: 4, correct: 3, withinBudget: 2, avgMsPerQuestion: 40_000, medianMsPerQuestion: 38_000 }),
      makeResult({ formatId: "deep-set", attempted: 2, correct: 2, withinBudget: 2, avgMsPerQuestion: 300_000, medianMsPerQuestion: 300_000 }),
      makeResult({ formatId: "blitz", attempted: 6, correct: 3, withinBudget: 3, avgMsPerQuestion: 50_000, medianMsPerQuestion: 45_000 }),
    ];
    const byFormat = aggregateByFormat(results);
    // First-seen order: blitz then deep-set.
    expect(byFormat.map((f) => f.formatId)).toEqual(["blitz", "deep-set"]);

    const blitz = byFormat[0];
    expect(blitz.sessions).toBe(2);
    expect(blitz.totalAttempted).toBe(10);
    expect(blitz.totalCorrect).toBe(6);
    expect(blitz.accuracy).toBeCloseTo(6 / 10, 6);
    // attempted-weighted avg: (40000*4 + 50000*6) / 10 = 46000
    expect(blitz.avgMsPerQuestion).toBe(46_000);
    expect(blitz.pctWithinBudget).toBeCloseTo(5 / 10, 6);

    const deep = byFormat[1];
    expect(deep.sessions).toBe(1);
    expect(deep.totalAttempted).toBe(2);
    expect(deep.accuracy).toBe(1);
  });

  it("each per-format group matches aggregateOaStats over that group's results", () => {
    const results = [
      makeResult({ formatId: "rapid-battery", attempted: 30, correct: 20, avgMsPerQuestion: 12_000 }),
      makeResult({ formatId: "rapid-battery", attempted: 25, correct: 15, avgMsPerQuestion: 14_000 }),
    ];
    const [row] = aggregateByFormat(results);
    const { ...expected } = aggregateOaStats(results);
    expect(row).toEqual({ formatId: "rapid-battery", ...expected });
  });

  it("is empty for no results", () => {
    expect(aggregateByFormat([])).toEqual([]);
  });
});
