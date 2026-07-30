import { describe, expect, it } from "vitest";
import {
  intersectionBounds,
  clampIntersection,
  independentIntersection,
  vennMetrics,
  simulateTwoIndependent,
} from "./venn";

describe("intersectionBounds", () => {
  it("uses [max(0,pA+pB-1), min(pA,pB)]", () => {
    expect(intersectionBounds(0.3, 0.4)).toEqual([0, 0.3]);
    // 0.7 + 0.6 - 1 = 0.3 lower bound; min = 0.6 upper bound
    expect(intersectionBounds(0.7, 0.6)).toEqual([
      0.7 + 0.6 - 1,
      0.6,
    ]);
  });
});

describe("clampIntersection", () => {
  it("clamps below the lower bound up to the lower bound", () => {
    // bounds for (0.8, 0.7) = [0.5, 0.7]; asking for 0 -> 0.5
    expect(clampIntersection(0.8, 0.7, 0)).toBeCloseTo(0.5, 12);
  });

  it("clamps above the upper bound down to the upper bound", () => {
    // bounds for (0.3, 0.4) = [0, 0.3]; asking for 0.9 -> 0.3
    expect(clampIntersection(0.3, 0.4, 0.9)).toBeCloseTo(0.3, 12);
  });

  it("leaves a feasible value untouched", () => {
    expect(clampIntersection(0.5, 0.5, 0.25)).toBeCloseTo(0.25, 12);
  });
});

describe("independentIntersection", () => {
  it("returns the product of the marginals", () => {
    expect(independentIntersection(0.5, 0.4)).toBeCloseTo(0.2, 12);
  });
});

describe("vennMetrics", () => {
  it("computes pOr, complements and conditionals on a known case", () => {
    // P(A)=0.5, P(B)=0.4, P(A∩B)=0.2
    const m = vennMetrics({ pA: 0.5, pB: 0.4, pAnd: 0.2 });
    expect(m.pOr).toBeCloseTo(0.7, 12); // 0.5 + 0.4 - 0.2
    expect(m.pOnlyA).toBeCloseTo(0.3, 12);
    expect(m.pOnlyB).toBeCloseTo(0.2, 12);
    expect(m.pNeither).toBeCloseTo(0.3, 12);
    expect(m.pAgivenB).toBeCloseTo(0.5, 12); // 0.2 / 0.4
    expect(m.pBgivenA).toBeCloseTo(0.4, 12); // 0.2 / 0.5
  });

  it("flags independence exactly when pAnd = pA*pB", () => {
    expect(vennMetrics({ pA: 0.5, pB: 0.4, pAnd: 0.2 }).independent).toBe(true);
    expect(vennMetrics({ pA: 0.5, pB: 0.4, pAnd: 0.3 }).independent).toBe(
      false,
    );
  });

  it("flags mutual exclusivity exactly when pAnd = 0", () => {
    expect(vennMetrics({ pA: 0.3, pB: 0.4, pAnd: 0 }).mutuallyExclusive).toBe(
      true,
    );
    expect(
      vennMetrics({ pA: 0.3, pB: 0.4, pAnd: 0.1 }).mutuallyExclusive,
    ).toBe(false);
  });

  it("guards conditionals when a marginal is zero", () => {
    const m = vennMetrics({ pA: 0, pB: 0, pAnd: 0 });
    expect(m.pAgivenB).toBe(0);
    expect(m.pBgivenA).toBe(0);
  });

  it("keeps every probability within [0,1] for feasible input", () => {
    const pA = 0.65;
    const pB = 0.55;
    const pAnd = clampIntersection(pA, pB, 0.4);
    const m = vennMetrics({ pA, pB, pAnd });
    for (const v of [
      m.pOr,
      m.pAnd,
      m.pOnlyA,
      m.pOnlyB,
      m.pNeither,
      m.pAgivenB,
      m.pBgivenA,
    ]) {
      expect(v).toBeGreaterThanOrEqual(-1e-12);
      expect(v).toBeLessThanOrEqual(1 + 1e-12);
    }
  });
});

describe("simulateTwoIndependent", () => {
  it("is deterministic for a fixed seed", () => {
    const a = simulateTwoIndependent(0.5, 0.5, 500, 7);
    const b = simulateTwoIndependent(0.5, 0.5, 500, 7);
    expect(a).toEqual(b);
  });

  it("converges to pA*pB within 0.03 at N=20000", () => {
    const pA = 0.5;
    const pB = 0.4;
    const series = simulateTwoIndependent(pA, pB, 20000, 12345);
    const final = series[series.length - 1];
    expect(Math.abs(final - pA * pB)).toBeLessThan(0.03);
  });
});
