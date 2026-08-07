import Fraction from "fraction.js";

/**
 * Exact Kelly bet-sizing solver + event catalogs.
 *
 * Category → Subcategory → Schema taxonomy:
 *   Probability & Statistics  →  Betting & Sizing  →  {Cards, Coins, Dice} ×
 *   {American, Decimal, Fractional} odds  (a 3×3 schema grid, the Kelly factory).
 *
 * ALL probability / odds / Kelly math is done with exact rationals
 * (`fraction.js`), never floating point, so every ground-truth answer is an
 * exact rational and dollar stakes are exact integers.
 *
 *   Kelly fraction: f* = (b·p − q) / b,  q = 1 − p.   Stake $ = f* × bankroll.
 *   If f* ≤ 0, don't bet.
 *
 *   Odds → net odds b:
 *     American  +M → b = M/100 ;  −M → b = 100/M
 *     Decimal   o  → b = o − 1
 *     Fractional m:n → b = m/n
 *
 *   Break-even / implied probability:
 *     American  +M → 100/(M+100) ;  −M → M/(M+100)
 *     Decimal   o  → 1/o
 *     Fractional m:n → n/(m+n)
 */

/** Convenience Fraction constructor. */
export const F = (n: number | string | bigint, d?: number | bigint): Fraction =>
  d === undefined ? new Fraction(n as never) : new Fraction(n as never, d);

export type Source = "cards" | "coins" | "dice";
export type OddsFormat = "american" | "decimal" | "fractional";

/* -------------------------------------------------------------------------- */
/*  Odds                                                                       */
/* -------------------------------------------------------------------------- */

export interface AmericanOdds {
  format: "american";
  /** Signed money line, e.g. +150 or −120 (never 0). */
  american: number;
}
export interface DecimalOdds {
  format: "decimal";
  /** Decimal odds as an exact string, e.g. "2.50" (o > 1). */
  decimal: string;
}
export interface FractionalOdds {
  format: "fractional";
  num: number;
  den: number;
}
export type Odds = AmericanOdds | DecimalOdds | FractionalOdds;

/** Net odds b as an exact Fraction. */
export function oddsToB(o: Odds): Fraction {
  switch (o.format) {
    case "american":
      return o.american > 0
        ? F(o.american, 100)
        : F(100, -o.american);
    case "decimal":
      return F(o.decimal).sub(1);
    case "fractional":
      return F(o.num, o.den);
  }
}

/** Break-even / implied probability as an exact Fraction. */
export function impliedProb(o: Odds): Fraction {
  switch (o.format) {
    case "american": {
      const M = Math.abs(o.american);
      return o.american > 0 ? F(100, M + 100) : F(M, M + 100);
    }
    case "decimal":
      return F(1).div(F(o.decimal));
    case "fractional":
      return F(o.den, o.num + o.den);
  }
}

/** Human-readable odds label for prompts / explanations. */
export function oddsLabel(o: Odds): string {
  switch (o.format) {
    case "american":
      return o.american > 0 ? `+${o.american}` : `${o.american}`;
    case "decimal":
      return o.decimal;
    case "fractional":
      return `${o.num}/${o.den}`;
  }
}

/* -------------------------------------------------------------------------- */
/*  Kelly                                                                      */
/* -------------------------------------------------------------------------- */

/** Kelly fraction f* = (b·p − q)/b as an exact Fraction (may be ≤ 0). */
export function kellyFraction(p: Fraction, b: Fraction): Fraction {
  const q = F(1).sub(p);
  return b.mul(p).sub(q).div(b);
}

/** Exact stake = f* × bankroll (a Fraction; integer when the item is clean). */
export function stakeExact(
  p: Fraction,
  b: Fraction,
  bankroll: number,
): Fraction {
  return kellyFraction(p, b).mul(bankroll);
}

/* -------------------------------------------------------------------------- */
/*  Combinatorics helpers (exact, small n)                                     */
/* -------------------------------------------------------------------------- */

/** Binomial coefficient C(n,k) (exact; n small). */
export function binom(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  let v = 1;
  for (let i = 0; i < k; i++) v = (v * (n - i)) / (i + 1);
  return Math.round(v);
}

/* -------------------------------------------------------------------------- */
/*  CARDS, winning-card count k out of a 52-card deck                          */
/* -------------------------------------------------------------------------- */

export interface CardEvent {
  key: string;
  /** Winning cards out of 52. */
  k: number;
  /** Prompt phrase: "the drawn card is …". */
  phrase: string;
  /** Short label for the worked explanation. */
  label: string;
}

export const CARD_EVENTS: CardEvent[] = [
  { key: "spade", k: 13, phrase: "a spade", label: "spade (13/52)" },
  { key: "heart", k: 13, phrase: "a heart", label: "heart (13/52)" },
  { key: "diamond", k: 13, phrase: "a diamond", label: "diamond (13/52)" },
  { key: "club", k: 13, phrase: "a club", label: "club (13/52)" },
  { key: "red", k: 26, phrase: "a red card", label: "red (26/52)" },
  { key: "black", k: 26, phrase: "a black card", label: "black (26/52)" },
  { key: "face", k: 12, phrase: "a face card (J, Q, K)", label: "face card (12/52)" },
  {
    key: "faceOrAce",
    k: 16,
    phrase: "a face card or an ace",
    label: "face-or-ace (16/52)",
  },
  {
    key: "tenThroughAce",
    k: 20,
    phrase: "a ten, jack, queen, king, or ace",
    label: "ten-through-ace (20/52)",
  },
  { key: "ace", k: 4, phrase: "an ace", label: "ace (4/52)" },
  { key: "king", k: 4, phrase: "a king", label: "king (4/52)" },
  { key: "queen", k: 4, phrase: "a queen", label: "queen (4/52)" },
  { key: "jack", k: 4, phrase: "a jack", label: "jack (4/52)" },
  { key: "twoToNine", k: 32, phrase: "a 2 through 9", label: "2–9 (32/52)" },
  { key: "twoToFour", k: 12, phrase: "a 2, 3, or 4", label: "2–4 (12/52)" },
  { key: "sevenOrHigher", k: 32, phrase: "a 7 or higher (7–A)", label: "7–A (32/52)" },
];

export function cardEventProb(e: CardEvent): Fraction {
  return F(e.k, 52);
}

/* -------------------------------------------------------------------------- */
/*  COINS, winning-outcome count via the binomial over n fair coins           */
/* -------------------------------------------------------------------------- */

export interface CoinEvent {
  key: string;
  /** Which coin counts n this event is defined for. */
  ns: number[];
  /** Predicate on the number of heads h ∈ {0..n}. */
  pred: (h: number, n: number) => boolean;
  phrase: string;
  label: string;
}

export const COIN_EVENTS: CoinEvent[] = [
  {
    key: "exactlyTwoHeads",
    ns: [2, 3, 4],
    pred: (h) => h === 2,
    phrase: "exactly two heads",
    label: "exactly two heads",
  },
  {
    key: "allHeads",
    ns: [2, 3, 4],
    pred: (h, n) => h === n,
    phrase: "all heads",
    label: "all heads",
  },
  {
    key: "atLeastOneHead",
    ns: [2, 3, 4],
    pred: (h) => h >= 1,
    phrase: "at least one head",
    label: "at least one head",
  },
  {
    key: "atLeastTwoHeads",
    ns: [3, 4],
    pred: (h) => h >= 2,
    phrase: "at least two heads",
    label: "at least two heads",
  },
  {
    key: "atMostOneHead",
    ns: [2, 3, 4],
    pred: (h) => h <= 1,
    phrase: "at most one head",
    label: "at most one head",
  },
  {
    key: "majority",
    ns: [3, 4],
    pred: (h, n) => 2 * h > n,
    phrase: "a majority of heads",
    label: "majority heads",
  },
  {
    key: "allSameFace",
    ns: [2, 3, 4],
    pred: (h, n) => h === 0 || h === n,
    phrase: "all coins the same face",
    label: "all same face",
  },
  {
    key: "evenHeads",
    ns: [2, 3, 4],
    pred: (h) => h % 2 === 0,
    phrase: "an even number of heads (0 counts)",
    label: "even # heads",
  },
  {
    key: "notExactlyTwoTails",
    ns: [3, 4],
    pred: (h, n) => n - h !== 2,
    phrase: "not exactly two tails",
    label: "not exactly two tails",
  },
  {
    key: "exactlyOneHead",
    ns: [2, 3, 4],
    pred: (h) => h === 1,
    phrase: "exactly one head",
    label: "exactly one head",
  },
];

/** Winning-outcome count for a coin event over n coins (Σ C(n,h)). */
export function coinWinningCount(e: CoinEvent, n: number): number {
  let count = 0;
  for (let h = 0; h <= n; h++) if (e.pred(h, n)) count += binom(n, h);
  return count;
}

export function coinEventProb(e: CoinEvent, n: number): Fraction {
  return F(coinWinningCount(e, n), 2 ** n);
}

/* -------------------------------------------------------------------------- */
/*  DICE, p by EXACT ENUMERATION of the 6^n outcome space (n ∈ {1,2})          */
/* -------------------------------------------------------------------------- */

export interface DiceEvent {
  key: string;
  ns: number[];
  /** Predicate on a rolled tuple of n dice, each in 1..6. Optional param x. */
  pred: (dice: number[], x: number) => boolean;
  /** Whether the event takes a parameter x (a threshold / target face/sum). */
  param?: "face" | "sum";
  phrase: (x: number) => string;
  label: (x: number) => string;
}

/** Enumerate all 6^n outcomes and count those satisfying `pred`. */
export function diceWinningCount(
  n: number,
  pred: (dice: number[], x: number) => boolean,
  x: number,
): number {
  let count = 0;
  const dice = new Array(n).fill(1);
  const total = 6 ** n;
  for (let i = 0; i < total; i++) {
    let rem = i;
    for (let j = 0; j < n; j++) {
      dice[j] = (rem % 6) + 1;
      rem = Math.floor(rem / 6);
    }
    if (pred(dice, x)) count++;
  }
  return count;
}

export function diceEventProb(e: DiceEvent, n: number, x: number): Fraction {
  return F(diceWinningCount(n, e.pred, x), 6 ** n);
}

export const DICE_EVENTS: DiceEvent[] = [
  // ---- one die (n = 1) ----
  {
    key: "showsFace",
    ns: [1],
    param: "face",
    pred: (d, x) => d[0] === x,
    phrase: (x) => `the die shows a ${x}`,
    label: (x) => `die = ${x} (1/6)`,
  },
  {
    key: "atLeastX",
    ns: [1],
    param: "face",
    pred: (d, x) => d[0] >= x,
    phrase: (x) => `the die shows ${x} or higher`,
    label: (x) => `die ≥ ${x}`,
  },
  {
    key: "even",
    ns: [1],
    pred: (d) => d[0] % 2 === 0,
    phrase: () => "the die shows an even number",
    label: () => "die even (3/6)",
  },
  {
    key: "fiveOrSix",
    ns: [1],
    pred: (d) => d[0] >= 5,
    phrase: () => "the die shows a 5 or 6",
    label: () => "die ∈ {5,6} (2/6)",
  },
  // ---- two dice (n = 2) ----
  {
    key: "bothAtLeastX",
    ns: [2],
    param: "face",
    pred: (d, x) => d[0] >= x && d[1] >= x,
    phrase: (x) => `both dice show ${x} or higher`,
    label: (x) => `both ≥ ${x}`,
  },
  {
    key: "bothOdd",
    ns: [2],
    pred: (d) => d[0] % 2 === 1 && d[1] % 2 === 1,
    phrase: () => "both dice are odd",
    label: () => "both odd (9/36)",
  },
  {
    key: "bothEven",
    ns: [2],
    pred: (d) => d[0] % 2 === 0 && d[1] % 2 === 0,
    phrase: () => "both dice are even",
    label: () => "both even (9/36)",
  },
  {
    key: "atLeastOneSix",
    ns: [2],
    pred: (d) => d[0] === 6 || d[1] === 6,
    phrase: () => "at least one die shows a 6",
    label: () => "≥ one 6 (11/36)",
  },
  {
    key: "neitherSix",
    ns: [2],
    pred: (d) => d[0] !== 6 && d[1] !== 6,
    phrase: () => "neither die shows a 6",
    label: () => "no 6 (25/36)",
  },
  {
    key: "sumEquals",
    ns: [2],
    param: "sum",
    pred: (d, x) => d[0] + d[1] === x,
    phrase: (x) => `the two dice sum to exactly ${x}`,
    label: (x) => `sum = ${x}`,
  },
  {
    key: "sumGreater",
    ns: [2],
    param: "sum",
    pred: (d, x) => d[0] + d[1] > x,
    phrase: (x) => `the two dice sum to more than ${x}`,
    label: (x) => `sum > ${x}`,
  },
  {
    key: "sumAtLeast",
    ns: [2],
    param: "sum",
    pred: (d, x) => d[0] + d[1] >= x,
    phrase: (x) => `the two dice sum to ${x} or more`,
    label: (x) => `sum ≥ ${x}`,
  },
  {
    key: "sumDivisibleBy3",
    ns: [2],
    pred: (d) => (d[0] + d[1]) % 3 === 0,
    phrase: () => "the two dice sum to a multiple of 3",
    label: () => "sum ÷ 3 (12/36)",
  },
  {
    key: "double",
    ns: [2],
    pred: (d) => d[0] === d[1],
    phrase: () => "the two dice match (a double)",
    label: () => "double (6/36)",
  },
  {
    key: "bothLessThan3",
    ns: [2],
    pred: (d) => d[0] < 3 && d[1] < 3,
    phrase: () => "both dice show less than 3",
    label: () => "both < 3 (4/36)",
  },
];

/* -------------------------------------------------------------------------- */
/*  Formatting                                                                 */
/* -------------------------------------------------------------------------- */

/** "n/d", or "n" when the denominator is 1. */
export function fracText(f: Fraction): string {
  return f.toFraction(false);
}

/** Approximate percent for display only (e.g. "23.1%"). */
export function pctText(f: Fraction, dp = 1): string {
  return `${(f.valueOf() * 100).toFixed(dp)}%`;
}
