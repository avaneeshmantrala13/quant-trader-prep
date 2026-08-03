import { describe, expect, it } from "vitest";
import { migrateProgress } from "./migrate";
import { emptyProgress } from "@/types/progress";

describe("migrateProgress (v1 → v2 → v3)", () => {
  it("upgrades a v1 blob (no mastery fields) non-destructively to v3", () => {
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
    const v3 = migrateProgress(v1);
    expect(v3.version).toBe(3);
    // preserved
    expect(v3.levelProgress["p-1"].mastered).toBe(true);
    expect(v3.xp).toBe(420);
    expect(v3.streak).toBe(7);
    expect(v3.lastActiveDate).toBe("2025-12-31");
    expect(v3.createdAt).toBe("2025-01-01T00:00:00.000Z");
    // new fields default to empty maps
    expect(v3.topicMastery).toEqual({});
    expect(v3.tierDifficulty).toEqual({});
    expect(v3.diagnosticDoneAt).toBeUndefined();
    // T12 (v2→v3): the new optional Glicko difficulty map starts ABSENT.
    expect(v3.glickoDifficulty).toBeUndefined();
  });

  it("passes a v2 blob through to v3, preserving existing mastery state EXACTLY (θ/α/β valid + unchanged)", () => {
    const v2in = {
      version: 2,
      levelProgress: {},
      resume: {},
      xp: 10,
      streak: 0,
      lastActiveDate: "2026-01-01",
      createdAt: "2026-01-01T00:00:00.000Z",
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
    expect(out.version).toBe(3);
    // θ/α/β preserved VALID and UNCHANGED.
    expect(out.topicMastery?.["t::_core"].theta).toBe(0.5);
    expect(out.topicMastery?.["t::_core"].alpha).toBe(3);
    expect(out.topicMastery?.["t::_core"].beta).toBe(1);
    expect(out.topicMastery?.["t::_core"].n).toBe(3);
    expect(out.tierDifficulty?.["t::_core#medium"]).toBe(0.4);
    expect(out.diagnosticDoneAt).toBe("2026-01-01T00:00:00.000Z");
    // Additive field left absent since the v2 blob never carried it.
    expect(out.glickoDifficulty).toBeUndefined();
  });

  it("preserves an already-present T12 Glicko difficulty map and per-topic IRT ability", () => {
    const withT12 = {
      ...emptyProgress(),
      topicMastery: {
        "t::_core": {
          theta: 0.5,
          n: 6,
          alpha: 5,
          beta: 3,
          lastSeen: "2026-01-01T00:00:00.000Z",
          misconceptions: {},
          irtAbility: 0.73,
          irtAbilitySe: 0.4,
        },
      },
      glickoDifficulty: {
        "t::_core#medium": { rating: 1560, rd: 90, lastAt: "2026-01-01T00:00:00.000Z" },
      },
    };
    const out = migrateProgress(withT12);
    expect(out.version).toBe(3);
    // The new estimator signals ride along, preserved-if-present.
    expect(out.topicMastery?.["t::_core"].irtAbility).toBe(0.73);
    expect(out.topicMastery?.["t::_core"].irtAbilitySe).toBe(0.4);
    expect(out.glickoDifficulty?.["t::_core#medium"].rating).toBe(1560);
    expect(out.glickoDifficulty?.["t::_core#medium"].rd).toBe(90);
  });

  it("preserves the durable Timed-OA store across the migration (non-destructive)", () => {
    const withOa = {
      ...emptyProgress(),
      version: 2,
      oaTimed: { active: undefined, results: [{ id: "oa-x" }] },
    } as unknown;
    const out = migrateProgress(withOa);
    expect(out.version).toBe(3);
    expect(out.oaTimed).toEqual({ active: undefined, results: [{ id: "oa-x" }] });
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
    expect(out.version).toBe(3);
    expect(out.levelProgress.x.mastered).toBe(true);
    expect(out.topicMastery).toEqual({});
  });

  it("leaves `goalMode` undefined for a pre-mode save (existing users default to Case B)", () => {
    const out = migrateProgress({ ...emptyProgress(), version: 1 });
    expect(out.goalMode).toBeUndefined();
  });

  it("preserves an explicit `goalMode` and the additive `calibrationLog`", () => {
    const saved = {
      ...emptyProgress(),
      goalMode: "course" as const,
      calibrationLog: [{ topicKey: "probability::Expected Value", pred: 0.8, outcome: 1 as const }],
    };
    const out = migrateProgress(saved);
    expect(out.goalMode).toBe("course");
    expect(out.calibrationLog).toHaveLength(1);
    expect(out.calibrationLog?.[0].pred).toBe(0.8);
  });

  it("returns a fresh empty (v3) progress for garbage input", () => {
    expect(migrateProgress(null).version).toBe(3);
    expect(migrateProgress(undefined).topicMastery).toEqual({});
    expect(migrateProgress("nope").tierDifficulty).toEqual({});
  });
});
