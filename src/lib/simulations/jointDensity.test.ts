import { describe, expect, it } from "vitest";
import {
  bivariateNormalPdf,
  densityGrid,
  displayDomain,
  marginalXProbability,
  monteCarloRectProbability,
  rectProbability,
  rectProbabilityIndependent,
  standardNormalCdf,
  type BivariateNormalParams,
  type Region,
} from "./jointDensity";

const STD: BivariateNormalParams = {
  muX: 0,
  muY: 0,
  sigmaX: 1,
  sigmaY: 1,
  rho: 0,
};

describe("standardNormalCdf", () => {
  it("is 0.5 at 0 and symmetric", () => {
    expect(standardNormalCdf(0)).toBeCloseTo(0.5, 6);
    expect(standardNormalCdf(1.96)).toBeCloseTo(0.975, 3);
    expect(standardNormalCdf(-1.96)).toBeCloseTo(0.025, 3);
  });
});

describe("bivariateNormalPdf", () => {
  it("matches the closed form at the origin for the standard normal", () => {
    // f(0,0) = 1 / (2π) for the independent standard bivariate normal.
    expect(bivariateNormalPdf(0, 0, STD)).toBeCloseTo(1 / (2 * Math.PI), 9);
  });

  it("factorises into the product of marginals when ρ = 0", () => {
    const p = { muX: 1, muY: -2, sigmaX: 2, sigmaY: 0.5, rho: 0 };
    const x = 1.7;
    const y = -1.3;
    const phi = (z: number) => Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
    const expected =
      (phi((x - p.muX) / p.sigmaX) / p.sigmaX) *
      (phi((y - p.muY) / p.sigmaY) / p.sigmaY);
    expect(bivariateNormalPdf(x, y, p)).toBeCloseTo(expected, 12);
  });

  it("integrates to ≈1 over a wide window (total volume under the surface)", () => {
    const p = { muX: 0.3, muY: -0.4, sigmaX: 1.2, sigmaY: 0.8, rho: 0.5 };
    const d = displayDomain(p, 6);
    const total = rectProbability(
      p,
      { x0: d.xMin, x1: d.xMax, y0: d.yMin, y1: d.yMax },
      160,
    );
    expect(total).toBeGreaterThan(0.999);
    expect(total).toBeLessThanOrEqual(1);
  });
});

describe("rectProbability (numerical double integral)", () => {
  it("matches the exact independent closed form when ρ = 0", () => {
    const p = { muX: 0, muY: 0, sigmaX: 1, sigmaY: 1, rho: 0 };
    const region: Region = { x0: -1, x1: 1, y0: -1, y1: 1 };
    const numeric = rectProbability(p, region, 160);
    const exact = rectProbabilityIndependent(p, region);
    expect(numeric).toBeCloseTo(exact, 4);
  });

  it("agrees with the closed form for a shifted, scaled independent normal", () => {
    const p = { muX: 2, muY: -1, sigmaX: 1.5, sigmaY: 0.7, rho: 0 };
    const region: Region = { x0: 1, x1: 3.5, y0: -1.5, y1: 0.2 };
    expect(rectProbability(p, region, 160)).toBeCloseTo(
      rectProbabilityIndependent(p, region),
      4,
    );
  });

  it("returns 0 for a degenerate (zero-area) region", () => {
    expect(rectProbability(STD, { x0: 1, x1: 1, y0: -1, y1: 1 })).toBe(0);
    expect(rectProbability(STD, { x0: -1, x1: 1, y0: 2, y1: 2 })).toBe(0);
  });

  it("normalises coordinate order (x0>x1 / y0>y1 handled)", () => {
    const forward = rectProbability(STD, { x0: -1, x1: 1, y0: -1, y1: 1 });
    const reversed = rectProbability(STD, { x0: 1, x1: -1, y0: 1, y1: -1 });
    expect(reversed).toBeCloseTo(forward, 10);
  });

  it("stays in [0,1] and reflects correlation making the diagonal likelier", () => {
    const region: Region = { x0: 0, x1: 3, y0: 0, y1: 3 };
    const indep = rectProbability(
      { muX: 0, muY: 0, sigmaX: 1, sigmaY: 1, rho: 0 },
      region,
    );
    const positive = rectProbability(
      { muX: 0, muY: 0, sigmaX: 1, sigmaY: 1, rho: 0.8 },
      region,
    );
    // Both quadrant-positive; strong positive correlation piles more mass into
    // the shared-sign quadrant, so the upper-right box is more probable.
    expect(positive).toBeGreaterThan(indep);
    for (const v of [indep, positive]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe("marginal probabilities", () => {
  it("recovers the 1-D normal-interval probability on the X axis", () => {
    const p = { muX: 0, muY: 5, sigmaX: 1, sigmaY: 3, rho: 0.3 };
    // P(−1 ≤ X ≤ 1) for X ~ N(0,1) ≈ 0.6827.
    expect(marginalXProbability(p, -1, 1)).toBeCloseTo(0.6827, 3);
  });
});

describe("densityGrid", () => {
  it("has the requested shape and a positive peak", () => {
    const d = displayDomain(STD);
    const g = densityGrid(STD, d, 30, 20);
    expect(g.xs).toHaveLength(30);
    expect(g.ys).toHaveLength(20);
    expect(g.z).toHaveLength(20);
    expect(g.z[0]).toHaveLength(30);
    expect(g.zMax).toBeGreaterThan(0);
  });
});

describe("monteCarloRectProbability", () => {
  it("is deterministic given the seed", () => {
    const region: Region = { x0: -1, x1: 1, y0: -1, y1: 1 };
    const a = monteCarloRectProbability(STD, region, 3000, 7);
    const b = monteCarloRectProbability(STD, region, 3000, 7);
    expect(a.proportion).toBe(b.proportion);
    expect(a.inside).toBe(b.inside);
  });

  it("converges to the numerical double integral within tolerance", () => {
    const p = { muX: 0, muY: 0, sigmaX: 1, sigmaY: 1, rho: 0.6 };
    const region: Region = { x0: -1.5, x1: 1.5, y0: -1.5, y1: 1.5 };
    const exact = rectProbability(p, region);
    const mc = monteCarloRectProbability(p, region, 40000, 3);
    expect(Math.abs(mc.proportion - exact)).toBeLessThan(0.02);
  });

  it("caps the returned display points and tags them by membership", () => {
    const region: Region = { x0: -1, x1: 1, y0: -1, y1: 1 };
    const mc = monteCarloRectProbability(STD, region, 20000, 5, 800);
    expect(mc.total).toBe(20000);
    expect(mc.points.length).toBeLessThanOrEqual(800);
    for (const pt of mc.points) {
      const shouldBeInside =
        pt.x >= -1 && pt.x <= 1 && pt.y >= -1 && pt.y <= 1;
      expect(pt.inside).toBe(shouldBeInside);
    }
  });
});
