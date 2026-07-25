import type { Difficulty } from "@/types/content";
import type { TierDifficultyMap } from "@/types/mastery";
import type { Rng } from "@/lib/rng";
import { predictSuccess, seedTierDifficulty } from "@/lib/mastery/elo";
import { tierDifficultyKey } from "@/lib/mastery/topicKey";
import { LP_BETA, LP_ETA, P_TARGET, ZPDES_EPS, ZPDES_W } from "./config";

/**
 * ZPDES next-question policy (Clément, Roy, Oudeyer & Lopes 2015) — a heuristic
 * that beats learned RL at our scale (RESEARCH_ML_USAGE.md §1.8). The policy
 * SUGGESTS an order among ALREADY-UNLOCKED, non-mastered topics; it NEVER
 * overrides the prerequisite/unlock graph (COORDINATION §3.5 / PHASE_5 §3) — the
 * caller supplies `unlocked` from `locking.ts` and only unlocked topics are ever
 * returned. Due spaced reviews (SM-2) resurface an otherwise-mastered topic.
 *
 * Tier selection follows the 85% Rule band (Wilson et al. 2019): pick the tier
 * whose guessing-corrected `predictSuccess` is closest to P_TARGET (0.80).
 *
 * All functions are PURE and take a seeded `Rng` for exploration, so tests are
 * fully deterministic (COORDINATION §3.7).
 */

export interface TopicSnapshot {
  topicKey: string;
  /** From locking.ts (prereqs satisfied). Only unlocked topics are candidates. */
  unlocked: boolean;
  /** verdict.mastered (CI_low ≥ 0.80) — excluded UNLESS a review is due. */
  masteredTopic: boolean;
  mean: number;
  ciWidth: number;
  theta: number;
  /** ZPDES reward: recent success-rate minus older (see updateLearningProgress). */
  learningProgress: number;
  reviewDue: boolean;
}

/**
 * ZPDES priority (Clément 2015):
 *   priority = w1·max(P_TARGET − mean, 0)   // below-target gap
 *            + w2·ciWidth                    // uncertainty
 *            + w3·learningProgress           // ZPDES reward
 *            + w4·[reviewDue]                 // spaced review (SM-2)
 * with w1=1.0, w2=0.5, w3=0.5, w4=2.0.
 */
export function zpdesPriority(s: TopicSnapshot): number {
  const belowTargetGap = Math.max(P_TARGET - s.mean, 0);
  return (
    ZPDES_W.belowTarget * belowTargetGap +
    ZPDES_W.uncertainty * s.ciWidth +
    ZPDES_W.learningProgress * s.learningProgress +
    ZPDES_W.reviewDue * (s.reviewDue ? 1 : 0)
  );
}

/**
 * The candidate set: UNLOCKED topics that are either not-yet-mastered OR have a
 * due review (a due review overrides the mastered exclusion). The unlock graph
 * is never overridden — locked topics are never candidates.
 */
export function candidateSnapshots(
  snapshots: readonly TopicSnapshot[],
): TopicSnapshot[] {
  return snapshots.filter(
    (s) => s.unlocked && (!s.masteredTopic || s.reviewDue),
  );
}

/**
 * Sample the next topic ∝ priority among unlocked non-mastered (+ due reviews),
 * with an ε=0.15 exploration floor so no unlocked topic is starved. With
 * probability ε a uniformly-random candidate is chosen; otherwise selection is
 * proportional to `zpdesPriority` (clamped ≥ 0). Returns `undefined` only when
 * there are no unlocked candidates.
 */
export function nextTopic(
  snapshots: readonly TopicSnapshot[],
  rng: Rng,
): string | undefined {
  const candidates = candidateSnapshots(snapshots);
  if (candidates.length === 0) return undefined;
  if (candidates.length === 1) return candidates[0].topicKey;

  // ε exploration floor: occasional uniformly-random unlocked candidate.
  if (rng.next() < ZPDES_EPS) {
    return rng.pick(candidates).topicKey;
  }

  const weights = candidates.map((c) => Math.max(zpdesPriority(c), 0));
  const total = weights.reduce((a, b) => a + b, 0);
  // All-zero priorities (e.g. every candidate at/above target) ⇒ uniform.
  if (total <= 0) return rng.pick(candidates).topicKey;

  let r = rng.next() * total;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r < 0) return candidates[i].topicKey;
  }
  return candidates[candidates.length - 1].topicKey;
}

const DEFAULT_TIERS: readonly Difficulty[] = [
  "intro",
  "easy",
  "medium",
  "hard",
  "expert",
];

/**
 * Pick the tier whose `predictSuccess(θ, d[t,τ], kOptions)` is closest to
 * P_TARGET (0.80) — the 85% Rule optimal-difficulty band. With probability
 * `eps` (default ε=0.15) it jitters to an adjacent tier instead (a-stratification
 * analogue). Deterministic when `eps` is 0. `tierD` misses fall back to the
 * seeded tier difficulty (Phase 1's `seedTierDifficulty`).
 */
export function pickTier(
  theta: number,
  topicKey: string,
  tierD: TierDifficultyMap,
  rng: Rng,
  opts?: { tiers?: readonly Difficulty[]; kOptions?: number; eps?: number },
): Difficulty {
  const tiers = opts?.tiers ?? DEFAULT_TIERS;
  const eps = opts?.eps ?? ZPDES_EPS;

  let bestIdx = 0;
  let bestDist = Infinity;
  tiers.forEach((tier, i) => {
    const d = tierD[tierDifficultyKey(topicKey, tier)] ?? seedTierDifficulty(tier);
    const dist = Math.abs(predictSuccess(theta, d, opts?.kOptions) - P_TARGET);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  });

  if (eps > 0 && tiers.length > 1 && rng.next() < eps) {
    const neighbors: Difficulty[] = [];
    if (bestIdx > 0) neighbors.push(tiers[bestIdx - 1]);
    if (bestIdx < tiers.length - 1) neighbors.push(tiers[bestIdx + 1]);
    if (neighbors.length > 0) return rng.pick(neighbors);
  }
  return tiers[bestIdx];
}

/**
 * ZPDES learning-progress update wₐ ← β·wₐ + η·r, where r = recent success rate
 * minus older success rate (Clément 2015). Positive r ⇒ the learner is improving
 * on this topic (high learning progress ⇒ keep practicing here).
 */
export function updateLearningProgress(
  prev: number,
  recentRate: number,
  olderRate: number,
): number {
  return LP_BETA * prev + LP_ETA * (recentRate - olderRate);
}
