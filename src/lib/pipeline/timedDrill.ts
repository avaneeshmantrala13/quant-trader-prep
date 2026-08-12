import type { PipelineState, TimedSectionResult } from "@/types/progress";
import { skillByKey } from "@/lib/roadmap/skillGraph";

/**
 * ============================================================================
 *  STAGE 6 — TIMED DRILL (progress-model helpers)  (guided pipeline, Phase P6)
 * ============================================================================
 *
 * PURE + deterministic helpers that make a SHOT-CLOCKED, per-topic timed retake
 * in the drilling loop actually able to CLEAR the Stage-6 timed gate
 * (`allTimedSectionsClear`: every recorded `pipeline.timed.sections` entry ≥
 * 0.90). They never touch React and never mutate their inputs.
 *
 * WHY THIS EXISTS (the "good untimed / bad timed" stall). The timed diagnostic
 * (Stage 3) writes ONE `TimedSectionResult` per topic into
 * `progress.pipeline.timed.sections`; a failed run leaves failing per-topic
 * sections on record. Drilling used to re-serve a timed-weak topic through the
 * UNTIMED numeric hint-ladder, which folds CONTENT mastery but never rewrites
 * `pipeline.timed.sections` — so `allTimedSectionsClear` could never flip and a
 * content-strong / timed-weak learner was stuck in drilling forever. The timed
 * drill closes that loop: it re-runs the weak topic UNDER A CLOCK and
 * SUPERSEDES that topic's failing section with the retake's result via
 * {@link mergeTimedSection}, so a genuinely passing retake clears the 0.90 bar.
 * The "no timed evidence ⇒ not cleared" semantics are preserved: an empty
 * `sections` list still does not pass.
 */

/** Items served per timed-drill section (matches the content round size). */
export const TIMED_DRILL_ROUND_SIZE = 5;

/**
 * Per-question shot-clock budget (ms) for a timed drill. Tight enough to be a
 * genuine SPEED test of an already-content-mastered topic, generous enough that
 * a fluent solver clears it. A timeout auto-advances and counts as a miss (the
 * same "speed of correct thinking" contract as the timed diagnostic).
 */
export const TIMED_DRILL_BUDGET_MS = 45_000;

/**
 * True iff `section` is a SINGLE-TOPIC section attributed to `topicKey` — i.e.
 * exactly the shape the timed diagnostic / a timed retake writes for one topic
 * (`topicKeys === [topicKey]`). A multi-topic section (spanning several topics)
 * is deliberately NOT matched: superseding it on one topic's retake would drop
 * the evidence it carries for the others.
 */
export function sectionIsSingleTopicFor(
  section: TimedSectionResult,
  topicKey: string,
): boolean {
  return section.topicKeys?.length === 1 && section.topicKeys[0] === topicKey;
}

/**
 * Build the per-topic {@link TimedSectionResult} for one finished timed drill:
 * `correct/total` under the clock, tagged to `topicKey` (so the metric-b
 * per-topic tally and {@link mergeTimedSection} attribute it precisely).
 */
export function buildTimedDrillSection(
  topicKey: string,
  correct: number,
  total: number,
  at: string = new Date().toISOString(),
): TimedSectionResult {
  return {
    label: skillByKey(topicKey)?.label ?? topicKey,
    correct,
    total,
    topicKeys: [topicKey],
    at,
  };
}

/**
 * Merge a fresh timed-drill `section` into the `pipeline.timed` payload,
 * SUPERSEDING any prior single-topic section for the SAME topicKey (so a passing
 * retake REPLACES the diagnostic's failing per-topic section rather than piling
 * a second entry the 0.90 gate would still trip over) and recomputing the
 * overall {correct,total}. Pure: returns a new payload; never mutates input.
 * Absent prior `timed` ⇒ a fresh payload with just this section.
 */
export function mergeTimedSection(
  timed: PipelineState["timed"] | undefined,
  section: TimedSectionResult,
): NonNullable<PipelineState["timed"]> {
  const targetKey = section.topicKeys?.[0];
  const prior = timed?.sections ?? [];
  const kept =
    targetKey != null
      ? prior.filter((s) => !sectionIsSingleTopicFor(s, targetKey))
      : prior;
  const sections = [...kept, section];
  const correct = Number(
    sections.reduce((sum, s) => sum + s.correct, 0).toFixed(4),
  );
  const total = sections.reduce((sum, s) => sum + s.total, 0);
  return { correct, total, sections };
}
