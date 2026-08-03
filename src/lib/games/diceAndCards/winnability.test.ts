import { describe, it, expect } from "vitest";
import { Rng } from "@/lib/rng";
import {
  freshDeck,
  dealRound,
  productEV,
  realizedPnl,
  type GameConfig,
  type Card,
} from "./engine";

/**
 * WINNABILITY (Monte-Carlo). Dice & Cards is a TAKER game that FORCES a trade
 * every round (buy or sell) but lets the player SIZE it (the page offers 1/5/10).
 * So the winning strategy is SIZE DISCIPLINE: press size when the quote gives a
 * real edge (its centre is off the product EV by more than the half-spread),
 * and trade the minimum when it doesn't. E[product] = ∏ factor-means exactly
 * for these configs, so the edge is real.
 *
 * We assert: a size-to-edge player is positive-EV (winnable), while a player who
 * blindly max-sizes one side bleeds — good play beats bad play, by a lot.
 */

const CONFIG: GameConfig = { numCards: 1, numDice: 1, aceMode: "high" };
const EV = productEV(CONFIG); // 8 × 3.5 = 28, exactly E[product]
const N = 40_000;
const BIG = 10;
const SMALL = 1;

/** Run N seeded rounds off a self-refreshing deck, averaging per-round P&L. */
function meanPnl(
  choose: (bid: number, ask: number) => { action: "buy" | "sell"; size: number },
): number {
  const rng = new Rng(7);
  let deck: Card[] = rng.shuffle(freshDeck());
  let total = 0;
  for (let i = 0; i < N; i++) {
    if (deck.length < CONFIG.numCards) deck = rng.shuffle(freshDeck());
    const { round, deck: rest } = dealRound(rng, deck, CONFIG);
    deck = rest;
    const { action, size } = choose(round.quote.bid, round.quote.ask);
    total += realizedPnl(action, size, round.quote, round.product);
  }
  return total / N;
}

describe("Dice & Cards — winnability (size discipline)", () => {
  // Skilled: trade the +edge side; press BIG size only when the edge is real,
  // else trade the minimum (the game forces a trade, so you can't skip).
  const skilled = meanPnl((bid, ask) => {
    const buyEdge = EV - ask;
    const sellEdge = bid - EV;
    if (buyEdge >= sellEdge) {
      return { action: "buy", size: buyEdge > 0 ? BIG : SMALL };
    }
    return { action: "sell", size: sellEdge > 0 ? BIG : SMALL };
  });

  // Bad: always buy the maximum size, ignoring the quote entirely.
  const alwaysMaxBuy = meanPnl(() => ({ action: "buy", size: BIG }));

  // Bad: press BIG size on the WRONG (negative-edge) side.
  const antiEdge = meanPnl((bid, ask) => {
    const buyEdge = EV - ask;
    const sellEdge = bid - EV;
    // pick the worse side and press it
    return buyEdge >= sellEdge
      ? { action: "sell", size: BIG }
      : { action: "buy", size: BIG };
  });

  it("size-to-edge play is positive-EV (winnable)", () => {
    expect(skilled).toBeGreaterThan(0);
  });

  it("blindly max-sizing one side is negative-EV", () => {
    expect(alwaysMaxBuy).toBeLessThan(0);
  });

  it("pressing the wrong side is negative-EV and far worse than skilled", () => {
    expect(antiEdge).toBeLessThan(0);
    expect(skilled).toBeGreaterThan(antiEdge);
  });
});
