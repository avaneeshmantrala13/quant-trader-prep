import { describe, expect, it } from "vitest";
import {
  REVIEW_INTERVALS_DAYS,
  climbBackSequence,
  isNodeCleared,
  scheduleReview,
} from "./climbBack";

const NOW = "2026-01-01T00:00:00.000Z";
const dayMs = 86_400_000;
const daysAfter = (iso: string) =>
  (new Date(iso).getTime() - new Date(NOW).getTime()) / dayMs;

describe("scheduleReview (SM-2 ladder [1,3,7,16,35])", () => {
  it("advances the ladder on each pass", () => {
    let step = 0;
    for (const expected of REVIEW_INTERVALS_DAYS) {
      const r = scheduleReview(NOW, step, true);
      expect(daysAfter(r.reviewDue)).toBe(expected);
      step = r.step;
    }
    // Clamped at the last rung.
    const capped = scheduleReview(NOW, step, true);
    expect(daysAfter(capped.reviewDue)).toBe(35);
    expect(capped.step).toBe(REVIEW_INTERVALS_DAYS.length - 1);
  });

  it("resets to step 0 (shortest interval) on a miss", () => {
    const r = scheduleReview(NOW, 3, false);
    expect(r.step).toBe(0);
    expect(daysAfter(r.reviewDue)).toBe(1);
  });
});

describe("isNodeCleared", () => {
  it("true at CLEAR_CORRECT_AT_TARGET (2) correct at target tier", () => {
    expect(isNodeCleared(1, 1, 2)).toBe(true);
  });

  it("true when CI_low ≥ 0.80 even with fewer recent correct", () => {
    // A strongly-successful posterior clears via the credible interval.
    expect(isNodeCleared(60, 3, 0)).toBe(true);
  });

  it("false when neither bar is met", () => {
    expect(isNodeCleared(3, 2, 1)).toBe(false);
    expect(isNodeCleared(1, 1, 0)).toBe(false);
  });
});

describe("climbBackSequence (interleave, don't mass-drill)", () => {
  it("alternates repaired ↔ parent", () => {
    expect(climbBackSequence("child", "parent", 2)).toEqual([
      "child",
      "parent",
      "child",
      "parent",
    ]);
  });

  it("interleaves rather than blocking (no two identical in a row)", () => {
    const seq = climbBackSequence("child", "parent", 3);
    for (let i = 1; i < seq.length; i++) {
      expect(seq[i]).not.toBe(seq[i - 1]);
    }
    // And the parent (the climb target) is actually present.
    expect(seq).toContain("parent");
  });
});
