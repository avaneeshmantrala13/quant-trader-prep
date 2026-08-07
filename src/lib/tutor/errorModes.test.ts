import { describe, expect, it } from "vitest";
import {
  buildCommonErrors,
  matchErrorMode,
  classifyFallbackTopic,
  genericFallbackCoaching,
  inferAnswerDomain,
  isOutOfDomain,
  domainPointerCoaching,
  isArithmeticSlip,
  arithmeticSlipCoaching,
  isDeterministicContext,
  isLogicOrConstructionContext,
  type ErrorModeCatalog,
} from "./errorModes";

/** Operational method words rung 1 must NEVER reveal in the generic nudge. */
const METHOD_WORDS =
  /multiply|order matters|combinations|probability × value|1 − p|1-p|\bA AND B\b|\bA OR B\b/i;

// A tiny illustrative family: "P(A and B) for independent events" with params
// {pa, pb}. Correct = pa*pb. Error modes are parametric solvers.
interface AndParams {
  pa: number;
  pb: number;
}

const AND_CATALOG: ErrorModeCatalog<AndParams> = [
  {
    id: "added_instead_of_multiplied",
    misconception: "and_means_add",
    compute: ({ pa, pb }) => pa + pb,
    coach: ({ pa, pb }) =>
      `Close! It looks like you added ${pa} and ${pb}. But the wording says "A AND B" — what do independent probabilities do on AND?`,
  },
  {
    id: "took_the_max",
    misconception: "and_is_max",
    compute: ({ pa, pb }) => Math.max(pa, pb),
    coach: `You seem to have taken the larger of the two. For "A AND B", does requiring BOTH make the chance bigger or smaller than either one alone?`,
  },
  // A mode that will collide with the correct value for pa=pb=... never applies
  // here; included to exercise the "compute → null" skip path.
  {
    id: "n_a",
    misconception: "n_a",
    compute: () => null,
    coach: "n/a",
  },
];

describe("buildCommonErrors", () => {
  it("computes the parametric wrong values with coaching + misconception", () => {
    const errs = buildCommonErrors(AND_CATALOG, { pa: 0.5, pb: 0.4 }, 0.2, {
      decimals: 4,
    });
    expect(errs).toHaveLength(2);
    expect(errs[0]).toMatchObject({
      value: 0.9,
      misconception: "and_means_add",
    });
    expect(errs[0].feedback).toContain("added");
    expect(errs[1]).toMatchObject({ value: 0.5, misconception: "and_is_max" });
  });

  it("drops a mode whose value equals the correct answer (not a distractor)", () => {
    // pa=1, pb=0 → correct=0; max=1, add=1 collide with each other but not with
    // correct. Use pa=0, pb=0.3 → correct=0; add=0.3, max=0.3 collide → 1 kept.
    const errs = buildCommonErrors(AND_CATALOG, { pa: 0, pb: 0.3 }, 0, {
      decimals: 4,
    });
    // add=0.3 and max=0.3 are the SAME value → only the first survives.
    expect(errs).toHaveLength(1);
    expect(errs[0].value).toBeCloseTo(0.3, 6);
    expect(errs[0].misconception).toBe("and_means_add");
  });

  it("drops a mode that collides with the correct value", () => {
    // pa=0.2, pb=0 → correct=0; add=0.2, max=0.2 collide → 1 survives (0.2).
    // Now make correct collide: pa=0.5,pb=0.5 → correct=0.25; add=1.0,max=0.5.
    const errs = buildCommonErrors(AND_CATALOG, { pa: 0.5, pb: 0.5 }, 0.25, {
      decimals: 4,
    });
    expect(errs.map((e) => e.value).sort()).toEqual([0.5, 1.0]);
  });
});

describe("matchErrorMode", () => {
  const params = { pa: 0.5, pb: 0.4 };
  const correct = 0.2;

  it("matches an entry to its parametric error mode", () => {
    const m = matchErrorMode(AND_CATALOG, params, correct, 0.9, { decimals: 4 });
    expect(m?.misconception).toBe("and_means_add");
    expect(m?.coaching).toContain("added");
  });

  it("returns undefined for the correct value", () => {
    expect(
      matchErrorMode(AND_CATALOG, params, correct, 0.2, { decimals: 4 }),
    ).toBeUndefined();
  });

  it("returns undefined for an unmatched entry (fall back to generic nudge)", () => {
    expect(
      matchErrorMode(AND_CATALOG, params, correct, 0.123, { decimals: 4 }),
    ).toBeUndefined();
  });

  it("is deterministic under collisions (first catalog entry wins)", () => {
    const m = matchErrorMode(AND_CATALOG, { pa: 0, pb: 0.3 }, 0, 0.3, {
      decimals: 4,
    });
    expect(m?.misconception).toBe("and_means_add");
  });
});

describe("genericFallbackCoaching (unaccounted-error fallback)", () => {
  it("does NOT say the old bare 'Arithmetic error.' / claim a specific known trap", () => {
    const msg = genericFallbackCoaching();
    expect(msg).not.toBe("Arithmetic error.");
    expect(msg).not.toMatch(/arithmetic error\.?$/i);
    // Must not fabricate a specific misconception or falsely assert knowledge.
    expect(msg).not.toMatch(/you tripped a common trap/i);
    expect(msg).not.toMatch(/the mistake is (usually )?in the set-?up/i);
  });

  it("honestly acknowledges it's wrong WITHOUT inventing a cause, and invites another try", () => {
    const msg = genericFallbackCoaching();
    expect(msg.toLowerCase()).toContain("not the right answer");
    // Explicitly disclaims knowing the specific mistake.
    expect(msg).toMatch(/won't guess|doesn't line up with any/i);
    // Invites a re-attempt / advancing the ladder.
    expect(msg).toMatch(/try again|next hint/i);
  });

  it("gives a generic-but-useful self-check when no topic info is available", () => {
    const msg = genericFallbackCoaching();
    expect(msg).toMatch(/re-check each arithmetic step/i);
    expect(msg).toMatch(/units|representation/i);
  });

  it("classifies topics from section/family text", () => {
    expect(classifyFallbackTopic({ section: "Core Probability" })).toBe(
      "probability",
    );
    expect(
      classifyFallbackTopic({ section: "Conditional Probability" }),
    ).toBe("probability");
    expect(classifyFallbackTopic({ section: "Combinatorial Analysis" })).toBe(
      "combinatorics",
    );
    expect(classifyFallbackTopic({ section: "Expected Value" })).toBe(
      "expected-value",
    );
    expect(
      classifyFallbackTopic({ section: "Variance, Covariance & the CLT" }),
    ).toBe("variance-stats");
    expect(classifyFallbackTopic({ family: "genMentalAddition" })).toBe(
      "mental-math",
    );
    expect(classifyFallbackTopic({})).toBe("generic");
    expect(classifyFallbackTopic({ section: "Core Puzzles" })).toBe("generic");
  });

  it("gives a METHOD-FREE probability nudge (no AND/OR operational rule)", () => {
    const msg = genericFallbackCoaching({ section: "Core Probability" });
    // Still honest, still invites a re-check — but no operational method words.
    expect(msg.toLowerCase()).toContain("not the right answer");
    expect(msg).toMatch(/re-check each arithmetic step/i);
    expect(msg).toMatch(/units|representation/i);
    expect(msg).not.toMatch(METHOD_WORDS);
    expect(msg).not.toMatch(/you tripped a common trap/i);
  });

  it("keeps EVERY topic nudge method-free (no operational rules enumerated)", () => {
    for (const section of [
      "Core Probability",
      "Combinatorial Analysis",
      "Expected Value",
      "Variance, Covariance & the CLT",
    ]) {
      const msg = genericFallbackCoaching({ section });
      expect(msg).not.toMatch(METHOD_WORDS);
      expect(msg).toMatch(/re-check each arithmetic step/i);
      expect(msg).toMatch(/units|representation/i);
    }
  });
});

describe("inferAnswerDomain / isOutOfDomain / domainPointerCoaching", () => {
  it("infers a probability domain and flags values outside [0, 1]", () => {
    const d = inferAnswerDomain({
      section: "Core Probability",
      unit: "",
      answer: 0.2,
    });
    expect(d.kind).toBe("probability");
    expect(isOutOfDomain(1.4, d)).toBe(true);
    expect(isOutOfDomain(-0.1, d)).toBe(true);
    expect(isOutOfDomain(0.3, d)).toBe(false);
    expect(domainPointerCoaching(d)).toContain("[0, 1]");
  });

  it("infers a count domain and flags negative / non-integer counts", () => {
    const d = inferAnswerDomain({ section: "Combinatorial Analysis", answer: 42 });
    expect(d.kind).toBe("count");
    expect(isOutOfDomain(-3, d)).toBe(true);
    expect(isOutOfDomain(4.5, d)).toBe(true);
    expect(isOutOfDomain(10, d)).toBe(false);
    expect(domainPointerCoaching(d).toLowerCase()).toContain("count");
  });

  it("infers a non-negative domain for variance/σ and flags negatives", () => {
    const d = inferAnswerDomain({
      section: "Variance, Covariance & the CLT",
      answer: 2.5,
    });
    expect(d.kind).toBe("nonneg");
    expect(isOutOfDomain(-1, d)).toBe(true);
    expect(isOutOfDomain(3, d)).toBe(false);
    expect(domainPointerCoaching(d).toLowerCase()).toContain("negative");
  });

  it("infers a non-negative dollar-stake domain for Kelly and flags negatives", () => {
    const d = inferAnswerDomain({ unit: "$", answer: 25 });
    expect(d.kind).toBe("nonneg");
    expect(isOutOfDomain(-5, d)).toBe(true);
    expect(domainPointerCoaching(d).toLowerCase()).toContain("negative");
  });

  it("treats expected-value / real quantities as never out of domain", () => {
    const d = inferAnswerDomain({ section: "Expected Value", answer: -3.2 });
    expect(d.kind).toBe("real");
    expect(isOutOfDomain(-9999, d)).toBe(false);
    expect(isOutOfDomain(9999, d)).toBe(false);
    expect(domainPointerCoaching(d)).toBe("");
  });

  it("none of the pointers reveal a corrective operation", () => {
    for (const d of [
      inferAnswerDomain({ section: "Core Probability", unit: "", answer: 0.2 }),
      inferAnswerDomain({ section: "Combinatorial Analysis", answer: 42 }),
      inferAnswerDomain({ section: "Variance, Covariance & the CLT", answer: 2 }),
    ]) {
      expect(domainPointerCoaching(d)).not.toMatch(METHOD_WORDS);
    }
  });
});

describe("isArithmeticSlip / arithmeticSlipCoaching", () => {
  it("flags a close-but-not-exact value as an arithmetic slip", () => {
    expect(isArithmeticSlip(0.19, 0.2)).toBe(true);
    expect(isArithmeticSlip(41, 42)).toBe(true);
  });

  it("does NOT flag a far-off value or an exact match", () => {
    expect(isArithmeticSlip(0.9, 0.2)).toBe(false);
    expect(isArithmeticSlip(0.2, 0.2)).toBe(false);
    expect(isArithmeticSlip(100, 0)).toBe(false);
  });

  it("coaching mentions arithmetic and reveals no numeric value", () => {
    const msg = arithmeticSlipCoaching();
    expect(msg.toLowerCase()).toContain("arithmetic");
    expect(msg).not.toMatch(/\d/);
    expect(msg).not.toMatch(METHOD_WORDS);
  });
});

describe("isDeterministicContext (RC1: rung-4 generic elicitation flavour)", () => {
  it("flags deterministic arithmetic / logic / number-theory / sequence contexts", () => {
    expect(isDeterministicContext({ section: "Mental Math" })).toBe(true);
    expect(isDeterministicContext({ section: "Rates, Algebra & Word Problems" })).toBe(true);
    expect(isDeterministicContext({ section: "Geometry & Derivations" })).toBe(true);
    expect(isDeterministicContext({ section: "Number Theory & Counting" })).toBe(true);
    expect(isDeterministicContext({ section: "Sequences & Pattern Recognition" })).toBe(true);
    expect(isDeterministicContext({ section: "Core Puzzles" })).toBe(true);
    expect(isDeterministicContext({ family: "genMentalAddition" })).toBe(true);
    expect(isDeterministicContext({ family: "genSumOddsRangeNumeric" })).toBe(true);
    expect(isDeterministicContext({ family: "geometricNext" })).toBe(true);
  });

  it("does NOT flag genuine probability contexts (they keep the trial/enumerate confront)", () => {
    expect(isDeterministicContext({ section: "Core Probability" })).toBe(false);
    expect(isDeterministicContext({ section: "Conditional Probability" })).toBe(false);
    expect(isDeterministicContext({ family: "genBinomial" })).toBe(false);
    expect(isDeterministicContext({ family: "genBayes" })).toBe(false);
    expect(isDeterministicContext({})).toBe(false);
  });
});

describe("isLogicOrConstructionContext (RC3b: arithmetic-slip gate)", () => {
  it("flags logic / construction / conceptual (brainteaser, game-theory, sequence) contexts", () => {
    expect(isLogicOrConstructionContext({ section: "Core Puzzles" })).toBe(true);
    expect(isLogicOrConstructionContext({ section: "Techniques Toolkit" })).toBe(true);
    expect(isLogicOrConstructionContext({ section: "Game Theory & Puzzles" })).toBe(true);
    expect(isLogicOrConstructionContext({ section: "Sequences & Pattern Recognition" })).toBe(true);
    expect(isLogicOrConstructionContext({ family: "genPigeonhole" })).toBe(true);
    expect(isLogicOrConstructionContext({ family: "geometricNext" })).toBe(true);
    expect(isLogicOrConstructionContext({ family: "genValue2x2" })).toBe(true);
  });

  it("does NOT flag genuine numeric-arithmetic contexts (arithmetic-slip stays enabled there)", () => {
    expect(isLogicOrConstructionContext({ section: "Mental Math" })).toBe(false);
    expect(isLogicOrConstructionContext({ section: "Core Probability" })).toBe(false);
    expect(isLogicOrConstructionContext({ family: "genMentalAddition" })).toBe(false);
    expect(isLogicOrConstructionContext({ family: "genExpectedValueNumeric" })).toBe(false);
    expect(isLogicOrConstructionContext({})).toBe(false);
  });

  it("flags derivation-heavy items by their `concept` when section/family are absent (static pools)", () => {
    // The Interview-Games EV pool carries no section/family — concept is the
    // only signal that a near-miss is a derivation, not a digit slip.
    expect(
      isLogicOrConstructionContext({ concept: "Order statistics / expected maximum" }),
    ).toBe(true);
    expect(
      isLogicOrConstructionContext({ concept: "Optimal stopping (secretary problem)" }),
    ).toBe(true);
    // A plain EV-of-a-bet concept is genuine arithmetic → still not flagged.
    expect(isLogicOrConstructionContext({ concept: "Expected value of a bet" })).toBe(
      false,
    );
  });
});
