import type { Difficulty } from "@/types/content";
import { DIFFICULTY_META } from "@/types/content";

/**
 * Lightly-multistage tier rule for the cold-start diagnostic (PHASE_3 §5).
 *
 * Research anchor: adaptive/multistage testing places the next item near the
 * learner's current estimate, so a correct answer bumps difficulty UP and a
 * miss bumps it DOWN by a single tier (Wilson et al. 2019 optimal-difficulty
 * band; classic CAT item-selection). We keep it deliberately coarse — one ±1
 * step, clamped to the ladder — because ~2 items/topic is a floor, not a
 * precise ability estimate.
 */

/** The Difficulty ladder in ascending `DIFFICULTY_META.order`. */
const TIER_LADDER: Difficulty[] = (Object.keys(DIFFICULTY_META) as Difficulty[]).sort(
  (a, b) => DIFFICULTY_META[a].order - DIFFICULTY_META[b].order,
);

/**
 * Next tier after an outcome: bump up one tier on a correct answer, down one on
 * a miss, clamped to `intro…expert`.
 */
export function nextTier(current: Difficulty, correct: boolean): Difficulty {
  const i = DIFFICULTY_META[current].order;
  const target = correct ? i + 1 : i - 1;
  const clamped = Math.max(0, Math.min(TIER_LADDER.length - 1, target));
  return TIER_LADDER[clamped];
}
