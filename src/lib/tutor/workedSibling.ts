import { Rng } from "@/lib/rng";
import type { Level, NumericQuestion, Question } from "@/types/content";
import {
  freshPracticeSeed,
  generateFreshNumericQuestion,
  generateFreshQuestion,
} from "@/lib/regenerate";
import { formatNumericAnswer } from "@/lib/numeric";
import { deriveWorkedSteps } from "./faded";

/**
 * Rung-3 WORKED SIBLING builder (PHASE_2 §5 — completion / worked-example study).
 *
 * Rung 3 of the answer-withholding ladder promises "the SAME kind of problem
 * with different numbers, worked one step at a time". This module actually
 * PRODUCES that worked example: it re-invokes the level's OWN parametric
 * generator/solver (via `@/lib/regenerate`) with a fresh seed, LOCKED to the
 * current item's family, so the sibling is a genuine same-family instance whose
 * numbers, steps, and final answer are computed by the exact same code that
 * produced the current question — never a generic sentence.
 *
 * INVARIANTS (asserted in `workedSibling.test.ts`):
 *  - The sibling is CONCRETE: a full problem statement, ordered worked steps
 *    carrying real numbers, and the sibling's own final answer.
 *  - It NEVER leaks the current item's answer: the sibling is drawn until its
 *    answer differs from the current one (different numbers). If a family's
 *    parameter space is too small to yield a different answer within the cap, we
 *    return `null` (the view then keeps the generic caption) rather than show a
 *    sibling that coincidentally reveals the current answer.
 *
 * FALLBACK. When the level has no generator (a hand-authored STATIC pool), we
 * look for a DIFFERENT item in the same pool that shares the current item's
 * `concept` and has a different answer, and use ITS authored worked solution —
 * the most concrete "same kind, different numbers" example available without a
 * generator. When even that is unavailable the builder returns `null`.
 */

/** A fully worked same-family instance rendered at rung 3. */
export interface WorkedSibling {
  /** The sibling problem statement (different numbers than the current item). */
  prompt: string;
  /** Ordered worked steps, each carrying the sibling's concrete numbers. */
  steps: string[];
  /** The sibling's own final answer (formatted for display). */
  answer: string;
}

/** Max reseed attempts to find a sibling whose answer differs from the current. */
const MAX_SIBLING_ATTEMPTS = 16;

function isQuiz(q: Question | NumericQuestion): q is Question {
  return "choices" in q;
}

/** Rounded-compare mirroring `numeric.ts`/`errorModes.ts` decimals semantics. */
function numericAnswersEqual(a: number, b: number, decimals?: number): boolean {
  if (decimals == null) return a === b;
  const f = 10 ** decimals;
  return Math.round(a * f) === Math.round(b * f);
}

/** Format a numeric sibling's answer the way the numeric player displays it. */
function numericAnswerText(q: NumericQuestion): string {
  const unit = q.unit ?? "$";
  return `${unit}${formatNumericAnswer(q)}`;
}

/** Turn a numeric sibling into worked content, or `null` if it has no steps. */
function numericToWorked(sib: NumericQuestion): WorkedSibling | null {
  const steps = deriveWorkedSteps(sib.explanation).map((s) => s.text);
  if (steps.length === 0) return null;
  return { prompt: sib.prompt, steps, answer: numericAnswerText(sib) };
}

/** Turn a quiz sibling into worked content, or `null` if it has no steps. */
function quizToWorked(sib: Question): WorkedSibling | null {
  const steps = deriveWorkedSteps(sib.explanation).map((s) => s.text);
  if (steps.length === 0) return null;
  return { prompt: sib.prompt, steps, answer: sib.choices[sib.correctIndex] };
}

/**
 * Draw a same-family NUMERIC sibling whose answer differs from `question`'s, so
 * the worked example never reveals the current answer. Returns `null` when the
 * level has no numeric generator, or when no different-answer sibling turns up
 * within the reseed cap (tiny parameter space).
 */
function buildNumericSibling(
  level: Level,
  question: NumericQuestion,
  seed: number,
): WorkedSibling | null {
  const driver = new Rng(seed);
  for (let i = 0; i < MAX_SIBLING_ATTEMPTS; i++) {
    const attemptSeed = driver.int(1, 2_000_000_000);
    const sib = generateFreshNumericQuestion(
      level,
      attemptSeed,
      question.family,
      question,
      true,
      question,
    );
    if (!sib) return null; // no numeric generator on this level
    const decimals = question.decimals ?? sib.decimals;
    if (!numericAnswersEqual(sib.answer, question.answer, decimals)) {
      const worked = numericToWorked(sib);
      if (worked) return worked;
    }
  }
  return null;
}

/**
 * Draw a same-family QUIZ sibling whose correct choice differs from
 * `question`'s. Returns `null` when the level has no generator or no
 * different-answer sibling turns up within the reseed cap.
 */
function buildQuizSibling(
  level: Level,
  question: Question,
  seed: number,
): WorkedSibling | null {
  const driver = new Rng(seed);
  const currentAnswer = question.choices[question.correctIndex];
  for (let i = 0; i < MAX_SIBLING_ATTEMPTS; i++) {
    const attemptSeed = driver.int(1, 2_000_000_000);
    const sib = generateFreshQuestion(
      level,
      attemptSeed,
      question.family,
      question,
      true,
      question,
    );
    if (!sib) return null; // no generator on this level
    if (sib.choices[sib.correctIndex] !== currentAnswer) {
      const worked = quizToWorked(sib);
      if (worked) return worked;
    }
  }
  return null;
}

/**
 * The base id used to tell a pooled item apart from the current one. Static pool
 * items keep their authored ids (materialization does NOT suffix them), so we
 * only strip a regenerate `-practice-<n>` suffix and otherwise compare as-is
 * (authored ids such as `ig-max-dice` legitimately end in a word, not a number).
 */
function baseId(id: string): string {
  return id.replace(/-practice-\d+$/, "");
}

/**
 * STATIC-pool fallback: find a DIFFERENT item in the level's hand-authored pool
 * that shares the current item's `concept` and has a different answer, and use
 * its authored worked solution. This is the most concrete "same kind, different
 * numbers" example available when a level has no generator. Returns `null` when
 * the pool has no such sibling.
 */
function buildStaticSibling(
  level: Level,
  question: Question | NumericQuestion,
): WorkedSibling | null {
  const concept = question.concept;
  if (!concept) return null;
  const curBase = baseId(question.id);

  if (!isQuiz(question) && level.numericQuestions) {
    const cand = level.numericQuestions.find(
      (q) =>
        baseId(q.id) !== curBase &&
        q.concept === concept &&
        !numericAnswersEqual(q.answer, question.answer, question.decimals ?? q.decimals),
    );
    return cand ? numericToWorked(cand) : null;
  }

  if (isQuiz(question) && level.questions) {
    const cand = level.questions.find(
      (q) =>
        baseId(q.id) !== curBase &&
        q.concept === concept &&
        q.choices[q.correctIndex] !== question.choices[question.correctIndex],
    );
    return cand ? quizToWorked(cand) : null;
  }

  return null;
}

/**
 * Build the rung-3 worked sibling for `question` within `level`.
 *
 * Prefers a freshly GENERATED same-family instance (real generator/solver, new
 * numbers, guaranteed different answer). Falls back to a same-`concept` item
 * from a static pool. Returns `null` only when neither is available — the view
 * then keeps the generic "study the step you slipped on" caption.
 *
 * `seed` is accepted for deterministic tests; production callers omit it (a
 * fresh random seed is drawn) so each wrong attempt studies a new sibling.
 */
export function buildWorkedSibling(args: {
  level: Level;
  question: Question | NumericQuestion;
  seed?: number;
}): WorkedSibling | null {
  const { level, question } = args;
  const seed = args.seed ?? freshPracticeSeed();
  const generated = isQuiz(question)
    ? buildQuizSibling(level, question, seed)
    : buildNumericSibling(level, question, seed);
  return generated ?? buildStaticSibling(level, question);
}
