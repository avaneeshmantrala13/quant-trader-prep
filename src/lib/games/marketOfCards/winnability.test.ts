import { describe, it, expect } from "vitest";
import { Rng } from "@/lib/rng";
import {
  dealGame,
  revealNext,
  addFills,
  playerEV,
  resolvePlayerQuote,
  settle,
  type Quote,
} from "./engine";

/**
 * WINNABILITY (Monte-Carlo). Market of Cards is a MAKER game: the whole skill is
 * pricing the signed table total from your two cards and quoting a tight,
 * two-sided, well-CENTRED market. These seeded runs drive the engine's own
 * counterparty/settlement code over thousands of deals with a fixed policy and
 * assert the game is (a) winnable for a skilled maker — a quote centred on the
 * information-correct EV is positive-EV — and (b) PUNISHING for mis-pricing: a
 * quote pushed off-centre is adversely selected and loses EV, worse the further
 * off it sits. This guards the F4 fairness fix (mis-pricing used to be a wash).
 */

const N = 5000;

/** Mean end-of-game mark-to-true P&L for a quoting policy over N seeded deals. */
function meanPnl(mk: (ev: number) => Quote, numRounds = 4): { avg: number; winRate: number } {
  let sum = 0;
  let wins = 0;
  for (let i = 0; i < N; i++) {
    const rng = new Rng(90_000 + i);
    let g = dealGame(rng, { numBots: 3, numRounds, aceMode: "high" });
    for (let r = 1; r <= numRounds; r++) {
      const q = mk(playerEV(g));
      g = addFills(g, resolvePlayerQuote(q, g, rng).fills);
      if (r < numRounds) g = revealNext(g);
    }
    const p = settle(g).markPnl;
    sum += p;
    if (p >= 0) wins++;
  }
  return { avg: sum / N, winRate: wins / N };
}

/** A tight two-sided market centred on `mid`, size 2 each side. */
const market = (mid: number, half = 4): Quote => ({
  bid: Math.round(mid - half),
  ask: Math.round(mid + half),
  bidSize: 2,
  askSize: 2,
});

describe("Market of Cards — winnability", () => {
  const good = meanPnl((ev) => market(ev)); // centred on your EV
  const off40 = meanPnl((ev) => market(ev + 40)); // 40 off-centre
  const off150 = meanPnl((ev) => market(ev + 150)); // 150 off-centre

  it("good, centred two-sided play is positive-EV (winnable)", () => {
    expect(good.avg).toBeGreaterThan(0);
    expect(good.winRate).toBeGreaterThan(0.6);
  });

  it("a 40-off-centre quote is adversely selected → negative-EV, clearly worse than good", () => {
    expect(off40.avg).toBeLessThan(0);
    expect(off40.avg).toBeLessThan(good.avg - 50);
  });

  it("EV keeps falling as the mis-price grows (150-off is far worse than 40-off)", () => {
    expect(off150.avg).toBeLessThan(off40.avg);
    expect(off150.avg).toBeLessThan(-300); // a wild mis-price bleeds hard
  });

  it("good centring meaningfully beats bad centring in expected P&L", () => {
    expect(good.avg - off40.avg).toBeGreaterThan(50);
  });
});
