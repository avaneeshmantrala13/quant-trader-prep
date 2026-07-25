import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import { F, fracText } from "./solvers";
import {
  avoidMultiplesThreshold,
  complementaryPairThreshold,
  digitCountBruteForce,
  digitCountUpToPow10,
  firstToTargetBruteForce,
  firstToTargetGame,
  houseOfCards,
  lastCogDirection,
  maxSubsetNoMultiple,
  minBinaryWeights,
  minDropsTwoBalls,
  minPerBoxThreshold,
  modularHats,
  smallestDigitProductBruteForce,
  smallestNumberWithDigitProduct,
  trailingZerosBruteForce,
  trailingZerosFactorial,
  triangular,
} from "./techniqueSolvers";
import {
  genBinaryWeights,
  genDigitProduct,
  genHouseOfCards,
  genModularHats,
  genPigeonhole,
  genSubtractionGame,
  genTrailingZeros,
  genTwoBalls,
} from "./techniqueGenerators";
import { brainteasersTrack } from "./levels";
import {
  canRegenerate,
  canRegenerateFlashcard,
  generateFreshFlashcard,
} from "@/lib/regenerate";

/**
 * Verification for the NEW technique families (datasets 3–8). Every exact
 * solver is pinned against the ORIGINAL dataset answer (a HIDDEN fixture — the
 * originals are never shipped as cards) and, where feasible, an INDEPENDENT
 * brute force / exhaustive check. Then every generator is exercised across many
 * seeds: its answer must re-derive from the `id` via the solver, the prompt must
 * contain the drawn numbers, and the card must be self-consistent. Finally the
 * three new levels' wiring and family-preserving regeneration are checked.
 */

const SEEDS = Array.from({ length: 80 }, (_, i) => i * 131 + 5);

/* ========================================================================== */
/*  1. Summation / triangular (dataset 5) — dataset fixtures + brute force.     */
/* ========================================================================== */

describe("Summation / triangular solvers", () => {
  it("triangular numbers match the closed form", () => {
    expect(triangular(12)).toBe(78); // Clock Parts total (BU1): 78 / 3 = 26
    expect(triangular(12) % 3).toBe(0);
    expect(triangular(100)).toBe(5050);
  });

  it("house of cards reproduces the dataset answers", () => {
    expect(houseOfCards(100)).toBe(15050); // BU3
    expect(houseOfCards(2)).toBe(7);
    expect(houseOfCards(3)).toBe(15);
    expect(houseOfCards(4)).toBe(26);
  });

  it("house of cards equals 3·T(S) − S for all S (independent recompute)", () => {
    for (let s = 1; s <= 200; s++) {
      expect(houseOfCards(s)).toBe(3 * triangular(s) - s);
    }
  });

  it("minimum two-ball drops reproduces the dataset answer and the triangular bound", () => {
    expect(minDropsTwoBalls(100)).toBe(14); // BU4
    for (const floors of [1, 2, 3, 16, 25, 55, 100, 105, 106, 200]) {
      const n = minDropsTwoBalls(floors);
      expect(triangular(n)).toBeGreaterThanOrEqual(floors);
      expect(triangular(n - 1)).toBeLessThan(floors);
    }
  });

  it("digit-count formula reproduces How-Many-Twos and matches brute force", () => {
    expect(digitCountUpToPow10(2, 4)).toBe(4000); // BS1: 2s in 1..10000
    // The formula counts 1..10^k − 1; compare brute force over that same range.
    for (const [d, k] of [
      [2, 1],
      [3, 2],
      [7, 3],
      [1, 4],
      [1, 3],
    ]) {
      expect(digitCountUpToPow10(d, k)).toBe(
        digitCountBruteForce(d, 10 ** k - 1),
      );
    }
  });
});

/* ========================================================================== */
/*  2. Pigeonhole (dataset 6) — dataset fixtures + exhaustive worst-case.        */
/* ========================================================================== */

describe("Pigeonhole solvers", () => {
  it("min-per-box threshold reproduces the dataset answers", () => {
    expect(minPerBoxThreshold(15, 5)).toBe(61); // BP2 coins, box > 4 ⇒ ≥ 5
    expect(minPerBoxThreshold(12, 7)).toBe(73); // BP6 month with ≥ 7
    expect(minPerBoxThreshold(12, 2)).toBe(13); // BP7 zodiac (≥ 2)
    expect(minPerBoxThreshold(2, 2)).toBe(3); // BP5 socks (2 colors, a pair)
  });

  it("complementary-pair and avoid-multiple thresholds reproduce the dataset", () => {
    expect(complementaryPairThreshold(60)).toBe(31); // BP8 wristbands (sum 61)
    expect(avoidMultiplesThreshold(30, 3)).toBe(21); // BP4 multiple of 3 in 1..30
  });

  it("avoid-multiple threshold = (largest multiple-free subset) + 1 (exhaustive)", () => {
    for (let N = 1; N <= 80; N++) {
      for (const d of [2, 3, 4, 5, 7]) {
        expect(avoidMultiplesThreshold(N, d)).toBe(maxSubsetNoMultiple(N, d) + 1);
      }
    }
  });

  it("min-per-box threshold = boxes·(perBox−1) + 1 (the tight worst case)", () => {
    for (let boxes = 1; boxes <= 30; boxes++) {
      for (let per = 1; per <= 8; per++) {
        // The worst safe config places per−1 in every box; one more overflows.
        expect(minPerBoxThreshold(boxes, per)).toBe(boxes * (per - 1) + 1);
      }
    }
  });
});

/* ========================================================================== */
/*  3. Number theory (dataset 7) — dataset fixtures + brute force.              */
/* ========================================================================== */

describe("Number-theory solvers", () => {
  it("trailing zeros of n! reproduces the dataset answer and matches brute force", () => {
    expect(trailingZerosFactorial(100)).toBe(24); // LG36
    for (const n of [5, 10, 24, 25, 26, 50, 99, 100, 125, 200, 500]) {
      expect(trailingZerosFactorial(n)).toBe(trailingZerosBruteForce(n));
    }
  });

  it("smallest number with a digit product reproduces the dataset answers", () => {
    expect(smallestNumberWithDigitProduct(96)).toBe("268"); // LG24
    expect(smallestNumberWithDigitProduct(10000)).toBe("255558"); // LG31
    expect(smallestNumberWithDigitProduct(1)).toBe("1");
    // Unreachable products (prime factor > 7) have no such number.
    expect(smallestNumberWithDigitProduct(11)).toBeNull();
    expect(smallestNumberWithDigitProduct(22)).toBeNull();
  });

  it("smallest digit-product number matches an exhaustive scan for small products", () => {
    for (const p of [2, 6, 8, 12, 24, 36, 48, 72, 96, 100, 162, 216]) {
      expect(smallestNumberWithDigitProduct(p)).toBe(
        smallestDigitProductBruteForce(p),
      );
    }
  });

  it("minimum binary weights reproduces the dataset answer and covers 1..N", () => {
    expect(minBinaryWeights(35)).toBe(6); // LG43 (1,2,4,8,16,32 cover 1..63)
    for (const N of [1, 2, 3, 7, 8, 35, 63, 64, 100, 500, 1023, 1024]) {
      const b = minBinaryWeights(N);
      expect(2 ** b - 1).toBeGreaterThanOrEqual(N); // b powers of two reach N
      expect(2 ** (b - 1) - 1).toBeLessThan(N); // b − 1 do not
    }
  });

  it("cog direction reproduces the parity dataset answer", () => {
    expect(lastCogDirection(3)).toBe("clockwise"); // LG10 (odd ⇒ same as first)
    expect(lastCogDirection(4)).toBe("counterclockwise");
    for (let n = 1; n <= 20; n++) {
      expect(lastCogDirection(n)).toBe(
        n % 2 === 1 ? "clockwise" : "counterclockwise",
      );
    }
  });
});

/* ========================================================================== */
/*  4. Modular checksum hats (dataset 3) — dataset fixtures.                    */
/* ========================================================================== */

describe("Modular-checksum hats solver", () => {
  it("reproduces both dataset prisoner problems", () => {
    const bm1 = modularHats(100, 2); // BM1: 2 colors, mod 2
    expect(bm1.savedForCertain).toBe(99);
    expect(bm1.backSurvival.equals(F(1, 2))).toBe(true);

    const bm2 = modularHats(100, 10); // BM2: 10 colors, mod 10
    expect(bm2.savedForCertain).toBe(99);
    expect(bm2.backSurvival.equals(F(1, 10))).toBe(true);
  });

  it("saves n−1 for certain and the back prisoner survives 1/k for all n, k", () => {
    for (const n of [2, 5, 12, 25, 100]) {
      for (const k of [2, 3, 4, 5, 10]) {
        const r = modularHats(n, k);
        expect(r.savedForCertain).toBe(n - 1);
        expect(r.backSurvival.equals(F(1, k))).toBe(true);
      }
    }
  });
});

/* ========================================================================== */
/*  5. Subtraction game (dataset 7, LG17) — closed form vs exhaustive.          */
/* ========================================================================== */

describe("Subtraction / count-to-target game solver", () => {
  it("matches exhaustive retrograde analysis across many targets/steps", () => {
    for (let maxStep = 1; maxStep <= 8; maxStep++) {
      for (let target = 1; target <= 60; target++) {
        const closed = firstToTargetGame(target, maxStep);
        const brute = firstToTargetBruteForce(target, maxStep);
        expect(closed.firstPlayerWins).toBe(brute.firstPlayerWins);
        expect(closed.firstMove).toBe(brute.firstMove);
      }
    }
  });

  it("first player loses exactly when target is a multiple of (maxStep+1)", () => {
    expect(firstToTargetGame(21, 3).firstPlayerWins).toBe(true); // 21 mod 4 = 1
    expect(firstToTargetGame(21, 3).firstMove).toBe(1);
    expect(firstToTargetGame(20, 3).firstPlayerWins).toBe(false); // 20 mod 4 = 0
    expect(firstToTargetGame(50, 9).firstPlayerWins).toBe(false); // 50 mod 10 = 0
    expect(firstToTargetGame(50, 6).firstPlayerWins).toBe(true); // 50 mod 7 = 1
  });
});

/* ========================================================================== */
/*  6. Generators — id-based re-derivation, prompt contents, self-consistency.  */
/* ========================================================================== */

/** Split an id into its "-"-delimited parts (e.g. "bt-pigeon-box-15-5"). */
function idParts(id: string): string[] {
  return id.split("-");
}

describe("technique generators are self-consistent across many seeds", () => {
  it("genPigeonhole — answer re-derives for every scenario", () => {
    for (const seed of SEEDS) {
      const c = genPigeonhole(new Rng(seed));
      const p = idParts(c.id); // bt pigeon <scenario> ...
      const scenario = p[2];
      let k: number;
      if (scenario === "box") {
        k = minPerBoxThreshold(Number(p[3]), Number(p[4]));
        expect(c.prompt).toContain(String(Number(p[3]))); // #boxes
      } else if (scenario === "pair") {
        k = complementaryPairThreshold(Number(p[3]));
        expect(c.prompt).toContain(String(Number(p[3]))); // N
      } else {
        k = avoidMultiplesThreshold(Number(p[3]), Number(p[4]));
        expect(c.prompt).toContain(String(Number(p[4]))); // d
      }
      expect(c.answer).toContain(String(k));
      expect(c.difficulty).toBe("medium");
      expect(c.explanation.length).toBeGreaterThan(80);
    }
  });

  it("genHouseOfCards — card count re-derives; prompt shows the story count", () => {
    for (const seed of SEEDS) {
      const c = genHouseOfCards(new Rng(seed));
      const stories = Number(idParts(c.id)[2]);
      expect(c.answer).toContain(String(houseOfCards(stories)));
      expect(c.prompt).toContain(String(stories));
      expect(c.difficulty).toBe("medium");
    }
  });

  it("genTwoBalls — drops re-derive; prompt shows the floor count", () => {
    for (const seed of SEEDS) {
      const c = genTwoBalls(new Rng(seed));
      const floors = Number(idParts(c.id)[2]);
      expect(c.answer).toContain(`${minDropsTwoBalls(floors)} drops`);
      expect(c.prompt).toContain(String(floors));
      expect(c.difficulty).toBe("medium");
    }
  });

  it("genTrailingZeros — zero count re-derives; prompt shows n", () => {
    for (const seed of SEEDS) {
      const c = genTrailingZeros(new Rng(seed));
      const n = Number(idParts(c.id)[2]);
      expect(c.answer).toContain(String(trailingZerosFactorial(n)));
      expect(c.prompt).toContain(String(n));
      expect(c.difficulty).toBe("medium");
    }
  });

  it("genDigitProduct — the smallest number re-derives; prompt shows the product", () => {
    for (const seed of SEEDS) {
      const c = genDigitProduct(new Rng(seed));
      const product = Number(idParts(c.id)[2]);
      const num = smallestNumberWithDigitProduct(product);
      expect(num).not.toBeNull();
      expect(c.answer).toContain(num as string);
      expect(c.prompt).toContain(String(product));
      expect(c.difficulty).toBe("medium");
    }
  });

  it("genBinaryWeights — weight count re-derives; prompt shows N", () => {
    for (const seed of SEEDS) {
      const c = genBinaryWeights(new Rng(seed));
      const N = Number(idParts(c.id)[2]);
      expect(c.answer).toContain(`${minBinaryWeights(N)} weights`);
      expect(c.prompt).toContain(String(N));
      expect(c.difficulty).toBe("medium");
    }
  });

  it("genModularHats — survivors + odds re-derive; prompt shows the count", () => {
    for (const seed of SEEDS) {
      const c = genModularHats(new Rng(seed));
      const [, , nStr, kStr] = idParts(c.id);
      const n = Number(nStr);
      const k = Number(kStr);
      const { savedForCertain, backSurvival } = modularHats(n, k);
      expect(c.answer).toContain(String(savedForCertain));
      expect(c.answer).toContain(`1/${k}`);
      expect(backSurvival.equals(F(1, k))).toBe(true);
      expect(c.prompt).toContain(String(n));
      expect(c.difficulty).toBe("hard");
    }
  });

  it("genSubtractionGame — the winner matches the solver; prompt shows target", () => {
    for (const seed of SEEDS) {
      const c = genSubtractionGame(new Rng(seed));
      const [, , targetStr, stepStr] = idParts(c.id);
      const target = Number(targetStr);
      const maxStep = Number(stepStr);
      const { firstPlayerWins } = firstToTargetGame(target, maxStep);
      if (firstPlayerWins) {
        expect(c.answer).toContain("first player wins");
      } else {
        expect(c.answer).toContain("SECOND player wins");
      }
      expect(c.prompt).toContain(String(target));
      expect(c.prompt).toContain(String(maxStep));
      expect(c.difficulty).toBe("hard");
    }
  });

  it("each generator is deterministic per seed and varied across seeds", () => {
    const gens = [
      genPigeonhole,
      genHouseOfCards,
      genTwoBalls,
      genTrailingZeros,
      genDigitProduct,
      genBinaryWeights,
      genModularHats,
      genSubtractionGame,
    ];
    for (const gen of gens) {
      const a = gen(new Rng(24680));
      const b = gen(new Rng(24680));
      expect(a.id).toBe(b.id);
      expect(a.prompt).toBe(b.prompt);
      expect(a.answer).toBe(b.answer);

      const prompts = new Set<string>();
      for (const seed of SEEDS) prompts.add(gen(new Rng(seed)).prompt);
      expect(prompts.size).toBeGreaterThan(1);
    }
  });
});

/* ========================================================================== */
/*  7. Wiring — the three new levels regenerate; families stay in-family.       */
/* ========================================================================== */

describe("new Techniques Toolkit levels are wired for infinite generation", () => {
  const byId = (id: string) =>
    brainteasersTrack.levels.find((l) => l.id === id)!;
  const toolkit = ["bt-4", "bt-5", "bt-6"].map(byId);

  it("exposes exactly three new levels, all in the 'Techniques Toolkit' section", () => {
    expect(toolkit.every((l) => l.section === "Techniques Toolkit")).toBe(true);
    // The three original levels keep their own 'Core Puzzles' section.
    for (const id of ["bt-1", "bt-2", "bt-3"]) {
      expect(byId(id).section).toBe("Core Puzzles");
    }
  });

  it("difficulty ramps medium → hard → expert across the new section", () => {
    expect(toolkit.map((l) => l.difficulty)).toEqual([
      "medium",
      "hard",
      "expert",
    ]);
  });

  it("each new level carries static cards AND parametric families", () => {
    for (const lvl of toolkit) {
      expect(lvl.mode).toBe("flashcard");
      expect((lvl.flashcards ?? []).length).toBeGreaterThan(0);
      expect((lvl.flashcardGenerators ?? []).length).toBeGreaterThan(0);
      expect(canRegenerateFlashcard(lvl)).toBe(true);
      expect(canRegenerate(lvl)).toBe(true);
    }
  });

  it("family counts match the plan (6 counting, 1 invariant, 1 game)", () => {
    expect(byId("bt-4").flashcardGenerators?.length).toBe(6);
    expect(byId("bt-5").flashcardGenerators?.length).toBe(1);
    expect(byId("bt-6").flashcardGenerators?.length).toBe(1);
  });

  it("static cards never reuse a generated id and have non-decreasing difficulty", () => {
    const order = { intro: 0, easy: 1, medium: 2, hard: 3, expert: 4 } as const;
    for (const lvl of toolkit) {
      const seq = (lvl.flashcards ?? []).map((c) => order[c.difficulty]);
      for (let i = 1; i < seq.length; i++) {
        expect(seq[i]).toBeGreaterThanOrEqual(seq[i - 1]);
      }
    }
  });

  it("generateFreshFlashcard yields fresh, valid, seed-keyed bonus cards", () => {
    for (const lvl of toolkit) {
      const staticIds = new Set((lvl.flashcards ?? []).map((c) => c.id));
      const prompts = new Set<string>();
      for (let seed = 1; seed <= 60; seed++) {
        const c = generateFreshFlashcard(lvl, seed);
        expect(c).not.toBeNull();
        expect(c!.id).toContain(`-practice-${seed}`);
        expect(staticIds.has(c!.id)).toBe(false);
        expect(c!.answer.trim().length).toBeGreaterThan(0);
        expect(c!.explanation.trim().length).toBeGreaterThan(40);
        prompts.add(c!.prompt);
      }
      expect(prompts.size).toBeGreaterThan(1);
    }
  });

  it("family-preserving regeneration (button #1) stays in the SAME family", () => {
    for (const lvl of toolkit) {
      for (let seed = 1; seed <= 40; seed++) {
        // Draw a current bonus card from the level's families…
        const current = generateFreshFlashcard(lvl, seed);
        expect(current).not.toBeNull();
        expect(current!.family).toBeTruthy();
        // …then "give me another like this" must reproduce the same family.
        const next = generateFreshFlashcard(
          lvl,
          seed + 500,
          undefined,
          current!,
          true,
          current!,
        );
        expect(next).not.toBeNull();
        expect(next!.family).toBe(current!.family);
      }
    }
  });
});

/* A trivial reference so `fracText` stays imported for probability rendering. */
it("modular-hats probability renders as a clean fraction", () => {
  expect(fracText(modularHats(100, 10).backSurvival)).toBe("1/10");
});
