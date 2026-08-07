import { describe, expect, it } from "vitest";
import type { PersistedCalibrationPair } from "@/types/progress";
import { topicKeyOf } from "@/lib/mastery/topicKey";
import { FLOOR_TOPIC_KEY } from "@/lib/tradingFloor/config";
import {
  MIN_PAIRS,
  reliabilityDiagram,
} from "./reliability";
import {
  elicitedConfidencePairs,
  elicitedConfidenceSourceNote,
  toCalibrationPairs,
} from "./persistedLog";

const FERMI = topicKeyOf("fermi");
const QUIZ = "probability::Expected Value";

function pair(
  topicKey: string,
  pred: number,
  outcome: 0 | 1,
): PersistedCalibrationPair {
  return { topicKey, pred, outcome };
}

describe("elicitedConfidencePairs — FIX 2: only genuinely-stated confidence feeds the panel", () => {
  it("keeps Fermi (90% CI) and Trading-Floor pairs, drops model-predicted quiz/numeric pairs", () => {
    const log: PersistedCalibrationPair[] = [
      pair(FERMI, 0.9, 1),
      pair(FLOOR_TOPIC_KEY, 0.7, 0),
      // Quiz/numeric: predictSuccess(θ,…) — a MODEL estimate, never stated by the
      // learner — must be excluded.
      pair(QUIZ, 0.82, 1),
      pair(QUIZ, 0.5, 0),
    ];
    const kept = elicitedConfidencePairs(log);
    expect(kept).toHaveLength(2);
    expect(kept).toEqual([
      { pred: 0.9, outcome: 1 },
      { pred: 0.7, outcome: 0 },
    ]);
    // Sanity: the unfiltered projection would have surfaced the dishonest pairs.
    expect(toCalibrationPairs(log)).toHaveLength(4);
  });

  it("gates the panel OFF when ALL pairs are model-predicted (no elicited data)", () => {
    // A learner who ONLY answered quizzes — even with plenty of pairs — has never
    // stated a confidence, so the panel must read insufficient (never fabricate).
    const log = Array.from({ length: MIN_PAIRS * 2 }, (_, i) =>
      pair(QUIZ, 0.8, (i % 2) as 0 | 1),
    );
    const data = reliabilityDiagram(elicitedConfidencePairs(log));
    expect(data.sufficient).toBe(false);
    expect(data.count).toBe(0);
    expect(elicitedConfidenceSourceNote(log)).toBeUndefined();
  });

  it("renders the panel once enough ELICITED pairs accrue, and names the source", () => {
    const log: PersistedCalibrationPair[] = [
      ...Array.from({ length: 20 }, (_, i) =>
        pair(FERMI, 0.9, (i < 16 ? 1 : 0) as 0 | 1),
      ),
      ...Array.from({ length: 20 }, (_, i) =>
        pair(FLOOR_TOPIC_KEY, 0.8, (i < 16 ? 1 : 0) as 0 | 1),
      ),
    ];
    const data = reliabilityDiagram(elicitedConfidencePairs(log));
    expect(data.count).toBe(40);
    expect(data.sufficient).toBe(true);

    const note = elicitedConfidenceSourceNote(log);
    expect(note).toBeTruthy();
    expect(note).toContain("40 times");
    // Names BOTH genuine sources, not "quizzes".
    expect(note).toContain("90% intervals");
    expect(note).toContain("Trading-Floor");
    expect(note).not.toContain("quiz");
  });
});
