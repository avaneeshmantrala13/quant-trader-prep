import { describe, expect, it } from "vitest";
import {
  advanceReveal,
  currentFair,
  currentPosteriorSd,
  finishFloor,
  postQuote,
  startFloor,
  tick,
} from "./engine";
import { INTERVIEW } from "./config";
import { diceBinaryScenario, diceQuantityScenario } from "./scenarios/dice";
import type { FloorConfig, FloorState, Scenario, UserQuote } from "./types";

/** Drive a full session to a finished state with a per-round quote policy. */
function playToFinish<T>(
  scenario: Scenario<T>,
  config: FloorConfig,
  seed: number,
  quoteFn: (s: FloorState<T>) => UserQuote,
): FloorState<T> {
  let s = startFloor(scenario, config, seed);
  let guard = 0;
  while (s.phase !== "finished" && guard++ < 10_000) {
    if (s.phase === "quoting") s = postQuote(s, quoteFn(s));
    else s = advanceReveal(s);
  }
  return s;
}

const honest = <T>(s: FloorState<T>): UserQuote => ({
  mid: currentFair(s),
  half: Math.max(0.02, currentPosteriorSd(s)),
  skew: 0,
  size: 1,
});

describe("startFloor", () => {
  it("starts quoting on round 0 with the first reveal shown", () => {
    const s = startFloor(diceQuantityScenario(8), INTERVIEW, 1);
    expect(s.phase).toBe("quoting");
    expect(s.round).toBe(0);
    expect(s.revealed).toHaveLength(1);
    expect(s.remainingMs).toBe(INTERVIEW.shotClockMs);
    expect(s.totalRounds).toBe(8);
  });
});

describe("determinism", () => {
  it("identical (scenario, config, seed) full plays produce identical results", () => {
    const build = () =>
      finishFloor(playToFinish(diceBinaryScenario(8), INTERVIEW, 4242, honest));
    const a = build();
    const b = build();
    expect(a.userFinal).toBe(b.userFinal);
    expect(a.benchFinal).toBe(b.benchFinal);
    expect(a.userPnl).toEqual(b.userPnl);
    expect(a.calibrationPairs).toEqual(b.calibrationPairs);
    expect(a).toEqual(b);
  });
});

describe("single-round hand computation", () => {
  it("an informed pick-off on the ask moves cash/inventory/pnl as reasoned", () => {
    // informedProb=1, edgeNoiseSd=0 ⇒ botFair === trueFair (exact reasoning).
    const exact: FloorConfig = {
      id: "exact",
      label: "Exact",
      bot: {
        informedProb: 1,
        edgeNoiseSd: 0,
        noiseProb: 0,
        noiseMaxHalf: 1,
        lookahead: 0,
      },
      maxSize: 5,
      shotClockMs: 20_000,
      benchSkew: 0,
    };
    const scenario = diceQuantityScenario(2);
    const s0 = startFloor(scenario, exact, 123);
    const fairNow = currentFair(s0);
    const settle = scenario.settle(s0.truth);

    // Quote too low so ask < fair ⇒ informed lifts the ask (userSells, adverse).
    const half = 0.1;
    const mid = fairNow - 1;
    const expectedAsk = mid + half; // = fairNow - 0.9
    const s1 = postQuote(s0, { mid, half, skew: 0, size: 1 });

    expect(s1.phase).toBe("revealed");
    expect(s1.inventory).toBe(-1);
    expect(s1.cash).toBeCloseTo(expectedAsk, 12);
    expect(s1.fills[0]).toMatchObject({
      side: "userSells",
      adverse: true,
      size: 1,
      round: 0,
    });
    expect(s1.fills[0].price).toBeCloseTo(expectedAsk, 12);
    // markedPnl = cash + inventory * markFair, markFair = settle (last round next).
    expect(s1.pnlPath[0]).toBeCloseTo(expectedAsk - settle, 12);
  });
});

describe("honest policy ties the benchmark desk", () => {
  it("driving the exact honest policy yields userFinal ≈ benchFinal", () => {
    const tie = <T>(s: FloorState<T>): UserQuote => ({
      mid: currentFair(s),
      half: currentPosteriorSd(s),
      skew: INTERVIEW.benchSkew ?? 0,
      size: 1,
    });
    for (const seed of [1, 7, 55, 909, 12345]) {
      const done = playToFinish(diceQuantityScenario(8), INTERVIEW, seed, tie);
      const result = finishFloor(done);
      expect(result.userFinal).toBeCloseTo(result.benchFinal, 9);
      expect(result.userPnl).toEqual(result.benchPnl);
    }
  });
});

describe("stand-aside on timeout", () => {
  it("tick past the clock resolves a size-0, no-fill round with no calibration pair", () => {
    const s0 = startFloor(diceBinaryScenario(8), INTERVIEW, 77);
    const s1 = tick(s0, 10_000_000);
    expect(s1.phase).toBe("revealed");
    expect(s1.round).toBe(1);
    expect(s1.fills[0]).toMatchObject({ side: "none", size: 0, price: 0 });
    expect(s1.calibration).toHaveLength(0);
    expect(s1.pickedOff).toBe(0);
  });

  it("tick within the clock only decrements remainingMs", () => {
    const s0 = startFloor(diceBinaryScenario(8), INTERVIEW, 77);
    const s1 = tick(s0, 5000);
    expect(s1.phase).toBe("quoting");
    expect(s1.remainingMs).toBe(INTERVIEW.shotClockMs - 5000);
  });
});

describe("finishFloor", () => {
  it("populates LiveRunResult fields and consistent aggregate metrics", () => {
    const done = playToFinish(diceBinaryScenario(8), INTERVIEW, 314, honest);
    const result = finishFloor(done);

    expect(result.rounds).toBe(8);
    expect(result.userPnl).toHaveLength(8);
    expect(result.benchPnl).toHaveLength(8);
    expect(typeof result.userFinal).toBe("number");
    expect(typeof result.benchFinal).toBe("number");
    expect(result.userMaxDrawdown).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(result.consistency)).toBe(true);
    expect(result.grade).toHaveProperty("delta");
    expect(result.grade).toHaveProperty("label");

    // pickedOff counts adverse fills recorded on the driven state.
    const adverse = done.fills.filter((f) => f.side !== "none" && f.adverse).length;
    expect(result.pickedOff).toBe(adverse);
    // fills count == rounds with a real trade.
    expect(result.fills).toBe(done.fills.filter((f) => f.side !== "none").length);
  });
});

describe("proper-scoring property (headline rigor)", () => {
  it("honest quoting beats a biased quoter in total P&L and mean Brier", () => {
    const bias = 0.18;
    const seeds = 300;
    let honestPnl = 0;
    let biasedPnl = 0;
    let honestBrier = 0;
    let biasedBrier = 0;

    const play = (seed: number, b: number) => {
      const scenario = diceBinaryScenario(8);
      const done = playToFinish(scenario, INTERVIEW, seed, (s) => ({
        mid: currentFair(s) + b,
        half: Math.max(0.02, currentPosteriorSd(s)),
        skew: 0,
        size: 1,
      }));
      return finishFloor(done);
    };

    for (let seed = 0; seed < seeds; seed++) {
      const h = play(seed, 0);
      const w = play(seed, bias);
      honestPnl += h.userFinal;
      biasedPnl += w.userFinal;
      honestBrier += h.brier;
      biasedBrier += w.brier;
    }

    expect(honestPnl).toBeGreaterThan(biasedPnl);
    expect(honestBrier / seeds).toBeLessThan(biasedBrier / seeds);
  });
});
