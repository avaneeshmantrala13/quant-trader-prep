/**
 * THE TRADING FLOOR — the informed-with-noise counterparty.
 *
 * The bot's "information edge" is nothing more than the `fairForFill` we feed to
 * the REUSED `resolveFill` (from `liveMarket.ts`), plus how often it is informed.
 * This is genuine adverse selection, not a scripted rule of thumb:
 *   - informed rounds: the bot prices at `trueFair + N(0, edgeNoiseSd)` — usually
 *     right but not omniscient, so blindly widening to dodge it also costs you
 *     the noise spread;
 *   - uninformed rounds: pure noise flow (`drawNoise`) pays you the spread when
 *     your straddling quote is competitive.
 *
 * The only RNG addition the plan calls for lives here: a Box–Muller `normal`
 * helper (unit-tested for mean/variance), so `@/lib/rng` stays untouched.
 */
import type { Rng } from "@/lib/rng";
import { drawNoise, type Noise } from "@/lib/simulations/liveMarket";
import type { BotConfig } from "./types";

/**
 * A standard-normal → scaled draw via Box–Muller, consuming two uniforms from
 * `rng`. Guards the `log(0)` edge by nudging `u1` off zero. Deterministic given
 * the rng stream.
 */
export function normal(rng: Rng, mean = 0, sd = 1): number {
  let u1 = rng.next();
  const u2 = rng.next();
  if (u1 <= 1e-12) u1 = 1e-12;
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + sd * z;
}

/** One round's drawn counterparty: what `resolveFill` needs to settle the fill. */
export interface Counterparty {
  informed: boolean;
  /** The fair value the counterparty transacts against. */
  fairForFill: number;
  /** Uninformed noise draw (only trades on informed=false rounds). */
  noise: Noise;
}

/**
 * Draw the round's counterparty. Advances `rng` by: one `chance` roll, then
 * either two uniforms (informed → the edge-noise normal) or the `drawNoise`
 * draw (uninformed). `trueFair` is the honest fair the informed bot perturbs.
 */
export function drawCounterparty(
  rng: Rng,
  trueFair: number,
  cfg: BotConfig,
): Counterparty {
  if (rng.chance(cfg.informedProb)) {
    const fairForFill = trueFair + normal(rng, 0, cfg.edgeNoiseSd);
    return { informed: true, fairForFill, noise: { trades: false, buys: false } };
  }
  return {
    informed: false,
    fairForFill: trueFair,
    noise: drawNoise(rng, cfg.noiseProb),
  };
}
