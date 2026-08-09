import { describe, expect, it } from "vitest";
import type { NumericQuestion, Question } from "@/types/content";
import {
  buildHintLadder,
  directionalNudge,
  nameOnlyCoaching,
  nameTrapWithoutAnswer,
  type HintRung,
} from "./hintLadder";
import { containsFinalAnswer } from "./answerWithholding";
import { MISCONCEPTION } from "./misconception";
import type { MonteCarloSpec } from "./monteCarlo";
import { SIM_BY_ID } from "@/lib/simulations/catalog";
import { PLAYABLE_TRACKS } from "@/content";
import { materializeLevel, materializeNumericLevel } from "@/content/materialize";
import { isFlashcardLevel, isNumericLevel } from "@/types/content";
import { materializeUntimedRun } from "@/lib/diagnostic/untimedRun";
import {
  FR_ADAPTER_FAMILIES,
  adaptHardOaToFreeResponse,
} from "@/lib/oa/hardContent/frAdapters";
import { Rng } from "@/lib/rng";

const bayesQ: Question = {
  id: "cp-bayestest-1-80-9",
  prompt:
    "A condition affects 1% of a population. A screening test flags 80% of people who have it, but also flags 9.6% of people who don't. A random person tests positive. What is the probability they have the condition?",
  choices: ["0.0748", "0.80", "0.90", "0.01"],
  correctIndex: 0,
  explanation:
    "Bayes: P(D|+) = (0.8)(0.01)/[(0.8)(0.01)+(0.096)(0.99)] = 0.0748. Reporting 80% is base-rate neglect.",
  difficulty: "medium",
  distractorRationale: [
    "Correct — prior times sensitivity over the total probability of a positive.",
    "Base-rate neglect: you reported the sensitivity as if it were the posterior.",
    "That is the specificity, not the asked posterior.",
    "That is just the prior, ignoring the evidence.",
  ],
  misconceptions: ["", MISCONCEPTION.baseRateNeglect, "", ""],
};

function isMcSpec(p: HintRung["payload"]): p is MonteCarloSpec {
  return !!p && "kind" in p && "trials" in p;
}

describe("buildHintLadder", () => {
  it("returns exactly 5 rungs in order 1..5 with the expected kinds", () => {
    const ladder = buildHintLadder({
      question: bayesQ,
      chosenIndex: 1,
      misconceptionTag: MISCONCEPTION.baseRateNeglect,
    });
    expect(ladder.map((r) => r.rung)).toEqual([1, 2, 3, 4, 5]);
    expect(ladder.map((r) => r.kind)).toEqual([
      "name-trap",
      "representation",
      "worked-sibling",
      "elicit-confront",
      "reveal",
    ]);
  });

  it("rungs 1–4 never contain the final answer; rung 5 (reveal) may", () => {
    const answer = bayesQ.choices[bayesQ.correctIndex];
    const ladder = buildHintLadder({
      question: bayesQ,
      chosenIndex: 1,
      misconceptionTag: MISCONCEPTION.baseRateNeglect,
    });
    for (const rung of ladder.slice(0, 4)) {
      expect(containsFinalAnswer(rung.text, answer)).toBe(false);
    }
    // The reveal rung IS allowed to contain the answer.
    expect(containsFinalAnswer(ladder[4].text, answer)).toBe(true);
  });

  it("a Bayesian item's rung 2 is a guided plan of attack (no NF-tree, answer withheld)", () => {
    const ladder = buildHintLadder({
      question: bayesQ,
      chosenIndex: 1,
      misconceptionTag: MISCONCEPTION.baseRateNeglect,
    });
    const rung2 = ladder[1];
    expect(rung2.kind).toBe("representation");
    // Rung 2 is now a plan, NOT a natural-frequency visualization (that would
    // duplicate the Bayes NF simulation at rung 4).
    expect(rung2.payload).toBeUndefined();
    // Question-driven plan naming WHAT to determine — never the method/answer.
    expect(rung2.text).toContain("?");
    expect(rung2.text.toLowerCase()).toMatch(/plan|figure out|determine|which|what/);
    const answer = bayesQ.choices[bayesQ.correctIndex];
    expect(containsFinalAnswer(rung2.text, answer)).toBe(false);
    expect(rung2.text.toLowerCase()).not.toMatch(/multiply|divide/);
  });

  it("a gambler's-fallacy tag yields a coin MonteCarloSpec at rung 4", () => {
    const coinQ: Question = {
      id: "gf-1",
      prompt:
        "A fair coin has landed heads five times in a row. What is the probability the next flip is tails?",
      choices: ["1/2", "5/6", "1/6", "6/7"],
      correctIndex: 0,
      explanation: "Flips are independent, so the answer is 1/2.",
      difficulty: "easy",
      distractorRationale: [
        "Correct — independence means the streak is irrelevant.",
        "The gambler's fallacy: expecting a correction after a streak.",
        "Confusing the streak with a fixed budget of outcomes.",
        "Miscounting the sequence space.",
      ],
      misconceptions: ["", MISCONCEPTION.gamblersFallacy, "", ""],
    };
    const ladder = buildHintLadder({
      question: coinQ,
      chosenIndex: 1,
      misconceptionTag: MISCONCEPTION.gamblersFallacy,
    });
    const rung4 = ladder[3];
    expect(rung4.kind).toBe("elicit-confront");
    expect(isMcSpec(rung4.payload)).toBe(true);
    if (isMcSpec(rung4.payload)) {
      expect(rung4.payload.kind).toBe("coin");
      expect(rung4.payload.trials).toBe(10_000);
    }
    // still answer-withholding on rungs 1–4
    const answer = coinQ.choices[coinQ.correctIndex];
    for (const rung of ladder.slice(0, 4)) {
      expect(containsFinalAnswer(rung.text, answer)).toBe(false);
    }
  });

  it("sanitises a rung-1 rationale that would leak the answer", () => {
    const leaky: Question = {
      id: "leak-1",
      prompt: "P?",
      choices: ["1/3", "1/2"],
      correctIndex: 0,
      explanation: "It is 1/3.",
      difficulty: "easy",
      // The chosen distractor's rationale accidentally states the answer 1/3.
      distractorRationale: ["Correct.", "You said 1/2 but the answer is 1/3."],
    };
    const ladder = buildHintLadder({ question: leaky, chosenIndex: 1 });
    expect(containsFinalAnswer(ladder[0].text, "1/3")).toBe(false);
  });

  it("works for numeric items (rung-1 from commonErrors, answer withheld)", () => {
    const numQ: NumericQuestion = {
      id: "cp-lotp-1",
      prompt: "Overall defect probability? (Round to 4 decimals.)",
      answer: 0.074,
      decimals: 4,
      difficulty: "medium",
      explanation: "Weight each rate by its share: 0.074.",
      unit: "",
      commonErrors: [
        {
          value: 0.085,
          feedback: "You averaged the two rates equally instead of weighting by share.",
          misconception: MISCONCEPTION.equalWeightMixture,
        },
      ],
    };
    const ladder = buildHintLadder({
      question: numQ,
      chosenValue: 0.085,
      misconceptionTag: MISCONCEPTION.equalWeightMixture,
    });
    expect(ladder).toHaveLength(5);
    expect(ladder[0].text).toContain("averaged");
    for (const rung of ladder.slice(0, 4)) {
      expect(containsFinalAnswer(rung.text, numQ.answer, 1e-9)).toBe(false);
    }
  });

  const indepAndQ: Question = {
    id: "ci-indep-1",
    prompt:
      "A fair coin is flipped and a fair die is rolled. What is the probability of BOTH heads and a six?",
    choices: ["0.0833", "0.6667", "0.5833", "0.25"],
    correctIndex: 0,
    explanation: "Independent: P(H)·P(6) = 0.5 · (1/6) = 0.0833.",
    difficulty: "easy",
    distractorRationale: [
      "Correct — multiply the two independent probabilities.",
      "You added the probabilities instead of multiplying them.",
      "Mixed up the operation on independent events.",
      "Used the wrong die probability.",
    ],
    family: "genIntersectionIndep",
  };

  it("rung 2 is a guided plan of attack for a non-Bayesian item (answer + method withheld)", () => {
    const ladder = buildHintLadder({
      question: indepAndQ,
      chosenIndex: 1,
      misconceptionTag: MISCONCEPTION.conjunctionFallacy,
      section: "Core Probability",
    });
    const rung2 = ladder[1];
    expect(rung2.kind).toBe("representation");
    // A question-driven plan that names WHAT to determine — never the operation
    // ("multiply"/"add") and never a rung-4-style visualization.
    expect(rung2.text).toContain("?");
    expect(rung2.text.toLowerCase()).not.toMatch(
      /multiply|\badd\b|subtract|divide|draw|venn|visualize|simulate/,
    );
    // Still answer-withholding.
    const answer = indepAndQ.choices[indepAndQ.correctIndex];
    expect(containsFinalAnswer(rung2.text, answer)).toBe(false);
  });

  it("rung 4 carries a catalog-valid simLink and answer-free pointer text", () => {
    const ladder = buildHintLadder({
      question: indepAndQ,
      chosenIndex: 1,
      misconceptionTag: MISCONCEPTION.conjunctionFallacy,
      section: "Core Probability",
    });
    const rung4 = ladder[3];
    expect(rung4.kind).toBe("elicit-confront");
    // conjunction_fallacy resolves to the two-independent-events sim.
    expect(rung4.simLink).toBeTruthy();
    expect(rung4.simLink?.href).toBe("/simulations#two-independent-events");
    expect(rung4.simLink?.href.startsWith("/simulations#")).toBe(true);
    expect(rung4.simLink?.title).toBe(SIM_BY_ID["two-independent-events"].title);
    // The pointer text names the sim and withholds the answer.
    expect(rung4.text).toContain(SIM_BY_ID["two-independent-events"].title);
    const answer = indepAndQ.choices[indepAndQ.correctIndex];
    expect(containsFinalAnswer(rung4.text, answer)).toBe(false);
  });

  it("gambler's-fallacy rung 4 keeps the coin sim AND links to coin-flips", () => {
    const coinQ: Question = {
      id: "gf-2",
      prompt:
        "A fair coin has landed heads five times in a row. What is the probability the next flip is tails?",
      choices: ["1/2", "5/6", "1/6", "6/7"],
      correctIndex: 0,
      explanation: "Flips are independent, so the answer is 1/2.",
      difficulty: "easy",
      misconceptions: ["", MISCONCEPTION.gamblersFallacy, "", ""],
    };
    const ladder = buildHintLadder({
      question: coinQ,
      chosenIndex: 1,
      misconceptionTag: MISCONCEPTION.gamblersFallacy,
      section: "Core Probability",
    });
    const rung4 = ladder[3];
    // The inline confront payload survives...
    expect(isMcSpec(rung4.payload)).toBe(true);
    if (isMcSpec(rung4.payload)) {
      expect(rung4.payload.kind).toBe("coin");
    }
    // ...and now ALSO deep-links to the coin-flips sim.
    expect(rung4.simLink?.href).toBe("/simulations#coin-flips");
    expect(rung4.simLink?.title).toBe(SIM_BY_ID["coin-flips"].title);
    const answer = coinQ.choices[coinQ.correctIndex];
    for (const rung of ladder.slice(0, 4)) {
      expect(containsFinalAnswer(rung.text, answer)).toBe(false);
    }
  });
});

describe("nameOnlyCoaching", () => {
  it("keeps the naming clause and strips a trailing corrective directive", () => {
    const out = nameOnlyCoaching(
      "It looks like you added the two probabilities — but you should multiply them.",
    );
    expect(out).toContain("added");
    expect(out).not.toMatch(/multiply|should/i);
  });

  it("strips an 'instead' / 'to get' corrective tail but keeps the mistake name", () => {
    expect(
      nameOnlyCoaching("You averaged the two rates instead of weighting by share."),
    ).toContain("averaged");
    expect(
      nameOnlyCoaching("You averaged the two rates instead of weighting by share."),
    ).not.toMatch(/instead/i);
  });

  it("never returns empty; falls back to the first sentence when the cut is too short", () => {
    expect(nameOnlyCoaching("")).toBe("");
    const s = nameOnlyCoaching(
      "Nope. You mislabeled the branch and mixed the conditionals up completely.",
    );
    expect(s.length).toBeGreaterThan(0);
  });

  it("never ships a mid-sentence fragment: an operation word INSIDE the naming clause is backed off to a clean boundary (the committee/P(n,k) trap)", () => {
    // The rationale contains " divide" INSIDE its second (corrective) clause, so
    // the old first-marker cut shipped the dangling fragment "…so should you keep or".
    const out = nameOnlyCoaching(
      "Close, that's the number of ORDERED arrangements P(7,2). A committee doesn't care about order, so should you keep or divide out the 2! orderings of each group?",
    );
    expect(out).toBe(
      "Close, that's the number of ORDERED arrangements P(7,2). A committee doesn't care about order.",
    );
    // No dangling tail, no revealed method, ends cleanly.
    expect(out).not.toMatch(/keep or/i);
    expect(out).not.toMatch(/divide/i);
    expect(out).not.toContain("2!");
    expect(out.trim()).toMatch(/[.?!]$/);
  });

  it("drops a trailing imperative-directive SENTENCE that reveals the method (the '…Weight each by its share.' family)", () => {
    const out = nameOnlyCoaching(
      "You averaged the two defect rates equally. Weight each by its production SHARE (40% vs 60%), not 50/50.",
    );
    expect(out).toBe("You averaged the two defect rates equally.");
    expect(out.toLowerCase()).not.toContain("weight");
  });

  it("preserves a COHERENT authored Socratic question that ends on a preposition (no over-stripping)", () => {
    const q =
      "That's only the numerator P(+|D)·P(D), the joint. To turn a joint into P(D|+), what total must you normalise by?";
    // No corrective marker → returned as authored (a complete, grammatical question).
    expect(nameOnlyCoaching(q)).toBe(q);
    expect(nameOnlyCoaching(q).trim()).toMatch(/[.?!]$/);
  });

  it("always terminates with punctuation and never ends on a dangling conjunction", () => {
    const samples = [
      "You added P(A)+P(B); some integers are divisible by BOTH 3 and 4 and get counted twice.",
      "That's only P(A), divisibility by 3 alone. The event is A OR B; how do you fold in B without double-counting?",
      "You inverted the ratio. P(A|B) puts the joint on top and P(B) on the bottom, which quantity should divide which?",
      "That's the joint P(A∩B). Conditioning restricts you to the world where B happened, what must you divide the joint by?",
    ];
    for (const s of samples) {
      const out = nameOnlyCoaching(s);
      expect(out.trim()).toMatch(/[.?!]["')\]]?$/);
      const lastWord = out
        .trim()
        .replace(/[.?!"')\]]+$/g, "")
        .match(/([\p{L}\p{N}']+)$/u)?.[1];
      expect(lastWord).toBeTruthy();
      expect(lastWord!).not.toMatch(
        /^(or|and|so|but|nor|yet|then|because|thus|hence|the|a|an)$/i,
      );
    }
  });
});

describe("buildHintLadder rung-1 (prioritised numeric name-trap cases)", () => {
  const baseNum = (over: Partial<NumericQuestion>): NumericQuestion => ({
    id: "num-x",
    prompt: "What is the probability?",
    answer: 0.2,
    decimals: 4,
    difficulty: "easy",
    explanation: "It is 0.2.",
    unit: "",
    ...over,
  });

  it("(a) an out-of-[0,1] probability entry yields the domain pointer (answer withheld)", () => {
    const q = baseNum({ commonErrors: [] });
    const ladder = buildHintLadder({
      question: q,
      chosenValue: 1.4,
      section: "Core Probability",
    });
    expect(ladder[0].kind).toBe("name-trap");
    expect(ladder[0].text).toContain("[0, 1]");
    expect(containsFinalAnswer(ladder[0].text, q.answer, 1e-9)).toBe(false);
  });

  it("(b) a close-but-not-exact unmatched entry yields the arithmetic-slip nudge", () => {
    const q = baseNum({ commonErrors: [] });
    const ladder = buildHintLadder({
      question: q,
      chosenValue: 0.19,
      section: "Core Probability",
    });
    expect(ladder[0].text.toLowerCase()).toContain("arithmetic");
    // No operational method, no answer.
    expect(ladder[0].text).not.toMatch(/multiply|add\b/i);
    expect(containsFinalAnswer(ladder[0].text, q.answer, 1e-9)).toBe(false);
  });

  it("(c) a matched misconception entry names the mistake WITHOUT the corrective op or answer", () => {
    const q = baseNum({
      commonErrors: [
        {
          value: 0.9,
          feedback:
            "It looks like you added the two probabilities here. Re-read what the wording is asking you to combine.",
          misconception: "and_means_add",
        },
      ],
    });
    const ladder = buildHintLadder({
      question: q,
      chosenValue: 0.9,
      section: "Core Probability",
    });
    expect(ladder[0].text).toContain("added");
    expect(ladder[0].text).not.toMatch(/multiply|you should|instead/i);
    expect(containsFinalAnswer(ladder[0].text, q.answer, 1e-9)).toBe(false);
  });

  it("(d) a far-off unmatched entry yields the method-free generic nudge", () => {
    const q = baseNum({
      answer: 42,
      decimals: undefined,
      commonErrors: [],
    });
    const ladder = buildHintLadder({
      question: q,
      chosenValue: 5,
      section: "Core Puzzles",
    });
    expect(ladder[0].text.toLowerCase()).toContain("not the right answer");
    expect(ladder[0].text).not.toMatch(
      /multiply|order matters|probability × value/i,
    );
    expect(containsFinalAnswer(ladder[0].text, q.answer, 1e-9)).toBe(false);
  });

  it("rungs 1–4 never leak the answer across all four rung-1 cases", () => {
    const cases: { q: NumericQuestion; v: number; section: string }[] = [
      { q: baseNum({ commonErrors: [] }), v: 1.4, section: "Core Probability" },
      { q: baseNum({ commonErrors: [] }), v: 0.19, section: "Core Probability" },
      {
        q: baseNum({
          commonErrors: [
            {
              value: 0.9,
              feedback: "It looks like you added the two probabilities here.",
              misconception: "and_means_add",
            },
          ],
        }),
        v: 0.9,
        section: "Core Probability",
      },
      {
        q: baseNum({ answer: 42, decimals: undefined, commonErrors: [] }),
        v: 5,
        section: "Core Puzzles",
      },
    ];
    for (const { q, v, section } of cases) {
      const ladder = buildHintLadder({ question: q, chosenValue: v, section });
      for (const rung of ladder.slice(0, 4)) {
        expect(containsFinalAnswer(rung.text, q.answer, 1e-9)).toBe(false);
      }
    }
  });
});

/* ========================================================================== */
/*  Rung-1 hint-ladder truncation regression (the committee P(n,k) trap +      */
/*  an exhaustive property sweep over every authored rationale/feedback).      */
/* ========================================================================== */

/** True iff `s` ends on a terminal `. ? !` (optionally quote/paren-wrapped). */
function endsTerminal(s: string): boolean {
  return /[.?!]["')\]]?$/.test(s.trim());
}

/** The final content word (ignoring trailing terminal punctuation), lowercased. */
function finalWord(s: string): string {
  return (
    s
      .trim()
      .replace(/[.?!"')\]]+$/g, "")
      .match(/([\p{L}\p{N}']+)$/u)?.[1] ?? ""
  ).toLowerCase();
}

// A dangling CONJUNCTION/article is the unambiguous fingerprint of a
// mid-sentence cut. (Coherent Socratic questions may end on a preposition +
// "?", e.g. "…normalise by?", which is grammatical and intentionally kept.)
const DANGLING_CONJUNCTION =
  /^(or|and|so|but|nor|yet|then|because|thus|hence|the|a|an)$/i;

// Rungs 2–4 are GENERIC (guided plan / worked-sibling / sim pointer) — authored
// never to embed the item's computed answer. They do, however, contain
// STRUCTURAL integers unrelated to the answer: plan step labels "(1) (2) (3)"
// and fixed sim titles like "Mixed Strategies (2×2 Zero-Sum)". The purely
// syntactic numeric scanner can't tell those from a genuine small-integer
// answer, so for rungs 2–4 we exempt small integer answers (|a| ≤ 12) — the only
// values that collide with such structural numbers. Rung 1 (the surface this fix
// touches) is ALWAYS checked strictly, and every non-trivial (decimal / larger)
// answer is still fully checked on rungs 2–4. Representative per-item rungs-1–4
// coverage also lives in the targeted tests above.
function answerAsNumber(a: number | string): number | null {
  if (typeof a === "number") return a;
  const frac = /^(-?\d+)\s*\/\s*(\d+)$/.exec(a.trim());
  if (frac) return Number(frac[2]) === 0 ? null : Number(frac[1]) / Number(frac[2]);
  const n = Number(a.replace(/[$,%\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function collidesWithStructuralInteger(a: number | string): boolean {
  const n = answerAsNumber(a);
  return n !== null && Number.isInteger(n) && Math.abs(n) <= 12;
}

describe("rung-1 truncation regression (the committee P(n,k) ordered-arrangements trap)", () => {
  const committeeQ: Question = {
    id: "ca-committee-7-2",
    prompt:
      "How many ways can you choose a committee of 2 from 7 people, where order does NOT matter?",
    // C(7,2) = 21 is correct; P(7,2) = 42 is the ordered-arrangements trap.
    choices: ["21", "42", "14", "49"],
    correctIndex: 0,
    explanation:
      "A committee is unordered, so count combinations: C(7,2) = 21. The ordered count P(7,2) = 42 double-counts each pair 2! = 2 ways.",
    difficulty: "easy",
    distractorRationale: [
      "Correct — C(7,2) counts unordered pairs.",
      "Close, that's the number of ORDERED arrangements P(7,2). A committee doesn't care about order, so should you keep or divide out the 2! orderings of each group?",
      "That undercounts — you left out some valid committees.",
      "That's the number of ordered pairs allowing repeats.",
    ],
    misconceptions: ["", MISCONCEPTION.orderedVsUnordered, "", ""],
    family: "genChooseKTrap",
  };

  it("rung 1 is a COMPLETE thought: ends in punctuation, no 'keep or' dangling, no revealed '2!' method, answer withheld", () => {
    const ladder = buildHintLadder({
      question: committeeQ,
      chosenIndex: 1,
      misconceptionTag: MISCONCEPTION.orderedVsUnordered,
      section: "Combinatorial Analysis",
    });
    const rung1 = ladder[0].text;
    expect(endsTerminal(rung1)).toBe(true);
    expect(DANGLING_CONJUNCTION.test(finalWord(rung1))).toBe(false);
    expect(rung1).not.toMatch(/keep or/i);
    expect(rung1).not.toMatch(/divide/i);
    expect(rung1).not.toContain("2!");
    // Still NAMES the trap...
    expect(rung1).toMatch(/ORDERED arrangements/i);
    expect(rung1).toContain("A committee doesn't care about order");
    // ...and never reveals the answer (21) on rungs 1–4.
    const answer = committeeQ.choices[committeeQ.correctIndex];
    for (const rung of ladder.slice(0, 4)) {
      expect(containsFinalAnswer(rung.text, answer)).toBe(false);
    }
  });
});

/* ========================================================================== */
/*  RC3a: rung-1 answer-guard SANITISES (redacts) a quoted answer instead of   */
/*  silently dropping to the content-free generic nudge.                       */
/* ========================================================================== */

describe("nameTrapWithoutAnswer (RC3a: redact the leaked answer, keep the diagnosis)", () => {
  it("keeps the naming clause and redacts a leaked numeric answer (no drop-to-generic)", () => {
    // A common-error feedback that quotes the CORRECT value (0.9) to contrast.
    const out = nameTrapWithoutAnswer(
      "That's the tighter Chebyshev variance bound, not the looser Markov mean bound of 0.9 here.",
      0.9,
    );
    expect(out).not.toBe(""); // did NOT drop to generic
    expect(out).toMatch(/Chebyshev/i);
    expect(out).toMatch(/Markov/i);
    expect(containsFinalAnswer(out, 0.9, 1e-9)).toBe(false);
    expect(out).not.toContain("0.9");
    expect(out.trim()).toMatch(/[.?!]$/);
  });

  it("redacts a leaked fraction answer while preserving the trap name", () => {
    const out = nameTrapWithoutAnswer(
      "You reported the complement 1/3 for this streak instead.",
      "1/3",
    );
    // "instead" is a corrective marker → nameOnlyCoaching alone already trims it,
    // but if the answer survives we must still be answer-free and non-empty.
    expect(containsFinalAnswer(out, "1/3")).toBe(false);
  });

  it("returns '' (→ caller uses generic) only when nothing nameable survives redaction", () => {
    // The whole feedback IS the answer token — nothing nameable remains.
    expect(nameTrapWithoutAnswer("0.25", 0.25)).toBe("");
  });
});

describe("buildHintLadder rung-1 (RC3a: sanitise, don't drop-to-generic)", () => {
  const GENERIC_FINGERPRINT = /not the right answer/i;

  it("numeric matched feedback quoting the answer keeps the SPECIFIC diagnosis (not generic)", () => {
    const q: NumericQuestion = {
      id: "vc-markovbound-leak",
      prompt: "Markov's inequality upper bound? (Round to 4 decimals.)",
      answer: 0.9,
      decimals: 4,
      difficulty: "medium",
      explanation: "Markov: bound = E[X]/a = 0.9.",
      unit: "",
      commonErrors: [
        {
          value: 0.5,
          // Quotes the correct value 0.9 to contrast — the old guard tripped on
          // this and silently fell back to the generic nudge.
          feedback:
            "That's the tighter Chebyshev variance bound, not the looser Markov mean bound of 0.9 here.",
          misconception: MISCONCEPTION.nVsNMinusOne,
        },
      ],
    };
    const ladder = buildHintLadder({
      question: q,
      chosenValue: 0.5,
      section: "Variance, Covariance & the CLT",
    });
    const rung1 = ladder[0].text;
    // Kept the specific trap name...
    expect(rung1).toMatch(/Chebyshev/i);
    expect(rung1).toMatch(/Markov/i);
    // ...did NOT collapse to the content-free generic nudge...
    expect(rung1).not.toMatch(GENERIC_FINGERPRINT);
    // ...and is still answer-free on rungs 1–4.
    for (const rung of ladder.slice(0, 4)) {
      expect(containsFinalAnswer(rung.text, q.answer, 1e-9)).toBe(false);
    }
  });

  it("quiz distractor rationale quoting the answer keeps the diagnosis (answer redacted)", () => {
    const q: Question = {
      id: "vc-leak-quiz",
      prompt: "Which bound applies to this one-sided tail?",
      choices: ["0.9", "0.5", "0.1", "0.3"],
      correctIndex: 0,
      explanation: "Markov gives 0.9.",
      difficulty: "medium",
      distractorRationale: [
        "Correct — Markov's mean-based cap.",
        "That's the Chebyshev variance bound, not the Markov mean cap of 0.9 for this tail.",
        "Off by an order of magnitude.",
        "That mixes up the threshold.",
      ],
      family: "genMarkovBound",
    };
    const ladder = buildHintLadder({
      question: q,
      chosenIndex: 1,
      section: "Variance, Covariance & the CLT",
    });
    const rung1 = ladder[0].text;
    expect(rung1).toMatch(/Chebyshev/i);
    expect(rung1).not.toMatch(GENERIC_FINGERPRINT);
    expect(containsFinalAnswer(rung1, "0.9")).toBe(false);
    expect(rung1).not.toContain("0.9");
  });
});

/* ========================================================================== */
/*  RC3b: arithmetic-slip nudge is GATED to genuine numeric-arithmetic         */
/*  contexts (misleading "your logic is spot on" no longer fires on logic).    */
/* ========================================================================== */

describe("buildHintLadder rung-1 (RC3b: arithmetic-slip gating)", () => {
  const SLIP_FINGERPRINT = /logic looks spot on/i;
  const GENERIC_FINGERPRINT = /not the right answer/i;

  const numBase = (over: Partial<NumericQuestion>): NumericQuestion => ({
    id: "slip-x",
    prompt: "How many?",
    answer: 20,
    decimals: undefined,
    difficulty: "easy",
    explanation: "It is 20.",
    unit: "",
    commonErrors: [],
    ...over,
  });

  it("does NOT fire the arithmetic-slip nudge on a LOGIC/construction puzzle (misleading there)", () => {
    const q = numBase({});
    const ladder = buildHintLadder({
      question: q,
      chosenValue: 19, // close → would look like an arithmetic slip
      section: "Core Puzzles",
      // note: family threaded via question; pigeonhole is a logic construction
    });
    // Sanity: 19 vs 20 IS within the arithmetic-slip band.
    const rung1 = ladder[0].text;
    expect(rung1).not.toMatch(SLIP_FINGERPRINT);
    // Falls to the honest generic nudge instead.
    expect(rung1).toMatch(GENERIC_FINGERPRINT);
    expect(containsFinalAnswer(rung1, q.answer, 1e-9)).toBe(false);
  });

  it("does NOT fire on a logic family id even outside a puzzle section", () => {
    const q = numBase({ family: "genPigeonhole" });
    const ladder = buildHintLadder({
      question: q,
      chosenValue: 19,
      section: "Number Theory & Counting",
    });
    expect(ladder[0].text).not.toMatch(SLIP_FINGERPRINT);
  });

  it("STILL fires the arithmetic-slip nudge on a genuine mental-math numeric context", () => {
    const q = numBase({ answer: 42, explanation: "It is 42." });
    const ladder = buildHintLadder({
      question: q,
      chosenValue: 41, // close numeric near-miss
      section: "Mental Math",
    });
    const rung1 = ladder[0].text;
    expect(rung1).toMatch(SLIP_FINGERPRINT);
    expect(containsFinalAnswer(rung1, q.answer, 1e-9)).toBe(false);
  });

  it("does NOT fire on a STATIC derivation item recognised only by its concept (the ig-max-dice screenshot)", () => {
    // The Interview-Games "expected maximum of two dice" item is a STATIC pool
    // item with no section/family — only `concept` marks it as a derivation
    // problem. A close-but-wrong entry (4.5 vs 4.47) reflects a setup/formula
    // slip, not a digit slip, so "your logic is spot on" would mislead.
    const q: NumericQuestion = {
      id: "ig-max-dice",
      prompt:
        "Two fair six-sided dice are rolled. What is the expected value of the LARGER of the two?",
      answer: 4.47,
      decimals: 2,
      difficulty: "hard",
      explanation:
        "P(max = k) = (2k − 1)/36. E[max] = Σ k·(2k−1)/36 = 161/36 ≈ 4.47.",
      unit: "",
      concept: "Order statistics / expected maximum",
      commonErrors: [],
    };
    const ladder = buildHintLadder({ question: q, chosenValue: 4.5 });
    const rung1 = ladder[0].text;
    // Sanity: 4.5 vs 4.47 is well within the arithmetic-slip band.
    expect(rung1).not.toMatch(SLIP_FINGERPRINT);
    expect(rung1).toMatch(GENERIC_FINGERPRINT);
    expect(containsFinalAnswer(rung1, q.answer, 1e-9)).toBe(false);
  });
});

describe("rung-1 property sweep over EVERY authored quiz/numeric rationale", () => {
  // Enumerate every playable level, materialise it across many seeds (so
  // parametric rationale text is exercised), build the SHIPPED hint ladder for
  // each wrong choice / common-error, and assert the invariants the truncation
  // bug violated.
  const SEEDS = Array.from({ length: 24 }, (_, i) => i * 29 + 1);

  it("rung 1 always ends in terminal punctuation and never on a dangling conjunction; rungs 1–4 never leak the answer; rung 2 terminates cleanly", () => {
    const seen = new Set<string>();
    let checked = 0;

    for (const track of PLAYABLE_TRACKS) {
      for (const level of track.levels) {
        if (isFlashcardLevel(level)) continue;
        const section = level.section;

        if (isNumericLevel(level)) {
          for (const seed of SEEDS) {
            for (const q of materializeNumericLevel(level, seed)) {
              for (const ce of q.commonErrors ?? []) {
                if (seen.has(`N::${ce.feedback}`)) continue;
                seen.add(`N::${ce.feedback}`);
                checked++;
                const ladder = buildHintLadder({
                  question: q,
                  chosenValue: ce.value,
                  misconceptionTag: ce.misconception,
                  section,
                });
                const rung1 = ladder[0].text;
                expect(endsTerminal(rung1)).toBe(true);
                expect(DANGLING_CONJUNCTION.test(finalWord(rung1))).toBe(false);
                expect(rung1.trim().length).toBeGreaterThanOrEqual(15);
                expect(endsTerminal(ladder[1].text)).toBe(true);
                // Rung 1 (the changed surface): STRICT — no answer at all.
                expect(containsFinalAnswer(rung1, q.answer, 1e-9)).toBe(false);
                if (!collidesWithStructuralInteger(q.answer)) {
                  for (const rung of ladder.slice(1, 4)) {
                    expect(containsFinalAnswer(rung.text, q.answer, 1e-9)).toBe(false);
                  }
                }
              }
            }
          }
        } else {
          for (const seed of SEEDS) {
            for (const q of materializeLevel(level, seed)) {
              if (!q.distractorRationale) continue;
              for (let i = 0; i < q.distractorRationale.length; i++) {
                if (i === q.correctIndex) continue;
                const r = q.distractorRationale[i];
                if (!r || seen.has(`Q::${r}`)) continue;
                seen.add(`Q::${r}`);
                checked++;
                const answer = q.choices[q.correctIndex];
                const ladder = buildHintLadder({
                  question: q,
                  chosenIndex: i,
                  misconceptionTag: q.misconceptions?.[i],
                  section,
                });
                const rung1 = ladder[0].text;
                expect(endsTerminal(rung1)).toBe(true);
                expect(DANGLING_CONJUNCTION.test(finalWord(rung1))).toBe(false);
                expect(rung1.trim().length).toBeGreaterThanOrEqual(15);
                expect(endsTerminal(ladder[1].text)).toBe(true);
                expect(containsFinalAnswer(rung1, answer)).toBe(false);
                if (!collidesWithStructuralInteger(answer)) {
                  for (const rung of ladder.slice(1, 4)) {
                    expect(containsFinalAnswer(rung.text, answer)).toBe(false);
                  }
                }
              }
            }
          }
        }
      }
    }

    // Sanity: the sweep actually exercised a large, representative corpus.
    expect(checked).toBeGreaterThan(1000);
  });
});

/* ========================================================================== */
/*  V5: the SAME rung-1 well-formedness sweep, now over the DIAGNOSTIC corpus  */
/*  — the UNTIMED_BLUEPRINT (authored + parametric + hard-adapter items) and   */
/*  every frAdapters projection — so a blueprint/adapter rationale can never   */
/*  ship a truncated, dangling, or answer-leaking rung 1 either.               */
/* ========================================================================== */

/** Assert the shipped rung-1..4 invariants for one wrong numeric attempt. */
function assertRungInvariants(
  q: NumericQuestion,
  ce: NonNullable<NumericQuestion["commonErrors"]>[number],
  section: string | undefined,
): void {
  const ladder = buildHintLadder({
    question: q,
    chosenValue: ce.value,
    misconceptionTag: ce.misconception,
    section,
  });
  const rung1 = ladder[0].text;
  expect(endsTerminal(rung1)).toBe(true);
  expect(DANGLING_CONJUNCTION.test(finalWord(rung1))).toBe(false);
  expect(rung1.trim().length).toBeGreaterThanOrEqual(15);
  expect(endsTerminal(ladder[1].text)).toBe(true);
  // Rung 1: STRICT — never any form of the answer.
  expect(containsFinalAnswer(rung1, q.answer, 1e-9)).toBe(false);
  if (!collidesWithStructuralInteger(q.answer)) {
    for (const rung of ladder.slice(1, 4)) {
      expect(containsFinalAnswer(rung.text, q.answer, 1e-9)).toBe(false);
    }
  }
}

describe("V5 — rung-1 property sweep over UNTIMED_BLUEPRINT + frAdapters outputs", () => {
  const SEEDS = Array.from({ length: 16 }, (_, i) => i * 37 + 3);

  it("every UNTIMED_BLUEPRINT numeric item's commonErrors ship a well-formed, answer-free rung 1", () => {
    const seen = new Set<string>();
    let checked = 0;
    for (const seed of SEEDS) {
      for (const m of materializeUntimedRun(seed)) {
        if (m.kind !== "numeric") continue;
        const q = m.question;
        // The blueprint's own subtopic tag stands in for the drill `section`
        // (mirrors how DrillingStage threads the topic label into the ladder).
        const section = m.subtopic;
        for (const ce of q.commonErrors ?? []) {
          const key = `${q.id}::${ce.feedback}`;
          if (seen.has(key)) continue;
          seen.add(key);
          checked++;
          assertRungInvariants(q, ce, section);
        }
      }
    }
    // The blueprint is ~100 items; across seeds we exercise a broad corpus.
    expect(checked).toBeGreaterThan(60);
  });

  it("every frAdapters family projection ships a well-formed, answer-free rung 1 (all seeds)", () => {
    const seen = new Set<string>();
    let checked = 0;
    for (const family of FR_ADAPTER_FAMILIES) {
      for (const seed of SEEDS) {
        const { question } = adaptHardOaToFreeResponse(family, new Rng(seed));
        for (const ce of question.commonErrors ?? []) {
          const key = `${family}::${ce.feedback}`;
          if (seen.has(key)) continue;
          seen.add(key);
          checked++;
          assertRungInvariants(question, ce, `hard::${family}`);
        }
      }
    }
    // Every hard family projects distractors; the sweep must have real coverage.
    expect(checked).toBeGreaterThan(FR_ADAPTER_FAMILIES.length);
  });
});

/* ========================================================================== */
/*  Rung-1 DIRECTIONAL NUDGE: the first hint must both NAME the error AND point */
/*  at the concept to reconsider — without revealing the fix, method, or        */
/*  answer, and without leaking a later rung's content.                         */
/* ========================================================================== */

describe("directionalNudge (misconception → conceptual nudge)", () => {
  // Every nudge is a directional "reconsider …" cue: non-empty, digit-free (so
  // it can never carry a numeric answer), and a complete terminated clause.
  const cases: { tag: string; fingerprint: RegExp }[] = [
    { tag: MISCONCEPTION.orMeansAddNoOverlap, fingerprint: /double-count|account for/i },
    { tag: MISCONCEPTION.andMeansAdd, fingerprint: /both events|larger or smaller/i },
    { tag: MISCONCEPTION.complementConfusion, fingerprint: /does NOT|chance this happens/i },
    { tag: MISCONCEPTION.reversedConditional, fingerprint: /already happened|smaller world/i },
    { tag: MISCONCEPTION.baseRateNeglect, fingerprint: /before any evidence/i },
    { tag: MISCONCEPTION.orderedVsUnordered, fingerprint: /different order|new outcome/i },
    { tag: MISCONCEPTION.atLeastOneNaive, fingerprint: /pile up|break down/i },
    { tag: MISCONCEPTION.gamblersFallacy, fingerprint: /earlier independent|next trial/i },
    { tag: MISCONCEPTION.conjunctionFallacy, fingerprint: /extra requirement|more likely/i },
    { tag: MISCONCEPTION.nVsNMinusOne, fingerprint: /population|limited sample/i },
    { tag: MISCONCEPTION.equalWeightMixture, fingerprint: /equal weight|occur more often/i },
    { tag: MISCONCEPTION.forgotDivideByTwo, fingerprint: /each pairing|each order/i },
    { tag: MISCONCEPTION.memorylessUniform, fingerprint: /time already spent/i },
    // Free-form content tags are classified by family, not exact string.
    { tag: "with_replacement_ignored", fingerprint: /next pick|left available/i },
    { tag: "off_by_one_continuation", fingerprint: /how many steps|endpoints/i },
    { tag: "ignored_host_information", fingerprint: /already happened|smaller world/i },
  ];

  it("maps each representative misconception to a specific, digit-free nudge", () => {
    for (const { tag, fingerprint } of cases) {
      const nudge = directionalNudge(tag, "");
      expect(nudge, `tag=${tag}`).not.toBe("");
      expect(nudge, `tag=${tag}`).toMatch(fingerprint);
      // Never carries a digit (so it can never leak a numeric answer)...
      expect(nudge, `tag=${tag}`).not.toMatch(/\d/);
      // ...never reveals an operational method...
      expect(nudge, `tag=${tag}`).not.toMatch(/multiply|divide|subtract/i);
      // ...and is a complete, terminated thought.
      expect(nudge.trim(), `tag=${tag}`).toMatch(/[.?!]$/);
    }
  });

  it("falls back to a whole-word cue in the naming text when the tag carries no signal", () => {
    // Placeholder tags (idx:/err:/empty) → classify off the naming clause.
    expect(directionalNudge("idx:1", "You averaged the two rates equally.")).toMatch(
      /equal weight|occur more often/i,
    );
    expect(directionalNudge("err:5", "You reported the complement here.")).toMatch(
      /does NOT|chance this happens/i,
    );
    // Nothing classifiable → empty (caller keeps the plain name-only clause).
    expect(directionalNudge("", "That value is not right.")).toBe("");
  });
});

describe("buildHintLadder rung-1 directional nudge (names error + nudges concept)", () => {
  const numItem = (over: Partial<NumericQuestion>): NumericQuestion => ({
    id: "nudge-x",
    prompt: "What is the probability?",
    answer: 0.5,
    decimals: 4,
    difficulty: "easy",
    explanation: "It is 0.5.",
    unit: "",
    ...over,
  });

  it("the OR-probability case: names the addition AND nudges toward double-counting (no fix/answer)", () => {
    const q = numItem({
      answer: 0.7,
      commonErrors: [
        {
          value: 0.9,
          feedback: "You added the two probabilities here.",
          misconception: MISCONCEPTION.orMeansAddNoOverlap,
        },
      ],
    });
    const ladder = buildHintLadder({
      question: q,
      chosenValue: 0.9,
      misconceptionTag: MISCONCEPTION.orMeansAddNoOverlap,
      section: "Core Probability",
    });
    const rung1 = ladder[0].text;
    // (a) still NAMES what they did...
    expect(rung1).toMatch(/added/i);
    // (b) ...and now ALSO gives a directional nudge at the concept...
    expect(rung1).toMatch(/double-count|account for/i);
    // ...without revealing the corrective operation or the answer.
    expect(rung1).not.toMatch(/multiply|divide|subtract|you should|instead/i);
    expect(containsFinalAnswer(rung1, q.answer, 1e-9)).toBe(false);
    // A single, complete, non-truncating thought.
    expect(rung1.trim()).toMatch(/[.?!]$/);
  });

  it("the AND-independence case: names the error AND nudges at the size of a joint event", () => {
    const q = numItem({
      answer: 0.0833,
      commonErrors: [
        {
          value: 0.6667,
          feedback: "You added the probabilities instead of combining them.",
          misconception: MISCONCEPTION.andMeansAdd,
        },
      ],
    });
    const rung1 = buildHintLadder({
      question: q,
      chosenValue: 0.6667,
      misconceptionTag: MISCONCEPTION.andMeansAdd,
      section: "Core Probability",
    })[0].text;
    expect(rung1).toMatch(/added/i);
    expect(rung1).toMatch(/both events|larger or smaller/i);
    expect(rung1).not.toMatch(/multiply|divide|instead/i);
    expect(containsFinalAnswer(rung1, q.answer, 1e-9)).toBe(false);
  });

  it("the complement case: names the mistake AND nudges at happens-vs-does-not", () => {
    const q = numItem({
      answer: 0.3,
      commonErrors: [
        {
          value: 0.7,
          feedback: "You reported the complement of the asked event.",
          misconception: MISCONCEPTION.complementConfusion,
        },
      ],
    });
    const rung1 = buildHintLadder({
      question: q,
      chosenValue: 0.7,
      misconceptionTag: MISCONCEPTION.complementConfusion,
      section: "Core Probability",
    })[0].text;
    expect(rung1).toMatch(/complement/i);
    expect(rung1).toMatch(/does NOT|chance this happens/i);
    expect(containsFinalAnswer(rung1, q.answer, 1e-9)).toBe(false);
  });

  it("the unordered-vs-ordered committee case: names the trap AND nudges at re-arrangement", () => {
    const committeeQ: Question = {
      id: "ca-committee-nudge",
      prompt: "How many committees of 2 from 7 (order does NOT matter)?",
      choices: ["21", "42", "14", "49"],
      correctIndex: 0,
      explanation: "C(7,2) = 21.",
      difficulty: "easy",
      distractorRationale: [
        "Correct.",
        "Close, that's the number of ORDERED arrangements P(7,2). A committee doesn't care about order.",
        "That undercounts.",
        "That allows repeats.",
      ],
      misconceptions: ["", MISCONCEPTION.orderedVsUnordered, "", ""],
      family: "genChooseKTrap",
    };
    const rung1 = buildHintLadder({
      question: committeeQ,
      chosenIndex: 1,
      misconceptionTag: MISCONCEPTION.orderedVsUnordered,
      section: "Combinatorial Analysis",
    })[0].text;
    expect(rung1).toMatch(/ORDERED arrangements/i);
    expect(rung1).toMatch(/different order|new outcome/i);
    // Never reveals the correcting operation or the answer.
    expect(rung1).not.toMatch(/divide/i);
    expect(rung1).not.toContain("2!");
    expect(containsFinalAnswer(rung1, committeeQ.choices[0])).toBe(false);
  });

  it("does NOT double-nudge an authored Socratic question (already directional)", () => {
    const q = numItem({
      answer: 0.25,
      commonErrors: [
        {
          value: 0.5,
          feedback:
            "That's the joint P(A∩B). Conditioning restricts you to the world where B happened, what must you compare the joint against?",
          misconception: MISCONCEPTION.reversedConditional,
        },
      ],
    });
    const rung1 = buildHintLadder({
      question: q,
      chosenValue: 0.5,
      misconceptionTag: MISCONCEPTION.reversedConditional,
      section: "Core Probability",
    })[0].text;
    // The authored question is preserved verbatim (ends on '?', no spliced dash).
    expect(rung1.trim()).toMatch(/\?$/);
    expect(rung1).not.toMatch(/ — but think about/);
  });

  it("the appended nudge never leaks a LATER rung's content (worked-sibling / reveal)", () => {
    const q = numItem({
      answer: 0.7,
      explanation: "Use inclusion–exclusion: the answer is 0.7.",
      commonErrors: [
        {
          value: 0.9,
          feedback: "You added the two probabilities here.",
          misconception: MISCONCEPTION.orMeansAddNoOverlap,
        },
      ],
    });
    const ladder = buildHintLadder({
      question: q,
      chosenValue: 0.9,
      misconceptionTag: MISCONCEPTION.orMeansAddNoOverlap,
      section: "Core Probability",
    });
    const rung1 = ladder[0].text;
    // Not the worked-sibling header, not the reveal explanation.
    expect(rung1).not.toContain("SAME kind of problem");
    expect(rung1).not.toContain(q.explanation);
    expect(rung1).not.toBe(ladder[4].text);
  });
});
