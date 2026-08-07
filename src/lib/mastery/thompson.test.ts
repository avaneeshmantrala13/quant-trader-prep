import { describe, expect, it } from "vitest";
import {
  sampleBeta,
  sampleGamma,
  sampleNormal,
  selectNextTopic,
  thompsonSelect,
  type ThompsonArm,
} from "./thompson";
import { Rng } from "@/lib/rng";
import type { TopicMastery } from "@/types/mastery";

function mean(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}
function variance(xs: number[]): number {
  const m = mean(xs);
  return mean(xs.map((x) => (x - m) ** 2));
}

describe("sampleNormal", () => {
  it("has ~0 mean and ~1 variance and is seed-deterministic", () => {
    const draws = Array.from({ length: 5000 }, () => sampleNormal(new Rng(1)));
    // Same seed each time ⇒ identical draw (determinism).
    expect(new Set(draws).size).toBe(1);
    const rng = new Rng(7);
    const stream = Array.from({ length: 20000 }, () => sampleNormal(rng));
    expect(mean(stream)).toBeCloseTo(0, 1);
    expect(variance(stream)).toBeCloseTo(1, 1);
  });
});

describe("sampleGamma", () => {
  it("matches the Gamma mean (shape·scale) for shape ≥ 1", () => {
    const rng = new Rng(11);
    const draws = Array.from({ length: 20000 }, () => sampleGamma(rng, 3, 2));
    expect(mean(draws)).toBeCloseTo(6, 0); // 3·2
    expect(draws.every((x) => x >= 0)).toBe(true);
  });

  it("handles shape < 1 via boosting", () => {
    const rng = new Rng(12);
    const draws = Array.from({ length: 20000 }, () => sampleGamma(rng, 0.5, 1));
    expect(mean(draws)).toBeCloseTo(0.5, 1);
    expect(draws.every((x) => x >= 0)).toBe(true);
  });
});

describe("sampleBeta", () => {
  it("recovers the Beta mean a/(a+b) and stays in [0,1]", () => {
    const rng = new Rng(21);
    const draws = Array.from({ length: 20000 }, () => sampleBeta(rng, 2, 8));
    expect(mean(draws)).toBeCloseTo(0.2, 1); // 2/10
    expect(draws.every((x) => x >= 0 && x <= 1)).toBe(true);
  });

  it("a symmetric Beta samples around 0.5", () => {
    const rng = new Rng(22);
    const draws = Array.from({ length: 20000 }, () => sampleBeta(rng, 5, 5));
    expect(mean(draws)).toBeCloseTo(0.5, 1);
  });
});

describe("thompsonSelect", () => {
  const arms: ThompsonArm[] = [
    { key: "a", alpha: 1, beta: 9 }, // ~0.1
    { key: "b", alpha: 8, beta: 2 }, // ~0.8
    { key: "c", alpha: 18, beta: 2 }, // ~0.9
  ];

  it("is deterministic for a fixed seed", () => {
    const c1 = thompsonSelect(arms, new Rng(5));
    const c2 = thompsonSelect(arms, new Rng(5));
    expect(c1.key).toBe(c2.key);
    expect(c1.sample).toBe(c2.sample);
  });

  it('mastery objective favors the highest-mean arm over many seeds', () => {
    const counts: Record<string, number> = { a: 0, b: 0, c: 0 };
    for (let s = 0; s < 400; s++) {
      const c = thompsonSelect(arms, new Rng(s), { objective: "mastery" });
      counts[c.key!]++;
    }
    // The ~0.9 arm should win most often; the ~0.1 arm almost never.
    expect(counts.c).toBeGreaterThan(counts.b);
    expect(counts.c).toBeGreaterThan(counts.a);
    expect(counts.a).toBeLessThan(counts.c);
  });

  it('zpd objective favors the arm nearest the target success band', () => {
    const counts: Record<string, number> = { a: 0, b: 0, c: 0 };
    for (let s = 0; s < 400; s++) {
      const c = thompsonSelect(arms, new Rng(s), { objective: "zpd", target: 0.8 });
      counts[c.key!]++;
    }
    // Arm "b" (~0.8) is closest to the ZPD target ⇒ selected most often.
    expect(counts.b).toBeGreaterThan(counts.a);
    expect(counts.b).toBeGreaterThan(counts.c);
  });

  it("skips ineligible arms and returns null when none are eligible", () => {
    const c = thompsonSelect(
      [
        { key: "x", eligible: false },
        { key: "y", eligible: false },
      ],
      new Rng(1),
    );
    expect(c.key).toBeNull();
  });
});

describe("selectNextTopic", () => {
  it("reads Beta posteriors off the mastery map and can exclude mastered topics", () => {
    const m = (alpha: number, beta: number): TopicMastery => ({
      theta: 0,
      n: alpha + beta - 2,
      alpha,
      beta,
      lastSeen: "2026-01-01T00:00:00.000Z",
      misconceptions: {},
    });
    const map: Record<string, TopicMastery | undefined> = {
      t1: m(18, 2), // confidently strong
      t2: m(6, 4), // mid
      t3: undefined, // unseen ⇒ prior
    };
    const choice = selectNextTopic(map, ["t1", "t2", "t3"], new Rng(3), {
      objective: "mastery",
      excludeKeys: ["t1"],
    });
    expect(choice.key).not.toBe("t1"); // excluded
    expect(["t2", "t3"]).toContain(choice.key);
  });
});
