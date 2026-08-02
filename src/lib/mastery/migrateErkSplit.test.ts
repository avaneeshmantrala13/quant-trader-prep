import { describe, expect, it } from "vitest";
import { migrateErkSplit } from "./migrateErkSplit";
import { topicKeyOf } from "./topicKey";
import { emptyProgress, type UserProgress } from "@/types/progress";
import type { TopicMastery } from "@/types/mastery";

const ERK_KEY = topicKeyOf("probability", "Extra Relevant Knowledge");
const MGF_KEY = topicKeyOf("probability", "Moment Generating Functions");
const GAMMA_KEY = topicKeyOf("probability", "Gamma Distribution");

function erkMastery(): TopicMastery {
  return {
    theta: 0.8,
    n: 10,
    alpha: 7,
    beta: 4,
    lastSeen: "2026-01-01T00:00:00.000Z",
    misconceptions: { "probability::Extra Relevant Knowledge::foo": 2 },
  };
}

describe("migrateErkSplit", () => {
  it("is a no-op when no stale ERK aggregate is present", () => {
    const fresh = emptyProgress();
    expect(migrateErkSplit(fresh)).toBe(fresh); // same reference (fast path)
  });

  it("removes the stale blended ERK aggregate", () => {
    const p: UserProgress = {
      ...emptyProgress(),
      topicMastery: { [ERK_KEY]: erkMastery() },
    };
    const out = migrateErkSplit(p);
    expect(out.topicMastery?.[ERK_KEY]).toBeUndefined();
  });

  it("re-derives a new topic's mastery from that topic's OWN level attempts", () => {
    const p: UserProgress = {
      ...emptyProgress(),
      levelProgress: {
        // ek-mgf is a 5-question quiz; bestScore 0.8 → 4 successes / 1 failure.
        "ek-mgf": {
          bestScore: 0.8,
          mastered: true,
          attempts: 2,
          completedAt: "2026-02-02T00:00:00.000Z",
        },
      },
      topicMastery: { [ERK_KEY]: erkMastery() },
    };
    const out = migrateErkSplit(p);
    const mgf = out.topicMastery?.[MGF_KEY];
    expect(mgf).toBeDefined();
    // Beta seeded from real attempts: alpha = 1 + successes, beta = 1 + failures.
    expect(mgf!.alpha).toBe(1 + 4);
    expect(mgf!.beta).toBe(1 + 1);
    expect(mgf!.n).toBe(5);
    expect(mgf!.lastSeen).toBe("2026-02-02T00:00:00.000Z");
  });

  it("leaves a topic dormant when it has no attempted levels", () => {
    const p: UserProgress = {
      ...emptyProgress(),
      levelProgress: {
        "ek-mgf": { bestScore: 0.8, mastered: true, attempts: 1 },
      },
      topicMastery: { [ERK_KEY]: erkMastery() },
    };
    const out = migrateErkSplit(p);
    // Gamma was never attempted → no seeded aggregate (fresh Beta(1,1) implied).
    expect(out.topicMastery?.[GAMMA_KEY]).toBeUndefined();
  });

  it("never clobbers a new-key aggregate that already holds real post-split data", () => {
    const existingMgf: TopicMastery = {
      theta: 1.2,
      n: 3,
      alpha: 4,
      beta: 1,
      lastSeen: "2026-03-03T00:00:00.000Z",
      misconceptions: {},
    };
    const p: UserProgress = {
      ...emptyProgress(),
      levelProgress: {
        "ek-mgf": { bestScore: 0.2, mastered: false, attempts: 1 },
      },
      topicMastery: { [ERK_KEY]: erkMastery(), [MGF_KEY]: existingMgf },
    };
    const out = migrateErkSplit(p);
    expect(out.topicMastery?.[MGF_KEY]).toEqual(existingMgf);
  });

  it("is idempotent (running twice is a no-op after the first pass)", () => {
    const p: UserProgress = {
      ...emptyProgress(),
      levelProgress: {
        "ek-gamma": { bestScore: 1, mastered: true, attempts: 1 },
      },
      topicMastery: { [ERK_KEY]: erkMastery() },
    };
    const once = migrateErkSplit(p);
    const twice = migrateErkSplit(once);
    expect(twice).toBe(once); // no ERK key left → fast-path no-op
    expect(once.topicMastery?.[GAMMA_KEY]).toBeDefined();
  });
});
