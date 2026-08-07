import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import type { NumericQuestion, Question } from "@/types/content";
import {
  F,
  acquireEvGivenWin,
  acquireExpectedProfit,
  acquireIsPositiveEv,
  acquireUnconditionalEv,
  evGivenWin,
  expectedMaxOfN,
  expectedMinOfN,
} from "./solvers";
import {
  AUCTION_NUMERIC_GENERATORS,
  AUCTION_QUIZ_GENERATORS,
} from "./generators";

const SEEDS = Array.from({ length: 250 }, (_, i) => i * 7 + 1);

/** The four NAMED misconceptions this task's distractors must encode. */
const NAMED = new Set([
  "ignored_winners_curse",
  "no_shading_for_n",
  "used_own_signal",
  "wrong_conditioning",
]);

/**
 * INDEPENDENT ground truth for E[max of n i.i.d. uniform draws on {−m,…,m}],
 * by brute-force enumeration of every one of the K^n signal tuples (memoized —
 * only ~12 (m,n) combos occur). Deliberately shares no code with the solver's
 * closed form, so agreement is a real cross-check.
 */
const emaxCache = new Map<string, number>();
function bruteExpectedMax(m: number, n: number): number {
  const key = `${m},${n}`;
  const cached = emaxCache.get(key);
  if (cached !== undefined) return cached;
  const vals: number[] = [];
  for (let v = -m; v <= m; v++) vals.push(v);
  const K = vals.length;
  const total = K ** n;
  let sumMax = 0;
  for (let t = 0; t < total; t++) {
    let x = t;
    let mx = -Infinity;
    for (let d = 0; d < n; d++) {
      const r = x % K;
      x = Math.floor(x / K);
      if (vals[r] > mx) mx = vals[r];
    }
    sumMax += mx;
  }
  const res = sumMax / total;
  emaxCache.set(key, res);
  return res;
}

/* ========================================================================== */
/*  1. Exact solver checks (closed form vs. brute force + known fixtures)       */
/* ========================================================================== */

describe("auction solvers — exact fixtures & brute-force agreement", () => {
  it("expectedMaxOfN matches hand-computed rationals", () => {
    expect(expectedMaxOfN(1, 1).equals(F(0))).toBe(true); // symmetric mean = 0
    expect(expectedMaxOfN(1, 2).equals(F(4, 9))).toBe(true);
    expect(expectedMaxOfN(1, 3).equals(F(2, 3))).toBe(true);
    expect(expectedMaxOfN(2, 2).equals(F(4, 5))).toBe(true);
    expect(expectedMaxOfN(3, 1).equals(F(0))).toBe(true);
  });

  it("closed form agrees with brute-force enumeration over all combos", () => {
    for (let m = 1; m <= 3; m++) {
      for (let n = 1; n <= 4; n++) {
        expect(expectedMaxOfN(m, n).valueOf()).toBeCloseTo(
          bruteExpectedMax(m, n),
          10,
        );
      }
    }
  });

  it("E[min] = −E[max] by symmetry", () => {
    for (let m = 1; m <= 4; m++)
      for (let n = 1; n <= 5; n++)
        expect(expectedMinOfN(m, n).equals(expectedMaxOfN(m, n).neg())).toBe(true);
  });

  it("SHADING increases (weakly) with n, strictly for a real signal", () => {
    for (let m = 2; m <= 4; m++) {
      for (let n = 1; n <= 6; n++) {
        const cur = expectedMaxOfN(m, n).valueOf();
        const nxt = expectedMaxOfN(m, n + 1).valueOf();
        expect(nxt).toBeGreaterThanOrEqual(cur); // weakly increasing (required)
        expect(nxt).toBeGreaterThan(cur); // strictly, for m ≥ 1 non-degenerate noise
      }
      expect(expectedMaxOfN(m, 1).valueOf()).toBe(0); // no curse with one bidder
    }
  });

  it("evGivenWin = signal − shade, strictly below the signal for n ≥ 2", () => {
    for (let m = 1; m <= 4; m++)
      for (let n = 2; n <= 5; n++) {
        const ev = evGivenWin(50, m, n);
        expect(ev.equals(F(50).sub(expectedMaxOfN(m, n)))).toBe(true);
        expect(ev.valueOf()).toBeLessThan(50);
      }
  });

  it("acquiring-a-company: E[V|win]=b/2, and +EV iff synergy > 2×", () => {
    expect(acquireEvGivenWin(40).equals(F(20))).toBe(true);
    expect(acquireUnconditionalEv(100).equals(F(50))).toBe(true);
    // Profit sign tracks (f − 2): f < 2 loses, f = 2 breaks even, f > 2 wins.
    expect(acquireExpectedProfit(100, 40, 3, 2).valueOf()).toBeLessThan(0);
    expect(acquireExpectedProfit(100, 40, 4, 2).valueOf()).toBe(0);
    expect(acquireExpectedProfit(100, 40, 5, 2).valueOf()).toBeGreaterThan(0);
    expect(acquireIsPositiveEv(9, 4)).toBe(true);
    expect(acquireIsPositiveEv(7, 4)).toBe(false);
    expect(acquireIsPositiveEv(3, 2)).toBe(false);
  });
});

/* ========================================================================== */
/*  2. Quiz generators — structural invariants                                 */
/* ========================================================================== */

describe("auction quiz generators: 4 distinct choices, aligned rationale/tags", () => {
  for (const [name, gen] of Object.entries(AUCTION_QUIZ_GENERATORS)) {
    it(`${name}: valid over ${SEEDS.length} seeds`, () => {
      for (const seed of SEEDS) {
        const q: Question = gen(new Rng(seed));
        expect(q.choices).toHaveLength(4);
        for (const c of q.choices) expect(c.includes("·alt")).toBe(false);
        expect(new Set(q.choices).size).toBe(4); // format-parity: all distinct
        expect(q.correctIndex).toBeGreaterThanOrEqual(0);
        expect(q.correctIndex).toBeLessThan(4);
        expect(q.prompt.length).toBeGreaterThan(20);
        expect(q.explanation.length).toBeGreaterThan(20);
        expect(q.family).toBe(name); // stable family id stamped on every item
        if (q.distractorRationale) {
          expect(q.distractorRationale).toHaveLength(4);
          expect(q.distractorRationale[q.correctIndex].length).toBeGreaterThan(0);
        }
        if (q.misconceptions) {
          expect(q.misconceptions).toHaveLength(4);
          expect(q.misconceptions[q.correctIndex]).toBe("");
          for (const tag of q.misconceptions)
            if (tag) expect(NAMED.has(tag)).toBe(true);
        }
      }
    });
  }
});

/* ========================================================================== */
/*  3. Quiz generators — independent re-derivation of the CORRECT answer        */
/* ========================================================================== */

describe("auction quiz generators: correct choice re-derives independently", () => {
  it("genBidEvDecision: +EV iff bid < signal − E[max of n]", () => {
    for (const seed of SEEDS) {
      const q = AUCTION_QUIZ_GENERATORS.genBidEvDecision(new Rng(seed));
      const n = Number(q.prompt.match(/n = (\d+) bidders/)![1]);
      const m = Number(q.prompt.match(/, (\d+)\}/)![1]);
      const signal = Number(q.prompt.match(/signal is \$(\d+)/)![1]);
      const bid = Number(q.prompt.match(/bidding \$(\d+)/)![1]);
      const evWin = signal - bruteExpectedMax(m, n);
      const correct = q.choices[q.correctIndex];
      if (bid < evWin) expect(correct.startsWith("+EV, even conditional")).toBe(true);
      else expect(correct.startsWith("−EV, the winner's curse")).toBe(true);
    }
  });

  it("genShadingWithN: correct = shade MORE, and E[max] grows n1→n2", () => {
    for (const seed of SEEDS) {
      const q = AUCTION_QUIZ_GENERATORS.genShadingWithN(new Rng(seed));
      const n1 = Number(q.prompt.match(/Auction A has n = (\d+)/)![1]);
      const n2 = Number(q.prompt.match(/Auction B has n = (\d+)/)![1]);
      const m = Number(q.prompt.match(/, (\d+)\}/)![1]);
      expect(n2).toBeGreaterThan(n1);
      expect(bruteExpectedMax(m, n2)).toBeGreaterThan(bruteExpectedMax(m, n1));
      expect(q.choices[q.correctIndex].startsWith("Bid LOWER")).toBe(true);
    }
  });

  it("genAcquireDecision: +EV iff synergy multiple f > 2", () => {
    for (const seed of SEEDS) {
      const q = AUCTION_QUIZ_GENERATORS.genAcquireDecision(new Rng(seed));
      const fm = q.prompt.match(/worth (\d+)\/(\d+) × V/)!;
      const fNum = Number(fm[1]);
      const fDen = Number(fm[2]);
      const correct = q.choices[q.correctIndex];
      if (fNum > 2 * fDen) expect(correct.startsWith("Yes,")).toBe(true);
      else expect(correct.startsWith("No,")).toBe(true);
    }
  });
});

/* ========================================================================== */
/*  4. Numeric generators — validity + independent re-derivation                */
/* ========================================================================== */

describe("auction numeric generators: valid answers, distinct traceable errors", () => {
  for (const [name, gen] of Object.entries(AUCTION_NUMERIC_GENERATORS)) {
    it(`${name}: invariants over ${SEEDS.length} seeds`, () => {
      for (const seed of SEEDS) {
        const q: NumericQuestion = gen(new Rng(seed));
        expect(q.prompt.length).toBeGreaterThan(20);
        expect(q.explanation.length).toBeGreaterThan(40);
        expect(q.family).toBe(name);
        expect(q.decimals).toBeGreaterThan(0);
        expect(Number.isFinite(q.answer)).toBe(true);
        expect(q.answer).toBeGreaterThanOrEqual(0);

        const errs = q.commonErrors ?? [];
        const f = 10 ** (q.decimals ?? 0);
        const keys = new Set<number>();
        for (const ce of errs) {
          expect(Number.isFinite(ce.value)).toBe(true);
          // distinct from the key at grading precision
          expect(Math.round(ce.value * f)).not.toBe(Math.round(q.answer * f));
          const k = Math.round(ce.value * f);
          expect(keys.has(k)).toBe(false); // distinct from each other
          keys.add(k);
          expect(ce.feedback.length).toBeGreaterThan(10);
          expect(ce.misconception).toBeTruthy();
          expect(NAMED.has(ce.misconception!)).toBe(true);
        }
        expect(errs.length).toBeGreaterThanOrEqual(1);
      }
    });
  }

  it("genWinnersCurseShade: answer = E[max of n signals]", () => {
    for (const seed of SEEDS) {
      const q = AUCTION_NUMERIC_GENERATORS.genWinnersCurseShade(new Rng(seed));
      const n = Number(q.prompt.match(/n = (\d+) bidders/)![1]);
      const m = Number(q.prompt.match(/, (\d+)\}/)![1]);
      expect(q.answer).toBeCloseTo(bruteExpectedMax(m, n), 4);
    }
  });

  it("genEvGivenWin: answer = signal − E[max of n signals]", () => {
    for (const seed of SEEDS) {
      const q = AUCTION_NUMERIC_GENERATORS.genEvGivenWin(new Rng(seed));
      const n = Number(q.prompt.match(/n = (\d+) bidders/)![1]);
      const m = Number(q.prompt.match(/, (\d+)\}/)![1]);
      const signal = Number(q.prompt.match(/signal is \$(\d+)/)![1]);
      expect(q.answer).toBeCloseTo(signal - bruteExpectedMax(m, n), 4);
    }
  });

  it("genAcquireEvGivenWin: answer = b/2 (mean of {0,…,b})", () => {
    for (const seed of SEEDS) {
      const q = AUCTION_NUMERIC_GENERATORS.genAcquireEvGivenWin(new Rng(seed));
      const b = Number(q.prompt.match(/bid of \$(\d+)/)![1]);
      expect(q.answer).toBeCloseTo(b / 2, 1);
    }
  });
});

/* ========================================================================== */
/*  5. Determinism-by-seed                                                      */
/* ========================================================================== */

describe("auction generators: fully deterministic by seed", () => {
  const all = { ...AUCTION_QUIZ_GENERATORS, ...AUCTION_NUMERIC_GENERATORS };
  for (const [name, gen] of Object.entries(all)) {
    it(`${name}: same seed ⇒ identical item`, () => {
      for (const seed of [1, 7, 42, 99, 1234]) {
        const a = gen(new Rng(seed));
        const b = gen(new Rng(seed));
        expect(a).toEqual(b);
      }
    });
  }
});
