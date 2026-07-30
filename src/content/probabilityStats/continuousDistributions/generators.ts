import type { Rng } from "@/lib/rng";
import type { Difficulty, NumericQuestion } from "@/types/content";
import { F, decText, fracText } from "../coreSolvers";
import { cap, numDp, numericErrors } from "../coreScaffold";
import {
  densityMean,
  densityNormConst,
  densityProb,
  expMemoryless,
  expTail,
  normalBelow,
  normalSymmetric,
  uniformProb,
  uniformVar,
} from "./continuous";

/**
 * Parametric numeric generators for **Continuous Distributions** (Bucket 1, UT
 * M362K ch. 5): density integration, continuous Uniform, Exponential, and Normal.
 * Density/Uniform answers are EXACT rationals; Exponential/Normal answers are
 * decimals with tolerance (transcendental). Every distractor is a NAMED,
 * re-derived misconception, distinct and ≠ the answer (asserted in tests).
 */

/* ============================ density integration ========================= */

/** Find the normalising constant c for f(x)=c·xⁿ on [0,L]: c=(n+1)/L^{n+1}. */
export function buildDensityNormInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const n = rng.pick([1, 2]);
  const L = rng.pick([2, 3, 4]);
  const value = densityNormConst(n, L);
  const dp = numDp(value, 2, 4);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    F(1, L ** (n + 1)),
    `1/L^{n+1} = ${fracText(F(1, L ** (n + 1)))} drops the (n+1) that comes from integrating xⁿ. ∫₀ᴸ c·xⁿ dx = c·L^{n+1}/(n+1) = 1 ⇒ c = (n+1)/L^{n+1}.`,
  );
  push(
    F(n + 1, L),
    `(n+1)/L = ${fracText(F(n + 1, L))} uses exponent 1, not n+1. The antiderivative of xⁿ raises the power to n+1, so L appears as L^{n+1}.`,
  );
  push(
    F(1, L),
    `1/L = ${fracText(F(1, L))} is the constant density of a UNIFORM. Here f grows like xⁿ, so its normaliser is (n+1)/L^{n+1}.`,
  );

  const prompt =
    `A continuous variable on [0, ${L}] has density f(x) = c·x^${n}. ` +
    `What value of c makes this a valid probability density? (Round to ${dp} decimals.)`;
  const explanation =
    `Require ∫₀^${L} c·x^${n} dx = c·${L}^${n + 1}/${n + 1} = 1, so c = ${n + 1}/${L}^${n + 1} = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `gen-density-norm-${n}-${L}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Density normalisation ∫f=1 ⇒ c=(n+1)/L^{n+1}",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Continuous · density normalisation",
    },
  };
}

/** P(a ≤ X ≤ b) for the normalised f(x)=c·xⁿ on [0,L] via integration. */
export function buildDensityProbInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const n = rng.pick([1, 2]);
  const L = rng.pick([2, 3, 4]);
  const a = rng.int(0, L - 2);
  let b = rng.int(a + 1, L);
  // Avoid the full support [0,L] (answer 1, where every distractor collapses to 1).
  if (a === 0 && b === L) b = L - 1;
  const value = densityProb(n, L, a, b);
  const dp = numDp(value, 2, 4);
  const answer = Number(decText(value, dp));

  const c = densityNormConst(n, L);
  const { errors, push } = numericErrors(answer, dp);
  push(
    F(b - a, L),
    `(b−a)/L = ${fracText(F(b - a, L))} treats X as UNIFORM. Because f=c·xⁿ is not flat, you must integrate: ∫ₐᵇ c·xⁿ dx = (b^{n+1}−a^{n+1})/L^{n+1}.`,
  );
  push(
    c.mul(b - a),
    `c·(b−a) = ${fracText(c.mul(b - a))} multiplies the density by the width (one rectangle). You must INTEGRATE the density across [${a},${b}], not sample it once.`,
  );
  push(
    F(b ** n - a ** n, L ** n),
    `(b^n−a^n)/L^n = ${fracText(F(b ** n - a ** n, L ** n))} forgets that integrating xⁿ raises the exponent to n+1.`,
  );

  const prompt =
    `A variable on [0, ${L}] has density f(x) = c·x^${n} (properly normalised). ` +
    `What is P(${a} ≤ X ≤ ${b})? (Round to ${dp} decimals.)`;
  const explanation =
    `With c = (n+1)/L^{n+1}, P(${a} ≤ X ≤ ${b}) = ∫_${a}^${b} c·x^${n} dx = (${b}^${n + 1} − ${a}^${n + 1})/${L}^${n + 1} = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `gen-density-prob-${n}-${L}-${a}-${b}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Probability by integrating a density",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Continuous · probability by integration",
    },
  };
}

/** E[X] for the normalised f(x)=c·xⁿ on [0,L] = (n+1)/(n+2)·L. */
export function buildDensityMeanInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const n = rng.pick([1, 2]);
  const L = rng.pick([2, 3, 4, 6]);
  const value = densityMean(n, L);
  const dp = numDp(value, 2, 4);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    F(L, 2),
    `L/2 = ${fracText(F(L, 2))} is the mean of a UNIFORM. A density rising like xⁿ pulls the mean toward L: E[X] = (n+1)/(n+2)·L.`,
  );
  push(
    F(L),
    `L = ${L} is the maximum, not the mean. The mean sits below L at (n+1)/(n+2)·L.`,
  );
  push(
    F(n * L, n + 1),
    `n/(n+1)·L = ${fracText(F(n * L, n + 1))} is an off-by-one: integrating x·xⁿ = x^{n+1} gives the (n+2) denominator and (n+1) numerator.`,
  );

  const prompt =
    `A variable on [0, ${L}] has density f(x) = c·x^${n} (properly normalised). ` +
    `What is E[X]? (Round to ${dp} decimals.)`;
  const explanation =
    `E[X] = ∫₀^${L} x·c·x^${n} dx = c·${L}^${n + 2}/${n + 2} = (n+1)/(n+2)·L = ${n + 1}/${n + 2}·${L} = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `gen-density-mean-${n}-${L}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "E[X] of a power density = (n+1)/(n+2)·L",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Continuous · expectation by integration",
    },
  };
}

/* ================================= uniform =============================== */

const UNIFORM_THEME = [
  { thing: "a bus arrival time (min past the hour)" },
  { thing: "a sensor reading (mV)" },
  { thing: "a delivery time (min)" },
];

/** P(a ≤ X ≤ b) for X ~ U(L, U). */
export function buildUniformProbInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(UNIFORM_THEME);
  const L = rng.int(1, 5);
  const U = L + rng.pick([4, 5, 6, 8, 10]);
  const a = rng.int(L, U - 2);
  const b = rng.int(a + 1, U);
  const value = uniformProb(L, U, a, b);
  const dp = numDp(value, 2, 4);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    F(b - a, U),
    `(b−a)/U = ${fracText(F(b - a, U))} divides by U, forgetting the support starts at L=${L}. The total length is U−L = ${U - L}.`,
  );
  push(
    F(1).sub(value),
    `1 − (b−a)/(U−L) = ${fracText(F(1).sub(value))} is the complement (outside [${a},${b}]).`,
  );
  push(
    F(b, U - L),
    `b/(U−L) = ${fracText(F(b, U - L))} uses the endpoint b instead of the interval length (b−a) = ${b - a}.`,
  );

  const prompt =
    `${cap(th.thing)} is uniform on [${L}, ${U}]. What is P(${a} ≤ X ≤ ${b})? (Round to ${dp} decimals.)`;
  const explanation =
    `For a Uniform on [${L}, ${U}], probability is proportional to length: P(${a} ≤ X ≤ ${b}) = (${b}−${a})/(${U}−${L}) = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `gen-uniform-prob-${L}-${U}-${a}-${b}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Continuous uniform probability = length ratio",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Continuous · uniform probability",
    },
  };
}

/** Variance of X ~ U(L, U) = (U−L)²/12. */
export function buildUniformVarInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(UNIFORM_THEME);
  const L = rng.int(0, 4);
  const U = L + rng.pick([4, 6, 8, 10, 12]);
  const range = U - L;
  const value = uniformVar(L, U);
  const dp = numDp(value, 2, 4);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    F(range, 12),
    `(U−L)/12 = ${fracText(F(range, 12))} forgot to SQUARE the range. Var = (U−L)²/12.`,
  );
  push(
    F(range * range),
    `(U−L)² = ${range * range} forgot to divide by 12.`,
  );
  push(
    F(range * range, 4),
    `(U−L)²/4 = ${fracText(F(range * range, 4))} squares the half-range. The uniform variance divides the squared range by 12, not 4.`,
  );

  const prompt =
    `${cap(th.thing)} is uniform on [${L}, ${U}]. What is its VARIANCE? (Round to ${dp} decimals.)`;
  const explanation =
    `Var(U(${L},${U})) = (U−L)²/12 = ${range}²/12 = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `gen-uniform-var-${L}-${U}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Continuous uniform variance (U−L)²/12",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Continuous · uniform variance",
    },
  };
}

/* =============================== exponential ============================= */

const EXP_THEME = [
  { thing: "the wait for the next call (min)", rate: "arrival rate" },
  { thing: "a component's lifetime (years)", rate: "failure rate" },
  { thing: "time between trades (s)", rate: "trade rate" },
];

/** P(X > t) = e^{−λt} for X ~ Exp(λ). */
export function buildExpTailInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(EXP_THEME);
  const lambda = rng.pick([0.5, 1, 2]);
  const t = rng.pick([1, 2, 3]);
  const dp = 4;
  const value = expTail(lambda, t);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    1 - value,
    `1 − e^{−λt} = ${decText(1 - value, dp)} is the CDF P(X ≤ t). The question asks the upper tail P(X > t) = e^{−λt}.`,
  );
  push(
    Math.exp(-lambda),
    `e^{−λ} = ${decText(Math.exp(-lambda), dp)} drops t. The exponent is λt = ${lambda}·${t} = ${lambda * t}.`,
  );
  push(
    Math.exp(-t),
    `e^{−t} = ${decText(Math.exp(-t), dp)} drops λ. The rate multiplies t in the exponent.`,
  );

  const prompt =
    `Suppose ${th.thing} is exponential with ${th.rate} λ = ${lambda}. ` +
    `What is P(X > ${t})? (Round to ${dp} decimals.)`;
  const explanation =
    `For an exponential, P(X > t) = e^{−λt} = e^{−${lambda}·${t}} = e^{−${lambda * t}} = ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `gen-exp-tail-${lambda}-${t}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Exponential upper tail e^{−λt}",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Continuous · exponential tail",
    },
  };
}

/** Memorylessness: P(X > s+t | X > s) = e^{−λt}. */
export function buildExpMemorylessInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(EXP_THEME);
  const lambda = rng.pick([0.5, 1, 2]);
  const s = rng.pick([1, 2, 3]);
  const t = rng.pick([1, 2]);
  const dp = 4;
  const value = expMemoryless(lambda, t);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    Math.exp(-lambda * (s + t)),
    `e^{−λ(s+t)} = ${decText(Math.exp(-lambda * (s + t)), dp)} is the UNconditional P(X > ${s + t}); you didn't condition on surviving to ${s}.`,
  );
  push(
    Math.exp(-lambda * s),
    `e^{−λs} = ${decText(Math.exp(-lambda * s), dp)} uses the elapsed time s instead of the extra time t.`,
  );
  push(
    1 - value,
    `1 − e^{−λt} = ${decText(1 - value, dp)} is the conditional CDF; the question asks the SURVIVAL probability.`,
  );

  const prompt =
    `Suppose ${th.thing} is exponential with ${th.rate} λ = ${lambda}. Given it has already exceeded ${s}, ` +
    `what is the probability it exceeds ${s + t} (i.e. lasts at least ${t} more)? (Round to ${dp} decimals.)`;
  const explanation =
    `The exponential is MEMORYLESS: P(X > s+t | X > s) = P(X > t) = e^{−λt} = e^{−${lambda}·${t}} = ${decText(value, dp)}. The elapsed time ${s} is irrelevant.`;

  return {
    answer,
    numeric: {
      id: `gen-exp-memoryless-${lambda}-${s}-${t}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Exponential memorylessness",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Continuous · memorylessness",
    },
  };
}

/** E[min of n iid Exp(λ)] = 1/(nλ). */
export function buildExpMinInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(EXP_THEME);
  const lambda = rng.pick([1, 2, 3, 4]);
  const n = rng.pick([2, 3, 4]);
  const frac = F(1, n * lambda);
  const dp = numDp(frac, 2, 4);
  const answer = Number(decText(frac, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    F(1, lambda),
    `1/λ = ${fracText(F(1, lambda))} is the mean of a SINGLE exponential. The minimum of ${n} of them has rate ${n}λ, so E[min] = 1/(${n}λ).`,
  );
  push(
    F(n, lambda),
    `n/λ = ${fracText(F(n, lambda))} multiplies by n; taking the MINIMUM speeds things up, so you DIVIDE by n: E[min] = 1/(nλ).`,
  );
  push(
    F(lambda, n),
    `λ/n = ${fracText(F(lambda, n))} inverts the mean. E[min] = 1/(nλ), not λ/n.`,
  );

  const prompt =
    `You have ${n} independent components, each with ${th.thing.replace(/\(.*\)/, "").trim()} exponential at rate λ = ${lambda}. ` +
    `What is the expected time until the FIRST event (the minimum)? (Round to ${dp} decimals.)`;
  const explanation =
    `The minimum of ${n} independent Exp(λ) is Exp(nλ), so E[min] = 1/(nλ) = 1/(${n}·${lambda}) = ${fracText(frac)} ≈ ${decText(frac, dp)}.`;

  return {
    answer,
    numeric: {
      id: `gen-exp-min-${lambda}-${n}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Minimum of exponentials is Exp(Σλ)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Continuous · min of exponentials",
    },
  };
}

/* ================================= normal ================================ */

const NORMAL_THEME = [
  { thing: "a daily return (bps)", who: "returns" },
  { thing: "a machined part's length (mm)", who: "parts" },
  { thing: "a test score", who: "scores" },
];

/** P(X ≤ x) = Φ(z) for X ~ N(μ, σ²) with a clean integer z. */
export function buildNormalBelowInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(NORMAL_THEME);
  const mu = rng.pick([50, 100, 0, 20]);
  const sigma = rng.pick([2, 4, 5, 10]);
  const z = rng.pick([-2, -1, 1, 2]);
  const x = mu + z * sigma;
  const dp = 4;
  const value = normalBelow(mu, sigma, x);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    normalBelow(mu, sigma, 2 * mu - x), // Φ(−z) = 1 − Φ(z): sign flip / wrong tail
    `Φ(−z) = ${decText(normalBelow(mu, sigma, 2 * mu - x), dp)} flips the sign of z (equivalently, reports the upper tail 1−Φ(z)). Here z = (x−μ)/σ = ${z}, and P(X ≤ x) = Φ(z).`,
  );
  push(
    normalBelow(mu, sigma * sigma, x), // divided by σ² not σ
    `${decText(normalBelow(mu, sigma * sigma, x), dp)} standardises with the VARIANCE σ² instead of σ. Use z = (x−μ)/σ.`,
  );
  if (mu !== 0) {
    push(
      normalBelow(0, sigma, x), // forgot to subtract μ
      `${decText(normalBelow(0, sigma, x), dp)} forgets to center by μ = ${mu}. Standardise as z = (x−μ)/σ, subtracting the mean first.`,
    );
  }

  const prompt =
    `Suppose ${th.thing} is Normal with mean μ = ${mu} and standard deviation σ = ${sigma}. ` +
    `What is P(X ≤ ${x})? (Round to ${dp} decimals.)`;
  const explanation =
    `Standardise: z = (x−μ)/σ = (${x}−${mu})/${sigma} = ${z}. Then P(X ≤ ${x}) = Φ(${z}) = ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `gen-normal-below-${mu}-${sigma}-${z}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Normal standardisation P(X≤x)=Φ((x−μ)/σ)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Continuous · normal standardisation",
    },
  };
}

/** P(μ−kσ ≤ X ≤ μ+kσ) = 2Φ(k) − 1 (the empirical-rule masses). */
export function buildNormalSymmetricInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(NORMAL_THEME);
  const mu = rng.pick([0, 50, 100]);
  const sigma = rng.pick([2, 4, 5, 10]);
  const k = rng.pick([1, 2, 3]);
  const lo = mu - k * sigma;
  const hi = mu + k * sigma;
  const dp = 4;
  const value = normalSymmetric(k);
  const answer = Number(decText(value, dp));
  const Phi = (value + 1) / 2; // Φ(k)

  const { errors, push } = numericErrors(answer, dp);
  push(
    Phi,
    `Φ(k) = ${decText(Phi, dp)} is only P(X ≤ μ+kσ) (everything below the upper edge). The interval mass is Φ(k) − Φ(−k) = 2Φ(k) − 1.`,
  );
  push(
    1 - value,
    `1 − (2Φ(k)−1) = ${decText(1 - value, dp)} is the mass OUTSIDE the interval (both tails combined).`,
  );
  push(
    1 - Phi,
    `1 − Φ(k) = ${decText(1 - Phi, dp)} is a single upper tail, not the central interval.`,
  );

  const prompt =
    `Suppose ${th.thing} is Normal with mean μ = ${mu} and standard deviation σ = ${sigma}. ` +
    `What is P(${lo} ≤ X ≤ ${hi}) — i.e. within ${k} standard deviation${k > 1 ? "s" : ""}? (Round to ${dp} decimals.)`;
  const explanation =
    `The interval is μ ± ${k}σ, so z runs from −${k} to ${k}: P = Φ(${k}) − Φ(−${k}) = 2Φ(${k}) − 1 = ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `gen-normal-sym-${sigma}-${k}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Symmetric normal interval 2Φ(k)−1",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Continuous · symmetric normal interval",
    },
  };
}

/* ------------------------------ named adapters ---------------------------- */

export const genDensityNorm = (rng: Rng): NumericQuestion =>
  buildDensityNormInstance(rng, "medium").numeric;
export const genDensityProb = (rng: Rng): NumericQuestion =>
  buildDensityProbInstance(rng, "medium").numeric;
export const genDensityMean = (rng: Rng): NumericQuestion =>
  buildDensityMeanInstance(rng, "medium").numeric;
export const genUniformProb = (rng: Rng): NumericQuestion =>
  buildUniformProbInstance(rng, "easy").numeric;
export const genUniformVar = (rng: Rng): NumericQuestion =>
  buildUniformVarInstance(rng, "medium").numeric;
export const genExpTail = (rng: Rng): NumericQuestion =>
  buildExpTailInstance(rng, "medium").numeric;
export const genExpMemoryless = (rng: Rng): NumericQuestion =>
  buildExpMemorylessInstance(rng, "hard").numeric;
export const genExpMin = (rng: Rng): NumericQuestion =>
  buildExpMinInstance(rng, "hard").numeric;
export const genNormalBelow = (rng: Rng): NumericQuestion =>
  buildNormalBelowInstance(rng, "hard").numeric;
export const genNormalSymmetric = (rng: Rng): NumericQuestion =>
  buildNormalSymmetricInstance(rng, "hard").numeric;
