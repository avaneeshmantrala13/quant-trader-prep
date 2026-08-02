import type { NumericQuestion, Question } from "./content";
import type { TierDifficultyMap, TopicMasteryMap } from "./mastery";
import type { OaTimedStore } from "@/lib/oa/types";

export interface LevelProgress {
  bestScore: number; // 0..1, best fraction correct achieved
  mastered: boolean;
  attempts: number;
  completedAt?: string;
  /**
   * Flashcard levels only: the set of problem ids the learner has marked
   * "Got it" (persisted so it survives leave/resume). No score is recorded for
   * flashcard levels.
   */
  understood?: string[];
}

/**
 * Mid-level resume state: the exact materialized question set + answers so far.
 * `questions` holds `Question[]` for quiz levels and `NumericQuestion[]` for
 * numeric levels; `answers` holds the chosen choice index (quiz) or the entered
 * numeric value (numeric), with `null` meaning "not yet answered".
 */
export interface ResumeState {
  levelId: string;
  seed: number;
  questions: (Question | NumericQuestion)[];
  index: number;
  answers: (number | null)[];
  /**
   * Numeric levels only: the per-item hint-credit earned so far, parallel to
   * `answers` (∈ [0,1] from the rung schedule; 0 for unanswered items). Needed
   * so the credit-weighted VISIBLE score survives a mid-round reload — the
   * `highestRung` reached is unrecoverable from the final entered value alone.
   * OPTIONAL so older saved blobs (and quiz levels) still load unchanged.
   */
  credits?: number[];
  lessonSkipped: boolean;
  startedAt: string;
}

/**
 * One completed diagnostic (Recalibrate) attempt, recorded so the summary can
 * chart improvement over time. `overallScore` is a 0..1 fraction (higher is
 * better); `perTopic` is an optional per-topic fraction-correct map. Additive
 * and back-compatible — nothing reads it except the improvement graph.
 */
export interface DiagnosticResult {
  /** ISO timestamp of the attempt (matches the seed stamp where practical). */
  at: string;
  /** Overall score in 0..1 (fraction correct, optionally tier-weighted). */
  overallScore: number;
  /** Number of graded items answered in this attempt. */
  itemsAnswered: number;
  /** Optional per-topic fraction correct (0..1), keyed by topicKey. */
  perTopic?: Record<string, number>;
}

/**
 * User-selectable Goal Mode. Case A "course" (UT course mastery) | Case B
 * "interview" (quant interview / OA prep, the safe default). It is a pure VIEW
 * selector — it NEVER stores progress, gates content, or affects
 * scoring/mastery/the v1→v2 migration. See `src/lib/mode/`.
 */
export type GoalMode = "course" | "interview";

/**
 * One persisted (predicted, outcome) calibration pair, keyed by topic. Additive
 * & optional (mirrors `diagnosticHistory`): older saves without it load
 * unchanged, and it NEVER gates content or affects scoring / mastery / the
 * v1→v2 migration. Persisting a capped log lets the dashboard's calibration
 * panel accumulate across sessions instead of resetting every reload.
 */
export interface PersistedCalibrationPair {
  topicKey: string;
  /** Predicted success probability at serve time, in [0,1]. */
  pred: number;
  /** Observed outcome (0 miss, 1 hit). */
  outcome: 0 | 1;
  /** ISO timestamp of the graded item (optional). */
  at?: string;
}

export interface UserProgress {
  version: number; // was 1; Phase 1 writes 2 (see src/lib/mastery/migrate.ts)
  levelProgress: Record<string, LevelProgress>;
  resume: Record<string, ResumeState>;
  xp: number;
  streak: number;
  lastActiveDate: string; // YYYY-MM-DD
  createdAt: string;
  // ---- NEW (Phase 1 — Mastery & Calibration). All OPTIONAL so v1 saves load
  //      unchanged; migrateProgress fills them with empty maps (COORDINATION §2.2). ----
  /** Per-topic Elo θ + Beta(α,β) posterior + misconception flags (src/types/mastery.ts). */
  topicMastery?: TopicMasteryMap;
  /** Per (topic,tier) Elo difficulty d[topic,τ]. Key = `${topicKey}#${difficulty}`. */
  tierDifficulty?: TierDifficultyMap;
  /** Set once, after the diagnostic is completed or skipped (Phase 3). */
  diagnosticDoneAt?: string;
  /**
   * Set once the new-user ONBOARDING TOUR has been shown/dismissed. Purely a
   * UI "shown once" flag — additive and migration-safe (mirrors
   * `diagnosticDoneAt`). It NEVER gates content and is untouched by
   * `recordAttempt`, `recordItemAttempt`, mastery/locking, or the v1→v2
   * migration. Re-triggerable on demand via the "Show tutorial" affordance.
   */
  onboardingTourDoneAt?: string;
  /**
   * Append-only history of completed diagnostic attempts, oldest → newest.
   * Powers the Recalibrate "you're improving" graph. Additive & optional
   * (mirrors `diagnosticDoneAt`): older saves without it load unchanged, and it
   * NEVER gates content or affects scoring / mastery / the v1→v2 migration.
   */
  diagnosticHistory?: DiagnosticResult[];
  /**
   * User-selected Goal Mode (Case A "course" | Case B "interview"). Additive &
   * optional (mirrors `diagnosticDoneAt`): older saves load unchanged and are
   * treated as "interview" (Case B = today's app). A pure VIEW selector — it
   * NEVER stores progress, gates content, or affects scoring/mastery/the v1→v2
   * migration. Overlapping-topic progress is therefore shared automatically when
   * toggling A↔B (mastery stays topicKey-keyed; mode reads none of it).
   */
  goalMode?: GoalMode;
  /**
   * Append-only, capped cross-session calibration log (WS-CAL). Additive &
   * optional (mirrors `diagnosticHistory`): older saves without it load
   * unchanged, and it NEVER gates content or affects scoring / mastery / the
   * v1→v2 migration. Lets the reliability panel accrue across sessions so it can
   * reach the sufficiency threshold instead of resetting on reload.
   */
  calibrationLog?: PersistedCalibrationPair[];
  /**
   * Durable Timed OA store: the single resumable in-progress session plus the
   * capped completed-results history (src/lib/oa/types.ts). Additive & optional
   * (mirrors `diagnosticHistory` / `calibrationLog`): older saves without it
   * load unchanged, and it NEVER gates content or affects scoring / mastery /
   * the v1→v2 migration. Persisting it here makes an active session reload-proof
   * (survives leave/resume/re-login) and keeps completed results for the
   * dashboard trend graph.
   */
  oaTimed?: OaTimedStore;
}

export function emptyProgress(): UserProgress {
  const today = new Date().toISOString().slice(0, 10);
  return {
    version: 2,
    levelProgress: {},
    resume: {},
    xp: 0,
    streak: 0,
    lastActiveDate: today,
    createdAt: new Date().toISOString(),
    topicMastery: {},
    tierDifficulty: {},
  };
}
