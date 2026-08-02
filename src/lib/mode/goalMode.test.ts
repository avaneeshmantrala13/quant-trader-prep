import { describe, expect, it } from "vitest";
import { emptyProgress } from "@/types/progress";
import {
  DEFAULT_GOAL_MODE,
  getGoalMode,
  GOAL_MODES,
  MODE_META,
  otherMode,
  resolveGoalMode,
} from "./goalMode";

describe("resolveGoalMode (default / migration for existing users)", () => {
  it("treats undefined goalMode as Case B ('interview') — the safe default", () => {
    expect(resolveGoalMode(emptyProgress())).toBe("interview");
    expect(resolveGoalMode({ goalMode: undefined })).toBe("interview");
    expect(DEFAULT_GOAL_MODE).toBe("interview");
  });

  it("returns the explicit mode when set", () => {
    expect(resolveGoalMode({ goalMode: "course" })).toBe("course");
    expect(resolveGoalMode({ goalMode: "interview" })).toBe("interview");
  });

  it("is null/undefined safe", () => {
    expect(resolveGoalMode(undefined)).toBe("interview");
    expect(resolveGoalMode(null)).toBe("interview");
  });

  it("getGoalMode is an alias of resolveGoalMode", () => {
    expect(getGoalMode({ goalMode: "course" })).toBe("course");
  });
});

describe("mode metadata", () => {
  it("exposes copy for both modes", () => {
    expect(MODE_META.course.label).toBeTruthy();
    expect(MODE_META.interview.label).toBeTruthy();
    expect(GOAL_MODES).toEqual(["course", "interview"]);
  });

  it("otherMode is a two-way toggle", () => {
    expect(otherMode("course")).toBe("interview");
    expect(otherMode("interview")).toBe("course");
  });
});
