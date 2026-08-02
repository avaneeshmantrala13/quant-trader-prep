/**
 * ============================================================================
 *  FRUIT MARKET MAKING — SPEED DRILL (pure game engine, no React)
 * ============================================================================
 * A fast mental-math market-making drill. Two bags each hold apples & oranges.
 * The real market value is (applesA + applesB) × (orangesA + orangesB). The
 * house quotes a two-sided market (bid/ask) around it and the player is the
 * TAKER: BUY when the true value is above the ask, SELL when it's below the
 * bid, SKIP when the value sits inside the quote.
 *
 * A round may carry at most ONE market event (or none) that transforms the
 * fruit COUNTS before the multiply:
 *   • apple-inflation  (2×) — double the apple TOTAL.
 *   • orange-inflation (2×) — double the orange TOTAL.
 *   • orange-deflation (0.5×) — halve the orange total, ROUNDED UP (11 → 6).
 *   • no-fruit-a       — bag A's apples AND oranges become 0.
 *   • no-fruit-b       — bag B's apples AND oranges become 0.
 * After the event and the multiply, the product is rounded to the nearest 10
 * to give the `trueValue` used for every trade decision; the pre-round product
 * is exposed as `rawValue` for display.
 *
 * Scoring rewards speed and accuracy: a correct profitable trade captures more
 * of its edge the more of the 15s window is left (early-bird bonus, floor of
 * half the edge); a correct skip earns 0; an actual trade in the WRONG
 * direction forfeits the FULL edge of the correct action with no bonus; a skip
 * when a trade was right simply forgoes profit (0, never a loss). Repeated
 * trades in the same window decay 15% each. The leaderboard number is raw
 * profit × first-click accuracy.
 */
import { Rng } from "@/lib/rng";

/* ========================================================================== */
/*  Types                                                                      */
/* ========================================================================== */

export type FruitEvent =
  | "none"
  | "apple-inflation"
  | "orange-inflation"
  | "orange-deflation"
  | "no-fruit-a"
  | "no-fruit-b";

export type Action = "buy" | "sell" | "skip";

export interface Bag {
  apples: number;
  oranges: number;
}

export interface Quote {
  bid: number;
  ask: number;
}

export interface FruitMarket {
  bagA: Bag;
  bagB: Bag;
  event: FruitEvent;
  quote: Quote;
  /** The multiplied integer product BEFORE rounding to the nearest 10. */
  rawValue: number;
  /** `rawValue` rounded to the nearest 10 — used for ALL trade decisions. */
  trueValue: number;
}

export interface MarketConfig {
  maxPerBag: number;
  eventsEnabled: boolean;
}

/** The five non-trivial events, used for weighted event selection. */
const EVENTS: FruitEvent[] = [
  "apple-inflation",
  "orange-inflation",
  "orange-deflation",
  "no-fruit-a",
  "no-fruit-b",
];

/* ========================================================================== */
/*  Count transforms + value pipeline                                          */
/* ========================================================================== */

/**
 * Total apples across both bags AFTER applying the event's count transform.
 * `no-fruit-*` zeroes an entire bag; `apple-inflation` doubles the total; the
 * orange events leave apples untouched.
 */
export function applesTotal(bagA: Bag, bagB: Bag, event: FruitEvent): number {
  const a = event === "no-fruit-a" ? 0 : bagA.apples;
  const b = event === "no-fruit-b" ? 0 : bagB.apples;
  const total = a + b;
  return event === "apple-inflation" ? total * 2 : total;
}

/**
 * Total oranges across both bags AFTER applying the event's count transform.
 * `no-fruit-*` zeroes an entire bag; `orange-inflation` doubles the total;
 * `orange-deflation` halves it ROUNDED UP (11 → 6); apple events leave oranges
 * untouched.
 */
export function orangesTotal(bagA: Bag, bagB: Bag, event: FruitEvent): number {
  const a = event === "no-fruit-a" ? 0 : bagA.oranges;
  const b = event === "no-fruit-b" ? 0 : bagB.oranges;
  const total = a + b;
  if (event === "orange-inflation") return total * 2;
  if (event === "orange-deflation") return Math.ceil(total / 2);
  return total;
}

/** Round to the nearest 10 (ties round up): 544 → 540, 545 → 550, 11 → 10. */
export function roundTo10(n: number): number {
  return Math.round(n / 10) * 10;
}

/**
 * Full value pipeline: apply the event to the counts, multiply, and round.
 *   rawValue  = applesTotal × orangesTotal (integer)
 *   trueValue = rawValue rounded to the nearest 10
 */
export function computeValue(
  bagA: Bag,
  bagB: Bag,
  event: FruitEvent,
): { rawValue: number; trueValue: number } {
  const rawValue = applesTotal(bagA, bagB, event) * orangesTotal(bagA, bagB, event);
  return { rawValue, trueValue: roundTo10(rawValue) };
}

/* ========================================================================== */
/*  Decisions + edge                                                           */
/* ========================================================================== */

/** BUY when trueValue > ask, SELL when trueValue < bid, else SKIP. */
export function correctAction(trueValue: number, quote: Quote): Action {
  if (trueValue > quote.ask) return "buy";
  if (trueValue < quote.bid) return "sell";
  return "skip";
}

/**
 * Signed magnitude of the edge captured by `action` at this quote:
 *   buy  → trueValue − ask
 *   sell → bid − trueValue
 *   skip → 0
 * (Positive when the action is the correct, edge-capturing one.)
 */
export function edge(trueValue: number, quote: Quote, action: Action): number {
  if (action === "buy") return round2(trueValue - quote.ask);
  if (action === "sell") return round2(quote.bid - trueValue);
  return 0;
}

/* ========================================================================== */
/*  Market construction                                                        */
/* ========================================================================== */

/**
 * Deal one market: random bags (apples/oranges each 1..maxPerBag), a weighted
 * event (~40% none, else uniform among the five events; always "none" when
 * events are disabled), then an integer bid < ask centered near `trueValue`
 * with a small spread (2..8) and a random offset so BUY/SELL/SKIP each come up.
 */
export function dealMarket(rng: Rng, config: MarketConfig): FruitMarket {
  const bagA: Bag = {
    apples: rng.int(1, config.maxPerBag),
    oranges: rng.int(1, config.maxPerBag),
  };
  const bagB: Bag = {
    apples: rng.int(1, config.maxPerBag),
    oranges: rng.int(1, config.maxPerBag),
  };

  let event: FruitEvent = "none";
  if (config.eventsEnabled && !rng.chance(0.4)) {
    event = rng.pick(EVENTS);
  }

  const { rawValue, trueValue } = computeValue(bagA, bagB, event);

  const spread = rng.int(2, 8);
  const offset = rng.int(-spread, spread);
  const mid = Math.round(trueValue + offset);
  const bid = mid - Math.floor(spread / 2);
  const ask = bid + spread;

  return { bagA, bagB, event, quote: { bid, ask }, rawValue, trueValue };
}

/* ========================================================================== */
/*  Scoring                                                                    */
/* ========================================================================== */

/**
 * Score a single market's first trade.
 *   • Correct profitable buy/sell → edge × (0.5 + 0.5·fractionTimeLeft): more of
 *     the 15s window left captures more edge, with a floor of half the edge.
 *   • Correct skip → 0.
 *   • Skip when a trade was correct → 0 (forgone profit, never a loss).
 *   • Actual buy/sell in the WRONG direction → −|edge of the correct action|
 *     with no early-bird bonus and no decay.
 * `fractionTimeLeft` is the share of the 15s window remaining on the first click.
 */
export function scoreTrade(
  market: FruitMarket,
  action: Action,
  fractionTimeLeft: number,
): number {
  const correct = correctAction(market.trueValue, market.quote);
  if (action === correct) {
    if (action === "skip") return 0;
    const captured = edge(market.trueValue, market.quote, action) * (0.5 + 0.5 * fractionTimeLeft);
    return round2(captured);
  }
  // Wrong: a skip merely forgoes profit; only a real trade eats the full edge.
  if (action === "skip") return 0;
  return round2(-Math.abs(edge(market.trueValue, market.quote, correct)));
}

/** Each subsequent trade in the same window pays 85% of the previous one. */
export function decayedRepeat(baseProfit: number, repeatIndex: number): number {
  return round2(baseProfit * Math.pow(0.85, repeatIndex));
}

/** Share (0..1) of markets whose FIRST trade was profitable/correct. */
export function firstClickAccuracy(results: { firstActionCorrect: boolean }[]): number {
  if (results.length === 0) return 0;
  const hits = results.filter((r) => r.firstActionCorrect).length;
  return round2(hits / results.length);
}

/** Leaderboard number: raw profit × first-click accuracy. */
export function finalScore(rawProfit: number, firstClickAccuracy: number): number {
  return round2(rawProfit * firstClickAccuracy);
}

/* ========================================================================== */
/*  Helpers                                                                    */
/* ========================================================================== */

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
