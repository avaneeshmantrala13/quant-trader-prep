import { MASTERY_BAR } from "@/lib/mastery/config";
import { UNLOCK_MEAN_BAR } from "@/lib/mastery/unlock";
import { SKILL_GRAPH, type SkillNode } from "./skillGraph";

/**
 * READINESS — the pure derivation of the roadmap's state from a learner's
 * mastery + level-completion evidence (no React, no storage; unit-tested).
 *
 * Per-skill % and overall readiness are documented in
 * `datasets/CURRICULUM_ROADMAP.md §5`. In short, each skill blends two signals
 * already in `progress`:
 *  - GRADED CONFIDENCE = the Beta 95%-CI lower bound `ciLow` (the dashboard's
 *    "confidently mastered" signal; mastered ⇔ `ciLow ≥ MASTERY_BAR`). It rewards
 *    accuracy AND evidence volume, so it cannot be gamed by a couple of lucky hits.
 *  - LEVEL COMPLETION = fraction of the topic's levels marked `mastered` — the
 *    fallback for flashcard/integrity topics (Brainteasers) that never emit
 *    graded Elo/Beta items.
 *
 * `masteryPct = round(100 · clamp01(max(ciLow, completion) / MASTERY_BAR))` — the
 * distance to the mastery bar, hitting 100% exactly when a skill is mastered.
 */

/** Per-skill evidence gathered by the React layer (pure input to this module). */
export interface SkillEvidence {
  topicKey: string;
  /** Beta 95%-CI lower bound in [0,1] (from `TopicVerdict.lo`). */
  ciLow: number;
  /** Beta posterior MEAN in [0,1] (raw accuracy point estimate). */
  mean: number;
  /** Number of graded items in this topic. */
  gradedCount: number;
  /** Elo skill θ on the logit scale. */
  theta: number;
  /** How many of the topic's levels are mastered (unlock-gate `mastered`). */
  levelsMastered: number;
  /** Total levels in the topic. */
  levelsTotal: number;
}

export type SkillStatus =
  | "mastered"
  | "in-progress"
  | "available"
  | "locked";

/** A skill's fully-derived roadmap progress (display-ready). */
export interface SkillProgress {
  topicKey: string;
  status: SkillStatus;
  /** Headline "percent mastered" in 0..100 (distance to the mastery bar). */
  masteryPct: number;
  /** True once the skill counts as mastered (ciLow ≥ bar OR all levels mastered). */
  mastered: boolean;
  /**
   * Diagnostic-style LOW-CONFIDENCE unlock: graded point-estimate (Beta mean) is
   * at/above the more-forgiving `UNLOCK_MEAN_BAR`, so the topic is unlocked even
   * before it is confidently mastered. Additive signal (Part B) — it never gates
   * prereqs or changes `status`; it flips false the moment a failing quiz swings
   * the mean back under the bar (the "swing-and-relock" behavior).
   */
  unlocked: boolean;
  /** Any graded/level evidence exists. */
  hasEvidence: boolean;
  /** Prerequisites all mastered. */
  prereqsMet: boolean;
  /** Raw accuracy point estimate in 0..100 (Beta mean), or undefined if none. */
  meanPct?: number;
  ciLowPct: number;
  gradedCount: number;
  theta: number;
  levelsMastered: number;
  levelsTotal: number;
  /** Prereq skills not yet mastered (topicKeys) — why a skill is locked. */
  missingPrereqs: string[];
}

export interface RoadmapState {
  /** Every skill in curriculum order, fully derived. */
  skills: SkillProgress[];
  /** 0..100 weighted readiness across the whole graph. */
  overallReadiness: number;
  masteredCount: number;
  totalCount: number;
  remainingCount: number;
  /** Where you are now: first not-mastered, prereqs-met skill in order. */
  currentSkillKey?: string;
  /** True once every skill is mastered. */
  complete: boolean;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/**
 * Interview readiness is deliberately CONSERVATIVE: merely starting or getting
 * a low-confidence diagnostic unlock on a topic should barely move the overall
 * number — it climbs meaningfully only as topics are actually mastered. We apply
 * this convex discount to each skill's partial fraction when aggregating overall
 * readiness. A confidently-mastered skill has fraction 1 (1^k = 1, full credit),
 * so full mastery still reads 100%; a fresh post-diagnostic learner (lots of
 * small partial signals, nothing mastered) reads only a few percent.
 */
const READINESS_DISCOUNT_EXP = 3.5;

/** Fraction toward the mastery bar in [0,1] for one skill's evidence. */
export function skillReadinessFraction(e: SkillEvidence): number {
  const completion = e.levelsTotal > 0 ? e.levelsMastered / e.levelsTotal : 0;
  const signal = Math.max(e.ciLow, completion);
  return clamp01(signal / MASTERY_BAR);
}

/**
 * The conservative contribution of one skill's readiness to the OVERALL number.
 * Full mastery (fraction 1) contributes fully; partial progress is heavily
 * discounted so readiness stays honest until skills are truly locked in.
 */
export function skillReadinessContribution(e: SkillEvidence): number {
  return Math.pow(skillReadinessFraction(e), READINESS_DISCOUNT_EXP);
}

/** True when a skill is mastered: confidently graded OR all its levels mastered. */
export function isSkillMastered(e: SkillEvidence): boolean {
  const allLevels = e.levelsTotal > 0 && e.levelsMastered >= e.levelsTotal;
  return e.ciLow >= MASTERY_BAR || allLevels;
}

/**
 * True when a skill is UNLOCKED at (at least) low confidence: it has graded
 * evidence and its Beta mean clears the forgiving {@link UNLOCK_MEAN_BAR}. A
 * strong diagnostic seeds this without conferring confident mastery; a failing
 * quiz swings the mean back under the bar and this returns false (re-locked).
 * Separate from {@link isSkillMastered} so earned-mastery gating is unchanged.
 */
export function isSkillUnlocked(e: SkillEvidence): boolean {
  return e.gradedCount > 0 && e.mean >= UNLOCK_MEAN_BAR;
}

/**
 * Derive the whole roadmap state from a lookup of per-skill evidence. Skills
 * absent from `evidenceByKey` are treated as zero-evidence (fresh learner).
 * Pure and deterministic — same evidence ⇒ same state.
 */
export function computeRoadmap(
  evidenceByKey: (topicKey: string) => SkillEvidence,
  graph: SkillNode[] = SKILL_GRAPH,
): RoadmapState {
  // First pass: mastered flag per skill (needed for prereq resolution).
  const evidence = new Map<string, SkillEvidence>();
  const mastered = new Map<string, boolean>();
  for (const node of graph) {
    const e = evidenceByKey(node.topicKey);
    evidence.set(node.topicKey, e);
    mastered.set(node.topicKey, isSkillMastered(e));
  }

  const skills: SkillProgress[] = graph.map((node) => {
    const e = evidence.get(node.topicKey)!;
    const isMastered = mastered.get(node.topicKey)!;
    const missingPrereqs = node.prereqs.filter((p) => !mastered.get(p));
    const prereqsMet = missingPrereqs.length === 0;
    const hasEvidence = e.gradedCount > 0 || e.levelsMastered > 0;

    let status: SkillStatus;
    if (isMastered) status = "mastered";
    else if (hasEvidence) status = "in-progress";
    else if (prereqsMet) status = "available";
    else status = "locked";

    return {
      topicKey: node.topicKey,
      status,
      masteryPct: Math.round(100 * skillReadinessFraction(e)),
      mastered: isMastered,
      unlocked: isSkillUnlocked(e),
      hasEvidence,
      prereqsMet,
      meanPct: e.gradedCount > 0 ? Math.round(100 * e.mean) : undefined,
      ciLowPct: Math.round(100 * e.ciLow),
      gradedCount: e.gradedCount,
      theta: e.theta,
      levelsMastered: e.levelsMastered,
      levelsTotal: e.levelsTotal,
      missingPrereqs,
    };
  });

  // Weighted overall readiness across the whole graph.
  let weightSum = 0;
  let accum = 0;
  for (const node of graph) {
    weightSum += node.weight;
    accum += node.weight * skillReadinessContribution(evidence.get(node.topicKey)!);
  }
  const overallReadiness = weightSum > 0 ? Math.round(100 * (accum / weightSum)) : 0;

  const masteredCount = skills.filter((s) => s.mastered).length;
  const totalCount = skills.length;

  // "Where you are": first not-mastered, prereqs-met skill in pathway order.
  const current = skills.find((s) => !s.mastered && s.prereqsMet);

  return {
    skills,
    overallReadiness,
    masteredCount,
    totalCount,
    remainingCount: totalCount - masteredCount,
    currentSkillKey: current?.topicKey,
    complete: masteredCount === totalCount && totalCount > 0,
  };
}
