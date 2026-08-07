import { describe, expect, it } from "vitest";
import {
  PACE_BAND_TOKEN,
  paceBand,
  paceFraction,
  perQuestionBudgetMs,
  sectionBudgetMs,
} from "./budget";
import {
  DEFAULT_SPRINT_BUDGET_MS,
  OPTIVER_DEFAULT,
  ZETAMAC_DEFAULT,
  type ArenaPreset,
} from "./config";

describe("perQuestionBudgetMs", () => {
  it("derives window/cap for a capped preset (Optiver = 6000ms)", () => {
    // 480s window / 80 questions = 6000ms/q — the real arithmetic-sprint pace.
    expect(perQuestionBudgetMs(OPTIVER_DEFAULT)).toBe(6000);
  });

  it("falls back to the sprint consensus budget with no cap (Zetamac)", () => {
    expect(perQuestionBudgetMs(ZETAMAC_DEFAULT)).toBe(DEFAULT_SPRINT_BUDGET_MS);
  });

  it("prefers an explicit budgetMs (adaptive tightening)", () => {
    const p: ArenaPreset = { ...OPTIVER_DEFAULT, budgetMs: 4500 };
    expect(perQuestionBudgetMs(p)).toBe(4500);
  });

  it("never returns below 1ms", () => {
    const p: ArenaPreset = { ...ZETAMAC_DEFAULT, budgetMs: 0 };
    // budgetMs 0 is ignored (falsy) → falls back to sprint default
    expect(perQuestionBudgetMs(p)).toBe(DEFAULT_SPRINT_BUDGET_MS);
  });
});

describe("sectionBudgetMs", () => {
  it("is the full window in ms", () => {
    expect(sectionBudgetMs(OPTIVER_DEFAULT)).toBe(480_000);
    expect(sectionBudgetMs(ZETAMAC_DEFAULT)).toBe(120_000);
  });
});

describe("paceFraction", () => {
  it("is elapsed/budget, clamped to [0,1]", () => {
    expect(paceFraction(3000, 6000)).toBeCloseTo(0.5, 6);
    expect(paceFraction(0, 6000)).toBe(0);
    expect(paceFraction(9000, 6000)).toBe(1); // clamped
    expect(paceFraction(-100, 6000)).toBe(0); // negative clamps to 0
  });

  it("is 1 for a non-positive budget (avoids divide-by-zero)", () => {
    expect(paceFraction(1000, 0)).toBe(1);
  });
});

describe("paceBand", () => {
  it("classifies ahead / on-pace / behind / over at the default marks", () => {
    expect(paceBand(1000, 6000)).toBe("ahead"); // 0.17 < 0.4
    expect(paceBand(3000, 6000)).toBe("on-pace"); // 0.5 in [0.4,0.75)
    expect(paceBand(5000, 6000)).toBe("behind"); // 0.83 in [0.75,1)
    expect(paceBand(6000, 6000)).toBe("over"); // ≥ 1
    expect(paceBand(9000, 6000)).toBe("over");
  });

  it("respects custom marks", () => {
    expect(paceBand(3000, 6000, { onPaceAt: 0.6 })).toBe("ahead");
    expect(paceBand(3600, 6000, { onPaceAt: 0.6 })).toBe("on-pace");
  });

  it("has a token for every band", () => {
    for (const band of ["ahead", "on-pace", "behind", "over"] as const) {
      expect(PACE_BAND_TOKEN[band]).toBeTruthy();
    }
  });
});
