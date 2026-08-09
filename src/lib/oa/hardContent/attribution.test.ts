import { describe, expect, it } from "vitest";

import { skillKeySet } from "@/lib/roadmap/skillGraph";
import { topicKeyOf } from "@/lib/mastery/topicKey";
import { HARD_OA_BUILDERS } from "./generators";
import { HARD_FAMILY_TOPIC, topicForHardFamily } from "./attribution";

/**
 * M5 UNIFICATION — the canonical hard-family → scored-KST-node map is the single
 * source of truth both diagnostics consume. These tests lock its invariants:
 *   • every hard OA family in `HARD_OA_BUILDERS` has a mapping (no orphans),
 *   • every mapped node is a REAL `SKILL_GRAPH` node (no dangling tags),
 *   • the two families the audit called out are pinned to ONE node each, and
 *   • `topicForHardFamily` fails fast on an unknown family.
 */
describe("M5 — canonical hard-family attribution map", () => {
  it("covers EVERY hard OA builder family (no orphaned generator)", () => {
    for (const family of Object.keys(HARD_OA_BUILDERS)) {
      expect(HARD_FAMILY_TOPIC[family], `family ${family} is unmapped`).toBeTypeOf(
        "string",
      );
    }
  });

  it("maps ONLY real hard families (no stale entries)", () => {
    for (const family of Object.keys(HARD_FAMILY_TOPIC)) {
      expect(HARD_OA_BUILDERS[family], `mapped family ${family} has no builder`)
        .toBeTypeOf("function");
    }
  });

  it("attributes every family to a REAL SKILL_GRAPH node", () => {
    const keys = skillKeySet();
    for (const [family, topicKey] of Object.entries(HARD_FAMILY_TOPIC)) {
      expect(keys.has(topicKey), `${family} → ${topicKey}`).toBe(true);
    }
  });

  it("pins the two audit-flagged families to their ONE canonical node", () => {
    // hardOneReroll is a keep-or-reroll EXPECTED-VALUE decision (not interview-games).
    expect(topicForHardFamily("hardOneReroll")).toBe(
      topicKeyOf("probability", "Expected Value"),
    );
    // hardPatternWait is an expected-wait first-step / martingale CONDITIONAL-EXPECTATION
    // argument (not Markov chains).
    expect(topicForHardFamily("hardPatternWait")).toBe(
      topicKeyOf("probability", "Conditional Expectation"),
    );
  });

  it("throws fast on an unknown family (can never silently orphan mastery)", () => {
    expect(() => topicForHardFamily("hardNope")).toThrow(/unknown hard OA family/);
  });
});
