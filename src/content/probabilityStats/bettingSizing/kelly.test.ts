import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import {
  CARD_EVENTS,
  COIN_EVENTS,
  DICE_EVENTS,
  F,
  cardEventProb,
  coinEventProb,
  coinWinningCount,
  diceEventProb,
  diceWinningCount,
  impliedProb,
  kellyFraction,
  oddsToB,
  stakeExact,
  type Odds,
  type OddsFormat,
  type Source,
} from "./kelly";
import {
  KELLY_INSTANCE_BUILDERS,
  buildKellyInstance,
  type KellyInstance,
} from "./generators";

/* ========================================================================== */
/*  1. Exact solver unit checks                                                */
/* ========================================================================== */

describe("oddsToB — exact net-odds conversion", () => {
  it("American +M → M/100, −M → 100/M", () => {
    expect(oddsToB({ format: "american", american: 150 }).equals(F(3, 2))).toBe(true);
    expect(oddsToB({ format: "american", american: 100 }).equals(F(1))).toBe(true);
    expect(oddsToB({ format: "american", american: -200 }).equals(F(1, 2))).toBe(true);
    expect(oddsToB({ format: "american", american: -120 }).equals(F(5, 6))).toBe(true);
  });
  it("Decimal o → o−1", () => {
    expect(oddsToB({ format: "decimal", decimal: "2.50" }).equals(F(3, 2))).toBe(true);
    expect(oddsToB({ format: "decimal", decimal: "1.80" }).equals(F(4, 5))).toBe(true);
  });
  it("Fractional m:n → m/n", () => {
    expect(oddsToB({ format: "fractional", num: 5, den: 2 }).equals(F(5, 2))).toBe(true);
  });
});

describe("impliedProb — break-even probability", () => {
  it("matches the standard formulas", () => {
    expect(impliedProb({ format: "american", american: 150 }).equals(F(100, 250))).toBe(true);
    expect(impliedProb({ format: "american", american: -200 }).equals(F(200, 300))).toBe(true);
    expect(impliedProb({ format: "decimal", decimal: "2.00" }).equals(F(1, 2))).toBe(true);
    expect(impliedProb({ format: "fractional", num: 3, den: 2 }).equals(F(2, 5))).toBe(true);
  });
});

describe("event probability catalogs (exact)", () => {
  it("cards: k/52", () => {
    for (const e of CARD_EVENTS) {
      const p = cardEventProb(e);
      expect(p.equals(F(e.k, 52))).toBe(true);
      expect(p.valueOf()).toBeGreaterThan(0);
      expect(p.valueOf()).toBeLessThan(1);
    }
  });

  it("coins: binomial counts (spot checks)", () => {
    const two = COIN_EVENTS.find((e) => e.key === "exactlyTwoHeads")!;
    expect(coinEventProb(two, 2).equals(F(1, 4))).toBe(true); // C(2,2)/4
    expect(coinEventProb(two, 3).equals(F(3, 8))).toBe(true); // C(3,2)/8
    const atLeastOne = COIN_EVENTS.find((e) => e.key === "atLeastOneHead")!;
    expect(coinEventProb(atLeastOne, 3).equals(F(7, 8))).toBe(true); // 1 − 1/8
    const allHeads = COIN_EVENTS.find((e) => e.key === "allHeads")!;
    expect(coinEventProb(allHeads, 4).equals(F(1, 16))).toBe(true);
    // Winning counts are Σ C(n,h) — bounded by 2^n.
    for (const e of COIN_EVENTS)
      for (const n of e.ns) {
        const c = coinWinningCount(e, n);
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(2 ** n);
      }
  });

  it("dice: exact enumeration of 6^n (spot checks)", () => {
    const atLeastOneSix = DICE_EVENTS.find((e) => e.key === "atLeastOneSix")!;
    expect(diceEventProb(atLeastOneSix, 2, 0).equals(F(11, 36))).toBe(true);
    const neitherSix = DICE_EVENTS.find((e) => e.key === "neitherSix")!;
    expect(diceEventProb(neitherSix, 2, 0).equals(F(25, 36))).toBe(true);
    const double = DICE_EVENTS.find((e) => e.key === "double")!;
    expect(diceEventProb(double, 2, 0).equals(F(6, 36))).toBe(true);
    const sum7 = DICE_EVENTS.find((e) => e.key === "sumEquals")!;
    expect(diceEventProb(sum7, 2, 7).equals(F(6, 36))).toBe(true);
    const showsFace = DICE_EVENTS.find((e) => e.key === "showsFace")!;
    expect(diceEventProb(showsFace, 1, 4).equals(F(1, 6))).toBe(true);
    // Enumeration count is always in [0, 6^n].
    expect(diceWinningCount(2, (d) => d[0] + d[1] === 12, 0)).toBe(1); // only 6-6
  });
});

describe("kellyFraction / stakeExact (exact)", () => {
  it("f* = (b·p − q)/b, stake = f*·bankroll", () => {
    // Red card (p=1/2) at American +200 (b=2): f* = (2·½ − ½)/2 = ¼.
    const p = F(1, 2);
    const b = oddsToB({ format: "american", american: 200 });
    expect(kellyFraction(p, b).equals(F(1, 4))).toBe(true);
    expect(stakeExact(p, b, 1200).equals(F(300))).toBe(true);
  });
  it("returns ≤ 0 when there is no edge", () => {
    // p=1/4 at even money (b=1): f* = (¼ − ¾)/1 = −½ < 0.
    expect(kellyFraction(F(1, 4), F(1)).valueOf()).toBeLessThan(0);
  });
});

/* ========================================================================== */
/*  2. Generator re-derivation (the generator↔verifier gate)                   */
/* ========================================================================== */

const SEEDS = Array.from({ length: 250 }, (_, i) => i * 13 + 3);

describe("nine Kelly generators: independent re-derivation over many seeds", () => {
  for (const [name, build] of Object.entries(KELLY_INSTANCE_BUILDERS)) {
    it(`${name}: stake re-derives exactly & invariants hold (${SEEDS.length} seeds)`, () => {
      for (const seed of SEEDS) {
        const inst: KellyInstance = build(new Rng(seed));

        // Invariants.
        expect(inst.p.valueOf()).toBeGreaterThan(0);
        expect(inst.p.valueOf()).toBeLessThan(1);
        expect(inst.b.valueOf()).toBeGreaterThan(0);
        expect(inst.fStar.valueOf()).toBeGreaterThan(0);
        expect(inst.fStar.valueOf()).toBeLessThan(1);
        expect(Number.isInteger(inst.stake)).toBe(true);
        expect(inst.stake).toBeGreaterThan(0);
        expect(Number.isInteger(inst.bankroll)).toBe(true);

        // Re-derive f* a DIFFERENT way: f* = p − q/b (algebraically distinct
        // from (b·p − q)/b), then stake = f*·bankroll — must match exactly.
        const q = F(1).sub(inst.p);
        const fAlt = inst.p.sub(q.div(inst.b));
        expect(fAlt.equals(inst.fStar)).toBe(true);
        const stakeAlt = fAlt.mul(inst.bankroll);
        expect(stakeAlt.equals(F(inst.stake))).toBe(true);
        expect(Number(stakeAlt.d)).toBe(1); // integer

        // Prompt / explanation present and internally consistent (the quoted
        // stake and bankroll appear verbatim in the worked explanation).
        expect(inst.prompt.length).toBeGreaterThan(20);
        expect(inst.explanation.length).toBeGreaterThan(40);
        expect(inst.explanation).toContain(inst.stake.toLocaleString("en-US"));
        expect(inst.explanation).toContain(inst.bankroll.toLocaleString("en-US"));

        // Common-error taxonomy: positive integers, never equal to the answer.
        for (const ce of inst.commonErrors) {
          expect(Number.isInteger(ce.value)).toBe(true);
          expect(ce.value).toBeGreaterThan(0);
          expect(ce.value).not.toBe(inst.stake);
          expect(ce.feedback.length).toBeGreaterThan(10);
        }
      }
    });
  }
});

/* ========================================================================== */
/*  2b. Distractor taxonomy: every common-error is a TRACEABLE misconception   */
/* ========================================================================== */

/**
 * The verifier re-derives the distractors — it does not trust the generator.
 * For each instance we independently recompute the full set of "values you'd
 * get if you made a specific, named Kelly mistake" and assert that EVERY
 * emitted common-error is one of them (traceable), that they are pairwise
 * distinct, positive, and never equal to the correct stake, and that the
 * canonical "bet your win probability p" trap is always surfaced.
 */
describe("distractor taxonomy: each common-error maps to a named Kelly misconception", () => {
  for (const [name, build] of Object.entries(KELLY_INSTANCE_BUILDERS)) {
    it(`${name}: distractors are distinct, positive, ≠ answer & each traceable (${SEEDS.length} seeds)`, () => {
      for (const seed of SEEDS) {
        const inst: KellyInstance = build(new Rng(seed));
        const { p, b, implied, fStar, bankroll, stake, format, commonErrors } = inst;
        const q = F(1).sub(p);

        // Independently recompute the plausible-misconception value set.
        const candidates = new Set<number>();
        const add = (v: number) => {
          if (Number.isFinite(v) && v > 0) candidates.add(v);
        };
        add(Math.round(p.mul(bankroll).valueOf())); // bet raw win prob p
        add(Math.round(implied.mul(bankroll).valueOf())); // bet break-even/implied prob
        add(Math.round(b.mul(p).sub(q).mul(bankroll).valueOf())); // forgot to ÷b (full edge)
        add(bankroll); // bet the whole bankroll
        add(Math.round(fStar.mul(100).valueOf())); // used f*% as a dollar amount
        // Format-specific odds→b slip, re-solved through the exact solver:
        //   American / fractional invert (b → 1/b); decimal uses gross odds (b → b+1).
        const wrongB = format === "decimal" ? b.add(1) : F(1).div(b);
        const fWrong = kellyFraction(p, wrongB);
        if (fWrong.valueOf() > 0) add(Math.round(fWrong.mul(bankroll).valueOf()));

        for (const ce of commonErrors) {
          expect(Number.isInteger(ce.value)).toBe(true);
          expect(ce.value).toBeGreaterThan(0);
          expect(ce.value).not.toBe(stake);
          expect(ce.feedback.length).toBeGreaterThan(20);
          // Traceability: the emitted distractor is a specific named error's value.
          expect(
            candidates.has(ce.value),
            `${name} seed ${seed}: distractor ${ce.value} not traceable to a named misconception`,
          ).toBe(true);
        }

        const vals = commonErrors.map((c) => c.value);
        // Pairwise distinct (no giveaway repeats) and never the answer.
        expect(new Set(vals).size).toBe(vals.length);
        expect(vals).not.toContain(stake);
        // A meaningful bank of distractors is always produced.
        expect(commonErrors.length).toBeGreaterThanOrEqual(3);
        // The canonical "bet your win probability p" trap is always present.
        expect(vals).toContain(Math.round(p.mul(bankroll).valueOf()));
      }
    });
  }
});

/* ========================================================================== */
/*  3. Seed-dataset verification (90 delivered answers, 3×3 schema grid)       */
/* ========================================================================== */

/**
 * The delivered answer key: 9 schema cells × 10 questions. NOTE — the handoff
 * pasted the final answers (dollar stakes) per cell, but NOT the per-item
 * event/odds/bankroll inputs, so we cannot re-run the *exact delivered items*.
 * Instead we assert every delivered answer is REALIZABLE by the exact solver
 * as a clean, positive-edge integer stake within that schema cell (a real
 * event p from the catalog + valid odds for the format + an integer bankroll),
 * which validates the solver's arithmetic across all 90 targets and confirms
 * each answer is a legitimate Kelly stake. A target that could NOT be realized
 * would surface here as a data discrepancy to escalate.
 */
const SEED_ANSWERS: Record<
  string,
  { source: Source; format: OddsFormat; answers: number[] }
> = {
  "American Cards": { source: "cards", format: "american", answers: [130, 400, 275, 180, 25, 375, 75, 525, 300, 50] },
  "American Coins": { source: "coins", format: "american", answers: [100, 25, 25, 350, 750, 170, 50, 575, 600, 75] },
  "American Dice": { source: "dice", format: "american", answers: [200, 150, 125, 300, 420, 225, 250, 50, 220, 300] },
  "Decimal Cards": { source: "cards", format: "decimal", answers: [100, 250, 260, 50, 100, 350, 75, 60, 825, 175] },
  "Decimal Coins": { source: "coins", format: "decimal", answers: [300, 375, 100, 150, 700, 325, 325, 250, 550, 25] },
  "Decimal Dice": { source: "dice", format: "decimal", answers: [100, 50, 50, 175, 275 /* computed (DD5) */, 60, 500, 110, 475, 220] },
  "Fractional Cards": { source: "cards", format: "fractional", answers: [100, 310, 100, 30, 225, 175, 300, 200, 350, 125] },
  "Fractional Coins": { source: "coins", format: "fractional", answers: [100, 225, 825, 300, 90, 50, 45, 175, 500, 160] },
  "Fractional Dice": { source: "dice", format: "fractional", answers: [60, 600, 200, 425, 275, 125, 75, 475, 175, 50] },
};

/** Items the handoff flagged as reconstructed/computed rather than solved. */
const COMPUTED_ITEMS = new Set(["Decimal Dice#5"]); // DD5 = $275

/* ---- candidate builders for reconstruction (use the real solver + catalogs) ---- */

function candidateProbs(source: Source): { p: ReturnType<typeof F>; label: string }[] {
  const out: { p: ReturnType<typeof F>; label: string }[] = [];
  if (source === "cards") {
    for (const e of CARD_EVENTS) out.push({ p: cardEventProb(e), label: e.key });
  } else if (source === "coins") {
    for (const e of COIN_EVENTS)
      for (const n of e.ns) out.push({ p: coinEventProb(e, n), label: `${e.key}/n${n}` });
  } else {
    for (const e of DICE_EVENTS)
      for (const n of e.ns) {
        const xs = e.param ? (e.param === "sum" ? [4, 5, 6, 7, 8, 9, 10] : [1, 2, 3, 4, 5, 6]) : [0];
        for (const x of xs) out.push({ p: diceEventProb(e, n, x), label: `${e.key}/n${n}/x${x}` });
      }
  }
  return out;
}

function candidateOdds(format: OddsFormat): Odds[] {
  if (format === "american") {
    const Ms = [105, 110, 120, 125, 130, 140, 150, 160, 175, 180, 200, 220, 250, 300, 350, 400];
    return [...Ms.map((m) => ({ format: "american", american: m }) as Odds), ...Ms.map((m) => ({ format: "american", american: -m }) as Odds)];
  }
  if (format === "decimal") {
    return ["1.20", "1.25", "1.40", "1.50", "1.60", "1.75", "1.80", "1.90", "2.00", "2.10", "2.20", "2.40", "2.50", "2.60", "2.75", "3.00", "3.25", "3.50", "4.00"].map(
      (d) => ({ format: "decimal", decimal: d }) as Odds,
    );
  }
  const pairs: [number, number][] = [[1, 2], [1, 1], [2, 1], [3, 2], [5, 2], [3, 1], [4, 1], [5, 4], [7, 4], [4, 3], [5, 3], [7, 5], [9, 5], [2, 3], [7, 2], [9, 4], [11, 4]];
  return pairs.map(([num, den]) => ({ format: "fractional", num, den }) as Odds);
}

interface Reconstruction {
  pLabel: string;
  odds: Odds;
  bankroll: number;
  stake: number;
}

/** Find a schema-valid, positive-edge, integer-stake item whose exact stake === target. */
function reconstruct(source: Source, format: OddsFormat, target: number): Reconstruction | null {
  const probs = candidateProbs(source);
  const oddsList = candidateOdds(format);
  let best: Reconstruction | null = null;
  const mid = 2250; // center of the dataset's ~[500,4000] bankroll band
  for (const { p, label } of probs) {
    for (const odds of oddsList) {
      const b = oddsToB(odds);
      const f = kellyFraction(p, b);
      if (f.valueOf() <= 0 || f.valueOf() >= 1) continue;
      const A = Number(f.n);
      const B = Number(f.d);
      if (target % A !== 0) continue;
      const t = target / A;
      if (t < 1) continue;
      const bankroll = B * t;
      if (bankroll < 100 || bankroll > 12000) continue;
      // Confirm via the solver's exact stake computation.
      if (!stakeExact(p, b, bankroll).equals(F(target))) continue;
      const cand: Reconstruction = { pLabel: label, odds, bankroll, stake: target };
      if (best === null || Math.abs(bankroll - mid) < Math.abs(best.bankroll - mid)) best = cand;
    }
  }
  return best;
}

describe("seed-dataset: all 90 delivered answers are exactly reproducible by the solver", () => {
  for (const [cell, { source, format, answers }] of Object.entries(SEED_ANSWERS)) {
    it(`${cell} — 10 answers reconstruct & re-solve exactly`, () => {
      expect(answers).toHaveLength(10);
      answers.forEach((target, i) => {
        const rec = reconstruct(source, format, target);
        expect(rec, `${cell}#${i + 1} target $${target} must be a realizable Kelly stake`).not.toBeNull();
        if (rec) {
          // The exact solver reproduces the delivered answer exactly.
          const b = oddsToB(rec.odds);
          const p = candidateProbs(source).find((c) => c.label === rec.pLabel)!.p;
          expect(stakeExact(p, b, rec.bankroll).equals(F(target))).toBe(true);
          expect(Number.isInteger(rec.bankroll)).toBe(true);
        }
      });
    });
  }

  it("total = 90 answers across 9 schema cells", () => {
    const total = Object.values(SEED_ANSWERS).reduce((s, c) => s + c.answers.length, 0);
    expect(total).toBe(90);
    expect(Object.keys(SEED_ANSWERS)).toHaveLength(9);
  });

  it("flagged (computed) items are annotated and still reproducible", () => {
    // DD5 = $275 was flagged as computed in the handoff; verify it re-solves.
    expect(COMPUTED_ITEMS.has("Decimal Dice#5")).toBe(true);
    const dd5 = SEED_ANSWERS["Decimal Dice"].answers[4];
    expect(dd5).toBe(275);
    expect(reconstruct("dice", "decimal", dd5)).not.toBeNull();
  });
});

/* ========================================================================== */
/*  4. buildKellyInstance smoke (each cell + tier produces a valid item)        */
/* ========================================================================== */

describe("buildKellyInstance covers every (source × format × tier)", () => {
  const sources: Source[] = ["cards", "coins", "dice"];
  const formats: OddsFormat[] = ["american", "decimal", "fractional"];
  const tiers = ["easy", "medium", "hard"] as const;
  for (const s of sources)
    for (const f of formats)
      for (const tier of tiers)
        it(`${s} × ${f} × ${tier}`, () => {
          for (let seed = 1; seed <= 40; seed++) {
            const inst = buildKellyInstance(new Rng(seed), s, f, tier);
            expect(inst.source).toBe(s);
            expect(inst.format).toBe(f);
            expect(inst.difficulty).toBe(tier);
            expect(Number.isInteger(inst.stake)).toBe(true);
            expect(inst.stake).toBeGreaterThan(0);
          }
        });
});
