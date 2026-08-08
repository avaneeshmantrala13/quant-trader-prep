import { describe, expect, it } from "vitest";
import { scoredContentTopicKeys } from "@/lib/pipeline/gates";
import { skillByKey, COMPETENCY_BRAINTEASER } from "@/lib/roadmap/skillGraph";
import { MENTAL_MATH_SUBTOPICS, MENTAL_MATH_TOPIC_KEY } from "@/content/mentalMath/subtopics";
import { gradeFreeResponse } from "@/lib/numeric";
import { FR_ADAPTER_FAMILIES } from "@/lib/oa/hardContent/frAdapters";
import {
  UNTIMED_BLUEPRINT,
  UNTIMED_ITEM_COUNT,
  untimedBrainteaserItems,
  untimedContentItems,
} from "@/content/diagnostic/untimedBlueprint";
import { materializeUntimedRun } from "@/lib/diagnostic/untimedRun";

const MENTAL_SUBTOPIC_IDS = new Set(Object.keys(MENTAL_MATH_SUBTOPICS));

describe("untimedBlueprint: composition & attribution", () => {
  it("has ≈100 items", () => {
    expect(UNTIMED_ITEM_COUNT).toBe(UNTIMED_BLUEPRINT.length);
    expect(UNTIMED_ITEM_COUNT).toBeGreaterThanOrEqual(90);
    expect(UNTIMED_ITEM_COUNT).toBeLessThanOrEqual(110);
  });

  it("covers EVERY scored KST topic with BOTH a floor AND a ceiling item", () => {
    const scored = scoredContentTopicKeys();
    // GOAL A: the scored set is now the 21 quant-relevant topics (the 5 academic
    // course-completeness topics were dropped from the scored/gated set).
    expect(scored.length).toBe(21);

    const floors = new Map<string, number>();
    const ceilings = new Map<string, number>();
    for (const it of untimedContentItems()) {
      if (it.tier === "floor") floors.set(it.topicKey, (floors.get(it.topicKey) ?? 0) + 1);
      if (it.tier === "ceiling")
        ceilings.set(it.topicKey, (ceilings.get(it.topicKey) ?? 0) + 1);
    }

    for (const topicKey of scored) {
      expect(floors.get(topicKey), `floor for ${topicKey}`).toBeGreaterThanOrEqual(1);
      expect(ceilings.get(topicKey), `ceiling for ${topicKey}`).toBeGreaterThanOrEqual(1);
    }
  });

  it("every item carries a precise, resolvable subtopic tag (attribution invariant)", () => {
    for (const it of UNTIMED_BLUEPRINT) {
      expect(it.subtopic.length).toBeGreaterThan(0);
      // The topicKey must resolve to a real KST node.
      expect(skillByKey(it.topicKey), `node for ${it.topicKey}`).toBeDefined();

      if (it.topicKey === MENTAL_MATH_TOPIC_KEY && it.kind !== "brainteaser") {
        // Mental-math items tag a canonical mental-math subtopic (decision §10.9).
        expect(MENTAL_SUBTOPIC_IDS.has(it.subtopic)).toBe(true);
      }
      if (it.kind === "brainteaser") {
        expect(it.topicKey).toBe(COMPETENCY_BRAINTEASER);
        expect(it.subtopic).toBe("brainteaser-reasoning");
      }
    }
  });

  it("adapter items reference only known hard OA families", () => {
    for (const it of untimedContentItems()) {
      if (it.kind === "numeric-adapter") {
        expect(FR_ADAPTER_FAMILIES).toContain(it.family);
      }
    }
  });

  it("includes brainteaser flashcards folded into the competency node", () => {
    const bts = untimedBrainteaserItems();
    expect(bts.length).toBeGreaterThanOrEqual(12);
    for (const b of bts) expect(b.topicKey).toBe(COMPETENCY_BRAINTEASER);
  });

  it("materializes deterministically; a correct entry grades correct for every numeric item", () => {
    const items = materializeUntimedRun(1234);
    expect(items.length).toBe(UNTIMED_ITEM_COUNT);

    // Determinism: the same seed reproduces the same served questions.
    const again = materializeUntimedRun(1234);
    for (let i = 0; i < items.length; i++) {
      const a = items[i];
      const b = again[i];
      if (a.kind === "numeric" && b.kind === "numeric") {
        expect(b.question.answer).toBe(a.question.answer);
      }
    }

    for (const m of items) {
      if (m.kind === "numeric") {
        expect(Number.isFinite(m.question.answer)).toBe(true);
        const typed =
          m.question.decimals != null
            ? m.question.answer.toFixed(m.question.decimals)
            : String(m.question.answer);
        expect(gradeFreeResponse(m.question, typed).correct, m.question.id).toBe(true);
      }
    }
  });
});
