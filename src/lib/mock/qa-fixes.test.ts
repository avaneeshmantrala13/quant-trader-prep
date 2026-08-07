import { describe, expect, it } from "vitest";
import {
  buildFollowupPresentations,
  extractTargetAnswer,
  gradeAgainstReference,
  gradeFollowup,
} from "./followups";
import { _pools } from "./questionPools";
import { gradeReasoningDeterministic } from "./reasoning";
import {
  deterministicDiagnosis,
  floorDiagnosis,
} from "./diagnosis";
import { verdictFor } from "./marketMaking";
import { Rng } from "@/lib/rng";
import type { MmRoundResult, MockDiagnosis, MockPerformance } from "./types";

/* -------------------------------------------------------------------------- */
/*  D1 — AI follow-up grader targets the SPECIFIC parsed answer, not any digit */
/* -------------------------------------------------------------------------- */

describe("D1 — follow-up grades against the specific note answer", () => {
  // The contract's own example note: the real answer is 1/4 = 0.25; 1/8 and
  // 1/2 are intermediate decoys, 3 and 8 are digits inside those fractions.
  const note =
    "P(exactly 3 | >1 flip) = P(TTH)/P(first flip tails) = (1/8)/(1/2) = 1/4. " +
    "Watch for candidates who misapply memorylessness or confuse the conditioning event.";

  it("extracts the FINAL computed value (1/4 → 0.25), not a decoy", () => {
    expect(extractTargetAnswer(note)).toBeCloseTo(0.25, 10);
  });

  it("marks the true decimal answer correct and rejects decoy digits", () => {
    // The ACTUAL answer passes, whether written as a decimal, fraction, or %.
    expect(gradeAgainstReference(note, "0.25", 3000, 12000)?.correct).toBe(true);
    expect(gradeAgainstReference(note, "1/4", 3000, 12000)?.correct).toBe(true);
    expect(gradeAgainstReference(note, "25%", 3000, 12000)?.correct).toBe(true);
    // The decoys that USED to pass (any digit in the note) now fail.
    for (const decoy of ["3", "8", "1", "2"]) {
      expect(gradeAgainstReference(note, decoy, 3000, 12000)?.correct).toBe(
        false,
      );
    }
  });

  it("returns null (ungradable, excluded) when no reliable target exists", () => {
    // No numeric anchor at all.
    expect(gradeAgainstReference("Discuss the intuition.", "42", 3000, 12000)).toBeNull();
    // Multiple distinct values and no result delimiter → refuse to guess.
    expect(extractTargetAnswer("Compare 3 apples and 8 oranges.")).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/*  D2 — deterministic reasoning grader                                        */
/* -------------------------------------------------------------------------- */

describe("D2 — deterministic reasoning grader engages the problem", () => {
  const PROMPT = "A fair coin is flipped 3 times. P(exactly 2 heads)?";

  it("flags marker-word-vague reasoning as vague EVEN when the answer is correct", () => {
    const g = gradeReasoningDeterministic({
      prompt: PROMPT,
      correctAnswer: "3/8",
      correct: true,
      reasoning: "Obviously it is just the probability, so yeah trust me.",
      isMentalMath: false,
    });
    // Buzzwords ("probability", "so") no longer count as engaging the setup.
    expect(g.quality).toBe("vague");
  });

  it("does NOT rate a self-contradictory derivation as sound", () => {
    const g = gradeReasoningDeterministic({
      prompt: PROMPT,
      correctAnswer: "3/8",
      correct: true, // the SUBMITTED number was right; the written work is bogus
      reasoning: "independent, so I multiply 3 × 1/2 = 3/8",
      isMentalMath: false,
    });
    // 3 × 1/2 = 1.5 ≠ 3/8 is a FALSE stated step → flawed (never sound).
    expect(g.quality).toBe("flawed");
    expect(g.quality).not.toBe("sound");
  });

  it("rates a genuine, engaged, correct derivation as sound", () => {
    const g = gradeReasoningDeterministic({
      prompt: PROMPT,
      correctAnswer: "3/8",
      correct: true,
      reasoning:
        "Three of the eight equally likely outcomes have exactly two heads, so P = 3/8.",
      isMentalMath: false,
    });
    expect(g.quality).toBe("sound");
  });

  it("never flips correctness: a wrong-but-structured answer is partial, not sound", () => {
    const g = gradeReasoningDeterministic({
      prompt: PROMPT,
      correctAnswer: "3/8",
      correct: false,
      reasoning: "8 outcomes, I count 4 with two heads → 4/8",
      isMentalMath: false,
    });
    expect(g.quality).toBe("partial");
  });

  it("keeps mental-math brevity sound (never charged as vague)", () => {
    const g = gradeReasoningDeterministic({
      prompt: "12 × 12 = ?",
      correctAnswer: "144",
      correct: true,
      reasoning: "144",
      isMentalMath: true,
    });
    expect(g.quality).toBe("sound");
  });
});

/* -------------------------------------------------------------------------- */
/*  D3 — diagnosis is always complete (field-by-field floor)                   */
/* -------------------------------------------------------------------------- */

function perfWithWeaknesses(): MockPerformance {
  return {
    scorePct: 62,
    mathCorrect: 7,
    mathTotal: 10,
    avgMathMs: 16000,
    brainteaserCorrect: 2,
    brainteaserTotal: 4,
    followupCorrect: 1,
    followupTotal: 3,
    probeCorrect: 1,
    probeTotal: 2,
    adversarialCorrect: 0,
    adversarialTotal: 1,
    mmPnl: -120,
    mmVerdict: "quoted too wide, missed flow",
    reasoningTags: { sound: 3, partial: 4, flawed: 0, vague: 5, absent: 1 },
    correctButVagueCount: 4,
    tier: "top-tier prop desk",
  };
}

describe("D3 — getDiagnosis floors a partial AI reply to complete", () => {
  it("fills empty AI fields from the deterministic diagnosis", () => {
    const fallback = deterministicDiagnosis(perfWithWeaknesses());
    // A verbose model that emitted a verdict then got truncated: empty arrays.
    const partialAi: MockDiagnosis = {
      verdict: "You are borderline.",
      wouldPass: "borderline",
      strengths: [],
      weaknesses: [],
      nextSteps: [],
      source: "ai",
    };
    const floored = floorDiagnosis(partialAi, fallback);

    expect(floored.verdict).toBe("You are borderline."); // AI verdict kept
    expect(floored.strengths.length).toBeGreaterThan(0);
    expect(floored.weaknesses.length).toBeGreaterThan(0);
    expect(floored.nextSteps.length).toBeGreaterThan(0);
    expect(floored.weaknesses).toEqual(fallback.weaknesses);
    // Something usable came from the model → source is ai.
    expect(floored.source).toBe("ai");
  });

  it("falls back entirely when the AI reply is empty", () => {
    const fallback = deterministicDiagnosis(perfWithWeaknesses());
    const emptyAi: MockDiagnosis = {
      verdict: "",
      wouldPass: "borderline",
      strengths: [],
      weaknesses: [],
      nextSteps: [],
      source: "ai",
    };
    const floored = floorDiagnosis(emptyAi, fallback);
    expect(floored.source).toBe("deterministic");
    expect(floored).toEqual({ ...fallback, source: "deterministic" });
  });
});

/* -------------------------------------------------------------------------- */
/*  D4 / D5 — authored follow-ups are adversarial, concept-relevant, fair       */
/* -------------------------------------------------------------------------- */

describe("D4/D5 — concept-specific follow-ups adversarial + gradable + fair", () => {
  it("probes deepen the concept and stay cleanly gradable", () => {
    // Every conceptual generator authors a probe (deepen) + adversarial (challenge).
    for (const gen of _pools.PROB_EV_HARD) {
      for (let seed = 1; seed <= 8; seed++) {
        const q = gen(new Rng(seed));
        const { probe, adversarial } = buildFollowupPresentations(
          q.followups!,
          15000,
        );
        expect(probe.source).toBe("authored");
        // NOT the old naked arithmetic transforms of the previous answer.
        expect(probe.prompt).not.toMatch(/square your answer|double your answer|3⁄8 of|reprice/i);
        // The probe is a distinct, real computation — never just the main answer.
        expect(probe.answerKind).toBe("numeric");
        expect(probe.answer).not.toBe(q.answer);
        expect(gradeFollowup(probe, String(probe.answer), 3000)?.correct).toBe(true);
        expect(
          gradeFollowup(probe, String((probe.answer ?? 0) + 123), 3000)?.correct,
        ).toBe(false);
        // The adversarial is graded BY ITS TYPE and credits a correct argument.
        if (adversarial.answerKind === "reasoning") {
          const kws = (adversarial.conclusionKeywords ?? [])
            .map((g) => g[0])
            .join(" ");
          const targets = (adversarial.conclusionTargets ?? []).join(" ");
          expect(
            gradeFollowup(adversarial, `${targets} ${kws}`.trim(), 3000)?.correct,
          ).toBe(true);
        } else {
          expect(gradeFollowup(adversarial, String(adversarial.answer), 3000)?.correct).toBe(true);
        }
      }
    }
  });

  it("is deterministic by seed", () => {
    const gen = _pools.PROB_EV_MEDIUM[0];
    const a = buildFollowupPresentations(gen(new Rng(77)).followups!, 15000);
    const b = buildFollowupPresentations(gen(new Rng(77)).followups!, 15000);
    expect(a).toEqual(b);
  });
});

/* -------------------------------------------------------------------------- */
/*  D6 / D7 — market-making verdict reflects quote quality + P&L sign          */
/* -------------------------------------------------------------------------- */

function pass(round: number, bid: number, ask: number): MmRoundResult {
  return {
    round,
    quote: { bid, ask, bidSize: 2, askSize: 2 },
    fill: null,
    chatter: "",
    kind: "pass",
  };
}

describe("D6/D7 — MM verdict correctness", () => {
  it("D6: a tight, centred, no-flow quote is FLAT, not 'too wide'", () => {
    const results = [pass(1, 698, 702), pass(2, 698, 702), pass(3, 698, 702)];
    const v = verdictFor(results, 0, 40, 700);
    expect(v).not.toMatch(/too wide/i);
    expect(v).toMatch(/flat/i);
  });

  it("D6: an actually-wide flat quote is still called 'too wide'", () => {
    const results = [pass(1, 670, 705), pass(2, 670, 705)];
    const v = verdictFor(results, 0, 40, 700); // avg spread 35 ≈ 0.88·cap
    expect(v).toMatch(/too wide/i);
  });

  it("D7: a positive P&L on an OFFSIDE quote is variance, not 'earned the spread'", () => {
    const results: MmRoundResult[] = [
      {
        round: 1,
        quote: { bid: 650, ask: 670, bidSize: 3, askSize: 3 },
        fill: { side: "buy", price: 650, size: 1 }, // long below true → +50
        chatter: "",
        kind: "noise",
      },
      pass(2, 650, 670),
    ];
    const v = verdictFor(results, 50, 40, 700); // truth 700 is above the 670 ask
    expect(v).not.toMatch(/earned the spread/i);
    expect(v).toMatch(/offside|variance/i);
  });

  it("credits a genuinely centred, profitable quote with earning the spread", () => {
    const results: MmRoundResult[] = [
      {
        round: 1,
        quote: { bid: 698, ask: 702, bidSize: 2, askSize: 2 },
        fill: { side: "sell", price: 702, size: 1 },
        chatter: "",
        kind: "noise",
      },
      pass(2, 698, 702),
    ];
    const v = verdictFor(results, 2, 40, 700);
    expect(v).toMatch(/earned the spread/i);
  });

  it("D6: deterministic diagnosis reports P&L 0 as break-even, not positive", () => {
    const perf: MockPerformance = {
      ...perfWithWeaknesses(),
      mmPnl: 0,
      mmVerdict: "flat",
    };
    const d = deterministicDiagnosis(perf);
    expect(d.verdict).toMatch(/break-even market-making sim/);
    expect(d.verdict).not.toMatch(/positive market-making sim/);
  });
});
