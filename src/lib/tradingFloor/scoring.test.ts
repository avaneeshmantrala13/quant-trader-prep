import { describe, expect, it } from "vitest";
import { consistency, roundDeltas } from "./scoring";

describe("roundDeltas", () => {
  it("differences a cumulative path against a zero start", () => {
    expect(roundDeltas([2, 5, 5, 9])).toEqual([2, 3, 0, 4]);
  });

  it("handles negatives and an empty path", () => {
    expect(roundDeltas([-1, -4, 0])).toEqual([-1, -3, 4]);
    expect(roundDeltas([])).toEqual([]);
  });
});

describe("consistency", () => {
  it("is mean / population-sd of the deltas (hand-computed)", () => {
    // deltas = [1,2,3]: mean = 2, popVar = (1+0+1)/3 = 2/3, sd = sqrt(2/3)
    // consistency = 2 / sqrt(2/3) = 2.449489742783178
    expect(consistency([1, 2, 3])).toBeCloseTo(2.449489742783178, 9);
  });

  it("returns 0 for fewer than 2 rounds", () => {
    expect(consistency([])).toBe(0);
    expect(consistency([5])).toBe(0);
  });

  it("returns 0 for a flat zero path", () => {
    expect(consistency(roundDeltas([0, 0, 0]))).toBe(0);
  });

  it("returns 0 for any flat (zero-sd) deltas", () => {
    expect(consistency([4, 4, 4, 4])).toBe(0);
  });
});
