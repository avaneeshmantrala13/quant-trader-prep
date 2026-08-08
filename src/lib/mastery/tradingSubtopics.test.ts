import { describe, expect, it } from "vitest";
import type { TopicMastery } from "@/types/mastery";
import { deriveVerdict } from "@/lib/mastery/verdict";
import { MASTERY_BAR } from "@/lib/mastery/config";
import { SKILL_GRAPH } from "@/lib/roadmap/skillGraph";
import {
  TRADING_SUBTOPICS,
  TRADING_SUBTOPIC_KEYS,
  buildTradingSubtopicAttempt,
  clamp01,
  foldTradingSubtopic,
  isTradingSubtopic,
  tradingRoundCredit,
  tradingSubtopicByGame,
  tradingSubtopicByKey,
  type TradingGameId,
} from "./tradingSubtopics";

/**
 * The trading-intuition subtopic DECOMPOSITION — the single source of truth that
 * maps each Game-OA battery game → its own competency subtopic. These tests lock
 * the mapping (1:1, unique keys), the KST registration (every subtopic is a real
 * external SKILL_GRAPH node whose prereqs are real non-external nodes), and the
 * per-round credit/fold path used by both the battery and drilling.
 */

const GAME_IDS: TradingGameId[] = [
  "make-market",
  "trading-floor",
  "cards-mm",
  "next-card",
  "arbitrage",
  "fermi",
  "numberlogic",
  "beat-the-odds",
  "stockmaster",
  "number-box",
  "shape-shift",
];

describe("tradingSubtopics — the decomposition mapping", () => {
  it("has one subtopic per battery game with unique keys and game ids", () => {
    expect(TRADING_SUBTOPICS).toHaveLength(GAME_IDS.length);
    const keys = new Set(TRADING_SUBTOPICS.map((s) => s.key));
    const games = new Set(TRADING_SUBTOPICS.map((s) => s.gameId));
    expect(keys.size).toBe(TRADING_SUBTOPICS.length);
    expect(games.size).toBe(TRADING_SUBTOPICS.length);
    expect([...games].sort()).toEqual([...GAME_IDS].sort());
    expect(TRADING_SUBTOPIC_KEYS).toEqual(TRADING_SUBTOPICS.map((s) => s.key));
  });

  it("every key is `competency::<slug>`", () => {
    for (const s of TRADING_SUBTOPICS) {
      expect(s.key.startsWith("competency::")).toBe(true);
    }
  });

  it("round-trips by game and by key", () => {
    for (const s of TRADING_SUBTOPICS) {
      expect(tradingSubtopicByGame(s.gameId).key).toBe(s.key);
      expect(tradingSubtopicByKey(s.key)?.gameId).toBe(s.gameId);
      expect(isTradingSubtopic(s.key)).toBe(true);
    }
    expect(isTradingSubtopic("competency::not-a-subtopic")).toBe(false);
    expect(tradingSubtopicByKey("nope")).toBeUndefined();
    expect(() => tradingSubtopicByGame("bogus" as TradingGameId)).toThrow();
  });
});

describe("tradingSubtopics — KST node registration", () => {
  const byKey = new Map(SKILL_GRAPH.map((n) => [n.topicKey, n]));

  it("registers each subtopic as an external competency node", () => {
    for (const s of TRADING_SUBTOPICS) {
      const node = byKey.get(s.key);
      expect(node, `missing node for ${s.key}`).toBeTruthy();
      expect(node!.external).toBe(true);
      expect(node!.trackId).toBe("competency");
      expect(node!.prereqs).toEqual(s.prereqs);
    }
  });

  it("rests every subtopic on REAL, non-external prerequisite nodes", () => {
    for (const s of TRADING_SUBTOPICS) {
      for (const pre of s.prereqs) {
        const preNode = byKey.get(pre);
        expect(preNode, `prereq ${pre} of ${s.key} is not a node`).toBeTruthy();
        expect(preNode!.external ?? false).toBe(false);
      }
    }
  });
});

describe("tradingSubtopics — per-round credit + fold", () => {
  it("clamps credit into [0,1] and flags correctness at full credit", () => {
    expect(clamp01(1.5)).toBe(1);
    expect(clamp01(-2)).toBe(0);
    const key = TRADING_SUBTOPIC_KEYS[0];
    const full = buildTradingSubtopicAttempt(key, 1, "t");
    expect(full.topicKey).toBe(key);
    expect(full.correct).toBe(true);
    expect(full.credit).toBe(1);
    const partial = buildTradingSubtopicAttempt(key, 0.5, "t");
    expect(partial.correct).toBe(false);
    expect(partial.credit).toBe(0.5);
    // Out-of-range credit is clamped by the builder.
    expect(buildTradingSubtopicAttempt(key, 9, "t").credit).toBe(1);
  });

  it("maps binary + fractional round outcomes to credit", () => {
    expect(tradingRoundCredit(true)).toBe(1);
    expect(tradingRoundCredit(false)).toBe(0);
    expect(tradingRoundCredit(false, 0.5)).toBe(0.5);
    expect(tradingRoundCredit(true, 1.7)).toBe(1);
  });

  it("folds clean rounds to mastery over ~16 rounds, but not a thin streak", () => {
    const key = TRADING_SUBTOPIC_KEYS[0];
    let m: TopicMastery | undefined;
    for (let i = 0; i < 16; i++) m = foldTradingSubtopic(m, key, 1, "t");
    expect(deriveVerdict(m, key).lo).toBeGreaterThanOrEqual(MASTERY_BAR);

    let thin: TopicMastery | undefined;
    for (let i = 0; i < 5; i++) thin = foldTradingSubtopic(thin, key, 1, "t");
    expect(deriveVerdict(thin, key).mastered).toBe(false);
  });
});
