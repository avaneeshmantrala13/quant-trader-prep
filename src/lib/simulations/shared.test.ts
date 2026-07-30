import { describe, expect, it } from "vitest";
import {
  runningMean,
  cumulativeProportion,
  mean,
  variance,
  downsample,
  range,
  linspace,
  integerHistogram,
  roundTo,
} from "./shared";

describe("runningMean", () => {
  it("returns [] for empty input", () => {
    expect(runningMean([])).toEqual([]);
  });

  it("computes the cumulative mean on a known input", () => {
    // means of [2], [2,4], [2,4,6] = 2, 3, 4
    expect(runningMean([2, 4, 6])).toEqual([2, 3, 4]);
  });

  it("handles negatives", () => {
    expect(runningMean([-1, 1])).toEqual([-1, 0]);
  });
});

describe("cumulativeProportion", () => {
  it("returns [] for empty input", () => {
    expect(cumulativeProportion([])).toEqual([]);
  });

  it("tracks the running proportion of true", () => {
    // T, T, F, F -> 1/1, 2/2, 2/3, 2/4
    expect(cumulativeProportion([true, true, false, false])).toEqual([
      1, 1, 2 / 3, 0.5,
    ]);
  });

  it("is all zeros when nothing is true", () => {
    expect(cumulativeProportion([false, false])).toEqual([0, 0]);
  });
});

describe("mean", () => {
  it("is 0 for empty", () => {
    expect(mean([])).toBe(0);
  });

  it("averages a known input", () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5);
  });
});

describe("variance", () => {
  it("is 0 for empty and single-element inputs", () => {
    expect(variance([])).toBe(0);
    expect(variance([42])).toBe(0);
  });

  it("computes population variance on a known input", () => {
    // mean=4, squared devs = 4,1,0,1,4 -> sum 10 / 5 = 2
    expect(variance([2, 3, 4, 5, 6])).toBe(2);
  });

  it("is 0 when all values are equal", () => {
    expect(variance([7, 7, 7])).toBe(0);
  });
});

describe("downsample", () => {
  it("returns a copy (not the same ref) when already short", () => {
    const xs = [1, 2, 3];
    const out = downsample(xs, 5);
    expect(out).toEqual([1, 2, 3]);
    expect(out).not.toBe(xs);
  });

  it("respects the cap and keeps both endpoints", () => {
    const xs = range(100); // 0..99
    const out = downsample(xs, 5);
    expect(out.length).toBeLessThanOrEqual(5);
    expect(out[0]).toBe(0);
    expect(out[out.length - 1]).toBe(99);
  });

  it("collapses to endpoints when maxPoints is 2", () => {
    expect(downsample([0, 1, 2, 3, 4], 2)).toEqual([0, 4]);
  });

  it("returns a single element for maxPoints=1", () => {
    expect(downsample([5, 6, 7], 1)).toEqual([5]);
  });

  it("produces evenly spaced samples including endpoints", () => {
    expect(downsample(range(9), 5)).toEqual([0, 2, 4, 6, 8]);
  });
});

describe("range", () => {
  it("produces [0..n-1]", () => {
    expect(range(4)).toEqual([0, 1, 2, 3]);
  });

  it("is empty for non-positive n", () => {
    expect(range(0)).toEqual([]);
    expect(range(-3)).toEqual([]);
  });
});

describe("linspace", () => {
  it("includes both endpoints", () => {
    expect(linspace(0, 1, 5)).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });

  it("returns [a, b] for n=2", () => {
    expect(linspace(3, 9, 2)).toEqual([3, 9]);
  });

  it("lands exactly on the final endpoint", () => {
    const out = linspace(0, 10, 11);
    expect(out[out.length - 1]).toBe(10);
    expect(out).toHaveLength(11);
  });
});

describe("integerHistogram", () => {
  it("counts each integer in [0..maxValue]", () => {
    // values 0,1,1,2,2,2 with maxValue 3 -> [1,2,3,0]
    expect(integerHistogram([0, 1, 1, 2, 2, 2], 3)).toEqual([1, 2, 3, 0]);
  });

  it("ignores out-of-range values and floors non-integers", () => {
    expect(integerHistogram([-1, 4, 1.9], 2)).toEqual([0, 1, 0]);
  });
});

describe("roundTo", () => {
  it("rounds to the requested decimals", () => {
    expect(roundTo(3.14159, 2)).toBe(3.14);
    expect(roundTo(2.5, 0)).toBe(3);
    expect(roundTo(1.005, 2)).toBeCloseTo(1, 5);
  });
});
