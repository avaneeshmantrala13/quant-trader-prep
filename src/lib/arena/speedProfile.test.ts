import { describe, expect, it } from "vitest";
import type { KeyValueStore } from "./localPb";
import {
  medianSolveAcross,
  readSpeedProfile,
  recordSpeedRun,
  type SpeedRun,
} from "./speedProfile";

function memStore(): KeyValueStore {
  const m = new Map<string, string>();
  return {
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    setItem: (k, v) => {
      m.set(k, v);
    },
  };
}

const BOARD = "optiver";
const CFG = "cfgA";

const run = (p: Partial<SpeedRun>): SpeedRun => ({
  medianSolveMs: p.medianSolveMs ?? 4000,
  accuracy: p.accuracy ?? 0.9,
  attempted: p.attempted ?? 30,
  budgetMs: p.budgetMs ?? 6000,
  atMs: p.atMs ?? 1000,
});

describe("speed profile persistence", () => {
  it("returns null before any run", () => {
    expect(readSpeedProfile(memStore(), BOARD, CFG)).toBeNull();
  });

  it("accumulates runs and keeps the budget when adaptive is off", () => {
    const store = memStore();
    recordSpeedRun(store, BOARD, CFG, run({ atMs: 1 }), { adaptive: false });
    const p = recordSpeedRun(store, BOARD, CFG, run({ atMs: 2 }), {
      adaptive: false,
    });
    expect(p.runs).toHaveLength(2);
    expect(p.budgetMs).toBe(6000); // unchanged without adaptive
  });

  it("tightens the budget across runs when adaptive + accuracy is stable", () => {
    const store = memStore();
    const p1 = recordSpeedRun(
      store,
      BOARD,
      CFG,
      run({ accuracy: 0.9, attempted: 40 }),
      { adaptive: true },
    );
    expect(p1.budgetMs).toBe(5400); // 6000 × 0.9

    const p2 = recordSpeedRun(
      store,
      BOARD,
      CFG,
      run({ accuracy: 0.92, attempted: 40 }),
      { adaptive: true },
    );
    expect(p2.budgetMs).toBe(Math.round(5400 * 0.9)); // 4860 — compounds
  });

  it("does not tighten when accuracy is below target", () => {
    const store = memStore();
    const p = recordSpeedRun(
      store,
      BOARD,
      CFG,
      run({ accuracy: 0.6, attempted: 40 }),
      { adaptive: true },
    );
    expect(p.budgetMs).toBe(6000);
  });
});

describe("medianSolveAcross", () => {
  it("is null with no profile / no runs", () => {
    expect(medianSolveAcross(null)).toBeNull();
    expect(medianSolveAcross({ budgetMs: 6000, runs: [] })).toBeNull();
  });

  it("takes the median of per-run medians", () => {
    const profile = {
      budgetMs: 6000,
      runs: [
        run({ medianSolveMs: 3000 }),
        run({ medianSolveMs: 5000 }),
        run({ medianSolveMs: 4000 }),
      ],
    };
    expect(medianSolveAcross(profile)).toBe(4000);
  });
});
