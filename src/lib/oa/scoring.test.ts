import { describe, expect, it } from "vitest";
import { SECTION_FORMAT, SPRINT_FORMAT, resolveScoring } from "./config";
import {
  classify,
  countAttempted,
  countCorrect,
  isCorrect,
  maxOaScore,
  scoreOaAnswers,
  scoreOaSession,
} from "./scoring";
import type { OaAnswer, OaQuestion, OaScoringRule, OaSessionState } from "./types";

/** A minimal question whose correct choice is index 0 by default. */
const q = (id: string, correctIndex = 0): OaQuestion => ({
  id,
  prompt: `prompt ${id}`,
  choices: ["a", "b", "c", "d"],
  correctIndex,
  explanation: "because",
  difficulty: "medium",
});

/** An answer parallel to a question. `chosen: null` ⇒ skipped. */
const ans = (questionId: string, chosen: number | null, elapsedMs = 1000): OaAnswer => ({
  questionId,
  chosen,
  elapsedMs,
});

const SPRINT_RULE: OaScoringRule = SPRINT_FORMAT.scoring; // +1 / -1 / 0
const SECTION_RULE: OaScoringRule = SECTION_FORMAT.scoring; // +1 / 0 / 0
const SECTION_HARD_RULE: OaScoringRule = resolveScoring(SECTION_FORMAT, true); // +1 / -1 / 0

describe("isCorrect", () => {
  it("is true only when answered and chosen matches correctIndex", () => {
    expect(isCorrect(q("a", 2), ans("a", 2))).toBe(true);
    expect(isCorrect(q("a", 2), ans("a", 1))).toBe(false);
  });

  it("is false for a skip (chosen === null), even if correctIndex is 0", () => {
    expect(isCorrect(q("a", 0), ans("a", null))).toBe(false);
  });
});

describe("classify", () => {
  it("returns correct / wrong / skip", () => {
    expect(classify(q("a", 1), ans("a", 1))).toBe("correct");
    expect(classify(q("a", 1), ans("a", 0))).toBe("wrong");
    expect(classify(q("a", 1), ans("a", null))).toBe("skip");
  });
});

describe("scoreOaAnswers", () => {
  const questions = [q("q1", 0), q("q2", 1), q("q3", 2), q("q4", 3)];
  // correct, wrong, skip, correct
  const answers = [ans("q1", 0), ans("q2", 0), ans("q3", null), ans("q4", 3)];

  it("scores sprint (+1 / -1 / 0): 2 correct, 1 wrong, 1 skip ⇒ +1", () => {
    // +1 +(-1) + 0 + 1 = 1
    expect(scoreOaAnswers(questions, answers, SPRINT_RULE)).toBe(1);
  });

  it("scores section (+1 / 0 / 0): wrong & skip score 0 ⇒ 2", () => {
    // +1 + 0 + 0 + 1 = 2
    expect(scoreOaAnswers(questions, answers, SECTION_RULE)).toBe(2);
  });

  it("scores section hard-mode (+1 / -1 / 0): wrong penalized ⇒ +1", () => {
    // +1 +(-1) + 0 + 1 = 1
    expect(scoreOaAnswers(questions, answers, SECTION_HARD_RULE)).toBe(1);
  });

  it("guards a length mismatch by iterating the shared min length", () => {
    // Only q1 (correct) + q2 (wrong) are scored under sprint ⇒ +1 -1 = 0.
    expect(scoreOaAnswers(questions, answers.slice(0, 2), SPRINT_RULE)).toBe(0);
    // Extra answers beyond questions are ignored too.
    expect(
      scoreOaAnswers(questions.slice(0, 1), answers, SPRINT_RULE),
    ).toBe(1);
  });

  it("is 0 for empty inputs", () => {
    expect(scoreOaAnswers([], [], SPRINT_RULE)).toBe(0);
  });
});

describe("scoreOaSession", () => {
  it("delegates to scoreOaAnswers with the session's own rule", () => {
    const state = {
      questions: [q("q1", 0), q("q2", 1)],
      answers: [ans("q1", 0), ans("q2", 0)], // correct, wrong
      scoring: SPRINT_RULE,
    } as unknown as OaSessionState;
    expect(scoreOaSession(state)).toBe(0); // +1 -1
  });
});

describe("maxOaScore", () => {
  it("is questionCount × scoring.correct", () => {
    expect(maxOaScore(12, SPRINT_RULE)).toBe(12);
    expect(maxOaScore(17, SECTION_RULE)).toBe(17);
    expect(maxOaScore(0, SPRINT_RULE)).toBe(0);
  });
});

describe("countCorrect / countAttempted", () => {
  const questions = [q("q1", 0), q("q2", 1), q("q3", 2), q("q4", 3)];
  const answers = [ans("q1", 0), ans("q2", 0), ans("q3", null), ans("q4", 3)];

  it("countCorrect counts only matching answers", () => {
    expect(countCorrect(questions, answers)).toBe(2); // q1, q4
  });

  it("countAttempted counts answered (chosen != null), excluding skips", () => {
    expect(countAttempted(questions, answers)).toBe(3); // q1, q2, q4
  });

  it("both guard length mismatch via min length", () => {
    expect(countCorrect(questions, answers.slice(0, 2))).toBe(1); // q1
    expect(countAttempted(questions, answers.slice(0, 2))).toBe(2); // q1, q2
  });
});
