import type { Level, Track } from "@/types/content";
import { ALL_MM_GENERATORS, MM_EASY, MM_HARD, MM_MEDIUM, mixed } from "./generators";

const A = ALL_MM_GENERATORS;

/**
 * Mental Math track — all generator-based, so every drill is fresh and exact.
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
    masteryThreshold: 0.8,
    generator: mixed(MM_EASY),
    questionCount: 8,
    lesson: {
      paragraphs: [
        "Mental math is the GATE at most trading firms (Optiver's 80-in-8, Jane Street's 60-in-8). Speed comes from decomposition: add hundreds→tens→ones; multiply by splitting a two-digit number into its tens and ones.",
        "Percentages: x% of N = (x/100)·N. Anchor off 10% (move the decimal) and scale — 15% = 10% + half of 10%.",
      ],
      keyIdea: "Decompose, anchor on 10%, and check the order of magnitude.",
      whyInterviewers: "Fail the timed arithmetic screen and the process ends.",
    },
  },
  {
    id: "mm-2",
    title: "Speed Round",
    subtitle: "Two-digit products, division, fractions",
    blurb:
      "Two-digit multiplication via the four cross-terms, division by estimating first, and the common fraction↔decimal conversions.",
    difficulty: "medium",
    masteryThreshold: 0.8,
    generator: mixed(MM_MEDIUM),
    questionCount: 8,
    lesson: {
      paragraphs: [
        "For 2×2 multiplication use the distributive expansion (a+b)(c+d): tens×tens + tens×ones + ones×tens + ones×ones. Forgetting one of the four cross-terms is the most common error.",
        "Division: estimate the quotient's magnitude first, then refine. Memorize the common fraction↔decimal conversions (1/8 = .125, 1/16 = .0625, 3/4 = .75) — they recur constantly in pricing.",
      ],
      keyIdea: "Expand products into four cross-terms; estimate before refining.",
      whyInterviewers: "Two-digit speed is the difference between passing and not.",
    },
  },
  {
    id: "mm-3",
    title: "Optiver Sprint",
    subtitle: "Hardest mixed arithmetic at pace",
    blurb:
      "Hardest mixed arithmetic at ~6 seconds a question, using shortcuts like difference-of-squares and ×5 = halve-then-×10.",
    difficulty: "hard",
    masteryThreshold: 0.8,
    generator: mixed(MM_HARD),
    questionCount: 10,
    lesson: {
      paragraphs: [
        "This is the pressure tier: larger products, exact division, and conversions mixed together, the way a real timed test throws them at you. Aim for ~6 seconds per question.",
        "Trade a little accuracy tooling for speed: round, compute, adjust. For 48×52, recognize (50−2)(50+2)=2500−4=2496 — difference-of-squares tricks save seconds.",
      ],
      keyIdea: "Pattern-match to shortcuts (a²−b², ×5 = ÷2 then ×10).",
      whyInterviewers: "Mirrors the 6-seconds-per-question firm screens.",
    },
  },
  {
    id: "mm-4",
    title: "Trader Conversions",
    subtitle: "Percents, fractions, and odds ↔ probability",
    blurb:
      "Converting between percents, fractions, and odds↔probability — the a:b-against ⇒ b/(a+b) fluency market makers quote with.",
    difficulty: "hard",
    masteryThreshold: 0.8,
    generator: mixed([A.genPercent, A.genFractionToDecimal, A.genOddsToProb]),
    questionCount: 8,
    lesson: {
      paragraphs: [
        "Traders constantly convert between odds, probabilities, fractions, and percents. Odds of a:b AGAINST an event mean b favorable to a unfavorable, so the probability the event happens is b/(a+b) — mind the direction.",
        "Fluency here underpins market making: a price of implied 'x-to-1' must instantly become a probability so you can judge whether a quote is cheap or rich.",
      ],
      keyIdea: "Odds a:b against ⇒ P(event) = b/(a+b). Watch the direction.",
      whyInterviewers:
        "Odds↔probability conversions are the vocabulary of quoting.",
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
