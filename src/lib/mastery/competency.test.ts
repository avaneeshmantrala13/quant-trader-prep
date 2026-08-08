import { describe, expect, it } from "vitest";
import type { TopicMastery } from "@/types/mastery";
import { deriveVerdict } from "./verdict";
import { MASTERY_BAR } from "./config";
import {
  COMPETENCY_BRAINTEASER,
  COMPETENCY_TRADING,
  brainteaserCredit,
  foldBrainteaserOutcome,
  foldMarketMakingRound,
  marketMakingCredit,
  type MarketMakingRoundOutcome,
} from "./competency";
import {
  COMPETENCY_BRAINTEASER as GATE_BRAINTEASER,
  COMPETENCY_TRADING as GATE_TRADING,
} from "@/lib/pipeline/gates";

/**
 * Competency scorer (spec §3.2). Both nodes are gated by the SAME
 * `deriveVerdict(...).mastered` (Beta CI_low ≥ 0.80) as every content node, so a
 * "mastered" competency means enough good self-eval / edge-capturing outcomes to
 * push the Beta credible-interval lower bound over the 0.80 bar.
 */

const AT = "2026-08-07T00:00:00.000Z";

/** Fold a sequence of brainteaser gots/misses into a fresh node. */
function foldBrainteasers(gots: boolean[]): TopicMastery | undefined {
  let m: TopicMastery | undefined;
  for (const got of gots) m = foldBrainteaserOutcome(m, { got, at: AT });
  return m;
}

/** Fold a sequence of MM round outcomes into a fresh node. */
function foldRounds(rounds: MarketMakingRoundOutcome[]): TopicMastery | undefined {
  let m: TopicMastery | undefined;
  for (const r of rounds) m = foldMarketMakingRound(m, r);
  return m;
}

describe("competency node topicKeys line up with the P0 gate stubs", () => {
  it("match the constants the un-editable gates.ts reads", () => {
    expect(COMPETENCY_BRAINTEASER).toBe(GATE_BRAINTEASER);
    expect(COMPETENCY_TRADING).toBe(GATE_TRADING);
    expect(COMPETENCY_BRAINTEASER).toBe("competency::brainteaser-reasoning");
    expect(COMPETENCY_TRADING).toBe("competency::trading-intuition");
  });
});

describe("credit mapping", () => {
  it("brainteaser: got ⇒ 1, missed ⇒ 0 (decision §10.3 hybrid boolean)", () => {
    expect(brainteaserCredit({ got: true, at: AT })).toBe(1);
    expect(brainteaserCredit({ got: false, at: AT })).toBe(0);
  });

  it("market-making: edge-capturing verdict (decision §10.8)", () => {
    // A positive-P&L, non-picked-off round captured edge ⇒ full credit.
    expect(marketMakingCredit({ pnl: 12, at: AT })).toBe(1);
    // An adverse informed pick-off is the archetypal error ⇒ 0, even if the
    // round's raw P&L happened to be positive.
    expect(marketMakingCredit({ pnl: 5, pickedOff: true, at: AT })).toBe(0);
    // Break-even / negative non-pick-off ⇒ no edge captured ⇒ 0.
    expect(marketMakingCredit({ pnl: 0, at: AT })).toBe(0);
    expect(marketMakingCredit({ pnl: -8, at: AT })).toBe(0);
    // With an edgeScale, partial capture scores proportionally and clamps.
    expect(marketMakingCredit({ pnl: 3, edgeScale: 6, at: AT })).toBeCloseTo(0.5, 6);
    expect(marketMakingCredit({ pnl: 9, edgeScale: 6, at: AT })).toBe(1);
  });
});

describe("brainteaser-reasoning competency gate", () => {
  it("enough clean 'got' outcomes push Beta CI_low ≥ 0.80 (mastered)", () => {
    const m = foldBrainteasers(Array(20).fill(true));
    const v = deriveVerdict(m, COMPETENCY_BRAINTEASER);
    expect(v.lo).toBeGreaterThanOrEqual(MASTERY_BAR);
    expect(v.mastered).toBe(true);
    expect(v.n).toBe(20);
  });

  it("poor / mixed outcomes stay BELOW the bar (not mastered)", () => {
    // A few gots is not enough evidence for the CI_low to clear 0.80.
    expect(deriveVerdict(foldBrainteasers(Array(5).fill(true)), COMPETENCY_BRAINTEASER).mastered).toBe(
      false,
    );
    // Half-and-half — a genuinely shaky reasoner — stays well below the bar.
    const mixed = foldBrainteasers([
      ...Array(10).fill(true),
      ...Array(10).fill(false),
    ]);
    const v = deriveVerdict(mixed, COMPETENCY_BRAINTEASER);
    expect(v.mastered).toBe(false);
    expect(v.lo).toBeLessThan(MASTERY_BAR);
  });

  it("a fresh (no-evidence) node is not mastered", () => {
    expect(deriveVerdict(undefined, COMPETENCY_BRAINTEASER).mastered).toBe(false);
  });
});

describe("trading-intuition competency gate", () => {
  it("enough edge-capturing rounds push Beta CI_low ≥ 0.80 (mastered)", () => {
    const rounds: MarketMakingRoundOutcome[] = Array.from({ length: 20 }, () => ({
      pnl: 10,
      at: AT,
    }));
    const v = deriveVerdict(foldRounds(rounds), COMPETENCY_TRADING);
    expect(v.lo).toBeGreaterThanOrEqual(MASTERY_BAR);
    expect(v.mastered).toBe(true);
  });

  it("repeated adverse pick-offs keep it below the bar (not mastered)", () => {
    // Every round gets picked off ⇒ credit 0 ⇒ Beta collapses toward 0.
    const rounds: MarketMakingRoundOutcome[] = Array.from({ length: 20 }, () => ({
      pnl: -5,
      pickedOff: true,
      at: AT,
    }));
    const v = deriveVerdict(foldRounds(rounds), COMPETENCY_TRADING);
    expect(v.mastered).toBe(false);
    expect(v.mean).toBeLessThan(0.5);
  });

  it("a thin winning streak is not yet enough evidence", () => {
    const rounds: MarketMakingRoundOutcome[] = Array.from({ length: 6 }, () => ({
      pnl: 10,
      at: AT,
    }));
    expect(deriveVerdict(foldRounds(rounds), COMPETENCY_TRADING).mastered).toBe(false);
  });
});
