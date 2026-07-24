import { describe, expect, it } from "vitest";
import {
  F,
  absDiffTwoDiceEV,
  allSameCoinsProb,
  convertAllEV,
  couponCollectorAll,
  dieBustGameValue,
  dieSecondMoment,
  dieVariance,
  expectedDistinctAfterDraws,
  expectedRecords,
  expectedTrialsOrderedPair,
  expectedTrialsPairSame,
  expectedTrialsSuccessOnEven,
  firstMarkerSpacingEV,
  geometricEV,
  geometricMemorylessTotal,
  geometricSumEV,
  harmonic,
  higherWhenDifferEV,
  maxOfDiceEV,
  negBinomialEV,
  oneRerollFeeEV,
  oneRerollUniformEV,
  overlapProbTwoWindows,
  stPetersburgSeries,
  sumOfUniformsEV,
  symmetricWalkDuration,
  symmetricWalkReachProb,
  twoDiceMatchProb,
  twoDiceSumProb,
  waldEV,
} from "./ev";
import { decText, fracText, meetWithinProb, uniformOrderStatEV } from "./ev";
import { Rng } from "@/lib/rng";
import { gradeNumeric } from "@/lib/numeric";
import type { NumericQuestion, Question } from "@/types/content";
import * as G from "./generators";

const r = (x: number, dp: number) => Math.round(x * 10 ** dp) / 10 ** dp;

/* ========================================================================== */
/*  1. Seed-dataset fixtures — the 85 ORIGINAL Expected Value questions.       */
/*     TEST-ONLY ground truth. No generated/user-facing content reuses these   */
/*     verbatim; users only ever see freshly generated instances (see          */
/*     generators.ts / levels.ts). Answers exactly as delivered, including the  */
/*     −1 divergent-EV sentinels and the two "(computed)" reconstructions.      */
/* ========================================================================== */

/** Sentinel meaning "expected value is infinite / the series diverges". */
const INFINITE = -1;

const SEED_ANSWERS: Record<string, number | string> = {
  EV1_HundredSidedDie: "stop at 87+ (E≈87.4)",
  EV2_BustOnTen: 6,
  EV3_CashOrReroll: 5.5,
  EV4_CostlyReroll: 5.95,
  EV5_DiceGame1: 6.15,
  EV6_DiceGame2: 10.42,
  EV7_CompanyAcquired: 2.4,
  EV8_DiceSumGame: 3.5, // break-even fee (don't play at €5)
  EV9_FiveDescendingCards: 119, // fair prize (EV itself = −99/120)
  EV10_BiasedCoin1: "1/(p(1−p))",
  EV11_BiasedCoin2: "procedure (2 flips)",
  EV12_BiasedCoin3: "procedure (3 flips)",
  EV13_BiasedCoin4: 32,
  EV14_BiasedCoin5: "procedure (unbounded)",
  EV15_BullseyeBet: 3, // E[W] at r=6
  EV16_CapsuleColors: 3.439,
  EV17_DiamondVariance: 1.544,
  EV18_CoefficientOfVariation: 0.614,
  EV19_CardOnTop: 0.5,
  EV20_CoinsAndDice: 0.222,
  EV21_CroissantOrMuffin: 0.84,
  EV22_BasketballPractice1: 50,
  EV23_BasketballPractice2: 0.667,
  EV24_CoinToss2: 0.667,
  EV25_CollectingStickers: 73.5,
  EV26_DiceVsCoins: 0.9913,
  EV27_DiceWithSameNumbers: 4.06,
  EV28_DifferentOutcome: 0.83,
  EV29_DivisibleThrows: 0.9,
  EV30_DoubleDownCoinBet: 0,
  EV31_DoubleRollPay: 24.5,
  EV32_DrunkStudent1: 0.27,
  EV33_DrunkStudent2: 1971,
  EV34_EmptyBoxes: 6.63,
  EV35_ExponentialDistribution1: 2 / 9,
  EV36_FasterSixes: 1.8,
  EV37_FirstAce: 10.6,
  EV38_FirstFlipWins: 0.75,
  EV39_FirstPrime: 1.14,
  EV40_Flip100Coins: 2475,
  EV41_Flip4Coins: 4, // endless-reroll value (parts: 2; 19/8; 4)
  EV42_FlowersInBloom: 0.575,
  EV43_FreeSeat: 0.821,
  EV44_FreeTicket: 20, // best position
  EV45_GameShowStopOrGo: 0.2,
  EV46_KellyBetting1: "go first",
  EV47_KellyBetting2: 0.12, // f = 3/25 of bankroll
  EV48_LargestSunflower: 2.72,
  EV49_OtherThanSix: 3, // reconstructed
  EV50_PatientRoller: 10,
  EV51_RemainingCoins: 5.64,
  EV52_RepeatingDice: 7,
  EV53_RollAndSpin: 6,
  EV54_RowingReshuffle: 0.52,
  EV55_SameFlips: 0.25,
  EV56_ShootingStar: 0.5,
  EV57_ShuttleWait: 6,
  EV58_SpecificCard1: 0.25,
  EV59_SpinInTwoRegions: 3.4,
  EV60_SumRemainingOddDice: 300,
  EV61_SumTwoDice: 0.167,
  EV62_SumUntilSuccess: 10.5,
  EV63_TennisTournament: 0.308,
  EV64_TheHighestFace: 3.89,
  EV65_ThirdSix: 18,
  EV66_ThreeBlueOrbs: 4.5,
  EV67_ThrowA6_1: 6,
  EV68_ThrowA6_2: 42,
  EV69_ThrowA6_3: 36,
  EV70_ThrowA6_4: 12,
  EV71_ThrowUntilMatched: 3.78,
  EV72_ToyCollection1: 11.4,
  EV73_ToyCollection2: 3.95,
  EV74_TriplingDie: INFINITE, // divergent-EV sentinel
  EV75_TwoAtATime: 5.5,
  EV76_TwoConsecutiveFives: 72, // reconstructed
  EV77_TwoDiceDifference: 1.944,
  EV78_TwoHuesLeft: 4.77,
  EV79_TwoRollsPayoff: 3.89,
  EV80_TwoSameDice: 0.167,
  EV81_UniformDistribution1: 1,
  EV82_UpDays: 3.5,
  EV83_VoucherSwap: 125,
  EV84_WarmingSpells: 244,
  EV85_WideningWheel: INFINITE, // divergent-EV sentinel
};

describe("seed dataset: all 85 answers are captured as test-only ground truth", () => {
  it("has exactly 85 documented answers", () => {
    expect(Object.keys(SEED_ANSWERS).length).toBe(85);
  });
  it("the two divergent-EV games use the −1 'infinite' sentinel (never a numeric target)", () => {
    expect(SEED_ANSWERS.EV74_TriplingDie).toBe(INFINITE);
    expect(SEED_ANSWERS.EV85_WideningWheel).toBe(INFINITE);
  });
});

/* ========================================================================== */
/*  2. Exact solver REPRODUCES the documented answers (family by family).      */
/*     Spot-checks include the two reconstructed answers (3, 72) and the two   */
/*     divergent sentinels (verified as diverging, not a finite number).       */
/* ========================================================================== */

describe("solver reproduces documented answers — optimal stopping", () => {
  it("Bust on Ten (EV2) = 6", () => {
    expect(dieBustGameValue(10, 10).equals(F(6))).toBe(true);
    expect(dieBustGameValue(10, 10).valueOf()).toBe(SEED_ANSWERS.EV2_BustOnTen);
  });
  it("Cash or Reroll (EV3) = 5.5 and Costly Reroll (EV4) = 5.95", () => {
    expect(oneRerollFeeEV(8, F(0)).valueOf()).toBe(SEED_ANSWERS.EV3_CashOrReroll);
    expect(oneRerollFeeEV(10, F(2)).valueOf()).toBe(SEED_ANSWERS.EV4_CostlyReroll);
  });
  it("Voucher Swap (EV83, continuous one-reroll) = 125", () => {
    expect(oneRerollUniformEV(F(200)).valueOf()).toBe(SEED_ANSWERS.EV83_VoucherSwap);
  });
});

describe("solver reproduces documented answers — coupon collector & linearity", () => {
  it("Collecting Stickers (EV25): 6·H₆·£5 = £73.5", () => {
    expect(couponCollectorAll(6).mul(5).valueOf()).toBe(SEED_ANSWERS.EV25_CollectingStickers);
  });
  it("Toy Collection #1 (EV72) ≈ 11.4 and #2 (EV73) ≈ 3.95", () => {
    expect(r(couponCollectorAll(5).valueOf(), 1)).toBe(SEED_ANSWERS.EV72_ToyCollection1);
    expect(r(expectedDistinctAfterDraws(5, 7).valueOf(), 2)).toBe(SEED_ANSWERS.EV73_ToyCollection2);
  });
  it("Capsule Colors (EV16) = 3.439", () => {
    expect(r(expectedDistinctAfterDraws(10, 4).valueOf(), 3)).toBe(SEED_ANSWERS.EV16_CapsuleColors);
  });
  it("Largest Sunflower (EV48): H₈ ≈ 2.72", () => {
    expect(r(expectedRecords(8).valueOf(), 2)).toBe(SEED_ANSWERS.EV48_LargestSunflower);
  });
  it("First Ace (EV37): (52+1)/(4+1) = 10.6", () => {
    expect(firstMarkerSpacingEV(52, 4).valueOf()).toBe(SEED_ANSWERS.EV37_FirstAce);
  });
});

describe("solver reproduces documented answers — geometric / neg-binomial / recursion", () => {
  it("Throw a 6 #1 (EV67) = 6; Third Six (EV65) = 18", () => {
    expect(geometricEV(F(1, 6)).valueOf()).toBe(SEED_ANSWERS.EV67_ThrowA6_1);
    expect(negBinomialEV(3, F(1, 6)).valueOf()).toBe(SEED_ANSWERS.EV65_ThirdSix);
  });
  it("Throw a 6 #2 (EV68, HH run) = 42 and Two Consecutive Fives (EV76, d8) = 72 [reconstructed]", () => {
    expect(expectedTrialsPairSame(F(1, 6)).valueOf()).toBe(SEED_ANSWERS.EV68_ThrowA6_2);
    expect(expectedTrialsPairSame(F(1, 8)).valueOf()).toBe(SEED_ANSWERS.EV76_TwoConsecutiveFives);
  });
  it("Throw a 6 #3 (EV69, ordered pair) = 36; #4 (EV70, even-trial) = 12", () => {
    expect(expectedTrialsOrderedPair(F(1, 6), F(1, 6)).valueOf()).toBe(SEED_ANSWERS.EV69_ThrowA6_3);
    expect(expectedTrialsSuccessOnEven(F(1, 6)).valueOf()).toBe(SEED_ANSWERS.EV70_ThrowA6_4);
  });
  it("Patient Roller (EV50, memoryless) = 4 + 6 = 10", () => {
    expect(geometricMemorylessTotal(F(1, 6), 4).valueOf()).toBe(SEED_ANSWERS.EV50_PatientRoller);
  });
  it("Roll and Spin (EV53) = 6; Three Blue Orbs (EV66) = 4.5", () => {
    expect(geometricSumEV(F(9, 2), F(1, 4)).valueOf()).toBe(SEED_ANSWERS.EV53_RollAndSpin);
    expect(convertAllEV(3, 2).valueOf()).toBe(SEED_ANSWERS.EV66_ThreeBlueOrbs);
  });
});

describe("solver reproduces documented answers — Wald / random walks", () => {
  it("Double Roll Pay (EV31): E[N]=7, Wald = 7·3.5 = 24.5", () => {
    expect(waldEV(F(7), F(7, 2)).valueOf()).toBe(SEED_ANSWERS.EV31_DoubleRollPay);
  });
  it("Sum Until Success (EV62) = 10.5; Repeating Dice (EV52) = 7", () => {
    expect(waldEV(F(3), F(7, 2)).valueOf()).toBe(SEED_ANSWERS.EV62_SumUntilSuccess);
    expect(waldEV(F(2), F(7, 2)).valueOf()).toBe(SEED_ANSWERS.EV52_RepeatingDice);
  });
  it("Drunk Student #1 (EV32) = 27/100 and #2 (EV33) = 27·73 = 1971", () => {
    expect(symmetricWalkReachProb(27, 100).valueOf()).toBe(SEED_ANSWERS.EV32_DrunkStudent1);
    expect(symmetricWalkDuration(27, 100).valueOf()).toBe(SEED_ANSWERS.EV33_DrunkStudent2);
  });
});

describe("solver reproduces documented answers — geometry, continuous & EV-over-distribution", () => {
  it("Flowers in Bloom (EV42) = 0.575", () => {
    expect(overlapProbTwoWindows(F(30), F(9), F(12)).valueOf()).toBe(SEED_ANSWERS.EV42_FlowersInBloom);
  });
  it("Uniform convolution (EV81): E[U+U] = 1", () => {
    expect(sumOfUniformsEV(2, F(1)).valueOf()).toBe(SEED_ANSWERS.EV81_UniformDistribution1);
  });
  it("Two Dice Difference (EV77) ≈ 1.944; Two Rolls Payoff (EV79/EV64) ≈ 3.89", () => {
    expect(r(absDiffTwoDiceEV(6).valueOf(), 3)).toBe(SEED_ANSWERS.EV77_TwoDiceDifference);
    expect(r(higherWhenDifferEV(6).valueOf(), 2)).toBe(SEED_ANSWERS.EV79_TwoRollsPayoff);
  });
});

describe("solver reproduces documented answers — elementary & variance", () => {
  it("Two Same Dice (EV80) = 1/6 (NOT 1/36); Sum Two Dice (EV61) = 1/6", () => {
    expect(twoDiceMatchProb(6).equals(F(1, 6))).toBe(true);
    expect(twoDiceMatchProb(6).valueOf()).not.toBe(F(1, 36).valueOf());
    expect(twoDiceSumProb(6, 7).equals(F(1, 6))).toBe(true);
  });
  it("Same Flips (EV55): P(3 same) = 1/4", () => {
    expect(allSameCoinsProb(3).valueOf()).toBe(SEED_ANSWERS.EV55_SameFlips);
  });
  it("Other Than Six (EV49) = 3 [reconstructed]: mean of {1..5}", () => {
    const mean = F(1 + 2 + 3 + 4 + 5, 5);
    expect(mean.valueOf()).toBe(SEED_ANSWERS.EV49_OtherThanSix);
  });
  it("Flip 100 Coins (EV40): n(n−1)/4 = 2475", () => {
    const n = 100;
    expect(F(n * (n - 1), 4).valueOf()).toBe(SEED_ANSWERS.EV40_Flip100Coins);
  });
  it("die second moment / variance are exact (E[X²]=91/6, Var=35/12 for d6)", () => {
    expect(dieSecondMoment(6).equals(F(91, 6))).toBe(true);
    expect(dieVariance(6).equals(F(35, 12))).toBe(true);
  });
});

describe("solver handles the divergent-EV sentinels correctly (never a finite target)", () => {
  it("Tripling Die (EV74): per-term = 3·(2/3) = 2 ≥ 1 ⇒ diverges", () => {
    const s = stPetersburgSeries(F(2, 3), F(3), 40);
    expect(s.perTerm.equals(F(2))).toBe(true);
    expect(s.diverges).toBe(true);
    // The tempting FINITE analog (a doubling prize, ratio ½) converges to a
    // finite $ value — which is exactly the distractor, not the answer.
    expect(stPetersburgSeries(F(2, 3), F(3, 2), 40).perTerm.equals(F(1))).toBe(true);
  });
  it("Widening Wheel (EV85): E[W] = Σ 4/(n+4) is a tail of the harmonic series ⇒ diverges", () => {
    // Partial sums grow without bound (harmonic divergence): Σ_{n=0..upTo} 4/(n+4).
    // (Float loop — an EXACT rational harmonic over 10^5 terms overflows.)
    const partial = (upTo: number) => {
      let s = 0;
      for (let n = 0; n <= upTo; n++) s += 4 / (n + 4);
      return s;
    };
    expect(partial(1000)).toBeGreaterThan(partial(100));
    expect(partial(100000)).toBeGreaterThan(partial(1000));
    // Small-n exact spot check: 4·(H_5 − H_4) = 4·(1/5) = 0.8 for the n=1 term set.
    expect(harmonic(5).sub(harmonic(4)).mul(4).equals(F(4, 5))).toBe(true);
  });
  it("max-of-dice order statistic is exact (two d6 → 161/36)", () => {
    expect(maxOfDiceEV(6, 2).equals(F(161, 36))).toBe(true);
  });
});

/* ========================================================================== */
/*  3. Generators — independent re-derivation, distractor quality, grading.    */
/*     Every generator id encodes its parameters, so each test RE-DERIVES the  */
/*     answer a SECOND way (raw closed form here) and asserts it matches the    */
/*     emitted answer, that grading round-trips, and that every distractor is   */
/*     distinct, finite, and ≠ the answer (misconception-traceable).           */
/* ========================================================================== */

const SEEDS = Array.from({ length: 60 }, (_, i) => i * 101 + 7);

function fact(n: number): number {
  let f = 1;
  for (let k = 2; k <= n; k++) f *= k;
  return f;
}

/** Parse the integer params trailing a generator id ("ev-fam-1-2" → [1,2]). */
function idNums(id: string): number[] {
  return id
    .split("-")
    .slice(2)
    .map((s) => Number(s));
}

/** Independent re-derivation of a numeric generator's answer from its id. */
function reDeriveNumeric(q: NumericQuestion): ReturnType<typeof F> {
  const key = q.id.split("-")[1];
  const n = idNums(q.id);
  switch (key) {
    case "reroll": {
      const [N, fee] = n;
      const rv = F(N + 1, 2).sub(F(fee));
      let s = F(0);
      for (let v = 1; v <= N; v++)
        s = s.add(F(v).valueOf() >= rv.valueOf() ? F(v) : rv);
      return s.div(F(N));
    }
    case "voucher": {
      const [M] = n;
      return F(M, 4).add(F(3 * M, 8)); // ½·M/4 + ½·3M/4 = 5M/8
    }
    case "negbin": {
      const [N, r] = n;
      return F(r * N);
    }
    case "pairsame": {
      const [N] = n;
      return F(N * N + N);
    }
    case "memoryless": {
      const [N, m] = n;
      return F(m + N);
    }
    case "runsum": {
      const [N, t] = n;
      return F(N, N - t).mul(F(N + 1, 2));
    }
    case "geomsum": {
      const N = Number(q.id.split("-")[2]);
      const [cn, cd] = q.id.split("-")[3].split("_").map(Number);
      const cont = F(cn, cd);
      return F(N + 1, 2).div(F(1).sub(cont));
    }
    case "convertall": {
      const [N] = n;
      return F(N).mul(harmonic(N));
    }
    case "otherthan": {
      const [N, ex] = n;
      let sum = 0;
      for (let k = 1; k <= N; k++) if (k !== ex) sum += k;
      return F(sum, N - 1);
    }
    case "coupon": {
      const [nn, cost] = n;
      return F(nn).mul(harmonic(nn)).mul(F(cost));
    }
    case "distinct": {
      const [nn, m] = n;
      return F(nn).mul(F(1).sub(F(nn - 1, nn).pow(m)));
    }
    case "records": {
      const [nn] = n;
      return harmonic(nn);
    }
    case "emptyboxes": {
      const [B, K] = n;
      return F(B).mul(F(B - 1, B).pow(K));
    }
    case "firstmarker": {
      const [D, c] = n;
      return F(D + 1, c + 1);
    }
    case "warming": {
      const [w, target] = n;
      return F(target * fact(w) + (w - 1));
    }
    case "condgeo": {
      const [M] = n;
      const q2 = F(1).sub(F(1, M));
      return F(1).div(F(1).sub(q2.pow(2)));
    }
    case "overlap": {
      const [D, a, b] = n;
      return F(1).sub(
        F(D - a)
          .pow(2)
          .add(F(D - b).pow(2))
          .div(F(D).pow(2).mul(2)),
      );
    }
    case "meet": {
      const [L, t] = n;
      return meetWithinProb(F(L), F(t));
    }
    case "maxdice": {
      const [N, d] = n;
      let e = F(0);
      for (let k = 1; k <= N; k++) e = e.add(F(1).sub(F(k - 1, N).pow(d)));
      return e;
    }
    case "unifspacing": {
      const [nn, k] = n;
      return uniformOrderStatEV(k, nn);
    }
    default:
      throw new Error(`no re-derivation for numeric family ${key}`);
  }
}

/** Independent re-derivation of a quiz generator's correct choice text. */
function reDeriveQuiz(q: Question): string {
  const key = q.id.split("-")[1];
  const n = idNums(q.id);
  switch (key) {
    case "match":
      return fracText(F(1, n[0]));
    case "differ":
      return fracText(F(n[0] - 1, n[0]));
    case "allsame":
      return fracText(F(1, 2 ** (n[0] - 1)));
    case "3dice": {
      const [a, b, c] = n;
      return decText(F(6 * a + 90 * b - 120 * c, 216), 2);
    }
    case "higherdiffer": {
      const [N] = n;
      let s = F(0);
      for (let x = 1; x <= N; x++)
        for (let y = 1; y <= N; y++)
          if (x !== y) s = s.add(F(Math.max(x, y)));
      return decText(s.div(F(N * N)), 2);
    }
    case "headstails":
      return String((n[0] * (n[0] - 1)) / 4);
    case "2ndmoment":
      return decText(F((n[0] + 1) * (2 * n[0] + 1), 6), 2);
    case "expmoment":
      return decText(F(2, n[0] * n[0]), 3);
    case "sumunif":
      return decText(F(n[0] * n[1], 2), 2);
    case "cltvar": {
      const [coins, dice] = n;
      return decText(F(coins, 4).add(F(dice).mul(F(35, 12))), 2);
    }
    case "walkreach":
      return decText(F(n[1], n[0]), 2);
    case "walkdur":
      return String(n[1] * (n[0] - n[1]));
    case "wald":
      return decText(F((1 + n[0]) * (n[0] + 1), 2), 2);
    case "martingale":
      return "0";
    default:
      throw new Error(`no re-derivation for quiz family ${key}`);
  }
}

const NUMERIC_GENS: [string, (rng: Rng) => NumericQuestion][] = [
  ["genOneReroll", G.genOneReroll],
  ["genContinuousReroll", G.genContinuousReroll],
  ["genNegBinomial", G.genNegBinomial],
  ["genPairSame", G.genPairSame],
  ["genMemoryless", G.genMemoryless],
  ["genRunningSum", G.genRunningSum],
  ["genGeometricSum", G.genGeometricSum],
  ["genConvertAll", G.genConvertAll],
  ["genOtherThan", G.genOtherThan],
  ["genCoupon", G.genCoupon],
  ["genDistinct", G.genDistinct],
  ["genRecords", G.genRecords],
  ["genEmptyBoxes", G.genEmptyBoxes],
  ["genFirstMarker", G.genFirstMarker],
  ["genWarmingSpells", G.genWarmingSpells],
  ["genConditionalGeo", G.genConditionalGeo],
  ["genOverlap", G.genOverlap],
  ["genMeetWithin", G.genMeetWithin],
  ["genMaxDice", G.genMaxDice],
  ["genUniformSpacing", G.genUniformSpacing],
];

const QUIZ_GENS: [string, (rng: Rng) => Question][] = [
  ["genTwoDiceMatch", G.genTwoDiceMatch],
  ["genDiffer", G.genDiffer],
  ["genAllSameCoins", G.genAllSameCoins],
  ["genThreeDicePayoff", G.genThreeDicePayoff],
  ["genHigherDiffer", G.genHigherDiffer],
  ["genHeadsTimesTails", G.genHeadsTimesTails],
  ["genSecondMoment", G.genSecondMoment],
  ["genExpMoment", G.genExpMoment],
  ["genSumUniforms", G.genSumUniforms],
  ["genCltVariance", G.genCltVariance],
  ["genWalkReach", G.genWalkReach],
  ["genWalkDuration", G.genWalkDuration],
  ["genWald", G.genWald],
  ["genMartingaleDoubling", G.genMartingaleDoubling],
];

describe("numeric generators: independent re-derivation + grading + distractors", () => {
  for (const [name, gen] of NUMERIC_GENS) {
    it(`${name} — answer re-derives, grades, distractors are clean`, () => {
      for (const seed of SEEDS) {
        const q = gen(new Rng(seed));
        const dp = q.decimals ?? 0;
        const f = 10 ** dp;
        // (a) Independent re-derivation matches the emitted answer.
        const expected = reDeriveNumeric(q);
        expect(Math.round(expected.valueOf() * f)).toBe(
          Math.round(q.answer * f),
        );
        // (b) Grading round-trips: typing the exact answer is graded correct.
        const typed = dp === 0 ? String(q.answer) : q.answer.toFixed(dp);
        expect(gradeNumeric(q, typed).correct).toBe(true);
        // (c) Every commonError is finite, ≠ the answer, and its feedback fires.
        for (const ce of q.commonErrors ?? []) {
          expect(Number.isFinite(ce.value)).toBe(true);
          expect(Math.round(ce.value * f)).not.toBe(Math.round(q.answer * f));
          const g = gradeNumeric(
            q,
            dp === 0 ? String(ce.value) : ce.value.toFixed(dp),
          );
          expect(g.correct).toBe(false);
          expect(g.matchedError?.feedback).toBeTruthy();
        }
        // commonErrors are mutually distinct at the grading precision.
        const keys = (q.commonErrors ?? []).map((e) => Math.round(e.value * f));
        expect(new Set(keys).size).toBe(keys.length);
        expect(q.answer).toBeGreaterThanOrEqual(0);
      }
    });
  }
});

describe("quiz generators: independent re-derivation + distractor quality", () => {
  for (const [name, gen] of QUIZ_GENS) {
    it(`${name} — correct choice re-derives, options are clean`, () => {
      for (const seed of SEEDS) {
        const q = gen(new Rng(seed));
        // (a) Exactly one correct option, at a valid index.
        expect(q.correctIndex).toBeGreaterThanOrEqual(0);
        expect(q.correctIndex).toBeLessThan(q.choices.length);
        // (b) The correct choice equals the independently re-derived value.
        expect(q.choices[q.correctIndex]).toBe(reDeriveQuiz(q));
        // (c) Options are distinct (no leak) and ≥ 2, with aligned rationale.
        expect(new Set(q.choices).size).toBe(q.choices.length);
        expect(q.choices.length).toBeGreaterThanOrEqual(2);
        expect(q.distractorRationale?.length).toBe(q.choices.length);
        // (d) Every distractor differs from the correct answer text.
        q.choices.forEach((c, i) => {
          if (i !== q.correctIndex) expect(c).not.toBe(q.choices[q.correctIndex]);
        });
        expect(q.explanation.length).toBeGreaterThan(40);
      }
    });
  }
});
