import type { Level } from "@/types/content";
import { mixNumeric, mixQuiz } from "./_shared";
import {
  genAllSameColor,
  genAvoidSpecialSum,
  genEachPlayerSpecial,
  genExactlyTwoColors,
  genOneAssignment,
  genOneOfEach,
  genPairSumThreshold,
} from "./genChooseK";
import { genHyperAtLeast, genHyperExactly, genHyperNone } from "./genHyper";
import { genPokerHand } from "./genPoker";
import {
  genBinomAtMost,
  genLatticeMeeting,
  genMoreTails,
  genRaceCondition,
  genReturnOrigin,
  genStepCount,
} from "./genBinomial";
import {
  genPermVsComb,
  genReplacementTrap,
  genStarsBarsCap,
  genTiesOrder,
} from "./genTraps";
import {
  genAlternatingSteps,
  genDivisibility,
  genLightsLine,
  genMultinomialPaths,
} from "./genGrid";
import {
  genBalanceScale,
  genCircularAscending,
  genDealUntil,
  genGapMethod,
  genIndependentChoices,
  genOrderedDraw,
  genUnionFixedBits,
} from "./genArrangements";
import {
  genAtLeastKOfAKind,
  genDiceSumTarget,
  genExpectedPairs,
  genStrictlyIncreasing,
  genSubsetSum,
  genTopTwoSum,
} from "./genDiceSums";
import { combinatorialAnalysisFlashcards } from "./flashcards";
// Re-homed from the former "General" subcategory (counting-family generators).
import {
  genBinomTail,
  genBothColors,
  genContainsDigit,
  genProductEven,
  genSmallestN,
  genSubInterval,
} from "./genGeneralComplement";
import {
  genBracketFinal,
  genConsecutiveRun,
  genCoupon,
  genHigherCard,
  genInclExcl,
  genLinearityWords,
  genPolygonAnts,
  genRound1,
  genSemicircle,
  genTwoInRowSchedule,
} from "./genGeneralCounting";
import {
  genDiceSumQuiz,
  genDieCompare,
  genDigitOrder,
  genParitySymmetry,
} from "./genGeneralDice";
import { combinatorialGeneralFlashcards } from "./generalFlashcards";

/**
 * Probability & Statistics — **Combinatorial Analysis**, the counting-heavy
 * subcategory (51-question dataset across ~10 counting families). Almost every
 * answer is EXACT combinatorics, so the whole subcategory is built on an exact
 * integer/rational core (`./combinatorics.ts`) + family solvers (`./solvers.ts`),
 * with parametric generators clustered by cohesive TECHNIQUE into 9 Candy-Crush
 * levels ramping Easy → Hard, each using the mode that best teaches it:
 *
 *   • `numeric`   — where a clean exact number is the point: choose-k ratios,
 *                   hypergeometric draws, binomial coin/dice counts (incl. the
 *                   INTEGER-COUNT families 504/448/13860/25/243/792 shipped with
 *                   `decimals` omitted), grid/lattice paths, arrangements, and
 *                   the stars-&-bars + inclusion–exclusion capstone.
 *   • `quiz`      — where NAMING the misconception teaches: poker suit-combo
 *                   counting, and the permutation-vs-combination / with-vs-without-
 *                   replacement / non-decreasing-ties / stars-&-bars-cap traps.
 *   • `flashcard` — the non-scalar / multi-technique specials: two-part threshold
 *                   secret-sharing, the "compute-it-yourself" coin-grab count, a
 *                   big-binomial denied-boarding tail, a multi-deck straight, and
 *                   a linearity-of-expectation indicator count.
 *
 * Every level sets `section: "Combinatorial Analysis"`. NONE of the 51 source
 * questions are user-facing — they live only in `./combinatorialAnalysis.test.ts`
 * as hidden fixtures; every playable item is freshly generated.
 */
const SECTION = "Combinatorial Analysis";

export const combinatorialAnalysisLevels: Level[] = [
  {
    id: "ca-1",
    title: "Ratios of Combinations",
    subtitle: "Favorable over total",
    blurb:
      "Favorable-over-total combinations: one-of-each-color, all-same-color, exactly-two-colors, parity-by-avoidance, pair-sum thresholds, single-assignment odds.",
    section: SECTION,
    difficulty: "easy",
    mode: "numeric",
    masteryThreshold: 0.8,
    questionCount: 6,
    numericGenerator: mixNumeric([
      genOneOfEach,
      genAllSameColor,
      genExactlyTwoColors,
      genAvoidSpecialSum,
      genPairSumThreshold,
      genOneAssignment,
      genEachPlayerSpecial,
    ]),
    lesson: {
      paragraphs: [
        "The workhorse of combinatorial probability is favorable ÷ total, where BOTH are counts of unordered selections C(n,k). Draw 3 marbles from a mixed bag and want one of each color? Favorable = ∏ C(colorᵢ,1); total = C(N,3). Want all the same color? Sum C(colorᵢ,3) over colors. Want exactly two colors? Choose the pair of colors, take all draws from those two, and subtract the all-one-color triples — inclusion–exclusion in miniature.",
        "The recurring slip is order. Using permutations P(n,k) or nᵏ (with-replacement, ordered) when the sample space is unordered without replacement inflates both counts inconsistently. Keep numerator and denominator in the SAME world: unordered combinations for a simultaneous grab, ordered chain-rule fractions for a sequence. Parity shortcuts help too — a sum of chosen numbers is even iff you avoid the lone even element, so the answer collapses to C(n−1,k)/C(n,k).",
      ],
      keyIdea: "P = favorable C(n,k) ÷ total C(N,k); never mix ordered (nᵏ, P(n,k)) with unordered counts.",
      whyInterviewers:
        "Choose-k ratios are the first screen: desks check you set up the right sample space and don't confuse permutations with combinations.",
    },
  },
  {
    id: "ca-2",
    title: "Hypergeometric Draws",
    subtitle: "Exactly-j without replacement",
    blurb:
      "Draw without replacement and count 'special' items: exactly j, none, or at least j via the hypergeometric law C(m,j)·C(N−m,k−j)/C(N,k).",
    section: SECTION,
    difficulty: "easy",
    mode: "numeric",
    masteryThreshold: 0.8,
    questionCount: 5,
    numericGenerator: mixNumeric([genHyperExactly, genHyperNone, genHyperAtLeast]),
    lesson: {
      paragraphs: [
        "When you draw k items WITHOUT replacement from a population of N containing m special ones, the number of specials you get is hypergeometric: P(exactly j) = C(m,j)·C(N−m,k−j)/C(N,k). Choose which j of the m specials you get, times which k−j of the N−m ordinary ones, over all C(N,k) draws. 'No special' is just the j = 0 case C(N−m,k)/C(N,k); 'at least j' sums the upper tail.",
        "The classic mistake is the BINOMIAL-with-replacement approximation C(k,j)·(m/N)^j·((N−m)/N)^{k−j}. That treats each draw as independent with fixed probability m/N — valid only for large N or with replacement. For a small drawer of batteries or a single deck, the exact hypergeometric is required, and the two answers can differ noticeably. Also keep j straight: 'exactly 2 dead' is not 'at least 2 dead'.",
      ],
      keyIdea: "P(exactly j) = C(m,j)·C(N−m,k−j)/C(N,k); don't approximate with the binomial m/N.",
      whyInterviewers:
        "Hypergeometric-vs-binomial is a favorite discriminator: it checks whether you notice sampling is without replacement.",
    },
  },
  {
    id: "ca-3",
    title: "Poker Hands",
    subtitle: "Count the suit combos",
    blurb:
      "Probabilities of five-card-draw hands (four of a kind, full house, two pair, …) by counting rank choices × suit combinations C(4,2)/C(4,3), as a percentage.",
    section: SECTION,
    difficulty: "easy",
    mode: "quiz",
    masteryThreshold: 0.75,
    questionCount: 5,
    generator: mixQuiz([genPokerHand]),
    lesson: {
      paragraphs: [
        "Every poker-hand probability is a count over C(52,5) = 2,598,960. The art is counting the favorable hands as (rank choices) × (suit combinations). Four of a kind: pick the quad rank (13) and any 5th card (48) → 624. Full house: pick the triple rank (13) with C(4,3) = 4 suit combos, then the pair rank (12) with C(4,2) = 6 → 3744. Two pair: C(13,2) pair-ranks, each C(4,2) suits, plus a 44-card kicker.",
        "The signature errors are all about suit combos and ordering. Forgetting the C(4,2)/C(4,3) suit factors undercounts; treating the full-house triple and pair ranks as an unordered C(13,2) (instead of ordered 13·12) halves the count; forgetting the two-pair kicker drops the 44. Because these probabilities are tiny, expressing them as a percent (0.024%, 0.144%, 4.754%) keeps them comparable — but the counting logic is the point.",
      ],
      keyIdea: "Favorable = (rank choices) × (suit combos C(4,r)); full-house ranks are ORDERED (13·12), not C(13,2).",
      whyInterviewers:
        "Poker-hand counting is the canonical test of clean multiplication-principle counting with suit combinations.",
    },
  },
  {
    id: "ca-comp",
    title: "Complement & At-Least-One",
    subtitle: "1 − P(none) beats brute force",
    blurb:
      "Solve 'at least one' problems by the complement: both-colour draws, digit occurrence, sub-interval scaling, even products, and smallest-n thresholds.",
    section: SECTION,
    difficulty: "easy",
    mode: "numeric",
    masteryThreshold: 0.8,
    questionCount: 5,
    numericGenerator: mixNumeric([
      genBothColors,
      genContainsDigit,
      genSubInterval,
      genProductEven,
      genSmallestN,
    ]),
    lesson: {
      paragraphs: [
        "When a question says 'at least one', computing it head-on usually means messy inclusion–exclusion. The shortcut is almost always the COMPLEMENT: P(at least one) = 1 − P(none). 'At least one of each colour' = 1 − P(all one colour); 'contains the digit 5' = 1 − P(no 5 in any position) = 1 − (9/10)^L; 'the product is even' = 1 − P(every die odd).",
        "The same complement logic scales across independent sub-intervals — if a whole window has no event with probability f^k over k equal pieces, each piece is event-free with probability f, so per-piece P(≥1) = 1 − f. And to find the smallest n making P(at least one success) ≥ a threshold, solve 1 − (1−p)ⁿ ≥ threshold and round UP: n = ⌈ln(1−threshold)/ln(1−p)⌉.",
      ],
      keyIdea: "P(at least one) = 1 − P(none); for a threshold, n = ⌈ln(1−t)/ln(1−p)⌉ (round UP).",
      whyInterviewers:
        "The complement turns a scary 'at least one' into one clean multiplication — desks check you reach for it reflexively.",
    },
  },
  {
    id: "ca-bino",
    title: "Binomial Tails & Digit Counting",
    subtitle: "Tails, and counting by cases",
    blurb:
      "Binomial tails P(X≤k)/P(X≥k) via complement, plus digit-counting by length case — dodging the wrong-p and off-by-one boundary traps.",
    section: SECTION,
    difficulty: "easy",
    mode: "numeric",
    masteryThreshold: 0.8,
    questionCount: 5,
    numericGenerator: mixNumeric([genBinomTail, genDigitOrder]),
    lesson: {
      paragraphs: [
        "A binomial tail P(X ≥ k) is best computed as 1 − P(X ≤ k−1): sum the small lower tail and subtract. The two recurring slips are forgetting that complement (reporting P(X ≤ k) when P(X ≥ k) was asked), and using the wrong success probability p (e.g. 'a 5 or higher' is p = 2/6, not 1/6). Keep the boundary k straight: is it included?",
        "Digit-counting problems are pure case analysis. 'All digits different' over 1–1000 counts by length: 1-digit 9, 2-digit 9·9, 3-digit 9·9·8, then divide by the total. 'Ones digit greater than tens' counts ordered pairs (36 of 90). The trap is the sample space — keep numbers distinguishable and use the right denominator (90 two-digit numbers, not 100).",
      ],
      keyIdea: "P(X≥k) = 1 − P(X≤k−1); count digits by length case with the correct denominator.",
      whyInterviewers:
        "Tail and counting questions separate people who track the complement and sample space from those who mis-set p or the boundary.",
    },
  },
  {
    id: "ca-symm",
    title: "Dice Sums, Symmetry & Parity",
    subtitle: "Ordered sample space & the ½ trap",
    blurb:
      "Count dice sums over the ordered sample space, and name the ½ traps: parity is ½ by symmetry, and a tie breaks the </> symmetry of two dice.",
    section: SECTION,
    difficulty: "easy",
    mode: "quiz",
    masteryThreshold: 0.75,
    questionCount: 5,
    generator: mixQuiz([genDiceSumQuiz, genParitySymmetry, genDieCompare]),
    lesson: {
      paragraphs: [
        "Dice-sum probabilities are counting over the equally-likely ORDERED sample space: two d6 give 36 outcomes, so (1,3) and (3,1) are two of them — dividing by the 21 unordered pairs is the classic miscount. Some answers are meant to be SEEN, not summed: the parity of a dice sum or a coin-head count is exactly ½ by symmetry, because the last die/coin flips the running parity with probability ½ regardless of everything before it — so a big binomial sum is the trap, not the method.",
        "Ties break naive symmetry. 'Second die lower than the first' is (1 − P(tie))/2 = 5/12, not ½: the tie probability carves out the middle. And an unequal-dice comparison (a d50 beating a d30) is cleanest by conditioning on the larger die: it wins outright above the smaller die's range, and splits the shared overlap. Count the ordered outcomes and handle the ties exactly.",
      ],
      keyIdea: "Dice sums count ORDERED outcomes; parity = ½ by symmetry; ties break </> symmetry ((1−P(tie))/2).",
      whyInterviewers:
        "These are 'do you simplify or over-complicate' checks — the tempting messy sum is exactly the wrong path.",
    },
  },
  {
    id: "ca-4",
    title: "Binomial Coin & Dice Counting",
    subtitle: "Tails, walks & step counts",
    blurb:
      "Count binomial sequences: coin-flip tails P(X≤k)/P(more), random-walk return-to-origin C(2n,n)/4ⁿ, step-sequence counts C(steps,r), and lattice-meeting odds.",
    section: SECTION,
    difficulty: "medium",
    mode: "numeric",
    masteryThreshold: 0.75,
    questionCount: 6,
    numericGenerator: mixNumeric([
      genBinomAtMost,
      genMoreTails,
      genReturnOrigin,
      genStepCount,
      genLatticeMeeting,
      genRaceCondition,
    ]),
    lesson: {
      paragraphs: [
        "Coin and symmetric-walk problems are binomial-coefficient counting. P(at most k tails in n flips) sums C(n,0..k)/2ⁿ; 'more tails than heads' is the strict upper tail. A ±1 walk of 2n steps returns to the origin with probability C(2n,n)/2^{2n} (equal ups and downs), and the number of step SEQUENCES ending at displacement d is simply C(steps, (steps+d)/2) — an integer count, not a probability.",
        "Two subtleties recur. First, the boundary and the tie: 'more tails than heads' EXCLUDES the equal case, so start the sum above n/2. Second, conditioning: once a race's first flip is fixed, the remaining flips are a fresh binomial — the winner is decided by a tail of that smaller binomial. And the two-walkers-meeting probability on an n×n grid equals Σ C(n,i)²/4ⁿ = C(2n,n)/4ⁿ, the same central-coefficient count in disguise.",
      ],
      keyIdea: "Binomial tails sum C(n,·)/2ⁿ; return-to-origin = C(2n,n)/4ⁿ; step-count = C(steps,(steps+d)/2).",
      whyInterviewers:
        "These separate people who count sequences with binomial coefficients from those who guess ratios or drop the tie boundary.",
    },
  },
  {
    id: "ca-5",
    title: "Counting Traps",
    subtitle: "Name the miscount",
    blurb:
      "Name the miscount: permutations vs combinations, with vs without replacement (nᵏ vs C), non-decreasing vs strictly-increasing ties, and the stars-&-bars cap.",
    section: SECTION,
    difficulty: "medium",
    mode: "quiz",
    masteryThreshold: 0.75,
    questionCount: 5,
    generator: mixQuiz([genPermVsComb, genReplacementTrap, genTiesOrder, genStarsBarsCap]),
    lesson: {
      paragraphs: [
        "Most counting errors are one of four named traps. Order: choosing an unordered committee is C(n,k), but arranging them in a row is P(n,k) = k!·C(n,k) — off by a factor of k!. Replacement: picking k of n with replacement and order is nᵏ; without replacement ordered is P(n,k); unordered without replacement is C(n,k); unordered WITH replacement is C(n+k−1,k). Pick the right one of the four.",
        "Ties are the sneakiest. The probability three drawn values come out strictly increasing is C(faces,3)/faces³ — the naive 1/3! is wrong because it silently assumes all three values differ; when repeats are possible, non-decreasing draws get extra valid orders (a pair contributes 3 orders, a triple all 6). Finally, stars & bars counts non-negative solutions with C(target−1, dice−1), but that OVERCOUNTS when each die is capped at 6 — you must subtract, by inclusion–exclusion, the cases where a die exceeds its face limit.",
      ],
      keyIdea: "C(n,k) vs P(n,k) vs nᵏ vs C(n+k−1,k); strictly-increasing ≠ non-decreasing; cap stars & bars by inclusion–exclusion.",
      whyInterviewers:
        "These four traps are exactly what interviewers probe to see if you count the right sample space.",
    },
  },
  {
    id: "ca-6",
    title: "Grid & Lattice Path Counting",
    subtitle: "Lines, multinomial paths & mods",
    blurb:
      "Count on grids: lit cells forming a line, 3-D monotone routes via the multinomial, alternating-stride paths, and last-digit divisibility.",
    section: SECTION,
    difficulty: "medium",
    mode: "numeric",
    masteryThreshold: 0.7,
    questionCount: 5,
    numericGenerator: mixNumeric([
      genLightsLine,
      genMultinomialPaths,
      genAlternatingSteps,
      genDivisibility,
    ]),
    lesson: {
      paragraphs: [
        "Grid problems are counting lines and paths. On an n×n grid there are 2n+2 full lines (n rows, n columns, 2 main diagonals); the chance that random lit cells contain a full line multiplies the line count by the ways to place the remaining lit cells. Monotone routes through a 3-D lattice to (a,b,c) are the multinomial (a+b+c)!/(a!b!c!) — the number of distinct arrangements of a·E + b·N + c·U moves; reducing this to a 2-D binomial forgets the third axis.",
        "Two twists round out the family. When steps ALTERNATE between two stride lengths, the magnitude sequence is forced by the total distance, and you only choose which steps go up vs right (a small DP over the fixed magnitudes). And divisibility of a long concatenated number by 2^t depends ONLY on its last t digits, so P(divisible by 8) reduces to counting the last-three-digit combinations with 4d₁+2d₂+d₃ ≡ 0 (mod 8) — the leading digits are irrelevant.",
      ],
      keyIdea: "n×n has 2n+2 lines; 3-D routes = multinomial (a+b+c)!/(a!b!c!); mod-2^t depends only on the last t digits.",
      whyInterviewers:
        "Lattice-path and line-counting problems test whether you pick the right structure (multinomial vs binomial) and exploit modular shortcuts.",
    },
  },
  {
    id: "ca-7",
    title: "Arrangements & the Multiplication Principle",
    subtitle: "Chains, circles & independent choices",
    blurb:
      "Chain-rule ordered draws, deal-until counts, circular and gap arrangements, kⁿ independent choices, inclusion–exclusion bit strings, and balance scales.",
    section: SECTION,
    difficulty: "medium",
    mode: "numeric",
    masteryThreshold: 0.7,
    questionCount: 6,
    numericGenerator: mixNumeric([
      genOrderedDraw,
      genDealUntil,
      genCircularAscending,
      genGapMethod,
      genIndependentChoices,
      genUnionFixedBits,
      genBalanceScale,
    ]),
    lesson: {
      paragraphs: [
        "Ordered problems use the chain rule: the probability of a specific color sequence multiplies shrinking fractions (6/15 · 5/14 · …), decrementing as you go. Circular arrangements divide out rotations — n people seat in (n−1)! distinct circles, so an ascending order (either direction) has probability 2/(n−1)!. The gap method places items into the gaps between fixed objects: keeping both of one object's neighbors means its two flanking gaps stay empty, C(anchors−2, fillers)/C(anchors, fillers).",
        "The multiplication principle counts independent choices directly: n elements each with k independent states give kⁿ configurations (not nᵏ — keep base and exponent straight). Inclusion–exclusion counts unions of constraints: strings starting with a fixed block OR ending with one number 2^{L−p} + 2^{L−s} − 2^{L−p−s}. And symmetry cracks the balance scale: fix the heaviest weight on one pan and just count how many companion-pairs tip it over the halfway threshold.",
      ],
      keyIdea: "Chain rule for sequences; 2/(n−1)! for circular order; kⁿ for independent choices; |A∪B| by inclusion–exclusion.",
      whyInterviewers:
        "This is the everyday counting toolkit; desks expect fluent chain-rule, circular, gap, and multiplication-principle counting.",
    },
  },
  {
    id: "ca-tourn",
    title: "Tournaments & Arrangements",
    subtitle: "Brackets, arcs & rings",
    blurb:
      "Combinatorial placement: seeded #1-vs-#3 in the final, a round-1 pairing, n points in a common semicircle (n·½^{n−1}), and no-collision on a ring.",
    section: SECTION,
    difficulty: "medium",
    mode: "numeric",
    masteryThreshold: 0.75,
    questionCount: 5,
    numericGenerator: mixNumeric([
      genBracketFinal,
      genRound1,
      genSemicircle,
      genPolygonAnts,
    ]),
    lesson: {
      paragraphs: [
        "Bracket problems are slot-placement counting. For seeds #1 and #3 to meet in the FINAL, #3 must land on the opposite half (size/2 of size−1 slots) AND #2 must be on #1's half so it doesn't eliminate #3 early — a product of conditional slot fractions. For a round-1 pairing of two specific players, fix one and the other fills one of size−1 slots: 1/(size−1).",
        "Spatial-arrangement problems exploit an anchor. n uniform points lie in a common semicircle with probability n·(½)^{n−1}: anchor the arc at each point (mutually exclusive) and require the other n−1 in its half. On a cycle, n agents each stepping to a random neighbour avoid all collisions only if they all go the same way — 2 of 2ⁿ outcomes = 2^{1−n}.",
      ],
      keyIdea: "Count slots conditionally for brackets; anchor for the semicircle (n·½^{n−1}); ring no-collision = 2/2ⁿ.",
      whyInterviewers:
        "Bracket and circle problems test clean conditional counting and the anchoring trick.",
    },
  },
  {
    id: "ca-count",
    title: "Counting, Expectation & Linearity",
    subtitle: "Linearity, incl–excl & runs",
    blurb:
      "The EV/counting toolkit: coupon collector n·Hₙ, linearity of merges, consecutive-win patterns, run DP, first-card-higher, and De Morgan / inclusion–exclusion.",
    section: SECTION,
    difficulty: "medium",
    mode: "numeric",
    masteryThreshold: 0.7,
    questionCount: 6,
    numericGenerator: mixNumeric([
      genCoupon,
      genLinearityWords,
      genTwoInRowSchedule,
      genConsecutiveRun,
      genHigherCard,
      genInclExcl,
    ]),
    lesson: {
      paragraphs: [
        "Linearity of expectation is the workhorse: it holds even under dependence. Expected merges among n tokens = (n−1)·P(a pair merges); coupon collector = n·Hₙ (each new type is a geometric wait). Consecutive-win and run events are pattern counting — enumerate the win/loss patterns that contain a run (or DP over the trailing run length), rather than a union bound that double-counts overlapping windows.",
        "The rest are careful bookkeeping: 'first card strictly higher' conditions on rank and counts lower cards; De Morgan turns P(Aᶜ ∪ Bᶜ) into 1 − P(A∩B), with P(A∩B) = P(A)+P(B)−P(A∪B) by inclusion–exclusion. Track the sample space and the overlaps and the counting falls out.",
      ],
      keyIdea: "Linearity always holds; coupon = n·Hₙ; runs by DP (not a union bound); De Morgan + inclusion–exclusion for unions.",
      whyInterviewers:
        "This is the everyday EV/counting toolkit; desks expect fluent linearity, run-counting, and inclusion–exclusion.",
    },
  },
  {
    id: "ca-8",
    title: "Dice Sums: Stars & Bars + Inclusion–Exclusion",
    subtitle: "Capped sums & complements",
    blurb:
      "The hard capstone: capped stars-&-bars + inclusion–exclusion dice sums, top-two maxima, at-least-k-of-a-kind, subset-sums, strict increases, and expected pairs.",
    section: SECTION,
    difficulty: "hard",
    mode: "numeric",
    masteryThreshold: 0.7,
    questionCount: 6,
    numericGenerator: mixNumeric([
      genDiceSumTarget,
      genTopTwoSum,
      genAtLeastKOfAKind,
      genSubsetSum,
      genStrictlyIncreasing,
      genExpectedPairs,
    ]),
    lesson: {
      paragraphs: [
        "The hardest counting is multi-technique. To count the ways k dice sum to a target, shift each die to 0..faces−1 and use stars & bars C(target−k+... , k−1) — then subtract, by inclusion–exclusion, the solutions where some die exceeds its cap of faces−1. Forgetting that cap is the single biggest overcount. 'At least k of a kind' is cleanest by the complement: count outcomes where every value appears at most k−1 times (an occupancy sum) and subtract from faces^dice.",
        "Several harder events reduce to earlier tools. The two highest dice summing to the maximum means at least two show the top face — a binomial tail. 'Some subset sums to the target' is a complement over all outcomes with a subset-sum check. Strictly increasing values are C(faces,dice)/faces^dice (distinct values, one order). And expected counts — like the expected number of complete pairs dealt — fall out of linearity of expectation over per-item indicators, no independence required.",
      ],
      keyIdea: "Capped dice sums = stars & bars − inclusion–exclusion; 'at least k' by complement; expectations by linearity of indicators.",
      whyInterviewers:
        "These multi-step setups reward candidates who compose stars & bars, inclusion–exclusion, complements, and linearity rather than plug in a formula.",
    },
  },
  {
    id: "ca-9",
    title: "Combinatorial Reasoning Desk",
    subtitle: "Two-part & multi-technique specials",
    blurb:
      "Non-scalar specials: threshold secret-sharing (locks AND keys), a coin-grab count, a big-binomial tail, a multi-deck straight, and expected pairs by linearity.",
    section: SECTION,
    difficulty: "hard",
    mode: "flashcard",
    masteryThreshold: 0.75,
    flashcards: [...combinatorialAnalysisFlashcards, ...combinatorialGeneralFlashcards],
    lesson: {
      paragraphs: [
        "Some counting answers aren't a single graded number. Threshold secret-sharing asks for TWO integers — the minimum lock count C(n, t−1) and the per-person key count — because the deliverable is a whole scheme, not a scalar. A value-threshold coin-grab has no published formula: you reason it out, noticing which grabs can possibly clear the bar, then count the complement. Both reward stating the full picture, then self-assessing.",
        "The rest are multi-technique set-pieces. A denied-boarding probability is a binomial tail with n in the hundreds — computed in log-space so the huge coefficients and tiny powers don't overflow. A multi-deck straight counts three consecutive ranks and then SUBTRACTS the straight-flushes. And the expected number of pairs dealt is pure linearity of expectation over indicators — easy precisely because linearity ignores the dependence between ranks. Work each through, reveal, and check your reasoning.",
      ],
      keyIdea: "Report the full answer: both secret-sharing numbers, the complement count, the log-space tail, straights minus straight-flushes, and linearity of indicators.",
      whyInterviewers:
        "The specials reward candidates who recognise a two-part or multi-technique answer and lay out the full reasoning rather than forcing one number.",
    },
  },
];
