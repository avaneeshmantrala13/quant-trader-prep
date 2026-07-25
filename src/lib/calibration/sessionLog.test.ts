import { describe, expect, it } from "vitest";
import {
  appendPair,
  pooledPairs,
  topicPairs,
  type TopicCalibrationLog,
} from "./sessionLog";

describe("sessionLog ring buffer", () => {
  it("appends immutably without mutating the input log", () => {
    const log: TopicCalibrationLog = {};
    const next = appendPair(log, "a", { pred: 0.8, outcome: 1 });
    expect(log).toEqual({}); // untouched
    expect(topicPairs(next, "a")).toEqual([{ pred: 0.8, outcome: 1 }]);
  });

  it("caps a topic's history at the most-recent N", () => {
    let log: TopicCalibrationLog = {};
    for (let i = 0; i < 5; i++) {
      log = appendPair(log, "a", { pred: i / 10, outcome: 1 }, 3);
    }
    const pairs = topicPairs(log, "a");
    expect(pairs).toHaveLength(3);
    // Kept the last three (preds 0.2, 0.3, 0.4).
    expect(pairs.map((p) => p.pred)).toEqual([0.2, 0.3, 0.4]);
  });

  it("keeps per-topic logs separate and pools across topics", () => {
    let log: TopicCalibrationLog = {};
    log = appendPair(log, "a", { pred: 0.5, outcome: 0 });
    log = appendPair(log, "b", { pred: 0.9, outcome: 1 });
    expect(topicPairs(log, "a")).toHaveLength(1);
    expect(topicPairs(log, "b")).toHaveLength(1);
    expect(topicPairs(log, "missing")).toEqual([]);
    expect(pooledPairs(log)).toHaveLength(2);
  });
});
