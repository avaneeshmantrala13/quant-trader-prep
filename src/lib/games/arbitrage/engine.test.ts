import { describe, expect, it } from "vitest";
import {
  ARBITRAGE_DRILL_POOL,
  buildArbitrageDrill,
  gradeNumericItem,
  gradeQuizItem,
  scoreDrill,
} from "./engine";

const SEEDS = [1, 7, 42, 99, 256, 1000, 31337];

describe("arbitrage drill engine", () => {
  it("pool contains every quiz + numeric family", () => {
    const quiz = ARBITRAGE_DRILL_POOL.filter((g) => g.kind === "quiz");
    const numeric = ARBITRAGE_DRILL_POOL.filter((g) => g.kind === "numeric");
    expect(quiz.length).toBe(3);
    expect(numeric.length).toBe(5);
  });

  it("builds `count` items with unique ids and valid questions", () => {
    for (const seed of SEEDS) {
      const items = buildArbitrageDrill(seed, 10);
      expect(items).toHaveLength(10);
      expect(new Set(items.map((i) => i.id)).size).toBe(10);
      for (const it of items) {
        expect(it.question.prompt.length).toBeGreaterThan(10);
        if (it.kind === "quiz") {
          expect(it.question.choices).toHaveLength(4);
          expect(it.question.correctIndex).toBeGreaterThanOrEqual(0);
        } else {
          expect(Number.isFinite(it.question.answer)).toBe(true);
        }
      }
    }
  });

  it("is deterministic for a given seed", () => {
    for (const seed of SEEDS) {
      expect(buildArbitrageDrill(seed, 8)).toEqual(buildArbitrageDrill(seed, 8));
    }
  });

  it("grades the correct choice / value as correct and errors as wrong", () => {
    const items = buildArbitrageDrill(42, 12);
    for (const it of items) {
      if (it.kind === "quiz") {
        expect(gradeQuizItem(it, it.question.correctIndex).correct).toBe(true);
        const wrong = (it.question.correctIndex + 1) % 4;
        expect(gradeQuizItem(it, wrong).correct).toBe(false);
      } else {
        const decimals = it.question.decimals ?? 0;
        const answerStr = it.question.answer.toFixed(decimals);
        expect(gradeNumericItem(it, answerStr).correct).toBe(true);
        // A known common-error value must grade wrong and surface its feedback.
        const err = it.question.commonErrors?.[0];
        if (err) {
          const g = gradeNumericItem(it, err.value.toFixed(decimals));
          expect(g.correct).toBe(false);
          expect(g.matchedError?.misconception).toBe(err.misconception);
        }
      }
    }
  });

  it("scoreDrill tallies answered / correct / pct", () => {
    const s = scoreDrill([true, false, true, null], 4);
    expect(s.answered).toBe(3);
    expect(s.correct).toBe(2);
    expect(s.total).toBe(4);
    expect(s.pct).toBe(50);
  });
});
