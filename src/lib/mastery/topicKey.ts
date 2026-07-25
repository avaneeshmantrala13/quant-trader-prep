import type { Difficulty } from "@/types/content";

/**
 * Stable topic identity + key helpers (COORDINATION §2.4).
 *
 * A topic = track + section. Many levels are section-less (Mental Math,
 * Interview Games, Core Probability): those collapse to a single per-track
 * topic `${trackId}::_core` (COORDINATION §6.4). This keeps mastery buckets
 * coarse-but-meaningful without requiring every level to declare a section.
 */

/** `${trackId}::${section ?? "_core"}` — the canonical topic key. */
export function topicKeyOf(trackId: string, section?: string): string {
  return `${trackId}::${section ?? "_core"}`;
}

/** Topic key for a specific level (uses its optional `section`). */
export function topicKeyForLevel(
  trackId: string,
  level: { id: string; section?: string },
): string {
  return topicKeyOf(trackId, level.section);
}

/**
 * Namespaced misconception key `${topicKey}::${tag}`. `tag` is an authored
 * `Question.misconceptions[i]` / `commonErrors[].misconception` when present,
 * else the deterministic fallback `idx:<i>` (quiz) / `err:<value>` (numeric).
 */
export function misconceptionKey(topicKey: string, tag: string): string {
  return `${topicKey}::${tag}`;
}

/** Companion key for the per-(topic,tier) Elo difficulty value in TierDifficultyMap. */
export function tierDifficultyKey(topicKey: string, tier: Difficulty): string {
  return `${topicKey}#${tier}`;
}

/**
 * Companion key for the per-(topic,tier) EXPOSURE COUNT stored alongside the
 * difficulty in the same TierDifficultyMap (COORDINATION §2.1 note / PHASE_1
 * §5: "maintain the count inside tierDifficulty companion"). Distinct from
 * {@link tierDifficultyKey} so downstream direct lookups of the difficulty
 * never collide. Only used to decide the d-freeze at TIER_FREEZE_N.
 */
export function tierExposureKey(topicKey: string, tier: Difficulty): string {
  return `${topicKey}#${tier}#n`;
}
