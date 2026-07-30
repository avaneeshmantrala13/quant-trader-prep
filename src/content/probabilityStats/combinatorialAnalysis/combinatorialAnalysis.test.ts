import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import { gradeFreeResponse, gradeNumeric } from "@/lib/numeric";
import type { NumericQuestion, Question } from "@/types/content";
import { F, choose } from "./combinatorics";
import {
  genAllSameColor,
  genAvoidSpecialSum,
  genEachPlayerSpecial,
  genExactlyTwoColors,
  genOneAssignment,
  genOneOfEach,
  genPairSumThreshold,
} from "./genChooseK";
import { genHyperAtLeast, genHyperExactly, genHyperNone } from "./genHyper";
import { genPokerHand, genPokerHandNumeric } from "./genPoker";
import {
  genBinomAtMost,
  genLatticeMeeting,
  genMoreTails,
  genRaceCondition,
  genReturnOrigin,
  genStepCount,
} from "./genBinomial";
import {
  genPermVsComb,
  genPermVsCombNumeric,
  genReplacementTrap,
  genReplacementTrapNumeric,
  genStarsBarsCap,
  genStarsBarsCapNumeric,
  genTiesOrder,
  genTiesOrderNumeric,
} from "./genTraps";
import {
  genAlternatingSteps,
  genDivisibility,
  genLightsLine,
  genMultinomialPaths,
} from "./genGrid";
import {
  genBalanceScale,
  genCircularAscending,
  genDealUntil,
  genGapMethod,
  genIndependentChoices,
  genOrderedDraw,
  genUnionFixedBits,
} from "./genArrangements";
import {
  genAtLeastKOfAKind,
  genDiceSumTarget,
  genExpectedPairs,
  genStrictlyIncreasing,
  genSubsetSum,
  genTopTwoSum,
} from "./genDiceSums";
import { combinatorialAnalysisFlashcards } from "./flashcards";
import {
  binomTailGE,
  binomTailLE,
  orderedDrawProb,
  unionFixedBitsCount,
  allSameColorProb,
  alternatingStepPathsCount,
  atLeastKOfAKindProb,
  avoidOneSpecialProb,
  circularAscendingProb,
  coinGrabAtLeastProb,
  coinRaceHeadsWinProb,
  deadlockSequencesCount,
  dealUntilOneEachProb,
  diceSumEqualsProb,
  divisibleByModProb,
  eachPlayerOneSpecialProb,
  exactlyTwoColorsProb,
  expectedPairsDealt,
  firstAllThreeOnDrawFourProb,
  heavierPanProb,
  hyperExactlyProb,
  hyperNoneProb,
  independentChoicesCount,
  keepBothNeighborsProb,
  latticeMeetingProb,
  lightsLineProb,
  maxLengthRaceProb,
  multiDeckStraightProb,
  multinomialPathsCount,
  nonDecreasingThreeDrawProb,
  oneCorrectAssignmentProb,
  oneOfEachColorProb,
  overbookedDeniedProb,
  pairSumAtLeastProb,
  pairsAgreeColorProb,
  pokerHandPercent,
  pokerHandProb,
  raceConditionalWinProb,
  returnToOriginProb,
  secretSharing,
  stepSequencesCount,
  strictlyIncreasingProb,
  subsetSumsToProb,
  sumLowestThreeMinProb,
  threeValuesGapProb,
  topTwoMaxProb,
} from "./solvers";

const r = (x: number, dp: number) => Math.round(x * 10 ** dp) / 10 ** dp;

/* ========================================================================== */
/*  1. Seed-dataset fixtures — the 51 ORIGINAL "Combinatorial Analysis" items.  */
/*     TEST-ONLY ground truth. No generated / user-facing content reuses these  */
/*     verbatim; users only ever see freshly generated instances. Counts (not   */
/*     probabilities) and the two-part CA11 are noted inline.                   */
/* ========================================================================== */

const SEED_ANSWERS: Record<string, number | string> = {
  CA1_3UniqueMarbles: 0.2463,
  CA2_90CentsPlease: 0.643, // 9/14 (computed — no source solution)
  CA3_AcesForAll: 0.105,
  CA4_AirHockeyDeadlock: 504, // integer COUNT
  CA5_AirplaneFood: 0.029,
  CA6_BinaryBookends: 448, // integer COUNT
  CA7_ButtonTin1: 0.0659,
  CA8_ButtonTin2: 0.367,
  CA9_CoinRace2: 0.254,
  CA10_DeadBatteries: 0.27,
  CA11_DemocraticSafe: "462 locks / 252 keys", // two-part
  CA12_DiceOrder: 0.093,
  CA13_FiveDeckStraight: 0.0311,
  CA14_FlippingCoin1: 0.3125,
  CA15_FlippingCoin2: 0.6,
  CA16_HeavierSide: 0.8,
  CA17_HowManyPairs: 0.857,
  CA18_LightsOn1: 0.0055,
  CA19_LightsOn2: 0.0275,
  CA20_LightsOn3: 0.0824,
  CA21_MaxThreeTails: 0.656,
  CA22_MeetingYourFriend: 0.27,
  CA23_MoreTails: 0.344,
  CA24_OldScale: 0.8,
  CA25_OverbookedFlight: 0.051,
  CA26_PickingBalls1: 0.06,
  CA27_PickingBalls2: 0.65,
  CA28_PickingBalls3: 0.286,
  CA29_PokerFourOfAKind: 0.024, // percent
  CA30_PokerFullHouse: 0.144, // percent
  CA31_PokerTwoPair: 4.754, // percent (decimal 0.048)
  CA32_RisingChips: 0.242,
  CA33_RooftopDrone: 13860, // integer COUNT
  CA34_RoundTableJesters: 0.143,
  CA35_RunningRabbit: 25, // integer COUNT
  CA36_SpecificCard2: 0.035,
  CA37_SpecificCard3: 0.0224,
  CA38_StarredWatchlist: 243, // integer COUNT
  CA39_StockPriceCoinFlip: 0.246,
  CA40_SubsetMakesSix: 0.75,
  CA41_SumOfPrimes: 0.75,
  CA42_SumSeventeen: 0.0802,
  CA43_SumTo3: 0.016,
  CA44_TableOfAges: 0.083,
  CA45_TenCardsNoKing: 0.4134,
  CA46_ThreeCardsDifference: 0.478,
  CA47_TopTwoDice: 0.1319,
  CA48_TripleMatch: 0.5409,
  CA49_TwoTickets: 0.444,
  CA50_UnitSteps: 792, // integer COUNT
  CA51_WheelOfEights: 0.125,
};

describe("seed dataset: all 51 answers captured as test-only ground truth", () => {
  it("has exactly 51 documented answers", () => {
    expect(Object.keys(SEED_ANSWERS).length).toBe(51);
  });
  it("routes the six integer COUNTS separately from [0,1] probabilities", () => {
    for (const key of [
      "CA4_AirHockeyDeadlock",
      "CA6_BinaryBookends",
      "CA33_RooftopDrone",
      "CA35_RunningRabbit",
      "CA38_StarredWatchlist",
      "CA50_UnitSteps",
    ]) {
      const v = SEED_ANSWERS[key] as number;
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThan(1); // NOT a probability in [0,1]
    }
  });
});

describe("CA solver reproduces all 51 documented answers", () => {
  it("CA1 3 Unique Marbles = 0.2463", () => {
    expect(r(oneOfEachColorProb([10, 10, 10], 3).valueOf(), 4)).toBe(0.2463);
  });
  it("CA2 90 Cents Please = 9/14 ≈ 0.643 (computed)", () => {
    const p = coinGrabAtLeastProb([200, 100, 50, 20, 10, 5, 2, 1], 3, 90);
    expect(p.equals(F(9, 14))).toBe(true);
    expect(r(p.valueOf(), 3)).toBe(0.643);
  });
  it("CA3 Aces for All = 0.105", () => {
    expect(r(eachPlayerOneSpecialProb(4, 13).valueOf(), 3)).toBe(0.105);
  });
  it("CA4 Air Hockey Deadlock = 504", () => {
    expect(deadlockSequencesCount(6)).toBe(504n);
  });
  it("CA5 Airplane Food = 1/35 ≈ 0.029", () => {
    expect(oneCorrectAssignmentProb(7, 4).equals(F(1, 35))).toBe(true);
    expect(r(oneCorrectAssignmentProb(7, 4).valueOf(), 3)).toBe(0.029);
  });
  it("CA6 Binary Bookends = 448", () => {
    expect(unionFixedBitsCount(10, 2, 2)).toBe(448n);
  });
  it("CA7 Button Tin #1 = 0.0659", () => {
    expect(r(orderedDrawProb([6, 9], [0, 0, 1, 1]).valueOf(), 4)).toBe(0.0659);
  });
  it("CA8 Button Tin #2 = 0.3670", () => {
    expect(pairsAgreeColorProb(6, 9).equals(F(167, 455))).toBe(true);
    expect(r(pairsAgreeColorProb(6, 9).valueOf(), 4)).toBe(0.367);
  });
  it("CA9 Coin Race #2 = 0.254", () => {
    expect(r(coinRaceHeadsWinProb(10, 3).valueOf(), 3)).toBe(0.254);
  });
  it("CA10 Dead Batteries = 0.27", () => {
    expect(r(hyperExactlyProb(25, 5, 6, 2).valueOf(), 2)).toBe(0.27);
  });
  it("CA11 Democratic Safe = 462 locks, 252 keys/person", () => {
    const s = secretSharing(11, 6);
    expect(s.locks).toBe(462n);
    expect(s.keysPerPerson).toBe(252n);
  });
  it("CA12 Dice Order = 5/54 ≈ 0.093", () => {
    expect(strictlyIncreasingProb(3, 6).equals(F(5, 54))).toBe(true);
    expect(r(strictlyIncreasingProb(3, 6).valueOf(), 3)).toBe(0.093);
  });
  it("CA13 Five Deck Straight = 0.0311", () => {
    expect(r(multiDeckStraightProb(5).valueOf(), 4)).toBe(0.0311);
  });
  it("CA14 Flipping a Coin #1 = 5/16 = 0.3125", () => {
    expect(maxLengthRaceProb(4).equals(F(5, 16))).toBe(true);
  });
  it("CA15 Flipping a Coin #2 = 3/5 = 0.6", () => {
    expect(raceConditionalWinProb(4, 6).equals(F(3, 5))).toBe(true);
  });
  it("CA16/CA24 Heavier Side / Old Scale = 0.8", () => {
    expect(heavierPanProb([101, 102, 103, 104, 105, 106]).equals(F(4, 5))).toBe(true);
  });
  it("CA17 How Many Pairs = 6/7 ≈ 0.857", () => {
    expect(expectedPairsDealt(4, 2, 4).equals(F(6, 7))).toBe(true);
    expect(r(expectedPairsDealt(4, 2, 4).valueOf(), 3)).toBe(0.857);
  });
  it("CA18 Lights On #1 = 1/182 ≈ 0.0055", () => {
    expect(lightsLineProb(4, 4).equals(F(1, 182))).toBe(true);
    expect(r(lightsLineProb(4, 4).valueOf(), 4)).toBe(0.0055);
  });
  it("CA19 Lights On #2 = 5/182 ≈ 0.0275", () => {
    expect(lightsLineProb(4, 5).equals(F(5, 182))).toBe(true);
    expect(r(lightsLineProb(4, 5).valueOf(), 4)).toBe(0.0275);
  });
  it("CA20 Lights On #3 = 15/182 ≈ 0.0824", () => {
    expect(lightsLineProb(4, 6).equals(F(15, 182))).toBe(true);
    expect(r(lightsLineProb(4, 6).valueOf(), 4)).toBe(0.0824);
  });
  it("CA21 Max Three Tails = 21/32 ≈ 0.656", () => {
    expect(binomTailLE(6, F(1, 2), 3).equals(F(21, 32))).toBe(true);
    expect(r(binomTailLE(6, F(1, 2), 3).valueOf(), 3)).toBe(0.656);
  });
  it("CA23 More Tails = 22/64 ≈ 0.344", () => {
    expect(binomTailGE(6, F(1, 2), 4).equals(F(11, 32))).toBe(true);
    expect(r(binomTailGE(6, F(1, 2), 4).valueOf(), 3)).toBe(0.344);
  });
  it("CA22 Meeting Your Friend = 70/256 ≈ 0.27", () => {
    expect(latticeMeetingProb(4).equals(F(70, 256))).toBe(true);
    expect(r(latticeMeetingProb(4).valueOf(), 2)).toBe(0.27);
  });
  it("CA25 Overbooked Flight ≈ 0.051", () => {
    expect(r(overbookedDeniedProb(310, 300, 0.05), 3)).toBe(0.051);
  });
  it("CA26 Picking Balls #1 = 5/84 ≈ 0.060", () => {
    expect(allSameColorProb([3, 4, 2], 3).equals(F(5, 84))).toBe(true);
    expect(r(allSameColorProb([3, 4, 2], 3).valueOf(), 3)).toBe(0.06);
  });
  it("CA27 Picking Balls #2 = 55/84 ≈ 0.65", () => {
    expect(exactlyTwoColorsProb([3, 4, 2], 3).equals(F(55, 84))).toBe(true);
    expect(r(exactlyTwoColorsProb([3, 4, 2], 3).valueOf(), 2)).toBe(0.65);
  });
  it("CA28 Picking Balls #3 = 2/7 ≈ 0.286", () => {
    expect(firstAllThreeOnDrawFourProb([3, 4, 2]).equals(F(2, 7))).toBe(true);
    expect(r(firstAllThreeOnDrawFourProb([3, 4, 2]).valueOf(), 3)).toBe(0.286);
  });
  it("CA29 Poker Four of a Kind = 0.024%", () => {
    expect(r(pokerHandPercent("fourOfAKind").valueOf(), 3)).toBe(0.024);
  });
  it("CA30 Poker Full House = 0.144%", () => {
    expect(r(pokerHandPercent("fullHouse").valueOf(), 3)).toBe(0.144);
  });
  it("CA31 Poker Two Pair = 4.754% ≈ 0.048", () => {
    expect(r(pokerHandPercent("twoPair").valueOf(), 3)).toBe(4.754);
    expect(r(pokerHandProb("twoPair").valueOf(), 3)).toBe(0.048);
  });
  it("CA32 Rising Chips = 22/91 ≈ 0.242", () => {
    expect(nonDecreasingThreeDrawProb(5, 3).equals(F(22, 91))).toBe(true);
    expect(r(nonDecreasingThreeDrawProb(5, 3).valueOf(), 3)).toBe(0.242);
  });
  it("CA33 Rooftop Drone = 13860", () => {
    expect(multinomialPathsCount([6, 4, 2])).toBe(13860n);
  });
  it("CA34 Round Table Jesters = 1/7 ≈ 0.143", () => {
    expect(keepBothNeighborsProb(15, 9).equals(F(1, 7))).toBe(true);
    expect(r(keepBothNeighborsProb(15, 9).valueOf(), 3)).toBe(0.143);
  });
  it("CA35 Running Rabbit = 25", () => {
    expect(alternatingStepPathsCount(13, 4, 1, 3)).toBe(25n);
  });
  it("CA36 Specific Card #2 = 0.035", () => {
    expect(r(dealUntilOneEachProb([4, 4, 4], 4).valueOf(), 3)).toBe(0.035);
  });
  it("CA37 Specific Card #3 = 0.0224", () => {
    expect(r(dealUntilOneEachProb([4, 4, 4], 1).valueOf(), 4)).toBe(0.0224);
  });
  it("CA38 Starred Watchlist = 243", () => {
    expect(independentChoicesCount(3, 5)).toBe(243n);
  });
  it("CA39 Stock Price Coin Flip = 0.246", () => {
    expect(r(returnToOriginProb(10).valueOf(), 3)).toBe(0.246);
  });
  it("CA40 Subset Makes Six = 3/4 = 0.75", () => {
    expect(subsetSumsToProb(3, 6, 6).equals(F(3, 4))).toBe(true);
  });
  it("CA41 Sum of Primes = 3/4 = 0.75", () => {
    expect(avoidOneSpecialProb(16, 4).equals(F(3, 4))).toBe(true);
  });
  it("CA42 Sum Seventeen = 13/162 ≈ 0.0802", () => {
    expect(diceSumEqualsProb(4, 6, 17).equals(F(13, 162))).toBe(true);
    expect(r(diceSumEqualsProb(4, 6, 17).valueOf(), 4)).toBe(0.0802);
  });
  it("CA43 Sum to 3 = 7/432 ≈ 0.016", () => {
    expect(sumLowestThreeMinProb(6).equals(F(7, 432))).toBe(true);
    expect(r(sumLowestThreeMinProb(6).valueOf(), 3)).toBe(0.016);
  });
  it("CA44 Table of Ages = 1/12 ≈ 0.083", () => {
    expect(circularAscendingProb(5).equals(F(1, 12))).toBe(true);
    expect(r(circularAscendingProb(5).valueOf(), 3)).toBe(0.083);
  });
  it("CA45 Ten Cards, No King = 246/595 ≈ 0.4134", () => {
    expect(hyperNoneProb(52, 4, 10).equals(F(246, 595))).toBe(true);
    expect(r(hyperNoneProb(52, 4, 10).valueOf(), 4)).toBe(0.4134);
  });
  it("CA46 Three Cards Difference = 528/1105 ≈ 0.478", () => {
    expect(threeValuesGapProb(13).equals(F(528, 1105))).toBe(true);
    expect(r(threeValuesGapProb(13).valueOf(), 3)).toBe(0.478);
  });
  it("CA47 Top Two Dice = 19/144 ≈ 0.1319", () => {
    expect(topTwoMaxProb(4, 6).equals(F(19, 144))).toBe(true);
    expect(r(topTwoMaxProb(4, 6).valueOf(), 4)).toBe(0.1319);
  });
  it("CA48 Triple Match = 701/1296 ≈ 0.5409", () => {
    expect(atLeastKOfAKindProb(7, 6, 3).equals(F(701, 1296))).toBe(true);
    expect(r(atLeastKOfAKindProb(7, 6, 3).valueOf(), 4)).toBe(0.5409);
  });
  it("CA49 Two Tickets = 4/9 ≈ 0.444", () => {
    expect(pairSumAtLeastProb(10, 12).equals(F(4, 9))).toBe(true);
  });
  it("CA50 Unit Steps = 792", () => {
    expect(stepSequencesCount(12, 2)).toBe(792n);
  });
  it("CA51 Wheel of Eights = 1/8 = 0.125", () => {
    expect(divisibleByModProb(6, 8, 3).equals(F(1, 8))).toBe(true);
  });
});

/* ========================================================================== */
/*  1b. Second INDEPENDENT method — brute-force cross-checks of key solvers.     */
/*      Each recomputes an answer a DIFFERENT way (naive enumeration / an        */
/*      alternate closed form) than the solver's internal route.                */
/* ========================================================================== */

describe("solvers agree with an independent brute-force derivation", () => {
  it("dice-sum count = naive nested-loop enumeration (4 d6)", () => {
    for (const target of [14, 15, 16, 17, 18]) {
      let brute = 0;
      for (let a = 1; a <= 6; a++)
        for (let b = 1; b <= 6; b++)
          for (let c = 1; c <= 6; c++)
            for (let d = 1; d <= 6; d++) if (a + b + c + d === target) brute++;
      expect(diceSumEqualsProb(4, 6, target).equals(F(brute, 1296))).toBe(true);
    }
  });
  it("lattice meeting = Σ_i C(n,i)² / 4ⁿ (independent of the C(2n,n) form)", () => {
    for (const n of [3, 4, 5]) {
      let s = 0n;
      for (let i = 0; i <= n; i++) s += BigInt(choose(n, i)) ** 2n;
      expect(latticeMeetingProb(n).equals(F(s.toString(), 4 ** n))).toBe(true);
    }
  });
  it("strictly-increasing = enumeration of ordered dice triples", () => {
    for (const faces of [6, 8]) {
      let inc = 0;
      for (let a = 1; a <= faces; a++)
        for (let b = 1; b <= faces; b++)
          for (let c = 1; c <= faces; c++) if (a < b && b < c) inc++;
      expect(strictlyIncreasingProb(3, faces).equals(F(inc, faces ** 3))).toBe(true);
    }
  });
  it("coin-grab ≥90¢ = independent subset enumeration (agrees with 9/14)", () => {
    const coins = [200, 100, 50, 20, 10, 5, 2, 1];
    let fav = 0;
    let tot = 0;
    for (let i = 0; i < 8; i++)
      for (let j = i + 1; j < 8; j++)
        for (let k = j + 1; k < 8; k++) {
          tot++;
          if (coins[i] + coins[j] + coins[k] >= 90) fav++;
        }
    expect(coinGrabAtLeastProb(coins, 3, 90).equals(F(fav, tot))).toBe(true);
    expect(F(fav, tot).equals(F(9, 14))).toBe(true); // re-derivation AGREES with 9/14
  });
  it("multinomial 3-D paths = product of nested binomials C(a+b+c,a)·C(b+c,b)", () => {
    for (const [a, b, c] of [[6, 4, 2], [3, 3, 3], [5, 2, 4]] as const) {
      const nested = BigInt(choose(a + b + c, a)) * BigInt(choose(b + c, b));
      expect(multinomialPathsCount([a, b, c])).toBe(nested);
    }
  });
});

/* ========================================================================== */
/*  2. Generators — grading round-trips, distractor quality, determinism.       */
/*     Every generated answer comes from the verified solvers above, so here we  */
/*     assert the QUESTION objects are well-formed: numeric answers grade, all   */
/*     commonErrors are finite / ≠ answer / feedback-firing and distinct; quiz   */
/*     choices are distinct with an aligned correct index + rationale.           */
/* ========================================================================== */

const NUMERIC_GENS: Record<string, (rng: Rng) => NumericQuestion> = {
  genOneOfEach,
  genAllSameColor,
  genExactlyTwoColors,
  genAvoidSpecialSum,
  genPairSumThreshold,
  genOneAssignment,
  genEachPlayerSpecial,
  genHyperExactly,
  genHyperNone,
  genHyperAtLeast,
  genBinomAtMost,
  genMoreTails,
  genReturnOrigin,
  genStepCount,
  genLatticeMeeting,
  genRaceCondition,
  genLightsLine,
  genMultinomialPaths,
  genAlternatingSteps,
  genDivisibility,
  genOrderedDraw,
  genDealUntil,
  genCircularAscending,
  genGapMethod,
  genIndependentChoices,
  genUnionFixedBits,
  genBalanceScale,
  genDiceSumTarget,
  genTopTwoSum,
  genAtLeastKOfAKind,
  genSubsetSum,
  genStrictlyIncreasing,
  genExpectedPairs,
  // PHASE_2 MCQ→free-response conversions (ca-3 poker, ca-5 counting traps).
  genPokerHandNumeric,
  genPermVsCombNumeric,
  genReplacementTrapNumeric,
  genTiesOrderNumeric,
  genStarsBarsCapNumeric,
};

const QUIZ_GENS: Record<string, (rng: Rng) => Question> = {
  genPokerHand,
  genPermVsComb,
  genReplacementTrap,
  genTiesOrder,
  genStarsBarsCap,
};

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 131 + 5);

describe("numeric generators: grading round-trips + clean distractors", () => {
  for (const [name, gen] of Object.entries(NUMERIC_GENS)) {
    it(`${name} — answer grades, commonErrors are clean`, () => {
      for (const seed of SEEDS) {
        const q = gen(new Rng(seed));
        const dp = q.decimals ?? 0;
        const f = 10 ** dp;
        // answer well-formed
        expect(Number.isFinite(q.answer)).toBe(true);
        expect(q.answer).toBeGreaterThanOrEqual(0);
        if (q.decimals == null) {
          expect(Number.isInteger(q.answer)).toBe(true);
          expect(q.answer).toBeGreaterThan(0);
        }
        // grading round-trips
        const typed = dp === 0 ? String(q.answer) : q.answer.toFixed(dp);
        expect(gradeNumeric(q, typed).correct).toBe(true);
        // determinism
        const q2 = gen(new Rng(seed));
        expect(q2.answer).toBe(q.answer);
        expect(q2.id).toBe(q.id);
        // every commonError finite, ≠ answer at dp, fires targeted feedback
        for (const ce of q.commonErrors ?? []) {
          expect(Number.isFinite(ce.value)).toBe(true);
          expect(ce.value).toBeGreaterThanOrEqual(0);
          expect(Math.round(ce.value * f)).not.toBe(Math.round(q.answer * f));
          const g = gradeNumeric(q, dp === 0 ? String(ce.value) : ce.value.toFixed(dp));
          expect(g.correct).toBe(false);
          expect(g.matchedError?.feedback).toBeTruthy();
        }
        // commonErrors mutually distinct at grading precision
        const keys = (q.commonErrors ?? []).map((e) => Math.round(e.value * f));
        expect(new Set(keys).size).toBe(keys.length);
        expect(q.explanation.trim().length).toBeGreaterThan(40);
      }
    });
  }
});

/* ========================================================================== */
/*  2b. Free-response conversions (ca-3 poker, ca-5 traps) — every common      */
/*      error is a NAMED, parametric misconception (rung-1 coaching driver),    */
/*      and the correct value still grades typed as a fraction/expression.      */
/* ========================================================================== */

describe("free-response conversions carry tagged error modes + grade fractions", () => {
  const CONVERTED: Record<string, { gen: (rng: Rng) => NumericQuestion; needs: string[] }> = {
    genPokerHandNumeric: { gen: genPokerHandNumeric, needs: ["forgot_suit_combo"] },
    genPermVsCombNumeric: {
      gen: genPermVsCombNumeric,
      needs: ["ordered_vs_unordered", "counts_with_replacement", "naive_product"],
    },
    genReplacementTrapNumeric: {
      gen: genReplacementTrapNumeric,
      needs: ["ordered_vs_unordered", "forgot_replacement", "unordered_with_replacement"],
    },
    genTiesOrderNumeric: {
      gen: genTiesOrderNumeric,
      needs: ["strict_vs_nondecreasing", "assume_all_distinct"],
    },
    genStarsBarsCapNumeric: {
      gen: genStarsBarsCapNumeric,
      needs: ["forgot_face_cap", "forgot_die_minimum", "off_by_one_target"],
    },
  };

  for (const [name, { gen, needs }] of Object.entries(CONVERTED)) {
    it(`${name} — every common error is tagged; answer grades as a fraction`, () => {
      const tagsAcrossSeeds = new Set<string>();
      for (const seed of SEEDS) {
        const q = gen(new Rng(seed));
        expect((q.commonErrors ?? []).length).toBeGreaterThan(0);
        for (const ce of q.commonErrors ?? []) {
          expect(ce.misconception, `${name} untagged error @${seed}`).toBeTruthy();
          expect(ce.feedback.length).toBeGreaterThan(20);
          if (ce.misconception) tagsAcrossSeeds.add(ce.misconception);
        }
        // the correct answer still grades via the free-response parser.
        const dp = q.decimals ?? 0;
        const typed = dp === 0 ? String(q.answer) : q.answer.toFixed(dp);
        expect(gradeFreeResponse(q, typed).correct).toBe(true);
      }
      for (const tag of needs) {
        expect(tagsAcrossSeeds.has(tag), `${name} never emitted "${tag}"`).toBe(true);
      }
    });
  }
});

describe("quiz generators: valid correct index + distinct, aligned choices", () => {
  for (const [name, gen] of Object.entries(QUIZ_GENS)) {
    it(`${name} — options clean, rationale aligned`, () => {
      for (const seed of SEEDS) {
        const q = gen(new Rng(seed));
        expect(q.correctIndex).toBeGreaterThanOrEqual(0);
        expect(q.correctIndex).toBeLessThan(q.choices.length);
        expect(q.choices.length).toBeGreaterThanOrEqual(2);
        expect(new Set(q.choices).size).toBe(q.choices.length); // no dup options
        expect(q.distractorRationale?.length).toBe(q.choices.length);
        q.choices.forEach((c, i) => {
          if (i !== q.correctIndex) expect(c).not.toBe(q.choices[q.correctIndex]);
        });
        expect(q.explanation.trim().length).toBeGreaterThan(40);
      }
    });
  }
});

/* ========================================================================== */
/*  3. No original dataset title/wording leaks into any generated prompt.        */
/* ========================================================================== */

const FINGERPRINTS = [
  "3 Unique Marbles", "90 Cents", "Aces for All", "Air Hockey", "Deadlock",
  "Airplane Food", "Binary Bookends", "Button Tin", "Coin Race",
  "Democratic Safe", "Dead Batteries", "Dice Order", "Five Deck Straight",
  "Flipping a Coin", "Heavier Side", "How Many Pairs", "Lights On",
  "Max Three Tails", "Meeting Your Friend", "More Tails", "Old Scale",
  "Overbooked Flight", "Picking Balls", "Poker - Four of a Kind",
  "Poker - Full House", "Poker - Two Pair", "Rising Chips", "Rooftop Drone",
  "Round Table Jesters", "Running Rabbit", "Specific Card", "Starred Watchlist",
  "Stock Price Coin Flip", "Subset Makes Six", "Sum of Primes", "Sum Seventeen",
  "Sum to 3", "Table of Ages", "Ten Cards", "Three Cards Difference",
  "Top Two Dice", "Triple Match", "Two Tickets", "Unit Steps", "Wheel of Eights",
];

describe("no source-dataset title/wording leaks into generated prompts", () => {
  it("generated prompts never contain a verbatim dataset fingerprint", () => {
    const gens = [
      ...Object.values(NUMERIC_GENS),
      ...Object.values(QUIZ_GENS),
    ] as ((rng: Rng) => { prompt: string })[];
    for (const seed of SEEDS) {
      for (const gen of gens) {
        const q = gen(new Rng(seed));
        for (const fp of FINGERPRINTS) expect(q.prompt).not.toContain(fp);
      }
    }
  });
  it("flashcard PROMPTS avoid the dataset fingerprints too", () => {
    for (const c of combinatorialAnalysisFlashcards) {
      for (const fp of FINGERPRINTS) expect(c.prompt).not.toContain(fp);
    }
  });
});

/* ========================================================================== */
/*  4. Reasoning-desk flashcards (ca-9) — the non-scalar specials well-formed.   */
/* ========================================================================== */

describe("Combinatorial reasoning flashcards cover the non-scalar specials", () => {
  it("include the flagged specials with substantive explanations + unique ids", () => {
    const ids = new Set(combinatorialAnalysisFlashcards.map((c) => c.id));
    expect(ids.size).toBe(combinatorialAnalysisFlashcards.length); // unique
    for (const need of [
      "ca-fc-secretsharing", // two-part locks/keys
      "ca-fc-coingrab", // computed value-threshold
      "ca-fc-overbooked", // big-binomial tail
      "ca-fc-multideckstraight", // straights − straight flushes
      "ca-fc-linearitypairs", // linearity of indicators
    ]) {
      expect(ids.has(need)).toBe(true);
    }
    for (const c of combinatorialAnalysisFlashcards) {
      expect(c.prompt.trim().length).toBeGreaterThan(5);
      expect(c.answer.trim().length).toBeGreaterThan(0);
      expect(c.explanation.trim().length).toBeGreaterThan(40);
    }
  });
  it("the secret-sharing special reveals BOTH the lock count and keys/person", () => {
    const fc = combinatorialAnalysisFlashcards.find((c) => c.id === "ca-fc-secretsharing")!;
    expect(/lock/i.test(fc.answer) && /key/i.test(fc.answer)).toBe(true);
  });
});
