import { describe, expect, it } from "vitest";
import { verifyHint, verifyNoFinalAnswer } from "./aiFlavor";

/**
 * The Phase-7 answer-withholding guard for the AI hint-phrasing layer: a
 * rephrased hint (rungs 1–4 must WITHHOLD the answer) is rejected if it leaks
 * the final answer or alters/introduces a number. These are the pure gate units
 * — no network, no API key. A rejection just means the caller keeps the ORIGINAL
 * deterministic rung, so the LLM can never reveal an answer or change the math.
 */

describe("verifyNoFinalAnswer", () => {
  it("rejects a candidate that states the numeric answer", () => {
    expect(
      verifyNoFinalAnswer("…divide the two counts to get 0.072", 0.072),
    ).toBe(true);
  });

  it("accepts a candidate that stops BEFORE the answer", () => {
    expect(
      verifyNoFinalAnswer(
        "…which two counts should you divide to get the probability?",
        0.072,
      ),
    ).toBe(false);
  });

  it("treats $1,000 and 1000 as the same value (currency/comma normalized)", () => {
    expect(verifyNoFinalAnswer("the Kelly stake is $1,000", 1000)).toBe(true);
    expect(verifyNoFinalAnswer("the Kelly stake is 1000", "$1,000")).toBe(true);
  });

  it("matches a percentage answer written with a % sign", () => {
    expect(verifyNoFinalAnswer("so about 12% survive", "12%")).toBe(true);
  });

  it("matches a fraction answer (a/b)", () => {
    expect(verifyNoFinalAnswer("the chance is 1/3 here", "1/3")).toBe(true);
  });

  it("respects the tolerance for decimal answers", () => {
    expect(verifyNoFinalAnswer("roughly 2.8 at play", 2.8, 0.05)).toBe(true);
    expect(verifyNoFinalAnswer("roughly 2.9 at play", 2.8, 0)).toBe(false);
  });
});

describe("verifyHint", () => {
  const rung =
    "Re-express it as natural frequencies out of 1000 people, then compare the two counts.";

  it("accepts a rephrase that keeps the context number and hides the answer", () => {
    const candidate =
      "Picture it as 1000 people — line up the two groups and compare which is bigger.";
    expect(verifyHint(rung, candidate, { answer: 8 }).ok).toBe(true);
  });

  it("rejects a rephrase that introduces a new number", () => {
    const candidate =
      "Out of 1000 people, look at the 8 who test positive and compare.";
    const res = verifyHint(rung, candidate, { answer: 8 });
    expect(res.ok).toBe(false);
  });

  it("rejects a rephrase that drops the required context number", () => {
    const candidate = "Re-express it as natural frequencies, then compare.";
    const res = verifyHint(rung, candidate, { answer: 8 });
    expect(res.ok).toBe(false);
    expect(res.missing).toContain("1000");
  });

  it("rejects if the answer LEAKS even when the numbers otherwise match", () => {
    // requiredNumbers is pinned to ["1000"], so the number-preservation check
    // passes — yet the answer (1000) is stated, so the no-answer guard rejects.
    const candidate = "Count the 1000 people who fit and you have your answer.";
    const res = verifyHint(rung, candidate, {
      answer: 1000,
      requiredNumbers: ["1000"],
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("leaks final answer");
  });
});
