import type { Level } from "@/types/content";
import { totalQuestions } from "@/types/content";
import type { UserProgress } from "@/types/progress";
import { topicKeyOf } from "./topicKey";
import { applyDiagnosticSeed } from "./mastery";
import { mgfLevels } from "@/content/probabilityStats/mgf/levels";
import { gammaLevels } from "@/content/probabilityStats/gammaDistribution/levels";
import { jointDistributionsLevels } from "@/content/probabilityStats/jointDistributions/levels";
import { branchingLevels } from "@/content/probabilityStats/branchingProcesses/levels";
import { ctmcLevels } from "@/content/probabilityStats/continuousTimeMarkov/levels";
import { limitTheoremsLevels } from "@/content/probabilityStats/limitTheorems/levels";
import { markovStructureLevels } from "@/content/probabilityStats/markovStructure/levels";

/**
 * ERK-split progress migration (Part 3 of the ERK super-node refactor).
 *
 * The seven course-completeness topics (MGF, Gamma, Joint Distributions, Limit
 * Theorems, Branching, CTMC, Markov Chain Structure) used to share ONE mastery
 * bucket, `probability::Extra Relevant Knowledge`. They are now seven
 * first-class topicKeys.
 *
 * WHAT AUTOMATICALLY RE-BUCKETS. `levelProgress` (the per-level unlock gate +
 * the best-score shown on the map) is keyed by `levelId`, NOT by topicKey, so it
 * is COMPLETELY UNAFFECTED by the section rename — every ek-* level keeps its own
 * progress and its `mastered` unlock state. Likewise, any NEW graded attempt now
 * folds into the correct new topicKey via `recordItemAttempt`. So the split is
 * transparent for progression.
 *
 * WHAT NEEDS MIGRATING. `topicMastery` is an AGGREGATE (Elo θ + Beta(α,β) +
 * misconception flags) keyed by topicKey and folded incrementally — it is NOT
 * re-derived from level attempts. Any pre-split learner therefore has a stale,
 * BLENDED aggregate under `probability::Extra Relevant Knowledge` that no
 * displayed topic reads anymore.
 *
 * LEAST-LOSSY CHOICE. Rather than copy that one blended aggregate onto all seven
 * keys (which would fabricate a misleading, identical per-topic signal) or drop
 * it entirely, we RE-DERIVE each new topic's mastery from THAT TOPIC'S OWN scored
 * level attempts (`levelProgress[ek-*].bestScore × questionCount` → successes /
 * failures, seeded via `applyDiagnosticSeed`). This is the option the split's
 * plan prefers: it uses real, correctly-bucketed per-topic data. What is not
 * recoverable from `levelProgress` (the Elo θ trajectory and the per-topic
 * attribution of blended misconception flags) is intentionally reset to a
 * neutral prior — exactly what the diagnostic-seed path already does. A topic
 * with no attempted levels is left DORMANT (fresh Beta(1,1)). The stale ERK
 * aggregate is then removed.
 *
 * Pure and IDEMPOTENT: it only acts when the old ERK key is present (so it is a
 * no-op on fresh users, post-split users, and re-runs), and it never clobbers a
 * new-key aggregate that already holds real post-split data.
 */

const ERK_KEY = topicKeyOf("probability", "Extra Relevant Knowledge");

/** The seven new topicKeys and the level arrays whose attempts re-derive them. */
const SPLIT_TOPICS: { topicKey: string; levels: Level[] }[] = [
  { topicKey: topicKeyOf("probability", "Moment Generating Functions"), levels: mgfLevels },
  { topicKey: topicKeyOf("probability", "Gamma Distribution"), levels: gammaLevels },
  { topicKey: topicKeyOf("probability", "Joint Distributions"), levels: jointDistributionsLevels },
  { topicKey: topicKeyOf("probability", "Limit Theorems"), levels: limitTheoremsLevels },
  { topicKey: topicKeyOf("probability", "Branching Processes"), levels: branchingLevels },
  { topicKey: topicKeyOf("probability", "Continuous-Time Markov Chains"), levels: ctmcLevels },
  { topicKey: topicKeyOf("probability", "Markov Chain Structure"), levels: markovStructureLevels },
];

/** Later of two optional ISO timestamps (undefined-safe). */
function laterIso(a: string | undefined, b: string | undefined): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
}

export function migrateErkSplit(p: UserProgress): UserProgress {
  // No-op unless a stale pre-split ERK aggregate is present (idempotent).
  if (!p.topicMastery || !p.topicMastery[ERK_KEY]) return p;

  const next = structuredClone(p);
  const tm = next.topicMastery!;

  for (const { topicKey, levels } of SPLIT_TOPICS) {
    // Never clobber a new-key aggregate that already carries real post-split data.
    if (tm[topicKey]) continue;

    let successes = 0;
    let failures = 0;
    let lastSeen: string | undefined;
    for (const lvl of levels) {
      const lp = next.levelProgress[lvl.id];
      if (!lp || lp.attempts <= 0) continue;
      const q = totalQuestions(lvl);
      const s = Math.max(0, Math.min(q, Math.round((lp.bestScore ?? 0) * q)));
      successes += s;
      failures += q - s;
      lastSeen = laterIso(lastSeen, lp.completedAt);
    }

    // Re-derive only when this topic has real attempts; otherwise leave dormant.
    if (successes + failures > 0) {
      tm[topicKey] = applyDiagnosticSeed(undefined, { successes, failures, at: lastSeen });
    }
  }

  // Drop the stale blended aggregate — no displayed topic reads it anymore.
  delete tm[ERK_KEY];
  return next;
}
