import { describe, expect, it } from "vitest";
import {
  applyReview,
  buildReviewQueue,
  coerceSrsStore,
  dueCount,
  emptySrsStore,
  ensureCardsSeeded,
  getSrsCard,
  graduatedCount,
  isGraduated,
} from "./store";
import { newCard } from "./schedule";

const DAY = 24 * 60 * 60 * 1000;
const T0 = 1_700_000_000_000;

describe("SRS store — seeding", () => {
  it("seeds missing ids as fresh cards due immediately, leaving existing rows untouched", () => {
    let store = emptySrsStore();
    store = ensureCardsSeeded(store, ["a", "b"], T0);
    expect(Object.keys(store.cards).sort()).toEqual(["a", "b"]);
    expect(store.cards.a.dueAtMs).toBe(T0);

    // Grade "a" so it now has a real schedule, then re-seed with a new id.
    const graded = applyReview(store, "a", 5, T0);
    const after = ensureCardsSeeded(graded, ["a", "b", "c"], T0 + DAY);
    // "a" keeps its graded schedule (not reset by re-seeding).
    expect(after.cards.a).toEqual(graded.cards.a);
    expect(after.cards.c.dueAtMs).toBe(T0 + DAY);
  });

  it("is a cheap no-op (same reference) when nothing is missing", () => {
    const store = ensureCardsSeeded(emptySrsStore(), ["a"], T0);
    expect(ensureCardsSeeded(store, ["a"], T0 + 999)).toBe(store);
  });
});

describe("SRS store — grading persists a rescheduled card", () => {
  it("applies the SM-2 scheduler and bumps the review counter", () => {
    const store = applyReview(emptySrsStore(), "x", 4, T0);
    const c = getSrsCard(store, "x")!;
    expect(store.reviews).toBe(1);
    expect(c.reps).toBe(1);
    expect(c.intervalDays).toBe(1);
    // Absolute wall-clock due timestamp (reload-proof).
    expect(c.dueAtMs).toBe(T0 + 1 * DAY);
  });

  it("a passing grade pushes the card out of the due window", () => {
    const ids = ["x"];
    const seeded = ensureCardsSeeded(emptySrsStore(), ids, T0);
    expect(dueCount(seeded, ids, T0)).toBe(1);
    const graded = applyReview(seeded, "x", 4, T0);
    // Now due tomorrow, so not due at T0.
    expect(dueCount(graded, ids, T0)).toBe(0);
    expect(dueCount(graded, ids, T0 + DAY)).toBe(1);
  });
});

describe("SRS store — due count + queue treat unseeded catalog cards as new", () => {
  it("counts never-seeded catalog ids as due, and orders most-overdue first", () => {
    // Only "b" is seeded (and overdue); "a" and "c" are brand new.
    let store = emptySrsStore();
    store = { ...store, cards: { b: { ...newCard(T0), dueAtMs: T0 - 5 * DAY } } };
    const ids = ["a", "b", "c"];
    expect(dueCount(store, ids, T0)).toBe(3);
    const q = buildReviewQueue(store, ids, T0);
    // "b" is 5 days overdue → first; new cards ("a","c") are due exactly at T0,
    // ordered stably by id.
    expect(q[0]).toBe("b");
    expect(q).toEqual(["b", "a", "c"]);
  });

  it("ignores store rows that aren't in the catalog", () => {
    const store = { cards: { stale: newCard(T0) }, reviews: 0 };
    expect(buildReviewQueue(store, ["fresh"], T0)).toEqual(["fresh"]);
  });
});

describe("SRS store — graduation (long-term retention)", () => {
  it("counts cards whose interval has reached the graduation bar", () => {
    const store = {
      cards: {
        a: { ...newCard(T0), intervalDays: 30 },
        b: { ...newCard(T0), intervalDays: 6 },
      },
      reviews: 2,
    };
    expect(graduatedCount(store, ["a", "b"], 21)).toBe(1);
    expect(isGraduated(store, "a", 21)).toBe(true);
    expect(isGraduated(store, "b", 21)).toBe(false);
  });
});

describe("SRS store — coercion", () => {
  it("normalizes absent / partial stores", () => {
    expect(coerceSrsStore(undefined)).toEqual({ cards: {}, reviews: 0 });
    expect(coerceSrsStore({ cards: { a: newCard(T0) } } as never).reviews).toBe(0);
  });
});
