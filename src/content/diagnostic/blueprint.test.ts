import { describe, expect, it } from "vitest";
import {
  DIAGNOSTIC_BLUEPRINT,
  diagnosticItemCount,
  diagnosticMaxItemCount,
} from "./blueprint";
import { drawSlotItems } from "./items";
import { getLevel } from "@/content";
import { topicKeyForLevel, topicKeyOf } from "@/lib/mastery/topicKey";

describe("DIAGNOSTIC_BLUEPRINT", () => {
  it("comprehensively covers every MCQ-able skill family (15 slots)", () => {
    expect(DIAGNOSTIC_BLUEPRINT.length).toBe(15);
  });

  it("stays comprehensive but under the 31-item cap", () => {
    // Nominal (base + every gated slot, no tiebreaks).
    expect(diagnosticItemCount()).toBe(23);
    // Provable worst case (all gates open + every 2-item base slot splits).
    expect(diagnosticMaxItemCount()).toBeLessThanOrEqual(30);
    for (const slot of DIAGNOSTIC_BLUEPRINT) {
      expect([1, 2]).toContain(slot.itemsPerTopic);
    }
  });

  it("splits into an always-on base pass and a prereq-gated depth pass", () => {
    const base = DIAGNOSTIC_BLUEPRINT.filter((s) => !s.gatedOnTopicKey);
    const gated = DIAGNOSTIC_BLUEPRINT.filter((s) => s.gatedOnTopicKey);
    expect(base.length).toBe(8);
    expect(gated.length).toBe(7);
    // Every gate points at a topic that is itself a slot (a real prerequisite).
    const topics = new Set(DIAGNOSTIC_BLUEPRINT.map((s) => s.topicKey));
    for (const g of gated) {
      expect(topics.has(g.gatedOnTopicKey!)).toBe(true);
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

  it("probes all three Applied-Math sections (rates, number theory, geometry)", () => {
    const mq = DIAGNOSTIC_BLUEPRINT.filter((s) => s.trackId === "math-questions");
    expect(mq).toHaveLength(3);
    const keys = new Set(mq.map((s) => s.topicKey));
    expect(keys.has(topicKeyOf("math-questions", "Rates, Algebra & Word Problems"))).toBe(true);
    expect(keys.has(topicKeyOf("math-questions", "Number Theory & Counting"))).toBe(true);
    expect(keys.has(topicKeyOf("math-questions", "Geometry & Derivations"))).toBe(true);
  });

  it("aligns each gated probe with a real skill-graph prerequisite edge", () => {
    const gate = (level: string) =>
      DIAGNOSTIC_BLUEPRINT.find((s) => s.levelId === level)?.gatedOnTopicKey;
    expect(gate("geo-1")).toBe(topicKeyOf("probability", "Core Probability"));
    expect(gate("os-1")).toBe(topicKeyOf("probability", "Expected Value"));
    expect(gate("vc-1")).toBe(topicKeyOf("probability", "Expected Value"));
    expect(gate("bs-1")).toBe(topicKeyOf("probability", "Expected Value"));
    expect(gate("mc-1")).toBe(topicKeyOf("probability", "Conditional Probability"));
    expect(gate("gt-1")).toBe(topicKeyOf("interview-games"));
    expect(gate("mq-5")).toBe(
      topicKeyOf("math-questions", "Rates, Algebra & Word Problems"),
    );
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
