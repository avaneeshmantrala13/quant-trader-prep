import type { Difficulty } from "@/types/content";
import { TIER_SEED } from "@/lib/mastery/config";
import { misconceptionKey } from "@/lib/mastery/topicKey";

/**
 * Pure seed derivation for the cold-start diagnostic (PHASE_3 §4/§5).
 *
 * The diagnostic's ONLY output is a per-topic prior fed to Phase-1's
 * `applyDiagnosticSeed`: `α₀ = 1 + successes`, `β₀ = 1 + failures`, an initial
 * `θ` (thetaSeed), and misconception flags from tripped trap distractors. This
 * kills the Elo/Beta cold-start weakness (cold-start literature: ~5 responses
 * stabilize an estimate; 2 items/topic is a sensible floor; misconception-trap
 * distractors as probes — Bradshaw & Templin 2013; Pelánek 2016).
 *
 * This module is intentionally UI-independent: the PRIMARY item flow and the
 * BACKUP one-screen self-report both funnel into the same `TopicSeed` shape, so
 * swapping the input is costless (PHASE_3 §2).
 */

export interface TopicSeed {
  topicKey: string;
  successes: number;
  failures: number;
  thetaSeed: number;
  /** Fully-namespaced misconception keys (`${topicKey}::${tag}`). */
  misconceptions: string[];
}

/** One graded diagnostic item outcome for a topic. */
export interface DiagnosticOutcome {
  topicKey: string;
  tier: Difficulty;
  correct: boolean;
  /** Raw misconception tag tripped on a miss (authored tag or `idx:<i>` fallback). */
  misconceptionTag?: string;
}

/**
 * TIER_SEED is spaced one logit apart between adjacent tiers; we interpolate the
 * ability estimate to the MIDPOINT of the crossing, i.e. half a step past the
 * hardest tier passed / easiest tier failed.
 */
const TIER_STEP = 1;

/**
 * Estimate θ as the seed difficulty at which success crosses ~50%, interpolated
 * between the two attempted tiers (PHASE_3 §5):
 *  - passed everything  ⇒ just above the hardest tier passed
 *  - failed everything  ⇒ just below the easiest tier failed
 *  - mixed              ⇒ midpoint of (hardest passed, easiest failed)
 *  - no outcomes        ⇒ 0 (neutral prior)
 */
function crossingTheta(passed: number[], failed: number[]): number {
  if (passed.length === 0 && failed.length === 0) return 0;
  if (failed.length === 0) return Math.max(...passed) + TIER_STEP / 2;
  if (passed.length === 0) return Math.min(...failed) - TIER_STEP / 2;
  return (Math.max(...passed) + Math.min(...failed)) / 2;
}

/**
 * Fold per-topic diagnostic outcomes into seeds. Groups by `topicKey`
 * (first-seen order preserved), counts successes/failures, derives `thetaSeed`
 * via the tier-crossing interpolation, and collects namespaced misconception
 * keys from missed trap distractors.
 */
export function diagnosticToSeeds(outcomes: DiagnosticOutcome[]): TopicSeed[] {
  const order: string[] = [];
  const byTopic = new Map<string, DiagnosticOutcome[]>();
  for (const o of outcomes) {
    if (!byTopic.has(o.topicKey)) {
      byTopic.set(o.topicKey, []);
      order.push(o.topicKey);
    }
    byTopic.get(o.topicKey)!.push(o);
  }

  return order.map((topicKey) => {
    const os = byTopic.get(topicKey)!;
    let successes = 0;
    let failures = 0;
    const passed: number[] = [];
    const failed: number[] = [];
    const misc = new Set<string>();
    for (const o of os) {
      const d = TIER_SEED[o.tier];
      if (o.correct) {
        successes += 1;
        passed.push(d);
      } else {
        failures += 1;
        failed.push(d);
        if (o.misconceptionTag) {
          misc.add(misconceptionKey(topicKey, o.misconceptionTag));
        }
      }
    }
    return {
      topicKey,
      successes,
      failures,
      thetaSeed: crossingTheta(passed, failed),
      misconceptions: [...misc],
    };
  });
}

/* -------------------------------------------------------------------------- */
/*  BACKUP path — one-screen self-report → coarse seeds (PHASE_3 §2/§4).      */
/*  Not wired into the PRIMARY item flow; kept here so the swap is costless.   */
/* -------------------------------------------------------------------------- */

/** Which topic each self-report question maps to. Keys are answer-record keys. */
const SELF_REPORT_TOPIC: Record<string, string> = {
  // "Have you taken M362K / a probability course?"
  m362k: "probability::Core Probability",
  probCourse: "probability::Conditional Probability",
  // "Rate your mental-math speed"
  mentalMath: "mental-math::_core",
};

/** Coarse confidence → pseudo-counts + θ. Higher confidence ⇒ higher prior. */
function coarseSeed(answer: string): {
  successes: number;
  failures: number;
  thetaSeed: number;
} {
  const a = answer.trim().toLowerCase();
  if (["yes", "y", "strong", "fast", "high", "advanced"].includes(a)) {
    return { successes: 2, failures: 0, thetaSeed: 1 };
  }
  if (["some", "medium", "ok", "okay", "average", "maybe"].includes(a)) {
    return { successes: 1, failures: 1, thetaSeed: 0 };
  }
  // "no" / "slow" / "low" / "none" / anything unrecognized ⇒ low prior.
  return { successes: 0, failures: 2, thetaSeed: -1 };
}

/**
 * BACKUP: map a one-screen self-report to coarse per-topic seeds. Answers
 * unknown to the mapping are ignored; a stronger self-report ("took M362K")
 * yields a strictly higher prior than "no".
 */
export function selfReportToSeed(answers: Record<string, string>): TopicSeed[] {
  const seeds: TopicSeed[] = [];
  for (const [key, topicKey] of Object.entries(SELF_REPORT_TOPIC)) {
    const answer = answers[key];
    if (answer === undefined) continue;
    const { successes, failures, thetaSeed } = coarseSeed(answer);
    seeds.push({ topicKey, successes, failures, thetaSeed, misconceptions: [] });
  }
  return seeds;
}
