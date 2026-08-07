import { describe, expect, it } from "vitest";
import { materializeLevel, materializeNumericLevel } from "@/content/materialize";
import { isNumericLevel } from "@/types/content";
import { topicKeyOf } from "@/lib/mastery/topicKey";
import { MISCONCEPTION_LABELS } from "@/lib/dashboard/misconceptionLabels";
import { buildTargetedMistakeItems, topicScoredLevels } from "./targetedPractice";

/**
 * Discover a misconception TAG that (a) actually appears in this topic's authored
 * content and (b) has a human-readable label — so the targeted-practice test uses
 * a REAL, surfaceable error mode rather than a hard-coded guess.
 */
function discoverLabeledTag(topicKey: string): string | undefined {
  const resolved = topicScoredLevels(topicKey);
  if (!resolved) return undefined;
  for (let s = 1; s <= 12; s++) {
    for (const level of resolved.levels) {
      if (isNumericLevel(level)) {
        for (const q of materializeNumericLevel(level, s)) {
          for (const e of q.commonErrors ?? []) {
            if (e.misconception && MISCONCEPTION_LABELS[e.misconception]) {
              return e.misconception;
            }
          }
        }
      } else {
        for (const q of materializeLevel(level, s)) {
          for (const t of q.misconceptions ?? []) {
            if (t && MISCONCEPTION_LABELS[t]) return t;
          }
        }
      }
    }
  }
  return undefined;
}

describe("buildTargetedMistakeItems (exactly-that-mistake re-prep)", () => {
  const CANDIDATES = [
    topicKeyOf("probability", "Core Probability"),
    topicKeyOf("probability", "Conditional Probability"),
    topicKeyOf("probability", "Expected Value"),
    topicKeyOf("probability", "Combinatorial Analysis"),
  ];

  it("assembles items that ALL trip exactly the requested misconception tag", () => {
    // Find a real (topic, labeled-tag) pair from authored content.
    let picked: { topicKey: string; tag: string } | undefined;
    for (const topicKey of CANDIDATES) {
      const tag = discoverLabeledTag(topicKey);
      if (tag) {
        picked = { topicKey, tag };
        break;
      }
    }
    expect(picked, "expected at least one labeled misconception in content").toBeDefined();

    const items = buildTargetedMistakeItems(picked!.topicKey, picked!.tag, 42, 4);
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      if (item.mode === "quiz") {
        expect(item.question!.misconceptions ?? []).toContain(picked!.tag);
      } else {
        expect(
          (item.numericQuestion!.commonErrors ?? []).some(
            (e) => e.misconception === picked!.tag,
          ),
        ).toBe(true);
      }
    }
  });

  it("returns an empty set for a tag that never appears in the topic (graceful)", () => {
    const items = buildTargetedMistakeItems(
      topicKeyOf("probability", "Core Probability"),
      "definitely_not_a_real_tag_xyz",
      1,
      4,
    );
    expect(items).toEqual([]);
  });

  it("returns nothing for a topic with no registered scored levels", () => {
    expect(topicScoredLevels("nope::nope")).toBeUndefined();
    expect(buildTargetedMistakeItems("nope::nope", "anything", 1)).toEqual([]);
  });
});
