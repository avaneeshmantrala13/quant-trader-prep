import type { Level, Question, Track } from "@/types/content";
import {
  genCoinBetEvNumeric,
  genDiceSumModeNumeric,
  genExpMaxDiceNumeric,
  genFairValueNumeric,
  genReRollDieNumeric,
  mixEVNumeric,
} from "./generators";
import {
  FERMI_FLASHCARDS,
  TRADING_NUMERIC_GENERATORS,
  TRADING_QUIZ_GENERATORS,
  mixTradingNumeric,
  mixTradingQuiz,
} from "./tradingGames";

const N = TRADING_NUMERIC_GENERATORS;
const Q = TRADING_QUIZ_GENERATORS;

/**
 * Interview Games. EV, optimal stopping, and market making, the
 * SIG / Citadel / Jane Street "decision game" genres. Levels blend exact EV
 * generators with hand-authored market-making scenarios.
 *
 * NOTE: Kelly bet-sizing was retired from here (formerly the `ig-4` "Kelly
 * Sizing Drills" driven by `genKelly`) and superseded by the dedicated,
 * exact-rational **Betting & Sizing** subcategory on the Probability/Math track
 * (`src/content/probabilityStats/bettingSizing/`).
 */

/**
 * ig-1 "Pricing Fair Value" was a hand-authored STATIC pool of three numeric
 * items (a coin-bet EV, the mode of a two-dice sum, and the expected MAXIMUM of
 * dice). Those are now three exact parametric families in `./generators`
 * (`genCoinBetEvNumeric`, `genDiceSumModeNumeric`, `genExpMaxDiceNumeric`) mixed
 * into the level's `numericGenerator` below, so every item is freshly generated
 * with a worked step-by-step `explanation`. This lets the tutor's rung-3
 * worked-sibling builder render a real, different-numbers sibling for each item
 * — notably the expected-maximum order-statistic item, which previously fell
 * back to the generic caption because it had no generator.
 */

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
      "EV = Σ P(first tails on flip k)·2ᵏ = Σ (1/2ᵏ)·2ᵏ = Σ 1 = ∞. This is the St. Petersburg paradox, the EV is infinite even though nobody would pay much to play (utility, not EV, governs the real decision).",
    difficulty: "expert",
    concept: "St. Petersburg paradox / divergent EV",
    distractorRationale: [
      "Correct, each term contributes 1, so the sum diverges.",
      "Only the first term's contribution.",
      "That's only a partial sum of the payout series, not its full total.",
      "That's only a partial sum of the payout series, not its full total.",
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
      "Correct, 1/e ≈ 0.368.",
      "The intuitive coin-flip guess.",
      "That underestimates the optimal-stopping success rate.",
      "That underestimates the optimal-stopping success rate.",
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
      "Correct, −12/10 = −$1.20.",
      "Assumes a symmetric market breaks even, but you only get filled by the informed side.",
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
      "Correct, spread should scale with uncertainty.",
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
      "Correct, skew quotes down to offload a long.",
      "Backwards, that would attract even more buying.",
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
    mode: "numeric",
    masteryThreshold: 0.8,
    numericGenerator: mixEVNumeric([
      genCoinBetEvNumeric,
      genDiceSumModeNumeric,
      genExpMaxDiceNumeric,
    ]),
    questionCount: 5,
    lesson: {
      paragraphs: [
        "Every trade is a bet; its fair price is its expected value, E = Σ p·x. A market maker's 'mid' should sit at the EV of the underlying value, and any bet with positive EV is worth taking (before worrying about sizing).",
        "Watch two traps: forgetting to weight payoffs by probability, and confusing a distribution's most-likely value (mode) with its average (mean), for a maximum or a skewed payoff they differ.",
      ],
      keyIdea: "Fair value = expected value; weight every payoff by its probability.",
      whyInterviewers:
        "Pricing a bet's EV instantly is the foundation of trading.",
      deepDive: {
        whyItWorks:
          "A random payoff's fair price is its probability-weighted average, E = Σ p·x, because that is what you collect on average over many repetitions. Price below EV is a buy and above it a sell, before any adjustment for risk or sizing.",
        approach: [
          "List every possible outcome together with its payoff.",
          "Attach each outcome's probability and check the probabilities sum to one.",
          "Multiply each payoff by its probability and add the products.",
          "Compare that expected value to the quoted price to decide bet or pass.",
        ],
        pitfalls: [
          "Averaging the payoffs without weighting them by their probabilities.",
          "Quoting the most likely outcome (the mode) as if it were the average (the mean), for skewed or extreme-valued payoffs they differ.",
          "Dropping the sign on losing outcomes, so a loss gets added instead of subtracted.",
        ],
      },
    },
  },
  {
    id: "ig-basket",
    title: "Basket & ETF Pricing",
    subtitle: "NAV as a weighted sum",
    blurb:
      "Price a basket (ETF or fruit stand) as the weighted sum of its components, the NAV behind every ETF/Fruit market-making game.",
    difficulty: "medium",
    mode: "numeric",
    masteryThreshold: 0.8,
    numericGenerator: N.genBasketNAV,
    questionCount: 5,
    lesson: {
      paragraphs: [
        "A basket's fair value is the weighted SUM of its parts: NAV = Σ qtyᵢ · priceᵢ. This is how you price an ETF from its holdings, or a fruit basket from unit prices, the core of the ETF Challenge and Fruit games.",
        "The classic slips: adding prices without multiplying by quantity, or averaging the legs instead of summing them. A basket is a total, not a mean.",
      ],
      keyIdea: "Basket / ETF fair value = Σ (quantity × price).",
      whyInterviewers:
        "Pricing a basket instantly is the foundation of ETF and index market making.",
      deepDive: {
        whyItWorks:
          "A basket is worth exactly the sum of what its holdings are worth, so its fair value is Σ (quantity × price). Bundling components together neither creates nor destroys value.",
        approach: [
          "Identify each component's unit price and how many units the basket holds.",
          "Multiply each component's quantity by its price to get that leg's value.",
          "Sum the leg values to obtain the basket's net asset value.",
          "Compare the NAV to the traded price to spot a rich or cheap basket.",
        ],
        pitfalls: [
          "Adding the component prices while forgetting to multiply by the quantities held.",
          "Summing the share counts instead of the dollar values.",
          "Averaging the legs instead of summing them, a basket is a total, not a mean.",
        ],
      },
    },
  },
  {
    id: "ig-fermi",
    title: "Fermi Estimation",
    subtitle: "Guesstimates by decomposition",
    blurb:
      "Order-of-magnitude estimation by decomposition, piano tuners, golf balls in a 747, and why a market's width should scale with uncertainty.",
    difficulty: "medium",
    mode: "flashcard",
    masteryThreshold: 0.8,
    flashcards: FERMI_FLASHCARDS,
    lesson: {
      paragraphs: [
        "Fermi problems are estimated, not computed: break the unknown into factors you can bound (population → pianos → tunings ÷ throughput), multiply, and sanity-check the power of ten. The method is graded, not a single exact number.",
        "This is the 'guesstimate' half of Make-Me-a-Market: quote a fair value from a decomposition, and make your spread WIDER when your uncertainty is larger so an informed counterparty can't pick you off.",
      ],
      keyIdea: "Decompose → multiply → check the order of magnitude; width ∝ uncertainty.",
      whyInterviewers:
        "Guesstimate markets test structured estimation under pressure, a daily trading skill.",
      deepDive: {
        whyItWorks:
          "You can pin an unknown to the right order of magnitude by breaking it into factors you can each bound, since independent over- and under-estimates tend to partly cancel in a product. The target is the correct power of ten, not a precise figure.",
        approach: [
          "Restate the target as a product of a few quantities you can estimate.",
          "Bound each factor with a defensible round number.",
          "Multiply the factors, tracking the powers of ten separately.",
          "Sanity-check the resulting magnitude against anything you already know.",
          "When quoting a market on the estimate, widen your spread as your uncertainty grows.",
        ],
        pitfalls: [
          "Adding the factors instead of multiplying them.",
          "Slipping a power of ten while combining the estimates.",
          "Chasing false precision instead of the order of magnitude the method actually delivers.",
          "Quoting a tight market on a quantity you are very unsure of, inviting a pick-off.",
        ],
      },
    },
  },
  {
    id: "ig-2",
    title: "Optimal Stopping",
    subtitle: "Re-roll games, secretary, divergent EV",
    blurb:
      "Valuing the option to continue, the die re-roll game, the secretary problem's 37% rule, and the St. Petersburg paradox.",
    difficulty: "hard",
    masteryThreshold: 0.75,
    questions: stopping,
    lesson: {
      paragraphs: [
        "When you may act now or wait, the option to continue has value. The die-with-re-roll game is the canonical example: keep a roll only if it beats the EV of rolling again, for a fair d6 that means keeping 4–6 and re-rolling 1–3, giving EV 4.25.",
        "Optimal stopping recurs everywhere: the secretary problem (reject ~37%, then take the next best) and the St. Petersburg paradox (infinite EV, finite willingness to pay) both hinge on valuing the choice to continue.",
      ],
      keyIdea: "Continue iff the current option is worse than E[future]; option value is real.",
      whyInterviewers:
        "Re-roll and stopping games are staple SIG/Citadel decision problems.",
      deepDive: {
        whyItWorks:
          "When you may stop now or continue, holding out is worth what you expect to get by continuing, so you should stop only when the offer in hand beats that continuation value. This option to continue is a real, priceable asset.",
        approach: [
          "Work out the expected payoff of continuing rather than accepting now.",
          "Accept the current option only when it exceeds that continuation value.",
          "For multi-stage problems, reason backward from the final stage's value.",
          "Treat the threshold as the point where stopping and continuing are equally good.",
        ],
        pitfalls: [
          "Ignoring the option to continue and grabbing the first outcome offered.",
          "Comparing the current offer to the best possible outcome instead of the expected continuation value.",
          "Assuming a game with infinite expected value is worth paying an unbounded amount, willingness to pay is governed by utility and risk, not raw EV.",
        ],
      },
    },
  },
  {
    id: "ig-3",
    title: "Optimal Stopping Drills",
    subtitle: "Fresh re-roll and fair-value problems",
    blurb:
      "Fresh re-roll and uniform fair-value drills: keep any roll above a fresh roll's mean, and price a 1..N draw at (N+1)/2.",
    difficulty: "hard",
    mode: "numeric",
    masteryThreshold: 0.8,
    numericGenerator: mixEVNumeric([genReRollDieNumeric, genFairValueNumeric]),
    questionCount: 6,
    lesson: {
      paragraphs: [
        "Now practice the re-roll game and fair-value pricing on fresh numbers. For an N-sided die with one re-roll, the EV is (1/N)·Σ max(x, (N+1)/2): keep any roll at or above the mean of a fresh roll.",
        "Fair value of a uniform draw on 1..N is (N+1)/2, the price a maker quotes around. Watch the off-by-one: the average of 1..N is not N/2.",
      ],
      keyIdea: "Re-roll EV = (1/N)Σ max(x, mean); uniform fair value = (N+1)/2.",
      whyInterviewers: "Speed AND correctness on option-value math.",
      deepDive: {
        whyItWorks:
          "A single re-roll is worth taking only when your current roll is below the average of a fresh roll, so the optimal rule keeps anything at or above that mean. The fair value of a uniform draw is just the midpoint of its inclusive range.",
        approach: [
          "Compute the expected value of a fresh draw, your fallback if you re-roll.",
          "Keep the current result whenever it is at least that fallback, otherwise re-roll.",
          "Average the kept-or-re-rolled outcome over all first-roll possibilities.",
          "For a plain uniform draw, take the midpoint of the smallest and largest values.",
        ],
        pitfalls: [
          "Re-rolling only the single worst value instead of everything below the mean.",
          "Averaging only the outcomes you would keep, as if you never land in the re-roll region.",
          "Using half the top value for a range that starts at one, that drops the endpoint correction.",
        ],
      },
    },
  },
  {
    id: "ig-books",
    title: "Fair Odds: Counting & De-Vigging",
    subtitle: "Conditional pricing and the overround",
    blurb:
      "The updating probability of the next card (card counting), and stripping a bookmaker's overround to recover vig-free probabilities.",
    difficulty: "hard",
    mode: "numeric",
    masteryThreshold: 0.8,
    numericGenerator: mixTradingNumeric([N.genNextCardFairProb, N.genDeVig]),
    questionCount: 6,
    lesson: {
      paragraphs: [
        "As cards leave a deck the fair probability UPDATES: with r reds of r+b cards left, P(next red) = r/(r+b), not the original ½. This card-counting update is the Next-Card betting game.",
        "Quoted decimal odds imply probabilities 1/o that sum to more than 1, the overround (vig). Strip it by normalizing: fair pᵢ = (1/oᵢ) / Σ(1/oⱼ). If the booksum is below 1, there is a Dutch-book arbitrage.",
      ],
      keyIdea: "P(next) = favorable/remaining; fair odds = implied ÷ booksum.",
      whyInterviewers:
        "Updating probabilities and removing the vig are how you price sequential and cross-outcome markets.",
      deepDive: {
        whyItWorks:
          "A conditional probability is just the favorable count over the total still remaining, so it updates every time a card leaves the deck. Quoted odds imply probabilities inflated by the bookmaker's margin, so you recover fair probabilities by rescaling them to sum to one.",
        approach: [
          "For a sequential draw, count the favorable and total items still remaining.",
          "Form the ratio favorable ÷ remaining as the updated probability.",
          "For a book, convert each decimal price to its implied probability (its reciprocal).",
          "Add the implied probabilities to measure the overround, then divide each by that sum.",
          "Read a total below one as a Dutch-book arbitrage in the bettor's favor.",
        ],
        pitfalls: [
          "Using the full-deck probability instead of re-conditioning on the cards already gone.",
          "Treating raw implied probabilities as fair without stripping the overround.",
          "Normalizing by the sum of the odds rather than the sum of the implied probabilities.",
          "Reading the booksum backwards, an arbitrage needs it below one, a bookmaker edge is above one.",
        ],
      },
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
        "Two levers: (1) set your spread proportional to your uncertainty about fair value, and (2) skew both quotes to manage inventory, shift down when you're too long to encourage selling your excess.",
      ],
      keyIdea: "Spread ∝ uncertainty; skew quotes to flatten inventory.",
      whyInterviewers:
        "This IS the job, quoting, sizing, and managing risk on live flow.",
      deepDive: {
        whyItWorks:
          "A market maker earns the spread but suffers adverse selection: informed counterparties trade with you precisely when your price is wrong, so a symmetric quote loses in expectation. You defend by widening the spread as your uncertainty grows and skewing quotes to shed unwanted inventory.",
        approach: [
          "Center your quotes on your best estimate of fair value.",
          "Recognize you get filled on whichever side an informed trader profits from.",
          "Set the spread wider when your uncertainty about fair value is larger.",
          "Skew both quotes toward the side that reduces your current inventory.",
        ],
        pitfalls: [
          "Assuming a symmetric two-sided quote breaks even against informed flow.",
          "Tightening the spread into rising uncertainty, inviting a pick-off.",
          "Skewing the wrong way, so an over-long position attracts even more buying.",
          "Believing inventory doesn't affect optimal quotes, carrying risk should shift them.",
        ],
      },
    },
  },
  {
    id: "ig-trading-decisions",
    title: "Trading Decisions",
    subtitle: "Arbitrage, edge & adverse selection",
    blurb:
      "A capstone of trading decisions: ETF/NAV and Dutch-book arbitrage, +EV bet/pass calls, adverse-selection P&L, and Fermi sanity checks.",
    difficulty: "expert",
    masteryThreshold: 0.75,
    generator: mixTradingQuiz([
      Q.genBasketArb,
      Q.genVigArb,
      Q.genNextCardBet,
      Q.genMakeMarketPnl,
      Q.genFermiMagnitude,
    ]),
    questionCount: 8,
    lesson: {
      paragraphs: [
        "Every trading game reduces to a decision under a computed edge: is the ETF rich or cheap versus NAV, does a book admit an arbitrage, is a ticket +EV to buy, and what does adverse selection do to a naive two-sided quote?",
        "The recurring traps: trading the wrong side of a mispricing, reading a booksum backwards, comparing to ½ instead of the conditional fair value, and assuming a symmetric market breaks even against informed flow.",
      ],
      keyIdea: "Compute the edge, then act on it, and price in adverse selection.",
      whyInterviewers:
        "This is the desk in miniature: quote, price the edge, and decide, fast and correctly.",
      deepDive: {
        whyItWorks:
          "Every trading decision reduces to computing an edge, the gap between fair value and the quoted price, then acting on its sign, while pricing in adverse selection. Fair value comes from the same toolkit throughout: expected value, NAV, conditional probability, and de-vigging.",
        approach: [
          "Compute fair value with the tool the situation calls for (EV, NAV, conditional probability, de-vig).",
          "Compare fair value to the quoted price to find the size and sign of the edge.",
          "Buy the cheap leg and sell the rich one; pass when there is no edge.",
          "Discount any two-sided quote for the adverse selection that informed flow imposes.",
        ],
        pitfalls: [
          "Trading the wrong side of a mispricing, locking in a loss.",
          "Reading a booksum backwards when judging whether an arbitrage exists.",
          "Comparing a sequential bet to one-half instead of the conditional fair value.",
          "Assuming a symmetric market breaks even against informed traders.",
        ],
      },
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
