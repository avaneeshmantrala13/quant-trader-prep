import Fraction from "fraction.js";

/**
 * Exact, rational solvers for a PURE no-arbitrage / odds-normalization / de-vig
 * REASONING drill. This is a math + logic drill (converting quoted odds to
 * implied probabilities, stripping the vig, and detecting a Dutch-book). NOT a
 * finance lesson. There is deliberately NO put-call-parity / options / synthetic
 * content here; every function below is elementary probability + arithmetic done
 * with EXACT rationals (`fraction.js`) so every ground-truth answer a generator
 * ships is exact-by-construction and re-derivable from the seed alone.
 *
 * Vocabulary used throughout:
 *   - decimal odds `o`      : total return per unit staked (stake included), so a
 *                             winning $1 bet returns $o. Implied prob = 1/o.
 *   - booksum (Σ 1/oᵢ)      : sum of raw implied probs over the mutually-exclusive,
 *                             exhaustive outcomes of ONE book.
 *       booksum < 1  ⇒ ARBITRAGE (Dutch book): back every outcome for a locked
 *                       profit.
 *       booksum > 1  ⇒ OVERROUND: the bookmaker's margin (the "vig"); no arb for
 *                       the bettor.
 *       booksum = 1  ⇒ FAIR: the raw implied probs already sum to 1.
 *   - de-vig / fair prob    : normalize the raw implied probs by the booksum so
 *                             they sum to 1: fairᵢ = (1/oᵢ) / Σ(1/oⱼ).
 */

/** Convenience Fraction constructor (exact; never floating point). */
export const F = (n: number | string, d?: number): Fraction =>
  d === undefined ? new Fraction(n as never) : new Fraction(n as never, d);

/* -------------------------------------------------------------------------- */
/*  Odds-format conversion, decimal / fractional / American moneyline         */
/* -------------------------------------------------------------------------- */

/** The three odds formats a book may be quoted in. */
export type OddsFormat = "decimal" | "fractional" | "moneyline";

/**
 * Fractional odds `a/b` ("a-to-b against") as a DECIMAL-odds Fraction:
 * decimal = a/b + 1 = (a + b) / b. E.g. 5/2 ⇒ 7/2 = 3.5.
 */
export function fractionalToDecimal(a: number, b: number): Fraction {
  return F(a + b, b);
}

/**
 * American moneyline `m` as a DECIMAL-odds Fraction:
 *   positive m (underdog): decimal = 1 + m/100  = (m + 100) / 100
 *   negative m (favorite): decimal = 1 + 100/|m| = (|m| + 100) / |m|
 */
export function moneylineToDecimal(m: number): Fraction {
  if (m > 0) return F(m + 100, 100);
  const a = Math.abs(m);
  return F(a + 100, a);
}

/** Implied probability of a leg quoted at DECIMAL odds `o`: 1/o. */
export function impliedFromDecimal(o: Fraction | string | number): Fraction {
  return F(1).div(o instanceof Fraction ? o : F(o));
}

/** Implied probability of fractional odds `a/b`: b / (a + b). */
export function impliedFromFractional(a: number, b: number): Fraction {
  return F(b, a + b);
}

/** Implied probability of American moneyline `m`. */
export function impliedFromMoneyline(m: number): Fraction {
  return impliedFromDecimal(moneylineToDecimal(m));
}

/* -------------------------------------------------------------------------- */
/*  Booksum, overround, de-vig, the core normalization                        */
/* -------------------------------------------------------------------------- */

/** Coerce a decimal-odds input (string like "1.90", number, or Fraction). */
function dec(o: Fraction | string | number): Fraction {
  return o instanceof Fraction ? o : F(o);
}

/** Book sum Σ 1/oᵢ over all mutually-exclusive, exhaustive legs (exact). */
export function booksum(odds: (Fraction | string | number)[]): Fraction {
  return odds.reduce<Fraction>((s, o) => s.add(impliedFromDecimal(dec(o))), F(0));
}

/** Overround (bookmaker margin) = booksum − 1. Negative ⇒ arbitrage. */
export function overround(odds: (Fraction | string | number)[]): Fraction {
  return booksum(odds).sub(1);
}

/**
 * De-vigged (arbitrage-free) fair probability of leg `idx`:
 * (1/oᵢ) / Σ(1/oⱼ), normalize the raw implied probs so they sum to exactly 1.
 */
export function fairProb(
  odds: (Fraction | string | number)[],
  idx: number,
): Fraction {
  return impliedFromDecimal(dec(odds[idx])).div(booksum(odds));
}

/** All de-vigged fair probabilities, in leg order (they sum to exactly 1). */
export function fairProbs(
  odds: (Fraction | string | number)[],
): Fraction[] {
  const bs = booksum(odds);
  return odds.map((o) => impliedFromDecimal(dec(o)).div(bs));
}

/* -------------------------------------------------------------------------- */
/*  Book state / Dutch-book detection                                          */
/* -------------------------------------------------------------------------- */

/** The three exhaustive states of a book, decided EXACTLY from the booksum. */
export type BookState = "arbitrage" | "overround" | "fair";

/**
 * Classify a book by comparing its EXACT booksum to 1:
 *   < 1 ⇒ "arbitrage" (Dutch book), > 1 ⇒ "overround" (vig), = 1 ⇒ "fair".
 * Uses exact rational comparison, so a book that is fair to the penny is
 * reported as "fair" (not a rounding artifact).
 */
export function bookState(
  odds: (Fraction | string | number)[],
): BookState {
  const cmp = booksum(odds).compare(1);
  if (cmp < 0) return "arbitrage";
  if (cmp > 0) return "overround";
  return "fair";
}

/** True iff the quoted book admits a guaranteed-profit (Dutch-book) arbitrage. */
export function hasArbitrage(
  odds: (Fraction | string | number)[],
): boolean {
  return booksum(odds).compare(1) < 0;
}

/**
 * Expected value per unit staked on a leg with TRUE probability `p` quoted at
 * DECIMAL odds `o`: p·o − 1. Positive ⇒ a value bet (the book pays more than the
 * true chance warrants); negative ⇒ the book has the edge on that leg.
 */
export function betEV(p: Fraction, o: Fraction | string | number): Fraction {
  return p.mul(dec(o)).sub(1);
}

/**
 * Index of the VALUE (mispriced-in-your-favor) leg: the outcome with the highest
 * per-unit EV given your model's true probabilities `probs` against the book's
 * quoted decimal `odds`. It is genuinely a value bet iff its EV is > 0 (check
 * with {@link betEV}). Ties break toward the lower index.
 */
export function valueBetIndex(
  probs: Fraction[],
  odds: (Fraction | string | number)[],
): number {
  let best = 0;
  let bestEV = betEV(probs[0], odds[0]);
  for (let i = 1; i < odds.length; i++) {
    const ev = betEV(probs[i], odds[i]);
    if (ev.compare(bestEV) > 0) {
      bestEV = ev;
      best = i;
    }
  }
  return best;
}

/** Index of the shortest-odds (book's favorite) leg, the highest implied prob. */
export function favoriteIndex(
  odds: (Fraction | string | number)[],
): number {
  let best = 0;
  let bestImplied = impliedFromDecimal(dec(odds[0]));
  for (let i = 1; i < odds.length; i++) {
    const imp = impliedFromDecimal(dec(odds[i]));
    if (imp.compare(bestImplied) > 0) {
      bestImplied = imp;
      best = i;
    }
  }
  return best;
}

/* -------------------------------------------------------------------------- */
/*  Arbitrage stake sizing & guaranteed profit                                 */
/* -------------------------------------------------------------------------- */

/**
 * Stakes that lock an EQUAL payout on every outcome for a total outlay `total`:
 * stakeᵢ = total · (1/oᵢ) / booksum. Each outcome then returns
 * stakeᵢ·oᵢ = total / booksum, identical whichever result lands. When
 * booksum < 1 that common return exceeds the outlay ⇒ a guaranteed profit.
 */
export function arbStakes(
  odds: (Fraction | string | number)[],
  total: number | Fraction,
): Fraction[] {
  const T = total instanceof Fraction ? total : F(total);
  const bs = booksum(odds);
  return odds.map((o) => T.mul(impliedFromDecimal(dec(o))).div(bs));
}

/** The guaranteed (result-independent) return on outlay `total`: total / booksum. */
export function guaranteedReturn(
  odds: (Fraction | string | number)[],
  total: number | Fraction,
): Fraction {
  const T = total instanceof Fraction ? total : F(total);
  return T.div(booksum(odds));
}

/**
 * The guaranteed arbitrage PROFIT on outlay `total`:
 * total·(1 − booksum)/booksum = total/booksum − total. Positive iff booksum < 1.
 */
export function guaranteedProfit(
  odds: (Fraction | string | number)[],
  total: number | Fraction,
): Fraction {
  const T = total instanceof Fraction ? total : F(total);
  return guaranteedReturn(odds, T).sub(T);
}

/* -------------------------------------------------------------------------- */
/*  Basket / NAV, weighted-sum mispricing (parts vs whole)                     */
/* -------------------------------------------------------------------------- */

export interface BasketLeg {
  qty: number;
  price: number;
  label: string;
}

/** Net asset value = Σ qtyᵢ·priceᵢ (exact integer for integer inputs). */
export function basketNAV(legs: BasketLeg[]): number {
  return legs.reduce((s, l) => s + l.qty * l.price, 0);
}

/** The UNWEIGHTED price sum Σ priceᵢ, the classic "ignored the quantities" error. */
export function unweightedSum(legs: BasketLeg[]): number {
  return legs.reduce((s, l) => s + l.price, 0);
}

/** Which side is the arbitrage when a basket/ETF trades away from its NAV. */
export type BasketSide = "buy_basket_sell_parts" | "sell_basket_buy_parts" | "fair";

/**
 * The no-arbitrage direction for a basket (ETF) priced at `price` vs its NAV:
 *   price > NAV ⇒ the basket is RICH ⇒ SELL the basket, BUY the parts.
 *   price < NAV ⇒ the basket is CHEAP ⇒ BUY the basket, SELL the parts.
 *   price = NAV ⇒ fairly priced ⇒ no arbitrage.
 */
export function basketArbSide(nav: number, price: number): BasketSide {
  if (price > nav) return "sell_basket_buy_parts";
  if (price < nav) return "buy_basket_sell_parts";
  return "fair";
}

/* -------------------------------------------------------------------------- */
/*  Formatting helpers                                                          */
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

/** Format an American moneyline integer with an explicit sign, e.g. "+150", "−200". */
export function fmtMoneyline(m: number): string {
  return m > 0 ? `+${m}` : `−${Math.abs(m)}`;
}
