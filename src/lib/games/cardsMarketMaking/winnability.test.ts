import { describe, it, expect } from "vitest";
import { Rng } from "@/lib/rng";
import {
  dealRound,
  analyzeEdge,
  realizedPnl,
  type RoundConfig,
} from "./engine";

/**
 * WINNABILITY (Monte-Carlo). Cards Market Making is a TAKER game: the maker's
 * quote is randomly skewed off the unconditional EV, so on some rounds buying is
 * +EV, on some selling is, on some neither. The whole skill is "trade only the
 * edge". These seeded Monte-Carlo runs assert the game is winnable for a skilled
 * player (trades the EV-correct side ⇒ mean P&L > 0) and punishing for a bad one
 * (trades a fixed side blind ⇒ mean P&L < 0). E[sum of N cards] = N·meanCard
 * exactly, so the edge the skilled player captures is real, not an artifact.
 */

const CONFIG: RoundConfig = { numCards: 3, aceValue: 14, replace: true };
const N = 20_000;

/** Average per-round realized P&L for a strategy over N seeded rounds. */
function meanPnl(strategy: (round: ReturnType<typeof dealRound>) => number): number {
  let total = 0;
  for (let i = 0; i < N; i++) {
    total += strategy(dealRound(new Rng(1_000 + i), CONFIG));
  }
  return total / N;
}

describe("Cards Market Making — winnability", () => {
  // Skilled: trade the EV-correct side (buy when ask < EV, sell when bid > EV),
  // size 1, and pass when there's no edge.
  const skilled = meanPnl((r) => {
    const edge = analyzeEdge(r.quote, r.evSum);
    if (edge.correctAction === "none") return 0;
    return realizedPnl(edge.correctAction, 1, r.quote, r.sum);
  });

  // Bad: always buy one lot, ignoring where the quote sits vs EV.
  const alwaysBuy = meanPnl((r) => realizedPnl("buy", 1, r.quote, r.sum));

  // Worst: deliberately trade AGAINST the edge (the mirror of skilled).
  const antiEdge = meanPnl((r) => {
    const edge = analyzeEdge(r.quote, r.evSum);
    if (edge.correctAction === "none") return 0;
    const wrong = edge.correctAction === "buy" ? "sell" : "buy";
    return realizedPnl(wrong, 1, r.quote, r.sum);
  });

  it("skilled edge-only play is positive-EV (winnable)", () => {
    expect(skilled).toBeGreaterThan(0);
  });

  it("blindly buying every round is negative-EV", () => {
    expect(alwaysBuy).toBeLessThan(0);
  });

  it("trading against the edge is negative-EV and strictly worse than skilled", () => {
    expect(antiEdge).toBeLessThan(0);
    expect(skilled).toBeGreaterThan(antiEdge);
  });
});
