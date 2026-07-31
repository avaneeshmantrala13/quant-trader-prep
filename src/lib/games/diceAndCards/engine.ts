/**
 * ============================================================================
 *  DICE AND CARDS MARKET MAKING — TAKER (pure game engine, no React)
 * ============================================================================
 * The multiplicative cousin of Cards Market Making. The table is 1–2 cards
 * plus 1–2 dice, and the table VALUE is the PRODUCT of every face value (not
 * the sum). A market maker quotes a two-sided market on that product and you
 * are the TAKER: buy if you think the true value beats the quote, sell if it
 * falls short, and size your order to your edge.
 *
 * Card face values: pip value for 2–10, J/Q/K = 11/12/13, and the Ace is
 * either 1 (ace-low) or 14 (ace-high). Dice are uniform over 1–6. Because the
 * factors are independent, the product's mean is the product of the factor
 * means (card EV 7/8, die EV 3.5) — but its spread is wide, so a graded
 * pre-question asks for the standard deviation of the product, computed here
 * by enumerating the full joint distribution.
 *
 * Quotes are phrased from the COMPUTER's side: "Buy at 33" means the computer
 * buys at 33 (your bid — you sell into it), "Sell at 37" means the computer
 * sells at 37 (your ask — you buy from it). So a player who BUYS pays the ask
 * and a player who SELLS receives the bid.
 *
 * Scoring is the asymmetric Game-3 rule: a wrong LOSS guess is punished at 2×,
 * which makes precise P&L awareness the real test.
 */
import { Rng } from "@/lib/rng";

/* ========================================================================== */
/*  Types                                                                      */
/* ========================================================================== */

export type AceMode = "low" | "high";

export type Suit = "♠" | "♥" | "♦" | "♣";

export interface Card {
  /** 2–14, where 11=J 12=Q 13=K 14=A. */
  rank: number;
  suit: Suit;
}

export interface GameConfig {
  numCards: 1 | 2;
  numDice: 1 | 2;
  aceMode: AceMode;
}

export interface Quote {
  /** Computer BUYS here = the price at which YOU can SELL. */
  bid: number;
  /** Computer SELLS here = the price at which YOU can BUY. bid < ask. */
  ask: number;
}

export type Action = "buy" | "sell";

export interface Round {
  cards: Card[];
  dice: number[];
  /** Realized product of all card + dice face values. */
  product: number;
  quote: Quote;
}

/* ========================================================================== */
/*  Face values + EV                                                           */
/* ========================================================================== */

const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];

/** Face value of a rank: 2–10 pip, J/Q/K = 11/12/13, A = 14 (high) or 1 (low). */
export function cardFaceValue(rank: number, aceMode: AceMode): number {
  if (rank === 14) return aceMode === "high" ? 14 : 1;
  return rank;
}

/**
 * Mean face value of a single card over the 13 ranks. Ace-high → 8, ace-low
 * → 7 (matches the official course shorthand).
 */
export function cardEV(aceMode: AceMode): number {
  return aceMode === "high" ? 8 : 7;
}

/** Mean of a fair die. */
export function diceEV(): number {
  return 3.5;
}

/** Unconditional expected product = cardEV^numCards × diceEV^numDice. */
export function productEV(config: GameConfig): number {
  return (
    Math.pow(cardEV(config.aceMode), config.numCards) *
    Math.pow(diceEV(), config.numDice)
  );
}

/** The largest single-card value: K=13 dominates ace-low, ace=14 ace-high. */
export function maxCardValue(aceMode: AceMode): number {
  return aceMode === "high" ? 14 : 13;
}

/** Realized product of the given cards and dice. */
export function productValue(cards: Card[], dice: number[], aceMode: AceMode): number {
  let p = 1;
  for (const c of cards) p *= cardFaceValue(c.rank, aceMode);
  for (const d of dice) p *= d;
  return p;
}

/* ========================================================================== */
/*  Standard deviation of the product (graded pre-question)                    */
/* ========================================================================== */

/** The 13 card face values for a mode (each rank 2..14, uniform). */
function cardFaceValues(aceMode: AceMode): number[] {
  const vals: number[] = [];
  for (let rank = 2; rank <= 14; rank++) vals.push(cardFaceValue(rank, aceMode));
  return vals;
}

const DICE_FACES = [1, 2, 3, 4, 5, 6];

/**
 * Standard deviation of the product, computed by ENUMERATING the full joint
 * distribution of the independent factors: each card uniform over its 13 face
 * values (treated as i.i.d. with replacement — this reproduces the official
 * reference σ), each die uniform over 1..6. Var = E[X²] − E[X]², return √Var.
 *
 * Reference values (must match to 2 decimals):
 *   • 1 card, 1 die, ace-high → σ ≈ 19.97 (mean 28)
 *   • 2 cards, 1 die, ace-low → σ ≈ 175.45 (mean 171.5)
 *   • 2 cards, 2 dice, ace-high → σ ≈ 885.91 (mean 784)
 */
export function productSD(config: GameConfig): number {
  const cardVals = cardFaceValues(config.aceMode);
  const factors: number[][] = [];
  for (let i = 0; i < config.numCards; i++) factors.push(cardVals);
  for (let i = 0; i < config.numDice; i++) factors.push(DICE_FACES);

  let count = 0;
  let sum = 0;
  let sumSq = 0;

  const walk = (index: number, product: number): void => {
    if (index === factors.length) {
      count += 1;
      sum += product;
      sumSq += product * product;
      return;
    }
    for (const v of factors[index]) walk(index + 1, product * v);
  };
  walk(0, 1);

  const mean = sum / count;
  const variance = sumSq / count - mean * mean;
  return round2(Math.sqrt(variance));
}

/** How much the product SD changes moving from one config to another. */
export function sdDelta(fromConfig: GameConfig, toConfig: GameConfig): number {
  return round2(productSD(toConfig) - productSD(fromConfig));
}

/* ========================================================================== */
/*  Prices, P&L, scoring                                                       */
/* ========================================================================== */

/** The price the player transacts at: buy → ask, sell → bid. */
export function playerPriceFor(action: Action, quote: Quote): number {
  return action === "buy" ? quote.ask : quote.bid;
}

/**
 * Realized P&L.
 *   • Buy N @ ask:  (product − ask) × N
 *   • Sell N @ bid: (bid − product) × N
 */
export function realizedPnl(
  action: Action,
  size: number,
  quote: Quote,
  product: number,
): number {
  if (action === "buy") return (product - quote.ask) * size;
  return (quote.bid - product) * size;
}

/**
 * Asymmetric round score (identical to Cards MM Game 3):
 *   • Correct profit guess:   +P
 *   • Correct loss guess:     −L (the actual negative)
 *   • Incorrect profit guess:  0
 *   • Incorrect loss guess:   −2L (double the actual loss)
 * `guessCorrect` = whether the player's stated P&L matched the realized P&L.
 */
export function scoreRound(pnl: number, guessCorrect: boolean): number {
  if (pnl >= 0) {
    return guessCorrect ? pnl : 0;
  }
  return guessCorrect ? pnl : 2 * pnl;
}

/* ========================================================================== */
/*  Order-size limits (official course)                                        */
/* ========================================================================== */

/** Max BUY lots = floor(funds ÷ ask). */
export function maxBuy(funds: number, quote: Quote): number {
  if (quote.ask <= 0) return 0;
  return Math.floor(funds / quote.ask);
}

/**
 * Max SELL lots = floor(funds ÷ max-loss-per-lot), where the worst case is the
 * maximum possible product (maxCardValue^numCards × 6^numDice) minus the bid.
 */
export function maxSell(funds: number, quote: Quote, config: GameConfig): number {
  const maxProduct =
    Math.pow(maxCardValue(config.aceMode), config.numCards) *
    Math.pow(6, config.numDice);
  const maxLossPerLot = maxProduct - quote.bid;
  if (maxLossPerLot <= 0) return Infinity;
  return Math.floor(funds / maxLossPerLot);
}

/* ========================================================================== */
/*  Quote generation                                                           */
/* ========================================================================== */

/**
 * Build an integer two-sided market centered near the product EV, with a small
 * spread scaled modestly to the EV and a random offset so that on some rounds
 * buying has edge and on others selling does. bid < ask always.
 */
export function makeQuote(rng: Rng, config: GameConfig): Quote {
  const ev = productEV(config);
  const spread = Math.max(2, Math.round(ev * 0.08));
  const offset = rng.int(-spread, spread);
  const mid = Math.round(ev + offset);
  const bid = mid - Math.floor(spread / 2);
  const ask = bid + spread;
  return { bid, ask };
}

/* ========================================================================== */
/*  Deck + dealing                                                             */
/* ========================================================================== */

/** A fresh, ordered 52-card deck. */
export function freshDeck(): Card[] {
  const deck: Card[] = [];
  for (let rank = 2; rank <= 14; rank++) {
    for (const suit of SUITS) deck.push({ rank, suit });
  }
  return deck;
}

/**
 * Deal one round from a running deck: draw `numCards` off the front, roll
 * `numDice` dice, compute the product and a quote. Returns the round plus the
 * remaining deck (cards are NOT replaced between rounds within a game).
 */
export function dealRound(
  rng: Rng,
  deck: Card[],
  config: GameConfig,
): { round: Round; deck: Card[] } {
  const cards = deck.slice(0, config.numCards);
  const remaining = deck.slice(config.numCards);
  const dice: number[] = [];
  for (let i = 0; i < config.numDice; i++) dice.push(rng.int(1, 6));
  const product = productValue(cards, dice, config.aceMode);
  const quote = makeQuote(rng, config);
  return { round: { cards, dice, product, quote }, deck: remaining };
}

/* ========================================================================== */
/*  Constants + helpers                                                        */
/* ========================================================================== */

export const START_BALANCE = 500000;

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
