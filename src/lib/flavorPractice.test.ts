import { describe, expect, it } from "vitest";
import type { NumericQuestion, Question } from "@/types/content";
import type { FlavoredVariant } from "./aiFlavor";
import { resolveFlavoredItem } from "./flavorPractice";

/**
 * The "✨ Fresh variant" control composes a FRESH PARAMETRIC item with the
 * optional LLM flavor layer. These units pin the one property that must hold:
 * the parametric item (its solver answer/options) is preserved unless a genuine
 * AI/stub reskin passed — null / "fallback" degrade to the fresh item verbatim.
 */

const freshQuiz: Question = {
  id: "q-practice-42",
  prompt: "Original parametric prompt with $1,000 and 200.",
  choices: ["300", "400", "500", "600"],
  correctIndex: 0,
  explanation: "Solver-derived.",
  difficulty: "easy",
};

const freshNumeric: NumericQuestion = {
  id: "n-practice-7",
  prompt: "Size a $1,000 bankroll at 200 odds.",
  answer: 300,
  explanation: "Solver-derived.",
  difficulty: "medium",
};

describe("resolveFlavoredItem — graceful fallback composition", () => {
  it("keeps the fresh parametric item when the flavor layer is off (null)", () => {
    expect(resolveFlavoredItem(freshQuiz, null)).toBe(freshQuiz);
    expect(resolveFlavoredItem(freshNumeric, null)).toBe(freshNumeric);
  });

  it("keeps the fresh parametric item on a guardrail 'fallback' result", () => {
    // aiFlavor returns the ORIGINAL question on fallback; we must keep it.
    const variant: FlavoredVariant<Question> = {
      question: freshQuiz,
      source: "fallback",
    };
    expect(resolveFlavoredItem(freshQuiz, variant)).toBe(freshQuiz);
  });

  it("uses the reskinned question on an 'ai' result (only prompt changed)", () => {
    const reskinned: Question = {
      ...freshQuiz,
      prompt: "Reskinned narrative that still cites $1,000 and 200.",
    };
    const variant: FlavoredVariant<Question> = {
      question: reskinned,
      source: "ai",
    };
    const out = resolveFlavoredItem(freshQuiz, variant);
    expect(out).toBe(reskinned);
    // Answer/options are untouched by the flavor layer.
    expect(out.choices).toEqual(freshQuiz.choices);
    expect(out.correctIndex).toBe(freshQuiz.correctIndex);
  });

  it("uses the (unchanged) question on a 'stub' result", () => {
    const variant: FlavoredVariant<NumericQuestion> = {
      question: freshNumeric,
      source: "stub",
    };
    const out = resolveFlavoredItem(freshNumeric, variant);
    expect(out).toBe(freshNumeric);
    expect(out.answer).toBe(300);
  });
});
