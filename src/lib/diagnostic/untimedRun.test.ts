import { describe, expect, it } from "vitest";
import type { UserProgress } from "@/types/progress";
import { applyDiagnosticSeed, applyItemAttempt } from "@/lib/mastery/mastery";
import { COMPETENCY_BRAINTEASER } from "@/lib/mastery/competency";
import { scoredContentTopicKeys } from "@/lib/pipeline/gates";
import {
  brainteaserIsNumeric,
  gradeBrainteaserNumeric,
  materializeUntimedRun,
  untimedToCompetencyAttempts,
  untimedToDiagnosticSeeds,
  untimedToResult,
  withUntimedResult,
  type UntimedOutcome,
} from "@/lib/diagnostic/untimedRun";
import { isUntimedNonAuthoritativeTopic } from "@/content/diagnostic/untimedBlueprint";
import { MENTAL_MATH_TOPIC_KEY } from "@/content/mentalMath/subtopics";

const AT = "2026-01-01T00:00:00.000Z";

describe("M7 — materializeUntimedRun serves no exact-duplicate prompt", () => {
  const promptOf = (m: ReturnType<typeof materializeUntimedRun>[number]) =>
    (m.kind === "numeric" ? m.question.prompt : m.flashcard.prompt)
      .trim()
      .replace(/\s+/g, " ");

  it("every served item has a distinct rendered prompt (multiple seeds)", () => {
    for (const seed of [1, 7, 20260807, 424242, 99999]) {
      const items = materializeUntimedRun(seed);
      const prompts = items.map(promptOf);
      expect(new Set(prompts).size, `seed ${seed} duplicate prompt`).toBe(
        prompts.length,
      );
    }
  });

  it("stays deterministic under the dedup guard (same seed ⇒ same prompts)", () => {
    const a = materializeUntimedRun(20260807).map(promptOf);
    const b = materializeUntimedRun(20260807).map(promptOf);
    expect(a).toEqual(b);
  });
});

describe("untimedRun: hybrid brainteaser grading (decision §10.3)", () => {
  const items = materializeUntimedRun(20260807);
  const numericBts = items.filter(
    (m) => m.kind === "brainteaser" && m.numericGradable,
  );
  const selfEvalBts = items.filter(
    (m) => m.kind === "brainteaser" && !m.numericGradable,
  );

  it("run yields BOTH objectively-numeric and self-eval brainteasers", () => {
    expect(numericBts.length).toBeGreaterThan(0);
    expect(selfEvalBts.length).toBeGreaterThan(0);
  });

  it("numeric brainteaser → objective grade against its verified numericAnswer", () => {
    for (const m of numericBts) {
      if (m.kind !== "brainteaser") continue;
      const ans = m.flashcard.numericAnswer as number;
      expect(brainteaserIsNumeric(m.flashcard)).toBe(true);
      expect(gradeBrainteaserNumeric(m.flashcard, ans)).toBe(true);
      expect(gradeBrainteaserNumeric(m.flashcard, ans + 1_000_003)).toBe(false);
    }
  });

  it("self-eval brainteaser has no numeric answer (must be self-graded)", () => {
    for (const m of selfEvalBts) {
      if (m.kind !== "brainteaser") continue;
      expect(brainteaserIsNumeric(m.flashcard)).toBe(false);
      // Objective grading is refused for a non-numeric card.
      expect(gradeBrainteaserNumeric(m.flashcard, 0)).toBe(false);
    }
  });
});

describe("untimedRun: seeding maps outcomes to the correct KST / competency nodes", () => {
  const outcomes: UntimedOutcome[] = [
    { topicKey: "probability::Expected Value", subtopic: "probability::Expected Value", kind: "numeric", tier: "medium", correct: true, at: AT },
    { topicKey: "probability::Expected Value", subtopic: "probability::Expected Value", kind: "numeric", tier: "hard", correct: false, misconceptionTag: "greedy", at: AT },
    { topicKey: COMPETENCY_BRAINTEASER, subtopic: "brainteaser-reasoning", kind: "brainteaser", tier: "medium", correct: true, at: AT },
    { topicKey: COMPETENCY_BRAINTEASER, subtopic: "brainteaser-reasoning", kind: "brainteaser", tier: "medium", correct: false, at: AT },
  ];

  it("numeric outcomes → per-topic diagnostic seeds (competency EXCLUDED)", () => {
    const seeds = untimedToDiagnosticSeeds(outcomes);
    expect(seeds.length).toBe(1);
    const seed = seeds[0];
    expect(seed.topicKey).toBe("probability::Expected Value");
    expect(seed.successes).toBe(1);
    expect(seed.failures).toBe(1);
    // No brainteaser/competency node leaks into the KST seeds.
    expect(seeds.some((s) => s.topicKey === COMPETENCY_BRAINTEASER)).toBe(false);

    // The seed folds into mastery exactly like the existing diagnostic.
    const mastery = applyDiagnosticSeed(undefined, seed);
    expect(mastery.n).toBe(2);
  });

  it("brainteaser outcomes → competency ItemAttempts on the reasoning node", () => {
    const attempts = untimedToCompetencyAttempts(outcomes);
    expect(attempts.length).toBe(2);
    for (const a of attempts) {
      expect(a.topicKey).toBe(COMPETENCY_BRAINTEASER);
      expect(a.mode).toBe("flashcard");
    }
    expect(attempts[0].correct).toBe(true);
    expect(attempts[1].correct).toBe(false);

    // Fold into the competency node the same way ProgressContext does.
    let mastery = applyItemAttempt(undefined, undefined, attempts[0], 0).mastery;
    mastery = applyItemAttempt(mastery, undefined, attempts[1], 0).mastery;
    expect(mastery.n).toBe(2);
  });

  it("untimedToResult summarizes overall + per-topic accuracy", () => {
    const result = untimedToResult(outcomes, AT);
    expect(result.at).toBe(AT);
    expect(result.itemsAnswered).toBe(4);
    expect(result.overallScore).toBeCloseTo(0.5, 6);
    expect(result.perTopic?.["probability::Expected Value"]).toBeCloseTo(0.5, 6);
    expect(result.perTopic?.[COMPETENCY_BRAINTEASER]).toBeCloseTo(0.5, 6);
  });
});

describe("untimedRun: withUntimedResult writes pipeline.untimed and advances", () => {
  it("stamps the result and re-derives the next stage", () => {
    const base = { topicMastery: {} } as unknown as UserProgress;
    const result = untimedToResult(
      [{ topicKey: "probability::Expected Value", subtopic: "probability::Expected Value", kind: "numeric", tier: "medium", correct: true, at: AT }],
      AT,
    );
    const next = withUntimedResult(base, result);
    expect(next.pipeline?.untimed).toEqual(result);
    expect(next.pipeline?.untimedDoneAt).toBe(AT);
    expect(next.pipeline?.stage).toBe("diagnostic-timed");
    // Purity: the input is untouched.
    expect((base as UserProgress).pipeline).toBeUndefined();
  });
});

describe("untimedRun: a fully-correct run seeds every scored topic", () => {
  it("produces KST seeds covering all scored topics", () => {
    const items = materializeUntimedRun(555);
    const outcomes: UntimedOutcome[] = items.map((m) =>
      m.kind === "numeric"
        ? {
            topicKey: m.topicKey,
            subtopic: m.subtopic,
            kind: "numeric" as const,
            tier: m.tier,
            correct: true,
            at: AT,
          }
        : {
            topicKey: m.topicKey,
            subtopic: m.subtopic,
            kind: "brainteaser" as const,
            tier: "medium" as const,
            correct: true,
            at: AT,
          },
    );
    const seededTopics = new Set(untimedToDiagnosticSeeds(outcomes).map((s) => s.topicKey));
    for (const topicKey of scoredContentTopicKeys()) {
      // Mental arithmetic is NON-AUTHORITATIVE for the untimed diagnostic: its
      // real skill (speed) is scored by the timed mental-math sprint, so untimed
      // items no longer seed it. Every OTHER scored content node still seeds.
      if (isUntimedNonAuthoritativeTopic(topicKey)) continue;
      expect(seededTopics.has(topicKey), `seed for ${topicKey}`).toBe(true);
    }
  });

  it("does NOT seed mental-math from the untimed run (no free-point inflation)", () => {
    const items = materializeUntimedRun(555);
    const outcomes: UntimedOutcome[] = items.map((m) => ({
      topicKey: m.topicKey,
      subtopic: m.subtopic,
      kind: m.kind,
      tier: m.kind === "numeric" ? m.tier : ("medium" as const),
      correct: true,
      at: AT,
    }));
    // The untimed run DOES render mental-math items (coverage preserved)…
    expect(outcomes.some((o) => o.topicKey === MENTAL_MATH_TOPIC_KEY)).toBe(true);
    // …but NONE of them seed the mental-math node.
    const seededTopics = new Set(
      untimedToDiagnosticSeeds(outcomes).map((s) => s.topicKey),
    );
    expect(seededTopics.has(MENTAL_MATH_TOPIC_KEY)).toBe(false);
  });
});
