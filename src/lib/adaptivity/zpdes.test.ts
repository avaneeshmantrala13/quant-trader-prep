import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import type { TierDifficultyMap } from "@/types/mastery";
import { tierDifficultyKey } from "@/lib/mastery/topicKey";
import {
  candidateSnapshots,
  nextTopic,
  pickTier,
  updateLearningProgress,
  zpdesPriority,
  type TopicSnapshot,
} from "./zpdes";

function snap(partial: Partial<TopicSnapshot>): TopicSnapshot {
  return {
    topicKey: "t",
    unlocked: true,
    masteredTopic: false,
    mean: 0.5,
    ciWidth: 0.2,
    theta: 0,
    learningProgress: 0,
    reviewDue: false,
    ...partial,
  };
}

describe("zpdesPriority", () => {
  it("increases with the below-target gap (lower mean ⇒ higher priority)", () => {
    const low = zpdesPriority(snap({ mean: 0.3 }));
    const high = zpdesPriority(snap({ mean: 0.7 }));
    expect(low).toBeGreaterThan(high);
  });

  it("increases with CI width (uncertainty)", () => {
    expect(zpdesPriority(snap({ ciWidth: 0.4 }))).toBeGreaterThan(
      zpdesPriority(snap({ ciWidth: 0.1 })),
    );
  });

  it("increases with learning progress", () => {
    expect(zpdesPriority(snap({ learningProgress: 0.5 }))).toBeGreaterThan(
      zpdesPriority(snap({ learningProgress: 0.0 })),
    );
  });

  it("increases when a review is due (w4 = 2.0)", () => {
    const base = snap({ mean: 0.9, ciWidth: 0.05 });
    expect(zpdesPriority({ ...base, reviewDue: true })).toBeGreaterThan(
      zpdesPriority({ ...base, reviewDue: false }) + 1.9,
    );
  });

  it("ranks a below-target, high-CI-width topic ABOVE a near-mastered one", () => {
    const weak = snap({ mean: 0.55, ciWidth: 0.35 });
    const nearMastered = snap({ mean: 0.82, ciWidth: 0.06 });
    expect(zpdesPriority(weak)).toBeGreaterThan(zpdesPriority(nearMastered));
  });

  it("a mastered, non-due topic scores ~0 on the below-target/uncertainty terms", () => {
    // mean at target, tiny CI, no LP, not due ⇒ priority collapses toward 0.
    const p = zpdesPriority(
      snap({ masteredTopic: true, mean: 0.95, ciWidth: 0.03, reviewDue: false }),
    );
    expect(p).toBeLessThan(0.05);
  });
});

describe("candidateSnapshots (unlock graph respected)", () => {
  it("excludes locked topics and mastered non-due topics; keeps due reviews", () => {
    const snapshots = [
      snap({ topicKey: "unlocked-weak" }),
      snap({ topicKey: "locked", unlocked: false }),
      snap({ topicKey: "mastered", masteredTopic: true, reviewDue: false }),
      snap({ topicKey: "mastered-due", masteredTopic: true, reviewDue: true }),
      snap({ topicKey: "locked-due", unlocked: false, reviewDue: true }),
    ];
    const keys = candidateSnapshots(snapshots).map((s) => s.topicKey);
    expect(keys).toEqual(["unlocked-weak", "mastered-due"]);
  });
});

describe("nextTopic", () => {
  it("returns undefined when there are no unlocked candidates", () => {
    const snapshots = [snap({ unlocked: false }), snap({ masteredTopic: true })];
    expect(nextTopic(snapshots, new Rng(1))).toBeUndefined();
  });

  it("only ever returns an unlocked candidate (never a locked topic)", () => {
    const snapshots = [
      snap({ topicKey: "locked-a", unlocked: false, mean: 0.1, ciWidth: 0.5 }),
      snap({ topicKey: "locked-b", unlocked: false, reviewDue: true }),
      snap({ topicKey: "ok", unlocked: true, mean: 0.6 }),
    ];
    const unlocked = new Set(["ok"]);
    for (let seed = 0; seed < 200; seed++) {
      const chosen = nextTopic(snapshots, new Rng(seed));
      expect(chosen).toBeDefined();
      expect(unlocked.has(chosen!)).toBe(true);
    }
  });

  it("a due review dominates selection across seeds", () => {
    const snapshots = [
      snap({ topicKey: "a", mean: 0.7, ciWidth: 0.1 }),
      snap({ topicKey: "b", mean: 0.65, ciWidth: 0.12 }),
      snap({ topicKey: "due", mean: 0.9, ciWidth: 0.05, reviewDue: true }),
    ];
    let dueCount = 0;
    const N = 300;
    for (let seed = 0; seed < N; seed++) {
      if (nextTopic(snapshots, new Rng(seed)) === "due") dueCount++;
    }
    // w4=2.0 makes "due" by far the highest weight ⇒ chosen the large majority.
    expect(dueCount).toBeGreaterThan(N * 0.6);
  });

  it("ε exploration is reachable: a low-priority candidate is sometimes picked", () => {
    const snapshots = [
      snap({ topicKey: "hot", mean: 0.1, ciWidth: 0.5 }), // huge priority
      snap({ topicKey: "cold", mean: 0.95, ciWidth: 0.02 }), // ~0 priority
    ];
    let coldPicked = false;
    for (let seed = 0; seed < 200 && !coldPicked; seed++) {
      if (nextTopic(snapshots, new Rng(seed)) === "cold") coldPicked = true;
    }
    // Without the ε floor, "cold" (near-zero weight) would essentially never win.
    expect(coldPicked).toBe(true);
  });
});

describe("pickTier (85% Rule, target 0.80)", () => {
  const topicKey = "t";
  const emptyTierD: TierDifficultyMap = {};

  it("deterministic (ε=0) picks the tier whose predictSuccess is closest to 0.80", () => {
    // θ=1.5, numeric (no guess): medium (d=0.5 ⇒ σ(1.0)=0.73) is closest to 0.80.
    const tier = pickTier(1.5, topicKey, emptyTierD, new Rng(1), { eps: 0 });
    expect(tier).toBe("medium");
  });

  it("uses stored tier difficulty when present", () => {
    // Store a "hard" difficulty so that at θ=2.5 it lands exactly at 0.80
    // (σ(2.5 − 1.114) = σ(1.386) = 0.80) — closer than medium's seed (0.881).
    const tierD: TierDifficultyMap = {
      [tierDifficultyKey(topicKey, "hard")]: 1.114,
    };
    const tier = pickTier(2.5, topicKey, tierD, new Rng(1), { eps: 0 });
    expect(tier).toBe("hard");
  });

  it("can jitter to a neighboring tier with a seeded Rng (ε default)", () => {
    let jittered: string | null = null;
    for (let seed = 0; seed < 200 && jittered === null; seed++) {
      const tier = pickTier(1.5, topicKey, emptyTierD, new Rng(seed));
      if (tier !== "medium") jittered = tier;
    }
    // Only the immediate neighbors of "medium" are reachable via jitter.
    expect(jittered === "easy" || jittered === "hard").toBe(true);
  });
});

describe("updateLearningProgress", () => {
  it("wₐ ← β·wₐ + η·(recent − older); rises when recent beats older", () => {
    expect(updateLearningProgress(0, 0.8, 0.4)).toBeCloseTo(0.08, 10);
    // Monotonic in the (recent − older) reward.
    expect(updateLearningProgress(0.5, 0.9, 0.1)).toBeGreaterThan(
      updateLearningProgress(0.5, 0.5, 0.5),
    );
  });
});
