import type { TopicVerdict } from "@/lib/mastery/verdict";
import { isReviewDue } from "@/lib/adaptivity/review";

/**
 * Weakness / strength ranking for the dashboard (PHASE_5 §5). Always ordered by
 * the CREDIBLE-INTERVAL bound, never the point mean — "worst, and most confident
 * about it" surfaces first so the learner fixes provable gaps before noisy ones.
 *
 * PLACEMENT NOTE: PHASE_5 §3 sketches this as `src/lib/dashboard/ranking.ts`, but
 * COORDINATION §4 grants Phase 5 only `src/lib/adaptivity/**` + `calibration/**`
 * (plus the page/components), so it lives under `calibration/` (it is a pure,
 * verdict-driven ordering — no UI). Documented deviation; same functions.
 */

/** Reliability gap for tie-breaking (0 when uncomputed). */
function relGap(v: TopicVerdict): number {
  return v.reliabilityGap ?? 0;
}

/**
 * Weaknesses, ascending by `CI_low` (worst-most-confident first). Ties break by
 * higher reliability gap (more overconfident), then more active misconceptions,
 * then topicKey for a stable order.
 */
export function rankWeaknesses(verdicts: TopicVerdict[]): TopicVerdict[] {
  return [...verdicts].sort(
    (a, b) =>
      a.lo - b.lo ||
      relGap(b) - relGap(a) ||
      b.namedMisconceptions.length - a.namedMisconceptions.length ||
      a.topicKey.localeCompare(b.topicKey),
  );
}

/** Strengths: STRONG verdicts only, descending by `CI_low` (most-proven first). */
export function rankStrengths(verdicts: TopicVerdict[]): TopicVerdict[] {
  return verdicts
    .filter((v) => v.state === "STRONG")
    .sort((a, b) => b.lo - a.lo || a.topicKey.localeCompare(b.topicKey));
}

/** Topics with a spaced review due at `now` (SM-2), earliest-due first. */
export function reviewsDue(
  verdicts: TopicVerdict[],
  now: string,
): TopicVerdict[] {
  return verdicts
    .filter((v) => isReviewDue(v.reviewDue, now))
    .sort((a, b) => (a.reviewDue ?? "").localeCompare(b.reviewDue ?? ""));
}
