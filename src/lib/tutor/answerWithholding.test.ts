import { describe, expect, it } from "vitest";
import { containsFinalAnswer } from "./answerWithholding";

describe("containsFinalAnswer", () => {
  it("detects the exact integer answer", () => {
    expect(containsFinalAnswer("the stake works out to 300 dollars", 300)).toBe(
      true,
    );
    expect(containsFinalAnswer("bet around 250", 300)).toBe(false);
  });

  it("normalises currency + thousands separators ($1,000 vs 1000)", () => {
    expect(containsFinalAnswer("you should stake $1,000 here", 1000)).toBe(true);
    expect(containsFinalAnswer("you should stake 1000 here", "$1,000")).toBe(
      true,
    );
  });

  it("matches decimals within tolerance and rejects near-but-different", () => {
    expect(containsFinalAnswer("the value is 2.8", 2.8)).toBe(true);
    // near but different: rejected at tolerance 0
    expect(containsFinalAnswer("the value is 2.81", 2.8)).toBe(false);
    // within an explicit tolerance
    expect(containsFinalAnswer("the value is 2.81", 2.8, 0.02)).toBe(true);
  });

  it("catches fraction answers written as a/b", () => {
    expect(containsFinalAnswer("this collapses to 1/3 of the pool", "1/3")).toBe(
      true,
    );
    expect(containsFinalAnswer("this is 1/4 of the pool", "1/3")).toBe(false);
  });

  it("matches percentages against a probability answer", () => {
    expect(containsFinalAnswer("about 8% of positives", 0.08)).toBe(true);
  });

  it("falls back to substring for non-numeric decision answers", () => {
    const decision = "Spin again (re-randomize the cylinder)";
    expect(
      containsFinalAnswer(`the right move is to ${decision.toLowerCase()}`, decision),
    ).toBe(true);
    expect(containsFinalAnswer("keep pulling the same cylinder", decision)).toBe(
      false,
    );
  });

  it("is false for empty text", () => {
    expect(containsFinalAnswer("", 5)).toBe(false);
  });
});
