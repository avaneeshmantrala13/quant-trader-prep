import Fraction from "fraction.js";

/**
 * Exact solvers for the Dataset-1 "trading game" mechanics that reduce to
 * skills our exact-verifier engine already models. ALL probability / odds /
 * pricing math is done with exact rationals (`fraction.js`), never floating
 * point, so every ground-truth answer is an exact rational and every dollar
 * figure is exact.
 *
 * Families (see datasets/quant-interview-games-mechanics.md):
 *   - Next-Card betting  → conditional fair probability of the next draw.
 *   - Vig / overround    → strip the bookmaker's overround to fair probs;
 *                          detect a Dutch-book arbitrage.
 *   - Basket / ETF NAV   → price a basket as a weighted sum; ETF-vs-NAV arb.
 *   - Make-a-Market      → expected adverse-selection P&L of a two-sided quote.
 */

/** Convenience Fraction constructor. */
export const F = (n: number | string, d?: number): Fraction =>
  d === undefined ? new Fraction(n as never) : new Fraction(n as never, d);

/* -------------------------------------------------------------------------- */
/*  Next-Card betting, conditional probability of the next draw               */
/* -------------------------------------------------------------------------- */

/**
 * P(next card is a "hit") when `hits` favorable and `miss` unfavorable cards
 * remain in the deck: hits / (hits + miss). This is the sequential/updating
 * probability. NOT the original 26/52 = 1/2 of a full deck.
 */
export function nextHitProb(hits: number, miss: number): Fraction {
  return F(hits, hits + miss);
}

/** Fair price (in the ticket's payout units) of a bet paying `payout` on a hit. */
export function nextCardFairPrice(
  hits: number,
  miss: number,
  payout: number,
): Fraction {
  return nextHitProb(hits, miss).mul(payout);
}

/* -------------------------------------------------------------------------- */
/*  Vig / overround, de-vigging a book & Dutch-book detection                 */
/* -------------------------------------------------------------------------- */

/** Implied probability of a leg quoted at decimal odds `o`: 1/o. */
export function impliedFromDecimal(oddsStr: string): Fraction {
  return F(1).div(F(oddsStr));
}

/**
 * Book sum (a.k.a. overround + 1): Σ 1/oᵢ over all mutually-exclusive,
 * exhaustive legs. > 1 ⇒ bookmaker edge (vig); < 1 ⇒ Dutch-book arbitrage.
 */
export function booksum(oddsStrs: string[]): Fraction {
  return oddsStrs.reduce((s, o) => s.add(impliedFromDecimal(o)), F(0));
}

/**
 * De-vigged (arbitrage-free) fair probability of leg `idx`:
 * (1/oᵢ) / Σ(1/oⱼ), normalize the raw implied probs so they sum to 1.
 */
export function deVigFairProb(oddsStrs: string[], idx: number): Fraction {
  return impliedFromDecimal(oddsStrs[idx]).div(booksum(oddsStrs));
}

/** True iff the quoted book admits a guaranteed-profit (Dutch-book) arbitrage. */
export function hasArbitrage(oddsStrs: string[]): boolean {
  return booksum(oddsStrs).valueOf() < 1;
}

/* -------------------------------------------------------------------------- */
/*  Basket / ETF NAV, weighted-sum pricing                                    */
/* -------------------------------------------------------------------------- */

export interface BasketLeg {
  qty: number;
  price: number;
  label: string;
}

/** Net asset value = Σ qtyᵢ · priceᵢ (exact integer for integer inputs). */
export function basketNAV(legs: BasketLeg[]): number {
  return legs.reduce((s, l) => s + l.qty * l.price, 0);
}

/* -------------------------------------------------------------------------- */
/*  Make-a-Market, expected adverse-selection P&L of a two-sided quote        */
/* -------------------------------------------------------------------------- */

/**
 * Expected P&L per round of posting bid `bid` / ask `ask` on a value uniform on
 * {1..N} against an INFORMED counterparty who knows V:
 *   - sells to you at `bid` when V < bid  → your P&L = V − bid  (< 0)
 *   - buys from you at `ask` when V > ask → your P&L = ask − V  (< 0)
 *   - otherwise no trade                  → 0
 * Returns an exact (non-positive) Fraction. This is adverse selection: you only
 * trade when it is bad for you.
 */
export function adverseSelectionEV(N: number, bid: number, ask: number): Fraction {
  let sum = F(0);
  for (let V = 1; V <= N; V++) {
    if (V < bid) sum = sum.add(F(V - bid));
    else if (V > ask) sum = sum.add(F(ask - V));
  }
  return sum.div(N);
}

/* -------------------------------------------------------------------------- */
/*  Formatting                                                                 */
/* -------------------------------------------------------------------------- */

/** Round a Fraction to `dp` decimals as a Number (for numeric-mode answers). */
export function fracToRounded(f: Fraction, dp = 4): number {
  return Number(f.valueOf().toFixed(dp));
}

/** Signed dollar string, e.g. "+$1.20", "−$1.20", "$0.00" (2 dp). */
export function signedDollar(n: number): string {
  const v = Number(n.toFixed(2));
  if (v === 0) return "$0.00";
  const sign = v > 0 ? "+" : "−";
  return `${sign}$${Math.abs(v).toFixed(2)}`;
}
