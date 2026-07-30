import { describe, expect, it } from "vitest";
import { DIFFICULTY_META, type Difficulty } from "@/types/content";
import { L1_MEANING, PREREQ_DAG } from "@/content/remediation/prereqDAG";
import { buildProbeItem } from "./probe";

const ALL_TIERS = Object.keys(DIFFICULTY_META) as Difficulty[];

describe("buildProbeItem", () => {
  it("materializes a quiz or numeric probe for every DAG node (deterministic in seed)", () => {
    for (const topicKey of Object.keys(PREREQ_DAG)) {
      const a = buildProbeItem(topicKey, 12345);
      expect(a, topicKey).not.toBeNull();
      expect(a!.topicKey).toBe(topicKey);
      if (a!.mode === "quiz") {
        expect(a!.question).toBeDefined();
        expect(a!.question!.choices.length).toBeGreaterThanOrEqual(2);
      } else {
        expect(a!.numericQuestion).toBeDefined();
      }
      // Same seed ⇒ same item id (reproducible for save/resume parity).
      const b = buildProbeItem(topicKey, 12345);
      const idA = a!.question?.id ?? a!.numericQuestion?.id;
      const idB = b!.question?.id ?? b!.numericQuestion?.id;
      expect(idB).toBe(idA);
    }
  });

  it("returns null for an unknown topic", () => {
    expect(buildProbeItem("no::such", 1)).toBeNull();
  });
});

describe("buildProbeItem — probeTier (Wilson 85% Rule) honoring", () => {
  it("omitting probeTier preserves the fixed easy levelRef behavior", () => {
    // L1_MEANING (Core Probability) has pr-1..pr-5 spanning easy→expert; the
    // levelRef is the EASY pr-1, so the no-tier probe must serve an easy item.
    const item = buildProbeItem(L1_MEANING, 777);
    expect(item).not.toBeNull();
    expect(item!.level.difficulty).toBe("easy");
  });

  it("serves an item AT the requested tier when the node has a tier variant", () => {
    // The bug: the old buildProbeItem ignored the tier and always served the
    // easy levelRef. Now a hard probe must actually materialize a HARD item.
    const hard = buildProbeItem(L1_MEANING, 777, "hard");
    expect(hard).not.toBeNull();
    expect(hard!.level.difficulty).toBe("hard");
    // …and it is a genuinely different (harder) item than the easy default.
    const easy = buildProbeItem(L1_MEANING, 777);
    expect(hard!.level.id).not.toBe(easy!.level.id);
  });

  it("climbs the served difficulty as the requested tier rises", () => {
    const medium = buildProbeItem(L1_MEANING, 5, "medium");
    const expert = buildProbeItem(L1_MEANING, 5, "expert");
    expect(medium!.level.difficulty).toBe("medium");
    expect(expert!.level.difficulty).toBe("expert");
  });

  it("degrades gracefully: every DAG node serves a non-null item at EVERY tier", () => {
    for (const topicKey of Object.keys(PREREQ_DAG)) {
      for (const tier of ALL_TIERS) {
        const item = buildProbeItem(topicKey, 4242, tier);
        expect(item, `${topicKey} @ ${tier}`).not.toBeNull();
        // The served tier is the CLOSEST available to the request (never crashes
        // / serves nothing even when the node lacks that exact tier variant).
        const served = DIFFICULTY_META[item!.level.difficulty].order;
        expect(Number.isFinite(served)).toBe(true);
      }
    }
  });

  it("is deterministic in (topicKey, seed, tier)", () => {
    const a = buildProbeItem(L1_MEANING, 909, "hard");
    const b = buildProbeItem(L1_MEANING, 909, "hard");
    const idA = a!.question?.id ?? a!.numericQuestion?.id;
    const idB = b!.question?.id ?? b!.numericQuestion?.id;
    expect(idB).toBe(idA);
  });
});
