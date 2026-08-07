import { describe, it, expect } from "vitest";
import {
  buildStockmasterTrials,
  classify,
  createStockmasterSession,
  currentTrial,
  DEFAULT_STOCKMASTER_COUNT,
  isGoTick,
  recordAndAdvance,
  scoreOutcome,
  STOCK_POINTS,
  summarizeStockmaster,
  trialsFor,
} from "./engine";

/**
 * STOCKMASTER engine: the go/no-go rule, outcome classification + scoring, a
 * deterministic mixed trial stream, and winnability (a fast, disciplined player
 * beats both the always-react and always-withhold strategies).
 */

describe("go/no-go rule", () => {
  it("a go tick is arrow up AND signal green", () => {
    expect(isGoTick("up", "green")).toBe(true);
    expect(isGoTick("up", "red")).toBe(false);
    expect(isGoTick("down", "green")).toBe(false);
    expect(isGoTick("down", "red")).toBe(false);
  });
});

describe("classification + scoring", () => {
  const go = { id: 0, arrow: "up", signal: "green", isGo: true } as const;
  const noGo = { id: 1, arrow: "down", signal: "green", isGo: false } as const;

  it("classifies the four outcomes", () => {
    expect(classify(go, true)).toBe("hit");
    expect(classify(go, false)).toBe("miss");
    expect(classify(noGo, false)).toBe("correct-reject");
    expect(classify(noGo, true)).toBe("false-alarm");
  });

  it("scores a fast hit best and penalizes false alarms + misses", () => {
    expect(scoreOutcome("hit", 0)).toBe(STOCK_POINTS.hitBase + STOCK_POINTS.hitSpeedBonus);
    expect(scoreOutcome("hit", 1)).toBe(STOCK_POINTS.hitBase);
    expect(scoreOutcome("correct-reject", 0)).toBe(STOCK_POINTS.correctReject);
    expect(scoreOutcome("miss", 0)).toBe(STOCK_POINTS.miss);
    expect(scoreOutcome("false-alarm", 0)).toBe(STOCK_POINTS.falseAlarm);
  });
});

describe("trial stream", () => {
  it("is deterministic and the default length", () => {
    expect(buildStockmasterTrials(3)).toEqual(buildStockmasterTrials(3));
    expect(buildStockmasterTrials(3)).toHaveLength(DEFAULT_STOCKMASTER_COUNT);
  });

  it("contains both go and no-go trials", () => {
    const trials = buildStockmasterTrials(3, 40);
    expect(trials.some((t) => t.isGo)).toBe(true);
    expect(trials.some((t) => !t.isGo)).toBe(true);
  });
});

describe("session", () => {
  it("records responses forward and finishes at the end", () => {
    let s = createStockmasterSession({ seed: 5, count: 3 });
    for (let i = 0; i < 3; i++) {
      const t = currentTrial(s)!;
      s = recordAndAdvance(s, t.isGo, 0);
    }
    expect(s.status).toBe("finished");
    const sum = summarizeStockmaster(s);
    expect(sum.misses).toBe(0);
    expect(sum.falseAlarms).toBe(0);
  });
});

describe("winnability", () => {
  const seed = 77;
  const count = 30;

  function play(strategy: (isGo: boolean) => boolean, frac: number): number {
    let s = createStockmasterSession({ seed, count });
    const trials = trialsFor(s);
    for (let i = 0; i < count; i++) {
      s = recordAndAdvance(s, strategy(trials[i].isGo), frac);
    }
    return summarizeStockmaster(s).score;
  }

  it("a perfect, instant player maxes the score", () => {
    let s = createStockmasterSession({ seed, count });
    const trials = trialsFor(s);
    for (let i = 0; i < count; i++) s = recordAndAdvance(s, trials[i].isGo, 0);
    const sum = summarizeStockmaster(s);
    expect(sum.score).toBe(sum.maxScore);
    expect(sum.accuracyPct).toBe(100);
  });

  it("perfect discipline beats always-react and always-withhold", () => {
    const perfect = play((isGo) => isGo, 0);
    const alwaysReact = play(() => true, 0);
    const alwaysWithhold = play(() => false, 0);
    expect(perfect).toBeGreaterThan(alwaysReact);
    expect(perfect).toBeGreaterThan(alwaysWithhold);
  });
});
