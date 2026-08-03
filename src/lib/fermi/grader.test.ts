import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import {
  computeFermiReference,
  computeRunningSteps,
  parseFermiInput,
  gradeFermi,
  gradeFermiValue,
  formatFermiNumber,
  gradeInterval,
  intervalCoverage,
  coverageLean,
  FERMI_CI_ALPHA,
  FERMI_FULL_CREDIT_LOG,
  FERMI_PARTIAL_CREDIT_LOG,
  type FermiFactor,
} from "./grader";

describe("computeFermiReference — coded product of a decomposition", () => {
  it("multiplies plain factors", () => {
    const factors: FermiFactor[] = [
      { label: "a", value: 50 },
      { label: "b", value: 14 },
      { label: "c", value: 7 },
    ];
    expect(computeFermiReference(factors)).toBe(4900);
  });

  it("supports division steps (demand ÷ throughput)", () => {
    const factors: FermiFactor[] = [
      { label: "cars", value: 250_000_000 },
      { label: "fills/car/wk", value: 1 },
      { label: "fills/station/wk", value: 2000, op: "div" },
    ];
    expect(computeFermiReference(factors)).toBe(125_000);
  });

  it("handles a mixed multiply/divide chain", () => {
    const factors: FermiFactor[] = [
      { label: "pop", value: 9_000_000 },
      { label: "per household", value: 2.5, op: "div" },
      { label: "piano share", value: 0.05 },
      { label: "tunings/yr", value: 1 },
      { label: "throughput", value: 1000, op: "div" },
    ];
    expect(computeFermiReference(factors)).toBeCloseTo(180, 6);
  });
});

describe("computeRunningSteps — reveal chain", () => {
  it("returns one step per factor with the cumulative running product", () => {
    const steps = computeRunningSteps([
      { label: "a", value: 50 },
      { label: "b", value: 14 },
      { label: "c", value: 7 },
    ]);
    expect(steps.map((s) => s.running)).toEqual([50, 700, 4900]);
    expect(steps[2].op).toBe("mul");
  });

  it("marks divide steps and divides the running product", () => {
    const steps = computeRunningSteps([
      { label: "count", value: 1000 },
      { label: "rate", value: 4, op: "div" },
    ]);
    expect(steps[1].op).toBe("div");
    expect(steps[1].running).toBe(250);
  });
});

describe("parseFermiInput — large / scientific / suffixed entry", () => {
  it("parses plain integers and grouped digits", () => {
    expect(parseFermiInput("300000")).toBe(300000);
    expect(parseFermiInput("300,000")).toBe(300000);
    expect(parseFermiInput(" 1,250,000 ")).toBe(1_250_000);
  });
  it("parses scientific notation", () => {
    expect(parseFermiInput("3e5")).toBe(300000);
    expect(parseFermiInput("3E5")).toBe(300000);
    expect(parseFermiInput("3e+5")).toBe(300000);
    expect(parseFermiInput("1.2e9")).toBe(1_200_000_000);
  });
  it("parses magnitude suffixes and spelled-out scales", () => {
    expect(parseFermiInput("300k")).toBe(300000);
    expect(parseFermiInput("1.5m")).toBe(1_500_000);
    expect(parseFermiInput("9b")).toBe(9_000_000_000);
    expect(parseFermiInput("48t")).toBe(48_000_000_000_000);
    expect(parseFermiInput("8.1 million")).toBe(8_100_000);
    expect(parseFermiInput("2 billion")).toBe(2_000_000_000);
    expect(parseFermiInput("500 thousand")).toBe(500_000);
    expect(parseFermiInput("480bn")).toBe(480_000_000_000);
    expect(parseFermiInput("5mm")).toBe(5_000_000);
  });
  it("strips a leading currency symbol", () => {
    expect(parseFermiInput("$5,000")).toBe(5000);
    expect(parseFermiInput("$480 billion")).toBe(480_000_000_000);
  });
  it("returns null on malformed input", () => {
    expect(parseFermiInput("")).toBeNull();
    expect(parseFermiInput("   ")).toBeNull();
    expect(parseFermiInput("abc")).toBeNull();
    expect(parseFermiInput("$")).toBeNull();
    expect(parseFermiInput("12x3")).toBeNull();
    expect(parseFermiInput("1.2.3")).toBeNull();
    expect(parseFermiInput("e5")).toBeNull();
    expect(parseFermiInput("k")).toBeNull();
  });
});

describe("gradeFermi — log-distance bands", () => {
  const reference = 100_000;

  it("awards full credit for an exact answer", () => {
    const g = gradeFermi(reference, "100000");
    expect(g.band).toBe("correct");
    expect(g.score).toBe(1);
    expect(g.logDistance).toBe(0);
    expect(g.factor).toBe(1);
  });

  it("awards full credit within ~3x (d <= 0.5)", () => {
    expect(gradeFermi(reference, "3e5").band).toBe("correct"); // 3x, d≈0.477
    expect(gradeFermi(reference, "40000").band).toBe("correct"); // 2.5x
    expect(gradeFermi(reference, "300000").score).toBe(1);
  });

  it("awards partial credit within one order of magnitude (0.5 < d <= 1)", () => {
    expect(gradeFermi(reference, "1e6").band).toBe("close"); // 10x, d=1
    expect(gradeFermi(reference, "20000").band).toBe("close"); // 5x
    expect(gradeFermi(reference, "1000000").score).toBe(0.5);
  });

  it("marks answers off by more than 10x incorrect", () => {
    expect(gradeFermi(reference, "5e6").band).toBe("incorrect"); // 50x
    expect(gradeFermi(reference, "500").band).toBe("incorrect"); // 200x
    expect(gradeFermi(reference, "5000000").score).toBe(0);
  });

  it("handles malformed / non-positive input gracefully (no crash)", () => {
    for (const raw of ["", "abc", "0", "-5", "1.2.3", "$"]) {
      const g = gradeFermi(reference, raw);
      expect(g.band).toBe("incorrect");
      expect(g.score).toBe(0);
      expect(g.logDistance).toBeNull();
      expect(g.factor).toBeNull();
    }
  });

  it("computes the multiplicative distance both above and below", () => {
    expect(gradeFermiValue(100, 1000).factor).toBeCloseTo(10, 6);
    expect(gradeFermiValue(100, 10).factor).toBeCloseTo(10, 6);
  });

  it("uses documented band thresholds", () => {
    expect(FERMI_FULL_CREDIT_LOG).toBe(0.5);
    expect(FERMI_PARTIAL_CREDIT_LOG).toBe(1.0);
    // Exactly on the boundaries -> inclusive of the better band.
    const atFull = gradeFermiValue(1, 10 ** FERMI_FULL_CREDIT_LOG);
    expect(atFull.band).toBe("correct");
    const atPartial = gradeFermiValue(1, 10 ** FERMI_PARTIAL_CREDIT_LOG);
    expect(atPartial.band).toBe("close");
  });
});

describe("gradeInterval — Winkler 90% interval score (additive path)", () => {
  it("flags a hit when the reference is inside the interval", () => {
    const g = gradeInterval({ lo: 50, hi: 150 }, 100);
    expect(g.hit).toBe(true);
    expect(g.penalty).toBe(0);
    expect(g.width).toBe(100);
    expect(g.score).toBe(100); // hit => score is pure width
    expect(g.valid).toBe(true);
    expect(g.alpha).toBe(FERMI_CI_ALPHA);
  });

  it("treats the interval as closed at both endpoints", () => {
    expect(gradeInterval({ lo: 50, hi: 150 }, 50).hit).toBe(true);
    expect(gradeInterval({ lo: 50, hi: 150 }, 150).hit).toBe(true);
    expect(gradeInterval({ lo: 50, hi: 150 }, 49.999).hit).toBe(false);
    expect(gradeInterval({ lo: 50, hi: 150 }, 150.001).hit).toBe(false);
  });

  it("a TIGHT correct interval beats a WIDE correct interval (lower score)", () => {
    const tight = gradeInterval({ lo: 90, hi: 110 }, 100);
    const wide = gradeInterval({ lo: 10, hi: 1000 }, 100);
    expect(tight.hit).toBe(true);
    expect(wide.hit).toBe(true);
    expect(tight.penalty).toBe(0);
    expect(wide.penalty).toBe(0);
    // Sharper (narrower) honest interval is rewarded: strictly lower score.
    expect(tight.score).toBeLessThan(wide.score);
    expect(tight.width).toBeLessThan(wide.width);
  });

  it("a MISS is penalized MORE than a same-width hit", () => {
    // Same width (100), one contains the truth, one misses it.
    const hit = gradeInterval({ lo: 50, hi: 150 }, 100);
    const miss = gradeInterval({ lo: 50, hi: 150 }, 300);
    expect(hit.hit).toBe(true);
    expect(miss.hit).toBe(false);
    expect(miss.penalty).toBeGreaterThan(0);
    expect(miss.score).toBeGreaterThan(hit.score);
    // 90% miss penalty is (2/alpha) × distance outside the band = 20 × (300-150).
    expect(miss.penalty).toBeCloseTo(20 * 150, 6);
    expect(miss.score).toBeCloseTo(100 + 20 * 150, 6);
  });

  it("penalizes a low miss symmetrically to a high miss", () => {
    const low = gradeInterval({ lo: 50, hi: 150 }, 30); // 20 below
    const high = gradeInterval({ lo: 50, hi: 150 }, 170); // 20 above
    expect(low.hit).toBe(false);
    expect(high.hit).toBe(false);
    expect(low.penalty).toBeCloseTo(high.penalty, 6);
    expect(low.penalty).toBeCloseTo(20 * 20, 6);
  });

  it("scales the miss penalty by 2/alpha (a wider CI level is less punishing)", () => {
    const ci90 = gradeInterval({ lo: 50, hi: 150 }, 250, 0.1); // 2/alpha = 20
    const ci50 = gradeInterval({ lo: 50, hi: 150 }, 250, 0.5); // 2/alpha = 4
    expect(ci90.penalty).toBeCloseTo(20 * 100, 6);
    expect(ci50.penalty).toBeCloseTo(4 * 100, 6);
    expect(ci90.penalty).toBeGreaterThan(ci50.penalty);
  });

  it("normalizes a swapped lo/hi entry defensively", () => {
    const g = gradeInterval({ lo: 150, hi: 50 }, 100);
    expect(g.lo).toBe(50);
    expect(g.hi).toBe(150);
    expect(g.hit).toBe(true);
    expect(g.width).toBe(100);
  });

  it("returns an invalid, no-crash grade on non-finite bounds", () => {
    for (const iv of [
      { lo: NaN, hi: 10 },
      { lo: 1, hi: Infinity },
    ]) {
      const g = gradeInterval(iv, 5);
      expect(g.valid).toBe(false);
      expect(g.hit).toBe(false);
      expect(Number.isNaN(g.score)).toBe(true);
    }
  });

  it("is deterministic and obeys its invariants across many seeds", () => {
    for (let seed = 0; seed < 400; seed++) {
      const rng = new Rng(seed);
      const a = rng.next() * 1000;
      const b = rng.next() * 1000;
      const reference = rng.next() * 1200 - 100;
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);

      const g1 = gradeInterval({ lo: a, hi: b }, reference);
      const g2 = gradeInterval({ lo: a, hi: b }, reference);
      // Determinism: same seed → identical output.
      expect(g2).toEqual(g1);

      // Invariants of a proper interval score.
      expect(g1.lo).toBeCloseTo(lo, 9);
      expect(g1.hi).toBeCloseTo(hi, 9);
      expect(g1.width).toBeGreaterThanOrEqual(0);
      expect(g1.penalty).toBeGreaterThanOrEqual(0);
      expect(g1.hit).toBe(reference >= lo && reference <= hi);
      expect(g1.score).toBeCloseTo(g1.width + g1.penalty, 9);
      if (g1.hit) expect(g1.penalty).toBe(0);
      else expect(g1.penalty).toBeGreaterThan(0);
    }
  });
});

describe("intervalCoverage — running empirical CI coverage", () => {
  it("counts hits and computes the fraction", () => {
    const cov = intervalCoverage([true, false, true, true, false]);
    expect(cov.n).toBe(5);
    expect(cov.hits).toBe(3);
    expect(cov.coverage).toBeCloseTo(0.6, 9);
  });

  it("is 0 (not NaN) for an empty list", () => {
    const cov = intervalCoverage([]);
    expect(cov.n).toBe(0);
    expect(cov.hits).toBe(0);
    expect(cov.coverage).toBe(0);
  });

  it("all-hits → coverage 1, all-misses → coverage 0", () => {
    expect(intervalCoverage([true, true, true]).coverage).toBe(1);
    expect(intervalCoverage([false, false]).coverage).toBe(0);
  });

  it("matches a hand-counted stream over many seeds", () => {
    for (let seed = 0; seed < 200; seed++) {
      const rng = new Rng(seed);
      const n = rng.int(1, 20);
      const hits: boolean[] = [];
      let expected = 0;
      for (let i = 0; i < n; i++) {
        const h = rng.chance(0.9);
        hits.push(h);
        if (h) expected++;
      }
      const cov = intervalCoverage(hits);
      expect(cov.n).toBe(n);
      expect(cov.hits).toBe(expected);
      expect(cov.coverage).toBeCloseTo(expected / n, 9);
    }
  });

  it("classifies coverage against the 90% target", () => {
    // 6/10 = 0.6 → well below 0.9 → intervals too tight → over-confident.
    expect(coverageLean(intervalCoverage([
      true, true, true, true, true, true, false, false, false, false,
    ]))).toBe("over");
    // 10/10 = 1.0 → above the band → over-cautious → under-confident.
    expect(coverageLean(intervalCoverage(Array(10).fill(true)))).toBe("under");
    // 9/10 = 0.9 → on target.
    expect(
      coverageLean(intervalCoverage([...Array(9).fill(true), false])),
    ).toBe("on-target");
    // Empty sample: nothing to judge.
    expect(coverageLean(intervalCoverage([]))).toBe("on-target");
  });
});

describe("point-estimate path is untouched by the interval additions", () => {
  it("still grades a point estimate exactly as before", () => {
    const g = gradeFermi(100_000, "3e5");
    expect(g.band).toBe("correct");
    expect(g.score).toBe(1);
    // gradeInterval does not exist on the point-grade shape.
    expect("hit" in g).toBe(false);
  });
});

describe("formatFermiNumber — magnitude display", () => {
  it("groups digits below one million", () => {
    expect(formatFermiNumber(180)).toBe("180");
    expect(formatFermiNumber(650000)).toBe("650,000");
  });
  it("uses scale words at/above one million", () => {
    expect(formatFermiNumber(8_100_000)).toBe("8.1 million");
    expect(formatFermiNumber(9_000_000_000)).toBe("9 billion");
    expect(formatFermiNumber(48_000_000_000_000)).toBe("48 trillion");
  });
  it("supports a money prefix", () => {
    expect(formatFermiNumber(4900, { money: true })).toBe("$4,900");
    expect(formatFermiNumber(480_000_000_000, { money: true })).toBe("$480 billion");
  });
});
