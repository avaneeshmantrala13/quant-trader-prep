import { describe, expect, it } from "vitest";
import {
  CARELESS_RATIO,
  OPTIVER_COMPETITIVE,
  OPTIVER_DEFAULT,
  OPTIVER_PASS,
  RUSH_FLOOR_MS,
  RUSH_RATIO,
  WEAKSPOT_DEFAULT,
  ZETAMAC_DEFAULT,
  ZETAMAC_DURATIONS,
  configHash,
  presetForMode,
} from "./config";

describe("preset + constant conformance to spec §5", () => {
  it("Zetamac: 120s window, no penalty, integers, count-only", () => {
    expect(ZETAMAC_DEFAULT.durationSec).toBe(120);
    expect(ZETAMAC_DEFAULT.penalty).toBe(false);
    expect(ZETAMAC_DEFAULT.questionCap).toBeUndefined();
    expect(ZETAMAC_DEFAULT.packs).toEqual(["int"]);
  });

  it("Optiver: 80 questions / 480s, +1/−1, skips free", () => {
    expect(OPTIVER_DEFAULT.durationSec).toBe(480);
    expect(OPTIVER_DEFAULT.questionCap).toBe(80);
    expect(OPTIVER_DEFAULT.penalty).toBe(true);
    expect(OPTIVER_DEFAULT.skipsFree).toBe(true);
  });

  it("offers the documented Zetamac durations and score markers", () => {
    expect(ZETAMAC_DURATIONS).toEqual([30, 60, 120, 300, 600]);
    expect(OPTIVER_PASS).toBe(56);
    expect(OPTIVER_COMPETITIVE).toBe(70);
  });

  it("rushing/careless defaults match the spec", () => {
    expect(RUSH_FLOOR_MS).toBe(800);
    expect(RUSH_RATIO).toBe(0.5);
    expect(CARELESS_RATIO).toBe(0.4);
  });

  it("Weak-Spot Trainer: Zetamac-identical scoring, own mode bucket", () => {
    // Practice aid — only the question MIX differs, never scoring.
    expect(WEAKSPOT_DEFAULT.mode).toBe("weakspot");
    expect(WEAKSPOT_DEFAULT.penalty).toBe(false);
    expect(WEAKSPOT_DEFAULT.skipsFree).toBe(true);
    expect(WEAKSPOT_DEFAULT.packs).toEqual(["int"]);
    expect(WEAKSPOT_DEFAULT.questionCap).toBeUndefined();
    // Distinct leaderboard bucket from Zetamac despite matching scoring rules.
    expect(configHash(WEAKSPOT_DEFAULT)).not.toBe(configHash(ZETAMAC_DEFAULT));
    expect(presetForMode("weakspot")).toEqual(WEAKSPOT_DEFAULT);
  });

  it("presetForMode returns independent copies", () => {
    const a = presetForMode("optiver");
    const b = presetForMode("optiver");
    expect(a).toEqual(b);
    a.durationSec = 1;
    expect(b.durationSec).toBe(480); // not aliased
  });
});

describe("configHash", () => {
  it("is stable and independent of op/pack ordering", () => {
    const h1 = configHash(OPTIVER_DEFAULT);
    const h2 = configHash({
      ...OPTIVER_DEFAULT,
      ops: ["div", "add", "mul", "sub"],
    });
    expect(h1).toBe(h2);
  });

  it("differs when a score-affecting field changes", () => {
    expect(configHash(ZETAMAC_DEFAULT)).not.toBe(configHash(OPTIVER_DEFAULT));
    expect(configHash(ZETAMAC_DEFAULT)).not.toBe(
      configHash({ ...ZETAMAC_DEFAULT, durationSec: 60 }),
    );
  });
});
