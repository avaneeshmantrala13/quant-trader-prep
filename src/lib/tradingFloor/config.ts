/**
 * THE TRADING FLOOR — difficulty presets + the local-PB / leaderboard bucket
 * hash. Tuned in the spirit of `arena/config.ts`: Warm-up is forgiving (honest
 * quoting easily beats the desk), Interview is the Case-B default, Superday is
 * unforgiving (a picky informed bot that also peeks one reveal ahead).
 */
import type { FloorConfig } from "./types";

/** Board id used for the always-on local personal-best store. */
export const FLOOR_BOARD = "trading-floor";

/** Topic key the Floor writes its binary calibration pairs under. */
export const FLOOR_TOPIC_KEY = "trading-floor";

/**
 * Warm-up: mostly noise flow (informed only 25% of rounds), a noisy informed
 * edge, generous noise tolerance, no lookahead. Honest quoting is paid.
 */
export const WARMUP: FloorConfig = {
  id: "warmup",
  label: "Warm-up",
  bot: {
    informedProb: 0.25,
    edgeNoiseSd: 0.9,
    noiseProb: 0.85,
    noiseMaxHalf: 0.6,
    lookahead: 0,
  },
  maxSize: 5,
  shotClockMs: 25_000,
  benchSkew: 0,
};

/** Interview: an even informed/uninformed mix — the default Case-B experience. */
export const INTERVIEW: FloorConfig = {
  id: "interview",
  label: "Interview",
  bot: {
    informedProb: 0.5,
    edgeNoiseSd: 0.5,
    noiseProb: 0.7,
    noiseMaxHalf: 0.4,
    lookahead: 0,
  },
  maxSize: 5,
  shotClockMs: 20_000,
  benchSkew: 0,
};

/** Superday: a picky, low-noise informed bot that peeks one reveal ahead. */
export const SUPERDAY: FloorConfig = {
  id: "superday",
  label: "Superday",
  bot: {
    informedProb: 0.75,
    edgeNoiseSd: 0.28,
    noiseProb: 0.55,
    noiseMaxHalf: 0.28,
    lookahead: 1,
  },
  maxSize: 8,
  shotClockMs: 15_000,
  benchSkew: 0,
};

export const FLOOR_CONFIGS: FloorConfig[] = [WARMUP, INTERVIEW, SUPERDAY];

/** Look up a preset by id (defaults to Interview). */
export function floorConfigById(id: string): FloorConfig {
  return FLOOR_CONFIGS.find((c) => c.id === id) ?? INTERVIEW;
}

/**
 * Stable, order-independent bucket key so only comparable runs are ranked
 * together: `(packId, configId, rounds)` plus the score-affecting bot levers.
 * Pure and deterministic (a bucketing key, not a security token).
 */
export function floorConfigHash(
  packId: string,
  config: FloorConfig,
  rounds: number,
): string {
  const b = config.bot;
  return [
    packId,
    config.id,
    `n${rounds}`,
    `ip${b.informedProb}`,
    `es${b.edgeNoiseSd}`,
    `np${b.noiseProb}`,
    `nh${b.noiseMaxHalf}`,
    `la${b.lookahead}`,
    `ms${config.maxSize}`,
  ].join("|");
}
