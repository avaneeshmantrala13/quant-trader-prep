import { describe, expect, it } from "vitest";
import type { TopicVerdict } from "@/lib/mastery/verdict";
import { rankStrengths, rankWeaknesses, reviewsDue } from "./ranking";

function v(partial: Partial<TopicVerdict>): TopicVerdict {
  return {
    topicKey: "t",
    state: "UNCERTAIN",
    mean: 0.5,
    lo: 0.4,
    hi: 0.6,
    n: 5,
    theta: 0,
    namedMisconceptions: [],
    mastered: false,
    ...partial,
  };
}

const NOW = "2026-01-01T00:00:00.000Z";
const BEFORE = "2025-12-31T00:00:00.000Z";
const AFTER = "2026-01-02T00:00:00.000Z";

describe("rankWeaknesses", () => {
  it("sorts ascending by CI_low (worst-most-confident first)", () => {
    const ranked = rankWeaknesses([
      v({ topicKey: "mid", lo: 0.5 }),
      v({ topicKey: "worst", lo: 0.2 }),
      v({ topicKey: "best", lo: 0.7 }),
    ]);
    expect(ranked.map((x) => x.topicKey)).toEqual(["worst", "mid", "best"]);
  });

  it("tie-breaks equal lo by higher reliability gap, then misconception count", () => {
    const ranked = rankWeaknesses([
      v({ topicKey: "lowGap", lo: 0.4, reliabilityGap: 0.05 }),
      v({ topicKey: "highGap", lo: 0.4, reliabilityGap: 0.3 }),
      v({
        topicKey: "midGapManyMisc",
        lo: 0.4,
        reliabilityGap: 0.05,
        namedMisconceptions: ["t::a", "t::b"],
      }),
    ]);
    // highGap first (most overconfident); among equal gaps, more misconceptions wins.
    expect(ranked.map((x) => x.topicKey)).toEqual([
      "highGap",
      "midGapManyMisc",
      "lowGap",
    ]);
  });

  it("does not mutate the input array", () => {
    const input = [v({ topicKey: "a", lo: 0.6 }), v({ topicKey: "b", lo: 0.2 })];
    const before = input.map((x) => x.topicKey);
    rankWeaknesses(input);
    expect(input.map((x) => x.topicKey)).toEqual(before);
  });
});

describe("rankStrengths", () => {
  it("includes only STRONG verdicts, descending by CI_low", () => {
    const ranked = rankStrengths([
      v({ topicKey: "strongHi", state: "STRONG", lo: 0.9 }),
      v({ topicKey: "weak", state: "WEAK", lo: 0.95 }),
      v({ topicKey: "strongLo", state: "STRONG", lo: 0.82 }),
      v({ topicKey: "uncertain", state: "UNCERTAIN", lo: 0.99 }),
    ]);
    expect(ranked.map((x) => x.topicKey)).toEqual(["strongHi", "strongLo"]);
  });
});

describe("reviewsDue", () => {
  it("filters to topics whose reviewDue ≤ now, earliest-due first", () => {
    const due = reviewsDue(
      [
        v({ topicKey: "overdue", reviewDue: BEFORE }),
        v({ topicKey: "future", reviewDue: AFTER }),
        v({ topicKey: "exactly", reviewDue: NOW }),
        v({ topicKey: "unscheduled" }),
      ],
      NOW,
    );
    expect(due.map((x) => x.topicKey)).toEqual(["overdue", "exactly"]);
  });
});
