import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import {
  HARD_QUANTITY_GENERATORS,
  dealHardQuantity,
  type HardQuantityScenario,
} from "./hardToValueQuantities";

/**
 * Stage-4 hard-to-value content (spec §2 / §10.3 content rule). Every dealt
 * quantity must carry a DEFENSIBLE, verifier-style reference value: the true
 * value is provably the honest rounding of an exact product of the drawn factors
 * (`reference.value === round(reference.raw / reference.scale)`), never a
 * hand-picked number — so there is a real quantity for the make-a-market engine
 * to mark against and nothing to memorise.
 */

/** Sane magnitude bands per generator id (proves the reference is defensible). */
const SANE_RANGE: Record<string, [number, number]> = {
  "lightbulbs-state": [150, 1200], // millions of bulbs
  "streetlights-city": [10, 160], // thousands of lights
  "option-quotes-per-day": [30, 1600], // millions of quotes
  "golf-balls-in-bus": [250, 650], // thousands of balls
  "gas-stations-us": [90, 190], // thousands of stations
  "trades-per-day": [5, 40], // millions of trades
};

function allDeals(seeds: number): HardQuantityScenario[] {
  const out: HardQuantityScenario[] = [];
  for (const gen of HARD_QUANTITY_GENERATORS) {
    for (let s = 0; s < seeds; s++) out.push(gen(new Rng(s * 2654435761)));
  }
  return out;
}

describe("hard-to-value quantities — defensible reference values", () => {
  it("covers the expected trading-flavoured quantities", () => {
    const ids = HARD_QUANTITY_GENERATORS.map((g) => g(new Rng(1)).id);
    expect(new Set(ids)).toEqual(
      new Set([
        "lightbulbs-state",
        "streetlights-city",
        "option-quotes-per-day",
        "golf-balls-in-bus",
        "gas-stations-us",
        "trades-per-day",
      ]),
    );
  });

  it("every deal's true value is the honest rounding of an exact reference", () => {
    for (const sc of allDeals(120)) {
      expect(Number.isFinite(sc.trueValue)).toBe(true);
      expect(sc.trueValue).toBeGreaterThan(0);
      // The engine settles against `trueValue`; it must equal the verifier value.
      expect(sc.reference.value).toBe(sc.trueValue);
      // …and that value is provably round(raw / scale) — a computed reference,
      // not a hand-picked constant.
      expect(sc.reference.value).toBe(
        Math.max(1, Math.round(sc.reference.raw / sc.reference.scale)),
      );
      expect(sc.reference.raw).toBeGreaterThan(0);
      expect(sc.reference.scale).toBeGreaterThan(0);
      expect(sc.reference.rationale.trim().length).toBeGreaterThan(0);
    }
  });

  it("keeps every true value in a defensible magnitude band", () => {
    for (const sc of allDeals(120)) {
      const [lo, hi] = SANE_RANGE[sc.id];
      expect(sc.trueValue, `${sc.id}=${sc.trueValue}`).toBeGreaterThanOrEqual(lo);
      expect(sc.trueValue, `${sc.id}=${sc.trueValue}`).toBeLessThanOrEqual(hi);
    }
  });

  it("gives a strictly-inside, quotable max spread + teaching payoff", () => {
    for (const sc of allDeals(80)) {
      expect(sc.suggestedMaxSpread).toBeGreaterThan(0);
      // A two-sided market must be quotable: the cap sits strictly below the value.
      expect(sc.suggestedMaxSpread).toBeLessThan(sc.trueValue);
      expect(sc.prompt.trim().length).toBeGreaterThan(0);
      expect(sc.unit.trim().length).toBeGreaterThan(0);
      expect(sc.decomposition.length).toBeGreaterThanOrEqual(2);
      expect(sc.anchor.trim().length).toBeGreaterThan(0);
    }
  });

  it("is deterministic for a fixed seed (reproducible / anti-memorisation)", () => {
    for (const gen of HARD_QUANTITY_GENERATORS) {
      const a = gen(new Rng(42));
      const b = gen(new Rng(42));
      expect(a.trueValue).toBe(b.trueValue);
      expect(a.reference.raw).toBe(b.reference.raw);
    }
  });

  it("dealHardQuantity returns a valid, reference-backed scenario", () => {
    const sc = dealHardQuantity(new Rng(7));
    expect(sc.reference.value).toBe(sc.trueValue);
    expect(sc.suggestedMaxSpread).toBeLessThan(sc.trueValue);
  });
});
