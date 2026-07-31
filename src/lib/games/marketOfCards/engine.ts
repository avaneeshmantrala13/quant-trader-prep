/**
 * ============================================================================
 *  MARKET OF CARDS — GROUP MAKER (pure game engine, no React)
 * ============================================================================
 * Faithful implementation of the tradinginterview.com "Market of Cards" super-
 * day game as documented in `QuantGames-Mechanics.md` (Game 4).
 *
 * YOU are the MAKER. Every player is dealt 2 private cards; 3 community cards
 * sit face-down centre-table. With `B` bots there are `2·(B+1) + 3` cards total,
 * and the settle value is the SUM of ALL their signed values. You only ever see
 * your own 2. One community card is revealed at the start of each round after
 * the first, so uncertainty shrinks round by round.
 *
 * Card valuation (confirmed on-screen — "number × 10"):
 *   • Number cards 2–10  = face × 10  (any suit)          → +20 … +100
 *   • Red faces  (♥ ♦)   = J +110, Q +120, K +130
 *   • Black faces (♠ ♣)  = J −110, Q −120, K −130         (mirror of red)
 *   • Ace LOW  → +10 (below the 2, both colours)
 *   • Ace HIGH → Red +140, Black −140 (the extremes)
 *
 * The skills: price an expectation (mid ≈ Σknown + unknown·EV/card), size the
 * spread to variance (≤ 20 cap), update the mid the instant a community card
 * flips, and trade BOTH directions against adaptive bots (the "risk manager"
 * test) rather than accumulating one-way risk. Endgame P&L marks your net
 * position to the true total; post-game position / max-loss / break-even reuse
 * the Make-Me-a-Market break-even algorithm.
 *
 * Everything deals fresh from a shuffled deck, so nothing is memorizable.
 */
import { Rng } from "@/lib/rng";
import {
  markToTrue,
  netPosition,
  breakEven,
  type Fill,
  type Side,
  type BreakEvenResult,
} from "@/lib/games/makeMarket/engine";

/* ========================================================================== */
/*  Types                                                                      */
/* ========================================================================== */

export type Suit = "♠" | "♥" | "♦" | "♣";
export type AceMode = "low" | "high";

export interface Card {
  rank: number; // 2..14 (11=J 12=Q 13=K 14=A)
  suit: Suit;
  value: number; // signed point value under the active ace mode
}

export interface Quote {
  bid: number;
  ask: number;
  bidSize: number;
  askSize: number;
}

export interface GameConfig {
  numBots: number; // 1..5
  numRounds: number; // reveals happen in rounds 2..numRounds
  aceMode: AceMode;
}

export interface Bot {
  id: number;
  name: string;
  hand: Card[]; // its 2 private cards (hidden from player until settle)
  /** Adverse-selection temperament: higher = trades more aggressively. */
  aggression: number;
}

export interface GameState {
  config: GameConfig;
  playerHand: Card[];
  bots: Bot[];
  community: Card[]; // all community cards (length 3)
  revealedCount: number; // how many community cards are face-up
  totalCards: number; // 2·(bots+1) + 3
  trueTotal: number; // signed sum of every card (the settle value)
  evPerCard: number;
  fills: Fill[]; // player fills, makeMarket perspective (buy = player long)
  roundIdx: number; // 1-based
}

/* ========================================================================== */
/*  Deck + valuation                                                           */
/* ========================================================================== */

const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];
const isRed = (suit: Suit) => suit === "♥" || suit === "♦";

/** Signed point value of a card under the active ace mode. */
export function cardValue(rank: number, suit: Suit, aceMode: AceMode): number {
  if (rank <= 10) return rank * 10; // numbers 2..10, any suit
  if (rank === 14) {
    // Ace
    if (aceMode === "low") return 10;
    return isRed(suit) ? 140 : -140;
  }
  // Faces J/Q/K = 11/12/13 → magnitude 110/120/130, signed by colour.
  const mag = rank * 10;
  return isRed(suit) ? mag : -mag;
}

export function rankLabel(rank: number): string {
  if (rank === 14) return "A";
  if (rank === 13) return "K";
  if (rank === 12) return "Q";
  if (rank === 11) return "J";
  return String(rank);
}

/** A fresh, ordered 52-card deck valued under `aceMode`. */
export function freshDeck(aceMode: AceMode): Card[] {
  const deck: Card[] = [];
  for (let rank = 2; rank <= 14; rank++) {
    for (const suit of SUITS) {
      deck.push({ rank, suit, value: cardValue(rank, suit, aceMode) });
    }
  }
  return deck;
}

/** Mean signed value of a single card over the full deck. */
export function evPerCard(aceMode: AceMode): number {
  const deck = freshDeck(aceMode);
  return round2(deck.reduce((a, c) => a + c.value, 0) / deck.length);
}

export function sumCards(cards: Card[]): number {
  return cards.reduce((a, c) => a + c.value, 0);
}

/* ========================================================================== */
/*  EV estimates                                                               */
/* ========================================================================== */

/** Cards a given observer can see: their own hand + revealed community. */
function revealedCommunity(state: GameState): Card[] {
  return state.community.slice(0, state.revealedCount);
}

/**
 * The PLAYER's fair-value estimate of the settle total:
 *   Σ(own 2 cards) + Σ(revealed community) + (unknown count) × EV/card.
 */
export function playerEV(state: GameState): number {
  const known = sumCards(state.playerHand) + sumCards(revealedCommunity(state));
  const unknown = state.totalCards - state.playerHand.length - state.revealedCount;
  return round2(known + unknown * state.evPerCard);
}

/** A bot's fair-value estimate (it sees its OWN hand + revealed community). */
export function botEV(bot: Bot, state: GameState): number {
  const known = sumCards(bot.hand) + sumCards(revealedCommunity(state));
  const unknown = state.totalCards - bot.hand.length - state.revealedCount;
  return round2(known + unknown * state.evPerCard);
}

/**
 * The change to EV when the next community card flips, from the player's view:
 * `Δ = revealedValue − EV/card`. Handy for the "update fast" coaching line.
 */
export function evUpdateOnReveal(cardValueRevealed: number, evPer: number): number {
  return round2(cardValueRevealed - evPer);
}

/* ========================================================================== */
/*  Spread cap + quote validation                                              */
/* ========================================================================== */

export const MAX_SPREAD = 20;

export interface QuoteValidation {
  ok: boolean;
  error?: string;
}

export function validateQuote(q: Quote): QuoteValidation {
  if (![q.bid, q.ask, q.bidSize, q.askSize].every(Number.isFinite)) {
    return { ok: false, error: "Enter bid, ask and both sizes." };
  }
  if (q.ask <= q.bid) return { ok: false, error: "Ask must be above bid." };
  if (q.ask - q.bid > MAX_SPREAD) {
    return { ok: false, error: `Spread cannot exceed ${MAX_SPREAD}.` };
  }
  if (q.bidSize < 0 || q.askSize < 0) {
    return { ok: false, error: "Sizes cannot be negative." };
  }
  return { ok: true };
}

/* ========================================================================== */
/*  Bot behaviour                                                              */
/* ========================================================================== */

/**
 * A bot posts a two-sided market around its own EV, spread scaled to remaining
 * uncertainty (more unknown cards → wider), capped at MAX_SPREAD. Deterministic
 * given the rng.
 */
export function botQuote(bot: Bot, state: GameState, rng: Rng): Quote {
  const mid = botEV(bot, state);
  const unknown = state.totalCards - bot.hand.length - state.revealedCount;
  // Wider when more is unknown; each bot jitters its centre a touch.
  const half = Math.min(MAX_SPREAD / 2, 4 + Math.round(unknown * 0.9));
  const skew = rng.int(-2, 2);
  const bid = Math.round(mid + skew - half);
  const ask = bid + Math.min(MAX_SPREAD, half * 2);
  const size = rng.int(1, 3);
  return { bid, ask, bidSize: size, askSize: size };
}

export interface BotTrade {
  /** From the PLAYER's perspective. "buy" = player bought (bot sold to player). */
  side: Side;
  price: number;
  size: number;
  botId: number;
  chatter: string;
}

/**
 * Given the PLAYER's posted quote, decide whether a bot trades against it.
 * A bot lifts the player's ask (player SELLS) when its EV is comfortably above
 * the ask; it hits the player's bid (player BUYS) when its EV is below the bid.
 * Trade size scales with the bot's perceived edge and aggression, capped by the
 * player's offered size.
 */
export function botReactToPlayerQuote(
  bot: Bot,
  playerQuote: Quote,
  state: GameState,
): BotTrade | null {
  const ev = botEV(bot, state);
  const threshold = 2; // needs at least this much edge to bother
  // Bot buys from player at the ask → player is SHORT (sold).
  if (ev - playerQuote.ask > threshold && playerQuote.askSize > 0) {
    const edge = ev - playerQuote.ask;
    const size = Math.min(
      playerQuote.askSize,
      Math.max(1, Math.round((edge / 10) * bot.aggression)),
    );
    return {
      side: "sell",
      price: playerQuote.ask,
      size,
      botId: bot.id,
      chatter: `${bot.name} lifts your offer — buys ${size} @ ${playerQuote.ask}.`,
    };
  }
  // Bot sells to player at the bid → player is LONG (bought).
  if (playerQuote.bid - ev > threshold && playerQuote.bidSize > 0) {
    const edge = playerQuote.bid - ev;
    const size = Math.min(
      playerQuote.bidSize,
      Math.max(1, Math.round((edge / 10) * bot.aggression)),
    );
    return {
      side: "buy",
      price: playerQuote.bid,
      size,
      botId: bot.id,
      chatter: `${bot.name} hits your bid — sells ${size} @ ${playerQuote.bid}.`,
    };
  }
  return null;
}

/**
 * Resolve ALL bots against the player's posted quote in one pass. Returns the
 * fills (player perspective) and chatter, respecting the total size offered on
 * each side across bots.
 */
export function resolvePlayerQuote(
  quote: Quote,
  state: GameState,
): { fills: Fill[]; trades: BotTrade[] } {
  let bidLeft = quote.bidSize;
  let askLeft = quote.askSize;
  const fills: Fill[] = [];
  const trades: BotTrade[] = [];
  for (const bot of state.bots) {
    const remainingQuote: Quote = {
      ...quote,
      bidSize: bidLeft,
      askSize: askLeft,
    };
    const t = botReactToPlayerQuote(bot, remainingQuote, state);
    if (!t) continue;
    trades.push(t);
    fills.push({ side: t.side, price: t.price, size: t.size, round: state.roundIdx });
    if (t.side === "buy") bidLeft -= t.size; // bot sold into our bid
    else askLeft -= t.size; // bot bought our ask
  }
  return { fills, trades };
}

/**
 * The player trades against a BOT's posted quote: lifting the bot's ask makes
 * the player LONG (buy); hitting the bot's bid makes the player SHORT (sell).
 */
export function playerTradesBotQuote(
  botQuoteMkt: Quote,
  side: Side,
  size: number,
  round: number,
): Fill {
  const price = side === "buy" ? botQuoteMkt.ask : botQuoteMkt.bid;
  return { side, price, size, round };
}

/* ========================================================================== */
/*  Settlement + post-game (reuses Make-Me-a-Market algorithms)                */
/* ========================================================================== */

export interface Settlement {
  position: number; // signed net lots
  markPnl: number; // net position marked to the true total
  breakEven: BreakEvenResult;
  trueTotal: number;
  twoSided: boolean; // did the player trade BOTH directions? (risk-manager test)
}

export function settle(state: GameState): Settlement {
  const position = netPosition(state.fills);
  const markPnl = markToTrue(state.fills, state.trueTotal);
  const be = breakEven(state.fills);
  const boughtSome = state.fills.some((f) => f.side === "buy");
  const soldSome = state.fills.some((f) => f.side === "sell");
  return {
    position,
    markPnl,
    breakEven: be,
    trueTotal: state.trueTotal,
    twoSided: boughtSome && soldSome,
  };
}

/* ========================================================================== */
/*  Game construction                                                          */
/* ========================================================================== */

const BOT_NAMES = ["Bot Alpha", "Bot Bravo", "Bot Charlie", "Bot Delta", "Bot Echo"];

export function dealGame(rng: Rng, config: GameConfig): GameState {
  const deck = rng.shuffle(freshDeck(config.aceMode));
  let idx = 0;
  const take = (n: number): Card[] => deck.slice(idx, (idx += n));

  const playerHand = take(2);
  const bots: Bot[] = [];
  for (let i = 0; i < config.numBots; i++) {
    bots.push({
      id: i,
      name: BOT_NAMES[i] ?? `Bot ${i + 1}`,
      hand: take(2),
      aggression: round2(0.8 + rng.next() * 1.2), // 0.8 – 2.0
    });
  }
  const community = take(3);

  const totalCards = 2 * (config.numBots + 1) + 3;
  // The settle total is the sum of every dealt card (players + community).
  const allDealt = [playerHand, ...bots.map((b) => b.hand), community].flat();
  const trueTotal = sumCards(allDealt);

  return {
    config,
    playerHand,
    bots,
    community,
    revealedCount: 0,
    totalCards,
    trueTotal,
    evPerCard: evPerCard(config.aceMode),
    fills: [],
    roundIdx: 1,
  };
}

/** Reveal the next community card at the start of a new round (rounds 2..N). */
export function revealNext(state: GameState): GameState {
  const max = state.community.length;
  return {
    ...state,
    revealedCount: Math.min(max, state.revealedCount + 1),
    roundIdx: state.roundIdx + 1,
  };
}

/** Append fills to the game state (immutably). */
export function addFills(state: GameState, fills: Fill[]): GameState {
  if (fills.length === 0) return state;
  return { ...state, fills: [...state.fills, ...fills] };
}

/* ========================================================================== */
/*  Helpers                                                                     */
/* ========================================================================== */

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
