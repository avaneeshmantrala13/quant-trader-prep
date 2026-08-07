import type { Flashcard } from "@/types/content";
import { optimalSpread } from "../coreSolvers";

/**
 * Reasoning-desk flashcard re-homed from the former "General" reasoning desk
 * into **Game Theory & Puzzles** (gp-3, the Betting/Market desk): the two-sided
 * market-making quote against informed + uninformed flow, the deliverable is a
 * MARKET (bid AND ask), not a single scalar. Numbers come from the verified
 * solver in `../coreSolvers`.
 */
const { bid, ask, spread } = optimalSpread();

export const gamePuzzleGeneralFlashcards: Flashcard[] = [
  {
    // GN37. Optimal Spread, the answer is a two-sided MARKET, not a scalar.
    id: "gen-fc-market",
    prompt:
      "You must quote a two-sided market (a bid and an ask) on an outcome uniform on [0,1]. 500 traders are INFORMED (know the outcome) and 500 are UNINFORMED (trade at a uniform-random value); everyone trades only when it is profitable in expectation. What market should you quote, and what spread does it imply?",
    answer:
      `Quote bid = ${bid.valueOf().toFixed(3)} and ask = ${ask.valueOf().toFixed(3)}, a market of 0.167 at 0.833, i.e. a spread of ${spread.toFraction(false)} (≈ ${spread.valueOf().toFixed(3)}) centred on 0.5. The deliverable is the MARKET (two quotes), not a single number.`,
    explanation:
      "Let X be the spread (quotes at 0.5 ± X/2). Uninformed traders: a fraction (1−X) still find it worth trading, split half-buy/half-sell, each paying you X/2 → revenue (1−X)·(500)·(X/2)·?, in the standard setup E[revenue] = 250·X·(1−X). Informed traders: a fraction (1−X) trade, always adversely, expected loss 125·(1−X)². So E[PnL] = 250X(1−X) − 125(1−X)² = −375X² + 500X − 125. Maximise: d/dX = −750X + 500 = 0 ⇒ X* = 2/3. Then bid = (1−X*)/2 = 1/6 ≈ 0.167 and ask = 1 − bid = 5/6 ≈ 0.833. Widening beyond 2/3 loses too much uninformed volume; tightening bleeds to the informed. The interview answer must be the two-sided quote plus the 2/3 spread derivation.",
    difficulty: "hard",
    concept: "Market-making spread optimisation (informed vs uninformed flow)",
    source: "Game Theory & Puzzles · Market making (a market, not a scalar)",
  },
];
