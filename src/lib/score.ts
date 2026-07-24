import type { NumericQuestion, Question } from "@/types/content";
import { numericMatches } from "./numeric";

/**
 * Round-scoring helpers — the SINGLE source of truth for a level attempt's
 * tally. A round is EXACTLY the fixed set of materialized questions (5 by
 * default) and its parallel `answers` array; the score is `correct / total`.
 *
 * Bonus "Generate another like this" / "✨ Fresh variant" items are produced by
 * separate, self-contained player components (see `LessonPage`) that keep their
 * OWN local state and NEVER touch the round's `questions` / `answers` arrays or
 * `recordAttempt`. Because these helpers read ONLY the round arrays, no bonus
 * item — right or wrong, from either button — can ever move the round score,
 * mastery, streak, or resume. `regenerateFamily.test.ts` locks that in.
 */

/** Count correct answers in a multiple-choice round (index === correctIndex). */
export function countQuizCorrect(
  questions: Question[],
  answers: (number | null)[],
): number {
  return answers.filter(
    (a, i) => a !== null && a === questions[i]?.correctIndex,
  ).length;
}

/** Count correct answers in a numeric round (exact/rounded grader match). */
export function countNumericCorrect(
  questions: NumericQuestion[],
  answers: (number | null)[],
): number {
  return answers.filter(
    (a, i) => a !== null && questions[i] != null && numericMatches(questions[i], a),
  ).length;
}

/** The round score as a fraction in [0, 1]; 0 for an empty round. */
export function roundScore(correct: number, total: number): number {
  return total > 0 ? correct / total : 0;
}
