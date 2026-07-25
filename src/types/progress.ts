import type { NumericQuestion, Question } from "./content";
import type { TierDifficultyMap, TopicMasteryMap } from "./mastery";

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
  lessonSkipped: boolean;
  startedAt: string;
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
