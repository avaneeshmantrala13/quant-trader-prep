/**
 * mock/reasoning-wording.test.ts — the VERDICT-WORDING branch suite.
 *
 * Proves the reported wording bug is fixed and can never regress: a garbled /
 * nonsensical response reads "Response not understood" (its OWN verdict), and is
 * kept DISTINCT from a genuine hedge (both-sides) and a genuine contradiction.
 *   (a) uninterpretable / garbled → `uninterpretable` quality / `uninterpretable`
 *       clarify kind → a not-understood prompt;
 *   (b) self-contradictory        → `contradiction` clarify kind;
 *   (c) hedging / both-sides      → `hedge` clarify kind.
 */
import { describe, expect, it } from "vitest";
import {
  gradeReasoningDeterministic,
  isUninterpretable,
  normalizeReasoningPayload,
} from "./reasoning";
import { gradeConclusion, buildClarifyPrompt } from "./conclusion";

describe("reasoning wording — uninterpretable detector is conservative", () => {
  it("flags genuine gibberish (keyboard-mash / symbol-soup)", () => {
    expect(isUninterpretable("zxcvbnm qwrtp hjkl sdfgh")).toBe(true);
    expect(isUninterpretable("@@@ ### $$$ %%%")).toBe(true);
    expect(isUninterpretable("asdfghjkl lkjhgfdsa")).toBe(true);
  });

  it("does NOT flag readable English — even weak, vague, or terse", () => {
    // Hand-wavy but READABLE ⇒ vague, not garbled.
    expect(isUninterpretable("it is obviously correct, trust me")).toBe(false);
    // Buzzword / content-bearing ⇒ readable.
    expect(isUninterpretable("the probability is pretty high here")).toBe(false);
    // A committed polarity ⇒ readable.
    expect(isUninterpretable("yes it changes")).toBe(false);
    // Any number is itself a claim.
    expect(isUninterpretable("about 0.5 give or take")).toBe(false);
    // Empty is `absent`, not garbled.
    expect(isUninterpretable("")).toBe(false);
  });
});

describe("reasoning wording — deterministic grader emits the right quality", () => {
  const base = {
    prompt: "An urn has 4 red and 6 blue; draw two. P(both red)?",
    correctAnswer: "0.1333",
    correct: false,
    isMentalMath: false,
  };

  it("garbled reasoning → `uninterpretable` (not `ambiguous`, not `vague`)", () => {
    const g = gradeReasoningDeterministic({
      ...base,
      reasoning: "zxcvbnm qwrtp hjkl sdfgh",
    });
    expect(g.quality).toBe("uninterpretable");
    expect(g.issues.join(" ")).toMatch(/couldn't understand/i);
  });

  it("hand-wavy readable reasoning stays `vague`", () => {
    const g = gradeReasoningDeterministic({
      ...base,
      reasoning: "it's obviously correct, trust me",
    });
    expect(g.quality).toBe("vague");
  });

  it("both-sides readable reasoning stays `ambiguous`", () => {
    const g = gradeReasoningDeterministic({
      ...base,
      reasoning: "it could be either the same or different, hard to say honestly",
    });
    expect(g.quality).toBe("ambiguous");
  });
});

describe("reasoning wording — conclusion grader tags an accurate clarifyKind", () => {
  it("(a) garbled → clarifyKind 'uninterpretable' + a not-understood prompt", () => {
    const r = gradeConclusion("zxcvbnm qwrtp hjkl sdfgh", {
      correctValues: [0.5],
    });
    expect(r.verdict).toBe("clarify");
    expect(r.clarifyKind).toBe("uninterpretable");
    expect(buildClarifyPrompt(r)).toMatch(/couldn't understand/i);
    // Crucially NOT a both-sides / contradiction message.
    expect(buildClarifyPrompt(r)).not.toMatch(/both ways|contradict/i);
  });

  it("(b) contradiction (correct part + wrong-side commit) → 'contradiction'", () => {
    const r = gradeConclusion("it is different but also exactly the same", {
      correctKeywords: [["different"]],
      wrongKeywords: [["the same"]],
    });
    expect(r.verdict).toBe("clarify");
    expect(r.clarifyKind).toBe("contradiction");
  });

  it("(c) hedging / both-sides → 'hedge'", () => {
    const r = gradeConclusion("honestly it could be either one, not sure", {
      correctKeywords: [["different"]],
    });
    expect(r.verdict).toBe("clarify");
    expect(r.clarifyKind).toBe("hedge");
  });

  it("strict mode (the clarify round) collapses any clarify to missed", () => {
    const r = gradeConclusion("zxcvbnm qwrtp hjkl sdfgh", { correctValues: [0.5] }, { strict: true });
    expect(r.verdict).toBe("missed");
  });
});

describe("reasoning wording — payload normalization accepts uninterpretable", () => {
  it("lifts a valid `uninterpretable` quality from an AI payload", () => {
    const g = normalizeReasoningPayload({ reasoningQuality: "uninterpretable", issues: [] });
    expect(g.quality).toBe("uninterpretable");
    expect(g.source).toBe("ai");
  });
});
