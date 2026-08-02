import type { NumericQuestion, Question } from "@/types/content";
import { numericMatches } from "./numeric";
import {
  creditForEpisode,
  type HintRungReached,
} from "@/lib/tutor/creditSchedule";

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

/**
 * The credit-weighted VISIBLE round score: the mean of per-item hint-credit over
 * the FIXED round size. This is the number the learner SEES (the lesson map's
 * "Best X%" and the Summary "Mastery %"), and it is DISTINCT from the binary
 * `roundScore` above.
 *
 * `roundScore` (fraction of items ULTIMATELY correct, ignoring hints) drives the
 * lenient advance/unlock GATE and remediation so that using hints can never
 * bounce a learner below the pass bar. `creditRoundScore` reflects HOW MUCH help
 * was needed: a question answered correctly after 2 hints earns 0.45 credit, so
 * a 5/5 all-correct-after-2-hints round displays 45% even though the gate is met.
 *
 * `credits` is the parallel per-item credit array (each ∈ [0,1] from the rung
 * schedule); non-finite entries are treated as 0. Returns 0 when `total <= 0`.
 */
export function creditRoundScore(credits: number[], total: number): number {
  if (total <= 0) return 0;
  const sum = credits.reduce(
    (acc, c) => acc + (Number.isFinite(c) ? c : 0),
    0,
  );
  return sum / total;
}

/**
 * Thin re-export wrapper around `creditForEpisode` so callers/tests have a single
 * partial-credit scoring entry point in `score.ts`. Returns the credit ∈ [0,1] a
 * resolved hint episode earns given whether it was ultimately `correct` and the
 * `highestRung` reached before that correct answer.
 */
export function creditForRung(
  correct: boolean,
  highestRung: HintRungReached,
): number {
  return creditForEpisode(correct, highestRung);
}
