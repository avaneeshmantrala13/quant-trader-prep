import { describe, expect, it } from "vitest";
import {
  estimateAbility2PL,
  itemInformation2PL,
  probability2PL,
  testInformation2PL,
  type IrtResponse,
} from "./irt";
import { Rng } from "@/lib/rng";

describe("probability2PL", () => {
  it("is 0.5 exactly at θ = b regardless of discrimination", () => {
    expect(probability2PL(0, 1, 0)).toBeCloseTo(0.5, 12);
    expect(probability2PL(1.3, 2.5, 1.3)).toBeCloseTo(0.5, 12);
  });

  it("rises with ability and falls with difficulty", () => {
    expect(probability2PL(2, 1, 0)).toBeGreaterThan(probability2PL(0, 1, 0));
    expect(probability2PL(0, 1, 2)).toBeLessThan(probability2PL(0, 1, 0));
  });

  it("higher discrimination steepens the curve around b", () => {
    const flat = probability2PL(0.5, 0.5, 0);
    const steep = probability2PL(0.5, 3, 0);
    expect(steep).toBeGreaterThan(flat); // above b, steeper ⇒ closer to 1
  });
});

describe("itemInformation2PL / testInformation2PL", () => {
  it("item information is maximized at θ = b", () => {
    const atB = itemInformation2PL(0, 1, 0);
    expect(atB).toBeGreaterThan(itemInformation2PL(1.5, 1, 0));
    expect(atB).toBeGreaterThan(itemInformation2PL(-1.5, 1, 0));
    // For a=1 at θ=b: a²·0.25 = 0.25.
    expect(atB).toBeCloseTo(0.25, 12);
  });

  it("test information sums item information", () => {
    const items = [
      { a: 1, b: -1 },
      { a: 1.5, b: 0 },
      { a: 0.8, b: 1 },
    ];
    const total = testInformation2PL(0.2, items);
    const manual = items.reduce((s, it) => s + itemInformation2PL(0.2, it.a, it.b), 0);
    expect(total).toBeCloseTo(manual, 12);
    expect(total).toBeGreaterThan(0);
  });
});

describe("estimateAbility2PL", () => {
  it("returns the prior mean with prior SE for no responses", () => {
    const r = estimateAbility2PL([], { priorMean: 0, priorSd: 2 });
    expect(r.theta).toBe(0);
    expect(r.se).toBeCloseTo(2, 12);
    expect(r.n).toBe(0);
  });

  it("recovers a known ability from clean 2PL responses", () => {
    const trueTheta = 1.1;
    const rng = new Rng(2024);
    const bank = Array.from({ length: 50 }, () => ({
      a: 0.8 + rng.next() * 1.2,
      b: -2 + rng.next() * 4,
    }));
    const responses: IrtResponse[] = bank.map((it) => ({
      a: it.a,
      b: it.b,
      score: rng.next() < probability2PL(trueTheta, it.a, it.b) ? 1 : 0,
    }));
    const est = estimateAbility2PL(responses, { priorSd: 3 });
    expect(est.theta).toBeGreaterThan(0.5);
    expect(est.theta).toBeLessThan(1.7);
    expect(est.se).toBeLessThan(0.6);
    expect(est.information).toBeGreaterThan(1);
  });

  it("MAP prior keeps an all-correct response set finite (no divergence)", () => {
    const responses: IrtResponse[] = [
      { a: 1, b: -1, score: 1 },
      { a: 1, b: 0, score: 1 },
      { a: 1, b: 1, score: 1 },
    ];
    const est = estimateAbility2PL(responses, { priorSd: 2, clamp: 6 });
    expect(Number.isFinite(est.theta)).toBe(true);
    expect(est.theta).toBeGreaterThan(0); // all correct ⇒ high ability
    expect(est.theta).toBeLessThanOrEqual(6);
  });

  it("all-wrong drives ability below the prior mean but stays finite", () => {
    const responses: IrtResponse[] = [
      { a: 1, b: -1, score: 0 },
      { a: 1, b: 0, score: 0 },
      { a: 1, b: 1, score: 0 },
    ];
    const est = estimateAbility2PL(responses, { priorSd: 2 });
    expect(est.theta).toBeLessThan(0);
    expect(Number.isFinite(est.theta)).toBe(true);
  });

  it("is deterministic across multi-start given the same seed, and seedable", () => {
    const responses: IrtResponse[] = [
      { a: 1.2, b: -0.5, score: 1 },
      { a: 0.9, b: 0.3, score: 0 },
      { a: 1.5, b: 1.0, score: 1 },
    ];
    const a1 = estimateAbility2PL(responses, { starts: 5, seed: 123 });
    const a2 = estimateAbility2PL(responses, { starts: 5, seed: 123 });
    expect(a1.theta).toBe(a2.theta);
    // Multi-start finds essentially the same optimum as the single start (the
    // penalized 2PL log-posterior is unimodal), just proving seed-stability.
    const single = estimateAbility2PL(responses, { starts: 1 });
    expect(a1.theta).toBeCloseTo(single.theta, 6);
  });

  it("accepts fractional partial-credit scores", () => {
    const responses: IrtResponse[] = [
      { a: 1, b: 0, score: 0.5 },
      { a: 1, b: 0, score: 0.5 },
    ];
    const est = estimateAbility2PL(responses, { priorSd: 3 });
    // Two half-credit responses at b=0 ⇒ ability near the difficulty.
    expect(est.theta).toBeCloseTo(0, 1);
  });

  it("tighter prior SD shrinks the estimate toward the prior mean", () => {
    const responses: IrtResponse[] = [{ a: 1, b: 0, score: 1 }];
    const loose = estimateAbility2PL(responses, { priorSd: 5 });
    const tight = estimateAbility2PL(responses, { priorSd: 0.5 });
    expect(tight.theta).toBeLessThan(loose.theta);
    expect(tight.theta).toBeGreaterThan(0);
  });
});
