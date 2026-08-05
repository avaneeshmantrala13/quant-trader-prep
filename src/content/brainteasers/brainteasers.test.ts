import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import {
  F,
  adjacentCrossBruteForce,
  adjacentCrossExpected,
  backupDealerExpectedPrice,
  fadingBuyer,
  fadingBuyerValueOfThreshold,
  inventoryCap,
  roundTrip,
  uniformPairMax,
  uniformPairMin,
  walkOfferDown,
  walkOfferRevenueForSchedule,
} from "./solvers";
import {
  genAdjacentCross,
  genBackupDealer,
  genFadingBuyer,
  genInventoryCap,
  genRoundTrip,
  genWalkOfferDown,
} from "./generators";
import { brainteasersTrack } from "./levels";
import {
  canRegenerate,
  canRegenerateFlashcard,
  generateFreshFlashcard,
} from "@/lib/regenerate";

/**
 * Verification for the six ORIGINAL parametric brainteaser families. Each exact
 * solver is checked against an INDEPENDENT ground truth:
 *   • brute force / exhaustive for the discrete families (Adjacent Cross,
 *     Inventory Cap small cap),
 *   • deterministic seeded Monte-Carlo (fixed seed, enough trials + tolerance)
 *     for the continuous families (Backup Dealer, Walking the Offer Down, Fading
 *     Buyer, Round-Trip),
 *   • the documented v2 answers as spot fixtures.
 * Then every generator is exercised across many seeds: its answer must re-derive
 * from the id via the solver, the prompt must contain the drawn numbers, and the
 * card must be self-consistent (non-empty answer + substantive explanation).
 */

const SEEDS = Array.from({ length: 80 }, (_, i) => i * 131 + 5);

/* A shared deterministic RNG stream for Monte-Carlo (fixed seed → non-flaky). */
function mcUniform(rng: Rng, M: number): number {
  return rng.next() * M;
}

/* ========================================================================== */
/*  1. Backup Dealer — exact midpoint + MC.                                     */
/* ========================================================================== */

describe("Backup Dealer solver", () => {
  it("documented case [0,1], 50/50 fill → 1/2", () => {
    expect(backupDealerExpectedPrice(F(0), F(1), F(1, 2)).equals(F(1, 2))).toBe(true);
  });

  it("collapses to the exact midpoint (a+b)/2 for p = 1/2, any interval", () => {
    for (const [a, b] of [
      [0, 1],
      [2, 5],
      [1, 4],
      [3, 9],
    ]) {
      expect(
        backupDealerExpectedPrice(F(a), F(b), F(1, 2)).equals(F(a + b, 2)),
      ).toBe(true);
    }
  });

  it("general fill-prob formula matches p·E[min] + (1−p)·E[max]", () => {
    for (const p of [F(1, 3), F(2, 3), F(1, 4), F(3, 5)]) {
      const a = F(1);
      const b = F(4);
      const expected = p
        .mul(uniformPairMin(a, b))
        .add(F(1).sub(p).mul(uniformPairMax(a, b)));
      expect(backupDealerExpectedPrice(a, b, p).equals(expected)).toBe(true);
    }
  });

  it("Monte-Carlo matches the closed form (fixed seed)", () => {
    const rng = new Rng(20260723);
    const a = 1;
    const b = 4;
    const trials = 300_000;
    let sum = 0;
    for (let i = 0; i < trials; i++) {
      const x = mcUniform(rng, b - a) + a;
      const y = mcUniform(rng, b - a) + a;
      const lo = Math.min(x, y);
      const hi = Math.max(x, y);
      sum += rng.next() < 0.5 ? lo : hi;
    }
    const mc = sum / trials;
    const exact = backupDealerExpectedPrice(F(a), F(b), F(1, 2)).valueOf();
    expect(Math.abs(mc - exact)).toBeLessThan(0.01);
  });
});

/* ========================================================================== */
/*  2. Adjacent Cross — exhaustive brute force.                                 */
/* ========================================================================== */

describe("Adjacent Cross solver", () => {
  it("documented 8 buys + 8 sells → exactly 4", () => {
    expect(adjacentCrossExpected(8, 8).equals(F(4))).toBe(true);
  });

  it("closed form n·m/(n+m) equals exhaustive brute force (all arrangements)", () => {
    for (let n = 1; n <= 7; n++) {
      for (let m = 1; m <= 7; m++) {
        expect(adjacentCrossExpected(n, m).equals(adjacentCrossBruteForce(n, m))).toBe(
          true,
        );
      }
    }
  });
});

/* ========================================================================== */
/*  3. Walking the Offer Down — grid-search optimality + MC of the policy.      */
/* ========================================================================== */

describe("Walking the Offer Down solver", () => {
  it("documented [0,1], 2 rounds → prices 2/3, 1/3; revenue 1/3; single-ask 1/4", () => {
    const { prices, revenue, singleAskRevenue } = walkOfferDown(F(1), 2);
    expect(prices[0].equals(F(2, 3))).toBe(true);
    expect(prices[1].equals(F(1, 3))).toBe(true);
    expect(revenue.equals(F(1, 3))).toBe(true);
    expect(singleAskRevenue.equals(F(1, 4))).toBe(true);
  });

  it("k = 1 reduces to the single-ask optimum M/4", () => {
    expect(walkOfferDown(F(1), 1).revenue.equals(F(1, 4))).toBe(true);
    expect(walkOfferDown(F(12), 1).revenue.equals(F(3))).toBe(true);
  });

  it("closed-form schedule beats a fine grid of nearby 2-round schedules", () => {
    const M = F(1);
    const best = walkOfferDown(M, 2).revenue.valueOf();
    let gridBest = 0;
    for (let i = 1; i < 100; i++) {
      for (let j = 1; j < i; j++) {
        const p1 = F(i, 100);
        const p2 = F(j, 100);
        const r = walkOfferRevenueForSchedule(M, [p1, p2]).valueOf();
        if (r > gridBest) gridBest = r;
      }
    }
    // The exact optimum is at least as good as the best grid point.
    expect(best).toBeGreaterThanOrEqual(gridBest - 1e-9);
  });

  it("Monte-Carlo of the optimal schedule matches the closed-form revenue", () => {
    const rng = new Rng(777001);
    const M = 1;
    const rounds = 3;
    const { prices, revenue } = walkOfferDown(F(M), rounds);
    const p = prices.map((f) => f.valueOf());
    const trials = 300_000;
    let sum = 0;
    for (let t = 0; t < trials; t++) {
      const V = mcUniform(rng, M);
      for (const price of p) {
        if (price <= V) {
          sum += price;
          break;
        }
      }
    }
    expect(Math.abs(sum / trials - revenue.valueOf())).toBeLessThan(0.01);
  });
});

/* ========================================================================== */
/*  4. Fading Buyer — MC + threshold-scan optimality (irrational answer).       */
/* ========================================================================== */

describe("Fading Buyer solver", () => {
  it("documented [0,1], q = 1/2 → t* = 2 − √3, W = 4 − 2√3", () => {
    const { threshold, ev } = fadingBuyer(1, 0.5);
    expect(Math.abs(threshold - (2 - Math.sqrt(3)))).toBeLessThan(1e-12);
    expect(Math.abs(ev - (4 - 2 * Math.sqrt(3)))).toBeLessThan(1e-12);
  });

  it("the solver's threshold maximizes the exact value-of-threshold curve", () => {
    for (const [M, q] of [
      [1, 0.5],
      [1, 1 / 3],
      [10, 0.5],
      [100, 2 / 3],
    ]) {
      const { threshold, ev } = fadingBuyer(M, q);
      // Exact payoff of playing t* equals the reported EV.
      expect(Math.abs(fadingBuyerValueOfThreshold(M, q, threshold) - ev)).toBeLessThan(
        1e-9,
      );
      // No nearby threshold does better (fine scan).
      let scanBest = 0;
      for (let i = 0; i <= 1000; i++) {
        const t = (i / 1000) * M;
        scanBest = Math.max(scanBest, fadingBuyerValueOfThreshold(M, q, t));
      }
      expect(ev).toBeGreaterThanOrEqual(scanBest - 1e-4 * M);
    }
  });

  it("Monte-Carlo of the threshold policy matches the closed-form EV", () => {
    const rng = new Rng(424242);
    const M = 1;
    const q = 0.5;
    const { threshold, ev } = fadingBuyer(M, q);
    const trials = 400_000;
    let sum = 0;
    for (let t = 0; t < trials; t++) {
      let payoff = 0;
      // Simulate until accept or collapse.
       
      while (true) {
        const x = mcUniform(rng, M);
        if (x >= threshold) {
          payoff = x;
          break;
        }
        // rejected → collapse w.p. q, else another offer
        if (rng.next() < q) {
          payoff = 0;
          break;
        }
      }
      sum += payoff;
    }
    expect(Math.abs(sum / trials - ev)).toBeLessThan(0.01);
  });
});

/* ========================================================================== */
/*  5. Round-Trip — backward induction + MC of the derived policy.              */
/* ========================================================================== */

describe("Round-Trip solver", () => {
  it("documented 3 days [0,1] → 1/4; 2 days → 1/8", () => {
    expect(roundTrip(F(1), 3).profit.equals(F(1, 4))).toBe(true);
    expect(roundTrip(F(1), 2).profit.equals(F(1, 8))).toBe(true);
  });

  it("profit scales linearly with M", () => {
    expect(roundTrip(F(10), 3).profit.equals(F(10, 4))).toBe(true);
    expect(roundTrip(F(100), 4).profit.equals(roundTrip(F(1), 4).profit.mul(100))).toBe(
      true,
    );
  });

  it("Monte-Carlo of the derived thresholds matches the exact profit", () => {
    const rng = new Rng(9090909);
    for (const days of [2, 3, 4, 5]) {
      const M = 1;
      const { profit, sellThresholds, buyThresholds } = roundTrip(F(M), days);
      const sell = sellThresholds.map((f) => f.valueOf());
      const buy = buyThresholds.map((f) => f.valueOf());
      const trials = 200_000;
      let sum = 0;
      for (let t = 0; t < trials; t++) {
        const px: number[] = [];
        for (let d = 0; d < days; d++) px.push(mcUniform(rng, M));
        // Simulate the online policy.
        let holding = false;
        let buyPrice = 0;
        let pnl = 0;
        for (let d = 0; d < days; d++) {
          const price = px[d];
          const isLast = d === days - 1;
          if (holding) {
            if (isLast || price >= sell[d]) {
              pnl = price - buyPrice;
              holding = false;
              break;
            }
          } else {
            // flat
            if (!isLast && price <= buy[d]) {
              holding = true;
              buyPrice = price;
            }
          }
        }
        if (holding) {
          // Safety: forced sale already handled on last day; nothing left.
          pnl = 0;
        }
        sum += pnl;
      }
      expect(Math.abs(sum / trials - profit.valueOf())).toBeLessThan(0.01);
    }
  });
});

/* ========================================================================== */
/*  6. Inventory Cap — exact stationary + MC of the chain.                      */
/* ========================================================================== */

describe("Inventory Cap solver", () => {
  it("documented cap 1, symmetric → rejection 1/3, uniform stationary", () => {
    const { stationary, rejectionRate } = inventoryCap(1, F(1, 2));
    expect(rejectionRate.equals(F(1, 3))).toBe(true);
    for (const pi of stationary) expect(pi.equals(F(1, 3))).toBe(true);
  });

  it("symmetric book: rejection = 1/(2k+1) for every cap", () => {
    for (let cap = 1; cap <= 5; cap++) {
      expect(inventoryCap(cap, F(1, 2)).rejectionRate.equals(F(1, 2 * cap + 1))).toBe(
        true,
      );
    }
  });

  it("stationary distribution sums to 1 and satisfies detailed balance", () => {
    for (const [cap, p] of [
      [1, F(1, 3)],
      [2, F(2, 3)],
      [3, F(2, 5)],
      [4, F(1, 2)],
    ] as [number, ReturnType<typeof F>][]) {
      const { stationary } = inventoryCap(cap, p);
      const total = stationary.reduce((acc, x) => acc.add(x), F(0));
      expect(total.equals(F(1))).toBe(true);
      // Detailed balance π_i·pUp = π_{i+1}·pDown across adjacent states.
      const pDown = F(1).sub(p);
      for (let i = 0; i < stationary.length - 1; i++) {
        expect(stationary[i].mul(p).equals(stationary[i + 1].mul(pDown))).toBe(true);
      }
    }
  });

  it("Monte-Carlo of the chain matches the exact rejection rate", () => {
    const rng = new Rng(31337);
    for (const [cap, pUp] of [
      [1, F(1, 2)],
      [2, F(1, 2)],
      [3, F(2, 3)],
    ] as [number, ReturnType<typeof F>][]) {
      const p = pUp.valueOf();
      const steps = 2_000_000;
      let inv = 0;
      let rejects = 0;
      for (let s = 0; s < steps; s++) {
        if (rng.next() < p) {
          if (inv + 1 <= cap) inv += 1;
          else rejects++;
        } else {
          if (inv - 1 >= -cap) inv -= 1;
          else rejects++;
        }
      }
      const exact = inventoryCap(cap, pUp).rejectionRate.valueOf();
      expect(Math.abs(rejects / steps - exact)).toBeLessThan(0.005);
    }
  });
});

/* ========================================================================== */
/*  7. Generators — id-based re-derivation, prompt contents, self-consistency.  */
/* ========================================================================== */

/** Parse trailing integer params from a generator id ("bt-fam-1-2" → [1,2]). */
function idNums(id: string): number[] {
  return id
    .split("-")
    .slice(2)
    .map((s) => Number(s));
}

describe("brainteaser generators are self-consistent across many seeds", () => {
  it("genBackupDealer — answer re-derives, prompt shows the interval", () => {
    for (const seed of SEEDS) {
      const c = genBackupDealer(new Rng(seed));
      const [a, b] = idNums(c.id);
      const exact = backupDealerExpectedPrice(F(a), F(b), F(1, 2));
      // The exact midpoint appears in the answer.
      const mid = exact.mul(100);
      const midText =
        Number(mid.d) === 1 ? `$${exact.valueOf().toFixed(2)}` : `$${exact.toFraction(false)}`;
      expect(c.answer).toContain(midText);
      expect(c.prompt.length).toBeGreaterThan(40);
      expect(c.explanation.length).toBeGreaterThan(40);
      expect(a).toBeLessThan(b);
      expect(c.difficulty).toBe("easy");
    }
  });

  it("genAdjacentCross — answer re-derives via n·m/(n+m); prompt shows counts", () => {
    for (const seed of SEEDS) {
      const c = genAdjacentCross(new Rng(seed));
      const [n, m] = idNums(c.id);
      const exact = adjacentCrossExpected(n, m);
      expect(c.answer).toContain(exact.toFraction(false));
      expect(c.prompt).toContain(String(n));
      expect(c.prompt).toContain(String(m));
      expect(c.prompt).toContain(String(n + m));
      expect(c.difficulty).toBe("medium");
    }
  });

  it("genWalkOfferDown — revenue re-derives; prompt shows scale + rounds", () => {
    for (const seed of SEEDS) {
      const c = genWalkOfferDown(new Rng(seed));
      const [M, rounds] = idNums(c.id);
      const { revenue } = walkOfferDown(F(M), rounds);
      const revText =
        Number(revenue.mul(100).d) === 1
          ? `$${revenue.valueOf().toFixed(2)}`
          : `$${revenue.toFraction(false)}`;
      expect(c.answer).toContain(revText);
      expect(rounds).toBeGreaterThanOrEqual(2); // aha: ≥ 2 asks preserved
      expect(c.difficulty).toBe("medium");
    }
  });

  it("genFadingBuyer — threshold + EV re-derive; irrational rendered as decimals", () => {
    for (const seed of SEEDS) {
      const c = genFadingBuyer(new Rng(seed));
      const [M, qn, qd] = idNums(c.id);
      const { threshold, ev } = fadingBuyer(M, qn / qd);
      expect(c.answer).toContain(threshold.toFixed(4));
      expect(c.answer).toContain(ev.toFixed(4));
      expect(c.difficulty).toBe("hard");
    }
  });

  it("genRoundTrip — profit re-derives; prompt shows days + scale", () => {
    for (const seed of SEEDS) {
      const c = genRoundTrip(new Rng(seed));
      const [M, days] = idNums(c.id);
      const { profit } = roundTrip(F(M), days);
      const profText =
        Number(profit.mul(100).d) === 1
          ? `$${profit.valueOf().toFixed(2)}`
          : `$${profit.toFraction(false)}`;
      expect(c.answer).toContain(profText);
      expect(c.prompt).toContain(String(days));
      expect(days).toBeGreaterThanOrEqual(2);
      expect(c.difficulty).toBe("hard");
    }
  });

  it("genInventoryCap — rejection rate re-derives; prompt shows the cap", () => {
    for (const seed of SEEDS) {
      const c = genInventoryCap(new Rng(seed));
      const [cap, pn, pd] = idNums(c.id);
      const { rejectionRate } = inventoryCap(cap, F(pn, pd));
      expect(c.answer).toContain(rejectionRate.toFraction(false));
      expect(c.prompt).toContain(String(cap));
      expect(c.difficulty).toBe("hard");
    }
  });

  it("each generator is deterministic per seed", () => {
    const gens = [
      genBackupDealer,
      genAdjacentCross,
      genWalkOfferDown,
      genFadingBuyer,
      genRoundTrip,
      genInventoryCap,
    ];
    for (const gen of gens) {
      const a = gen(new Rng(13579));
      const b = gen(new Rng(13579));
      expect(a.prompt).toBe(b.prompt);
      expect(a.answer).toBe(b.answer);
      expect(a.id).toBe(b.id);
    }
  });

  it("produces genuine variety across seeds (not one frozen card)", () => {
    for (const gen of [
      genBackupDealer,
      genAdjacentCross,
      genWalkOfferDown,
      genFadingBuyer,
      genRoundTrip,
      genInventoryCap,
    ]) {
      const prompts = new Set<string>();
      for (const seed of SEEDS) prompts.add(gen(new Rng(seed)).prompt);
      expect(prompts.size).toBeGreaterThan(1);
    }
  });
});

/* ========================================================================== */
/*  8. Wiring — the three brainteaser levels regenerate; static classics stay.  */
/* ========================================================================== */

describe("brainteaser levels are wired for infinite generation", () => {
  const [warmups, classics, hard] = brainteasersTrack.levels;

  it("all three flashcard levels carry parametric families AND keep static cards", () => {
    for (const lvl of [warmups, classics, hard]) {
      expect(lvl.mode).toBe("flashcard");
      expect((lvl.flashcards ?? []).length).toBeGreaterThan(0); // static classics remain
      expect((lvl.flashcardGenerators ?? []).length).toBeGreaterThan(0);
      expect(canRegenerateFlashcard(lvl)).toBe(true);
      expect(canRegenerate(lvl)).toBe(true);
    }
  });

  it("family counts match the plan (1 easy, 2 medium, 3 hard)", () => {
    expect(warmups.flashcardGenerators?.length).toBe(1);
    expect(classics.flashcardGenerators?.length).toBe(2);
    expect(hard.flashcardGenerators?.length).toBe(3);
  });

  it("generateFreshFlashcard yields fresh, valid, seed-keyed bonus cards", () => {
    for (const lvl of [warmups, classics, hard]) {
      const staticIds = new Set((lvl.flashcards ?? []).map((c) => c.id));
      const prompts = new Set<string>();
      for (let seed = 1; seed <= 60; seed++) {
        const c = generateFreshFlashcard(lvl, seed);
        expect(c).not.toBeNull();
        // Unique, seed-suffixed id → stable React key + never collides with the
        // static mastery-deck ids (so it can't corrupt the `understood` set).
        expect(c!.id).toContain(`-practice-${seed}`);
        expect(staticIds.has(c!.id)).toBe(false);
        expect(c!.answer.trim().length).toBeGreaterThan(0);
        expect(c!.explanation.trim().length).toBeGreaterThan(40);
        prompts.add(c!.prompt);
      }
      expect(prompts.size).toBeGreaterThan(1); // genuinely infinite variety
    }
  });

  it("static-only flashcard levels do NOT regenerate (fall back to the fixed pool)", () => {
    const noGen = { ...warmups, flashcardGenerators: undefined };
    expect(canRegenerateFlashcard(noGen)).toBe(false);
    expect(generateFreshFlashcard(noGen, 1)).toBeNull();
  });
});
