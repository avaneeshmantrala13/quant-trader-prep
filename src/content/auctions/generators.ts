import type { Rng } from "@/lib/rng";
import type {
  NumericQuestion,
  NumericQuestionGenerator,
  Question,
  QuestionGenerator,
} from "@/types/content";
import { assemble, fmt } from "../shared";
import {
  F,
  acquireIsPositiveEv,
  acquireUnconditionalEv,
  acquireEvGivenWin,
  evGivenWin,
  expectedMaxOfN,
  fracToRounded,
  noiseSupport,
  winnersCurseShade,
} from "./solvers";

/**
 * Common-value / winner's-curse auction generators.
 *
 * Every answer is re-derived by an EXACT rational solver in `solvers.ts` from a
 * clean discrete/uniform model; distractors encode NAMED misconceptions, never
 * random numbers:
 *   - `ignored_winners_curse` — bid the UNCONDITIONAL E[V] (no haircut for the
 *     bad news that winning conveys).
 *   - `no_shading_for_n`      — used a shade sized for fewer bidders (didn't
 *     grow the correction as n rose).
 *   - `used_own_signal`       — bid / valued at the raw signal (or the bid) as
 *     if it were the value.
 *   - `wrong_conditioning`    — conditioned the wrong way (added instead of
 *     subtracted, off-by-one range, divided by n, competition-not-information).
 *
 * Answer routing mirrors the interviewGames dataset: a scalar $ answer → numeric
 * free-entry; a decision (+EV / shade-direction / bid-or-pass) → multiple-choice.
 */

/** 4-dp formatter for the rational value amounts. */
const P4 = (x: number) => fmt(x, 4);
const $ = (n: number) => `$${fmt(n)}`;
/** Render the noise support {−m, …, m} for a prompt. */
const noiseStr = (m: number) => {
  const s = noiseSupport(m);
  return `{${s[0]}, …, ${s[s.length - 1]}}`;
};

/* Small exact-arithmetic helpers so distractors stay rational, never floats. */
const bidNum = (b: number) => F(b);
const F_add = (a: number, frac: ReturnType<typeof F>) => F(a).add(frac);
const F_sub = (a: number, frac: ReturnType<typeof F>) => F(a).sub(frac);
const F_div = (a: number, d: number) => F(a, d);

/** Drop error values equal to the key (at grading precision) or to each other. */
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
/*  NUMERIC — scalar $ answers                                                 */
/* ========================================================================== */

/**
 * SHADE amount = E[max of n noises]. Tests that the winner's-curse correction
 * is positive even for an UNBIASED signal, and that it grows with n.
 */
function genWinnersCurseShade(rng: Rng): NumericQuestion {
  const m = rng.pick([2, 3, 4] as const);
  const n = rng.pick([2, 3, 4, 5] as const);
  const shade = winnersCurseShade(m, n);
  const answer = fracToRounded(shade, 4);

  const raw = [
    {
      value: 0,
      feedback:
        "You reasoned that an unbiased signal (mean-zero noise) needs no correction — but conditioning on WINNING is what bites: you only win when your signal is the highest of the n, which overstates V. Shade by the expected size of that overstatement.",
      misconception: "ignored_winners_curse",
    },
    ...(n > 2
      ? [
          {
            value: fracToRounded(expectedMaxOfN(m, 2), 4),
            feedback:
              "That is the shade for just 2 bidders. With more rivals to beat, winning is even worse news about V, so the correction must GROW with n. Recompute the expected maximum over all " +
              n +
              " signals.",
            misconception: "no_shading_for_n",
          },
        ]
      : []),
    {
      value: fracToRounded(shade.div(n), 4),
      feedback:
        "You divided the expected overstatement by the number of bidders. The shade is the expected MAXIMUM of the n noises, not that maximum spread across the bidders — do not divide by n.",
      misconception: "wrong_conditioning",
    },
  ];
  const errors = dedupeErrors(raw, answer, 4);

  return {
    id: `auc-shade-${m}-${n}`,
    prompt: `In a common-value auction, an item's unknown value V (in $) is estimated by each of n = ${n} bidders through an independent, unbiased signal V + ε, where the noise ε is uniform on the integer dollars ${noiseStr(m)}. Bids increase in the signal, so you win exactly when your signal is the highest. By how much (in $) should you shade your bid below your signal to neutralize the winner's curse?`,
    answer,
    decimals: 4,
    unit: "$",
    difficulty: "hard",
    concept: "Winner's curse — shade = E[max of n signals]",
    explanation: `Conditional on winning, your own noise is the MAXIMUM of the ${n} i.i.d. noises, so on average your signal overstates V by E[max of ${n} draws from ${noiseStr(m)}] = ${P4(answer)}. Shade your bid by exactly that. It is 0 for a single bidder and rises with n.`,
    commonErrors: errors,
    source: "Common-value auction — optimal bid shading (winner's curse)",
    family: "genWinnersCurseShade",
  };
}

/**
 * E[V | you won] = signal − E[max of n noises]. Tests the central winner's-curse
 * fact: winning is bad news, so the value conditional on winning is BELOW your
 * (unbiased) signal.
 */
function genEvGivenWin(rng: Rng): NumericQuestion {
  const m = rng.pick([2, 3, 4] as const);
  const n = rng.pick([2, 3, 4, 5] as const);
  const signal = rng.int(40, 90);
  const ev = evGivenWin(signal, m, n);
  const answer = fracToRounded(ev, 4);
  const shade = expectedMaxOfN(m, n);

  const raw = [
    {
      value: signal,
      feedback:
        "You used your raw signal as the estimate of V. The signal is unbiased UNCONDITIONALLY, but conditional on winning it is the highest of the " +
        n +
        " signals, so it overstates V. Subtract the expected overstatement.",
      misconception: "used_own_signal",
    },
    ...(n > 2
      ? [
          {
            value: fracToRounded(F_sub(signal, expectedMaxOfN(m, 2)), 4),
            feedback:
              "You subtracted the correction for only 2 bidders. With " +
              n +
              " rivals, winning is worse news, so the haircut (E[max of n signals]) is larger. Use all " +
              n +
              " bidders.",
            misconception: "no_shading_for_n",
          },
        ]
      : []),
    {
      value: fracToRounded(F_add(signal, shade), 4),
      feedback:
        "You ADDED the correction instead of subtracting it — that is the loser's blessing, not the winner's curse. Winning means your signal was too HIGH, so E[V | win] sits below your signal.",
      misconception: "wrong_conditioning",
    },
  ];
  const errors = dedupeErrors(raw, answer, 4);

  return {
    id: `auc-evwin-${m}-${n}-${signal}`,
    prompt: `A common-value auction has n = ${n} bidders. The item's unknown value V (in $) is common to all; your unbiased signal is V + ε with ε uniform on the integer dollars ${noiseStr(m)}. Your signal is $${signal}. Conditional on WINNING (your signal is the highest of the ${n}), what is E[V]?`,
    answer,
    decimals: 4,
    unit: "$",
    difficulty: "hard",
    concept: "Expected value conditional on winning",
    explanation: `Winning ⇒ your signal is the max of the ${n}, so your noise is E[max of ${n} draws from ${noiseStr(m)}] = ${P4(fracToRounded(shade, 4))} too high. Hence E[V | win] = ${signal} − ${P4(fracToRounded(shade, 4))} = ${P4(answer)}, strictly below your signal.`,
    commonErrors: errors,
    source: "Common-value auction — E[V | you won] (winner's curse)",
    family: "genEvGivenWin",
  };
}

/**
 * Acquiring-a-company: E[V | V ≤ b] = b/2 for V uniform on {0, …, M}. A purely
 * conditional-expectation drill — winning (V ≤ b) means the value is low.
 */
function genAcquireEvGivenWin(rng: Rng): NumericQuestion {
  const M = rng.pick([20, 40, 50, 100] as const);
  const b = rng.int(4, M - 4);
  const ev = acquireEvGivenWin(b);
  const answer = fracToRounded(ev, 1);

  const raw = [
    {
      value: fracToRounded(acquireUnconditionalEv(M), 1),
      feedback:
        "That is the UNCONDITIONAL average, M/2. But you only win when V ≤ your bid, which selects the low values — so condition on V ≤ b, giving a mean of b/2, not M/2.",
      misconception: "ignored_winners_curse",
    },
    {
      value: b,
      feedback:
        "You set the value equal to your bid. Winning tells you V ≤ b, not V = b; averaging the low outcomes {0, …, b} gives b/2, only half your bid.",
      misconception: "used_own_signal",
    },
    {
      value: fracToRounded(F_div(b + 1, 2), 1),
      feedback:
        "Off-by-one on the range: winning covers the b+1 integers {0, 1, …, b} (including 0), whose mean is b/2 — not (b+1)/2, which averages {1, …, b}.",
      misconception: "wrong_conditioning",
    },
  ];
  const errors = dedupeErrors(raw, answer, 1);

  return {
    id: `auc-acq-ev-${M}-${b}`,
    prompt: `A company's true value V is equally likely to be any integer dollar amount in {0, 1, …, ${M}}. You tender a bid of $${b}; the owner sells only if V ≤ your bid (you win exactly when the true value is at most $${b}). Conditional on your bid WINNING, what is the expected true value E[V | V ≤ ${b}]?`,
    answer,
    decimals: 1,
    unit: "$",
    difficulty: "medium",
    concept: "Conditional expectation given you won (acquiring a company)",
    explanation: `Winning means V ≤ ${b}, so V is uniform on the ${b + 1} integers {0, …, ${b}}, whose mean is ${b}/2 = ${P4(answer)}. Conditioning on winning halves your bid — the essence of the winner's curse.`,
    commonErrors: errors,
    source: "Acquiring-a-company winner's curse (conditional value)",
    family: "genAcquireEvGivenWin",
  };
}

/* ========================================================================== */
/*  QUIZ — decision answers                                                    */
/* ========================================================================== */

/**
 * +EV / −EV decision on a specific bid, evaluated CONDITIONAL ON WINNING. Half
 * the time the bidder naively bids their raw signal (a −EV winner's-curse trap);
 * half the time they bid a well-shaded amount below E[V | win] (+EV).
 */
function genBidEvDecision(rng: Rng): Question {
  const m = rng.pick([2, 3, 4] as const);
  const n = rng.pick([2, 3, 4, 5] as const);
  const signal = rng.int(40, 90);
  const evWin = evGivenWin(signal, m, n);
  const bidRaw = rng.chance(0.5);
  const bid = bidRaw
    ? signal
    : Math.floor(evWin.valueOf()) - rng.int(1, 4);
  const isPos = evWin.sub(bidNum(bid)).valueOf() > 0;

  const POS =
    "+EV — even conditional on winning (your signal being the highest), the bid sits below E[V | win], so winning is profitable on average.";
  const NEG =
    "−EV — the winner's curse: conditional on winning, E[V | win] is below the bid, so winning loses money on average.";
  const IGN =
    "+EV — the signal is an unbiased estimate of V, so any bid at or below your signal cannot lose in expectation.";
  const NOSHADE =
    "It depends only on the bid versus your signal; the number of rival bidders is irrelevant to the calculation.";

  const correct = isPos ? POS : NEG;
  const distractors = [POS, NEG, IGN, NOSHADE].filter((c) => c !== correct);

  const q = assemble(rng, {
    id: `auc-biddec-${m}-${n}-${signal}-${bid}`,
    prompt: `A common-value auction has n = ${n} bidders, each seeing an unbiased signal V + ε with ε uniform on the integer dollars ${noiseStr(m)}. Your signal is $${signal}. Bids increase in the signal (so you win only with the highest signal). You are thinking of bidding $${bid}. Is that bid +EV, break-even, or −EV — evaluated conditional on actually winning?`,
    correct,
    distractors,
    explanation: `E[V | win] = signal − E[max of ${n} noises] = ${signal} − ${P4(fracToRounded(expectedMaxOfN(m, n), 4))} = ${P4(fracToRounded(evWin, 4))}. Compared to a bid of ${$(bid)}, winning is ${isPos ? "PROFITABLE (bid below E[V | win])" : "a LOSS (bid above E[V | win]) — the winner's curse"}.`,
    difficulty: "expert",
    concept: "+EV vs −EV bid conditional on winning",
    distractorRationaleByValue: {
      [POS]:
        "Comparing the bid to your raw signal instead of to E[V | win] flips the call — a bid below your signal can still be above E[V | win].",
      [NEG]:
        "This bid is already shaded below E[V | win], so applying the curse a second time wrongly rejects a profitable bid.",
      [IGN]:
        "An unbiased signal is only unbiased UNCONDITIONALLY; conditional on winning it overstates V, so a bid below the signal can still lose.",
      [NOSHADE]:
        "The number of rivals sets the size of the winner's-curse haircut (E[max of n]); it is central, not irrelevant.",
    },
    misconceptionByValue: {
      [POS]: "ignored_winners_curse",
      [NEG]: "wrong_conditioning",
      [IGN]: "ignored_winners_curse",
      [NOSHADE]: "no_shading_for_n",
    },
    source: "Common-value auction — +EV/−EV bid decision (winner's curse)",
  });
  return { ...q, family: "genBidEvDecision" };
}

/**
 * Same signal, two auctions with different bidder counts: how should the optimal
 * bid change as n grows? Provably LOWER, since shade = E[max of n] increases in n.
 */
function genShadingWithN(rng: Rng): Question {
  const m = rng.pick([2, 3, 4] as const);
  const counts = rng.shuffle([2, 3, 4, 5, 6] as const).slice(0, 2).sort((a, b) => a - b);
  const [n1, n2] = counts;

  const LOWER =
    "Bid LOWER (shade more) in the auction with more bidders — beating more rivals is worse news about V.";
  const SAME =
    "Bid the SAME in both — the number of rivals doesn't change your signal, so it shouldn't change your bid.";
  const HIGHER =
    "Bid HIGHER with more bidders — you must outbid more rivals, so you have to bid up to win.";
  const RAW =
    "Bid your raw signal in both — it's an unbiased estimate of V either way.";

  const q = assemble(rng, {
    id: `auc-shadingN-${m}-${n1}-${n2}`,
    prompt: `You receive the SAME signal in two otherwise-identical common-value auctions. Auction A has n = ${n1} bidders; Auction B has n = ${n2} bidders (more rivals). Each bidder's signal is an independent unbiased estimate of V (noise uniform on ${noiseStr(m)}). How should your optimal bid differ between the two?`,
    correct: LOWER,
    distractors: [SAME, HIGHER, RAW],
    explanation: `The shade equals E[max of n signals], which rises from ${P4(fracToRounded(expectedMaxOfN(m, n1), 4))} (n = ${n1}) to ${P4(fracToRounded(expectedMaxOfN(m, n2), 4))} (n = ${n2}). More rivals ⇒ winning implies a higher signal-order-statistic ⇒ shade more ⇒ bid LOWER.`,
    difficulty: "hard",
    concept: "Shading increases with the number of bidders",
    distractorRationaleByValue: {
      [SAME]:
        "The winner's-curse correction depends on how many signals you beat; more rivals means a bigger correction, so the bid must move.",
      [HIGHER]:
        "That is the competitive-auction intuition (private values). With a COMMON value, more rivals sharpen the curse, so you bid down, not up.",
      [RAW]:
        "The signal is unbiased only unconditionally; conditional on winning it overstates V, and more so with more bidders.",
    },
    misconceptionByValue: {
      [SAME]: "no_shading_for_n",
      [HIGHER]: "wrong_conditioning",
      [RAW]: "used_own_signal",
    },
    source: "Common-value auction — shading grows with n",
  });
  return { ...q, family: "genShadingWithN" };
}

/**
 * Acquiring-a-company decision: with V uniform on {0, …, M}, winning (V ≤ b)
 * halves the value, so a positive bid is +EV iff the synergy multiple f > 2.
 */
function genAcquireDecision(rng: Rng): Question {
  const M = rng.pick([20, 40, 50, 100] as const);
  const [fNum, fDen] = rng.pick([
    [3, 2],
    [5, 4],
    [7, 4],
    [9, 4],
    [5, 2],
    [11, 4],
  ] as const);
  const isPos = acquireIsPositiveEv(fNum, fDen);

  const YES =
    "Yes — positive bids are +EV here (the synergy multiple exceeds 2×, which overcomes the value-halving from conditioning on winning).";
  const NO =
    "No — every positive bid is −EV here (you only win when V is low, and the synergy multiple is too small to beat E[V | win] = b/2).";
  const IGN =
    "Yes — any synergy multiple above 1× makes bidding worthwhile, since you'd be paying less than the value you add.";
  const DEP =
    "It depends on M — bid only when your bid b is small relative to the maximum value M.";

  const correct = isPos ? YES : NO;
  const distractors = [YES, NO, IGN, DEP].filter((c) => c !== correct);

  const q = assemble(rng, {
    id: `auc-acqdec-${M}-${fNum}-${fDen}`,
    prompt: `A company is worth V, equally likely any integer dollar amount in {0, …, ${M}}. Under your ownership it would be worth ${fNum}/${fDen} × V to you. The owner accepts a bid b > 0 iff V ≤ b (you win only when the value is at most your bid). Is submitting some positive bid +EV?`,
    correct,
    distractors,
    explanation: `Winning ⇒ V ≤ b ⇒ E[V | win] = b/2, so the value you win is (${fNum}/${fDen})·(b/2) and your expected profit ∝ (${fNum}/${fDen})/2 − 1 = f/2 − 1. Since f = ${fNum}/${fDen} is ${isPos ? "> 2, every positive bid is +EV" : "< 2, every positive bid is −EV"}, independent of b and M.`,
    difficulty: "expert",
    concept: "Acquiring a company — +EV iff synergy > 2×",
    distractorRationaleByValue: {
      [YES]:
        "A multiple below 2× cannot overcome the value-halving (E[V | win] = b/2), so bidding still loses in expectation.",
      [NO]:
        "A multiple above 2× more than offsets the value-halving, so positive bids are profitable.",
      [IGN]:
        "This ignores the winner's curse: conditional on winning V averages only b/2, so you need f > 2, not merely f > 1.",
      [DEP]:
        "The sign of the expected profit is f/2 − 1 — independent of b and M — so no choice of a small bid rescues a low multiple.",
    },
    misconceptionByValue: {
      [YES]: "wrong_conditioning",
      [NO]: "wrong_conditioning",
      [IGN]: "ignored_winners_curse",
      [DEP]: "wrong_conditioning",
    },
    source: "Acquiring-a-company auction — +EV iff synergy exceeds 2× (winner's curse)",
  });
  return { ...q, family: "genAcquireDecision" };
}

/* ========================================================================== */
/*  Registries                                                                 */
/* ========================================================================== */

export const AUCTION_QUIZ_GENERATORS: Record<string, QuestionGenerator> = {
  genBidEvDecision,
  genShadingWithN,
  genAcquireDecision,
};

export const AUCTION_NUMERIC_GENERATORS: Record<string, NumericQuestionGenerator> = {
  genWinnersCurseShade,
  genEvGivenWin,
  genAcquireEvGivenWin,
};
