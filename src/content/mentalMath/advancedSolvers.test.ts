import { describe, expect, it } from "vitest";
import {
  diffOfSquaresProduct,
  digitCount,
  rangeSum,
  square,
  sumOfFirstEvens,
  sumOfFirstOdds,
  totalDigitsToNumber,
  triangular,
} from "./advancedSolvers";

/**
 * Ground-truth pins for the advanced mental-math verifiers. Every closed form is
 * cross-checked against an independent brute-force loop so the generators that
 * lean on these solvers are provably correct-by-construction.
 */

describe("difference-of-squares products", () => {
  it("(center−k)(center+k) = center² − k²", () => {
    expect(diffOfSquaresProduct(50, 2)).toBe(48 * 52);
    expect(diffOfSquaresProduct(50, 2)).toBe(2496);
    expect(diffOfSquaresProduct(30, 3)).toBe(27 * 33);
    expect(diffOfSquaresProduct(100, 7)).toBe(93 * 107);
    // Matches the naive product for every center/offset pair.
    for (let c = 11; c <= 120; c++) {
      for (let k = 1; k <= 9 && k < c; k++) {
        expect(diffOfSquaresProduct(c, k)).toBe((c - k) * (c + k));
      }
    }
  });

  it("square(n) = n·n", () => {
    for (let n = 1; n <= 200; n++) expect(square(n)).toBe(n * n);
  });
});

describe("series sums (closed forms vs brute force)", () => {
  const brute = (lo: number, hi: number) => {
    let s = 0;
    for (let i = lo; i <= hi; i++) s += i;
    return s;
  };

  it("triangular Σ_{1..n} i = n(n+1)/2", () => {
    for (let n = 1; n <= 300; n++) expect(triangular(n)).toBe(brute(1, n));
    expect(triangular(100)).toBe(5050);
  });

  it("sum of the first n odds = n²", () => {
    for (let n = 1; n <= 200; n++) {
      let s = 0;
      for (let i = 0; i < n; i++) s += 2 * i + 1;
      expect(sumOfFirstOdds(n)).toBe(s);
      expect(sumOfFirstOdds(n)).toBe(n * n);
    }
  });

  it("sum of the first n evens = n(n+1)", () => {
    for (let n = 1; n <= 200; n++) {
      let s = 0;
      for (let i = 1; i <= n; i++) s += 2 * i;
      expect(sumOfFirstEvens(n)).toBe(s);
    }
  });

  it("consecutive-integer range sum lo..hi", () => {
    for (let lo = 1; lo <= 30; lo++) {
      for (let hi = lo; hi <= 60; hi++) {
        expect(rangeSum(lo, hi)).toBe(brute(lo, hi));
      }
    }
    expect(rangeSum(40, 60)).toBe(1050);
  });
});

describe("digit counting", () => {
  it("digitCount matches the string length", () => {
    expect(digitCount(1)).toBe(1);
    expect(digitCount(9)).toBe(1);
    expect(digitCount(10)).toBe(2);
    expect(digitCount(999)).toBe(3);
    expect(digitCount(1000)).toBe(4);
  });

  it("totalDigitsToNumber equals Σ digitCount(i) over 1..N", () => {
    const brute = (N: number) => {
      let s = 0;
      for (let i = 1; i <= N; i++) s += String(i).length;
      return s;
    };
    for (const N of [1, 9, 10, 11, 99, 100, 101, 250, 999, 1000, 1234]) {
      expect(totalDigitsToNumber(N)).toBe(brute(N));
    }
    // 1..9 → 9 digits; 10..99 → 90·2 = 180; total to 99 = 189.
    expect(totalDigitsToNumber(99)).toBe(189);
    // + 100..250 → 151·3 = 453; total to 250 = 642.
    expect(totalDigitsToNumber(250)).toBe(642);
  });
});
