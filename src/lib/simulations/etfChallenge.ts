/**
 * ============================================================================
 *  ETF CHALLENGE — LIVE CREATION/REDEMPTION SIMULATOR (pure model)
 * ============================================================================
 * You make a two-sided market on an ETF while its `components` random-walk. The
 * ETF's fair value is its NAV = Σ sharesᵢ · priceᵢ — an EXACT integer weighted
 * sum (integer share weights and prices), so NAV is computed exactly; streaming
 * P&L is plain floating point.
 *
 * The twist is LATENCY: you quote off the NAV you can SEE now, but your fills
 * resolve against the NAV AFTER the components tick. So a creation/redemption
 * ARBITRAGEUR (who trades the real, post-move NAV) picks you off whenever your
 * quote is stale — lifting your ETF when you're cheap vs NAV (they redeem into
 * components), hitting it when you're rich (they create from components). The
 * core lesson: your spread must be wide enough to COVER the NAV move over your
 * latency window; too tight and you're arbitraged, too wide and you win no
 * flow. Carried ETF inventory marked at a moving NAV is what drives drawdown —
 * skew your quotes to keep the book flat.
 *
 * Scored on cumulative P&L and max drawdown vs a benchmark desk maker (a spread
 * sized to the component volatility) running the identical price + flow stream.
 */
import { Rng } from "@/lib/rng";
import {
  drawNoise,
  makerQuote,
  maxDrawdown,
  resolveFill,
  type LiveRunResult,
  type MakerPolicy,
  type Noise,
} from "./liveMarket";

export interface EtfConfig {
  /** Number of component stocks in the basket. */
  components: number;
  /** Trading rounds in the session. */
  rounds: number;
  /** Starting price of every component. */
  startPrice: number;
  /** Per-component per-round move magnitude (a "tick"). */
  tickSize: number;
  /** Probability a given component moves in a round (else it stays flat). */
  moveProb: number;
  /** Integer share weight of each component in one creation unit. */
  shares: number[];
  /** Probability an uninformed ETF trade arrives in a round. */
  noiseProb: number;
  /** Widest half-spread that still wins noise flow. */
  noiseMaxHalf: number;
  /** The benchmark desk maker's policy (spread sized to NAV volatility). */
  benchPolicy: MakerPolicy;
}

export const DEFAULT_ETF_CONFIG: EtfConfig = {
  components: 3,
  rounds: 140,
  startPrice: 50,
  tickSize: 1,
  moveProb: 0.8,
  shares: [1, 1, 1],
  noiseProb: 0.85,
  noiseMaxHalf: 3.5,
  benchPolicy: { halfSpread: 2, skew: 0.3 },
};

/** EXACT ETF net asset value: `Σ sharesᵢ · priceᵢ` (integer weighted sum). */
export function nav(prices: number[], shares: number[]): number {
  let total = 0;
  for (let i = 0; i < prices.length; i++) total += shares[i] * prices[i];
  return total;
}

export interface EtfRunResult extends LiveRunResult {
  /** NAV at the start of each round (the value the maker prices off). */
  navSeen: number[];
  /** NAV after each round's component moves (fills + marks settle here). */
  navFill: number[];
  /** Maker ETF inventory after each round. */
  userInventory: number[];
  /** Benchmark ETF inventory after each round. */
  benchInventory: number[];
}

interface PolicyTrace {
  pnl: number[];
  inventory: number[];
  fills: number;
  pickedOff: number;
}

/**
 * Run one policy over a NAV path. The maker quotes around `navSeen[r]` but the
 * fill + mark use `navFill[r]` (the post-move NAV), so a spread that fails to
 * cover the NAV move over the latency window gets arbitraged.
 */
function runPolicy(
  policy: MakerPolicy,
  navSeen: number[],
  navFill: number[],
  noises: Noise[],
  config: EtfConfig,
): PolicyTrace {
  const R = navSeen.length;
  let cash = 0;
  let inv = 0;
  const pnl: number[] = new Array(R);
  const inventory: number[] = new Array(R);
  let fills = 0;
  let pickedOff = 0;

  for (let r = 0; r < R; r++) {
    const quote = makerQuote(navSeen[r], inv, policy);
    const fair = navFill[r];
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
    pnl[r] = cash + inv * fair;
    inventory[r] = inv;
  }
  return { pnl, inventory, fills, pickedOff };
}

/**
 * Simulate a full ETF Challenge session for a maker `policy` and `seed`. The
 * component price path and the noise flow are drawn once and REPLAYED for both
 * the maker and the benchmark desk, so they trade the identical market.
 */
export function runEtfChallenge(
  policy: MakerPolicy,
  seed: number,
  config: EtfConfig = DEFAULT_ETF_CONFIG,
): EtfRunResult {
  const rng = new Rng(seed);
  const R = Math.max(0, config.rounds);
  const M = config.components;

  // Component price path of length R + 1: prices[t] is the price BEFORE round t
  // ticks; prices[R] is the final (settlement) price vector.
  const prices: number[][] = new Array(R + 1);
  prices[0] = new Array(M).fill(config.startPrice);
  for (let t = 1; t <= R; t++) {
    const prev = prices[t - 1];
    const cur = prev.slice();
    for (let i = 0; i < M; i++) {
      if (rng.chance(config.moveProb)) {
        const dir = rng.chance(0.5) ? 1 : -1;
        cur[i] = Math.max(config.tickSize, prev[i] + dir * config.tickSize);
      }
    }
    prices[t] = cur;
  }

  const navPath: number[] = prices.map((p) => nav(p, config.shares));
  const navSeen: number[] = new Array(R);
  const navFill: number[] = new Array(R);
  for (let r = 0; r < R; r++) {
    navSeen[r] = navPath[r];
    navFill[r] = navPath[r + 1];
  }

  const noises: Noise[] = new Array(R);
  for (let r = 0; r < R; r++) noises[r] = drawNoise(rng, config.noiseProb);

  const user = runPolicy(policy, navSeen, navFill, noises, config);
  const bench = runPolicy(config.benchPolicy, navSeen, navFill, noises, config);

  return {
    rounds: R,
    userPnl: user.pnl,
    benchPnl: bench.pnl,
    userFinal: R > 0 ? user.pnl[R - 1] : 0,
    benchFinal: R > 0 ? bench.pnl[R - 1] : 0,
    userMaxDrawdown: maxDrawdown(user.pnl),
    fills: user.fills,
    pickedOff: user.pickedOff,
    navSeen,
    navFill,
    userInventory: user.inventory,
    benchInventory: bench.inventory,
  };
}
