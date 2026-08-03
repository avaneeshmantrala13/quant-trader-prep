import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import type { ArenaOp } from "./config";
import {
  DEFAULT_WEAK_SPOT_CONFIG,
  attemptBucketId,
  bucketId,
  bucketStats,
  bucketWeights,
  enumerateBuckets,
  makeAttempt,
  parseBucketId,
  selectBucket,
  selectBucketSequence,
  shapeOfOperands,
  shapeRange,
  smoothedErrorRate,
  weakBuckets,
  weakSpotPlan,
  type WeakSpotAttempt,
} from "./weakSpot";

const ALL_OPS: ArenaOp[] = ["add", "sub", "mul", "div"];

/** Build `n` attempts for one bucket with `wrong` of them wrong (rest correct). */
function attemptsFor(
  op: ArenaOp,
  a: number,
  b: number,
  n: number,
  wrong: number,
): WeakSpotAttempt[] {
  return Array.from({ length: n }, (_, i) => makeAttempt(op, a, b, i >= wrong));
}

describe("operand shape bucketing", () => {
  it("buckets on the larger operand magnitude", () => {
    expect(shapeOfOperands(3, 9)).toBe("small");
    expect(shapeOfOperands(12, 2)).toBe("small");
    expect(shapeOfOperands(13, 2)).toBe("medium");
    expect(shapeOfOperands(100, 4)).toBe("medium");
    expect(shapeOfOperands(101, 4)).toBe("large");
    expect(shapeOfOperands(750, 3)).toBe("large");
  });

  it("uses absolute value (sign-agnostic)", () => {
    expect(shapeOfOperands(-200, -3)).toBe("large");
  });

  it("shapeRange tiles the magnitude line with no gap/overlap", () => {
    expect(shapeRange("small")).toEqual([2, 12]);
    expect(shapeRange("medium")).toEqual([13, 100]);
    expect(shapeRange("large")).toEqual([101, 999]);
    // An item drawn from a shape's range re-buckets to that shape.
    for (const shape of ["small", "medium", "large"] as const) {
      const [lo, hi] = shapeRange(shape);
      expect(shapeOfOperands(lo, 2)).toBe(shape);
      expect(shapeOfOperands(hi, 2)).toBe(shape);
    }
  });

  it("bucketId round-trips through parseBucketId", () => {
    expect(bucketId("mul", "large")).toBe("mul:large");
    expect(parseBucketId("mul:large")).toEqual({ op: "mul", shape: "large" });
    expect(attemptBucketId(makeAttempt("div", 144, 12, true))).toBe("div:large");
  });
});

describe("bucketStats — weak-bucket detection", () => {
  it("computes per-bucket error rates and sorts weakest-first", () => {
    const attempts = [
      ...attemptsFor("add", 3, 4, 10, 0), // add:small — 0% error
      ...attemptsFor("mul", 300, 7, 10, 8), // mul:large — 80% error
      ...attemptsFor("sub", 50, 20, 10, 3), // sub:medium — 30% error
    ];
    const stats = bucketStats(attempts);
    expect(stats.map((s) => s.id)).toEqual([
      "mul:large",
      "sub:medium",
      "add:small",
    ]);
    const mul = stats.find((s) => s.id === "mul:large")!;
    expect(mul.attempts).toBe(10);
    expect(mul.wrong).toBe(8);
    expect(mul.errorRate).toBeCloseTo(0.8, 10);
  });

  it("excludes skipped attempts from the error rate", () => {
    const attempts: WeakSpotAttempt[] = [
      makeAttempt("add", 5, 6, true),
      makeAttempt("add", 5, 6, false, true), // skipped — no signal
      makeAttempt("add", 5, 6, false, true), // skipped — no signal
    ];
    const [stat] = bucketStats(attempts);
    expect(stat.attempts).toBe(1);
    expect(stat.wrong).toBe(0);
    expect(stat.errorRate).toBe(0);
  });

  it("weakBuckets filters by minAttempts and minErrorRate", () => {
    const attempts = [
      ...attemptsFor("add", 3, 4, 1, 1), // 100% but only 1 attempt
      ...attemptsFor("mul", 300, 7, 10, 6), // 60% over 10
      ...attemptsFor("div", 8, 2, 10, 0), // 0% over 10
    ];
    const weak = weakBuckets(attempts, { minAttempts: 5, minErrorRate: 0.2 });
    expect(weak.map((s) => s.id)).toEqual(["mul:large"]);
  });

  it("is empty for an empty history", () => {
    expect(bucketStats([])).toEqual([]);
    expect(weakBuckets([])).toEqual([]);
  });
});

describe("smoothedErrorRate", () => {
  it("returns the prior with no evidence", () => {
    expect(smoothedErrorRate(0, 0)).toBeCloseTo(0.5, 10);
  });

  it("pulls sparse buckets toward the prior, converges with evidence", () => {
    // 1 wrong of 1: raw 100%, but smoothed toward the 50% prior.
    const sparse = smoothedErrorRate(1, 1);
    expect(sparse).toBeGreaterThan(0.5);
    expect(sparse).toBeLessThan(1);
    // 90 wrong of 100: essentially the empirical rate.
    expect(smoothedErrorRate(90, 100)).toBeCloseTo((90 + 2) / 104, 10);
  });
});

describe("bucketWeights — over-sampling distribution", () => {
  it("weights every op × shape candidate", () => {
    const weighted = bucketWeights([], ALL_OPS);
    expect(weighted).toHaveLength(enumerateBuckets(ALL_OPS).length);
    expect(weighted).toHaveLength(12);
  });

  it("gives weak buckets strictly more weight than mastered ones", () => {
    const attempts = [
      ...attemptsFor("mul", 300, 7, 20, 16), // weak: 80%
      ...attemptsFor("add", 3, 4, 20, 0), // mastered: 0%
    ];
    const weighted = bucketWeights(attempts, ALL_OPS);
    const weak = weighted.find((w) => w.id === "mul:large")!;
    const mastered = weighted.find((w) => w.id === "add:small")!;
    expect(weak.weight).toBeGreaterThan(mastered.weight);
    // With the defaults, a fully-missed bucket outweighs a mastered one clearly.
    expect(weak.weight / mastered.weight).toBeGreaterThan(2);
  });

  it("never assigns a zero/negative weight (mastered buckets still appear)", () => {
    const attempts = attemptsFor("add", 3, 4, 50, 0);
    const weighted = bucketWeights(attempts, ALL_OPS);
    for (const w of weighted) expect(w.weight).toBeGreaterThan(0);
  });
});

describe("selection — deterministic by seed", () => {
  const weighted = bucketWeights(
    [
      ...attemptsFor("mul", 300, 7, 20, 16),
      ...attemptsFor("add", 3, 4, 20, 0),
    ],
    ALL_OPS,
  );

  it("same seed ⇒ identical pick and identical sequence", () => {
    const a = selectBucket(weighted, new Rng(1234));
    const b = selectBucket(weighted, new Rng(1234));
    expect(a.id).toBe(b.id);

    const seqA = selectBucketSequence(weighted, new Rng(42), 25).map((w) => w.id);
    const seqB = selectBucketSequence(weighted, new Rng(42), 25).map((w) => w.id);
    expect(seqA).toEqual(seqB);
  });

  it("weakSpotPlan is reproducible for a fixed seed", () => {
    const attempts = [
      ...attemptsFor("mul", 300, 7, 20, 16),
      ...attemptsFor("add", 3, 4, 20, 0),
    ];
    const planA = weakSpotPlan(attempts, ALL_OPS, 99, 30).map((w) => w.id);
    const planB = weakSpotPlan(attempts, ALL_OPS, 99, 30).map((w) => w.id);
    expect(planA).toEqual(planB);
    expect(planA).toHaveLength(30);
  });

  it("over-samples the weak bucket over many deterministic draws", () => {
    const seq = selectBucketSequence(weighted, new Rng(7), 4000);
    const weakCount = seq.filter((w) => w.id === "mul:large").length;
    const masteredCount = seq.filter((w) => w.id === "add:small").length;
    expect(weakCount).toBeGreaterThan(masteredCount);
  });

  it("falls back to a uniform pick when all weights are non-positive", () => {
    const zeroed = bucketWeights([], ALL_OPS).map((w) => ({ ...w, weight: 0 }));
    const chosen = selectBucket(zeroed, new Rng(3));
    expect(zeroed.some((w) => w.id === chosen.id)).toBe(true);
  });

  it("throws on an empty candidate list", () => {
    expect(() => selectBucket([], new Rng(1))).toThrow();
  });
});

describe("config sanity", () => {
  it("has sensible over-sampling defaults", () => {
    expect(DEFAULT_WEAK_SPOT_CONFIG.base).toBeGreaterThan(0);
    expect(DEFAULT_WEAK_SPOT_CONFIG.boost).toBeGreaterThan(0);
    expect(DEFAULT_WEAK_SPOT_CONFIG.priorErrorRate).toBeGreaterThan(0);
    expect(DEFAULT_WEAK_SPOT_CONFIG.priorErrorRate).toBeLessThanOrEqual(1);
  });
});
