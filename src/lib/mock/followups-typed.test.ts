import { describe, expect, it } from "vitest";
import {
  buildAiFollowup,
  buildFollowupPresentations,
  gradeFollowup,
  gradeReasoningConclusion,
} from "./followups";
import { _pools, type MockNumericQuestion } from "./questionPools";
import { Rng } from "@/lib/rng";
import type { FollowupPresentation } from "./types";

/**
 * ISSUE A — follow-ups are graded BY THEIR TYPE. Open/reasoning follow-ups are
 * credited when the written reasoning reaches the correct conclusion and are
 * NEVER marked "missed" by single-numeric extraction; crisp numeric follow-ups
 * keep exact numeric grading.
 *
 * ISSUE B — follow-ups are CONCEPT-SPECIFIC (authored by the question generator
 * from its own setup), NOT arithmetic on the previous answer. Probes are clean
 * numeric targets; adversarials challenge the underlying logic.
 */

/** Draw every question a pool can produce across many seeds. */
function drawAll(pool: ((rng: Rng) => MockNumericQuestion)[]): MockNumericQuestion[] {
  const out: MockNumericQuestion[] = [];
  for (const gen of pool) {
    for (let seed = 1; seed <= 12; seed++) out.push(gen(new Rng(seed)));
  }
  return out;
}

const ALL_CONCEPTUAL = [
  ..._pools.PROB_EV_MEDIUM,
  ..._pools.PROB_EV_HARD,
  ..._pools.PROB_EV_STRETCH,
  ..._pools.SEQUENCE_MEDIUM,
  ..._pools.SEQUENCE_HARD,
  ..._pools.ESTIMATION_POOL,
];

/* -------------------------------------------------------------------------- */
/*  A — reasoning-typed grading                                                 */
/* -------------------------------------------------------------------------- */

function reasoningFu(
  over: Partial<FollowupPresentation> = {},
): FollowupPresentation {
  return {
    prompt:
      "Are the odds internally consistent? State the implied-probability sum and whether the book is overround.",
    source: "authored",
    role: "adversarial",
    label: "Follow-up 2 of 2 · Adversarial",
    answerKind: "reasoning",
    conclusionTargets: [1.125],
    conclusionKeywords: [["overround", "inconsistent", "not consistent"]],
    targetMs: 15000,
    ...over,
  };
}

describe("reasoning follow-ups — conclusion-graded, never a false miss", () => {
  it("credits a correct written argument (right number + conclusion word)", () => {
    const fu = reasoningFu();
    const score = gradeFollowup(
      fu,
      "The implied probabilities sum to 1.125, so the book is overround — not consistent.",
      6000,
    );
    expect(score?.correct).toBe(true);
  });

  it("does NOT mark a correct reasoning answer as missed", () => {
    const fu = reasoningFu();
    expect(gradeFollowup(fu, "sum = 1.125, overround", 4000)?.correct).toBe(true);
  });

  it("withholds credit when the conclusion value is wrong", () => {
    const fu = reasoningFu();
    expect(gradeFollowup(fu, "sum is 1.0, so it's a fair book", 4000)?.correct).toBe(
      false,
    );
  });

  it("withholds credit when the required conclusion word is missing", () => {
    const fu = reasoningFu();
    expect(gradeFollowup(fu, "1.125", 4000)?.correct).toBe(false);
  });

  it("falls back to a substantive-answer gate when nothing is verifiable", () => {
    const fu = reasoningFu({ conclusionTargets: undefined, conclusionKeywords: undefined });
    expect(
      gradeReasoningConclusion(
        fu,
        "Because the two implied probabilities exceed one, there is a margin.",
        5000,
      ).correct,
    ).toBe(true);
    expect(gradeReasoningConclusion(fu, "", 5000).correct).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/*  Concept-specific authored follow-ups (from the generators themselves)      */
/* -------------------------------------------------------------------------- */

describe("authored follow-ups are concept-tied, distinct, and gradable", () => {
  it("every conceptual question authors a numeric probe + a distinct adversarial", () => {
    for (const q of drawAll(ALL_CONCEPTUAL)) {
      expect(q.followups).toBeDefined();
      const { probe, adversarial } = buildFollowupPresentations(q.followups!, 15000);
      expect(probe.role).toBe("probe");
      expect(adversarial.role).toBe("adversarial");
      // Probes are always a clean numeric target you can grade exactly.
      expect(probe.answerKind).toBe("numeric");
      expect(typeof probe.answer).toBe("number");
      expect(gradeFollowup(probe, String(probe.answer), 3000)?.correct).toBe(true);
      // Distinct questions.
      expect(probe.prompt).not.toBe(adversarial.prompt);
      // The probe is NOT arithmetic on the previous answer.
      expect(probe.answer).not.toBe(q.answer);
    }
  });

  it("probes never use arithmetic-on-answer phrasing", () => {
    // Arithmetic-ON-THE-PREVIOUS-ANSWER transforms — the worthless old style.
    // (Manipulating an INPUT assumption, e.g. "double your assumption", is fine.)
    const BANNED = [
      /square your answer/i,
      /double your answer|double that answer|double it and/i,
      /3⁄8 of|3\/8 of|7⁄8 of|5⁄8 of/i,
      /reprice/i,
      /× 13|x 13/i,
      /divide .* by 16/i,
      /answer as a percentage/i,
    ];
    for (const q of drawAll(ALL_CONCEPTUAL)) {
      const { probe, adversarial } = buildFollowupPresentations(q.followups!, 15000);
      for (const re of BANNED) {
        expect(probe.prompt).not.toMatch(re);
        expect(adversarial.prompt).not.toMatch(re);
      }
    }
  });

  it("reasoning adversarials appear and credit a correct conclusion", () => {
    let sawReasoning = false;
    for (const q of drawAll([..._pools.PROB_EV_MEDIUM, ..._pools.PROB_EV_HARD])) {
      const { adversarial } = buildFollowupPresentations(q.followups!, 15000);
      if (adversarial.answerKind !== "reasoning") continue;
      sawReasoning = true;
      // One keyword from EACH required group + every required conclusion value.
      const kws = (adversarial.conclusionKeywords ?? [])
        .map((g) => g[0])
        .join(" ");
      const targets = (adversarial.conclusionTargets ?? []).join(" ");
      expect(
        gradeFollowup(adversarial, `${targets} ${kws}`.trim(), 5000)?.correct,
      ).toBe(true);
    }
    expect(sawReasoning).toBe(true);
  });

  it("is deterministic by seed", () => {
    const gen = _pools.PROB_EV_MEDIUM[0];
    const a = buildFollowupPresentations(gen(new Rng(77)).followups!, 15000);
    const b = buildFollowupPresentations(gen(new Rng(77)).followups!, 15000);
    expect(a).toEqual(b);
  });
});

describe("AI follow-ups — classified numeric vs reasoning", () => {
  const authored = reasoningFu({
    answerKind: "numeric",
    answer: 42,
    conclusionTargets: undefined,
    conclusionKeywords: undefined,
  });

  it("routes an OPEN question to reasoning grading (the odds bug scenario)", () => {
    const fu = buildAiFollowup(authored, {
      question:
        "A bookmaker offers 7:1 against A and 3:1 against B — are the odds internally consistent, and how would you adjust A keeping B fixed?",
      idealAnswerNote:
        "7:1 → 1/8, 3:1 → 1/4; the implied probabilities sum to → 0.375 which is under 1, so not consistent.",
    });
    expect(fu.answerKind).toBe("reasoning");
    expect(
      gradeFollowup(fu, "The sum is 0.375, so the book is not consistent.", 8000)
        ?.correct,
    ).toBe(true);
    expect(gradeFollowup(fu, "8", 8000)?.correct).toBe(false);
  });

  it("routes a crisp single-number ask to numeric grading", () => {
    const fu = buildAiFollowup(authored, {
      question: "What is the probability of exactly two heads in three fair flips?",
      idealAnswerNote: "C(3,2)/8 = 3/8 = 0.375.",
    });
    expect(fu.answerKind).toBe("numeric");
    expect(gradeFollowup(fu, "0.375", 8000)?.correct).toBe(true);
    expect(gradeFollowup(fu, "0.5", 8000)?.correct).toBe(false);
  });
});
