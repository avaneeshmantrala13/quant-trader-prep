import { describe, expect, it } from "vitest";
import {
  classifyTiming,
  normalizeSpokenNumber,
  scoreMathAnswer,
} from "./scoring";
import type { MathStep } from "./types";

/**
 * Math-portion scoring is DETERMINISTIC: identical (step, answer text, elapsed)
 * always yields an identical grade. We cover spoken-number normalization,
 * right/wrong/tolerance grading, and the timing bands.
 */

const step = (over: Partial<MathStep> = {}): MathStep => ({
  kind: "math",
  id: "s",
  prompt: "12 x 12 = ?",
  answer: 144,
  explanation: "",
  followUps: [],
  targetMs: 15000,
  ...over,
});

describe("normalizeSpokenNumber", () => {
  it("passes digit strings through untouched", () => {
    expect(normalizeSpokenNumber("42")).toBe("42");
    expect(normalizeSpokenNumber("  144 ")).toBe("144");
    expect(normalizeSpokenNumber("3/8")).toBe("3/8");
    expect(normalizeSpokenNumber("(3+1)/8")).toBe("(3+1)/8");
  });

  it("converts English integer words", () => {
    expect(normalizeSpokenNumber("forty two")).toBe("42");
    expect(normalizeSpokenNumber("forty-two")).toBe("42");
    expect(normalizeSpokenNumber("twelve")).toBe("12");
    expect(normalizeSpokenNumber("three hundred")).toBe("300");
    expect(normalizeSpokenNumber("three hundred forty two")).toBe("342");
    expect(normalizeSpokenNumber("one thousand two hundred")).toBe("1200");
    expect(normalizeSpokenNumber("three hundred and five")).toBe("305");
  });

  it("handles spoken decimals via 'point'", () => {
    expect(normalizeSpokenNumber("one point five")).toBe("1.5");
    expect(normalizeSpokenNumber("zero point two five")).toBe("0.25");
    expect(normalizeSpokenNumber("point five")).toBe("0.5");
  });

  it("handles percent and fraction words", () => {
    expect(normalizeSpokenNumber("fifty percent")).toBe("50%");
    expect(normalizeSpokenNumber("25 percent")).toBe("25%");
    expect(normalizeSpokenNumber("one half")).toBe("1/2");
    expect(normalizeSpokenNumber("a half")).toBe("1/2");
    expect(normalizeSpokenNumber("three quarters")).toBe("3/4");
  });

  it("returns empty for empty/nullish and passes through unknown phrases", () => {
    expect(normalizeSpokenNumber("")).toBe("");
    expect(normalizeSpokenNumber("   ")).toBe("");
    expect(normalizeSpokenNumber("banana")).toBe("banana");
  });

  it("is deterministic", () => {
    for (const s of ["forty two", "one point five", "fifty percent"]) {
      expect(normalizeSpokenNumber(s)).toBe(normalizeSpokenNumber(s));
    }
  });
});

describe("classifyTiming", () => {
  it("bands relative to target", () => {
    expect(classifyTiming(5000, 15000)).toBe("fast");
    expect(classifyTiming(15000, 15000)).toBe("fast");
    expect(classifyTiming(20000, 15000)).toBe("ok");
    expect(classifyTiming(30000, 15000)).toBe("ok");
    expect(classifyTiming(45000, 15000)).toBe("slow");
  });
  it("clamps negative elapsed to fast", () => {
    expect(classifyTiming(-100, 15000)).toBe("fast");
  });
});

describe("scoreMathAnswer", () => {
  it("grades a correct spoken answer as correct with score 1", () => {
    const g = scoreMathAnswer(step(), "one hundred forty four", 5000);
    expect(g.parsed).toBe(144);
    expect(g.correct).toBe(true);
    expect(g.score).toBe(1);
    expect(g.timing).toBe("fast");
  });

  it("grades a correct typed answer identically", () => {
    const g = scoreMathAnswer(step(), "144", 5000);
    expect(g.correct).toBe(true);
    expect(g.score).toBe(1);
  });

  it("grades a wrong answer as incorrect and surfaces matched error feedback", () => {
    const g = scoreMathAnswer(
      step({
        answer: 144,
        commonErrors: [
          { value: 24, feedback: "You added instead of multiplied.", misconception: "op" },
        ],
      }),
      "twenty four",
      8000,
    );
    expect(g.correct).toBe(false);
    expect(g.score).toBe(0);
    expect(g.matchedError?.feedback).toBe("You added instead of multiplied.");
  });

  it("accepts tolerant / equivalent representations for non-integer answers", () => {
    const s = step({ answer: 0.5, prompt: "1/2 = ?" });
    expect(scoreMathAnswer(s, "one half", 1000).correct).toBe(true);
    expect(scoreMathAnswer(s, "0.5", 1000).correct).toBe(true);
    expect(scoreMathAnswer(s, "fifty percent", 1000).correct).toBe(true);
  });

  it("reports slow timing without changing correctness", () => {
    const g = scoreMathAnswer(step(), "144", 60000);
    expect(g.correct).toBe(true);
    expect(g.timing).toBe("slow");
    expect(g.score).toBe(1);
  });

  it("treats unparseable input as incorrect (parsed null)", () => {
    const g = scoreMathAnswer(step(), "no idea", 5000);
    expect(g.parsed).toBe(null);
    expect(g.correct).toBe(false);
  });

  it("is fully deterministic across repeated calls", () => {
    const a = scoreMathAnswer(step(), "one hundred forty four", 9000);
    const b = scoreMathAnswer(step(), "one hundred forty four", 9000);
    expect(a).toEqual(b);
  });
});
