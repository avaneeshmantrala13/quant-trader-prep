import { describe, it, expect } from "vitest";
import {
  advanceNumberBox,
  answerNumberBox,
  buildNumberBoxPaper,
  buildResidueOptions,
  createNumberBoxSession,
  DEFAULT_NUMBERBOX_COUNT,
  mod,
  nbTierForIndex,
  summarizeNumberBox,
} from "./engine";
import { Rng } from "@/lib/rng";

/**
 * NUMBER BOX engine: exact modular answers, clean five-residue options, honest
 * net scoring, and winnability.
 */

describe("mod", () => {
  it("returns a positive residue in [0, m)", () => {
    expect(mod(-1, 12)).toBe(11);
    expect(mod(25, 12)).toBe(1);
    expect(mod(0, 7)).toBe(0);
  });
});

describe("Number Box — paper generation", () => {
  it("is deterministic and the default length with escalating tiers", () => {
    expect(buildNumberBoxPaper(5)).toEqual(buildNumberBoxPaper(5));
    const paper = buildNumberBoxPaper(5);
    expect(paper).toHaveLength(DEFAULT_NUMBERBOX_COUNT);
    expect(nbTierForIndex(0, 30)).toBe(1);
    expect(nbTierForIndex(29, 30)).toBe(3);
    expect(paper[0].tier).toBe(1);
    expect(paper[paper.length - 1].tier).toBe(3);
  });
});

describe("Number Box — item validity", () => {
  const papers = [1, 2, 3, 4, 5, 6].flatMap((s) => buildNumberBoxPaper(s));

  it("answers are valid residues in [0, modulus)", () => {
    for (const it of papers) {
      expect(it.answer).toBeGreaterThanOrEqual(0);
      expect(it.answer).toBeLessThan(it.modulus);
    }
  });

  it("has 5 distinct residue options containing the answer once", () => {
    for (const it of papers) {
      expect(it.options).toHaveLength(5);
      expect(new Set(it.options).size).toBe(5);
      expect(it.options[it.correctIndex]).toBe(it.answer);
      for (const o of it.options) {
        expect(o).toBeGreaterThanOrEqual(0);
        expect(o).toBeLessThan(it.modulus);
      }
    }
  });
});

describe("buildResidueOptions", () => {
  it("always returns 5 distinct residues including the answer", () => {
    const rng = new Rng(2);
    for (let m = 6; m <= 13; m++) {
      for (let a = 0; a < m; a++) {
        const opts = buildResidueOptions(rng, a, m);
        expect(opts).toHaveLength(5);
        expect(new Set(opts).size).toBe(5);
        expect(opts).toContain(a);
      }
    }
  });
});

describe("Number Box — session + scoring", () => {
  it("scores +1 per correct, penalizes wrong, floors net at 0", () => {
    const items = buildNumberBoxPaper(5, 4);
    let s = createNumberBoxSession({ seed: 5, nowTs: 0, count: 4 });
    s = answerNumberBox(s, items[0].correctIndex);
    s = advanceNumberBox(s, 0);
    s = answerNumberBox(s, (items[1].correctIndex + 1) % 5);
    s = advanceNumberBox(s, 0);
    s = answerNumberBox(s, items[2].correctIndex);
    s = advanceNumberBox(s, 0);
    s = answerNumberBox(s, items[3].correctIndex);
    s = advanceNumberBox(s, 0);
    const sum = summarizeNumberBox(s, items);
    expect(sum.correct).toBe(3);
    expect(sum.wrong).toBe(1);
    expect(sum.netScore).toBe(2);
  });

  it("finishes when the whole-run clock elapses", () => {
    let s = createNumberBoxSession({ seed: 5, nowTs: 0, count: 10, budgetMs: 1000 });
    s = advanceNumberBox(s, 2000);
    expect(s.status).toBe("finished");
  });

  it("is winnable: a perfect solver nets the full count", () => {
    const items = buildNumberBoxPaper(7, 10);
    let s = createNumberBoxSession({ seed: 7, nowTs: 0, count: 10 });
    for (let i = 0; i < 10; i++) {
      s = answerNumberBox(s, items[i].correctIndex);
      s = advanceNumberBox(s, 0);
    }
    const sum = summarizeNumberBox(s, items);
    expect(sum.correct).toBe(10);
    expect(sum.netScore).toBe(10);
    expect(sum.accuracyPct).toBe(100);
  });
});
