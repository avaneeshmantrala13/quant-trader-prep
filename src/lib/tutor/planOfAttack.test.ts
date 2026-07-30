import { describe, expect, it } from "vitest";
import { planOfAttack, GENERIC_PLAN } from "./planOfAttack";
import type { PlanContext } from "./plans/types";
import { MISCONCEPTION } from "./misconception";

/**
 * Rung-2 "guided plan of attack" guards. A plan must:
 *  - be PRESENT and QUESTION-DRIVEN (names WHAT to determine, ≥ 2 questions);
 *  - never spell out the corrective OPERATION/rule;
 *  - never be a rung-4-style visualization ("draw / visualize / simulate");
 *  - never contain a computed answer (checked here as "no stray decimals").
 */

/** Corrective operations / rules that rung 2 must never spell out. */
const OPERATION_LEAK =
  /\bmultiply\b|\bdivide\b|\bsubtract\b|\bproduct\b|\bfactorial\b|\bn ?choose ?k\b|1\s*[−-]\s*p\b|×|·/i;
/** Rung-4 visualization content that rung 2 must not duplicate. */
const VISUALIZATION_LEAK = /\bdraw\b|\bsketch\b|\bpicture\b|\bvenn\b|visuali|simulat|diagram/i;

function questionCount(s: string): number {
  return (s.match(/\?/g) ?? []).length;
}

/** One representative context per section/family/misconception across the app. */
const CONTEXTS: { label: string; ctx: PlanContext }[] = [
  { label: "prob: independent AND", ctx: { family: "genIntersectionIndep" } },
  { label: "prob: union", ctx: { family: "genUnion" } },
  { label: "prob: at least one", ctx: { family: "genAtLeastOne" } },
  {
    label: "prob: gambler's fallacy",
    ctx: { misconceptionTag: MISCONCEPTION.gamblersFallacy },
  },
  {
    label: "conditional: Bayes",
    ctx: { misconceptionTag: MISCONCEPTION.baseRateNeglect },
  },
  { label: "conditional (section)", ctx: { section: "Conditional Probability" } },
  { label: "core probability (section)", ctx: { section: "Core Probability" } },
  { label: "expected value (section)", ctx: { section: "Expected Value" } },
  { label: "betting & sizing (section)", ctx: { section: "Betting & Sizing" } },
  {
    label: "combinatorial (section)",
    ctx: { section: "Combinatorial Analysis" },
  },
  { label: "markov (section)", ctx: { section: "Markov Chains" } },
  {
    label: "variance/CLT (section)",
    ctx: { section: "Variance, Covariance & the CLT" },
  },
  { label: "order statistics (section)", ctx: { section: "Order Statistics" } },
  { label: "poisson (section)", ctx: { section: "Poisson Processes" } },
  { label: "brownian (section)", ctx: { section: "Brownian Motion" } },
  {
    label: "geometric probability (section)",
    ctx: { section: "Geometric Probability" },
  },
  {
    label: "game theory (section)",
    ctx: { section: "Game Theory & Puzzles" },
  },
  { label: "mental math (section)", ctx: { section: "Mental Math" } },
  { label: "math questions (section)", ctx: { section: "Math Questions" } },
  { label: "interview games (section)", ctx: { section: "Interview Games" } },
  { label: "extra knowledge (section)", ctx: { section: "Extra Knowledge" } },
];

describe("planOfAttack — rung-2 guided plan of attack", () => {
  it.each(CONTEXTS)(
    "$label → present, question-driven, no operation/visualization leak",
    ({ ctx }) => {
      const plan = planOfAttack(ctx);
      expect(plan.trim().length).toBeGreaterThan(40);
      // Question-driven: names WHAT to determine with ≥ 2 leading questions.
      expect(questionCount(plan)).toBeGreaterThanOrEqual(2);
      // Never spells out the corrective operation/rule.
      expect(plan).not.toMatch(OPERATION_LEAK);
      // Never a rung-4-style visualization.
      expect(plan).not.toMatch(VISUALIZATION_LEAK);
      // No stray decimal number (a plan carries no computed answer).
      expect(plan).not.toMatch(/\b\d+\.\d+\b/);
    },
  );

  it("falls back to the generic plan for an unknown context", () => {
    const plan = planOfAttack({});
    expect(plan).toBe(GENERIC_PLAN);
    expect(questionCount(plan)).toBeGreaterThanOrEqual(2);
    expect(plan).not.toMatch(OPERATION_LEAK);
    expect(plan).not.toMatch(VISUALIZATION_LEAK);
  });

  it("resolves a domain-specific (non-generic) plan for a known family", () => {
    expect(planOfAttack({ family: "genIntersectionIndep" })).not.toBe(
      GENERIC_PLAN,
    );
    expect(planOfAttack({ section: "Markov Chains" })).not.toBe(GENERIC_PLAN);
  });
});
