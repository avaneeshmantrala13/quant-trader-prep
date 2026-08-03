import { describe, it, expect } from "vitest";
import { Rng } from "@/lib/rng";
import {
  freshDeck,
  evaluateHigherLower,
  resolveBet,
  rankValue,
  type Card,
  type GameConfig,
} from "./engine";

/**
 * WINNABILITY (Monte-Carlo). Next Card Betting is even-money card counting: the
 * exact remaining-card counts give the true P(next card higher/lower), and the
 * Kelly fraction of a side with probability p is max(0, 2p − 1). So betting the
 * higher-probability side is +EV (2p − 1 > 0 whenever p > ½) and betting the
 * lower-probability side is −EV. We draw the outcome from the SAME remaining
 * distribution the probabilities are computed from, so realized frequency
 * matches the counts exactly — the edge is real, not assumed.
 */

const CONFIG: GameConfig = { numSuits: 4, aceMode: "high" };
const N = 40_000;

/**
 * One trial: shuffle a deck, expose a random prefix as "seen", pick the next
 * card as the reference, and the card after that as the ACTUAL outcome. The
 * remaining pool (everything after the reference) is what both the probability
 * and the outcome are drawn from — exactly the game's information state.
 */
function trial(seed: number, chooseSide: (hp: number, lp: number) => "higher" | "lower" | null) {
  const rng = new Rng(seed);
  const shuffled = rng.shuffle(freshDeck(CONFIG));
  // A random number of already-seen cards (never so many that <3 remain).
  const seen = rng.int(0, shuffled.length - 3);
  const reference: Card = shuffled[seen];
  const remaining = shuffled.slice(seen + 1); // pool the next card is drawn from
  const outcome = rng.pick(remaining); // the true next card

  const [higher, lower] = evaluateHigherLower(reference, remaining, CONFIG.aceMode);
  const side = chooseSide(higher.p, lower.p);
  if (!side) return 0;
  // Even-money unit stake on the chosen side.
  return resolveBet("higher-lower", side, 1, outcome, {
    aceMode: CONFIG.aceMode,
    reference,
  });
}

function meanNet(chooseSide: (hp: number, lp: number) => "higher" | "lower" | null): number {
  let total = 0;
  for (let i = 0; i < N; i++) total += trial(9_000 + i, chooseSide);
  return total / N;
}

describe("Next Card Betting — winnability", () => {
  // Skilled: bet the higher-probability side, but only when it's a genuine edge
  // (p > ½). A coin-flip reference (p ≈ ½) is passed — free.
  const skilled = meanNet((hp, lp) => {
    const best = hp >= lp ? "higher" : "lower";
    const bestP = Math.max(hp, lp);
    return bestP > 0.5 ? best : null;
  });

  // Bad: always bet the LOWER-probability side (the losing side of the count).
  const badSide = meanNet((hp, lp) => (hp >= lp ? "lower" : "higher"));

  it("betting the favoured side (p > ½) is positive-EV (winnable)", () => {
    expect(skilled).toBeGreaterThan(0);
  });

  it("betting the unfavoured side is negative-EV", () => {
    expect(badSide).toBeLessThan(0);
  });

  it("skilled counting strictly beats anti-counting", () => {
    expect(skilled).toBeGreaterThan(badSide);
  });
});

// Guards the assumption the sim relies on: rankValue orders the deck sensibly
// so "higher/lower" is a real, computable edge.
describe("Next Card Betting — rank ordering sanity", () => {
  it("ace-high ranks the ace above the king", () => {
    expect(rankValue(14, "high")).toBeGreaterThan(rankValue(13, "high"));
  });
});
