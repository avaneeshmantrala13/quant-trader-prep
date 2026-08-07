import { describe, it, expect } from "vitest";
import { Rng } from "@/lib/rng";
import { counterpartyTight, markToTrue, type Fill, type Quote } from "./engine";

/**
 * WINNABILITY (Monte-Carlo). Make Me a Market is a MAKER game: quote a tight,
 * well-CENTRED two-sided market and uninformed flow pays your half-spread, while
 * an informed counterparty picks off a mis-centred quote. These seeded runs
 * drive the engine's own `counterpartyTight` + `markToTrue` over thousands of
 * games with fixed policies and assert:
 *   (a) EXCELLENT play (perfect valuation, ~half-cap spread) is clearly positive,
 *   (b) DECENT play (a realistic ±10% valuation error, sensible spread) is
 *       roughly break-even-to-positive — the game is winnable for a skilled-but-
 *       human estimator, not only a perfect one (guards the F1 fix),
 *   (c) genuinely BAD play is punished: an OFFSIDE market bleeds, and a STUPID-
 *       WIDE market earns far less than a sensible one (never a real earn).
 *
 * A single representative scenario (true 300, cap 100 ≈ 1/3 of value — the
 * scenario generator's niceSpread) keeps the P&L stable and interpretable; the
 * ±10% error is re-drawn every round to model an imperfect but unbiased valuer.
 */

const TRUE = 300;
const MAX = 100; // ≈ niceSpread(300): the tight-round spread cap
const TIGHT_ROUNDS = 4;
const AGGRESSION = 0.8; // matches the standalone game's counterparty aggression
const N = 4000;

type Policy = (rng: Rng) => Quote;

/** Mean mark-to-true P&L for a per-round quoting policy over N seeded games. */
function meanPnl(policy: Policy): { avg: number; winRate: number } {
  let sum = 0;
  let wins = 0;
  for (let i = 0; i < N; i++) {
    const rng = new Rng(50_000 + i);
    const fills: Fill[] = [];
    for (let r = 2; r <= TIGHT_ROUNDS + 1; r++) {
      const q = policy(rng);
      const a = counterpartyTight(q, TRUE, MAX, r, rng, AGGRESSION);
      if (a.fill) fills.push(a.fill);
    }
    const p = markToTrue(fills, TRUE);
    sum += p;
    if (p >= 0) wins++;
  }
  return { avg: sum / N, winRate: wins / N };
}

/** Centred quote: estimate = truth ± `errFrac`·truth, spread = `spreadFrac`·cap. */
function centred(spreadFrac: number, errFrac = 0): Policy {
  return (rng) => {
    const err = errFrac === 0 ? 0 : (rng.next() * 2 - 1) * errFrac * TRUE;
    const est = TRUE + err;
    const h = (spreadFrac * MAX) / 2;
    return { bid: est - h, ask: est + h, bidSize: 3, askSize: 3 };
  };
}

describe("Make Me a Market — winnability", () => {
  const excellent = meanPnl(centred(0.5, 0)); // perfect valuation, half-cap spread
  const decent = meanPnl(centred(0.5, 0.1)); // realistic ±10% valuation error
  const wide = meanPnl(centred(0.95, 0)); // stupid-wide, even if centred
  const offside = meanPnl((rng) => {
    // Mid pushed ~1 whole cap above truth → truth sits below the bid.
    const h = (0.5 * MAX) / 2;
    void rng;
    return { bid: TRUE + MAX - h, ask: TRUE + MAX + h, bidSize: 3, askSize: 3 };
  });

  it("excellent play (perfect valuation, sensible spread) is clearly positive-EV", () => {
    expect(excellent.avg).toBeGreaterThan(40);
    expect(excellent.winRate).toBeGreaterThan(0.9);
  });

  it("decent play (realistic ±10% valuation error) is break-even-to-positive (F1)", () => {
    expect(decent.avg).toBeGreaterThan(0);
    expect(decent.winRate).toBeGreaterThan(0.6);
  });

  it("an offside market is punished — clearly negative and far worse than good play", () => {
    expect(offside.avg).toBeLessThan(-50);
    expect(offside.avg).toBeLessThan(decent.avg - 100);
  });

  it("a stupid-wide market earns far less than a sensible one (never a real earn)", () => {
    expect(wide.avg).toBeLessThan(excellent.avg / 2);
    expect(wide.avg).toBeLessThan(decent.avg);
  });
});
