import { describe, expect, it } from "vitest";
import { applyItemAttempt } from "./mastery";
import { betaMean } from "./beta";
import type { ItemAttempt } from "@/types/mastery";

/** Minimal ItemAttempt builder for a numeric free-response item. */
function attempt(over: Partial<ItemAttempt> = {}): ItemAttempt {
  return {
    topicKey: "prob::conditional",
    tier: "medium",
    correct: true,
    mode: "numeric",
    at: new Date().toISOString(),
    ...over,
  };
}

describe("applyItemAttempt — partial credit (PHASE_1)", () => {
  it("full-credit (no hint) moves θ up like a binary correct", () => {
    const binary = applyItemAttempt(undefined, undefined, attempt({ correct: true }), 0);
    const full = applyItemAttempt(
      undefined,
      undefined,
      attempt({ correct: true, credit: 1 }),
      0,
    );
    expect(full.mastery.theta).toBeCloseTo(binary.mastery.theta, 12);
    expect(full.mastery.theta).toBeGreaterThan(0);
  });

  it("fractional credit moves θ LESS than a full-credit correct", () => {
    const full = applyItemAttempt(undefined, undefined, attempt({ credit: 1 }), 0);
    const partial = applyItemAttempt(undefined, undefined, attempt({ credit: 0.2 }), 0);
    const zero = applyItemAttempt(
      undefined,
      undefined,
      attempt({ correct: false, credit: 0 }),
      0,
    );
    expect(partial.mastery.theta).toBeLessThan(full.mastery.theta);
    expect(partial.mastery.theta).toBeGreaterThan(zero.mastery.theta);
  });

  it("Beta posterior mean tracks the fractional credit (soft observation)", () => {
    // Rung-5 recovery (0.04) barely moves the posterior — ~0.04 success + ~0.96 fail.
    const rung5 = applyItemAttempt(undefined, undefined, attempt({ credit: 0.04 }), 0);
    const m = rung5.mastery;
    expect(betaMean(m.alpha, m.beta)).toBeCloseTo((1 + 0.04) / (1 + 1 + 1), 6);
    // A clean solve pushes the mean up much more.
    const clean = applyItemAttempt(undefined, undefined, attempt({ credit: 1 }), 0);
    expect(betaMean(clean.mastery.alpha, clean.mastery.beta)).toBeGreaterThan(
      betaMean(m.alpha, m.beta),
    );
  });

  it("a partial-credit recovery BUMPS the tripped misconception (help was needed)", () => {
    const prev = undefined;
    const res = applyItemAttempt(
      prev,
      undefined,
      attempt({ correct: true, credit: 0.2, misconceptions: ["prob::conditional::reversed_conditional"] }),
      0,
    );
    // Even though they eventually got it right, help was used (credit < 1), so the
    // misconception they demonstrated is recorded rather than decayed.
    expect(res.mastery.misconceptions["prob::conditional::reversed_conditional"]).toBe(1);
  });

  it("a clean full-credit solve DECAYS existing misconception flags", () => {
    const prev = {
      theta: 0,
      n: 1,
      alpha: 1,
      beta: 2,
      lastSeen: new Date().toISOString(),
      misconceptions: { "prob::conditional::reversed_conditional": 2 },
    };
    const res = applyItemAttempt(prev, undefined, attempt({ credit: 1 }), 0);
    expect(
      res.mastery.misconceptions["prob::conditional::reversed_conditional"],
    ).toBe(1); // 2 * MISCONCEPTION_DECAY(0.5)
  });

  it("absent credit is fully back-compatible with binary callers", () => {
    const correct = applyItemAttempt(undefined, undefined, attempt({ correct: true }), 0);
    const wrong = applyItemAttempt(
      undefined,
      undefined,
      attempt({ correct: false }),
      0,
    );
    expect(correct.mastery.theta).toBeGreaterThan(0);
    expect(wrong.mastery.theta).toBeLessThan(0);
  });
});
