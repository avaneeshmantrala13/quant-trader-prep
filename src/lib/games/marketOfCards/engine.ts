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

export { rankLabel } from "@/lib/games/format";

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
 * MAX probability the informed desk picks you off on a round when your market is
 * badly OFFSIDE. The effective rate scales with how far the FAIR value (your
 * information-correct EV) sits outside your posted market (`INFORMED_SPAN`), so
 * a well-centred quote is essentially never adversely selected while a grossly
 * mis-centred one is picked off almost every round. (F4.)
 */
export const INFORMED_RATE_MAX = 0.9;
/** Overhang (points the fair value sits outside your market) that reaches max pick-off rate. */
const INFORMED_SPAN = 22;
/** Points of overhang per lot the informed desk presses (bigger miss → more size). */
const INFORMED_EDGE_PER_LOT = 10;
/** Up to this many informed arrivals can hit a mis-priced quote per round. */
const INFORMED_ARRIVALS = 2;
/** Base rate of UNINFORMED noise flow crossing your market (scaled by tightness). */
export const NOISE_BASE = 0.95;
/** Up to this many independent uninformed orders can arrive per quote. */
const NOISE_ARRIVALS = 3;
/** Largest lot count a single uninformed order takes (capped by the size you show). */
const NOISE_MAX_LOTS = 3;
/**
 * How far your mid can drift from the fair value before UNINFORMED flow dries up.
 * A quote that is obviously stale attracts no random/uninformed trade — only the
 * sharp, adverse flow — so a mis-priced market can no longer "bank the spread"
 * from matched noise to offset its pick-offs. This is what turns mis-pricing
 * into an EV loss instead of a wash (F4).
 */
const NOISE_KILL = 26;

/**
 * Resolve the player's posted quote against a REALISTIC mix of flow, in one
 * pass. Everything is keyed off `fair = playerEV(state)` — the information-
 * correct value of the total given what the PLAYER can see — so the game
 * rewards pricing skill and never punishes the irreducible uncertainty of the
 * hidden cards (a quote centred on your own correct EV is "well-centred" by
 * definition; settlement noise around it is symmetric and washes out).
 *
 * Let `c = mid − fair` be your signed mis-centring and `h` your half-spread.
 * Two flows combine so the game is both WINNABLE and FAIR:
 *
 *   1. INFORMED / ADVERSE FLOW — an informed desk (voiced by the bots) that
 *      knows the fair value picks off the side you've left stale: it hits a bid
 *      you've left too RICH (c > h → you buy above fair) or lifts an offer you've
 *      left too CHEAP (c < −h → you sell below fair). Both the rate and the size
 *      grow with the overhang `max(|c| − h, 0)`, so a well-centred quote is never
 *      picked off, a slightly-off one only occasionally, and a grossly mis-
 *      centred one almost every round for size-scaled losses. EV therefore falls
 *      smoothly and monotonically as |c| grows (F4).
 *
 *   2. UNINFORMED / NOISE FLOW — passing traders cross a SENSIBLE market on both
 *      sides in MATCHED size, so a symmetric, well-centred book stays FLAT and
 *      banks the full spread (pure spread capture — the winnable core). Crucially
 *      this flow DRIES UP as your mid drifts from fair (`NOISE_KILL`): an
 *      obviously stale quote gets no uninformed trade, so it can't bank the
 *      spread to offset the adverse pick-offs. That's what makes a mis-priced
 *      book bleed instead of washing out. Showing only one side (or exhausting a
 *      side) leaves you carrying one-way inventory into the total's variance and
 *      fully exposed to the adverse flow — an EV drag, not just a variance one
 *      (F5).
 *
 * The noise rate also falls as you quote wider (so there's a sweet spot, not
 * "quote the max"). All randomness is from the seeded `rng` for determinism.
 */
export function resolvePlayerQuote(
  quote: Quote,
  state: GameState,
  rng: Rng,
): { fills: Fill[]; trades: BotTrade[] } {
  let bidLeft = quote.bidSize;
  let askLeft = quote.askSize;
  const fills: Fill[] = [];
  const trades: BotTrade[] = [];
  const spread = quote.ask - quote.bid;
  const half = spread / 2;
  const fair = playerEV(state);
  const mid = (quote.bid + quote.ask) / 2;
  const c = mid - fair; // signed mis-centring vs the information-correct value
  const overhang = Math.max(Math.abs(c) - half, 0); // how far fair sits outside your market

  // 1) INFORMED / ADVERSE flow — picks off the stale side, rate & size scaling
  //    with how far off-centre you priced. This is the adverse selection that
  //    punishes mis-pricing (F4).
  const pInformed = INFORMED_RATE_MAX * clamp01(overhang / INFORMED_SPAN);
  for (let k = 0; k < INFORMED_ARRIVALS && overhang > 0; k++) {
    if (bidLeft <= 0 && askLeft <= 0) break;
    if (rng.next() >= pInformed) continue;
    const bot = state.bots[(state.roundIdx + k) % Math.max(1, state.bots.length)];
    const name = bot?.name ?? "An informed desk";
    const want = Math.max(1, Math.round(overhang / INFORMED_EDGE_PER_LOT));
    if (c > 0 && bidLeft > 0) {
      // Mid too high → your bid is too rich → informed hits it, you BUY above fair.
      const size = Math.min(bidLeft, want);
      fills.push({ side: "buy", price: quote.bid, size, round: state.roundIdx });
      trades.push({
        side: "buy",
        price: quote.bid,
        size,
        botId: bot?.id ?? -2,
        chatter: `${name} hits your rich bid — sells ${size} @ ${quote.bid}.`,
      });
      bidLeft -= size;
    } else if (c < 0 && askLeft > 0) {
      // Mid too low → your offer is too cheap → informed lifts it, you SELL below fair.
      const size = Math.min(askLeft, want);
      fills.push({ side: "sell", price: quote.ask, size, round: state.roundIdx });
      trades.push({
        side: "sell",
        price: quote.ask,
        size,
        botId: bot?.id ?? -2,
        chatter: `${name} lifts your cheap offer — buys ${size} @ ${quote.ask}.`,
      });
      askLeft -= size;
    }
  }

  // 2) UNINFORMED noise flow — passing customers, MATCHED two-sided so a centred
  //    book stays flat and banks the spread. Dries up as your mid drifts off fair.
  const tightness = clamp01(1 - spread / (MAX_SPREAD * 1.5));
  const staleMult = clamp01(1 - Math.abs(c) / NOISE_KILL);
  const noiseRate = NOISE_BASE * tightness * staleMult;
  for (let k = 0; k < NOISE_ARRIVALS; k++) {
    if (bidLeft <= 0 && askLeft <= 0) break;
    if (rng.next() >= noiseRate) continue;
    const draw = rng.int(1, NOISE_MAX_LOTS);
    // A customer lifts your offer (you SELL).
    if (askLeft > 0) {
      const size = Math.max(1, Math.min(askLeft, draw));
      fills.push({ side: "sell", price: quote.ask, size, round: state.roundIdx });
      trades.push({
        side: "sell",
        price: quote.ask,
        size,
        botId: -1,
        chatter: `A passing trader lifts your offer — buys ${size} @ ${quote.ask}.`,
      });
      askLeft -= size;
    }
    // A customer hits your bid (you BUY) — matched size so a two-sided book nets flat.
    if (bidLeft > 0) {
      const size = Math.max(1, Math.min(bidLeft, draw));
      fills.push({ side: "buy", price: quote.bid, size, round: state.roundIdx });
      trades.push({
        side: "buy",
        price: quote.bid,
        size,
        botId: -1,
        chatter: `A passing trader hits your bid — sells ${size} @ ${quote.bid}.`,
      });
      bidLeft -= size;
    }
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
/*  Post-game coaching — the REAL "why" (pricing accuracy, then risk)          */
/* ========================================================================== */

export interface SettlementCoaching {
  headline: string;
  detail: string;
  tone: "good" | "bad" | "mixed";
  /** Fraction of traded lots that settled at a LOSS (a proxy for adverse selection). */
  adverseFrac: number;
  twoSided: boolean;
}

/**
 * Grounded post-game coaching that leads with PRICING QUALITY — the skill this
 * game actually trains — instead of the old misleading binary "two-sided ✓/✕"
 * chip that praised a wildly mis-priced quote as a "risk-manager pass" (F4/F5).
 *
 * The verdict is derived from the settled fills:
 *   • `adverseFrac` — the share of your traded lots that settled at a LOSS vs the
 *     true total. A high share on a losing round means the informed flow kept
 *     picking off the side you left stale, i.e. your MID was off — the pricing
 *     lesson the old chip never surfaced.
 *   • two-sidedness / ending inventory — the risk-manager lesson, now a SECONDARY
 *     factor (and, per the engine fix, one-way risk is an EV drag too, not just
 *     variance), never a headline "pass" on its own.
 */
export function coachSettlement(state: GameState, s: Settlement): SettlementCoaching {
  const fills = state.fills;
  const totalLots = fills.reduce((a, f) => a + f.size, 0);
  let adverseLots = 0;
  for (const f of fills) {
    const per = f.side === "buy" ? state.trueTotal - f.price : f.price - state.trueTotal;
    if (per < 0) adverseLots += f.size;
  }
  const adverseFrac = totalLots > 0 ? round2(adverseLots / totalLots) : 0;
  const pct = Math.round(adverseFrac * 100);
  const won = s.markPnl >= 0;
  const evLine = `your EV (Σ your known cards + unknown × ${state.evPerCard}/card)`;

  if (totalLots === 0) {
    return {
      headline: "You never got a fill.",
      detail:
        "Nothing crossed your market, so there's no pricing signal to grade. Quote a tighter, two-sided market centred on your EV so uninformed flow can pay you the spread.",
      tone: "mixed",
      adverseFrac,
      twoSided: s.twoSided,
    };
  }

  if (!won) {
    if (adverseFrac >= 0.5) {
      return {
        headline: "Mis-priced — the informed flow picked you off.",
        detail: `${pct}% of your lots settled at a loss: traders kept taking the side you left stale, so your MID was off — not just your risk. Centre on ${evLine}, and re-centre the instant a community card flips. A two-sided market that isn't centred still bleeds.`,
        tone: "bad",
        adverseFrac,
        twoSided: s.twoSided,
      };
    }
    return {
      headline: "You carried the total's risk and it moved against you.",
      detail: `You finished ${Math.abs(s.position)} lots ${s.position > 0 ? "long" : "short"} into a total that settled the other way. Your centring wasn't terrible (only ${pct}% of lots were picked off), but the open inventory is what cost you — trade the side that FLATTENS you and don't let flow build a one-way position.`,
      tone: "bad",
      adverseFrac,
      twoSided: s.twoSided,
    };
  }

  if (s.twoSided && adverseFrac < 0.4) {
    return {
      headline: "Well-priced and well-managed.",
      detail: `A tight, two-sided market centred on your EV: uninformed flow paid your spread and you stayed near flat (only ${pct}% of lots were adversely selected). This is exactly the maker's edge — keep centring on ${evLine} and updating on every reveal.`,
      tone: "good",
      adverseFrac,
      twoSided: s.twoSided,
    };
  }
  if (!s.twoSided) {
    return {
      headline: "You won — but on one-way risk, not making.",
      detail: `You only traded one side, so you were ${s.position > 0 ? "long" : "short"} into the total's variance. It paid this time, but a one-sided book is an EV drag as well as a variance one — show BOTH sides and let matched flow bank the spread.`,
      tone: "mixed",
      adverseFrac,
      twoSided: s.twoSided,
    };
  }
  return {
    headline: "Profitable, but your pricing was scrappy.",
    detail: `You finished up, but ${pct}% of your lots were adversely selected — you were getting picked off more than a clean quote should. Tighten your centring on ${evLine} so more of your flow is the spread-paying kind.`,
    tone: "mixed",
    adverseFrac,
    twoSided: s.twoSided,
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

/** Clamp a number into [0, 1]. */
function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
