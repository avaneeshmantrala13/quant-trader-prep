import { describe, expect, it } from "vitest";
import type { Level, NumericQuestion } from "@/types/content";
import { buildWorkedSibling } from "./workedSibling";
import { materializeNumericLevel } from "@/content/materialize";
import { orderStatisticsLevels } from "@/content/probabilityStats/orderStatistics/levels";
import { interviewGamesTrack } from "@/content/interviewGames/levels";
import { formatNumericAnswer } from "@/lib/numeric";

/**
 * Rung 3 ("study a worked sibling") must render a REAL worked example: a fresh
 * same-family instance with DIFFERENT numbers, its ordered solution steps, and
 * its OWN final answer — and it must never leak the current item's answer.
 */
describe("buildWorkedSibling — generator-based numeric topic (Order Statistics)", () => {
  const level = orderStatisticsLevels[0];

  it("is a representative generator-based numeric level (precondition)", () => {
    expect(typeof level.numericGenerator).toBe("function");
  });

  it("produces a CONCRETE sibling for every materialized item: prompt, numbered steps, final answer", () => {
    // Several seeds so all three families (min / ordering / median) are covered.
    for (const seed of [1, 7, 42, 101, 999]) {
      for (const q of materializeNumericLevel(level, seed)) {
        const sib = buildWorkedSibling({ level, question: q, seed: seed * 31 + 5 });
        expect(sib, `sibling for ${q.id}`).not.toBeNull();
        if (!sib) continue;

        // A real problem statement...
        expect(sib.prompt.trim().length).toBeGreaterThan(0);
        // ...ordered worked steps that carry concrete numbers...
        expect(sib.steps.length).toBeGreaterThan(0);
        expect(sib.steps.some((s) => /\d/.test(s))).toBe(true);
        // ...and the sibling's own final answer.
        expect(sib.answer.trim().length).toBeGreaterThan(0);
        expect(/\d/.test(sib.answer)).toBe(true);
      }
    }
  });

  it("uses DIFFERENT numbers than the current item and never leaks its answer", () => {
    for (const seed of [3, 21, 88, 256]) {
      for (const q of materializeNumericLevel(level, seed)) {
        const sib = buildWorkedSibling({ level, question: q, seed: seed * 13 + 2 });
        expect(sib).not.toBeNull();
        if (!sib) continue;

        // The sibling's answer differs from the current item's answer (rounded to
        // the item's own precision) — so rung 3 cannot reveal the current answer.
        const currentAnswer = formatNumericAnswer(q);
        expect(sib.answer).not.toContain(currentAnswer);

        // The sibling's steps do not contain the current item's exact answer token.
        for (const step of sib.steps) {
          expect(step.includes(currentAnswer)).toBe(false);
        }

        // Different numbers ⇒ a different problem statement.
        expect(sib.prompt).not.toBe(q.prompt);
      }
    }
  });

  it("is deterministic for a fixed seed (reproducible in save/resume + tests)", () => {
    const q = materializeNumericLevel(level, 5)[0];
    const a = buildWorkedSibling({ level, question: q, seed: 777 });
    const b = buildWorkedSibling({ level, question: q, seed: 777 });
    expect(a).toEqual(b);
  });
});

describe("buildWorkedSibling — the ig-max-dice screenshot item (Interview Games ig-1)", () => {
  const ig1 = interviewGamesTrack.levels.find((l) => l.id === "ig-1")!;

  /** Materialize ig-1 across seeds and collect the expected-maximum instances. */
  function expectedMaxInstances() {
    const out = [] as ReturnType<typeof materializeNumericLevel>;
    for (const seed of [1, 2, 3, 5, 8, 13, 21, 34, 55, 89]) {
      for (const q of materializeNumericLevel(ig1, seed)) {
        if (q.concept === "Order statistics / expected maximum") out.push(q);
      }
    }
    return out;
  }

  it("ig-1 actually produces expected-maximum (order-statistic) instances", () => {
    expect(expectedMaxInstances().length).toBeGreaterThan(0);
  });

  it("now renders a REAL worked sibling (prompt + steps + answer), no generic caption", () => {
    for (const q of expectedMaxInstances()) {
      const sib = buildWorkedSibling({ level: ig1, question: q, seed: 424242 });
      // A concrete worked example — NOT null (the old generic-caption fallback).
      expect(sib, `sibling for ${q.id}`).not.toBeNull();
      if (!sib) continue;
      expect(sib.prompt).toMatch(/expected value of the LARGEST/i);
      expect(sib.steps.length).toBeGreaterThan(0);
      expect(sib.steps.some((s) => /\d/.test(s))).toBe(true);
      expect(/\d/.test(sib.answer)).toBe(true);

      // Different numbers ⇒ different problem, and it never leaks the current
      // answer (compared by VALUE at the item's own precision, the true leak
      // semantics — a longer decimal coincidentally sharing digits is fine).
      expect(sib.prompt).not.toBe(q.prompt);
      const f = 10 ** (q.decimals ?? 2);
      const sibValue = Number(sib.answer.replace(/[^0-9.\-]/g, ""));
      expect(Math.round(sibValue * f)).not.toBe(Math.round(q.answer * f));
    }
  });
});

describe("buildWorkedSibling — static-pool fallback (no generator)", () => {
  const numQ = (over: Partial<NumericQuestion>): NumericQuestion => ({
    id: "s-1",
    prompt: "Q1?",
    answer: 1,
    difficulty: "easy",
    explanation: "Step one. Step two, so the answer is 1.",
    unit: "",
    concept: "widget-ev",
    ...over,
  });

  it("returns a same-concept, different-answer pool item's worked solution", () => {
    const current = numQ({ id: "s-1", answer: 1 });
    const sibling = numQ({
      id: "s-2",
      prompt: "A different widget problem with other numbers?",
      answer: 2,
      explanation: "First find the parts. Then combine them, so the answer is 2.",
    });
    const level: Level = {
      id: "static-lvl",
      title: "t",
      subtitle: "s",
      blurb: "b",
      difficulty: "easy",
      mode: "numeric",
      masteryThreshold: 0.8,
      numericQuestions: [current, sibling],
      lesson: { paragraphs: [] },
    };
    const sib = buildWorkedSibling({ level, question: current });
    expect(sib).not.toBeNull();
    expect(sib?.prompt).toBe(sibling.prompt);
    expect(sib?.steps.length).toBeGreaterThan(0);
    expect(sib?.answer).toBe("2");
  });

  it("returns null (→ generic caption) when the concept is unique in a static pool", () => {
    const current = numQ({ id: "u-1", answer: 1, concept: "unique-concept" });
    const other = numQ({ id: "u-2", answer: 2, concept: "some-other-concept" });
    const level: Level = {
      id: "static-lvl-2",
      title: "t",
      subtitle: "s",
      blurb: "b",
      difficulty: "easy",
      mode: "numeric",
      masteryThreshold: 0.8,
      numericQuestions: [current, other],
      lesson: { paragraphs: [] },
    };
    expect(buildWorkedSibling({ level, question: current })).toBeNull();
  });
});
