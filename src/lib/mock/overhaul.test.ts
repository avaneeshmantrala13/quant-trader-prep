import { describe, expect, it } from "vitest";
import {
  buildInterview,
  createSession,
  currentStep,
  mockReducer,
  type MockSession,
} from "./engine";
import {
  buildFollowupPresentations,
  gradeAgainstReference,
  gradeFollowup,
} from "./followups";
import { drawNumericQuestion } from "./questionPools";
import {
  buildMarketMakingSteps,
  initMmState,
  playMmRound,
  validateMmQuote,
} from "./marketMaking";
import {
  computePerformance,
  deterministicDiagnosis,
  normalizeDiagnosisPayload,
} from "./diagnosis";
import {
  gradeReasoningDeterministic,
  normalizeReasoningPayload,
} from "./reasoning";
import {
  serializeSession,
  deserializeSession,
  saveActiveSession,
  loadActiveSession,
  type KeyValueStore,
} from "./persist";
import { Rng } from "@/lib/rng";
import type {
  MarketMakingStep,
  MathScore,
  MathStep,
  MockResponse,
} from "./types";

/* -------------------------------------------------------------------------- */
/*  Follow-ups: asked AND graded                                               */
/* -------------------------------------------------------------------------- */

/** A conceptual math step (probability-EV) carrying its authored follow-ups. */
function conceptualMathStep(seed: number, id = `m-${seed}`): MathStep {
  const q = drawNumericQuestion(new Rng(seed), "probability-ev", "medium");
  const { probe, adversarial } = buildFollowupPresentations(q.followups!, 15000);
  return {
    kind: "math",
    id,
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
    targetMs: 15000,
    source: q.source,
  };
}

describe("follow-ups — concept-specific derivation + grading", () => {
  it("authors a deterministic numeric probe with a known answer", () => {
    const a = buildFollowupPresentations(
      drawNumericQuestion(new Rng(99), "probability-ev", "medium").followups!,
      15000,
    );
    const b = buildFollowupPresentations(
      drawNumericQuestion(new Rng(99), "probability-ev", "medium").followups!,
      15000,
    );
    expect(a).toEqual(b); // same seed ⇒ identical follow-ups
    expect(a.probe.source).toBe("authored");
    expect(a.probe.answerKind).toBe("numeric");
    expect(typeof a.probe.answer).toBe("number");
  });

  it("grades a correct probe answer as correct and a wrong one as wrong", () => {
    const { probe } = buildFollowupPresentations(
      drawNumericQuestion(new Rng(3), "probability-ev", "medium").followups!,
      15000,
    );
    expect(gradeFollowup(probe, String(probe.answer), 4000)?.correct).toBe(true);
    expect(
      gradeFollowup(probe, String((probe.answer ?? 0) + 999), 4000)?.correct,
    ).toBe(false);
  });

  it("grades an AI follow-up deterministically against its reference note", () => {
    // The client owns the correctness decision; the note is just stored data.
    const note = "Strong answer: P = 1/4 = 0.25. Watch for memorylessness errors.";
    expect(gradeAgainstReference(note, "0.25", 3000, 12000)?.correct).toBe(true);
    expect(gradeAgainstReference(note, "9", 3000, 12000)?.correct).toBe(false);
    // A note with no numeric anchor is ungradable → null (never a crash).
    expect(gradeAgainstReference("Discuss the intuition.", "42", 3000, 12000)).toBeNull();
  });

  it("drives the full ask-and-grade flow through the reducer", () => {
    const script = {
      seed: 7,
      tier: "hard" as const,
      intro: "",
      steps: [conceptualMathStep(7)],
    };
    let s = createSession(script, { speechSupported: false });
    s = mockReducer(s, { type: "start" });
    const step = currentStep(s) as MathStep;

    s = mockReducer(s, {
      type: "recordMath",
      raw: String(step.answer),
      viaSpeech: false,
      elapsedMs: 5000,
      reasoning: "did the arithmetic",
    });
    s = mockReducer(s, {
      type: "applyReasoningGrade",
      stepId: step.id,
      grade: { quality: "sound", issues: [], probe: "", source: "deterministic" },
    });
    // Ask + grade the PROBE (Follow-up 1 of 2).
    s = mockReducer(s, {
      type: "askFollowup",
      stepId: step.id,
      followup: step.authoredProbe!,
    });
    const beforeProbe = s.responses[0].followups!.probe!;
    expect(beforeProbe.graded).toBe(false);
    s = mockReducer(s, {
      type: "recordFollowup",
      stepId: step.id,
      role: "probe",
      raw: String(step.authoredProbe!.answer),
      viaSpeech: false,
      elapsedMs: 3000,
    });
    const afterProbe = s.responses[0].followups!.probe!;
    expect(afterProbe.graded).toBe(true);
    expect(afterProbe.score?.correct).toBe(true);

    // Then ask + grade the ADVERSARIAL (Follow-up 2 of 2) — by its type.
    const adv = step.authoredAdversarial!;
    const advRaw =
      adv.answerKind === "reasoning"
        ? `${adv.conclusionTargets![0]} ${adv.conclusionKeywords?.[0]?.[0] ?? ""}`
        : String(adv.answer);
    s = mockReducer(s, {
      type: "askFollowup",
      stepId: step.id,
      followup: adv,
    });
    s = mockReducer(s, {
      type: "recordFollowup",
      stepId: step.id,
      role: "adversarial",
      raw: advRaw,
      viaSpeech: false,
      elapsedMs: 3000,
    });
    const afterAdv = s.responses[0].followups!.adversarial!;
    expect(afterAdv.graded).toBe(true);
    expect(afterAdv.score?.correct).toBe(true);

    const perf = computePerformance(s);
    expect(perf.probeTotal).toBe(1);
    expect(perf.probeCorrect).toBe(1);
    expect(perf.adversarialTotal).toBe(1);
    expect(perf.adversarialCorrect).toBe(1);
    expect(perf.followupTotal).toBe(2);
    expect(perf.followupCorrect).toBe(2);
  });

  it("probe and adversarial are DISTINCT questions with DIFFERENT targets", () => {
    // The probe deepens the principle; the adversarial challenges the logic.
    // They must never collide.
    for (let seed = 1; seed <= 40; seed++) {
      const q = drawNumericQuestion(new Rng(seed), "probability-ev", "hard");
      const { probe, adversarial } = buildFollowupPresentations(q.followups!, 15000);
      expect(probe.role).toBe("probe");
      expect(adversarial.role).toBe("adversarial");
      expect(probe.prompt).not.toBe(adversarial.prompt);
      // The probe is always a clean numeric target; grade it against its own.
      expect(probe.answerKind).toBe("numeric");
      expect(gradeFollowup(probe, String(probe.answer), 2000)?.correct).toBe(true);
      // The adversarial is graded BY ITS TYPE and earns credit when correct.
      if (adversarial.answerKind === "reasoning") {
        const kws = (adversarial.conclusionKeywords ?? [])
          .map((g) => g[0])
          .join(" ");
        const targets = (adversarial.conclusionTargets ?? []).join(" ");
        expect(
          gradeFollowup(adversarial, `${targets} ${kws}`.trim(), 2000)?.correct,
        ).toBe(true);
      } else {
        expect(probe.answer).not.toBe(adversarial.answer);
        expect(
          gradeFollowup(adversarial, String(adversarial.answer), 2000)?.correct,
        ).toBe(true);
      }
    }
  });
});

/* -------------------------------------------------------------------------- */
/*  Market making: the bot picks off a bad quote                               */
/* -------------------------------------------------------------------------- */

function mmStep(seed: number): MarketMakingStep {
  return {
    kind: "marketMaking",
    id: `mm-${seed}`,
    prompt: "Make a market on X.",
    contextHint: "",
    trueValue: 700,
    maxSpread: 40,
    totalRounds: 3,
    aggression: 2,
    seed,
  };
}

describe("market making — deterministic adversarial bot", () => {
  it("is deterministic by seed", () => {
    const a = buildMarketMakingSteps(new Rng(11), "medium", 1);
    const b = buildMarketMakingSteps(new Rng(11), "medium", 1);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("rejects an over-wide / crossed quote", () => {
    const step = mmStep(1);
    expect(validateMmQuote(step, { bid: 690, ask: 705, bidSize: 1, askSize: 1 }).ok).toBe(true);
    // spread == maxSpread is rejected (must be strictly smaller)
    expect(validateMmQuote(step, { bid: 680, ask: 720, bidSize: 1, askSize: 1 }).ok).toBe(false);
    // crossed
    expect(validateMmQuote(step, { bid: 705, ask: 700, bidSize: 1, askSize: 1 }).ok).toBe(false);
  });

  it("picks off an OFFSIDE quote for a loss on at least one seed", () => {
    // An offside quote (ask well below the truth) should be lifted by informed
    // flow, leaving the player short below fair value → a loss.
    let sawInformedLoss = false;
    for (let seed = 1; seed <= 40 && !sawInformedLoss; seed++) {
      const step = mmStep(seed);
      const st = playMmRound(step, initMmState(step), {
        bid: 650,
        ask: 670, // 30 below the true 700 → begging to be lifted
        bidSize: 3,
        askSize: 3,
      });
      const r = st.results[0];
      if (r.kind === "informed" && r.fill && r.fill.side === "sell") {
        expect(r.fill.price).toBeLessThan(step.trueValue); // sold below fair → loss
        sawInformedLoss = true;
      }
    }
    expect(sawInformedLoss).toBe(true);
  });

  it("an offside book never beats a tight, centred book (in aggregate)", () => {
    let offsideTotal = 0;
    let centredTotal = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const step = mmStep(seed);
      // Play all rounds offside vs centred.
      let off = initMmState(step);
      let cen = initMmState(step);
      for (let round = 0; round < step.totalRounds; round++) {
        off = playMmRound(step, off, { bid: 650, ask: 670, bidSize: 3, askSize: 3 });
        cen = playMmRound(step, cen, { bid: 695, ask: 705, bidSize: 3, askSize: 3 });
      }
      offsideTotal += off.pnl;
      centredTotal += cen.pnl;
    }
    expect(offsideTotal).toBeLessThan(0); // offside loses money on average
    expect(centredTotal).toBeGreaterThan(offsideTotal); // centred is strictly better
  });
});

/* -------------------------------------------------------------------------- */
/*  Diagnosis aggregation (incl. correct-but-vague)                            */
/* -------------------------------------------------------------------------- */

function mathScore(correct: boolean): MathScore {
  return {
    parsed: correct ? 1 : 0,
    correct,
    elapsedMs: 6000,
    targetMs: 15000,
    timing: "fast",
    score: correct ? 1 : 0,
  };
}

describe("diagnosis — deterministic aggregation", () => {
  it("tallies follow-ups + reasoning and counts correct-but-vague (never MM brevity)", () => {
    const script = buildInterview({
      seed: 21,
      mathCount: 1,
      brainteaserCount: 1,
      marketMakingCount: 1,
      behavioralCount: 0,
    });
    const [mathS, btS, mmS] = script.steps;

    const responses: MockResponse[] = [
      {
        stepId: mathS.id,
        stage: "math",
        raw: "",
        viaSpeech: false,
        score: mathScore(true),
        // Mental-math with a "vague" tag must NOT be charged as correct-but-vague.
        reasoningGrade: { quality: "vague", issues: [], probe: "", source: "deterministic" },
        followups: {
          probe: {
            presentation: {
              prompt: "x2?",
              source: "authored",
              role: "probe",
              label: "Follow-up 1 of 2 · Probe",
              answer: 2,
              targetMs: 1000,
            },
            raw: "2",
            viaSpeech: false,
            score: mathScore(true),
            graded: true,
          },
        },
      },
      {
        stepId: btS.id,
        stage: "brainteaser",
        raw: "",
        viaSpeech: false,
        selfAssessed: "got", // "correct"
        // ...but vague reasoning → THIS is the correct-but-vague case.
        reasoningGrade: { quality: "vague", issues: [], probe: "", source: "deterministic" },
      },
      {
        stepId: mmS.id,
        stage: "marketMaking",
        raw: "",
        viaSpeech: false,
        mm: {
          trueValue: 700,
          maxSpread: 40,
          totalRounds: 3,
          results: [],
          done: true,
          pnl: -80,
          picked: 2,
          verdict: "Picked off — quoted offside.",
        },
      },
    ];

    const session: MockSession = {
      script,
      speechSupported: false,
      status: "summary",
      index: script.steps.length - 1,
      responses,
    };

    const perf = computePerformance(session);
    expect(perf.mathCorrect).toBe(1);
    expect(perf.followupCorrect).toBe(1);
    expect(perf.followupTotal).toBe(1);
    expect(perf.brainteaserCorrect).toBe(1);
    expect(perf.reasoningTags.vague).toBe(2); // math + brainteaser tags counted
    expect(perf.correctButVagueCount).toBe(1); // ONLY the brainteaser (mental-math excluded)
    expect(perf.mmPnl).toBe(-80);
    expect(perf.scorePct).toBe(100); // 3/3 correct items (math + follow-up + teaser)

    const diag = deterministicDiagnosis(perf);
    expect(diag.source).toBe("deterministic");
    expect(diag.weaknesses.join(" ")).toMatch(/vague/i);
    expect(diag.weaknesses.join(" ")).toMatch(/-80|market-making/i);
  });

  it("normalizes a malformed diagnosis payload to safe defaults", () => {
    const d = normalizeDiagnosisPayload({ wouldPass: "maybe", strengths: [1, "ok", ""] });
    expect(d.wouldPass).toBe("borderline"); // out-of-set → default
    expect(d.strengths).toEqual(["ok"]); // non-strings dropped
    expect(d.verdict).toBe("");
    expect(d.nextSteps).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/*  Reasoning fallback                                                         */
/* -------------------------------------------------------------------------- */

describe("reasoning — deterministic fallback", () => {
  it("never rates terse-but-correct mental math as vague", () => {
    const g = gradeReasoningDeterministic({
      prompt: "12 × 12 = ?",
      correctAnswer: "144",
      correct: true,
      reasoning: "144",
      isMentalMath: true,
    });
    expect(g.quality).toBe("sound");
    const empty = gradeReasoningDeterministic({
      prompt: "12 × 12 = ?",
      correctAnswer: "144",
      correct: true,
      reasoning: "",
      isMentalMath: true,
    });
    expect(empty.quality).toBe("sound"); // brevity never penalized
  });

  it("flags absent / vague reasoning on non-mental-math", () => {
    const absent = gradeReasoningDeterministic({
      prompt: "A fair coin flipped 3 times. P(2 heads)?",
      correctAnswer: "3/8",
      correct: false,
      reasoning: "",
      isMentalMath: false,
    });
    expect(absent.quality).toBe("absent");
    const vague = gradeReasoningDeterministic({
      prompt: "A fair coin flipped 3 times. P(2 heads)?",
      correctAnswer: "3/8",
      correct: true,
      reasoning: "it's obvious",
      isMentalMath: false,
    });
    expect(vague.quality).toBe("vague");
  });

  it("applies contract defaults for a malformed reason-grade payload", () => {
    const g = normalizeReasoningPayload({ reasoningQuality: "excellent", issues: "nope" });
    expect(g.quality).toBe("partial"); // out-of-set → default
    expect(g.issues).toEqual([]);
    expect(g.probe).toBe("");
    expect(g.source).toBe("ai");
  });
});

/* -------------------------------------------------------------------------- */
/*  Persistence round-trip incl. follow-ups + MM                               */
/* -------------------------------------------------------------------------- */

function fakeStore(): KeyValueStore & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

describe("persistence — full new session survives a round-trip", () => {
  it("preserves reasoning grades, asked-and-graded follow-ups, and MM state", () => {
    const script = {
      seed: 5,
      tier: "hard" as const,
      intro: "",
      steps: [conceptualMathStep(5), mmStep(5)],
    };
    let s = createSession(script, { speechSupported: true });
    s = mockReducer(s, { type: "start" });
    const math = currentStep(s) as MathStep;

    // Answer + reasoning + graded follow-up on the math step.
    s = mockReducer(s, {
      type: "recordMath",
      raw: String(math.answer),
      viaSpeech: false,
      elapsedMs: 4000,
      reasoning: "worked it out",
    });
    s = mockReducer(s, {
      type: "applyReasoningGrade",
      stepId: math.id,
      grade: { quality: "sound", issues: [], probe: "double it?", source: "ai" },
    });
    s = mockReducer(s, {
      type: "askFollowup",
      stepId: math.id,
      followup: math.authoredProbe!,
    });
    s = mockReducer(s, {
      type: "recordFollowup",
      stepId: math.id,
      role: "probe",
      raw: String(math.authoredProbe!.answer),
      viaSpeech: false,
      elapsedMs: 2500,
    });
    s = mockReducer(s, { type: "next" });

    // Play one MM round (in progress, not yet settled).
    const mm = currentStep(s) as MarketMakingStep;
    s = mockReducer(s, {
      type: "submitMmQuote",
      stepId: mm.id,
      quote: { bid: mm.trueValue - 2, ask: mm.trueValue + 2, bidSize: 2, askSize: 2 },
    });

    // Pure serialize round-trip reproduces everything exactly.
    const restored = deserializeSession(serializeSession(s));
    expect(restored).toEqual(s);

    // ...including via the injected-store I/O path.
    const store = fakeStore();
    saveActiveSession(s, null, store);
    const loaded = loadActiveSession(null, store)!;
    expect(loaded).toEqual(s);

    const mathResp = loaded.responses.find((r) => r.stepId === math.id)!;
    expect(mathResp.reasoningGrade?.quality).toBe("sound");
    expect(mathResp.followups?.probe?.graded).toBe(true);
    expect(mathResp.followups?.probe?.score?.correct).toBe(true);
    const mmResp = loaded.responses.find((r) => r.stepId === mm.id)!;
    expect(mmResp.mm?.results.length).toBe(1);
  });
});
