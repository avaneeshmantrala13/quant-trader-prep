import { describe, expect, it } from "vitest";
import { migrateProgress } from "./migrate";
import { emptyProgress } from "@/types/progress";

describe("migrateProgress (v1 → v2)", () => {
  it("upgrades a v1 blob (no mastery fields) non-destructively", () => {
    const v1 = {
      version: 1,
      levelProgress: {
        "p-1": { bestScore: 0.9, mastered: true, attempts: 3 },
      },
      resume: {},
      xp: 420,
      streak: 7,
      lastActiveDate: "2025-12-31",
      createdAt: "2025-01-01T00:00:00.000Z",
    };
    const v2 = migrateProgress(v1);
    expect(v2.version).toBe(2);
    // preserved
    expect(v2.levelProgress["p-1"].mastered).toBe(true);
    expect(v2.xp).toBe(420);
    expect(v2.streak).toBe(7);
    expect(v2.lastActiveDate).toBe("2025-12-31");
    expect(v2.createdAt).toBe("2025-01-01T00:00:00.000Z");
    // new fields default to empty maps
    expect(v2.topicMastery).toEqual({});
    expect(v2.tierDifficulty).toEqual({});
    expect(v2.diagnosticDoneAt).toBeUndefined();
  });

  it("passes a v2 blob through, preserving existing mastery state", () => {
    const v2in = {
      ...emptyProgress(),
      version: 2,
      xp: 10,
      topicMastery: {
        "t::_core": {
          theta: 0.5,
          n: 3,
          alpha: 3,
          beta: 1,
          lastSeen: "2026-01-01T00:00:00.000Z",
          misconceptions: {},
        },
      },
      tierDifficulty: { "t::_core#medium": 0.4 },
      diagnosticDoneAt: "2026-01-01T00:00:00.000Z",
    };
    const out = migrateProgress(v2in);
    expect(out.version).toBe(2);
    expect(out.topicMastery?.["t::_core"].theta).toBe(0.5);
    expect(out.tierDifficulty?.["t::_core#medium"]).toBe(0.4);
    expect(out.diagnosticDoneAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("preserves the additive `onboardingTourDoneAt` UI flag on load (regression: tour must not re-auto-open every reload)", () => {
    const saved = {
      ...emptyProgress(),
      diagnosticDoneAt: "2026-01-01T00:00:00.000Z",
      onboardingTourDoneAt: "2026-01-02T00:00:00.000Z",
    };
    const out = migrateProgress(saved);
    expect(out.onboardingTourDoneAt).toBe("2026-01-02T00:00:00.000Z");
  });

  it("leaves `onboardingTourDoneAt` undefined when the saved blob never set it", () => {
    const out = migrateProgress({ ...emptyProgress(), version: 1 });
    expect(out.onboardingTourDoneAt).toBeUndefined();
  });

  it("safely upgrades a blob missing `version` entirely", () => {
    const legacy = {
      levelProgress: { x: { bestScore: 1, mastered: true, attempts: 1 } },
      resume: {},
      xp: 5,
      streak: 1,
      lastActiveDate: "2025-06-01",
      createdAt: "2025-01-01T00:00:00.000Z",
    };
    const out = migrateProgress(legacy);
    expect(out.version).toBe(2);
    expect(out.levelProgress.x.mastered).toBe(true);
    expect(out.topicMastery).toEqual({});
  });

  it("returns a fresh empty (v2) progress for garbage input", () => {
    expect(migrateProgress(null).version).toBe(2);
    expect(migrateProgress(undefined).topicMastery).toEqual({});
    expect(migrateProgress("nope").tierDifficulty).toEqual({});
  });
});
