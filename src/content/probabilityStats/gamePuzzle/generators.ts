import type { Rng } from "@/lib/rng";
import type {
  Difficulty,
  Flashcard,
  NumericQuestion,
  NumericQuestionGenerator,
} from "@/types/content";
import {
  F,
  decText,
  fracText,
  impliedProbabilitySum,
  rigBagsClosedForm,
} from "./puzzles";
import type FractionType from "fraction.js";
import { mixNumericGenerators } from "../../mixFamilies";

/**
 * Parametric generators + misconception taxonomy for the Game Puzzle
 * subcategory.
 *
 * Mode per family:
 *   • Rig the Bags (probability optimization) → `numeric` (exact P(win)).
 *   • Arbitrage detection (implied-probability sum) → `numeric` (the ONE
 *     verifiable scalar in the otherwise open-ended arbitrage family).
 *   • Arbitrage construction, value betting, parimutuel → `flashcard`
 *     (open-ended: the answer is a strategy + representative book, with the
 *     source firms preserved as metadata).
 *
 * All ground truth is exact (`fraction.js`); none of the 4 source-dataset
 * questions are user-facing (they live only in `./gamePuzzle.test.ts`).
 */

const DP = 2;

function roundedErrorPusher(
  answerRounded2dp: number,
): {
  errors: { value: number; feedback: string }[];
  push: (raw: FractionType | number, feedback: string) => void;
} {
  const f = 10 ** DP;
  const key = Math.round(answerRounded2dp * f);
  const errors: { value: number; feedback: string }[] = [];
  const seen = new Set<number>([key]);
  const push = (raw: FractionType | number, feedback: string) => {
    const v = typeof raw === "number" ? raw : raw.valueOf();
    const rounded = Math.round(v * f) / f;
    const k = Math.round(rounded * f);
    if (!Number.isFinite(rounded) || seen.has(k)) return;
    seen.add(k);
    errors.push({ value: rounded, feedback });
  };
  return { errors, push };
}

/* ========================================================================== */
/*  FAMILY 1. Rig the Bags (probability optimization)  (numeric)             */
/* ========================================================================== */

// NOTE: deliberately avoids the source GP4 "Rig the Bags" framing (TV game show
// / gold / black tokens) so no user-facing item echoes that named scenario.
const BAG_SCENARIOS: { host: string; prize: string; good: string; bad: string }[] =
  [
    { host: "an office holiday raffle", prize: "the headline prize", good: "silver", bad: "charcoal" },
    { host: "a trading-floor raffle", prize: "the bonus pool", good: "green", bad: "red" },
    { host: "a carnival stall", prize: "the jackpot", good: "white", bad: "blue" },
  ];

export interface RigBagsInstance {
  gold: number;
  black: number;
  pWin: number;
  numeric: NumericQuestion;
}

export function buildRigBagsInstance(
  rng: Rng,
  difficulty: Difficulty,
): RigBagsInstance {
  // Keep 26 tokens total (gold + black) so the optimum P = ½ + (gold−1)/50 is a
  // clean 2-dp terminating decimal; vary the gold/black split for variety.
  // Exclude gold = 13: the source GP4 uses the 13/13 split (answer 0.74), which
  // we must not reproduce, every other split gives a different answer.
  const gold = rng.pick([6, 8, 11, 16, 21]);
  const black = 26 - gold;
  const p = rigBagsClosedForm(gold, black); // exact optimum via the lone-gold trick
  const answer = Number(decText(p, DP));
  const sc = rng.pick(BAG_SCENARIOS);

  const { errors, push } = roundedErrorPusher(answer);
  push(
    F(1, 2),
    "That's the mirror split (or full separation), both give a coin flip. The trick is to isolate ONE winning token in its own bag so that bag wins with certainty.",
  );
  push(
    F(gold, gold + black),
    `You reported the overall ${sc.good}-fraction (${gold}/${gold + black}). But you get to RIG the bags, the whole point is to beat the raw fraction.`,
  );
  push(
    F(gold - 1, gold + black - 1),
    "You computed only the second bag's winning fraction and forgot the ½·1 contribution from the lone-winning-token bag. P = ½·1 + ½·f₂.",
  );
  push(
    F(gold, 2 * (gold + black - 1)),
    `You isolated a LOSING token instead of a winning one, that's the worst split, giving ½·0 + ½·(${gold}/${gold + black - 1}).`,
  );

  const prompt =
    `On ${sc.host}, you have ${gold} ${sc.good} and ${black} ${sc.bad} tokens and two identical bags. ` +
    `You may distribute all ${gold + black} tokens between the bags however you like (each bag ≥ 1 token). ` +
    `A bag is picked at random, then one token is drawn at random from it; a ${sc.good} token wins ${sc.prize}. ` +
    `If you distribute optimally, what is your probability of winning? (Round to ${DP} decimals.)`;

  const explanation =
    `Law of total probability: P(win) = ½·f₁ + ½·f₂, the average of the two bags' ${sc.good}-fractions. ` +
    `To maximize, put exactly ONE ${sc.good} token alone in bag 1 (f₁ = 1) and everything else, ` +
    `${gold - 1} ${sc.good} + ${black} ${sc.bad} = ${gold + black - 1} tokens, in bag 2 (f₂ = ${gold - 1}/${gold + black - 1}). ` +
    `Then P(win) = ½·1 + ½·(${gold - 1}/${gold + black - 1}) = ${fracText(p)} ≈ ${decText(p, DP)}. ` +
    `Half the time you grab the sure-win bag; the other half you still win almost half the time.`;

  return {
    gold,
    black,
    pWin: answer,
    numeric: {
      id: `gp-bags-${gold}-${black}`,
      prompt,
      answer,
      decimals: DP,
      difficulty,
      concept: "Law of total probability (optimization)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Game Puzzle · Rig the Bags · Akuna Capital, Citadel Securities, Flow Traders",
    },
  };
}

/* ========================================================================== */
/*  FAMILY 2. Arbitrage detection (implied-probability sum)  (numeric)       */
/* ========================================================================== */

// NOTE: avoids the source GP2 "Tennis Odds" quote pair (1.29 / 4.70). The
// favourite/underdog pair below is still a sub-100% book (arbitrage) but uses
// distinct odds.
const ODDS_PAIRS: { o1: string; o2: string; a: string; b: string }[] = [
  { o1: "1.35", o2: "4.20", a: "the favourite", b: "the underdog" },
  { o1: "2.05", o2: "2.10", a: "Team Red", b: "Team Blue" },
  { o1: "2.10", o2: "2.10", a: "Player North", b: "Player South" },
  { o1: "1.85", o2: "2.40", a: "the champion", b: "the challenger" },
  { o1: "1.80", o2: "2.10", a: "the home side", b: "the away side" },
  { o1: "1.90", o2: "1.90", a: "Heads Corp", b: "Tails Corp" },
  { o1: "2.00", o2: "2.00", a: "the long", b: "the short" },
  { o1: "1.75", o2: "2.05", a: "the incumbent", b: "the insurgent" },
];

export interface ArbitrageInstance {
  o1: string;
  o2: string;
  sum: number;
  isArb: boolean;
  numeric: NumericQuestion;
}

export function buildArbitrageInstance(
  rng: Rng,
  difficulty: Difficulty,
): ArbitrageInstance {
  const pair = rng.pick(ODDS_PAIRS);
  const { o1, o2, a, b } = pair;
  const sumFrac = impliedProbabilitySum([o1, o2]);
  const answer = Number(decText(sumFrac, DP));
  const isArb = sumFrac.valueOf() < 1;

  const { errors, push } = roundedErrorPusher(answer);
  push(
    F(o1).add(F(o2)),
    "You added the decimal ODDS themselves. Implied probability is the RECIPROCAL 1/o, not o, add 1/o₁ + 1/o₂.",
  );
  push(
    F(1).div(F(o1).sub(1)).add(F(1).div(F(o2).sub(1))),
    "You used net odds (o − 1) in the reciprocal. Implied probability uses the GROSS decimal odds: 1/o, not 1/(o−1).",
  );
  push(
    F(1).div(F(o1)),
    `You counted only ${a}'s implied probability and forgot ${b}. A book must cover ALL mutually-exclusive outcomes.`,
  );

  const prompt =
    `A two-outcome market prices ${a} at decimal odds ${o1} and ${b} at ${o2} (a €1 winning bet returns €o). ` +
    `Enter the total implied probability across both outcomes (the sum of 1/odds), rounded to ${DP} decimals. ` +
    `(A total below 1.00 signals an arbitrage.)`;

  const explanation =
    `Convert each quote to an implied probability with 1/o: 1/${o1} = ${decText(F(1).div(F(o1)), 4)} and ` +
    `1/${o2} = ${decText(F(1).div(F(o2)), 4)}. Their sum is ${fracText(sumFrac)} ≈ ${decText(sumFrac, DP)}. ` +
    (isArb
      ? `Because the sum is BELOW 1, an arbitrage exists: stake inversely to the odds and every outcome returns more than you staked.`
      : `Because the sum is AT/ABOVE 1, there is NO arbitrage, the extra above 1 is the bookmaker's overround (their margin).`);

  return {
    o1,
    o2,
    sum: answer,
    isArb,
    numeric: {
      id: `gp-arb-${o1}-${o2}`,
      prompt,
      answer,
      decimals: DP,
      difficulty,
      concept: "Arbitrage detection (implied probability)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Game Puzzle · Arbitrage · Citadel Securities, Jane Street",
    },
  };
}

/* ========================================================================== */
/*  Named generators                                                          */
/* ========================================================================== */

export const genRigBags = (rng: Rng): NumericQuestion =>
  buildRigBagsInstance(rng, "easy").numeric;
export const genArbitrage = (rng: Rng): NumericQuestion =>
  buildArbitrageInstance(rng, "hard").numeric;

/** Combine numeric generators (family-tagged). */
export const mixNumeric = (
  pool: NumericQuestionGenerator[],
): NumericQuestionGenerator => mixNumericGenerators(pool);

/* ========================================================================== */
/*  FAMILY 3. Arbitrage construction / value betting / parimutuel (flashcards)*/
/* ========================================================================== */

/**
 * The open-ended families: the "answer" is a strategy + a representative
 * winning book, not a unique vector. Company tags from the source dataset are
 * preserved verbatim in each card's `source` (metadata only, not synthesized).
 */
export const gamePuzzleFlashcards: Flashcard[] = [
  {
    id: "gp-fc-arb-single",
    prompt:
      "A bookmaker offers a two-horse race: Storm at 9:4 and Dash at 3:5 (m:n means a €n winning bet returns your €n plus €m). You have €100 (whole-euro bets, need not bet it all). Is there a guaranteed profit, and how would you stake it?",
    answer:
      "Yes, an arbitrage. Payout multiples are Storm (9+4)/4 = 3.25 and Dash (3+5)/5 = 1.6. To guarantee ≥ €100 back you need ≥ 100/3.25 ≈ €30.8 on Storm and ≥ 100/1.6 = €62.5 on Dash; those sum below €100, so e.g. €32 on Storm (→ €104) and €65 on Dash (→ €104) wins whichever horse wins.",
    explanation:
      "Convert each quote to a payout multiple (stake × multiple = total return): Storm 13/4 = 3.25, Dash 8/5 = 1.6. Equivalently implied probabilities 1/3.25 ≈ 0.308 and 1/1.6 = 0.625 sum to 0.933 < 1, a sub-100% book, the signature of an arbitrage. Size each stake so its return covers the whole outlay: ≥100/3.25 ≈ €30.8 on Storm and ≥100/1.6 = €62.5 on Dash. Since €30.8 + €62.5 < €100 you have slack, so any split respecting both minimums (e.g. €32 / €65, €3 unbet) returns more than €100 regardless of outcome. The answer is the STRATEGY plus one representative book, there's no unique vector.",
    difficulty: "hard",
    concept: "Single-book arbitrage / value betting",
    source: "Game Puzzle · Arbitrage · Citadel Securities",
  },
  {
    id: "gp-fc-arb-crossbook",
    prompt:
      "Two bookmakers price a one-on-one final. Book A: Alice 1.25, Bob 4.5. Book B: Alice 1.20, Bob 5.0 (decimal odds). Each book alone has implied probabilities summing above 1. With €100, can you still lock in a profit?",
    answer:
      "Yes, a CROSS-book arbitrage. Take the best price for each outcome across books: Alice @ Book A (1.25) and Bob @ Book B (5.0). Implied sum 1/1.25 + 1/5.0 = 0.80 + 0.20 = 1.00, break-even here, so widen: Alice @ A (1.25) and Bob @ B (5.0) with any book combo whose implied sum < 1 guarantees profit; stake in the ratio of the odds (~€80 Alice, ~€20 Bob) so both legs return the same.",
    explanation:
      "Within each book the implied probabilities exceed 1 (the overround), so no single-book arb. But you may mix books, taking the highest odds for each outcome. Compare combinations: Alice@A (1.25) + Bob@B (5.0) gives 1/1.25 + 1/5.0 = 0.80 + 0.20 = 1.00. If instead Book B quoted Alice higher or Bob at 5.2 the sum drops below 1 and the arb is strict; the method is: for each mutually-exclusive outcome pick the best cross-book price, sum the implied probabilities, and if < 1 stake each leg proportional to its odds so every outcome returns the same total. Represent the plan (which book for which side + the stake ratio), not a single number.",
    difficulty: "hard",
    concept: "Cross-bookmaker arbitrage",
    source: "Game Puzzle · Arbitrage (cross-book) · Citadel Securities, Jane Street",
  },
  {
    id: "gp-fc-value",
    prompt:
      "No pure arbitrage is available. A bookmaker offers Team X at 3:1 (payout multiple 4.0) and you believe Team X's TRUE win probability is 30%. Should you bet, and on what principle?",
    answer:
      "Yes, it's a positive-expected-value (value) bet: expected payout = true prob × multiple = 0.30 × 4.0 = 1.20 > 1, so each €1 staked returns €1.20 on average. Bet where true probability × payout multiple exceeds 1; avoid outcomes where it's below 1 (the book is charging more than the risk is worth).",
    explanation:
      "When implied probabilities sum above 1 there's no guaranteed arb, so you switch to VALUE betting: compare the bookmaker's payout to your own probability estimate. Expected return per €1 = p_true × payout_multiple. Here 0.30 × 4.0 = 1.20 (a 20% edge), so betting Team X is +EV. The discipline is exactly Kelly's precondition, only bet when your edge is positive, and then (separately) size it. Contrast an outcome priced at 1.5 that you think is 50% likely: 0.50 × 1.5 = 0.75 < 1, a losing bet you should skip. The 'answer' is the EV rule and the sign of the edge, not a unique stake.",
    difficulty: "medium",
    concept: "Expected-payout value betting",
    source: "Game Puzzle · Value betting · Citadel Securities",
  },
  {
    id: "gp-fc-parimutuel-1",
    prompt:
      "Parimutuel pool: you, Mia, and Leo each stake €100 (pot €300); backers of the winning team split the pot pro-rata. Mia and Leo have already bet. Falcons: Mia €60/Leo €50; Hawks: Mia €40/Leo €50; Eagles: €0/€0; Owls: €0/€10. How do you allocate your €100 to make more than €100?",
    answer:
      "Exploit the empty/thin teams. Put €1 on Eagles (nobody else → you'd own the whole €300 if they win), €3 on Owls (3/(3+10)×300 ≈ €69 if they win), and split the remaining €96 across the crowded Falcons/Hawks (~€48/€48) so you recover close to €100 if a favourite wins. Caps downside, huge upside on a longshot.",
    explanation:
      "In parimutuel there are no fixed odds, your payout depends only on how the pot splits against KNOWN opponent bets. Team totals from opponents: Falcons €110, Hawks €90, Eagles €0, Owls €10. Betting a thin/empty team means you own most of its share of the €300 pot: €1 on Eagles alone returns the full €300; €3 on Owls returns 3/13×300 ≈ €69. Cover the crowded favourites lightly so that if one wins you still get roughly your money back: e.g. €48 on Falcons → 48/158×300 ≈ €91. Total spend €1+€3+€48+€48 = €100. The point is the STRATEGY (load empty/thin teams, cover the crowd), many whole-euro allocations work, so there's no unique answer.",
    difficulty: "medium",
    concept: "Parimutuel pot-splitting against known opponents",
    source: "Game Puzzle · Parimutuel · Citadel Securities",
  },
  {
    id: "gp-fc-parimutuel-2",
    prompt:
      "Parimutuel pool of €300 (you + two opponents at €100 each). Opponents have piled onto one favourite: Alpha €150 total, Beta €50 total, Gamma €0, Delta €0. Where should your €100 go, and why?",
    answer:
      "Load the empty teams. €1 on Gamma and €1 on Delta each win the whole €300 outright if that team comes in (nobody else backs them). Put a modest cover on Beta (thin) and only a token on the crowded Alpha. E.g. Gamma €1, Delta €1, Beta €40 (→ 40/90×300 ≈ €133), Alpha €58 (→ 58/208×300 ≈ €84). Minimises loss probability, big upside on any longshot.",
    explanation:
      "Payout = (your stake on winner)/(total stake on winner) × €300. Empty teams are gold: €1 on Gamma or Delta returns the entire €300 if they win, because you're the only backer. Thin Beta (opponents €50) lets a €40 stake capture 40/90 ≈ 44% of the pot ≈ €133. The crowded Alpha (opponents €150) is a poor per-euro return, so only cover it enough to blunt the most likely outcome. Spend €1+€1+€40+€58 = €100. As with all parimutuel questions the deliverable is the reasoning and a representative allocation, many valid spreads exist, so it's routed as open-ended reasoning, not a single scalar.",
    difficulty: "hard",
    concept: "Parimutuel pot-splitting against known opponents",
    source: "Game Puzzle · Parimutuel · Citadel Securities",
  },
];
