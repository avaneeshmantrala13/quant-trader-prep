import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import { ALL_MM_GENERATORS } from "./generators";
import { ALL_MM_NUMERIC_GENERATORS } from "./generators";
import { topicKeyOf } from "@/lib/mastery/topicKey";
import {
  MENTAL_MATH_CONCEPT_TO_SUBTOPIC,
  MENTAL_MATH_SUBTOPICS,
  MENTAL_MATH_TOPIC_KEY,
  mentalMathSubtopicOf,
  type MentalMathSubtopic,
} from "./subtopics";

/**
 * Mental-arithmetic SUBTOPIC taxonomy (spec §10.9). The subtopic is a TAG on each
 * item (`concept`) that maps to the single Mental Arithmetic KST node — verified
 * here to be attributable (every generator stamps a resolvable concept) and to
 * map to a canonical subtopic, so a mental-math mistake is precise about the
 * sub-skill.
 */

const SEEDS = Array.from({ length: 80 }, (_, i) => i * 53 + 11);

describe("mental-math subtopic registry", () => {
  it("the owning KST node is the single mental-math::_core bucket", () => {
    expect(MENTAL_MATH_TOPIC_KEY).toBe(topicKeyOf("mental-math"));
  });

  it("every concept maps to a subtopic id that has a label", () => {
    for (const sub of Object.values(MENTAL_MATH_CONCEPT_TO_SUBTOPIC)) {
      expect(MENTAL_MATH_SUBTOPICS[sub], `label for ${sub}`).toBeTruthy();
    }
  });

  it("covers the decision-§10.9 sub-skills (multiplication, division, %, fractions, odds)", () => {
    const subs = new Set<MentalMathSubtopic>(
      Object.values(MENTAL_MATH_CONCEPT_TO_SUBTOPIC),
    );
    for (const s of [
      "multiplication",
      "division",
      "percentages",
      "fractions-decimals",
      "ratios-odds-probability",
    ] as MentalMathSubtopic[]) {
      expect(subs.has(s), `subtopic ${s}`).toBe(true);
    }
  });
});

describe("every mental-math generator stamps a resolvable subtopic", () => {
  const gens = {
    ...ALL_MM_GENERATORS,
    ...ALL_MM_NUMERIC_GENERATORS,
  };
  for (const [name, gen] of Object.entries(gens)) {
    it(`${name} — items carry a concept that resolves to a canonical subtopic`, () => {
      for (const seed of SEEDS) {
        const q = (gen as (r: Rng) => { concept?: string })(new Rng(seed));
        expect(q.concept, `${name} must stamp a concept`).toBeTruthy();
        expect(
          mentalMathSubtopicOf(q.concept),
          `${name} concept "${q.concept}" must resolve`,
        ).toBeTruthy();
      }
    });
  }
});

describe("mentalMathSubtopicOf", () => {
  it("returns undefined for an unknown / missing concept (an orphan tag)", () => {
    expect(mentalMathSubtopicOf(undefined)).toBeUndefined();
    expect(mentalMathSubtopicOf("Astrophysics")).toBeUndefined();
  });
});
