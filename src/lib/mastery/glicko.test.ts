import { describe, expect, it } from "vitest";
import {
  GLICKO_DEFAULT_RATING,
  GLICKO_INITIAL_RD,
  GLICKO_MAX_RD,
  GLICKO_MIN_RD,
  expectedScore,
  gFactor,
  glickoRatingToLogit,
  inflateRd,
  initialGlicko,
  logitToGlickoRating,
  updateGlicko,
  updateItemDifficulty,
  updateItemDifficultyFromAttempt,
} from "./glicko";
import type { ItemAttempt } from "@/types/mastery";

describe("gFactor / expectedScore", () => {
  it("g is 1 at RD 0 and shrinks as RD grows", () => {
    expect(gFactor(0)).toBeCloseTo(1, 12);
    expect(gFactor(350)).toBeLessThan(1);
    expect(gFactor(350)).toBeGreaterThan(0);
  });

  it("expected score is 0.5 for equal ratings and monotone in rating gap", () => {
    expect(expectedScore(1500, 1500, 50)).toBeCloseTo(0.5, 12);
    expect(expectedScore(1700, 1500, 50)).toBeGreaterThan(0.5);
    expect(expectedScore(1300, 1500, 50)).toBeLessThan(0.5);
  });
});

describe("updateGlicko", () => {
  it("raises rating on a win and shrinks RD with evidence", () => {
    const prior = initialGlicko();
    const after = updateGlicko(prior, [
      { rating: 1500, rd: 50, score: 1 },
    ]);
    expect(after.rating).toBeGreaterThan(prior.rating);
    expect(after.rd).toBeLessThan(prior.rd);
    expect(after.rd).toBeGreaterThanOrEqual(GLICKO_MIN_RD);
  });

  it("lowers rating on a loss", () => {
    const after = updateGlicko(initialGlicko(), [
      { rating: 1500, rd: 50, score: 0 },
    ]);
    expect(after.rating).toBeLessThan(GLICKO_DEFAULT_RATING);
  });

  it("no matches leaves the rating unchanged", () => {
    const prior = { rating: 1620, rd: 120 };
    const after = updateGlicko(prior, []);
    expect(after.rating).toBe(1620);
  });
});

describe("inflateRd", () => {
  it("is a no-op for zero/negative idle time (capped at max)", () => {
    expect(inflateRd(80, 0)).toBe(80);
    expect(inflateRd(80, -5)).toBe(80);
  });

  it("grows RD with idle days but never exceeds the ceiling", () => {
    expect(inflateRd(80, 30)).toBeGreaterThan(80);
    expect(inflateRd(300, 100000)).toBe(GLICKO_MAX_RD);
  });
});

describe("updateItemDifficulty", () => {
  it("a learner MISS makes the item look HARDER (rating up)", () => {
    const after = updateItemDifficulty(undefined, {
      correct: false,
      learnerRating: GLICKO_DEFAULT_RATING,
    });
    expect(after.rating).toBeGreaterThan(GLICKO_DEFAULT_RATING);
    expect(after.rd).toBeLessThan(GLICKO_INITIAL_RD);
  });

  it("a learner CORRECT makes the item look EASIER (rating down)", () => {
    const after = updateItemDifficulty(undefined, {
      correct: true,
      learnerRating: GLICKO_DEFAULT_RATING,
    });
    expect(after.rating).toBeLessThan(GLICKO_DEFAULT_RATING);
  });

  it("re-inflates RD over idle time before folding a new outcome", () => {
    const t0 = "2026-01-01T00:00:00.000Z";
    const settled = updateItemDifficulty(undefined, {
      correct: false,
      learnerRating: 1600,
      at: t0,
    });
    // A second, much-later attempt: RD was re-inflated, so it moves more than an
    // immediately-following attempt would from the same settled state.
    const soon = updateItemDifficulty(settled, {
      correct: true,
      learnerRating: 1600,
      at: "2026-01-01T01:00:00.000Z",
    });
    const late = updateItemDifficulty(settled, {
      correct: true,
      learnerRating: 1600,
      at: "2027-06-01T00:00:00.000Z",
    });
    expect(Math.abs(late.rating - settled.rating)).toBeGreaterThan(
      Math.abs(soon.rating - settled.rating),
    );
    expect(late.lastAt).toBe("2027-06-01T00:00:00.000Z");
  });

  it("honors fractional partial credit as a soft outcome", () => {
    const miss = updateItemDifficulty(undefined, {
      correct: false,
      score: 0,
      learnerRating: 1500,
    });
    const partial = updateItemDifficulty(undefined, {
      correct: false,
      score: 0.5,
      learnerRating: 1500,
    });
    // A half-credit outcome is weaker "harder" evidence than a clean miss.
    expect(partial.rating).toBeLessThan(miss.rating);
  });
});

describe("updateItemDifficultyFromAttempt", () => {
  it("reads correct/credit/at off an ItemAttempt", () => {
    const a: ItemAttempt = {
      topicKey: "probability::_core",
      tier: "medium",
      correct: true,
      mode: "numeric",
      at: "2026-02-02T00:00:00.000Z",
    };
    const after = updateItemDifficultyFromAttempt(undefined, a, 1500);
    expect(after.rating).toBeLessThan(GLICKO_DEFAULT_RATING);
    expect(after.lastAt).toBe("2026-02-02T00:00:00.000Z");
  });
});

describe("logit ⇄ Glicko rating conversion", () => {
  it("round-trips", () => {
    for (const theta of [-2, -0.5, 0, 1.3, 2.7]) {
      expect(glickoRatingToLogit(logitToGlickoRating(theta))).toBeCloseTo(theta, 10);
    }
    expect(logitToGlickoRating(0)).toBe(GLICKO_DEFAULT_RATING);
  });
});
