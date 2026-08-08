import type {
  Difficulty,
  FlashcardGenerator,
  NumericQuestion,
  NumericQuestionGenerator,
} from "@/types/content";
import { topicKeyOf } from "@/lib/mastery/topicKey";
import { COMPETENCY_BRAINTEASER } from "@/lib/roadmap/skillGraph";
import type { MentalMathSubtopic } from "@/content/mentalMath/subtopics";
import { ALL_BRAINTEASER_FAMILIES } from "@/content/brainteasers/generators";
import { ALL_TECHNIQUE_FAMILIES } from "@/content/brainteasers/techniqueGenerators";
import { combinedRatesFloorGenerator } from "./floorGenerators";

/**
 * THE ~100-ITEM UNTIMED FREE-RESPONSE DIAGNOSTIC BLUEPRINT (Stage 2, spec §2 /
 * §5.2 / §5.3, RESOLVED DECISIONS §10.6, §10.9, §10.10).
 *
 * One flat, ordered list of items spanning EVERY scored KST topic
 * (`scoredContentTopicKeys()` — the 21 QUANT-RELEVANT nodes) plus brainteaser
 * flashcards. It is UNTIMED and FREE-RESPONSE (numeric entry or, for
 * brainteasers, a flashcard).
 *
 * QUANT-ONLY TOPIC SET (GOAL A): the diagnostic probes only topics attested as
 * OA/interview material in the firm research (`datasets/OPTIVER_2026_DEEP.md`,
 * `datasets/JANE_STREET_2026_DEEP.md`, `datasets/TOP10_2026/*`). The five purely
 * academic distribution/process-theory topics — Moment Generating Functions,
 * Gamma Distribution, Joint Distributions, Limit Theorems (formal Chebyshev/LLN),
 * and Continuous-Time Markov Chains (M/M/1 queueing) — are `scored: false` in the
 * skill graph (UT_COURSE_GAP_ANALYSIS.md §4 "largely academic"), so they are NOT
 * in `scoredContentTopicKeys()` and are intentionally absent here. They remain
 * learnable in the Case-A course-mode diagnostic and free-play tracks.
 *
 * Per §5.2 / decision §10.6 every scored topic is GUARANTEED both:
 *   • a NON-TRIVIAL FLOOR item (GOAL B) — a real multi-step calc or non-obvious
 *     insight, never a memorized freebie ("P(heads)=½") and never a plug-and-chug
 *     definition ("E[Poisson] = λ", "Var(Bₜ) = t"); every floor clears the
 *     `difficulty-floor.test.ts` trivial-detector + vetted-concept allowlist; and
 *   • a HARD CEILING item — the lattice / random-walk / optimal-stopping tier,
 *     drawn from the exact-verified hard OA archetypes via the free-response
 *     adapters (`@/lib/oa/hardContent/frAdapters`) where one exists, else an
 *     authored hard item.
 *
 * ATTRIBUTION (decision §10.10): every item carries a PRECISE subtopic tag. For
 * mental arithmetic that is a canonical {@link MentalMathSubtopic} (which maps to
 * the single `mental-math::_core` node per §10.9); for every other topic the tag
 * is the topic's own KST node key. Brainteaser items attribute to the
 * `competency::brainteaser-reasoning` node. `untimedBlueprint.test.ts` asserts no
 * orphan subtopic tags and per-topic floor+ceiling coverage.
 *
 * Nothing here is new MATH: the hard ceilings reuse the existing generators +
 * verifiers verbatim (only re-projected to free-response), and the authored
 * floor/ceiling items are simple, exact, self-checking calculations.
 */

/* -- Scored KST node keys (mirror `@/lib/roadmap/skillGraph`) --------------- */
const MENTAL = topicKeyOf("mental-math");
const RATES = topicKeyOf("math-questions", "Rates, Algebra & Word Problems");
const NUMBER_THEORY = topicKeyOf("math-questions", "Number Theory & Counting");
const GEOMETRY = topicKeyOf("math-questions", "Geometry & Derivations");
const COMBINATORICS = topicKeyOf("probability", "Combinatorial Analysis");
const CORE_PROB = topicKeyOf("probability", "Core Probability");
const CONDITIONAL = topicKeyOf("probability", "Conditional Probability");
const EXPECTED_VALUE = topicKeyOf("probability", "Expected Value");
const CONDITIONAL_EXPECTATION = topicKeyOf("probability", "Conditional Expectation");
const CONTINUOUS = topicKeyOf("probability", "Continuous Distributions");
const POISSON = topicKeyOf("probability", "Poisson Distribution & Process");
const GEOMETRIC = topicKeyOf("probability", "Geometric Probability");
const ORDER_STATS = topicKeyOf("probability", "Order Statistics");
const VARIANCE_CLT = topicKeyOf("probability", "Variance, Covariance & the CLT");
const BETTING = topicKeyOf("probability", "Betting & Sizing");
const MARKOV = topicKeyOf("probability", "Markov Chains");
const BROWNIAN = topicKeyOf("probability", "Brownian Motion");
const INTERVIEW_GAMES = topicKeyOf("interview-games");
const GAME_THEORY = topicKeyOf("probability", "Game Theory & Puzzles");
const BRANCHING = topicKeyOf("probability", "Branching Processes");
const MARKOV_STRUCTURE = topicKeyOf("probability", "Markov Chain Structure");

/* -- Item model ------------------------------------------------------------- */

/** Floor (non-trivial), mid (enrichment), or the hard ceiling. */
export type UntimedTier = "floor" | "mid" | "ceiling";

interface BaseUntimedItem {
  /** The scored KST node (numeric) or the competency node (brainteaser). */
  topicKey: string;
  /** Precise attribution tag: a mental-math subtopic id, else the topicKey. */
  subtopic: string;
  tier: UntimedTier;
}

/** An authored, exact free-response numeric item. */
export interface UntimedNumericItem extends BaseUntimedItem {
  kind: "numeric-authored";
  question: NumericQuestion;
  /**
   * OPTIONAL exact-verified parametric generator for this item's family. When
   * present, materialization draws a FRESH same-family instance (varied numbers)
   * from the seed instead of re-serving the static `question`, so the drilling
   * bank feels infinite and a rung-3 worked SIBLING can be produced (a static
   * `question` alone cannot vary and drops the sibling rung). The static
   * `question` remains the canonical/floor exemplar and the difficulty-floor
   * allowlist keys off it. Absent ⇒ a genuinely-unique authored singleton.
   */
  generator?: NumericQuestionGenerator;
}

/** A hard-ceiling item projected from a hard OA archetype via `frAdapters`. */
export interface UntimedAdapterItem extends BaseUntimedItem {
  kind: "numeric-adapter";
  /** `HARD_OA_BUILDERS` family id (see `@/lib/oa/hardContent/generators`). */
  family: string;
}

/** A brainteaser flashcard (hybrid: numeric-objective when it has a number, else self-eval). */
export interface UntimedBrainteaserItem extends BaseUntimedItem {
  kind: "brainteaser";
  /** Stable family name (for ids / audits). */
  familyName: string;
  /** The exact-verified flashcard generator (`@/content/brainteasers/*`). */
  generator: FlashcardGenerator;
}

export type UntimedItem =
  | UntimedNumericItem
  | UntimedAdapterItem
  | UntimedBrainteaserItem;

/* -- Authoring helpers ------------------------------------------------------ */

/** Build an authored numeric item (subtopic defaults to the topic's own node). */
function num(
  topicKey: string,
  tier: UntimedTier,
  question: NumericQuestion,
  subtopic: string = topicKey,
): UntimedNumericItem {
  return { kind: "numeric-authored", topicKey, subtopic, tier, question };
}

/**
 * Build an authored numeric item that ALSO carries an exact-verified parametric
 * `generator` for its family (see {@link UntimedNumericItem.generator}). The
 * static `question` stays the canonical exemplar; every draw varies its numbers.
 */
function numGen(
  topicKey: string,
  tier: UntimedTier,
  question: NumericQuestion,
  generator: NumericQuestionGenerator,
  subtopic: string = topicKey,
): UntimedNumericItem {
  return { kind: "numeric-authored", topicKey, subtopic, tier, question, generator };
}

/** Build a hard-ceiling adapter item (defaults to `ceiling`). */
function adapt(
  topicKey: string,
  family: string,
  subtopic: string = topicKey,
  tier: UntimedTier = "ceiling",
): UntimedAdapterItem {
  return { kind: "numeric-adapter", topicKey, subtopic, tier, family };
}

/** Compact `NumericQuestion` constructor. */
function q(
  id: string,
  prompt: string,
  answer: number,
  meta: {
    difficulty: Difficulty;
    concept: string;
    explanation: string;
    decimals?: number;
    unit?: string;
    commonErrors?: NumericQuestion["commonErrors"];
    source?: string;
  },
): NumericQuestion {
  return {
    id,
    prompt,
    answer,
    difficulty: meta.difficulty,
    concept: meta.concept,
    explanation: meta.explanation,
    ...(meta.decimals != null ? { decimals: meta.decimals } : {}),
    ...(meta.unit != null ? { unit: meta.unit } : {}),
    ...(meta.commonErrors ? { commonErrors: meta.commonErrors } : {}),
    source: meta.source ?? "Untimed diagnostic",
  };
}

const mm: MentalMathSubtopic = "multiplication";
const pct: MentalMathSubtopic = "percentages";
const sqProd: MentalMathSubtopic = "squares-products";
const seriesSums: MentalMathSubtopic = "series-sums";
const digitCounting: MentalMathSubtopic = "digit-counting";

/* ========================================================================== */
/*  AUTHORED FLOOR + CEILING (+ a few adapter ceilings) PER SCORED TOPIC        */
/* ========================================================================== */

const CONTENT_ITEMS: UntimedItem[] = [
  /* -------------------------------- Foundations ------------------------------ */
  num(
    MENTAL,
    "floor",
    q("u-mental-floor", "Compute 88 × 125.", 11000, {
      difficulty: "medium",
      concept: "Multiplication (factoring trick)",
      explanation:
        "×125 = ×1000 ÷ 8. So 88 × 125 = 88 ÷ 8 × 1000 = 11 × 1000 = 11000 (recognizing 125 = 1000/8 is the trick).",
      commonErrors: [
        { value: 8800, feedback: "That is 88 × 100; ×125 is ×1000 ÷ 8, not ×100." },
        { value: 1100, feedback: "Off by a factor of 10 — 88 ÷ 8 = 11, then × 1000." },
      ],
    }),
    mm,
  ),
  num(
    MENTAL,
    "ceiling",
    q(
      "u-mental-ceiling",
      "A stock rises 25% one day, then falls 20% the next. What is the net percent change from the starting price?",
      0,
      {
        difficulty: "hard",
        concept: "Percentages",
        unit: "%",
        explanation:
          "Chain the multipliers: 1.25 × 0.80 = 1.00, so the price is exactly back to where it started — a 0% net change.",
        commonErrors: [
          { value: 5, feedback: "You added the percents (25 − 20); percent changes multiply, they don't add." },
          { value: -5, feedback: "Sign of the additive slip — but the correct method multiplies the factors to 1.00." },
        ],
      },
    ),
    pct,
  ),
  num(
    MENTAL,
    "mid",
    q("u-mental-sqprod", "Compute 47 × 53.", 2491, {
      difficulty: "medium",
      concept: "Squares & products",
      explanation:
        "47 and 53 sit symmetrically around 50, so use difference-of-squares: (50 − 3)(50 + 3) = 50² − 3² = 2500 − 9 = 2491.",
      commonErrors: [
        { value: 2500, feedback: "That is 50² — you forgot to subtract the offset² (3² = 9)." },
        { value: 2400, feedback: "Place-value slip; 50² − 9 = 2491, not 2400." },
      ],
    }),
    sqProd,
  ),
  num(
    MENTAL,
    "mid",
    q("u-mental-series", "Compute 1 + 2 + 3 + … + 50.", 1275, {
      difficulty: "medium",
      concept: "Series sums",
      explanation:
        "The 50th triangular number: 1 + 2 + … + 50 = 50 · 51 / 2 = 1275.",
      commonErrors: [
        { value: 1225, feedback: "That is 50² (the sum of the first 50 ODD numbers), not 1 + 2 + … + 50." },
        { value: 2550, feedback: "You used n(n+1) = 50 · 51 but forgot to divide by 2." },
      ],
    }),
    seriesSums,
  ),
  num(
    MENTAL,
    "mid",
    q(
      "u-mental-digits",
      "How many digit characters are used to write every whole number from 1 to 100?",
      192,
      {
        difficulty: "medium",
        concept: "Digit counting",
        explanation:
          "1–9 use 1 digit each (9), 10–99 use 2 each (90 · 2 = 180), and 100 uses 3, for 9 + 180 + 3 = 192.",
        commonErrors: [
          { value: 100, feedback: "That counts one digit per number, but 10–99 use two digits and 100 uses three." },
          { value: 200, feedback: "That assumes two digits per number; 1–9 use one and 100 uses three." },
        ],
      },
    ),
    digitCounting,
  ),
  numGen(
    RATES,
    "floor",
    q(
      "u-rates-floor",
      "Pipe A fills a tank in 3 hours; pipe B fills it in 6 hours. With both open, how many hours to fill the tank?",
      2,
      {
        difficulty: "medium",
        concept: "Combined rates",
        unit: "h",
        explanation: "Rates add: 1/3 + 1/6 = 1/2 tank per hour, so the tank fills in 2 hours.",
        commonErrors: [
          { value: 4.5, feedback: "You averaged the times (3 + 6)/2; you must add the RATES, not the times." },
          { value: 9, feedback: "You added the times; opening both pipes makes it faster, not slower." },
        ],
      },
    ),
    // Parametric combined-rates family: every draw varies the solo times, so the
    // "two pipes fill a tank" floor never re-emits the same rendered problem and
    // its rung-3 worked sibling can be produced from the SAME family.
    combinedRatesFloorGenerator,
  ),
  num(
    RATES,
    "ceiling",
    q(
      "u-rates-ceiling",
      "A boat travels 12 km downstream in 2 hours and the same 12 km back upstream in 3 hours. What is the speed of the current (km/h)?",
      1,
      {
        difficulty: "hard",
        concept: "Relative rates",
        unit: "km/h",
        explanation:
          "Downstream speed = 12/2 = 6, upstream = 12/3 = 4. Boat = (6+4)/2 = 5, current = (6−4)/2 = 1 km/h.",
        commonErrors: [
          { value: 5, feedback: "That is the boat's still-water speed; the current is HALF the difference of the two speeds." },
          { value: 2, feedback: "That is the full speed difference (6 − 4); the current is half of it." },
        ],
      },
    ),
  ),

  /* --------------------------- Probability foundations ----------------------- */
  num(
    COMBINATORICS,
    "floor",
    q("u-comb-floor", "How many ways can you choose a committee of 3 people from 8 (order doesn't matter)?", 56, {
      difficulty: "medium",
      concept: "Combinations",
      explanation: "C(8,3) = 8·7·6 / (3·2·1) = 336/6 = 56.",
      commonErrors: [
        { value: 336, feedback: "That is the ORDERED count P(8,3); a committee is unordered, so divide by 3!." },
        { value: 24, feedback: "That is 8·3; you must use the binomial coefficient." },
      ],
    }),
  ),
  num(
    COMBINATORICS,
    "ceiling",
    q(
      "u-comb-ceiling",
      "How many nonnegative integer solutions are there to x + y + z = 7?",
      36,
      {
        difficulty: "hard",
        concept: "Stars and bars",
        explanation: "Stars and bars: C(7 + 3 − 1, 3 − 1) = C(9,2) = 36.",
        commonErrors: [
          { value: 21, feedback: "That is C(7,2) — you forgot the extra dividers (it's C(n+k−1, k−1))." },
          { value: 8, feedback: "That counts only the x-axis solutions; use stars and bars across all three variables." },
        ],
      },
    ),
  ),
  num(
    NUMBER_THEORY,
    "floor",
    q("u-nt-floor", "How many integers from 1 to 100 inclusive are divisible by 4 OR by 6?", 33, {
      difficulty: "medium",
      concept: "Inclusion–exclusion on divisibility",
      explanation:
        "⌊100/4⌋ + ⌊100/6⌋ − ⌊100/12⌋ = 25 + 16 − 8 = 33 (subtract multiples of lcm(4,6)=12, counted twice).",
      commonErrors: [
        { value: 41, feedback: "25 + 16 without subtracting the multiples of 12 (double-counted in both sets)." },
        { value: 25, feedback: "Only multiples of 4 — add the multiples of 6 and subtract the multiples of 12." },
      ],
    }),
  ),
  num(
    NUMBER_THEORY,
    "ceiling",
    q("u-nt-ceiling", "What is the sum of every integer from 1 to 100 that is NOT divisible by 3?", 3367, {
      difficulty: "hard",
      concept: "Series & sums with a divisibility filter",
      explanation:
        "Total 1+…+100 = 5050. Multiples of 3 up to 100 are 3+6+…+99 = 3(1+…+33) = 3·561 = 1683. Answer = 5050 − 1683 = 3367.",
      commonErrors: [
        { value: 5050, feedback: "That is the sum of ALL integers; subtract the multiples of 3." },
        { value: 1683, feedback: "That is the sum of the multiples of 3 — the question wants the ones NOT divisible by 3." },
      ],
    }),
  ),
  num(
    CORE_PROB,
    "floor",
    q("u-core-floor", "Two fair six-sided dice are rolled. What is the probability that at least one of them shows a 6?", 11 / 36, {
      difficulty: "medium",
      concept: "Complement rule",
      explanation: "P(at least one 6) = 1 − P(no 6) = 1 − (5/6)² = 1 − 25/36 = 11/36.",
      commonErrors: [
        { value: 1 / 3, feedback: "You added 1/6 + 1/6; that double-counts the double-six and ignores the complement." },
        { value: 1 / 36, feedback: "That is P(BOTH dice show 6); you want AT LEAST one." },
      ],
    }),
  ),
  num(
    CORE_PROB,
    "ceiling",
    q(
      "u-core-ceiling",
      "In a group, P(likes tea) = 0.6, P(likes coffee) = 0.5, and P(likes both) = 0.3. What is P(likes tea OR coffee)?",
      0.8,
      {
        difficulty: "hard",
        concept: "Inclusion–exclusion",
        explanation: "P(A ∪ B) = P(A) + P(B) − P(A ∩ B) = 0.6 + 0.5 − 0.3 = 0.8.",
        commonErrors: [
          { value: 1.1, feedback: "You added without subtracting the overlap — probabilities can't exceed 1." },
          { value: 0.3, feedback: "That is P(both); the OR is the union, larger than the intersection." },
        ],
      },
    ),
  ),
  num(
    CONDITIONAL,
    "floor",
    q("u-cond-floor", "A fair die is rolled. Given that the result is even, what is the probability it is a 2?", 1 / 3, {
      difficulty: "medium",
      concept: "Conditional probability (reduced sample space)",
      explanation: "The even outcomes are {2,4,6}; given even, each is equally likely, so P(2 | even) = 1/3.",
      commonErrors: [
        { value: 1 / 6, feedback: "That is the UNconditional P(2); you must reduce to the even sample space." },
        { value: 0.5, feedback: "There are three even faces, not two." },
      ],
    }),
  ),
  // Ceiling: hard Bayesian update (fair-vs-biased coin) via the FR adapter.
  adapt(CONDITIONAL, "hardCoinBias"),

  /* ------------------------ Expectation, distributions ----------------------- */
  num(
    EXPECTED_VALUE,
    "floor",
    q(
      "u-ev-floor",
      "You stake $2 on a bet that pays 5-to-1 (net) and wins with probability 1/4. What is your expected NET profit, in dollars?",
      1,
      {
        difficulty: "medium",
        concept: "Expected value of a bet",
        unit: "$",
        explanation:
          "Win: +5×$2 = +$10 with p = 1/4; lose: −$2 with p = 3/4. EV = (1/4)(10) + (3/4)(−2) = 2.5 − 1.5 = $1.",
        commonErrors: [
          { value: 2.5, feedback: "You counted only the winning branch; subtract the probability-weighted loss." },
          { value: 8, feedback: "You forgot to probability-weight the payouts." },
        ],
      },
    ),
  ),
  // Ceiling: optimal one-reroll game value via the FR adapter.
  adapt(EXPECTED_VALUE, "hardOneReroll"),
  num(
    CONDITIONAL_EXPECTATION,
    "floor",
    q(
      "u-condexp-floor",
      "You roll a fair die repeatedly until a 6 appears. Given that the first 10 rolls were all non-sixes, what is the expected number of ADDITIONAL rolls until the first 6?",
      6,
      {
        difficulty: "medium",
        concept: "Memorylessness of the geometric wait",
        explanation:
          "The geometric waiting time is memoryless: the 10 elapsed failures don't change the future, so the expected additional rolls is still 1/(1/6) = 6.",
        commonErrors: [
          { value: 16, feedback: "You added the 10 elapsed rolls; the wait is memoryless, so the future expectation is unchanged." },
          { value: 3.5, feedback: "3.5 is the expected VALUE of a die roll, not the number of rolls to hit a 6." },
        ],
      },
    ),
  ),
  num(
    CONDITIONAL_EXPECTATION,
    "ceiling",
    q(
      "u-condexp-ceiling",
      "You flip a fair coin repeatedly. What is the expected number of flips to first see two heads in a row (HH)?",
      6,
      {
        difficulty: "hard",
        concept: "First-step analysis (patterns)",
        explanation:
          "Let E be the answer. From 0 heads: E = 1 + ½E₁ + ½E where E₁ is the state after one head; from one head E₁ = 1 + ½·0 + ½E. Solving gives E = 6.",
        commonErrors: [
          { value: 4, feedback: "4 is the expected wait for HT; HH is longer because a tail after a head loses BOTH heads of progress." },
          { value: 3, feedback: "This is a first-step recursion, not simply 1/p² of a single flip." },
        ],
      },
    ),
  ),
  num(
    CONTINUOUS,
    "floor",
    q("u-cont-floor", "X is uniform on [0, 12]. Given that X > 3, what is P(X > 9)?", 1 / 3, {
      difficulty: "medium",
      concept: "Conditional uniform distribution",
      explanation:
        "Conditioned on X > 3, X is uniform on (3, 12] (length 9). P(X > 9 | X > 3) = (12 − 9)/(12 − 3) = 3/9 = 1/3.",
      commonErrors: [
        { value: 0.25, feedback: "That is the UNconditional P(X > 9) = 3/12; you must reduce to the (3,12] range." },
        { value: 0.75, feedback: "That is P(X ≤ 9 | X > 3); you want the upper tail." },
      ],
    }),
  ),
  num(
    CONTINUOUS,
    "ceiling",
    q(
      "u-cont-ceiling",
      "X is Exponential with mean 4. What is P(X > 4)? (Give your answer to 3 decimals.)",
      Math.exp(-1),
      {
        difficulty: "hard",
        concept: "Exponential distribution",
        decimals: 3,
        explanation:
          "Rate λ = 1/mean = 1/4. P(X > t) = e^(−λt), so P(X > 4) = e^(−(1/4)·4) = e^(−1) ≈ 0.368.",
        commonErrors: [
          { value: 0.632, feedback: "That is P(X ≤ 4) = 1 − e^(−1); you want the survival probability." },
          { value: 0.5, feedback: "The exponential is not symmetric — the mean is not the median." },
        ],
      },
    ),
  ),
  num(
    POISSON,
    "floor",
    q("u-poisson-floor", "Calls arrive as a Poisson process with mean λ = 3 per hour. What is P(exactly 2 calls in one hour)? (3 decimals.)", 4.5 * Math.exp(-3), {
      difficulty: "medium",
      concept: "Poisson pmf",
      decimals: 3,
      explanation: "P(N = 2) = e^(−λ) λ²/2! = e^(−3)·9/2 = 4.5·e^(−3) ≈ 0.224.",
      commonErrors: [
        { value: 0.149, feedback: "That is P(N = 1) = λe^(−λ); you want exactly two events." },
        { value: 9 * Math.exp(-3), feedback: "You forgot the 2! in the denominator of the pmf (e^(−3)·9 vs e^(−3)·9/2)." },
      ],
    }),
  ),
  num(
    POISSON,
    "ceiling",
    q("u-poisson-ceiling", "Events occur as Poisson with mean λ = 2 per interval. What is P(zero events in an interval)? (3 decimals.)", Math.exp(-2), {
      difficulty: "hard",
      concept: "Poisson pmf",
      decimals: 3,
      explanation: "P(N = 0) = e^(−λ) λ⁰/0! = e^(−2) ≈ 0.135.",
      commonErrors: [
        { value: 0.865, feedback: "That is P(N ≥ 1) = 1 − e^(−2); you want exactly zero." },
        { value: 0.5, feedback: "The Poisson is right-skewed; P(0) is well below ½ when λ = 2." },
      ],
    }),
  ),
  num(
    GEOMETRIC,
    "floor",
    q("u-geo-floor", "A point (x, y) is chosen uniformly in the unit square [0,1]×[0,1]. What is P(x + y ≤ 1/2)?", 0.125, {
      difficulty: "medium",
      concept: "Geometric probability (area of a region)",
      explanation:
        "The region x + y ≤ 1/2 (inside the square) is a right triangle with legs 1/2, so its area is ½·(1/2)·(1/2) = 1/8 = 0.125.",
      commonErrors: [
        { value: 0.5, feedback: "That is P(x + y ≤ 1); the 1/2 threshold cuts a much smaller corner triangle." },
        { value: 0.25, feedback: "That is the area of the square [0,½]²; the favourable region is the TRIANGLE x + y ≤ ½." },
      ],
    }),
  ),
  num(
    GEOMETRIC,
    "ceiling",
    q(
      "u-geo-ceiling",
      "Two people each arrive at a uniformly random time within the same hour, independently. What is the probability their arrival times are within 15 minutes (0.25 h) of each other? (4 decimals.)",
      0.4375,
      {
        difficulty: "hard",
        concept: "Geometric probability (area in the unit square)",
        decimals: 4,
        explanation:
          "On the unit square, the 'not within 0.25' region is two corner triangles of total area (1 − 0.25)² = 0.5625. So P(within) = 1 − 0.5625 = 0.4375.",
        commonErrors: [
          { value: 0.25, feedback: "That is just the window width; you must compare AREAS on the square, not a single length." },
          { value: 0.5, feedback: "The favourable band is not half the square — compute 1 − (1 − 0.25)²." },
        ],
      },
    ),
  ),
  num(
    GEOMETRY,
    "floor",
    q("u-geom-floor", "A rectangular box has dimensions 3 × 4 × 12. What is the length of its space diagonal (corner to opposite corner)?", 13, {
      difficulty: "medium",
      concept: "3-D Pythagoras",
      explanation: "Space diagonal = √(3² + 4² + 12²) = √(9 + 16 + 144) = √169 = 13.",
      commonErrors: [
        { value: 5, feedback: "That is only the 3–4 face diagonal; include the third dimension (12)." },
        { value: 19, feedback: "You added the edges (3 + 4 + 12); use √(a² + b² + c²)." },
      ],
    }),
  ),
  num(
    GEOMETRY,
    "ceiling",
    q("u-geom-ceiling", "What is the smaller angle (in degrees) between the hour and minute hands of a clock at 3:30?", 75, {
      difficulty: "hard",
      concept: "Clock angles",
      unit: "°",
      explanation:
        "Minute hand at 180°. Hour hand at 3:30 is 3.5 × 30 = 105°. The gap is |180 − 105| = 75°.",
      commonErrors: [
        { value: 90, feedback: "You forgot the hour hand creeps past the 3 by half an hour (to 105°)." },
        { value: 15, feedback: "You used the 3 (90°) and the 6 (180°) as if the hour hand hadn't moved." },
      ],
    }),
  ),
  num(
    ORDER_STATS,
    "floor",
    q("u-os-floor", "You roll two fair six-sided dice. What is the probability the maximum of the two is at most 3?", 0.25, {
      difficulty: "medium",
      concept: "Order statistics (max)",
      explanation: "P(max ≤ 3) = P(both ≤ 3) = (3/6)² = (1/2)² = 1/4.",
      commonErrors: [
        { value: 0.5, feedback: "That is P(one die ≤ 3); BOTH must be ≤ 3, so square it." },
        { value: 0.75, feedback: "That would be P(min ≤ 3)-style reasoning; the max ≤ 3 needs both dice small." },
      ],
    }),
  ),
  // Ceiling: E[max/min of m dice] via the FR adapter.
  adapt(ORDER_STATS, "hardDiceOrderStat"),
  num(
    VARIANCE_CLT,
    "floor",
    q("u-var-floor", "A random variable X has Var(X) = 4. What is Var(3X)?", 36, {
      difficulty: "medium",
      concept: "Variance scaling",
      explanation: "Var(aX) = a²·Var(X) = 3²·4 = 9·4 = 36.",
      commonErrors: [
        { value: 12, feedback: "You used a·Var(X); variance scales by a², not a." },
        { value: 6, feedback: "You scaled the standard deviation; the question asks about variance." },
      ],
    }),
  ),
  num(
    VARIANCE_CLT,
    "ceiling",
    q("u-var-ceiling", "X and Y are independent with Var(X) = 3 and Var(Y) = 5. What is Var(2X − Y)?", 17, {
      difficulty: "hard",
      concept: "Variance of a linear combination",
      explanation: "Var(2X − Y) = 2²·Var(X) + (−1)²·Var(Y) = 4·3 + 5 = 17 (independence ⇒ no covariance term).",
      commonErrors: [
        { value: 11, feedback: "You used 2·Var(X) instead of 2²·Var(X); coefficients square." },
        { value: 7, feedback: "You subtracted the variances; variances always ADD for independent variables." },
      ],
    }),
  ),

  /* ---------------------- Processes & trading applications ------------------- */
  num(
    BETTING,
    "floor",
    q("u-bet-floor", "For an even-money (1:1) bet you win with probability 0.6. What fraction of your bankroll does Kelly say to stake?", 0.2, {
      difficulty: "medium",
      concept: "Kelly (even money)",
      explanation: "For b = 1, Kelly f* = p − q = 2p − 1 = 2(0.6) − 1 = 0.2.",
      commonErrors: [
        { value: 0.6, feedback: "You bet your win probability; Kelly bets the EDGE, not p." },
        { value: 0.1, feedback: "Half-Kelly is a choice, but full Kelly here is 2p − 1 = 0.2." },
      ],
    }),
  ),
  // Ceiling: Kelly with net odds b:1 via the FR adapter.
  adapt(BETTING, "hardKelly"),
  num(
    MARKOV,
    "floor",
    q(
      "u-markov-floor",
      "A token starts at position 2 on {0,1,2,3,4} and each step moves ±1 with equal probability, stopping at 0 or 4. What is the expected number of steps until it stops?",
      4,
      {
        difficulty: "medium",
        concept: "Fair gambler's ruin (duration)",
        explanation: "For a fair walk on {0..N} from a, the expected duration is a(N − a) = 2·(4 − 2) = 4.",
        commonErrors: [
          { value: 2, feedback: "That is the distance to a boundary, not the expected duration a(N−a)." },
          { value: 8, feedback: "You doubled; the fair-ruin duration is a(N−a) = 4." },
        ],
      },
    ),
  ),
  // Ceiling: BIASED gambler's ruin duration via the FR adapter.
  adapt(MARKOV, "hardRuinDuration"),
  num(
    BROWNIAN,
    "floor",
    q("u-bm-floor", "For standard Brownian motion Bₜ, what is Var(B₉ − B₄)?", 5, {
      difficulty: "medium",
      concept: "Independent increments of BM",
      explanation:
        "BM has independent increments with Var(Bₜ − Bₛ) = t − s, so Var(B₉ − B₄) = 9 − 4 = 5 (NOT 9 + 4).",
      commonErrors: [
        { value: 13, feedback: "You added the variances 9 + 4; the increment's variance is the time DIFFERENCE t − s." },
        { value: 9, feedback: "That is Var(B₉); the increment subtracts the earlier time (variance 9 − 4)." },
      ],
    }),
  ),
  num(
    BROWNIAN,
    "ceiling",
    q("u-bm-ceiling", "For driftless Brownian motion, you are told B₁ = 2. What is E[B₄]?", 2, {
      difficulty: "hard",
      concept: "Martingale property of BM",
      explanation:
        "Driftless BM is a martingale, so E[B₄ | B₁ = 2] = B₁ = 2 (independent increments have mean 0).",
      commonErrors: [
        { value: 8, feedback: "You scaled by t (2×4); increments are mean-zero, so the expectation stays at B₁." },
        { value: 5, feedback: "There is no drift, so the best forecast of the future value is the current value." },
      ],
    }),
  ),
  num(
    INTERVIEW_GAMES,
    "floor",
    q(
      "u-ig-floor",
      "A game costs $3 to play: you roll a fair die and win its face value in dollars, EXCEPT a roll of 1 pays nothing. What is your expected NET profit per play?",
      1 / 3,
      {
        difficulty: "medium",
        concept: "EV of a payoff table net of cost",
        unit: "$",
        explanation:
          "Expected winnings = (0 + 2 + 3 + 4 + 5 + 6)/6 = 20/6 = 10/3. Net = 10/3 − 3 = 1/3 ≈ $0.33.",
        commonErrors: [
          { value: 10 / 3, feedback: "That is gross expected winnings; subtract the $3 cost to play." },
          { value: 0.5, feedback: "You used the plain die mean 3.5; the roll of 1 pays 0, lowering the mean to 10/3." },
        ],
      },
    ),
  ),
  // Ceiling: secretary optimal-stopping win probability via the FR adapter.
  adapt(INTERVIEW_GAMES, "hardSecretary"),
  num(
    GAME_THEORY,
    "floor",
    q("u-gt-floor", "In rock–paper–scissors against a rational opponent, what probability should you play 'rock' in the optimal mixed strategy?", 1 / 3, {
      difficulty: "medium",
      concept: "Mixed-strategy equilibrium",
      explanation: "By symmetry the unique equilibrium mixes each move with probability 1/3.",
      commonErrors: [
        { value: 0.5, feedback: "There are three moves, not two; uniform over 3 is 1/3 each." },
        { value: 1, feedback: "A pure strategy is exploitable; the equilibrium is mixed." },
      ],
    }),
  ),
  num(
    GAME_THEORY,
    "ceiling",
    q(
      "u-gt-ceiling",
      "Poker river: the pot is $100 and your opponent bets $50. For you to be indifferent to calling, what fraction of the time must a rational opponent be bluffing?",
      1 / 3,
      {
        difficulty: "hard",
        concept: "Bluff frequency / pot odds",
        explanation:
          "You risk $50 to win the $150 pot, so you need to be right 50/150 = 1/3 of the time — the value-to-bluff mix makes the optimal bluff frequency 1/3.",
        commonErrors: [
          { value: 0.5, feedback: "You compared the bet to the pot alone; use bet ÷ (pot + bet) for the call threshold." },
          { value: 0.25, feedback: "That inverts the pot-odds ratio." },
        ],
      },
    ),
  ),

  /* -------- Advanced processes (quant-relevant course-completeness) ---------- *
   * GOAL A: the purely-academic distribution/process-theory topics (Moment
   * Generating Functions, Gamma Distribution, Joint Distributions, Limit
   * Theorems, Continuous-Time Markov Chains) were REMOVED from this diagnostic —
   * no attested OA/interview footprint (UT_COURSE_GAP_ANALYSIS.md §4). Branching
   * processes (PGF/extinction) and Markov-chain structure (Chapman–Kolmogorov /
   * stationary distributions) STAY: both are genuine top-firm interview families
   * and remain in `scoredContentTopicKeys()`. */
  num(
    BRANCHING,
    "floor",
    q("u-branch-floor", "In a branching process each individual has on average 2 offspring. Starting from 1, what is the expected population in generation 3?", 8, {
      difficulty: "medium",
      concept: "Branching-process mean growth",
      explanation: "Expected size in generation n is μⁿ; with μ = 2, generation 3 is 2³ = 8.",
      commonErrors: [
        { value: 6, feedback: "You used 2·3; the mean grows as μⁿ, not μ·n." },
        { value: 2, feedback: "That is one generation of growth; you need three." },
      ],
    }),
  ),
  num(
    BRANCHING,
    "ceiling",
    q(
      "u-branch-ceiling",
      "In a branching process each individual leaves 0 offspring with probability 1/2 and 3 offspring with probability 1/2. What is the extinction probability? (3 decimals.)",
      (Math.sqrt(5) - 1) / 2,
      {
        difficulty: "hard",
        concept: "Extinction probability (fixed point of the PGF)",
        decimals: 3,
        explanation:
          "q is the smallest root of q = ½ + ½q³. This factors to (q − 1)(q² + q − 1) = 0, and the smallest root in [0,1) is (√5 − 1)/2 ≈ 0.618.",
        commonErrors: [
          { value: 1, feedback: "q = 1 is always a root, but the mean (1.5 > 1) is supercritical, so extinction is the SMALLER root." },
          { value: 0.5, feedback: "That is P(0 offspring), not the extinction probability of the whole line." },
        ],
      },
    ),
  ),
  num(
    MARKOV_STRUCTURE,
    "floor",
    q(
      "u-mstruct-floor",
      "A 2-state chain has transition matrix rows [0.8, 0.2] and [0.4, 0.6]. What is the 2-step probability of going from state 1 back to state 1?",
      0.72,
      {
        difficulty: "medium",
        concept: "Chapman–Kolmogorov (P²)",
        explanation: "P²[1→1] = 0.8·0.8 + 0.2·0.4 = 0.64 + 0.08 = 0.72.",
        commonErrors: [
          { value: 0.64, feedback: "You kept only the stay-stay path; add the go-and-return path 0.2·0.4." },
          { value: 0.8, feedback: "That is the 1-step probability; square the matrix for two steps." },
        ],
      },
    ),
  ),
  num(
    MARKOV_STRUCTURE,
    "ceiling",
    q(
      "u-mstruct-ceiling",
      "For the chain with rows [0.8, 0.2] and [0.4, 0.6], what is the stationary probability of state 1?",
      2 / 3,
      {
        difficulty: "hard",
        concept: "Stationary distribution (πP = π)",
        explanation:
          "Balance: π₁·0.2 = π₂·0.4, so π₁ = 2π₂. With π₁ + π₂ = 1, π₁ = 2/3.",
        commonErrors: [
          { value: 0.5, feedback: "The chain is not symmetric; solve πP = π rather than assuming uniform." },
          { value: 0.8, feedback: "That is a single transition probability, not the long-run share." },
        ],
      },
    ),
  ),
];

/* ========================================================================== */
/*  EXTRA HARD-CEILING ADAPTERS (showcase every hard OA family; free/exact)     */
/* ========================================================================== */

/**
 * Each hard OA archetype mapped to the scored topic it best probes. Used to add
 * extra hard-ceiling items so the diagnostic exercises the FULL hard bank (all
 * 14 families) without authoring any new math — each is a `frAdapters` projection
 * of the exact verifier.
 */
const ADAPTER_FAMILY_TOPIC: [string, string][] = [
  ["hardPathIntersect", MARKOV],
  ["hardGraphHitting", MARKOV],
  ["hardStepLanding", MARKOV],
  ["hardCycleMeeting", MARKOV],
  ["hardPatternWait", CONDITIONAL_EXPECTATION],
  ["hardResetCollector", EXPECTED_VALUE],
  ["hardHiddenComposition", CONDITIONAL],
  ["hardInformedLift", INTERVIEW_GAMES],
  ["hardRuinDuration", MARKOV],
  ["hardSecretary", INTERVIEW_GAMES],
  ["hardDiceOrderStat", ORDER_STATS],
  ["hardCoinBias", CONDITIONAL],
  ["hardOneReroll", EXPECTED_VALUE],
  ["hardKelly", BETTING],
];

/**
 * A second, curated pass over the highest-signal hard families (random walks,
 * optimal stopping, Bayes, EV) mapped to sensible scored topics — extra hard
 * ceilings that push the diagnostic to ≈ 100 items with zero new math.
 */
const ADAPTER_FAMILY_TOPIC_2: [string, string][] = [
  ["hardPathIntersect", MARKOV],
  ["hardGraphHitting", MARKOV],
  ["hardCoinBias", CONDITIONAL],
  ["hardHiddenComposition", CONDITIONAL],
  ["hardOneReroll", INTERVIEW_GAMES],
  ["hardResetCollector", EXPECTED_VALUE],
];

/**
 * A THIRD very-hard pass (GOAL B): after removing the five academic topics, this
 * re-weights the diagnostic toward the anchor tier — the lattice-path
 * intersection (`hardPathIntersect`), random-walk meeting/hitting/first-passage
 * (`hardCycleMeeting`, `hardGraphHitting`, `hardStepLanding`, `hardRuinDuration`),
 * optimal stopping (`hardSecretary`), hard Bayes (`hardHiddenComposition`),
 * pattern-wait first-step (`hardPatternWait`), and order-statistics EV
 * (`hardDiceOrderStat`). Each is an exact-verified `frAdapters` projection (no new
 * math), so the diagnostic keeps a GENUINELY-very-hard ceiling subset while the
 * item count stays ≈ {@link UNTIMED_ITEM_COUNT}.
 */
const ADAPTER_FAMILY_TOPIC_3: [string, string][] = [
  ["hardPathIntersect", MARKOV],
  ["hardCycleMeeting", MARKOV],
  ["hardGraphHitting", MARKOV],
  ["hardStepLanding", MARKOV],
  ["hardRuinDuration", MARKOV],
  ["hardPatternWait", CONDITIONAL_EXPECTATION],
  ["hardSecretary", INTERVIEW_GAMES],
  ["hardOneReroll", EXPECTED_VALUE],
  ["hardHiddenComposition", CONDITIONAL],
  ["hardDiceOrderStat", ORDER_STATS],
];

/**
 * NET-NEW game-OA families (Cluster B): Next-Card conditional fair value,
 * de-vig/overround removal, basket/NAV creation-redemption arbitrage, and
 * make-a-market pick-off P&L. Each is an exact-verified `frAdapters` projection
 * (no new math), added here as an extra hard ceiling so the untimed diagnostic
 * showcases the trading-desk pricing families alongside the probability tier.
 */
const ADAPTER_FAMILY_TOPIC_NETNEW: [string, string][] = [
  ["hardNextCard", CONDITIONAL],
  ["hardDeVig", BETTING],
  ["hardBasketNav", INTERVIEW_GAMES],
  ["hardMakeMarket", INTERVIEW_GAMES],
];

const EXTRA_ADAPTER_ITEMS: UntimedAdapterItem[] = [
  ...ADAPTER_FAMILY_TOPIC,
  ...ADAPTER_FAMILY_TOPIC_2,
  ...ADAPTER_FAMILY_TOPIC_3,
  ...ADAPTER_FAMILY_TOPIC_NETNEW,
].map(([family, topicKey]) => adapt(topicKey, family, topicKey, "ceiling"));

/* ========================================================================== */
/*  BRAINTEASER FLASHCARDS (hybrid grading — decision §10.3)                    */
/* ========================================================================== */

/** Every exact-verified brainteaser family (house originals + technique toolkit). */
const BRAINTEASER_FAMILIES: [string, FlashcardGenerator][] = [
  ...ALL_BRAINTEASER_FAMILIES,
  ...ALL_TECHNIQUE_FAMILIES,
];

/**
 * Brainteaser flashcard items (folded into `competency::brainteaser-reasoning`).
 * Draw every family once, then cycle the list again for a second pass, so the
 * section mixes objectively-gradable (numeric) cards with self-eval-only cards
 * and gives the competency Beta enough evidence to be seed-meaningful.
 */
const BRAINTEASER_COUNT = 24;

const BRAINTEASER_ITEMS: UntimedBrainteaserItem[] = Array.from(
  { length: BRAINTEASER_COUNT },
  (_, i) => {
    const [name, generator] = BRAINTEASER_FAMILIES[i % BRAINTEASER_FAMILIES.length];
    const pass = Math.floor(i / BRAINTEASER_FAMILIES.length);
    return {
      kind: "brainteaser",
      topicKey: COMPETENCY_BRAINTEASER,
      subtopic: "brainteaser-reasoning",
      tier: "mid",
      familyName: pass === 0 ? name : `${name}#${pass}`,
      generator,
    } satisfies UntimedBrainteaserItem;
  },
);

/* ========================================================================== */
/*  THE BLUEPRINT                                                               */
/* ========================================================================== */

/**
 * The full untimed-diagnostic item list, in serve order: the per-topic floor +
 * ceiling content items, then the extra hard-ceiling adapters, then the
 * brainteaser flashcards. ≈ {@link UNTIMED_ITEM_COUNT} items total.
 */
export const UNTIMED_BLUEPRINT: UntimedItem[] = [
  ...CONTENT_ITEMS,
  ...EXTRA_ADAPTER_ITEMS,
  ...BRAINTEASER_ITEMS,
];

/** Total item count in the blueprint (≈ 100 — RESOLVED DECISION §10.6). */
export const UNTIMED_ITEM_COUNT = UNTIMED_BLUEPRINT.length;

/** The numeric (non-brainteaser) content items (authored + adapter). */
export function untimedContentItems(): (UntimedNumericItem | UntimedAdapterItem)[] {
  return UNTIMED_BLUEPRINT.filter(
    (it): it is UntimedNumericItem | UntimedAdapterItem => it.kind !== "brainteaser",
  );
}

/** The brainteaser flashcard items. */
export function untimedBrainteaserItems(): UntimedBrainteaserItem[] {
  return UNTIMED_BLUEPRINT.filter(
    (it): it is UntimedBrainteaserItem => it.kind === "brainteaser",
  );
}
