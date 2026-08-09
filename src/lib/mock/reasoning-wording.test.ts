/**
 * mock/reasoning-wording.test.ts — the VERDICT-WORDING branch suite.
 *
 * Proves the reported wording bug is fixed and can never regress: a garbled /
 * nonsensical response reads "Response not understood" (its OWN quality), and is
 * kept DISTINCT from a genuine hedge (both-sides) and a genuine contradiction.
 *
 * It ALSO locks the STRICT confirm/clarify gate: the second-chance (clarify) path
 * fires ONLY when there is genuine CORRECT, load-bearing content and just a small
 * part is wrong/ambiguous. Garbled input, a footingless hedge, "I don't know",
 * and a fully-wrong answer are all graded WRONG directly — no clarify:
 *   (a) uninterpretable / garbled → graded `missed`, not-understood reason;
 *   (b) correct part + wrong-side commit → `contradiction` clarify;
 *   (c) hedge WITH correct content       → `hedge` clarify (the only hedge that
 *       earns a clarify); (d) footingless hedge / "I don't know" → `missed`;
 *   (e) fully-wrong committed answer     → `missed`.
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

  it("a both-sides hedge WITH correct footing stays `ambiguous` (earns a clarify)", () => {
    // STRICT GATE: the verified value 0.1333 is present, so there is genuine
    // correct content — a hedge on top of it is the mostly-right case → clarify.
    const g = gradeReasoningDeterministic({
      ...base,
      reasoning: "it could be either 0.1333 or 0.5 — hard to say honestly",
    });
    expect(g.quality).toBe("ambiguous");
  });

  it("a FOOTINGLESS both-sides hedge is NOT ambiguous (no second chance)", () => {
    // STRICT GATE: nothing correct to build on ⇒ commit to a wrong verdict, not a
    // lenient clarify. It must NOT read `ambiguous` (which would trigger clarify).
    const g = gradeReasoningDeterministic({
      ...base,
      reasoning: "it could be either the same or different, hard to say honestly",
    });
    expect(g.quality).not.toBe("ambiguous");
  });
});

describe("reasoning wording — conclusion grader clarifyKind + strict gate", () => {
  it("(a) garbled → graded WRONG directly (no second chance), not-understood reason", () => {
    // STRICT GATE: garbled input has nothing correct to confirm ⇒ `missed`, NOT a
    // "couldn't confirm — restate below" clarify.
    const r = gradeConclusion("zxcvbnm qwrtp hjkl sdfgh", {
      correctValues: [0.5],
    });
    expect(r.verdict).toBe("missed");
    expect(r.reason).toMatch(/not understood|couldn't|could not/i);
  });

  it("(b) contradiction (correct part + wrong-side commit) → 'contradiction' clarify", () => {
    // Genuine correct content ("different") + a wrong-side commit ("the same") is
    // the mostly-right-with-a-flaw case ⇒ the clarify path is allowed.
    const r = gradeConclusion("it is different but also exactly the same", {
      correctKeywords: [["different"]],
      wrongKeywords: [["the same"]],
    });
    expect(r.verdict).toBe("clarify");
    expect(r.clarifyKind).toBe("contradiction");
  });

  it("(c) hedge WITH correct content → 'hedge' clarify (the only hedge that clarifies)", () => {
    const r = gradeConclusion("it's different, but honestly it could be either, not sure", {
      correctKeywords: [["different"]],
    });
    expect(r.verdict).toBe("clarify");
    expect(r.clarifyKind).toBe("hedge");
    expect(buildClarifyPrompt(r)).toMatch(/both ways|commit/i);
  });

  it("(d) FOOTINGLESS hedge / 'I don't know' → graded WRONG, no clarify", () => {
    // STRICT GATE: no correct load-bearing content ⇒ commit to wrong directly.
    const hedge = gradeConclusion("honestly it could be either one, not sure", {
      correctKeywords: [["different"]],
    });
    expect(hedge.verdict).toBe("missed");
    const idk = gradeConclusion("I don't know", { correctKeywords: [["different"]] });
    expect(idk.verdict).toBe("missed");
  });

  it("(e) a fully-wrong committed answer → graded WRONG, no clarify", () => {
    const r = gradeConclusion("it's exactly the same", {
      correctKeywords: [["different"]],
      wrongKeywords: [["the same"]],
    });
    expect(r.verdict).toBe("missed");
  });

  it("strict mode (the clarify round) collapses any clarify to missed", () => {
    const r = gradeConclusion(
      "it's different, but honestly it could be either, not sure",
      { correctKeywords: [["different"]] },
      { strict: true },
    );
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
