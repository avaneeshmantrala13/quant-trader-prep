import type { Rng } from "@/lib/rng";
import type {
  Flashcard,
  NumericQuestion,
  NumericQuestionGenerator,
  Question,
  QuestionGenerator,
} from "@/types/content";
import { assemble, assembleDistinct, fmt } from "../shared";
import { mixQuestionGenerators, mixNumericGenerators } from "../mixFamilies";
import {
  F,
  adverseSelectionEV,
  basketNAV,
  booksum,
  deVigFairProb,
  fracToRounded,
  hasArbitrage,
  impliedFromDecimal,
  nextCardFairPrice,
  nextHitProb,
  signedDollar,
  type BasketLeg,
} from "./tradingSolvers";

/**
 * Dataset-1 "trading game" generators (Make-a-Market, Cards/ETF/Fruit basket
 * pricing, Next-Card betting, Marble-Olympics vig removal, Fermi estimation).
 * Every answer is re-derived by an EXACT rational solver in `tradingSolvers.ts`;
 * distractors encode NAMED misconceptions (see the `misconceptionByValue` tags),
 * never random numbers. Answer routing follows the dataset's rule:
 *   scalar $/probability      → numeric free-entry,
 *   decision / arbitrage side → multiple-choice quiz,
 *   estimation / procedure    → integrity flashcard (no MC).
 */

const P4 = (x: number) => fmt(x, 4);
const $ = (n: number) => `$${fmt(n)}`;

const FRUITS = ["apples", "bananas", "cherries", "dates", "figs", "grapes"];
const TICKERS = ["A", "B", "C", "D"];
const DECIMAL_ODDS = ["1.50", "1.80", "1.90", "2.00", "2.10", "2.20", "2.50", "2.75", "3.00", "4.00"];

/* ========================================================================== */
/*  NUMERIC, scalar $ / probability answers                                   */
/* ========================================================================== */

/** Basket / ETF NAV: fair value = Σ qtyᵢ·priceᵢ (exact integer). */
function genBasketNAV(rng: Rng): NumericQuestion {
  const k = rng.pick([2, 3] as const);
  const names = rng.shuffle(FRUITS).slice(0, k);
  const legs: BasketLeg[] = names.map((label) => ({
    label,
    qty: rng.int(1, 9),
    price: rng.int(5, 60),
  }));
  const nav = basketNAV(legs);
  const unweighted = legs.reduce((s, l) => s + l.price, 0);
  const summedQty = legs.reduce((s, l) => s + l.qty, 0);
  const averaged = Math.round(nav / k);

  const errors = dedupeErrors(
    [
      { value: unweighted, feedback: "Added the prices without multiplying by the quantities held.", misconception: "unweighted_sum" },
      { value: summedQty, feedback: "Summed the share counts instead of the dollar values.", misconception: "summed_weights" },
      { value: averaged, feedback: "Averaged the leg values instead of summing them (a basket is a total, not a mean).", misconception: "averaged_not_summed" },
    ],
    nav,
    0,
  );

  const parts = legs
    .map((l) => `${l.qty} unit${l.qty === 1 ? "" : "s"} of ${l.label} at $${l.price}`)
    .join(", ");
  return {
    id: `ig-basket-${legs.map((l) => `${l.qty}x${l.price}`).join("-")}`,
    prompt: `A basket (think ETF or fruit stand) holds ${parts}. What is its fair value (NAV)?`,
    answer: nav,
    unit: "$",
    difficulty: "medium",
    concept: "Basket / ETF NAV = weighted sum",
    explanation: `NAV = ${legs.map((l) => `${l.qty}×$${l.price}`).join(" + ")} = ${$(nav)}. A basket is priced as the weighted SUM of its components.`,
    commonErrors: errors,
    source: "Basket / ETF NAV pricing (Fruit / ETF Challenge)",
    family: "genBasketNAV",
  };
}

/** Next-Card betting: fair probability the next draw is a hit (conditional). */
function genNextCardFairProb(rng: Rng): NumericQuestion {
  const hits = rng.int(3, 24);
  const miss = rng.int(3, 24);
  const p = nextHitProb(hits, miss);
  const answer = fracToRounded(p, 4);

  const raw = [
    { value: 0.5, feedback: "Used the full-deck probability (½), ignoring the cards already removed.", misconception: "unconditioned_half" },
    { value: fracToRounded(F(miss, hits + miss), 4), feedback: "Counted the unfavorable cards in the numerator (color inverted).", misconception: "color_inversion" },
    { value: fracToRounded(F(hits, hits + miss - 1), 4), feedback: "Removed the next card from the denominator too early (off-by-one on remaining).", misconception: "miscount_remaining" },
  ];
  const errors = dedupeErrors(raw, answer, 4);

  return {
    id: `ig-nextcard-${hits}-${miss}`,
    prompt: `A shuffled deck currently has ${hits} red and ${miss} black cards remaining. You may bet on the color of the next card drawn. What is the fair (arbitrage-free) probability it is RED?`,
    answer,
    decimals: 4,
    difficulty: "hard",
    concept: "Sequential conditional probability (card counting)",
    explanation: `With ${hits} red of ${hits + miss} cards left, P(next red) = ${hits}/${hits + miss} = ${P4(answer)}. As cards leave the deck the fair probability UPDATES, it is not the original ½.`,
    commonErrors: errors,
    source: "Next-Card betting (GetCracked sequential probability)",
    family: "genNextCardFairProb",
  };
}

/** Vig / overround: de-vigged fair probability of the first leg. */
function genDeVig(rng: Rng): NumericQuestion {
  // Draw a book with a genuine overround (booksum > 1) so de-vigging matters.
  let odds: string[] = [];
  for (let tries = 0; tries < 40; tries++) {
    const k = rng.pick([2, 3] as const);
    odds = Array.from({ length: k }, () => rng.pick(DECIMAL_ODDS));
    if (booksum(odds).valueOf() > 1) break;
  }
  const bs = booksum(odds);
  const fair = deVigFairProb(odds, 0);
  const answer = fracToRounded(fair, 4);

  const raw = [
    { value: fracToRounded(impliedFromDecimal(odds[0]), 4), feedback: "Used the raw implied probability 1/o without removing the overround.", misconception: "ignore_overround" },
    { value: fracToRounded(F(1, odds.length), 4), feedback: "Assumed the outcomes were equally likely (uniform), ignoring the odds.", misconception: "uniform_norm" },
    { value: fracToRounded(impliedFromDecimal(odds[0]).div(F(odds.reduce((s, o) => s + Number(o), 0))), 4), feedback: "Normalized by the sum of the ODDS instead of the sum of implied probabilities.", misconception: "normalize_by_odds" },
  ];
  const errors = dedupeErrors(raw, answer, 4);

  return {
    id: `ig-devig-${odds.join("-")}`,
    prompt: `A sportsbook posts decimal odds ${odds.join(", ")} on the ${odds.length} possible results, exactly one of which happens. Booksum = ${P4(fracToRounded(bs, 4))} (> 1 ⇒ overround). Strip the vig: what is the fair probability of the FIRST result?`,
    answer,
    decimals: 4,
    difficulty: "hard",
    concept: "Removing the vig (overround → fair probabilities)",
    explanation: `Raw implied probs are 1/oᵢ; they sum to ${P4(fracToRounded(bs, 4))} (the overround). Normalize: fair = (1/${odds[0]}) / ${P4(fracToRounded(bs, 4))} = ${P4(answer)}.`,
    commonErrors: errors,
    source: "Vig / overround removal (Heard on the Street / Marble Olympics)",
    family: "genDeVig",
  };
}

/** Drop distractors equal to the answer (at grading precision) or to each other. */
function dedupeErrors(
  raw: { value: number; feedback: string; misconception: string }[],
  answer: number,
  dp: number,
): { value: number; feedback: string; misconception: string }[] {
  const f = 10 ** dp;
  const key = (v: number) => Math.round(v * f);
  const seen = new Set<number>([key(answer)]);
  const out: typeof raw = [];
  for (const e of raw) {
    if (!Number.isFinite(e.value) || e.value < 0) continue;
    const k = key(e.value);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(e);
  }
  return out;
}

/* ========================================================================== */
/*  QUIZ, decision / arbitrage-side answers                                   */
/* ========================================================================== */

/** ETF-vs-NAV arbitrage: which side to trade when price ≠ fair value. */
function genBasketArb(rng: Rng): Question {
  const k = rng.pick([2, 3] as const);
  const names = rng.shuffle(TICKERS).slice(0, k);
  const legs: BasketLeg[] = names.map((label) => ({ label, qty: rng.int(1, 6), price: rng.int(8, 40) }));
  const nav = basketNAV(legs);
  const delta = rng.pick([-8, -6, -5, -4, -3, 3, 4, 5, 6, 8] as const);
  const price = nav + delta;
  const rich = delta > 0; // ETF price above NAV ⇒ ETF is expensive

  const BUY_ETF = "Buy the ETF, sell the basket of components";
  const SELL_ETF = "Sell the ETF, buy the basket of components";
  const NONE = "No arbitrage, the ETF is fairly priced";
  const BOTH = "Buy both the ETF and the basket";
  const correct = rich ? SELL_ETF : BUY_ETF;

  return assemble(rng, {
    id: `ig-basketarb-${nav}-${price}`,
    prompt: `A basket of components is worth ${$(nav)} (NAV). The ETF that holds them trades at ${$(price)}. What is the arbitrage?`,
    correct,
    distractors: [rich ? BUY_ETF : SELL_ETF, NONE, BOTH],
    explanation: `NAV = ${$(nav)}, ETF = ${$(price)}. ${rich ? "The ETF is RICH (above NAV): sell the ETF and buy the cheaper basket" : "The ETF is CHEAP (below NAV): buy the ETF and sell the richer basket"}, capturing the ${$(Math.abs(delta))} gap.`,
    difficulty: "hard",
    concept: "ETF-vs-NAV (creation/redemption) arbitrage",
    distractorRationaleByValue: {
      [rich ? BUY_ETF : SELL_ETF]: "Traded the wrong direction, you'd be buying the expensive leg and selling the cheap one (locking in a loss).",
      [NONE]: "Price ≠ NAV, so there IS a mispricing to capture.",
      [BOTH]: "Buying both legs is not a hedge, it just doubles directional risk with no locked-in edge.",
    },
    misconceptionByValue: {
      [rich ? BUY_ETF : SELL_ETF]: "wrong_arb_direction",
      [NONE]: "no_arb_when_mispriced",
      [BOTH]: "buy_both_no_hedge",
    },
    source: "ETF/NAV arbitrage (ETF Challenge)",
  });
}

/** Dutch-book detection: does the quoted book admit a guaranteed profit? */
function genVigArb(rng: Rng): Question {
  const k = rng.pick([2, 3] as const);
  const odds = Array.from({ length: k }, () => rng.pick(DECIMAL_ODDS));
  const bs = booksum(odds);
  const arb = hasArbitrage(odds);

  const ARB_ALL = "Arbitrage exists, back all outcomes for a guaranteed profit";
  const NO_ARB = "No arbitrage, the overround favors the bookmaker";
  const ARB_FAV = "Arbitrage exists, back only the favorite";
  const FAIR = "No arbitrage, the odds are perfectly fair";
  const correct = arb ? ARB_ALL : NO_ARB;

  return assemble(rng, {
    id: `ig-vigarb-${odds.join("-")}`,
    prompt: `A sportsbook posts decimal odds ${odds.join(", ")} on the ${k} possible results, exactly one of which happens. Booksum Σ(1/oᵢ) = ${P4(fracToRounded(bs, 4))}. Is there an arbitrage?`,
    correct,
    distractors: [arb ? NO_ARB : ARB_ALL, ARB_FAV, FAIR],
    explanation: `Σ(1/oᵢ) = ${P4(fracToRounded(bs, 4))}. ${arb ? "Because the booksum is BELOW 1, staking proportionally on every outcome guarantees a profit (a Dutch book)." : "Because the booksum is ABOVE 1, the overround is the bookmaker's edge, no arbitrage for the bettor."}`,
    difficulty: "hard",
    concept: "Dutch-book / overround arbitrage detection",
    distractorRationaleByValue: {
      [arb ? NO_ARB : ARB_ALL]: "Read the booksum backwards, arbitrage requires booksum < 1, a bookmaker edge means booksum > 1.",
      [ARB_FAV]: "Backing a single leg is a directional bet, not a locked-in arbitrage.",
      [FAIR]: "A fair book has booksum exactly 1; this one does not.",
    },
    misconceptionByValue: {
      [arb ? NO_ARB : ARB_ALL]: "booksum_backwards",
      [ARB_FAV]: "single_leg_not_arb",
      [FAIR]: "assume_fair_book",
    },
    source: "Vig / Dutch-book arbitrage (Marble Olympics winner markets)",
  });
}

/** Next-Card bet/pass decision given a quoted ticket price. */
function genNextCardBet(rng: Rng): Question {
  const hits = rng.int(4, 20);
  const miss = rng.int(4, 20);
  const payout = 100;
  const fair = nextCardFairPrice(hits, miss, payout).valueOf();
  const buy = rng.chance(0.5);
  // Set an integer price strictly on the chosen side of fair value.
  const gap = rng.int(4, 12);
  let price = buy ? Math.floor(fair) - gap : Math.ceil(fair) + gap;
  price = Math.max(2, Math.min(98, price));
  const reallyBuy = price < fair;

  const BUY = "Buy the ticket, it is cheap versus fair value";
  const SELL = "Sell / decline, it is expensive versus fair value";
  const INDIFF = "Indifferent, the price equals fair value";
  const OPP = "Buy the black (opposite) ticket at this price instead";
  const correct = reallyBuy ? BUY : SELL;

  return assemble(rng, {
    id: `ig-ncbet-${hits}-${miss}-${price}`,
    prompt: `${hits} red and ${miss} black cards remain. A ticket pays $${payout} if the next card is RED, offered at $${price}. What should you do?`,
    correct,
    distractors: [reallyBuy ? SELL : BUY, INDIFF, OPP],
    explanation: `Fair value = $${payout}·${hits}/${hits + miss} = ${$(Number(fair.toFixed(2)))}. At $${price} the ticket is ${reallyBuy ? "CHEAP → buy it" : "EXPENSIVE → sell/decline"} (edge ${signedDollar(fair - price)} per ticket if you buy).`,
    difficulty: "medium",
    concept: "Fair pricing & +EV decision on a sequential bet",
    distractorRationaleByValue: {
      [reallyBuy ? SELL : BUY]: "Compared to ½ (the full-deck probability) instead of the conditional fair value, flipping the decision.",
      [INDIFF]: "The quoted price is strictly off fair value, so there is a real edge.",
      [OPP]: "The black ticket's fair value is $100·black/total; buying it here does not fix the mispricing on the red ticket.",
    },
    misconceptionByValue: {
      [reallyBuy ? SELL : BUY]: "unconditioned_half",
      [INDIFF]: "no_edge_when_mispriced",
      [OPP]: "wrong_ticket",
    },
    source: "Next-Card betting decision (GetCracked)",
  });
}

/** Make-a-Market: expected adverse-selection P&L of a two-sided quote. */
function genMakeMarketPnl(rng: Rng): Question {
  return assembleDistinct(rng, (r) => {
    const N = r.pick([6, 8, 10, 12] as const);
    const bid = r.int(2, N - 3);
    const ask = r.int(bid + 2, N - 1);
    const ev = adverseSelectionEV(N, bid, ask);
    const evNum = ev.valueOf();
    const rawSum = ev.mul(N).valueOf();
    // One-side-only: count just the "sold at bid" adverse fills.
    let oneSide = 0;
    for (let V = 1; V < bid; V++) oneSide += V - bid;
    const oneSideEV = oneSide / N;

    const correct = signedDollar(evNum);
    return {
      id: `ig-mmpnl-${N}-${bid}-${ask}`,
      prompt: `A value is uniform on {1,…,${N}}. You post bid ${bid} / ask ${ask}. An INFORMED trader sells to you at ${bid} whenever the value is below ${bid}, and buys from you at ${ask} whenever it is above ${ask}. What is your expected P&L per round?`,
      correct,
      distractors: [signedDollar(0), signedDollar(-evNum), signedDollar(rawSum), signedDollar(oneSideEV)],
      explanation: `You only trade when it's bad: sell-at-${bid} for V<${bid} (P&L V−${bid}) and buy-at-${ask} for V>${ask} (P&L ${ask}−V). Summing and dividing by ${N} gives ${correct}. Adverse selection makes a symmetric quote lose in expectation.`,
      difficulty: "expert",
      concept: "Adverse-selection expected P&L",
      distractorRationaleByValue: {
        [signedDollar(0)]: "Assumed a symmetric market breaks even, but you only get filled by the informed side.",
        [signedDollar(-evNum)]: "Sign error: adverse selection is a LOSS, not a gain.",
        [signedDollar(rawSum)]: "Forgot to divide the summed P&L by the number of equally-likely values.",
        [signedDollar(oneSideEV)]: "Counted only the sell-side fills, ignoring the buy-side pick-offs.",
      },
      misconceptionByValue: {
        [signedDollar(0)]: "ignore_adverse_selection",
        [signedDollar(-evNum)]: "sign_error",
        [signedDollar(rawSum)]: "forgot_normalize",
        [signedDollar(oneSideEV)]: "one_side_only",
      },
      source: "Make-a-Market adverse-selection P&L (Green Book)",
    };
  });
}

/** Fermi estimation: order-of-magnitude of a decomposed product. */
function genFermiMagnitude(rng: Rng): Question {
  return assembleDistinct(rng, (r) => {
    const A = r.pick([2, 3, 4, 5, 6, 8] as const) * 10 ** r.int(1, 3);
    const B = r.pick([2, 3, 4, 5, 6, 8] as const) * 10 ** r.int(1, 2);
    const C = r.int(2, 9);
    const prod = A * B * C;
    const correct = fmt(prod);
    return {
      id: `ig-fermi-${A}-${B}-${C}`,
      prompt: `A Fermi estimate decomposes a quantity as roughly ${fmt(A)} × ${fmt(B)} × ${C}. About how large is it?`,
      correct,
      distractors: [fmt(prod * 10), fmt(Math.round(prod / 10)), fmt(A + B + C)],
      explanation: `${fmt(A)} × ${fmt(B)} × ${C} = ${correct}. Fermi estimation multiplies the factors; the classic error is a wrong power of ten (or adding instead of multiplying).`,
      difficulty: "medium",
      concept: "Fermi decomposition / order of magnitude",
      distractorRationaleByValue: {
        [fmt(prod * 10)]: "One power of ten too high (a place-value slip upward).",
        [fmt(Math.round(prod / 10))]: "One power of ten too low (a place-value slip downward).",
        [fmt(A + B + C)]: "Added the factors instead of multiplying them.",
      },
      misconceptionByValue: {
        [fmt(prod * 10)]: "off_by_order_high",
        [fmt(Math.round(prod / 10))]: "off_by_order_low",
        [fmt(A + B + C)]: "added_not_multiplied",
      },
      source: "Fermi order-of-magnitude estimation",
    };
  });
}

/* ========================================================================== */
/*  Fermi flashcards, integrity-based reasoning (no MC)                        */
/* ========================================================================== */

export const FERMI_FLASHCARDS: Flashcard[] = [
  {
    id: "ig-fermi-piano-tuners",
    prompt:
      "A market-maker asks you to guesstimate how many working piano tuners serve the Denver metro area. Walk through your decomposition.",
    answer: "≈ 50–150 tuners.",
    explanation:
      "Decompose: ~3M people ÷ ~2.5 per household ≈ 1.2M households; ~1 in 20 keeps a piano ⇒ ~60k pianos; each tuned ~once a year ⇒ ~60k tunings. One tuner handles ~4 tunings/day × ~250 working days ≈ 1,000/year ⇒ ~60 tuners, rounding up to ~50–150 once schools and concert halls are included. The METHOD (population → pianos → tunings ÷ throughput) matters more than the exact count.",
    difficulty: "medium",
    concept: "Fermi decomposition",
    source: "Classic Fermi estimation (piano tuners)",
  },
  {
    id: "ig-fermi-golf-balls-747",
    prompt:
      "Roughly how many golf balls could you pack into the passenger cabin of a Boeing 747? Reason it out by decomposition.",
    answer: "≈ 10 million.",
    explanation:
      "Cabin volume ~ a cylinder ~60 m long × ~3 m radius ⇒ ~1,700 m³ ≈ 1.7×10⁹ cm³. A golf ball ~4 cm across occupies ~64 cm³ in its bounding cube; with ~65% sphere packing usable, ~100 cm³ effective ⇒ ~1.7×10⁷. Round to ~10⁷. Key skill: volume ratio × a packing-efficiency haircut.",
    difficulty: "medium",
    concept: "Volume-ratio Fermi estimate",
    source: "Classic Fermi estimation (golf balls in a 747)",
  },
  {
    id: "ig-fermi-gas-stations-us",
    prompt: "Estimate the number of gas stations in the United States.",
    answer: "≈ 100,000–150,000.",
    explanation:
      "~330M people ⇒ ~250M cars; each visits a station ~weekly ⇒ ~250M fills/week. A station serves maybe ~10 cars/hour × ~16 hours × 7 days ≈ ~1,000/week ⇒ ~250k. Haircut for higher-throughput highway stations ⇒ ~100–150k (the true figure is ~120k). Skill: demand ÷ per-unit throughput.",
    difficulty: "medium",
    concept: "Demand ÷ throughput Fermi estimate",
    source: "Classic Fermi estimation (US gas stations)",
  },
  {
    id: "ig-fermi-market-width",
    prompt:
      "You must make a two-sided market on the weight (in kg) of a full-grown male African elephant, which you don't know exactly. How wide should your market be, and why?",
    answer: "A wide market (e.g. bid 4,000 / ask 8,000 kg) centered near ~6,000 kg.",
    explanation:
      "Fair value ~6,000 kg (males run 5,000–7,000 kg). Because your uncertainty is large and an informed counterparty will pick you off on whichever side is wrong, your SPREAD must scale with your uncertainty, quote wide when unsure, then tighten as you learn. A tight market on a fact you don't know is how you get run over.",
    difficulty: "hard",
    concept: "Spread ∝ uncertainty (Make-a-Market)",
    source: "Make-Me-a-Market (facts + guesstimates)",
  },
  {
    id: "ig-fermi-value-of-information",
    prompt:
      "In a card market-making game you may pay $2 to privately see one hidden card before quoting. When is buying that information worth it?",
    answer: "Buy it iff the expected reduction in adverse-selection loss exceeds $2.",
    explanation:
      "Information is worth its expected value: seeing the card sharpens your fair value, letting you quote tighter and lose less to informed flow (or trade with edge). If the expected improvement in P&L from the sharper estimate exceeds the $2 cost, pay it; otherwise pass. This is the value-of-information principle behind the taker/maker card games.",
    difficulty: "hard",
    concept: "Value of information",
    source: "Cards Market Making, value of information",
  },
];

/* ========================================================================== */
/*  Registries + mix helpers                                                   */
/* ========================================================================== */

export const TRADING_QUIZ_GENERATORS: Record<string, QuestionGenerator> = {
  genBasketArb,
  genVigArb,
  genNextCardBet,
  genMakeMarketPnl,
  genFermiMagnitude,
};

export const TRADING_NUMERIC_GENERATORS: Record<string, NumericQuestionGenerator> = {
  genBasketNAV,
  genNextCardFairProb,
  genDeVig,
};

export const mixTradingQuiz = (pool: QuestionGenerator[]): QuestionGenerator =>
  mixQuestionGenerators(pool);

export const mixTradingNumeric = (
  pool: NumericQuestionGenerator[],
): NumericQuestionGenerator => mixNumericGenerators(pool);
