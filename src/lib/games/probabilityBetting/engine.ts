/**
 * ============================================================================
 *  PROBABILITY BETTING — GAME ENGINE (pure model, no React)
 * ============================================================================
 * Faithful implementation of the tradinginterview.com "Probability Betting"
 * game as documented in `QuantGames-Mechanics.md` (Game 2).
 *
 * The house quotes FRACTIONAL ODDS `b:1` on random events from three sources —
 * two dice, two cards (fresh deck), three coins. Each quote implies a
 * probability `1/(b+1)`. The player's job:
 *   1. Compute the TRUE probability of each event (this engine knows it exactly).
 *   2. Bet only where the quote pays MORE than fair (positive edge) — passing
 *      is free; betting fair/negative-edge events is punished in the skill score.
 *   3. SIZE each stake with the Kelly criterion `f* = (b·p − q)/b`.
 *
 * Two SPECIAL bets each round:
 *   • Insurance — wins if your other (regular) bets net a LOSS this round.
 *   • Boost     — wins if your other (regular) bets net a PROFIT this round.
 *
 * Everything is derived from first principles so it's naturally
 * un-memorizable: events, their true probabilities, and the (deliberately
 * mispriced) house odds are generated fresh each round. All probability math is
 * exact rational where it matters; odds are rounded to 2 decimals for display
 * only, and edge/Kelly are computed from the TRUE probability, not the rounded
 * display odds.
 */
import { Rng } from "@/lib/rng";

/* ========================================================================== */
/*  Types                                                                      */
/* ========================================================================== */

export type Category = "dice" | "cards" | "coins";

export interface BettingEvent {
  id: string;
  category: Category;
  /** Human-readable description, e.g. "Sum of two dice is 7 or more". */
  label: string;
  /** TRUE probability of the event (exact). */
  trueProb: number;
  /** House fractional odds `b:1` offered (what the player sees). */
  houseOdds: number;
  /**
   * A deterministic settler: given a fresh Rng, does the event happen?
   * Called once per round at settlement. Uses the SAME true distribution the
   * probability was computed from, so realized frequency matches trueProb.
   */
  settle: (rng: Rng) => boolean;
}

export type SpecialKind = "insurance" | "boost";

export interface SpecialBet {
  id: string;
  kind: SpecialKind;
  label: string;
  /** House fractional odds for the special. */
  houseOdds: number;
}

export interface RoundEvents {
  events: BettingEvent[];
  specials: SpecialBet[];
}

/** A stake the player places on a regular event. */
export interface Stake {
  eventId: string;
  amount: number;
}

/** A stake on a special bet. */
export interface SpecialStake {
  specialId: string;
  amount: number;
}

/* ========================================================================== */
/*  Odds ↔ probability                                                         */
/* ========================================================================== */

/** Implied probability from fractional odds `b:1`  →  1/(b+1). */
export function impliedProb(houseOdds: number): number {
  return 1 / (houseOdds + 1);
}

/** Fair fractional odds for a true probability p  →  (1−p)/p. */
export function fairOdds(trueProb: number): number {
  if (trueProb <= 0) return Infinity;
  return (1 - trueProb) / trueProb;
}

/**
 * Edge % — how much the house quote beats fair, as a fraction of the fair
 * price. Positive means the quote pays more than it should (bet it).
 *
 * Measured as (houseOdds − fairOdds) / fairOdds, matching the doc's examples:
 *   quote 2.86:1 vs fair 2.60:1 → +10%;  4.72 vs 3.74 → +26%;  0.71 vs 0.60 → +18%.
 */
export function edgePct(houseOdds: number, trueProb: number): number {
  const fair = fairOdds(trueProb);
  if (!Number.isFinite(fair) || fair === 0) return 0;
  return (houseOdds - fair) / fair;
}

/* ========================================================================== */
/*  Kelly                                                                       */
/* ========================================================================== */

/**
 * Kelly FRACTION of bankroll `f* = (b·p − q) / b`, where b = net fractional
 * odds, p = true prob, q = 1−p. Clamped to [0, 1]; a non-positive-edge bet
 * returns 0 (don't bet).
 */
export function kellyFraction(houseOdds: number, trueProb: number): number {
  const b = houseOdds;
  const p = trueProb;
  const q = 1 - p;
  if (b <= 0) return 0;
  const f = (b * p - q) / b;
  return f > 0 ? Math.min(1, f) : 0;
}

/** Kelly stake in dollars given a bankroll (rounded to the nearest dollar). */
export function kellyStake(houseOdds: number, trueProb: number, bankroll: number): number {
  return Math.round(kellyFraction(houseOdds, trueProb) * bankroll);
}

/**
 * Sizing EFFICIENCY 0–1: how close the actual stake was to the Kelly optimum.
 *  • Kelly = 0 (no edge): ANY positive stake is 0% efficient; a $0 stake is 100%.
 *  • Kelly > 0: efficiency falls off linearly with the relative distance from
 *    optimal, so both under- and over-betting cost you. Betting exactly Kelly
 *    is 100%; betting 2× or 0× Kelly is 0%.
 */
export function sizingEfficiency(
  actualStake: number,
  kellyOptimal: number,
): number {
  if (kellyOptimal <= 0) return actualStake <= 0 ? 1 : 0;
  const rel = Math.abs(actualStake - kellyOptimal) / kellyOptimal;
  return Math.max(0, 1 - rel);
}

/* ========================================================================== */
/*  Settlement                                                                  */
/* ========================================================================== */

export interface EventResult {
  event: BettingEvent;
  won: boolean;
  stake: number;
  /** Net dollars from this bet: +stake·b on a win, −stake on a loss, 0 if unbet. */
  net: number;
}

export interface SpecialResult {
  special: SpecialBet;
  won: boolean;
  stake: number;
  net: number;
}

export interface RoundSettlement {
  results: EventResult[];
  specials: SpecialResult[];
  /** Net from regular bets only (drives Insurance/Boost). */
  regularNet: number;
  /** Net from specials. */
  specialNet: number;
  /** Total net this round. */
  totalNet: number;
}

/**
 * Settle a round. Each regular event is resolved by its own settler; specials
 * resolve against the sign of the regular net (Insurance wins on a loss, Boost
 * on a profit). A regular net of exactly 0 counts as neither a profit nor a
 * loss, so both specials lose (matches "wins if bets net a LOSS / PROFIT").
 */
export function settleRound(
  round: RoundEvents,
  stakes: Stake[],
  specialStakes: SpecialStake[],
  rng: Rng,
): RoundSettlement {
  const stakeMap = new Map(stakes.map((s) => [s.eventId, s.amount]));

  const results: EventResult[] = round.events.map((event) => {
    const stake = stakeMap.get(event.id) ?? 0;
    const won = event.settle(rng);
    let net = 0;
    if (stake > 0) net = won ? stake * event.houseOdds : -stake;
    return { event, won, stake, net: round2(net) };
  });

  const regularNet = round2(results.reduce((a, r) => a + r.net, 0));

  const specialMap = new Map(specialStakes.map((s) => [s.specialId, s.amount]));
  const specials: SpecialResult[] = round.specials.map((special) => {
    const stake = specialMap.get(special.id) ?? 0;
    const won =
      special.kind === "insurance" ? regularNet < 0 : regularNet > 0;
    let net = 0;
    if (stake > 0) net = won ? stake * special.houseOdds : -stake;
    return { special, won, stake, net: round2(net) };
  });

  const specialNet = round2(specials.reduce((a, r) => a + r.net, 0));
  return {
    results,
    specials,
    regularNet,
    specialNet,
    totalNet: round2(regularNet + specialNet),
  };
}

/* ========================================================================== */
/*  Skill scoring (leaderboard = Skill × PnL)                                  */
/* ========================================================================== */

export interface EventGrade {
  event: BettingEvent;
  stake: number;
  impliedProb: number;
  fairOdds: number;
  edgePct: number;
  kellyStake: number;
  efficiency: number;
  /** Was betting this a good DECISION (strictly positive edge)? */
  goodDecision: boolean;
}

/** Grade every event in a round against true probabilities (the review table). */
export function gradeRound(
  round: RoundEvents,
  stakes: Stake[],
  bankroll: number,
): EventGrade[] {
  const stakeMap = new Map(stakes.map((s) => [s.eventId, s.amount]));
  return round.events.map((event) => {
    const stake = stakeMap.get(event.id) ?? 0;
    const edge = edgePct(event.houseOdds, event.trueProb);
    const kOpt = kellyStake(event.houseOdds, event.trueProb, bankroll);
    return {
      event,
      stake,
      impliedProb: impliedProb(event.houseOdds),
      fairOdds: fairOdds(event.trueProb),
      edgePct: edge,
      kellyStake: kOpt,
      efficiency: sizingEfficiency(stake, kOpt),
      goodDecision: edge > 1e-9,
    };
  });
}

export interface SkillScore {
  /** Decision component, 0–7. */
  decision: number;
  /** Sizing component, 0–3. */
  sizing: number;
  /** Total skill 0–10 (before any arbitrage bonus). */
  total: number;
}

/**
 * Skill score 0–10 = Decision (0–7) + Sizing (0–3), aggregated over all graded
 * events across the game.
 *
 *  • DECISION (0–7): reward betting +edge events (scaled by edge size), and
 *    penalise betting fair/negative-edge events. Passing a bad event is free.
 *    We compute the fraction of "edge-weighted opportunity" the player captured
 *    minus a penalty for staked bad bets, mapped onto 0–7.
 *  • SIZING (0–3): average efficiency across the events the player actually bet
 *    that HAD positive edge, mapped onto 0–3. If they bet nothing good, sizing
 *    is 0.
 */
export function skillScore(grades: EventGrade[]): SkillScore {
  let capturedEdge = 0; // edge captured on staked good bets
  let totalGoodEdge = 0; // edge available across all good bets
  let badStakePenalty = 0; // penalty weight for staking bad bets
  const goodBetEffs: number[] = [];

  for (const g of grades) {
    const staked = g.stake > 0;
    if (g.goodDecision) {
      totalGoodEdge += g.edgePct;
      if (staked) {
        capturedEdge += g.edgePct;
        goodBetEffs.push(g.efficiency);
      }
    } else if (staked) {
      // Staked a fair/negative-edge event — a decision error.
      badStakePenalty += 1 + Math.max(0, -g.edgePct);
    }
  }

  const captureRatio = totalGoodEdge > 0 ? capturedEdge / totalGoodEdge : 0;
  // Each bad bet costs ~1 point off the decision score.
  const decision = clamp(captureRatio * 7 - badStakePenalty, 0, 7);

  const avgEff =
    goodBetEffs.length > 0
      ? goodBetEffs.reduce((a, b) => a + b, 0) / goodBetEffs.length
      : 0;
  const sizing = clamp(avgEff * 3, 0, 3);

  return { decision: round2(decision), sizing: round2(sizing), total: round2(decision + sizing) };
}

/* ========================================================================== */
/*  Special-bet arbitrage detector (the advanced trick)                        */
/* ========================================================================== */

/**
 * Detect whether pairing a high-odds regular bet with Insurance can LOCK a
 * guaranteed profit regardless of outcome. Returns the arb if one exists.
 *
 * If you stake `s` on one event at odds `b`, and `i` on Insurance at odds `bi`:
 *   • event wins  → regular net = s·b > 0 → Insurance loses → total = s·b − i
 *   • event loses → regular net = −s < 0 → Insurance wins   → total = i·bi − s
 * A risk-free profit needs BOTH ≥ 0 with at least one > 0. Feasible only when
 * the event odds are high enough that a single loss is covered by Insurance.
 */
export interface ArbSuggestion {
  eventId: string;
  eventStake: number;
  insuranceStake: number;
  guaranteedProfit: number;
}

export function findInsuranceArb(
  round: RoundEvents,
  bankroll: number,
): ArbSuggestion | null {
  const insurance = round.specials.find((s) => s.kind === "insurance");
  if (!insurance) return null;
  const bi = insurance.houseOdds;

  let best: ArbSuggestion | null = null;
  for (const ev of round.events) {
    const b = ev.houseOdds;
    // Choose s = bankroll fraction; solve for i that equalises the two outcomes:
    //   s·b − i = i·bi − s   →   i = s·(b + 1) / (bi + 1)
    const s = Math.round(bankroll * 0.1);
    if (s <= 0) continue;
    const i = Math.round((s * (b + 1)) / (bi + 1));
    if (i <= 0) continue;
    const ifWin = s * b - i;
    const ifLose = i * bi - s;
    const guaranteed = Math.min(ifWin, ifLose);
    if (guaranteed > 0 && (!best || guaranteed > best.guaranteedProfit)) {
      best = {
        eventId: ev.id,
        eventStake: s,
        insuranceStake: i,
        guaranteedProfit: round2(guaranteed),
      };
    }
  }
  return best;
}

/* ========================================================================== */
/*  Constants + helpers                                                         */
/* ========================================================================== */

export const START_BALANCE = 1000;

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
