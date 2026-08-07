import {
  MISCONCEPTION_EDGE,
  PREREQ_DAG,
  prereqNode,
} from "@/content/remediation/prereqDAG";
import { skillByKey } from "@/lib/roadmap/skillGraph";
import { topicDisplayName } from "@/lib/dashboard/misconceptionLabels";

/**
 * FAILED-TOPIC → "Suggested to strengthen first" prerequisite recommendation
 * (ZPD, NON-forcing).
 *
 * When a learner FAILS a topic (finishes below the mastery gate), this picks the
 * KST prerequisites — from the failed topic's transitive prerequisite closure —
 * that are MOST RELEVANT to it AND currently sit at a STRONG-BUT-NOT-PERFECT
 * mastery (~0.85). Those are the foundations most worth a quick reinforcement:
 * solid enough that a short refresh will re-cement them, but not so mastered that
 * revisiting them is wasted effort, and not so weak that they belong on the
 * automatic descend/floor-teach path instead.
 *
 * This is a SUGGESTION surface only — it never forces, gates, or launches
 * anything. It complements (does not replace) the in-round / finish-time descent
 * cascade (`remediationStep` / `chooseDescentEdge` / `planFinishRemediation`): the
 * descent still auto-probes the ~0.85 prerequisite mid-flow, while THIS list is
 * the calm, browse-able "here's what to shore up first" shown on the finish
 * screen and mirrored on the dashboard.
 *
 * Selection (pure; deterministic given the same mastery snapshot):
 *   1. Compute the prerequisite CLOSURE of the failed topic over the KST
 *      (`PREREQ_DAG`), recording each prereq's minimum edge DEPTH (relevance).
 *   2. Keep only prereqs with GRADED evidence whose posterior mean is inside the
 *      strengthen band {@link STRENGTHEN_MIN}..{@link STRENGTHEN_MAX} (≈0.85).
 *   3. Rank: the misconception-implicated prereq first (the `MISCONCEPTION_EDGE`
 *      target when it is in the band), then by DEPTH ascending (closest = most
 *      relevant), then by MEAN ascending (the learner's weakest relevant prereq),
 *      then topicKey for stability.
 *
 * Research: Doignon & Falmagne (precedence closure / outer fringe); Wilson et al.
 * 2019 (the ~85% optimal-difficulty band); Bloom 1984 (reinforce the specific
 * upstream prerequisite).
 */

/** Centre of the "strong but not perfect" reinforcement band (Wilson 85% Rule). */
export const STRENGTHEN_TARGET = 0.85;
/** A prereq below this mean is too weak — it belongs on the descend/floor path. */
export const STRENGTHEN_MIN = 0.7;
/** A prereq at/above this mean is effectively mastered — no reinforcement needed. */
export const STRENGTHEN_MAX = 0.98;
/** Default number of suggestions surfaced. */
export const MAX_SUGGESTIONS = 3;

/** A mastery snapshot for one prerequisite (mean posterior + graded count). */
export interface PrereqMasterySnapshot {
  mean: number;
  n: number;
}

/** One "strengthen first" suggestion, ready for the finish/dashboard surface. */
export interface PrereqSuggestion {
  topicKey: string;
  /** Learner-facing topic name (never a raw key). */
  label: string;
  /** Current posterior mean in the band (≈0.85). */
  mean: number;
  /** Minimum KST edge distance from the failed topic (1 = direct prerequisite). */
  depth: number;
  /** True when this prereq is the one the tripping misconception implicated. */
  misconceptionLinked: boolean;
  /** Deep-link target (the prereq's first level), when the topic is playable. */
  trackId?: string;
  firstLevelId?: string;
}

export interface SuggestPrereqsInput {
  /** The just-failed origin topicKey. */
  failedTopicKey: string;
  /** Mastery lookup for any topicKey (undefined ⇒ no graded evidence yet). */
  masteryOf: (topicKey: string) => PrereqMasterySnapshot | undefined;
  /** The tripping misconception TAG (already stripped of the topicKey prefix). */
  misconceptionTag?: string;
  /** Max suggestions (default {@link MAX_SUGGESTIONS}). */
  max?: number;
}

/**
 * The transitive prerequisite CLOSURE of `topicKey` over {@link PREREQ_DAG},
 * mapping each reachable prerequisite to its MINIMUM edge depth from the origin
 * (a direct prereq is depth 1). The origin itself is excluded. Safe on cycles
 * (there are none — asserted by the DAG tests) via a visited set.
 */
export function prereqClosure(topicKey: string): Map<string, number> {
  const depthOf = new Map<string, number>();
  const start = PREREQ_DAG[topicKey];
  if (!start) return depthOf;
  // BFS so the first time we reach a node is via a shortest path (min depth).
  let frontier: string[] = [...start.prereqs];
  let depth = 1;
  while (frontier.length > 0) {
    const nextFrontier: string[] = [];
    for (const key of frontier) {
      if (depthOf.has(key) || key === topicKey) continue;
      depthOf.set(key, depth);
      const node = PREREQ_DAG[key];
      if (node) nextFrontier.push(...node.prereqs);
    }
    frontier = nextFrontier;
    depth += 1;
  }
  return depthOf;
}

/**
 * Rank the failed topic's prerequisites into a non-forcing "strengthen first"
 * list (see module doc). Pure + deterministic.
 */
export function suggestPrereqsToStrengthen(
  input: SuggestPrereqsInput,
): PrereqSuggestion[] {
  const { failedTopicKey, masteryOf, misconceptionTag } = input;
  const max = input.max ?? MAX_SUGGESTIONS;

  const closure = prereqClosure(failedTopicKey);
  if (closure.size === 0) return [];

  // The misconception-implicated prereq, but ONLY when it is actually in this
  // topic's closure (a mapping shared across topics harmlessly falls through).
  const implicated =
    misconceptionTag && MISCONCEPTION_EDGE[misconceptionTag]
      ? MISCONCEPTION_EDGE[misconceptionTag]
      : undefined;

  const candidates: PrereqSuggestion[] = [];
  for (const [topicKey, depth] of closure) {
    const m = masteryOf(topicKey);
    // Needs graded evidence AND a mean in the strong-but-not-perfect band.
    if (!m || m.n <= 0) continue;
    if (m.mean < STRENGTHEN_MIN || m.mean > STRENGTHEN_MAX) continue;
    const skill = skillByKey(topicKey);
    const node = prereqNode(topicKey);
    candidates.push({
      topicKey,
      label: topicDisplayName(topicKey, skill?.label ?? node?.label ?? topicKey),
      mean: m.mean,
      depth,
      misconceptionLinked: topicKey === implicated,
      // Deep-link only to a REAL registered first level (skip external stubs).
      trackId: skill && !skill.external ? skill.trackId : undefined,
      firstLevelId: skill && !skill.external ? skill.firstLevelId : undefined,
    });
  }

  candidates.sort((a, b) => {
    // 1) misconception-implicated prereq first.
    if (a.misconceptionLinked !== b.misconceptionLinked) {
      return a.misconceptionLinked ? -1 : 1;
    }
    // 2) closer (more relevant) prereqs first.
    if (a.depth !== b.depth) return a.depth - b.depth;
    // 3) the learner's weakest relevant prereq first.
    if (Math.abs(a.mean - b.mean) > 1e-12) return a.mean - b.mean;
    // 4) stable tie-break.
    return a.topicKey.localeCompare(b.topicKey);
  });

  return candidates.slice(0, max);
}
