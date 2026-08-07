/**
 * ============================================================================
 *  BEAT THE ODDS — fast probability / EV drill (pure session engine)
 * ============================================================================
 * Mimics the Optiver-style "Beat the Odds" section: ~20 rapid probability-
 * theory + expected-value questions, ~90 seconds each, five-option "pick the
 * closest", strictly forward (no back-navigation), difficulty escalating.
 *
 * The questions come from the standalone `@/content/games/beatTheOddsQuestions`
 * generators (exact-verified). This engine owns only the SESSION: a per-question
 * wall-clock deadline (absolute epoch-ms, so a leave/reload resumes exactly and
 * an expired question auto-times-out on return), the forward-only cursor, and a
 * speed-weighted score. Pure and JSON-serializable — snapshot = seed + answers.
 */
import {
  buildBeatTheOddsPaper,
  DEFAULT_BTO_COUNT,
  type BtoQuestion,
} from "@/content/games/beatTheOddsQuestions";

/** ~90 seconds per question, the section's signature fast clock. */
export const DEFAULT_BTO_BUDGET_MS = 90 * 1000;

/** Base points for a correct answer (before the speed bonus + tier weight). */
export const BTO_BASE_POINTS = 50;
/** Max speed bonus for an instant correct answer. */
export const BTO_MAX_SPEED_BONUS = 50;

export interface BtoAnswer {
  chosen: number | null;
  atTs: number;
  timedOut: boolean;
  /** Fraction of the per-question budget consumed at commit (0 = instant). */
  timeFraction: number;
  /** Points earned for this item (0 when wrong/timed out). */
  points: number;
  correct: boolean;
}

export interface BeatTheOddsSession {
  seed: number;
  count: number;
  budgetMs: number;
  index: number;
  /** Absolute epoch-ms deadline for the CURRENT question. */
  questionDeadlineTs: number;
  answers: (BtoAnswer | null)[];
  status: "running" | "finished";
}

/* ========================================================================== */
/*  Construction                                                               */
/* ========================================================================== */

/** The exact question paper backing a session (deterministic from the seed). */
export function paperFor(s: BeatTheOddsSession): BtoQuestion[] {
  return buildBeatTheOddsPaper(s.seed, s.count);
}

export function createBtoSession(opts: {
  seed: number;
  nowTs: number;
  count?: number;
  budgetMs?: number;
}): BeatTheOddsSession {
  const count = opts.count ?? DEFAULT_BTO_COUNT;
  const budgetMs = opts.budgetMs ?? DEFAULT_BTO_BUDGET_MS;
  return {
    seed: opts.seed,
    count,
    budgetMs,
    index: 0,
    questionDeadlineTs: opts.nowTs + budgetMs,
    answers: Array.from({ length: count }, () => null),
    status: "running",
  };
}

/* ========================================================================== */
/*  Scoring                                                                    */
/* ========================================================================== */

/**
 * Points for one item: 0 if wrong/timed out; otherwise a tier-weighted base
 * plus a speed bonus that decays linearly to 0 as the 90s budget is consumed.
 */
export function scoreItem(
  tier: 1 | 2 | 3,
  correct: boolean,
  timeFraction: number,
): number {
  if (!correct) return 0;
  const frac = Math.max(0, Math.min(1, timeFraction));
  const bonus = BTO_MAX_SPEED_BONUS * (1 - frac);
  return Math.round(tier * (BTO_BASE_POINTS + bonus));
}

/* ========================================================================== */
/*  Transitions                                                                */
/* ========================================================================== */

export function currentQuestion(s: BeatTheOddsSession): BtoQuestion | undefined {
  return paperFor(s)[s.index];
}

export function isAnswered(s: BeatTheOddsSession, index: number): boolean {
  return s.answers[index] != null;
}

export function remainingMs(s: BeatTheOddsSession, nowTs: number): number {
  return Math.max(0, s.questionDeadlineTs - nowTs);
}

export function isQuestionExpired(s: BeatTheOddsSession, nowTs: number): boolean {
  return nowTs >= s.questionDeadlineTs;
}

/**
 * Commit the current question. `chosen` is the option index, or null for a
 * skip/timeout. Idempotent per index. Deterministic given (chosen, atTs).
 */
export function answerBto(
  s: BeatTheOddsSession,
  chosen: number | null,
  atTs: number,
  timedOut = false,
): BeatTheOddsSession {
  if (s.status !== "running") return s;
  if (isAnswered(s, s.index)) return s;
  const q = currentQuestion(s);
  if (!q) return s;
  const elapsed = s.budgetMs - Math.max(0, s.questionDeadlineTs - atTs);
  const timeFraction = Math.max(0, Math.min(1, elapsed / s.budgetMs));
  const correct = chosen != null && chosen === q.correctIndex;
  const points = scoreItem(q.tier, correct, timeFraction);
  const answers = s.answers.slice();
  answers[s.index] = { chosen, atTs, timedOut, timeFraction, points, correct };
  return { ...s, answers };
}

/** Advance forward to the next question (resets the per-question clock). */
export function advanceBto(
  s: BeatTheOddsSession,
  nowTs: number,
): BeatTheOddsSession {
  if (s.status !== "running") return s;
  const next = s.index + 1;
  if (next >= s.count) return { ...s, status: "finished" };
  return { ...s, index: next, questionDeadlineTs: nowTs + s.budgetMs };
}

/* ========================================================================== */
/*  Summary                                                                    */
/* ========================================================================== */

export interface BtoSummary {
  total: number;
  answered: number;
  correct: number;
  score: number;
  maxScore: number;
  accuracyPct: number;
  avgTimeFraction: number;
}

export function summarizeBto(s: BeatTheOddsSession): BtoSummary {
  const paper = paperFor(s);
  let correct = 0;
  let answered = 0;
  let score = 0;
  let maxScore = 0;
  let fracSum = 0;
  let fracCount = 0;
  paper.forEach((q, i) => {
    maxScore += scoreItem(q.tier, true, 0); // best-case: instant + correct
    const a = s.answers[i];
    if (a) {
      answered += 1;
      if (a.correct) correct += 1;
      score += a.points;
      fracSum += a.timeFraction;
      fracCount += 1;
    }
  });
  return {
    total: paper.length,
    answered,
    correct,
    score,
    maxScore,
    accuracyPct: paper.length ? Math.round((correct / paper.length) * 100) : 0,
    avgTimeFraction: fracCount ? fracSum / fracCount : 0,
  };
}
