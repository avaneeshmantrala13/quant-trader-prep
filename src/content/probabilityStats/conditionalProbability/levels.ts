import type { Level } from "@/types/content";
import {
  conditionalProbabilityFlashcards,
  genAllOn,
  genBayesTest,
  genBertrand,
  genBoth,
  genCheerLoser,
  genFirstStep,
  genFirstToss,
  genGivenSum,
  genInversion,
  genLotpLine,
  genRRFixed,
  genRRRespun,
  genRRTwoConsecutive,
  genRRTwoRandom,
  genSumRace,
  genTable,
  genTie,
  genTransfer,
  genUniform,
  genWhichDie,
  mixNumeric,
  mixQuiz,
} from "./generators";
// Re-homed from the former "General" reasoning desk (a stopping-rule invariant).
import { conditionalGeneralFlashcards } from "./generalFlashcards";

/**
 * Conditional Probability — the FIFTH Probability & Statistics subcategory.
 * Conditional probability is NOT one repeating template — the 45-question
 * dataset spans a cluster of solution-method FAMILIES: reduced sample space /
 * equally-likely counting, Bayes' theorem, law of total probability, continuous
 * conditioning, competing-events / race conditioning, first-step recursion, the
 * Russian-Roulette series, two-child framing paradoxes, and counterintuitive
 * classics. The families are clustered into 6 Candy-Crush levels ramping
 * Easy → Hard, each grouping related families and using the mode that best
 * teaches them:
 *
 *   • `quiz`      — where NAMING the misconception is the lesson: reduced sample
 *                   space (the Pine reversed-conditional & ordered-vs-unordered
 *                   traps), Bayes (base-rate neglect, likelihood-as-posterior),
 *                   and the Russian-Roulette spin/no-spin decisions.
 *   • `numeric`   — where a clean probability is the point: law of total
 *                   probability, continuous conditioning, and race conditioning.
 *   • `flashcard` — the framing paradoxes whose answer is two-part or a decision
 *                   + probability (Child's Gender, Monty Hall, Bertrand, Vacant
 *                   Room) — reason it through, reveal, self-assess.
 *
 * Every level sets `section: "Conditional Probability"` so the map / Table of
 * Contents render a labeled segment. Exact solvers live in `./cp.ts`; the
 * generators + per-family distractor taxonomy in `./generators.ts`. NONE of the
 * 45 source questions are user-facing — they live only in
 * `./conditionalProbability.test.ts`.
 */
const SECTION = "Conditional Probability";

export const conditionalProbabilityLevels: Level[] = [
  {
    id: "cp-1",
    title: "Reduced Sample Space",
    subtitle: "Discard, then re-count the survivors",
    blurb:
      "Master P(A|B) = #(A∩B)/#B: the Pine reversed-conditional trap, ordered-vs-unordered dice, faces-not-objects, and at-least-one conditioning.",
    section: SECTION,
    difficulty: "easy",
    mode: "quiz",
    masteryThreshold: 0.8,
    questionCount: 6,
    generator: mixQuiz([genTable, genBoth, genGivenSum, genBertrand, genAllOn]),
    lesson: {
      paragraphs: [
        "When outcomes are equally likely and you're told a conditioning fact, throw away every outcome inconsistent with it and take the target's share of what remains: P(A|B) = #(A∩B)/#B. The single most common slip is answering the REVERSED conditional — the 'Pine Property' trap — computing P(B|A) instead of the P(A|B) that was asked.",
        "Two counting habits keep you honest. Count ORDERED outcomes for distinct dice ((2,5) and (5,2) are different rolls), and count FACES not OBJECTS for the disc/box problems — an all-green disc shows green twice as often, so seeing green is evidence for it. 'At least one' conditioning (both sixes given a six; all bulbs on given one on) pools overlapping cases, giving 1/(2N−1) and 1/(2ⁿ−1), never the naive 1/N.",
      ],
      keyIdea: "P(A|B) = #(A∩B)/#B — count ordered outcomes and faces, and never flip the conditional.",
      whyInterviewers:
        "Reversing the conditional and miscounting the sample space are the two fastest ways to blow an 'easy' conditional-probability question on a desk.",
    },
  },
  {
    id: "cp-2",
    title: "Bayes' Theorem",
    subtitle: "Prior × likelihood, normalized",
    blurb:
      "Flip conditionals with Bayes: dodge base-rate neglect, don't report the likelihood as the posterior, and handle cheer-for-a-loser evidence.",
    section: SECTION,
    difficulty: "medium",
    mode: "quiz",
    masteryThreshold: 0.75,
    questionCount: 6,
    generator: mixQuiz([genBayesTest, genWhichDie, genCheerLoser, genInversion]),
    lesson: {
      paragraphs: [
        "Bayes' theorem flips a conditional: P(H|E) = P(E|H)P(H) / Σ P(E|Hⱼ)P(Hⱼ) — prior times likelihood, then normalize. The famous failure is BASE-RATE NEGLECT: with a rare condition, a 99%-sensitive test can still make most positives false, so P(disease | positive) ≪ the sensitivity. Reporting the likelihood P(E|H) as if it were the posterior P(H|E) is the same reversed-conditional mistake in disguise.",
        "The evidence can point the 'wrong' way. If you pick a random competitor and it LOSES, weight by the LOSS likelihood — losing is evidence AGAINST the strong favourite, so the slow racer's posterior rises. Only ratios of likelihoods matter after normalizing, so unknown common factors cancel.",
      ],
      keyIdea: "Posterior ∝ prior × likelihood; normalize, and never mistake P(E|H) for P(H|E).",
      whyInterviewers:
        "Bayesian updating under a base rate is the canonical 'do you actually understand conditioning?' interview filter.",
    },
  },
  {
    id: "cp-3",
    title: "Total Probability & Continuous",
    subtitle: "Condition on a scenario; rescale a uniform",
    blurb:
      "Use P(A)=ΣP(A|Bᵢ)P(Bᵢ) for transfers and mixtures, and condition a uniform correctly — it is NOT memoryless.",
    section: SECTION,
    difficulty: "medium",
    mode: "numeric",
    masteryThreshold: 0.75,
    questionCount: 6,
    numericGenerator: mixNumeric([genTransfer, genLotpLine, genUniform]),
    lesson: {
      paragraphs: [
        "The law of total probability breaks a hard question into cases: P(A) = Σ P(A|Bᵢ)P(Bᵢ). Move a chocolate between boxes and you must condition on WHICH chocolate moved before drawing; mix two production lines and you weight each defect rate by its production SHARE, not 50/50.",
        "For a continuous uniform, conditioning chops the interval and rescales: given a Uniform(a,b) has already run past time g, the remaining duration is uniform on (g, b). So the chance it finishes in the next w minutes is w/(b−g) — the interval SHRINKS as time passes. Treating the uniform as memoryless (using w/(b−a)) is the classic error; unlike the exponential, a uniform's fixed cap makes finishing soon more and more likely.",
      ],
      keyIdea: "P(A) = Σ P(A|Bᵢ)P(Bᵢ); a conditioned uniform rescales to its survivor interval (not memoryless).",
      whyInterviewers:
        "Case-splitting and correct continuous conditioning show you can set up a problem before touching arithmetic.",
    },
  },
  {
    id: "cp-4",
    title: "Races & Recursion",
    subtitle: "Winner's share of the deciding trials",
    blurb:
      "Solve competing-events races with a/(a+b) (ordered counts!), geometric-race conditioning, tie rules, and first-step recursion.",
    section: SECTION,
    difficulty: "medium",
    mode: "numeric",
    masteryThreshold: 0.7,
    questionCount: 6,
    numericGenerator: mixNumeric([genSumRace, genFirstToss, genTie, genFirstStep]),
    lesson: {
      paragraphs: [
        "In a race between two events, ignore every trial where neither happens — the winner's probability is its share of the DECIDING trials, a/(a+b). Rolling a sum of 6 before an 11 uses the ORDERED counts 5 and 2 (→ 5/7); the unordered count is the trap. Tie-break rules just add the tie outcomes to one side's deciding pool.",
        "When a game recurses, set up a first-step equation. Conditioning on winning a geometric race shortens the expected wait and shifts probabilities (given the second mover won, they won on their first toss with probability 1 − q²). For an alternating 'win-your-turn' game, p = w + (1−w)(1−p) solves to p = 1/(2−w): going first is worth strictly more than a single turn.",
      ],
      keyIdea: "Race winner = a/(a+b) over ordered deciding trials; recurse with a first-step equation.",
      whyInterviewers:
        "Race and recursion set-ups (first-to-fill, first-to-fault) are staple 'who wins?' desk brainteasers.",
    },
  },
  {
    id: "cp-5",
    title: "Russian Roulette",
    subtitle: "Fixed vs re-spun, and when to spin",
    blurb:
      "Fixed cylinders make pulls dependent, re-spun ones memoryless; two-bullet variants condition on survival to decide spin vs no-spin.",
    section: SECTION,
    difficulty: "medium",
    mode: "quiz",
    masteryThreshold: 0.7,
    questionCount: 6,
    generator: mixQuiz([genRRFixed, genRRRespun, genRRTwoRandom, genRRTwoConsecutive]),
    lesson: {
      paragraphs: [
        "Whether the cylinder is re-spun changes everything. Spun ONCE, the bullet's position is fixed and the pulls are dependent — the first player simply fires a fixed set of chambers. RE-SPUN before every pull, the pulls are independent (memoryless), and a first-step recursion shows the second player is the safer seat (surviving with probability 1/(2−p)).",
        "The two-bullet variants are decisions, not numbers: after surviving, compare spinning (which resets the risk) against pulling on. With two RANDOM bullets, surviving barely helps, so you SHOULD spin; with two CONSECUTIVE bullets, surviving tells you the hammer is on an empty chamber that is usually NOT followed by the block, so you should KEEP pulling. Always compute both conditional probabilities before deciding.",
      ],
      keyIdea: "Fixed cylinder ⇒ dependent pulls; re-spun ⇒ memoryless; two-bullet spin decisions compare conditional risks.",
      whyInterviewers:
        "The Russian-Roulette series tests dependent-vs-independent reasoning and conditioning on survival — a favourite escalating interview arc.",
    },
  },
  {
    id: "cp-6",
    title: "Paradoxes & Classics",
    subtitle: "Two-child, Monty Hall, Bertrand & the sign",
    blurb:
      "Reason through framing paradoxes whose answer is two-part or a decision + probability — then reveal: 1/3 vs 1/2, Monty Hall 2/3, Bertrand 2/3.",
    section: SECTION,
    difficulty: "hard",
    mode: "flashcard",
    masteryThreshold: 0.75,
    flashcards: [...conditionalProbabilityFlashcards, ...conditionalGeneralFlashcards],
    lesson: {
      paragraphs: [
        "Some conditional-probability answers are not a single scalar — the whole point is a contrast or a decision. The two-child paradox gives 1/3 ('at least one boy') versus 1/2 (you SAW one specific boy): identical-sounding, but the way the information arose changes the conditioning. Monty Hall's answer is a decision (switch) plus a probability (2/3), because the host's constrained action leaks information — the naive '2 left, so 1/2' ignores it.",
        "Bertrand's box (and its coin/card/prisoner disguises) resolves to 2/3, not 1/2, by conditioning on FACES rather than objects. The vacant-room sign is a multi-stage conditional that lands on 4/5. These are integrity-based flashcards: work out the reasoning, reveal, and self-assess — there's no number to type, and that's deliberate.",
      ],
      keyIdea: "How information ARISES decides the answer; some 'answers' are a contrast (1/3 vs 1/2) or a decision (switch, 2/3).",
      whyInterviewers:
        "The classics probe whether you truly track the conditioning event rather than pattern-matching to a memorized number.",
    },
  },
];
