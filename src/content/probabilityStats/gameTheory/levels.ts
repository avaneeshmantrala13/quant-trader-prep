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
import { genOptimalSpread, genOptimizeAgentsNumeric } from "./genGeneralAgents";
import { gameTheoryGeneralFlashcards } from "./generalFlashcards";

/**
 * Game Theory, a Probability & Statistics subcategory. NOTE: as of the
 * section-consolidation pass these levels are tagged `section: "Game Theory &
 * Puzzles"` and are interleaved (by difficulty) with the small Game Puzzle
 * (betting/odds) family in `../index.ts` to form ONE merged Easy→Hard segment on
 * the Probability/Math map, the two used to be adjacent standalone sections.
 * The subcategory module/tests are otherwise unchanged.
 *
 * Unlike Kelly (one formula reused), each family here has its OWN solution
 * method, so the levels are grouped by family and use three player modes:
 *
 *   • `quiz`     . Prisoner's Dilemma, backward induction, Hotelling, beauty
 *                   contest. Chosen because the teaching point is NAMING the
 *                   misconception behind each wrong payoff (cooperative vs NE
 *                   payoff, believed non-credible threat, whole-market vs split,
 *                   level-k depth). Distractor rationale carries that pedagogy.
 *   • `numeric`  , zero-sum 2×2 / 3×2 mixed-strategy VALUE and the Volunteer's
 *                   Dilemma probability: a single exact scalar (`fraction.js`),
 *                   graded to the dataset's 2-dp / exact-probability convention.
 *   • `flashcard`, coordination / stag hunt, non-credible threat, repeated
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
        "In a simultaneous game, look first for a DOMINANT strategy, an action that beats your alternative no matter what the opponent does. Use best-response analysis: freeze the opponent on each choice and see which of your actions pays more.",
        "The Prisoner's Dilemma is the classic trap: defecting strictly dominates, so both players defect and land on the punishment payoff (P), even though mutual cooperation (R) would pay both more. R is unstable because either side can deviate to the temptation payoff (T).",
      ],
      keyIdea: "Dominant strategy ⇒ unique NE at (Defect, Defect) = P; not R.",
      whyInterviewers:
        "Recognising individually-rational choices that produce a jointly-bad outcome is core desk intuition (latency/spread arms races).",
      deepDive: {
        whyItWorks:
          "In a simultaneous game the stable outcome is one where no player can gain by deviating alone; the quickest route there is to find a dominant action that is a best response no matter what the opponent does. When both players have one, that mutual best response is the unique equilibrium even if it leaves both worse off than cooperating.",
        approach: [
          "Fix the opponent on each of their possible choices in turn.",
          "For each, identify your own best-responding action.",
          "Check whether one action is best regardless of what the opponent does.",
          "Pair the players' dominant choices to read off the equilibrium outcome.",
        ],
        pitfalls: [
          "Reporting the mutually-cooperative payoff as the equilibrium when it isn't stable.",
          "Assuming individually rational choices must yield the jointly-best outcome.",
          "Overlooking that dominance must hold against every opponent action, not just the likely one.",
        ],
      },
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
        "Sequential games are trees, not grids: solve them by BACKWARD INDUCTION. Settle the last mover's choice first, fix it, and roll back, this yields the subgame-perfect equilibrium and automatically discards threats nobody would actually carry out.",
        "The key trap is a NON-CREDIBLE threat: an incumbent's promise to 'fight a price war' is empty if, once entry happens, fighting hurts the incumbent more than accommodating. Anticipate your opponent's ACTUAL last move, not the one you wish they'd make.",
      ],
      keyIdea: "Reason last-move-first; drop threats that aren't self-interested.",
      whyInterviewers:
        "Backward induction and credibility underpin negotiation, entry, and commitment problems on any desk.",
      deepDive: {
        whyItWorks:
          "A sequential game is a tree, so you solve it from the end backwards: fix what each last mover would actually do, then choose earlier moves anticipating those replies. This yields the subgame-perfect equilibrium and automatically discards threats a rational player would never carry out.",
        approach: [
          "Picture the game as a tree of moves taken in order.",
          "Start at the final decisions and pick each last mover's payoff-maximising choice.",
          "Replace each settled subtree with its resulting payoffs and roll back one stage.",
          "Continue to the opening move, keeping only self-interested actions at every node.",
        ],
        pitfalls: [
          "Believing a threat that would hurt the threatener to actually execute.",
          "Reasoning forward from the first move instead of backward from the last.",
          "Assuming an opponent makes the move you want rather than their own best move.",
        ],
      },
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
        "Hotelling / median-voter: two competitors choosing position both converge to the MEDIAN and split the market evenly, the principle of minimum differentiation. Off-centre splits aren't stable because either side can crowd beside the other to grab the bigger share.",
        "The Keynesian beauty contest ('closest to half the average') collapses under iterated elimination of dominated strategies to the unique equilibrium 0. But winning MONEY uses level-k thinking (L0 ≈ midpoint, each level halving), go one level deeper than the room.",
      ],
      keyIdea: "Median ⇒ split 50/50; iterated dominance ⇒ equilibrium 0.",
      whyInterviewers:
        "Both test whether you can iterate others' reasoning, exactly the skill in reading a crowded trade.",
      deepDive: {
        whyItWorks:
          "Both puzzles are about iterating other players' reasoning. Spatial competition drives rivals toward the median because either can capture more share by moving toward the centre; a guessing game collapses toward the logical equilibrium under repeated elimination of choices that can never win, yet real money is won by going just one reasoning step beyond the crowd.",
        approach: [
          "Ask where a player can gain by moving relative to the others, and follow that incentive to its resting point.",
          "For guessing games, remove choices that are dominated no matter what others pick.",
          "Iterate that elimination to find the logical equilibrium.",
          "To win in practice, estimate the crowd's reasoning depth and go one level deeper.",
        ],
        pitfalls: [
          "Thinking off-centre positions are stable when a rival can crowd in for more share.",
          "Playing the full-rationality equilibrium against opponents who don't reason that far.",
          "Going too few, or too many, levels deep relative to the actual field.",
        ],
      },
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
        "For a 3×2, first prune: a strictly dominated row (beaten in BOTH columns) is never played, delete it, then solve the surviving 2×2 by mixing. The safe pure strategy only locks in the maximin, strictly below the true value.",
      ],
      keyIdea: "No saddle ⇒ mix by indifference; delete dominated rows first.",
      whyInterviewers:
        "Randomising so a counterparty can't read you, and pricing the exact edge of doing so, is a real trading skill.",
      deepDive: {
        whyItWorks:
          "In a zero-sum game with no saddle point, best responses cycle, so any pure choice can be exploited; you defend the game's value by randomising precisely so the opponent is indifferent between their replies. A strictly dominated strategy is never worth playing, so you can prune it before mixing.",
        approach: [
          "Check for a saddle point where the row's guaranteed minimum meets the column's minimum of maxima.",
          "If there's no saddle, delete any strategy beaten in every column.",
          "On the surviving 2×2, set your mixing probabilities so the opponent is indifferent between columns.",
          "Compute the game's value from that equilibrium mix.",
        ],
        pitfalls: [
          "Settling for the safe pure (maximin) payoff, which sits strictly below the true value.",
          "Trying to mix before eliminating dominated strategies.",
          "Choosing your mix to maximise your own payoff directly instead of making the opponent indifferent.",
        ],
      },
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
        "In a Volunteer's Dilemma any one person acting helps everyone, but acting is costly, so each hopes someone else does it. There's no pure equilibrium; the symmetric mixed equilibrium sets each person's volunteer probability p by INDIFFERENCE: net benefit of acting = expected benefit of waiting.",
        "Solve (1−p)^(N−1) = c/b for p, then P(nobody volunteers) = (1−p)^N. Counterintuitively, more potential volunteers pushes each to act less, so the building is MORE likely to freeze, diffusion of responsibility as a mathematical fact.",
      ],
      keyIdea: "Indifference ⇒ (1−p)^(N−1)=c/b; P(nobody)=(1−p)^N.",
      whyInterviewers:
        "It formalises free-riding and the bystander effect, key to thinking about liquidity provision and shared risk.",
      deepDive: {
        whyItWorks:
          "When any single volunteer benefits everyone but bears a private cost, there's no pure equilibrium, each person randomises, tuned so they're exactly indifferent between acting and free-riding. Because that indifference condition makes each person less willing to act as the group grows, collective failure becomes more likely with more potential volunteers.",
        approach: [
          "Recognise the structure: one volunteer suffices, but volunteering is costly.",
          "Impose symmetric indifference, the cost of acting equals the expected benefit of waiting for someone else.",
          "Solve that condition for each player's volunteer probability.",
          "Combine the independent non-volunteering events to get the chance nobody acts.",
        ],
        pitfalls: [
          "Expecting a pure equilibrium where one designated person always volunteers.",
          "Assuming more potential helpers makes success more likely.",
          "Confusing one person's volunteer probability with the chance that someone volunteers.",
        ],
      },
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
        "Market-making is an optimization: quoting a spread X against informed + uninformed flow trades uninformed revenue (∝ X(1−X)) against adverse-selection losses (∝ (1−X)²). Maximizing E[PnL] gives X* = (U+I)/(2U+I), which is 2/3 for an equal split, and a two-sided market of bid (1−X)/2 and ask 1 − bid.",
        "Ignoring the informed flow entirely (and answering ½) is the trap: a spread that's too tight bleeds to the informed traders, while one that's too wide loses too much uninformed volume. Set up E[PnL] as a downward parabola in X and take the derivative.",
      ],
      keyIdea: "Spread X* = (U+I)/(2U+I) (2/3 for an equal split); market = bid (1−X)/2, ask 1 − bid.",
      whyInterviewers:
        "Pricing a spread against adverse selection is the core desk-quant market-making computation.",
      deepDive: {
        whyItWorks:
          "Quoting a spread trades revenue from uninformed flow against adverse-selection losses to informed traders; expected PnL is a downward parabola in the spread, so calculus pins a unique interior optimum. Quote too tight and you bleed to the informed; quote too wide and you lose uninformed volume.",
        approach: [
          "Model expected profit as uninformed revenue minus informed adverse-selection cost.",
          "Express both terms as functions of the chosen spread.",
          "Maximise the resulting concave objective by taking its derivative and setting it to zero.",
          "Translate the optimal spread into symmetric bid and ask quotes.",
        ],
        pitfalls: [
          "Ignoring informed flow and defaulting to a naive symmetric spread.",
          "Quoting so tight that informed traders pick you off.",
          "Quoting so wide that uninformed volume dries up.",
        ],
      },
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
    mode: "numeric",
    masteryThreshold: 0.7,
    questionCount: 5,
    numericGenerator: mixNumeric([genOptimizeAgentsNumeric]),
    lesson: {
      paragraphs: [
        "When two symmetric agents each choose a participation probability p, the success probability is a quadratic in p: P(success) = s₂·p² + 2s₁·p(1−p), where s₂ is the both-participate success rate and s₁ the one-participate rate. This is a downward parabola whenever s₁ > s₂/2, so it has an interior optimum, you cannot just push p to 0 or 1.",
        "Maximize by calculus: dP/dp = 0 gives p* = s₁/(2s₁ − s₂). For the canonical s₁ = ½, s₂ = ¼ this is 2/3, giving P = 1/3. The traps are the corner guesses (p = 1 'always participate', which over-weights the weaker both-participate case) and the naive midpoint p = ½. Set up the objective, differentiate, solve, the optimum is rarely at the boundary.",
      ],
      keyIdea: "Maximize s₂p² + 2s₁p(1−p): p* = s₁/(2s₁−s₂) (2/3 in the canonical case), not ½ or 1.",
      whyInterviewers:
        "Optimizing-agent games test whether you set up and maximize an objective rather than guessing a corner.",
      deepDive: {
        whyItWorks:
          "When symmetric agents each choose a participation probability, the joint success probability is a quadratic in that probability, and when the one-participant case is valuable enough it's a downward parabola with an interior maximum. So the best choice is generally neither 'never' nor 'always', it's found by optimising, not by picking a corner.",
        approach: [
          "Write the success probability by conditioning on how many agents participate.",
          "Recognise it as a quadratic in the participation probability.",
          "Confirm the parabola opens downward, guaranteeing an interior optimum.",
          "Differentiate, set to zero, and solve for the optimal probability.",
        ],
        pitfalls: [
          "Jumping to a corner choice of always or never participating.",
          "Guessing the midpoint by default.",
          "Over-weighting the both-participate case when the single-participant case is what matters.",
        ],
      },
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
        "Three important game-theory families have NO single numeric answer, the answer IS the reasoning. Coordination / stag hunt (two equilibria: payoff-dominant vs risk-dominant, resolved by a focal point), non-credible threats (backward induction strips them out; credibility needs a commitment device, reputation, or a cheap-to-execute punishment), and repeated games (the folk theorem: cooperation is sustainable via grim trigger once δ clears (T−R)/(T−P), but it's not the only equilibrium).",
        "These are integrity-based flashcards: think the scenario through, hit reveal, and honestly self-assess. Aim to name the equilibria, distinguish payoff- vs risk-dominance, identify (non-)credibility, and state the discount condition where relevant.",
      ],
      keyIdea: "Some games have no scalar answer, the reasoning is the answer.",
      whyInterviewers:
        "Open-ended 'what would you do and why' game questions test structured reasoning, not arithmetic.",
      deepDive: {
        whyItWorks:
          "Several important games have no single numeric answer, the deliverable is the reasoning: naming the equilibria, distinguishing payoff- from risk-dominance, judging whether a threat is credible, and stating when repetition can sustain cooperation. The tools are equilibrium analysis, backward induction, and the discounted-future logic of repeated play.",
        approach: [
          "Identify the game's family: coordination, commitment, or repeated play.",
          "Enumerate the equilibria and distinguish the payoff-dominant from the risk-dominant one.",
          "Test whether any threat or promise is self-interested to carry out.",
          "For repeated play, ask whether patient players can sustain cooperation via a credible punishment.",
        ],
        pitfalls: [
          "Assuming a coordination game has one obvious solution without appealing to a focal point.",
          "Treating a non-credible threat as if it were binding.",
          "Believing cooperation is the only possible equilibrium of a repeated game.",
        ],
      },
    },
  },
];
