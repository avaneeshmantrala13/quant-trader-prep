import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import { drawArchetype, archetypeFamily } from "./questionPools";
import {
  auditFollowup,
  auditMathStepFollowups,
  difficultyRank,
  MIN_ITEM_DIFFICULTY_RANK,
  type FollowupBase,
} from "./interviewGate";
import type { MathStep } from "./types";
import {
  queryTheMaxMinQueries,
  queryTheMaxTraps,
} from "@/content/brainteasers/infoTrapSolvers";

/**
 * The NEW "query-the-max" (information & adversarial trap) mock archetype: a
 * harder, verifier-backed reasoning/brainteaser question with a probe +
 * adversarial that must PASS the interview gate. It is registered (drawable via
 * `drawArchetype`) and tagged to the `brainteaser` family so the family-aware
 * assembler treats it like other brainteaser mock items — never forced into
 * every mock, and never breaking the difficulty floor / follow-up taxonomy.
 */

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 97 + 3);

describe("query-the-max mock archetype", () => {
  it("is verifier-sourced (answer = n) and tagged to the brainteaser family", () => {
    for (const seed of SEEDS) {
      const q = drawArchetype(new Rng(seed), "query-the-max");
      const n = Number(q.id.split("-").pop());
      expect(q.answer).toBe(queryTheMaxMinQueries(n)); // = n, exactly
      expect(q.family).toBe("brainteaser");
      expect(archetypeFamily("query-the-max")).toBe("brainteaser");
      // Clears the hard floor and carries both follow-ups.
      expect(difficultyRank(q.difficulty)).toBeGreaterThanOrEqual(MIN_ITEM_DIFFICULTY_RANK);
      expect(q.followups?.probe).toBeDefined();
      expect(q.followups?.adversarial).toBeDefined();
    }
  });

  it("enumerates the classic traps as wrong-answer common errors", () => {
    const q = drawArchetype(new Rng(1), "query-the-max");
    const n = Number(q.id.split("-").pop());
    const { skipLast, binarySearch, ternarySearch } = queryTheMaxTraps(n);
    const errVals = new Set((q.commonErrors ?? []).map((e) => e.value));
    expect(errVals.has(skipLast)).toBe(true);
    expect(errVals.has(binarySearch)).toBe(true);
    expect(errVals.has(ternarySearch)).toBe(true);
    // Every common error carries a misconception tag (powers the hint ladder).
    for (const e of q.commonErrors ?? []) expect(e.misconception).toBeTruthy();
  });

  it("both follow-ups PASS the interview gate (taxonomy, floor, no decomposition)", () => {
    for (const seed of SEEDS) {
      const q = drawArchetype(new Rng(seed), "query-the-max");
      const base: FollowupBase = {
        answer: q.answer,
        difficulty: q.difficulty,
        baseIntermediates: q.baseIntermediates,
      };
      const probe = q.followups!.probe;
      const adversarial = q.followups!.adversarial;
      expect(auditFollowup(base, probe)).toEqual([]);
      expect(auditFollowup(base, adversarial)).toEqual([]);
      // The probe generalizes to 2n (a genuinely new value, not a base sub-step).
      const n = Number(q.id.split("-").pop());
      expect(probe.answer).toBe(2 * n);
      expect(probe.type).toBe("generalize-n");
      expect(adversarial.type).toBe("adversarial-trap");
      expect(adversarial.answerKind).toBe("reasoning");
    }
  });

  it("passes the gate's own assembled-step follow-up audit (as the engine builds it)", () => {
    // Project the archetype to the MathStep shape the engine builds, then run the
    // EXACT script-level follow-up audit the acceptance gate applies per item.
    for (const seed of SEEDS) {
      const q = drawArchetype(new Rng(seed), "query-the-max");
      const step: MathStep = {
        kind: "math",
        id: q.id,
        qtype: "probability-ev",
        regime: "reasoning",
        prompt: q.prompt,
        answer: q.answer,
        decimals: q.decimals,
        concept: q.concept,
        difficulty: "hard",
        baseDifficulty: "hard",
        family: "brainteaser",
        baseIntermediates: q.baseIntermediates,
        explanation: q.explanation,
        commonErrors: q.commonErrors,
        followUps: [],
        authoredProbe: {
          prompt: q.followups!.probe.prompt,
          source: "authored",
          role: "probe",
          label: "Follow-up 1 of 2 · Probe",
          answerKind: q.followups!.probe.answerKind,
          type: q.followups!.probe.type,
          difficulty: q.followups!.probe.difficulty,
          answer: q.followups!.probe.answer,
          decimals: q.followups!.probe.decimals,
          targetMs: 60_000,
        },
        authoredAdversarial: {
          prompt: q.followups!.adversarial.prompt,
          source: "authored",
          role: "adversarial",
          label: "Follow-up 2 of 2 · Adversarial",
          answerKind: q.followups!.adversarial.answerKind,
          type: q.followups!.adversarial.type,
          difficulty: q.followups!.adversarial.difficulty,
          targetMs: 90_000,
        },
        targetMs: 90_000,
      };
      expect(auditMathStepFollowups(step)).toEqual([]);
    }
  });
});
