import { describe, expect, it } from "vitest";
import {
  firstIncompleteTopic,
  groupLevelsIntoTopics,
  type TopicLevel,
} from "./topics";
import { probabilityTrack } from "@/content/probability/levels";
import { mentalMathTrack } from "@/content/mentalMath/levels";

/**
 * Topic grouping = the data-driven basis of the in-page topic selector. A topic
 * is a maximal CONTIGUOUS run of levels sharing the same `section`, in data
 * (difficulty) order, so the topic's 1-based position is its "Level N" rank.
 */

// Two labeled sections (A: a1..a3, B: b1,b2) + a trailing UNLABELED run.
const LABELED: TopicLevel[] = [
  { section: "A" },
  { section: "A" },
  { section: "A" },
  { section: "B" },
  { section: "B" },
  {},
  {},
];

describe("groupLevelsIntoTopics", () => {
  it("splits into maximal contiguous runs, in order, with 1-based ranks", () => {
    const topics = groupLevelsIntoTopics(LABELED);
    expect(topics).toHaveLength(3);
    expect(topics.map((t) => [t.rank, t.label, t.startIndex, t.endIndex])).toEqual(
      [
        [1, "A", 0, 2],
        [2, "B", 3, 4],
        [3, "Section 3", 5, 6],
      ],
    );
    expect(topics.map((t) => t.count)).toEqual([3, 2, 2]);
  });

  it("assigns unique, URL-safe slugs", () => {
    const topics = groupLevelsIntoTopics(LABELED);
    const slugs = topics.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs[0]).toBe("a");
  });

  it("collapses a section-less track to a single topic", () => {
    const single = groupLevelsIntoTopics([{}, {}, {}]);
    expect(single).toHaveLength(1);
    expect(single[0]).toMatchObject({ rank: 1, startIndex: 0, endIndex: 2 });
  });

  it("re-splits when a section value REPEATS non-contiguously", () => {
    // A, A, B, A → three topics (the trailing A is a separate run).
    const topics = groupLevelsIntoTopics([
      { section: "A" },
      { section: "A" },
      { section: "B" },
      { section: "A" },
    ]);
    expect(topics.map((t) => t.label)).toEqual(["A", "B", "A"]);
    // Non-contiguous same-name runs still get distinct slugs.
    expect(new Set(topics.map((t) => t.slug)).size).toBe(3);
  });

  it("returns [] for an empty level list", () => {
    expect(groupLevelsIntoTopics([])).toEqual([]);
  });
});

describe("firstIncompleteTopic (default selection)", () => {
  const topics = groupLevelsIntoTopics(LABELED);

  it("fresh profile → the first topic", () => {
    expect(firstIncompleteTopic(topics, () => false)?.rank).toBe(1);
  });

  it("skips fully-mastered leading topics to the current one", () => {
    // Master all of A (indices 0..2) → current in-progress topic is B.
    const masteredA = (i: number) => i <= 2;
    expect(firstIncompleteTopic(topics, masteredA)?.rank).toBe(2);
  });

  it("all mastered → falls back to the first topic", () => {
    expect(firstIncompleteTopic(topics, () => true)?.rank).toBe(1);
  });

  it("no topics → undefined", () => {
    expect(firstIncompleteTopic([], () => false)).toBeUndefined();
  });
});

describe("integration with real tracks", () => {
  it("Probability/Math groups into the finalized EASIEST→HARDEST topic order", () => {
    const topics = groupLevelsIntoTopics(probabilityTrack.levels);
    expect(topics.map((t) => t.label)).toEqual([
      "Core Probability",
      "Combinatorial Analysis",
      "Geometric Probability",
      "Conditional Probability",
      "Expected Value",
      "Betting & Sizing",
      "Order Statistics",
      "Variance, Covariance & the CLT",
      "Markov Chains",
      "Game Theory & Puzzles",
    ]);
    // Ranks are 1..10 in data order.
    expect(topics.map((t) => t.rank)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
    // Topics partition the track with no gaps/overlaps.
    expect(topics[0].startIndex).toBe(0);
    expect(topics[topics.length - 1].endIndex).toBe(
      probabilityTrack.levels.length - 1,
    );
    topics.slice(1).forEach((t, i) => {
      expect(t.startIndex).toBe(topics[i].endIndex + 1);
    });
  });

  it("Mental Math (no sections) collapses to a single topic (no selector)", () => {
    const topics = groupLevelsIntoTopics(mentalMathTrack.levels);
    expect(topics).toHaveLength(1);
  });
});
