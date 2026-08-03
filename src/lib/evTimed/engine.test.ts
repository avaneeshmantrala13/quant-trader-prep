import { describe, expect, it } from "vitest";
import {
  CORRECT_BASE,
  MAX_ITEM_SCORE,
  SPEED_MAX,
  advanceEvTimed,
  answerCurrent,
  createEvTimedSession,
  currentItem,
  drawEvTimedItems,
  isAnswered,
  isQuestionExpired,
  remainingMs,
  scoreAnswer,
  summarize,
} from "./engine";
import { EV_TIMED_POOL } from "./pool";

const T0 = 1_000_000; // fixed epoch-ms base for determinism.
const SEED = 42;

/* -------------------------------------------------------------------------- */
/*  scoreAnswer — the pure timed-scoring primitive                             */
/* -------------------------------------------------------------------------- */

describe("scoreAnswer", () => {
  const budgetMs = 10_000;

  it("scores a wrong answer as the lowest possible (0)", () => {
    const wrongFast = scoreAnswer({ correct: false, elapsedMs: 0, budgetMs });
    const wrongSlow = scoreAnswer({
      correct: false,
      elapsedMs: budgetMs,
      budgetMs,
    });
    expect(wrongFast.points).toBe(0);
    expect(wrongSlow.points).toBe(0);
    expect(wrongFast.base).toBe(0);
    expect(wrongFast.speedBonus).toBe(0);
  });

  it("gives a correct answer the full speed bonus at 0 ms", () => {
    const s = scoreAnswer({ correct: true, elapsedMs: 0, budgetMs });
    expect(s.base).toBe(CORRECT_BASE);
    expect(s.speedBonus).toBe(SPEED_MAX);
    expect(s.points).toBe(MAX_ITEM_SCORE);
    expect(s.withinBudget).toBe(true);
  });

  it("keeps a correct answer above zero even past the budget (no speed bonus)", () => {
    const s = scoreAnswer({
      correct: true,
      elapsedMs: budgetMs * 2,
      budgetMs,
    });
    expect(s.points).toBe(CORRECT_BASE);
    expect(s.speedBonus).toBe(0);
    expect(s.withinBudget).toBe(false);
  });

  it("faster correct scores >= slower correct (monotonic non-increasing)", () => {
    const times = [0, 1_000, 2_500, 5_000, 9_999, 10_000, 20_000];
    const pts = times.map(
      (t) => scoreAnswer({ correct: true, elapsedMs: t, budgetMs }).points,
    );
    for (let i = 1; i < pts.length; i++) {
      expect(pts[i]).toBeLessThanOrEqual(pts[i - 1]);
    }
  });

  it("always ranks any correct answer strictly above any wrong answer", () => {
    const slowestCorrect = scoreAnswer({
      correct: true,
      elapsedMs: 1e9,
      budgetMs,
    }).points;
    const fastestWrong = scoreAnswer({
      correct: false,
      elapsedMs: 0,
      budgetMs,
    }).points;
    expect(slowestCorrect).toBeGreaterThan(fastestWrong);
  });

  it("flags within-budget correctly at the boundary", () => {
    expect(
      scoreAnswer({ correct: true, elapsedMs: budgetMs, budgetMs }).withinBudget,
    ).toBe(true);
    expect(
      scoreAnswer({ correct: true, elapsedMs: budgetMs + 1, budgetMs })
        .withinBudget,
    ).toBe(false);
  });

  it("degrades gracefully for a non-positive budget", () => {
    const s = scoreAnswer({ correct: true, elapsedMs: 500, budgetMs: 0 });
    expect(s.points).toBe(CORRECT_BASE);
    expect(s.withinBudget).toBe(false);
    expect(s.timeFraction).toBe(1);
  });
});

/* -------------------------------------------------------------------------- */
/*  Deterministic draw                                                         */
/* -------------------------------------------------------------------------- */

describe("drawEvTimedItems", () => {
  it("is deterministic by seed (same seed ⇒ identical items)", () => {
    const a = drawEvTimedItems(SEED, EV_TIMED_POOL.length);
    const b = drawEvTimedItems(SEED, EV_TIMED_POOL.length);
    expect(a.map((i) => i.question.id)).toEqual(b.map((i) => i.question.id));
    expect(a.map((i) => i.slotId)).toEqual(b.map((i) => i.slotId));
    expect(a.map((i) => i.question.correctIndex)).toEqual(
      b.map((i) => i.question.correctIndex),
    );
  });

  it("produces a different draw for a different seed (not degenerate)", () => {
    const a = drawEvTimedItems(SEED, EV_TIMED_POOL.length);
    const b = drawEvTimedItems(SEED + 1, EV_TIMED_POOL.length);
    const same =
      JSON.stringify(a.map((i) => [i.slotId, i.question.id])) ===
      JSON.stringify(b.map((i) => [i.slotId, i.question.id]));
    expect(same).toBe(false);
  });

  it("materializes valid 4-choice MCQs from the existing generators", () => {
    const items = drawEvTimedItems(SEED, EV_TIMED_POOL.length);
    expect(items.length).toBe(EV_TIMED_POOL.length);
    for (const it of items) {
      expect(it.question.choices.length).toBe(4);
      expect(it.question.correctIndex).toBeGreaterThanOrEqual(0);
      expect(it.question.correctIndex).toBeLessThan(4);
      expect(it.budgetMs).toBeGreaterThan(0);
    }
  });

  it("cycles the pool when count exceeds its size", () => {
    const n = EV_TIMED_POOL.length + 3;
    const items = drawEvTimedItems(SEED, n);
    expect(items.length).toBe(n);
  });

  it("returns nothing for an empty pool or non-positive count", () => {
    expect(drawEvTimedItems(SEED, 3, [])).toEqual([]);
    expect(drawEvTimedItems(SEED, 0)).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/*  Session state machine                                                      */
/* -------------------------------------------------------------------------- */

describe("createEvTimedSession", () => {
  it("opens a running session with the first question's clock started", () => {
    const s = createEvTimedSession({ seed: SEED, nowTs: T0 });
    expect(s.status).toBe("running");
    expect(s.index).toBe(0);
    expect(s.totalScore).toBe(0);
    expect(s.items.length).toBe(EV_TIMED_POOL.length);
    expect(s.questionDeadlineTs).toBe(T0 + s.items[0].budgetMs);
    expect(remainingMs(s, T0)).toBe(s.items[0].budgetMs);
  });

  it("is fully reproducible from seed", () => {
    const a = createEvTimedSession({ seed: SEED, nowTs: T0 });
    const b = createEvTimedSession({ seed: SEED, nowTs: T0 });
    expect(a.items.map((i) => i.question.id)).toEqual(
      b.items.map((i) => i.question.id),
    );
  });

  it("finishes immediately for an empty pool", () => {
    const s = createEvTimedSession({ seed: SEED, nowTs: T0, pool: [] });
    expect(s.status).toBe("finished");
    expect(s.completedAtTs).toBe(T0);
  });
});

describe("answerCurrent + advanceEvTimed", () => {
  it("scores a fast correct answer higher than a slow correct answer", () => {
    const s = createEvTimedSession({ seed: SEED, nowTs: T0 });
    const item = currentItem(s)!;
    const correct = item.question.correctIndex;

    const fast = answerCurrent(s, correct, T0 + 1_000);
    const slow = answerCurrent(s, correct, T0 + item.budgetMs - 500);

    expect(fast.answers[0].score!.base).toBe(CORRECT_BASE);
    expect(slow.answers[0].score!.base).toBe(CORRECT_BASE);
    expect(fast.answers[0].score!.points).toBeGreaterThanOrEqual(
      slow.answers[0].score!.points,
    );
    expect(fast.totalScore).toBeGreaterThanOrEqual(slow.totalScore);
  });

  it("scores a wrong answer below any correct answer and marks it", () => {
    const s = createEvTimedSession({ seed: SEED, nowTs: T0 });
    const item = currentItem(s)!;
    const wrongChoice = (item.question.correctIndex + 1) % 4;

    const wrong = answerCurrent(s, wrongChoice, T0 + 500);
    expect(wrong.answers[0].score!.points).toBe(0);
    expect(wrong.totalScore).toBe(0);
    expect(isAnswered(wrong, 0)).toBe(true);
  });

  it("treats a null (skip/timeout) commit as wrong and clamps elapsed to budget", () => {
    const s = createEvTimedSession({ seed: SEED, nowTs: T0 });
    const item = currentItem(s)!;
    const timedOut = answerCurrent(
      s,
      null,
      T0 + item.budgetMs + 5_000,
      true,
    );
    expect(timedOut.answers[0].score!.points).toBe(0);
    expect(timedOut.answers[0].timedOut).toBe(true);
    // Elapsed is clamped to the budget, so `timedOut` (not the boundary
    // within-budget flag) is the signal that time ran out.
    expect(timedOut.answers[0].elapsedMs).toBe(item.budgetMs);
    expect(timedOut.answers[0].score!.timeFraction).toBe(1);
  });

  it("does not double-score an already-answered question", () => {
    const s = createEvTimedSession({ seed: SEED, nowTs: T0 });
    const item = currentItem(s)!;
    const once = answerCurrent(s, item.question.correctIndex, T0 + 1_000);
    const twice = answerCurrent(once, item.question.correctIndex, T0 + 2_000);
    expect(twice).toBe(once);
  });

  it("advances with a fresh clock and finishes after the last item", () => {
    let s = createEvTimedSession({ seed: SEED, nowTs: T0 });
    let now = T0;
    const n = s.items.length;
    for (let i = 0; i < n; i++) {
      const item = currentItem(s)!;
      now += 1_000;
      s = answerCurrent(s, item.question.correctIndex, now);
      now += 500;
      const before = s.index;
      s = advanceEvTimed(s, now);
      if (i < n - 1) {
        expect(s.index).toBe(before + 1);
        expect(s.questionDeadlineTs).toBe(now + s.items[s.index].budgetMs);
        expect(s.status).toBe("running");
      }
    }
    expect(s.status).toBe("finished");
    expect(s.completedAtTs).toBe(now);
    expect(s.index).toBe(n);
  });

  it("is a no-op once the session is finished", () => {
    let s = createEvTimedSession({ seed: SEED, nowTs: T0, pool: [] });
    expect(s.status).toBe("finished");
    const after = answerCurrent(s, 0, T0 + 1_000);
    expect(after).toBe(s);
    expect(advanceEvTimed(s, T0 + 1_000)).toBe(s);
  });
});

describe("isQuestionExpired", () => {
  it("is false before and true at/after the deadline", () => {
    const s = createEvTimedSession({ seed: SEED, nowTs: T0 });
    const deadline = s.questionDeadlineTs;
    expect(isQuestionExpired(s, deadline - 1)).toBe(false);
    expect(isQuestionExpired(s, deadline)).toBe(true);
    expect(isQuestionExpired(s, deadline + 1_000)).toBe(true);
  });
});

describe("summarize", () => {
  it("aggregates correctness, within-budget and score", () => {
    let s = createEvTimedSession({ seed: SEED, nowTs: T0 });
    let now = T0;
    const n = s.items.length;
    // Answer every item correctly, fast (well within budget).
    for (let i = 0; i < n; i++) {
      const item = currentItem(s)!;
      now += 1_000;
      s = answerCurrent(s, item.question.correctIndex, now);
      now += 100;
      s = advanceEvTimed(s, now);
    }
    const sum = summarize(s);
    expect(sum.total).toBe(n);
    expect(sum.answered).toBe(n);
    expect(sum.correct).toBe(n);
    expect(sum.withinBudget).toBe(n);
    expect(sum.accuracy).toBe(1);
    expect(sum.score).toBe(s.totalScore);
    expect(sum.maxScore).toBe(n * MAX_ITEM_SCORE);
    expect(sum.avgElapsedMs).toBeGreaterThan(0);
  });

  it("counts a wrong answer toward answered but not correct", () => {
    let s = createEvTimedSession({ seed: SEED, nowTs: T0 });
    const item = currentItem(s)!;
    s = answerCurrent(s, (item.question.correctIndex + 1) % 4, T0 + 500);
    const sum = summarize(s);
    expect(sum.answered).toBe(1);
    expect(sum.correct).toBe(0);
    expect(sum.withinBudget).toBe(0);
  });
});
