import type { UserProgress } from "@/types/progress";
import { getTrack } from "@/content";
import { topicKeyForLevel } from "@/lib/mastery/topicKey";
import {
  COURSE_BY_ID,
  courseForTopic,
  courseIds,
  topicsInCourse,
  type CourseId,
} from "./courseMap";

/**
 * COURSE-MODE "Start / Continue" RESUME TARGET (Fix 2).
 *
 * In course mode the landing CTA must resume the learner in THEIR course — at
 * their last-done / current course — instead of dumping them at the raw
 * "Probability & Statistics" track the interview (quant) site opens. All course
 * topics live in the probability track (as `section`s grouped by `courseMap`),
 * so we read the learner's level progress, resolve it to a course, and route to
 * that course page (`/course/:courseId`). Pure (no React/storage) so it is
 * unit-testable; interview mode never calls this (its behavior is unchanged).
 */

const COURSE_TRACK_ID = "probability";

/** Every displayed topicKey (primary + shared) for a course. */
function courseTopicSet(id: CourseId): Set<string> {
  return new Set(topicsInCourse(id));
}

/** True when any level in the course's topics is not yet mastered. */
export function courseHasUnmastered(
  id: CourseId,
  progress: Pick<UserProgress, "levelProgress">,
): boolean {
  const track = getTrack(COURSE_TRACK_ID);
  if (!track) return false;
  const topics = courseTopicSet(id);
  return track.levels.some(
    (level) =>
      topics.has(topicKeyForLevel(track.id, level)) &&
      !progress.levelProgress[level.id]?.mastered,
  );
}

/**
 * The course owning the learner's MOST-RECENTLY-COMPLETED course level (by
 * `completedAt`), or undefined when no course level has been completed. Shared
 * topics resolve to their PRIMARY owner (via `courseForTopic`).
 */
export function latestCompletedCourse(
  progress: Pick<UserProgress, "levelProgress">,
): CourseId | undefined {
  const track = getTrack(COURSE_TRACK_ID);
  if (!track) return undefined;
  let best: { at: string; course: CourseId } | undefined;
  for (const level of track.levels) {
    const lp = progress.levelProgress[level.id];
    if (!lp?.completedAt) continue;
    const course = courseForTopic(topicKeyForLevel(track.id, level));
    if (!course) continue;
    if (!best || lp.completedAt > best.at) best = { at: lp.completedAt, course };
  }
  return best?.course;
}

/**
 * The course the learner should resume in:
 *  1. their last-done course, if it still has un-mastered work (keep going),
 *  2. else the first course (in order) that still has un-mastered work (advance
 *     to the next relevant place in their path),
 *  3. else fall back to their last-done course, or the very first course when
 *     there is genuinely no progress at all.
 */
export function courseStartCourseId(
  progress: Pick<UserProgress, "levelProgress">,
): CourseId {
  const ids = courseIds();
  const last = latestCompletedCourse(progress);
  if (last && courseHasUnmastered(last, progress)) return last;
  const frontier = ids.find((id) => courseHasUnmastered(id, progress));
  if (frontier) return frontier;
  return last ?? ids[0];
}

/** The `/course/:courseId` route the course-mode Start / Continue CTA links to. */
export function courseStartHref(
  progress: Pick<UserProgress, "levelProgress">,
): string {
  return `/course/${courseStartCourseId(progress)}`;
}

/** The learner-facing label of the resume-target course (for the CTA text). */
export function courseStartLabel(
  progress: Pick<UserProgress, "levelProgress">,
): string {
  return COURSE_BY_ID[courseStartCourseId(progress)].label;
}
