import { describe, it, expect } from "vitest";
import { Rng } from "@/lib/rng";
import {
  dealMarket,
  correctAction,
  scoreTrade,
  type Action,
  type MarketConfig,
} from "./engine";

/**
 * WINNABILITY (Monte-Carlo). Fruit Market is a fast TAKER drill: BUY when the
 * true value is above the ask, SELL when below the bid, SKIP inside the quote.
 * Scoring rewards a correct trade with (a fraction of) its edge and forfeits the
 * edge on a wrong-direction trade. So a skilled player who reads the value
 * correctly is strictly positive; a player who trades the wrong way bleeds.
 */

const CONFIG: MarketConfig = { maxPerBag: 9, eventsEnabled: true };
const N = 20_000;
const FULL_TIME = 1; // assume an instant, first-click read

function meanScore(pick: (correct: Action) => Action): number {
  let total = 0;
  for (let i = 0; i < N; i++) {
    const market = dealMarket(new Rng(5_000 + i), CONFIG);
    const correct = correctAction(market.trueValue, market.quote);
    total += scoreTrade(market, pick(correct), FULL_TIME);
  }
  return total / N;
}

const opposite = (a: Action): Action =>
  a === "buy" ? "sell" : a === "sell" ? "buy" : "buy";

describe("Fruit Market — winnability", () => {
  const skilled = meanScore((correct) => correct); // always the right call
  const wrongWay = meanScore((correct) => opposite(correct)); // always wrong

  it("reading the market correctly is positive-EV (winnable)", () => {
    expect(skilled).toBeGreaterThan(0);
  });

  it("trading the wrong direction is negative-EV", () => {
    expect(wrongWay).toBeLessThan(0);
  });

  it("skilled play strictly beats bad play", () => {
    expect(skilled).toBeGreaterThan(wrongWay);
  });
});
