import { describe, expect, it } from "vitest";
import { parseNumericInput, gradeNumeric } from "./numeric";

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
