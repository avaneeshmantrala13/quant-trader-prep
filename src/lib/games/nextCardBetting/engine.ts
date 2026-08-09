/**
 * ============================================================================
 *  NEXT CARD BETTING — card-counting + Kelly (pure game engine, no React)
 * ============================================================================
 * A card-counting drill dressed as a betting game. You start with 1,000 chips
 * and a deck of 1–4 suits (Ace low OR high). Each CYCLE deals a reference card
 * and (for the range bet) a second boundary card. Every dealt card STAYS
 * VISIBLE on the table, grouped by cycle, so the player can count exactly what
 * remains, compute the TRUE probability of each side, and stake the KELLY
 * fraction of their bankroll.
 *
 * There are up to three bets per cycle (skipping any is free):
 *   1. HIGHER / LOWER than the reference card (by rank value; ties are neither).
 *   2. INSIDE / OUTSIDE the range spanned by the two boundary cards (endpoints
 *      excluded on both sides — "inside" is strictly between).
 *   3. NEW SUIT? — only meaningful with 2+ suits: does the next card show a
 *      suit not yet seen among the visible cards.
 *
 * Payouts are EVEN MONEY (1:1), so the Kelly fraction of a side with true
 * probability p is f* = max(0, 2p − 1): P=0.6→0.2, P=0.7→0.4, P=1→1, and any
 * side with p ≤ 0.5 has f* = 0 (skipping is correct).
 *
 * Everything is derived from the exact remaining-card counts, so the true
 * probabilities are computed as exact rationals; only Kelly fractions and
 * scores are rounded to 2 decimals for display.
 */
import { Rng } from "@/lib/rng";

/* ========================================================================== */
/*  Types                                                                      */
/* ========================================================================== */

export type Suit = "♠" | "♥" | "♦" | "♣";

export type AceMode = "low" | "high";

export interface Card {
  /** 2–14, where 11=J 12=Q 13=K 14=A. */
  rank: number;
  suit: Suit;
}

export type BetType = "higher-lower" | "inside-outside" | "new-suit";

export interface GameConfig {
  numSuits: 1 | 2 | 3 | 4;
  aceMode: AceMode;
}

/** One selectable side of a bet, with its true probability and Kelly size. */
export interface BetOption {
  label: string;
  side: string;
  /** TRUE probability of this side over the remaining cards. */
  p: number;
  /** Even-money Kelly fraction = max(0, 2p − 1). */
  kelly: number;
}

/** Context needed to resolve a bet against the drawn card. */
export interface BetContext {
  aceMode: AceMode;
  reference?: Card;
  low?: Card;
  high?: Card;
  visibleSuits?: Set<Suit>;
}

/** State produced by dealing one cycle. */
export interface CycleState {
  /** The reference card for Higher/Lower. */
  reference: Card;
  /** Lower boundary card for Inside/Outside (by rank value). */
  low: Card;
  /** Upper boundary card for Inside/Outside (by rank value). */
  high: Card;
  /** The deck after the cycle's cards were removed. */
  deck: Card[];
  /** All cards on the table after this cycle (grouped history + new). */
  visible: Card[];
}

/* ========================================================================== */
/*  Rank value + deck                                                          */
/* ========================================================================== */

const SUIT_ORDER: Suit[] = ["♠", "♥", "♦", "♣"];

/**
 * Numeric rank value under the active ace mode. Ace (stored as rank 14) is 1
 * when ace-low and 14 when ace-high; every other rank keeps its stored value
 * (2..10 = pip, J=11, Q=12, K=13).
 */
export function rankValue(rank: number, aceMode: AceMode): number {
  if (rank === 14) return aceMode === "low" ? 1 : 14;
  return rank;
}

/** The first N suits from the canonical order ♠ ♥ ♦ ♣. */
export function suitsFor(numSuits: number): Suit[] {
  return SUIT_ORDER.slice(0, numSuits);
}

/** A fresh, ordered deck: numSuits × 13 cards (ranks 2..14). */
export function freshDeck(config: GameConfig): Card[] {
  const deck: Card[] = [];
  for (const suit of suitsFor(config.numSuits)) {
    for (let rank = 2; rank <= 14; rank++) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

/**
 * Deck minus the visible cards, removing exactly ONE occurrence per visible
 * card (matched by rank+suit). A visible card with no match in the deck is
 * ignored.
 */
export function remainingCards(deck: Card[], visible: Card[]): Card[] {
  const remaining = deck.slice();
  for (const v of visible) {
    const idx = remaining.findIndex((c) => c.rank === v.rank && c.suit === v.suit);
    if (idx >= 0) remaining.splice(idx, 1);
  }
  return remaining;
}

/* ========================================================================== */
/*  Counting → probability                                                     */
/* ========================================================================== */

/** P(next card strictly HIGHER than the reference). Ties count as neither. */
export function pHigher(reference: Card, remaining: Card[], aceMode: AceMode): number {
  if (remaining.length === 0) return 0;
  const ref = rankValue(reference.rank, aceMode);
  const fav = remaining.filter((c) => rankValue(c.rank, aceMode) > ref).length;
  return fav / remaining.length;
}

/** P(next card strictly LOWER than the reference). Ties count as neither. */
export function pLower(reference: Card, remaining: Card[], aceMode: AceMode): number {
  if (remaining.length === 0) return 0;
  const ref = rankValue(reference.rank, aceMode);
  const fav = remaining.filter((c) => rankValue(c.rank, aceMode) < ref).length;
  return fav / remaining.length;
}

/** P(next card strictly INSIDE the range) — between low & high, endpoints excluded. */
export function pInside(low: Card, high: Card, remaining: Card[], aceMode: AceMode): number {
  if (remaining.length === 0) return 0;
  const lo = rankValue(low.rank, aceMode);
  const hi = rankValue(high.rank, aceMode);
  const fav = remaining.filter((c) => {
    const v = rankValue(c.rank, aceMode);
    return v > lo && v < hi;
  }).length;
  return fav / remaining.length;
}

/** P(next card strictly OUTSIDE the range) — above high OR below low. */
export function pOutside(low: Card, high: Card, remaining: Card[], aceMode: AceMode): number {
  if (remaining.length === 0) return 0;
  const lo = rankValue(low.rank, aceMode);
  const hi = rankValue(high.rank, aceMode);
  const fav = remaining.filter((c) => {
    const v = rankValue(c.rank, aceMode);
    return v > hi || v < lo;
  }).length;
  return fav / remaining.length;
}

/** P(next card's suit is one NOT yet appeared among the visible cards). */
export function pNewSuit(visibleSuits: Set<Suit>, remaining: Card[]): number {
  if (remaining.length === 0) return 0;
  const fav = remaining.filter((c) => !visibleSuits.has(c.suit)).length;
  return fav / remaining.length;
}

/* ========================================================================== */
/*  Kelly + options                                                            */
/* ========================================================================== */

/** Even-money Kelly fraction of bankroll: max(0, 2p − 1), rounded to 2 dp. */
export function kellyFraction(p: number): number {
  return Math.max(0, round2(2 * p - 1));
}

/**
 * Per-bet SIZING credit ∈ [0,1] for staking `chosenFraction` of bankroll on a
 * side of true probability `p`, measured as closeness to that side's even-money
 * Kelly fraction f* = max(0, 2p − 1). Mirrors {@link sizingScore}'s closeness
 * kernel: `1 − min(1, |chosen − kelly| / kelly)` when a +EV Kelly stake exists,
 * and (for a ≤50% side where the correct stake is zero) full credit only for NOT
 * staking. So betting exactly Kelly on a good side ⇒ 1, wildly over/under-sizing
 * ⇒ →0, and staking anything on a −EV side ⇒ 0.
 */
export function kellySizingCredit(p: number, chosenFraction: number): number {
  const k = kellyFraction(p);
  if (k <= 0) return chosenFraction <= 0 ? 1 : 0;
  return round2(Math.max(0, 1 - Math.min(1, Math.abs(chosenFraction - k) / k)));
}

/**
 * ONE next-card round's combined COUNTING + KELLY credit ∈ [0,1] — the signal the
 * battery station folds. It rewards two things at once:
 *   1. the DECISION (counting): bet the >50% side, or skip when neither clears
 *      50% (a ≤50% round's correct play is to stand aside), and
 *   2. the SIZING (Kelly): once on the right side, stake near f* = 2p − 1.
 *
 * Grading:
 *   • No +EV side (best p ≤ 0.5): skipping (fraction ≤ 0) ⇒ 1; staking ⇒ 0.
 *   • A +EV side exists: staking the WRONG side or skipping ⇒ 0 (missed edge);
 *     staking the RIGHT side ⇒ `kellySizingCredit(bestP, chosenFraction)`.
 */
export function roundKellyCredit(
  options: BetOption[],
  chosenSide: string,
  chosenFraction: number,
): number {
  const best = bestOption(options);
  const shouldBet = best.p > 0.5;
  if (!shouldBet) {
    return chosenSide === "skip" || chosenFraction <= 0 ? 1 : 0;
  }
  if (chosenSide !== best.side || chosenFraction <= 0) return 0;
  return kellySizingCredit(best.p, chosenFraction);
}

/** The +EV side to bet: the option with the highest true probability. */
export function bestOption(options: BetOption[]): BetOption {
  return options.reduce((best, o) => (o.p > best.p ? o : best));
}

/** Higher / Lower options for the reference card. */
export function evaluateHigherLower(
  reference: Card,
  remaining: Card[],
  aceMode: AceMode,
): BetOption[] {
  const hp = pHigher(reference, remaining, aceMode);
  const lp = pLower(reference, remaining, aceMode);
  return [
    { label: "Higher", side: "higher", p: hp, kelly: kellyFraction(hp) },
    { label: "Lower", side: "lower", p: lp, kelly: kellyFraction(lp) },
  ];
}

/** Inside / Outside options for the boundary range. */
export function evaluateInsideOutside(
  low: Card,
  high: Card,
  remaining: Card[],
  aceMode: AceMode,
): BetOption[] {
  const ip = pInside(low, high, remaining, aceMode);
  const op = pOutside(low, high, remaining, aceMode);
  return [
    { label: "Inside", side: "inside", p: ip, kelly: kellyFraction(ip) },
    { label: "Outside", side: "outside", p: op, kelly: kellyFraction(op) },
  ];
}

/**
 * New Suit / Not New options (only meaningful with 2+ suits — with 1 suit
 * P(new) is 0). Both probabilities are computed directly from remaining counts.
 */
export function evaluateNewSuit(
  visibleSuits: Set<Suit>,
  remaining: Card[],
): BetOption[] {
  const np = pNewSuit(visibleSuits, remaining);
  const total = remaining.length;
  const notNew = total === 0
    ? 0
    : remaining.filter((c) => visibleSuits.has(c.suit)).length / total;
  return [
    { label: "New Suit", side: "new", p: np, kelly: kellyFraction(np) },
    { label: "Not New", side: "not-new", p: notNew, kelly: kellyFraction(notNew) },
  ];
}

/* ========================================================================== */
/*  Resolution + payout (even money)                                           */
/* ========================================================================== */

/** Does the chosen side WIN given the drawn card and context? */
export function decideWin(
  betType: BetType,
  side: string,
  drawn: Card,
  ctx: BetContext,
): boolean {
  const v = rankValue(drawn.rank, ctx.aceMode);
  if (betType === "higher-lower") {
    if (!ctx.reference) return false;
    const ref = rankValue(ctx.reference.rank, ctx.aceMode);
    return side === "higher" ? v > ref : v < ref;
  }
  if (betType === "inside-outside") {
    if (!ctx.low || !ctx.high) return false;
    const lo = rankValue(ctx.low.rank, ctx.aceMode);
    const hi = rankValue(ctx.high.rank, ctx.aceMode);
    return side === "inside" ? v > lo && v < hi : v > hi || v < lo;
  }
  // new-suit
  if (!ctx.visibleSuits) return false;
  const isNew = !ctx.visibleSuits.has(drawn.suit);
  return side === "new" ? isNew : !isNew;
}

/**
 * Even-money resolution: a winning side returns +stake, a losing side −stake.
 * A stake of 0 (skip) always nets 0.
 */
export function resolveBet(
  betType: BetType,
  side: string,
  stake: number,
  drawn: Card,
  ctx: BetContext,
): number {
  if (stake <= 0) return 0;
  return decideWin(betType, side, drawn, ctx) ? stake : -stake;
}

/* ========================================================================== */
/*  Skill scoring (leaderboard = balance × skill / 10)                         */
/* ========================================================================== */

/** A stake the player actually placed, for sizing evaluation. */
export interface PlacedBet {
  /** True probability of the side bet on. */
  p: number;
  /** Optimal Kelly fraction for that side (max(0, 2p − 1)). */
  kelly: number;
  /** Fraction of bankroll the player actually staked. */
  actualFraction: number;
  /** Whether the player placed a stake at all. */
  staked: boolean;
}

/** A cycle's best-side decision, for decision evaluation. */
export interface RoundDecision {
  /** True probability of the BEST (highest-p) side this round. */
  bestP: number;
  /** Did the player place any stake this round? */
  bet: boolean;
}

/**
 * SIZING score (0–7). For each +EV bet the player actually took (staked with
 * p > 0.5), closeness to Kelly is 1 − min(1, |actualFraction − kelly| / kelly);
 * closeness is averaged and scaled to 0–7, then multiplied by the coverage
 * ratio (good bets taken ÷ good bets available). Betting exactly Kelly on every
 * available +EV side scores a full 7; far-off stakes or ignoring good bets both
 * drag it down. Returns 0 when there are no good bets available or none taken.
 */
export function sizingScore(bets: PlacedBet[]): number {
  const goodAvailable = bets.filter((b) => b.p > 0.5).length;
  if (goodAvailable === 0) return 0;
  const takenGood = bets.filter((b) => b.staked && b.p > 0.5);
  if (takenGood.length === 0) return 0;

  let sumCloseness = 0;
  for (const b of takenGood) {
    const closeness =
      b.kelly > 0
        ? 1 - Math.min(1, Math.abs(b.actualFraction - b.kelly) / b.kelly)
        : b.actualFraction === 0
          ? 1
          : 0;
    sumCloseness += closeness;
  }
  const avgCloseness = sumCloseness / takenGood.length;
  const coverage = takenGood.length / goodAvailable;
  return round2(avgCloseness * 7 * coverage);
}

/**
 * DECISION score (0–3): the share of +EV rounds (best side p > 0.5) the player
 * actually bet on, scaled to 0–3. Skipping a >50% side hurts; betting a ≤50%
 * side or skipping it is fine (those rounds don't count). Full marks when there
 * are no +EV rounds to miss.
 */
export function decisionScore(rounds: RoundDecision[]): number {
  const good = rounds.filter((r) => r.bestP > 0.5);
  if (good.length === 0) return 3;
  const betOn = good.filter((r) => r.bet).length;
  return round2((betOn / good.length) * 3);
}

/** Total skill 0–10 = sizing (0–7) + decision (0–3). */
export function skillScore(bets: PlacedBet[], rounds: RoundDecision[]): number {
  return round2(sizingScore(bets) + decisionScore(rounds));
}

/** Leaderboard value combines bankroll and skill: balance × skill / 10. */
export function leaderboardScore(balance: number, skill: number): number {
  return round2((balance * skill) / 10);
}

/* ========================================================================== */
/*  Cycle dealing                                                              */
/* ========================================================================== */

/**
 * Deal one cycle: draw a reference card and a second boundary card from the
 * deck, order the two by rank value into low/high, and append both to the
 * visible table. Deterministic given the Rng. Returns the updated deck and
 * visible list so a page can drive successive cycles.
 */
export function dealCycle(
  rng: Rng,
  deck: Card[],
  config: GameConfig,
  visible: Card[] = [],
): CycleState {
  const shuffled = rng.shuffle(deck);
  const reference = shuffled[0];
  const second = shuffled[1];
  const restDeck = shuffled.slice(2);

  const refV = rankValue(reference.rank, config.aceMode);
  const secV = rankValue(second.rank, config.aceMode);
  const [low, high] = refV <= secV ? [reference, second] : [second, reference];

  return {
    reference,
    low,
    high,
    deck: restDeck,
    visible: [...visible, reference, second],
  };
}

/* ========================================================================== */
/*  Constants + helpers                                                        */
/* ========================================================================== */

export const START_CHIPS = 1000;

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
