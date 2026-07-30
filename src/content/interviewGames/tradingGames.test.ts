import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import type { NumericQuestion, Question } from "@/types/content";
import {
  F,
  adverseSelectionEV,
  basketNAV,
  booksum,
  deVigFairProb,
  hasArbitrage,
  nextCardFairPrice,
  nextHitProb,
} from "./tradingSolvers";
import {
  FERMI_FLASHCARDS,
  TRADING_NUMERIC_GENERATORS,
  TRADING_QUIZ_GENERATORS,
} from "./tradingGames";

const SEEDS = Array.from({ length: 400 }, (_, i) => i * 7 + 1);

/** Strip formatting ($ , % and the unicode minus) to compare numeric strings. */
function num(s: string): number {
  return Number(s.replace(/[$,%\s]/g, "").replace("−", "-"));
}

/* ========================================================================== */
/*  1. Exact solver unit checks (with known-correct fixtures)                  */
/* ========================================================================== */

describe("tradingSolvers — exact fixtures", () => {
  it("nextHitProb / fair price are conditional, not the full-deck ½", () => {
    expect(nextHitProb(26, 26).equals(F(1, 2))).toBe(true);
    expect(nextHitProb(13, 39).equals(F(1, 4))).toBe(true);
    expect(nextHitProb(6, 2).equals(F(3, 4))).toBe(true);
    expect(nextCardFairPrice(6, 2, 100).equals(F(75))).toBe(true);
  });

  it("booksum / de-vig / arbitrage detection", () => {
    // Fair book (booksum = 1), no arb.
    expect(booksum(["2.00", "2.00"]).equals(F(1))).toBe(true);
    expect(hasArbitrage(["2.00", "2.00"])).toBe(false);
    // Overround book (booksum > 1): the bookmaker's edge, no arb for bettor.
    expect(booksum(["1.90", "1.90"]).valueOf()).toBeGreaterThan(1);
    expect(hasArbitrage(["1.90", "1.90"])).toBe(false);
    // Dutch book (booksum < 1): arbitrage exists.
    expect(booksum(["2.10", "2.10"]).valueOf()).toBeLessThan(1);
    expect(hasArbitrage(["2.10", "2.10"])).toBe(true);
    // De-vig normalizes a fair 3-way book of 0.5/0.25/0.25 → unchanged.
    expect(deVigFairProb(["2.00", "4.00", "4.00"], 0).equals(F(1, 2))).toBe(true);
  });

  it("basketNAV is an exact weighted sum", () => {
    expect(basketNAV([{ qty: 3, price: 10, label: "A" }, { qty: 2, price: 5, label: "B" }])).toBe(40);
  });

  it("adverseSelectionEV reproduces the canonical ig-adverse-ev original (uniform 1..10, bid 4 / ask 7 → −$1.20)", () => {
    expect(adverseSelectionEV(10, 4, 7).equals(F(-6, 5))).toBe(true);
    expect(adverseSelectionEV(10, 4, 7).valueOf()).toBeCloseTo(-1.2, 10);
    // A two-sided quote against an informed counterparty is always ≤ 0.
    for (let N = 6; N <= 12; N += 2)
      for (let bid = 2; bid <= N - 3; bid++)
        for (let ask = bid + 2; ask <= N - 1; ask++)
          expect(adverseSelectionEV(N, bid, ask).valueOf()).toBeLessThanOrEqual(0);
  });
});

/* ========================================================================== */
/*  2. Quiz generators — structural invariants (mirror generators.test.ts)     */
/* ========================================================================== */

describe("trading quiz generators: 4 distinct choices, aligned rationale/misconceptions", () => {
  for (const [name, gen] of Object.entries(TRADING_QUIZ_GENERATORS)) {
    it(`${name}: valid over ${SEEDS.length} seeds`, () => {
      for (const seed of SEEDS) {
        const q: Question = gen(new Rng(seed));
        expect(q.choices).toHaveLength(4);
        for (const c of q.choices) expect(c.includes("·alt")).toBe(false);
        expect(new Set(q.choices).size).toBe(4);
        expect(q.correctIndex).toBeGreaterThanOrEqual(0);
        expect(q.correctIndex).toBeLessThan(4);
        expect(q.choices[q.correctIndex]).toBeTruthy();
        expect(q.prompt.length).toBeGreaterThan(10);
        expect(q.explanation.length).toBeGreaterThan(20);
        if (q.distractorRationale) {
          expect(q.distractorRationale).toHaveLength(4);
          expect(q.distractorRationale[q.correctIndex].length).toBeGreaterThan(0);
        }
        if (q.misconceptions) {
          expect(q.misconceptions).toHaveLength(4);
          expect(q.misconceptions[q.correctIndex]).toBe("");
        }
      }
    });
  }
});

/* ========================================================================== */
/*  3. Quiz generators — independent re-derivation of the CORRECT answer        */
/* ========================================================================== */

describe("trading quiz generators: correct choice re-derives independently", () => {
  it("genFermiMagnitude: correct = A × B × C", () => {
    for (const seed of SEEDS) {
      const q = TRADING_QUIZ_GENERATORS.genFermiMagnitude(new Rng(seed));
      const m = q.prompt.match(/roughly ([\d,]+) × ([\d,]+) × (\d+)/)!;
      expect(m).not.toBeNull();
      const prod = num(m[1]) * num(m[2]) * num(m[3]);
      expect(num(q.choices[q.correctIndex])).toBe(prod);
    }
  });

  it("genMakeMarketPnl: correct = independent JS adverse-selection loop", () => {
    for (const seed of SEEDS) {
      const q = TRADING_QUIZ_GENERATORS.genMakeMarketPnl(new Rng(seed));
      const m = q.prompt.match(/uniform on \{1,…,(\d+)\}\. You post bid (\d+) \/ ask (\d+)/)!;
      expect(m).not.toBeNull();
      const N = Number(m[1]);
      const bid = Number(m[2]);
      const ask = Number(m[3]);
      let sum = 0;
      for (let V = 1; V <= N; V++) {
        if (V < bid) sum += V - bid;
        else if (V > ask) sum += ask - V;
      }
      expect(num(q.choices[q.correctIndex])).toBe(Number((sum / N).toFixed(2)));
    }
  });

  it("genVigArb: correct answer agrees with an independent booksum test", () => {
    for (const seed of SEEDS) {
      const q = TRADING_QUIZ_GENERATORS.genVigArb(new Rng(seed));
      const odds = q.prompt.match(/decimal odds ([\d., ]+) on the/)![1].split(/,\s*/);
      const bs = odds.reduce((s, o) => s + 1 / Number(o), 0);
      const correct = q.choices[q.correctIndex];
      if (bs < 1) expect(correct).toContain("Arbitrage exists — back all outcomes");
      else expect(correct).toContain("No arbitrage");
    }
  });

  it("genBasketArb: correct direction sells the rich leg", () => {
    for (const seed of SEEDS) {
      const q = TRADING_QUIZ_GENERATORS.genBasketArb(new Rng(seed));
      const m = q.prompt.match(/worth \$([\d,]+) \(NAV\)\. The ETF that holds them trades at \$([\d,]+)/)!;
      const nav = num(m[1]);
      const price = num(m[2]);
      const correct = q.choices[q.correctIndex];
      if (price > nav) expect(correct).toBe("Sell the ETF, buy the basket of components");
      else expect(correct).toBe("Buy the ETF, sell the basket of components");
    }
  });

  it("genNextCardBet: correct decision matches conditional fair value", () => {
    for (const seed of SEEDS) {
      const q = TRADING_QUIZ_GENERATORS.genNextCardBet(new Rng(seed));
      const m = q.prompt.match(/(\d+) red and (\d+) black cards remain\. A ticket pays \$(\d+) if the next card is RED, offered at \$(\d+)/)!;
      const [h, b, pay, price] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
      const fair = (pay * h) / (h + b);
      const correct = q.choices[q.correctIndex];
      if (price < fair) expect(correct).toContain("Buy the ticket");
      else expect(correct).toContain("Sell / decline");
    }
  });
});

/* ========================================================================== */
/*  4. Numeric generators — validity + independent re-derivation                */
/* ========================================================================== */

describe("trading numeric generators: valid answers, distinct traceable errors", () => {
  for (const [name, gen] of Object.entries(TRADING_NUMERIC_GENERATORS)) {
    it(`${name}: invariants over ${SEEDS.length} seeds`, () => {
      for (const seed of SEEDS) {
        const q: NumericQuestion = gen(new Rng(seed));
        expect(q.prompt.length).toBeGreaterThan(10);
        expect(q.explanation.length).toBeGreaterThan(40);
        if (q.decimals == null) {
          expect(Number.isInteger(q.answer)).toBe(true);
          expect(q.answer).toBeGreaterThan(0);
        } else {
          expect(Number.isFinite(q.answer)).toBe(true);
          expect(q.answer).toBeGreaterThanOrEqual(0);
        }
        const errs = q.commonErrors ?? [];
        // Distinct and never equal to the key at grading precision.
        const f = 10 ** (q.decimals ?? 0);
        const keys = new Set<number>();
        for (const ce of errs) {
          expect(Number.isFinite(ce.value)).toBe(true);
          expect(Math.round(ce.value * f)).not.toBe(Math.round(q.answer * f));
          const k = Math.round(ce.value * f);
          expect(keys.has(k)).toBe(false);
          keys.add(k);
          expect(ce.feedback.length).toBeGreaterThan(10);
          expect(ce.misconception).toBeTruthy();
        }
        expect(errs.length).toBeGreaterThanOrEqual(1);
      }
    });
  }

  it("genBasketNAV: answer = Σ qty×price parsed from the prompt", () => {
    for (const seed of SEEDS) {
      const q = TRADING_NUMERIC_GENERATORS.genBasketNAV(new Rng(seed));
      const legs = [...q.prompt.matchAll(/(\d+) units? of \w+ at \$(\d+)/g)];
      const nav = legs.reduce((s, m) => s + Number(m[1]) * Number(m[2]), 0);
      expect(q.answer).toBe(nav);
    }
  });

  it("genNextCardFairProb: answer = red/(red+black)", () => {
    for (const seed of SEEDS) {
      const q = TRADING_NUMERIC_GENERATORS.genNextCardFairProb(new Rng(seed));
      const m = q.prompt.match(/(\d+) red and (\d+) black/)!;
      const [h, b] = [Number(m[1]), Number(m[2])];
      expect(q.answer).toBeCloseTo(h / (h + b), 4);
    }
  });

  it("genDeVig: answer = (1/o₀) / Σ(1/oᵢ) from a real overround book", () => {
    for (const seed of SEEDS) {
      const q = TRADING_NUMERIC_GENERATORS.genDeVig(new Rng(seed));
      const use = q.prompt
        .match(/decimal odds ([\d., ]+) on the/)![1]
        .split(/,\s*/)
        .map(Number);
      const bs = use.reduce((s, o) => s + 1 / o, 0);
      expect(bs).toBeGreaterThan(1);
      expect(q.answer).toBeCloseTo(1 / use[0] / bs, 4);
    }
  });
});

/* ========================================================================== */
/*  5. Fermi flashcards — integrity deck is well-formed                         */
/* ========================================================================== */

describe("Fermi flashcards", () => {
  it("are unique, substantive, and reasoning-based", () => {
    const ids = new Set<string>();
    for (const c of FERMI_FLASHCARDS) {
      expect(ids.has(c.id)).toBe(false);
      ids.add(c.id);
      expect(c.prompt.trim().length).toBeGreaterThan(10);
      expect(c.answer.trim().length).toBeGreaterThan(0);
      expect(c.explanation.trim().length).toBeGreaterThan(40);
    }
    expect(FERMI_FLASHCARDS.length).toBeGreaterThanOrEqual(5);
  });
});
