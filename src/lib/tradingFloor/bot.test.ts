import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import { drawCounterparty, normal } from "./bot";
import type { BotConfig } from "./types";

describe("normal (Box–Muller)", () => {
  it("has ~mean and ~variance over many draws (fixed seed)", () => {
    const rng = new Rng(12345);
    const targetMean = 2;
    const targetSd = 3;
    const n = 50_000;
    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < n; i++) {
      const x = normal(rng, targetMean, targetSd);
      sum += x;
      sumSq += x * x;
    }
    const mean = sum / n;
    const variance = sumSq / n - mean * mean;
    expect(Math.abs(mean - targetMean)).toBeLessThan(0.2);
    expect(Math.abs(variance - targetSd * targetSd) / (targetSd * targetSd)).toBeLessThan(0.1);
  });

  it("defaults to standard normal (mean 0, sd 1)", () => {
    const rng = new Rng(999);
    const n = 40_000;
    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < n; i++) {
      const x = normal(rng);
      sum += x;
      sumSq += x * x;
    }
    const mean = sum / n;
    const variance = sumSq / n - mean * mean;
    expect(Math.abs(mean)).toBeLessThan(0.05);
    expect(Math.abs(variance - 1)).toBeLessThan(0.1);
  });

  it("is deterministic: same seed → same sequence", () => {
    const a = new Rng(7);
    const b = new Rng(7);
    for (let i = 0; i < 100; i++) {
      expect(normal(a, 1, 2)).toBe(normal(b, 1, 2));
    }
  });
});

const baseBot: BotConfig = {
  informedProb: 1,
  edgeNoiseSd: 0,
  noiseProb: 0.7,
  noiseMaxHalf: 0.4,
  lookahead: 0,
};

describe("drawCounterparty", () => {
  it("with informedProb=1 & edgeNoiseSd=0 is always informed at exactly trueFair", () => {
    const rng = new Rng(42);
    const trueFair = 5.25;
    for (let i = 0; i < 200; i++) {
      const cp = drawCounterparty(rng, trueFair, baseBot);
      expect(cp.informed).toBe(true);
      expect(cp.fairForFill).toBe(trueFair);
      expect(cp.noise.trades).toBe(false);
    }
  });

  it("with informedProb=1 & edge>0 is informed, fairForFill ≈ trueFair ± edge", () => {
    const rng = new Rng(2024);
    const trueFair = 10;
    const cfg: BotConfig = { ...baseBot, edgeNoiseSd: 0.5 };
    const n = 20_000;
    let sum = 0;
    let allInformed = true;
    for (let i = 0; i < n; i++) {
      const cp = drawCounterparty(rng, trueFair, cfg);
      if (!cp.informed) allInformed = false;
      sum += cp.fairForFill - trueFair;
    }
    expect(allInformed).toBe(true);
    expect(Math.abs(sum / n)).toBeLessThan(0.05);
  });

  it("with informedProb=0 is uninformed at trueFair with drawNoise flow", () => {
    const rng = new Rng(314);
    const trueFair = 3.5;
    const cfg: BotConfig = { ...baseBot, informedProb: 0, noiseProb: 0.7 };
    const n = 20_000;
    let trades = 0;
    for (let i = 0; i < n; i++) {
      const cp = drawCounterparty(rng, trueFair, cfg);
      expect(cp.informed).toBe(false);
      expect(cp.fairForFill).toBe(trueFair);
      expect(typeof cp.noise.trades).toBe("boolean");
      if (cp.noise.trades) trades++;
    }
    expect(Math.abs(trades / n - 0.7)).toBeLessThan(0.02);
  });
});
