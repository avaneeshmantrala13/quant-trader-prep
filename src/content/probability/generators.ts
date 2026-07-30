import type { Rng } from "@/lib/rng";
import type {
  Difficulty,
  NumericQuestion,
  Question,
  QuestionGenerator,
} from "@/types/content";
import { assemble, assembleDistinct, fmt, round } from "../shared";
import { mixQuestionGenerators } from "../mixFamilies";
import { MISCONCEPTION } from "@/lib/tutor/misconception";

/**
 * Probability generators with EXACT verifiers: the true answer is computed
 * deterministically from the parameters, so every item is provably correct and
 * can be regenerated fresh. The distractors are the heart of the design — each
 * wrong choice is produced by a *specific* reasoning error a real student makes
 * (e.g. for "P(A or B)": P(A)+P(B) forgets inclusion–exclusion; P(A)·P(B)
 * confuses "or" with independent "and"). Parameters are drawn from curated sets
 * chosen so the four resulting values are always distinct.
 */

const D = (n: number) => fmt(round(n, 4), 4);

/** P(A or B) via inclusion–exclusion, over integers 1..N. */
function genUnion(rng: Rng): Question {
  return assembleDistinct(rng, (r) => {
    const [N, d1, d2] = r.pick([
      [20, 3, 4],
      [24, 4, 6],
      [18, 2, 5],
      [22, 2, 3],
      [24, 3, 4],
    ] as const);
    const cA = Math.floor(N / d1);
    const cB = Math.floor(N / d2);
    const lcm = (d1 * d2) / gcd(d1, d2);
    const cBoth = Math.floor(N / lcm);
    const pA = cA / N;
    const pB = cB / N;
    const pBoth = cBoth / N;
    const correct = pA + pB - pBoth;
    return {
      id: `pr-union-${N}-${d1}-${d2}`,
      prompt: `An integer is chosen uniformly at random from 1 to ${N}. Let A = "divisible by ${d1}" and B = "divisible by ${d2}". What is P(A or B)?`,
      correct: D(correct),
      distractors: [D(pA + pB), D(pA * pB), D(pBoth)],
      explanation: `P(A)=${cA}/${N}, P(B)=${cB}/${N}, and P(A∩B)=${cBoth}/${N} (divisible by lcm=${lcm}). By inclusion–exclusion P(A∪B)=P(A)+P(B)−P(A∩B)=${cA}/${N}+${cB}/${N}−${cBoth}/${N}=${D(correct)}.`,
      difficulty: "easy" as const,
      concept: "Union / inclusion–exclusion",
      distractorRationaleByValue: {
        [D(pA + pB)]: "Added P(A)+P(B) but forgot to subtract the overlap P(A∩B).",
        [D(pA * pB)]: 'Multiplied P(A)·P(B) — treating "or" as an independent "and".',
        [D(pBoth)]: "Reported only the overlap P(A∩B).",
      },
      source: "Inclusion–exclusion (canonical distractor schema)",
    };
  });
}

/** P(A and B) for independent events. */
function genIntersectionIndep(rng: Rng): Question {
  const [aNum, aDen] = rng.pick([
    [1, 2],
    [1, 3],
    [2, 3],
    [1, 4],
    [3, 4],
  ] as const);
  const [bNum, bDen] = rng.pick([
    [1, 3],
    [2, 5],
    [1, 5],
    [3, 5],
    [1, 6],
  ] as const);
  const pA = aNum / aDen;
  const pB = bNum / bDen;
  const correct = pA * pB;
  return assemble(rng, {
    id: `pr-and-${aNum}${aDen}-${bNum}${bDen}`,
    prompt: `Two independent events have P(A)=${aNum}/${aDen} and P(B)=${bNum}/${bDen}. What is P(A and B)?`,
    correct: D(correct),
    distractors: [D(pA + pB), D(pA + pB - pA * pB), D(Math.min(pA, pB))],
    explanation: `For independent events P(A∩B)=P(A)·P(B)=(${aNum}/${aDen})(${bNum}/${bDen})=${D(correct)}.`,
    difficulty: "easy",
    concept: "Independent intersection",
    distractorRationaleByValue: {
      [D(pA + pB)]: 'Added the probabilities — that is the (non-disjoint) "or" mistake applied to "and".',
      [D(pA + pB - pA * pB)]: "Computed P(A or B) (inclusion–exclusion) instead of P(A and B).",
      [D(Math.min(pA, pB))]: "Took the smaller probability instead of the product.",
    },
    source: "Independent events",
  });
}

/** "At least one" via complement: 1 − (1−p)^n. */
function genAtLeastOne(rng: Rng): Question {
  return assembleDistinct(rng, (r) => {
    const [pNum, pDen] = r.pick([
      [1, 6],
      [1, 4],
      [1, 3],
      [1, 5],
      [2, 5],
    ] as const);
    const n = r.int(2, 4);
    const p = pNum / pDen;
    const correct = 1 - Math.pow(1 - p, n);
    return {
      id: `pr-atleast-${pNum}${pDen}-${n}`,
      prompt: `An event with probability ${pNum}/${pDen} is tried ${n} times independently. What is the probability it happens at least once?`,
      correct: D(correct),
      distractors: [D(n * p), D(Math.pow(p, n)), D(1 - Math.pow(p, n))],
      explanation: `P(at least one) = 1 − P(none) = 1 − (1−${pNum}/${pDen})^${n} = 1 − (${D(1 - p)})^${n} = ${D(correct)}.`,
      difficulty: "medium" as const,
      concept: "Complement / at-least-one",
      distractorRationaleByValue: {
        [D(n * p)]: "Added the per-trial probabilities (n·p) — double counts overlapping successes.",
        [D(Math.pow(p, n))]: "Computed P(all n succeed) = pⁿ instead of P(at least one).",
        [D(1 - Math.pow(p, n))]: "Subtracted P(all) instead of P(none): 1 − pⁿ.",
      },
      source: "Complement rule",
    };
  });
}

/** Conditional probability P(A|B) = P(A∩B)/P(B). */
function genConditional(rng: Rng): Question {
  const [pA, pB, pBoth] = rng.pick([
    [0.5, 0.4, 0.2],
    [0.6, 0.5, 0.3],
    [0.4, 0.25, 0.1],
    [0.7, 0.4, 0.28],
    [0.3, 0.6, 0.18],
  ] as const);
  const correct = pBoth / pB;
  return assemble(rng, {
    id: `pr-cond-${pA}-${pB}-${pBoth}`,
    prompt: `Given P(A)=${D(pA)}, P(B)=${D(pB)}, and P(A∩B)=${D(pBoth)}, what is P(A | B)?`,
    correct: D(correct),
    distractors: [D(pBoth / pA), D(pBoth), D(pB / pBoth)],
    explanation: `By definition P(A|B) = P(A∩B) / P(B) = ${D(pBoth)} / ${D(pB)} = ${D(correct)}.`,
    difficulty: "medium",
    concept: "Conditional probability",
    distractorRationaleByValue: {
      [D(pBoth / pA)]: "Divided by P(A) instead of P(B) — computed P(B|A).",
      [D(pBoth)]: "Forgot to divide by P(B); reported the joint P(A∩B).",
      [D(pB / pBoth)]: "Inverted the ratio.",
    },
    // Phase 4: canonical tags for the reversed-conditional distractors (drive the
    // remediation edge to L1 + the tutor's natural-frequency-tree confront).
    misconceptionByValue: {
      [D(pBoth / pA)]: MISCONCEPTION.reversedConditional,
      [D(pB / pBoth)]: MISCONCEPTION.reversedConditional,
    },
    source: "Conditional probability definition",
  });
}

/** Bayes' theorem — the classic disease-test inverse-probability trap. */
function genBayes(rng: Rng): Question {
  return assembleDistinct(rng, (r) => {
    const [prevPct, sensPct, fprPct] = r.pick([
      [1, 99, 5],
      [2, 90, 10],
      [5, 95, 8],
      [1, 95, 2],
      [10, 80, 20],
    ] as const);
    const prior = prevPct / 100;
    const sens = sensPct / 100; // P(+|D)
    const fpr = fprPct / 100; // P(+|¬D)
    const post = (sens * prior) / (sens * prior + fpr * (1 - prior));
    const ignorePrior = sens / (sens + fpr);
    return {
      id: `pr-bayes-${prevPct}-${sensPct}-${fprPct}`,
      prompt: `A disease affects ${prevPct}% of a population. A test is ${sensPct}% sensitive (P(+|disease)) and has a ${fprPct}% false-positive rate (P(+|no disease)). A random person tests positive. What is the probability they have the disease?`,
      correct: D(post),
      distractors: [D(sens), D(sens * prior), D(ignorePrior)],
      explanation: `Bayes: P(D|+) = P(+|D)P(D) / [P(+|D)P(D) + P(+|¬D)P(¬D)] = (${D(sens)}·${D(prior)}) / (${D(sens)}·${D(prior)} + ${D(fpr)}·${D(1 - prior)}) = ${D(post)}. The low prior dominates.`,
      difficulty: "hard" as const,
      concept: "Bayes' theorem",
      distractorRationaleByValue: {
        [D(sens)]: "Reported the sensitivity P(+|disease) — the inverse-probability fallacy (confusing P(D|+) with P(+|D)).",
        [D(sens * prior)]: "Computed only the numerator P(+|D)·P(D); forgot to normalize by total P(+).",
        [D(ignorePrior)]: "Ignored the prior/base rate entirely: P(+|D)/(P(+|D)+P(+|¬D)).",
      },
      // Phase 4: canonical tags — likelihood-as-posterior + base-rate neglect.
      misconceptionByValue: {
        [D(sens)]: MISCONCEPTION.likelihoodAsPosterior,
        [D(ignorePrior)]: MISCONCEPTION.baseRateNeglect,
      },
      source: "Bayes disease-test (base-rate neglect schema)",
    };
  });
}

/** Expected value of a weighted discrete payout (probability-weighting error). */
function genExpectedValue(rng: Rng): Question {
  return assembleDistinct(rng, (rr) => {
    const [r, b, g, pr, pb, pg] = rr.pick([
      [3, 2, 1, 2, 5, 10],
      [4, 3, 1, 1, 4, 12],
      [5, 3, 2, 1, 2, 6],
      [4, 2, 1, 2, 5, 11],
      [5, 2, 1, 1, 3, 8],
    ] as const);
    const total = r + b + g;
    const ev = (r * pr + b * pb + g * pg) / total;
    const unweighted = (pr + pb + pg) / 3;
    const sumPayouts = pr + pb + pg;
    const weightedNoDivide = r * pr + b * pb + g * pg;
    return {
      id: `pr-ev-${r}${b}${g}-${pr}${pb}${pg}`,
      prompt: `A bag holds ${r} red, ${b} blue, and ${g} green chips. You draw one at random. Red pays $${pr}, blue pays $${pb}, green pays $${pg}. What is the expected payout?`,
      correct: `$${D(ev)}`,
      distractors: [
        `$${D(unweighted)}`,
        `$${D(sumPayouts)}`,
        `$${D(weightedNoDivide)}`,
      ],
      explanation: `EV = Σ P(outcome)·payout = (${r}·${pr} + ${b}·${pb} + ${g}·${pg}) / ${total} = ${weightedNoDivide}/${total} = $${D(ev)}.`,
      difficulty: "medium" as const,
      concept: "Expected value",
      distractorRationaleByValue: {
        [`$${D(unweighted)}`]: "Averaged the payouts equally — forgot to weight by each color's probability.",
        [`$${D(sumPayouts)}`]: "Summed the payouts without weighting or dividing.",
        [`$${D(weightedNoDivide)}`]: "Weighted by counts but forgot to divide by the total number of chips.",
      },
      source: "Expected value (probability-weighting schema)",
    };
  });
}

/** Combinations vs permutations. */
function genCombinations(rng: Rng): Question {
  return assembleDistinct(rng, (r) => {
    const n = r.int(6, 10);
    const k = r.int(2, 3);
    const comb = choose(n, k);
    const perm = permute(n, k);
    const withRepl = Math.pow(n, k);
    const naiveProduct = n * k;
    return {
      id: `pr-comb-${n}-${k}`,
      prompt: `How many ways can you choose a committee of ${k} people from ${n} (order does not matter)?`,
      correct: fmt(comb),
      distractors: [fmt(perm), fmt(withRepl), fmt(naiveProduct)],
      explanation: `Order doesn't matter, so use combinations: C(${n},${k}) = ${n}! / (${k}!·${n - k}!) = ${fmt(comb)}.`,
      difficulty: "medium" as const,
      concept: "Combinations vs permutations",
      distractorRationaleByValue: {
        [fmt(perm)]: `Used permutations P(${n},${k}) = ${n}!/(${n}−${k})! — counted order as mattering.`,
        [fmt(withRepl)]: `Used ${n}^${k} — ordered selection WITH replacement.`,
        [fmt(naiveProduct)]: `Just multiplied n·k instead of using the combination formula.`,
      },
      // Phase 4: canonical tag — ordered-vs-unordered (drives the edge to Counting).
      misconceptionByValue: {
        [fmt(perm)]: MISCONCEPTION.orderedVsUnordered,
        [fmt(withRepl)]: MISCONCEPTION.orderedVsUnordered,
      },
      source: "Counting (combinations vs permutations)",
    };
  });
}

/** Binomial: P(exactly k of n fair-coin flips are heads). */
function genBinomial(rng: Rng): Question {
  return assembleDistinct(rng, (r) => {
    const n = r.int(4, 6);
    const k = r.int(1, n - 1);
    const correct = choose(n, k) / Math.pow(2, n);
    const oneSequence = 1 / Math.pow(2, n);
    const naiveRatio = k / n;
    const noArrangements = Math.pow(0.5, k);
    return {
      id: `pr-binom-${n}-${k}`,
      prompt: `A fair coin is flipped ${n} times. What is the probability of getting exactly ${k} head${k === 1 ? "" : "s"}?`,
      correct: D(correct),
      distractors: [D(oneSequence), D(naiveRatio), D(noArrangements)],
      explanation: `P = C(${n},${k})·(1/2)^${n} = ${choose(n, k)}/${Math.pow(2, n)} = ${D(correct)}. There are C(${n},${k})=${choose(n, k)} arrangements, each of probability (1/2)^${n}.`,
      difficulty: "hard" as const,
      concept: "Binomial distribution",
      distractorRationaleByValue: {
        [D(oneSequence)]: "Probability of ONE specific sequence (1/2)ⁿ — forgot to multiply by the number of arrangements.",
        [D(naiveRatio)]: "Used the naive ratio k/n.",
        [D(noArrangements)]: "Only accounted for the k heads (1/2)^k, ignoring the other flips and the count.",
      },
      source: "Binomial distribution",
    };
  });
}

/** Geometric: expected number of trials until first success = 1/p. */
function genGeometric(rng: Rng): Question {
  const [pNum, pDen] = rng.pick([
    [1, 3],
    [1, 4],
    [1, 5],
    [2, 5],
    [1, 6],
  ] as const);
  const p = pNum / pDen;
  const correct = 1 / p;
  return assemble(rng, {
    id: `pr-geo-${pNum}${pDen}`,
    prompt: `Each trial succeeds independently with probability ${pNum}/${pDen}. What is the expected number of trials until the first success?`,
    correct: D(correct),
    distractors: [D(p), D(1 / (1 - p)), D(pDen / pNum - 1)],
    explanation: `For a geometric distribution, E[trials to first success] = 1/p = 1/(${pNum}/${pDen}) = ${D(correct)}.`,
    difficulty: "hard",
    concept: "Geometric expectation",
    distractorRationaleByValue: {
      [D(p)]: "Reported p itself instead of 1/p.",
      [D(1 / (1 - p))]: "Used 1/(1−p) — the failure probability in the denominator.",
      [D(pDen / pNum - 1)]: "Counted the expected number of FAILURES before the first success (E−1).",
    },
    source: "Geometric distribution",
  });
}

/* ========================================================================== */
/* ==========  FREE-RESPONSE (numeric) MCQ→free-response conversions  ======== */
/* ==  Numeric conversions of the PARAMETRIC quiz families in pr-1/pr-2/pr-3.  */
/* ==  Each mirrors the geo-1 / cp-1 pattern: the SAME exact math + the SAME    */
/* ==  genuine error modes, now as a parametric error-mode catalog carrying a   */
/* ==  machine-readable `misconception` tag + an answer-withholding rung-1       */
/* ==  coaching sentence. The learner types a fraction/decimal/whole number,     */
/* ==  graded by `gradeFreeResponse`. The QUIZ builders above are KEPT and       */
/* ==  BYTE-STABLE (still `PROB_GENERATORS`, still consumed by                    */
/* ==  `generators.test.ts`); these numeric generators are a SEPARATE export     */
/* ==  (`PROB_NUMERIC_GENERATORS`) so the quiz-only 4-choices registry test is   */
/* ==  never fed a `NumericQuestion`.                                            */
/* ========================================================================== */

/** Decimals to grade a probability/decimal answer at (exact if ≤ cap, min 2). */
function numDp(value: number, min = 2, cap = 4): number {
  for (let d = min; d <= cap; d++) {
    const f = 10 ** d;
    if (Math.abs(Math.round(value * f) / f - value) < 1e-9) return d;
  }
  return cap;
}

/**
 * Deduping accumulator for `numeric` commonErrors (rounded to `dp`, ≠ answer) —
 * the plain-number local equivalent of the shared `numericErrors` scaffold (this
 * track computes with floats, not `fraction.js`). `push` accepts an OPTIONAL
 * machine-readable `misconception` tag: when supplied it is carried onto the
 * entry so the mastery layer folds `misconceptionKey(topicKey, tag)` and the
 * hint ladder can key rung-1 coaching / the confront strategy off it.
 */
function numericErrors(
  answer: number,
  dp: number,
): {
  errors: { value: number; feedback: string; misconception?: string }[];
  push: (raw: number, feedback: string, misconception?: string) => void;
} {
  const f = 10 ** dp;
  const seen = new Set<number>([Math.round(answer * f)]);
  const errors: { value: number; feedback: string; misconception?: string }[] =
    [];
  const push = (raw: number, feedback: string, misconception?: string) => {
    if (!Number.isFinite(raw)) return;
    const rounded = Math.round(raw * f) / f;
    const k = Math.round(rounded * f);
    if (seen.has(k)) return;
    seen.add(k);
    errors.push({
      value: rounded,
      feedback,
      ...(misconception ? { misconception } : {}),
    });
  };
  return { errors, push };
}

/* ------------------------  pr-1 — Foundations  ---------------------------- */

/** FREE-RESPONSE P(A∪B) — numeric conversion of `genUnion`. */
export function buildUnionNumericInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const [N, d1, d2] = rng.pick([
    [20, 3, 4],
    [24, 4, 6],
    [18, 2, 5],
    [22, 2, 3],
    [24, 3, 4],
  ] as const);
  const cA = Math.floor(N / d1);
  const cB = Math.floor(N / d2);
  const lcm = (d1 * d2) / gcd(d1, d2);
  const cBoth = Math.floor(N / lcm);
  const pA = cA / N;
  const pB = cB / N;
  const pBoth = cBoth / N;
  const value = pA + pB - pBoth;
  const dp = numDp(value);
  const answer = Number(value.toFixed(dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    pA + pB,
    `Close — you added P(A)+P(B), but some integers are divisible by BOTH ${d1} and ${d2}. What must you subtract so those aren't counted twice?`,
    MISCONCEPTION.orMeansAddNoOverlap,
  );
  push(
    pA * pB,
    `That's P(A)·P(B), which treats "or" like an independent "and". Does "A OR B" call for a product, or a sum with the overlap removed once?`,
    "or_means_multiply",
  );
  push(
    pBoth,
    `That's just P(A∩B), the overlap alone. The question asks for the whole union — what do you add before removing the double-count?`,
    "reported_overlap_only",
  );
  push(
    pA,
    `That's only P(A) — divisibility by ${d1} alone. The event is A OR B; how do you fold in B without double-counting the overlap?`,
    "reported_one_event_only",
  );

  const prompt =
    `An integer is chosen uniformly at random from 1 to ${N}. Let A = "divisible by ${d1}" and B = "divisible by ${d2}". What is P(A or B)? (Enter a fraction or decimal.) Round to the nearest thousandth.`;
  const explanation =
    `P(A)=${cA}/${N}, P(B)=${cB}/${N}, and P(A∩B)=${cBoth}/${N} (divisible by lcm=${lcm}). By inclusion–exclusion P(A∪B)=P(A)+P(B)−P(A∩B)=${cA}/${N}+${cB}/${N}−${cBoth}/${N}=${D(value)}.`;

  return {
    answer,
    numeric: {
      id: `pr-unionnum-${N}-${d1}-${d2}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Union / inclusion–exclusion",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Inclusion–exclusion (canonical distractor schema)",
    },
  };
}

/** FREE-RESPONSE P(A∩B), independent — numeric conversion of `genIntersectionIndep`. */
export function buildIntersectionIndepNumericInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const [aNum, aDen] = rng.pick([
    [1, 2],
    [1, 3],
    [2, 3],
    [1, 4],
    [3, 4],
  ] as const);
  const [bNum, bDen] = rng.pick([
    [1, 3],
    [2, 5],
    [1, 5],
    [3, 5],
    [1, 6],
  ] as const);
  const pA = aNum / aDen;
  const pB = bNum / bDen;
  const value = pA * pB;
  const dp = numDp(value);
  const answer = Number(value.toFixed(dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    pA + pB,
    `Close — you added the two probabilities. But the wording says "A AND B" for INDEPENDENT events — what do probabilities do on AND, add or multiply?`,
    MISCONCEPTION.andMeansAdd,
  );
  push(
    pA + pB - pA * pB,
    `That's P(A OR B) via inclusion–exclusion. The question asks for BOTH happening — which single operation gives the joint of independent events?`,
    "computed_union_not_intersection",
  );
  push(
    Math.min(pA, pB),
    `You reported the smaller of the two probabilities. Both events must occur together — is the joint bigger or smaller than either one, and how do you combine them?`,
    "took_min_probability",
  );

  const prompt =
    `Two independent events have P(A)=${aNum}/${aDen} and P(B)=${bNum}/${bDen}. What is P(A and B)? (Enter a fraction or decimal.) Round to the nearest thousandth.`;
  const explanation =
    `For independent events P(A∩B)=P(A)·P(B)=(${aNum}/${aDen})(${bNum}/${bDen})=${D(value)}.`;

  return {
    answer,
    numeric: {
      id: `pr-andnum-${aNum}${aDen}-${bNum}${bDen}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Independent intersection",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Independent events",
    },
  };
}

/** FREE-RESPONSE C(n,k) — numeric conversion of `genCombinations` (integer count). */
export function buildCombinationsNumericInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const n = rng.int(6, 10);
  const k = rng.int(2, 3);
  const comb = choose(n, k);
  const perm = permute(n, k);
  const withRepl = Math.pow(n, k);
  const naiveProduct = n * k;
  const answer = comb;

  const { errors, push } = numericErrors(answer, 0);
  push(
    perm,
    `Close — that's the number of ORDERED arrangements P(${n},${k}). A committee doesn't care about order, so should you keep or divide out the ${k}! orderings of each group?`,
    MISCONCEPTION.orderedVsUnordered,
  );
  push(
    withRepl,
    `That's ${n}^${k} — ordered selection WITH replacement (the same person picked twice). Are repeats allowed, and does order matter here?`,
    "counted_with_replacement",
  );
  push(
    naiveProduct,
    `You multiplied n·k. That isn't a counting formula for choosing a group — which formula counts unordered selections of ${k} from ${n}?`,
    "multiplied_n_times_k",
  );

  const prompt =
    `How many ways can you choose a committee of ${k} people from ${n} (order does not matter)? (Enter a whole number.)`;
  const explanation =
    `Order doesn't matter, so use combinations: C(${n},${k}) = ${n}! / (${k}!·${n - k}!) = ${fmt(comb)}.`;

  return {
    answer,
    numeric: {
      id: `pr-combnum-${n}-${k}`,
      prompt,
      answer,
      difficulty,
      concept: "Combinations vs permutations",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Counting (combinations vs permutations)",
    },
  };
}

/* ------------------  pr-2 — Conditional, Bayes, at-least-one  ------------- */

/** FREE-RESPONSE P(A|B) — numeric conversion of `genConditional`. */
export function buildConditionalNumericInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const [pA, pB, pBoth] = rng.pick([
    [0.5, 0.4, 0.2],
    [0.6, 0.5, 0.3],
    [0.4, 0.25, 0.1],
    [0.7, 0.4, 0.28],
    [0.3, 0.6, 0.18],
  ] as const);
  const value = pBoth / pB;
  const dp = numDp(value);
  const answer = Number(value.toFixed(dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    pBoth / pA,
    `Close — dividing by P(A) gives P(B|A), the REVERSED conditional. Which event were you told has already happened, and so belongs in the denominator?`,
    MISCONCEPTION.reversedConditional,
  );
  push(
    pBoth,
    `That's the joint P(A∩B). Conditioning restricts you to the world where B happened — what must you divide the joint by?`,
    "reported_joint_not_conditional",
  );
  push(
    pB / pBoth,
    `You inverted the ratio. P(A|B) puts the joint on top and P(B) on the bottom — which quantity should divide which?`,
    MISCONCEPTION.reversedConditional,
  );

  const prompt =
    `Given P(A)=${D(pA)}, P(B)=${D(pB)}, and P(A∩B)=${D(pBoth)}, what is P(A | B)? (Enter a fraction or decimal.) Round to the nearest thousandth.`;
  const explanation =
    `By definition P(A|B) = P(A∩B) / P(B) = ${D(pBoth)} / ${D(pB)} = ${D(value)}.`;

  return {
    answer,
    numeric: {
      id: `pr-condnum-${pA}-${pB}-${pBoth}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Conditional probability",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Conditional probability definition",
    },
  };
}

/** FREE-RESPONSE Bayes posterior — numeric conversion of `genBayes`. */
export function buildBayesNumericInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const [prevPct, sensPct, fprPct] = rng.pick([
    [1, 99, 5],
    [2, 90, 10],
    [5, 95, 8],
    [1, 95, 2],
    [10, 80, 20],
  ] as const);
  const prior = prevPct / 100;
  const sens = sensPct / 100; // P(+|D)
  const fpr = fprPct / 100; // P(+|¬D)
  const value = (sens * prior) / (sens * prior + fpr * (1 - prior));
  const ignorePrior = sens / (sens + fpr);
  const dp = numDp(value);
  const answer = Number(value.toFixed(dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    sens,
    `Close — you reported the sensitivity P(+|disease). That's the LIKELIHOOD, not the posterior P(disease|+). With so few people actually sick, how many positives are false alarms?`,
    MISCONCEPTION.likelihoodAsPosterior,
  );
  push(
    ignorePrior,
    `You dropped the base rate: P(+|D)/(P(+|D)+P(+|¬D)) ignores how RARE the disease is. Should a ${prevPct}% prevalence change the answer?`,
    MISCONCEPTION.baseRateNeglect,
  );
  push(
    sens * prior,
    `That's only the numerator P(+|D)·P(D) — the joint. To turn a joint into P(D|+), what total must you normalise by?`,
    "forgot_normalization",
  );
  push(
    prior,
    `That's just the prevalence P(D), ignoring the positive test entirely. How should a positive result move it up from the base rate?`,
    "reported_prior_only",
  );

  const prompt =
    `A disease affects ${prevPct}% of a population. A test is ${sensPct}% sensitive (P(+|disease)) and has a ${fprPct}% false-positive rate (P(+|no disease)). A random person tests positive. What is the probability they have the disease? (Enter a fraction or decimal.) Round to the nearest thousandth.`;
  const explanation =
    `Bayes: P(D|+) = P(+|D)P(D) / [P(+|D)P(D) + P(+|¬D)P(¬D)] = (${D(sens)}·${D(prior)}) / (${D(sens)}·${D(prior)} + ${D(fpr)}·${D(1 - prior)}) = ${D(value)}. The low prior dominates.`;

  return {
    answer,
    numeric: {
      id: `pr-bayesnum-${prevPct}-${sensPct}-${fprPct}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Bayes' theorem",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Bayes disease-test (base-rate neglect schema)",
    },
  };
}

/** FREE-RESPONSE P(at least one) — numeric conversion of `genAtLeastOne`. */
export function buildAtLeastOneNumericInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const [pNum, pDen] = rng.pick([
    [1, 6],
    [1, 4],
    [1, 3],
    [1, 5],
    [2, 5],
  ] as const);
  const n = rng.int(2, 4);
  const p = pNum / pDen;
  const value = 1 - Math.pow(1 - p, n);
  const dp = numDp(value);
  const answer = Number(value.toFixed(dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    n * p,
    `Close — you added the per-trial probabilities (n·p). That double-counts trials where it happens more than once. What's the clean way to handle "at least one" via its opposite?`,
    MISCONCEPTION.atLeastOneNaive,
  );
  push(
    Math.pow(p, n),
    `That's P(it happens on ALL ${n} trials) = pⁿ. "At least once" is a much bigger event — how do you get it from P(none)?`,
    "computed_all_not_at_least_one",
  );
  push(
    1 - Math.pow(p, n),
    `You subtracted P(all) from 1 instead of P(none). "At least one" is 1 − P(zero successes) — which power belongs there, pⁿ or (1−p)ⁿ?`,
    "complement_of_all_not_none",
  );

  const prompt =
    `An event with probability ${pNum}/${pDen} is tried ${n} times independently. What is the probability it happens at least once? (Enter a fraction or decimal.) Round to the nearest thousandth.`;
  const explanation =
    `P(at least one) = 1 − P(none) = 1 − (1−${pNum}/${pDen})^${n} = 1 − (${D(1 - p)})^${n} = ${D(value)}.`;

  return {
    answer,
    numeric: {
      id: `pr-atleastnum-${pNum}${pDen}-${n}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Complement / at-least-one",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Complement rule",
    },
  };
}

/* ------------------  pr-3 — Expectation & distributions  ------------------ */

/** FREE-RESPONSE expected payout — numeric conversion of `genExpectedValue` ($). */
export function buildExpectedValueNumericInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const [r, b, g, pr, pb, pg] = rng.pick([
    [3, 2, 1, 2, 5, 10],
    [4, 3, 1, 1, 4, 12],
    [5, 3, 2, 1, 2, 6],
    [4, 2, 1, 2, 5, 11],
    [5, 2, 1, 1, 3, 8],
  ] as const);
  const total = r + b + g;
  const value = (r * pr + b * pb + g * pg) / total;
  const unweighted = (pr + pb + pg) / 3;
  const sumPayouts = pr + pb + pg;
  const weightedNoDivide = r * pr + b * pb + g * pg;
  const dp = numDp(value);
  const answer = Number(value.toFixed(dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    unweighted,
    `Close — you averaged the three payouts equally. But the colours aren't equally likely; each payout must be weighted by its draw probability. Which chip is most common here?`,
    MISCONCEPTION.equalWeightMixture,
  );
  push(
    sumPayouts,
    `You summed the payouts without weighting OR dividing. Expected value is a probability-weighted average — what do you divide the weighted sum by?`,
    "summed_payouts_no_weight",
  );
  push(
    weightedNoDivide,
    `You weighted each payout by its chip COUNT but forgot to divide. Turning counts into probabilities means dividing by the total of ${total} chips.`,
    "forgot_divide_by_total",
  );

  const prompt =
    `A bag holds ${r} red, ${b} blue, and ${g} green chips. You draw one at random. Red pays $${pr}, blue pays $${pb}, green pays $${pg}. What is the expected payout? (Enter a dollar amount.)`;
  const explanation =
    `EV = Σ P(outcome)·payout = (${r}·${pr} + ${b}·${pb} + ${g}·${pg}) / ${total} = ${weightedNoDivide}/${total} = $${D(value)}.`;

  return {
    answer,
    numeric: {
      id: `pr-evnum-${r}${b}${g}-${pr}${pb}${pg}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Expected value",
      explanation,
      unit: "$",
      commonErrors: errors,
      source: "Expected value (probability-weighting schema)",
    },
  };
}

/** FREE-RESPONSE P(exactly k heads) — numeric conversion of `genBinomial`. */
export function buildBinomialNumericInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const n = rng.int(4, 6);
  const k = rng.int(1, n - 1);
  const value = choose(n, k) / Math.pow(2, n);
  const oneSequence = 1 / Math.pow(2, n);
  const naiveRatio = k / n;
  const noArrangements = Math.pow(0.5, k);
  const dp = numDp(value);
  const answer = Number(value.toFixed(dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    oneSequence,
    `Close — that's the chance of ONE specific sequence, (1/2)^${n}. There are several head/tail orders giving exactly ${k} head${k === 1 ? "" : "s"} — what counts them?`,
    "forgot_binomial_coefficient",
  );
  push(
    naiveRatio,
    `You used the naive ratio ${k}/${n}. Probability isn't "successes over flips" here — which formula counts the ways to place ${k} heads among ${n} flips?`,
    "naive_ratio_k_over_n",
  );
  push(
    noArrangements,
    `That's (1/2)^${k} for just the ${k} head${k === 1 ? "" : "s"}. What about the other ${n - k} flip${n - k === 1 ? "" : "s"}, and the number of arrangements?`,
    "ignored_other_flips",
  );
  push(
    choose(n, k),
    `That's C(${n},${k}), the COUNT of arrangements — not yet a probability. Each arrangement has probability (1/2)^${n}; what do you multiply by?`,
    "count_not_probability",
  );

  const prompt =
    `A fair coin is flipped ${n} times. What is the probability of getting exactly ${k} head${k === 1 ? "" : "s"}? (Enter a fraction or decimal.) Round to the nearest thousandth.`;
  const explanation =
    `P = C(${n},${k})·(1/2)^${n} = ${choose(n, k)}/${Math.pow(2, n)} = ${D(value)}. There are C(${n},${k})=${choose(n, k)} arrangements, each of probability (1/2)^${n}.`;

  return {
    answer,
    numeric: {
      id: `pr-binomnum-${n}-${k}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Binomial distribution",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Binomial distribution",
    },
  };
}

/** FREE-RESPONSE E[trials to first success] — numeric conversion of `genGeometric`. */
export function buildGeometricNumericInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const [pNum, pDen] = rng.pick([
    [1, 3],
    [1, 4],
    [1, 5],
    [2, 5],
    [1, 6],
  ] as const);
  const p = pNum / pDen;
  const value = 1 / p;
  const dp = numDp(value);
  const answer = Number(value.toFixed(dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    p,
    `Close — you reported p itself. The EXPECTED wait is the reciprocal of the per-trial chance. If success is rare, is the wait small or large?`,
    "reported_p_not_reciprocal",
  );
  push(
    1 / (1 - p),
    `You used 1/(1−p) — the failure probability in the denominator. The geometric mean uses the SUCCESS probability; which one goes on the bottom?`,
    "used_failure_probability",
  );
  push(
    pDen / pNum - 1,
    `That's the expected number of FAILURES before the first success (E − 1). The question counts the successful trial too — what do you add back?`,
    "counted_failures_not_trials",
  );

  const prompt =
    `Each trial succeeds independently with probability ${pNum}/${pDen}. What is the expected number of trials until the first success? (Enter a fraction or decimal.) Round to the nearest thousandth.`;
  const explanation =
    `For a geometric distribution, E[trials to first success] = 1/p = 1/(${pNum}/${pDen}) = ${D(value)}.`;

  return {
    answer,
    numeric: {
      id: `pr-geonum-${pNum}${pDen}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Geometric expectation",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Geometric distribution",
    },
  };
}

// ---- small exact combinatorial helpers ----
function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return a;
}
function choose(n: number, r: number): number {
  r = Math.min(r, n - r);
  let num = 1;
  for (let i = 0; i < r; i++) num = (num * (n - i)) / (i + 1);
  return Math.round(num);
}
function permute(n: number, r: number): number {
  let p = 1;
  for (let i = 0; i < r; i++) p *= n - i;
  return p;
}

export const PROB_GENERATORS = {
  genUnion,
  genIntersectionIndep,
  genAtLeastOne,
  genConditional,
  genBayes,
  genExpectedValue,
  genCombinations,
  genBinomial,
  genGeometric,
};

/* ========================================================================== */
/*  Numeric (free-response) adapters — MCQ→free-response conversions.          */
/*  These are DELIBERATELY kept OUT of `PROB_GENERATORS` (which must stay        */
/*  quiz-only, so the shared 4-choices registry test never sees a               */
/*  NumericQuestion). `levels.ts` references them directly through a            */
/*  `mixNumericGenerators([...])` mixer; the function `.name` becomes the        */
/*  family id (gen<Family>Numeric) used by the hint ladder / regeneration.       */
/* ========================================================================== */

// pr-1 — Foundations (union, independent AND, combinations)
export const genUnionNumeric = (rng: Rng): NumericQuestion =>
  buildUnionNumericInstance(rng, "easy").numeric;
export const genIntersectionIndepNumeric = (rng: Rng): NumericQuestion =>
  buildIntersectionIndepNumericInstance(rng, "easy").numeric;
export const genCombinationsNumeric = (rng: Rng): NumericQuestion =>
  buildCombinationsNumericInstance(rng, "medium").numeric;

// pr-2 — Conditional, Bayes, at-least-one
export const genConditionalNumeric = (rng: Rng): NumericQuestion =>
  buildConditionalNumericInstance(rng, "medium").numeric;
export const genBayesNumeric = (rng: Rng): NumericQuestion =>
  buildBayesNumericInstance(rng, "hard").numeric;
export const genAtLeastOneNumeric = (rng: Rng): NumericQuestion =>
  buildAtLeastOneNumericInstance(rng, "medium").numeric;

// pr-3 — Expectation & distributions (EV, binomial, geometric)
export const genExpectedValueNumeric = (rng: Rng): NumericQuestion =>
  buildExpectedValueNumericInstance(rng, "medium").numeric;
export const genBinomialNumeric = (rng: Rng): NumericQuestion =>
  buildBinomialNumericInstance(rng, "hard").numeric;
export const genGeometricNumeric = (rng: Rng): NumericQuestion =>
  buildGeometricNumericInstance(rng, "hard").numeric;

/** Quiz-free registry of the numeric conversions (parallel to PROB_GENERATORS). */
export const PROB_NUMERIC_GENERATORS = {
  genUnionNumeric,
  genIntersectionIndepNumeric,
  genCombinationsNumeric,
  genConditionalNumeric,
  genBayesNumeric,
  genAtLeastOneNumeric,
  genExpectedValueNumeric,
  genBinomialNumeric,
  genGeometricNumeric,
};

/**
 * Combine several question families into one generator. Delegates to the shared
 * family-tagging mixer so each produced item is stamped with the family that
 * drew it and the returned callable exposes a `.families` lookup — enabling
 * family-preserving "Generate another like this" while normal play is unchanged.
 */
export const mix = (pool: QuestionGenerator[]): QuestionGenerator =>
  mixQuestionGenerators(pool);
