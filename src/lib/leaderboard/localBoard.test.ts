import { describe, expect, it } from "vitest";
import {
  boardKey,
  compareScores,
  rankScores,
  topN,
  bestScore,
  readLocalBoard,
  readLocalScores,
  submitLocalScore,
  type KeyValueStore,
  type LocalScore,
} from "./localBoard";

/** A trivial in-memory KeyValueStore so the ranking logic needs no real DOM. */
function memStore(): KeyValueStore & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
  };
}

describe("compareScores — higher is better, earlier breaks ties", () => {
  it("orders a higher score ahead of a lower one", () => {
    expect(compareScores({ score: 10, atMs: 5 }, { score: 4, atMs: 1 })).toBeLessThan(0);
    expect(compareScores({ score: 4, atMs: 1 }, { score: 10, atMs: 5 })).toBeGreaterThan(0);
  });

  it("breaks an exact tie toward the earlier timestamp", () => {
    expect(compareScores({ score: 7, atMs: 100 }, { score: 7, atMs: 200 })).toBeLessThan(0);
    expect(compareScores({ score: 7, atMs: 200 }, { score: 7, atMs: 100 })).toBeGreaterThan(0);
  });

  it("treats identical score+time as equal", () => {
    expect(compareScores({ score: 3, atMs: 9 }, { score: 3, atMs: 9 })).toBe(0);
  });

  it("ranks negative scores correctly (a smaller loss is better)", () => {
    expect(compareScores({ score: -5, atMs: 1 }, { score: -50, atMs: 1 })).toBeLessThan(0);
  });
});

describe("rankScores / topN — pure ranking", () => {
  const scores: LocalScore[] = [
    { score: 5, atMs: 30 },
    { score: 20, atMs: 10 },
    { score: 20, atMs: 5 }, // tie with above but earlier → ranks ahead
    { score: -3, atMs: 40 },
  ];

  it("does not mutate the input array", () => {
    const copy = [...scores];
    rankScores(scores);
    expect(scores).toEqual(copy);
  });

  it("assigns dense 1-based ranks in comparator order", () => {
    const ranked = rankScores(scores);
    expect(ranked.map((r) => [r.score, r.atMs, r.rank])).toEqual([
      [20, 5, 1],
      [20, 10, 2],
      [5, 30, 3],
      [-3, 40, 4],
    ]);
  });

  it("topN slices the ranked list", () => {
    expect(topN(scores, 2).map((r) => r.rank)).toEqual([1, 2]);
    expect(topN(scores, 0)).toEqual([]);
  });

  it("bestScore returns the rank-1 row or null", () => {
    expect(bestScore(scores)).toMatchObject({ score: 20, atMs: 5, rank: 1 });
    expect(bestScore([])).toBeNull();
  });
});

describe("submitLocalScore — round-trip through an injected store", () => {
  it("persists under the namespaced key and reads back ranked", () => {
    const store = memStore();
    submitLocalScore(store, "make-market", { score: 100, atMs: 1 });
    expect(store.map.has(boardKey("make-market"))).toBe(true);

    const board = readLocalBoard(store, "make-market");
    expect(board).toHaveLength(1);
    expect(board[0]).toMatchObject({ score: 100, rank: 1 });
  });

  it("reports rank + isNewBest for each submission", () => {
    const store = memStore();
    const first = submitLocalScore(store, "cards", { score: 50, atMs: 1 });
    expect(first).toMatchObject({ rank: 1, isNewBest: true });

    const worse = submitLocalScore(store, "cards", { score: 10, atMs: 2 });
    expect(worse).toMatchObject({ rank: 2, isNewBest: false });

    const better = submitLocalScore(store, "cards", { score: 80, atMs: 3 });
    expect(better).toMatchObject({ rank: 1, isNewBest: true });
    expect(readLocalBoard(store, "cards").map((r) => r.score)).toEqual([80, 50, 10]);
  });

  it("keeps only the top-`keep` scores", () => {
    const store = memStore();
    for (let i = 0; i < 10; i++) {
      submitLocalScore(store, "dice-and-cards", { score: i, atMs: i }, 3);
    }
    const kept = readLocalScores(store, "dice-and-cards");
    expect(kept).toHaveLength(3);
    expect(kept.map((s) => s.score).sort((a, b) => b - a)).toEqual([9, 8, 7]);
  });

  it("does not persist the derived rank field", () => {
    const store = memStore();
    submitLocalScore(store, "fruit-market", { score: 3, atMs: 1 });
    const raw = JSON.parse(store.map.get(boardKey("fruit-market"))!) as unknown[];
    expect(raw[0]).not.toHaveProperty("rank");
  });

  it("carries optional meta through the round-trip", () => {
    const store = memStore();
    submitLocalScore(store, "next-card-betting", {
      score: 1200,
      atMs: 1,
      name: "Ava",
      meta: { skill: 8.5 },
    });
    const [row] = readLocalBoard(store, "next-card-betting");
    expect(row.name).toBe("Ava");
    expect(row.meta).toEqual({ skill: 8.5 });
  });
});

describe("readLocalScores — resilient to corrupt / empty storage", () => {
  it("returns [] when nothing is stored", () => {
    expect(readLocalScores(memStore(), "nope")).toEqual([]);
  });

  it("returns [] for a non-JSON / non-array blob", () => {
    const store = memStore();
    store.setItem(boardKey("x"), "not json");
    expect(readLocalScores(store, "x")).toEqual([]);
    store.setItem(boardKey("y"), JSON.stringify({ not: "an array" }));
    expect(readLocalScores(store, "y")).toEqual([]);
  });

  it("drops malformed rows", () => {
    const store = memStore();
    store.setItem(
      boardKey("z"),
      JSON.stringify([{ score: 5, atMs: 1 }, { score: "bad" }, null]),
    );
    expect(readLocalScores(store, "z")).toEqual([{ score: 5, atMs: 1 }]);
  });
});
