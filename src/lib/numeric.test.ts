import { describe, expect, it } from "vitest";
import {
  parseNumericInput,
  gradeNumeric,
  parseFreeResponse,
  gradeFreeResponse,
  freeResponseMatches,
} from "./numeric";

describe("parseNumericInput — input sanitization", () => {
  it("parses plain integers", () => {
    expect(parseNumericInput("300")).toBe(300);
  });
  it("strips currency symbols, commas, and whitespace", () => {
    expect(parseNumericInput("$300")).toBe(300);
    expect(parseNumericInput(" $1,200 ")).toBe(1200);
    expect(parseNumericInput("1,000,000")).toBe(1_000_000);
    expect(parseNumericInput("£75")).toBe(75);
    expect(parseNumericInput("€60")).toBe(60);
  });
  it("accepts decimals and signs", () => {
    expect(parseNumericInput("275.00")).toBe(275);
    expect(parseNumericInput("2.5")).toBe(2.5);
    expect(parseNumericInput("-40")).toBe(-40);
  });
  it("returns null on unparseable input", () => {
    expect(parseNumericInput("")).toBeNull();
    expect(parseNumericInput("   ")).toBeNull();
    expect(parseNumericInput("abc")).toBeNull();
    expect(parseNumericInput("$")).toBeNull();
    expect(parseNumericInput("12x3")).toBeNull();
    expect(parseNumericInput("1.2.3")).toBeNull();
  });
});

describe("gradeNumeric — exact match + common-error detection", () => {
  const q = {
    answer: 300,
    commonErrors: [
      { value: 450, feedback: "You bet your win probability p." },
      { value: 600, feedback: "You forgot to divide by b." },
    ],
  };

  it("grades an exact match correct (with sanitization)", () => {
    expect(gradeNumeric(q, "300").correct).toBe(true);
    expect(gradeNumeric(q, "$300").correct).toBe(true);
    expect(gradeNumeric(q, " 300.00 ").correct).toBe(true);
    const g = gradeNumeric(q, "300");
    expect(g.matchedError).toBeUndefined();
  });

  it("grades a wrong answer incorrect", () => {
    const g = gradeNumeric(q, "301");
    expect(g.correct).toBe(false);
    expect(g.parsed).toBe(301);
    expect(g.matchedError).toBeUndefined();
  });

  it("surfaces targeted feedback when the entry matches a common error", () => {
    const g = gradeNumeric(q, "$450");
    expect(g.correct).toBe(false);
    expect(g.matchedError?.feedback).toContain("win probability");
    const g2 = gradeNumeric(q, "600");
    expect(g2.matchedError?.feedback).toContain("divide by b");
  });

  it("handles unparseable entries as incorrect with no crash", () => {
    const g = gradeNumeric(q, "not a number");
    expect(g.correct).toBe(false);
    expect(g.parsed).toBeNull();
    expect(g.matchedError).toBeUndefined();
  });
});

describe("parseFreeResponse — fractions / percentages / expressions", () => {
  it("parses plain numbers, decimals, currency (superset of parseNumericInput)", () => {
    expect(parseFreeResponse("300")).toBe(300);
    expect(parseFreeResponse("$1,200")).toBe(1200);
    expect(parseFreeResponse("2.5")).toBe(2.5);
    expect(parseFreeResponse("-40")).toBe(-40);
  });
  it("parses fractions as division", () => {
    expect(parseFreeResponse("1/3")).toBeCloseTo(1 / 3, 12);
    expect(parseFreeResponse("3/4")).toBeCloseTo(0.75, 12);
    expect(parseFreeResponse("-1/8")).toBeCloseTo(-0.125, 12);
  });
  it("parses trailing percentages", () => {
    expect(parseFreeResponse("25%")).toBeCloseTo(0.25, 12);
    expect(parseFreeResponse("12.5%")).toBeCloseTo(0.125, 12);
  });
  it("evaluates simple arithmetic expressions safely", () => {
    expect(parseFreeResponse("1/2 + 1/4")).toBeCloseTo(0.75, 12);
    expect(parseFreeResponse("(3+1)/8")).toBeCloseTo(0.5, 12);
    expect(parseFreeResponse("2*3")).toBe(6);
    expect(parseFreeResponse("10 - 3*2")).toBe(4);
  });
  it("rejects malformed / unsafe input and division by zero", () => {
    expect(parseFreeResponse("")).toBeNull();
    expect(parseFreeResponse("abc")).toBeNull();
    expect(parseFreeResponse("1/0")).toBeNull();
    expect(parseFreeResponse("1..2")).toBeNull();
    expect(parseFreeResponse("2**3")).toBeNull();
    expect(parseFreeResponse("alert(1)")).toBeNull();
    expect(parseFreeResponse("(1+2")).toBeNull();
  });
});

describe("gradeFreeResponse — fraction/expression-aware grading", () => {
  const q = {
    answer: 0.3333,
    decimals: 4,
    commonErrors: [
      { value: 0.6667, feedback: "You inverted the ratio.", misconception: "reversed_ratio" },
    ],
  };
  it("accepts an equivalent fraction for a decimal answer (within decimals)", () => {
    // 1/3 = 0.3333… rounds to 0.3333 at 4 dp.
    expect(gradeFreeResponse(q, "1/3").correct).toBe(true);
    expect(gradeFreeResponse(q, "0.3333").correct).toBe(true);
  });
  it("matches a wrong expression to the family error mode", () => {
    const g = gradeFreeResponse(q, "2/3");
    expect(g.correct).toBe(false);
    expect(g.matchedError?.misconception).toBe("reversed_ratio");
  });
});

describe("gradeFreeResponse — thousandth-rounding across representations", () => {
  it("accepts fraction and truncated decimal for a non-terminating answer (1/3)", () => {
    // Reference stored as the raw non-terminating decimal, no `decimals` set.
    const q = { answer: 1 / 3 };
    expect(gradeFreeResponse(q, "1/3").correct).toBe(true);
    expect(gradeFreeResponse(q, "0.333").correct).toBe(true);
    expect(gradeFreeResponse(q, "0.3333").correct).toBe(true);
    expect(gradeFreeResponse(q, "0.334").correct).toBe(false);
    expect(gradeFreeResponse(q, "0.3").correct).toBe(false);
  });

  it("treats percent / decimal / fraction as equivalent for 1/2", () => {
    const q = { answer: 0.5 };
    expect(gradeFreeResponse(q, "50%").correct).toBe(true);
    expect(gradeFreeResponse(q, "0.5").correct).toBe(true);
    expect(gradeFreeResponse(q, "1/2").correct).toBe(true);
    expect(gradeFreeResponse(q, "0.501").correct).toBe(false);
  });

  it("rounds both sides to the nearest thousandth before comparing", () => {
    const q = { answer: 2 / 3 };
    expect(gradeFreeResponse(q, "2/3").correct).toBe(true);
    expect(gradeFreeResponse(q, "0.667").correct).toBe(true);
    expect(gradeFreeResponse(q, "66.7%").correct).toBe(true);
    expect(gradeFreeResponse(q, "0.666").correct).toBe(false);
  });

  it("keeps exact-integer / exact-dollar answers strict (no rounding slack)", () => {
    const q = { answer: 42 };
    expect(gradeFreeResponse(q, "42").correct).toBe(true);
    expect(gradeFreeResponse(q, "$42").correct).toBe(true);
    expect(gradeFreeResponse(q, "42.0004").correct).toBe(false);
    expect(gradeFreeResponse(q, "42.001").correct).toBe(false);
    expect(gradeFreeResponse(q, "41.999").correct).toBe(false);
  });

  it("keeps whole-dollar answers strict but accepts equivalent expressions", () => {
    const q = { answer: 300 };
    expect(gradeFreeResponse(q, "300").correct).toBe(true);
    expect(gradeFreeResponse(q, "600/2").correct).toBe(true);
    expect(gradeFreeResponse(q, "300.0004").correct).toBe(false);
  });
});

describe("gradeFreeResponse — thousandth tolerance vs authored precision", () => {
  it("accepts a 3-decimal rounding of a reference stored at finer precision", () => {
    // Probability families store non-terminating answers at 4 dp (e.g. 1/3).
    const q = { answer: 0.3333, decimals: 4 };
    expect(gradeFreeResponse(q, "0.3333").correct).toBe(true); // exact/declared
    expect(gradeFreeResponse(q, "1/3").correct).toBe(true); // full-precision fraction
    expect(gradeFreeResponse(q, "0.333").correct).toBe(true); // learner rounded to 3 dp
  });

  it("still rejects values outside the thousandth of the answer", () => {
    const q = { answer: 0.3333, decimals: 4 };
    expect(gradeFreeResponse(q, "0.334").correct).toBe(false);
    expect(gradeFreeResponse(q, "0.33").correct).toBe(false);
  });

  it("ranks an exact authored error value above the thousandth tolerance", () => {
    // 0.6668 rounds to 0.667 (same thousandth as 2/3) but is a registered error:
    // it must surface the misconception, not be leniently accepted.
    const q = {
      answer: 0.6667,
      decimals: 4,
      commonErrors: [
        { value: 0.6668, feedback: "off-by-one on remaining", misconception: "miscount" },
      ],
    };
    const g = gradeFreeResponse(q, "0.6668");
    expect(g.correct).toBe(false);
    expect(g.matchedError?.misconception).toBe("miscount");
  });
});

describe("freeResponseMatches", () => {
  it("requires exact match for whole-number answers without declared decimals", () => {
    expect(freeResponseMatches({ answer: 42 }, 42)).toBe(true);
    expect(freeResponseMatches({ answer: 42 }, 42.0004)).toBe(false);
  });
  it("rounds to the nearest thousandth for non-integer answers", () => {
    expect(freeResponseMatches({ answer: 1 / 3 }, 0.333)).toBe(true);
    expect(freeResponseMatches({ answer: 1 / 3 }, 0.334)).toBe(false);
  });
  it("honors declared decimals precision by rounding to the thousandth", () => {
    expect(freeResponseMatches({ answer: 0.3333, decimals: 4 }, 1 / 3)).toBe(true);
  });
});
