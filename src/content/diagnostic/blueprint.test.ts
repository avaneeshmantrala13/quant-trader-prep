import { describe, expect, it } from "vitest";
import {
  DIAGNOSTIC_BLUEPRINT,
  diagnosticItemCount,
} from "./blueprint";
import { drawSlotItems } from "./items";
import { getLevel } from "@/content";
import { topicKeyForLevel, topicKeyOf } from "@/lib/mastery/topicKey";

describe("DIAGNOSTIC_BLUEPRINT", () => {
  it("covers the core topics (6–10 slots)", () => {
    expect(DIAGNOSTIC_BLUEPRINT.length).toBeGreaterThanOrEqual(6);
    expect(DIAGNOSTIC_BLUEPRINT.length).toBeLessThanOrEqual(10);
  });

  it("totals ~16–24 nominal items (~2 per topic incl. the gated Markov probe)", () => {
    const total = diagnosticItemCount();
    expect(total).toBeGreaterThanOrEqual(16);
    expect(total).toBeLessThanOrEqual(24);
    for (const slot of DIAGNOSTIC_BLUEPRINT) {
      expect(slot.itemsPerTopic).toBe(2);
    }
  });

  it("uses distinct topics with unique source levels", () => {
    const topics = new Set(DIAGNOSTIC_BLUEPRINT.map((s) => s.topicKey));
    const levels = new Set(DIAGNOSTIC_BLUEPRINT.map((s) => `${s.trackId}/${s.levelId}`));
    expect(topics.size).toBe(DIAGNOSTIC_BLUEPRINT.length);
    expect(levels.size).toBe(DIAGNOSTIC_BLUEPRINT.length);
  });

  it("references a REAL level in TRACKS whose topicKey matches the slot", () => {
    for (const slot of DIAGNOSTIC_BLUEPRINT) {
      const found = getLevel(slot.trackId, slot.levelId);
      expect(found, `${slot.trackId}/${slot.levelId} must exist`).toBeDefined();
      // The slot's topicKey must equal the level's own resolved topic key.
      expect(topicKeyForLevel(slot.trackId, found!.level)).toBe(slot.topicKey);
    }
  });

  it("includes the NEW Combinatorial Analysis (ca-1) and gated Markov (mc-1) slots", () => {
    const ca = getLevel("probability", "ca-1");
    const mc = getLevel("probability", "mc-1");
    expect(ca, "probability/ca-1 must exist").toBeDefined();
    expect(mc, "probability/mc-1 must exist").toBeDefined();

    const caSlot = DIAGNOSTIC_BLUEPRINT.find((s) => s.levelId === "ca-1");
    const mcSlot = DIAGNOSTIC_BLUEPRINT.find((s) => s.levelId === "mc-1");
    expect(caSlot).toBeDefined();
    expect(mcSlot).toBeDefined();
    // The Markov probe is GATED on the Conditional-Probability topic passing.
    expect(mcSlot!.gatedOnTopicKey).toBe(
      topicKeyOf("probability", "Conditional Probability"),
    );
    expect(caSlot!.gatedOnTopicKey).toBeUndefined();
  });

  it("maps the (deduped) Math-Questions slot to 'Number Theory & Counting'", () => {
    const mq = DIAGNOSTIC_BLUEPRINT.filter((s) => s.trackId === "math-questions");
    // The two former MQ slots (Counting + Number Theory) collapse into ONE.
    expect(mq).toHaveLength(1);
    expect(mq[0].topicKey).toBe(
      topicKeyOf("math-questions", "Number Theory & Counting"),
    );
    const found = getLevel(mq[0].trackId, mq[0].levelId);
    expect(found!.level.section).toBe("Number Theory & Counting");
  });

  it("every source level is quiz-mode OR numeric-mode (both surfaced as MCQ)", () => {
    for (const slot of DIAGNOSTIC_BLUEPRINT) {
      const level = getLevel(slot.trackId, slot.levelId)!.level;
      const mode = level.mode ?? "quiz";
      expect(["quiz", "numeric"]).toContain(mode);
    }
  });

  it("carries an authored misconception tag per slot (not the idx fallback)", () => {
    for (const slot of DIAGNOSTIC_BLUEPRINT) {
      expect(slot.misconceptionTag).toBeTruthy();
      expect(slot.misconceptionTag).not.toMatch(/^idx:/);
    }
  });
});

describe("drawSlotItems", () => {
  it("draws exactly itemsPerTopic MCQ items per slot (numeric levels included)", () => {
    for (const slot of DIAGNOSTIC_BLUEPRINT) {
      const items = drawSlotItems(slot, 12345);
      expect(items, `${slot.levelId} should yield items`).toHaveLength(
        slot.itemsPerTopic,
      );
      for (const q of items) {
        expect(q.choices.length).toBeGreaterThanOrEqual(2);
        expect(q.correctIndex).toBeGreaterThanOrEqual(0);
        expect(q.correctIndex).toBeLessThan(q.choices.length);
      }
    }
  });

  it("is deterministic for a given seed", () => {
    const slot = DIAGNOSTIC_BLUEPRINT[0];
    const a = drawSlotItems(slot, 999).map((q) => q.prompt);
    const b = drawSlotItems(slot, 999).map((q) => q.prompt);
    expect(a).toEqual(b);
  });

  it("converts a numeric level (ca-1) into MCQ with trap distractors", () => {
    const caSlot = DIAGNOSTIC_BLUEPRINT.find((s) => s.levelId === "ca-1")!;
    const items = drawSlotItems(caSlot, 4242);
    expect(items.length).toBe(caSlot.itemsPerTopic);
    // The authored numeric commonErrors become ≥1 distractor + rationale.
    for (const q of items) {
      expect(q.choices.length).toBeGreaterThanOrEqual(2);
      expect(q.distractorRationale?.length).toBe(q.choices.length);
    }
  });
});
