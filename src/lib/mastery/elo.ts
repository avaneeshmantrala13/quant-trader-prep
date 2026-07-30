import type { Difficulty } from "@/types/content";
import { ELO_A, ELO_B, ELO_KD, TIER_FREEZE_N, TIER_SEED } from "./config";

/**
 * Guessing-corrected Elo for education (Pelánek 2016; Klinkenberg et al. 2011,
 * Math Garden). θ is per-topic skill on the logit scale; d[topic,τ] is the
 * per-tier difficulty. The learning-rate K_s(n) shrinks with exposures so early
 * answers move θ fast and it settles as evidence accrues (Pelánek's uncertainty
 * function). d moves opposite to the learner (it "learns" its own difficulty)
 * and is frozen once well-estimated to keep the scale stable.
 */

/** σ(x) = 1/(1+e^-x). */
export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/**
 * Guessing-corrected predicted success (Pelánek 2016).
 *  - MCQ (k options): P = 1/k + (1 − 1/k)·σ(θ − d).
 *  - Numeric / no-guess (kOptions undefined or ≤ 0): P = σ(θ − d).
 */
export function predictSuccess(
  theta: number,
  d: number,
  kOptions?: number,
): number {
  const base = sigmoid(theta - d);
  if (kOptions !== undefined && kOptions > 0) {
    const g = 1 / kOptions;
    return g + (1 - g) * base;
  }
  return base;
}

/** Learning-rate / uncertainty function K_s(n) = ELO_A / (1 + ELO_B·n). */
export function learningRateK(n: number): number {
  return ELO_A / (1 + ELO_B * n);
}

/**
 * One Elo step. `n` is items answered BEFORE this one; `dExposures` is how many
 * times this (topic,tier) has been seen (drives the freeze).
 *   θ += K_s(n)·(y − P)
 *   d += K_d·(P − y)   [frozen once dExposures ≥ TIER_FREEZE_N]
 *
 * `y` is the actual SCORE S ∈ [0,1] (Pelánek 2016 uses S directly). Binary
 * outcomes pass 0/1 as before; the free-response hint-attempt flow passes the
 * FRACTIONAL partial credit from `creditSchedule.ts` — the Elo update is the
 * same expression either way, so partial credit "just works" (PHASE_1).
 */
export function updateElo(args: {
  theta: number;
  d: number;
  y: number;
  kOptions?: number;
  n: number;
  dExposures: number;
}): { theta: number; d: number } {
  const { theta, d, y, kOptions, n, dExposures } = args;
  const p = predictSuccess(theta, d, kOptions);
  const nextTheta = theta + learningRateK(n) * (y - p);
  const nextD = dExposures >= TIER_FREEZE_N ? d : d + ELO_KD * (p - y);
  return { theta: nextTheta, d: nextD };
}

/** Seed d[topic,τ] on the Difficulty ladder when unseen (TIER_SEED, monotone). */
export function seedTierDifficulty(tier: Difficulty): number {
  return TIER_SEED[tier];
}
