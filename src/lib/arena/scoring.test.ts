import { describe, expect, it } from "vitest";
import {
  optiverScore,
  scoreRun,
  zetamacScore,
  type AnsweredItem,
} from "./scoring";
import {
  OPTIVER_COMPETITIVE,
  OPTIVER_DEFAULT,
  OPTIVER_PASS,
  ZETAMAC_DEFAULT,
} from "./config";

const item = (p: Partial<AnsweredItem>): AnsweredItem => ({
  id: p.id ?? "x",
  correct: p.correct ?? false,
  skipped: p.skipped ?? false,
  rtMs: p.rtMs ?? 1000,
  op: p.op ?? "add",
});

describe("zetamacScore", () => {
  it("counts correct, ignores skips and wrongs (no penalty)", () => {
    const items = [
      item({ id: "a", correct: true }),
      item({ id: "b", correct: false }),
      item({ id: "c", correct: true }),
      item({ id: "d", skipped: true }),
      item({ id: "e", correct: true }),
    ];
    expect(zetamacScore(items)).toBe(3);
  });

  it("is 0 for an empty run", () => {
    expect(zetamacScore([])).toBe(0);
  });
});

describe("optiverScore", () => {
  it("+1 correct / −1 wrong; skips free score 0", () => {
    const items = [
      item({ correct: true }),
      item({ correct: true }),
      item({ correct: false }),
      item({ skipped: true }),
    ];
    expect(optiverScore(items, true)).toBe(1); // +1 +1 −1 +0
  });

  it("penalizes skips when skipsFree is false", () => {
    const items = [
      item({ correct: true }),
      item({ skipped: true }),
      item({ skipped: true }),
    ];
    expect(optiverScore(items, true)).toBe(1);
    expect(optiverScore(items, false)).toBe(-1); // +1 −1 −1
  });

  it("can go negative", () => {
    const items = [item({ correct: false }), item({ correct: false })];
    expect(optiverScore(items, true)).toBe(-2);
  });
});

describe("scoreRun dispatches by preset", () => {
  it("Zetamac preset counts correct", () => {
    const items = [
      item({ correct: true }),
      item({ correct: false }),
      item({ correct: true }),
    ];
    expect(scoreRun(items, ZETAMAC_DEFAULT)).toBe(2);
  });

  it("Optiver preset is +1/−1 with skips free", () => {
    const items = [
      item({ correct: true }),
      item({ correct: false }),
      item({ skipped: true }),
    ];
    expect(scoreRun(items, OPTIVER_DEFAULT)).toBe(0);
  });
});

describe("an 80-item Optiver mix scores as expected + markers", () => {
  it("70 correct, 5 wrong, 5 skipped ⇒ 65; referenced against markers", () => {
    const items: AnsweredItem[] = [];
    for (let i = 0; i < 70; i++) items.push(item({ id: `c${i}`, correct: true }));
    for (let i = 0; i < 5; i++) items.push(item({ id: `w${i}`, correct: false }));
    for (let i = 0; i < 5; i++) items.push(item({ id: `s${i}`, skipped: true }));
    const score = optiverScore(items, true);
    expect(score).toBe(65); // 70 − 5
    expect(score).toBeGreaterThanOrEqual(OPTIVER_PASS);
    expect(score).toBeLessThan(OPTIVER_COMPETITIVE + 100);
    expect(OPTIVER_PASS).toBe(56);
    expect(OPTIVER_COMPETITIVE).toBe(70);
  });
});
