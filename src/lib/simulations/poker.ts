/**
 * ============================================================================
 *  POKER — SIMULATION MODEL (pot-odds EV + all-in hand equity)
 * ============================================================================
 * Pure, deterministic-given-seed functions powering the "Real-World Scenarios"
 * POKER sims of the Simulations tab. No React / DOM here — just exact EV math
 * for the pot-odds / call-vs-fold decision, and a correct Texas Hold'em hand
 * evaluator (best 5 of 7) driving a seedable all-in equity simulation whose
 * empirical win/tie share converges to the true probability. Unit-tested in
 * `poker.test.ts`.
 *
 * TEACHES:
 *  - Expected Value: EV(call) = w·(pot + bet) − (1 − w)·bet, and the pot-odds
 *    break-even equity that flips the correct action from fold to call.
 *  - Probability / equity: empirical win rate → true win probability, and a
 *    real hand-vs-hand equity converging over many random boards.
 */
import { Rng } from "@/lib/rng";

// ===========================================================================
//  PART 1 — POT ODDS / EV OF CALLING
// ===========================================================================

/**
 * EV of calling a `bet` into a `pot` with win probability `w` (your equity):
 * win → gain the pot plus their bet (`pot + bet`); lose → forfeit your call
 * (`bet`). `EV(call) = w·(pot + bet) − (1 − w)·bet`. Folding is always EV 0.
 */
export function evOfCall(pot: number, bet: number, w: number): number {
  return w * (pot + bet) - (1 - w) * bet;
}

/**
 * The break-even equity (classic "pot odds"): the win probability at which
 * calling is exactly EV 0, `bet / (pot + 2·bet)`. Call is +EV iff `w` exceeds
 * this; fold otherwise.
 */
export function breakEvenEquity(pot: number, bet: number): number {
  const denom = pot + 2 * bet;
  return denom === 0 ? 0 : bet / denom;
}

/** The EV-optimal decision given your equity `w` and the pot odds. */
export function potOddsDecision(
  pot: number,
  bet: number,
  w: number,
): "call" | "fold" {
  return w > breakEvenEquity(pot, bet) ? "call" : "fold";
}

/**
 * Running empirical win rate over `hands` Bernoulli(`w`) deals: `out[i]` is the
 * proportion of wins over the first `i + 1` hands. Converges to `w`.
 * Deterministic per seed.
 */
export function simulateWinRate(
  w: number,
  hands: number,
  seed: number,
): number[] {
  const rng = new Rng(seed);
  const n = Math.max(0, hands);
  const out: number[] = new Array(n);
  let wins = 0;
  for (let i = 0; i < n; i++) {
    if (rng.chance(w)) wins++;
    out[i] = wins / (i + 1);
  }
  return out;
}

/**
 * Running average realized P&L of ALWAYS calling over `hands` Bernoulli(`w`)
 * deals: win → `+(pot + bet)`, lose → `−bet`. Converges to `evOfCall`.
 * Deterministic per seed.
 */
export function simulateCallPnL(
  pot: number,
  bet: number,
  w: number,
  hands: number,
  seed: number,
): number[] {
  const rng = new Rng(seed);
  const n = Math.max(0, hands);
  const out: number[] = new Array(n);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += rng.chance(w) ? pot + bet : -bet;
    out[i] = sum / (i + 1);
  }
  return out;
}

// ===========================================================================
//  PART 2 — CARDS, HAND EVALUATION & ALL-IN EQUITY
// ===========================================================================

/** A playing card. `rank` 2..14 (11=J,12=Q,13=K,14=A); `suit` 0..3. */
export interface Card {
  rank: number;
  suit: number;
}

/** Suit glyphs indexed by suit id (0..3). */
export const SUIT_GLYPHS = ["\u2663", "\u2666", "\u2665", "\u2660"]; // ♣ ♦ ♥ ♠

/** Convenience constructor. */
export function card(rank: number, suit: number): Card {
  return { rank, suit };
}

/** Stable 0..51 id for a card (used for deck membership / dedup). */
export function cardId(c: Card): number {
  return (c.rank - 2) * 4 + c.suit;
}

/** Human label like "A♠" / "10♦". */
export function formatCard(c: Card): string {
  const r =
    c.rank === 14
      ? "A"
      : c.rank === 13
        ? "K"
        : c.rank === 12
          ? "Q"
          : c.rank === 11
            ? "J"
            : String(c.rank);
  return `${r}${SUIT_GLYPHS[c.suit] ?? "?"}`;
}

/** Parse a compact card string like "As", "Td", "Kh", "2c". */
export function parseCard(s: string): Card {
  const rankChar = s.slice(0, s.length - 1).toUpperCase();
  const suitChar = s[s.length - 1].toLowerCase();
  const rankMap: Record<string, number> = {
    A: 14,
    K: 13,
    Q: 12,
    J: 11,
    T: 10,
    "10": 10,
    "9": 9,
    "8": 8,
    "7": 7,
    "6": 6,
    "5": 5,
    "4": 4,
    "3": 3,
    "2": 2,
  };
  const suitMap: Record<string, number> = { c: 0, d: 1, h: 2, s: 3 };
  return { rank: rankMap[rankChar], suit: suitMap[suitChar] };
}

/** Parse a space-separated hand like "As Ks". */
export function parseHand(s: string): Card[] {
  return s
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(parseCard);
}

/** The full 52-card deck. */
export function fullDeck(): Card[] {
  const deck: Card[] = [];
  for (let rank = 2; rank <= 14; rank++) {
    for (let suit = 0; suit < 4; suit++) deck.push({ rank, suit });
  }
  return deck;
}

/** Hand-category ranks (higher beats lower) — the first element of a score. */
export const CATEGORY = {
  HIGH_CARD: 0,
  PAIR: 1,
  TWO_PAIR: 2,
  TRIPS: 3,
  STRAIGHT: 4,
  FLUSH: 5,
  FULL_HOUSE: 6,
  QUADS: 7,
  STRAIGHT_FLUSH: 8,
} as const;

/** Distinct ranks present, highest first. */
function distinctRanksDesc(cards: Card[]): number[] {
  const seen = new Set<number>();
  for (const c of cards) seen.add(c.rank);
  return [...seen].sort((a, b) => b - a);
}

/**
 * The high card of the best 5-in-a-row straight from a set of ranks, or `null`.
 * Handles the wheel (A-2-3-4-5, high card 5). Ace is high (14) elsewhere.
 */
function bestStraightHigh(ranks: Set<number>): number | null {
  for (let high = 14; high >= 6; high--) {
    let ok = true;
    for (let r = high; r > high - 5; r--) {
      if (!ranks.has(r)) {
        ok = false;
        break;
      }
    }
    if (ok) return high;
  }
  // Wheel: A treated as low.
  if (
    ranks.has(14) &&
    ranks.has(2) &&
    ranks.has(3) &&
    ranks.has(4) &&
    ranks.has(5)
  ) {
    return 5;
  }
  return null;
}

/** Top `n` distinct ranks not in `exclude`, highest first. */
function topKickers(cards: Card[], exclude: Set<number>, n: number): number[] {
  const out: number[] = [];
  for (const r of distinctRanksDesc(cards)) {
    if (exclude.has(r)) continue;
    out.push(r);
    if (out.length === n) break;
  }
  return out;
}

/**
 * Evaluate the best 5-card poker hand from 5..7 cards, returning a comparable
 * score array `[category, ...tiebreakers]`. Two scores compare lexicographically
 * via {@link compareScore}; a larger score is the stronger hand.
 */
export function evaluate7(cards: Card[]): number[] {
  // Rank multiplicities and per-suit rank lists.
  const rankCount = new Map<number, number>();
  const suits: number[][] = [[], [], [], []];
  for (const c of cards) {
    rankCount.set(c.rank, (rankCount.get(c.rank) ?? 0) + 1);
    suits[c.suit].push(c.rank);
  }

  // Flush suit (only one is possible with <= 7 cards).
  let flushSuit = -1;
  for (let s = 0; s < 4; s++) {
    if (suits[s].length >= 5) flushSuit = s;
  }

  // Straight flush.
  if (flushSuit >= 0) {
    const sfHigh = bestStraightHigh(new Set(suits[flushSuit]));
    if (sfHigh !== null) return [CATEGORY.STRAIGHT_FLUSH, sfHigh];
  }

  const quads: number[] = [];
  const trips: number[] = [];
  const pairs: number[] = [];
  for (const [rank, count] of rankCount) {
    if (count === 4) quads.push(rank);
    else if (count === 3) trips.push(rank);
    else if (count === 2) pairs.push(rank);
  }
  quads.sort((a, b) => b - a);
  trips.sort((a, b) => b - a);
  pairs.sort((a, b) => b - a);

  // Four of a kind.
  if (quads.length > 0) {
    const quad = quads[0];
    const kicker = topKickers(cards, new Set([quad]), 1);
    return [CATEGORY.QUADS, quad, kicker[0] ?? 0];
  }

  // Full house (a trip plus a pair, or two trips).
  if (trips.length >= 1 && (pairs.length >= 1 || trips.length >= 2)) {
    const trip = trips[0];
    const pair = Math.max(trips[1] ?? 0, pairs[0] ?? 0);
    return [CATEGORY.FULL_HOUSE, trip, pair];
  }

  // Flush.
  if (flushSuit >= 0) {
    const top = [...suits[flushSuit]].sort((a, b) => b - a).slice(0, 5);
    return [CATEGORY.FLUSH, ...top];
  }

  // Straight.
  const straightHigh = bestStraightHigh(new Set(cards.map((c) => c.rank)));
  if (straightHigh !== null) return [CATEGORY.STRAIGHT, straightHigh];

  // Three of a kind.
  if (trips.length > 0) {
    const trip = trips[0];
    const k = topKickers(cards, new Set([trip]), 2);
    return [CATEGORY.TRIPS, trip, k[0] ?? 0, k[1] ?? 0];
  }

  // Two pair.
  if (pairs.length >= 2) {
    const [hp, lp] = pairs;
    const kicker = topKickers(cards, new Set([hp, lp]), 1);
    return [CATEGORY.TWO_PAIR, hp, lp, kicker[0] ?? 0];
  }

  // One pair.
  if (pairs.length === 1) {
    const pair = pairs[0];
    const k = topKickers(cards, new Set([pair]), 3);
    return [CATEGORY.PAIR, pair, k[0] ?? 0, k[1] ?? 0, k[2] ?? 0];
  }

  // High card.
  return [CATEGORY.HIGH_CARD, ...distinctRanksDesc(cards).slice(0, 5)];
}

/**
 * Lexicographic comparison of two score arrays: `> 0` if `a` beats `b`, `< 0`
 * if `b` beats `a`, `0` for an exact tie. Missing trailing entries count as 0.
 */
export function compareScore(a: number[], b: number[]): number {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

/** Compare two full 7-card hands: `1` = A wins, `-1` = B wins, `0` = tie. */
export function compareHands(handA: Card[], handB: Card[]): number {
  return compareScore(evaluate7(handA), evaluate7(handB));
}

/** The result of an all-in equity simulation. */
export interface EquityResult {
  /** Running equity for hand A (`win = 1`, `tie = 0.5`) over the deals. */
  equity: number[];
  winsA: number;
  winsB: number;
  ties: number;
  deals: number;
}

/**
 * Simulate an all-in preflop showdown: deal 5 community cards from the deck
 * (minus the four known hole cards) over `deals` random boards, evaluate each
 * player's best 5-of-7, and track hand A's running equity (win = 1, tie = 0.5).
 * The running equity converges to hand A's true probability. Deterministic per
 * seed.
 */
export function simulateAllInEquity(
  handA: Card[],
  handB: Card[],
  deals: number,
  seed: number,
): EquityResult {
  const rng = new Rng(seed);
  const used = new Set<number>([...handA, ...handB].map(cardId));
  const deck = fullDeck().filter((c) => !used.has(cardId(c)));
  const n = Math.max(0, deals);
  const equity: number[] = new Array(n);
  let winsA = 0;
  let winsB = 0;
  let ties = 0;
  let cum = 0;

  for (let d = 0; d < n; d++) {
    // Partial Fisher–Yates: draw 5 distinct community cards from the deck.
    const board: Card[] = [];
    for (let k = 0; k < 5; k++) {
      const j = rng.int(k, deck.length - 1);
      const tmp = deck[k];
      deck[k] = deck[j];
      deck[j] = tmp;
      board.push(deck[k]);
    }
    const cmp = compareHands([...handA, ...board], [...handB, ...board]);
    if (cmp > 0) {
      winsA++;
      cum += 1;
    } else if (cmp < 0) {
      winsB++;
    } else {
      ties++;
      cum += 0.5;
    }
    equity[d] = cum / (d + 1);
  }

  return { equity, winsA, winsB, ties, deals: n };
}
