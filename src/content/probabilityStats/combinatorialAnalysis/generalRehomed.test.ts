import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import { gradeNumeric } from "@/lib/numeric";
import type { NumericQuestion, Question } from "@/types/content";
import {
  F,
  absDiffInRangeProb,
  allDifferentDigitsProb,
  ascendingGame,
  biggerDieProb,
  binomTailGE,
  binomTailLE,
  birthdayCollisionProb,
  birthdayThreshold,
  bothColorsProb,
  commonSemicircleProb,
  consecutiveRunProb,
  containsDigitProb,
  couponCollectorExpected,
  diceSumEvenProb,
  diceSumInSetProb,
  diceSumLEProb,
  evenHeadsProb,
  expectedWordsAfterMerges,
  higherCardProb,
  notAorNotBProb,
  onesGreaterThanTensProb,
  pigeonholeCertain,
  polygonNoCollisionProb,
  productEvenProb,
  round1MeetProb,
  secondLessProb,
  smallestNForAtLeastOne,
  topTwoSeedsMeetFinalProb,
  tripleMatchProb,
  twoInARowScheduleProb,
  twoMoveOddProb,
  twoSumCollisionProb,
} from "../coreSolvers";
import {
  genBinomTail,
  genBothColors,
  genContainsDigit,
  genProductEven,
  genSmallestN,
  genSubInterval,
} from "./genGeneralComplement";
import {
  genBracketFinal,
  genConsecutiveRun,
  genCoupon,
  genHigherCard,
  genInclExcl,
  genLinearityWords,
  genPolygonAnts,
  genRound1,
  genSemicircle,
  genTwoInRowSchedule,
} from "./genGeneralCounting";
import {
  genDiceSumQuiz,
  genDieCompare,
  genDigitOrder,
  genParitySymmetry,
} from "./genGeneralDice";
import { combinatorialGeneralFlashcards } from "./generalFlashcards";

/**
 * Re-homed from the former `general/general.test.ts`: the counting-family slice
 * of the original 67 "General" seed fixtures (binomial tails, complements,
 * birthday/collision, digit counting, dice sums & symmetry, tournaments &
 * arrangements, counting/expectation misc) plus the counting generators'
 * round-trip + distractor-quality checks and the fairness-payout flashcard.
 */

const r = (x: number, dp: number) => Math.round(x * 10 ** dp) / 10 ** dp;

const NUMERIC_GENS: Record<string, (rng: Rng) => NumericQuestion> = {
  genBothColors,
  genContainsDigit,
  genSubInterval,
  genProductEven,
  genSmallestN,
  genBinomTail,
  genDigitOrder,
  genBracketFinal,
  genRound1,
  genSemicircle,
  genPolygonAnts,
  genCoupon,
  genLinearityWords,
  genTwoInRowSchedule,
  genConsecutiveRun,
  genHigherCard,
  genInclExcl,
};

const QUIZ_GENS: Record<string, (rng: Rng) => Question> = {
  genDiceSumQuiz,
  genParitySymmetry,
  genDieCompare,
};

const SEED_ANSWERS: Record<string, number> = {
  GN4_AnyCakeLeft: 0.9,
  GN5_FourFives1: 0.584,
  GN6_FourFives2: 0.98,
  GN7_ClawMachine: 19,
  GN8_BothCardColors: 0.765,
  GN9_FiveInMillion: 0.4686,
  GN10_BikesOnRoad: 0.6,
  GN11_Multiply3Dice: 0.875,
  GN12_Birthday1: 23,
  GN13_Birthday2: 0.39,
  GN18_DifferentDigits: 0.738,
  GN19_TwoDigitNumber: 0.4,
  GN20_LowTotal: 0.167,
  GN21_OutcomeDice: 0.083,
  GN22_SumTwoRandom: 0.067,
  GN23_EvenSum: 0.5,
  GN24_EvenHeads: 0.5,
  GN25_LowerDie: 0.4166,
  GN26_MismatchedDice: 0.69,
  GN48_KnockoutStage: 0.258,
  GN49_OpeningRoundDraw: 0.0667,
  GN50_RadarSweep: 0.3125,
  GN51_PentagonAnts: 0.0625,
  GN52_AllFaces: 14.7,
  GN53_ArcadeTriple: 0.00167,
  GN54_CherryStreak: 0.0098,
  GN55_FootballOrCupcake: 15,
  GN56_HigherCard: 0.47,
  GN57_Checkmate: 0.171,
  GN58_FourDigitDifference: 0.188,
  GN59_CoinsInBoxes: 1,
  GN60_OldPhone1: 0.555,
  GN61_OldPhone2: 0.555,
  GN62_Complementary: 0.9,
  GN67_FiveAscending: 119,
};

describe("solver reproduces documented answers — binomial counting", () => {
  it("Any Cake Left (GN4) P(X≤2) ≈ 0.901 → 0.9", () => {
    expect(r(binomTailLE(6, F(1, 5), 2).valueOf(), 1)).toBe(SEED_ANSWERS.GN4_AnyCakeLeft);
    expect(r(binomTailLE(6, F(1, 5), 2).valueOf(), 3)).toBe(0.901);
  });
  it("Four Fives #1 (GN5) P(X≥4), p=1/6 → 0.584", () => {
    expect(r(binomTailGE(24, F(1, 6), 4).valueOf(), 3)).toBe(SEED_ANSWERS.GN5_FourFives1);
  });
  it("Four Fives #2 (GN6) P(X≥4), p=1/3 → 0.980", () => {
    expect(r(binomTailGE(24, F(1, 3), 4).valueOf(), 3)).toBe(SEED_ANSWERS.GN6_FourFives2);
  });
  it("Claw Machine (GN7) smallest n = 19", () => {
    expect(smallestNForAtLeastOne(0.15, 0.95)).toBe(SEED_ANSWERS.GN7_ClawMachine);
  });
});

describe("solver reproduces documented answers — complement / at-least-one", () => {
  it("Both Card Colors (GN8) = 0.765", () => {
    expect(r(bothColorsProb(26, 26, 3).valueOf(), 3)).toBe(SEED_ANSWERS.GN8_BothCardColors);
  });
  it("Five In Million (GN9) = 0.4686", () => {
    expect(r(containsDigitProb(6).valueOf(), 4)).toBe(SEED_ANSWERS.GN9_FiveInMillion);
  });
  it("Bikes on the Road (GN10) p = 0.6 (16/625 = (2/5)^4)", () => {
    expect(r(1 - Math.pow(16 / 625, 1 / 4), 6)).toBe(SEED_ANSWERS.GN10_BikesOnRoad);
  });
  it("Multiply 3 Dice (GN11) = 0.875", () => {
    expect(productEvenProb(3, 6).equals(F(7, 8))).toBe(true);
    expect(productEvenProb(3, 6).valueOf()).toBe(SEED_ANSWERS.GN11_Multiply3Dice);
  });
});

describe("solver reproduces documented answers — birthday / collision", () => {
  it("Birthday #1 (GN12) N = 23", () => {
    expect(birthdayThreshold(365)).toBe(SEED_ANSWERS.GN12_Birthday1);
  });
  it("Birthday #2 (GN13) = 19/49 ≈ 0.39", () => {
    expect(birthdayCollisionProb(3, 7).equals(F(19, 49))).toBe(true);
    expect(r(birthdayCollisionProb(3, 7).valueOf(), 2)).toBe(SEED_ANSWERS.GN13_Birthday2);
  });
});

describe("solver reproduces documented answers — digit counting", () => {
  it("Different Digits (GN18) = 738/1000 = 0.738", () => {
    expect(allDifferentDigitsProb(3).equals(F(738, 1000))).toBe(true);
    expect(allDifferentDigitsProb(3).valueOf()).toBe(SEED_ANSWERS.GN18_DifferentDigits);
  });
  it("Two Digit Number (GN19) = 2/5 = 0.4", () => {
    expect(onesGreaterThanTensProb().equals(F(2, 5))).toBe(true);
    expect(onesGreaterThanTensProb().valueOf()).toBe(SEED_ANSWERS.GN19_TwoDigitNumber);
  });
});

describe("solver reproduces documented answers — dice sums & symmetry", () => {
  it("Low Total (GN20) P(sum ≤ 4) = 1/6 ≈ 0.167", () => {
    expect(r(diceSumLEProb(2, 6, 4).valueOf(), 3)).toBe(SEED_ANSWERS.GN20_LowTotal);
  });
  it("Outcome Dice (GN21) P(sum ∈ {2,3}) = 1/12 ≈ 0.083", () => {
    expect(r(diceSumInSetProb(6, [2, 3]).valueOf(), 3)).toBe(SEED_ANSWERS.GN21_OutcomeDice);
  });
  it("Sum Two Random (GN22) = 670/10000 = 0.067", () => {
    expect(twoSumCollisionProb(10).equals(F(670, 10000))).toBe(true);
    expect(twoSumCollisionProb(10).valueOf()).toBe(SEED_ANSWERS.GN22_SumTwoRandom);
  });
  it("Even Sum (GN23) = 1/2 by symmetry", () => {
    expect(diceSumEvenProb(5, 6).equals(F(1, 2))).toBe(true);
    expect(diceSumEvenProb(5, 6).valueOf()).toBe(SEED_ANSWERS.GN23_EvenSum);
  });
  it("Even Heads (GN24) = 1/2 by parity pairing", () => {
    expect(evenHeadsProb(1000).equals(F(1, 2))).toBe(true);
    expect(evenHeadsProb(1000).valueOf()).toBe(SEED_ANSWERS.GN24_EvenHeads);
  });
  it("Lower Die (GN25) = 5/12 (doc truncates to 0.4166)", () => {
    expect(secondLessProb(6).equals(F(5, 12))).toBe(true);
    expect(Math.floor(secondLessProb(6).valueOf() * 1e4) / 1e4).toBe(SEED_ANSWERS.GN25_LowerDie);
  });
  it("Mismatched Dice (GN26) d50 > d30 = 0.69", () => {
    expect(biggerDieProb(30, 50).equals(F(69, 100))).toBe(true);
    expect(biggerDieProb(30, 50).valueOf()).toBe(SEED_ANSWERS.GN26_MismatchedDice);
  });
});

describe("solver reproduces documented answers — tournaments & arrangements", () => {
  it("Knockout Stage (GN48) = 8/31 ≈ 0.258", () => {
    expect(topTwoSeedsMeetFinalProb(32).equals(F(8, 31))).toBe(true);
    expect(r(topTwoSeedsMeetFinalProb(32).valueOf(), 3)).toBe(SEED_ANSWERS.GN48_KnockoutStage);
  });
  it("Opening Round Draw (GN49) = 1/15 ≈ 0.0667", () => {
    expect(round1MeetProb(16).equals(F(1, 15))).toBe(true);
    expect(r(round1MeetProb(16).valueOf(), 4)).toBe(SEED_ANSWERS.GN49_OpeningRoundDraw);
  });
  it("Radar Sweep (GN50) semicircle = 5/16 = 0.3125", () => {
    expect(commonSemicircleProb(5).equals(F(5, 16))).toBe(true);
    expect(commonSemicircleProb(5).valueOf()).toBe(SEED_ANSWERS.GN50_RadarSweep);
  });
  it("Pentagon Ants (GN51) = 1/16 = 0.0625", () => {
    expect(polygonNoCollisionProb(5).equals(F(1, 16))).toBe(true);
    expect(polygonNoCollisionProb(5).valueOf()).toBe(SEED_ANSWERS.GN51_PentagonAnts);
  });
});

describe("solver reproduces documented answers — counting / expectation misc", () => {
  it("All Faces (GN52) coupon collector = 14.7", () => {
    expect(couponCollectorExpected(6).equals(F(147, 10))).toBe(true);
    expect(couponCollectorExpected(6).valueOf()).toBe(SEED_ANSWERS.GN52_AllFaces);
  });
  it("Arcade Triple (GN53) = 1/600 ≈ 0.00167", () => {
    expect(tripleMatchProb(8, 40, 15).equals(F(1, 600))).toBe(true);
    expect(r(tripleMatchProb(8, 40, 15).valueOf(), 5)).toBe(SEED_ANSWERS.GN53_ArcadeTriple);
  });
  it("Cherry Streak (GN54) = 5/512 ≈ 0.0098", () => {
    expect(consecutiveRunProb(6, 4, F(1, 4)).equals(F(5, 512))).toBe(true);
    expect(r(consecutiveRunProb(6, 4, F(1, 4)).valueOf(), 4)).toBe(SEED_ANSWERS.GN54_CherryStreak);
  });
  it("Football or Cupcake (GN55) = 15", () => {
    expect(expectedWordsAfterMerges(17, 4, 2).equals(F(15))).toBe(true);
    expect(expectedWordsAfterMerges(17, 4, 2).valueOf()).toBe(SEED_ANSWERS.GN55_FootballOrCupcake);
  });
  it("Higher Card (GN56) = 8/17 ≈ 0.47", () => {
    expect(higherCardProb(13, 4).equals(F(8, 17))).toBe(true);
    expect(r(higherCardProb(13, 4).valueOf(), 2)).toBe(SEED_ANSWERS.GN56_HigherCard);
  });
  it("Checkmate (GN57) = 0.171", () => {
    const p = twoInARowScheduleProb([F(1, 10), F(9, 10), F(1, 10)]);
    expect(r(p.valueOf(), 3)).toBe(SEED_ANSWERS.GN57_Checkmate);
  });
  it("Four Digit Difference (GN58) = 16901/90000 ≈ 0.188", () => {
    expect(absDiffInRangeProb(9000, 100, 999).equals(F(16901, 90000))).toBe(true);
    expect(r(absDiffInRangeProb(9000, 100, 999).valueOf(), 3)).toBe(SEED_ANSWERS.GN58_FourDigitDifference);
  });
  it("Coins in Boxes (GN59) pigeonhole = 1", () => {
    expect(pigeonholeCertain(76, 15, 5).valueOf()).toBe(SEED_ANSWERS.GN59_CoinsInBoxes);
  });
  it("Old Phone #1/#2 (GN60/GN61) = 5/9 (doc truncates to 0.555)", () => {
    expect(twoMoveOddProb().equals(F(5, 9))).toBe(true);
    expect(Math.floor(twoMoveOddProb().valueOf() * 1e3) / 1e3).toBe(SEED_ANSWERS.GN60_OldPhone1);
    expect(Math.floor(twoMoveOddProb().valueOf() * 1e3) / 1e3).toBe(SEED_ANSWERS.GN61_OldPhone2);
  });
  it("Complementary (GN62) = 0.9", () => {
    expect(notAorNotBProb(F(7, 10), F(5, 10), F(3, 10)).equals(F(9, 10))).toBe(true);
    expect(notAorNotBProb(F(7, 10), F(5, 10), F(3, 10)).valueOf()).toBe(SEED_ANSWERS.GN62_Complementary);
  });
  it("Five Ascending Cards (GN67) not fair; fair payout = $119", () => {
    const { winProb, ev, fairReward } = ascendingGame(5, 25, 1);
    expect(winProb.equals(F(1, 120))).toBe(true);
    expect(ev.valueOf()).toBeLessThan(0);
    expect(fairReward.equals(F(119))).toBe(true);
    expect(fairReward.valueOf()).toBe(SEED_ANSWERS.GN67_FiveAscending);
  });
});

describe("solvers agree with a second independent derivation", () => {
  it("binomial upper tail = direct sum of upper terms (not 1 − lower)", () => {
    for (const [n, pn, pd, k] of [
      [24, 1, 6, 4],
      [10, 1, 3, 3],
      [12, 1, 2, 7],
    ] as const) {
      const p = F(pn, pd);
      let direct = F(0);
      for (let j = k; j <= n; j++) direct = direct.add(binomPMFLocal(n, p, j));
      expect(direct.equals(binomTailGE(n, p, k))).toBe(true);
    }
  });
  it("common-semicircle = n·2^(1−n) computed directly", () => {
    for (const n of [3, 4, 5, 6]) {
      expect(commonSemicircleProb(n).equals(F(n).div(F(2 ** (n - 1))))).toBe(true);
    }
  });
  it("even-heads (small n) via pairing = 2^(n−1)/2^n = ½", () => {
    for (const n of [1, 2, 5, 8, 12]) {
      expect(evenHeadsProb(n).equals(F(2 ** (n - 1), 2 ** n))).toBe(true);
    }
  });
});

function binomPMFLocal(n: number, p: ReturnType<typeof F>, k: number): ReturnType<typeof F> {
  const q = F(1).sub(p);
  let c = 1;
  for (let i = 0; i < k; i++) c = (c * (n - i)) / (i + 1);
  return F(Math.round(c))
    .mul(p.pow(k) as ReturnType<typeof F>)
    .mul(q.pow(n - k) as ReturnType<typeof F>);
}

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 131 + 5);

describe("numeric generators: grading round-trips + clean distractors", () => {
  for (const [name, gen] of Object.entries(NUMERIC_GENS)) {
    it(`${name} — answer grades, commonErrors are clean`, () => {
      for (const seed of SEEDS) {
        const q = gen(new Rng(seed));
        const dp = q.decimals ?? 0;
        const f = 10 ** dp;
        expect(Number.isFinite(q.answer)).toBe(true);
        expect(q.answer).toBeGreaterThanOrEqual(0);
        if (q.decimals == null) {
          expect(Number.isInteger(q.answer)).toBe(true);
          expect(q.answer).toBeGreaterThan(0);
        }
        const typed = dp === 0 ? String(q.answer) : q.answer.toFixed(dp);
        expect(gradeNumeric(q, typed).correct).toBe(true);
        const q2 = gen(new Rng(seed));
        expect(q2.answer).toBe(q.answer);
        for (const ce of q.commonErrors ?? []) {
          expect(Number.isFinite(ce.value)).toBe(true);
          expect(Math.round(ce.value * f)).not.toBe(Math.round(q.answer * f));
          const g = gradeNumeric(q, dp === 0 ? String(ce.value) : ce.value.toFixed(dp));
          expect(g.correct).toBe(false);
          expect(g.matchedError?.feedback).toBeTruthy();
        }
        const keys = (q.commonErrors ?? []).map((e) => Math.round(e.value * f));
        expect(new Set(keys).size).toBe(keys.length);
        expect(q.explanation.trim().length).toBeGreaterThan(40);
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
        expect(new Set(q.choices).size).toBe(q.choices.length);
        expect(q.distractorRationale?.length).toBe(q.choices.length);
        q.choices.forEach((c, i) => {
          if (i !== q.correctIndex) expect(c).not.toBe(q.choices[q.correctIndex]);
        });
        expect(q.explanation.trim().length).toBeGreaterThan(40);
      }
    });
  }
});

const FINGERPRINTS = [
  "Any Cake Left", "Four Fives", "Claw Machine", "Both Card Colors",
  "Five In Million", "Bikes on the Road", "Multiply 3 Dice", "Birthday Problem",
  "Different Digits", "Two Digit Number", "Low Total", "Outcome Dice",
  "Sum Two Random", "Even Sum", "Even Heads", "Lower Die", "Mismatched Dice",
  "Knockout Stage", "Opening Round Draw", "Radar Sweep", "Pentagon Ants",
  "All Faces", "Arcade Triple", "Cherry Streak", "Football or Cupcake",
  "Higher Card", "Checkmate", "Four Digit Difference", "Coins in Boxes",
  "Old Phone", "Complementary", "Five Ascending",
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
});

describe("re-homed reasoning flashcard (fair payout)", () => {
  it("reveals $119 and a 'not fair' judgment", () => {
    const fc = combinatorialGeneralFlashcards.find((c) => c.id === "gen-fc-fairpayout")!;
    expect(fc.answer).toContain("119");
    expect(/not fair/i.test(fc.answer)).toBe(true);
    expect(fc.explanation.trim().length).toBeGreaterThan(40);
  });
});
