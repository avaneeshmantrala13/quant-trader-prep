/**
 * mock/gate-coverage.test.ts — regression net for the mock/firm-hardness fixes:
 *
 *   G4  Pinned archetypes are VERIFIER-SOURCED (bank-or-roll EV, Citadel hidden-
 *       composition posterior, SIG Kelly stake) — answers match the deterministic
 *       verifiers by construction, closing the inline-literal drift window.
 *   G5  The acceptance gate now FLOOR-CHECKS and RUBRIC-REVIEWS market-making and
 *       brainteaser steps (previously skipped), so a soft MM/brainteaser round is
 *       caught and the "make a market on N×N" trivial guard can fire on MM.
 */
import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import { buildInterview } from "./engine";
import { drawArchetype } from "./questionPools";
import { auditScript } from "./interviewGate";
import {
  rubricItemsFromScript,
  reviewItemHeuristic,
  type RubricItem,
} from "./interviewRubric";
import {
  bankOrRollFiniteEV,
  hiddenCompositionNextBlack,
  kellyFraction,
} from "./archetypes/verifiers";
import type { BrainteaserStep, MarketMakingStep, MockScript } from "./types";

/* -------------------------------------------------------------------------- */
/*  G4 — pinned archetypes are verifier-sourced                               */
/* -------------------------------------------------------------------------- */

describe("G4 — pinned archetypes source their answers from the verifiers", () => {
  const rng = () => new Rng(12345);

  it("bank-or-roll base EV equals bankOrRollFiniteEV(6, 2).ev (17/4 = 4.25)", () => {
    const q = drawArchetype(rng(), "bank-or-roll");
    expect(q.answer).toBe(bankOrRollFiniteEV(6, 2).ev);
    expect(q.answer).toBe(4.25);
  });

  it("Citadel posterior equals hiddenCompositionNextBlack(3, 2) = 3/4 and the probe uses m=1 = 2/3", () => {
    const q = drawArchetype(rng(), "citadel-bet");
    expect(q.answer).toBe(Math.round(hiddenCompositionNextBlack(3, 2) * 1e4) / 1e4);
    expect(q.answer).toBe(0.75);
    const probeAnswer = q.followups?.probe?.answer;
    expect(probeAnswer).toBe(
      Math.round(hiddenCompositionNextBlack(3, 1) * 1e4) / 1e4,
    );
    expect(probeAnswer).toBe(0.6667);
  });

  it("SIG confidence-bet stake equals kellyFraction(0.75, 1)·100 = $50", () => {
    const q = drawArchetype(rng(), "sig-confidence-bet");
    const stake = kellyFraction(0.75, 1) * 100;
    expect(stake).toBe(50);
    // The adversarial 'act-on-it' follow-up is graded against that Kelly stake.
    expect(q.followups?.adversarial?.conclusionTargets).toContain(stake);
  });
});

/* -------------------------------------------------------------------------- */
/*  G5 — MM + brainteaser steps are floor-checked and rubric-reviewed         */
/* -------------------------------------------------------------------------- */

/** Minimal well-formed script wrapper around a set of scored steps. */
function scriptOf(steps: MockScript["steps"]): MockScript {
  return {
    seed: 1,
    tier: "hard",
    presetId: "optiver",
    presetName: "x",
    scoringNote: "x",
    calculatorAllowed: false,
    intro: "x",
    steps,
  } as MockScript;
}

const softMm = (id: string, difficulty: string): MarketMakingStep => ({
  kind: "marketMaking",
  id,
  prompt: "Make me a market on the sum 1..50.",
  contextHint: "quote tight",
  trueValue: 1275,
  maxSpread: 60,
  totalRounds: 3,
  aggression: 2,
  seed: 1,
  concept: "series-sum",
  difficulty,
});

const softBt = (id: string, difficulty: string): BrainteaserStep => ({
  kind: "brainteaser",
  id,
  prompt: "A genuinely hard puzzle.",
  answer: "42",
  explanation: "…",
  concept: "logic",
  difficulty,
  probes: [],
  timeLimitSec: 180,
});

describe("G5 — auditScript floor-checks market-making + brainteaser steps", () => {
  it("flags a market-making round below the hard floor", () => {
    const report = auditScript(scriptOf([softMm("mm-easy", "easy")]));
    expect(
      report.violations.some((v) => /mm-easy: marketMaking difficulty "easy" is below the hard floor/.test(v)),
    ).toBe(true);
  });

  it("flags a brainteaser below the hard floor", () => {
    const report = auditScript(scriptOf([softBt("bt-medium", "medium")]));
    expect(
      report.violations.some((v) => /bt-medium: brainteaser difficulty "medium" is below the hard floor/.test(v)),
    ).toBe(true);
  });

  it("does NOT floor-flag a hard MM / brainteaser, nor an undefined-difficulty legacy step", () => {
    const hard = auditScript(scriptOf([softMm("mm-hard", "hard"), softBt("bt-hard", "hard")]));
    expect(hard.violations.some((v) => /below the hard floor/.test(v))).toBe(false);
    // Legacy count-based path leaves difficulty undefined ⇒ no false floor flag.
    const legacy = auditScript(scriptOf([softMm("mm-legacy", undefined as unknown as string)]));
    expect(legacy.violations.some((v) => /below the hard floor/.test(v))).toBe(false);
  });
});

describe("G5 — rubricItemsFromScript now extracts MM + brainteaser items", () => {
  it("a Jane Street mock yields market-making AND brainteaser rubric items", () => {
    const script = buildInterview({ seed: 7, preset: "janestreet" });
    const items = rubricItemsFromScript(script);
    expect(items.some((i) => i.family === "market-making")).toBe(true);
    expect(items.some((i) => i.family === "brainteaser")).toBe(true);
    // The count matches every scored, non-mental-math step.
    const expected = script.steps.filter(
      (s) =>
        (s.kind === "math" && s.qtype !== "mental-math") ||
        s.kind === "marketMaking" ||
        s.kind === "brainteaser",
    ).length;
    expect(items.length).toBe(expected);
  });
});

describe("G5 — the heuristic reviewer handles follow-up-free MM + brainteaser bases", () => {
  const mmItem = (over: Partial<RubricItem> = {}): RubricItem => ({
    id: "mm-1",
    family: "market-making",
    difficulty: "hard",
    prompt: "Make me a market on the sum 1..50.",
    baseAnswer: 1275,
    followups: [],
    expectFollowups: false,
    prevFamily: "market-making",
    ...over,
  });

  it("passes a hard MM base with no typed follow-ups (no shallow-followup flag)", () => {
    const v = reviewItemHeuristic(mmItem());
    expect(v.interviewGrade).toBe(true);
    expect(v.flags).toHaveLength(0);
  });

  it("still fires the trivial-base guard on 'make a market on 12 × 14'", () => {
    const v = reviewItemHeuristic(mmItem({ prompt: "Make me a market on 12 × 14." }));
    expect(v.flags).toContain("trivial-base");
    expect(v.interviewGrade).toBe(false);
  });

  it("flags a soft MM base below the hard floor", () => {
    const v = reviewItemHeuristic(mmItem({ difficulty: "easy" }));
    expect(v.flags).toContain("easy-base");
  });

  it("exempts adjacent market-making rounds from the duplicate-topic flag", () => {
    const v = reviewItemHeuristic(mmItem({ prevFamily: "market-making" }));
    expect(v.flags).not.toContain("duplicate-topic");
  });

  it("passes a hard brainteaser base with no follow-ups", () => {
    const v = reviewItemHeuristic({
      id: "bt-1",
      family: "brainteaser",
      difficulty: "hard",
      prompt: "A genuinely hard optimal-stopping puzzle.",
      baseAnswer: Number.NaN,
      followups: [],
      expectFollowups: false,
      prevFamily: "conditional-prob",
    });
    expect(v.interviewGrade).toBe(true);
    expect(v.flags).toHaveLength(0);
  });
});
