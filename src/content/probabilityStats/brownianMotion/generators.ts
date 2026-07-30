import type { Rng } from "@/lib/rng";
import type { Difficulty, NumericQuestion } from "@/types/content";
import { decText } from "../coreSolvers";
import { numericErrors } from "../coreScaffold";
import { bmBelow, bmMean, bmStd } from "./brownian";

/**
 * Parametric numeric generators for **Brownian Motion** (Bucket 1, advanced).
 * Every value comes ONLY from `./brownian.ts`; every distractor is a NAMED,
 * re-derived misconception (the recurring one: linear-t scaling vs √t scaling),
 * distinct and ≠ the answer (asserted in tests). `t` is a perfect square so σ√t
 * is a clean number.
 */

const BM_THEME = [
  { proc: "a stock's log-price", drift: "drift", vol: "volatility", unit: "per day" },
  { proc: "a particle's position", drift: "drift", vol: "diffusion", unit: "per second" },
  { proc: "a spread", drift: "drift", vol: "volatility", unit: "per hour" },
];

/** Standard deviation of X_t = σ√t. Trap: linear σt, the variance σ²t, or dropping σ. */
export function buildBmStdInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(BM_THEME);
  const sigma = rng.pick([2, 3, 4]);
  const t = rng.pick([4, 9, 16, 25]);
  const dp = 0;
  const value = bmStd(sigma, t); // integer
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    sigma * t,
    `σt = ${sigma * t} scales the std LINEARLY with time. Brownian std grows like √t, so it is σ√t, not σt.`,
  );
  push(
    sigma * sigma * t,
    `σ²t = ${sigma * sigma * t} is the VARIANCE. The standard deviation is its square root, σ√t.`,
  );
  push(
    Math.sqrt(t),
    `√t = ${Math.sqrt(t)} dropped σ. The std is σ·√t = ${sigma}·${Math.sqrt(t)}.`,
  );

  const prompt =
    `${cap(th.proc)} follows a Brownian motion with ${th.vol} σ = ${sigma} ${th.unit} (so X_t ~ N(μt, σ²t)). ` +
    `What is the standard deviation of X at time t = ${t}? (Whole number.)`;
  const explanation =
    `For Brownian motion, Var(X_t) = σ²t, so the standard deviation is σ√t = ${sigma}·√${t} = ${sigma}·${Math.sqrt(t)} = ${value}. ` +
    `This √t growth (not linear t) is the signature of diffusion.`;

  return {
    answer,
    numeric: {
      id: `gen-bm-std-${sigma}-${t}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Brownian std scales as σ√t",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Brownian motion · √t scaling",
    },
  };
}

/** Mean of X_t = x₀ + μt (linear drift). Trap: forgetting drift, start, or t. */
export function buildBmMeanInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(BM_THEME);
  const x0 = rng.pick([5, 10, 20, 100]);
  const mu = rng.pick([1, 2, 3]);
  const t = rng.pick([2, 3, 5]);
  const dp = 0;
  const value = bmMean(x0, mu, t); // positive integer
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    x0,
    `${x0} is the starting value x₀; you forgot the drift accumulated over time: E[X_t] = x₀ + μt.`,
  );
  push(
    mu * t,
    `μt = ${mu * t} is the drift alone; add the starting value x₀ = ${x0}.`,
  );
  push(
    x0 + mu,
    `x₀ + μ = ${x0 + mu} applies the drift for just one step; it accumulates over all t = ${t} units: x₀ + μt.`,
  );

  const prompt =
    `${cap(th.proc)} starts at x₀ = ${x0} and follows a Brownian motion with ${th.drift} μ = ${mu} ${th.unit}. ` +
    `What is the EXPECTED value E[X_t] at time t = ${t}? (Whole number.)`;
  const explanation =
    `Brownian drift is linear in time: E[X_t] = x₀ + μt = ${x0} + ${mu}·${t} = ${value}. ` +
    `(The variance σ²t does not affect the mean.)`;

  return {
    answer,
    numeric: {
      id: `gen-bm-mean-${x0}-${mu}-${t}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Brownian mean x₀+μt (linear drift)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Brownian motion · drift",
    },
  };
}

/** P(X_t ≤ x) = Φ((x−μt)/(σ√t)), started at 0. Trap: √t vs t denominator, forgetting drift, wrong tail. */
export function buildBmProbInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(BM_THEME);
  const mu = rng.pick([1, 2]);
  const sigma = rng.pick([2, 3]);
  const t = rng.pick([4, 9, 16]);
  const z = rng.pick([-2, -1, 1, 2]);
  const sd = bmStd(sigma, t); // integer
  const meanT = mu * t;
  const x = meanT + z * sd; // integer
  const dp = 4;
  const value = bmBelow(0, mu, sigma, t, x);
  const answer = Number(decText(value, dp));

  const linearDenom = bmBelow(0, mu, sigma * Math.sqrt(t), t, x); // uses σt in denom
  const noDrift = bmBelow(0, 0, sigma, t, x); // forgot the drift μt
  const wrongTail = bmBelow(0, mu, sigma, t, 2 * meanT - x); // Φ(−z)

  const { errors, push } = numericErrors(answer, dp);
  push(
    wrongTail,
    `${decText(wrongTail, dp)} = Φ(−z) reports the wrong tail (equivalently 1−Φ(z)). Here z = (x−μt)/(σ√t) = ${z}.`,
  );
  push(
    linearDenom,
    `${decText(linearDenom, dp)} standardises with σt (linear time) in the denominator. The BM std is σ√t, so z = (x−μt)/(σ√t).`,
  );
  push(
    noDrift,
    `${decText(noDrift, dp)} ignores the drift: the mean at time t is μt = ${meanT}, so subtract it before standardising.`,
  );

  const prompt =
    `${cap(th.proc)} starts at 0 with ${th.drift} μ = ${mu} and ${th.vol} σ = ${sigma} ${th.unit}, so X_t ~ N(μt, σ²t). ` +
    `What is P(X_${t} ≤ ${x})? (Round to ${dp} decimals.)`;
  const explanation =
    `X_${t} ~ N(μt, σ²t) = N(${meanT}, ${sigma * sigma * t}). Standardise: z = (${x} − ${meanT})/(σ√t) = (${x} − ${meanT})/${sd} = ${z}. ` +
    `So P(X_${t} ≤ ${x}) = Φ(${z}) = ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `gen-bm-prob-${mu}-${sigma}-${t}-${z}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "BM distribution X_t~N(μt,σ²t)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Brownian motion · distribution",
    },
  };
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const genBmStd = (rng: Rng): NumericQuestion =>
  buildBmStdInstance(rng, "hard").numeric;
export const genBmMean = (rng: Rng): NumericQuestion =>
  buildBmMeanInstance(rng, "hard").numeric;
export const genBmProb = (rng: Rng): NumericQuestion =>
  buildBmProbInstance(rng, "expert").numeric;
