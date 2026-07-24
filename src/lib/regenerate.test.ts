import { describe, expect, it } from "vitest";
import type { Level } from "@/types/content";
import { gradeNumeric } from "@/lib/numeric";
import { PROB_GENERATORS } from "@/content/probability/generators";
import { makeKellyGenerator } from "@/content/probabilityStats/bettingSizing/generators";
import {
  canRegenerate,
  canRegenerateNumeric,
  canRegenerateQuiz,
  generateFreshNumericQuestion,
  generateFreshQuestion,
} from "./regenerate";

/** Minimal parametric quiz level backed by a real content generator. */
const quizLevel: Level = {
  id: "test-quiz",
  title: "Test Quiz",
  subtitle: "",
  blurb: "",
  difficulty: "easy",
  masteryThreshold: 0.8,
  questionCount: 5,
  generator: PROB_GENERATORS.genBinomial,
  lesson: { paragraphs: [] },
};

/** Minimal parametric numeric level backed by a real Kelly generator. */
const numericLevel: Level = {
  id: "test-numeric",
  title: "Test Numeric",
  subtitle: "",
  blurb: "",
  difficulty: "medium",
  mode: "numeric",
  masteryThreshold: 0.8,
  questionCount: 5,
  numericGenerator: makeKellyGenerator("cards", "decimal", "easy"),
  lesson: { paragraphs: [] },
};

/** A fixed-pool quiz level (no generator) — should not be regenerable. */
const fixedPoolLevel: Level = {
  id: "test-fixed",
  title: "Fixed",
  subtitle: "",
  blurb: "",
  difficulty: "easy",
  masteryThreshold: 0.8,
  questions: [
    {
      id: "q1",
      prompt: "1 + 1?",
      choices: ["2", "3", "4", "5"],
      correctIndex: 0,
      explanation: "It's 2.",
      difficulty: "easy",
    },
  ],
  lesson: { paragraphs: [] },
};

/** A static flashcard level — should not be regenerable. */
const flashcardLevel: Level = {
  id: "test-flash",
  title: "Flash",
  subtitle: "",
  blurb: "",
  difficulty: "easy",
  mode: "flashcard",
  masteryThreshold: 1,
  flashcards: [
    {
      id: "f1",
      prompt: "Why?",
      answer: "Because.",
      explanation: "Reasoning.",
      difficulty: "easy",
    },
  ],
  lesson: { paragraphs: [] },
};

describe("regenerate applicability", () => {
  it("detects parametric quiz / numeric levels", () => {
    expect(canRegenerateQuiz(quizLevel)).toBe(true);
    expect(canRegenerateNumeric(quizLevel)).toBe(false);
    expect(canRegenerateNumeric(numericLevel)).toBe(true);
    expect(canRegenerateQuiz(numericLevel)).toBe(false);
    expect(canRegenerate(quizLevel)).toBe(true);
    expect(canRegenerate(numericLevel)).toBe(true);
  });

  it("returns false / null for fixed-pool and flashcard levels", () => {
    expect(canRegenerate(fixedPoolLevel)).toBe(false);
    expect(canRegenerate(flashcardLevel)).toBe(false);
    expect(generateFreshQuestion(fixedPoolLevel, 1)).toBeNull();
    expect(generateFreshNumericQuestion(fixedPoolLevel, 1)).toBeNull();
    expect(generateFreshQuestion(flashcardLevel, 1)).toBeNull();
    expect(generateFreshNumericQuestion(flashcardLevel, 1)).toBeNull();
  });
});

describe("generateFreshQuestion (quiz)", () => {
  it("yields a valid, solver-consistent multiple-choice question", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const q = generateFreshQuestion(quizLevel, seed);
      expect(q).not.toBeNull();
      expect(q!.choices).toHaveLength(4);
      expect(new Set(q!.choices).size).toBe(4);
      expect(q!.correctIndex).toBeGreaterThanOrEqual(0);
      expect(q!.correctIndex).toBeLessThan(q!.choices.length);
      // The exact solver's answer is a real, present choice.
      expect(q!.choices[q!.correctIndex]).toBeTruthy();
      expect(q!.prompt.length).toBeGreaterThan(5);
      expect(q!.explanation.length).toBeGreaterThan(5);
      // Unique, seed-suffixed id for stable React keys.
      expect(q!.id).toContain(`-practice-${seed}`);
    }
  });

  it("is deterministic per seed but produces variety across seeds", () => {
    const a1 = generateFreshQuestion(quizLevel, 12345)!;
    const a2 = generateFreshQuestion(quizLevel, 12345)!;
    expect(a1.prompt).toBe(a2.prompt);
    expect(a1.choices).toEqual(a2.choices);

    const prompts = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) {
      prompts.add(generateFreshQuestion(quizLevel, seed)!.prompt);
    }
    // A fresh seed yields a genuinely different instance (not one frozen item).
    expect(prompts.size).toBeGreaterThan(1);
  });
});

describe("generateFreshNumericQuestion (numeric)", () => {
  it("yields items the exact solver grades as correct on their own answer", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const q = generateFreshNumericQuestion(numericLevel, seed);
      expect(q).not.toBeNull();
      expect(q!.prompt.length).toBeGreaterThan(5);
      expect(q!.explanation.length).toBeGreaterThan(5);
      expect(q!.id).toContain(`-practice-${seed}`);
      // Reusing the shared grader: the generated answer must grade correct.
      const grade = gradeNumeric(q!, String(q!.answer));
      expect(grade.correct).toBe(true);
    }
  });

  it("is deterministic per seed but produces variety across seeds", () => {
    const a1 = generateFreshNumericQuestion(numericLevel, 777)!;
    const a2 = generateFreshNumericQuestion(numericLevel, 777)!;
    expect(a1.prompt).toBe(a2.prompt);
    expect(a1.answer).toBe(a2.answer);

    const prompts = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) {
      prompts.add(generateFreshNumericQuestion(numericLevel, seed)!.prompt);
    }
    expect(prompts.size).toBeGreaterThan(1);
  });
});
