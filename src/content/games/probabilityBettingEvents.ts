/**
 * ============================================================================
 *  PROBABILITY BETTING — EVENT GENERATORS
 * ============================================================================
 * Generates fresh betting events each round for Game 2 (`QuantGames-Mechanics.md`).
 *
 * Every event carries its EXACT true probability (computed from first
 * principles) and a HOUSE odds quote that is deliberately mispriced by a random
 * margin — sometimes generous (positive edge, you should bet), sometimes stingy
 * (negative edge, you should pass). Because the events, their probabilities, and
 * the mispricing are all randomized per round, there is nothing to memorize:
 * the player must actually compute each probability and compare to the quote.
 *
 * Sources (per the doc): two dice, two cards from a fresh deck, three coins.
 * Pure data + math, no React.
 */
import { Rng } from "@/lib/rng";
import {
  fairOdds,
  round2,
  type BettingEvent,
  type Category,
  type RoundEvents,
  type SpecialBet,
} from "@/lib/games/probabilityBetting/engine";

/* ========================================================================== */
/*  Exact probability primitives                                               */
/* ========================================================================== */

/** P(sum of two fair dice ≥ t), t in 2..12. */
function probTwoDiceSumAtLeast(t: number): number {
  let count = 0;
  for (let a = 1; a <= 6; a++)
    for (let b = 1; b <= 6; b++) if (a + b >= t) count++;
  return count / 36;
}

/** P(sum of two fair dice == t). */
function probTwoDiceSumEquals(t: number): number {
  let count = 0;
  for (let a = 1; a <= 6; a++)
    for (let b = 1; b <= 6; b++) if (a + b === t) count++;
  return count / 36;
}

/** P(at least one die shows a specific value) with two dice. */
function probAtLeastOneDie(): number {
  // 1 − P(neither) = 1 − (5/6)^2
  return 1 - (5 / 6) ** 2;
}

/** P(exactly k heads in 3 fair coins). */
function probKHeads(k: number): number {
  const choose = [1, 3, 3, 1][k];
  return choose / 8;
}

/** P(at least k heads in 3 fair coins). */
function probAtLeastKHeads(k: number): number {
  let c = 0;
  for (let i = k; i <= 3; i++) c += [1, 3, 3, 1][i];
  return c / 8;
}

/**
 * Two cards drawn from a fresh 52-card deck (no replacement). Rank value 2..14
 * (Ace high = 14). P(sum of the two ranks ≥ t) computed exactly over all
 * ordered draws.
 */
function probTwoCardsSumAtLeast(t: number, aceHigh: boolean): number {
  const ranks: number[] = [];
  for (let r = 2; r <= 14; r++) {
    const val = r === 14 ? (aceHigh ? 14 : 1) : r;
    for (let s = 0; s < 4; s++) ranks.push(val);
  }
  let total = 0;
  let hit = 0;
  for (let i = 0; i < ranks.length; i++) {
    for (let j = 0; j < ranks.length; j++) {
      if (i === j) continue; // distinct physical cards
      total++;
      if (ranks[i] + ranks[j] >= t) hit++;
    }
  }
  return hit / total;
}

/** P(the two cards are the same colour) — 2 from a fresh deck. */
function probSameColour(): number {
  // 26 same-colour partners out of remaining 51.
  return 25 / 51;
}

/** P(at least one of two cards is a face card J/Q/K). */
function probAtLeastOneFace(): number {
  // 12 faces. 1 − P(none) = 1 − (40/52)(39/51).
  return 1 - (40 / 52) * (39 / 51);
}

/* ========================================================================== */
/*  House-odds mispricing                                                      */
/* ========================================================================== */

/**
 * Turn a true probability into a HOUSE odds quote that is mispriced by a random
 * margin. `edgeBias` in roughly [−0.25, +0.30]: positive → the quote pays more
 * than fair (player should bet), negative → stingy (player should pass). Odds
 * are rounded to 2 decimals like the real game.
 */
function priceWithEdge(trueProb: number, rng: Rng): number {
  const fair = fairOdds(trueProb);
  // Random edge: skew slightly toward offering SOME positive-edge bets.
  const edge = rng.next() * 0.55 - 0.25; // [−0.25, +0.30]
  const odds = fair * (1 + edge);
  return Math.max(0.1, round2(odds));
}

/* ========================================================================== */
/*  Event factories                                                            */
/* ========================================================================== */

type Factory = (rng: Rng, aceHigh: boolean) => BettingEvent;

const diceFactories: Factory[] = [
  (rng) => {
    const t = rng.int(7, 11);
    const p = probTwoDiceSumAtLeast(t);
    return makeEvent("dice", `Sum of two dice is ${t} or more`, p, rng);
  },
  (rng) => {
    const t = rng.pick([6, 7, 8, 9]);
    const p = probTwoDiceSumEquals(t);
    return makeEvent("dice", `Sum of two dice is exactly ${t}`, p, rng);
  },
  (rng) => {
    const v = rng.int(1, 6);
    const p = probAtLeastOneDie();
    return makeEvent("dice", `At least one die shows a ${v}`, p, rng);
  },
];

const coinFactories: Factory[] = [
  (rng) => {
    const k = rng.pick([2, 3]);
    const p = probAtLeastKHeads(k);
    return makeEvent("coins", `At least ${k} of three coins are heads`, p, rng);
  },
  (rng) => {
    const k = rng.pick([1, 2, 3]);
    const p = probKHeads(k);
    return makeEvent("coins", `Exactly ${k} of three coins are heads`, p, rng);
  },
];

const cardFactories: Factory[] = [
  (rng, aceHigh) => {
    const t = rng.int(15, 22);
    const p = probTwoCardsSumAtLeast(t, aceHigh);
    return makeEvent("cards", `Two cards sum to ${t} or more`, p, rng);
  },
  (rng) => {
    const p = probSameColour();
    return makeEvent("cards", `Both cards are the same colour`, p, rng);
  },
  (rng) => {
    const p = probAtLeastOneFace();
    return makeEvent("cards", `At least one card is a face card (J/Q/K)`, p, rng);
  },
];

let seq = 0;
function makeEvent(
  category: Category,
  label: string,
  trueProb: number,
  rng: Rng,
): BettingEvent {
  const houseOdds = priceWithEdge(trueProb, rng);
  const id = `${category}-${seq++}`;
  return {
    id,
    category,
    label,
    trueProb,
    houseOdds,
    // Settler draws a uniform and compares to the true prob — realized
    // frequency matches trueProb exactly in expectation, independent of the
    // human-readable label.
    settle: (r: Rng) => r.next() < trueProb,
  };
}

/* ========================================================================== */
/*  Round assembly                                                             */
/* ========================================================================== */

/**
 * Build one round: `perCategory` events from each of dice / cards / coins, plus
 * the two specials. Factories are sampled without repeating within a category
 * where possible.
 */
export function buildRound(
  rng: Rng,
  perCategory: number,
  aceHigh: boolean,
): RoundEvents {
  const pick = (factories: Factory[], n: number): BettingEvent[] => {
    const order = rng.shuffle(factories);
    const out: BettingEvent[] = [];
    for (let i = 0; i < n; i++) {
      const f = order[i % order.length];
      out.push(f(rng, aceHigh));
    }
    return out;
  };

  const events = [
    ...pick(diceFactories, perCategory),
    ...pick(cardFactories, perCategory),
    ...pick(coinFactories, perCategory),
  ];

  const specials: SpecialBet[] = [
    {
      id: `insurance-${seq++}`,
      kind: "insurance",
      label: "Insurance — pays if your other bets net a LOSS this round",
      houseOdds: round2(0.8 + rng.next() * 1.4), // ~0.8–2.2 : 1
    },
    {
      id: `boost-${seq++}`,
      kind: "boost",
      label: "Boost — pays if your other bets net a PROFIT this round",
      houseOdds: round2(0.6 + rng.next() * 1.2), // ~0.6–1.8 : 1
    },
  ];

  return { events, specials };
}
