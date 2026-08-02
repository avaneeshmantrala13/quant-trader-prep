import { describe, expect, it } from "vitest";
import { questionPace, sectionPace } from "./pacing";

describe("questionPace", () => {
  it("derives remaining, fraction, band, and overBudget mid-budget", () => {
    const s = questionPace(3000, 6000);
    expect(s.budgetMs).toBe(6000);
    expect(s.elapsedMs).toBe(3000);
    expect(s.remainingMs).toBe(3000);
    expect(s.fraction).toBeCloseTo(0.5, 6);
    expect(s.band).toBe("on-pace");
    expect(s.overBudget).toBe(false);
  });

  it("clamps remaining at 0 and flags overBudget past the budget", () => {
    const s = questionPace(8000, 6000);
    expect(s.remainingMs).toBe(0);
    expect(s.fraction).toBe(1);
    expect(s.band).toBe("over");
    expect(s.overBudget).toBe(true);
  });

  it("treats negative elapsed as 0", () => {
    const s = questionPace(-500, 6000);
    expect(s.elapsedMs).toBe(0);
    expect(s.remainingMs).toBe(6000);
    expect(s.band).toBe("ahead");
  });
});

describe("sectionPace", () => {
  it("projects on-track when the current pace clears every question", () => {
    // 10 done in 60s ⇒ 6s/q; 90s left ⇒ 15 more projected ⇒ 25 total ≥ 20.
    const s = sectionPace({
      answered: 10,
      total: 20,
      elapsedMs: 60_000,
      remainingMs: 90_000,
    });
    expect(s.msPerQuestion).toBe(6000);
    expect(s.projectedRemaining).toBe(15);
    expect(s.projectedTotal).toBe(25);
    expect(s.onTrack).toBe(true);
  });

  it("projects behind when the pace is too slow", () => {
    // 10 done in 120s ⇒ 12s/q; 30s left ⇒ 2 more ⇒ 12 total < 20.
    const s = sectionPace({
      answered: 10,
      total: 20,
      elapsedMs: 120_000,
      remainingMs: 30_000,
    });
    expect(s.projectedRemaining).toBe(2);
    expect(s.projectedTotal).toBe(12);
    expect(s.onTrack).toBe(false);
  });

  it("before the first answer, assumes the remaining questions (no data yet)", () => {
    const s = sectionPace({
      answered: 0,
      total: 20,
      elapsedMs: 0,
      remainingMs: 120_000,
    });
    expect(s.msPerQuestion).toBe(0);
    expect(s.projectedRemaining).toBe(20);
    expect(s.onTrack).toBe(true);
  });
});
