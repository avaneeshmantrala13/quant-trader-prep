import type { Difficulty, Flashcard, NumericQuestion } from "@/types/content";
import type { ItemAttempt } from "@/types/mastery";
import type { DiagnosticResult, UserProgress } from "@/types/progress";
import { Rng } from "@/lib/rng";
import { gradeFreeResponse, numericMatches, type NumericGrade } from "@/lib/numeric";
import { adaptHardOaToFreeResponse } from "@/lib/oa/hardContent/frAdapters";
import { brainteaserCredit, COMPETENCY_BRAINTEASER } from "@/lib/mastery/competency";
import { diagnosticToSeeds, type TopicSeed } from "./diagnosticSeed";
import type { DiagnosticOutcome } from "./diagnosticSeed";
import { resolveStage } from "@/lib/pipeline/stateMachine";
import {
  UNTIMED_BLUEPRINT,
  type UntimedItem,
} from "@/content/diagnostic/untimedBlueprint";

/**
 * DRIVER for ONE untimed free-response diagnostic run (Stage 2, P3 bullet 4).
 *
 * PURE + UI-independent so it is deterministic and unit-testable. It:
 *   1. MATERIALIZES the blueprint into served items (numeric questions +
 *      brainteaser flashcards) from a seed — adapter items are projected through
 *      `frAdapters`, brainteasers through their exact-verified generators.
 *   2. GRADES answers — numeric via `@/lib/numeric` (`gradeFreeResponse`);
 *      brainteasers via the HYBRID rule (decision §10.3): a card with a numeric
 *      answer is graded OBJECTIVELY (`numericMatches` against `numericAnswer`),
 *      otherwise it is self-evaluated ("got it" / "missed it").
 *   3. FOLDS outcomes into the correct KST nodes (topic mastery, via
 *      `applyDiagnosticSeed` through `diagnosticToSeeds`) and the
 *      `competency::brainteaser-reasoning` node (via P2's competency scorer credit
 *      through `applyItemAttempt`), and produces the `DiagnosticResult` written to
 *      `progress.pipeline.untimed`.
 *
 * It NEVER touches the EXISTING diagnostic (`run.ts` / `diagnosticSeed.ts` are
 * imported read-only) — this is an additive, parallel driver.
 */

/* -------------------------------------------------------------------------- */
/*  Materialization                                                            */
/* -------------------------------------------------------------------------- */

/** A materialized numeric item: the served free-response question + its blueprint slot. */
export interface MaterializedNumericItem {
  kind: "numeric";
  item: UntimedItem;
  topicKey: string;
  subtopic: string;
  question: NumericQuestion;
  /** The tier the outcome is seeded at (the served question's difficulty). */
  tier: Difficulty;
}

/** A materialized brainteaser item: the served flashcard + its blueprint slot. */
export interface MaterializedBrainteaserItem {
  kind: "brainteaser";
  item: UntimedItem;
  topicKey: string;
  subtopic: string;
  flashcard: Flashcard;
  /** True iff this card has a numeric answer ⇒ HYBRID objective grading. */
  numericGradable: boolean;
}

export type MaterializedUntimedItem =
  | MaterializedNumericItem
  | MaterializedBrainteaserItem;

/** Distinct sub-seed per position so each item is fresh yet reproducible. */
function itemSeed(seed: number, index: number): number {
  return (seed + index * 7919 + 1) >>> 0;
}

/** Materialize ONE blueprint item at position `index` under `seed`. */
export function materializeUntimedItem(
  item: UntimedItem,
  seed: number,
  index: number,
): MaterializedUntimedItem {
  const rng = new Rng(itemSeed(seed, index));
  if (item.kind === "numeric-authored") {
    return {
      kind: "numeric",
      item,
      topicKey: item.topicKey,
      subtopic: item.subtopic,
      question: item.question,
      tier: item.question.difficulty,
    };
  }
  if (item.kind === "numeric-adapter") {
    const { question } = adaptHardOaToFreeResponse(item.family, rng);
    return {
      kind: "numeric",
      item,
      topicKey: item.topicKey,
      subtopic: item.subtopic,
      question,
      tier: question.difficulty,
    };
  }
  // brainteaser
  const flashcard = item.generator(rng);
  return {
    kind: "brainteaser",
    item,
    topicKey: item.topicKey,
    subtopic: item.subtopic,
    flashcard,
    numericGradable: brainteaserIsNumeric(flashcard),
  };
}

/** Materialize the WHOLE blueprint (serve order preserved) from one seed. */
export function materializeUntimedRun(
  seed: number,
  blueprint: UntimedItem[] = UNTIMED_BLUEPRINT,
): MaterializedUntimedItem[] {
  return blueprint.map((item, i) => materializeUntimedItem(item, seed, i));
}

/* -------------------------------------------------------------------------- */
/*  Grading                                                                    */
/* -------------------------------------------------------------------------- */

/** A brainteaser HAS a numeric answer ⇒ it is objectively gradable (decision §10.3). */
export function brainteaserIsNumeric(card: Flashcard): boolean {
  return card.gradable === true && typeof card.numericAnswer === "number";
}

/** Grade a free-response numeric entry (delegates to `@/lib/numeric`). */
export function gradeUntimedNumeric(
  question: NumericQuestion,
  raw: string,
): NumericGrade {
  return gradeFreeResponse(question, raw);
}

/**
 * Grade a brainteaser numeric commit OBJECTIVELY, tolerant to the card's own
 * `tolerance` (via `numericMatches` — spec §5.1: graded by `@/lib/numeric`).
 * Only valid when {@link brainteaserIsNumeric} is true.
 */
export function gradeBrainteaserNumeric(card: Flashcard, value: number): boolean {
  if (!brainteaserIsNumeric(card)) return false;
  const decimals = decimalsForTolerance(card.tolerance ?? 0);
  return numericMatches({ answer: card.numericAnswer as number, decimals }, value);
}

/** Turn an absolute tolerance into a `numericMatches` decimals precision. */
function decimalsForTolerance(tolerance: number): number | undefined {
  if (tolerance <= 0) return undefined; // exact-integer answers
  // 0.005 → 2 dp, 0.0005 → 3 dp, … (round both sides to the tolerance scale).
  return Math.max(0, Math.round(-Math.log10(tolerance)));
}

/* -------------------------------------------------------------------------- */
/*  Outcomes → seeds / competency folds / result                              */
/* -------------------------------------------------------------------------- */

/** One graded outcome from a served item (numeric or brainteaser). */
export interface UntimedOutcome {
  topicKey: string;
  subtopic: string;
  kind: "numeric" | "brainteaser";
  /** For numeric items: the tier to seed at. Ignored for brainteasers. */
  tier: Difficulty;
  correct: boolean;
  /** Optional tripped misconception tag (from a matched common error). */
  misconceptionTag?: string;
  /** ISO timestamp of the graded item. */
  at: string;
}

/**
 * Fold the NUMERIC (KST) outcomes into per-topic diagnostic seeds via the SAME
 * `diagnosticToSeeds` the existing diagnostic uses — each seed writes the item's
 * scored KST node (α = 1 + successes, β = 1 + failures, θ from the tier crossing).
 */
export function untimedToDiagnosticSeeds(outcomes: UntimedOutcome[]): TopicSeed[] {
  const numericOutcomes: DiagnosticOutcome[] = outcomes
    .filter((o) => o.kind === "numeric")
    .map((o) => ({
      topicKey: o.topicKey,
      tier: o.tier,
      correct: o.correct,
      misconceptionTag: o.misconceptionTag,
    }));
  return diagnosticToSeeds(numericOutcomes);
}

/**
 * Fold the BRAINTEASER outcomes into `competency::brainteaser-reasoning`
 * `ItemAttempt`s. Reuses P2's `brainteaserCredit` (competency scorer) so a clean
 * "got" is credit 1 and a miss is 0, and passes it through `applyItemAttempt`
 * exactly as `foldBrainteaserOutcome` does — the SAME Beta path that gates the
 * node (spec §3.2 / decision §10.3). The stage hands each of these to
 * `ProgressContext.recordItemAttempt`.
 */
export function untimedToCompetencyAttempts(
  outcomes: UntimedOutcome[],
): ItemAttempt[] {
  return outcomes
    .filter((o) => o.kind === "brainteaser")
    .map((o) => {
      const credit = brainteaserCredit({ got: o.correct, at: o.at });
      return {
        topicKey: COMPETENCY_BRAINTEASER,
        tier: "medium" as Difficulty,
        correct: credit >= 1,
        mode: "flashcard" as const,
        credit,
        at: o.at,
      } satisfies ItemAttempt;
    });
}

/**
 * Build the `DiagnosticResult` for the whole run (reuses the existing type). The
 * overall score is the fraction of ALL graded items answered correctly, and
 * `perTopic` is the per-node fraction correct (numeric nodes + the competency
 * node), so the progress view / audit can chart the run.
 */
export function untimedToResult(
  outcomes: UntimedOutcome[],
  at: string = new Date().toISOString(),
): DiagnosticResult {
  const total = outcomes.length;
  const correct = outcomes.filter((o) => o.correct).length;
  const perTopic: Record<string, number> = {};
  const byTopic = new Map<string, { c: number; n: number }>();
  for (const o of outcomes) {
    const cur = byTopic.get(o.topicKey) ?? { c: 0, n: 0 };
    cur.n += 1;
    if (o.correct) cur.c += 1;
    byTopic.set(o.topicKey, cur);
  }
  for (const [topicKey, { c, n }] of byTopic) {
    perTopic[topicKey] = n === 0 ? 0 : c / n;
  }
  return {
    at,
    overallScore: total === 0 ? 0 : correct / total,
    itemsAnswered: total,
    perTopic,
  };
}

/* -------------------------------------------------------------------------- */
/*  Pure progress reducer (write pipeline.untimed)                            */
/* -------------------------------------------------------------------------- */

/**
 * PURE reducer that writes the untimed-diagnostic result into
 * `progress.pipeline.untimed` and stamps `untimedDoneAt` (P3 bullet 4). It then
 * re-derives `pipeline.stage` from the stamps via {@link resolveStage} (so the
 * router advances to the timed diagnostic). Additive: never mutates its input,
 * never touches mastery / other lanes. The stage seeds mastery separately via the
 * ProgressContext; this only records the pipeline result + stamp.
 */
export function withUntimedResult(
  progress: UserProgress,
  result: DiagnosticResult,
): UserProgress {
  const prevPipeline = progress.pipeline ?? { stage: "diagnostic-untimed" as const };
  const withStamp: UserProgress = {
    ...progress,
    pipeline: {
      ...prevPipeline,
      untimed: result,
      untimedDoneAt: result.at,
    },
  };
  return {
    ...withStamp,
    pipeline: {
      ...withStamp.pipeline!,
      stage: resolveStage(withStamp),
    },
  };
}
