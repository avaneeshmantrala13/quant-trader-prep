import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import {
  F,
  asymmetricBetEV,
  binom,
  breakEvenProb,
  catalan,
  coinBiasPosterior,
  couponCollectorEV,
  cubeGraph,
  cycleGraph,
  cycleMeetingTime,
  completeGraph,
  deVigFairProb,
  diceSumProb,
  expectedHittingTime,
  expectedReturnTime,
  expectedWaitForPattern,
  hiddenCompositionNextSame,
  informedLiftPosteriorMean,
  keepHigherOfTwoEV,
  kellyFraction,
  maxOfDiceEV,
  minOfDiceEV,
  oneRerollEV,
  pathIntersectProb,
  pathsAvoidingPoint,
  probStrictlyGreater,
  resetCollectorEV,
  ruinExpectedDuration,
  ruinReachProb,
  sameTimeMeetProb,
  secretaryOptimal,
  stepLandingProb,
} from "./solvers";

/** Assert an exact Fraction equals a/b. */
function expectFrac(got: { compare(x: unknown): number }, a: number, b: number) {
  expect(got.compare(F(a, b) as never)).toBe(0);
}

/** Monte-Carlo helper: fraction of trials where `trial(rng)` is true. */
function mcRate(seed: number, trials: number, trial: (rng: Rng) => boolean): number {
  const rng = new Rng(seed);
  let hits = 0;
  for (let i = 0; i < trials; i++) if (trial(rng)) hits++;
  return hits / trials;
}

/** Monte-Carlo mean of `sample(rng)`. */
function mcMean(seed: number, trials: number, sample: (rng: Rng) => number): number {
  const rng = new Rng(seed);
  let sum = 0;
  for (let i = 0; i < trials; i++) sum += sample(rng);
  return sum / trials;
}

describe("binom / catalan / harmonic-derived", () => {
  it("computes exact binomials", () => {
    expect(binom(12, 5)).toBe(792);
    expect(binom(20, 10)).toBe(184756);
    expect(binom(5, 0)).toBe(1);
    expect(binom(5, 6)).toBe(0);
  });
  it("computes Catalan numbers", () => {
    expect(catalan(3)).toBe(5);
    expect(catalan(4)).toBe(14);
    expect(catalan(5)).toBe(42);
  });
});

describe("ANCHOR — lattice path intersection", () => {
  it("matches the verified anchor 3273/4096 for B=(3,4)", () => {
    expectFrac(pathIntersectProb(3, 4), 3273, 4096);
  });
  it("matches the verified generalizations", () => {
    expectFrac(pathIntersectProb(1, 1), 7, 8);
    expectFrac(pathIntersectProb(2, 2), 109, 128);
    expectFrac(pathIntersectProb(2, 3), 203, 256);
    expectFrac(pathIntersectProb(3, 3), 431, 512);
    expectFrac(pathIntersectProb(1, 4), 231, 512);
  });
  it("Monte-Carlo agrees with the exact anchor (2e5 trials)", () => {
    const bx = 3;
    const by = 4;
    const s = bx + by;
    const rate = mcRate(1, 200000, (rng) => {
      // A's x on each diagonal 0..s
      const ax = new Int16Array(s + 1);
      let x = 0;
      for (let i = 1; i <= s; i++) {
        if (rng.chance(0.5)) x++;
        ax[i] = x;
      }
      // B's x on each diagonal (start bx on diagonal s, decrement)
      const bxd = new Int16Array(s + 1);
      bxd[s] = bx;
      let xb = bx;
      for (let j = 1; j <= s; j++) {
        if (rng.chance(0.5)) xb--;
        bxd[s - j] = xb;
      }
      for (let k = 0; k <= s; k++) if (ax[k] === bxd[k]) return true;
      return false;
    });
    expect(Math.abs(rate - 3273 / 4096)).toBeLessThan(0.01);
  });
  it("same-time meeting is the parity trap", () => {
    expectFrac(sameTimeMeetProb(3, 4), 0, 1); // odd gap ⇒ 0
    expectFrac(sameTimeMeetProb(5, 7), 792, 4096);
    expectFrac(sameTimeMeetProb(2, 4), 15, 64);
  });
});

describe("gambler's ruin", () => {
  it("fair case a=3,N=10", () => {
    expectFrac(ruinReachProb(3, 10, F(1, 2)), 3, 10);
    expectFrac(ruinExpectedDuration(3, 10, F(1, 2)), 21, 1);
  });
  it("biased p=9/19 (roulette even-money) reach prob", () => {
    const reach = ruinReachProb(5, 10, F(9, 19));
    // P(ruin) ≈ 0.6287 ⇒ P(reach) ≈ 0.3713 (verified)
    expect(Math.abs(reach.valueOf() - 0.3713)).toBeLessThan(0.001);
  });
  it("Monte-Carlo agrees (fair, a=3,N=10)", () => {
    const rate = mcRate(2, 200000, (rng) => {
      let pos = 3;
      while (pos > 0 && pos < 10) pos += rng.chance(0.5) ? 1 : -1;
      return pos === 10;
    });
    expect(Math.abs(rate - 0.3)).toBeLessThan(0.01);
  });
});

describe("expected wait for a coin pattern (Conway)", () => {
  it("fair coin patterns", () => {
    expect(expectedWaitForPattern([0, 0], 2)).toBe(6); // HH
    expect(expectedWaitForPattern([0, 1], 2)).toBe(4); // HT
    expect(expectedWaitForPattern([0, 0, 0], 2)).toBe(14); // HHH
    expect(expectedWaitForPattern([0, 1, 0], 2)).toBe(10); // HTH
    expect(expectedWaitForPattern([0, 0, 1], 2)).toBe(8); // HHT
  });
  it("Monte-Carlo agrees for HH", () => {
    const mean = mcMean(3, 200000, (rng) => {
      let flips = 0;
      let prevH = false;
      for (;;) {
        const h = rng.chance(0.5);
        flips++;
        if (h && prevH) return flips;
        prevH = h;
      }
    });
    expect(Math.abs(mean - 6)).toBeLessThan(0.1);
  });
});

describe("secretary / best-choice", () => {
  it("n=5 optimum", () => {
    const { r, prob } = secretaryOptimal(5);
    expect(r).toBe(2);
    expectFrac(prob, 13, 30);
  });
  it("n=10 optimum r=3", () => {
    const { r, prob } = secretaryOptimal(10);
    expect(r).toBe(3);
    expect(Math.abs(prob.valueOf() - 0.3987)).toBeLessThan(0.001);
  });
});

describe("hitting / return times on graphs", () => {
  it("cube antipode = 10", () => {
    expectFrac(expectedHittingTime(cubeGraph(), 0, [7]), 10, 1);
  });
  it("6-cycle distance-3 hitting = 9, return = 6", () => {
    expectFrac(expectedHittingTime(cycleGraph(6), 0, [3]), 9, 1);
    expectFrac(expectedReturnTime(cycleGraph(6), 0), 6, 1);
  });
  it("complete graph K_5 return = 5, hitting = 4", () => {
    expectFrac(expectedReturnTime(completeGraph(5), 0), 5, 1);
    expectFrac(expectedHittingTime(completeGraph(5), 0, [1]), 4, 1);
  });
  it("Monte-Carlo agrees for the cube antipode", () => {
    const adj = cubeGraph();
    const mean = mcMean(4, 80000, (rng) => {
      let v = 0;
      let steps = 0;
      while (v !== 7) {
        v = adj[v][rng.int(0, adj[v].length - 1)];
        steps++;
      }
      return steps;
    });
    expect(Math.abs(mean - 10)).toBeLessThan(0.2);
  });
});

describe("coupon collector (plain + reset)", () => {
  it("plain die = 147/10", () => {
    expectFrac(couponCollectorEV(6), 147, 10);
  });
  it("7-face with fragile last face resets = 1701/20", () => {
    expectFrac(resetCollectorEV(7), 1701, 20);
  });
  it("Monte-Carlo agrees for the reset collector (n=7)", () => {
    const n = 7;
    const mean = mcMean(5, 60000, (rng) => {
      let rolls = 0;
      const seen = new Set<number>();
      for (;;) {
        const face = rng.int(1, n);
        rolls++;
        if (seen.size === n - 1 && !seen.has(face)) return rolls; // got the last new
        if (seen.size === n - 1 && seen.has(face)) {
          seen.clear(); // reset
          continue;
        }
        seen.add(face);
      }
    });
    expect(Math.abs(mean - 85.05)).toBeLessThan(1.5);
  });
});

describe("hidden-composition Bayes (Citadel)", () => {
  it("N=4,m=2 → 3/4; N=6,m=3 → 4/5", () => {
    expectFrac(hiddenCompositionNextSame(4, 2), 3, 4);
    expectFrac(hiddenCompositionNextSame(6, 3), 4, 5);
  });
});

describe("Bayes fair-vs-biased coin (Optiver)", () => {
  it("pB=3/4, 3 heads → posterior 27/35, predictive 97/140", () => {
    const { posteriorBiased, predictiveHead } = coinBiasPosterior(F(3, 4), 3);
    expectFrac(posteriorBiased, 27, 35);
    expectFrac(predictiveHead, 97, 140);
  });
});

describe("dice distributions", () => {
  it("sum of 3 dice = 10 → 1/8", () => {
    expectFrac(diceSumProb(3, 6, 10), 1, 8);
  });
  it("order statistics of dice", () => {
    expectFrac(maxOfDiceEV(2, 6), 161, 36);
    expectFrac(maxOfDiceEV(3, 6), 119, 24);
    expectFrac(minOfDiceEV(3, 6), 49, 24);
    expectFrac(probStrictlyGreater(6), 5, 12);
  });
  it("informed-lift posterior mean (dice sum, ask 8) = 10", () => {
    expectFrac(informedLiftPosteriorMean(2, 6, 8), 10, 1);
  });
});

describe("EV / stopping / sizing", () => {
  it("one optional reroll: n=6 → 17/4, n=13 → 112/13", () => {
    expectFrac(oneRerollEV(6), 17, 4);
    expectFrac(oneRerollEV(13), 112, 13);
  });
  it("keep-higher-of-two: n=13 → 119/13", () => {
    expectFrac(keepHigherOfTwoEV(13), 119, 13);
  });
  it("coin-step landing p4=11/16, p10=683/1024", () => {
    expectFrac(stepLandingProb(4), 11, 16);
    expectFrac(stepLandingProb(10), 683, 1024);
  });
  it("Kelly fraction p=3/5,b=1 → 1/5", () => {
    expectFrac(kellyFraction(F(3, 5), 1), 1, 5);
  });
  it("asymmetric bet +10/-1: break-even 1/11, EV at p=1/5 is 6/5", () => {
    expectFrac(breakEvenProb(10, 1), 1, 11);
    expectFrac(asymmetricBetEV(F(1, 5), 10, 1), 6, 5);
  });
});

describe("de-vig + constrained path counting + cycle meeting", () => {
  it("de-vig fair prob leg0 (odds 2.0, 4.0) → 2/3", () => {
    expectFrac(deVigFairProb([2, 4], [1, 1]), 2, 3);
  });
  it("paths avoiding a point (3,3) avoid (1,1) = 8", () => {
    expect(pathsAvoidingPoint(3, 3, 1, 1)).toBe(8);
  });
  it("two walkers meeting on a cycle", () => {
    expectFrac(cycleMeetingTime(8, 4)!, 8, 1);
    expectFrac(cycleMeetingTime(12, 6)!, 18, 1);
    expectFrac(cycleMeetingTime(4, 2)!, 2, 1);
    expect(cycleMeetingTime(6, 3)).toBeNull(); // odd gap ⇒ never meet
  });
});
