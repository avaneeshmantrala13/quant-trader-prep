import { describe, expect, it } from "vitest";
import {
  buildDiagnosticPlan,
  buildFollowUpPlan,
  outcomesFromAnswers,
  type PlanItem,
} from "./run";
import { diagnosticToSeeds } from "./diagnosticSeed";
import {
  COURSE_DIAGNOSTIC_BLUEPRINT,
  DIAGNOSTIC_BLUEPRINT,
  blueprintForMode,
  diagnosticMaxItemCount,
} from "@/content/diagnostic/blueprint";
import { topicsInCourse } from "@/lib/mode/courseMap";
import { topicKeyOf } from "@/lib/mastery/topicKey";

/**
 * PART A — the diagnostic is MODE-AWARE: Case A ("course") assesses the UT course
 * spine (Intro to Probability + Intro to Stochastic Processes, incl. the seven
 * ex-"Extra Relevant Knowledge" topics), Case B ("interview") the quant set. The
 * selected blueprint drives BOTH item selection and seeding, and the sensitive
 * ≤ 30-item guarantee holds for both.
 */

function allCorrect(plan: PlanItem[]): number[] {
  return plan.map((p) => p.item.correctIndex);
}

/** Full run: base + every gate opened (all-correct) + any tiebreaks. */
function fullRun(seed: number, blueprint = COURSE_DIAGNOSTIC_BLUEPRINT) {
  const base = buildDiagnosticPlan(seed, blueprint);
  const baseAnswers = allCorrect(base);
  const follow = buildFollowUpPlan(seed, base, baseAnswers, blueprint);
  const plan = [...base, ...follow];
  const answers = [...baseAnswers, ...allCorrect(follow)];
  return { plan, answers };
}

const COURSE_TOPIC_KEYS = new Set([
  ...topicsInCourse("m362k"),
  ...topicsInCourse("m362m"),
]);

const QUANT_ONLY = [
  topicKeyOf("mental-math"),
  topicKeyOf("interview-games"),
  topicKeyOf("probability", "Betting & Sizing"),
  topicKeyOf("probability", "Game Theory & Puzzles"),
  topicKeyOf("math-questions", "Rates, Algebra & Word Problems"),
  topicKeyOf("math-questions", "Number Theory & Counting"),
  topicKeyOf("math-questions", "Geometry & Derivations"),
];

describe("blueprintForMode", () => {
  it("selects the course blueprint for Case A and the interview one for Case B", () => {
    expect(blueprintForMode("course")).toBe(COURSE_DIAGNOSTIC_BLUEPRINT);
    expect(blueprintForMode("interview")).toBe(DIAGNOSTIC_BLUEPRINT);
  });
});

describe("course blueprint assesses the course topic set (not quant-only)", () => {
  it("every course slot's topicKey is a real course topic", () => {
    for (const slot of COURSE_DIAGNOSTIC_BLUEPRINT) {
      expect(COURSE_TOPIC_KEYS.has(slot.topicKey)).toBe(true);
    }
  });

  it("includes the ex-ERK first-class topics and drops quant-only topics", () => {
    const keys = new Set(COURSE_DIAGNOSTIC_BLUEPRINT.map((s) => s.topicKey));
    // Ex-"Extra Relevant Knowledge" topics are now first-class course topics.
    expect(keys.has(topicKeyOf("probability", "Moment Generating Functions"))).toBe(true);
    expect(keys.has(topicKeyOf("probability", "Joint Distributions"))).toBe(true);
    expect(keys.has(topicKeyOf("probability", "Branching Processes"))).toBe(true);
    expect(keys.has(topicKeyOf("probability", "Continuous-Time Markov Chains"))).toBe(true);
    expect(keys.has(topicKeyOf("probability", "Conditional Expectation"))).toBe(true);
    // Quant-only topics are NOT assessed in course mode.
    for (const q of QUANT_ONLY) expect(keys.has(q)).toBe(false);
  });

  it("the interview blueprint DOES assess quant-only topics (Case B unchanged)", () => {
    const keys = new Set(DIAGNOSTIC_BLUEPRINT.map((s) => s.topicKey));
    expect(keys.has(topicKeyOf("mental-math"))).toBe(true);
    expect(keys.has(topicKeyOf("interview-games"))).toBe(true);
  });

  it("draws real MCQ items for EVERY course slot on a full run", () => {
    const { plan } = fullRun(101);
    const seededSlots = new Set(plan.map((p) => p.topicKey));
    for (const slot of COURSE_DIAGNOSTIC_BLUEPRINT) {
      expect(seededSlots.has(slot.topicKey)).toBe(true);
    }
  });
});

describe("≤ 30-item guarantee holds for the course blueprint", () => {
  it("worst-case course run stays under 31 items", () => {
    const max = diagnosticMaxItemCount(COURSE_DIAGNOSTIC_BLUEPRINT);
    expect(max).toBeLessThanOrEqual(30);

    // Empirically: open every gate (base item0 correct) AND split every 2-item
    // base slot (item1 wrong) ⇒ the provable maximum.
    const base = buildDiagnosticPlan(77, COURSE_DIAGNOSTIC_BLUEPRINT);
    const answers = base.map((p) =>
      p.indexInSlot === 0 ? p.item.correctIndex : (p.item.correctIndex + 1) % p.item.choices.length,
    );
    const follow = buildFollowUpPlan(77, base, answers, COURSE_DIAGNOSTIC_BLUEPRINT);
    expect(base.length + follow.length).toBeLessThanOrEqual(max);
    expect(base.length + follow.length).toBeLessThanOrEqual(30);
  });
});

describe("course-mode seeding targets the correct per-mode topic set", () => {
  it("seeds course topics (incl. ex-ERK) and never quant-only topics", () => {
    const { plan, answers } = fullRun(202);
    const seeds = diagnosticToSeeds(
      outcomesFromAnswers(plan, answers, COURSE_DIAGNOSTIC_BLUEPRINT),
    );
    const seededKeys = new Set(seeds.map((s) => s.topicKey));

    // A representative course topic + an ex-ERK topic are seeded.
    expect(seededKeys.has(topicKeyOf("probability", "Core Probability"))).toBe(true);
    expect(seededKeys.has(topicKeyOf("probability", "Joint Distributions"))).toBe(true);
    // Nothing quant-only leaks into the course seeds.
    for (const q of QUANT_ONLY) expect(seededKeys.has(q)).toBe(false);
    // Every seeded key is a course topic.
    for (const k of seededKeys) expect(COURSE_TOPIC_KEYS.has(k)).toBe(true);
  });
});
