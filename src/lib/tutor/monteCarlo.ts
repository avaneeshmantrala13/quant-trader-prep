import type { Rng } from "@/lib/rng";

/**
 * Deterministic client-side Monte-Carlo simulators (PHASE_2 §5, rung 4).
 *
 * Research anchor: GAISE 2016 / Fischbein & Schnarch 1997 / Konold 1993 —
 * ELICIT-THEN-CONFRONT durable misconceptions (gambler's fallacy, outcome
 * approach) by simulating and letting the learner watch the empirical frequency
 * converge to the true value. The simulation is SEEDED, so it is fully
 * deterministic and reproducible in tests (no real randomness, no clock).
 *
 * Everything runs client-side with the LLM flag OFF; the sim IS the confront.
 */

export interface MonteCarloSpec {
  kind: "coin" | "dice" | "urn";
  /** Number of trials (capped at {@link MAX_TRIALS}). */
  trials: number;
  /** Seed used to reconstruct the exact same run in the view. */
  seed: number;
  /** Kind-specific parameters (see each simulator below). */
  params: Record<string, number>;
}

export interface MonteCarloResult {
  /** Cumulative success frequency after each trial (converges to the truth). */
  runningFrequency: number[];
  /** The final cumulative frequency (= runningFrequency at the last trial). */
  final: number;
}

/** Hard cap on trials so a rung-4 open is always a few trivial ms (PHASE_2 §9). */
export const MAX_TRIALS = 10_000;

/**
 * Run a seeded Monte-Carlo simulation and return the running success frequency.
 *
 * Simulators (all use ONLY the injected `rng`, so a fixed seed reproduces the
 * run exactly):
 *  - `coin`  — params `{ pHeads? = 0.5 }`; success = heads. The gambler's-fallacy
 *    confront: each flip is independent, so the running frequency converges to
 *    `pHeads` regardless of streaks.
 *  - `dice`  — params `{ sides? = 6, face? = 6 }`; success = rolling `face`.
 *  - `urn`   — params `{ total, success }`; success = drawing a "success" item
 *    (draw with replacement ⇒ independent), converging to `success/total`.
 */
export function runMonteCarlo(spec: MonteCarloSpec, rng: Rng): MonteCarloResult {
  const trials = Math.max(0, Math.min(spec.trials | 0, MAX_TRIALS));
  const runningFrequency: number[] = new Array(trials);
  let successes = 0;

  const isSuccess = successPredicate(spec);
  for (let i = 0; i < trials; i++) {
    if (isSuccess(rng)) successes++;
    runningFrequency[i] = successes / (i + 1);
  }

  return {
    runningFrequency,
    final: trials > 0 ? runningFrequency[trials - 1] : 0,
  };
}

/** Build the per-trial success test for a spec (each call consumes one draw). */
function successPredicate(spec: MonteCarloSpec): (rng: Rng) => boolean {
  switch (spec.kind) {
    case "coin": {
      const pHeads = spec.params.pHeads ?? 0.5;
      return (rng) => rng.next() < pHeads;
    }
    case "dice": {
      const sides = Math.max(2, spec.params.sides ?? 6);
      const face = spec.params.face ?? sides;
      return (rng) => rng.int(1, sides) === face;
    }
    case "urn": {
      const total = Math.max(1, spec.params.total ?? 2);
      const success = spec.params.success ?? 1;
      return (rng) => rng.int(1, total) <= success;
    }
  }
}
