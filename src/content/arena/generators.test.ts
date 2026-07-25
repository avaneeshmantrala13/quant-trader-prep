import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import { arenaItemStream, generateArenaItem } from "./generators";
import { CUSTOM_DEFAULT, type ArenaOp, type ArenaPack } from "@/lib/arena/config";

const SEEDS = Array.from({ length: 120 }, (_, i) => i * 13 + 1);

describe("arena packs are correct by construction", () => {
  it("int pack answers match the exact op", () => {
    const ops: ArenaOp[] = ["add", "sub", "mul", "div"];
    for (const seed of SEEDS) {
      for (const op of ops) {
        const it = generateArenaItem(new Rng(seed), op, "int", CUSTOM_DEFAULT);
        const m = it.prompt.match(/^(\d+)\s*(.)\s*(\d+)/);
        expect(m).not.toBeNull();
        const a = Number(m![1]);
        const b = Number(m![3]);
        const expected =
          op === "add"
            ? a + b
            : op === "sub"
              ? a - b
              : op === "mul"
                ? a * b
                : a / b;
        expect(it.answer).toBe(expected);
        expect(Number.isInteger(it.answer)).toBe(true);
      }
    }
  });

  it("subtraction never yields a negative answer", () => {
    for (const seed of SEEDS) {
      const it = generateArenaItem(new Rng(seed), "sub", "int", CUSTOM_DEFAULT);
      expect(it.answer).toBeGreaterThanOrEqual(0);
    }
  });

  it("fraction pack answers equal num/den to its decimals precision", () => {
    for (const seed of SEEDS) {
      const it = generateArenaItem(new Rng(seed), "div", "fraction", CUSTOM_DEFAULT);
      const m = it.prompt.match(/^(\d+)\/(\d+)/);
      expect(m).not.toBeNull();
      const num = Number(m![1]);
      const den = Number(m![2]);
      expect(it.decimals).toBe(4);
      expect(it.answer).toBeCloseTo(num / den, 4);
    }
  });

  it("percent pack answers equal p% of base", () => {
    for (const seed of SEEDS) {
      const it = generateArenaItem(new Rng(seed), "mul", "percent", CUSTOM_DEFAULT);
      const m = it.prompt.match(/^(\d+)% of (\d+)/);
      expect(m).not.toBeNull();
      const p = Number(m![1]);
      const base = Number(m![2]);
      expect(it.answer).toBeCloseTo((p / 100) * base, 2);
    }
  });
});

describe("arenaItemStream", () => {
  it("is deterministic for the same (seed, preset, count)", () => {
    const preset = { ...CUSTOM_DEFAULT, packs: ["int", "percent"] as ArenaPack[] };
    const a = arenaItemStream(7, preset, 30);
    const b = arenaItemStream(7, preset, 30);
    expect(a).toEqual(b);
    expect(a).toHaveLength(30);
  });

  it("differs across seeds and gives every item a unique id", () => {
    const a = arenaItemStream(1, CUSTOM_DEFAULT, 25);
    const b = arenaItemStream(2, CUSTOM_DEFAULT, 25);
    expect(a).not.toEqual(b);
    expect(new Set(a.map((i) => i.id)).size).toBe(25);
  });
});
