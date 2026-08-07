import { describe, it, expect } from "vitest";
import {
  advanceBto,
  answerBto,
  BTO_BASE_POINTS,
  BTO_MAX_SPEED_BONUS,
  createBtoSession,
  currentQuestion,
  isQuestionExpired,
  paperFor,
  remainingMs,
  scoreItem,
  summarizeBto,
} from "./engine";

/**
 * BEAT THE ODDS engine: forward-only cursor, per-question wall-clock, speed-
 * weighted scoring, and winnability (a perfect fast solver maxes the score).
 */

describe("scoreItem", () => {
  it("is zero for a wrong or timed-out answer", () => {
    expect(scoreItem(1, false, 0)).toBe(0);
    expect(scoreItem(3, false, 0.1)).toBe(0);
  });

  it("rewards an instant correct answer with base + full speed bonus × tier", () => {
    expect(scoreItem(1, true, 0)).toBe(BTO_BASE_POINTS + BTO_MAX_SPEED_BONUS);
    expect(scoreItem(2, true, 0)).toBe(2 * (BTO_BASE_POINTS + BTO_MAX_SPEED_BONUS));
  });

  it("decays the speed bonus toward the budget (still >= base)", () => {
    const atBudget = scoreItem(1, true, 1);
    expect(atBudget).toBe(BTO_BASE_POINTS);
    const mid = scoreItem(1, true, 0.5);
    expect(mid).toBeGreaterThan(atBudget);
    expect(mid).toBeLessThan(BTO_BASE_POINTS + BTO_MAX_SPEED_BONUS);
  });
});

describe("Beat the Odds — session lifecycle", () => {
  it("commits, advances forward, and finishes at the end", () => {
    let s = createBtoSession({ seed: 9, nowTs: 0, count: 3 });
    const paper = paperFor(s);
    for (let i = 0; i < 3; i++) {
      const q = currentQuestion(s)!;
      expect(q).toEqual(paper[i]);
      s = answerBto(s, q.correctIndex, 0);
      s = advanceBto(s, 0);
    }
    expect(s.status).toBe("finished");
  });

  it("is idempotent: a second answer for the same item is ignored", () => {
    let s = createBtoSession({ seed: 9, nowTs: 0, count: 3 });
    const q = currentQuestion(s)!;
    s = answerBto(s, q.correctIndex, 0);
    const after = answerBto(s, (q.correctIndex + 1) % 5, 500);
    expect(after.answers[0]).toEqual(s.answers[0]);
  });

  it("auto-expires a question once its per-question clock elapses", () => {
    const s = createBtoSession({ seed: 9, nowTs: 0, count: 3, budgetMs: 1000 });
    expect(isQuestionExpired(s, 500)).toBe(false);
    expect(isQuestionExpired(s, 1000)).toBe(true);
    expect(remainingMs(s, 400)).toBe(600);
  });

  it("records a timeout as zero points", () => {
    let s = createBtoSession({ seed: 9, nowTs: 0, count: 2, budgetMs: 1000 });
    s = answerBto(s, null, 1000, true);
    expect(s.answers[0]!.points).toBe(0);
    expect(s.answers[0]!.correct).toBe(false);
  });
});

describe("Beat the Odds — winnability", () => {
  it("a perfect, instant solver scores the maximum", () => {
    let s = createBtoSession({ seed: 21, nowTs: 0, count: 20 });
    for (let i = 0; i < 20; i++) {
      const q = currentQuestion(s)!;
      s = answerBto(s, q.correctIndex, 0); // instant + correct
      s = advanceBto(s, 0);
    }
    const sum = summarizeBto(s);
    expect(sum.correct).toBe(20);
    expect(sum.accuracyPct).toBe(100);
    expect(sum.score).toBe(sum.maxScore);
  });

  it("an always-wrong player scores zero", () => {
    let s = createBtoSession({ seed: 21, nowTs: 0, count: 20 });
    for (let i = 0; i < 20; i++) {
      const q = currentQuestion(s)!;
      s = answerBto(s, (q.correctIndex + 1) % q.options.length, 0);
      s = advanceBto(s, 0);
    }
    const sum = summarizeBto(s);
    expect(sum.correct).toBe(0);
    expect(sum.score).toBe(0);
  });
});
