/**
 * ============================================================================
 *  MARBLE OLYMPICS — LIVE WINNER-MARKETS SIMULATOR (pure model)
 * ============================================================================
 * Correlated "who wins?" markets across a run of marble races. Each race has
 * `marbles` mutually-exclusive competitors with EXACT true win probabilities
 * (rationals summing to 1, via `fraction.js`). Each race you post a two-sided
 * market on every marble's winner contract (pays 1 if it wins, else 0), then a
 * winner is drawn and the contracts settle.
 *
 * Two counterparties trade against your book:
 *   • a per-leg INFORMED trader who picks off any single marble you misprice,
 *     plus uninformed noise that pays you the spread when you're competitive;
 *   • a book ARBITRAGEUR who, whenever your quotes admit a Dutch book (Σ asks
 *     < 1, or Σ bids > 1), trades your whole book for a RISK-FREE profit at your
 *     expense — exactly the overround/de-vig mechanic, made live.
 *
 * The single most important defense is RENORMALIZING your book so the mids sum
 * to 1 (de-vigging your own quotes): that GUARANTEES `Σ ask ≥ 1` and
 * `Σ bid ≤ 1`, so no Dutch book can ever be lifted off you. You are scored on
 * cumulative P&L vs the ARBITRAGE-FREE benchmark book (true probs ± a house
 * vig) run over the identical race + flow stream.
 *
 * True probabilities and the arb-free proof use exact rationals; streaming P&L
 * is plain floating point (fine for display).
 */
import Fraction from "fraction.js";
import { Rng } from "@/lib/rng";
import {
  drawNoise,
  maxDrawdown,
  resolveFill,
  type LiveRunResult,
  type Noise,
} from "./liveMarket";

export interface MarbleConfig {
  /** Number of competitors per race (mutually-exclusive winner outcomes). */
  marbles: number;
  /** Number of races in the run. */
  rounds: number;
  /** Probability an uninformed trade arrives on a given leg in a race. */
  noiseProb: number;
  /** Widest half-spread that still wins noise flow on a leg. */
  noiseMaxHalf: number;
  /** Magnitude of the maker's per-leg probability MIS-estimate (±). */
  estNoise: number;
  /** The arbitrage-free benchmark book's half-spread (the house vig). */
  benchHalf: number;
}

export interface MarblePolicy {
  /** Half the quoted width on each leg. */
  halfSpread: number;
  /**
   * Renormalize the book so the maker's mids sum to exactly 1 before quoting
   * (de-vig your own quotes). When true, the book is PROVABLY arbitrage-free;
   * when false, a mis-estimated book can leak a Dutch book to the arbitrageur.
   */
  normalize: boolean;
}

export const DEFAULT_MARBLE_CONFIG: MarbleConfig = {
  marbles: 4,
  rounds: 200,
  noiseProb: 0.9,
  noiseMaxHalf: 0.08,
  estNoise: 0.05,
  benchHalf: 0.04,
};

/**
 * EXACT true win probabilities for the marbles — random integer weights
 * normalized to rationals that sum to exactly 1 (`Σ pᵢ = 1` as a Fraction).
 * Deterministic given the seed.
 */
export function trueProbabilities(
  config: MarbleConfig,
  seed: number,
): Fraction[] {
  const rng = new Rng(seed);
  const weights: number[] = [];
  for (let i = 0; i < config.marbles; i++) weights.push(rng.int(1, 6));
  const total = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => new Fraction(w, total));
}

/**
 * A book is arbitrage-free for winner contracts iff you cannot buy the whole
 * set for less than its guaranteed payout of 1 (`Σ ask ≥ 1`) and cannot sell
 * the whole set for more than 1 (`Σ bid ≤ 1`). Either violation is a Dutch book.
 */
export function bookIsArbitrageFree(bids: number[], asks: number[]): boolean {
  const sumAsk = asks.reduce((a, b) => a + b, 0);
  const sumBid = bids.reduce((a, b) => a + b, 0);
  // Tiny epsilon to absorb floating-point noise on an exactly-fair book.
  const eps = 1e-9;
  return sumAsk >= 1 - eps && sumBid <= 1 + eps;
}

export interface MarbleRunResult extends LiveRunResult {
  /** Exact true win probabilities of the marbles (Σ = 1). */
  trueProbs: number[];
  /** Races in which a Dutch book was lifted off the maker (guaranteed loss). */
  bookLeaks: number;
}

interface RaceRandomness {
  winner: number;
  beliefNoise: number[];
  legNoise: Noise[];
}

interface PolicyTrace {
  pnl: number[];
  fills: number;
  pickedOff: number;
  bookLeaks: number;
}

/** Clamp a probability estimate to a sane open interval. */
function clampProb(x: number): number {
  return Math.min(0.999, Math.max(0.001, x));
}

/**
 * Compute a maker's quoted mids for a race from the true probs + this race's
 * belief noise, honoring the normalize toggle. The benchmark passes
 * `beliefNoise` all-zero and `normalize = true`, i.e. it quotes the true
 * (arbitrage-free) probabilities.
 */
function makerMids(
  probs: number[],
  beliefNoise: number[],
  normalize: boolean,
): number[] {
  const raw = probs.map((p, i) => clampProb(p + beliefNoise[i]));
  if (!normalize) return raw;
  const total = raw.reduce((a, b) => a + b, 0);
  return raw.map((r) => r / total);
}

/** Resolve a single race for one policy; returns the round's realized P&L. */
function resolveRace(
  mids: number[],
  halfSpread: number,
  probs: number[],
  rr: RaceRandomness,
  noiseMaxHalf: number,
): { pnl: number; fills: number; pickedOff: number; leaked: boolean } {
  const asks = mids.map((m) => m + halfSpread);
  const bids = mids.map((m) => m - halfSpread);
  const sumAsk = asks.reduce((a, b) => a + b, 0);
  const sumBid = bids.reduce((a, b) => a + b, 0);

  let pnl = 0;
  let fills = 0;
  let pickedOff = 0;
  let leaked = false;

  // Book arbitrageur: a Dutch book settles to exactly 1 regardless of winner.
  if (sumAsk < 1 - 1e-9) {
    pnl += sumAsk - 1; // arb buys the whole book off you at your asks
    leaked = true;
  } else if (sumBid > 1 + 1e-9) {
    pnl += 1 - sumBid; // arb sells you the whole book at your bids
    leaked = true;
  }

  // Per-leg informed / noise flow, settled at the realized winner.
  for (let i = 0; i < mids.length; i++) {
    const fair = probs[i];
    const fill = resolveFill(
      { bid: bids[i], ask: asks[i] },
      fair,
      rr.legNoise[i],
      noiseMaxHalf,
    );
    const payoff = i === rr.winner ? 1 : 0;
    if (fill.side === "userSells") {
      pnl += fill.price - payoff; // received premium, owe the payout
      fills++;
      if (fill.adverse) pickedOff++;
    } else if (fill.side === "userBuys") {
      pnl += payoff - fill.price; // paid premium, collect the payout
      fills++;
      if (fill.adverse) pickedOff++;
    }
  }
  return { pnl, fills, pickedOff, leaked };
}

function runPolicy(
  probs: number[],
  beliefNoiseZeroed: boolean,
  normalize: boolean,
  halfSpread: number,
  races: RaceRandomness[],
  config: MarbleConfig,
): PolicyTrace {
  const roundPnl: number[] = new Array(races.length);
  let fills = 0;
  let pickedOff = 0;
  let bookLeaks = 0;
  for (let t = 0; t < races.length; t++) {
    const rr = races[t];
    const beliefNoise = beliefNoiseZeroed
      ? probs.map(() => 0)
      : rr.beliefNoise;
    const mids = makerMids(probs, beliefNoise, normalize);
    const r = resolveRace(mids, halfSpread, probs, rr, config.noiseMaxHalf);
    roundPnl[t] = r.pnl;
    fills += r.fills;
    pickedOff += r.pickedOff;
    if (r.leaked) bookLeaks++;
  }
  // Running cumulative P&L.
  const pnl: number[] = new Array(roundPnl.length);
  let sum = 0;
  for (let t = 0; t < roundPnl.length; t++) {
    sum += roundPnl[t];
    pnl[t] = sum;
  }
  return { pnl, fills, pickedOff, bookLeaks };
}

/**
 * Simulate a full Marble Olympics run for a maker `policy` and `seed`. The true
 * probabilities, per-race winner, per-leg belief noise, and per-leg flow are
 * drawn once and REPLAYED for both the maker and the arbitrage-free benchmark
 * book, so the two are compared on identical races.
 */
export function runMarbleOlympics(
  policy: MarblePolicy,
  seed: number,
  config: MarbleConfig = DEFAULT_MARBLE_CONFIG,
): MarbleRunResult {
  const probsFrac = trueProbabilities(config, seed);
  const probs = probsFrac.map((p) => p.valueOf());
  const rng = new Rng(seed ^ 0x9e3779b9); // decorrelate from weight draws

  const R = Math.max(0, config.rounds);
  const races: RaceRandomness[] = new Array(R);
  // Cumulative distribution for winner sampling.
  const cdf: number[] = [];
  let acc = 0;
  for (const p of probs) {
    acc += p;
    cdf.push(acc);
  }
  for (let t = 0; t < R; t++) {
    const u = rng.next();
    let winner = probs.length - 1;
    for (let i = 0; i < cdf.length; i++) {
      if (u <= cdf[i]) {
        winner = i;
        break;
      }
    }
    const beliefNoise = probs.map(
      () => (rng.next() * 2 - 1) * config.estNoise,
    );
    const legNoise: Noise[] = probs.map(() => drawNoise(rng, config.noiseProb));
    races[t] = { winner, beliefNoise, legNoise };
  }

  const user = runPolicy(
    probs,
    false,
    policy.normalize,
    policy.halfSpread,
    races,
    config,
  );
  // Benchmark = the arbitrage-free book: true probs (no belief noise),
  // normalized, quoting the house vig `benchHalf`.
  const bench = runPolicy(probs, true, true, config.benchHalf, races, config);

  return {
    rounds: R,
    userPnl: user.pnl,
    benchPnl: bench.pnl,
    userFinal: R > 0 ? user.pnl[R - 1] : 0,
    benchFinal: R > 0 ? bench.pnl[R - 1] : 0,
    userMaxDrawdown: maxDrawdown(user.pnl),
    fills: user.fills,
    pickedOff: user.pickedOff,
    trueProbs: probs,
    bookLeaks: user.bookLeaks,
  };
}
