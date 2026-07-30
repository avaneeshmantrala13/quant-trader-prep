/**
 * ============================================================================
 *  BASKETBALL — LIVE BOOK-MANAGEMENT SIMULATOR (pure model)
 * ============================================================================
 * A streaming, path-dependent market-making game. A basketball game unfolds
 * over `rounds` scoring possessions; you continuously make a two-sided market
 * on the FINAL total points and manage the resulting inventory + P&L.
 *
 * The fair value of the final total, entering round r, is
 *   fair(r) = knownScore + remainingRounds · meanPointsPerRound,
 * i.e. the points already on the board plus the expected points still to come
 * (a martingale — it drifts only with the surprise in each possession). This
 * expected-remaining term is computed EXACTLY with `fraction.js` (meanPoints can
 * be a half-integer), so the benchmark's fair value is exact; streaming P&L is
 * plain floating point, which is fine for display.
 *
 * You are scored on cumulative P&L and max drawdown against a benchmark desk
 * maker running the SAME game + noise stream. Lessons: (1) tighten your spread
 * to earn the noise spread, but not so tight/mispriced that informed flow picks
 * you off; (2) carrying inventory while the fair value swings is what creates
 * drawdown — skew your quotes to flatten the book.
 */
import Fraction from "fraction.js";
import { Rng } from "@/lib/rng";
import {
  cumulativeSum,
  drawNoise,
  makerQuote,
  maxDrawdown,
  resolveFill,
  type LiveRunResult,
  type MakerPolicy,
  type Noise,
} from "./liveMarket";

export interface BasketballConfig {
  /** Scoring possessions in the game. */
  rounds: number;
  /** Points scored on a possession are uniform on [minPts, maxPts]. */
  minPts: number;
  maxPts: number;
  /** Probability an uninformed trade arrives in a round. */
  noiseProb: number;
  /** Widest half-spread that still wins noise flow (competitiveness band). */
  noiseMaxHalf: number;
  /** The benchmark desk maker's policy. */
  benchPolicy: MakerPolicy;
}

export const DEFAULT_BASKETBALL_CONFIG: BasketballConfig = {
  rounds: 120,
  minPts: 0,
  maxPts: 4,
  noiseProb: 0.85,
  noiseMaxHalf: 3,
  benchPolicy: { halfSpread: 2, skew: 0.25 },
};

/** Exact mean points per possession, `(min + max) / 2`, as a rational. */
export function meanPointsPerRound(config: BasketballConfig): Fraction {
  return new Fraction(config.minPts + config.maxPts, 2);
}

/**
 * EXACT fair value of the final total entering round `r` (0-indexed), given the
 * `knownScore` already on the board and `rounds` total possessions:
 *   knownScore + (rounds − r) · meanPointsPerRound.
 * Uses `fraction.js` so the expected-remaining term is exact.
 */
export function fairEnteringRound(
  knownScore: number,
  r: number,
  config: BasketballConfig,
): Fraction {
  const remaining = config.rounds - r;
  return meanPointsPerRound(config).mul(remaining).add(knownScore);
}

export interface BasketballRunResult extends LiveRunResult {
  /** The realized final total points of the game. */
  finalTotal: number;
  /** Cumulative score after each possession (length `rounds`). */
  scorePath: number[];
  /** Fair value of the final total entering each round (length `rounds`). */
  fairPath: number[];
  /** Maker inventory (net contracts on the final total) after each round. */
  userInventory: number[];
  /** Benchmark inventory after each round. */
  benchInventory: number[];
}

interface PolicyTrace {
  pnl: number[];
  inventory: number[];
  fills: number;
  pickedOff: number;
}

/**
 * Run a single policy over a pre-drawn possession stream (`pts`) and noise
 * stream (`noises`). Returns the round-by-round cumulative P&L and inventory.
 *
 * Timeline per round r: quote on the final total around `fair(r)` → a fill may
 * happen at `fair(r)` → the possession scores `pts[r]` → inventory is marked at
 * the UPDATED fair (`fair(r+1)`), which at the last round equals the final
 * total. So the mark-to-market P&L already settles the book at game end.
 */
function runPolicy(
  policy: MakerPolicy,
  pts: number[],
  noises: Noise[],
  config: BasketballConfig,
): PolicyTrace {
  const R = pts.length;
  const mean = meanPointsPerRound(config).valueOf();
  let cash = 0;
  let inv = 0;
  let cumScore = 0;
  const pnl: number[] = new Array(R);
  const inventory: number[] = new Array(R);
  let fills = 0;
  let pickedOff = 0;

  for (let r = 0; r < R; r++) {
    const knownScore = cumScore;
    const fair = knownScore + (R - r) * mean;
    const quote = makerQuote(fair, inv, policy);
    const fill = resolveFill(quote, fair, noises[r], config.noiseMaxHalf);
    if (fill.side === "userSells") {
      cash += fill.price;
      inv -= 1;
      fills++;
      if (fill.adverse) pickedOff++;
    } else if (fill.side === "userBuys") {
      cash -= fill.price;
      inv += 1;
      fills++;
      if (fill.adverse) pickedOff++;
    }
    // The possession scores; mark the book at the updated fair value.
    cumScore += pts[r];
    const fairMark = cumScore + (R - r - 1) * mean;
    pnl[r] = cash + inv * fairMark;
    inventory[r] = inv;
  }
  return { pnl, inventory, fills, pickedOff };
}

/**
 * Simulate a full basketball book-management game for a maker `policy` and
 * `seed`. Deterministic given the seed: the possession points and the noise
 * flow are drawn once and REPLAYED for both the maker and the benchmark desk,
 * so the two are compared on an identical game.
 */
export function runBasketball(
  policy: MakerPolicy,
  seed: number,
  config: BasketballConfig = DEFAULT_BASKETBALL_CONFIG,
): BasketballRunResult {
  const rng = new Rng(seed);
  const R = Math.max(0, config.rounds);

  const pts: number[] = new Array(R);
  const noises: Noise[] = new Array(R);
  for (let r = 0; r < R; r++) pts[r] = rng.int(config.minPts, config.maxPts);
  // Noise is drawn AFTER the whole point path so both policies see the same
  // stream regardless of how many RNG calls a policy would otherwise consume.
  for (let r = 0; r < R; r++) noises[r] = drawNoise(rng, config.noiseProb);

  const mean = meanPointsPerRound(config).valueOf();
  const scorePath: number[] = new Array(R);
  const fairPath: number[] = new Array(R);
  let cum = 0;
  for (let r = 0; r < R; r++) {
    fairPath[r] = cum + (R - r) * mean;
    cum += pts[r];
    scorePath[r] = cum;
  }
  const finalTotal = cum;

  const user = runPolicy(policy, pts, noises, config);
  const bench = runPolicy(config.benchPolicy, pts, noises, config);

  return {
    rounds: R,
    userPnl: user.pnl,
    benchPnl: bench.pnl,
    userFinal: R > 0 ? user.pnl[R - 1] : 0,
    benchFinal: R > 0 ? bench.pnl[R - 1] : 0,
    userMaxDrawdown: maxDrawdown(user.pnl),
    fills: user.fills,
    pickedOff: user.pickedOff,
    finalTotal,
    scorePath,
    fairPath,
    userInventory: user.inventory,
    benchInventory: bench.inventory,
  };
}

/** Sanity helper for the UI: cumulative points, exposed for the score readout. */
export { cumulativeSum };
