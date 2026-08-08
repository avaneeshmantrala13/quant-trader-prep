import { describe, expect, it } from "vitest";
import { devEffectiveStage, isValidStage } from "./devStage";
import { nextStage, stageOrder, type Stage } from "@/lib/pipeline/stateMachine";

/**
 * `devEffectiveStage` is the single choke point for the developer stage bypass.
 * The crux: it may return a forced stage ONLY for a developer — a normal user
 * can never be moved off the gate-derived (`resolved`) stage, no matter what
 * `forcedStage` holds.
 */

const RESOLVED: Stage = "diagnostic-untimed";

describe("devEffectiveStage", () => {
  it("returns the resolved stage when no override is set", () => {
    expect(
      devEffectiveStage(RESOLVED, { isDeveloper: true, forcedStage: null }),
    ).toBe(RESOLVED);
  });

  it("returns the forced stage for a developer (set-stage / jump)", () => {
    for (const target of stageOrder) {
      expect(
        devEffectiveStage(RESOLVED, {
          isDeveloper: true,
          forcedStage: target,
        }),
      ).toBe(target);
    }
  });

  it("NORMAL USERS CANNOT BYPASS: a non-developer always gets the resolved stage", () => {
    // Even with a forced stage present, a non-developer is pinned to `resolved`.
    for (const target of stageOrder) {
      expect(
        devEffectiveStage(RESOLVED, {
          isDeveloper: false,
          forcedStage: target,
        }),
      ).toBe(RESOLVED);
    }
  });

  it("force-advance drives to the NEXT stage in order", () => {
    // The control forces `nextStage(current)`; assert that composition lands on
    // the correct successor for a developer.
    let current: Stage = stageOrder[0];
    for (let i = 1; i < stageOrder.length; i++) {
      const next = nextStage(current);
      expect(next).toBe(stageOrder[i]);
      current = devEffectiveStage(current, {
        isDeveloper: true,
        forcedStage: next,
      });
      expect(current).toBe(stageOrder[i]);
    }
    // Terminal stage has no successor.
    expect(nextStage(stageOrder[stageOrder.length - 1])).toBeNull();
  });

  it("ignores an unknown/garbage forced value (falls back to resolved)", () => {
    expect(
      devEffectiveStage(RESOLVED, {
        isDeveloper: true,
        forcedStage: "not-a-stage" as Stage,
      }),
    ).toBe(RESOLVED);
  });
});

describe("isValidStage", () => {
  it("accepts every real stage and rejects everything else", () => {
    for (const s of stageOrder) expect(isValidStage(s)).toBe(true);
    expect(isValidStage("nope")).toBe(false);
    expect(isValidStage(null)).toBe(false);
    expect(isValidStage(undefined)).toBe(false);
  });
});
