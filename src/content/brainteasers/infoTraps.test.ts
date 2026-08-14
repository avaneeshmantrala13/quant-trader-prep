import { describe, expect, it } from "vitest";
import type { Flashcard } from "@/types/content";
import { Rng } from "@/lib/rng";
import { parseFreeResponse } from "@/lib/numeric";
import { F } from "./solvers";
import {
  lastAmongKBruteForce,
  lastAmongKProb,
  lastAmongKTraps,
  minWeighingsBinaryTrap,
  minWeighingsFakeUnknown,
  minWeighingsKnownHeavier,
  queryTheMaxMinQueries,
  queryTheMaxTraps,
  secretaryHalfTrap,
  secretaryOptimalReject,
  secretaryRejectApprox,
  secretaryWinProb,
  secretaryWinProbExact,
  skipOneStrategyErrorBruteForce,
  skipOneStrategyErrorRate,
  symmetryPayoutEV,
} from "./infoTrapSolvers";
import {
  ALL_INFOTRAP_FAMILIES,
  genLastAmongK,
  genQueryTheMax,
  genSecretaryStop,
  genWeighFakeUnknown,
  genWeighKnownHeavier,
} from "./infoTrapGenerators";
import { brainteasersTrack } from "./levels";
import { untimedBrainteaserItems } from "@/content/diagnostic/untimedBlueprint";

/**
 * VERIFICATION for the NEW "Information-theoretic & adversarial-trap" family.
 * Each exact solver is (a) pinned to its closed-form / famous instance and (b)
 * independently cross-checked by an exhaustive BRUTE FORCE where feasible. The
 * three HARD invariants of these trap puzzles are asserted explicitly:
 *   • query-the-max MUST equal n,
 *   • the known-heavier weighing MUST use log base 3,
 *   • the last-among-k symmetry probability MUST be 1/k.
 * Every generator is exercised across many seeds (answer re-derives from the id;
 * prompt shows the drawn numbers; the gradable contract holds), and the family's
 * presence in the untimed diagnostic + the bt-7 level wiring are checked.
 */

const SEEDS = Array.from({ length: 80 }, (_, i) => i * 131 + 5);

/** Mirror the player's tolerant compare (`@/lib/numeric` parser + tolerance). */
function gradesCorrect(card: Flashcard, raw: string): boolean {
  const value = parseFreeResponse(raw);
  if (value === null || typeof card.numericAnswer !== "number") return false;
  const tol = Math.abs(card.tolerance ?? 0);
  return Math.abs(value - card.numericAnswer) <= tol + 1e-9;
}

const idParts = (id: string) => id.split("-");

/* ========================================================================== */
/*  1. Query-the-max — MUST be n; traps under-count; 1/n miss rate            */
/* ========================================================================== */

describe("query-the-max solver (information lower bound = n)", () => {
  it("the minimum number of queries is EXACTLY n (the hard invariant)", () => {
    for (const n of [1, 2, 3, 5, 8, 13, 21, 100]) {
      expect(queryTheMaxMinQueries(n)).toBe(n);
    }
  });

  it("every enumerated trap is a STRICT under-count for n ≥ 2", () => {
    for (let n = 2; n <= 64; n++) {
      const { skipLast, binarySearch, ternarySearch } = queryTheMaxTraps(n);
      expect(skipLast).toBe(n - 1);
      expect(skipLast).toBeLessThan(n);
      expect(binarySearch).toBeLessThan(n);
      expect(ternarySearch).toBeLessThan(n);
      // ⌈log₂ n⌉ ≥ ⌈log₃ n⌉ always (base-2 needs at least as many steps).
      expect(binarySearch).toBeGreaterThanOrEqual(ternarySearch);
    }
  });

  it("the skip-one strategy misses the max exactly 1/n of the time (brute-forced)", () => {
    for (let n = 1; n <= 8; n++) {
      const exact = skipOneStrategyErrorRate(n);
      expect(exact.equals(F(1, n))).toBe(true);
      expect(skipOneStrategyErrorBruteForce(n).equals(exact)).toBe(true);
    }
  });
});

/* ========================================================================== */
/*  2. Secretary / optimal stopping — argmax ≈ n/e, success ≈ 1/e            */
/* ========================================================================== */

describe("secretary / optimal-stopping solver", () => {
  it("the r=0 rule wins 1/n and the double win-prob equals the EXACT rational (small n)", () => {
    for (const n of [3, 5, 10, 20]) {
      expect(secretaryWinProb(n, 0)).toBeCloseTo(1 / n, 12);
      expect(secretaryWinProbExact(n, 0).equals(F(1, n))).toBe(true);
      for (let r = 1; r < n; r++) {
        // Exact rational ground truth for the closed form …
        let sum = F(0);
        for (let i = r + 1; i <= n; i++) sum = sum.add(F(1, i - 1));
        const exact = F(r, n).mul(sum);
        expect(secretaryWinProbExact(n, r).equals(exact)).toBe(true);
        // … and the shipped double matches it to full double precision.
        expect(secretaryWinProb(n, r)).toBeCloseTo(exact.valueOf(), 12);
      }
    }
  });

  it("the double argmax equals the EXACT rational argmax for every small n", () => {
    // Certify the double-precision optimizer against the ground-truth rational
    // argmax where fraction.js is provably exact (n ≤ 20).
    for (let n = 2; n <= 20; n++) {
      let exactBestR = 0;
      let exactBestP = secretaryWinProbExact(n, 0);
      for (let r = 1; r < n; r++) {
        const p = secretaryWinProbExact(n, r);
        if (p.sub(exactBestP).valueOf() > 0) {
          exactBestP = p;
          exactBestR = r;
        }
      }
      expect(secretaryOptimalReject(n).r).toBe(exactBestR);
    }
  });

  it("secretaryOptimalReject returns the argmax over all r (no r beats it)", () => {
    for (const n of [2, 5, 10, 12, 20, 30, 52, 100]) {
      const { r, prob } = secretaryOptimalReject(n);
      for (let rr = 0; rr < n; rr++) {
        expect(secretaryWinProb(n, rr)).toBeLessThanOrEqual(prob + 1e-12);
      }
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(n);
      // The reject-count is always within 1 of the ⌊n/e⌋ closed form.
      expect(Math.abs(r - secretaryRejectApprox(n))).toBeLessThanOrEqual(1);
    }
  });

  it("n = 100 has the classic optimum r* = 37 with success ≈ 1/e", () => {
    const { r, prob } = secretaryOptimalReject(100);
    expect(r).toBe(37);
    expect(prob).toBeCloseTo(0.371, 2);
    // The reject-count and success prob both approach 1/e for large n.
    expect(secretaryRejectApprox(100)).toBe(36); // ⌊100/e⌋
    expect(secretaryOptimalReject(1000).prob).toBeCloseTo(1 / Math.E, 2);
  });

  it("the n/2 trap is the wrong reject-count", () => {
    expect(secretaryHalfTrap(100)).toBe(50);
    expect(secretaryOptimalReject(100).r).not.toBe(secretaryHalfTrap(100));
  });
});

/* ========================================================================== */
/*  3. Weighings — known-heavier is log base 3; fake-unknown is (3^k−3)/2     */
/* ========================================================================== */

describe("balance-scale weighing solvers", () => {
  it("known-heavier uses LOG BASE 3 (the hard invariant), never base 2", () => {
    expect(minWeighingsKnownHeavier(9)).toBe(2);
    expect(minWeighingsKnownHeavier(12)).toBe(3);
    expect(minWeighingsKnownHeavier(27)).toBe(3);
    for (let n = 2; n <= 300; n++) {
      const k = minWeighingsKnownHeavier(n);
      expect(3 ** k).toBeGreaterThanOrEqual(n); // k weighings suffice
      expect(3 ** (k - 1)).toBeLessThan(n); // k−1 do not
      // The binary trap NEVER under-counts (it treats 3 outcomes as 2).
      expect(minWeighingsBinaryTrap(n)).toBeGreaterThanOrEqual(k);
    }
  });

  it("fake-unknown (identify coin AND direction) matches (3^k − 3)/2 and the 12-coin classic", () => {
    expect(minWeighingsFakeUnknown(12)).toBe(3); // the famous twelve-coin puzzle
    expect(minWeighingsFakeUnknown(3)).toBe(2);
    expect(minWeighingsFakeUnknown(39)).toBe(4);
    for (let n = 2; n <= 200; n++) {
      const k = minWeighingsFakeUnknown(n);
      expect((3 ** k - 3) / 2).toBeGreaterThanOrEqual(n);
      expect((3 ** (k - 1) - 3) / 2).toBeLessThan(n);
    }
  });
});

/* ========================================================================== */
/*  4. Symmetry "last among k" — MUST be 1/k; EV = payout/k                   */
/* ========================================================================== */

describe("last-among-k symmetry solver", () => {
  it("P(a specific one is last) is EXACTLY 1/k (the hard invariant), brute-forced", () => {
    for (let k = 1; k <= 8; k++) {
      expect(lastAmongKProb(k).equals(F(1, k))).toBe(true);
      expect(lastAmongKBruteForce(k).equals(F(1, k))).toBe(true);
    }
  });

  it("the payout EV is payout/k and the traps are 1/k!, 1/2^(k−1), 1/2", () => {
    expect(symmetryPayoutEV(100, 4).equals(F(25))).toBe(true);
    expect(symmetryPayoutEV(120, 3).equals(F(40))).toBe(true);
    for (const k of [3, 4, 5, 6, 8]) {
      const t = lastAmongKTraps(k);
      let fact = 1n;
      for (let i = 2n; i <= BigInt(k); i++) fact *= i;
      expect(t.fullPermutation.equals(F(1, fact))).toBe(true);
      expect(t.pairwiseHalves.equals(F(1, 2 ** (k - 1)))).toBe(true);
      expect(t.coinFlip.equals(F(1, 2))).toBe(true);
      // Every trap ≠ the true 1/k (else it wouldn't be a trap) for k ≥ 3.
      expect(t.fullPermutation.equals(F(1, k))).toBe(false);
    }
  });
});

/* ========================================================================== */
/*  5. Generators — id-based re-derivation, prompt contents, gradable         */
/* ========================================================================== */

describe("info-trap generators are self-consistent across many seeds", () => {
  it("genQueryTheMax — answer re-derives to n; prompt shows n; grades", () => {
    for (const seed of SEEDS) {
      const c = genQueryTheMax(new Rng(seed));
      const n = Number(idParts(c.id)[2]);
      expect(c.answer).toContain(String(queryTheMaxMinQueries(n)));
      expect(c.prompt).toContain(String(n));
      expect(c.difficulty).toBe("medium");
      expect(c.gradable).toBe(true);
      expect(c.numericAnswer).toBe(n);
      expect(gradesCorrect(c, String(c.numericAnswer))).toBe(true);
    }
  });

  it("genSecretaryStop — reject-count re-derives to the argmax; prompt shows n", () => {
    for (const seed of SEEDS) {
      const c = genSecretaryStop(new Rng(seed));
      const n = Number(idParts(c.id)[2]);
      const { r } = secretaryOptimalReject(n);
      expect(c.numericAnswer).toBe(r);
      expect(c.answer).toContain(String(r));
      expect(c.prompt).toContain(String(n));
      expect(c.difficulty).toBe("hard");
      expect(gradesCorrect(c, String(c.numericAnswer))).toBe(true);
    }
  });

  it("genWeighKnownHeavier — weighings re-derive to ⌈log₃ n⌉; prompt shows n", () => {
    for (const seed of SEEDS) {
      const c = genWeighKnownHeavier(new Rng(seed));
      const n = Number(idParts(c.id)[2]);
      const answer = minWeighingsKnownHeavier(n);
      expect(c.numericAnswer).toBe(answer);
      expect(c.answer).toContain(`${answer} weighings`);
      expect(c.prompt).toContain(String(n));
      // The binary trap must be strictly worse (else it wouldn't be a trap).
      expect(minWeighingsBinaryTrap(n)).toBeGreaterThan(answer);
      expect(c.difficulty).toBe("medium");
      expect(gradesCorrect(c, String(c.numericAnswer))).toBe(true);
    }
  });

  it("genWeighFakeUnknown — weighings re-derive; known-heavier is a STRICT under-count", () => {
    for (const seed of SEEDS) {
      const c = genWeighFakeUnknown(new Rng(seed));
      const n = Number(idParts(c.id)[2]);
      const answer = minWeighingsFakeUnknown(n);
      expect(c.numericAnswer).toBe(answer);
      expect(c.answer).toContain(`${answer} weighings`);
      expect(c.prompt).toContain(String(n));
      expect(minWeighingsKnownHeavier(n)).toBeLessThan(answer);
      expect(c.difficulty).toBe("hard");
      expect(gradesCorrect(c, String(c.numericAnswer))).toBe(true);
    }
  });

  it("genLastAmongK — probability re-derives to 1/k; EV = payout/k; grades within tol", () => {
    for (const seed of SEEDS) {
      const c = genLastAmongK(new Rng(seed));
      const k = Number(idParts(c.id)[2]);
      const payout = Number(idParts(c.id)[3]);
      expect(c.numericAnswer).toBeCloseTo(1 / k, 12);
      expect(c.answer).toContain(`1/${k}`);
      expect(c.answer).toContain(`$${symmetryPayoutEV(payout, k).valueOf().toFixed(2)}`);
      expect(c.prompt).toContain(String(k));
      expect(c.difficulty).toBe("medium");
      expect(gradesCorrect(c, String(c.numericAnswer))).toBe(true);
    }
  });

  it("each generator is deterministic per seed and varied across seeds", () => {
    for (const [, gen] of ALL_INFOTRAP_FAMILIES) {
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
/*  6. Wiring — untimed diagnostic + the bt-7 Techniques Toolkit level         */
/* ========================================================================== */

describe("info-trap family is wired into the diagnostic + the bt-7 level", () => {
  it("the untimed diagnostic serves the info-trap families (folded into brainteaser-reasoning)", () => {
    const names = new Set(untimedBrainteaserItems().map((b) => b.familyName));
    const infoNames = ALL_INFOTRAP_FAMILIES.map(([n]) => n);
    // At least one info-trap family is present in the untimed brainteaser section.
    expect(infoNames.some((n) => names.has(n))).toBe(true);
    // All five families are unique, real generators.
    expect(new Set(infoNames).size).toBe(5);
  });

  it("bt-7 'Information & Adversarial Traps' sits in the Techniques Toolkit with 5 families", () => {
    const bt7 = brainteasersTrack.levels.find((l) => l.id === "bt-7");
    expect(bt7).toBeDefined();
    expect(bt7!.section).toBe("Techniques Toolkit");
    expect(bt7!.mode).toBe("flashcard");
    expect((bt7!.flashcards ?? []).length).toBeGreaterThan(0);
    expect(bt7!.flashcardGenerators?.length).toBe(5);
  });

  it("keeps the original three Core Puzzles levels + the three earlier toolkit levels intact", () => {
    const ids = brainteasersTrack.levels.map((l) => l.id);
    for (const id of ["bt-1", "bt-2", "bt-3", "bt-4", "bt-5", "bt-6", "bt-7"]) {
      expect(ids).toContain(id);
    }
    // bt-4..bt-6 are unchanged in count (the family-count guard in techniques.test).
    expect(brainteasersTrack.levels.find((l) => l.id === "bt-4")!.flashcardGenerators?.length).toBe(6);
  });
});
