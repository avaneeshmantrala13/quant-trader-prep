/**
 * ============================================================================
 *  CARDS MARKET MAKING — TAKER (pure game engine, no React)
 * ============================================================================
 * Faithful implementation of the tradinginterview.com "Cards Market Making"
 * game as documented in `QuantGames-Mechanics.md` (Game 3).
 *
 * You are the TAKER. A market maker quotes a two-sided market `B at A` on the
 * SUM of N face-down cards. You Buy N lots (lift the ask), Sell N lots (hit the
 * bid), or No-Trade, given your own estimate of the expected sum. The cards flip
 * and you must state your EXACT realized P&L.
 *
 * The game tests two skills:
 *   1. TRADE THE EDGE — only trade when the quote sits on the wrong side of the
 *      unconditional expected sum (buy when ask < EV, sell when bid > EV).
 *   2. PRECISE P&L — because a wrong LOSS guess is punished at 2× (see scoring).
 *
 * Everything is generated fresh each round from a shuffled deck, so nothing is
 * memorizable. All EV math is exact; the maker's quote is deliberately skewed
 * off EV by a random margin to create (or deny) a taker's edge.
 */
import { Rng } from "@/lib/rng";

/* ========================================================================== */
/*  Types                                                                      */
/* ========================================================================== */

export type Suit = "♠" | "♥" | "♦" | "♣";

export interface Card {
  /** 2–14, where 11=J 12=Q 13=K 14=A. */
  rank: number;
  suit: Suit;
  /** Signed point value under the active ace setting. */
  value: number;
}

export type Action = "buy" | "sell" | "none";

export interface Quote {
  /** The maker's bid — the price at which YOU can SELL. */
  bid: number;
  /** The maker's ask — the price at which YOU can BUY. */
  ask: number;
}

export interface RoundConfig {
  numCards: number;
  /** 14 = ace-high, 1 = ace-low. */
  aceValue: number;
  /** Draw with replacement between rounds? (affects the deck the round draws from) */
  replace: boolean;
}

export interface CardsRound {
  cards: Card[];
  /** Realized sum of the N cards. */
  sum: number;
  quote: Quote;
  /** Unconditional expected sum = numCards × meanCard. */
  evSum: number;
  config: RoundConfig;
}

/* ========================================================================== */
/*  Deck + EV                                                                  */
/* ========================================================================== */

const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];

/** Point value of a rank under the active ace value. J/Q/K = 11/12/13. */
export function cardValue(rank: number, aceValue: number): number {
  return rank === 14 ? aceValue : rank;
}

/** Human label for a rank, e.g. 11 → "J", 14 → "A". Shared across the games. */
export { rankLabel } from "@/lib/games/format";

/** A fresh, ordered 52-card deck valued under `aceValue`. */
export function freshDeck(aceValue: number): Card[] {
  const deck: Card[] = [];
  for (let rank = 2; rank <= 14; rank++) {
    for (const suit of SUITS) {
      deck.push({ rank, suit, value: cardValue(rank, aceValue) });
    }
  }
  return deck;
}

/**
 * Mean value of a single card over the full deck. Ace-high (2..14) → 8;
 * ace-low (ace=1, so values 1..13) → 7. Matches the official course shorthand.
 */
export function meanCard(aceValue: number): number {
  let total = 0;
  let n = 0;
  for (let rank = 2; rank <= 14; rank++) {
    total += cardValue(rank, aceValue);
    n++;
  }
  return total / n;
}

/** The largest single-card value in the deck (drives max sell size + worst case). */
export function maxCardValue(aceValue: number): number {
  let mx = -Infinity;
  for (let rank = 2; rank <= 14; rank++) mx = Math.max(mx, cardValue(rank, aceValue));
  return mx;
}

/** Unconditional expected sum of N cards. */
export function evSum(numCards: number, aceValue: number): number {
  return numCards * meanCard(aceValue);
}

/** Sum of a set of cards. */
export function sumHand(cards: Card[]): number {
  return cards.reduce((a, c) => a + c.value, 0);
}

/* ========================================================================== */
/*  Quote generation (deliberately skewed off EV)                              */
/* ========================================================================== */

/**
 * Build a two-sided quote around EV, offset by a random margin so that on some
 * rounds buying has edge (ask < EV), on some selling does (bid > EV), and on
 * some neither. Spread is a small integer. Prices are integers.
 */
export function makeQuote(rng: Rng, ev: number): Quote {
  const spread = rng.int(2, 4);
  // Center offset roughly in [−4, +4]; sometimes leaves a clear edge.
  const offset = rng.int(-4, 4);
  const mid = Math.round(ev + offset);
  const bid = mid - Math.floor(spread / 2);
  const ask = bid + spread;
  return { bid, ask };
}

/* ========================================================================== */
/*  Edge / correct decision                                                    */
/* ========================================================================== */

export interface EdgeAnalysis {
  /** The EV-correct action given the quote. */
  correctAction: Action;
  /** Per-lot edge of the correct action (0 if no trade). */
  edgePerLot: number;
  buyEdge: number; // ev − ask (positive → buying is +EV)
  sellEdge: number; // bid − ev (positive → selling is +EV)
}

/**
 * Compare the quote to EV. Buy is +EV when ask < EV; sell is +EV when bid > EV;
 * otherwise pass. Ties (edge exactly 0) count as no-trade.
 */
export function analyzeEdge(quote: Quote, ev: number): EdgeAnalysis {
  const buyEdge = ev - quote.ask;
  const sellEdge = quote.bid - ev;
  let correctAction: Action = "none";
  let edgePerLot = 0;
  if (buyEdge > 1e-9 && buyEdge >= sellEdge) {
    correctAction = "buy";
    edgePerLot = buyEdge;
  } else if (sellEdge > 1e-9) {
    correctAction = "sell";
    edgePerLot = sellEdge;
  }
  return { correctAction, edgePerLot, buyEdge, sellEdge };
}

/* ========================================================================== */
/*  Order-size limits (official course)                                        */
/* ========================================================================== */

/** Max BUY lots = floor(funds ÷ ask). */
export function maxBuySize(funds: number, ask: number): number {
  if (ask <= 0) return 0;
  return Math.floor(funds / ask);
}

/**
 * Max SELL lots = floor(funds ÷ max-loss-per-lot), where max loss per lot is the
 * worst-case sum (N × maxCardValue) minus the bid you sold at.
 */
export function maxSellSize(
  funds: number,
  bid: number,
  numCards: number,
  aceValue: number,
): number {
  const worstSum = numCards * maxCardValue(aceValue);
  const maxLossPerLot = worstSum - bid;
  if (maxLossPerLot <= 0) return Infinity; // can't lose → unbounded
  return Math.floor(funds / maxLossPerLot);
}

/* ========================================================================== */
/*  Realized P&L + asymmetric scoring                                          */
/* ========================================================================== */

/**
 * Realized P&L for a trade.
 *   • Bought N @ ask A:  (Σcards − A) × N
 *   • Sold  N @ bid B:  (B − Σcards) × N
 *   • No trade: 0.
 */
export function realizedPnl(
  action: Action,
  size: number,
  quote: Quote,
  sum: number,
): number {
  if (action === "buy") return (sum - quote.ask) * size;
  if (action === "sell") return (quote.bid - sum) * size;
  return 0;
}

/**
 * Asymmetric round score (the key twist):
 *   • Correct profit guess:   +P
 *   • Correct loss guess:     −L
 *   • Incorrect profit guess:  0  (no credit)
 *   • Incorrect loss guess:   −2L (double the actual loss)
 * The `guessCorrect` flag is whether the player stated the exact P&L.
 */
export function scoreRound(pnl: number, guessCorrect: boolean): number {
  if (pnl >= 0) {
    return guessCorrect ? pnl : 0;
  }
  // pnl < 0 (a loss). L = |pnl|.
  return guessCorrect ? pnl : 2 * pnl;
}

/* ========================================================================== */
/*  Value of information — "pay to show the first card"                        */
/* ========================================================================== */

/**
 * How much you'd pay to reveal the first card, given you're FORCED to trade.
 * For each possible first-card value v, recompute total EV = v + (N−1)·meanCard,
 * take the better of forced buy (EV − ask) or forced sell (bid − EV), then
 * average over all card values. Mid-centered quote → 29/13 ≈ 2.23.
 */
export function payForFirstCard(
  quote: Quote,
  numCards: number,
  aceValue: number,
): number {
  const mean = meanCard(aceValue);
  let total = 0;
  let n = 0;
  for (let rank = 2; rank <= 14; rank++) {
    const v = cardValue(rank, aceValue);
    const totalEv = v + (numCards - 1) * mean;
    const buy = totalEv - quote.ask;
    const sell = quote.bid - totalEv;
    total += Math.max(buy, sell);
    n++;
  }
  return round2(total / n);
}

/* ========================================================================== */
/*  Round construction                                                         */
/* ========================================================================== */

/** Deal one round: shuffle a deck, take N cards, quote a market around EV. */
export function dealRound(rng: Rng, config: RoundConfig): CardsRound {
  const deck = rng.shuffle(freshDeck(config.aceValue));
  const cards = deck.slice(0, config.numCards);
  const sum = sumHand(cards);
  const ev = evSum(config.numCards, config.aceValue);
  const quote = makeQuote(rng, ev);
  return { cards, sum, quote, evSum: ev, config };
}

/* ========================================================================== */
/*  Conditional updating — value of information (posterior after a reveal)      */
/* ========================================================================== */

/**
 * The POSTERIOR expected sum once `revealed` of the N cards are face-up: the
 * realized sum of the shown cards plus the unconditional EV of the ones still
 * hidden (mean × count remaining). This is the exact conditional expectation
 * E[Σ | revealed] under draw-without-replacement-of-the-shown-cards — it is what
 * a taker must re-price on before trading, NOT the static unconditional EV.
 */
export function conditionalEvSum(
  revealed: Card[],
  numCards: number,
  aceValue: number,
): number {
  const remaining = Math.max(0, numCards - revealed.length);
  return sumHand(revealed) + remaining * meanCard(aceValue);
}

/**
 * A conditional-updating round: a quote is centered on the PRIOR (unconditional)
 * EV, then `numRevealed` cards are turned face-up. The edge to trade therefore
 * exists ONLY once you fold the revealed cards into a POSTERIOR expected sum —
 * a taker who prices off the static prior sees no edge and (correctly, for the
 * prior) passes, so the round rewards conditional updating specifically.
 */
export interface ConditionalCardsRound extends CardsRound {
  /** How many of the N cards are shown before the trade decision. */
  numRevealed: number;
  /** The cards shown (the first `numRevealed` of `cards`). */
  revealed: Card[];
  /** Posterior expected sum given the revealed cards (see {@link conditionalEvSum}). */
  posteriorEv: number;
}

/**
 * Build a quote CENTERED on `ev` (only a small integer spread, no deliberate
 * off-EV skew), so on a conditional round the *only* edge comes from the reveal.
 */
export function makeCenteredQuote(rng: Rng, ev: number): Quote {
  const spread = rng.int(2, 4);
  const mid = Math.round(ev);
  const bid = mid - Math.floor(spread / 2);
  const ask = bid + spread;
  return { bid, ask };
}

/**
 * Deal a conditional-updating round: shuffle, take N cards, quote CENTERED on
 * the prior EV, and reveal the first `numRevealed`. The correct action is the
 * one that is +EV against the POSTERIOR (`analyzeEdge(quote, posteriorEv)`), so
 * the round tests value-of-information / conditional pricing rather than static
 * edge detection. Deterministic given the Rng.
 */
export function dealConditionalRound(
  rng: Rng,
  config: RoundConfig,
  numRevealed: number,
): ConditionalCardsRound {
  const deck = rng.shuffle(freshDeck(config.aceValue));
  const cards = deck.slice(0, config.numCards);
  const sum = sumHand(cards);
  const ev = evSum(config.numCards, config.aceValue);
  const quote = makeCenteredQuote(rng, ev);
  const clamped = Math.max(0, Math.min(config.numCards - 1, numRevealed));
  const revealed = cards.slice(0, clamped);
  const posteriorEv = conditionalEvSum(revealed, config.numCards, config.aceValue);
  return {
    cards,
    sum,
    quote,
    evSum: ev,
    config,
    numRevealed: clamped,
    revealed,
    posteriorEv,
  };
}

/* ========================================================================== */
/*  Per-round grading (for the review screen)                                  */
/* ========================================================================== */

export interface RoundOutcome {
  round: CardsRound;
  action: Action;
  size: number;
  /** The P&L the player STATED. */
  guessedPnl: number;
  /** The correct realized P&L. */
  actualPnl: number;
  guessCorrect: boolean;
  /** Points banked/lost this round after the asymmetric rule. */
  score: number;
  /** Was the take/pass decision EV-correct? */
  decisionCorrect: boolean;
  edge: EdgeAnalysis;
}

export function gradeOutcome(
  round: CardsRound,
  action: Action,
  size: number,
  guessedPnl: number,
): RoundOutcome {
  const edge = analyzeEdge(round.quote, round.evSum);
  const actualPnl = realizedPnl(action, size, round.quote, round.sum);
  const guessCorrect = guessedPnl === actualPnl;
  const score = scoreRound(actualPnl, guessCorrect);
  const decisionCorrect = action === edge.correctAction;
  return {
    round,
    action,
    size,
    guessedPnl,
    actualPnl,
    guessCorrect,
    score,
    decisionCorrect,
    edge,
  };
}

/* ========================================================================== */
/*  Constants + helpers                                                         */
/* ========================================================================== */

export const START_BALANCE = 500;

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
