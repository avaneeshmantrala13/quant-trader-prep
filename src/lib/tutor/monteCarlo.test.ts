import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import { runMonteCarlo, type MonteCarloSpec } from "./monteCarlo";

const coinSpec: MonteCarloSpec = {
  kind: "coin",
  trials: 10_000,
  seed: 424242,
  params: { pHeads: 0.5 },
};

describe("runMonteCarlo", () => {
  it("a seeded 10,000-flip coin converges within 0.03 of 0.5", () => {
    const r = runMonteCarlo(coinSpec, new Rng(coinSpec.seed));
    expect(r.runningFrequency).toHaveLength(10_000);
    expect(Math.abs(r.final - 0.5)).toBeLessThan(0.03);
  });

  it("is reproducible for a fixed seed", () => {
    const a = runMonteCarlo(coinSpec, new Rng(coinSpec.seed));
    const b = runMonteCarlo(coinSpec, new Rng(coinSpec.seed));
    expect(b.final).toBe(a.final);
    expect(b.runningFrequency).toEqual(a.runningFrequency);
  });

  it("gambler's fallacy: a head after a head is still ~0.5 (independence)", () => {
    // Independence: conditioning on the previous flip being heads does NOT shift
    // the next flip's frequency — streaks carry no information.
    const rng = new Rng(coinSpec.seed);
    const flips: boolean[] = [];
    for (let i = 0; i < 10_000; i++) flips.push(rng.next() < 0.5);
    let afterHead = 0;
    let headThenHead = 0;
    for (let i = 1; i < flips.length; i++) {
      if (flips[i - 1]) {
        afterHead++;
        if (flips[i]) headThenHead++;
      }
    }
    expect(Math.abs(headThenHead / afterHead - 0.5)).toBeLessThan(0.03);
  });

  it("a seeded d6 'roll a six' sim converges near 1/6", () => {
    const spec: MonteCarloSpec = {
      kind: "dice",
      trials: 10_000,
      seed: 99,
      params: { sides: 6, face: 6 },
    };
    const r = runMonteCarlo(spec, new Rng(spec.seed));
    expect(Math.abs(r.final - 1 / 6)).toBeLessThan(0.03);
  });

  it("caps trials at 10,000", () => {
    const spec: MonteCarloSpec = {
      kind: "coin",
      trials: 999_999,
      seed: 1,
      params: {},
    };
    const r = runMonteCarlo(spec, new Rng(spec.seed));
    expect(r.runningFrequency).toHaveLength(10_000);
  });
});
