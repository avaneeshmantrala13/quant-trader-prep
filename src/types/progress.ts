import type { NumericQuestion, Question } from "./content";

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
  version: number;
  levelProgress: Record<string, LevelProgress>;
  resume: Record<string, ResumeState>;
  xp: number;
  streak: number;
  lastActiveDate: string; // YYYY-MM-DD
  createdAt: string;
}

export function emptyProgress(): UserProgress {
  const today = new Date().toISOString().slice(0, 10);
  return {
    version: 1,
    levelProgress: {},
    resume: {},
    xp: 0,
    streak: 0,
    lastActiveDate: today,
    createdAt: new Date().toISOString(),
  };
}
