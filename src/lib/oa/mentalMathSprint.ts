/**
 * lib/oa/mentalMathSprint.ts — question SELECTION, SPEED-WEIGHTED SCORING, and the
 * mental-math MASTERY MAPPING for the timed mental-math SPRINT that runs as the
 * first phase of the guided pipeline's Timed Diagnostic (Stage 3). This is the
 * sibling of `timedDiagnostic.ts` (the hard section) for the mental-math burst.
 *
 * WHY THIS EXISTS. Untimed mental-math items are "free" — they inflate mastery
 * without testing the real skill (SPEED). This sprint makes mental math a real,
 * time-pressured, scored part of the pipeline and is the AUTHORITATIVE source for
 * the single `mental-math::_core` KST node (see `content/mentalMath/subtopics.ts`).
 *
 * WHAT THIS OWNS:
 *  - A DETERMINISTIC, reload-recoverable draw of exact-arithmetic MCQ items that
 *    COVERS every mental-math subtopic. Each item is built from the EXISTING
 *    exact-verified mental-math generators (`content/mentalMath/generators.ts`):
 *    the numeric builder computes the answer directly (correct-by-construction)
 *    and its parametric slip catalog (`commonErrors`) becomes the MCQ distractors,
 *    so every item is verifier-backed with a matching answer among the choices.
 *  - A PER-QUESTION shot-clock budget per subtopic (~10–18 s by difficulty),
 *    threaded through the session's optional `questionBudgetsMs` so the shared
 *    sprint engine enforces it and a TIMEOUT = MISS (auto-advance, chosen = null).
 *  - SPEED-WEIGHTED scoring: fast+correct earns full credit, slow-but-correct
 *    earns partial credit (linear decay to a floor), wrong/timeout earns none —
 *    so fast-correct > slow-correct > wrong. This credit drives BOTH the
 *    `mental-math::_core` mastery fold (fractional `ItemAttempt.credit`) AND the
 *    timed-diagnostic gate/section score.
 *
 * The timer engine itself is NOT re-implemented here: the sprint runs on the
 * shared `sprint`-kind `MENTAL_MATH_SPRINT_FORMAT` (config.ts) through the exact
 * reload-proof per-question `timedSession.ts` engine (absolute `questionDeadlineTs`
 * + optional per-question `questionBudgetsMs`), like every other sprint.
 */
import type { Difficulty, NumericQuestion } from "@/types/content";
import type { ItemAttempt } from "@/types/mastery";
import type { TimedSectionResult } from "@/types/progress";
import { Rng } from "@/lib/rng";
import { fmt } from "@/content/shared";
import {
  MENTAL_MATH_SUBTOPICS,
  MENTAL_MATH_TOPIC_KEY,
  type MentalMathSubtopic,
} from "@/content/mentalMath/subtopics";
import {
  buildAdditionNumericInstance,
  buildDigitCountNumericInstance,
  buildDivisionNumericInstance,
  buildFractionToDecimalNumericInstance,
  buildMultiply2x1NumericInstance,
  buildMultiply2x2NumericInstance,
  buildOddsToProbNumericInstance,
  buildPercentNumericInstance,
  buildSeriesSumNumericInstance,
  buildSquareProductNumericInstance,
  buildSubtractionNumericInstance,
} from "@/content/mentalMath/generators";
import { isCorrect } from "./scoring";
import type { OaQuestion, OaSessionState } from "./types";

/* -------------------------------------------------------------------------- */
/*  Subtopic coverage + per-question shot-clock budgets                        */
/* -------------------------------------------------------------------------- */

/**
 * The mental-math subtopics the sprint COVERS, in a stable order. This is the
 * full canonical taxonomy (`MENTAL_MATH_SUBTOPICS`) — arithmetic, multiplication,
 * division, percentages, fractions↔decimals, ratios/odds→probability, squares &
 * products, series sums, and digit counting — so a full plan cycle exercises the
 * whole skill. Asserted exhaustive in the tests.
 */
export const MENTAL_MATH_SPRINT_SUBTOPICS: readonly MentalMathSubtopic[] = [
  "additive-arithmetic",
  "multiplication",
  "division",
  "percentages",
  "fractions-decimals",
  "ratios-odds-probability",
  "squares-products",
  "series-sums",
  "digit-counting",
];

/**
 * Per-subtopic PER-QUESTION shot-clock budget (ms), ≈10–18 s by difficulty: a
 * quick add/percent gets ~10 s; a two-digit product/division/fraction ~12–14 s;
 * an odds→probability conversion or series sum the full ~16–18 s. The sprint
 * threads these into the session's optional `questionBudgetsMs`, so the engine
 * paces each item on its own clock and a TIMEOUT counts as a MISS.
 */
export const MENTAL_MATH_SPRINT_BUDGETS_MS: Record<MentalMathSubtopic, number> = {
  "additive-arithmetic": 10_000,
  multiplication: 12_000,
  division: 12_000,
  percentages: 10_000,
  "fractions-decimals": 12_000,
  "ratios-odds-probability": 16_000,
  "squares-products": 14_000,
  "series-sums": 16_000,
  "digit-counting": 18_000,
};

/** A single build fn: computes the exact answer + its numeric (slip-catalog) question. */
type NumericInstanceBuilder = (
  rng: Rng,
) => { answer: number; numeric: NumericQuestion };

/**
 * The exact-verified numeric builder each subtopic draws from (all from
 * `content/mentalMath/generators.ts`). Where a subtopic has more than one natural
 * family (additive = add/subtract; multiplication = 2×1 / 2×2) the rng picks one,
 * keeping the draw varied yet deterministic. The chosen difficulty matches the
 * generators' own named-adapter difficulties.
 */
const SPRINT_BUILDERS: Record<MentalMathSubtopic, NumericInstanceBuilder> = {
  "additive-arithmetic": (rng) => {
    const build = rng.pick([
      buildAdditionNumericInstance,
      buildSubtractionNumericInstance,
    ]);
    return build(rng, "easy");
  },
  multiplication: (rng) => {
    const build = rng.pick([
      buildMultiply2x1NumericInstance,
      buildMultiply2x2NumericInstance,
    ]);
    return build(rng, "medium");
  },
  division: (rng) => buildDivisionNumericInstance(rng, "medium"),
  percentages: (rng) => buildPercentNumericInstance(rng, "easy"),
  "fractions-decimals": (rng) =>
    buildFractionToDecimalNumericInstance(rng, "medium"),
  "ratios-odds-probability": (rng) => buildOddsToProbNumericInstance(rng, "hard"),
  "squares-products": (rng) => buildSquareProductNumericInstance(rng, "hard"),
  "series-sums": (rng) => buildSeriesSumNumericInstance(rng, "hard"),
  "digit-counting": (rng) => buildDigitCountNumericInstance(rng, "medium"),
};

/* -------------------------------------------------------------------------- */
/*  Deterministic, reload-recoverable plan + draw                             */
/* -------------------------------------------------------------------------- */

/** Stable id prefix so the seed (hence the subtopic tags + budgets) is recoverable on reload. */
const ID_PREFIX = "mm-sprint";

function idFor(seed: number, i: number): string {
  return `${ID_PREFIX}-${seed}-${i}`;
}

/** Parse the seed back out of a `mm-sprint-<seed>-<i>` id (or null if it isn't one). */
export function parseMentalMathSprintSeed(id: string | undefined): number | null {
  if (!id) return null;
  const m = /^mm-sprint-(\d+)-\d+$/.exec(id);
  return m ? Number(m[1]) : null;
}

/** One entry in the sprint plan: a mental-math subtopic + its per-question budget. */
export interface MmSprintPlanEntry {
  subtopic: MentalMathSubtopic;
  budgetMs: number;
}

/**
 * The plan SELECTION only (no question generation): shuffle the subtopic coverage
 * list with a dedicated `Rng(seed)` and cycle it to `count` entries. Because the
 * first full cycle is a permutation of all subtopics, ANY `count ≥ subtopics`
 * COVERS every subtopic at least once. Deterministic from `(seed, count)` ALONE so
 * the per-index subtopic tags + budgets are recoverable after a reload without
 * regenerating the questions.
 */
export function selectMentalMathSprintPlan(
  seed: number,
  count: number,
): MmSprintPlanEntry[] {
  if (MENTAL_MATH_SPRINT_SUBTOPICS.length === 0) return [];
  const rng = new Rng(seed);
  const shuffled = rng.shuffle(MENTAL_MATH_SPRINT_SUBTOPICS);
  const out: MmSprintPlanEntry[] = [];
  for (let i = 0; i < Math.max(0, count); i++) {
    const subtopic = shuffled[i % shuffled.length];
    out.push({ subtopic, budgetMs: MENTAL_MATH_SPRINT_BUDGETS_MS[subtopic] });
  }
  return out;
}

/** Format a candidate choice value consistently so the correct answer is findable. */
function formatChoice(value: number, decimals: number): string {
  return decimals > 0 ? fmt(value, decimals) : fmt(value);
}

/**
 * Adapt one exact-verified numeric instance into a 4-choice MCQ `OaQuestion`. The
 * correct choice is the EXACT computed answer; the distractors are the numeric's
 * own parametric slip values (`commonErrors`), padded with deterministic near
 * misses if fewer than three survive de-duplication. The choices are shuffled with
 * the SAME rng so the correct index varies, and the "(Enter …)" free-response
 * hint is stripped from the prompt.
 */
function toSprintMcq(
  rng: Rng,
  built: { answer: number; numeric: NumericQuestion },
  id: string,
): OaQuestion {
  const { answer, numeric } = built;
  const decimals = numeric.decimals ?? 0;
  const correctStr = formatChoice(answer, decimals);

  const seen = new Set<string>([correctStr]);
  const distractors: string[] = [];
  for (const e of numeric.commonErrors ?? []) {
    if (distractors.length >= 3) break;
    const s = formatChoice(e.value, decimals);
    if (!seen.has(s)) {
      seen.add(s);
      distractors.push(s);
    }
  }
  // Deterministic padding so we always present four distinct choices even if the
  // slip catalog collided down to fewer than three usable distractors.
  const step = decimals > 0 ? 10 ** -decimals : 1;
  const pads = [
    answer + step,
    answer - step,
    answer + 2 * step,
    answer - 2 * step,
    answer + 10 * step,
    answer * 2,
    answer + 100 * step,
  ];
  for (const p of pads) {
    if (distractors.length >= 3) break;
    if (!Number.isFinite(p)) continue;
    const s = formatChoice(p, decimals);
    if (!seen.has(s)) {
      seen.add(s);
      distractors.push(s);
    }
  }

  const choices = rng.shuffle([correctStr, ...distractors]);
  const prompt = numeric.prompt.replace(/\s*\(Enter[^)]*\)\s*$/i, "");
  return {
    id,
    prompt,
    choices,
    correctIndex: choices.indexOf(correctStr),
    explanation: numeric.explanation,
    concept: numeric.concept,
    difficulty: numeric.difficulty,
    source: numeric.source,
  };
}

/** A drawn mental-math sprint: the questions + their parallel subtopic tags + budgets. */
export interface MentalMathSprintDraw {
  questions: OaQuestion[];
  /** `subtopics[i]` is the mental-math subtopic `questions[i]` tests. */
  subtopics: MentalMathSubtopic[];
  /** `budgetsMs[i]` is the per-question shot-clock budget (ms) for `questions[i]`. */
  budgetsMs: number[];
}

/**
 * Deterministically draw `count` exact-verified mental-math MCQ items from `seed`.
 * Same `(seed, count)` ⇒ identical questions (ids, prompts, choices, correctIndex)
 * AND identical subtopic tags + budgets. The plan (tags/budgets) comes from
 * {@link selectMentalMathSprintPlan}; the questions are materialized from each
 * entry's exact numeric builder with a SEPARATE `Rng(seed)`, so the tags are
 * recoverable independently of generation. Ids encode the seed
 * (`mm-sprint-<seed>-<i>`) so a reloaded session recovers its tags via
 * {@link mentalMathSprintSubtopicsForSession}.
 */
export function drawMentalMathSprint(
  seed: number,
  count: number,
): MentalMathSprintDraw {
  const plan = selectMentalMathSprintPlan(seed, count);
  const rng = new Rng(seed);
  const questions = plan.map((entry, i) => {
    const built = SPRINT_BUILDERS[entry.subtopic](rng);
    return toSprintMcq(rng, built, idFor(seed, i));
  });
  return {
    questions,
    subtopics: plan.map((e) => e.subtopic),
    budgetsMs: plan.map((e) => e.budgetMs),
  };
}

/**
 * Recover the per-question subtopic tags for a (running or finished) sprint
 * session — the reload-proof bridge that lets scoring attribute per subtopic
 * without persisting extra shape. Parses the seed from the session's first
 * question id and reproduces the deterministic plan; falls back to a repeated
 * `"additive-arithmetic"` tag if the id isn't a sprint id (defensive — never
 * throws).
 */
export function mentalMathSprintSubtopicsForSession(
  session: OaSessionState,
): MentalMathSubtopic[] {
  const seed = parseMentalMathSprintSeed(session.questions[0]?.id);
  if (seed == null) {
    return session.questions.map(() => "additive-arithmetic" as MentalMathSubtopic);
  }
  return selectMentalMathSprintPlan(seed, session.questions.length).map(
    (e) => e.subtopic,
  );
}

/** Recover the per-question budgets (ms) for a sprint session (reload-proof). */
export function mentalMathSprintBudgetsForSession(
  session: OaSessionState,
): number[] {
  const seed = parseMentalMathSprintSeed(session.questions[0]?.id);
  if (seed == null) {
    return session.questions.map(
      (_, i) => session.questionBudgetsMs?.[i] ?? session.budgetMs,
    );
  }
  return selectMentalMathSprintPlan(seed, session.questions.length).map(
    (e) => e.budgetMs,
  );
}

/* -------------------------------------------------------------------------- */
/*  Speed-weighted scoring                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Fraction of the budget within which a CORRECT answer earns FULL credit (1.0).
 * Answers slower than this decay linearly toward {@link MM_SPRINT_SLOW_FLOOR}.
 */
export const MM_SPRINT_FAST_FRACTION = 0.5;
/** Floor credit a CORRECT answer earns right at the budget (never below this while correct). */
export const MM_SPRINT_SLOW_FLOOR = 0.5;

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/**
 * The SPEED-WEIGHTED credit S ∈ [0,1] for one sprint item:
 *  - WRONG or TIMEOUT (`correct === false`) ⇒ 0,
 *  - CORRECT within `FAST_FRACTION` of the budget ⇒ full 1.0,
 *  - CORRECT but slower ⇒ linear decay from 1.0 down to `SLOW_FLOOR` as elapsed
 *    approaches the budget.
 * Guarantees fast-correct > slow-correct > wrong, and is monotonically
 * non-increasing in `elapsedMs`. Deterministic and pure.
 */
export function mentalMathSpeedCredit(
  elapsedMs: number,
  budgetMs: number,
  correct: boolean,
): number {
  if (!correct) return 0;
  if (!(budgetMs > 0)) return 1;
  const frac = clamp01(elapsedMs / budgetMs);
  if (frac <= MM_SPRINT_FAST_FRACTION) return 1;
  const t = (frac - MM_SPRINT_FAST_FRACTION) / (1 - MM_SPRINT_FAST_FRACTION);
  const credit = 1 - t * (1 - MM_SPRINT_SLOW_FLOOR);
  return Number(credit.toFixed(4));
}

/** One graded sprint item: subtopic, correctness, timing, and speed-weighted credit. */
export interface MmSprintItemOutcome {
  subtopic: MentalMathSubtopic;
  tier: Difficulty;
  correct: boolean;
  elapsedMs: number;
  budgetMs: number;
  /** Speed-weighted credit S ∈ [0,1] (see {@link mentalMathSpeedCredit}). */
  credit: number;
}

/**
 * Grade a finished sprint session into per-item speed-weighted outcomes. An
 * unanswered item (timeout/skip) counts as WRONG with the full budget spent, so
 * its credit is 0. Min-length guarded against a truncated answers array.
 */
export function scoreMentalMathSprint(
  session: OaSessionState,
  subtopics: MentalMathSubtopic[],
  budgetsMs: number[],
): MmSprintItemOutcome[] {
  const n = Math.min(session.questions.length, subtopics.length);
  const out: MmSprintItemOutcome[] = [];
  for (let i = 0; i < n; i++) {
    const question = session.questions[i];
    const answer = session.answers[i];
    const correct = !!answer && isCorrect(question, answer);
    const budgetMs = budgetsMs[i] ?? session.budgetMs;
    const elapsedMs = answer ? answer.elapsedMs : budgetMs;
    out.push({
      subtopic: subtopics[i],
      tier: (question.difficulty ?? "medium") as Difficulty,
      correct,
      elapsedMs,
      budgetMs,
      credit: mentalMathSpeedCredit(elapsedMs, budgetMs, correct),
    });
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Mastery mapping + timed-section wiring                                      */
/* -------------------------------------------------------------------------- */

/**
 * Map each sprint outcome to a `mental-math::_core` {@link ItemAttempt} carrying
 * the SPEED-WEIGHTED credit as the fractional score. The single mental-math node
 * receives all sprint evidence (per `content/mentalMath/subtopics.ts`: subtopics
 * are attribution TAGS on one KST node, not separate nodes), so a fast-correct
 * sprint pushes mastery up and a slow/missed one pushes it down. Handed to
 * `ProgressContext.recordItemAttempt` by the stage — this is the AUTHORITATIVE
 * mental-math mastery signal.
 */
export function mentalMathSprintAttempts(
  outcomes: MmSprintItemOutcome[],
  at: string = new Date().toISOString(),
): ItemAttempt[] {
  return outcomes.map(
    (o) =>
      ({
        topicKey: MENTAL_MATH_TOPIC_KEY,
        tier: o.tier,
        correct: o.correct,
        mode: "quiz" as const,
        kOptions: 4,
        credit: o.credit,
        responseMs: o.elapsedMs,
        at,
      }) satisfies ItemAttempt,
  );
}

/** Human label for the aggregate sprint section. */
export const MENTAL_MATH_SPRINT_SECTION_LABEL = "Mental-math sprint";

/**
 * Build the ONE aggregate timed section for the sprint: `correct` is the SUM of
 * speed-weighted credit and `total` is the item count, so the section accuracy
 * `correct/total` is the speed-weighted mental-math score gated at ≥ 0.90 by the
 * timed overlay (`allTimedSectionsClear`). It attributes to the single
 * `mental-math::_core` node. Returned as an array (empty when there are no
 * outcomes) so the stage can concatenate it with the hard section's per-topic
 * results.
 */
export function buildMentalMathSprintSections(
  outcomes: MmSprintItemOutcome[],
  at: string = new Date().toISOString(),
): TimedSectionResult[] {
  if (outcomes.length === 0) return [];
  const correct = Number(
    outcomes.reduce((s, o) => s + o.credit, 0).toFixed(4),
  );
  return [
    {
      label: MENTAL_MATH_SPRINT_SECTION_LABEL,
      correct,
      total: outcomes.length,
      topicKeys: [MENTAL_MATH_TOPIC_KEY],
      at,
    },
  ];
}

/** The distinct mental-math node the sprint attributes to (audit / tests). */
export function mentalMathSprintTopicKey(): string {
  return MENTAL_MATH_TOPIC_KEY;
}

/** Re-export the subtopic labels for callers/tests that render coverage. */
export { MENTAL_MATH_SUBTOPICS };
