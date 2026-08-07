import { describe, expect, it } from "vitest";
import {
  courseStartCourseId,
  courseStartHref,
  courseHasUnmastered,
} from "./courseResume";
import { courseForTopic } from "./courseMap";
import { topicKeyForLevel } from "@/lib/mastery/topicKey";
import { probabilityTrack } from "@/content/probability/levels";
import type { LevelProgress } from "@/types/progress";

/**
 * COURSE-MODE START RESUME (Fix 2): the landing CTA resumes the learner in their
 * last-done / current course, only falling back to the first course when there
 * is genuinely no progress. (Interview mode never calls this.)
 */

function levelIdsForCourse(courseId: "m362k" | "m362m"): string[] {
  return probabilityTrack.levels
    .filter(
      (l) => courseForTopic(topicKeyForLevel("probability", l)) === courseId,
    )
    .map((l) => l.id);
}

const mastered = (completedAt?: string): LevelProgress => ({
  bestScore: 1,
  mastered: true,
  attempts: 1,
  completedAt,
});

describe("courseStartCourseId", () => {
  it("falls back to the first course when there is NO progress", () => {
    expect(courseStartCourseId({ levelProgress: {} })).toBe("m362k");
    expect(courseStartHref({ levelProgress: {} })).toBe("/course/m362k");
  });

  it("resumes the last-done course while it still has un-mastered work", () => {
    const m362mLevels = levelIdsForCourse("m362m");
    expect(m362mLevels.length).toBeGreaterThan(1);
    const progress = {
      levelProgress: {
        [m362mLevels[0]]: mastered("2026-03-01T00:00:00.000Z"),
      },
    };
    // Last completed level is in m362m and m362m still has work ⇒ resume m362m.
    expect(courseStartCourseId(progress)).toBe("m362m");
    expect(courseStartHref(progress)).toBe("/course/m362m");
  });

  it("advances to the next course when the last-done course is fully mastered", () => {
    const m362kLevels = levelIdsForCourse("m362k");
    const levelProgress: Record<string, LevelProgress> = {};
    // Master EVERY m362k level; stamp one as the most recent completion.
    m362kLevels.forEach((id, i) => {
      levelProgress[id] = mastered(
        i === 0 ? "2026-04-01T00:00:00.000Z" : "2026-01-01T00:00:00.000Z",
      );
    });
    const progress = { levelProgress };
    expect(courseHasUnmastered("m362k", progress)).toBe(false);
    // m362k done ⇒ advance to the m362m frontier.
    expect(courseStartCourseId(progress)).toBe("m362m");
  });
});
