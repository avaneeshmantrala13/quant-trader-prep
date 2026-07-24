import type { Level, Question, Track } from "@/types/content";
import { EV_GENERATORS, mixEV } from "./generators";

const E = EV_GENERATORS;

/**
 * Interview Games — EV, optimal stopping, and market making, the
 * SIG / Citadel / Jane Street "decision game" genres. Levels blend exact EV
 * generators with hand-authored market-making scenarios.
 *
 * NOTE: Kelly bet-sizing was retired from here (formerly the `ig-4` "Kelly
 * Sizing Drills" driven by `genKelly`) and superseded by the dedicated,
 * exact-rational **Betting & Sizing** subcategory on the Probability/Math track
 * (`src/content/probabilityStats/bettingSizing/`).
 */

const evBasics: Question[] = [
  {
    id: "ig-coinbet",
    prompt:
      "A fair coin is flipped once. You win $10 on heads and lose $6 on tails. What is the expected value of playing?",
    choices: ["$2", "$4", "$8", "$16"],
    correctIndex: 0,
    explanation:
      "EV = 0.5·(+10) + 0.5·(−6) = 5 − 3 = $2. Positive EV, so you should take this bet (sizing aside).",
    difficulty: "easy",
    concept: "Expected value of a bet",
    distractorRationale: [
      "Correct — 0.5·10 + 0.5·(−6) = 2.",
      "The net of the two payoffs (10 − 6) without probability-weighting.",
      "The average of the magnitudes (10 + 6)/2, ignoring the loss sign.",
      "The sum of the magnitudes.",
    ],
    source: "EV of a coin bet",
  },
  {
    id: "ig-dice-sum",
    prompt:
      "Two fair six-sided dice are rolled and summed. Which total is the single MOST likely?",
    choices: ["7", "6", "8", "2"],
    correctIndex: 0,
    explanation:
      "7 has the most combinations (1-6, 2-5, 3-4, and reverses = 6 ways out of 36). Totals fall off symmetrically from 7.",
    difficulty: "easy",
    concept: "Discrete distribution mode",
    distractorRationale: [
      "Correct — 6 of 36 ways, the peak.",
      "5 ways — just below the peak.",
      "5 ways — just below the peak.",
      "Only 1 way (1-1) — the least likely.",
    ],
    source: "Sum of two dice",
  },
  {
    id: "ig-max-dice",
    prompt:
      "Two fair six-sided dice are rolled. What is the expected value of the LARGER of the two (the maximum)?",
    choices: ["4.47", "3.5", "4.0", "6"],
    correctIndex: 0,
    explanation:
      "P(max = k) = (2k − 1)/36. E[max] = Σ k·(2k−1)/36 = 161/36 ≈ 4.47. (Higher than a single die's 3.5, as expected for a maximum.)",
    difficulty: "hard",
    concept: "Order statistics / expected maximum",
    distractorRationale: [
      "Correct — 161/36 ≈ 4.47.",
      "The EV of a SINGLE die — ignores that a max is larger.",
      "A midpoint guess.",
      "The maximum possible value, not its expectation.",
    ],
    needsVerification: true,
    source: "Expected maximum of two dice (order statistics)",
  },
];

const stopping: Question[] = [
  {
    id: "ig-stpetersburg",
    prompt:
      "A game: flip a fair coin until the first tails; if the first tails is on flip k, you are paid $2ᵏ. What is the expected payout?",
    choices: [
      "Infinite (the sum diverges)",
      "$2",
      "$4",
      "$8",
    ],
    correctIndex: 0,
    explanation:
      "EV = Σ P(first tails on flip k)·2ᵏ = Σ (1/2ᵏ)·2ᵏ = Σ 1 = ∞. This is the St. Petersburg paradox — the EV is infinite even though nobody would pay much to play (utility, not EV, governs the real decision).",
    difficulty: "expert",
    concept: "St. Petersburg paradox / divergent EV",
    distractorRationale: [
      "Correct — each term contributes 1, so the sum diverges.",
      "Only the first term's contribution.",
      "A partial sum.",
      "A partial sum.",
    ],
    needsVerification: true,
    source: "St. Petersburg paradox",
  },
  {
    id: "ig-secretary",
    prompt:
      "You interview n candidates one at a time in random order and must accept or reject each immediately (no going back), wanting to hire the single best. Using the optimal strategy for large n, roughly what is your probability of hiring the best candidate?",
    choices: ["≈ 37%", "≈ 50%", "≈ 25%", "≈ 10%"],
    correctIndex: 0,
    explanation:
      "The optimal 'secretary problem' rule: reject the first n/e (~37%) candidates, then take the next one better than all seen so far. This succeeds with probability → 1/e ≈ 37% as n grows.",
    difficulty: "expert",
    concept: "Optimal stopping (secretary problem)",
    distractorRationale: [
      "Correct — 1/e ≈ 0.368.",
      "The intuitive coin-flip guess.",
      "Underestimate.",
      "Underestimate.",
    ],
    needsVerification: true,
    source: "Secretary problem / optimal stopping",
  },
];

const marketMaking: Question[] = [
  {
    id: "ig-adverse-ev",
    prompt:
      "An asset's value is uniform on {1,2,…,10}. You post a bid of 4 and an ask of 7. An informed trader (who knows the value V) will SELL to you at 4 whenever V < 4, and BUY from you at 7 whenever V > 7. What is your expected profit per round?",
    choices: ["−$1.20", "$0", "+$1.20", "−$6.00"],
    correctIndex: 0,
    explanation:
      "Losses only occur when the informed trader acts. Sells to you (V<4): P&L = V−4 for V∈{1,2,3} = −3−2−1. Buys from you (V>7): P&L = 7−V for V∈{8,9,10} = −1−2−3. Total −12 over 10 equally likely values ⇒ −$1.20. This is adverse selection: you only trade when it's bad for you.",
    difficulty: "expert",
    concept: "Adverse selection / market-making P&L",
    distractorRationale: [
      "Correct — −12/10 = −$1.20.",
      "Assumes a symmetric market breaks even — but you only get filled by the informed side.",
      "Sign error (you lose, not gain).",
      "Forgot to divide by the 10 outcomes.",
    ],
    needsVerification: true,
    source: "Adverse-selection market-making EV",
  },
  {
    id: "ig-spread-uncertainty",
    prompt:
      "You make a two-sided market on an uncertain value. Your uncertainty about fair value suddenly increases (news is pending). What is the correct adjustment to your quote?",
    choices: [
      "Widen the spread (lower bid, raise ask) to compensate for greater adverse-selection risk.",
      "Tighten the spread to attract more flow while you can.",
      "Keep the spread the same but double your size.",
      "Raise both bid and ask by the same amount.",
    ],
    correctIndex: 0,
    explanation:
      "Wider uncertainty means informed traders are more likely to pick you off, so you demand a larger spread as compensation. Spread scales with uncertainty; that is the core market-making instinct.",
    difficulty: "hard",
    concept: "Spread as a function of uncertainty",
    distractorRationale: [
      "Correct — spread should scale with uncertainty.",
      "Tightening into rising uncertainty invites being picked off.",
      "Increasing size magnifies the adverse-selection loss.",
      "Shifting both quotes changes your fair-value view, not your risk buffer.",
    ],
    source: "Market-making: spread vs uncertainty",
  },
  {
    id: "ig-inventory-skew",
    prompt:
      "You are a market maker who has accidentally accumulated a large LONG position. Holding your fair-value estimate fixed, how should you adjust your two-sided quotes to manage inventory risk?",
    choices: [
      "Skew both quotes DOWN (lower bid and ask) to encourage selling your excess and discourage buying more.",
      "Skew both quotes UP to make your inventory look more valuable.",
      "Widen the spread symmetrically around fair value.",
      "Do nothing; inventory doesn't affect optimal quotes.",
    ],
    correctIndex: 0,
    explanation:
      "Being over-long is a risk you want to shed, so you make selling (your ask) more attractive and buying (your bid) less attractive by shifting BOTH quotes down. This 'inventory skew' nudges flow to flatten your position.",
    difficulty: "hard",
    concept: "Inventory management / quote skew",
    distractorRationale: [
      "Correct — skew quotes down to offload a long.",
      "Backwards — that would attract even more buying.",
      "Widening manages adverse selection, not inventory imbalance.",
      "Inventory risk absolutely should shift your quotes.",
    ],
    source: "Market-making: inventory skew",
  },
];

const levels: Level[] = [
  {
    id: "ig-1",
    title: "Pricing Fair Value",
    subtitle: "Expected value as the fair price",
    blurb:
      "Pricing a bet as its expected value, and avoiding the mode-vs-mean trap when reading a distribution's fair price.",
    difficulty: "medium",
    masteryThreshold: 0.8,
    questions: evBasics,
    generator: undefined,
    lesson: {
      paragraphs: [
        "Every trade is a bet; its fair price is its expected value, E = Σ p·x. A market maker's 'mid' should sit at the EV of the underlying value, and any bet with positive EV is worth taking (before worrying about sizing).",
        "Watch two traps: forgetting to weight payoffs by probability, and confusing a distribution's most-likely value (mode) with its average (mean) — for a maximum or a skewed payoff they differ.",
      ],
      keyIdea: "Fair value = expected value; weight every payoff by its probability.",
      whyInterviewers:
        "Pricing a bet's EV instantly is the foundation of trading.",
    },
  },
  {
    id: "ig-2",
    title: "Optimal Stopping",
    subtitle: "Re-roll games, secretary, divergent EV",
    blurb:
      "Valuing the option to continue — the die re-roll game, the secretary problem's 37% rule, and the St. Petersburg paradox.",
    difficulty: "hard",
    masteryThreshold: 0.75,
    questions: stopping,
    lesson: {
      paragraphs: [
        "When you may act now or wait, the option to continue has value. The die-with-re-roll game is the canonical example: keep a roll only if it beats the EV of rolling again — for a fair d6 that means keeping 4–6 and re-rolling 1–3, giving EV 4.25.",
        "Optimal stopping recurs everywhere: the secretary problem (reject ~37%, then take the next best) and the St. Petersburg paradox (infinite EV, finite willingness to pay) both hinge on valuing the choice to continue.",
      ],
      keyIdea: "Continue iff the current option is worse than E[future]; option value is real.",
      whyInterviewers:
        "Re-roll and stopping games are staple SIG/Citadel decision problems.",
    },
  },
  {
    id: "ig-3",
    title: "Optimal Stopping Drills",
    subtitle: "Fresh re-roll and fair-value problems",
    blurb:
      "Fresh re-roll and uniform fair-value drills: keep any roll above a fresh roll's mean, and price a 1..N draw at (N+1)/2.",
    difficulty: "hard",
    masteryThreshold: 0.8,
    generator: mixEV([E.genReRollDie, E.genFairValue]),
    questionCount: 6,
    lesson: {
      paragraphs: [
        "Now practice the re-roll game and fair-value pricing on fresh numbers. For an N-sided die with one re-roll, the EV is (1/N)·Σ max(x, (N+1)/2): keep any roll at or above the mean of a fresh roll.",
        "Fair value of a uniform draw on 1..N is (N+1)/2 — the price a maker quotes around. Watch the off-by-one: the average of 1..N is not N/2.",
      ],
      keyIdea: "Re-roll EV = (1/N)Σ max(x, mean); uniform fair value = (N+1)/2.",
      whyInterviewers: "Speed AND correctness on option-value math.",
    },
  },
  {
    id: "ig-4",
    title: "Market Making",
    subtitle: "Adverse selection, spread & inventory skew",
    blurb:
      "Two-sided market making: adverse selection, setting spread proportional to uncertainty, and skewing quotes to manage inventory.",
    difficulty: "expert",
    masteryThreshold: 0.75,
    questions: marketMaking,
    lesson: {
      paragraphs: [
        "Market making adds adverse selection: you get filled precisely when an informed trader profits, so you only trade when it's slightly bad for you. The job is to price that risk.",
        "Two levers: (1) set your spread proportional to your uncertainty about fair value, and (2) skew both quotes to manage inventory — shift down when you're too long to encourage selling your excess.",
      ],
      keyIdea: "Spread ∝ uncertainty; skew quotes to flatten inventory.",
      whyInterviewers:
        "This IS the job — quoting, sizing, and managing risk on live flow.",
    },
  },
];

export const interviewGamesTrack: Track = {
  id: "interview-games",
  title: "Interview Games",
  tagline: "EV, optimal stopping & market making",
  description:
    "The decision games firms actually run: re-roll EV, optimal stopping, and two-sided market making with adverse selection. (Kelly bet-sizing now lives in Probability/Math → Betting & Sizing.)",
  motif: "interviewGames",
  levels,
};
