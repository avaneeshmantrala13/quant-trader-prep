import type { Level, Track } from "@/types/content";
import { mixNumericGenerators } from "../mixFamilies";
import {
  MM_CONVERSIONS_NUMERIC,
  MM_EASY_NUMERIC,
  MM_HARD_NUMERIC,
  MM_MEDIUM_NUMERIC,
} from "./generators";

/**
 * Mental Math track — all generator-based, so every drill is fresh and exact.
 * Every drill is a pure ARITHMETIC computation whose answer is a NUMBER, so all
 * four levels are FREE-RESPONSE (`mode: "numeric"`): the learner types the
 * result and it is graded by `gradeFreeResponse`, with per-family parametric
 * error-mode catalogs (dropped carries, place-value slips, operation confusions,
 * inverted fractions, flipped odds) driving the rung-1 coaching.
 * Modeled on Zetamac, Optiver's "80 in 8 minutes", and Jane Street's 60-in-8:
 * fast, accurate arithmetic and the odds/decimal conversions traders live on.
 */
const levels: Level[] = [
  {
    id: "mm-1",
    title: "Warm-Up",
    subtitle: "Addition, subtraction, small products, percents",
    blurb:
      "Fast addition, subtraction, small products, and percentages by decomposing numbers and anchoring on 10%.",
    difficulty: "easy",
    mode: "numeric",
    masteryThreshold: 0.8,
    numericGenerator: mixNumericGenerators(MM_EASY_NUMERIC),
    questionCount: 8,
    lesson: {
      paragraphs: [
        "Mental math is the GATE at most trading firms (Optiver's 80-in-8, Jane Street's 60-in-8). Speed comes from decomposition: add hundreds→tens→ones; multiply by splitting a two-digit number into its tens and ones.",
        "Percentages: x% of N = (x/100)·N. Anchor off 10% (move the decimal) and scale — 15% = 10% + half of 10%.",
      ],
      keyIdea: "Decompose, anchor on 10%, and check the order of magnitude.",
      whyInterviewers: "Fail the timed arithmetic screen and the process ends.",
      deepDive: {
        whyItWorks:
          "Decomposition works because addition and multiplication distribute over place value: a number is the sum of its hundreds, tens, and ones, so you can operate on the parts and recombine. A percentage is just (x/100)·N, and 10% is a single decimal shift, so every other percentage scales off it.",
        approach: [
          "Split each number into its place-value parts — hundreds, tens, ones.",
          "Combine matching places, carrying or borrowing where a column overflows.",
          "For a two-digit × one-digit product, multiply the tens and the ones separately, then add.",
          "For a percentage, take 10% by shifting the decimal, then scale to the target percent.",
          "Glance at the order of magnitude to confirm the answer is sane.",
        ],
        pitfalls: [
          "Dropping or mishandling a carry or borrow between columns.",
          "Forgetting to divide by 100 when taking a percentage.",
          "Misplacing the decimal point when finding 10%.",
          "Losing track of one place-value piece in a product.",
        ],
      },
    },
  },
  {
    id: "mm-2",
    title: "Speed Round",
    subtitle: "Two-digit products, division, fractions",
    blurb:
      "Two-digit multiplication via the four cross-terms, division by estimating first, and the common fraction↔decimal conversions.",
    difficulty: "medium",
    mode: "numeric",
    masteryThreshold: 0.8,
    numericGenerator: mixNumericGenerators(MM_MEDIUM_NUMERIC),
    questionCount: 8,
    lesson: {
      paragraphs: [
        "For 2×2 multiplication use the distributive expansion (a+b)(c+d): tens×tens + tens×ones + ones×tens + ones×ones. Forgetting one of the four cross-terms is the most common error.",
        "Division: estimate the quotient's magnitude first, then refine. Memorize the common fraction↔decimal conversions (1/8 = .125, 1/16 = .0625, 3/4 = .75) — they recur constantly in pricing.",
      ],
      keyIdea: "Expand products into four cross-terms; estimate before refining.",
      whyInterviewers: "Two-digit speed is the difference between passing and not.",
      deepDive: {
        whyItWorks:
          "Two-digit multiplication expands by the distributive law: (a+b)(c+d) is the sum of four cross-terms, which is exact. Division is the inverse of multiplication, so estimating the quotient's size first bounds where the answer must land, and the common fraction↔decimal equivalents are fixed identities worth memorizing rather than recomputing.",
        approach: [
          "Split each two-digit factor into its tens and ones.",
          "Form all four cross-products — tens×tens, tens×ones, ones×tens, ones×ones — and add them.",
          "For division, first estimate the quotient's magnitude, then refine toward the exact fit.",
          "Recall a memorized fraction↔decimal conversion instead of dividing from scratch.",
        ],
        pitfalls: [
          "Forgetting one of the four cross-terms in the expansion.",
          "Misaligning place value when adding the partial products.",
          "Skipping the magnitude estimate and landing an order of magnitude off.",
          "Inverting a fraction (denominator ÷ numerator) when converting to a decimal.",
        ],
      },
    },
  },
  {
    id: "mm-3",
    title: "Optiver Sprint",
    subtitle: "Hardest mixed arithmetic at pace",
    blurb:
      "Hardest mixed arithmetic at ~6 seconds a question, using shortcuts like difference-of-squares and ×5 = halve-then-×10.",
    difficulty: "hard",
    mode: "numeric",
    masteryThreshold: 0.8,
    numericGenerator: mixNumericGenerators(MM_HARD_NUMERIC),
    questionCount: 10,
    lesson: {
      paragraphs: [
        "This is the pressure tier: larger products, exact division, and conversions mixed together, the way a real timed test throws them at you. Aim for ~6 seconds per question.",
        "Trade a little accuracy tooling for speed: round, compute, adjust. For 48×52, recognize (50−2)(50+2)=2500−4=2496 — difference-of-squares tricks save seconds.",
      ],
      keyIdea: "Pattern-match to shortcuts (a²−b², ×5 = ÷2 then ×10).",
      whyInterviewers: "Mirrors the 6-seconds-per-question firm screens.",
      deepDive: {
        whyItWorks:
          "Speed at this tier comes from exact algebraic identities that swap a hard step for an easy one: (a−b)(a+b) = a² − b² turns a product whose factors sit symmetrically on either side of a round number into a square minus a square, and ×5 is the same as ×10 then ÷2. Because these are equalities, they cost nothing in accuracy.",
        approach: [
          "Scan each problem for a round number its values sit near.",
          "When two factors sit equidistantly on either side of a round centre, use a² − b²: square the centre and subtract the offset squared.",
          "Swap ×5 for ×10 then halve, and use similar round-then-adjust moves.",
          "Round to make the computation easy, then apply the exact correction.",
          "Keep a running magnitude estimate as a guardrail under time pressure.",
        ],
        pitfalls: [
          "Applying difference-of-squares when the factors aren't symmetric about a centre.",
          "Forgetting to subtract the offset-squared correction term.",
          "Rounding to speed up but never applying the adjustment back.",
          "Trading away so much accuracy that the 'shortcut' no longer gives the exact answer.",
        ],
      },
    },
  },
  {
    id: "mm-4",
    title: "Trader Conversions",
    subtitle: "Percents, fractions, and odds ↔ probability",
    blurb:
      "Converting between percents, fractions, and odds↔probability — the a:b-against ⇒ b/(a+b) fluency market makers quote with.",
    difficulty: "hard",
    mode: "numeric",
    masteryThreshold: 0.8,
    numericGenerator: mixNumericGenerators(MM_CONVERSIONS_NUMERIC),
    questionCount: 8,
    lesson: {
      paragraphs: [
        "Traders constantly convert between odds, probabilities, fractions, and percents. Odds of a:b AGAINST an event mean b favorable to a unfavorable, so the probability the event happens is b/(a+b) — mind the direction.",
        "Fluency here underpins market making: a price of implied 'x-to-1' must instantly become a probability so you can judge whether a quote is cheap or rich.",
      ],
      keyIdea: "Odds a:b against ⇒ P(event) = b/(a+b). Watch the direction.",
      whyInterviewers:
        "Odds↔probability conversions are the vocabulary of quoting.",
      deepDive: {
        whyItWorks:
          "Odds and probability describe the same event in different vocabularies. Odds of a:b AGAINST list a unfavorable outcomes to b favorable, so the probability the event happens is favorable ÷ total = b/(a+b). Percents and fractions are just other encodings of that same ratio.",
        approach: [
          "Read the odds direction carefully — against the event versus for it.",
          "Identify which count is favorable and which is unfavorable.",
          "Compute the probability as favorable ÷ (favorable + unfavorable).",
          "Convert between fraction, decimal, and percent as the question demands.",
        ],
        pitfalls: [
          "Flipping the odds direction and putting the unfavorable count in the numerator.",
          "Reporting the odds ratio itself as though it were a probability.",
          "Miscounting the total as just one side instead of the sum of both.",
          "Decimal- or percent-placement slips in the final conversion.",
        ],
      },
    },
  },
];

export const mentalMathTrack: Track = {
  id: "mental-math",
  title: "Mental Math",
  tagline: "Zetamac / Optiver-style speed arithmetic",
  description:
    "Fast, exact arithmetic and trader conversions — the timed screen that gates every quant interview. Fresh problems every attempt.",
  motif: "mentalMath",
  levels,
};
