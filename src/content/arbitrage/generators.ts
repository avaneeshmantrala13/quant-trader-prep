import type { Rng } from "@/lib/rng";
import type {
  NumericQuestion,
  NumericQuestionGenerator,
  Question,
  QuestionGenerator,
} from "@/types/content";
import { assemble, fmt, pct } from "../shared";
import {
  F,
  arbStakes,
  basketNAV,
  betEV,
  booksum,
  bookState,
  favoriteIndex,
  fmtMoneyline,
  fracToRounded,
  fairProb,
  guaranteedProfit,
  guaranteedReturn,
  impliedFromDecimal,
  impliedFromFractional,
  impliedFromMoneyline,
  moneylineToDecimal,
  unweightedSum,
  valueBetIndex,
  type BasketLeg,
} from "./solvers";

/**
 * Generators for the PURE no-arbitrage / odds-normalization / de-vig reasoning
 * drill. Every ground-truth answer is re-derived by an EXACT rational solver in
 * `solvers.ts` (never hardcoded), and every distractor encodes a NAMED
 * misconception (see the `misconceptionByValue` / `commonErrors[].misconception`
 * tags) rather than a random number. Answer routing:
 *   scalar probability / $ stake / $ profit  → numeric free-entry,
 *   detection / direction / value-leg choice  → multiple-choice quiz.
 *
 * SCOPE: this is a math + logic drill about odds → implied probability,
 * stripping the vig, Dutch-book detection, arb sizing, and basket (parts-vs-
 * whole) mispricings. It deliberately contains NO put-call-parity / options /
 * synthetics content.
 */

/* -------------------------------------------------------------------------- */
/*  Draw pools                                                                  */
/* -------------------------------------------------------------------------- */

/** Terminating-decimal odds strings (exact under fraction.js). */
const DECIMAL_ODDS = [
  "1.50", "1.80", "1.90", "2.00", "2.10", "2.20",
  "2.50", "2.75", "3.00", "4.00", "5.00", "6.00",
];

/** Longer odds used to build genuine arbitrage (Dutch-book) books. */
const LONG_ODDS = ["2.10", "2.20", "2.50", "2.75", "3.00", "3.50", "4.00", "5.00", "6.00"];

/** Fractional odds `[a, b]` ("a-to-b against"); implied = b/(a+b). */
const FRACTIONALS: [number, number][] = [
  [1, 2], [2, 1], [5, 2], [3, 1], [7, 2], [4, 1],
  [5, 1], [1, 1], [9, 4], [11, 4], [6, 4], [3, 2],
];

/** American moneyline integers; sign encodes underdog (+) / favorite (−). */
const MONEYLINES = [-200, -180, -150, -120, -110, 110, 120, 150, 180, 200, 250, 300];

const OUTCOMES3 = ["A", "B", "C"];

/** 4-decimal probability display. */
const P4 = (x: number) => fmt(x, 4);
const $ = (n: number) => `$${fmt(n)}`;

/* -------------------------------------------------------------------------- */
/*  Shared numeric-distractor deduping (mirrors the interviewGames pattern)     */
/* -------------------------------------------------------------------------- */

interface RawErr {
  value: number;
  feedback: string;
  misconception: string;
}

/** Drop distractors equal to the answer (at grading precision), ≤0, or repeats. */
function dedupeErrors(raw: RawErr[], answer: number, dp: number): RawErr[] {
  const f = 10 ** dp;
  const key = (v: number) => Math.round(v * f);
  const seen = new Set<number>([key(answer)]);
  const out: RawErr[] = [];
  for (const e of raw) {
    if (!Number.isFinite(e.value) || e.value <= 0) continue;
    const k = key(e.value);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(e);
  }
  return out;
}

/** Draw a k-leg book from `pool` (with replacement) satisfying `ok(booksum)`. */
function drawBook(
  rng: Rng,
  pool: string[],
  ks: readonly number[],
  ok: (odds: string[]) => boolean,
  fallback: string[],
): string[] {
  for (let tries = 0; tries < 80; tries++) {
    const k = rng.pick(ks);
    const odds = Array.from({ length: k }, () => rng.pick(pool));
    if (ok(odds)) return odds;
  }
  return fallback;
}

/* ========================================================================== */
/*  NUMERIC — implied probability, de-vig, arb stake, arb profit, basket NAV    */
/* ========================================================================== */

/**
 * Convert quoted odds (decimal / fractional / American moneyline) to the IMPLIED
 * probability. This is the raw 1/o conversion — NOT yet de-vigged.
 */
function genImpliedProb(rng: Rng): NumericQuestion {
  const format = rng.pick(["decimal", "fractional", "moneyline"] as const);
  let answer: number;
  let raw: RawErr[];
  let quoteLabel: string;
  let workLine: string;

  if (format === "decimal") {
    const o = rng.pick(DECIMAL_ODDS);
    const p = impliedFromDecimal(o);
    answer = fracToRounded(p, 4);
    quoteLabel = `decimal odds ${o}`;
    workLine = `implied = 1 / ${o} = ${P4(answer)} (${pct(answer)})`;
    raw = [
      { value: fracToRounded(F(1).sub(p), 4), feedback: "That is the probability of the OTHER outcome — the complement 1 − 1/o, not this leg's implied probability.", misconception: "complement_prob" },
      { value: fracToRounded(F(1).div(F(o).add(1)), 4), feedback: "You read the decimal odds as if they were fractional (b-to-1): implied = 1/(o+1). Decimal odds already include the stake, so implied = 1/o.", misconception: "decimal_as_fractional" },
      { value: fracToRounded(F(o).sub(1).div(F(o)), 4), feedback: "That is (o−1)/o, the NET-return share, not the implied probability 1/o.", misconception: "net_return_share" },
    ];
  } else if (format === "fractional") {
    const [a, b] = rng.pick(FRACTIONALS);
    const p = impliedFromFractional(a, b);
    answer = fracToRounded(p, 4);
    quoteLabel = `fractional odds ${a}/${b}`;
    workLine = `implied = b/(a+b) = ${b}/(${a}+${b}) = ${P4(answer)} (${pct(answer)})`;
    raw = [
      { value: fracToRounded(F(a, a + b), 4), feedback: "You inverted the fraction: a/(a+b) is the probability the bet LOSES. Implied (win) = b/(a+b).", misconception: "fraction_inverted" },
      { value: fracToRounded(F(1, a + b), 4), feedback: "You used 1/(a+b) — treating the total as the denominator with a unit numerator instead of the stake b.", misconception: "unit_numerator" },
      { value: fracToRounded(F(b, a), 4), feedback: "That is b/a (the raw payout ratio), not a probability.", misconception: "ratio_not_prob" },
    ];
  } else {
    const m = rng.pick(MONEYLINES);
    const p = impliedFromMoneyline(m);
    answer = fracToRounded(p, 4);
    quoteLabel = `American moneyline ${fmtMoneyline(m)}`;
    const dec = moneylineToDecimal(m);
    workLine = `moneyline ${fmtMoneyline(m)} ⇒ decimal ${P4(fracToRounded(dec, 4))} ⇒ implied 1/o = ${P4(answer)} (${pct(answer)})`;
    raw = [
      { value: fracToRounded(impliedFromMoneyline(-m), 4), feedback: "You applied the wrong-sign formula: a + moneyline uses 100/(m+100), a − uses |m|/(|m|+100). Flipping them flips the probability.", misconception: "moneyline_sign_flip" },
      { value: fracToRounded(F(1).sub(p), 4), feedback: "That is the complement (the other side's implied probability), not this leg's.", misconception: "complement_prob" },
      { value: fracToRounded(F(Math.abs(m), 100), 4), feedback: "You divided the moneyline by 100 without adding the 100 stake term in the denominator.", misconception: "forgot_stake_term" },
    ];
  }

  const errors = dedupeErrors(raw, answer, 4);
  const prompt = `A single outcome is quoted at ${quoteLabel}. What is its IMPLIED probability (as a decimal in 0–1)? Do NOT de-vig — just convert the quote.`;
  return {
    id: `arb-implied-${format}-${quoteLabel.replace(/\W+/g, "")}`,
    prompt,
    answer,
    decimals: 4,
    difficulty: format === "moneyline" ? "hard" : "medium",
    concept: "Quoted odds → implied probability",
    explanation: `Implied probability is 1/(decimal odds). Here ${workLine}. Implied probabilities are what you normalize (de-vig) when a book has several outcomes.`,
    commonErrors: errors,
    unit: "prob",
    source: "Odds → implied probability conversion",
    family: "genImpliedProb",
  };
}

/**
 * Strip the vig: de-vigged FAIR probability of the first leg on an overround
 * book, fairᵢ = (1/oᵢ)/Σ(1/oⱼ).
 */
function genDeVigFair(rng: Rng): NumericQuestion {
  const odds = drawBook(
    rng,
    DECIMAL_ODDS,
    [2, 3],
    (o) => booksum(o).compare(1) > 0,
    ["1.90", "1.90"],
  );
  const bs = booksum(odds);
  const fair = fairProb(odds, 0);
  const answer = fracToRounded(fair, 4);
  const bsNum = fracToRounded(bs, 4);

  const raw: RawErr[] = [
    { value: fracToRounded(impliedFromDecimal(odds[0]), 4), feedback: "You used the RAW implied probability 1/o and never removed the overround. Divide by the booksum to strip the vig.", misconception: "ignore_overround" },
    { value: fracToRounded(F(1, odds.length), 4), feedback: "You assumed the outcomes were equally likely (1/k), ignoring the odds entirely.", misconception: "uniform_norm" },
    { value: fracToRounded(impliedFromDecimal(odds[0]).div(F(odds.reduce((s, o) => s + Number(o), 0))), 4), feedback: "You normalized by the sum of the ODDS instead of the sum of implied probabilities (the booksum).", misconception: "normalize_by_odds" },
  ];
  const errors = dedupeErrors(raw, answer, 4);

  return {
    id: `arb-devig-${odds.join("-")}`,
    prompt: `A book posts decimal odds ${odds.join(", ")} on the ${odds.length} mutually-exclusive outcomes (exactly one happens). The booksum Σ(1/oᵢ) = ${P4(bsNum)} > 1, so it carries an overround. Strip the vig: what is the FAIR probability of the FIRST outcome (decimal 0–1)?`,
    answer,
    decimals: 4,
    difficulty: "hard",
    concept: "De-vig: normalize implied probs to sum to 1",
    explanation: `Raw implied probs are 1/oᵢ and sum to ${P4(bsNum)} (the overround). Normalize: fair = (1/${odds[0]}) / ${P4(bsNum)} = ${P4(answer)} (${pct(answer)}). De-vigging just rescales the implied probs so they sum to exactly 1.`,
    commonErrors: errors,
    unit: "prob",
    source: "Vig / overround removal",
    family: "genDeVigFair",
  };
}

/** Build an arbitrage (Dutch-book) book: booksum < 1. */
function drawArbBook(rng: Rng): string[] {
  return drawBook(
    rng,
    LONG_ODDS,
    [2, 3],
    (o) => booksum(o).compare(1) < 0,
    ["2.50", "2.50"],
  );
}

/**
 * Arb stake sizing: how much of a total outlay to place on the FIRST leg so
 * every outcome returns the same amount, stake₁ = total·(1/o₁)/booksum.
 */
function genArbStake(rng: Rng): NumericQuestion {
  const odds = drawArbBook(rng);
  const total = rng.pick([100, 200, 500, 1000] as const);
  const stakes = arbStakes(odds, total);
  const answer = fracToRounded(stakes[0], 2);
  const bs = booksum(odds);
  const oddsSum = odds.reduce((s, o) => s + Number(o), 0);

  const raw: RawErr[] = [
    { value: fracToRounded(F(total, odds.length), 2), feedback: "You split the outlay EQUALLY across the legs (total/k). Equal stakes don't equalize the payouts — size proportional to implied prob (1/oᵢ).", misconception: "uniform_norm" },
    { value: fracToRounded(F(total).mul(F(odds[0])).div(F(oddsSum)), 2), feedback: "You sized proportional to the ODDS, not the implied probabilities. That over-stakes the longshots — the reverse of what locks equal payouts.", misconception: "stake_by_odds" },
    { value: fracToRounded(F(total).mul(impliedFromDecimal(odds[0])), 2), feedback: "You used total·(1/o₁) but forgot to divide by the booksum, so your stakes don't sum to the outlay.", misconception: "forgot_normalize" },
  ];
  const errors = dedupeErrors(raw, answer, 2);

  return {
    id: `arb-stake-${odds.join("-")}-${total}`,
    prompt: `A book offers decimal odds ${odds.join(", ")} on ${odds.length} mutually-exclusive outcomes. The booksum Σ(1/oᵢ) = ${P4(fracToRounded(bs, 4))} < 1, so backing all outcomes is a guaranteed profit. With a total outlay of ${$(total)}, how much should you stake on the FIRST outcome to lock an equal return whichever result lands?`,
    answer,
    decimals: 2,
    unit: "$",
    difficulty: "hard",
    concept: "Arbitrage stake sizing (proportional to implied prob)",
    explanation: `Size each stake ∝ its implied prob: stake₁ = ${$(total)} · (1/${odds[0]}) / ${P4(fracToRounded(bs, 4))} = ${$(answer)}. Every outcome then returns ${$(fracToRounded(guaranteedReturn(odds, total), 2))}, identical whichever result lands.`,
    commonErrors: errors,
    source: "Arbitrage stake sizing",
    family: "genArbStake",
  };
}

/**
 * The guaranteed arbitrage PROFIT on a total outlay,
 * total·(1 − booksum)/booksum.
 */
function genArbProfit(rng: Rng): NumericQuestion {
  const odds = drawArbBook(rng);
  const total = rng.pick([100, 200, 500, 1000] as const);
  const bs = booksum(odds);
  const profit = guaranteedProfit(odds, total);
  const answer = fracToRounded(profit, 2);
  const ret = guaranteedReturn(odds, total);

  const raw: RawErr[] = [
    { value: fracToRounded(ret, 2), feedback: "That is the total RETURN (total/booksum). Subtract the outlay you staked to get the profit.", misconception: "forgot_subtract_stake" },
    { value: fracToRounded(F(total).mul(F(1).sub(bs)), 2), feedback: "You used total·(1 − booksum) but forgot to divide by the booksum — the payout scales by 1/booksum.", misconception: "forgot_divide_booksum" },
    { value: fracToRounded(F(total).mul(F(1).div(bs).sub(1)).div(F(odds.length)), 2), feedback: "You divided the profit by the number of legs, as if only one bet paid out. In an arb ALL legs are backed and exactly one wins the common return.", misconception: "divide_profit_by_legs" },
  ];
  const errors = dedupeErrors(raw, answer, 2);

  return {
    id: `arb-profit-${odds.join("-")}-${total}`,
    prompt: `A Dutch-book has decimal odds ${odds.join(", ")} on ${odds.length} mutually-exclusive outcomes, booksum Σ(1/oᵢ) = ${P4(fracToRounded(bs, 4))} < 1. You back all outcomes with a total outlay of ${$(total)}, sized to return the same amount whichever wins. What is your GUARANTEED profit?`,
    answer,
    decimals: 2,
    unit: "$",
    difficulty: "expert",
    concept: "Guaranteed arbitrage profit",
    explanation: `Sized correctly, every outcome returns total/booksum = ${$(fracToRounded(ret, 2))}. Profit = return − outlay = ${$(fracToRounded(ret, 2))} − ${$(total)} = ${$(answer)} = ${$(total)}·(1 − ${P4(fracToRounded(bs, 4))})/${P4(fracToRounded(bs, 4))}.`,
    commonErrors: errors,
    source: "Arbitrage profit",
    family: "genArbProfit",
  };
}

/** Basket NAV: fair value = Σ qtyᵢ·priceᵢ (parts-vs-whole weighted sum). */
function genBasketNAV(rng: Rng): NumericQuestion {
  const k = rng.pick([2, 3] as const);
  const labels = rng.shuffle(["X", "Y", "Z", "W"]).slice(0, k);
  const legs: BasketLeg[] = labels.map((label) => ({
    label,
    qty: rng.int(2, 9),
    price: rng.int(5, 60),
  }));
  const nav = basketNAV(legs);
  const unweighted = unweightedSum(legs);
  const summedQty = legs.reduce((s, l) => s + l.qty, 0);
  const averaged = Math.round(nav / k);

  const raw: RawErr[] = [
    { value: unweighted, feedback: "You added the component PRICES without multiplying by the quantities held. A basket is a WEIGHTED sum.", misconception: "unweighted_basket" },
    { value: summedQty, feedback: "You summed the share counts instead of the dollar values.", misconception: "summed_weights" },
    { value: averaged, feedback: "You averaged the leg values instead of summing them — a basket is a total, not a mean.", misconception: "averaged_not_summed" },
  ];
  const errors = dedupeErrors(raw, nav, 0);

  const parts = legs.map((l) => `${l.qty}× ${l.label} @ $${l.price}`).join(", ");
  return {
    id: `arb-basket-${legs.map((l) => `${l.qty}x${l.price}`).join("-")}`,
    prompt: `A basket holds ${parts}. What is its fair value (NAV = the weighted sum of its parts)?`,
    answer: nav,
    unit: "$",
    difficulty: "medium",
    concept: "Basket NAV = Σ qty × price",
    explanation: `NAV = ${legs.map((l) => `${l.qty}×$${l.price}`).join(" + ")} = ${$(nav)}. Price the whole as the WEIGHTED sum of the parts (quantities matter).`,
    commonErrors: errors,
    source: "Basket / parts-vs-whole pricing",
    family: "genBasketNAV",
  };
}

/* ========================================================================== */
/*  QUIZ — Dutch-book detection, value-leg, basket direction                    */
/* ========================================================================== */

/** Curated FAIR books (booksum exactly 1) with terminating-decimal odds. */
const FAIR_BOOKS: string[][] = [
  ["2.00", "2.00"],
  ["1.50", "3.00"],
  ["1.25", "5.00"],
  ["1.20", "6.00"],
  ["3.00", "3.00", "3.00"],
  ["2.00", "4.00", "4.00"],
  ["2.00", "3.00", "6.00"],
  ["1.50", "6.00", "6.00"],
];

/**
 * Dutch-book DETECTION: classify a book from its booksum — arbitrage (< 1),
 * overround (> 1), or fair (= 1). The signature error is reading the inequality
 * backwards (`booksum_backwards`).
 */
function genArbDetect(rng: Rng): Question {
  const target = rng.pick(["arbitrage", "overround", "fair"] as const);
  let odds: string[];
  if (target === "fair") {
    odds = rng.pick(FAIR_BOOKS);
  } else if (target === "arbitrage") {
    odds = drawBook(rng, LONG_ODDS, [2, 3], (o) => booksum(o).compare(1) < 0, ["2.50", "2.50"]);
  } else {
    odds = drawBook(rng, DECIMAL_ODDS, [2, 3], (o) => booksum(o).compare(1) > 0, ["1.90", "1.90"]);
  }
  const state = bookState(odds);
  const bs = booksum(odds);
  const bsNum = fracToRounded(bs, 4);

  const ARB = "Arbitrage — back all outcomes for a guaranteed profit";
  const OVER = "Overround — the bookmaker's margin; no arbitrage for the bettor";
  const FAIR = "Fair book — the implied probabilities already sum to 1";
  const ARB_FAV = "Arbitrage — but only by backing the single favorite";
  const STATE_TEXT: Record<string, string> = { arbitrage: ARB, overround: OVER, fair: FAIR };
  const correct = STATE_TEXT[state];

  const others = (["arbitrage", "overround", "fair"] as const)
    .filter((s) => s !== state)
    .map((s) => STATE_TEXT[s]);
  const distractors = [...others, ARB_FAV];

  const misconceptionByValue: Record<string, string> = { [ARB_FAV]: "single_leg_not_arb" };
  if (others.includes(ARB)) misconceptionByValue[ARB] = "booksum_backwards";
  if (others.includes(OVER)) misconceptionByValue[OVER] = "booksum_backwards";
  if (others.includes(FAIR)) misconceptionByValue[FAIR] = "assume_fair_book";

  const distractorRationaleByValue: Record<string, string> = {
    [ARB_FAV]: "Backing a single leg is a directional bet, not a locked-in arbitrage — an arb backs EVERY outcome.",
    [ARB]: "Read the booksum backwards — arbitrage needs booksum < 1; a booksum > 1 is the bookmaker's edge.",
    [OVER]: "Read the booksum backwards — an overround needs booksum > 1; this book's booksum is below 1.",
    [FAIR]: "A fair book has booksum exactly 1; this one does not.",
  };

  return assemble(rng, {
    id: `arb-detect-${odds.join("-")}`,
    prompt: `A book posts decimal odds ${odds.join(", ")} on ${odds.length} mutually-exclusive, exhaustive outcomes. The booksum Σ(1/oᵢ) = ${P4(bsNum)}. What does this book represent?`,
    correct,
    distractors,
    explanation: `Σ(1/oᵢ) = ${P4(bsNum)}. ${
      state === "arbitrage"
        ? "Below 1 ⇒ a Dutch book: staking proportionally on every outcome guarantees a profit."
        : state === "overround"
          ? "Above 1 ⇒ the overround is the bookmaker's edge; there is no arbitrage for the bettor."
          : "Exactly 1 ⇒ the implied probabilities already sum to 1: a fair book (no vig, no arb)."
    } Rule: booksum < 1 ⇒ arbitrage, > 1 ⇒ overround, = 1 ⇒ fair.`,
    difficulty: "medium",
    concept: "Dutch-book detection from the booksum",
    distractorRationaleByValue,
    misconceptionByValue,
    source: "Dutch-book / overround detection",
  });
}

/**
 * VALUE-leg selection: given your model's TRUE probabilities and the book's
 * quoted odds, pick the positive-EV bet (pᵢ·oᵢ > 1). The trap is backing the
 * book's favorite (`wrong_arb_direction`) — the short-odds leg is where the book
 * is confident, not where the value is.
 */
function genValueLeg(rng: Rng): Question {
  let probs: number[] = [50, 30, 20];
  let odds: string[] = ["1.80", "2.50", "6.00"];
  for (let tries = 0; tries < 200; tries++) {
    const a = rng.int(15, 60);
    const b = rng.int(15, 80 - a);
    const c = 100 - a - b;
    if (c < 10) continue;
    const p = [a, b, c];
    const o = Array.from({ length: 3 }, () => rng.pick(DECIMAL_ODDS));
    const pf = p.map((x) => F(x, 100));
    const positives = o.filter((oi, i) => betEV(pf[i], oi).compare(0) > 0).length;
    if (positives !== 1) continue;
    const vIdx = valueBetIndex(pf, o);
    if (vIdx === favoriteIndex(o)) continue; // keep the "favorite" a genuine trap
    probs = p;
    odds = o;
    break;
  }

  const pf = probs.map((x) => F(x, 100));
  const vIdx = valueBetIndex(pf, odds);
  const favIdx = favoriteIndex(odds);
  const otherIdx = [0, 1, 2].find((i) => i !== vIdx && i !== favIdx)!;

  const legText = OUTCOMES3.map(
    (name, i) => `${name} — true ${probs[i]}%, odds ${odds[i]}`,
  ).join("; ");
  const bet = (i: number) => `Bet ${OUTCOMES3[i]}`;
  const NONE = "None — no outcome offers positive expected value";
  const correct = bet(vIdx);
  const ev = betEV(pf[vIdx], odds[vIdx]);

  return assemble(rng, {
    id: `arb-value-${probs.join("")}-${odds.join("-")}`,
    prompt: `Your model's true probabilities and the book's decimal odds: ${legText}. Which is the VALUE bet (positive expected value, p·o > 1)?`,
    correct,
    distractors: [bet(favIdx), bet(otherIdx), NONE],
    explanation: `EV per $1 = p·o − 1. ${OUTCOMES3[vIdx]}: ${probs[vIdx]}%·${odds[vIdx]} = ${P4(fracToRounded(pf[vIdx].mul(F(odds[vIdx])), 4))} ⇒ EV ${fracToRounded(ev, 4) >= 0 ? "+" : ""}${P4(fracToRounded(ev, 4))} (> 0). The book's favorite (${OUTCOMES3[favIdx]}, shortest odds) has p·o < 1 — short odds mark the book's confidence, not your edge.`,
    difficulty: "hard",
    concept: "Value bet = positive EV (model prob × quoted odds)",
    distractorRationaleByValue: {
      [bet(favIdx)]: "You backed the book's FAVORITE (shortest odds). Low odds mean the book already prices it as likely — p·o < 1, so it's the wrong side.",
      [bet(otherIdx)]: "This leg's p·o is below 1 too — it doesn't clear the break-even bar.",
      [NONE]: "There IS a positive-EV leg — one outcome's p·o exceeds 1.",
    },
    misconceptionByValue: {
      [bet(favIdx)]: "wrong_arb_direction",
      [bet(otherIdx)]: "ignored_ev",
      [NONE]: "missed_value",
    },
    source: "Value bet / mispriced-leg detection",
  });
}

/** Basket-vs-parts DIRECTION: which side to trade when a basket ≠ its NAV. */
function genBasketArb(rng: Rng): Question {
  const k = rng.pick([2, 3] as const);
  const labels = rng.shuffle(["X", "Y", "Z", "W"]).slice(0, k);
  const legs: BasketLeg[] = labels.map((label) => ({ label, qty: rng.int(2, 6), price: rng.int(8, 40) }));
  const nav = basketNAV(legs);
  const delta = rng.pick([-8, -6, -5, -4, -3, 3, 4, 5, 6, 8] as const);
  const price = nav + delta;
  const rich = delta > 0; // basket price above NAV ⇒ basket is expensive

  const SELL = "Sell the basket, buy the components";
  const BUY = "Buy the basket, sell the components";
  const NONE = "No arbitrage — the basket is fairly priced";
  const UNWEIGHTED = "Fairly priced — the component prices already add up to the basket (no need to weight by quantity)";
  const correct = rich ? SELL : BUY;

  return assemble(rng, {
    id: `arb-basketdir-${nav}-${price}`,
    prompt: `A basket of ${legs.map((l) => `${l.qty}× ${l.label} @ $${l.price}`).join(", ")} has NAV ${$(nav)}. The basket itself trades at ${$(price)}. What is the arbitrage?`,
    correct,
    distractors: [rich ? BUY : SELL, NONE, UNWEIGHTED],
    explanation: `NAV = Σ qty×price = ${$(nav)}; the basket trades at ${$(price)}. ${
      rich
        ? "It is RICH (above NAV): SELL the basket and BUY the cheaper parts"
        : "It is CHEAP (below NAV): BUY the basket and SELL the richer parts"
    }, capturing the ${$(Math.abs(delta))} gap.`,
    difficulty: "hard",
    concept: "Basket-vs-parts (NAV) arbitrage direction",
    distractorRationaleByValue: {
      [rich ? BUY : SELL]: "Wrong direction — you'd buy the expensive leg and sell the cheap one, locking a loss.",
      [NONE]: "Price ≠ NAV, so there IS a mispricing to capture.",
      [UNWEIGHTED]: "That compares the UNWEIGHTED price sum to the basket. NAV must weight each price by its quantity — the parts don't add up to NAV without the quantities.",
    },
    misconceptionByValue: {
      [rich ? BUY : SELL]: "wrong_arb_direction",
      [NONE]: "no_arb_when_mispriced",
      [UNWEIGHTED]: "unweighted_basket",
    },
    source: "Basket / parts-vs-whole arbitrage direction",
  });
}

/* ========================================================================== */
/*  Registries                                                                  */
/* ========================================================================== */

export const ARBITRAGE_QUIZ_GENERATORS: Record<string, QuestionGenerator> = {
  genArbDetect,
  genValueLeg,
  genBasketArb,
};

export const ARBITRAGE_NUMERIC_GENERATORS: Record<string, NumericQuestionGenerator> = {
  genImpliedProb,
  genDeVigFair,
  genArbStake,
  genArbProfit,
  genBasketNAV,
};
