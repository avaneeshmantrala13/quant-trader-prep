import { describe, expect, it } from "vitest";
import {
  buildReport,
  isRushError,
  mean,
  median,
  percentile,
} from "./analytics";
import type { AnsweredItem } from "./scoring";
import {
  CARELESS_RATIO,
  OPTIVER_DEFAULT,
  RUSH_FLOOR_MS,
  ZETAMAC_DEFAULT,
  type ArenaPreset,
} from "./config";

const item = (p: Partial<AnsweredItem>): AnsweredItem => ({
  id: p.id ?? "x",
  correct: p.correct ?? false,
  skipped: p.skipped ?? false,
  rtMs: p.rtMs ?? 1000,
  op: p.op ?? "add",
});

describe("summary stats", () => {
  it("mean", () => {
    expect(mean([])).toBe(0);
    expect(mean([2, 4, 6])).toBe(4);
  });

  it("median (odd + even)", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBe(0);
  });

  it("p90 via linear interpolation on 1..10", () => {
    // idx = 0.9 * 9 = 8.1 → between 9 and 10 → 9.1
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9)).toBeCloseTo(9.1, 6);
  });
});

describe("isRushError", () => {
  it("true for wrong && rt below 0.5×median when that exceeds the floor", () => {
    // median 4000 → 0.5×median = 2000 > floor 800; rt 1500 < 2000 ⇒ rush
    expect(isRushError(item({ correct: false, rtMs: 1500 }), 4000)).toBe(true);
  });

  it("uses the RUSH_FLOOR_MS floor when the median is tiny", () => {
    // median 200 → 0.5×median = 100, floor 800 wins; rt 500 < 800 ⇒ rush
    expect(isRushError(item({ correct: false, rtMs: 500 }), 200)).toBe(true);
    // rt 900 ≥ 800 ⇒ not a rush even though it beats 0.5×median
    expect(isRushError(item({ correct: false, rtMs: 900 }), 200)).toBe(false);
  });

  it("never flags correct or skipped answers", () => {
    expect(isRushError(item({ correct: true, rtMs: 10 }), 4000)).toBe(false);
    expect(isRushError(item({ skipped: true, rtMs: 10 }), 4000)).toBe(false);
  });

  it("threshold boundary is strict (< not ≤)", () => {
    // median 4000 → threshold 2000; rt exactly 2000 ⇒ NOT a rush
    expect(isRushError(item({ correct: false, rtMs: 2000 }), 4000)).toBe(false);
  });
});

describe("buildReport", () => {
  const preset: ArenaPreset = { ...ZETAMAC_DEFAULT, durationSec: 120 };

  it("accuracy, attemptRate, and rt stats over attempted items", () => {
    const items = [
      item({ id: "a", correct: true, rtMs: 1000, op: "add" }),
      item({ id: "b", correct: false, rtMs: 3000, op: "mul" }),
      item({ id: "c", correct: true, rtMs: 2000, op: "add" }),
      item({ id: "d", skipped: true, rtMs: 0, op: "sub" }),
    ];
    const r = buildReport(items, preset, {});
    expect(r.accuracy).toBeCloseTo(2 / 3, 6); // 2 correct of 3 attempted
    expect(r.attemptRate).toBeCloseTo(3 / 4, 6);
    expect(r.medianMs).toBe(2000); // median of [1000,2000,3000]
    expect(r.meanMs).toBe(2000);
    expect(r.perQuestion).toHaveLength(3); // skipped excluded
  });

  it("byOp breakdown counts attempts/wrong/avgMs per op", () => {
    const items = [
      item({ id: "a", correct: true, rtMs: 1000, op: "add" }),
      item({ id: "b", correct: false, rtMs: 3000, op: "add" }),
      item({ id: "c", correct: true, rtMs: 2000, op: "mul" }),
    ];
    const r = buildReport(items, preset, {});
    expect(r.byOp.add).toEqual({ attempts: 2, wrong: 1, avgMs: 2000 });
    expect(r.byOp.mul).toEqual({ attempts: 1, wrong: 0, avgMs: 2000 });
  });

  it("slowest returns the top-3 attempted ids by rt (desc)", () => {
    const items = [
      item({ id: "a", correct: true, rtMs: 100 }),
      item({ id: "b", correct: true, rtMs: 500 }),
      item({ id: "c", correct: true, rtMs: 300 }),
      item({ id: "d", correct: true, rtMs: 900 }),
    ];
    const r = buildReport(items, preset, {});
    expect(r.slowest).toEqual(["d", "b", "c"]);
  });

  it("carelessSignal fires at ≥ CARELESS_RATIO of errors being rush errors", () => {
    // per-op median (add) = 4000 → rush threshold 2000. Two wrongs: one fast
    // (rush), one slow (not). rush/errors = 1/2 = 0.5 ≥ 0.4 ⇒ careless.
    const items = [
      item({ id: "w1", correct: false, rtMs: 500, op: "add" }),
      item({ id: "w2", correct: false, rtMs: 3500, op: "add" }),
    ];
    const r = buildReport(items, preset, { add: 4000 });
    expect(r.rushErrors).toContain("w1");
    expect(r.rushErrors).not.toContain("w2");
    expect(r.carelessSignal).toBe(true);
    expect(CARELESS_RATIO).toBe(0.4);
  });

  it("no careless signal when there are no errors", () => {
    const items = [item({ id: "a", correct: true, rtMs: 1000 })];
    const r = buildReport(items, preset, {});
    expect(r.carelessSignal).toBe(false);
    expect(r.rushErrors).toHaveLength(0);
  });

  it("pacing: required = window/cap, projected from actual pace", () => {
    const optiver = { ...OPTIVER_DEFAULT }; // 480s window, cap 80
    const items = Array.from({ length: 10 }, (_, i) =>
      item({ id: `q${i}`, correct: true, rtMs: 4000, op: "add" }),
    );
    const r = buildReport(items, optiver, {});
    expect(r.pacing.requiredMsPerQ).toBeCloseTo((480 * 1000) / 80, 6); // 6000ms
    expect(r.pacing.actualMsPerQ).toBe(4000);
    expect(r.pacing.projected).toBe(Math.floor((480 * 1000) / 4000)); // 120
  });

  it("Optiver report carries an EV coaching nudge; Zetamac does not", () => {
    const items = [item({ id: "a", correct: true, rtMs: 1000 })];
    expect(buildReport(items, OPTIVER_DEFAULT, {}).evCoaching).toBeTruthy();
    expect(buildReport(items, ZETAMAC_DEFAULT, {}).evCoaching).toBeUndefined();
  });

  it("empty run is safe (no NaN)", () => {
    const r = buildReport([], preset, {});
    expect(r.accuracy).toBe(0);
    expect(r.attemptRate).toBe(0);
    expect(r.medianMs).toBe(0);
    expect(r.score).toBe(0);
  });

  it("falls back to the overall median when an op has no prior sample", () => {
    // No userMedianByOp → uses this run's overall median (of [500, 3500] = 2000)
    // rush threshold = max(800, 0.5×2000=1000) = 1000; w1 rt 500 < 1000 ⇒ rush.
    const items = [
      item({ id: "w1", correct: false, rtMs: 500, op: "add" }),
      item({ id: "w2", correct: false, rtMs: 3500, op: "add" }),
    ];
    const r = buildReport(items, preset, {});
    expect(r.rushErrors).toEqual(["w1"]);
    expect(RUSH_FLOOR_MS).toBe(800);
  });
});
