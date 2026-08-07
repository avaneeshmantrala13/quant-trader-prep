/**
 * mock/jailbreak-grading.test.ts — the ADVERSARIAL / "gaming" suite for the
 * rock-solid, non-jailbreakable reasoning grader.
 *
 * THE BUG (fixed): the old grader marked reasoning CORRECT whenever a correct
 * token/phrase appeared ANYWHERE, so a contradictory answer that COMMITTED to
 * the wrong side while quoting a true fact would pass. This suite proves that:
 *
 *   • MANY adversarial reasoning attempts across question types NEVER grade
 *     CORRECT — they resolve to CLARIFY or MISSED;
 *   • the EXACT reported example (mutually-exclusive) is caught on the REAL
 *     question seed;
 *   • after a wrong / hedged CLARIFICATION the item is MISSED, but a genuine
 *     committed-correct clarification is CORRECT (exactly one clarify round);
 *   • genuinely correct, clearly-committed reasoning STILL passes with NO
 *     needless clarify (no over-strict regression).
 */
import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import {
  buildFollowupPresentations,
  gradeFollowup,
  gradeClarification,
  gradeMainClarification,
  gradeReasoningDeterministic,
  createSession,
  mockReducer,
  type FollowupPresentation,
  type MathStep,
  type MockScript,
} from "./index";
import { _pools, type MockNumericQuestion } from "./questionPools";

const TARGET_MS = 30_000;

/** Draw the mutually-exclusive `pev-twoof3` question (the reported example). */
function twoOfThreeAdversarial(): FollowupPresentation {
  const gens = [..._pools.PROB_EV_MEDIUM, ..._pools.PROB_EV_HARD, ..._pools.PROB_EV_STRETCH];
  for (const g of gens) {
    for (let seed = 1; seed <= 20; seed++) {
      const q = g(new Rng(seed));
      if (q.id.startsWith("pev-twoof3") && q.followups) {
        const { adversarial } = buildFollowupPresentations(q.followups, TARGET_MS);
        if (/MUTUALLY EXCLUSIVE/i.test(adversarial.prompt)) return adversarial;
      }
    }
  }
  throw new Error("pev-twoof3 mutually-exclusive adversarial not found");
}

/** Verdict of a reasoning follow-up answer. */
function verdict(p: FollowupPresentation, raw: string) {
  return gradeFollowup(p, raw, 5000)?.verdict;
}
function isCorrect(p: FollowupPresentation, raw: string) {
  return gradeFollowup(p, raw, 5000)?.correct === true;
}

/* -------------------------------------------------------------------------- */
/*  1) The EXACT reported example — must NOT pass                              */
/* -------------------------------------------------------------------------- */

describe("the reported mutually-exclusive jailbreak is caught", () => {
  const adv = twoOfThreeAdversarial();

  it("the exact user gaming answer is NOT correct (→ clarify)", () => {
    const gaming =
      "yes, it would because they are mutually exclusive so it would not be " +
      "possible for both of the events to occur.";
    expect(isCorrect(adv, gaming)).toBe(false);
    expect(verdict(adv, gaming)).toBe("clarify");
  });

  it("still credits a genuinely-correct, committed answer", () => {
    expect(isCorrect(adv, "No — it's 0; mutually exclusive events can't both occur.")).toBe(true);
    expect(isCorrect(adv, "Zero. At most one can happen, so exactly two is impossible.")).toBe(true);
  });

  it("a plainly-wrong committed answer is MISSED, not correct", () => {
    expect(verdict(adv, "Yes, it's still 3·p²·(1−p), unchanged.")).toBe("missed");
    expect(isCorrect(adv, "Yes, it's still 3·p²·(1−p), unchanged.")).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/*  2) A broad GAMING corpus — never CORRECT across question types            */
/* -------------------------------------------------------------------------- */

/** Build an inline reasoning follow-up with a known correct/wrong side. */
function reasoningFu(over: Partial<FollowupPresentation>): FollowupPresentation {
  return {
    prompt: "Reasoning follow-up.",
    source: "authored",
    role: "adversarial",
    label: "Follow-up 2 of 2 · Adversarial",
    answerKind: "reasoning",
    targetMs: TARGET_MS,
    ...over,
  };
}

interface Attempt {
  label: string;
  fu: FollowupPresentation;
  answer: string;
}

const GAMING_ATTEMPTS: Attempt[] = [
  // (a) correct-fact-but-wrong-conclusion (the mutually-exclusive family)
  {
    label: "correct-fact-but-wrong-conclusion",
    fu: reasoningFu({
      conclusionTargets: [0],
      conclusionKeywords: [["mutually exclusive", "impossible", "zero", "cannot both"]],
      conclusionMode: "any",
      expectedPolarity: "deny",
      wrongKeywords: [["still the same", "unchanged", "same as before"]],
    }),
    answer:
      "yes it's the same because mutually exclusive means both cannot occur.",
  },
  // (b) answer-stated-but-wrong-reason / non-sequitur
  {
    label: "answer-stated-but-wrong-reason (overround)",
    fu: reasoningFu({
      conclusionTargets: [1.125],
      conclusionKeywords: [["overround", "not consistent", "inconsistent"]],
    }),
    answer: "the book is fair and consistent because bookmakers are regulated.",
  },
  // (c) contradictory "both X and Y"
  {
    label: "contradictory both-sides",
    fu: reasoningFu({
      conclusionKeywords: [["no", "not equal", "different", "larger"]],
      expectedPolarity: "deny",
    }),
    answer: "yes they are equal, but also no they are different — either could be right.",
  },
  // (d) hedging
  {
    label: "hedging / could-be-either",
    fu: reasoningFu({
      conclusionKeywords: [["no", "not always", "depends", "skew"]],
      expectedPolarity: "deny",
    }),
    answer: "it could be either the same or different depending on how you look.",
  },
  // (e) keyword-stuffing the correct term while concluding wrongly
  {
    label: "keyword-stuffing + wrong conclusion",
    fu: reasoningFu({
      conclusionTargets: [0],
      conclusionKeywords: [["mutually exclusive", "impossible", "zero"]],
      conclusionMode: "any",
      expectedPolarity: "deny",
      wrongKeywords: [["still", "unchanged", "same"]],
    }),
    answer:
      "mutually exclusive impossible zero — but yes it's still the same as before, unchanged.",
  },
  // (f) correct-fact + wrong committed value
  {
    label: "wrong committed value with true buzzword",
    fu: reasoningFu({
      conclusionTargets: [0],
      conclusionKeywords: [["mutually exclusive", "impossible", "zero"]],
      conclusionMode: "any",
      wrongValues: [0.375],
      expectedPolarity: "deny",
    }),
    answer: "yes it's still 0.375 even though they're mutually exclusive.",
  },
];

describe("broad gaming corpus — never graded CORRECT", () => {
  for (const a of GAMING_ATTEMPTS) {
    it(`"${a.label}" → clarify or missed, never correct`, () => {
      const v = verdict(a.fu, a.answer);
      expect(v === "clarify" || v === "missed").toBe(true);
      expect(isCorrect(a.fu, a.answer)).toBe(false);
    });
  }
});

/* -------------------------------------------------------------------------- */
/*  3) The CLARIFY round is strict — one shot, no loops                       */
/* -------------------------------------------------------------------------- */

describe("clarify round is strictly graded (exactly one round)", () => {
  const adv = twoOfThreeAdversarial();

  it("a still-hedged / wrong clarification is MISSED", () => {
    expect(gradeClarification(adv, "yes it's still the same, unchanged.", 4000).correct).toBe(false);
    expect(gradeClarification(adv, "could be either — the same or different.", 4000).correct).toBe(false);
    // A strict clarify NEVER emits another clarify — it collapses to missed.
    expect(gradeClarification(adv, "yes it's still the same, unchanged.", 4000).verdict).toBe("missed");
  });

  it("a genuine committed-correct clarification is CORRECT", () => {
    expect(gradeClarification(adv, "No — it's 0; mutually exclusive events can't both occur.", 4000).correct).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/*  4) No over-strict regression — clean committed reasoning still passes      */
/* -------------------------------------------------------------------------- */

describe("no over-strict regression — clearly-committed correct reasoning passes", () => {
  const CLEAN: Attempt[] = [
    {
      label: "committed no + value + fact",
      fu: reasoningFu({
        conclusionTargets: [0],
        conclusionKeywords: [["mutually exclusive", "impossible", "zero"]],
        conclusionMode: "any",
        expectedPolarity: "deny",
        wrongKeywords: [["still", "unchanged", "same as before"]],
      }),
      answer: "No, it changes — under mutual exclusivity the probability is 0.",
    },
    {
      label: "overround committed",
      fu: reasoningFu({
        conclusionTargets: [1.125],
        conclusionKeywords: [["overround", "inconsistent", "not consistent"]],
      }),
      answer: "The implied probabilities sum to 1.125, so the book is overround — not consistent.",
    },
    {
      label: "terse committed",
      fu: reasoningFu({
        conclusionKeywords: [["no", "not equal", "different", "larger"]],
      }),
      answer: "No, E[X²] is larger; the gap is the variance.",
    },
  ];

  for (const c of CLEAN) {
    it(`"${c.label}" → correct with NO clarify`, () => {
      const s = gradeFollowup(c.fu, c.answer, 5000);
      expect(s?.verdict).toBe("correct");
      expect(s?.correct).toBe(true);
    });
  }
});

/* -------------------------------------------------------------------------- */
/*  5) MAIN-question reasoning — mixed/hedged → ambiguous → clarify            */
/* -------------------------------------------------------------------------- */

describe("main-question reasoning ambiguity + clarify grading", () => {
  const PROMPT = "A fair coin is flipped 3 times. P(exactly 2 heads)?";

  it("hedged main reasoning grades ambiguous (triggers clarify)", () => {
    const g = gradeReasoningDeterministic({
      prompt: PROMPT,
      correctAnswer: "3/8",
      correct: true,
      reasoning: "It could be either 3/8 or 1/2 — hard to say, both could be right.",
      isMentalMath: false,
    });
    expect(g.quality).toBe("ambiguous");
  });

  it("clean committed main reasoning is NOT ambiguous", () => {
    const g = gradeReasoningDeterministic({
      prompt: PROMPT,
      correctAnswer: "3/8",
      correct: true,
      reasoning: "Three of the eight equally likely outcomes have two heads, so 3/8.",
      isMentalMath: false,
    });
    expect(g.quality).toBe("sound");
  });

  it("main clarification: wrong/hedged → missed; committed-correct → correct", () => {
    expect(gradeMainClarification("3/8", "maybe 1/2, not sure", 4000, TARGET_MS).correct).toBe(false);
    expect(gradeMainClarification("3/8", "It's 3/8 — three of eight outcomes.", 4000, TARGET_MS).correct).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/*  6) End-to-end engine clarify flow (all reducer wiring)                     */
/* -------------------------------------------------------------------------- */

/** Draw a conceptual math step whose adversarial is the mutually-exclusive one. */
function twoOfThreeStep(): MathStep {
  const gens = [..._pools.PROB_EV_MEDIUM, ..._pools.PROB_EV_HARD];
  for (const g of gens) {
    for (let seed = 1; seed <= 20; seed++) {
      const q: MockNumericQuestion = g(new Rng(seed));
      if (!q.id.startsWith("pev-twoof3") || !q.followups) continue;
      const { probe, adversarial } = buildFollowupPresentations(q.followups, TARGET_MS);
      return {
        kind: "math",
        id: `mock-math-0-${q.id}`,
        qtype: "probability-ev",
        regime: "reasoning",
        prompt: q.prompt,
        answer: q.answer,
        decimals: q.decimals,
        concept: q.concept,
        explanation: q.explanation,
        commonErrors: q.commonErrors,
        followUps: [],
        authoredProbe: probe,
        authoredAdversarial: adversarial,
        targetMs: TARGET_MS,
      };
    }
  }
  throw new Error("pev-twoof3 step not found");
}

describe("engine clarify flow — gaming adversarial → clarify → strict resolution", () => {
  function runToAdversarial() {
    const step = twoOfThreeStep();
    const script: MockScript = { seed: 1, tier: "hard", intro: "", steps: [step] };
    let s = createSession(script, { speechSupported: false });
    s = mockReducer(s, { type: "start" });
    s = mockReducer(s, {
      type: "recordMath",
      raw: String(step.answer),
      viaSpeech: false,
      elapsedMs: 4000,
      reasoning: "worked it out",
    });
    s = mockReducer(s, {
      type: "applyReasoningGrade",
      stepId: step.id,
      grade: { quality: "sound", issues: [], probe: "", source: "deterministic" },
    });
    // Answer the probe correctly to unlock the adversarial.
    s = mockReducer(s, { type: "askFollowup", stepId: step.id, followup: step.authoredProbe! });
    s = mockReducer(s, {
      type: "recordFollowup",
      stepId: step.id,
      role: "probe",
      raw: String(step.authoredProbe!.answer),
      viaSpeech: false,
      elapsedMs: 3000,
    });
    // Present the (gaming-graded) adversarial.
    s = mockReducer(s, { type: "askFollowup", stepId: step.id, followup: step.authoredAdversarial! });
    return { s, step };
  }

  it("gaming adversarial answer → verdict clarify (not correct), then a wrong clarify → MISSED", () => {
    let { s, step } = runToAdversarial();
    s = mockReducer(s, {
      type: "recordFollowup",
      stepId: step.id,
      role: "adversarial",
      raw: "yes, it would because they are mutually exclusive so it would not be possible for both of the events to occur.",
      viaSpeech: false,
      elapsedMs: 5000,
    });
    let r = s.responses.find((x) => x.stepId === step.id)!;
    expect(r.followups?.adversarial?.score?.verdict).toBe("clarify");
    expect(r.followups?.adversarial?.score?.correct).toBe(false);

    // Ask + answer the clarify with STILL-wrong reasoning → missed, one round.
    s = mockReducer(s, {
      type: "askClarify",
      stepId: step.id,
      target: "adversarial",
      prompt: r.followups!.adversarial!.score!.clarifyPrompt!,
    });
    s = mockReducer(s, {
      type: "recordClarify",
      stepId: step.id,
      target: "adversarial",
      raw: "yes it's still the same, unchanged.",
      viaSpeech: false,
      elapsedMs: 4000,
    });
    r = s.responses.find((x) => x.stepId === step.id)!;
    expect(r.followups?.adversarial?.clarify?.graded).toBe(true);
    expect(r.followups?.adversarial?.clarify?.score?.correct).toBe(false);
    expect(r.followups?.adversarial?.score?.correct).toBe(false);
    expect(r.followups?.adversarial?.score?.verdict).toBe("missed");
  });

  it("gaming adversarial → clarify → a genuine committed-correct clarify → CORRECT", () => {
    let { s, step } = runToAdversarial();
    s = mockReducer(s, {
      type: "recordFollowup",
      stepId: step.id,
      role: "adversarial",
      raw: "yes, same, because they are mutually exclusive so both cannot occur.",
      viaSpeech: false,
      elapsedMs: 5000,
    });
    let r = s.responses.find((x) => x.stepId === step.id)!;
    expect(r.followups?.adversarial?.score?.verdict).toBe("clarify");

    s = mockReducer(s, {
      type: "askClarify",
      stepId: step.id,
      target: "adversarial",
      prompt: r.followups!.adversarial!.score!.clarifyPrompt!,
    });
    s = mockReducer(s, {
      type: "recordClarify",
      stepId: step.id,
      target: "adversarial",
      raw: "No — it changes; under mutual exclusivity the probability is 0.",
      viaSpeech: false,
      elapsedMs: 4000,
    });
    r = s.responses.find((x) => x.stepId === step.id)!;
    expect(r.followups?.adversarial?.clarify?.score?.correct).toBe(true);
    expect(r.followups?.adversarial?.score?.correct).toBe(true);
    expect(r.followups?.adversarial?.score?.verdict).toBe("correct");
  });
});
