import { describe, expect, it } from "vitest";
import { misconceptionKey, topicKeyOf } from "@/lib/mastery/topicKey";
import { MISCONCEPTION } from "@/lib/tutor/misconception";
import {
  REPEATED_MISTAKE_THRESHOLD,
  bumpTopicMisconceptions,
  describeRepeatedMistake,
  repeatedMistakesForTopic,
  type MisconceptionTally,
} from "./misconceptionTally";

const CORE = topicKeyOf("probability", "Core Probability");
const OVERLAP = MISCONCEPTION.orMeansAddNoOverlap; // has a human label
const AND_ADD = MISCONCEPTION.andMeansAdd;

describe("bumpTopicMisconceptions", () => {
  it("increments RAW per-topic counts, stripping the topicKey:: prefix to the bare tag", () => {
    const key = misconceptionKey(CORE, OVERLAP); // namespaced
    let tally: MisconceptionTally | undefined;
    tally = bumpTopicMisconceptions(tally, CORE, [key]);
    tally = bumpTopicMisconceptions(tally, CORE, [key]);
    expect(tally[CORE][OVERLAP]).toBe(2);
  });

  it("is a no-op (fresh clone) for a correct answer with no misconceptions", () => {
    const before: MisconceptionTally = { [CORE]: { [OVERLAP]: 3 } };
    const after = bumpTopicMisconceptions(before, CORE, []);
    expect(after).toEqual(before);
    expect(after).not.toBe(before); // immutable: returns a new object
  });

  it("never mutates the input tally", () => {
    const before: MisconceptionTally = { [CORE]: { [OVERLAP]: 1 } };
    const snapshot = JSON.parse(JSON.stringify(before));
    bumpTopicMisconceptions(before, CORE, [misconceptionKey(CORE, OVERLAP)]);
    expect(before).toEqual(snapshot);
  });

  it("accumulates several distinct tags in the same topic bucket", () => {
    let tally = bumpTopicMisconceptions(undefined, CORE, [
      misconceptionKey(CORE, OVERLAP),
      misconceptionKey(CORE, AND_ADD),
    ]);
    tally = bumpTopicMisconceptions(tally, CORE, [misconceptionKey(CORE, OVERLAP)]);
    expect(tally[CORE]).toEqual({ [OVERLAP]: 2, [AND_ADD]: 1 });
  });
});

describe("repeatedMistakesForTopic", () => {
  it("surfaces only tags at/above the threshold, ordered by count desc", () => {
    const tally: MisconceptionTally = {
      [CORE]: { [OVERLAP]: 4, [AND_ADD]: 3, [MISCONCEPTION.complementConfusion]: 2 },
    };
    const out = repeatedMistakesForTopic(tally, CORE);
    expect(REPEATED_MISTAKE_THRESHOLD).toBe(3);
    expect(out.map((m) => m.tag)).toEqual([OVERLAP, AND_ADD]);
    expect(out[0].count).toBe(4);
    // Below-threshold tag is excluded.
    expect(out.map((m) => m.tag)).not.toContain(MISCONCEPTION.complementConfusion);
  });

  it("excludes non-describable fallback tags (idx:/err:) — we never name an opaque key", () => {
    const tally: MisconceptionTally = {
      [CORE]: { "idx:2": 9, "err:0.5": 5, [OVERLAP]: 3 },
    };
    const out = repeatedMistakesForTopic(tally, CORE);
    expect(out.map((m) => m.tag)).toEqual([OVERLAP]);
  });

  it("returns an empty list for an unknown topic or empty tally", () => {
    expect(repeatedMistakesForTopic(undefined, CORE)).toEqual([]);
    expect(repeatedMistakesForTopic({}, CORE)).toEqual([]);
  });

  it("honors a custom threshold", () => {
    const tally: MisconceptionTally = { [CORE]: { [OVERLAP]: 2 } };
    expect(repeatedMistakesForTopic(tally, CORE, 2)).toHaveLength(1);
    expect(repeatedMistakesForTopic(tally, CORE, 3)).toHaveLength(0);
  });

  it("attaches a human-readable label and plain sentence", () => {
    const tally: MisconceptionTally = { [CORE]: { [OVERLAP]: 4 } };
    const [m] = repeatedMistakesForTopic(tally, CORE);
    expect(m.label).toMatch(/overlap/i);
    expect(describeRepeatedMistake(m)).toContain("4 times");
  });
});
