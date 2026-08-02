/**
 * lib/oa/scoring.ts — PURE scoring for the Timed OA / Interview sections.
 *
 * A question is CORRECT when the recorded answer's `chosen` matches the
 * question's `correctIndex`, SKIPPED when `chosen === null` (never answered),
 * and WRONG otherwise. Points are awarded per the resolved `OaScoringRule`
 * (already folds in any hard-mode penalty — see `config.resolveScoring`), so
 * this module never re-derives the rule and stays a thin, deterministic layer.
 *
 * Answers are PARALLEL to questions by index. Every aggregate iterates the
 * common (min) length so a truncated / mismatched `answers` array can never
 * read past its end or mis-attribute a score.
 */
import type { OaAnswer, OaQuestion, OaScoringRule, OaSessionState } from "./types";

/** True ⇔ the question was answered AND the chosen choice is correct. */
export function isCorrect(question: OaQuestion, answer: OaAnswer): boolean {
  return answer.chosen != null && answer.chosen === question.correctIndex;
}

/** Bucket a question/answer pair into the three scoring outcomes. */
export function classify(
  question: OaQuestion,
  answer: OaAnswer,
): "correct" | "wrong" | "skip" {
  if (answer.chosen == null) return "skip";
  return answer.chosen === question.correctIndex ? "correct" : "wrong";
}

/**
 * Sum the score across parallel questions/answers under `scoring`:
 * correct ⇒ `scoring.correct`, wrong ⇒ `scoring.wrong`, skip ⇒ `scoring.skip`.
 * Guards a length mismatch by only iterating the shared (min) length.
 */
export function scoreOaAnswers(
  questions: OaQuestion[],
  answers: OaAnswer[],
  scoring: OaScoringRule,
): number {
  const n = Math.min(questions.length, answers.length);
  let score = 0;
  for (let i = 0; i < n; i++) {
    switch (classify(questions[i], answers[i])) {
      case "correct":
        score += scoring.correct;
        break;
      case "wrong":
        score += scoring.wrong;
        break;
      case "skip":
        score += scoring.skip;
        break;
    }
  }
  return score;
}

/** Convenience: score a whole session with its own questions/answers/rule. */
export function scoreOaSession(state: OaSessionState): number {
  return scoreOaAnswers(state.questions, state.answers, state.scoring);
}

/** Best achievable score = every question correct. */
export function maxOaScore(questionCount: number, scoring: OaScoringRule): number {
  return questionCount * scoring.correct;
}

/** Number of correctly-answered questions (min-length guarded). */
export function countCorrect(questions: OaQuestion[], answers: OaAnswer[]): number {
  const n = Math.min(questions.length, answers.length);
  let c = 0;
  for (let i = 0; i < n; i++) if (isCorrect(questions[i], answers[i])) c++;
  return c;
}

/** Number of ATTEMPTED (answered, i.e. `chosen != null`) questions. */
export function countAttempted(questions: OaQuestion[], answers: OaAnswer[]): number {
  const n = Math.min(questions.length, answers.length);
  let a = 0;
  for (let i = 0; i < n; i++) if (answers[i].chosen != null) a++;
  return a;
}
