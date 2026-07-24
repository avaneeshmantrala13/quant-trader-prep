import type { Level } from "@/types/content";
import {
  expectedValueFlashcards,
  genAllSameCoins,
  genCltVariance,
  genConditionalGeo,
  genContinuousReroll,
  genConvertAll,
  genCoupon,
  genDiffer,
  genDistinct,
  genEmptyBoxes,
  genExpMoment,
  genFirstMarker,
  genGeometricSum,
  genHeadsTimesTails,
  genHigherDiffer,
  genMartingaleDoubling,
  genMaxDice,
  genMeetWithin,
  genMemoryless,
  genNegBinomial,
  genOneReroll,
  genOtherThan,
  genOverlap,
  genPairSame,
  genRecords,
  genRunningSum,
  genSecondMoment,
  genSumUniforms,
  genThreeDicePayoff,
  genTwoDiceMatch,
  genUniformSpacing,
  genWald,
  genWalkDuration,
  genWalkReach,
  genWarmingSpells,
  mixNumeric,
  mixQuiz,
} from "./generators";

/**
 * Expected Value — the fourth (and largest) Probability & Statistics
 * subcategory. Unlike Kelly (one formula) or even Game Theory, Expected Value
 * spans ~25 distinct solution-method FAMILIES, so the ~85-question dataset is
 * clustered into 8 Candy-Crush levels ramping Easy → Hard, each grouping
 * related families and using the mode that best teaches them:
 *
 *   • `quiz`      — where NAMING the misconception is the lesson (the 1/36
 *                   dice-match trap, CLT variance addition, Wald's wrong count,
 *                   walk duration i·N vs i(N−i), martingale fair-game EV = 0).
 *   • `numeric`   — where a clean exact scalar is the point (optimal-stopping
 *                   game values, geometric/recursion waits, indicator counts,
 *                   conditional expectation & geometric-probability areas).
 *   • `flashcard` — the special cases that must NOT be graded as a scalar:
 *                   divergent-EV sentinels ("infinite / diverges") and the
 *                   coin-simulation procedures/formulas.
 *
 * Every level sets `section: "Expected Value"` so the map / Table of Contents
 * render a labeled segment. Exact solvers live in `./ev.ts`; generators + the
 * per-family distractor taxonomy in `./generators.ts`. NONE of the 85 source
 * questions are user-facing — they live only in `./expectedValue.test.ts`.
 */
const SECTION = "Expected Value";

export const expectedValueLevels: Level[] = [
  {
    id: "ev-1",
    title: "Dice & Coin Foundations",
    subtitle: "Elementary probability & the 1/36 trap",
    blurb:
      "Nail the 1/N vs 1/N² dice-match trap, complements, all-same coins, and weighting dice payoffs by their true probabilities.",
    section: SECTION,
    difficulty: "easy",
    mode: "quiz",
    masteryThreshold: 0.8,
    questionCount: 6,
    generator: mixQuiz([
      genTwoDiceMatch,
      genDiffer,
      genAllSameCoins,
      genThreeDicePayoff,
      genHigherDiffer,
    ]),
    lesson: {
      paragraphs: [
        "Expected value starts with counting outcomes correctly. The most famous slip: rolling one die twice and asking P(the second matches the first). The first roll is FREE — only the second must match — so the answer is 1/N, not the 1/N² you'd get by fixing both dice to a specific value.",
        "For a payoff game, always WEIGHT each outcome by its probability, not by how memorable it is. Rolling three dice, 'exactly two the same' happens 90/216 of the time and dominates the rare 'all three same' (6/216). Enumerate, weight, sum — and never forget the outcomes that LOSE money.",
      ],
      keyIdea: "P(match) = 1/N (not 1/N²); EV weights every outcome by its probability.",
      whyInterviewers:
        "Miscounting the sample space is the #1 way candidates blow an easy EV question — desks want the count right cold.",
    },
  },
  {
    id: "ev-2",
    title: "Stop or Roll Again",
    subtitle: "Optimal stopping & the value of the option",
    blurb:
      "Price reroll games: keep a good first roll, take the fallback on a bad one — for both discrete dice and a continuous voucher.",
    section: SECTION,
    difficulty: "easy",
    mode: "numeric",
    masteryThreshold: 0.75,
    questionCount: 6,
    numericGenerator: mixNumeric([
      genOneReroll,
      genOneReroll,
      genContinuousReroll,
    ]),
    lesson: {
      paragraphs: [
        "In an optimal-stopping game you compare your current value to the value of CONTINUING. Keep the roll iff it beats the reroll's expected value; otherwise reroll. This 'option to stop' is why the game is worth strictly more than a single roll's average.",
        "The recipe: compute the continuation value V (e.g. a fresh d8 averages 4.5, minus any fee), keep the first roll v iff v ≥ V, and average max(v, V) over all faces. For a continuous Uniform(0, M) voucher with one reroll, keep iff v ≥ M/2, giving the clean 5M/8.",
      ],
      keyIdea: "Keep iff roll ≥ continuation value; the option lifts EV above the mean.",
      whyInterviewers:
        "Pricing the option to act later — and not overpaying for it — is the core of trading a resettable position.",
    },
  },
  {
    id: "ev-3",
    title: "Waiting Games",
    subtitle: "Geometric, negative-binomial & first-step recursion",
    blurb:
      "Compute expected waits: 1/p and r/p, two-in-a-row (1+p)/p², memorylessness (m + 1/p), and running-sum games via Wald.",
    section: SECTION,
    difficulty: "medium",
    mode: "numeric",
    masteryThreshold: 0.75,
    questionCount: 6,
    numericGenerator: mixNumeric([
      genNegBinomial,
      genMemoryless,
      genPairSame,
      genRunningSum,
      genGeometricSum,
      genConvertAll,
      genOtherThan,
    ]),
    lesson: {
      paragraphs: [
        "A single success with per-try probability p takes 1/p tries on average (geometric); the r-th success takes r/p (negative binomial). Memorylessness is the classic trap: after m failures the REMAINING wait is still 1/p, so the total from the start is m + 1/p — you must add the m already spent.",
        "First-step recursion handles patterns and running sums: for the same face twice in a row the wait is (1+p)/p² (longer than a fixed pair's 1/p² because a mismatch restarts you), and a stop-and-sum game pays E[#rolls]·E[value] by Wald's identity.",
      ],
      keyIdea: "Geometric 1/p; r-th success r/p; two-in-a-row (1+p)/p²; total wait m + 1/p.",
      whyInterviewers:
        "Expected waiting times underlie fill times, queueing, and 'how long until X' risk questions on every desk.",
    },
  },
  {
    id: "ev-4",
    title: "Indicators & Linearity",
    subtitle: "Sum of 0/1 indicators, even under dependence",
    blurb:
      "Use linearity of expectation for coupon collector (n·H_n), distinct counts, records, empty boxes, spacings, and solving for n.",
    section: SECTION,
    difficulty: "medium",
    mode: "numeric",
    masteryThreshold: 0.75,
    questionCount: 6,
    numericGenerator: mixNumeric([
      genCoupon,
      genDistinct,
      genRecords,
      genEmptyBoxes,
      genFirstMarker,
      genWarmingSpells,
    ]),
    lesson: {
      paragraphs: [
        "Linearity of expectation is the most powerful trick in EV: write a count as a sum of 0/1 indicators, use E[indicator] = P(event), and add — it works EVEN when the indicators are dependent, so you never need the joint distribution. Coupon collector (n·H_n), distinct colors after m draws, empty boxes, and record counts (H_n) all fall to it instantly.",
        "The same idea inverts: if the expected number of events is E = (#windows)·p, you can solve for an unknown parameter n. The recurring slips are dropping the hardest final coupon's 1/1 term and miscounting the number of windows or gaps.",
      ],
      keyIdea: "E[count] = Σ P(each event) — linearity holds even under dependence.",
      whyInterviewers:
        "Turning a scary joint-distribution count into a sum of easy probabilities is exactly the decomposition desks prize.",
    },
  },
  {
    id: "ev-5",
    title: "Distributions, Variance & CLT",
    subtitle: "Second moments and why variance ADDS",
    blurb:
      "Compute E[X²], the head×tail product n(n−1)/4, exponential 2/λ², uniform-sum means, and CLT variance addition.",
    section: SECTION,
    difficulty: "medium",
    mode: "quiz",
    masteryThreshold: 0.75,
    questionCount: 6,
    generator: mixQuiz([
      genSecondMoment,
      genHeadsTimesTails,
      genExpMoment,
      genSumUniforms,
      genCltVariance,
    ]),
    lesson: {
      paragraphs: [
        "Second moments trip people up: E[X²] = Var(X) + (E[X])² is strictly larger than (E[X])², and E[H·T] ≠ E[H]·E[T] when H and T are dependent (T = n − H), so the head×tail product is n(n−1)/4, not n²/4. For an exponential, E[X²] = 2/λ² (the mean squared, times two).",
        "For sums of independent variables, MEANS add (E[sum of k uniforms] = k·L/2) and, crucially, VARIANCES add — even for a difference D − H, Var(D − H) = Var(D) + Var(H). Forgetting to add the variances (or wrongly subtracting them) is the number-one CLT mistake.",
      ],
      keyIdea: "E[X²] = Var + mean²; variance ADDS for independent sums and differences.",
      whyInterviewers:
        "Aggregating independent risks means adding variances — mishandle it and every portfolio/CLT estimate is wrong.",
    },
  },
  {
    id: "ev-6",
    title: "Conditional & Geometric Probability",
    subtitle: "Conditioning, areas, order statistics & spacings",
    blurb:
      "Solve conditional-geometric races, meeting/overlap areas on a square, the max of several dice, and uniform order statistics.",
    section: SECTION,
    difficulty: "hard",
    mode: "numeric",
    masteryThreshold: 0.7,
    questionCount: 6,
    numericGenerator: mixNumeric([
      genConditionalGeo,
      genOverlap,
      genMeetWithin,
      genMaxDice,
      genUniformSpacing,
    ]),
    lesson: {
      paragraphs: [
        "Conditioning changes the answer: winning a geometric race shortens your expected count below the plain 1/p (E[A | A < B] = 1/(1 − q²)). And when two uniform times must fall close together, it's a 2-D AREA question — the meeting/overlap probability is 1 minus the corner triangles on a square, never a 1-D ratio like t/L.",
        "Order statistics are clean by symmetry: n uniform points split [0,1] into n+1 equal expected gaps, so the k-th smallest sits at k/(n+1); and E[max of several dice] comes from the tail sum Σ P(max ≥ k). Divide by the right count (n+1, not n) and remember the max beats a single die's mean.",
      ],
      keyIdea: "Condition carefully; 2-D events are areas; k-th of n uniforms = k/(n+1).",
      whyInterviewers:
        "Geometric-probability and conditioning arguments separate candidates who can set up an integral from those who guess.",
    },
  },
  {
    id: "ev-7",
    title: "Random Walks & Martingales",
    subtitle: "Gambler's ruin, optional stopping & Wald",
    blurb:
      "Find hitting probabilities i/N, walk durations i(N−i), Wald sums, and why no doubling system beats a fair game (EV = 0).",
    section: SECTION,
    difficulty: "hard",
    mode: "quiz",
    masteryThreshold: 0.7,
    questionCount: 6,
    generator: mixQuiz([
      genWalkReach,
      genWalkDuration,
      genWald,
      genMartingaleDoubling,
    ]),
    lesson: {
      paragraphs: [
        "For a fair ±1 walk between walls at 0 and N, the position is a martingale, so P(reach N first) = i/N (gambler's ruin). The expected DURATION uses the martingale Y² − t and equals i·(N − i) — the common trap i·N drops the −i and overstates it.",
        "Martingale reasoning also kills betting systems: a doubling ('martingale') strategy on a fair coin still has EV = 0, because the tiny chance of a big loss exactly cancels the large chance of a small win. Wald's identity ties it together: a random sum has mean E[#terms]·E[term].",
      ],
      keyIdea: "Fair walk: reach prob i/N, duration i(N−i); no system beats EV = 0.",
      whyInterviewers:
        "Random-walk hitting times and 'can a system beat a fair game?' are staple risk-of-ruin desk questions.",
    },
  },
  {
    id: "ev-8",
    title: "Infinity & Simulation Desk",
    subtitle: "Divergent EV sentinels & coin-simulation procedures",
    blurb:
      "Reason through St.-Petersburg-type games whose EV is infinite, and coin procedures (Von Neumann, dyadic, rejection) — then reveal.",
    section: SECTION,
    difficulty: "hard",
    mode: "flashcard",
    masteryThreshold: 0.75,
    flashcards: expectedValueFlashcards,
    lesson: {
      paragraphs: [
        "Some expected values are genuinely INFINITE. In a St.-Petersburg-type game the prize grows as fast as the probability shrinks, so each term of the EV sum stays ≥ a positive constant and the series diverges — the fair price is infinite, and the tempting finite number (a convergent doubling-prize analog) is exactly the trap. A heavy 1/n tail can also make an expected WAITING time infinite even though you win with probability 1.",
        "Other questions have a PROCEDURE or FORMULA as the answer, not a scalar: the Von Neumann extractor turns a biased coin fair in 1/(p(1−p)) flips; a fair coin simulates any dyadic k/2ⁿ by mapping k of 2ⁿ sequences; non-dyadic and irrational targets use rejection sampling / binary expansion. These are integrity-based flashcards — reason it through, reveal, and self-assess.",
      ],
      keyIdea: "Prize×prob ratio ≥ 1 ⇒ infinite EV; some answers are a procedure, not a number.",
      whyInterviewers:
        "Recognizing when an EV diverges — and when the 'answer' is a construction — shows real probabilistic maturity.",
    },
  },
];
