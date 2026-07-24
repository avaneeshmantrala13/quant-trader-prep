import type { Level } from "@/types/content";
import {
  gameTheoryFlashcards,
  genBeauty,
  genEntry,
  genHotelling,
  genPd,
  genValue2x2,
  genValue3x2,
  genVolunteer,
  mixNumeric,
  mixQuiz,
} from "./generators";
// Re-homed from the former "General" subcategory (optimizing-agents / market-making).
import { genOptimalSpread, genOptimizeAgents } from "./genGeneralAgents";
import { gameTheoryGeneralFlashcards } from "./generalFlashcards";

/**
 * Game Theory — a Probability & Statistics subcategory. NOTE: as of the
 * section-consolidation pass these levels are tagged `section: "Game Theory &
 * Puzzles"` and are interleaved (by difficulty) with the small Game Puzzle
 * (betting/odds) family in `../index.ts` to form ONE merged Easy→Hard segment on
 * the Probability/Math map — the two used to be adjacent standalone sections.
 * The subcategory module/tests are otherwise unchanged.
 *
 * Unlike Kelly (one formula reused), each family here has its OWN solution
 * method, so the levels are grouped by family and use three player modes:
 *
 *   • `quiz`      — Prisoner's Dilemma, backward induction, Hotelling, beauty
 *                   contest. Chosen because the teaching point is NAMING the
 *                   misconception behind each wrong payoff (cooperative vs NE
 *                   payoff, believed non-credible threat, whole-market vs split,
 *                   level-k depth). Distractor rationale carries that pedagogy.
 *   • `numeric`   — zero-sum 2×2 / 3×2 mixed-strategy VALUE and the Volunteer's
 *                   Dilemma probability: a single exact scalar (`fraction.js`),
 *                   graded to the dataset's 2-dp / exact-probability convention.
 *   • `flashcard` — coordination / stag hunt, non-credible threat, repeated
 *                   game / folk theorem: no single scalar (reason-then-reveal).
 *
 * See `./games.ts` (exact solvers) and `./generators.ts` (generators + the
 * per-family misconception taxonomy). NONE of the 11 source-dataset questions
 * are user-facing: they live ONLY in `./gameTheory.test.ts` as hidden fixtures.
 */
export const gameTheoryLevels: Level[] = [
  {
    id: "gt-1",
    title: "Dominant Strategies",
    subtitle: "Prisoner's Dilemma & best-response analysis",
    blurb:
      "Find the unique Nash equilibrium payoff in symmetric Prisoner's Dilemmas by spotting the strictly dominant strategy.",
    section: "Game Theory & Puzzles",
    difficulty: "easy",
    mode: "quiz",
    masteryThreshold: 0.8,
    questionCount: 5,
    generator: genPd,
    lesson: {
      paragraphs: [
        "In a simultaneous game, look first for a DOMINANT strategy — an action that beats your alternative no matter what the opponent does. Use best-response analysis: freeze the opponent on each choice and see which of your actions pays more.",
        "The Prisoner's Dilemma is the classic trap: defecting strictly dominates, so both players defect and land on the punishment payoff (P) — even though mutual cooperation (R) would pay both more. R is unstable because either side can deviate to the temptation payoff (T).",
      ],
      keyIdea: "Dominant strategy ⇒ unique NE at (Defect, Defect) = P; not R.",
      whyInterviewers:
        "Recognising individually-rational choices that produce a jointly-bad outcome is core desk intuition (latency/spread arms races).",
    },
  },
  {
    id: "gt-2",
    title: "Sequential Games",
    subtitle: "Backward induction & credible threats",
    blurb:
      "Solve entry games by backward induction and see why the 'I'll fight a price war' threat is non-credible.",
    section: "Game Theory & Puzzles",
    difficulty: "medium",
    mode: "quiz",
    masteryThreshold: 0.75,
    questionCount: 5,
    generator: genEntry,
    lesson: {
      paragraphs: [
        "Sequential games are trees, not grids: solve them by BACKWARD INDUCTION. Settle the last mover's choice first, fix it, and roll back — this yields the subgame-perfect equilibrium and automatically discards threats nobody would actually carry out.",
        "The key trap is a NON-CREDIBLE threat: an incumbent's promise to 'fight a price war' is empty if, once entry happens, fighting hurts the incumbent more than accommodating. Anticipate your opponent's ACTUAL last move, not the one you wish they'd make.",
      ],
      keyIdea: "Reason last-move-first; drop threats that aren't self-interested.",
      whyInterviewers:
        "Backward induction and credibility underpin negotiation, entry, and commitment problems on any desk.",
    },
  },
  {
    id: "gt-3",
    title: "Position & Prediction",
    subtitle: "Hotelling location & the beauty contest",
    blurb:
      "Locate two vendors at the median (Hotelling) and iterate dominated strategies to the beauty-contest equilibrium.",
    section: "Game Theory & Puzzles",
    difficulty: "medium",
    mode: "quiz",
    masteryThreshold: 0.75,
    questionCount: 6,
    generator: mixQuiz([genHotelling, genHotelling, genBeauty, genBeauty]),
    lesson: {
      paragraphs: [
        "Hotelling / median-voter: two competitors choosing position both converge to the MEDIAN and split the market evenly — the principle of minimum differentiation. Off-centre splits aren't stable because either side can crowd beside the other to grab the bigger share.",
        "The Keynesian beauty contest ('closest to half the average') collapses under iterated elimination of dominated strategies to the unique equilibrium 0. But winning MONEY uses level-k thinking (L0 ≈ midpoint, each level halving) — go one level deeper than the room.",
      ],
      keyIdea: "Median ⇒ split 50/50; iterated dominance ⇒ equilibrium 0.",
      whyInterviewers:
        "Both test whether you can iterate others' reasoning — exactly the skill in reading a crowded trade.",
    },
  },
  {
    id: "gt-4",
    title: "Zero-Sum Mixed Strategies",
    subtitle: "Minimax value of 2×2 and 3×2 games",
    blurb:
      "Compute the exact value of saddle-free zero-sum games via the indifference principle, deleting dominated rows first.",
    section: "Game Theory & Puzzles",
    difficulty: "hard",
    mode: "numeric",
    masteryThreshold: 0.75,
    questionCount: 6,
    numericGenerator: mixNumeric([genValue2x2, genValue2x2, genValue3x2]),
    lesson: {
      paragraphs: [
        "When a zero-sum game has no saddle point (best responses cycle), you must MIX. The indifference principle sets your mixing probability so the opponent is indifferent between their columns; the value is V = (a·d − b·c)/(a − b − c + d) for the 2×2 core.",
        "For a 3×2, first prune: a strictly dominated row (beaten in BOTH columns) is never played — delete it, then solve the surviving 2×2 by mixing. The safe pure strategy only locks in the maximin, strictly below the true value.",
      ],
      keyIdea: "No saddle ⇒ mix by indifference; delete dominated rows first.",
      whyInterviewers:
        "Randomising so a counterparty can't read you — and pricing the exact edge of doing so — is a real trading skill.",
    },
  },
  {
    id: "gt-5",
    title: "The Volunteer's Dilemma",
    subtitle: "Symmetric mixed equilibrium & diffusion of responsibility",
    blurb:
      "Find P(nobody volunteers) in the symmetric mixed equilibrium, where more potential helpers make collective failure MORE likely.",
    section: "Game Theory & Puzzles",
    difficulty: "hard",
    mode: "numeric",
    masteryThreshold: 0.7,
    questionCount: 5,
    numericGenerator: genVolunteer,
    lesson: {
      paragraphs: [
        "In a Volunteer's Dilemma any one person acting helps everyone, but acting is costly — so each hopes someone else does it. There's no pure equilibrium; the symmetric mixed equilibrium sets each person's volunteer probability p by INDIFFERENCE: net benefit of acting = expected benefit of waiting.",
        "Solve (1−p)^(N−1) = c/b for p, then P(nobody volunteers) = (1−p)^N. Counterintuitively, more potential volunteers pushes each to act less, so the building is MORE likely to freeze — diffusion of responsibility as a mathematical fact.",
      ],
      keyIdea: "Indifference ⇒ (1−p)^(N−1)=c/b; P(nobody)=(1−p)^N.",
      whyInterviewers:
        "It formalises free-riding and the bystander effect — key to thinking about liquidity provision and shared risk.",
    },
  },
  {
    id: "gt-spread",
    title: "Optimal Market-Making Spread",
    subtitle: "Informed vs uninformed flow",
    blurb:
      "Optimize a market maker's spread against informed + uninformed flow: X* = (U+I)/(2U+I), which is 2/3 for an equal split, giving a two-sided market.",
    section: "Game Theory & Puzzles",
    difficulty: "hard",
    mode: "numeric",
    masteryThreshold: 0.7,
    questionCount: 5,
    numericGenerator: genOptimalSpread,
    lesson: {
      paragraphs: [
        "Market-making is an optimization: quoting a spread X against informed + uninformed flow trades uninformed revenue (∝ X(1−X)) against adverse-selection losses (∝ (1−X)²). Maximizing E[PnL] gives X* = (U+I)/(2U+I) — which is 2/3 for an equal split — and a two-sided market of bid (1−X)/2 and ask 1 − bid.",
        "Ignoring the informed flow entirely (and answering ½) is the trap: a spread that's too tight bleeds to the informed traders, while one that's too wide loses too much uninformed volume. Set up E[PnL] as a downward parabola in X and take the derivative.",
      ],
      keyIdea: "Spread X* = (U+I)/(2U+I) (2/3 for an equal split); market = bid (1−X)/2, ask 1 − bid.",
      whyInterviewers:
        "Pricing a spread against adverse selection is the core desk-quant market-making computation.",
    },
  },
  {
    id: "gt-agents",
    title: "Optimizing Agents",
    subtitle: "Choose the best participation p",
    blurb:
      "Optimize a symmetric agent's participation probability: P(success) = s₂p² + 2s₁p(1−p) is maximized at p* = s₁/(2s₁−s₂), not at the naive p = ½ or p = 1.",
    section: "Game Theory & Puzzles",
    difficulty: "hard",
    mode: "quiz",
    masteryThreshold: 0.7,
    questionCount: 5,
    generator: genOptimizeAgents,
    lesson: {
      paragraphs: [
        "When two symmetric agents each choose a participation probability p, the success probability is a quadratic in p: P(success) = s₂·p² + 2s₁·p(1−p), where s₂ is the both-participate success rate and s₁ the one-participate rate. This is a downward parabola whenever s₁ > s₂/2, so it has an interior optimum — you cannot just push p to 0 or 1.",
        "Maximize by calculus: dP/dp = 0 gives p* = s₁/(2s₁ − s₂). For the canonical s₁ = ½, s₂ = ¼ this is 2/3, giving P = 1/3. The traps are the corner guesses (p = 1 'always participate', which over-weights the weaker both-participate case) and the naive midpoint p = ½. Set up the objective, differentiate, solve — the optimum is rarely at the boundary.",
      ],
      keyIdea: "Maximize s₂p² + 2s₁p(1−p): p* = s₁/(2s₁−s₂) (2/3 in the canonical case), not ½ or 1.",
      whyInterviewers:
        "Optimizing-agent games test whether you set up and maximize an objective rather than guessing a corner.",
    },
  },
  {
    id: "gt-6",
    title: "Reasoning Desk",
    subtitle: "Coordination, commitment & repeated play",
    blurb:
      "Reason through open-ended stag-hunt, non-credible-threat, and folk-theorem scenarios, then reveal and self-assess.",
    section: "Game Theory & Puzzles",
    difficulty: "hard",
    mode: "flashcard",
    masteryThreshold: 0.75,
    flashcards: [...gameTheoryFlashcards, ...gameTheoryGeneralFlashcards],
    lesson: {
      paragraphs: [
        "Three important game-theory families have NO single numeric answer — the answer IS the reasoning. Coordination / stag hunt (two equilibria: payoff-dominant vs risk-dominant, resolved by a focal point), non-credible threats (backward induction strips them out; credibility needs a commitment device, reputation, or a cheap-to-execute punishment), and repeated games (the folk theorem: cooperation is sustainable via grim trigger once δ clears (T−R)/(T−P), but it's not the only equilibrium).",
        "These are integrity-based flashcards: think the scenario through, hit reveal, and honestly self-assess. Aim to name the equilibria, distinguish payoff- vs risk-dominance, identify (non-)credibility, and state the discount condition where relevant.",
      ],
      keyIdea: "Some games have no scalar answer — the reasoning is the answer.",
      whyInterviewers:
        "Open-ended 'what would you do and why' game questions test structured reasoning, not arithmetic.",
    },
  },
];
