import { describe, it, expect } from "vitest";
import {
  btoTierForIndex,
  buildBeatTheOddsPaper,
  buildBtoQuestion,
  choose,
  DEFAULT_BTO_COUNT,
} from "./beatTheOddsQuestions";
import { Rng } from "@/lib/rng";

/**
 * BEAT THE ODDS content generators: determinism, exact answers, and clean
 * five-option construction so the drill is fair and winnable.
 */

describe("choose (n over k)", () => {
  it("computes small binomials exactly", () => {
    expect(choose(5, 2)).toBe(10);
    expect(choose(4, 0)).toBe(1);
    expect(choose(6, 3)).toBe(20);
    expect(choose(3, 5)).toBe(0);
  });
});

describe("Beat the Odds — paper generation", () => {
  it("is deterministic: same seed ⇒ identical paper", () => {
    expect(buildBeatTheOddsPaper(42)).toEqual(buildBeatTheOddsPaper(42));
  });

  it("produces the default 20 questions with escalating tiers", () => {
    const paper = buildBeatTheOddsPaper(3);
    expect(paper).toHaveLength(DEFAULT_BTO_COUNT);
    expect(btoTierForIndex(0, 20)).toBe(1);
    expect(btoTierForIndex(10, 20)).toBe(2);
    expect(btoTierForIndex(19, 20)).toBe(3);
    expect(paper[0].tier).toBe(1);
    expect(paper[paper.length - 1].tier).toBe(3);
  });
});

describe("Beat the Odds — question validity", () => {
  const papers = [1, 2, 3, 4, 5, 6, 7, 8].flatMap((s) => buildBeatTheOddsPaper(s));

  it("every question has 5 distinct options containing the answer once", () => {
    for (const q of papers) {
      expect(q.options).toHaveLength(5);
      expect(new Set(q.options).size).toBe(5);
      expect(q.options.filter((o) => o === q.answer).length).toBe(1);
      expect(q.options[q.correctIndex]).toBe(q.answer);
    }
  });

  it("probability answers are valid probabilities in (0,1)", () => {
    for (const q of papers) {
      if (q.format === "percent") {
        expect(q.answer).toBeGreaterThan(0);
        expect(q.answer).toBeLessThanOrEqual(1);
      }
    }
  });

  it("EV answers are finite numbers", () => {
    for (const q of papers) {
      if (q.format === "ev") expect(Number.isFinite(q.answer)).toBe(true);
    }
  });

  it("has a non-empty prompt and explanation for every question", () => {
    for (const q of papers) {
      expect(q.prompt.trim().length).toBeGreaterThan(0);
      expect(q.explanation.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("buildBtoQuestion", () => {
  it("respects the requested tier", () => {
    expect(buildBtoQuestion(new Rng(1), 0, 3).tier).toBe(3);
  });
});
