import { describe, it, expect } from "vitest";
import { Rng } from "@/lib/rng";
import {
  edgePct,
  kellyStake,
  settleRound,
  type Stake,
} from "./engine";
import { buildRound } from "@/content/games/probabilityBettingEvents";

/**
 * WINNABILITY (Monte-Carlo). Probability Betting quotes house odds that are
 * randomly mispriced around fair. The skill is "bet only positive-edge events,
 * sized by Kelly". Because each event settles at its TRUE probability, betting
 * the +edge events is positive-EV and betting the −edge events is negative-EV.
 * We settle whole rounds over many seeds and assert the mean P&L split.
 */

const PER_CATEGORY = 2;
const ACE_HIGH = true;
const BANKROLL = 1000;
const N = 6_000;

/** Mean per-round net for a stake policy over N seeded rounds (no specials). */
function meanNet(policy: (edge: number, houseOdds: number, trueProb: number) => number): number {
  let total = 0;
  for (let i = 0; i < N; i++) {
    const rng = new Rng(20_000 + i);
    const round = buildRound(rng, PER_CATEGORY, ACE_HIGH);
    const stakes: Stake[] = round.events.map((e) => ({
      eventId: e.id,
      amount: policy(edgePct(e.houseOdds, e.trueProb), e.houseOdds, e.trueProb),
    }));
    // Settle with a fresh, independent rng stream so the stake policy can't peek.
    const settlement = settleRound(round, stakes, [], new Rng(70_000 + i));
    total += settlement.totalNet;
  }
  return total / N;
}

describe("Probability Betting — winnability", () => {
  // Skilled: Kelly-size every strictly positive-edge event, pass the rest.
  const skilled = meanNet((edge, houseOdds, trueProb) =>
    edge > 1e-9 ? kellyStake(houseOdds, trueProb, BANKROLL) : 0,
  );

  // Bad: stake a flat amount on the NEGATIVE-edge events (paying the vig).
  const badEdge = meanNet((edge) => (edge < -1e-9 ? 50 : 0));

  // Reckless: flat-stake EVERYTHING regardless of edge.
  const betAll = meanNet(() => 50);

  it("Kelly-betting the positive-edge events is positive-EV (winnable)", () => {
    expect(skilled).toBeGreaterThan(0);
  });

  it("betting the negative-edge events is negative-EV", () => {
    expect(badEdge).toBeLessThan(0);
  });

  it("skilled selection strictly beats betting everything blindly", () => {
    expect(skilled).toBeGreaterThan(betAll);
  });
});
