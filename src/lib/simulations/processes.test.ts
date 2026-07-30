import { describe, expect, it } from "vitest";
import {
  stationaryDistribution,
  stepDistribution,
  evolveDistribution,
  simulateChainOccupancy,
  gamblersRuinReachTarget,
  simulateGamblersRuinReach,
  simulateWalkTrajectory,
} from "./processes";

describe("stationaryDistribution", () => {
  it("matches the analytic stationary vector [5/6, 1/6]", () => {
    const P = [
      [0.9, 0.1],
      [0.5, 0.5],
    ];
    const pi = stationaryDistribution(P);
    expect(pi[0]).toBeCloseTo(5 / 6, 6);
    expect(pi[1]).toBeCloseTo(1 / 6, 6);
  });

  it("is normalized (sums to 1)", () => {
    const P = [
      [0.7, 0.3],
      [0.4, 0.6],
    ];
    const pi = stationaryDistribution(P);
    expect(pi.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
  });
});

describe("stepDistribution", () => {
  it("computes dist · P on a known case", () => {
    const P = [
      [0.9, 0.1],
      [0.5, 0.5],
    ];
    // [1,0] · P should be the first row of P.
    expect(stepDistribution(P, [1, 0])).toEqual([0.9, 0.1]);
    // [0.5, 0.5] · P = [0.7, 0.3].
    const out = stepDistribution(P, [0.5, 0.5]);
    expect(out[0]).toBeCloseTo(0.7, 12);
    expect(out[1]).toBeCloseTo(0.3, 12);
  });
});

describe("evolveDistribution", () => {
  it("has length steps+1 with each row summing to 1", () => {
    const P = [
      [0.8, 0.2],
      [0.3, 0.7],
    ];
    const steps = 25;
    const traj = evolveDistribution(P, [1, 0], steps);
    expect(traj).toHaveLength(steps + 1);
    for (const row of traj) {
      expect(row.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    }
  });

  it("index 0 equals the initial distribution and converges to stationary", () => {
    const P = [
      [0.9, 0.1],
      [0.5, 0.5],
    ];
    const traj = evolveDistribution(P, [0, 1], 100);
    expect(traj[0]).toEqual([0, 1]);
    const last = traj[traj.length - 1];
    expect(last[0]).toBeCloseTo(5 / 6, 4);
    expect(last[1]).toBeCloseTo(1 / 6, 4);
  });
});

describe("gamblersRuinReachTarget", () => {
  it("fair walk (p=0.5): start/target", () => {
    expect(gamblersRuinReachTarget(0.5, 1, 4)).toBeCloseTo(0.25, 12);
    expect(gamblersRuinReachTarget(0.5, 3, 10)).toBeCloseTo(0.3, 12);
  });

  it("biased walk matches the r-formula", () => {
    const p = 0.6;
    const start = 2;
    const target = 5;
    const r = (1 - p) / p;
    const expected = (1 - r ** start) / (1 - r ** target);
    expect(gamblersRuinReachTarget(p, start, target)).toBeCloseTo(expected, 12);
  });
});

describe("simulateGamblersRuinReach", () => {
  it("is deterministic given the seed", () => {
    expect(simulateGamblersRuinReach(0.5, 2, 6, 500, 3)).toEqual(
      simulateGamblersRuinReach(0.5, 2, 6, 500, 3),
    );
  });

  it("final empirical proportion ≈ closed form within 0.03", () => {
    const p = 0.5;
    const start = 2;
    const target = 8;
    const games = 20000;
    const out = simulateGamblersRuinReach(p, start, target, games, 17);
    const cf = gamblersRuinReachTarget(p, start, target);
    expect(Math.abs(out[out.length - 1] - cf)).toBeLessThan(0.03);
  });
});

describe("simulateChainOccupancy", () => {
  it("occupancy ≈ stationary within 0.03 at large steps", () => {
    const P = [
      [0.9, 0.1],
      [0.5, 0.5],
    ];
    const occ = simulateChainOccupancy(P, 0, 20000, 21);
    const pi = stationaryDistribution(P);
    expect(Math.abs(occ[0] - pi[0])).toBeLessThan(0.03);
    expect(Math.abs(occ[1] - pi[1])).toBeLessThan(0.03);
    expect(occ.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
  });
});

describe("simulateWalkTrajectory", () => {
  it("starts at start and terminates at 0 or target", () => {
    const path = simulateWalkTrajectory(0.5, 3, 8, 5);
    expect(path[0]).toBe(3);
    const end = path[path.length - 1];
    expect(end === 0 || end === 8).toBe(true);
  });
});
