import { describe, expect, it } from "vitest";
import {
  computeFermiReference,
  computeRunningSteps,
  parseFermiInput,
  gradeFermi,
  gradeFermiValue,
  formatFermiNumber,
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
