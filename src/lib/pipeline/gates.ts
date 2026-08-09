import type { UserProgress } from "@/types/progress";
import { MASTERY_BAR } from "@/lib/mastery/config";
import { deriveVerdict } from "@/lib/mastery/verdict";
import { meetsMasteryGate, roundScore } from "@/lib/score";
import { SKILL_GRAPH } from "@/lib/roadmap/skillGraph";
import { TRADING_SUBTOPIC_KEYS } from "@/lib/mastery/tradingSubtopics";

/**
 * PURE gate predicates for the guided pipeline (spec §1 / §3.6 / §10). No React,
 * no side effects — every function is a deterministic read over
 * `UserProgress` (mastery + pipeline results) that returns a pass/fail boolean.
 *
 * They REUSE the existing mastery primitives rather than re-implementing any
 * math:
 *  - content mastery per node: `deriveVerdict(...).mastered`, i.e. Beta
 *    `CI_low ≥ MASTERY_BAR (0.80)` (`src/lib/mastery/{verdict,config}.ts`).
 *  - timed / mock accuracy: `meetsMasteryGate(score, threshold)` with a 0.90
 *    threshold (`src/lib/score.ts`) — the SAME gate function, never a config
 *    change to the global 0.80 content bar.
 *
 * ── RELOCK / UN-GREENLIGHT (RESOLVED DECISION §10.5) ─────────────────────────
 * These predicates RE-EVALUATE from LIVE mastery/results on every call — they do
 * NOT trust the latched `drillingClearedAt` / `mockClearedAt` / `greenlitAt`
 * stamps. A node whose Beta posterior decays back below the 0.80 bar (relock /
 * climb-back) will make {@link allContentNodesMastered} return `false` again, so
 * {@link passesDrillingGate} flips back to `false` and the stage router
 * (`resolveStage`) pulls the user back into drilling — i.e. readiness can be
 * REVOKED. The `*ClearedAt` stamps are audit-only ("when did this first pass"),
 * never the gate itself.
 */

/** Timed multi-topic sections + mocks gate at ≥ 90% (spec §3.6). */
export const TIMED_GATE = 0.9;
/** Mock accuracy bar as a PERCENT (spec §3.6 / §10.4). */
export const MOCK_GATE_PCT = 90;
/** Number of CONSECUTIVE mocks that must clear the bar (RESOLVED DECISION §10.4). */
export const MOCK_CONSECUTIVE = 3;

/**
 * Proposed topicKeys for the two NEW competency nodes (spec §3.2). These are
 * ADDED to `SKILL_GRAPH` + a competency scorer in Phase P2 — they do NOT exist
 * as graph nodes yet. The predicates below already read the (currently-absent)
 * `TopicMastery` bucket by this key, so today a user with no competency evidence
 * correctly does NOT pass, and once P2 folds self-eval / MM P&L into these
 * buckets the SAME predicate re-evaluates from live mastery with no change here.
 */
export const COMPETENCY_BRAINTEASER = "competency::brainteaser-reasoning";
export const COMPETENCY_TRADING = "competency::trading-intuition";

/**
 * The SCORED content KST nodes whose mastery counts toward the Stage-6 content
 * gate (spec §3.1): every `SKILL_GRAPH` node EXCEPT
 *  - the 6 `external` timed-drill / game stubs,
 *  - the 2 brainteaser flashcard-only nodes (`trackId === "brainteasers"`), and
 *  - the `scored: false` course-completeness topics (MGF, Gamma, Joint
 *    Distributions, Limit Theorems, CTMC) — purely academic distribution/
 *    process-theory with no attested quant OA/interview footprint
 *    (`datasets/UT_COURSE_GAP_ANALYSIS.md` §4). Excluding them here is what keeps
 *    the pipeline COHERENT after they were dropped from the untimed diagnostic:
 *    an un-diagnosed node can no longer gate drilling / greenlight, because it is
 *    no longer part of this scored set (nor drilled, nor a diagnosis-plan node).
 *
 * The result is the 21 quant-relevant scored nodes. The two competency nodes are
 * gated SEPARATELY (see below), not here.
 */
export function scoredContentTopicKeys(): string[] {
  return SKILL_GRAPH.filter(
    (n) => !n.external && n.trackId !== "brainteasers" && n.scored !== false,
  ).map((n) => n.topicKey);
}

/**
 * Content mastery for a single node: `deriveVerdict(...).mastered`, i.e. the
 * Beta credible-interval lower bound clears the 0.80 bar. Reads the LIVE
 * `topicMastery` bucket (absent ⇒ n=0 ⇒ not mastered).
 */
export function nodeContentMastered(
  progress: UserProgress,
  topicKey: string,
): boolean {
  return deriveVerdict(progress.topicMastery?.[topicKey], topicKey).mastered;
}

/** Stage-6 content gate: EVERY scored KST node is mastered at the 0.80 bar. */
export function allContentNodesMastered(progress: UserProgress): boolean {
  return scoredContentTopicKeys().every((key) =>
    nodeContentMastered(progress, key),
  );
}

/**
 * The credit-weighted / accuracy gate for ONE timed section: `correct / total`
 * clears the 0.90 bar via the SAME `meetsMasteryGate` used for content, just
 * with a higher threshold (spec §3.6 — never a global config change).
 */
export function timedSectionMeetsGate(section: {
  correct: number;
  total: number;
}): boolean {
  return meetsMasteryGate(roundScore(section.correct, section.total), TIMED_GATE);
}

/**
 * Stage-6 timed gate: there is timed evidence AND every recorded timed section
 * clears 0.90. No sections recorded ⇒ NOT cleared (a user cannot pass the timed
 * overlay without having taken any timed section).
 */
export function allTimedSectionsClear(progress: UserProgress): boolean {
  const sections = progress.pipeline?.timed?.sections ?? [];
  if (sections.length === 0) return false;
  return sections.every(timedSectionMeetsGate);
}

/**
 * Competency-node mastery (spec §3.2 / §3.6): the node's Beta `CI_low ≥ 0.80`.
 * TODO(P2): the competency nodes are not in `SKILL_GRAPH` and have no scorer
 * yet, so this reads an absent bucket (⇒ not mastered) until P2 lands. It then
 * re-evaluates from live mastery with no change here.
 */
export function competencyMastered(
  progress: UserProgress,
  topicKey: string,
): boolean {
  return deriveVerdict(progress.topicMastery?.[topicKey], topicKey).mastered;
}

/** Brainteaser-reasoning competency gate (spec §3.2). TODO(P2): scorer pending. */
export function brainteaserReasoningMastered(progress: UserProgress): boolean {
  return competencyMastered(progress, COMPETENCY_BRAINTEASER);
}

/**
 * The eleven trading-intuition SUBTOPIC node keys (one per Game-OA battery game).
 * Single source of truth in `@/lib/mastery/tradingSubtopics`; re-exported here so
 * gate/diagnosis/drilling code and their tests share one list.
 */
export { TRADING_SUBTOPIC_KEYS };

/** A single trading subtopic's Beta gate (`CI_low ≥ 0.80`, like any node). */
export function tradingSubtopicMastered(
  progress: UserProgress,
  subtopicKey: string,
): boolean {
  return competencyMastered(progress, subtopicKey);
}

/**
 * Trading-intuition competency gate (spec §3.2 / §10.8) as an AGGREGATE ROLL-UP:
 * the aggregate holds ⇔ EVERY per-game trading SUBTOPIC clears its 0.80 Beta bar.
 * Decomposing the old single-bucket gate this way is what makes a weak SPECIFIC
 * subtopic (e.g. arbitrage/de-vig) keep the Stage-6 drilling gate open and route
 * the learner back to that exact game (see `diagnosis.ts` / `drilling.ts`).
 * Re-evaluated from LIVE mastery every call, so a relocked subtopic un-clears it.
 */
export function tradingIntuitionMastered(progress: UserProgress): boolean {
  return TRADING_SUBTOPIC_KEYS.every((key) =>
    tradingSubtopicMastered(progress, key),
  );
}

/**
 * THE Stage-6 aggregate gate (spec §3.6): pass ⇔ ALL of
 *  - every scored KST node mastered (0.80), AND
 *  - all timed sections ≥ 0.90, AND
 *  - the brainteaser-reasoning competency mastered, AND
 *  - the trading-intuition competency mastered.
 *
 * Re-evaluated from LIVE mastery every call (see the relock note above), so a
 * relocked node un-clears drilling and can un-greenlight a user.
 */
export function passesDrillingGate(progress: UserProgress): boolean {
  return (
    allContentNodesMastered(progress) &&
    allTimedSectionsClear(progress) &&
    brainteaserReasoningMastered(progress) &&
    tradingIntuitionMastered(progress)
  );
}

/**
 * Stage-7 mock gate (spec §3.6 / RESOLVED DECISION §10.4): ≥ 90% on 3
 * CONSECUTIVE mocks, each also `wouldPass !== "no"` AND with SOUND REASONING
 * (`reasoningOk !== false`). Reads the MOST RECENT `MOCK_CONSECUTIVE` entries of
 * the append-only `pipeline.mocks` log — a single sub-90%, `"no"`, or
 * poor-reasoning mock breaks the streak, so this re-evaluates from live results.
 *
 * REASONING-QUALITY gate: a mock that clears the SCORE bar with poor reasoning
 * (right answers, vague/flawed/ambiguous justification → `reasoningOk === false`)
 * does NOT count — greenlight requires reasoning quality, not just correct
 * numbers. `reasoningOk` is optional for back-compat; an ABSENT value (historical
 * logs) is treated as OK so only an explicit `false` blocks.
 */
export function passesMockGate(progress: UserProgress): boolean {
  const mocks = progress.pipeline?.mocks ?? [];
  if (mocks.length < MOCK_CONSECUTIVE) return false;
  const recent = mocks.slice(-MOCK_CONSECUTIVE);
  return recent.every(
    (m) =>
      m.scorePct >= MOCK_GATE_PCT &&
      m.wouldPass !== "no" &&
      m.reasoningOk !== false,
  );
}

/** Re-export the content bar for callers/tests that want the numeric threshold. */
export const CONTENT_MASTERY_BAR = MASTERY_BAR;
