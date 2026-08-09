import type { NumericQuestion } from "@/types/content";
import { Rng, gcd } from "@/lib/rng";
import { MISCONCEPTION } from "@/lib/tutor/misconception";

/**
 * PARAMETRIC content generators for the untimed-diagnostic / drilling bank.
 *
 * WHY THIS EXISTS (drilling loop hard-stall, V1). ~12 scored content families —
 * Core Probability, Combinatorics, Number Theory, Continuous Distributions,
 * Poisson, Geometric Probability, Geometry, Variance/CLT, Brownian Motion, Game
 * Theory, Branching, and Markov-chain Structure — carried ONLY two static
 * authored items and no generator. The drilling loop re-draws a topic every
 * round; once both static items were served, `drawContentDrill` ran dry and
 * `DrillingStage` mounted a button-less `timed-info` panel that froze the loop
 * while its gate was still open. It also caused the diagnostic's exact-duplicate
 * repeats (M10) and topic imbalance (M8).
 *
 * The fix: give every one of those families a PARAMETRIC, exact-verified floor
 * generator, wired into the blueprint via `numGen(...)`. Each generator here is
 * pure + deterministic from a seeded `Rng`, COMPUTES its answer from the drawn
 * numbers by the same closed form the worked `explanation` narrates (never a
 * hardcoded table), carries a stable `family` tag (so a rung-3 worked SIBLING
 * can re-run the SAME family with different numbers), and tags each
 * `commonErrors` entry with a canonical `MISCONCEPTION.*` tag where one fits so
 * the rung-1 directional nudge fires on drill items (V3/V4). The static authored
 * `question` in the blueprint stays the canonical floor exemplar (the
 * difficulty-floor allowlist keys off it); these only widen the served instance
 * space so the bank feels infinite and the loop can always progress to the gate.
 */

/** Exact binomial C(n, k) as a Number (exact across the interview-scale ranges). */
function binom(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  const kk = Math.min(k, n - k);
  let num = 1;
  for (let i = 0; i < kk; i++) num = (num * (n - i)) / (i + 1);
  return Math.round(num);
}

/** Exact k! as a Number. */
function factorial(k: number): number {
  let f = 1;
  for (let i = 2; i <= k; i++) f *= i;
  return f;
}

/** Least common multiple. */
function lcm(a: number, b: number): number {
  return (a / gcd(a, b)) * b;
}

/** One `commonErrors` candidate before de-duplication. */
type ErrCandidate = { value: number; feedback: string; misconception?: string };

/**
 * Build the instance `commonErrors`: drop any candidate that collides with the
 * correct answer or an earlier candidate at the question's `decimals` precision
 * (so grading stays unambiguous), mirroring `errorModes.buildCommonErrors`.
 */
function mkErrors(
  answer: number,
  decimals: number | undefined,
  candidates: ErrCandidate[],
): NumericQuestion["commonErrors"] {
  const same = (a: number, b: number) =>
    decimals == null
      ? a === b
      : Math.round(a * 10 ** decimals) === Math.round(b * 10 ** decimals);
  const out: NonNullable<NumericQuestion["commonErrors"]> = [];
  const seen: number[] = [answer];
  for (const c of candidates) {
    if (!Number.isFinite(c.value)) continue;
    if (seen.some((v) => same(v, c.value))) continue;
    seen.push(c.value);
    out.push(
      c.misconception
        ? { value: c.value, feedback: c.feedback, misconception: c.misconception }
        : { value: c.value, feedback: c.feedback },
    );
  }
  return out;
}

/* ========================================================================== */
/*  Combinatorics — choose k from n (order doesn't matter)                     */
/* ========================================================================== */

export const COMB_CHOOSE_FAMILY = "diag-comb-choose";

/** How many unordered committees of `k` from `n`? Answer C(n, k). */
export function genCombChoose(rng: Rng): NumericQuestion {
  const n = rng.int(6, 12);
  const k = rng.int(2, Math.min(4, n - 2));
  const answer = binom(n, k);
  const perm = binom(n, k) * factorial(k); // ordered count P(n,k)
  return {
    id: `diag-comb-${n}-${k}`,
    prompt: `How many ways can you choose a committee of ${k} people from ${n} (order does not matter)?`,
    answer,
    difficulty: "medium",
    concept: "Combinations",
    explanation: `A committee is unordered, so count combinations: C(${n},${k}) = ${n}!/(${k}!·${n - k}!) = ${answer}.`,
    commonErrors: mkErrors(answer, undefined, [
      {
        value: perm,
        feedback: `That is the ORDERED count P(${n},${k}); a committee is unordered, so it double-counts each group's arrangements.`,
        misconception: MISCONCEPTION.orderedVsUnordered,
      },
      {
        value: n * k,
        feedback: `You multiplied ${n}·${k}; choosing an unordered subset is a binomial coefficient, not a product.`,
      },
    ]),
    source: "Untimed diagnostic · Combinations",
    family: COMB_CHOOSE_FAMILY,
  };
}

/* ========================================================================== */
/*  Number theory — count divisible by a OR b (inclusion–exclusion)            */
/* ========================================================================== */

export const NT_DIVISIBLE_FAMILY = "diag-nt-divisible-or";

const NT_PAIRS: [number, number][] = [
  [4, 6], [3, 5], [4, 10], [6, 9], [3, 4], [6, 10], [4, 5], [3, 8], [6, 8], [5, 6],
];

/** How many integers 1..N divisible by a OR b? Inclusion–exclusion. */
export function genDivisibleOr(rng: Rng): NumericQuestion {
  const N = rng.pick([100, 120, 150, 200, 90, 180]);
  const [a, b] = rng.pick(NT_PAIRS);
  const l = lcm(a, b);
  const cntA = Math.floor(N / a);
  const cntB = Math.floor(N / b);
  const cntBoth = Math.floor(N / l);
  const answer = cntA + cntB - cntBoth;
  return {
    id: `diag-nt-${N}-${a}-${b}`,
    prompt: `How many integers from 1 to ${N} inclusive are divisible by ${a} OR by ${b}?`,
    answer,
    difficulty: "medium",
    concept: "Inclusion–exclusion on divisibility",
    explanation: `⌊${N}/${a}⌋ + ⌊${N}/${b}⌋ − ⌊${N}/${l}⌋ = ${cntA} + ${cntB} − ${cntBoth} = ${answer} (subtract multiples of lcm(${a},${b})=${l}, counted in both sets).`,
    commonErrors: mkErrors(answer, undefined, [
      {
        value: cntA + cntB,
        feedback: `You added the two counts (${cntA} + ${cntB}) without removing the multiples of ${l} that both sets share.`,
        misconception: MISCONCEPTION.orMeansAddNoOverlap,
      },
      {
        value: cntA,
        feedback: `That counts only the multiples of ${a}; the wording also includes the multiples of ${b} you have ignored.`,
        misconception: "ignored_second_set",
      },
    ]),
    source: "Untimed diagnostic · Inclusion–exclusion",
    family: NT_DIVISIBLE_FAMILY,
  };
}

/* ========================================================================== */
/*  Core probability — at least one success (complement rule)                  */
/* ========================================================================== */

export const CORE_ATLEAST_FAMILY = "diag-core-atleast-one";

/** n fair dice; P(at least one shows face f) = 1 − (5/6)^n. */
export function genAtLeastOne(rng: Rng): NumericQuestion {
  const n = rng.int(2, 4);
  const f = rng.int(1, 6);
  const answer = 1 - (5 / 6) ** n;
  const decimals = 4;
  return {
    id: `diag-core-${n}-${f}`,
    prompt: `${n} fair six-sided dice are rolled. What is the probability that at least one of them shows a ${f}? (Round to ${decimals} decimals.)`,
    answer,
    decimals,
    difficulty: "medium",
    concept: "Complement rule",
    unit: "",
    explanation: `Use the complement: P(at least one ${f}) = 1 − P(no ${f}) = 1 − (5/6)^${n} = ${answer.toFixed(decimals)}.`,
    commonErrors: mkErrors(answer, decimals, [
      {
        value: n * (1 / 6),
        feedback: `You added 1/6 for each die (${n}·1/6); separate chances cannot simply pile up, and this ignores the complement.`,
        misconception: MISCONCEPTION.atLeastOneNaive,
      },
      {
        value: (1 / 6) ** n,
        feedback: `That is P(ALL ${n} dice show the ${f}); the question asks for AT LEAST one.`,
        misconception: "all_not_at_least_one",
      },
    ]),
    source: "Untimed diagnostic · Complement rule",
    family: CORE_ATLEAST_FAMILY,
  };
}

/* ========================================================================== */
/*  Continuous — conditional uniform tail                                      */
/* ========================================================================== */

export const CONT_COND_UNIFORM_FAMILY = "diag-cont-cond-uniform";

/** X uniform on [0, L]; given X > a, P(X > b) = (L − b)/(L − a). */
export function genCondUniform(rng: Rng): NumericQuestion {
  const L = rng.pick([10, 12, 16, 20, 24]);
  const a = rng.int(2, L - 4);
  const b = rng.int(a + 2, L - 1);
  const answer = (L - b) / (L - a);
  const decimals = 4;
  return {
    id: `diag-cont-${L}-${a}-${b}`,
    prompt: `X is uniform on [0, ${L}]. Given that X > ${a}, what is P(X > ${b})? (Round to ${decimals} decimals.)`,
    answer,
    decimals,
    difficulty: "medium",
    concept: "Conditional uniform distribution",
    unit: "",
    explanation: `Conditioned on X > ${a}, X is uniform on (${a}, ${L}] (length ${L - a}). P(X > ${b} | X > ${a}) = (${L} − ${b})/(${L} − ${a}) = ${answer.toFixed(decimals)}.`,
    commonErrors: mkErrors(answer, decimals, [
      {
        value: (L - b) / L,
        feedback: `That is the UNconditional P(X > ${b}) = (${L} − ${b})/${L}; you did not reduce to the conditional world X > ${a}.`,
        misconception: "unconditional_not_conditional",
      },
      {
        value: (b - a) / (L - a),
        feedback: `That is P(X ≤ ${b} | X > ${a}); the question asks for the upper tail, not its complement.`,
        misconception: MISCONCEPTION.complementConfusion,
      },
    ]),
    source: "Untimed diagnostic · Conditional uniform",
    family: CONT_COND_UNIFORM_FAMILY,
  };
}

/* ========================================================================== */
/*  Poisson — pmf of exactly k events                                          */
/* ========================================================================== */

export const POISSON_PMF_FAMILY = "diag-poisson-pmf";

/** Poisson(λ); P(exactly k) = e^{−λ} λ^k / k!. */
export function genPoissonPmf(rng: Rng): NumericQuestion {
  const lambda = rng.int(2, 5);
  const k = rng.int(1, 3);
  const decimals = 4;
  const pmf = (j: number) =>
    (Math.exp(-lambda) * lambda ** j) / factorial(j);
  const answer = pmf(k);
  return {
    id: `diag-poisson-${lambda}-${k}`,
    prompt: `Events arrive as a Poisson process with mean λ = ${lambda} per interval. What is P(exactly ${k} events in one interval)? (Round to ${decimals} decimals.)`,
    answer,
    decimals,
    difficulty: "medium",
    concept: "Poisson pmf",
    explanation: `P(N = ${k}) = e^(−${lambda}) · ${lambda}^${k} / ${k}! = ${answer.toFixed(decimals)}.`,
    commonErrors: mkErrors(answer, decimals, [
      {
        value: pmf(k - 1),
        feedback: `That is P(N = ${k - 1}); the question asks for exactly ${k} events.`,
        misconception: "off_by_one_count",
      },
      {
        value: Math.exp(-lambda) * lambda ** k,
        feedback: `You dropped the ${k}! in the denominator of the Poisson pmf.`,
        misconception: "forgot_factorial_denominator",
      },
    ]),
    source: "Untimed diagnostic · Poisson pmf",
    family: POISSON_PMF_FAMILY,
  };
}

/* ========================================================================== */
/*  Geometric probability — triangle area in the unit square                   */
/* ========================================================================== */

export const GEO_TRIANGLE_FAMILY = "diag-geo-triangle";

/** (x, y) uniform in [0,1]²; for c ≤ 1, P(x + y ≤ c) = c²/2. */
export function genGeoTriangle(rng: Rng): NumericQuestion {
  const c = rng.pick([
    0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.9,
  ]);
  const answer = (c * c) / 2;
  const decimals = 4;
  return {
    id: `diag-geo-${Math.round(c * 100)}`,
    prompt: `A point (x, y) is chosen uniformly in the unit square [0,1]×[0,1]. What is P(x + y ≤ ${c})? (Round to ${decimals} decimals.)`,
    answer,
    decimals,
    difficulty: "medium",
    concept: "Geometric probability (area of a region)",
    unit: "",
    explanation: `The region x + y ≤ ${c} (inside the square) is a right triangle with legs ${c}, so its area is ½·${c}·${c} = ${answer.toFixed(decimals)}.`,
    commonErrors: mkErrors(answer, decimals, [
      {
        value: c,
        feedback: `That is just the threshold ${c}; you must compare AREAS on the square, not a single length.`,
        misconception: "length_not_area",
      },
      {
        value: c * c,
        feedback: `That is the area of the square [0, ${c}]²; the favourable region is the TRIANGLE, exactly half of it.`,
        misconception: MISCONCEPTION.forgotDivideByTwo,
      },
    ]),
    source: "Untimed diagnostic · Geometric probability",
    family: GEO_TRIANGLE_FAMILY,
  };
}

/* ========================================================================== */
/*  Geometry — space diagonal of a box (3-D Pythagoras)                        */
/* ========================================================================== */

export const GEOMETRY_DIAGONAL_FAMILY = "diag-geometry-diagonal";

/** Pythagorean boxes (a, b, c, d) with integer space diagonal d = √(a²+b²+c²). */
const BODY_DIAGONAL_BOXES: [number, number, number, number][] = [
  [1, 2, 2, 3], [2, 3, 6, 7], [1, 4, 8, 9], [4, 4, 7, 9], [2, 6, 9, 11],
  [6, 6, 7, 11], [3, 4, 12, 13], [2, 5, 14, 15], [2, 10, 11, 15], [8, 9, 12, 17],
  [1, 12, 12, 17], [4, 13, 16, 21], [6, 13, 18, 23], [9, 12, 20, 25],
  [12, 15, 16, 25], [3, 16, 24, 29], [12, 16, 21, 29], [5, 6, 30, 31],
];

/** Rectangular box a×b×c; space diagonal √(a²+b²+c²). */
export function genSpaceDiagonal(rng: Rng): NumericQuestion {
  const [a, b, c, d] = rng.pick(BODY_DIAGONAL_BOXES);
  return {
    id: `diag-geometry-${a}-${b}-${c}`,
    prompt: `A rectangular box has dimensions ${a} × ${b} × ${c}. What is the length of its space diagonal (corner to opposite corner)?`,
    answer: d,
    difficulty: "medium",
    concept: "3-D Pythagoras",
    explanation: `Space diagonal = √(${a}² + ${b}² + ${c}²) = √(${a * a + b * b + c * c}) = ${d}.`,
    commonErrors: mkErrors(d, undefined, [
      {
        value: a + b + c,
        feedback: `You added the edges (${a} + ${b} + ${c}); the space diagonal uses √(a² + b² + c²).`,
        misconception: "added_edges_not_squares",
      },
    ]),
    source: "Untimed diagnostic · 3-D Pythagoras",
    family: GEOMETRY_DIAGONAL_FAMILY,
  };
}

/* ========================================================================== */
/*  Variance — scaling a random variable                                       */
/* ========================================================================== */

export const VAR_SCALE_FAMILY = "diag-var-scale";

/** Var(X) = v; Var(aX) = a²·v. */
export function genVarScale(rng: Rng): NumericQuestion {
  const v = rng.int(2, 9);
  const a = rng.int(2, 6);
  const answer = a * a * v;
  return {
    id: `diag-var-${a}-${v}`,
    prompt: `A random variable X has Var(X) = ${v}. What is Var(${a}X)?`,
    answer,
    difficulty: "medium",
    concept: "Variance scaling",
    explanation: `Var(aX) = a²·Var(X) = ${a}²·${v} = ${a * a}·${v} = ${answer}.`,
    commonErrors: mkErrors(answer, undefined, [
      {
        value: a * v,
        feedback: `You used a·Var(X); variance scales by a², not a.`,
        misconception: "scaled_by_a_not_a_squared",
      },
    ]),
    source: "Untimed diagnostic · Variance scaling",
    family: VAR_SCALE_FAMILY,
  };
}

/* ========================================================================== */
/*  Brownian motion — variance of an increment                                 */
/* ========================================================================== */

export const BM_INCREMENT_FAMILY = "diag-bm-increment";

/** Standard BM; Var(B_t − B_s) = t − s (independent increments). */
export function genBmIncrement(rng: Rng): NumericQuestion {
  const s = rng.int(1, 6);
  const dt = rng.int(2, 7);
  const t = s + dt;
  const answer = t - s;
  return {
    id: `diag-bm-${t}-${s}`,
    // NB: increment form "Var(B_t − B_s)" — never the single-time "Var(B_t)".
    prompt: `For standard Brownian motion, what is Var(B_${t} − B_${s})?`,
    answer,
    difficulty: "medium",
    concept: "Independent increments of BM",
    explanation: `BM has independent increments with Var(B_t − B_s) = t − s, so Var(B_${t} − B_${s}) = ${t} − ${s} = ${answer} (NOT ${t} + ${s}).`,
    commonErrors: mkErrors(answer, undefined, [
      {
        value: t + s,
        feedback: `You added the variances ${t} + ${s}; an increment's variance is the time DIFFERENCE t − s.`,
        misconception: "added_times_not_difference",
      },
      {
        value: t,
        feedback: `That is Var(B_${t}); the increment subtracts the earlier time ${s}.`,
        misconception: "used_endpoint_not_increment",
      },
    ]),
    source: "Untimed diagnostic · BM increments",
    family: BM_INCREMENT_FAMILY,
  };
}

/* ========================================================================== */
/*  Game theory — symmetric cyclic game mixed equilibrium                      */
/* ========================================================================== */

export const GAME_SYMMETRIC_FAMILY = "diag-game-symmetric";

/** Symmetric cyclic game with n equally-matched moves; equilibrium plays 1/n. */
export function genSymmetricGame(rng: Rng): NumericQuestion {
  // A regular tournament on an ODD number of moves (each beats exactly half the
  // rest) — the RPS family generalised. The unique symmetric equilibrium is
  // uniform 1/n. Odd n up to 25 gives a healthy, exact instance space.
  const n = rng.pick([3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25]);
  const answer = 1 / n;
  const decimals = 4;
  const named: Record<number, string> = {
    3: "rock–paper–scissors",
    5: "rock–paper–scissors–lizard–Spock",
  };
  const game =
    named[n] ??
    `a symmetric zero-sum game whose ${n} moves are perfectly balanced (each beats exactly half the others)`;
  return {
    id: `diag-game-${n}`,
    prompt: `In ${game} against a rational opponent, what probability should you assign to each move in the optimal mixed strategy? (Round to ${decimals} decimals.)`,
    answer,
    decimals,
    difficulty: "medium",
    concept: "Mixed-strategy equilibrium",
    unit: "",
    explanation: `By symmetry the unique equilibrium mixes each of the ${n} moves with equal probability 1/${n} = ${answer.toFixed(decimals)}.`,
    commonErrors: mkErrors(answer, decimals, [
      {
        value: 0.5,
        feedback: `You split it 50/50 as if there were only two options; there are ${n} balanced moves here.`,
        misconception: "guessed_half_symmetry",
      },
    ]),
    source: "Untimed diagnostic · Mixed strategy",
    family: GAME_SYMMETRIC_FAMILY,
  };
}

/* ========================================================================== */
/*  Branching processes — expected population growth                           */
/* ========================================================================== */

export const BRANCHING_MEAN_FAMILY = "diag-branching-mean";

/** Branching process, mean μ offspring; E[pop in generation g] from 1 = μ^g. */
export function genBranchingMean(rng: Rng): NumericQuestion {
  const mu = rng.int(2, 7);
  // Keep the population interview-scale: deeper generations only for small means.
  const g = rng.int(2, mu <= 3 ? 4 : 3);
  const answer = mu ** g;
  return {
    id: `diag-branch-${mu}-${g}`,
    prompt: `In a branching process each individual has on average ${mu} offspring. Starting from 1 individual, what is the expected population size in generation ${g}?`,
    answer,
    difficulty: "medium",
    concept: "Branching-process mean growth",
    explanation: `Expected size in generation n is μⁿ; with μ = ${mu}, generation ${g} is ${mu}^${g} = ${answer}.`,
    commonErrors: mkErrors(answer, undefined, [
      {
        value: mu * g,
        feedback: `You used μ·g (${mu}·${g}); the mean grows as μ^g, not μ·g.`,
        misconception: "linear_not_exponential_growth",
      },
      {
        value: mu ** (g - 1),
        feedback: `That is generation ${g - 1}; you need one more generation of growth.`,
        misconception: "off_by_one_generation",
      },
    ]),
    source: "Untimed diagnostic · Branching mean growth",
    family: BRANCHING_MEAN_FAMILY,
  };
}

/* ========================================================================== */
/*  Markov structure — two-step transition probability (Chapman–Kolmogorov)    */
/* ========================================================================== */

export const MARKOV_TWO_STEP_FAMILY = "diag-markov-two-step";

/** 2-state chain rows [a, 1−a], [b, 1−b]; P²[1→1] = a² + (1−a)·b. */
export function genMarkovTwoStep(rng: Rng): NumericQuestion {
  const a = rng.pick([0.6, 0.7, 0.8, 0.9]);
  const b = rng.pick([0.3, 0.4, 0.5, 0.6]);
  const answer = a * a + (1 - a) * b;
  const decimals = 4;
  const r = (x: number) => Number(x.toFixed(2));
  return {
    id: `diag-mstruct-${Math.round(a * 10)}-${Math.round(b * 10)}`,
    prompt: `A 2-state Markov chain has transition rows [${r(a)}, ${r(1 - a)}] (from state 1) and [${r(b)}, ${r(1 - b)}] (from state 2). What is the 2-step probability of going from state 1 back to state 1? (Round to ${decimals} decimals.)`,
    answer,
    decimals,
    difficulty: "medium",
    concept: "Chapman–Kolmogorov (P²)",
    unit: "",
    explanation: `P²[1→1] = ${r(a)}·${r(a)} + ${r(1 - a)}·${r(b)} = ${(a * a).toFixed(4)} + ${((1 - a) * b).toFixed(4)} = ${answer.toFixed(decimals)}.`,
    commonErrors: mkErrors(answer, decimals, [
      {
        value: a * a,
        feedback: `You kept only the stay–stay path a²; you ignored the leave-and-return path (1−a)·b.`,
        misconception: "ignored_return_path",
      },
      {
        value: a,
        feedback: `That is the 1-step probability; you must square the matrix for two steps.`,
        misconception: "used_one_step_not_two",
      },
    ]),
    source: "Untimed diagnostic · Chapman–Kolmogorov",
    family: MARKOV_TWO_STEP_FAMILY,
  };
}
