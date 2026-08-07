import type { Level } from "@/types/content";
import { gamePuzzleFlashcards, genArbitrage, genRigBags } from "./generators";
// Re-homed from the former "General" reasoning desk (a two-sided market quote).
import { gamePuzzleGeneralFlashcards } from "./generalFlashcards";

/**
 * Game Puzzle, a small Probability & Statistics subcategory (betting / odds
 * puzzles). NOTE: as of the section-consolidation pass these levels are tagged
 * `section: "Game Theory & Puzzles"` and are interleaved (by difficulty) with
 * the Game Theory family in `../index.ts` to form ONE merged Easy→Hard segment
 * on the Probability/Math map, rather than a 3-level standalone section. The
 * subcategory module/tests are otherwise unchanged. Modes:
 *
 *   • `numeric`  . Rig the Bags (law of total probability optimization) and
 *                   arbitrage detection (implied-probability sum): the two
 *                   families with an exact verifiable scalar.
 *   • `flashcard`, arbitrage construction, value betting, and parimutuel:
 *                   open-ended ("many valid allocations, no single vector"),
 *                   with the source firms preserved as metadata.
 *
 * See `./puzzles.ts` (exact solvers) and `./generators.ts`. None of the 4
 * source-dataset questions are user-facing, they live only in
 * `./gamePuzzle.test.ts` as hidden fixtures.
 */
export const gamePuzzleLevels: Level[] = [
  {
    id: "gp-1",
    title: "Rig the Bags",
    subtitle: "Law of total probability optimization",
    blurb:
      "Split gold/black tokens between two bags to maximize P(draw gold), using the lone-winning-token trick.",
    section: "Game Theory & Puzzles",
    difficulty: "easy",
    mode: "numeric",
    masteryThreshold: 0.8,
    questionCount: 5,
    numericGenerator: genRigBags,
    lesson: {
      paragraphs: [
        "When an experiment happens in stages, use the LAW OF TOTAL PROBABILITY: P(win) = Σ P(win | stage₁) · P(stage₁). Picking one of two bags then drawing gives P(win) = ½·f₁ + ½·f₂, the average of the two bags' gold-fractions.",
        "To maximize an average of fractions, make one of them as large as possible for free: put a SINGLE gold token alone in a bag (fraction 1), and dump everything else in the other bag. Half the time you win for sure; the other half you still win at nearly the leftover rate.",
      ],
      keyIdea: "P(win) = ½·f₁ + ½·f₂; isolate one gold token to force f₁ = 1.",
      whyInterviewers:
        "It rewards restructuring a problem to exploit a free degree of freedom, the essence of finding edge.",
      deepDive: {
        whyItWorks:
          "A staged experiment is handled by the law of total probability: the overall win chance is the average of the conditional win chances, weighted by how the first stage is chosen. When you control the arrangement, you exploit a free degree of freedom to push one conditional probability as high as possible.",
        approach: [
          "Decompose the win probability by conditioning on the first-stage choice.",
          "Express it as the weighted average of each configuration's success rate.",
          "Look for a free structural choice that can drive one conditional rate to its maximum.",
          "Allocate the remaining items to keep the other rate as high as possible.",
        ],
        pitfalls: [
          "Forgetting to weight each branch by the probability of selecting it.",
          "Splitting items evenly instead of restructuring for an edge.",
          "Overlooking that isolating a single sure-win item maximises one branch for free.",
        ],
      },
    },
  },
  {
    id: "gp-2",
    title: "Spotting Arbitrage",
    subtitle: "Implied probability & sub-100% books",
    blurb:
      "Convert decimal odds to implied probabilities and detect arbitrage: a set of outcomes summing below 1.00.",
    section: "Game Theory & Puzzles",
    difficulty: "hard",
    mode: "numeric",
    masteryThreshold: 0.75,
    questionCount: 5,
    numericGenerator: genArbitrage,
    lesson: {
      paragraphs: [
        "Every set of quoted odds implies a probability. For decimal odds o, the implied (break-even) probability is 1/o. Sum the implied probabilities across all mutually-exclusive outcomes of an event.",
        "If that sum is BELOW 1.00, the book is 'sub-100%' and an arbitrage exists, you can stake inversely to the odds so every outcome returns more than you staked. At or above 1.00 there's no arb; the excess is the bookmaker's overround (margin). The classic slips: adding the odds instead of their reciprocals, or using net odds (o−1) instead of gross o.",
      ],
      keyIdea: "Implied prob = 1/o; Σ implied < 1 ⇒ arbitrage.",
      whyInterviewers:
        "Reading mispriced, mutually-exclusive claims for a riskless edge is exactly what a desk does.",
      deepDive: {
        whyItWorks:
          "Every decimal-odds quote implies a break-even probability equal to its reciprocal; for mutually-exclusive, exhaustive outcomes a fair book's implied probabilities sum to one. When they sum below one the market is underpricing certainty, so you can stake across all outcomes for a guaranteed profit.",
        approach: [
          "Convert each decimal-odds quote to its implied probability by taking the reciprocal.",
          "Sum the implied probabilities across all mutually-exclusive outcomes.",
          "Compare the sum to one, below one signals arbitrage, above one is the bookmaker's margin.",
          "If an arb exists, stake each outcome inversely to its odds to lock it in.",
        ],
        pitfalls: [
          "Adding the odds themselves instead of their reciprocals.",
          "Using net odds instead of gross decimal odds.",
          "Mistaking a normal overround (sum above one) for an opportunity.",
        ],
      },
    },
  },
  {
    id: "gp-3",
    title: "Betting Strategy Desk",
    subtitle: "Arbitrage, value betting & parimutuel",
    blurb:
      "Reason through open-ended arbitrage-construction, value-betting, and parimutuel scenarios, then reveal and self-assess.",
    section: "Game Theory & Puzzles",
    difficulty: "hard",
    mode: "flashcard",
    masteryThreshold: 0.75,
    flashcards: [...gamePuzzleFlashcards, ...gamePuzzleGeneralFlashcards],
    lesson: {
      paragraphs: [
        "Some betting puzzles have no single right answer, the deliverable is a STRATEGY plus a representative winning book. Three families: single-book arbitrage (stake inversely to the odds when implied probabilities sum below 1), cross-book arbitrage (take the best price per outcome across bookmakers), value betting (when no arb exists, bet where true probability × payout exceeds 1), and parimutuel (no fixed odds, load empty/thin teams and lightly cover the crowd to cap downside).",
        "These are integrity-based flashcards: reason it through, reveal the worked strategy, and self-assess. Aim to identify the family, state the principle, and give one concrete allocation.",
      ],
      keyIdea: "Arbitrage / value / parimutuel, strategy over a single number.",
      whyInterviewers:
        "Open-ended 'construct a profitable book' questions test whether you can turn mispricing into a concrete, risk-managed plan.",
      deepDive: {
        whyItWorks:
          "These puzzles ask for a strategy plus a representative winning book rather than one number. The unifying idea is to compare quoted prices against true or best-available probabilities: bet only where the odds are in your favour, and size stakes to control downside across outcomes.",
        approach: [
          "Classify the situation: single-book arb, cross-book arb, value bet, or parimutuel.",
          "Convert prices to implied probabilities and compare against true or best-available prices.",
          "If a riskless edge exists, stake inversely to the odds to lock it in.",
          "Otherwise bet where expected value is positive and size stakes to cap downside.",
        ],
        pitfalls: [
          "Chasing a single 'right' allocation when many valid winning books exist.",
          "Betting where the price offers no genuine edge.",
          "Ignoring stake-sizing so one outcome can wipe out the others.",
        ],
      },
    },
  },
];
