/**
 * archetypes/verifiers.test.ts — EXACT ground-truth pins + MONTE-CARLO sanity
 * checks for every hard-archetype verifier. Each closed form / DP is asserted
 * against its exact rational value AND (for probabilistic archetypes) confirmed
 * by an independent seeded simulation.
 */
import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import {
  binom,
  latticeSameTimeMeetProb,
  latticeSameTimePossible,
  latticePathsIntersectProb,
  bankOrRollFiniteEV,
  bankOrRollBase,
  bankOrRollDieRemoved,
  bankOrRollCasino,
  expectedMaxDice,
  expectedMinDice,
  sumDiceProb,
  hiddenCompositionNextBlack,
  kellyFraction,
  kellyGrowth,
  hypercubeAntipodeHittingTime,
  expectedFlipsForPattern,
  gamblersRuinReachTop,
  gamblersRuinExpectedSteps,
  coinStepLandProb,
  dieResetExpectedRolls,
  secretaryOptimalCutoff,
  redsBeforeFirstBlack,
  bluffCatchFrequencies,
  conditionalTwoDiceMeanAbove,
  urnPosteriorMeanRed,
  couponCollectorExpected,
  couponCollectorLastFaceExpected,
  birthdayCollisionProb,
  birthdayNoCollisionProb,
  derangementProb,
  derangementCount,
} from "./verifiers";

/* -------------------------------------------------------------------------- */
/*  1) LATTICE anchor                                                          */
/* -------------------------------------------------------------------------- */

describe("lattice-path meeting (Optiver anchor)", () => {
  it("PARITY TRAP: same-time meeting is impossible for odd Manhattan gap", () => {
    expect(latticeSameTimeMeetProb(3, 4)).toBe(0); // s=7 odd
    expect(latticeSameTimePossible(3, 4)).toBe(false);
    expect(latticeSameTimeMeetProb(2, 3)).toBe(0); // s=5 odd
    // Even gaps DO allow a same-time meeting with a clean binomial probability.
    expect(latticeSameTimeMeetProb(1, 1)).toBeCloseTo(0.5, 12); // C(2,1)/4
    expect(latticeSameTimeMeetProb(2, 2)).toBeCloseTo(3 / 8, 12); // C(4,2)/16
    expect(latticeSameTimeMeetProb(3, 3)).toBeCloseTo(5 / 16, 12);
  });

  it("EXACT paths-intersect probability matches the verified anchor 3273/4096", () => {
    expect(latticePathsIntersectProb(3, 4)).toBeCloseTo(3273 / 4096, 12);
    expect(latticePathsIntersectProb(1, 1)).toBeCloseTo(7 / 8, 12);
    expect(latticePathsIntersectProb(2, 2)).toBeCloseTo(109 / 128, 12);
    expect(latticePathsIntersectProb(2, 3)).toBeCloseTo(203 / 256, 12);
    expect(latticePathsIntersectProb(1, 4)).toBeCloseTo(231 / 512, 12);
  });

  it("MONTE-CARLO confirms paths-intersect ≈ 0.7991 for B=(3,4)", () => {
    const rng = new Rng(12345);
    const s = 7;
    const trials = 60000;
    let hit = 0;
    for (let t = 0; t < trials; t++) {
      let ax = 0;
      let ay = 0;
      const A = new Set<string>(["0,0"]);
      for (let i = 0; i < s; i++) {
        if (rng.next() < 0.5) ax++;
        else ay++;
        A.add(`${ax},${ay}`);
      }
      let bx = 3;
      let by = 4;
      let meet = A.has("3,4");
      for (let i = 0; i < s; i++) {
        if (rng.next() < 0.5) bx--;
        else by--;
        if (A.has(`${bx},${by}`)) meet = true;
      }
      if (meet) hit++;
    }
    expect(hit / trials).toBeCloseTo(3273 / 4096, 2);
  });

  it("binom helper is exact", () => {
    expect(binom(7, 3)).toBe(35);
    expect(binom(4, 2)).toBe(6);
    expect(binom(20, 10)).toBe(184756);
  });
});

/* -------------------------------------------------------------------------- */
/*  2) BANK-OR-ROLL cascade                                                    */
/* -------------------------------------------------------------------------- */

describe("bank-or-roll optimal stopping (Jane Street cascade)", () => {
  it("finite keep-last EVs are exact (d6: 3-roll 14/3, 2-roll 17/4)", () => {
    const three = bankOrRollFiniteEV(6, 3);
    expect(three.ev).toBeCloseTo(14 / 3, 12);
    expect(three.keepThresholds).toEqual([4, 5]); // 2 rolls left → keep ≥4; 3 → keep ≥5
    const two = bankOrRollFiniteEV(6, 2);
    expect(two.ev).toBeCloseTo(17 / 4, 12);
  });

  it("MONTE-CARLO confirms the d6 3-roll EV ≈ 4.667", () => {
    const { continuation } = bankOrRollFiniteEV(6, 3);
    const rng = new Rng(999);
    const trials = 200000;
    let total = 0;
    for (let t = 0; t < trials; t++) {
      let rem = 3;
      let v = 0;
      while (rem > 0) {
        v = 1 + Math.floor(rng.next() * 6);
        if (rem === 1) break;
        const cont = continuation[rem - 2];
        if (v >= cont) break;
        rem--;
      }
      total += v;
    }
    expect(total / trials).toBeCloseTo(14 / 3, 1);
  });

  it("verified cascade constants: base 1773.34 / die-removed 555.05 / casino 863.93", () => {
    const base = bankOrRollBase(20, 100);
    expect(base.value).toBeCloseTo(1773.34, 1);
    expect(base.terminalThreshold).toBe(18);

    const removed = bankOrRollDieRemoved(20, 100);
    expect(removed.value).toBeCloseTo(555.05, 1);
    expect(removed.threshold).toBe(6);

    const casino = bankOrRollCasino(20, 100);
    expect(casino.value).toBeCloseTo(863.93, 1);
    expect(casino.bankThreshold).toBe(9);
  });
});

/* -------------------------------------------------------------------------- */
/*  3) ORDER STATISTICS                                                        */
/* -------------------------------------------------------------------------- */

describe("dice order statistics", () => {
  it("expected max/min of dice are exact", () => {
    expect(expectedMaxDice(2, 6)).toBeCloseTo(161 / 36, 12);
    expect(expectedMinDice(2, 6)).toBeCloseTo(91 / 36, 12);
    expect(expectedMaxDice(3, 6)).toBeCloseTo(119 / 24, 12);
    expect(expectedMinDice(3, 6)).toBeCloseTo(49 / 24, 12);
    // Symmetry check: max + min = 7 for two dice.
    expect(expectedMaxDice(2, 6) + expectedMinDice(2, 6)).toBeCloseTo(7, 12);
  });

  it("sum-of-dice probabilities are exact", () => {
    expect(sumDiceProb(2, 6, 7)).toBeCloseTo(6 / 36, 12);
    expect(sumDiceProb(3, 6, 10)).toBeCloseTo(1 / 8, 12);
    expect(sumDiceProb(2, 6, 2)).toBeCloseTo(1 / 36, 12);
  });
});

/* -------------------------------------------------------------------------- */
/*  4) HIDDEN COMPOSITION BAYES                                                */
/* -------------------------------------------------------------------------- */

describe("hidden-composition predictive posterior (Citadel)", () => {
  it("matches exact values", () => {
    expect(hiddenCompositionNextBlack(3, 2)).toBeCloseTo(3 / 4, 12);
    expect(hiddenCompositionNextBlack(6, 3)).toBeCloseTo(4 / 5, 12);
    expect(hiddenCompositionNextBlack(4, 1)).toBeCloseTo(2 / 3, 12);
    expect(hiddenCompositionNextBlack(5, 2)).toBeCloseTo(3 / 4, 12);
  });

  it("MONTE-CARLO confirms N=6, m=3 ≈ 0.8", () => {
    const rng = new Rng(77);
    const N = 6;
    const m = 3;
    let obs = 0;
    let nextBlack = 0;
    const trials = 400000;
    for (let t = 0; t < trials; t++) {
      const K = Math.floor(rng.next() * (N + 1)); // uniform 0..N black
      const bag: number[] = Array.from({ length: N }, (_, i) => (i < K ? 1 : 0));
      // shuffle
      for (let i = N - 1; i > 0; i--) {
        const j = Math.floor(rng.next() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      let firstM = true;
      for (let i = 0; i < m; i++) if (bag[i] !== 1) firstM = false;
      if (firstM) {
        obs++;
        if (bag[m] === 1) nextBlack++;
      }
    }
    expect(nextBlack / obs).toBeCloseTo(0.8, 1);
  });
});

/* -------------------------------------------------------------------------- */
/*  5) KELLY                                                                   */
/* -------------------------------------------------------------------------- */

describe("Kelly bet-sizing (SIG)", () => {
  it("optimal fractions are exact and overbetting destroys growth", () => {
    expect(kellyFraction(0.6, 1)).toBeCloseTo(0.2, 12);
    expect(kellyFraction(0.75, 1)).toBeCloseTo(0.5, 12);
    expect(kellyFraction(0.4, 2)).toBeCloseTo(0.1, 12);
    // Betting 2× Kelly (0.4 on an even-money 60% edge) yields NEGATIVE growth.
    expect(kellyGrowth(0.6, 1, 0.4)).toBeLessThan(0);
    // The optimum beats the double-Kelly overbet.
    expect(kellyGrowth(0.6, 1, 0.2)).toBeGreaterThan(kellyGrowth(0.6, 1, 0.4));
  });
});

/* -------------------------------------------------------------------------- */
/*  6) MARKOV / hitting times                                                  */
/* -------------------------------------------------------------------------- */

describe("Markov hitting times & patterns", () => {
  it("cube antipode expected hitting time is 10", () => {
    expect(hypercubeAntipodeHittingTime(3)).toBeCloseTo(10, 9);
  });

  it("MONTE-CARLO confirms the cube antipode ≈ 10", () => {
    const rng = new Rng(2024);
    const trials = 40000;
    let total = 0;
    for (let t = 0; t < trials; t++) {
      let v = 0;
      let steps = 0;
      while (v !== 7) {
        const bit = Math.floor(rng.next() * 3);
        v ^= 1 << bit;
        steps++;
      }
      total += steps;
    }
    expect(total / trials).toBeCloseTo(10, 0);
  });

  it("expected flips to a coin pattern (HH=6, HT=4, HHH=14, HTH=10)", () => {
    expect(expectedFlipsForPattern("HH")).toBeCloseTo(6, 9);
    expect(expectedFlipsForPattern("HT")).toBeCloseTo(4, 9);
    expect(expectedFlipsForPattern("HHH")).toBeCloseTo(14, 9);
    expect(expectedFlipsForPattern("HTH")).toBeCloseTo(10, 9);
  });

  it("gambler's ruin (fair) reach-top and expected steps", () => {
    expect(gamblersRuinReachTop(3, 10)).toBeCloseTo(0.3, 12);
    expect(gamblersRuinExpectedSteps(3, 10)).toBe(21);
    // Biased walk: p=0.6 from 3 of 10 is well above the fair 0.3.
    expect(gamblersRuinReachTop(3, 10, 0.6)).toBeGreaterThan(0.3);
  });
});

/* -------------------------------------------------------------------------- */
/*  7) DRW math                                                                */
/* -------------------------------------------------------------------------- */

describe("DRW hard-math archetypes", () => {
  it("coin-step landing probability (p_4=11/16, p_10=683/1024)", () => {
    expect(coinStepLandProb(4)).toBeCloseTo(11 / 16, 12);
    expect(coinStepLandProb(10)).toBeCloseTo(683 / 1024, 12);
    expect(coinStepLandProb(1)).toBeCloseTo(0.5, 12);
  });

  it("die-reset expected rolls (n=7 → 85.05)", () => {
    expect(dieResetExpectedRolls(7)).toBeCloseTo(1701 / 20, 9);
  });
});

/* -------------------------------------------------------------------------- */
/*  8) SECRETARY + poker + IMC                                                 */
/* -------------------------------------------------------------------------- */

describe("secretary / poker / IMC inference", () => {
  it("secretary optimal cutoff (n=10 → r=3)", () => {
    expect(secretaryOptimalCutoff(10).cutoff).toBe(3);
    expect(secretaryOptimalCutoff(5).cutoff).toBe(2);
    expect(secretaryOptimalCutoff(10).prob).toBeCloseTo(0.3987, 3);
  });

  it("reds before first black = R/(B+1)", () => {
    expect(redsBeforeFirstBlack(7, 3)).toBeCloseTo(7 / 4, 12);
    expect(redsBeforeFirstBlack(5, 2)).toBeCloseTo(5 / 3, 12);
  });

  it("bluff-catch frequencies", () => {
    const { bluffFreq, callFreq } = bluffCatchFrequencies(6, 3);
    expect(bluffFreq).toBeCloseTo(0.25, 12);
    expect(callFreq).toBeCloseTo(2 / 3, 12);
  });

  it("IMC conditional dice lift and urn posterior mean", () => {
    expect(conditionalTwoDiceMeanAbove(8)).toBeCloseTo(10, 12);
    expect(urnPosteriorMeanRed(100, 10, 3)).toBeCloseTo(33, 6);
    expect(urnPosteriorMeanRed(100, 10, 8)).toBeCloseTo(75.5, 6);
  });
});

/* -------------------------------------------------------------------------- */
/*  10) COUPON COLLECTOR / BIRTHDAY / DERANGEMENT                              */
/* -------------------------------------------------------------------------- */

describe("coupon collector / birthday / derangement (Cluster-A hard prob/EV)", () => {
  it("coupon-collector expectation k·H_k is exact (d6 → 14.7, d4 → 25/3)", () => {
    expect(couponCollectorExpected(6)).toBeCloseTo(14.7, 9);
    expect(couponCollectorExpected(4)).toBeCloseTo(25 / 3, 9);
    expect(couponCollectorExpected(2)).toBeCloseTo(3, 9); // 2·(1+1/2)
    // The last (k-th) face takes a mean of k rolls (the dominant term).
    expect(couponCollectorLastFaceExpected(6)).toBe(6);
  });

  it("MONTE-CARLO confirms the d6 coupon-collector mean ≈ 14.7", () => {
    const rng = new Rng(4242);
    const trials = 200000;
    let total = 0;
    for (let t = 0; t < trials; t++) {
      const seen = new Set<number>();
      let rolls = 0;
      while (seen.size < 6) {
        seen.add(1 + Math.floor(rng.next() * 6));
        rolls++;
      }
      total += rolls;
    }
    expect(total / trials).toBeCloseTo(14.7, 0);
  });

  it("birthday collision probability is exact and complement-consistent", () => {
    expect(birthdayCollisionProb(4, 10)).toBeCloseTo(0.496, 9); // 1 − .9·.8·.7
    expect(birthdayCollisionProb(5, 12)).toBeCloseTo(0.618055555, 6);
    expect(birthdayCollisionProb(2, 365)).toBeCloseTo(1 / 365, 9);
    // Pigeonhole: more people than days ⇒ a shared day is certain.
    expect(birthdayCollisionProb(13, 12)).toBe(1);
    // Complement consistency.
    expect(
      birthdayCollisionProb(4, 10) + birthdayNoCollisionProb(4, 10),
    ).toBeCloseTo(1, 12);
  });

  it("MONTE-CARLO confirms birthday collision for n=5, d=12 ≈ 0.618", () => {
    const rng = new Rng(555);
    const trials = 300000;
    let hit = 0;
    for (let t = 0; t < trials; t++) {
      const days = new Set<number>();
      let coll = false;
      for (let i = 0; i < 5; i++) {
        const day = Math.floor(rng.next() * 12);
        if (days.has(day)) coll = true;
        days.add(day);
      }
      if (coll) hit++;
    }
    expect(hit / trials).toBeCloseTo(0.6181, 1);
  });

  it("derangement probability is exact and tends to 1/e", () => {
    expect(derangementProb(4)).toBeCloseTo(3 / 8, 12); // !4/4! = 9/24
    expect(derangementProb(5)).toBeCloseTo(11 / 30, 12);
    expect(derangementProb(3)).toBeCloseTo(1 / 3, 12); // !3/3! = 2/6
    expect(derangementCount(4)).toBe(9);
    expect(derangementCount(5)).toBe(44);
    expect(derangementProb(8)).toBeCloseTo(Math.exp(-1), 3); // → 1/e
  });
});
