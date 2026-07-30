import { describe, expect, it } from "vitest";
import {
  binomialPmf,
  simulateBinomialCounts,
  sourceMean,
  simulateSampleMeans,
  normalPdf,
  histogramProportions,
  betaPdf,
  orderStatisticPdf,
  orderStatisticMean,
  simulateOrderStatistic,
} from "./distributions";

/** Weighted mean of a proportion/pmf array indexed by k = 0..n. */
function weightedMean(props: number[]): number {
  let m = 0;
  for (let k = 0; k < props.length; k++) m += k * props[k];
  return m;
}

/** Riemann sum of `f` over [a, b] with `steps` subintervals (midpoint rule). */
function integrate(
  f: (x: number) => number,
  a: number,
  b: number,
  steps: number,
): number {
  const h = (b - a) / steps;
  let sum = 0;
  for (let i = 0; i < steps; i++) sum += f(a + (i + 0.5) * h) * h;
  return sum;
}

describe("binomialPmf", () => {
  it("sums to 1 for a range of n and p", () => {
    for (const [n, p] of [
      [10, 0.5],
      [20, 0.3],
      [40, 0.9],
      [7, 0.01],
    ] as const) {
      const pmf = binomialPmf(n, p);
      expect(pmf).toHaveLength(n + 1);
      const total = pmf.reduce((a, b) => a + b, 0);
      expect(total).toBeCloseTo(1, 9);
    }
  });

  it("matches the exact pmf for n=2, p=0.5", () => {
    const pmf = binomialPmf(2, 0.5);
    expect(pmf[0]).toBeCloseTo(0.25, 9);
    expect(pmf[1]).toBeCloseTo(0.5, 9);
    expect(pmf[2]).toBeCloseTo(0.25, 9);
  });

  it("handles the degenerate p=0 and p=1", () => {
    expect(binomialPmf(5, 0)[0]).toBe(1);
    expect(binomialPmf(5, 1)[5]).toBe(1);
  });
});

describe("simulateBinomialCounts", () => {
  it("returns proportions summing to ~1 with mean ≈ n*p", () => {
    const n = 20;
    const p = 0.35;
    const props = simulateBinomialCounts(n, p, 20000, 12345);
    expect(props).toHaveLength(n + 1);
    const total = props.reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 9);
    expect(weightedMean(props)).toBeCloseTo(n * p, 1);
  });
});

describe("simulateSampleMeans", () => {
  it("has an overall mean ≈ sourceMean for each source", () => {
    for (const [kind, param] of [
      ["uniform", 0],
      ["bernoulli", 0.4],
      ["dice", 6],
    ] as const) {
      const means = simulateSampleMeans(kind, param, 10, 4000, 777);
      const avg = means.reduce((a, b) => a + b, 0) / means.length;
      expect(avg).toBeCloseTo(sourceMean(kind, param), 1);
    }
  });
});

describe("normalPdf", () => {
  it("peaks at ~0.3989 for the standard normal at 0", () => {
    expect(normalPdf(0, 0, 1)).toBeCloseTo(0.3989422804, 6);
  });

  it("integrates to ~1 over a wide range", () => {
    expect(integrate((x) => normalPdf(x, 0, 1), -8, 8, 4000)).toBeCloseTo(1, 4);
  });
});

describe("histogramProportions", () => {
  it("produces proportions summing to ~1 when all values are in-domain", () => {
    const hist = histogramProportions([0.1, 0.2, 0.9, 0.95, 0.5], 4, [0, 1]);
    const total = hist.reduce((a, b) => a + b.prop, 0);
    expect(total).toBeCloseTo(1, 9);
    expect(hist).toHaveLength(4);
  });
});

describe("betaPdf", () => {
  it("integrates to ~1 for a few (a, b)", () => {
    for (const [a, b] of [
      [2, 5],
      [3, 3],
      [1, 1],
    ] as const) {
      expect(integrate((x) => betaPdf(x, a, b), 0, 1, 4000)).toBeCloseTo(1, 3);
    }
  });
});

describe("orderStatisticPdf", () => {
  it("integrates to ~1 for min and max", () => {
    const n = 6;
    expect(
      integrate((x) => orderStatisticPdf("min", n, x), 0, 1, 4000),
    ).toBeCloseTo(1, 3);
    expect(
      integrate((x) => orderStatisticPdf("max", n, x), 0, 1, 4000),
    ).toBeCloseTo(1, 3);
    expect(
      integrate((x) => orderStatisticPdf("median", 5, x), 0, 1, 4000),
    ).toBeCloseTo(1, 3);
  });
});

describe("simulateOrderStatistic", () => {
  it("min mean ≈ 1/(n+1)", () => {
    const n = 9;
    const vals = simulateOrderStatistic("min", n, 8000, 42);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    expect(avg).toBeCloseTo(orderStatisticMean("min", n), 2);
  });

  it("max mean ≈ n/(n+1)", () => {
    const n = 9;
    const vals = simulateOrderStatistic("max", n, 8000, 43);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    expect(avg).toBeCloseTo(orderStatisticMean("max", n), 2);
  });

  it("median mean ≈ 0.5 for odd n", () => {
    const vals = simulateOrderStatistic("median", 9, 8000, 44);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    expect(avg).toBeCloseTo(0.5, 2);
  });
});
