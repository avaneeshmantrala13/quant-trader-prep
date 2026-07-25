import { describe, expect, it } from "vitest";
import { PREREQ_DAG } from "@/content/remediation/prereqDAG";
import { buildProbeItem } from "./probe";

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
