import { describe, expect, it } from "vitest";
import {
  F,
  allOnGivenAtLeastOne,
  atLeastOneBoyBothBoys,
  bayesInversion,
  bayesPosterior,
  bayesUnionCause,
  bertrandGreenProb,
  bothGivenAtLeastOne,
  chipChainProb,
  decText,
  diceSumFaceProb,
  exactDecimals,
  exactlyKGivenAtLeastOne,
  fracText,
  htTailWinnerFirstPlayer,
  lawTotalProb,
  montyHallSwitchProb,
  orderingConditionalProb,
  posteriorWeightedNextSuccess,
  raceProb,
  reducedProb,
  rrFixedFirstSurvives,
  rrRespunSecondSurvives,
  rrTwoConsecutiveDecision,
  rrTwoRandomDecision,
  secondMoverFirstTossGivenWin,
  specificChildBothProb,
  tableAboveThresholdProb,
  tieBreakerProb,
  uniformConditional,
  absorbingFirstStep,
  vacantRoomProb,
} from "./cp";
import { Rng } from "@/lib/rng";
import { gradeNumeric } from "@/lib/numeric";
import type { NumericQuestion, Question } from "@/types/content";
import * as G from "./generators";
import { RR_KEEP, RR_SPIN } from "./generators";

const r = (x: number, dp: number) => Math.round(x * 10 ** dp) / 10 ** dp;
/** Decimals a quiz choice is formatted at (mirrors generators' `gradeDp`). */
const qdp = (f: ReturnType<typeof F>) => Math.max(2, exactDecimals(f, 4));

/* ========================================================================== */
/*  1. Seed-dataset fixtures — the 45 ORIGINAL Conditional Probability items.  */
/*     TEST-ONLY ground truth. No generated / user-facing content reuses these */
/*     verbatim; users only ever see freshly generated instances (see          */
/*     generators.ts / levels.ts). Answers exactly as delivered, including the  */
/*     three NON-SCALAR specials: RR#3/#4 decisions, Child's Gender's two parts */
/*     (stored as a tuple), and Monty Hall's decision + probability.            */
/* ========================================================================== */

const SEED_ANSWERS: Record<string, number | string | number[]> = {
  CP1_AirportCafe: 0.25,
  CP2_PineProperty: 0.4,
  CP3_WestRegion: 0.375,
  CP4_GamesStore: 0.33,
  CP5_FavoriteSports: 0.19,
  CP6_ExactlyOneTail: 0.267,
  CP7_GivenASeven: 0.333,
  CP8_RollingSix: 0.09,
  CP9_AllBulbsLit: 0.067,
  CP10_PaintedDiscs: 0.667,
  CP11_ChipEleven: 0.167,
  CP12_DartGame: 0.67,
  CP13_Algorithms: 0.5,
  CP13b_AthleticCats: 0.125,
  CP14_CalfKicks: 0.04,
  CP15_EngineOrWheels: 0.43,
  CP16_FairOrUnfairCoin: 0.3636,
  CP17_FakeNews: 0.8,
  CP18_LiverDisease: 0.07,
  CP19_RacingCars: 0.45,
  CP20_SurpriseHeadliner: 0.45,
  CP21_TheInternDidIt: 0.6,
  CP22_TwiceAsLikely: 0.333,
  CP23_TwoBlueGumballs: 0.2,
  CP24_WhichDieWasIt: 0.6,
  CP25_WhichPouch: 0.824,
  CP26_PaintedCube: 0.5,
  CP27_SecondHeads: 0.44,
  CP28_UnfairHeads1: 0.571,
  CP29_UnfairHeads2: 0.444,
  CP30_ChocolateTransfer: 0.64,
  CP31_OneFairDie: 0.5,
  CP32_CarWash: 0.25,
  CP33_SixBeforeEleven: 0.714,
  CP34_TieToWin: 0.2222,
  CP35_FirstToHeads: 0.75,
  CP36_CoinToss1: 0.444,
  CP37_ParityRace: 0.667,
  CP38_RussianRoulette1: 0.5,
  CP39_RussianRoulette2: 0.55,
  CP40_RussianRoulette3: "should spin", // non-scalar decision
  CP41_RussianRoulette4: "should not spin", // non-scalar decision
  CP42_ChildsGender: [1 / 3, 1 / 2], // two-part answer
  CP43_VacantRoom: 0.8,
  CP44_MontyHall: "2/3 (switch)", // decision + probability
};

describe("seed dataset: all 45 answers captured as test-only ground truth", () => {
  it("has exactly 45 documented answers", () => {
    expect(Object.keys(SEED_ANSWERS).length).toBe(45);
  });
  it("the three NON-SCALAR specials are represented as decision / tuple, never a bare graded scalar", () => {
    expect(SEED_ANSWERS.CP40_RussianRoulette3).toBe("should spin");
    expect(SEED_ANSWERS.CP41_RussianRoulette4).toBe("should not spin");
    expect(SEED_ANSWERS.CP42_ChildsGender).toEqual([1 / 3, 1 / 2]);
    expect(SEED_ANSWERS.CP44_MontyHall).toBe("2/3 (switch)");
  });
});

/* ========================================================================== */
/*  2. Exact solver REPRODUCES the documented answers (family by family).      */
/* ========================================================================== */

// The two flagged tables (Airport, Pine) transcribed exactly from the dataset.
const AIRPORT = [
  [38200, 41500, 36900, 44300],
  [45100, 39800, 42600, 37400],
  [36500, 43900, 38100, 41200],
  [42800, 35600, 44700, 39300],
];
const PINE = [
  [82300, 78500, 85100, 79200],
  [77800, 83600, 81400, 84900],
  [86200, 79100, 88700, 76300],
  [75400, 81900, 83500, 87600],
];

describe("solver reproduces documented answers — reduced sample space", () => {
  it("Airport Cafe (CP1) = 2/8 = 0.25", () => {
    expect(tableAboveThresholdProb(AIRPORT, 40000, 2).equals(F(1, 4))).toBe(true);
    expect(tableAboveThresholdProb(AIRPORT, 40000, 2).valueOf()).toBe(
      SEED_ANSWERS.CP1_AirportCafe,
    );
  });
  it("Pine Property (CP2) = 4/10 = 0.40, and the reversed-conditional TRAP is 4/4 = 1", () => {
    expect(tableAboveThresholdProb(PINE, 80000, 2).equals(F(2, 5))).toBe(true);
    expect(tableAboveThresholdProb(PINE, 80000, 2).valueOf()).toBe(SEED_ANSWERS.CP2_PineProperty);
    // The flagged hard-negative: P(above|Pine) = 4/4 = 1 ≠ the asked P(Pine|above).
    expect(F(4, 4).valueOf()).toBe(1);
  });
  it("West (CP3)=3/8, Games (CP4)=1/3, Favorite Sports (CP5)=46/240, Exactly One Tail (CP6)=4/15", () => {
    expect(reducedProb(3, 8).valueOf()).toBe(SEED_ANSWERS.CP3_WestRegion);
    expect(r(reducedProb(3, 9).valueOf(), 2)).toBe(SEED_ANSWERS.CP4_GamesStore);
    expect(r(reducedProb(46, 240).valueOf(), 2)).toBe(SEED_ANSWERS.CP5_FavoriteSports);
    expect(r(exactlyKGivenAtLeastOne(4, 1).valueOf(), 3)).toBe(SEED_ANSWERS.CP6_ExactlyOneTail);
  });
  it("Given a Seven (CP7)=1/3, Rolling Six (CP8)=1/11, All Bulbs Lit (CP9)=1/15", () => {
    expect(r(diceSumFaceProb(6, 7, 2).valueOf(), 3)).toBe(SEED_ANSWERS.CP7_GivenASeven);
    expect(bothGivenAtLeastOne(6).equals(F(1, 11))).toBe(true);
    expect(r(bothGivenAtLeastOne(6).valueOf(), 2)).toBe(SEED_ANSWERS.CP8_RollingSix);
    expect(allOnGivenAtLeastOne(4).equals(F(1, 15))).toBe(true);
    expect(r(allOnGivenAtLeastOne(4).valueOf(), 3)).toBe(SEED_ANSWERS.CP9_AllBulbsLit);
  });
  it("Painted Discs (CP10)=2/3, Chip Eleven (CP11)=1/6, Dart Game (CP12)=2/3", () => {
    expect(bertrandGreenProb(1, 1).equals(F(2, 3))).toBe(true);
    expect(r(bertrandGreenProb(1, 1).valueOf(), 3)).toBe(SEED_ANSWERS.CP10_PaintedDiscs);
    expect(chipChainProb(18, 9, 6).equals(F(1, 6))).toBe(true);
    expect(r(chipChainProb(18, 9, 6).valueOf(), 3)).toBe(SEED_ANSWERS.CP11_ChipEleven);
    expect(r(orderingConditionalProb().valueOf(), 2)).toBe(SEED_ANSWERS.CP12_DartGame);
  });
});

describe("solver reproduces documented answers — Bayes' theorem", () => {
  it("Algorithms (CP13)=1/2, Athletic Cats (CP13b)=1/8", () => {
    expect(bayesPosterior([F(1, 3), F(1, 3), F(1, 3)], [F(4, 6), F(4, 6), F(0)], 1).valueOf()).toBe(
      SEED_ANSWERS.CP13_Algorithms,
    );
    // Cheer-for-a-loser: weight by LOSS likelihoods 1/4, 13/16, 15/16.
    expect(
      bayesPosterior([F(1, 3), F(1, 3), F(1, 3)], [F(1, 4), F(13, 16), F(15, 16)], 0).valueOf(),
    ).toBe(SEED_ANSWERS.CP13b_AthleticCats);
  });
  it("Calf Kicks (CP14)=0.04, Liver Disease (CP18)=0.07 (inversion)", () => {
    expect(r(bayesInversion(F(2, 10), F(3, 10), F(6, 100)).valueOf(), 2)).toBe(
      SEED_ANSWERS.CP14_CalfKicks,
    );
    expect(r(bayesInversion(F(11, 100), F(23, 100), F(15, 100)).valueOf(), 2)).toBe(
      SEED_ANSWERS.CP18_LiverDisease,
    );
  });
  it("Engine or Wheels (CP15)=20/47≈0.43 (union of independent causes)", () => {
    expect(bayesUnionCause(F(15, 100), F(10, 100)).equals(F(20, 47))).toBe(true);
    expect(r(bayesUnionCause(F(15, 100), F(10, 100)).valueOf(), 2)).toBe(
      SEED_ANSWERS.CP15_EngineOrWheels,
    );
  });
  it("Fair/Unfair Coin (CP16)=4/11, Fake News (CP17)=0.8, Surprise Headliner (CP20)=0.45", () => {
    expect(
      r(bayesPosterior([F(1, 3), F(1, 3), F(1, 3)], [F(1, 2), F(1, 2), F(4, 7)], 2).valueOf(), 4),
    ).toBe(SEED_ANSWERS.CP16_FairOrUnfairCoin);
    expect(bayesPosterior([F(6, 10), F(4, 10)], [F(8, 10), F(3, 10)], 0).valueOf()).toBe(
      SEED_ANSWERS.CP17_FakeNews,
    );
    expect(
      r(bayesPosterior([F(9, 10), F(1, 10)], [F(5, 100), F(55, 100)], 0).valueOf(), 2),
    ).toBe(SEED_ANSWERS.CP20_SurpriseHeadliner);
  });
  it("Racing Cars (CP19)=9/20, The Intern (CP21)=3/5, Twice as Likely (CP22)=1/3", () => {
    expect(
      bayesPosterior([F(1, 3), F(1, 3), F(1, 3)], [F(3, 10), F(4, 5), F(9, 10)], 2).valueOf(),
    ).toBe(SEED_ANSWERS.CP19_RacingCars);
    expect(bayesPosterior([F(1, 3), F(2, 3)], [F(3, 4), F(1, 4)], 0).valueOf()).toBe(
      SEED_ANSWERS.CP21_TheInternDidIt,
    );
    expect(
      r(bayesPosterior([F(50, 100), F(35, 100), F(15, 100)], [F(1), F(2), F(4)], 2).valueOf(), 3),
    ).toBe(SEED_ANSWERS.CP22_TwiceAsLikely);
  });
  it("Two Blue Gumballs (CP23)=0.2, Which Die (CP24)=3/5, Which Pouch (CP25)=14/17", () => {
    expect(bayesPosterior([F(1, 2), F(1, 2)], [F(9, 100), F(36, 100)], 0).valueOf()).toBe(
      SEED_ANSWERS.CP23_TwoBlueGumballs,
    );
    expect(bayesPosterior([F(1, 2), F(1, 2)], [F(1, 4), F(1, 6)], 0).valueOf()).toBe(
      SEED_ANSWERS.CP24_WhichDieWasIt,
    );
    expect(bayesPosterior([F(1, 3), F(1, 3), F(1, 3)], [F(1), F(0), F(3, 14)], 0).equals(F(14, 17))).toBe(
      true,
    );
    expect(
      r(bayesPosterior([F(1, 3), F(1, 3), F(1, 3)], [F(1), F(0), F(3, 14)], 0).valueOf(), 3),
    ).toBe(SEED_ANSWERS.CP25_WhichPouch);
  });
  it("Painted Cube (CP26)=1/2, Second Heads (CP27)=11/25, Unfair Heads #1 (CP28)=4/7, #2 (CP29)=4/9", () => {
    expect(bayesPosterior([F(1, 27), F(6, 27)], [F(1), F(1, 6)], 0).valueOf()).toBe(
      SEED_ANSWERS.CP26_PaintedCube,
    );
    expect(posteriorWeightedNextSuccess([F(2, 10), F(2, 10), F(6, 10)]).valueOf()).toBe(
      SEED_ANSWERS.CP27_SecondHeads,
    );
    expect(r(bayesPosterior([F(2, 5), F(3, 5)], [F(1, 2), F(1, 4)], 0).valueOf(), 3)).toBe(
      SEED_ANSWERS.CP28_UnfairHeads1,
    );
    expect(bayesPosterior([F(1, 11), F(10, 11)], [F(1), F(1, 8)], 0).equals(F(4, 9))).toBe(true);
    expect(r(bayesPosterior([F(1, 11), F(10, 11)], [F(1), F(1, 8)], 0).valueOf(), 3)).toBe(
      SEED_ANSWERS.CP29_UnfairHeads2,
    );
  });
});

describe("solver reproduces documented answers — total probability & continuous", () => {
  it("Chocolate Transfer (CP30)=32/50=0.64", () => {
    expect(lawTotalProb([F(2, 5), F(3, 5)], [F(7, 10), F(6, 10)]).valueOf()).toBe(
      SEED_ANSWERS.CP30_ChocolateTransfer,
    );
  });
  it("One Fair Die (CP31)=1/2 (fair die balances parity regardless of the rig)", () => {
    expect(lawTotalProb([F(4, 9), F(5, 9)], [F(1, 2), F(1, 2)]).valueOf()).toBe(
      SEED_ANSWERS.CP31_OneFairDie,
    );
  });
  it("Car Wash Countdown (CP32)=1/4 (uniform is NOT memoryless)", () => {
    expect(uniformConditional(2, 10, 6, 7).equals(F(1, 4))).toBe(true);
    expect(uniformConditional(2, 10, 6, 7).valueOf()).toBe(SEED_ANSWERS.CP32_CarWash);
  });
});

describe("solver reproduces documented answers — races & recursion", () => {
  it("Six Before Eleven (CP33)=5/7 (ORDERED counts; unordered gives the wrong 3/4)", () => {
    expect(raceProb(5, 2).equals(F(5, 7))).toBe(true);
    expect(r(raceProb(5, 2).valueOf(), 3)).toBe(SEED_ANSWERS.CP33_SixBeforeEleven);
    // The flagged trap: unordered pairs (sum-6 → {1,5},{2,4},{3,3}=3; sum-11 → {5,6}=1) give 3/4.
    expect(raceProb(3, 1).equals(F(3, 4))).toBe(true);
  });
  it("Tie to Win (CP34)=2/9, First to Heads (CP35)=3/4", () => {
    expect(tieBreakerProb(8).equals(F(2, 9))).toBe(true);
    expect(r(tieBreakerProb(8).valueOf(), 4)).toBe(SEED_ANSWERS.CP34_TieToWin);
    expect(secondMoverFirstTossGivenWin(F(1, 2)).equals(F(3, 4))).toBe(true);
    expect(secondMoverFirstTossGivenWin(F(1, 2)).valueOf()).toBe(SEED_ANSWERS.CP35_FirstToHeads);
  });
  it("Coin Toss #1 (CP36)=4/9, Parity Race (CP37)=2/3", () => {
    expect(htTailWinnerFirstPlayer().equals(F(4, 9))).toBe(true);
    expect(r(htTailWinnerFirstPlayer().valueOf(), 3)).toBe(SEED_ANSWERS.CP36_CoinToss1);
    expect(absorbingFirstStep(F(1, 2), F(1, 4)).equals(F(2, 3))).toBe(true);
    expect(r(absorbingFirstStep(F(1, 2), F(1, 4)).valueOf(), 3)).toBe(SEED_ANSWERS.CP37_ParityRace);
  });
});

describe("solver reproduces documented answers — Russian Roulette (incl. the two decision specials)", () => {
  it("RR#1 fixed (CP38)=1/2; RR#2 re-spun (CP39)=6/11", () => {
    expect(rrFixedFirstSurvives(6).equals(F(1, 2))).toBe(true);
    expect(rrFixedFirstSurvives(6).valueOf()).toBe(SEED_ANSWERS.CP38_RussianRoulette1);
    expect(rrRespunSecondSurvives(F(1, 6)).equals(F(6, 11))).toBe(true);
    expect(r(rrRespunSecondSurvives(F(1, 6)).valueOf(), 2)).toBe(SEED_ANSWERS.CP39_RussianRoulette2);
  });
  it("RR#3 (CP40) DECISION = should spin (1/3 < 2/5), never scalar-graded", () => {
    const d = rrTwoRandomDecision(6, 2);
    expect(d.spinLose.equals(F(1, 3))).toBe(true);
    expect(d.noSpinLose.equals(F(2, 5))).toBe(true);
    expect(d.shouldSpin).toBe(true);
    expect(d.shouldSpin ? "should spin" : "should not spin").toBe(SEED_ANSWERS.CP40_RussianRoulette3);
  });
  it("RR#4 (CP41) DECISION = should not spin (3/4 > 2/3), never scalar-graded", () => {
    const d = rrTwoConsecutiveDecision(6);
    expect(d.noSpinSurvive.equals(F(3, 4))).toBe(true);
    expect(d.spinSurvive.equals(F(2, 3))).toBe(true);
    expect(d.shouldSpin).toBe(false);
    expect(d.shouldSpin ? "should spin" : "should not spin").toBe(
      SEED_ANSWERS.CP41_RussianRoulette4,
    );
  });
});

describe("solver reproduces documented answers — paradoxes & classics (incl. two-part & decision)", () => {
  it("Child's Gender (CP42) is TWO parts: 1/3 (at least one) vs 1/2 (specific child)", () => {
    expect(atLeastOneBoyBothBoys().equals(F(1, 3))).toBe(true);
    expect(specificChildBothProb().equals(F(1, 2))).toBe(true);
    const tuple = SEED_ANSWERS.CP42_ChildsGender as number[];
    expect(r(atLeastOneBoyBothBoys().valueOf(), 6)).toBe(r(tuple[0], 6));
    expect(specificChildBothProb().valueOf()).toBe(tuple[1]);
  });
  it("Vacant Room (CP43)=4/5, Monty Hall (CP44)=2/3 with the decision 'switch'", () => {
    expect(vacantRoomProb(F(1, 2), F(1, 4)).equals(F(4, 5))).toBe(true);
    expect(vacantRoomProb(F(1, 2), F(1, 4)).valueOf()).toBe(SEED_ANSWERS.CP43_VacantRoom);
    expect(montyHallSwitchProb(3).equals(F(2, 3))).toBe(true);
    // The decision + probability: "2/3 (switch)"; the trap answer is 1/2.
    expect(`${fracText(montyHallSwitchProb(3))} (switch)`).toBe(SEED_ANSWERS.CP44_MontyHall);
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

/** Parse the integer params trailing a generator id ("cp-fam-1-2" → [1,2]). */
function idNums(id: string): number[] {
  return id.split("-").slice(2).map((s) => Number(s));
}

/** d6 ordered / unordered ways to make a sum (for the race re-derivation). */
function orderedWays(N: number, s: number): number {
  let c = 0;
  for (let a = 1; a <= N; a++) for (let b = 1; b <= N; b++) if (a + b === s) c++;
  return c;
}

/** Independent re-derivation of a numeric generator's answer from its id. */
function reDeriveNumeric(q: NumericQuestion): ReturnType<typeof F> {
  const key = q.id.split("-")[1];
  const n = idNums(q.id);
  switch (key) {
    case "transfer": {
      const [d1, m1, d2, m2] = n;
      const size2 = d2 + m2 + 1;
      return F(d1, d1 + m1)
        .mul(F(d2 + 1, size2))
        .add(F(m1, d1 + m1).mul(F(d2, size2)));
    }
    case "lotp": {
      const [w1, r1, r2] = n;
      return F(w1, 100).mul(F(r1, 100)).add(F(100 - w1, 100).mul(F(r2, 100)));
    }
    case "unif": {
      const [, b, g, w] = n;
      return F(w, b - g);
    }
    case "race": {
      const [s1, s2] = n;
      return F(orderedWays(6, s1), orderedWays(6, s1) + orderedWays(6, s2));
    }
    case "firsttoss": {
      const [M] = n;
      const q2 = F(1).sub(F(1, M));
      return F(1).sub(q2.pow(2));
    }
    case "tie": {
      const [N] = n;
      return F(N, N + (N * N - N) / 2);
    }
    case "firststep": {
      const [wn, wd] = n;
      return F(1).div(F(2).sub(F(wn, wd)));
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
    case "table":
      return fracText(F(n[0], n[1]));
    case "both":
      return fracText(F(1, 2 * n[0] - 1));
    case "givensum": {
      const [N, s, face] = n;
      let surv = 0;
      let fav = 0;
      for (let a = 1; a <= N; a++)
        for (let b = 1; b <= N; b++)
          if (a + b === s) {
            surv++;
            if (a === face || b === face) fav++;
          }
      return fracText(F(fav, surv));
    }
    case "bertrand": {
      const [g, m] = n;
      return fracText(F(2 * g, 2 * g + m));
    }
    case "allon": {
      const [nn] = n;
      return fracText(F(1, 2 ** nn - 1));
    }
    case "bayestest": {
      const [prev, sens, fpr] = n;
      const f = F(prev * sens, prev * sens + (100 - prev) * fpr);
      return decText(f, qdp(f));
    }
    case "die": {
      const [N1, N2] = n;
      return fracText(F(N2, N1 + N2));
    }
    case "loser": {
      const [d, a, b, c, target] = n;
      const losses = [F(d - a, d), F(d - b, d), F(d - c, d)];
      const norm = losses.reduce((x, y) => x.add(y), F(0));
      return fracText(losses[target].div(norm));
    }
    case "inv": {
      const [pA, pB, pBA] = n;
      const f = F(pBA * pA, pB * 100);
      return decText(f, qdp(f));
    }
    case "rrfixed": {
      const [c] = n;
      return fracText(F(Math.floor(c / 2), c));
    }
    case "rrrespun": {
      const [c] = n;
      return fracText(F(c, 2 * c - 1));
    }
    case "rrrandom":
      return RR_SPIN; // 2 random bullets ⇒ spinning always lowers the risk
    case "rrconsec":
      return RR_KEEP; // 2 adjacent bullets ⇒ surviving favours NOT spinning
    default:
      throw new Error(`no re-derivation for quiz family ${key}`);
  }
}

const NUMERIC_GENS: [string, (rng: Rng) => NumericQuestion][] = [
  ["genTransfer", G.genTransfer],
  ["genLotpLine", G.genLotpLine],
  ["genUniform", G.genUniform],
  ["genSumRace", G.genSumRace],
  ["genFirstToss", G.genFirstToss],
  ["genTie", G.genTie],
  ["genFirstStep", G.genFirstStep],
];

const QUIZ_GENS: [string, (rng: Rng) => Question][] = [
  ["genTable", G.genTable],
  ["genBoth", G.genBoth],
  ["genGivenSum", G.genGivenSum],
  ["genBertrand", G.genBertrand],
  ["genAllOn", G.genAllOn],
  ["genBayesTest", G.genBayesTest],
  ["genWhichDie", G.genWhichDie],
  ["genCheerLoser", G.genCheerLoser],
  ["genInversion", G.genInversion],
  ["genRRFixed", G.genRRFixed],
  ["genRRRespun", G.genRRRespun],
  ["genRRTwoRandom", G.genRRTwoRandom],
  ["genRRTwoConsecutive", G.genRRTwoConsecutive],
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
        expect(Math.round(expected.valueOf() * f)).toBe(Math.round(q.answer * f));
        // (b) Grading round-trips: typing the exact answer is graded correct.
        const typed = dp === 0 ? String(q.answer) : q.answer.toFixed(dp);
        expect(gradeNumeric(q, typed).correct).toBe(true);
        // (c) Every commonError is finite, ≠ the answer, and its feedback fires.
        for (const ce of q.commonErrors ?? []) {
          expect(Number.isFinite(ce.value)).toBe(true);
          expect(Math.round(ce.value * f)).not.toBe(Math.round(q.answer * f));
          const g = gradeNumeric(q, dp === 0 ? String(ce.value) : ce.value.toFixed(dp));
          expect(g.correct).toBe(false);
          expect(g.matchedError?.feedback).toBeTruthy();
        }
        // commonErrors are mutually distinct at the grading precision.
        const keys = (q.commonErrors ?? []).map((e) => Math.round(e.value * f));
        expect(new Set(keys).size).toBe(keys.length);
        // Every emitted probability is a valid probability in [0, 1].
        expect(q.answer).toBeGreaterThanOrEqual(0);
        expect(q.answer).toBeLessThanOrEqual(1);
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

/* ========================================================================== */
/*  4. No original dataset question is user-facing (source-text guard).        */
/* ========================================================================== */

describe("no source-dataset prompt wording leaks into generated content", () => {
  // Verbatim dataset phrases that must NEVER appear in generated prompts.
  const FINGERPRINTS = [
    "across the four quarters of 2024",
    "Annual rental income over four years",
    "Bob rolls two fair dice",
    "Whiskers",
    "Nova is in Lisbon",
    "Mia rolls two dice",
  ];
  it("generated prompts never contain a verbatim dataset fingerprint", () => {
    const gens = [...QUIZ_GENS.map(([, g]) => g), ...NUMERIC_GENS.map(([, g]) => g)];
    for (const seed of SEEDS.slice(0, 20)) {
      for (const gen of gens) {
        const q = gen(new Rng(seed)) as Question | NumericQuestion;
        for (const fp of FINGERPRINTS) expect(q.prompt).not.toContain(fp);
      }
    }
  });
});
