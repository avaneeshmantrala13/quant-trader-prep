import type { GoalMode, UserProgress } from "@/types/progress";

/**
 * GOAL MODE — the pure projection input (Case A / Case B), WS0.
 *
 * `goalMode` is a single optional field on `UserProgress`; it holds NO progress.
 * This module resolves it (undefined → the safe Case B default) and carries the
 * user-facing copy. Everything mode-aware in the UI reads its view from here (and
 * from `courseMap` / `visibility`), so toggling A↔B is instant and
 * non-destructive — the same `topicKey`-keyed mastery store is simply
 * regrouped/reprojected.
 */

export type { GoalMode } from "@/types/progress";

/** The safe default for existing users (no `goalMode`) = Case B (today's app). */
export const DEFAULT_GOAL_MODE: GoalMode = "interview";

/** Resolve the effective mode: undefined ⇒ Case B ("interview"). */
export function resolveGoalMode(
  progress: Pick<UserProgress, "goalMode"> | undefined | null,
): GoalMode {
  return progress?.goalMode ?? DEFAULT_GOAL_MODE;
}

/** Alias per the WS0 spec (`getGoalMode(progress)`). */
export const getGoalMode = resolveGoalMode;

export interface GoalModeMeta {
  id: GoalMode;
  /** Short segmented-control label. */
  label: string;
  /** One-line description for the toggle / diagnostic card. */
  blurb: string;
  /** Longer diagnostic-card body (first-person, learner voice). */
  detail: string;
}

/** User-facing copy for each mode (single source for the toggle + diagnostic). */
export const MODE_META: Record<GoalMode, GoalModeMeta> = {
  course: {
    id: "course",
    label: "Course mastery",
    blurb: "Master my probability courses",
    detail:
      "I'm taking (or reviewing) Intro to Probability and Intro to Stochastic Processes. Teach me the course topics and tell me how ready I am for each course. No trading games or speed drills.",
  },
  interview: {
    id: "interview",
    label: "Interview prep",
    blurb: "Prep for quant trading interviews / OAs",
    detail:
      "Get me interview- and online-assessment-ready: the probability that firms test, market-making games, and timed speed drills.",
  },
};

/** The two modes in display order (Course first, Interview second). */
export const GOAL_MODES: GoalMode[] = ["course", "interview"];

/** The opposite mode — used by the two-way toggle. */
export function otherMode(mode: GoalMode): GoalMode {
  return mode === "course" ? "interview" : "course";
}
