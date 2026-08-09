/**
 * mock/reasoning-mechanism.test.ts — the REQUIRED-MECHANISM guard rails.
 *
 * THE BUG (fixed + guarded forever): the reasoning grader was FAR too lenient
 * about what counts as well-justified reasoning. On the pinned Optiver demo
 * ("5, 11, 23, 41, 65, ___", answer 95) a user typed as their MAIN reasoning:
 *
 *     "because the math checks out and 65 + 30 is 95."
 *
 * …and the grader judged it fully SOUND. That is WRONG: it only RESTATES the
 * final arithmetic and hand-waves; it never articulates the MECHANISM (the first
 * differences grow by a constant 6 ⇒ the SECOND difference is constant, a
 * quadratic pattern). Reasoning that only states the conclusion / final
 * arithmetic, or asserts correctness without substance, must NEVER grade sound.
 *
 * This suite proves:
 *   1. the EXACT repro on the REAL pinned demo question is NOT sound, and a
 *      proper mechanism explanation IS sound (both terse and verbose);
 *   2. a battery of conclusion-only / arithmetic-only / hand-wave answers across
 *      MANY concepts (sequences, prob-EV, order stats, Bayes) is NOT sound,
 *      while matching genuinely-good concise answers ARE sound (no over-reject);
 *   3. reasoning FOLLOW-UPS enforce the same gate: a committed-correct side with
 *      no mechanism routes to CLARIFY (strict → missed), a hand-wave with no
 *      spec is MISSED, and a real mechanism answer is CORRECT.
 */
import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import {
  buildFollowupPresentations,
  drawArchetype,
  gradeClarification,
  gradeFollowup,
  gradeReasoningDeterministic,
  type FollowupPresentation,
  type ReasoningQuality,
} from "./index";

const TARGET_MS = 30_000;

/** Grade MAIN reasoning quality with the mechanism gate wired in. */
function mainQuality(over: {
  prompt: string;
  correctAnswer: string;
  reasoning: string;
  mechanismSignals?: string[];
  correct?: boolean;
}): ReasoningQuality {
  return gradeReasoningDeterministic({
    prompt: over.prompt,
    correctAnswer: over.correctAnswer,
    correct: over.correct ?? true,
    reasoning: over.reasoning,
    isMentalMath: false,
    mechanismSignals: over.mechanismSignals,
  }).quality;
}

/* -------------------------------------------------------------------------- */
/*  1) The EXACT reported repro — on the REAL pinned Optiver demo question     */
/* -------------------------------------------------------------------------- */

describe("Optiver demo repro: conclusion/arithmetic-only reasoning is NOT sound", () => {
  const demo = drawArchetype(new Rng(1), "optiver-quadratic-demo");
  const signals = demo.requiredReasoning?.mechanismSignals;

  it("the pinned demo actually authors mechanism signals", () => {
    expect(Array.isArray(signals)).toBe(true);
    expect((signals ?? []).length).toBeGreaterThan(3);
  });

  it('the EXACT user answer "because the math checks out and 65 + 30 is 95." is NOT sound', () => {
    const q = mainQuality({
      prompt: demo.prompt,
      correctAnswer: String(demo.answer),
      reasoning: "because the math checks out and 65 + 30 is 95.",
      mechanismSignals: signals,
    });
    // The exact repro must be partial (mechanism missing) — never sound.
    expect(q).not.toBe("sound");
    expect(q).toBe("partial");
  });

  it("a verbose mechanism explanation IS sound", () => {
    const q = mainQuality({
      prompt: demo.prompt,
      correctAnswer: String(demo.answer),
      reasoning:
        "The first differences are 6, 12, 18, 24 — each larger by a constant 6, " +
        "so the second difference is constant (a quadratic pattern). The next gap " +
        "is 30, so 65 + 30 = 95.",
      mechanismSignals: signals,
    });
    expect(q).toBe("sound");
  });

  it("a TERSE mechanism explanation is still sound (brevity never punished)", () => {
    const q = mainQuality({
      prompt: demo.prompt,
      correctAnswer: String(demo.answer),
      reasoning: "second differences are constant at 6, so next gap 30 → 95",
      mechanismSignals: signals,
    });
    expect(q).toBe("sound");
  });

  it('bare "trust me / I computed it" hand-waves are NOT sound', () => {
    for (const r of [
      "65 + 30 = 95, trust me.",
      "It's 95 — I computed it, obviously.",
      "The answer is 95 because the math checks out.",
    ]) {
      const q = mainQuality({
        prompt: demo.prompt,
        correctAnswer: String(demo.answer),
        reasoning: r,
        mechanismSignals: signals,
      });
      expect(q, `"${r}" must not be sound`).not.toBe("sound");
    }
  });
});

/* -------------------------------------------------------------------------- */
/*  1b) FALSE-NEGATIVE regression — a demoed CORRECT derivation graded SOUND   */
/*      via the VERIFIED SOLUTION SPACE (any equivalent mechanism accepted).   */
/* -------------------------------------------------------------------------- */

describe("Optiver demo: equivalent-but-correct derivations all grade SOUND", () => {
  const demo = drawArchetype(new Rng(1), "optiver-quadratic-demo");
  const signals = demo.requiredReasoning?.mechanismSignals;
  const grade = (reasoning: string) =>
    mainQuality({
      prompt: demo.prompt,
      correctAnswer: String(demo.answer), // "95"
      reasoning,
      mechanismSignals: signals,
    });

  it("the EXACT user text from the demo (first-differences framing) is SOUND", () => {
    // Regression for the reported false negative: the final answer 95 is stated
    // in PROSE ("which is 95") AFTER the last "=" (24 + 6 = 30). The old grader
    // read 30 as the conclusion and wrongly said "the derivation doesn't hold."
    const q = grade(
      "I know that the next term is 95 because the difference between terms " +
        "increases by 6 each time, and the last difference was 65 - 41 = 24, so " +
        "the next difference is 24 + 6 = 30. This means we have to add 30 to 65 " +
        "which is 95.",
    );
    expect(q).toBe("sound");
  });

  it("SECOND-difference framing is SOUND", () => {
    expect(
      grade(
        "The second difference is constant at 6. The last first-difference was " +
          "65 - 41 = 24, so the next first-difference is 24 + 6 = 30, and " +
          "65 + 30 = 95.",
      ),
    ).toBe("sound");
  });

  it("explicit quadratic a,b,c / closed-form framing is SOUND", () => {
    expect(
      grade(
        "This is a quadratic sequence with closed form 3n^2 - 3n + 5. For the " +
          "6th term, 3*36 - 3*6 + 5 = 108 - 18 + 5 = 95.",
      ),
    ).toBe("sound");
  });

  it("a chained closed-form computation is NOT misread as false arithmetic", () => {
    // "108 - 18 + 5 = 95" is a TRUE chain; the trailing binary "18 + 5 = 95" must
    // NOT trip the arithmetic-contradiction guard.
    expect(
      grade(
        "Quadratic pattern: a is half the constant second difference. Plugging " +
          "n = 6 into 3n^2 - 3n + 5 gives 108 - 18 + 5 = 95.",
      ),
    ).toBe("sound");
  });

  it("NEGATIVE: right answer 95 with NO real reasoning is NOT sound", () => {
    for (const r of ["95", "The answer is 95.", "It's 95, done."]) {
      expect(grade(r), `"${r}"`).not.toBe("sound");
    }
  });

  it("NEGATIVE: right answer via FALSE arithmetic (65 - 41 = 20) is FLAWED", () => {
    const q = grade(
      "The differences grow by 6. The last difference was 65 - 41 = 20, so the " +
        "next is 20 + 6 = 26 — wait, the answer is 95.",
    );
    expect(q).toBe("flawed");
  });

  it("NEGATIVE: a non-engaging generic justification is NOT sound", () => {
    for (const r of [
      "This is a standard pattern-recognition problem, so the answer is 95.",
      "It follows the obvious rule, giving 95.",
    ]) {
      expect(grade(r), `"${r}"`).not.toBe("sound");
    }
  });

  it("NEGATIVE: correct answer but the shown work CONCLUDES a different number", () => {
    // Right answer (95) typed, but the written derivation lands on 130 and never
    // reaches 95 — the broken-derivation guard must still catch this.
    const q = grade(
      "The terms roughly double each step, so the next first-difference is like " +
        "65 * 2 = 130.",
    );
    expect(q).not.toBe("sound");
  });
});

/* -------------------------------------------------------------------------- */
/*  2) A broad battery across concepts — conclusion-only NOT sound, good OK    */
/* -------------------------------------------------------------------------- */

interface MainCase {
  label: string;
  prompt: string;
  correctAnswer: string;
  mechanismSignals: string[];
  /** Conclusion-only / arithmetic-only / hand-wave — must NOT be sound. */
  notSound: string[];
  /** Genuinely-good concise reasoning — must be sound. */
  sound: string[];
}

const MAIN_CASES: MainCase[] = [
  {
    label: "arithmetic sequence",
    prompt: "What number comes next?  4, 11, 18, 25, 32, ___",
    correctAnswer: "39",
    mechanismSignals: [
      "common difference", "constant difference", "arithmetic", "add 7",
      "adds 7", "plus 7", "+7", "goes up by 7", "each step",
    ],
    notSound: [
      "32 + 7 = 39, the math checks out.",
      "It's 39 — obvious.",
    ],
    sound: [
      "It's an arithmetic sequence with common difference 7, so 32 + 7 = 39.",
      "Each step adds 7, so 32 + 7 = 39.",
    ],
  },
  {
    label: "independent-events probability",
    prompt: "Three independent events each occur with probability 30%. P(exactly two)?",
    correctAnswer: "0.189",
    mechanismSignals: [
      "choose", "3 ways", "three ways", "combination", "binomial",
      "p^2", "(1-p)", "one fails", "c(3,2)",
    ],
    notSound: [
      "It's 0.189, trust me, the math checks out.",
      "0.189 — I did the math.",
    ],
    sound: [
      "There are 3 ways to choose which two occur, each with probability p^2 (1 - p); combined that is 0.189.",
      "Three ways to choose the pair that occurs, times a binomial p^2 (1 - p) term, gives 0.189.",
    ],
  },
  {
    label: "order statistics (expected max of two dice)",
    prompt: "Two fair six-sided dice are rolled. Expected value of the larger?",
    correctAnswer: "4.4722",
    mechanismSignals: [
      "order statistic", "p(max", "2m-1", "2m - 1", "cdf", "m/6",
      "distribution of the max", "each value m",
    ],
    notSound: [
      "It's about 4.4722, obviously.",
      "4.4722 — the math works out.",
    ],
    sound: [
      "Using the order statistic, the chance the maximum equals m rises with m (proportional to 2m-1), so larger values weigh more and the expected max is about 4.4722.",
      "The distribution of the max weights larger values more, so E[max] is above a single die's mean, about 4.4722.",
    ],
  },
  {
    label: "Bayes with a low base rate",
    prompt:
      "A disease affects 1% of people; a test is 100% sensitive with a 10% false-positive rate. P(disease | positive)?",
    correctAnswer: "0.0917",
    mechanismSignals: [
      "bayes", "base rate", "base-rate", "prevalence", "prior", "posterior",
      "false positive", "false-positive", "dominat", "numerator",
    ],
    notSound: [
      "It's about 0.09, it's obvious.",
      "0.0917 — trust me.",
    ],
    sound: [
      "By Bayes, posterior = P*1 / (P*1 + (1-P)*FPR); the low base rate dominates, giving 0.01 / (0.01 + 0.099) = 0.0917.",
      "The tiny base rate (prevalence) dominates: 0.01 / (0.01 + 0.99*0.10) = 0.0917.",
    ],
  },
];

describe("mechanism battery — conclusion/hand-wave NOT sound; good concise IS sound", () => {
  for (const c of MAIN_CASES) {
    for (const r of c.notSound) {
      it(`[${c.label}] rejects (not sound): "${r}"`, () => {
        const q = mainQuality({
          prompt: c.prompt,
          correctAnswer: c.correctAnswer,
          reasoning: r,
          mechanismSignals: c.mechanismSignals,
        });
        expect(q).not.toBe("sound");
      });
    }
    for (const r of c.sound) {
      it(`[${c.label}] accepts (sound): "${r}"`, () => {
        const q = mainQuality({
          prompt: c.prompt,
          correctAnswer: c.correctAnswer,
          reasoning: r,
          mechanismSignals: c.mechanismSignals,
        });
        expect(q).toBe("sound");
      });
    }
  }
});

/* -------------------------------------------------------------------------- */
/*  3) Reasoning FOLLOW-UPS enforce the same mechanism gate                    */
/* -------------------------------------------------------------------------- */

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

describe("reasoning follow-ups — committed-correct-but-no-mechanism → clarify", () => {
  // Correct SIDE = "pass"; the mechanism = the negative EV / probabilities.
  const fu = reasoningFu({
    conclusionKeywords: [["pass", "decline", "reject", "don't take"]],
    mechanismSignals: ["ev", "-0.5", "negative", "0.25", "expected value"],
  });

  it("a committed-correct side with NO mechanism routes to clarify (not correct)", () => {
    const s = gradeFollowup(fu, "Pass, I'd decline the bet.", 4000);
    expect(s?.correct).toBe(false);
    expect(s?.verdict).toBe("clarify");
  });

  it("the same answer, WITH the mechanism, is correct", () => {
    const s = gradeFollowup(
      fu,
      "Pass — the EV is -0.5 per dollar (you're only 0.25 to win).",
      4000,
    );
    expect(s?.correct).toBe(true);
    expect(s?.verdict).toBe("correct");
  });

  it("a still-mechanism-less clarification is strictly MISSED (one round)", () => {
    const s = gradeClarification(fu, "Pass. Just pass.", 4000);
    expect(s.correct).toBe(false);
    expect(s.verdict).toBe("missed");
  });
});

describe("reasoning follow-ups — pure hand-wave with no spec is MISSED", () => {
  const openFu = reasoningFu({}); // no keywords/targets/mechanism → substantive gate

  it("a bare hand-wave is not a substantive answer", () => {
    const s = gradeFollowup(openFu, "It's obvious, trust me, the math checks out.", 4000);
    expect(s?.correct).toBe(false);
  });

  it("a genuine substantive argument still passes the open gate", () => {
    const s = gradeFollowup(
      openFu,
      "The total scales linearly with the refresh rate, so doubling the rate exactly doubles the message count.",
      4000,
    );
    expect(s?.correct).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/*  4) The PINNED demo adversarial follow-up is mechanism-gated end-to-end     */
/* -------------------------------------------------------------------------- */

describe("pinned Optiver demo adversarial follow-up is mechanism-gated", () => {
  const demo = drawArchetype(new Rng(1), "optiver-quadratic-demo");
  const { adversarial } = buildFollowupPresentations(demo.followups!, TARGET_MS);

  it("a full committed-correct + mechanism answer is CORRECT", () => {
    const s = gradeFollowup(
      adversarial,
      "a = 2, b = -1, c = 3 — three points give three equations that pin the three coefficients.",
      6000,
    );
    expect(s?.correct).toBe(true);
  });

  it("a bare 'a = 2, trust me' (right value, no mechanism) is NOT correct", () => {
    const s = gradeFollowup(adversarial, "a = 2, trust me.", 6000);
    expect(s?.correct).toBe(false);
  });
});
