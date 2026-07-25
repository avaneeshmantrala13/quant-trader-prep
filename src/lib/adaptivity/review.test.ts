import { describe, expect, it } from "vitest";
import type { TopicMastery } from "@/types/mastery";
import { REVIEW_INTERVALS_DAYS } from "./config";
import {
  isReviewDue,
  planRoundReview,
  reviewIntervalDays,
  scheduleReview,
} from "./review";

const NOW = "2026-01-01T00:00:00.000Z";
const DAY_MS = 86_400_000;

function daysAfter(now: string, days: number): string {
  return new Date(new Date(now).getTime() + days * DAY_MS).toISOString();
}

function mastery(over: Partial<TopicMastery>): TopicMastery {
  return {
    theta: 0,
    n: 0,
    alpha: 1,
    beta: 1,
    lastSeen: NOW,
    misconceptions: {},
    ...over,
  };
}

describe("reviewIntervalDays", () => {
  it("maps the ladder and clamps out-of-range steps", () => {
    expect(reviewIntervalDays(0)).toBe(1);
    expect(reviewIntervalDays(4)).toBe(35);
    expect(reviewIntervalDays(-3)).toBe(1); // clamp low
    expect(reviewIntervalDays(99)).toBe(35); // clamp high
  });
});

describe("scheduleReview (canonical, shared with Phase 4)", () => {
  it("re-exports the single-owner SM-2 fold: [1,3,7,16,35] advance / reset", () => {
    // Same ladder Phase 4 owns — this only guards that the re-export is wired.
    expect([...REVIEW_INTERVALS_DAYS]).toEqual([1, 3, 7, 16, 35]);
    const pass = scheduleReview(NOW, 0, true);
    expect(pass.reviewDue).toBe(daysAfter(NOW, 1));
    expect(pass.step).toBe(1);
    const lapse = scheduleReview(NOW, 3, false);
    expect(lapse.reviewDue).toBe(daysAfter(NOW, 1));
    expect(lapse.step).toBe(0);
  });
});

describe("isReviewDue", () => {
  it("true only when now ≥ reviewDue; false when unscheduled", () => {
    const due = daysAfter(NOW, 1);
    expect(isReviewDue(due, NOW)).toBe(false); // one day before
    expect(isReviewDue(due, daysAfter(NOW, 1))).toBe(true); // exactly due
    expect(isReviewDue(due, daysAfter(NOW, 2))).toBe(true); // overdue
    expect(isReviewDue(undefined, NOW)).toBe(false);
  });
});

describe("planRoundReview (round → SM-2 schedule, via canonical scheduleReview)", () => {
  // A strongly-successful posterior clears via the Beta credible interval.
  const CLEARED = { alpha: 60, beta: 3 };
  const LEARNING = { alpha: 3, beta: 2 };

  it("returns null when there is no mastery yet", () => {
    expect(planRoundReview(undefined, NOW)).toBeNull();
  });

  it("first clearing schedules the shortest interval and advances the step", () => {
    const plan = planRoundReview(mastery(CLEARED), NOW);
    expect(plan).toEqual({ reviewDue: daysAfter(NOW, 1), reviewStep: 1 });
  });

  it("a subsequent clearing advances further along the ladder", () => {
    const plan = planRoundReview(mastery({ ...CLEARED, reviewStep: 1 }), NOW);
    expect(plan).toEqual({ reviewDue: daysAfter(NOW, 3), reviewStep: 2 });
  });

  it("a DUE review that was not cleared lapses back to step 0", () => {
    const plan = planRoundReview(
      mastery({
        ...LEARNING,
        reviewStep: 3,
        reviewDue: daysAfter(NOW, -1), // overdue
      }),
      NOW,
    );
    expect(plan).toEqual({ reviewDue: daysAfter(NOW, 1), reviewStep: 0 });
  });

  it("leaves the schedule untouched when still learning and no review is due", () => {
    // Scheduled but not yet due → no change.
    expect(
      planRoundReview(
        mastery({ ...LEARNING, reviewStep: 2, reviewDue: daysAfter(NOW, 5) }),
        NOW,
      ),
    ).toBeNull();
    // Never scheduled and not cleared → no change.
    expect(planRoundReview(mastery(LEARNING), NOW)).toBeNull();
  });
});
