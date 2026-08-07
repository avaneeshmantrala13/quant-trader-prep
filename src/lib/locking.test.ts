import { describe, expect, it } from "vitest";
import {
  computeLockStates,
  isFirstOfSection,
  isLevelUnlockedBySection,
  levelLockState,
  type LockLevel,
} from "./locking";
import { probabilityTrack } from "@/content/probability/levels";
import { mentalMathTrack } from "@/content/mentalMath/levels";

/**
 * Per-section progression / unlock rule (see `@/lib/locking`). These tests pin
 * the NEW behavior: the first level of every topic/section is always unlocked,
 * while harder levels of a topic stay locked until the previous level in that
 * SAME section is mastered — and mastering one topic never gates another.
 */

// A synthetic track with two labeled sections (A: a1,a2,a3) and (B: b1,b2),
// plus a trailing UNLABELED run (u1,u2) to exercise the fallback.
const LABELED: LockLevel[] = [
  { id: "a1", section: "A" },
  { id: "a2", section: "A" },
  { id: "a3", section: "A" },
  { id: "b1", section: "B" },
  { id: "b2", section: "B" },
  { id: "u1" },
  { id: "u2" },
];

/** Build an `isMastered` predicate from a set of mastered ids. */
const mastered = (...ids: string[]) => {
  const set = new Set(ids);
  return (id: string) => set.has(id);
};

describe("isFirstOfSection", () => {
  it("index 0 always starts a section", () => {
    expect(isFirstOfSection(LABELED, 0)).toBe(true);
  });

  it("true only at a change in `section` value", () => {
    // a2, a3 continue section A; b1 starts B; b2 continues B.
    expect(isFirstOfSection(LABELED, 1)).toBe(false); // a2
    expect(isFirstOfSection(LABELED, 2)).toBe(false); // a3
    expect(isFirstOfSection(LABELED, 3)).toBe(true); // b1 (A -> B)
    expect(isFirstOfSection(LABELED, 4)).toBe(false); // b2
  });

  it("treats the start of an unlabeled run as a section start", () => {
    expect(isFirstOfSection(LABELED, 5)).toBe(true); // b2 (B) -> u1 (undefined)
    expect(isFirstOfSection(LABELED, 6)).toBe(false); // u1 -> u2 both undefined
  });
});

describe("per-section unlock rule", () => {
  it("first level of EVERY section is unlocked from a fresh profile", () => {
    const none = mastered();
    // a1 (first of A), b1 (first of B), u1 (first of unlabeled run) are open.
    expect(isLevelUnlockedBySection(LABELED, 0, none)).toBe(true); // a1
    expect(isLevelUnlockedBySection(LABELED, 3, none)).toBe(true); // b1
    expect(isLevelUnlockedBySection(LABELED, 5, none)).toBe(true); // u1
  });

  it("second level of a section stays LOCKED until its first is mastered", () => {
    // Fresh: a2 locked.
    expect(isLevelUnlockedBySection(LABELED, 1, mastered())).toBe(false);
    // Master a1 -> a2 unlocks, a3 still locked.
    expect(isLevelUnlockedBySection(LABELED, 1, mastered("a1"))).toBe(true);
    expect(isLevelUnlockedBySection(LABELED, 2, mastered("a1"))).toBe(false);
    // Master a1+a2 -> a3 unlocks.
    expect(isLevelUnlockedBySection(LABELED, 2, mastered("a1", "a2"))).toBe(
      true,
    );
  });

  it("mastering topic A does NOT affect topic B's gating", () => {
    // Fully mastering section A leaves B unchanged: b1 open (always), b2 locked.
    const m = mastered("a1", "a2", "a3");
    expect(isLevelUnlockedBySection(LABELED, 3, m)).toBe(true); // b1
    expect(isLevelUnlockedBySection(LABELED, 4, m)).toBe(false); // b2 needs b1
    // And mastering B does not unlock A's harder levels.
    const mb = mastered("b1", "b2");
    expect(isLevelUnlockedBySection(LABELED, 1, mb)).toBe(false); // a2 needs a1
  });

  it("levelLockState reports mastered / unlocked / locked", () => {
    const m = mastered("a1");
    expect(levelLockState(LABELED, 0, m)).toBe("mastered"); // a1 itself
    expect(levelLockState(LABELED, 1, m)).toBe("unlocked"); // a2 (prev a1 mastered)
    expect(levelLockState(LABELED, 2, m)).toBe("locked"); // a3 (prev a2 not mastered)
  });

  it("computeLockStates returns a state per level, in order", () => {
    const states = computeLockStates(LABELED, mastered());
    expect(states).toEqual([
      "unlocked", // a1 first of A
      "locked", // a2
      "locked", // a3
      "unlocked", // b1 first of B
      "locked", // b2
      "unlocked", // u1 first of unlabeled run
      "locked", // u2
    ]);
  });
});

describe("diagnostic-seeded low-confidence unlock predicate (Part B)", () => {
  it("opens a whole topic's later levels ahead of mastery, without leaking to others", () => {
    // Topic A is diagnostic-unlocked; a2/a3 open even though a1 isn't mastered.
    const seedUnlocked = (id: string) => id.startsWith("a");
    expect(isLevelUnlockedBySection(LABELED, 1, mastered(), seedUnlocked)).toBe(
      true,
    ); // a2
    expect(isLevelUnlockedBySection(LABELED, 2, mastered(), seedUnlocked)).toBe(
      true,
    ); // a3
    // Topic B is NOT seed-unlocked ⇒ b2 stays locked behind b1.
    expect(isLevelUnlockedBySection(LABELED, 4, mastered(), seedUnlocked)).toBe(
      false,
    ); // b2
  });

  it("re-locks automatically once the predicate flips false (the swing)", () => {
    const before = computeLockStates(LABELED, mastered(), (id) =>
      id.startsWith("a"),
    );
    expect(before.slice(0, 3)).toEqual(["unlocked", "unlocked", "unlocked"]);
    // The topic swung back under the bar ⇒ predicate now false ⇒ a2/a3 re-lock.
    const after = computeLockStates(LABELED, mastered(), () => false);
    expect(after.slice(0, 3)).toEqual(["unlocked", "locked", "locked"]);
  });

  it("defaults to no seed unlocks (existing mastery-only gating unchanged)", () => {
    expect(isLevelUnlockedBySection(LABELED, 1, mastered())).toBe(false); // a2
    expect(computeLockStates(LABELED, mastered())).toEqual([
      "unlocked",
      "locked",
      "locked",
      "unlocked",
      "locked",
      "unlocked",
      "locked",
    ]);
  });
});

describe("unlabeled tracks behave sequentially with first unlocked", () => {
  it("first level open, the rest gate on the immediately-previous level", () => {
    const seq: LockLevel[] = [{ id: "x1" }, { id: "x2" }, { id: "x3" }];
    // Fresh: only the first is open.
    expect(computeLockStates(seq, mastered())).toEqual([
      "unlocked",
      "locked",
      "locked",
    ]);
    // Master x1 -> x2 opens, x3 still locked (strict sequential).
    expect(computeLockStates(seq, mastered("x1"))).toEqual([
      "mastered",
      "unlocked",
      "locked",
    ]);
  });
});

describe("integration with real tracks", () => {
  it("Probability track: first level of each section unlocked from scratch", () => {
    const levels = probabilityTrack.levels;
    const none = () => false;
    levels.forEach((_level, i) => {
      const unlocked = isLevelUnlockedBySection(levels, i, none);
      // A level should be unlocked from a fresh profile IFF it is the first of
      // its section.
      expect(unlocked).toBe(isFirstOfSection(levels, i));
    });
    // Sanity: there is more than one section, so more than one level is open.
    const openCount = levels.filter((_, i) =>
      isLevelUnlockedBySection(levels, i, none),
    ).length;
    expect(openCount).toBeGreaterThan(1);
  });

  it("Mental Math (no sections): only the very first level is unlocked from scratch", () => {
    const levels = mentalMathTrack.levels;
    const none = () => false;
    const openCount = levels.filter((_, i) =>
      isLevelUnlockedBySection(levels, i, none),
    ).length;
    expect(openCount).toBe(1);
    expect(isLevelUnlockedBySection(levels, 0, none)).toBe(true);
  });
});
