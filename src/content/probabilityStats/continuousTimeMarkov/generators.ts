import type { Rng } from "@/lib/rng";
import type { Difficulty, NumericQuestion } from "@/types/content";
import { F, decText, fracText } from "../coreSolvers";
import { numDp, numericErrors } from "../coreScaffold";
import {
  ctmcTwoStateStationary,
  holdingTime,
  mm1MeanInSystem,
  mm1MeanWaiting,
  mm1Utilisation,
} from "./ctmc";

/**
 * Numeric generators for **continuous-time Markov chains + queues** (Bucket 2).
 * Exact rationals from `./ctmc.ts`; NAMED-misconception distractors (rate vs mean
 * time; racing vs summing exponentials; utilisation vs queue length; in-system
 * vs waiting).
 */

const HOLD_THEME = [
  { st: "a machine's 'running' state", ev: "failure or scheduled stop" },
  { st: "a server's 'busy' state", ev: "completion or timeout" },
  { st: "a molecule's excited state", ev: "decay or collision" },
];

/** E[holding time] = 1/(sum of out-rates). */
export function buildHoldingInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(HOLD_THEME);
  const a = rng.pick([1, 2, 3]);
  const b = rng.pick([1, 2, 4]);
  const total = a + b;
  const value = holdingTime([a, b]);
  const dp = numDp(value, 2, 4);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    F(total),
    `${total} is the total out-RATE. The expected holding TIME is its reciprocal, 1/(a+b).`,
  );
  push(
    F(1, a),
    `1/${a} uses only one exit's rate. The state leaves via EITHER route, so the total rate is a+b = ${total}.`,
  );
  push(
    F(1, a).add(F(1, b)),
    `1/a + 1/b = ${fracText(F(1, a).add(F(1, b)))} sums the two mean times. Competing exponentials RACE (rates add), so E[hold] = 1/(a+b).`,
  );

  const prompt =
    `In a CTMC, ${th.st} exits by ${th.ev} at independent rates ${a} and ${b}. ` +
    `What is the expected time spent in this state before leaving? (Round to ${dp} decimals.)`;
  const explanation =
    `The state is left at the total rate a+b = ${total} (competing exponentials add their rates), so the holding time is Exp(${total}) with mean 1/${total} = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `gen-ctmc-hold-${a}-${b}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "CTMC holding time = 1/(Σ out-rates)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "CTMC · holding time",
    },
  };
}

const CTMC_THEME = [
  { s0: "Off", s1: "On", up: "λ", down: "μ" },
  { s0: "Idle", s1: "Working", up: "λ", down: "μ" },
];

/** 2-state CTMC stationary π₀ = μ/(λ+μ). */
export function buildCtmcStationaryInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(CTMC_THEME);
  let lambda = rng.pick([1, 2, 3, 4]);
  let mu = rng.pick([1, 2, 3, 4]);
  while (lambda === mu) mu = rng.pick([1, 2, 3, 5]);
  const value = ctmcTwoStateStationary(lambda, mu); // μ/(λ+μ)
  const dp = numDp(value, 2, 4);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    F(lambda, lambda + mu),
    `λ/(λ+μ) = ${fracText(F(lambda, lambda + mu))} is the fraction of time in the OTHER state. π for a state is proportional to the rate flowing INTO it, so π_${th.s0} = μ/(λ+μ).`,
  );
  push(
    F(1, 2),
    `½ ignores the rates; the CTMC is 50/50 only when λ = μ.`,
  );
  push(
    F(lambda, mu),
    `λ/μ = ${fracText(F(lambda, mu))} is the rate ratio (odds), not a normalised probability.`,
  );

  const prompt =
    `A 2-state CTMC toggles ${th.s0} → ${th.s1} at rate λ = ${lambda} and ${th.s1} → ${th.s0} at rate μ = ${mu}. ` +
    `In the long run, what fraction of time is spent in ${th.s0}? (Round to ${dp} decimals.)`;
  const explanation =
    `Flow balance λπ_${th.s0} = μπ_${th.s1} with π summing to 1 gives π_${th.s0} = μ/(λ+μ) = ${mu}/${lambda + mu} = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `gen-ctmc-stationary-${lambda}-${mu}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "2-state CTMC stationary μ/(λ+μ)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "CTMC · stationary",
    },
  };
}

const MM1_THEME = [
  { serv: "a single teller", cust: "customers" },
  { serv: "one CPU core", cust: "jobs" },
  { serv: "a help desk", cust: "tickets" },
];

/** M/M/1 mean number in system L = λ/(μ−λ). */
export function buildMM1Instance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(MM1_THEME);
  // λ < μ (stable), with clean L.
  const [lambda, mu] = rng.pick([
    [1, 2],
    [2, 3],
    [1, 3],
    [2, 4],
    [3, 4],
    [1, 4],
    [3, 5],
  ]);
  const value = mm1MeanInSystem(lambda, mu); // λ/(μ−λ)
  const dp = numDp(value, 2, 4);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    mm1Utilisation(lambda, mu),
    `ρ = λ/μ = ${fracText(mm1Utilisation(lambda, mu))} is the server UTILISATION (fraction of time busy), not the mean number in the system L = ρ/(1−ρ).`,
  );
  push(
    F(mu, mu - lambda),
    `μ/(μ−λ) = ${fracText(F(mu, mu - lambda))} = 1/(1−ρ) forgets the ρ in the numerator: L = ρ/(1−ρ).`,
  );
  push(
    mm1MeanWaiting(lambda, mu),
    `${fracText(mm1MeanWaiting(lambda, mu))} = ρ²/(1−ρ) = Lq, the mean number WAITING in line; L also counts the one being served.`,
  );

  const prompt =
    `${cap(th.serv)} serves ${th.cust} as an M/M/1 queue: arrivals at rate λ = ${lambda}, service at rate μ = ${mu}. ` +
    `What is the mean number of ${th.cust} in the system? (Round to ${dp} decimals.)`;
  const explanation =
    `For M/M/1 with ρ = λ/μ = ${fracText(mm1Utilisation(lambda, mu))}, the mean number in system is L = ρ/(1−ρ) = λ/(μ−λ) = ${lambda}/${mu - lambda} = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `gen-ctmc-mm1-${lambda}-${mu}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "M/M/1 mean number in system L=ρ/(1−ρ)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "CTMC · M/M/1 queue",
    },
  };
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const genCtmcHolding = (rng: Rng): NumericQuestion =>
  buildHoldingInstance(rng, "medium").numeric;
export const genCtmcStationary = (rng: Rng): NumericQuestion =>
  buildCtmcStationaryInstance(rng, "hard").numeric;
export const genMM1 = (rng: Rng): NumericQuestion =>
  buildMM1Instance(rng, "hard").numeric;
