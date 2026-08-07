import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import type { NumericQuestion, Question } from "@/types/content";
import {
  F,
  arbStakes,
  basketArbSide,
  basketNAV,
  betEV,
  booksum,
  bookState,
  fairProb,
  fairProbs,
  fractionalToDecimal,
  guaranteedProfit,
  hasArbitrage,
  impliedFromDecimal,
  impliedFromFractional,
  impliedFromMoneyline,
  moneylineToDecimal,
  overround,
  unweightedSum,
  valueBetIndex,
} from "./solvers";
import {
  ARBITRAGE_NUMERIC_GENERATORS,
  ARBITRAGE_QUIZ_GENERATORS,
} from "./generators";

const SEEDS = Array.from({ length: 400 }, (_, i) => i * 7 + 1);

/** Strip formatting ($ , % and the unicode minus) to compare numeric strings. */
function num(s: string): number {
  return Number(s.replace(/[$,%\s]/g, "").replace(/−/g, "-"));
}

/* ========================================================================== */
/*  1. Exact solver fixtures                                                    */
/* ========================================================================== */

describe("solvers — odds-format conversion is exact", () => {
  it("implied from decimal = 1/o", () => {
    expect(impliedFromDecimal("2.00").equals(F(1, 2))).toBe(true);
    expect(impliedFromDecimal("4.00").equals(F(1, 4))).toBe(true);
    expect(impliedFromDecimal("1.25").equals(F(4, 5))).toBe(true);
  });

  it("fractional a/b ⇒ decimal (a+b)/b and implied b/(a+b)", () => {
    expect(fractionalToDecimal(5, 2).equals(F(7, 2))).toBe(true); // 5/2 → 3.5
    expect(impliedFromFractional(5, 2).equals(F(2, 7))).toBe(true);
    expect(impliedFromFractional(1, 1).equals(F(1, 2))).toBe(true);
  });

  it("moneyline ⇒ decimal + implied (both signs)", () => {
    // +150 ⇒ decimal 2.5, implied 100/250 = 2/5
    expect(moneylineToDecimal(150).equals(F(5, 2))).toBe(true);
    expect(impliedFromMoneyline(150).equals(F(2, 5))).toBe(true);
    // −200 ⇒ decimal 1.5, implied 200/300 = 2/3
    expect(moneylineToDecimal(-200).equals(F(3, 2))).toBe(true);
    expect(impliedFromMoneyline(-200).equals(F(2, 3))).toBe(true);
    // A + and − with |m| = 100 are complementary at even money would be 1/2 each.
    expect(impliedFromMoneyline(100).add(impliedFromMoneyline(-100)).equals(F(1))).toBe(true);
  });
});

describe("solvers — booksum / de-vig / Dutch-book", () => {
  it("classifies fair / overround / arbitrage from the exact booksum", () => {
    expect(booksum(["2.00", "2.00"]).equals(F(1))).toBe(true);
    expect(bookState(["2.00", "2.00"])).toBe("fair");
    expect(hasArbitrage(["2.00", "2.00"])).toBe(false);

    expect(booksum(["1.90", "1.90"]).compare(1)).toBeGreaterThan(0);
    expect(bookState(["1.90", "1.90"])).toBe("overround");
    expect(overround(["1.90", "1.90"]).compare(0)).toBeGreaterThan(0);

    expect(booksum(["2.10", "2.10"]).compare(1)).toBeLessThan(0);
    expect(bookState(["2.10", "2.10"])).toBe("arbitrage");
    expect(hasArbitrage(["2.10", "2.10"])).toBe(true);
  });

  it("de-vig fair probs sum to exactly 1 and match hand values", () => {
    // Fair 3-way 0.5/0.25/0.25 is unchanged by de-vigging.
    expect(fairProb(["2.00", "4.00", "4.00"], 0).equals(F(1, 2))).toBe(true);
    for (const odds of [["1.90", "1.90"], ["1.80", "2.10", "3.50"], ["1.50", "4.00", "5.00"]]) {
      const fp = fairProbs(odds);
      const sum = fp.reduce((s, p) => s.add(p), F(0));
      expect(sum.equals(F(1))).toBe(true);
    }
  });

  it("arb stakes equalize the payout and profit = total/booksum − total", () => {
    const odds = ["2.50", "3.00", "6.00"]; // booksum = .4+.333+.167 = .9 < 1
    expect(hasArbitrage(odds)).toBe(true);
    const total = 900;
    const stakes = arbStakes(odds, total);
    // Total staked equals the outlay.
    expect(stakes.reduce((s, x) => s.add(x), F(0)).equals(F(total))).toBe(true);
    // Every outcome returns the same amount.
    const returns = odds.map((o, i) => stakes[i].mul(F(o)));
    for (const r of returns) expect(r.equals(returns[0])).toBe(true);
    // Guaranteed profit = return − outlay > 0.
    const bs = booksum(odds);
    expect(guaranteedProfit(odds, total).equals(F(total).div(bs).sub(total))).toBe(true);
    expect(guaranteedProfit(odds, total).compare(0)).toBeGreaterThan(0);
  });

  it("basket NAV weights by quantity; direction follows price vs NAV", () => {
    const legs = [
      { qty: 3, price: 10, label: "X" },
      { qty: 2, price: 5, label: "Y" },
    ];
    expect(basketNAV(legs)).toBe(40);
    expect(unweightedSum(legs)).toBe(15);
    expect(basketArbSide(40, 45)).toBe("sell_basket_buy_parts");
    expect(basketArbSide(40, 35)).toBe("buy_basket_sell_parts");
    expect(basketArbSide(40, 40)).toBe("fair");
  });

  it("value bet = argmax p·o and betEV = p·o − 1", () => {
    const probs = [F(50, 100), F(30, 100), F(20, 100)];
    const odds = ["1.80", "2.50", "6.00"];
    // C: 0.2·6 = 1.2 > 1 is the value leg; favorite A: 0.5·1.8 = 0.9 < 1.
    expect(valueBetIndex(probs, odds)).toBe(2);
    expect(betEV(F(20, 100), "6.00").equals(F(1, 5))).toBe(true);
    expect(betEV(F(50, 100), "1.80").compare(0)).toBeLessThan(0);
  });
});

/* ========================================================================== */
/*  2. Quiz generators — structural invariants                                 */
/* ========================================================================== */

describe("arbitrage quiz generators: 4 distinct choices, aligned rationale/tags", () => {
  for (const [name, gen] of Object.entries(ARBITRAGE_QUIZ_GENERATORS)) {
    it(`${name}: valid over ${SEEDS.length} seeds`, () => {
      for (const seed of SEEDS) {
        const q: Question = gen(new Rng(seed));
        expect(q.choices).toHaveLength(4);
        for (const c of q.choices) {
          expect(c.includes("·alt")).toBe(false);
          expect(c.length).toBeGreaterThan(0);
        }
        expect(new Set(q.choices).size).toBe(4);
        expect(q.correctIndex).toBeGreaterThanOrEqual(0);
        expect(q.correctIndex).toBeLessThan(4);
        expect(q.prompt.length).toBeGreaterThan(10);
        expect(q.explanation.length).toBeGreaterThan(20);
        if (q.distractorRationale) {
          expect(q.distractorRationale).toHaveLength(4);
          expect(q.distractorRationale[q.correctIndex].length).toBeGreaterThan(0);
        }
        expect(q.misconceptions).toHaveLength(4);
        expect(q.misconceptions![q.correctIndex]).toBe("");
        // Every non-correct choice carries a named misconception tag.
        q.choices.forEach((_, i) => {
          if (i !== q.correctIndex) expect(q.misconceptions![i].length).toBeGreaterThan(0);
        });
      }
    });
  }
});

/* ========================================================================== */
/*  3. Quiz generators — independent re-derivation of the correct answer        */
/* ========================================================================== */

describe("arbitrage quiz generators: correct choice re-derives independently", () => {
  it("genArbDetect: state agrees with an independent booksum classification", () => {
    for (const seed of SEEDS) {
      const q = ARBITRAGE_QUIZ_GENERATORS.genArbDetect(new Rng(seed));
      const odds = q.prompt.match(/decimal odds ([\d., ]+) on/)![1].split(/,\s*/);
      const bs = odds.reduce((s, o) => s + 1 / Number(o), 0);
      const correct = q.choices[q.correctIndex];
      if (Math.abs(bs - 1) < 1e-9) expect(correct).toContain("Fair book");
      else if (bs < 1) expect(correct).toContain("Arbitrage, back all outcomes");
      else expect(correct).toContain("Overround");
    }
  });

  it("genValueLeg: correct = argmax p·o and that leg beats break-even", () => {
    for (const seed of SEEDS) {
      const q = ARBITRAGE_QUIZ_GENERATORS.genValueLeg(new Rng(seed));
      const legs = [...q.prompt.matchAll(/([ABC]), true (\d+)%, odds (\d+\.\d+)/g)];
      expect(legs).toHaveLength(3);
      let bestName = "";
      let bestEV = -Infinity;
      let positives = 0;
      for (const m of legs) {
        const ev = (Number(m[2]) / 100) * Number(m[3]);
        if (ev > 1 + 1e-12) positives++;
        if (ev > bestEV) {
          bestEV = ev;
          bestName = m[1];
        }
      }
      expect(positives).toBe(1);
      expect(bestEV).toBeGreaterThan(1);
      expect(q.choices[q.correctIndex]).toBe(`Bet ${bestName}`);
    }
  });

  it("genBasketArb: correct direction sells the rich side", () => {
    for (const seed of SEEDS) {
      const q = ARBITRAGE_QUIZ_GENERATORS.genBasketArb(new Rng(seed));
      const m = q.prompt.match(/NAV \$([\d,]+)\. The basket itself trades at \$([\d,]+)/)!;
      const nav = num(m[1]);
      const price = num(m[2]);
      const correct = q.choices[q.correctIndex];
      // Independently recompute NAV from the parts to confirm the weighted sum.
      const parts = [...q.prompt.matchAll(/(\d+)× \w+ @ \$(\d+)/g)];
      const recomputed = parts.reduce((s, p) => s + Number(p[1]) * Number(p[2]), 0);
      expect(recomputed).toBe(nav);
      if (price > nav) expect(correct).toBe("Sell the basket, buy the components");
      else expect(correct).toBe("Buy the basket, sell the components");
    }
  });
});

/* ========================================================================== */
/*  4. Numeric generators — validity + independent re-derivation                */
/* ========================================================================== */

describe("arbitrage numeric generators: valid answers, distinct traceable errors", () => {
  for (const [name, gen] of Object.entries(ARBITRAGE_NUMERIC_GENERATORS)) {
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
          expect(q.answer).toBeGreaterThan(0);
        }
        const errs = q.commonErrors ?? [];
        const f = 10 ** (q.decimals ?? 0);
        const keys = new Set<number>();
        for (const ce of errs) {
          expect(Number.isFinite(ce.value)).toBe(true);
          expect(ce.value).toBeGreaterThan(0); // format-parity: same positive numeric shape
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

  it("genImpliedProb: answer = 1/o (decimal) / b/(a+b) (frac) / implied (moneyline)", () => {
    for (const seed of SEEDS) {
      const q = ARBITRAGE_NUMERIC_GENERATORS.genImpliedProb(new Rng(seed));
      if (/decimal odds/.test(q.prompt)) {
        const o = Number(q.prompt.match(/decimal odds (\d+\.\d+)/)![1]);
        expect(q.answer).toBeCloseTo(1 / o, 4);
      } else if (/fractional odds/.test(q.prompt)) {
        const m = q.prompt.match(/fractional odds (\d+)\/(\d+)/)!;
        const [a, b] = [Number(m[1]), Number(m[2])];
        expect(q.answer).toBeCloseTo(b / (a + b), 4);
      } else {
        const m = num(q.prompt.match(/American moneyline ([+−]?\d+)/)![1]);
        const dec = m > 0 ? 1 + m / 100 : 1 + 100 / Math.abs(m);
        expect(q.answer).toBeCloseTo(1 / dec, 4);
      }
    }
  });

  it("genDeVigFair: answer = (1/o₀)/Σ(1/oᵢ) on a real overround book", () => {
    for (const seed of SEEDS) {
      const q = ARBITRAGE_NUMERIC_GENERATORS.genDeVigFair(new Rng(seed));
      const odds = q.prompt.match(/decimal odds ([\d., ]+) on/)![1].split(/,\s*/).map(Number);
      const bs = odds.reduce((s, o) => s + 1 / o, 0);
      expect(bs).toBeGreaterThan(1);
      expect(q.answer).toBeCloseTo(1 / odds[0] / bs, 4);
    }
  });

  it("genArbStake: answer = total·(1/o₀)/booksum on a Dutch-book", () => {
    for (const seed of SEEDS) {
      const q = ARBITRAGE_NUMERIC_GENERATORS.genArbStake(new Rng(seed));
      const odds = q.prompt.match(/decimal odds ([\d., ]+) on/)![1].split(/,\s*/).map(Number);
      const total = num(q.prompt.match(/total outlay of (\$[\d,]+)/)![1]);
      const bs = odds.reduce((s, o) => s + 1 / o, 0);
      expect(bs).toBeLessThan(1);
      expect(q.answer).toBeCloseTo((total * (1 / odds[0])) / bs, 2);
    }
  });

  it("genArbProfit: answer = total·(1/booksum − 1)", () => {
    for (const seed of SEEDS) {
      const q = ARBITRAGE_NUMERIC_GENERATORS.genArbProfit(new Rng(seed));
      const odds = q.prompt.match(/decimal odds ([\d., ]+) on/)![1].split(/,\s*/).map(Number);
      const total = num(q.prompt.match(/total outlay of (\$[\d,]+)/)![1]);
      const bs = odds.reduce((s, o) => s + 1 / o, 0);
      expect(bs).toBeLessThan(1);
      expect(q.answer).toBeCloseTo(total * (1 / bs - 1), 2);
    }
  });

  it("genBasketNAV: answer = Σ qty×price parsed from the prompt", () => {
    for (const seed of SEEDS) {
      const q = ARBITRAGE_NUMERIC_GENERATORS.genBasketNAV(new Rng(seed));
      const legs = [...q.prompt.matchAll(/(\d+)× \w+ @ \$(\d+)/g)];
      const nav = legs.reduce((s, m) => s + Number(m[1]) * Number(m[2]), 0);
      expect(q.answer).toBe(nav);
    }
  });
});

/* ========================================================================== */
/*  5. Determinism — same seed ⇒ identical item                                 */
/* ========================================================================== */

describe("arbitrage generators are deterministic", () => {
  const all = { ...ARBITRAGE_QUIZ_GENERATORS, ...ARBITRAGE_NUMERIC_GENERATORS };
  for (const [name, gen] of Object.entries(all)) {
    it(`${name}: reproducible from the seed`, () => {
      for (const seed of [1, 42, 99, 1234]) {
        expect(gen(new Rng(seed))).toEqual(gen(new Rng(seed)));
      }
    });
  }
});
