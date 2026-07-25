import { describe, expect, it } from "vitest";
import { deriveVerdict } from "./verdict";
import type { TopicMastery } from "@/types/mastery";

const AT = "2026-01-01T00:00:00.000Z";

function m(partial: Partial<TopicMastery>): TopicMastery {
  return {
    theta: 0,
    n: 1,
    alpha: 1,
    beta: 1,
    lastSeen: AT,
    misconceptions: {},
    ...partial,
  };
}

describe("deriveVerdict", () => {
  it("n = 0 (or undefined mastery) ⇒ UNCERTAIN (wide prior CI)", () => {
    expect(deriveVerdict(undefined, "t").state).toBe("UNCERTAIN");
    expect(deriveVerdict(m({ n: 0, alpha: 1, beta: 1 }), "t").state).toBe(
      "UNCERTAIN",
    );
    expect(deriveVerdict(undefined, "t").mastered).toBe(false);
  });

  it("strong evidence (α=20, β=1), well-calibrated ⇒ STRONG + mastered", () => {
    const v = deriveVerdict(m({ n: 19, alpha: 20, beta: 1 }), "t", 0);
    expect(v.state).toBe("STRONG");
    expect(v.mastered).toBe(true);
    expect(v.lo).toBeGreaterThanOrEqual(0.8);
  });

  it("consistently failing (α=1, β=20) ⇒ WEAK, not mastered", () => {
    const v = deriveVerdict(m({ n: 19, alpha: 1, beta: 20 }), "t");
    expect(v.state).toBe("WEAK");
    expect(v.mastered).toBe(false);
  });

  it("CI straddling the bar (α=8, β=2) ⇒ UNCERTAIN (first-class)", () => {
    const v = deriveVerdict(m({ n: 8, alpha: 8, beta: 2 }), "t");
    expect(v.lo).toBeLessThan(0.8);
    expect(v.hi).toBeGreaterThan(0.8);
    expect(v.state).toBe("UNCERTAIN");
  });

  it("overconfident (high mean but relGap 0.3) ⇒ WEAK", () => {
    const v = deriveVerdict(m({ n: 19, alpha: 20, beta: 1 }), "t", 0.3);
    expect(v.state).toBe("WEAK");
  });

  it("surfaces the top named misconceptions", () => {
    const v = deriveVerdict(
      m({ n: 5, alpha: 3, beta: 3, misconceptions: { "t::a": 1, "t::b": 4 } }),
      "t",
    );
    expect(v.namedMisconceptions[0]).toBe("t::b");
  });
});
