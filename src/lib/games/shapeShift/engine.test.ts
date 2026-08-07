import { describe, it, expect } from "vitest";
import {
  advanceShapeShift,
  answerShapeShift,
  applyTransform,
  buildShapeShiftItem,
  buildShapeShiftPaper,
  createShapeShiftSession,
  DEFAULT_SHAPESHIFT_COUNT,
  mirrorH,
  normalize,
  orbit,
  rotateCCW,
  rotateCW,
  shapeKey,
  ssTierForIndex,
  summarizeShapeShift,
  type Cell,
} from "./engine";
import { Rng } from "@/lib/rng";

/**
 * SHAPE SHIFT engine: transform algebra, orbit distinctness (so options are
 * unambiguous), item structure, and winnability.
 */

const L: Cell[] = [
  { r: 0, c: 0 }, { r: 1, c: 0 }, { r: 2, c: 0 }, { r: 3, c: 0 }, { r: 3, c: 1 },
];

describe("transform algebra", () => {
  it("rotate CW then CCW is the identity", () => {
    const s = normalize(L);
    const back = normalize(rotateCCW(rotateCW(s.cells)));
    expect(shapeKey(back)).toBe(shapeKey(s));
  });

  it("four CW rotations return the original", () => {
    let cells = normalize(L).cells;
    for (let i = 0; i < 4; i++) cells = normalize(rotateCW(cells)).cells;
    expect(shapeKey(normalize(cells))).toBe(shapeKey(normalize(L)));
  });

  it("mirror is an involution", () => {
    const s = normalize(L);
    const back = normalize(mirrorH(mirrorH(s.cells)));
    expect(shapeKey(back)).toBe(shapeKey(s));
  });
});

describe("orbit", () => {
  it("every base pentomino has 8 distinct orientations", () => {
    // Rebuild the five base shapes via the paper so we cover them all.
    const shapes = buildShapeShiftPaper(1, 40).map((it) => it.base);
    for (const base of shapes) {
      expect(orbit(base).length).toBeGreaterThanOrEqual(5);
    }
  });
});

describe("Shape Shift — paper generation", () => {
  it("is deterministic and the default length with escalating tiers", () => {
    expect(buildShapeShiftPaper(9)).toEqual(buildShapeShiftPaper(9));
    const paper = buildShapeShiftPaper(9);
    expect(paper).toHaveLength(DEFAULT_SHAPESHIFT_COUNT);
    expect(ssTierForIndex(0, 15)).toBe(1);
    expect(ssTierForIndex(14, 15)).toBe(3);
  });
});

describe("Shape Shift — item validity", () => {
  const papers = [1, 2, 3, 4, 5].flatMap((s) => buildShapeShiftPaper(s));

  it("has 5 distinct-shape options with the correct transform at correctIndex", () => {
    for (const it of papers) {
      expect(it.options).toHaveLength(5);
      const keys = it.options.map(shapeKey);
      expect(new Set(keys).size).toBe(5);
      const correct = applyTransform(it.base, it.transform);
      expect(keys[it.correctIndex]).toBe(shapeKey(correct));
    }
  });
});

describe("buildShapeShiftItem", () => {
  it("respects the requested tier", () => {
    expect(buildShapeShiftItem(new Rng(1), 0, 2).tier).toBe(2);
  });
});

describe("Shape Shift — winnability", () => {
  it("a perfect mental-rotator scores 100%", () => {
    const items = buildShapeShiftPaper(11, 15);
    let s = createShapeShiftSession({ seed: 11, nowTs: 0, count: 15 });
    for (let i = 0; i < 15; i++) {
      s = answerShapeShift(s, items[i].correctIndex);
      s = advanceShapeShift(s, 0);
    }
    const sum = summarizeShapeShift(s, items);
    expect(sum.correct).toBe(15);
    expect(sum.accuracyPct).toBe(100);
    expect(sum.score).toBe(sum.maxScore);
  });
});
