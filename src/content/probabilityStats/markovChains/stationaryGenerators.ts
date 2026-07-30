import type { Rng } from "@/lib/rng";
import type { Difficulty, NumericQuestion } from "@/types/content";
import { F, decText, fracText } from "../coreSolvers";
import { numDp, numericErrors } from "../coreScaffold";
import {
  longRunReward,
  stationaryDistribution,
  twoStateStationary,
} from "./stationary";

/**
 * Parametric numeric generators for **stationary / limiting distributions**
 * (Bucket 1). All answers are EXACT rationals from `./stationary.ts`; every
 * distractor is a NAMED misconception (wrong-state fraction, ignoring the rates,
 * odds-vs-probability, unweighted average), distinct and ≠ the answer.
 */

const TWO_STATE_THEME = [
  { s0: "Sunny", s1: "Rainy", noun: "days", a: "P(Sunny→Rainy)", b: "P(Rainy→Sunny)" },
  { s0: "Up", s1: "Down", noun: "hours", a: "P(Up→Down)", b: "P(Down→Up)" },
  { s0: "Bull", s1: "Bear", noun: "weeks", a: "P(Bull→Bear)", b: "P(Bear→Bull)" },
];

// (aNum,aDen,bNum,bDen) chosen so a≠b (π≠½) and both in (0,1).
const AB_POOL: [number, number, number, number][] = [
  [1, 4, 1, 3],
  [1, 4, 1, 2],
  [1, 3, 1, 6],
  [3, 10, 1, 5],
  [1, 6, 1, 3],
  [2, 5, 1, 5],
  [1, 5, 3, 10],
];

/** Long-run fraction of time in a state of a 2-state chain: π₀ = b/(a+b). */
export function buildTwoStateStationaryInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(TWO_STATE_THEME);
  const [an, ad, bn, bd] = rng.pick(AB_POOL);
  const a = F(an, ad);
  const b = F(bn, bd);
  const [pi0, pi1] = twoStateStationary(a, b);
  const target = rng.int(0, 1); // 0 or 1
  const value = target === 0 ? pi0 : pi1;
  const other = target === 0 ? pi1 : pi0;
  const dp = numDp(value, 2, 4);
  const answer = Number(decText(value, dp));
  const stateName = target === 0 ? th.s0 : th.s1;

  const { errors, push } = numericErrors(answer, dp);
  push(
    other,
    `${fracText(other)} is the long-run fraction of ${target === 0 ? th.s1 : th.s0} ${th.noun} — you solved for the wrong state (π for state j uses the INFLOW rate, so π_${th.s0} = b/(a+b)).`,
  );
  push(
    F(1, 2),
    `½ assumes 50/50. The steady state is 50/50 only if the two switch rates are equal; here they differ, so π = b/(a+b).`,
  );
  push(
    a.div(b),
    `a/b = ${fracText(a.div(b))} is the ratio of switch rates (odds), not a probability. Normalise: π₀ = b/(a+b).`,
  );

  const prompt =
    `A 2-state chain over ${th.s0}/${th.s1} ${th.noun} has ${th.a} = ${fracText(a)} and ${th.b} = ${fracText(b)}. ` +
    `In the long run, what FRACTION of ${th.noun} are ${stateName}? (Round to ${dp} decimals.)`;
  const explanation =
    `Solve πP = π with Σπ = 1: for a 2-state chain π₀ = b/(a+b) and π₁ = a/(a+b), where a = ${fracText(a)} (leave state 0) and b = ${fracText(b)} (enter state 0). ` +
    `So π_${stateName} = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `gen-stationary2-${an}_${ad}-${bn}_${bd}-${target}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "2-state stationary distribution π₀=b/(a+b)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Markov · stationary distribution (2-state)",
    },
  };
}

/** Long-run average reward Σπᵢrᵢ for a 2-state chain. */
export function buildStationaryRewardInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(TWO_STATE_THEME);
  const [an, ad, bn, bd] = rng.pick(AB_POOL);
  const a = F(an, ad);
  const b = F(bn, bd);
  const [pi0, pi1] = twoStateStationary(a, b);
  const r0 = rng.pick([10, 12, 20, 6]);
  const r1 = rng.pick([0, 2, 4, 3]);
  const value = longRunReward([pi0, pi1], [r0, r1]);
  const dp = numDp(value, 2, 4);
  const answer = Number(decText(value, dp));

  const swapped = pi1.mul(r0).add(pi0.mul(r1));
  const { errors, push } = numericErrors(answer, dp);
  push(
    F(r0 + r1, 2),
    `(r₀+r₁)/2 = ${fracText(F(r0 + r1, 2))} averages the two rewards equally. Weight each by its long-run fraction: π₀r₀ + π₁r₁.`,
  );
  push(
    swapped,
    `${fracText(swapped)} swaps the weights (π₁ on state 0). π₀ = b/(a+b) multiplies r₀, not π₁.`,
  );
  push(
    Math.max(r0, r1),
    `${Math.max(r0, r1)} is the best single-state reward; the long-run average blends both states by their stationary weights.`,
  );

  const prompt =
    `A 2-state chain over ${th.s0}/${th.s1} ${th.noun} has ${th.a} = ${fracText(a)} and ${th.b} = ${fracText(b)}. ` +
    `Each ${th.s0.toLowerCase()} ${th.noun.replace(/s$/, "")} yields ${r0} and each ${th.s1.toLowerCase()} one yields ${r1}. ` +
    `What is the long-run AVERAGE reward per ${th.noun.replace(/s$/, "")}? (Round to ${dp} decimals.)`;
  const explanation =
    `Long-run average = π₀r₀ + π₁r₁ with π₀ = b/(a+b) = ${fracText(pi0)}, π₁ = ${fracText(pi1)}. ` +
    `= ${fracText(pi0)}·${r0} + ${fracText(pi1)}·${r1} = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `gen-stationary-reward-${an}_${ad}-${bn}_${bd}-${r0}-${r1}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Long-run average reward Σπᵢrᵢ",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Markov · long-run average reward",
    },
  };
}

/** Stationary probability of a target state in a 3-state chain (solved exactly). */
export function buildThreeStateStationaryInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  // Rows: [0,a,1-a] / [1-b,0,b] / [c,1-c,0].
  const aPool = [F(1, 2), F(1, 3), F(2, 3)];
  const a = rng.pick(aPool);
  const b = rng.pick(aPool);
  const c = rng.pick(aPool);
  const P = [
    [F(0), a, F(1).sub(a)],
    [F(1).sub(b), F(0), b],
    [c, F(1).sub(c), F(0)],
  ];
  const pi = stationaryDistribution(P);
  const target = rng.int(0, 2);
  const value = pi[target];
  const dp = numDp(value, 2, 4);
  const answer = Number(decText(value, dp));
  const otherIdx = (target + 1) % 3;

  const { errors, push } = numericErrors(answer, dp);
  push(
    F(1, 3),
    `1/3 assumes a uniform steady state. That only holds for a doubly-stochastic chain; here you must solve πP = π.`,
  );
  push(
    pi[otherIdx],
    `${fracText(pi[otherIdx])} is the stationary probability of state ${otherIdx + 1}, not state ${target + 1}.`,
  );
  push(
    F(1).sub(value),
    `${fracText(F(1).sub(value))} = 1 − π is the mass on the OTHER two states combined, not π of state ${target + 1}.`,
  );

  const rowStr = P.map(
    (row) => `[${row.map((x) => fracText(x)).join(", ")}]`,
  ).join(", ");
  const prompt =
    `A 3-state Markov chain has transition matrix rows ${rowStr} (states 1,2,3). ` +
    `In the long run, what fraction of time is spent in state ${target + 1}? (Round to ${dp} decimals.)`;
  const explanation =
    `Solve the balance equations πP = π with π₁+π₂+π₃ = 1. The stationary vector is ` +
    `(${pi.map((x) => fracText(x)).join(", ")}), so π_${target + 1} = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `gen-stationary3-${fracText(a)}-${fracText(b)}-${fracText(c)}-${target}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "3-state stationary distribution (solve πP=π)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Markov · stationary distribution (3-state)",
    },
  };
}

export const genTwoStateStationary = (rng: Rng): NumericQuestion =>
  buildTwoStateStationaryInstance(rng, "hard").numeric;
export const genStationaryReward = (rng: Rng): NumericQuestion =>
  buildStationaryRewardInstance(rng, "hard").numeric;
export const genThreeStateStationary = (rng: Rng): NumericQuestion =>
  buildThreeStateStationaryInstance(rng, "hard").numeric;
