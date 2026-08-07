import type { TopicMastery } from "@/types/mastery";
import { SKILL_GRAPH, type SkillNode } from "@/lib/roadmap/skillGraph";
import { topicKeyForLevel } from "./topicKey";
import { isTopicUnlocked } from "./unlock";

/**
 * KST + LOW-CONFIDENCE-UNLOCK graph helpers (Part B) — the bridge that turns the
 * diagnostic's Beta-prior "unlock signal" into a concrete set of levels the
 * per-section gate (`@/lib/locking`) can open.
 *
 * Two pure pieces:
 *  1. {@link prereqClosure} — the transitive KST prerequisites of a topic, from
 *     `skillGraph.ts`. When a learner does WELL on a topic in the diagnostic we
 *     unlock the topic AND everything it rests on, so the path leading to it is
 *     coherent (you can't be "unlocked" on Conditional Probability while its
 *     Core Probability / Combinatorics prereqs stay locked).
 *  2. {@link seedUnlockedLevelIds} — the level ids whose TOPIC is currently
 *     low-confidence unlocked, given a live mastery lookup. This is exactly the
 *     `SeedUnlocked` predicate `locking.ts` consumes; because it reads the LIVE
 *     Beta posterior, a topic that later swings back under the unlock bar simply
 *     drops out of the set and its non-first levels RE-LOCK automatically.
 */

const NODE_BY_KEY = new Map<string, SkillNode>(
  SKILL_GRAPH.map((n) => [n.topicKey, n]),
);

/**
 * The transitive set of KST prerequisite topicKeys for `topicKey` (NOT including
 * `topicKey` itself), walked over `skillGraph.ts`. Cycle-safe. Optionally scoped
 * by `inScope` so only prereqs "within that path" (e.g. the selected course's
 * topic set) are returned; out-of-scope prereqs are pruned along with their
 * upstream (we never leave the path to reach a further-upstream in-scope node).
 */
export function prereqClosure(
  topicKey: string,
  inScope?: (key: string) => boolean,
): Set<string> {
  const out = new Set<string>();
  const stack = [...(NODE_BY_KEY.get(topicKey)?.prereqs ?? [])];
  while (stack.length > 0) {
    const key = stack.pop()!;
    if (out.has(key)) continue;
    if (inScope && !inScope(key)) continue;
    out.add(key);
    for (const p of NODE_BY_KEY.get(key)?.prereqs ?? []) stack.push(p);
  }
  return out;
}

/**
 * Given a track's ordered levels and a LIVE mastery lookup, return the set of
 * level ids whose topic is currently low-confidence unlocked ({@link isTopicUnlocked}).
 * Feed the result into `locking.ts` as `(id) => set.has(id)`.
 */
export function seedUnlockedLevelIds(
  levels: readonly { id: string; section?: string }[],
  trackId: string,
  masteryOf: (topicKey: string) => TopicMastery | undefined,
): Set<string> {
  const out = new Set<string>();
  for (const level of levels) {
    const key = topicKeyForLevel(trackId, level);
    if (isTopicUnlocked(masteryOf(key))) out.add(level.id);
  }
  return out;
}
