import type {
  Level,
  NumericQuestionGenerator,
  QuestionGenerator,
} from "@/types/content";
import {
  ARBITRAGE_NUMERIC_GENERATORS,
  ARBITRAGE_QUIZ_GENERATORS,
} from "./generators";

/**
 * A few illustrative `Level` objects for the no-arbitrage / de-vig drill. These
 * are DECLARED here for reuse but intentionally NOT registered into any track or
 * catalog — wiring them into the roadmap/course machinery is the Integrator's
 * job (see the T3 handoff). Each level draws fresh, exact-verified items from the
 * generators in `generators.ts`.
 */

/** Deterministically pick one quiz generator per call (a lightweight mixer). */
function mixQuiz(pool: QuestionGenerator[]): QuestionGenerator {
  return (rng) => pool[rng.int(0, pool.length - 1)](rng);
}

/** Deterministically pick one numeric generator per call. */
function mixNumeric(pool: NumericQuestionGenerator[]): NumericQuestionGenerator {
  return (rng) => pool[rng.int(0, pool.length - 1)](rng);
}

export const ARBITRAGE_LEVELS: Level[] = [
  {
    id: "arb-implied-prob",
    title: "Odds → Implied Probability",
    subtitle: "Read a quote as a probability",
    blurb:
      "Convert decimal, fractional, and American-moneyline odds into the implied probability 1/o — the raw building block of every book.",
    section: "No-Arbitrage",
    difficulty: "easy",
    mode: "numeric",
    masteryThreshold: 0.8,
    numericGenerator: ARBITRAGE_NUMERIC_GENERATORS.genImpliedProb,
    questionCount: 6,
    lesson: {
      paragraphs: [
        "Every quoted price is a probability in disguise. Decimal odds o pay o per unit staked (stake included), so the market's implied probability is exactly 1/o.",
        "Fractional odds a/b imply b/(a+b); American moneylines convert to a decimal first, then invert. Learn to read any quote as a probability and the rest of the drill follows.",
      ],
      keyIdea: "Implied probability = 1 / decimal odds.",
      whyInterviewers:
        "Traders must translate any quote convention into a probability instantly to compare prices and spot edge.",
    },
  },
  {
    id: "arb-devig",
    title: "Strip the Vig",
    subtitle: "Normalize implied probs to sum to 1",
    blurb:
      "Raw implied probabilities on a real book sum to more than 1 (the overround). Divide each by the booksum to recover fair probabilities.",
    section: "No-Arbitrage",
    difficulty: "medium",
    mode: "numeric",
    masteryThreshold: 0.8,
    numericGenerator: ARBITRAGE_NUMERIC_GENERATORS.genDeVigFair,
    questionCount: 6,
    lesson: {
      paragraphs: [
        "A bookmaker builds in a margin, so Σ(1/oᵢ) > 1. That excess is the overround — the house edge.",
        "To recover the fair probability of any outcome, divide its raw implied prob by the booksum so the whole set sums to exactly 1. This 'de-vigging' is pure normalization.",
      ],
      keyIdea: "fairᵢ = (1/oᵢ) / Σ(1/oⱼ).",
      whyInterviewers:
        "De-vigging separates the market's true probability estimate from the margin baked into the quote.",
    },
  },
  {
    id: "arb-detect",
    title: "Dutch-Book Detection",
    subtitle: "Arbitrage, overround, or fair?",
    blurb:
      "Classify a book from its booksum: below 1 is a Dutch-book arbitrage, above 1 is the bookmaker's overround, exactly 1 is fair.",
    section: "No-Arbitrage",
    difficulty: "medium",
    mode: "quiz",
    masteryThreshold: 0.8,
    generator: ARBITRAGE_QUIZ_GENERATORS.genArbDetect,
    questionCount: 6,
    lesson: {
      paragraphs: [
        "The booksum Σ(1/oᵢ) tells you everything. If it dips below 1, the outcomes are collectively over-priced — back them all for a guaranteed profit (a Dutch book).",
        "Above 1, the overround is the house's edge; equal to 1, the book is fair. The only skill is reading the inequality the right way round.",
      ],
      keyIdea: "booksum < 1 ⇒ arbitrage · > 1 ⇒ overround · = 1 ⇒ fair.",
      whyInterviewers:
        "Spotting a locked-in edge (and its direction) under time pressure is the essence of a market-making seat.",
    },
  },
  {
    id: "arb-sizing",
    title: "Sizing the Arbitrage",
    subtitle: "Stake for a guaranteed profit",
    blurb:
      "On a Dutch-book, size each stake proportional to its implied probability so every outcome returns the same — then bank the locked-in profit.",
    section: "No-Arbitrage",
    difficulty: "hard",
    mode: "numeric",
    masteryThreshold: 0.8,
    numericGenerator: mixNumeric([
      ARBITRAGE_NUMERIC_GENERATORS.genArbStake,
      ARBITRAGE_NUMERIC_GENERATORS.genArbProfit,
    ]),
    questionCount: 6,
    lesson: {
      paragraphs: [
        "Detecting an arb is half the job; sizing it is the other half. Stake each leg proportional to 1/oᵢ so the payout is identical whichever outcome lands.",
        "The common return is total/booksum, so the guaranteed profit is total·(1 − booksum)/booksum. Get the sizing wrong and the 'sure thing' can still lose on some outcomes.",
      ],
      keyIdea: "stakeᵢ = total·(1/oᵢ)/booksum · profit = total·(1 − booksum)/booksum.",
      whyInterviewers:
        "An edge you can't size correctly isn't an edge — sizing to equalize payouts is what makes it risk-free.",
    },
  },
  {
    id: "arb-basket-value",
    title: "Baskets & Value Legs",
    subtitle: "Parts-vs-whole and mispriced legs",
    blurb:
      "Price a basket as the weighted sum of its parts, trade the mispricing in the right direction, and pick the positive-EV leg against a model.",
    section: "No-Arbitrage",
    difficulty: "hard",
    mode: "quiz",
    masteryThreshold: 0.8,
    generator: mixQuiz([
      ARBITRAGE_QUIZ_GENERATORS.genBasketArb,
      ARBITRAGE_QUIZ_GENERATORS.genValueLeg,
    ]),
    questionCount: 6,
    lesson: {
      paragraphs: [
        "A basket (or ETF) is worth the weighted sum of its components — Σ qty×price. When the whole trades away from that NAV, sell the rich side and buy the cheap one.",
        "Against a probability model, the value leg is the one with p·o > 1 — never assume the short-odds favorite is the bet.",
      ],
      keyIdea: "NAV = Σ qty×price · value bet ⇔ p·o > 1.",
      whyInterviewers:
        "Relative-value trades — whole vs parts, model vs market — are the bread and butter of arbitrage desks.",
    },
  },
];
