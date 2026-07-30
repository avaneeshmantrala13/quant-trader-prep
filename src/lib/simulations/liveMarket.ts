/**
 * ============================================================================
 *  LIVE MARKET-MAKING SIMULATORS — SHARED SCAFFOLD
 * ============================================================================
 * Pure, deterministic-given-seed primitives shared by the "Trading Desk — Live
 * Markets" group of the Simulations tab: the Basketball book-management sim, the
 * Marble Olympics winner-markets sim, and the ETF Challenge creation/redemption
 * sim. No React / DOM here — just seedable flow, a quoting policy, an
 * adverse-selection fill model, and P&L / drawdown / benchmark scoring, so every
 * run is reproducible and unit-testable (mirrors `games.ts`, `shared.ts`).
 *
 * The pedagogy every sim shares: you post a two-sided quote each round; an
 * INFORMED counterparty picks you off when your quote is on the wrong side of
 * fair value, while UNINFORMED noise flow pays you the spread when your quote is
 * competitive. You are scored on cumulative P&L and max drawdown against a
 * well-defined benchmark maker policy running the SAME event stream.
 */
import { Rng } from "@/lib/rng";

/** A two-sided quote: the price you'll buy at (bid) and sell at (ask). */
export interface Quote {
  bid: number;
  ask: number;
}

/**
 * A market-maker policy — the levers a desk actually tunes:
 *   - `halfSpread`: half the quoted width. Wider ⇒ more edge per fill but less
 *     flow and less adverse-selection risk; too tight ⇒ picked off.
 *   - `skew`: inventory skew. The quote centers at `fair − skew·inventory`, so a
 *     long book (inventory > 0) lowers both quotes to encourage selling.
 *   - `bias`: a deliberate fair-value adjustment (mostly 0; lets a sim expose
 *     the cost of mispricing your mid).
 */
export interface MakerPolicy {
  halfSpread: number;
  skew: number;
  bias?: number;
}

/**
 * Build the two-sided quote a policy posts given the current fair value and
 * inventory. Center = `fair − skew·inventory + bias`; quote = center ± half.
 */
export function makerQuote(
  fair: number,
  inventory: number,
  policy: MakerPolicy,
): Quote {
  const center = fair - policy.skew * inventory + (policy.bias ?? 0);
  return { bid: center - policy.halfSpread, ask: center + policy.halfSpread };
}

/** Which way a single round's fill went (from the MAKER's perspective). */
export type FillSide = "userBuys" | "userSells" | "none";

export interface Fill {
  side: FillSide;
  /** The price the maker transacted at (their bid or ask), 0 when no trade. */
  price: number;
  /** True when the fill was an adverse (informed) pick-off, not noise flow. */
  adverse: boolean;
}

/** Uninformed flow for one round: whether it trades, and which side it takes. */
export interface Noise {
  trades: boolean;
  /** When it trades: true ⇒ it BUYS from the maker (lifts the ask). */
  buys: boolean;
}

/**
 * Resolve one round's single (size-1) fill against a two-sided quote.
 *
 * INFORMED flow knows `fairForFill` and only trades when your quote is on the
 * wrong side of it — lifting your ask when `ask < fair` (you sold too cheap) or
 * hitting your bid when `bid > fair` (you bought too rich). This is adverse
 * selection: you trade precisely when it's bad for you.
 *
 * Otherwise the quote STRADDLES fair (`bid ≤ fair ≤ ask`) and only UNINFORMED
 * noise trades — and only when your quote is COMPETITIVE, i.e. within
 * `noiseMaxHalf` of fair. Too wide a quote wins no flow (returns "none").
 */
export function resolveFill(
  quote: Quote,
  fairForFill: number,
  noise: Noise,
  noiseMaxHalf: number,
): Fill {
  // Informed pick-offs (mutually exclusive since ask > bid).
  if (quote.ask < fairForFill) {
    return { side: "userSells", price: quote.ask, adverse: true };
  }
  if (quote.bid > fairForFill) {
    return { side: "userBuys", price: quote.bid, adverse: true };
  }
  // Straddle: uninformed noise trades iff the quote is competitive.
  if (noise.trades) {
    if (noise.buys && quote.ask - fairForFill <= noiseMaxHalf) {
      return { side: "userSells", price: quote.ask, adverse: false };
    }
    if (!noise.buys && fairForFill - quote.bid <= noiseMaxHalf) {
      return { side: "userBuys", price: quote.bid, adverse: false };
    }
  }
  return { side: "none", price: 0, adverse: false };
}

/**
 * Draw a round of uninformed noise flow: trades with probability `noiseProb`,
 * and when it does, buys/sells with equal probability. Advances `rng`.
 */
export function drawNoise(rng: Rng, noiseProb: number): Noise {
  const trades = rng.chance(noiseProb);
  return { trades, buys: trades ? rng.chance(0.5) : false };
}

/** Running cumulative sum: `out[i] = Σ xs[0..i]`. Empty input → `[]`. */
export function cumulativeSum(xs: number[]): number[] {
  const out: number[] = new Array(xs.length);
  let sum = 0;
  for (let i = 0; i < xs.length; i++) {
    sum += xs[i];
    out[i] = sum;
  }
  return out;
}

/**
 * Maximum drawdown of an equity curve: the largest peak-to-trough drop, always
 * `≥ 0`. Empty input → 0. (Absolute currency units, not a percentage — equity
 * can be negative here, so a ratio would be ill-defined.)
 */
export function maxDrawdown(equity: number[]): number {
  let peak = -Infinity;
  let mdd = 0;
  for (const v of equity) {
    if (v > peak) peak = v;
    const dd = peak - v;
    if (dd > mdd) mdd = dd;
  }
  return equity.length > 0 ? mdd : 0;
}

/** Grade of a maker run versus its benchmark policy. */
export interface BenchmarkGrade {
  /** userFinal − benchFinal (currency). Positive ⇒ you beat the desk. */
  delta: number;
  /** userFinal / benchFinal as a percentage when the benchmark made money. */
  pct: number;
  /** A short, human-readable verdict. */
  label: string;
}

/**
 * Score a maker's final P&L against the benchmark's. `pct` is the share of the
 * benchmark's profit captured (100% ⇒ matched the desk). The label is a compact
 * verdict spanning "picked off"/"leaking edge" up to "you beat the desk".
 */
export function gradeVsBenchmark(
  userFinal: number,
  benchFinal: number,
): BenchmarkGrade {
  const delta = userFinal - benchFinal;
  const pct =
    benchFinal > 0
      ? (userFinal / benchFinal) * 100
      : userFinal >= 0
        ? 100
        : 0;
  let label: string;
  if (userFinal <= 0) label = "Losing money — you're being picked off";
  else if (delta >= 0) label = "You beat the desk benchmark";
  else if (pct >= 75) label = "Solid — nearly matched the desk";
  else if (pct >= 40) label = "Profitable, but leaking edge to the desk";
  else label = "Thin edge — well behind the desk";
  return { delta, pct, label };
}

/** Common result shape every live-market run returns (sims extend it). */
export interface LiveRunResult {
  /** Number of rounds simulated. */
  rounds: number;
  /** Cumulative maker P&L after each round (length `rounds`). */
  userPnl: number[];
  /** Cumulative benchmark-policy P&L on the SAME stream (length `rounds`). */
  benchPnl: number[];
  /** Maker final cumulative P&L. */
  userFinal: number;
  /** Benchmark final cumulative P&L. */
  benchFinal: number;
  /** Maker max drawdown over the run (currency units, ≥ 0). */
  userMaxDrawdown: number;
  /** Rounds in which the maker traded at all. */
  fills: number;
  /** Rounds in which the maker was adversely (informed) picked off. */
  pickedOff: number;
}
