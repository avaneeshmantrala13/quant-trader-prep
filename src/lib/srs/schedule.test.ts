import { describe, expect, it } from "vitest";
import {
  INITIAL_EASE,
  MIN_EASE,
  dueQueue,
  isDue,
  newCard,
  nextEase,
  reviewCard,
  type SrsCard,
} from "./schedule";

const DAY = 24 * 60 * 60 * 1000;
const T0 = 1_700_000_000_000;

describe("SRS scheduler — new card", () => {
  it("starts at initial ease, zero interval, due immediately", () => {
    const c = newCard(T0);
    expect(c.ease).toBe(INITIAL_EASE);
    expect(c.intervalDays).toBe(0);
    expect(c.reps).toBe(0);
    expect(c.lapses).toBe(0);
    expect(isDue(c, T0)).toBe(true);
  });
});

describe("SRS scheduler — successful progression", () => {
  it("uses the SM-2 fixed 1-day then 6-day intervals for the first two reps", () => {
    let c = newCard(T0);
    c = reviewCard(c, 4, T0);
    expect(c.reps).toBe(1);
    expect(c.intervalDays).toBe(1);
    expect(c.dueAtMs).toBe(T0 + 1 * DAY);

    c = reviewCard(c, 4, c.dueAtMs);
    expect(c.reps).toBe(2);
    expect(c.intervalDays).toBe(6);
  });

  it("multiplies the interval by ease after the second rep and grows monotonically", () => {
    let c = newCard(T0);
    c = reviewCard(c, 5, T0); // 1
    c = reviewCard(c, 5, c.dueAtMs); // 6
    const beforeInterval = c.intervalDays;
    c = reviewCard(c, 5, c.dueAtMs); // 6 * ease
    expect(c.intervalDays).toBe(Math.round(beforeInterval * c.ease));
    expect(c.intervalDays).toBeGreaterThan(beforeInterval);
  });

  it("is deterministic — identical inputs give identical output", () => {
    const c = newCard(T0);
    expect(reviewCard(c, 4, T0)).toEqual(reviewCard(c, 4, T0));
  });
});

describe("SRS scheduler — ease dynamics", () => {
  it("raises ease on a perfect grade and lowers it on a barely-passing grade", () => {
    expect(nextEase(2.5, 5)).toBeGreaterThan(2.5);
    expect(nextEase(2.5, 3)).toBeLessThan(2.5);
  });

  it("never lets ease fall below the floor", () => {
    let ease = 1.35;
    for (let i = 0; i < 20; i++) ease = nextEase(ease, 3);
    expect(ease).toBeGreaterThanOrEqual(MIN_EASE);
  });
});

describe("SRS scheduler — lapses", () => {
  it("resets reps + interval, penalizes ease, and increments lapses on failure", () => {
    let c = newCard(T0);
    c = reviewCard(c, 5, T0);
    c = reviewCard(c, 5, c.dueAtMs); // reps 2, interval 6
    const easeBefore = c.ease;
    c = reviewCard(c, 1, c.dueAtMs); // fail
    expect(c.reps).toBe(0);
    expect(c.intervalDays).toBe(1);
    expect(c.lapses).toBe(1);
    expect(c.ease).toBeLessThan(easeBefore);
    expect(c.ease).toBeGreaterThanOrEqual(MIN_EASE);
  });
});

describe("SRS scheduler — due queue", () => {
  it("returns only due cards, most-overdue first, stable on ties", () => {
    const cards: Record<string, SrsCard> = {
      a: { ...newCard(T0), dueAtMs: T0 - 2 * DAY },
      b: { ...newCard(T0), dueAtMs: T0 - 5 * DAY },
      c: { ...newCard(T0), dueAtMs: T0 + 3 * DAY }, // not due
      d: { ...newCard(T0), dueAtMs: T0 - 2 * DAY }, // tie with a
    };
    expect(dueQueue(cards, T0)).toEqual(["b", "a", "d"]);
  });
});
