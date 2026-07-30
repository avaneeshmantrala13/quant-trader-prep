import type { Difficulty } from "@/types/content";

/**
 * Per-topic learner state — the heart of the Phase-1 mastery/calibration layer.
 *
 * Research basis (cite in the algorithm modules):
 *  - Elo-for-education + guessing correction + the K_s(n) uncertainty function:
 *    Pelánek 2016 (RESEARCH_ASSESSMENT_ADAPTIVITY.md §1.3, RESEARCH_ML_USAGE.md §1.6).
 *  - Beta-Binomial conjugacy + credible-interval "good/bad": Bayes Rules! ch.3 (§1.4, §4).
 *
 * All scalars → DynamoDB-cheap; this rides along in the existing single per-user
 * progress blob (see COORDINATION §6 / §2.2). No new table, no GSIs.
 */
export interface TopicMastery {
  /** Elo skill θ for this topic (logit scale). Init 0 (or diagnostic seed). */
  theta: number;
  /** Items answered in this topic (drives the Elo uncertainty/learning-rate function). */
  n: number;
  /** Beta-Binomial success pseudo-count (prior + decayed successes). Init 1. */
  alpha: number;
  /** Beta-Binomial failure pseudo-count (prior + decayed failures). Init 1. */
  beta: number;
  /** ISO timestamp of the last graded item in this topic. */
  lastSeen: string;
  /** ISO timestamp when a spaced review is due (SM-2). Absent = none scheduled. */
  reviewDue?: string;
  /** SM-2 ladder index (0-based into REVIEW_INTERVALS_DAYS). Absent = not yet mastered. */
  reviewStep?: number;
  /** misconceptionKey → decayed hit count. Cleared by a remediation/spaced-review pass. */
  misconceptions: Record<string, number>;
}

export type TopicMasteryMap = Record<string, TopicMastery>;

/** Per (topic,tier) Elo difficulty d[topic,τ]. Key = `${topicKey}#${difficulty}`. */
export type TierDifficultyMap = Record<string, number>;

/** The immutable, verifier-produced record of ONE graded item. The ONLY input to mastery. */
export interface ItemAttempt {
  topicKey: string;
  tier: Difficulty;
  /** Did the learner EVENTUALLY answer correctly (first try OR after hints)? */
  correct: boolean;
  mode: "quiz" | "numeric" | "flashcard";
  /** MCQ option count for guessing correction (4 for quiz). Omit/undefined ⇒ no-guess (numeric). */
  kOptions?: number;
  chosenIndex?: number; // quiz only
  chosenValue?: number; // numeric only
  /** Resolved misconception keys this attempt tripped (see COORDINATION §2.4). */
  misconceptions?: string[];
  /** Response time in ms (Phase 6 / rushing detection; optional elsewhere). */
  responseMs?: number;
  /**
   * OPTIONAL, additive (PHASE_1 partial-credit). Fractional score S ∈ [0,1] from
   * the free-response hint-attempt schedule (`src/lib/tutor/creditSchedule.ts`).
   * When present the mastery fold uses it as the Elo actual score AND the Beta
   * fractional pseudo-count instead of the binary 0/1 from `correct`. When
   * ABSENT the fold falls back to `correct ? 1 : 0`, so every existing binary
   * caller (quiz, remediation, diagnostic) is unchanged and back-compatible.
   */
  credit?: number;
  /**
   * OPTIONAL analytics: the highest hint rung reached before the correct answer
   * (0 = no hint). Recorded per-item purely for later analytics; never affects
   * the mastery math (that reads `credit`). Cheap to carry, so we do.
   */
  highestRung?: 0 | 1 | 2 | 3 | 4 | 5;
  at: string; // ISO timestamp
}
