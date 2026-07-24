import type { Rng } from "@/lib/rng";
import type { Difficulty, NumericQuestion, Question } from "@/types/content";
import {
  F,
  affineCorrelation,
  cltDifferenceZ,
  cltUpperTail,
  decText,
  fracText,
  markovBound,
  maxCovariance,
  twoDrumSumSD,
  varLinearCombo,
} from "../coreSolvers";
import { type Choice, assembleChoices, cap, numericErrors } from "../coreScaffold";

/**
 * Parametric generators for the Probability & Statistics → **Variance,
 * Covariance & the CLT** subcategory (re-homed from the former "General" set,
 * consolidating the covariance/variance-trap family with the CLT /
 * concentration-bound family — both are second-moment / limit-law reasoning).
 *
 * Every correct scalar is produced ONLY by the exact / high-precision solver in
 * `../coreSolvers`; every distractor is a re-derived, NAMED misconception,
 * guaranteed ≠ the answer and distinct at the stated grading precision.
 *
 * Modes:
 *   • quiz    — genMaxCov, genAffineCorr, genSumSD, genCltDiffZ
 *   • numeric — genVarCombo, genCltTail, genMarkovBound
 */

/* ========================================================================== */
/* ================  COVARIANCE / VARIANCE (quiz + numeric)  =============== */
/* ========================================================================== */

/** (varA, varB) pairs whose product is a perfect square and varA ≠ varB. */
const COV_PAIRS: [number, number][] = [
  [20, 5],
  [8, 2],
  [18, 2],
  [12, 3],
  [27, 3],
];

/**
 * Maximum covariance under Cauchy–Schwarz = √(Var_A·Var_B); the stated MEANS are
 * red herrings. Traps: dropping the square root (Var_A·Var_B), using the means
 * (meanA·meanB), and averaging the variances ((Var_A+Var_B)/2).
 */
export function buildMaxCovInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: string; question: Question } {
  const [varA, varB] = rng.pick(COV_PAIRS);
  // Means are irrelevant; sample them so no red-herring value collides.
  let meanA = 0;
  let meanB = 0;
  const value = maxCovariance(varA, varB);
  const avgVar = (varA + varB) / 2;
  const product = varA * varB;
  do {
    meanA = rng.int(2, 9);
    meanB = rng.int(2, 9);
  } while (
    meanA * meanB === value ||
    meanA * meanB === product ||
    meanA * meanB === avgVar
  );

  const fmt = (v: number) => decText(v, 1);
  const correct: Choice = {
    text: fmt(value),
    rationale: `Correct — Cauchy–Schwarz caps covariance at √(Var_A·Var_B) = √(${varA}·${varB}) = ${fmt(value)}, attained at correlation ±1.`,
  };
  const distractors: Choice[] = [
    {
      text: fmt(product),
      rationale: `${fmt(product)} = Var_A·Var_B forgets the square root. The bound is Cov² ≤ Var_A·Var_B, so Cov ≤ √(Var_A·Var_B).`,
    },
    {
      text: fmt(meanA * meanB),
      rationale: `${fmt(meanA * meanB)} = mean_A·mean_B uses the MEANS. Covariance depends only on deviations from the mean, so the means are irrelevant.`,
    },
    {
      text: fmt(avgVar),
      rationale: `${fmt(avgVar)} = (Var_A+Var_B)/2 averages the variances. The Cauchy–Schwarz bound is the geometric mean √(Var_A·Var_B), not the arithmetic mean.`,
    },
  ];

  const prompt =
    `Two returns have means ${meanA} and ${meanB}, variances Var_A = ${varA} and Var_B = ${varB}. ` +
    `What is the LARGEST possible value of Cov(A, B)?`;
  const explanation =
    `By Cauchy–Schwarz, |Cov(A,B)| ≤ √(Var_A·Var_B) = √(${varA}·${varB}) = √${product} = ${fmt(value)}, achieved when A and B are perfectly correlated. ` +
    `The means (${meanA}, ${meanB}) play no role — covariance is built from deviations, not levels.`;

  return {
    answer: fmt(value),
    question: {
      id: `gen-maxcov-${varA}-${varB}`,
      prompt,
      explanation,
      difficulty,
      concept: "Cauchy–Schwarz covariance bound (means irrelevant)",
      source: "Variance & Covariance · Cauchy–Schwarz",
      ...assembleChoices(rng, correct, distractors),
    },
  };
}

/**
 * Correlation under affine maps U = α+bX, V = γ+dY equals sign(b)·sign(d)·ρ; the
 * magnitudes |b|,|d| cancel. This generator forces exactly one negative slope so
 * the correct answer is −ρ. Traps: keeping ρ (ignoring the sign flip), scaling
 * by |b·d|, and scaling while also dropping the sign flip.
 */
export function buildAffineCorrInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: string; question: Question } {
  let bm = 1;
  let dm = 1;
  do {
    bm = rng.int(1, 6);
    dm = rng.int(1, 6);
  } while (bm * dm < 2); // ensure |b·d| ≠ 1 so the scaled distractors differ
  const negIsB = rng.chance(0.5);
  const b = negIsB ? -bm : bm;
  const d = negIsB ? dm : -dm;

  const rhoNum = rng.int(1, 9);
  const rho = F(rhoNum, 10);
  const value = affineCorrelation(b, d, rho); // = −ρ (one negative slope)
  const dp = 2;
  const answer = decText(value, dp);
  const mag = bm * dm;

  const alpha = rng.int(1, 9);
  const gamma = rng.int(1, 9);

  const correct: Choice = {
    text: decText(value, dp),
    rationale: `Correct — ρ(U,V) = sign(b)·sign(d)·ρ = (−1)·${fracText(rho)} = ${decText(value, dp)}; the magnitudes |b|,|d| cancel, only the signs survive.`,
  };
  const distractors: Choice[] = [
    {
      text: decText(rho, dp),
      rationale: `You kept ρ = ${decText(rho, dp)}. One slope is negative, and a negative slope FLIPS the sign of the correlation, so the answer is −ρ.`,
    },
    {
      text: decText(-rho.valueOf() * mag, dp),
      rationale: `${decText(-rho.valueOf() * mag, dp)} scaled by |b·d| = ${mag}. Magnitudes CANCEL between the covariance and the two standard deviations; correlation is scale-free.`,
    },
    {
      text: decText(rho.valueOf() * mag, dp),
      rationale: `${decText(rho.valueOf() * mag, dp)} both scales by |b·d| = ${mag} AND ignores the sign flip — two separate errors; correlation stays in [−1, 1].`,
    },
  ];

  const prompt =
    `X and Y have correlation ρ(X,Y) = ${fracText(rho)}. Define U = ${alpha} + (${b})·X and V = ${gamma} + (${d})·Y. ` +
    `What is the correlation ρ(U, V)?`;
  const explanation =
    `Affine maps leave correlation invariant up to sign: ρ(U,V) = sign(b)·sign(d)·ρ(X,Y). Here sign(${b})·sign(${d}) = −1, so ρ(U,V) = −${fracText(rho)} = ${decText(value, dp)}. ` +
    `The shifts ${alpha}, ${gamma} drop out and the magnitudes ${bm}, ${dm} cancel.`;

  return {
    answer,
    question: {
      id: `gen-affinecorr-${b}-${d}-${rhoNum}`,
      prompt,
      explanation,
      difficulty,
      concept: "Affine correlation (only the signs survive)",
      source: "Variance & Covariance · affine correlation",
      ...assembleChoices(rng, correct, distractors),
    },
  };
}

const VARCOMBO_THEME = [
  { actor: "two independent desks", vars: ["X", "Y"] },
  { actor: "two uncorrelated assets", vars: ["X", "Y"] },
  { actor: "two independent sensors", vars: ["X", "Y"] },
];

/**
 * Var(aX + bY) for independent X, Y = a²Var(X) + b²Var(Y). Traps: not squaring
 * the coefficients (a·Var(X)+b·Var(Y)), adding a spurious covariance cross term
 * although independent, and a bare linear +2ab.
 */
export function buildVarComboInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(VARCOMBO_THEME);
  const a = rng.int(1, 4);
  const b = rng.int(1, 4);
  const vx = rng.int(1, 6);
  const vy = rng.int(1, 6);
  const varX = F(vx);
  const varY = F(vy);

  const value = varLinearCombo(a, varX, b, varY);
  const dp = 0;
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    a * vx + b * vy,
    `${a}·${vx} + ${b}·${vy} = ${a * vx + b * vy} forgets to SQUARE the coefficients. Var(aX) = a²Var(X), so the coefficients enter as a² and b².`,
  );
  push(
    value.valueOf() + 2 * a * b * Math.sqrt(vx * vy),
    `You added a covariance cross term 2ab·√(Var_X·Var_Y). Because X and Y are independent, Cov(X,Y) = 0 and there is NO cross term.`,
  );
  push(
    value.valueOf() + 2 * a * b,
    `You tacked on a bare 2ab = ${2 * a * b} as if Cov(X,Y) = 1. Independence forces the cross term to vanish entirely.`,
  );

  const prompt =
    `For ${th.actor} the readings X and Y are independent with Var(X) = ${vx} and Var(Y) = ${vy}. ` +
    `Let Z = ${a}X + ${b}Y. What is Var(Z)? (Whole number.)`;
  const explanation =
    `For independent variables, Var(${a}X + ${b}Y) = ${a}²·Var(X) + ${b}²·Var(Y) = ${a * a}·${vx} + ${b * b}·${vy} = ${fracText(value)}. No cross term appears because Cov(X,Y) = 0.`;

  return {
    answer,
    numeric: {
      id: `gen-varcombo-${a}-${b}-${vx}-${vy}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Variance of a linear combination (independent)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Variance & Covariance · variance of a sum",
    },
  };
}

const SUMSD_THEME = [
  { actor: "two independent dials", face: "wheel" },
  { actor: "two independent tickets", face: "stub" },
  { actor: "two independent chips", face: "token" },
];

/**
 * S = X + Y, X, Y iid discrete-uniform on 1..m: σ_S = √(2·(m²−1)/12). The
 * signature trap is ADDING standard deviations (σ_X+σ_Y); also reporting the
 * variance itself, and reporting a single draw's SD.
 */
export function buildSumSDInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: string; question: Question } {
  const th = rng.pick(SUMSD_THEME);
  const m = rng.pick([5, 7, 9, 11, 13]);
  const { variance, sd } = twoDrumSumSD(m);
  const dp = 2;
  const value = sd;
  const singleSd = Math.sqrt((m * m - 1) / 12);

  const correct: Choice = {
    text: decText(value, dp),
    rationale: `Correct — variances add for independent sums: Var(S) = 2·(m²−1)/12 = ${fracText(variance)}, so σ_S = √Var(S) = ${decText(value, dp)}.`,
  };
  const distractors: Choice[] = [
    {
      text: decText(2 * singleSd, dp),
      rationale: `${decText(2 * singleSd, dp)} = σ_X + σ_Y ADDS standard deviations. SDs don't add — variances do: σ_S = √(σ_X²+σ_Y²), not σ_X+σ_Y.`,
    },
    {
      text: decText(variance, dp),
      rationale: `${decText(variance, dp)} = Var(S) = 2·(m²−1)/12 is the VARIANCE. Take its square root to get the standard deviation.`,
    },
    {
      text: decText(singleSd, dp),
      rationale: `${decText(singleSd, dp)} = √((m²−1)/12) is ONE draw's SD. The sum of two independent draws has DOUBLE the variance, so a larger SD.`,
    },
  ];

  const prompt =
    `You add the results of ${th.actor}, each showing a uniform integer from 1 to ${m}; let S be the total on both ${th.face}s. ` +
    `What is the standard deviation of S?`;
  const explanation =
    `Each draw has variance (m²−1)/12 = (${m}²−1)/12 = ${fracText(F(m * m - 1, 12))}. Independence makes VARIANCES add: Var(S) = 2·(m²−1)/12 = ${fracText(variance)}, ` +
    `so σ_S = √${decText(variance, dp)} = ${decText(value, dp)}. Standard deviations themselves never add.`;

  return {
    answer: decText(value, dp),
    question: {
      id: `gen-sumsd-${m}`,
      prompt,
      explanation,
      difficulty,
      concept: "SD of an independent sum (variances add, not SDs)",
      source: "Variance & Covariance · SD addition trap",
      ...assembleChoices(rng, correct, distractors),
    },
  };
}

/* ========================================================================== */
/* ===============  CLT & CONCENTRATION (numeric + quiz)  =================== */
/* ========================================================================== */

const COIN_THEME = [
  { subj: "a fair coin", act: "flipped", noun: "flips", win: "heads" },
  {
    subj: "a fair chip (with replacement) drawn from an equal red/blue bag",
    act: "drawn",
    noun: "draws",
    win: "red chips",
  },
];

/**
 * CLT normal-approximation UPPER tail P(X ≥ k) ≈ 1 − Φ(z) for a binomial count
 * of `n` fair trials (mean ½, variance ¼). Parameters are chosen so the z-score
 * is a clean integer 2 or 3.
 */
export function buildCltTailInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(COIN_THEME);
  const [n, z] = rng.pick([
    [100, 2],
    [100, 3],
    [400, 2],
    [900, 2],
    [900, 3],
  ]);
  const mean = 0.5;
  const variance = 0.25;
  const sd = Math.sqrt(n * variance); // 5, 10, or 15
  const k = n * mean + z * sd; // integer by construction

  const dp = 5;
  const value = cltUpperTail(k, n, mean, variance); // 1 − Φ(z)
  const answer = Number(decText(value, dp));

  const phi = 1 - value; // Φ(z): reported the lower tail P(X ≤ k)
  const forgotComplement = phi;
  const varEqMean = cltUpperTail(k, n, mean, mean); // sd = √(n·p), dropped (1−p)
  const twoTailed = 2 * value;

  const { errors, push } = numericErrors(answer, dp);
  push(
    forgotComplement,
    `You reported P(X ≤ ${k}) = Φ(${z}) = ${decText(phi, dp)}; the question asks the UPPER tail 1 − Φ(${z}) = ${decText(value, dp)}.`,
  );
  push(
    varEqMean,
    `Binomial variance is n·p(1−p), not n·p. Using variance = ${mean} (sd = √(n·p)) instead of ${variance} (sd = √(n·p(1−p))) shifts the z-score and gives ${decText(varEqMean, dp)}.`,
  );
  push(
    twoTailed,
    `You doubled for both tails (${decText(twoTailed, dp)} = 2·(1−Φ(${z}))); this is a one-sided question, so the answer is the single upper tail ${decText(value, dp)}.`,
  );

  const prompt =
    `${cap(th.subj)} is ${th.act} ${n} times; let X be the number of ${th.win}. ` +
    `Using the Central Limit Theorem normal approximation (no continuity correction), ` +
    `estimate P(X ≥ ${k}). (Round to ${dp} decimals.)`;
  const explanation =
    `Each trial has mean μ = ${mean} and variance σ² = p(1−p) = ${variance}, so over ${n} trials E[X] = ${n * mean} and sd = √(${n}·${variance}) = ${sd}. ` +
    `The z-score is z = (${k} − ${n * mean})/${sd} = ${z}, and the upper tail is P(X ≥ ${k}) ≈ 1 − Φ(${z}) = ${decText(value, dp)}. ` +
    `(Φ(${z}) = ${decText(phi, dp)} is the lower tail, its complement.)`;

  return {
    answer,
    numeric: {
      id: `gen-clt-tail-${n}-${z}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "CLT normal-approximation upper tail (1 − Φ(z))",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "CLT & concentration · normal tail",
    },
  };
}

const DESK_THEME = [
  { a: "Desk A", b: "Desk B", unit: "trades", quantity: "PnL" },
  { a: "Line 1", b: "Line 2", unit: "batches", quantity: "yield deviation" },
];

/**
 * CLT z-argument `a` such that P(S − T > thresh) = Φ(a), where S and T are each
 * independent sums of `n` iid terms (mean 0, variance σ²). Because the DIFFERENCE
 * has Var = Var(S) + Var(T) = 2nσ², a = −thresh/√(2nσ²). Teaches the
 * variance-doubling trap. We ask for `a` itself (negative), not a probability.
 */
export function buildCltDiffZInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: string; question: Question } {
  const th = rng.pick(DESK_THEME);
  const [varN, varD, n] = rng.pick([
    [1, 20, 250],
    [1, 4, 200],
    [1, 12, 150],
    [1, 1, 50],
    [1, 12, 216],
    [1, 8, 100],
  ]);
  const z = rng.pick([2, 3]);
  const variance = varN / varD;
  const sd = Math.sqrt(2 * n * variance); // integer by construction
  const thresh = sd * z;

  const dp = 2;
  const value = cltDifferenceZ(thresh, n, variance); // −thresh/√(2nσ²) = −z

  const sdOne = Math.sqrt(n * variance); // sd of ONE sum
  const oneSumZ = -thresh / sdOne; // forgot the difference doubles variance
  const signFlip = -value; // +thresh/sd
  const noSqrt = -thresh / (2 * n * variance); // divided by the variance itself

  const correct: Choice = {
    text: decText(value, dp),
    rationale: `Correct — S − T has Var = 2nσ² = ${2 * n * variance}, sd = ${sd}, so P(S − T > ${thresh}) = Φ(−${thresh}/${sd}) = Φ(${decText(value, dp)}). Hence a = ${decText(value, dp)}.`,
  };
  const distractors: Choice[] = [
    {
      text: decText(oneSumZ, dp),
      rationale: `The variance-DOUBLING trap: the difference has Var(S)+Var(T) = 2nσ² = ${2 * n * variance} (sd ${sd}). Using only nσ² (sd ${decText(sdOne, dp)}) gives a = ${decText(oneSumZ, dp)} — too big in magnitude because you forgot the difference doubles the variance.`,
    },
    {
      text: decText(signFlip, dp),
      rationale: `Sign error: P(S − T > ${thresh}) = Φ(−${thresh}/${sd}), so a is NEGATIVE (${decText(value, dp)}), not ${decText(signFlip, dp)}.`,
    },
    {
      text: decText(noSqrt, dp),
      rationale: `You forgot the square root: sd = √(2nσ²) = ${sd}, not the variance 2nσ² = ${2 * n * variance}. Dividing by the variance gives a = ${decText(noSqrt, dp)}.`,
    },
  ];

  const prompt =
    `${th.a} and ${th.b} each independently record ${n} ${th.unit}, and every ${th.unit.replace(/s$/, "")}'s ${th.quantity} has mean 0 and variance ${fracText(F(varN, varD))}. ` +
    `Let S and T be the two totals. For which value a does P(S − T > ${thresh}) = Φ(a), where Φ is the standard normal CDF?`;
  const explanation =
    `S − T has mean 0 and variance Var(S) + Var(T) = 2·${n}·${fracText(F(varN, varD))} = ${2 * n * variance}, so its sd is √${2 * n * variance} = ${sd}. ` +
    `Then P(S − T > ${thresh}) = P(Z > ${thresh}/${sd}) = Φ(−${thresh}/${sd}) = Φ(${decText(value, dp)}), hence a = −${thresh}/${sd} = ${decText(value, dp)}. ` +
    `The classic slip is forgetting that a DIFFERENCE doubles the variance.`;

  return {
    answer: decText(value, dp),
    question: {
      id: `gen-clt-diffz-${varN}_${varD}-${n}-${z}`,
      prompt,
      explanation,
      difficulty,
      concept: "CLT z-argument for a difference (variance doubling)",
      source: "CLT & concentration · variance doubling",
      ...assembleChoices(rng, correct, distractors),
    },
  };
}

const MARKOV_THEME = [
  { actor: "an insurer", part: "claims", agg: "total payout" },
  { actor: "a warehouse", part: "orders", agg: "total volume" },
  { actor: "a load balancer", part: "requests", agg: "total work" },
];

/**
 * Markov's-inequality UPPER bound P(T ≥ a) ≤ E[T]/a for a sum T of `count` iid
 * nonnegative parts each with mean `mu`, so E[T] = count·mu (exact Fraction),
 * and a threshold a > E[T] chosen so the bound is a clean fraction in (0,1).
 */
export function buildMarkovBoundInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(MARKOV_THEME);
  const [count, muN, muD, a] = rng.pick([
    [4, 3, 2, 8],
    [4, 3, 2, 9],
    [4, 3, 2, 10],
    [4, 3, 2, 12],
    [4, 3, 2, 15],
    [5, 1, 1, 8],
    [5, 1, 1, 10],
    [5, 1, 1, 20],
    [3, 2, 1, 8],
    [8, 1, 2, 5],
    [5, 2, 1, 16],
    [5, 2, 1, 25],
  ]);
  const mu = F(muN, muD);
  const eT = mu.mul(count); // E[T] = count·mu
  const value = markovBound(eT, F(a)); // E[T]/a

  const dp = 3;
  const answer = Number(decText(value, dp));

  const inverted = F(a).div(eT); // a/E[T]
  const trivial = 1;
  const overTight = value.mul(value); // (E[T]/a)² — an over-tightening

  const { errors, push } = numericErrors(answer, dp);
  push(
    inverted,
    `Markov's inequality is E[T]/a = ${fracText(eT)}/${a} = ${fracText(value)}, not a/E[T] = ${fracText(inverted)}. You inverted the ratio.`,
  );
  push(
    trivial,
    `1 is the trivial bound. Because a = ${a} > E[T] = ${fracText(eT)}, Markov gives a nontrivial bound strictly below 1, namely ${fracText(value)}.`,
  );
  push(
    overTight,
    `${fracText(overTight)} squares the bound as if you had a variance-based (Chebyshev-style) tail. Markov uses only the mean, giving E[T]/a = ${fracText(value)}.`,
  );

  const prompt =
    `${cap(th.actor)} processes ${count} independent ${th.part}, each with mean ${fracText(mu)}, so the ${th.agg} T has mean E[T] = ${fracText(eT)}. ` +
    `Using Markov's inequality, what is the best upper bound on P(T ≥ ${a})? (Round to ${dp} decimals.)`;
  const explanation =
    `The parts are nonnegative, so Markov applies: P(T ≥ a) ≤ E[T]/a. Here E[T] = ${count}·${fracText(mu)} = ${fracText(eT)} and a = ${a}, ` +
    `giving P(T ≥ ${a}) ≤ ${fracText(eT)}/${a} = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `gen-markov-bound-${count}-${muN}_${muD}-${a}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Markov's inequality upper bound (E[T]/a)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "CLT & concentration · Markov bound",
    },
  };
}

/* ========================================================================== */
/*  Named generators (adapters — mode noted per line)                         */
/* ========================================================================== */

// Covariance / variance
export const genMaxCov = (rng: Rng): Question => buildMaxCovInstance(rng, "medium").question; // quiz
export const genAffineCorr = (rng: Rng): Question =>
  buildAffineCorrInstance(rng, "medium").question; // quiz
export const genVarCombo = (rng: Rng): NumericQuestion =>
  buildVarComboInstance(rng, "easy").numeric; // numeric
export const genSumSD = (rng: Rng): Question => buildSumSDInstance(rng, "medium").question; // quiz

// CLT & concentration
export const genCltTail = (rng: Rng): NumericQuestion =>
  buildCltTailInstance(rng, "hard").numeric; // numeric
export const genCltDiffZ = (rng: Rng): Question =>
  buildCltDiffZInstance(rng, "hard").question; // quiz
export const genMarkovBound = (rng: Rng): NumericQuestion =>
  buildMarkovBoundInstance(rng, "medium").numeric; // numeric
