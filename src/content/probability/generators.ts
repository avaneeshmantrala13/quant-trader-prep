import type { Rng } from "@/lib/rng";
import type { Question, QuestionGenerator } from "@/types/content";
import { assemble, assembleDistinct, fmt, round } from "../shared";
import { mixQuestionGenerators } from "../mixFamilies";

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

/**
 * Combine several question families into one generator. Delegates to the shared
 * family-tagging mixer so each produced item is stamped with the family that
 * drew it and the returned callable exposes a `.families` lookup — enabling
 * family-preserving "Generate another like this" while normal play is unchanged.
 */
export const mix = (pool: QuestionGenerator[]): QuestionGenerator =>
  mixQuestionGenerators(pool);
