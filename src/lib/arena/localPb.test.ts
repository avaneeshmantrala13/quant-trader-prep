import { describe, expect, it } from "vitest";
import {
  readHistory,
  readLocalPb,
  recordLocalRun,
  trailing7DayMedian,
  type KeyValueStore,
} from "./localPb";

/** In-memory KeyValueStore so the pure logic is tested with no real storage. */
function memStore(): KeyValueStore {
  const m = new Map<string, string>();
  return {
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    setItem: (k, v) => {
      m.set(k, v);
    },
  };
}

const BOARD = "zetamac";
const CFG = "cfgA";
const DAY = 24 * 60 * 60 * 1000;

describe("local personal best", () => {
  it("returns null before any run", () => {
    expect(readLocalPb(memStore(), BOARD, CFG)).toBeNull();
  });

  it("records the first run as a new best", () => {
    const store = memStore();
    const { pb, isNewBest } = recordLocalRun(store, BOARD, CFG, 40, 1000);
    expect(isNewBest).toBe(true);
    expect(pb).toEqual({ bestScore: 40, bestAtMs: 1000, attempts: 1 });
  });

  it("keeps the best across runs and counts attempts", () => {
    const store = memStore();
    recordLocalRun(store, BOARD, CFG, 40, 1000);
    const r2 = recordLocalRun(store, BOARD, CFG, 55, 2000);
    expect(r2.isNewBest).toBe(true);
    const r3 = recordLocalRun(store, BOARD, CFG, 50, 3000);
    expect(r3.isNewBest).toBe(false);
    const pb = readLocalPb(store, BOARD, CFG)!;
    expect(pb.bestScore).toBe(55);
    expect(pb.bestAtMs).toBe(2000);
    expect(pb.attempts).toBe(3);
  });

  it("keeps separate PBs per board+config", () => {
    const store = memStore();
    recordLocalRun(store, BOARD, CFG, 40, 1000);
    recordLocalRun(store, "optiver", CFG, 10, 1000);
    expect(readLocalPb(store, BOARD, CFG)!.bestScore).toBe(40);
    expect(readLocalPb(store, "optiver", CFG)!.bestScore).toBe(10);
  });
});

describe("history + 7-day trend", () => {
  it("accumulates run history", () => {
    const store = memStore();
    recordLocalRun(store, BOARD, CFG, 40, 1000);
    recordLocalRun(store, BOARD, CFG, 42, 2000);
    expect(readHistory(store, BOARD, CFG)).toEqual([
      { score: 40, atMs: 1000 },
      { score: 42, atMs: 2000 },
    ]);
  });

  it("trailing 7-day median only counts in-window runs", () => {
    const store = memStore();
    const now = 100 * DAY;
    recordLocalRun(store, BOARD, CFG, 10, now - 10 * DAY); // out of window
    recordLocalRun(store, BOARD, CFG, 30, now - 2 * DAY);
    recordLocalRun(store, BOARD, CFG, 50, now - 1 * DAY);
    expect(trailing7DayMedian(store, BOARD, CFG, now)).toBe(40); // median(30,50)
  });

  it("returns null when there are no in-window runs", () => {
    const store = memStore();
    recordLocalRun(store, BOARD, CFG, 10, 0);
    expect(trailing7DayMedian(store, BOARD, CFG, 100 * DAY)).toBeNull();
  });
});
