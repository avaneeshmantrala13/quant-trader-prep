import { describe, expect, it } from "vitest";
import {
  betaMean,
  betaMeanCI,
  betaQuantile,
  betaUpdate,
  regularizedIncompleteBeta,
} from "./beta";

describe("betaMean", () => {
  it("mean(1,1) = 0.5", () => {
    expect(betaMean(1, 1)).toBeCloseTo(0.5, 12);
  });
});

describe("betaUpdate", () => {
  it("folds a success into α and a failure into β (ρ=1 no decay)", () => {
    expect(betaUpdate(1, 1, 1)).toEqual({ alpha: 2, beta: 1 });
    expect(betaUpdate(1, 1, 0)).toEqual({ alpha: 1, beta: 2 });
  });

  it("applies ρ decay to the prior counts before folding", () => {
    expect(betaUpdate(4, 4, 1, 0.5)).toEqual({ alpha: 3, beta: 2 });
  });
});

describe("regularizedIncompleteBeta", () => {
  it("I_x(1,1) = x (uniform), so I_0.5(1,1) = 0.5", () => {
    expect(regularizedIncompleteBeta(0.5, 1, 1)).toBeCloseTo(0.5, 10);
    expect(regularizedIncompleteBeta(0.3, 1, 1)).toBeCloseTo(0.3, 10);
  });

  it("boundary values I_1 = 1 and I_0 = 0", () => {
    expect(regularizedIncompleteBeta(1, 2, 5)).toBe(1);
    expect(regularizedIncompleteBeta(0, 2, 5)).toBe(0);
  });

  it("matches a known value: I_0.5(2,2) = 0.5 (symmetric)", () => {
    expect(regularizedIncompleteBeta(0.5, 2, 2)).toBeCloseTo(0.5, 10);
  });
});

describe("betaQuantile", () => {
  it("inverts the uniform: Q(p,1,1) = p", () => {
    expect(betaQuantile(0.5, 1, 1)).toBeCloseTo(0.5, 6);
    expect(betaQuantile(0.975, 1, 1)).toBeCloseTo(0.975, 6);
    expect(betaQuantile(0.025, 1, 1)).toBeCloseTo(0.025, 6);
  });

  it("round-trips with regularizedIncompleteBeta within 1e-6", () => {
    const cases: Array<[number, number, number]> = [
      [0.1, 2, 3],
      [0.5, 5, 5],
      [0.9, 3, 7],
      [0.25, 20, 2],
      [0.975, 8, 8],
    ];
    for (const [p, a, b] of cases) {
      const x = betaQuantile(p, a, b);
      expect(regularizedIncompleteBeta(x, a, b)).toBeCloseTo(p, 6);
    }
  });
});

describe("betaMeanCI", () => {
  it("CI width shrinks as evidence grows", () => {
    const wide = betaMeanCI(2, 2);
    const tight = betaMeanCI(20, 20);
    expect(wide.hi - wide.lo).toBeGreaterThan(tight.hi - tight.lo);
    expect(wide.mean).toBeCloseTo(0.5, 12);
    expect(tight.mean).toBeCloseTo(0.5, 12);
  });

  it("uses the 95% equal-tail interval by default", () => {
    const ci = betaMeanCI(1, 1);
    expect(ci.lo).toBeCloseTo(0.025, 6);
    expect(ci.hi).toBeCloseTo(0.975, 6);
  });
});
