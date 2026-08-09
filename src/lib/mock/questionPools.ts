/**
 * mock/questionPools.ts — deterministic numeric question pools for the mock
 * interview's non-arithmetic scored items: PROBABILITY / EV, SEQUENCES, and
 * ESTIMATION.
 *
 * Every generator returns a `MockNumericQuestion` — a `NumericQuestion` (numeric
 * answer + worked explanation) PLUS a pair of CONCEPT-SPECIFIC `followups`
 * (a probe + an adversarial). Both the answer and the follow-ups are graded by
 * the SAME deterministic path, so correctness never depends on the LLM. All
 * items are pure reasoning / probability / estimation — ZERO options-or-
 * derivatives finance knowledge required. Same seed ⇒ identical question.
 *
 * The follow-ups are keyed to each question's SETUP, not to the numeric shape of
 * the answer: a probe deepens the SAME principle (a genuinely different related
 * computation or a small generalization), and an adversarial challenges the
 * FUNDAMENTAL logic (change an assumption, generalize to n, or spring a trap for
 * shallow reasoning). They are NEVER "square your answer" / "3⁄8 of it" style
 * arithmetic on the previous number.
 *
 * PURE: no React, DOM, storage, or network.
 */
import type { Rng } from "@/lib/rng";
import type { Difficulty, NumericQuestion } from "@/types/content";
import type {
  MockQuestionType,
  PoolDifficultyLike,
  QuestionFollowups,
  RequiredReasoning,
  TopicFamily,
} from "./types";
import {
  latticePathsIntersectProb,
  expectedMaxDice,
  expectedMinDice,
  expectedFlipsForPattern,
  gamblersRuinReachTop,
  couponCollectorExpected,
  couponCollectorLastFaceExpected,
  birthdayCollisionProb,
  birthdayNoCollisionProb,
  derangementProb,
  derangementCount,
  bankOrRollFiniteEV,
  hiddenCompositionNextBlack,
  kellyFraction,
} from "./archetypes/verifiers";

/** A scored numeric question with its two concept-specific follow-ups. */
export interface MockNumericQuestion extends NumericQuestion {
  followups?: QuestionFollowups;
  /**
   * Per-question REQUIRED-JUSTIFICATION signals for the MAIN reasoning-quality
   * grade: a `sound` verdict requires the candidate to convey this question's
   * MECHANISM, not merely restate the final answer/arithmetic. Threaded onto the
   * `MathStep` and consulted by the deterministic reasoning grader.
   */
  requiredReasoning?: RequiredReasoning;
  /**
   * Coarse topic-FAMILY tag (see `TopicFamily`). Populated by `familyForId` in
   * the draw functions and threaded onto the `MathStep`, so the assembler can
   * enforce diversity (no two adjacent scored items of the same family, per-
   * family caps, N distinct families) and the acceptance gate can audit it.
   */
  family?: TopicFamily;
  /**
   * The values ALREADY COMPUTED while solving the base — the numerator, the
   * denominator, a sub-count, a threshold, etc. The acceptance gate rejects any
   * numeric follow-up whose answer equals one of these (a DECOMPOSITION: asking
   * the candidate for a sub-step they already did). Author the true intermediates
   * so the gate has teeth; the base `answer` itself is always implicitly included.
   */
  baseIntermediates?: number[];
}

/**
 * Shared MECHANISM-signal banks. Authored once and reused across the reachable
 * generators so a terse-but-correct MAIN explanation still matches, while a
 * conclusion-only / hand-wave answer falls short of `sound`. Kept broad (many
 * synonyms) to AVOID over-rejecting genuine concise reasoning.
 */
const MECH = {
  /** Growing-gap / constant-second-difference (quadratic) family. */
  quadratic: [
    "second difference",
    "second differences",
    "2nd difference",
    "second-order difference",
    "difference of the differences",
    "differences grow",
    "differences increase",
    "gaps grow",
    "gaps increase",
    "gap grows",
    "gap increases",
    "grow by 6",
    "growing by 6",
    "increase by 6",
    "increases by 6",
    "constant increment",
    "quadratic",
    "parabola",
    "n^2",
    "3n^2",
    "closed form",
    "6 12 18 24",
    "12 18 24",
    "18 24 30",
  ],
} as const;

/* -------------------------------------------------------------------------- */
/*  Small exact helpers                                                        */
/* -------------------------------------------------------------------------- */

function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
  return Math.round(r);
}

/** Falling factorial n·(n−1)···(n−k+1) = number of ordered k-selections. */
function permute(n: number, k: number): number {
  let r = 1;
  for (let i = 0; i < k; i++) r *= n - i;
  return r;
}

function factorial(n: number): number {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function round(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round((n + Number.EPSILON) * f) / f;
}

/* -------------------------------------------------------------------------- */
/*  PROBABILITY / EV generators                                                */
/* -------------------------------------------------------------------------- */

/** P(exactly two of three independent events occur). */
function genExactlyTwoOfThree(rng: Rng): MockNumericQuestion {
  const pPct = rng.pick([20, 25, 30, 40, 50, 60]);
  const p = pPct / 100;
  const ans = round(3 * p * p * (1 - p), 4);
  const atLeastOne = round(1 - (1 - p) ** 3, 4);
  const exactlyThree = round(p ** 3, 4);
  const atLeastTwo = round(3 * p * p * (1 - p) + p ** 3, 4); // exactly-two OR all-three
  return {
    id: `pev-twoof3-${pPct}`,
    prompt: `Three independent events each occur with probability ${pPct}%. What is the probability that EXACTLY two of the three occur?`,
    answer: ans,
    decimals: 4,
    difficulty: "medium",
    concept: "Independent events",
    explanation: `Build it from the mechanism: "exactly two occur" means two specific events fire (probability p·p by independence) while the third does NOT (probability 1−p), and there are 3 different ways to choose WHICH event is the one that fails. Those 3 cases are mutually exclusive, so they add. Hence 3 · p² · (1−p) = 3 · ${round(p * p, 4)} · ${round(1 - p, 2)} = ${ans}.`,
    unit: "",
    commonErrors: [
      { value: round(p * p, 4), feedback: "You computed p² for one specific pair but forgot (1−p) for the third event and the ×3 choices.", misconception: "forgot_complement_and_count" },
      { value: round(p * p * p, 4), feedback: "That's all three occurring — you need exactly two.", misconception: "all_three" },
    ],
    baseIntermediates: [round(p * p, 4), exactlyThree, round(1 - p, 4), round(3 * p, 4), atLeastOne, ans],
    source: "mock probability/EV",
    followups: {
      probe: {
        // ADD-CONSTRAINT: escalate "exactly two" to "at least two" (adds the
        // all-three leg) — a strictly harder related computation, not the base
        // sub-steps (p², 1−p) the candidate already had.
        type: "add-constraint",
        difficulty: "hard",
        prompt: `For the SAME three independent ${pPct}% events, what is the probability that AT LEAST TWO of them occur (that is, exactly two OR all three)?`,
        answerKind: "numeric",
        answer: atLeastTwo,
        decimals: 4,
        modelReasoning: `"At least two" is just "exactly two" OR "all three", and those two outcomes can't happen at once, so you add them with no double-counting: P = 3·p²·(1−p) + p³ = ${ans} + ${exactlyThree} = ${atLeastTwo}.`,
        commonErrors: [
          { value: ans, feedback: "That's only EXACTLY two — you must also add the all-three case p³.", misconception: "forgot_all_three_leg" },
          { value: exactlyThree, feedback: "That's only all three (p³); add the exactly-two term 3·p²·(1−p) as well.", misconception: "only_all_three" },
        ],
      },
      adversarial: {
        type: "change-regime",
        difficulty: "hard",
        prompt: `Suppose the three events were MUTUALLY EXCLUSIVE instead of independent (still each ${pPct}%). Is 3·p²·(1−p) still the probability that exactly two occur? State the correct probability of "exactly two" under mutual exclusivity and explain why.`,
        answerKind: "reasoning",
        modelAnswer: `No — the probability is exactly 0.`,
        modelReasoning: `Mutually exclusive means at most one event can occur, so "exactly two" is impossible: P = 0. The formula 3·p²·(1−p) assumed independence and no longer applies.`,
        conclusionTargets: [0],
        conclusionKeywords: [["mutually exclusive", "exclusive", "cannot both", "can't both", "cannot two", "at most one", "only one", "impossible", "zero", "can't happen", "cannot happen"]],
        // "impossible / mutually exclusive" IS the correct conclusion, and the
        // value is exactly 0 — accept EITHER the stated 0 OR the exclusivity
        // reasoning (a candidate who says "impossible" needn't also type "0").
        conclusionMode: "any",
        // The correct answer is NO / it is NOT still 3·p²·(1−p) (it's 0). A
        // candidate who commits to "yes, it's still the same / unchanged" has
        // committed to the WRONG side — even if they quote a true fact like
        // "both can't occur". `expectedPolarity: "deny"` + these wrong phrasings
        // make the rock-solid grader flag that as CLARIFY (mixed) / MISSED
        // rather than passing it as correct (the reported jailbreak).
        expectedPolarity: "deny",
        wrongKeywords: [["still 3", "still the same", "unchanged", "same as before", "stays the same", "no change", "yes it is still", "3·p", "3p²", "3p^2"]],
      },
    },
  };
}

/**
 * Conditional probability with a NON-trivial conditioning event. The MAIN is
 * NOT the one-liner "second red given first red" (that is a single ratio a
 * strong candidate says instantly); it asks P(both red | AT LEAST ONE red) —
 * a genuine Bayes ratio requiring P(both red) over P(≥1 red). The PROBE isolates
 * the unconditional P(both red) that drives the numerator; the ADVERSARIAL asks
 * whether conditioning makes it larger or smaller (it must be LARGER, since the
 * no-red outcomes are removed).
 */
function genConditionalUrn(rng: Rng): MockNumericQuestion {
  const red = rng.int(3, 7);
  const blue = rng.int(2, 6);
  const T = red + blue;
  const bothRed = red * (red - 1); // ∝ C(red,2)
  const allPairs = T * (T - 1); // ∝ C(T,2)
  const atLeastOneRedPairs = allPairs - blue * (blue - 1); // remove both-blue pairs
  const ans = round(bothRed / atLeastOneRedPairs, 4); // P(both red | ≥1 red)
  const bothRedUncond = round(bothRed / allPairs, 4); // P(both red), no conditioning
  const withReplacement = round((red / T) * (red / T), 4);
  const secondGivenFirst = round((red - 1) / (T - 1), 4);
  const atLeastOneRed = round(atLeastOneRedPairs / allPairs, 4);
  // PROBE curveball — escalate to THREE draws, conditioning on "at least two red".
  const red3 = choose(red, 3);
  const exactlyTwoRed3 = choose(red, 2) * choose(blue, 1);
  const atLeastTwoRed3 = red3 + exactlyTwoRed3;
  const allThreeGivenTwo = round(red3 / atLeastTwoRed3, 4); // P(all 3 red | ≥2 red)
  return {
    id: `pev-urn-${red}-${blue}`,
    prompt: `An urn has ${red} red and ${blue} blue balls. You draw two without replacement. Given that AT LEAST ONE of the two drawn balls is red, what is the probability that BOTH are red?`,
    answer: ans,
    decimals: 4,
    difficulty: "hard",
    concept: "Conditional probability",
    explanation: `Conditioning on "at least one red" throws away every both-blue draw, so the real question is: among the pairs that contain some red, what fraction are fully red? Count equally-likely ordered pairs — both-red accounts for ${red}·${red - 1}, and the ONLY pairs we discard are the both-blue ones (${blue}·${blue - 1} of the ${T}·${T - 1} total). Removing losing outcomes can only push the fraction up, so the answer sits a bit above the plain P(both red). Formally P(both red | ≥1 red) = P(both red)/P(≥1 red) = ${red}·${red - 1} / (${T}·${T - 1} − ${blue}·${blue - 1}) = ${ans}.`,
    unit: "",
    commonErrors: [
      { value: bothRedUncond, feedback: "That's the UNCONDITIONAL P(both red). You must divide by P(at least one red) (< 1), so the conditional is larger.", misconception: "forgot_to_condition" },
      { value: secondGivenFirst, feedback: "That's P(second red | first red) — a different, simpler conditioning. Here you condition on 'at least one of the two is red'.", misconception: "wrong_conditioning_event" },
    ],
    baseIntermediates: [bothRedUncond, secondGivenFirst, withReplacement, atLeastOneRed, ans],
    source: "mock probability/EV",
    followups: {
      probe: {
        // ADD-CONSTRAINT / generalize: escalate to THREE draws with a HARDER
        // conditioning event ("at least two red"). Genuinely new work — a fresh
        // C(·,3) ratio — NOT the numerator sub-step the candidate already computed.
        type: "add-constraint",
        difficulty: "stretch",
        prompt: `Now draw THREE balls without replacement instead of two. Given that AT LEAST TWO of the three drawn are red, what is the probability that ALL THREE are red?`,
        answerKind: "numeric",
        answer: allThreeGivenTwo,
        decimals: 4,
        modelReasoning: `Same idea, one draw deeper: restrict to triples with at least two red, then ask what share are all-red. The "≥2 red" world splits cleanly into two disjoint pieces — all-three-red (C(${red},3)) plus exactly-two-red (C(${red},2)·C(${blue},1)) — so P(all 3 red | ≥2 red) = ${red3} / (${red3} + ${exactlyTwoRed3}) = ${allThreeGivenTwo}.`,
        commonErrors: [
          { value: round(red3 / choose(T, 3), 4), feedback: "That's the UNCONDITIONAL P(all three red); you must divide by P(at least two red), not by all triples.", misconception: "forgot_to_condition_three" },
          { value: ans, feedback: "That's the two-draw answer; the three-draw conditioning event and count are different.", misconception: "reused_two_draw" },
        ],
      },
      adversarial: {
        type: "adversarial-trap",
        difficulty: "hard",
        prompt: `Is P(both red | at least one red) LARGER or SMALLER than the unconditional P(both red), and why? Commit to a side and justify.`,
        answerKind: "reasoning",
        modelAnswer: `Larger.`,
        modelReasoning: `Conditioning on "at least one red" throws out the both-blue outcomes, so you divide P(both red) by P(≥1 red) < 1. Dividing by something below 1 makes the conditional probability strictly LARGER than the unconditional ${bothRedUncond}.`,
        conclusionTargets: [ans],
        conclusionKeywords: [["larger", "greater", "bigger", "higher", "increases", "goes up", "more likely", "raises it"]],
        conclusionMode: "any",
        wrongKeywords: [["smaller", "less likely", "lower", "decreases", "goes down", "the same", "unchanged", "no change", "equal"]],
      },
    },
  };
}

/**
 * Geometric distribution as a TURN-BASED RACE (not the free "E = 1/p"). Two
 * players alternate attempts, each succeeding with prob p = 1/k; the first to
 * succeed wins. The MAIN — P(first mover wins) = p·Σ(1−p)^{even} = 1/(2−p) —
 * requires summing a geometric series over one's own turns (real multi-step
 * work, not a memorized formula). The PROBE flips to the second mover; the
 * ADVERSARIAL takes p → 0, where the first-move edge vanishes to 1/2.
 */
function genGeometricFlips(rng: Rng): MockNumericQuestion {
  const k = rng.pick([3, 4, 5, 6]); // per-attempt success prob p = 1/k
  const first = round(k / (2 * k - 1), 4); // P(first mover wins) = 1/(2 − p)
  const second = round((k - 1) / (2 * k - 1), 4); // P(second mover wins)
  const pp = 1 / k;
  const qq = 1 - pp;
  const firstOfThree = round(pp / (1 - qq ** 3), 4); // P(first of THREE players wins)
  return {
    id: `pev-geo-${k}`,
    prompt: `Two players alternate attempts at a task; on each attempt a player succeeds with probability 1/${k}, independently. They take turns until someone succeeds, and whoever succeeds FIRST wins. What is the probability that the player who moves first wins?`,
    answer: first,
    decimals: 4,
    difficulty: "hard",
    concept: "Geometric distribution",
    explanation: `Intuition first: moving first is a genuine edge — every round you get the earlier shot — so the answer must sit a bit ABOVE 1/2, never below. To pin it exactly, note the first mover can only win on the ODD attempts 1, 3, 5, …, and each needs every prior attempt to have missed: P = p + (1−p)²p + (1−p)⁴p + ⋯. That geometric series collapses to p / (1 − (1−p)²) = 1/(2 − p). With p = 1/${k}, that is ${k}/(2·${k} − 1) = ${first}.`,
    unit: "",
    commonErrors: [
      { value: 0.5, feedback: "It isn't 50/50 — moving first is a real edge because you get the first attempt every round.", misconception: "assumed_symmetric" },
      { value: round(1 / k, 4), feedback: `1/${k} is the single-attempt success chance, not the whole-game win probability (you must sum the geometric series over your own turns).`, misconception: "used_single_attempt" },
    ],
    baseIntermediates: [first, second, round(1 / k, 4), 0.5],
    source: "mock probability/EV",
    followups: {
      probe: {
        // GENERALIZE-N: three players cycling instead of two — the geometric sum
        // now runs over every third turn, a genuinely harder setup (not 1 − first).
        type: "generalize-n",
        difficulty: "stretch",
        prompt: `Now THREE players take turns in a fixed cyclic order (still succeeding with probability 1/${k} per attempt, first success wins). What is the probability that the player who moves FIRST wins?`,
        answerKind: "numeric",
        answer: firstOfThree,
        decimals: 4,
        modelReasoning: `The first mover still leads each cycle, so they beat a symmetric 1/3 — but by less than in the two-player game, since now two rivals shoot before their next turn. They win only on attempts 1, 4, 7, …: P = p·Σ(1−p)^{3j} = p/(1−(1−p)³). With p = 1/${k} that is ${firstOfThree}.`,
        commonErrors: [
          { value: first, feedback: "That's the TWO-player first-mover probability; with three players the geometric sum runs over every THIRD attempt.", misconception: "reused_two_player" },
          { value: round(1 / 3, 4), feedback: "It isn't a symmetric 1/3 — moving first is an edge because you get the first attempt each cycle.", misconception: "assumed_symmetric_three" },
        ],
      },
      adversarial: {
        type: "change-regime",
        difficulty: "hard",
        prompt: `Now let the per-attempt success probability shrink toward 0 (the task becomes nearly impossible on any single try). What value does the FIRST mover's win probability approach, and why does the first-move advantage fade?`,
        answerKind: "reasoning",
        modelAnswer: `It approaches 1/2 (even odds).`,
        modelReasoning: `As p → 0 the first mover almost never converts their one-attempt head start, so the game becomes symmetric: P(first wins) = 1/(2 − p) → 1/2. The edge only exists because that first attempt matters.`,
        conclusionTargets: [0.5],
        conclusionKeywords: [["1/2", "one half", "a half", "half", "0.5", "even odds", "even", "50/50", "fifty-fifty", "symmetric", "no advantage", "no edge"]],
        conclusionMode: "any",
        wrongKeywords: [["certain", "certainty", "guaranteed", "always wins", "always win", "sure win", "stays the same", "unchanged", "no change", "keeps the edge", "still an edge"]],
      },
    },
  };
}

/**
 * Memoryless conditional flips with a BIASED coin (heads w.p. 1/3), so the
 * answer is not a clean power of 1/2 a candidate reads off. P(exactly m | >1
 * flip) = (2/3)^{m−2}·(1/3) requires setting up the conditional ratio AND a real
 * power computation. m ∈ {3,4} (the trivially-free m=2 case is excluded).
 */
function genConditionalGeometric(rng: Rng): MockNumericQuestion {
  const p = 1 / 3;
  const q = 1 - p; // 2/3
  const m = rng.pick([3, 4]);
  const ans = round(q ** (m - 2) * p, 4); // P(N = m | N > 1)
  const nextM = round(q ** (m - 1) * p, 4); // P(N = m+1 | N > 1)
  const uncond = round(q ** (m - 1) * p, 4); // P(N = m) unconditional (a decoy)
  const tailGivenGt1 = round(q ** (m - 1), 4); // P(N > m | N > 1) = q^{m-1}
  const tailUncond = round(q ** m, 4); // P(N > m) unconditional (a decoy)
  return {
    id: `pev-condgeo-${m}`,
    prompt: `You flip a biased coin that lands HEADS with probability 1/3, repeatedly, until the first heads. Given that you needed MORE than one flip, what is the probability you needed exactly ${m} flips?`,
    answer: ans,
    decimals: 4,
    difficulty: "hard",
    concept: "Conditional probability (memorylessness)",
    explanation: `Key intuition: the coin is MEMORYLESS — once you're told the first flip was a tail, the wait effectively restarts, so needing exactly ${m} flips in total is the same as needing exactly ${m - 1} flips from scratch (that's ${m - 2} more tails, then a head): (2/3)^${m - 2}·(1/3). Mechanically this is P(N=${m})/P(N>1) = (2/3)^${m - 1}·(1/3) / (2/3) = (2/3)^${m - 2}·(1/3) = ${ans}.`,
    unit: "",
    commonErrors: [
      { value: uncond, feedback: `That's the UNCONDITIONAL P(exactly ${m} flips); you must divide by P(>1 flip) = 2/3.`, misconception: "forgot_conditioning" },
    ],
    baseIntermediates: [ans, uncond, nextM, round(q, 4), round(p, 4)],
    source: "mock probability/EV",
    followups: {
      probe: {
        // INVERT / add-constraint: from an EXACTLY-m probability to the TAIL
        // "MORE than m flips" — a cumulative sum, not the same point mass one step
        // out. Requires P(N>m | N>1) = q^{m−1}, genuinely different reasoning.
        type: "invert",
        difficulty: "hard",
        prompt: `Same biased coin — given you needed more than one flip, what is the probability you needed MORE than ${m} flips (i.e. at least ${m + 1})?`,
        answerKind: "numeric",
        answer: tailGivenGt1,
        decimals: 4,
        modelReasoning: `"More than ${m} flips" just means the first ${m} flips are all tails — but you already know the first one was a tail, so only ${m - 1} of those tails are new information. By memorylessness the conditional tail is (2/3)^${m - 1} = ${tailGivenGt1}. (Mechanically, P(N>${m})/P(N>1) = (2/3)^${m}/(2/3).)`,
        commonErrors: [
          { value: tailUncond, feedback: `That's the UNCONDITIONAL tail P(N>${m}) = (2/3)^${m}; you must still divide by P(N>1) = 2/3.`, misconception: "forgot_conditioning_tail" },
          { value: ans, feedback: `That's P(N=${m} | N>1), a single point mass — the question asks for the whole tail beyond ${m}.`, misconception: "point_not_tail" },
        ],
      },
      adversarial: {
        type: "change-regime",
        difficulty: "hard",
        prompt: `Does the answer depend on HOW MANY early flips you're told came up tails before you start counting? Explain in one line using the memorylessness of the geometric distribution.`,
        answerKind: "reasoning",
        conclusionKeywords: [["memoryless", "no memory", "doesn't depend", "independent", "same distribution", "resets", "geometric"]],
        modelAnswer: `No — it does not depend on the earlier tails.`,
        modelReasoning: `The geometric distribution is memoryless: given no success yet, the count of additional flips has the SAME distribution no matter how many tails already happened. The past tails carry no information about when the first heads arrives.`,
      },
    },
  };
}

/**
 * Combinatorics that is NOT a bare C(n,k) look-up. A committee of k from n where
 * two specific people refuse to serve TOGETHER: the MAIN needs complementary
 * counting — all committees minus the ones containing BOTH, C(n,k) − C(n−2,k−2)
 * — with awkward parameters (n up to 10) that force real computation. The PROBE
 * isolates the forbidden count C(n−2,k−2); the ADVERSARIAL contrasts ordered
 * selections (permutations = k!·C(n,k)).
 */
function genCombosConstraint(rng: Rng): MockNumericQuestion {
  const n = rng.int(7, 10);
  const k = rng.int(3, 4);
  const total = choose(n, k);
  const bothTogether = choose(n - 2, k - 2); // committees containing BOTH A and B
  const ans = total - bothTogether; // committees NOT containing both
  const ordered = permute(n, k); // distinct roles from all n
  const trioTogether = choose(n - 3, k - 3); // committees containing ALL of A,B,C
  const ansTrio = total - trioTogether; // committees NOT containing all three
  return {
    id: `pev-choose-${n}-${k}`,
    prompt: `A committee of ${k} must be chosen from ${n} distinct candidates, but two of them (A and B) refuse to serve TOGETHER — a committee may contain A, or B, or neither, but never both. How many valid committees are there? (Order doesn't matter.)`,
    answer: ans,
    difficulty: "hard",
    concept: "Combinatorics",
    explanation: `Counting valid committees head-on means juggling three cases (A but not B, B but not A, neither) — it's far cleaner to count ALL committees and subtract only the forbidden ones. The forbidden committees are exactly those seating BOTH A and B: fix their two seats and fill the remaining ${k - 2} from the other ${n - 2} people, C(${n - 2},${k - 2}) = ${bothTogether}. So valid = C(${n},${k}) − C(${n - 2},${k - 2}) = ${total} − ${bothTogether} = ${ans}.`,
    unit: "",
    commonErrors: [
      { value: total, feedback: "That's ALL committees; you still have to remove the ones with A and B together.", misconception: "ignored_constraint" },
      { value: ordered, feedback: "That counts ORDERED selections (permutations); a committee is unordered — divide by k!.", misconception: "permutation_not_combination" },
    ],
    baseIntermediates: [total, bothTogether, ordered, choose(n - 2, k - 1)],
    source: "mock probability/EV",
    followups: {
      probe: {
        // ADD-CONSTRAINT: a HARDER exclusion — now THREE people can't all serve
        // together. Same complementary-counting principle, escalated to a trio;
        // NOT the C(n−2,k−2) subtracted term the base already computed.
        type: "add-constraint",
        difficulty: "stretch",
        prompt: `Change the rule: now THREE people (A, B, and C) refuse to ALL serve together — a committee of ${k} may include any two of them, but never all three. How many valid committees are there now?`,
        answerKind: "numeric",
        answer: ansTrio,
        decimals: 0,
        modelReasoning: `Same complementary trick: the only newly-forbidden committees are those seating ALL of A, B, C, so fix their three seats and fill the remaining ${k - 3} from the other ${n - 3} people, C(${n - 3},${k - 3}) = ${trioTogether}. Valid = C(${n},${k}) − C(${n - 3},${k - 3}) = ${total} − ${trioTogether} = ${ansTrio}.`,
        commonErrors: [
          { value: total, feedback: "That's ALL committees; still subtract the ones that seat all three of A, B, C.", misconception: "ignored_trio_constraint" },
          { value: bothTogether, feedback: "That's the two-person forbidden count from the base; the new rule forbids only the full TRIO — subtract C(n−3,k−3).", misconception: "reused_pair_count" },
        ],
      },
      adversarial: {
        type: "change-regime",
        difficulty: "hard",
        prompt: `Ignore the restriction for a moment. If the ${k} chosen were instead given DISTINCT numbered roles (order matters), how many ways are there to fill them from all ${n} candidates? State the count and explain why it is exactly ${factorial(k)}× the unrestricted committee count C(${n},${k}).`,
        answerKind: "reasoning",
        conclusionTargets: [ordered],
        conclusionKeywords: [["order", "ordered", "permutation", "arrange", "factorial", "k!", `${k}!`]],
        modelAnswer: `${ordered} ordered selections (a permutation).`,
        modelReasoning: `Each unordered committee of ${k} people can be arranged into the numbered roles in ${k}! = ${factorial(k)} ways, so the ordered count is ${k}!·C(${n},${k}) = ${ordered} — that's the permutation P(${n},${k}).`,
      },
    },
  };
}

/** Optimal-stopping EV: keep or reroll a die once (multi-stage EV). */
function genDieReroll(): MockNumericQuestion {
  // Reroll if first roll < 3.5 (i.e. 1,2,3); keep 4,5,6. Continuation value 3.5.
  const ev = 4.25; // ½·E[keep 4,5,6]=5 + ½·3.5
  // With TWO rerolls: last-stage continuation 3.5 → the one-reroll value is 4.25,
  // so on the first roll keep only 5,6 (they beat 4.25), else fall back to 4.25.
  const evTwoRerolls = round((2 / 6) * 5.5 + (4 / 6) * 4.25, 4); // ≈ 4.6667
  return {
    id: `pev-die-reroll`,
    prompt: `You roll a fair six-sided die. You may keep it, or reroll ONCE and must then take the second roll. Playing optimally, what is the expected value of your final number?`,
    answer: ev,
    decimals: 2,
    difficulty: "hard",
    concept: "Optimal stopping / multi-stage EV",
    explanation: `Compare each first roll against the value of rerolling — which is just a fresh die's mean, 3.5. Keep anything that beats 3.5 (so 4, 5, 6) and reroll the rest; since the option can only help, the answer must land ABOVE 3.5. Half the time you keep a high roll (average (4+5+6)/3 = 5), half the time you take the 3.5 continuation: EV = ½·5 + ½·3.5 = 4.25.`,
    unit: "",
    commonErrors: [
      { value: 3.5, feedback: "3.5 is the EV with NO option to reroll — the reroll strictly improves it.", misconception: "ignored_option" },
      { value: 5, feedback: "That's the EV of the kept high rolls only; you also reroll half the time (EV 3.5).", misconception: "kept_leg_only" },
    ],
    baseIntermediates: [ev, 3.5, 3, 5],
    source: "mock probability/EV",
    followups: {
      probe: {
        // GENERALIZE-N: add a second reroll and re-solve the multi-stage EV —
        // a full backward-induction, not the base's keep-threshold sub-fact.
        type: "generalize-n",
        difficulty: "stretch",
        prompt: `Now you may reroll up to TWICE (three rolls total; you must take the last roll you land on). Playing optimally, what is the expected value of your final number?`,
        answerKind: "numeric",
        answer: evTwoRerolls,
        decimals: 4,
        modelReasoning: `Backward induction: with one reroll left the value is 4.25, so on the first roll you keep only 5 or 6 (they beat 4.25) and otherwise fall back to 4.25. EV = (2/6)·5.5 + (4/6)·4.25 = ${evTwoRerolls}.`,
        commonErrors: [
          { value: ev, feedback: "That's the ONE-reroll EV; a second reroll strictly improves it — you now keep only 5,6 on the first roll.", misconception: "ignored_second_reroll" },
          { value: 5, feedback: "That's the EV of the kept high rolls only; you also fall back to the 4.25 continuation two-thirds of the time.", misconception: "kept_leg_only_two" },
        ],
      },
      adversarial: {
        type: "generalize-n",
        difficulty: "hard",
        prompt: `If you were allowed TWO rerolls (three rolls total), would your optimal FIRST-roll keep-threshold go UP, DOWN, or stay the same? Explain.`,
        answerKind: "reasoning",
        conclusionKeywords: [["up", "higher", "increase", "rises", "more selective", "stricter", "raise"]],
        modelAnswer: `It goes UP (you become more selective).`,
        modelReasoning: `With two rerolls the continuation value rises above 3.5 (you can afford to discard a mediocre roll), so you only keep higher first rolls — the keep-threshold increases.`,
      },
    },
  };
}

/** Expected value of the max of two fair dice (order statistics). */
function genExpectedMaxTwoDice(): MockNumericQuestion {
  // E[max] = Σ m·(2m−1)/36 = 161/36 ≈ 4.4722; E[min] = 7 − E[max] = 91/36.
  const eMax = round(161 / 36, 4);
  const eMin = round(91 / 36, 4);
  const eDiff = round(70 / 36, 4); // E[|a−b|] = E[max] − E[min] = 70/36 ≈ 1.9444
  return {
    id: `pev-max2dice`,
    prompt: `Two fair six-sided dice are rolled. What is the expected value of the LARGER of the two (the maximum)?`,
    answer: eMax,
    decimals: 4,
    difficulty: "hard",
    concept: "Order statistics",
    explanation: `First the intuition. Of the 36 equally likely ordered rolls, "max = m" means both dice land ≤ m but they're NOT both ≤ m−1 — that's m² − (m−1)² = 2m−1 outcomes, so P(max = m) = (2m−1)/36 (bigger m ⇒ more ways). And because you keep the LARGER of two draws, the max skews high: it should sit noticeably above a single die's mean of 3.5 (it comes out ≈ 4.47, not 3.5). Putting it together, E[max] = Σ m·(2m−1)/36 = 161/36 ≈ ${eMax}.`,
    unit: "",
    commonErrors: [
      { value: 3.5, feedback: "3.5 is the EV of one die; the max of two is pulled higher.", misconception: "used_single_die" },
    ],
    baseIntermediates: [eMax, eMin, 3.5, 7],
    source: "mock probability/EV",
    followups: {
      probe: {
        // INVERT: from the max to the expected GAP between the dice — a new
        // order-statistics computation (E[max] − E[min]), not the sibling E[min].
        type: "invert",
        difficulty: "hard",
        prompt: `For the same two dice, what is the expected value of the ABSOLUTE DIFFERENCE between them, E[ |a − b| ]?`,
        answerKind: "numeric",
        answer: eDiff,
        decimals: 4,
        modelReasoning: `|a − b| = max − min on every roll, so E[|a−b|] = E[max] − E[min] = 161/36 − 91/36 = 70/36 ≈ ${eDiff}.`,
        commonErrors: [
          { value: eMin, feedback: "That's E[min]; the expected gap is E[max] − E[min], not the minimum itself.", misconception: "gave_min_not_gap" },
          { value: 0, feedback: "The dice aren't equal on average — E[|a−b|] = E[max]−E[min] > 0.", misconception: "assumed_zero_gap" },
        ],
      },
      adversarial: {
        type: "adversarial-trap",
        difficulty: "hard",
        prompt: `Since one die is always the max and the other the min, E[max] + E[min] should equal E[sum of two dice]. Use this to CHECK your answer — state E[max] + E[min].`,
        answerKind: "reasoning",
        conclusionTargets: [7],
        conclusionKeywords: [["7", "seven", "sum", "linearity", "checks", "consistent", "equals"]],
        modelAnswer: `E[max] + E[min] = 7.`,
        modelReasoning: `The two dice always split into a max and a min, so max + min = the sum on every roll. By linearity E[max] + E[min] = E[sum] = 2·3.5 = 7 — a clean consistency check on 161/36 + 91/36.`,
      },
    },
  };
}

/** Bayes with a low base rate (false-positive paradox) — stretch. */
function genBayesDisease(rng: Rng): MockNumericQuestion {
  const prevPct = rng.pick([1, 2]);
  const fprPct = rng.pick([5, 10]);
  const p = prevPct / 100;
  const fpr = fprPct / 100;
  // Sensitivity 100% for a clean, still-counterintuitive posterior.
  const post = round((p * 1) / (p * 1 + (1 - p) * fpr), 4);
  const positivesPer10k = Math.round(10000 * (p * 1 + (1 - p) * fpr));
  // INVERT target: the prevalence making a positive a coin-flip (posterior 0.5):
  // p/(p + (1−p)·fpr) = 1/2  ⇒  p = fpr/(1 + fpr).
  const prevForHalf = round(fpr / (1 + fpr), 4);
  return {
    id: `pev-bayes-${prevPct}-${fprPct}`,
    prompt: `A disease affects ${prevPct}% of people. A test is 100% sensitive (never misses a real case) but has a ${fprPct}% false-positive rate. Given a POSITIVE test, what is the probability the person actually has the disease?`,
    answer: post,
    decimals: 4,
    difficulty: "expert",
    concept: "Bayes' theorem (base rates)",
    explanation: `Think in natural frequencies. Among 10,000 people only ${prevPct}% — about ${prevPct * 100} — truly have it, and all of them test positive. But ${fprPct}% of the ${10000 - prevPct * 100} healthy people ALSO test positive, roughly ${Math.round((1 - p) * fpr * 10000)} false alarms. Those false positives from the huge healthy majority swamp the ${prevPct * 100} real cases, so a positive is probably a false alarm — the answer is small despite the "positive". Formally P(disease|+) = P / (P + (1−P)·FPR) = ${p} / (${p} + ${round((1 - p) * fpr, 4)}) = ${post}.`,
    unit: "",
    commonErrors: [
      { value: round(1 - fpr, 4), feedback: "That's just (1 − false-positive rate); it ignores the tiny base rate, which dominates here.", misconception: "ignored_base_rate" },
    ],
    baseIntermediates: [post, positivesPer10k, round(1 - fpr, 4), round(p, 4), round(fpr, 4)],
    source: "mock probability/EV",
    followups: {
      probe: {
        // INVERT: solve for the PREVALENCE that would make a positive a 50/50 —
        // reversing the Bayes formula, not reading off its denominator.
        type: "invert",
        difficulty: "stretch",
        prompt: `Keeping the test the same (100% sensitive, ${fprPct}% false-positive rate), how COMMON would the disease have to be (what prevalence) for a positive test to mean a 50/50 chance of actually having it?`,
        answerKind: "numeric",
        answer: prevForHalf,
        decimals: 4,
        modelReasoning: `A positive becomes a coin-flip exactly when the true positives balance the false positives. Set the posterior to 1/2: p/(p + (1−p)·${fpr}) = 1/2 ⇒ p = ${fpr}/(1 + ${fpr}) = ${prevForHalf} (about ${round(prevForHalf * 100, 2)}%) — the disease would have to be far more common than it is.`,
        commonErrors: [
          { value: round(fpr, 4), feedback: "That's the false-positive rate, not the prevalence — solve p/(p+(1−p)·fpr)=1/2 for p.", misconception: "gave_fpr_not_prevalence" },
          { value: 0.5, feedback: "0.5 is the target POSTERIOR, not the prevalence that produces it.", misconception: "confused_posterior_and_prior" },
        ],
      },
      adversarial: {
        type: "adversarial-trap",
        difficulty: "expert",
        prompt: `A positive result here still means the person probably does NOT have the disease. Which quantity, if it ROSE, would most increase P(disease | positive): the disease's prevalence or the false-positive rate? Answer and explain.`,
        answerKind: "reasoning",
        conclusionKeywords: [["prevalence", "base rate", "base-rate", "prior", "how common"]],
        modelAnswer: `Raising the PREVALENCE (base rate) helps most.`,
        modelReasoning: `The posterior is dominated by the tiny base rate: a higher prevalence adds true positives to the numerator and lifts P(disease | +) sharply, whereas lowering the false-positive rate only trims the healthy-positive contribution. The base rate is the lever.`,
      },
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  HARD ANCHOR archetypes (calibrated to the Optiver lattice anchor)          */
/* -------------------------------------------------------------------------- */

/**
 * OPTIVER ANCHOR — two lattice walkers heading at each other. The MAIN question
 * is the PARITY TRAP: with an ODD Manhattan gap the walkers are always on
 * opposite parities, so P(same point at the same TIME) = 0. The PROBE flips it
 * to an EVEN gap where a same-time meeting IS possible (a clean binomial), and
 * the ADVERSARIAL drops timing entirely and asks whether the PATHS cross with
 * probability above or below 1/2 (the verified value ≈ 0.7991 for B=(3,4)).
 * Every value is pinned by `archetypes/verifiers.ts`.
 */
function genLatticePaths(rng: Rng): MockNumericQuestion {
  // All chosen start points have an ODD Manhattan gap (parity trap) AND a
  // paths-intersect probability ABOVE 1/2 (≈0.79–0.80), so the adversarial's
  // "greater than half" side is unambiguously correct. (1,4) is deliberately
  // EXCLUDED — its intersect probability is 231/512 ≈ 0.45, below half.
  const { bx, by } = rng.pick([
    { bx: 3, by: 4 },
    { bx: 4, by: 3 },
    { bx: 2, by: 3 },
    { bx: 3, by: 2 },
  ]);
  const s = bx + by; // odd by construction
  const ey = by - 1; // even-gap neighbour for the probe
  const es = bx + ey;
  const meetEven = round(choose(es, bx) / 2 ** es, 4);
  const intersect = round(latticePathsIntersectProb(bx, by), 4);
  return {
    id: `pev-lattice-${bx}-${by}`,
    prompt: `On a grid, walker A starts at (0, 0) and each step moves RIGHT or UP with probability 1/2 each. Walker B starts at (${bx}, ${by}) and each step moves LEFT or DOWN with probability 1/2 each. They step simultaneously, forever. What is the probability they occupy the SAME point at the SAME time?`,
    answer: 0,
    decimals: 0,
    difficulty: "expert",
    concept: "Random walks (parity)",
    explanation: `A's coordinate-sum rises by 1 each step (it equals the time t); B's falls from ${s} (it equals ${s} − t). They can only share a point when t = ${s} − t, i.e. t = ${s}/2 — impossible because ${s} is odd. The two walkers are permanently on opposite parities, so the same-time meeting probability is exactly 0 (the parity trap).`,
    unit: "",
    commonErrors: [
      { value: intersect, feedback: "That's the probability their PATHS ever cross (ignoring time). The question asks for the SAME point at the SAME time, which parity forbids here.", misconception: "answered_path_intersection" },
      { value: 0.5, feedback: "It isn't a coin flip: with an odd Manhattan distance the walkers are always on opposite parities, so they can NEVER coincide in time.", misconception: "guessed_half" },
    ],
    baseIntermediates: [intersect, 0.5],
    source: "mock probability/EV",
    followups: {
      probe: {
        // CHANGE-REGIME: flip the parity (even gap) so a same-time meeting becomes
        // possible — a fresh binomial, not a sub-step of the parity-zero base.
        type: "change-regime",
        difficulty: "stretch",
        prompt: `Now move B to (${bx}, ${ey}) so the Manhattan distance ${es} is EVEN. At the only time they could coincide (t = ${es}/2), what is the probability they actually occupy the same point?`,
        answerKind: "numeric",
        answer: meetEven,
        decimals: 4,
        modelReasoning: `At t = ${es}/2 both walkers have taken ${es / 2} steps; they coincide only if A went RIGHT exactly ${bx} times, so the probability is C(${es}, ${bx})/2^${es} = ${meetEven}.`,
        commonErrors: [
          { value: 0, feedback: `With an even distance a same-time meeting is now possible — it is C(${es}, ${bx})/2^${es}, not 0.`, misconception: "reused_parity_zero" },
        ],
      },
      adversarial: {
        type: "adversarial-trap",
        difficulty: "stretch",
        prompt: `Forget timing. Considering the SET of points each walker visits, do the two PATHS intersect with probability GREATER or LESS than 1/2? Commit to a side and justify — you do not need the exact value.`,
        answerKind: "reasoning",
        modelAnswer: `GREATER than 1/2 (about ${intersect}).`,
        modelReasoning: `Two monotone walkers heading toward each other across a small grid almost always share at least one lattice point — the exact intersection probability here is ≈ ${intersect}, comfortably above 1/2. (This is separate from the same-TIME meeting, which parity forces to 0.)`,
        conclusionTargets: [intersect],
        conclusionKeywords: [["greater", "more than half", "above half", "more likely than not", "majority", "most of the time", "likely", "better than even", "exceeds half"]],
        conclusionMode: "any",
        wrongKeywords: [["less than half", "below half", "under half", "unlikely", "rarely", "less than 1/2", "less than even"]],
      },
    },
  };
}

/**
 * BIASED random walk — GAMBLER'S RUIN with an UNFAIR coin, so the free linear
 * answer a/N does NOT apply. The MAIN needs the ratio formula
 * P = (1 − r^a)/(1 − r^N) with r = q/p — a genuine multi-step derivation, not a
 * memorized one-liner. The PROBE contrasts the FAIR-coin baseline a/N; the
 * ADVERSARIAL asks the limiting behavior as the edge grows (up, toward 1).
 * Values pinned by `verifiers.ts`.
 */
function genGamblersRuin(rng: Rng): MockNumericQuestion {
  const N = rng.pick([8, 10, 12]);
  const a = rng.int(2, N - 2);
  const p = 0.6; // win probability each bet (favorable)
  const reach = round(gamblersRuinReachTop(a, N, p), 4); // (1 − r^a)/(1 − r^N)
  const reachFair = round(a / N, 4);
  const reachUnfav = round(gamblersRuinReachTop(a, N, 0.4), 4); // r = q/p = 1.5 (adverse)
  return {
    id: `pev-ruin-${a}-${N}`,
    prompt: `You start with $${a} and bet $1 at a time on a coin that pays you with probability 0.6 each flip (win +$1, lose −$1), stopping only when you reach $0 (broke) or $${N} (target). What is the probability you reach $${N} before going broke?`,
    answer: reach,
    decimals: 4,
    difficulty: "hard",
    concept: "Gambler's ruin (martingale)",
    explanation: `Intuition first: with a 0.6 edge every step drifts you UPWARD, so your chance of reaching the top must beat the fair-coin baseline a/N = ${a}/${N}. Here's the clean way to see the exact value: under a bias the quantity that behaves like a fair game (a martingale) is r^{wealth} with r = q/p = 0.4/0.6 = 2/3 — NOT wealth itself, which is why the answer isn't linear. Balancing that martingale at the two barriers gives P(reach ${N}) = (1 − r^${a})/(1 − r^${N}) = ${reach}, comfortably above a/N.`,
    unit: "",
    commonErrors: [
      { value: reachFair, feedback: `${reachFair} is the FAIR-coin answer a/N. With a 0.6 edge your chance is higher — you must use (1 − r^a)/(1 − r^N).`, misconception: "used_fair_formula" },
      { value: 0.6, feedback: "0.6 is the per-flip win probability, not the whole-game survival probability.", misconception: "used_single_flip" },
    ],
    baseIntermediates: [reach, reachFair, 0.6, 0.5],
    source: "mock probability/EV",
    followups: {
      probe: {
        // CHANGE-REGIME: flip the edge AGAINST you (win prob 0.4, r = 1.5). Same
        // ratio formula but now r > 1 — a strictly harder instance, not the easy
        // fair-coin baseline the base already contrasts against.
        type: "change-regime",
        difficulty: "hard",
        prompt: `Now the coin is against you: it pays with probability only 0.4 each flip (lose −$1 with probability 0.6). From the same $${a}, what is the probability you reach $${N} before going broke?`,
        answerKind: "numeric",
        answer: reachUnfav,
        decimals: 4,
        modelReasoning: `Now r = q/p = 0.6/0.4 = 1.5 (> 1). P(reach ${N}) = (1 − r^${a})/(1 − r^${N}) = ${reachUnfav} — much lower than the favorable case because the walk now drifts toward ruin.`,
        commonErrors: [
          { value: reachFair, feedback: "That's the FAIR-coin a/N; with an adverse 0.4 edge your chance is far lower — use (1 − r^a)/(1 − r^N) with r = 1.5.", misconception: "used_fair_formula_unfav" },
          { value: reach, feedback: "That's the FAVORABLE (0.6) answer; flipping the edge to 0.4 inverts r to 1.5 and lowers the probability.", misconception: "reused_favorable" },
        ],
      },
      adversarial: {
        type: "generalize-n",
        difficulty: "hard",
        prompt: `As your per-flip edge grows even further (win probability rising toward 1), does your probability of reaching $${N} go UP or DOWN, and what value does it approach?`,
        answerKind: "reasoning",
        modelAnswer: `It goes UP, approaching 1.`,
        modelReasoning: `A bigger edge makes ruin ever less likely, so P(reach $${N}) rises monotonically; as the win probability → 1 you essentially never lose a step and reach the target with probability → 1.`,
        conclusionTargets: [1],
        conclusionKeywords: [["up", "higher", "increase", "increases", "rises", "more likely", "toward 1", "approaches 1", "closer to 1", "near 1"]],
        conclusionMode: "any",
        wrongKeywords: [["down", "lower", "decrease", "less likely", "toward 0", "approaches 0", "unchanged", "stays the same", "same"]],
      },
    },
  };
}

/**
 * ORDER STATISTICS — expected MAX of three fair dice (harder than the two-die
 * version). MAIN E[max 3d6] = 119/24; PROBE E[min 3d6] = 49/24; ADVERSARIAL asks
 * the limiting behavior of E[max] as the number of dice grows (up, toward 6).
 */
function genThreeDiceMax(): MockNumericQuestion {
  const eMax = round(expectedMaxDice(3, 6), 4); // 4.9583
  const eMin = round(expectedMinDice(3, 6), 4); // 2.0417
  const eMax4 = round(expectedMaxDice(4, 6), 4); // max of FOUR dice (probe)
  return {
    id: `pev-ord3-max`,
    prompt: `Three fair six-sided dice are rolled. What is the expected value of the LARGEST of the three?`,
    answer: eMax,
    decimals: 4,
    difficulty: "hard",
    concept: "Order statistics",
    explanation: `Intuition: keeping the biggest of THREE draws skews the result high — expect it well above a single die's mean of 3.5 (it lands ≈ 4.96). To pin it, notice "max ≤ m" happens exactly when all three dice are ≤ m, probability (m/6)³, so P(max = m) = (m³ − (m−1)³)/216. Summing gives E[max] = Σ m·P(max = m) = 119/24 ≈ ${eMax}.`,
    unit: "",
    commonErrors: [
      { value: 4.4722, feedback: "That's E[max] for TWO dice; a third die pulls the maximum higher still.", misconception: "used_two_dice" },
      { value: 3.5, feedback: "3.5 is one die's mean; the max of three is well above it.", misconception: "used_single_die" },
    ],
    baseIntermediates: [eMax, eMin, 3.5, 7],
    source: "mock probability/EV",
    followups: {
      probe: {
        // GENERALIZE-N: add a fourth die and recompute E[max] from the CDF — a
        // fresh (m/6)^4 order-statistics computation, not the symmetric E[min].
        type: "generalize-n",
        difficulty: "hard",
        prompt: `Now roll FOUR fair six-sided dice. What is the expected value of the LARGEST of the four?`,
        answerKind: "numeric",
        answer: eMax4,
        decimals: 4,
        modelReasoning: `P(max ≤ m) = (m/6)⁴, so P(max = m) = (m⁴ − (m−1)⁴)/6⁴ and E[max] = Σ m·P(max = m) ≈ ${eMax4} — higher than the three-die 119/24 because a fourth die can only raise the maximum.`,
        commonErrors: [
          { value: eMax, feedback: "That's E[max] for THREE dice; a fourth die pulls the maximum higher still.", misconception: "reused_three_dice_max" },
          { value: 6, feedback: "It isn't 6 yet — with only four dice the maximum is high but not almost-certainly the top face.", misconception: "assumed_limit_reached" },
        ],
      },
      adversarial: {
        type: "generalize-n",
        difficulty: "hard",
        prompt: `As you roll MORE and more dice, does E[max] keep rising, and what value does it approach? Commit to a direction and the limit.`,
        answerKind: "reasoning",
        modelAnswer: `It keeps RISING, approaching 6.`,
        modelReasoning: `Adding dice can only raise the maximum, and with many dice at least one showing a 6 becomes almost certain, so E[max] increases monotonically toward the top face, 6.`,
        conclusionTargets: [6],
        conclusionKeywords: [["increase", "increases", "grows", "rises", "higher", "up", "approaches 6", "toward 6", "toward the max", "toward the maximum", "maximum"]],
        conclusionMode: "any",
        wrongKeywords: [["decrease", "decreases", "falls", "toward 3.5", "approaches 3.5", "stays", "unchanged", "toward the mean", "toward the average"]],
      },
    },
  };
}

/**
 * EXPECTED WAIT FOR A COIN PATTERN — the classic "HH takes longer than HT"
 * surprise. MAIN E[flips to the target pattern]; PROBE E[flips to the paired
 * pattern] (a different value); ADVERSARIAL: which kind of pattern waits longer
 * and why (self-overlapping ⇒ longer). Values pinned by `verifiers.ts`.
 */
function genPatternFlips(rng: Rng): MockNumericQuestion {
  const pair = rng.pick([
    { main: "HH", probe: "HT" },
    { main: "HHH", probe: "HTH" },
    { main: "HTH", probe: "HHH" },
    { main: "HT", probe: "HH" },
  ]);
  const mainE = Math.round(expectedFlipsForPattern(pair.main));
  const probeE = Math.round(expectedFlipsForPattern(pair.probe));
  return {
    id: `pev-pattern-${pair.main}`,
    prompt: `You flip a fair coin repeatedly. What is the expected number of flips until the pattern "${pair.main}" first appears (as consecutive flips)?`,
    answer: mainE,
    decimals: 0,
    difficulty: "expert",
    concept: "Expected waiting time (pattern overlap)",
    explanation: `Intuition: you'd think two patterns of the same length are equally quick to appear, but they aren't. When a self-overlapping pattern like "HH" breaks (you flip H then T) the partial progress is wasted and you often restart from scratch, whereas "HT" never wastes progress — so overlapping patterns wait LONGER. Making that precise with the expected-wait recursion over matched-prefix states gives E[flips to "${pair.main}"] = ${mainE}.`,
    unit: "",
    commonErrors: [
      { value: 2 ** pair.main.length, feedback: "The expected wait is NOT just 2^length; overlap structure changes it (e.g. HH waits 6 but HT only 4).", misconception: "used_two_to_the_length" },
    ],
    // Only the genuinely-computed base value goes here (the 2^length figure is a
    // MISCONCEPTION decoy, tracked in commonErrors — NOT a computed sub-step —
    // and must not gate the probe, whose fresh answer can legitimately coincide).
    baseIntermediates: [mainE],
    source: "mock probability/EV",
    followups: {
      probe: {
        // CHANGE-REGIME: a DIFFERENT same-length pattern whose overlap structure
        // changes the wait — a fresh automaton recursion, not a base sub-step.
        type: "change-regime",
        difficulty: "stretch",
        prompt: `Now the pattern "${pair.probe}" instead. What is the expected number of flips until "${pair.probe}" first appears?`,
        answerKind: "numeric",
        answer: probeE,
        decimals: 0,
        modelReasoning: `Solve the prefix-automaton recursion for "${pair.probe}"; it gives E = ${probeE} flips (same length as "${pair.main}", but a different overlap structure changes the wait).`,
        commonErrors: [
          { value: mainE, feedback: `That's the wait for "${pair.main}". Same length, but the overlap structure differs, so the wait differs.`, misconception: "assumed_same_as_other_pattern" },
        ],
      },
      adversarial: {
        type: "adversarial-trap",
        difficulty: "expert",
        prompt: `Two patterns of the SAME length can have different expected waits. Does a pattern that can OVERLAP itself (like HH) take LONGER or SHORTER to appear than one that cannot (like HT)? Commit and explain.`,
        answerKind: "reasoning",
        conclusionKeywords: [["longer", "more flips", "greater", "waits longer", "takes longer", "larger", "higher", "more"]],
        wrongKeywords: [["shorter", "fewer flips", "less", "quicker", "faster", "same", "equal", "identical", "no difference"]],
        modelAnswer: `The self-overlapping pattern takes LONGER.`,
        modelReasoning: `When a self-overlapping pattern (HH) breaks, a partial match is wasted and you often restart from scratch, whereas a non-overlapping one (HT) reuses progress — so the overlapping pattern has a strictly LARGER expected wait (6 vs 4).`,
      },
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  FIRM-SIGNATURE archetypes (grounded in FIRM_INTERVIEW_LIVE_RESEARCH_2026)   */
/* -------------------------------------------------------------------------- */

/**
 * JANE STREET "mutation cascade" — the bank-or-roll optimal-stopping game from
 * Jane Street's own published mock. The follow-ups MUTATE the single problem
 * exactly the way JS interviewers do: the PROBE changes a structural rule (adds
 * a reroll cost — does your framework survive?), and the ADVERSARIAL generalizes
 * to n rerolls (reasoning-graded on the limiting value + why). This tests whether
 * the candidate's FRAMEWORK survives a mutation, never arithmetic on their answer.
 */
function genBankOrRoll(): MockNumericQuestion {
  // One free optional reroll of a fair 6-die; keep 4,5,6 (continuation 3.5). The
  // base EV and its continuation value are VERIFIER-SOURCED (never inline
  // literals) so the answer is correct by construction — `bankOrRollFiniteEV(6, 2)`
  // returns ev = 17/4 = 4.25 and continuation[0] = the 1-roll mean = 3.5.
  const { ev, continuation } = bankOrRollFiniteEV(6, 2);
  const cont = continuation[0]; // continuation value of a single reroll = 3.5
  // Probe: rerolling now COSTS 0.5, dropping the continuation to cont − 0.5 = 3.0,
  // so you now also bank a 3 (keep 3,4,5,6). Derive the new EV from that shifted
  // continuation rather than hardcoding 4.0.
  const costCont = cont - 0.5;
  let costTotal = 0;
  for (let v = 1; v <= 6; v++) costTotal += v >= costCont ? v : costCont;
  const withCostEv = round(costTotal / 6, 2); // (4/6)·4.5 + (2/6)·3.0 = 4.0
  return {
    id: `pev-bankroll`,
    prompt: `Bank-or-roll: you roll a fair six-sided die. You may BANK the shown value, or ROLL once more and must then take that second roll. Playing optimally, what is the expected value of the number you bank?`,
    answer: ev,
    decimals: 2,
    difficulty: "hard",
    concept: "Optimal stopping (bank-or-roll)",
    explanation: `The value of rolling again is just a fresh die's mean, 3.5 — so bank any first roll that beats it (4, 5, 6) and reroll the rest. Since the option can only help, the answer must exceed 3.5. Half the time you bank a high roll (average (4+5+6)/3 = 5), half the time you take the 3.5 continuation: EV = ½·5 + ½·3.5 = 4.25.`,
    unit: "",
    commonErrors: [
      { value: 3.5, feedback: "3.5 is the EV with NO option to reroll — the reroll strictly improves it.", misconception: "ignored_option" },
      { value: 5, feedback: "That's the EV of only the banked high rolls; you also reroll half the time (EV 3.5).", misconception: "kept_leg_only" },
    ],
    baseIntermediates: [ev, cont, 5],
    source: "mock probability/EV",
    followups: {
      probe: {
        // CHANGE-REGIME (Jane Street mutation): a reroll now costs 0.5, dropping
        // the continuation value and shifting the keep-threshold — a re-solve, not
        // arithmetic on the base answer.
        type: "change-regime",
        difficulty: "hard",
        prompt: `Now CHANGE THE RULE: each reroll costs you 0.5 (subtracted from your final banked number). Playing optimally under that cost, what is the new expected value?`,
        answerKind: "numeric",
        answer: withCostEv,
        decimals: 2,
        modelReasoning: `The cost drops the continuation value to 3.5 − 0.5 = 3.0, so you now also bank a 3 (keep 3,4,5,6). EV = (4/6)·4.5 + (2/6)·3.0 = 4.0.`,
        commonErrors: [
          { value: 4.25, feedback: "You ignored the cost. The reroll's continuation value drops to 3.5 − 0.5 = 3.0, so you now bank a 3 as well — recompute.", misconception: "ignored_reroll_cost" },
          { value: 3.75, feedback: "You subtracted 0.5 from the whole EV. The cost only applies on the half of the time you actually reroll, and it also shifts your keep-threshold.", misconception: "subtracted_cost_unconditionally" },
        ],
      },
      adversarial: {
        // MUTATION 2: generalize-to-n rerolls; reason about the limit.
        type: "generalize-n",
        difficulty: "hard",
        prompt: `Now GENERALIZE: back to free rerolls, but suppose you may reroll up to n times (each time you must eventually take a roll). As n → ∞, what value does the optimal expected banked number approach, and WHY?`,
        answerKind: "reasoning",
        conclusionTargets: [6],
        conclusionKeywords: [["approaches 6", "toward 6", "maximum", "highest", "keep rerolling", "six", "6"]],
        modelAnswer: `It approaches 6 (the maximum face).`,
        modelReasoning: `With free rerolls the continuation value rises each time you add one, so the optimal threshold climbs; given unlimited rerolls you simply hold out for a 6, and the expected banked value → 6.`,
      },
    },
  };
}

/**
 * IMC "challenge a correct answer" — the Monty Hall problem. IMC interviewers
 * deliberately push back on a CORRECT answer to see if the candidate flinches.
 * The ADVERSARIAL restates the classic wrong "50/50" claim and grades the
 * candidate on HOLDING FIRM with correct justification (the graded target is the
 * TRUE 2/3 plus a justification keyword) — caving to 1/2 fails the target.
 */
function genMontyHall(): MockNumericQuestion {
  const twoThirds = round(2 / 3, 4);
  const nineTenths = round(9 / 10, 4);
  return {
    id: `pev-monty`,
    prompt: `Three doors hide one prize. You pick a door. The host — who KNOWS where the prize is — opens a DIFFERENT door that reveals no prize, then offers you the switch. What is your probability of winning if you SWITCH?`,
    answer: twoThirds,
    decimals: 4,
    difficulty: "hard",
    concept: "Conditional probability (Monty Hall)",
    explanation: `Your first pick wins 1/3 of the time; the prize is behind one of the other two doors 2/3 of the time, and the host's informed reveal funnels that whole 2/3 onto the remaining door. So switching wins 2/3.`,
    unit: "",
    commonErrors: [
      { value: 0.5, feedback: "Two doors remaining does NOT make it 50/50 — the host's reveal is informed, so the 2/3 from your unpicked doors concentrates on the switch door.", misconception: "ignored_host_information" },
    ],
    baseIntermediates: [twoThirds, round(1 / 3, 4), 0.5],
    source: "mock probability/EV",
    followups: {
      probe: {
        // GENERALIZE-N: scale to 10 doors (host opens 8) — the same conditional
        // funnel taken to n, a genuinely new value (9/10), not a base sub-step.
        type: "generalize-n",
        difficulty: "hard",
        prompt: `Same game but with 10 doors: you pick one, then the host opens 8 OTHER doors that are all empty, leaving one unopened door besides yours. What is your probability of winning if you SWITCH?`,
        answerKind: "numeric",
        answer: nineTenths,
        decimals: 4,
        modelReasoning: `Your first pick is right only 1/10 of the time, so the other 9/10 collapses onto the single unopened door: switching wins 9/10 = ${nineTenths}.`,
        commonErrors: [
          { value: 0.5, feedback: "Again not 50/50: your first pick is right only 1/10 of the time, so the switch door carries the other 9/10.", misconception: "ignored_host_information" },
        ],
      },
      adversarial: {
        // IMC hold-firm: push back on the correct answer; credit only if they
        // hold 2/3 WITH justification. Caving to 1/2 misses the target ⇒ wrong.
        type: "adversarial-trap",
        difficulty: "hard",
        prompt: `Plenty of candidates insist that once two doors are left it is simply 50/50 — are you SURE? State the probability of winning by switching in the original 3-door game and defend WHY it is not 1/2.`,
        answerKind: "reasoning",
        conclusionTargets: [twoThirds],
        conclusionKeywords: [["host knows", "host opens", "informed", "information", "conditional", "not independent", "2/3", "two-thirds"]],
        modelAnswer: `Hold firm: switching wins 2/3, not 1/2.`,
        modelReasoning: `Your first pick is right only 1/3 of the time, and the host's INFORMED reveal (he always opens an empty door) funnels the whole remaining 2/3 onto the switch door. It's conditional information, not two equally-likely doors, so switching wins 2/3.`,
      },
    },
  };
}

/**
 * CITADEL "bet on your own probability" — the four-stones Bayesian-composition
 * question from a 2025 candidate report. After computing a posterior, the
 * ADVERSARIAL makes the candidate ACT on their own number: it offers a concrete
 * bet and asks take/pass + the EV, testing calibration and commitment (do they
 * trust their own estimate enough to price a position on it?).
 */
function genCitadelStones(): MockNumericQuestion {
  // 3 stones; #black uniform on {0,1,2,3}. Draw two without replacement, both
  // black. Posterior: P(k=3)=3/4, P(k=2)=1/4 ⇒ P(third black)=3/4. The predictive
  // posterior is VERIFIER-SOURCED via `hiddenCompositionNextBlack(N=3, m=2)` = 3/4
  // (never an inline literal), closing the drift window.
  const posterior = round(hiddenCompositionNextBlack(3, 2), 4);
  const bothBlack = round(1 / 3, 4); // P(first two both black), marginal
  const betEv = -0.5; // even-money bet the stone is WHITE, at your P(white)=1/4
  // INVERT probe: weaker evidence — only ONE black drawn. Same verifier with
  // m=1 gives P(a remaining stone is black) = 2/3 (weights ∝ k over k=1,2,3).
  const oneBlackPosterior = round(hiddenCompositionNextBlack(3, 1), 4);
  return {
    id: `pev-citadel-stones`,
    prompt: `A bag has 3 stones; each was independently colored black or white by a fair coin, so the number of black stones is equally likely to be 0, 1, 2, or 3. You draw two stones WITHOUT replacement and both are black. What is the probability the remaining (third) stone is also black?`,
    answer: posterior,
    decimals: 4,
    difficulty: "expert",
    concept: "Bayesian updating (unknown composition) + commitment",
    explanation: `Intuition: drawing two black stones is evidence the bag is black-heavy, so the answer should beat a naive 1/2. Only k=2 or k=3 black stones could have produced two black draws, and k=3 is THREE times as likely to yield "both black" as k=2 (probability 1 vs 1/3), so — starting from equal priors — seeing it tips the odds to 3:1 that the bag is all-black. The third stone is black exactly when k=3, so P(third black) = P(k=3 | both black) = (1/4·1)/(1/4·1/3 + 1/4·1) = 3/4.`,
    unit: "",
    commonErrors: [
      { value: 0.5, feedback: "The two black draws are evidence the bag is black-heavy — they shift the posterior toward all-black, so it is not 1/2.", misconception: "ignored_bayesian_update" },
    ],
    baseIntermediates: [posterior, bothBlack, 0.5, betEv],
    source: "mock probability/EV",
    followups: {
      probe: {
        // INVERT: WEAKER evidence — you drew only ONE black. Re-run the whole
        // Bayes update from a different observation, not the base's denominator.
        type: "invert",
        difficulty: "stretch",
        prompt: `Change the evidence: suppose you had drawn just ONE stone and it was black (not two). Now what is the probability that a specific one of the two remaining stones is also black?`,
        answerKind: "numeric",
        answer: oneBlackPosterior,
        decimals: 4,
        modelReasoning: `One black is weaker evidence than two, so expect something below the two-draw 3/4 but still above 1/2. A single black draw makes the count-posterior proportional to k (more black stones ⇒ likelier to have drawn black), so P(k=1,2,3) = 1/6, 2/6, 3/6. A remaining stone is then black with probability Σ P(k)·(k−1)/2 = (2/6)(1/2) + (3/6)(1) = 2/3 ≈ ${oneBlackPosterior}.`,
        commonErrors: [
          { value: posterior, feedback: "That's the posterior after TWO black draws; one black is weaker evidence, so the probability is lower.", misconception: "reused_two_draw_posterior" },
          { value: 0.5, feedback: "It isn't a uniform 1/2 — even one black draw shifts the composition toward black-heavy bags.", misconception: "ignored_single_update" },
        ],
      },
      adversarial: {
        // Citadel: bet on your OWN number. You believe black w.p. 0.75.
        type: "act-on-it",
        difficulty: "expert",
        prompt: `You believe the third stone is black with probability 0.75. I offer you EVEN MONEY that it is WHITE: you win $1 if it is white, lose $1 if it is black. Using YOUR own probability, should you TAKE or PASS this bet — and what is its EV per $1 to you?`,
        answerKind: "reasoning",
        conclusionTargets: [betEv],
        conclusionKeywords: [["pass", "decline", "reject", "don't take", "do not take", "won't take", "no"]],
        modelAnswer: `PASS — the bet's EV is −$0.50 per $1.`,
        modelReasoning: `You think it's white with probability only 0.25, so betting on white pays EV = 0.25·(+1) + 0.75·(−1) = −0.5 per dollar. A negative-EV bet against your own posterior should be declined.`,
      },
    },
  };
}

/**
 * SIG "how confident? how much would you bet?" — a confidence→bet-SIZE item.
 * After a clean probability, the ADVERSARIAL asks the candidate to size a stake
 * to their edge (Kelly on an even-money bet, with the rule STATED so no prior
 * poker knowledge is needed) and to reason that a bigger edge ⇒ a bigger stake.
 * This is scored/coached WITHIN the mock only — it is NEVER written to the
 * dashboard calibration source (that stays gated to Fermi + Trading Floor).
 */
function genSigConfidenceBet(): MockNumericQuestion {
  // Two-stage compound (law of total probability) that resolves to a clean 3/4
  // edge, so the MAIN is not the free "P(≥1 head in two flips)" one-liner but
  // still yields the exact 0.75 the Kelly follow-ups size a bet to.
  const p = 0.75; // 1/2·(5/6) + 1/2·(4/6) = 3/4
  const givenTails = round(4 / 6, 4); // P(win | tails) = 2/3
  // The Kelly stake is VERIFIER-SOURCED: `kellyFraction(p, b=1)` = 2p − 1 for an
  // even-money bet, so a $100 bankroll stakes kellyFraction(0.75,1)·100 = $50
  // (and the 60%-confidence comparison stakes kellyFraction(0.6,1)·100 = $20).
  const bankroll = 100;
  const stake = round(kellyFraction(p, 1) * bankroll, 2); // 0.5·$100 = $50
  const stakeAt60 = round(kellyFraction(0.6, 1) * bankroll, 2); // 0.2·$100 = $20
  // CHANGE-REGIME probe: bias the coin to 2/3 heads and re-weight the branches.
  const biasedWin = round((2 / 3) * (5 / 6) + (1 / 3) * (4 / 6), 4); // = 14/18 ≈ 0.7778
  return {
    id: `pev-sig-confbet`,
    prompt: `A fair coin is flipped and then a fair six-sided die is rolled. If the coin came up HEADS, you win when the die shows 2 or higher; if it came up TAILS, you win when the die shows 3 or higher. What is the probability that you win? (This is the edge you will size a bet to in the follow-ups.)`,
    answer: p,
    decimals: 4,
    difficulty: "hard",
    concept: "Confidence → bet-sizing (edge)",
    explanation: `Intuition: the coin decides which winning rule applies, and each is equally likely, so your overall chance is simply the AVERAGE of the two conditional win chances. Heads you win on a die ≥ 2 (5/6); tails you win on a die ≥ 3 (4/6). Averaging (law of total probability): P(win) = ½·(5/6) + ½·(4/6) = 5/12 + 4/12 = 9/12 = 3/4 = 0.75.`,
    unit: "",
    commonErrors: [
      { value: round(5 / 6, 4), feedback: "That's only the HEADS branch (die ≥ 2). You must weight both coin outcomes equally.", misconception: "single_branch" },
      { value: 0.5, feedback: "Average the two conditional win probabilities (5/6 and 2/3), each with weight 1/2 — that gives 3/4, not 1/2.", misconception: "ignored_conditionals" },
    ],
    baseIntermediates: [p, givenTails, round(5 / 6, 4), 0.5, stake],
    source: "mock probability/EV",
    followups: {
      probe: {
        // CHANGE-REGIME: bias the coin (2/3 heads) and re-weight the two branches
        // — the full law-of-total-probability again, not one isolated branch.
        type: "change-regime",
        difficulty: "hard",
        prompt: `Now suppose the coin is BIASED — it lands heads with probability 2/3 (tails 1/3), same die rule. What is the new probability that you win?`,
        answerKind: "numeric",
        answer: biasedWin,
        decimals: 4,
        modelReasoning: `The coin now leans toward the easier heads rule (win on ≥ 2), so the edge nudges up. Re-weight the two branches by the new coin: P(win) = (2/3)·(5/6) + (1/3)·(4/6) = 10/18 + 4/18 = 14/18 ≈ ${biasedWin}.`,
        commonErrors: [
          { value: p, feedback: "That's the FAIR-coin edge (equal 1/2 weights); the biased coin now weights the heads branch 2/3.", misconception: "reused_fair_weights" },
          { value: givenTails, feedback: "That's just the tails branch; you must weight BOTH branches by the biased coin.", misconception: "single_branch_biased" },
        ],
      },
      adversarial: {
        // SIG confidence→bet-size: size to edge; more edge ⇒ more stake.
        type: "act-on-it",
        difficulty: "hard",
        prompt: `Now bet on it. You are 75% to win an EVEN-MONEY bet (win $1 / lose $1). The Kelly rule sizes your stake at fraction f = (2p − 1) of your bankroll. How many dollars of a $${bankroll} bankroll should you stake — and should that stake be MORE or LESS than if you were only 60% confident?`,
        answerKind: "reasoning",
        conclusionTargets: [stake],
        conclusionKeywords: [["more", "larger", "bigger", "greater", "higher", "increase"]],
        modelAnswer: `Stake $${stake}, and that's MORE than at 60% confidence.`,
        modelReasoning: `Kelly says f = 2p − 1 = 2(0.75) − 1 = 0.5, so stake 0.5·$${bankroll} = $${stake}. A bigger edge means a bigger fraction, so at 60% (f = 0.2 → $${stakeAt60}) you'd bet less — more confidence, more stake.`,
      },
    },
  };
}

/**
 * COUPON COLLECTOR — expected rolls of a fair k-die to see EVERY face (k·H_k).
 * The MAIN is not a memorized 1/p: it needs summing the per-new-face geometric
 * waits k/k + k/(k−1) + ⋯ + k/1. The PROBE isolates the finish-line wait for the
 * single LAST missing face (mean k), and the ADVERSARIAL asks how the total
 * scales with k (super-linear, ~k ln k). Values pinned by `verifiers.ts`.
 */
function genCouponCollector(rng: Rng): MockNumericQuestion {
  const k = rng.pick([5, 6, 8]);
  const ev = round(couponCollectorExpected(k), 4);
  const last = couponCollectorLastFaceExpected(k); // k
  const nextK = rng.pick([8, 10, 12].filter((x) => x !== k));
  const evNext = round(couponCollectorExpected(nextK), 4);
  // INVERT probe: probability of the PERFECT run — all k faces in exactly k rolls
  // (no repeats) = k!/k^k. A fresh counting argument, not a term of the EV sum.
  const perfectRun = round(factorial(k) / k ** k, 4);
  return {
    id: `pev-coupon-${k}`,
    prompt: `You roll a fair ${k}-sided die repeatedly. What is the expected number of rolls until you have seen ALL ${k} distinct faces at least once?`,
    answer: ev,
    decimals: 4,
    difficulty: "hard",
    concept: "Coupon collector (expected cover time)",
    explanation: `Intuition: at the start almost every roll reveals a NEW face, so progress is fast — but near the end, with only one or two faces missing, you wait a long time for each (the very last face alone averages ${k} rolls). The total is the sum of these growing waits. Concretely, collecting the i-th new face is a geometric wait with success probability (${k}−(i−1))/${k}, mean ${k}/(${k}−i+1), so E = ${k}·(1 + 1/2 + ⋯ + 1/${k}) = ${k}·H_${k} = ${ev}.`,
    unit: "",
    commonErrors: [
      { value: k, feedback: `${k} is the expected wait for just the FINAL missing face; the earlier faces also take time — sum all ${k} geometric waits.`, misconception: "used_last_face_only" },
      { value: round(couponCollectorExpected(k) - k, 4), feedback: `You dropped the last (hardest) term k/1 = ${k}; include the wait for the final face.`, misconception: "dropped_last_term" },
    ],
    baseIntermediates: [ev, last, round(couponCollectorExpected(k) - k, 4)],
    source: "mock probability/EV",
    followups: {
      probe: {
        // INVERT: from an EXPECTED time to the PROBABILITY of the fastest possible
        // run (all faces in exactly k rolls) — a counting argument, k!/k^k, not a
        // summand of the base's expected-time sum.
        type: "invert",
        difficulty: "hard",
        prompt: `What is the probability that you collect all ${k} faces in exactly ${k} rolls — the fastest possible, with no face ever repeating?`,
        answerKind: "numeric",
        answer: perfectRun,
        decimals: 4,
        modelReasoning: `Every roll must land on a NEW face: the number of no-repeat sequences is ${k}!, out of ${k}^${k} equally-likely roll strings, so P = ${k}!/${k}^${k} = ${perfectRun}.`,
        commonErrors: [
          { value: round(1 / k, 4), feedback: "That's the chance a single later roll is the missing face; the perfect run requires EVERY roll to be new, k!/k^k.", misconception: "single_step_not_run" },
          { value: last, feedback: `${last} is an expected wait, not a probability — the no-repeat run probability is k!/k^k.`, misconception: "gave_wait_not_prob" },
        ],
      },
      adversarial: {
        type: "generalize-n",
        difficulty: "hard",
        prompt: `A fair ${nextK}-sided die instead of a ${k}-sided one: does the expected number of rolls to collect all faces grow in PROPORTION to the number of faces, or FASTER than proportionally? Commit to a side and explain, and state the value for the ${nextK}-sided die.`,
        answerKind: "reasoning",
        modelAnswer: `Faster than proportionally (≈ k·ln k), and for ${nextK} faces it is ${evNext}.`,
        modelReasoning: `E = k·H_k and H_k ≈ ln k + γ grows without bound, so the total grows like k·ln k — FASTER than linearly in k. For ${nextK} faces the expected rolls are ${nextK}·H_${nextK} = ${evNext}.`,
        conclusionTargets: [evNext],
        conclusionKeywords: [["faster", "grows faster", "harmonic", "k ln k", "k log k", "ln k", "log k"]],
        conclusionMode: "any",
        wrongKeywords: [["proportional", "linear", "linearly", "in proportion", "same rate", "doubles exactly", "just k"]],
      },
    },
  };
}

/**
 * BIRTHDAY PARADOX — collision probability among n people over d equally-likely
 * days. The MAIN uses the complement 1 − Π(d−i)/d (people underestimate it). The
 * PROBE isolates the no-collision product; the ADVERSARIAL springs the
 * pigeonhole limit (n > d ⇒ certainty). Values pinned by `verifiers.ts`.
 */
function genBirthdayCollision(rng: Rng): MockNumericQuestion {
  const { n, d } = rng.pick([
    { n: 4, d: 10 },
    { n: 5, d: 12 },
    { n: 4, d: 8 },
    { n: 5, d: 20 },
  ]);
  const ans = round(birthdayCollisionProb(n, d), 4);
  const noColl = round(birthdayNoCollisionProb(n, d), 4);
  const linear = round((n * (n - 1)) / (2 * d), 4); // pair-count approximation
  // INVERT probe: the smallest headcount at which a shared day is MORE likely than
  // not (collision probability first exceeds 1/2).
  let tippingN = 1;
  while (birthdayCollisionProb(tippingN, d) <= 0.5) tippingN++;
  return {
    id: `pev-birthday-${n}-${d}`,
    prompt: `A room has ${n} people, each equally likely to have been born on any of ${d} days (independently). What is the probability that AT LEAST TWO of them share a birthday (the same day)?`,
    answer: ans,
    decimals: 4,
    difficulty: "hard",
    concept: "Birthday paradox (collision probability)",
    explanation: `Counting "some pair shares a day" directly is messy because the pairs overlap, so flip to the complement — everyone distinct. Seat people one at a time; each newcomer must dodge all previously-used days, giving P(all distinct) = (${d}/${d})·(${d - 1}/${d})·⋯·(${d - n + 1}/${d}) = ${noColl}. Then P(some shared) = 1 − ${noColl} = ${ans}. It's larger than most people guess because the number of PAIRS that could collide grows fast.`,
    unit: "",
    commonErrors: [
      { value: noColl, feedback: "That's the probability all birthdays are DISTINCT — the question asks for at least one shared, its complement.", misconception: "answered_complement" },
      { value: linear, feedback: `${linear} counts the ${n}·(${n}−1)/2 pairs each colliding with probability 1/${d} — a first-order approximation that ignores overlap. Use 1 − Π(d−i)/d.`, misconception: "used_pair_approximation" },
    ],
    baseIntermediates: [ans, noColl, linear],
    source: "mock probability/EV",
    followups: {
      probe: {
        // INVERT: instead of "probability for n people", find the smallest n at
        // which a shared day becomes more likely than not — a search over the
        // same product, genuinely new work (not the all-distinct sub-step).
        type: "invert",
        difficulty: "hard",
        prompt: `With the same ${d} equally-likely days, how many people must be in the room for a shared birthday to be MORE likely than not (probability just over 1/2)?`,
        answerKind: "numeric",
        answer: tippingN,
        decimals: 0,
        modelReasoning: `A shared day tips past even odds once the fast-growing pair-count overwhelms the ${d} days. Grow the group until 1 − (${d}/${d})(${d - 1}/${d})⋯ first exceeds 1/2 — that happens at just ${tippingN} people, surprisingly few because the number of pairs grows like n²/2.`,
        commonErrors: [
          { value: 2, feedback: "Two people are nowhere near a coin-flip for a shared day; the probability rises much faster than you'd guess — solve 1 − Π(d−i)/d > 1/2.", misconception: "guessed_two_people" },
          { value: d, feedback: `You don't need all ${d} days filled — a majority chance of a shared day arrives well before ${d} people.`, misconception: "waited_for_pigeonhole" },
        ],
      },
      adversarial: {
        type: "generalize-n",
        difficulty: "hard",
        prompt: `Now suppose the room holds MORE than ${d} people (more people than possible days). What is the probability that at least two share a day, and what principle forces it? Commit to a value and name the principle.`,
        answerKind: "reasoning",
        modelAnswer: `Exactly 1 (certain), by the pigeonhole principle.`,
        modelReasoning: `With more people than distinct days, at least two must land on the same day — the pigeonhole principle forces a collision, so the probability is exactly 1.`,
        conclusionTargets: [1],
        conclusionKeywords: [["pigeonhole", "more people than days", "must share", "guaranteed", "certain", "forced", "cannot all be distinct", "can't all be distinct"]],
        conclusionMode: "any",
        wrongKeywords: [["less than 1", "still less than one", "not certain", "not guaranteed", "0.5", "impossible", "stays the same"]],
      },
    },
  };
}

/**
 * DERANGEMENTS — P(a random permutation fixes NO element) = !n/n! → 1/e. The
 * MAIN needs inclusion–exclusion (Σ(−1)^k/k!), not a naive 1/n. The PROBE asks
 * the exact derangement COUNT !n; the ADVERSARIAL asks the large-n limit (1/e).
 * Values pinned by `verifiers.ts`.
 */
function genDerangement(rng: Rng): MockNumericQuestion {
  const n = rng.pick([4, 5, 6]);
  const ans = round(derangementProb(n), 4);
  const count = derangementCount(n);
  const naive = round(1 / n, 4); // "1/n" reflex
  const oneMinus = round(1 - 1 / n, 4); // "1 − 1/n" reflex
  // INVERT probe: P(EXACTLY ONE letter correct) = C(n,1)·!(n−1)/n! = !(n−1)/(n−1)!.
  const exactlyOne = round((n * derangementCount(n - 1)) / factorial(n), 4);
  return {
    id: `pev-derange-${n}`,
    prompt: `${n} distinct letters are placed at random into ${n} addressed envelopes (one per envelope, a uniformly random matching). What is the probability that NO letter ends up in its own correct envelope?`,
    answer: ans,
    decimals: 4,
    difficulty: "expert",
    concept: "Derangements (inclusion–exclusion)",
    explanation: `Intuition: you might start from 1 and subtract "some letter is home", but that double-counts the cases where two letters land home, so you add those back, subtract the triples, and so on — exactly inclusion–exclusion. That gives P(no fixed point) = Σ_{k=0}^{${n}} (−1)^k/k! = 1 − 1 + 1/2! − ⋯ = !${n}/${n}! = ${count}/${factorial(n)} = ${ans}, which sits close to 1/e ≈ 0.3679 and barely moves as n grows.`,
    unit: "",
    commonErrors: [
      { value: naive, feedback: `${naive} = 1/${n} assumes only one letter matters; you must exclude EVERY letter landing home, which is inclusion–exclusion.`, misconception: "used_single_letter" },
      { value: oneMinus, feedback: `${oneMinus} = 1 − 1/${n} only removes the first letter being correct; the other correct-placements must be inclusion–excluded too.`, misconception: "removed_one_only" },
    ],
    baseIntermediates: [ans, count, naive, oneMinus, factorial(n)],
    source: "mock probability/EV",
    followups: {
      probe: {
        // INVERT: from "NO letter correct" to "EXACTLY ONE correct" — a new
        // inclusion–exclusion count (choose the fixed letter, derange the rest),
        // not the !n numerator the base already produced.
        type: "invert",
        difficulty: "stretch",
        prompt: `For those same ${n} letters, what is the probability that EXACTLY ONE letter ends up in its own correct envelope (and the other ${n - 1} do not)?`,
        answerKind: "numeric",
        answer: exactlyOne,
        decimals: 4,
        modelReasoning: `Choose which 1 of ${n} is correct (${n} ways) and derange the other ${n - 1}: P = ${n}·!${n - 1}/${n}! = ${n}·${derangementCount(n - 1)}/${factorial(n)} = ${exactlyOne}. (Curiously also ≈ 1/e.)`,
        commonErrors: [
          { value: ans, feedback: "That's the probability of ZERO correct (a full derangement); here exactly one letter is home.", misconception: "gave_zero_fixed" },
          { value: naive, feedback: `${naive} = 1/${n} is the chance ONE specific letter is home — you must also derange the rest and count which letter is fixed.`, misconception: "ignored_rest_derangement" },
        ],
      },
      adversarial: {
        type: "generalize-n",
        difficulty: "expert",
        prompt: `As the number of letters grows very large, what value does the probability of a complete derangement approach, and why does it NOT go to 0 or 1? Commit to the limit.`,
        answerKind: "reasoning",
        modelAnswer: `It approaches 1/e ≈ 0.3679.`,
        modelReasoning: `The series Σ(−1)^k/k! is exactly the Taylor expansion of e^{−1}, so P(derangement) → 1/e ≈ 0.3679 as n → ∞ — it stabilizes, neither vanishing nor going to 1.`,
        conclusionTargets: [round(Math.exp(-1), 4)],
        conclusionKeywords: [["1/e", "1 / e", "e^-1", "e^(-1)", "0.3679", "0.37", "reciprocal of e", "one over e"]],
        conclusionMode: "any",
        wrongKeywords: [["approaches 0", "goes to 0", "approaches 1", "goes to 1", "toward zero", "toward one", "1/2", "0.5"]],
      },
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  SEQUENCES (self-contained so each carries concept-tied follow-ups)         */
/* -------------------------------------------------------------------------- */

interface SeqBuild {
  idBase: string;
  concept: string;
  difficulty: Difficulty;
  ruleText: string;
  /** Exact term function, 0-indexed (term(0) is the first SHOWN term). */
  term: (i: number) => number;
  shown: number;
  errors?: (term: (i: number) => number, shown: number) => NonNullable<NumericQuestion["commonErrors"]>;
}

interface SeqBuildFull extends SeqBuild {
  /** Conclusion-word groups for the "state the rule" adversarial. */
  ruleKeywords: string[][];
}

/**
 * Build a sequence question from an exact term rule. Shows `shown` terms, asks
 * for the next; the PROBE asks for the term AFTER next (a pattern-matcher who
 * eyeballed one gap slips here), and the ADVERSARIAL asks for the rule + a
 * further-out term (generalization), graded on the value AND a rule keyword.
 */
function makeSeq(b: SeqBuildFull): MockNumericQuestion {
  const shownTerms = Array.from({ length: b.shown }, (_, i) => b.term(i));
  const answer = b.term(b.shown);
  const nextNext = b.term(b.shown + 1);
  // PROBE jumps several steps out (not just "one more"), forcing the rule/closed
  // form rather than eyeballing a single gap.
  const jumpPos = b.shown + 3; // 3 positions past the blank
  const jumpValue = b.term(jumpPos);
  const farPos = b.shown + 6; // adversarial reaches even further out
  const farValue = b.term(farPos - 1);
  const harderThanMedium: PoolDifficultyLike =
    b.difficulty === "hard" || b.difficulty === "expert" ? b.difficulty : "hard";
  return {
    id: `${b.idBase}-${shownTerms.join("-")}`,
    prompt: `What number comes next in the sequence?  ${shownTerms.join(", ")}, ___`,
    answer,
    unit: "",
    difficulty: b.difficulty,
    concept: b.concept,
    explanation: `${b.ruleText} So the next term is ${answer}.`,
    commonErrors: b.errors ? b.errors(b.term, b.shown) : undefined,
    baseIntermediates: [answer, nextNext],
    source: "Sequences & Pattern Recognition",
    followups: {
      probe: {
        // GENERALIZE-N: jump SEVERAL steps past the blank, so a candidate who only
        // eyeballed one gap can't coast — they must apply the rule / closed form.
        type: "generalize-n",
        difficulty: harderThanMedium,
        prompt: `Skip ahead: what is the value THREE positions after the blank (i.e. the term after the next two)?`,
        answerKind: "numeric",
        answer: jumpValue,
        decimals: 0,
        modelReasoning: `${b.ruleText} Applying it repeatedly from ${answer} (→ ${nextNext} → …) lands on ${jumpValue} three steps out.`,
        commonErrors: [
          { value: answer, feedback: "That's the blank itself — advance three more steps by the rule.", misconception: "gave_blank" },
          { value: nextNext, feedback: "That's only one step past the blank; go three steps out.", misconception: "off_by_two_steps" },
        ],
      },
      adversarial: {
        type: "generalize-n",
        difficulty: harderThanMedium,
        prompt: `State the RULE generating this sequence in one phrase, and give the value at position ${farPos} (counting the first shown term as position 1).`,
        answerKind: "reasoning",
        conclusionTargets: [farValue],
        conclusionKeywords: b.ruleKeywords,
        // The far-out value is un-guessable and fully proves the rule, so accept
        // EITHER the correct value OR a correctly-named rule (keywords are rule-
        // SPECIFIC, so a wrong rule won't trip them). Only both-wrong is missed.
        conclusionMode: "any",
        modelAnswer: `${b.ruleText} The value at position ${farPos} is ${farValue}.`,
        modelReasoning: `${b.ruleText} Extending that rule out to position ${farPos} (the ${farPos}th term) gives ${farValue}.`,
      },
    },
  };
}

function genSeqArithmetic(rng: Rng): MockNumericQuestion {
  const a0 = rng.int(2, 9);
  const d = rng.int(3, 9);
  return makeSeq({
    idBase: "seqn-arith",
    concept: "Arithmetic sequence (constant common difference)",
    difficulty: "medium",
    ruleText: `Each term adds a constant difference of ${d}.`,
    ruleKeywords: [[
      "arithmetic",
      "common difference",
      "constant difference",
      "difference of " + d,
      "add " + d,
      "adds " + d,
      "adding " + d,
      "plus " + d,
      "+" + d,
      "+ " + d,
    ]],
    term: (i) => a0 + d * i,
    shown: 5,
    errors: (term, shown) => [
      { value: term(shown - 1), feedback: `You repeated the last term; add the common difference once more.`, misconception: "used_previous_term" },
      { value: term(shown + 1), feedback: `You skipped a term — add the difference exactly once from the last shown term.`, misconception: "off_by_one_continuation" },
    ],
  });
}

function genSeqGeometric(rng: Rng): MockNumericQuestion {
  const a0 = rng.int(1, 4);
  const r = rng.pick([2, 3]);
  return makeSeq({
    idBase: "seqn-geo",
    concept: "Geometric sequence (constant ratio)",
    difficulty: "medium",
    ruleText: `Each term multiplies by a constant ratio of ${r}.`,
    ruleKeywords: [[
      "geometric",
      "ratio",
      "multiply by " + r,
      "multiplied by " + r,
      "times " + r,
      "×" + r,
      "× " + r,
      "*" + r,
      ...(r === 2 ? ["double", "doubles", "doubling"] : []),
      ...(r === 3 ? ["triple", "triples", "tripling"] : []),
    ]],
    term: (i) => a0 * r ** i,
    shown: 5,
    errors: (term, shown) => [
      { value: term(shown - 1) + (term(shown - 1) - term(shown - 2)), feedback: `You added the last gap (treated it as arithmetic); multiply by the ratio instead.`, misconception: "treated_as_arithmetic" },
    ],
  });
}

function genSeqQuadratic(rng: Rng): MockNumericQuestion {
  const a = rng.int(1, 3);
  const b = rng.int(0, 4);
  const c = rng.int(1, 6);
  return makeSeq({
    idBase: "seqn-poly",
    concept: "Polynomial sequence (constant second difference)",
    difficulty: "hard",
    ruleText: `The SECOND differences are constant at ${2 * a} (a quadratic pattern).`,
    ruleKeywords: [[
      "second difference",
      "second differences",
      "2nd difference",
      "quadratic",
      "squared",
      "n²",
      "n^2",
      "polynomial",
      "second-order",
      "parabola",
    ]],
    term: (i) => a * i * i + b * i + c,
    shown: 5,
    errors: (term, shown) => {
      const last = term(shown - 1);
      const first = last - term(shown - 2);
      return [
        { value: last + first, feedback: `You assumed the FIRST differences stay constant (linear); the SECOND differences are constant here.`, misconception: "constant_first_difference" },
      ];
    },
  });
}

function genSeqFibonacci(rng: Rng): MockNumericQuestion {
  const s0 = rng.int(1, 5);
  const s1 = rng.int(s0 + 1, s0 + 6);
  const cache: number[] = [s0, s1];
  const term = (i: number): number => {
    while (cache.length <= i) cache.push(cache[cache.length - 1] + cache[cache.length - 2]);
    return cache[i];
  };
  return makeSeq({
    idBase: "seqn-fib",
    concept: "Fibonacci-like sequence (sum of the previous two)",
    difficulty: "medium",
    ruleText: "Each term is the sum of the two preceding terms.",
    ruleKeywords: [[
      "fibonacci",
      "sum of the previous two",
      "sum of the two",
      "sum of the last two",
      "sum of the preceding",
      "previous two",
      "prior two",
      "preceding two",
      "two preceding",
      "last two",
      "two before",
      "add the two",
      "add the previous",
      "add the last two",
      "adding the previous two",
      "recurrence",
      "recursive",
      "n-1 + n-2",
      "n-1+n-2",
    ]],
    term,
    shown: 6,
    errors: (t, shown) => [
      { value: 2 * t(shown - 1), feedback: `You doubled the last term; add the two preceding terms instead.`, misconception: "doubled_last" },
    ],
  });
}

function genSeqAlternatingOp(rng: Rng): MockNumericQuestion {
  const s = rng.int(1, 6);
  const a = rng.int(2, 7);
  const b = rng.pick([2, 3]);
  const cache: number[] = [s];
  const term = (i: number): number => {
    while (cache.length <= i) {
      const last = cache[cache.length - 1];
      const stepIdx = cache.length - 1; // op producing this term
      cache.push(stepIdx % 2 === 0 ? last + a : last * b);
    }
    return cache[i];
  };
  return makeSeq({
    idBase: "seqn-alt",
    concept: "Alternating-operation sequence",
    difficulty: "hard",
    ruleText: `Operations alternate: add ${a}, then multiply by ${b}, repeating.`,
    ruleKeywords: [[
      "alternate",
      "alternating",
      "add then multiply",
      "then multiply by " + b,
      "then multiply",
      "add " + a + " then",
      "multiply by " + b,
      "every other",
      "cycle",
    ]],
    term,
    shown: 5,
    errors: (t, shown) => [
      { value: t(shown - 1), feedback: `You returned the last term; apply the next operation in the cycle.`, misconception: "used_previous_term" },
    ],
  });
}

/**
 * CUBIC sequence — constant THIRD differences. Genuinely hard as a MAIN: the
 * first differences grow, the second differences also grow, and only the third
 * differences are constant, so a candidate must take differences three levels
 * deep before the pattern reveals itself (a quadratic-pattern reflex fails). The
 * PROBE (next term) and ADVERSARIAL (rule + far-out term) come from `makeSeq`.
 */
function genSeqCubic(rng: Rng): MockNumericQuestion {
  const a = rng.pick([1, 2]);
  const b = rng.int(0, 2);
  const c = rng.int(0, 3);
  const d = rng.int(1, 5);
  return makeSeq({
    idBase: "seqn-cubic",
    concept: "Cubic sequence (constant third difference)",
    difficulty: "hard",
    ruleText: `The THIRD differences are constant at ${6 * a} (a cubic pattern); the first and second differences both keep growing.`,
    ruleKeywords: [[
      "third difference",
      "third differences",
      "3rd difference",
      "cubic",
      "cubed",
      "n³",
      "n^3",
      "polynomial",
      "third-order",
      "degree 3",
      "degree three",
    ]],
    term: (i) => a * i * i * i + b * i * i + c * i + d,
    shown: 5,
    errors: (term, shown) => {
      const t = term;
      const n = shown;
      // "Constant SECOND difference" reflex: extrapolate as if quadratic.
      const d1 = t(n - 1) - t(n - 2);
      const d2 = d1 - (t(n - 2) - t(n - 3)); // last second difference
      const quadraticGuess = t(n - 1) + (d1 + d2); // holds 2nd diff constant
      return [
        { value: quadraticGuess, feedback: `You held the SECOND differences constant (a quadratic guess); here only the THIRD differences are constant, so take differences one level deeper.`, misconception: "assumed_quadratic" },
      ];
    },
  });
}

/**
 * OPTIVER DEMO PIN — a FIXED, deterministic quadratic-sequence instance used as
 * the very first Optiver question every run (great for demos). The sequence
 * 5, 11, 23, 41, 65, … has a constant SECOND difference of 6 (first differences
 * 6, 12, 18, 24, 30, …), so the next term is 65 + 30 = 95 and the one after is
 * 95 + 36 = 131. Its closed form is aₙ = 3n² − 3n + 5 (n counted from 1) — which
 * the explanation already reveals, so the ADVERSARIAL deliberately switches to a
 * DIFFERENT quadratic sequence (4, 9, 18, 31, 48 → aₙ = 2n² − n + 3) and asks the
 * candidate to fit aₙ = a·n² + b·n + c from scratch (identify a = 2, b = −1, c = 3,
 * and WHY three points pin the three coefficients). It ignores the rng so
 * `drawArchetype` always returns this exact instance.
 */
function genOptiverQuadraticDemo(): MockNumericQuestion {
  return {
    id: "seqn-poly-demo-5-11-23-41-65",
    prompt: "What number comes next in the sequence?  5, 11, 23, 41, 65, ___",
    answer: 95,
    unit: "",
    difficulty: "hard",
    concept: "Polynomial sequence (constant second difference)",
    explanation:
      "Look at the GAPS first: the first differences are 6, 12, 18, 24 — each larger by a constant 6, so the SECOND difference is constant. A constant second difference is the signature of a QUADRATIC, and the leading coefficient is HALF that second difference (a = 6/2 = 3). The next gap is 30, so the next term is 65 + 30 = 95. In closed form aₙ = 3n² − 3n + 5 (n counted from the first term) — so, for example, the 10th term is 3·10² − 3·10 + 5 = 275. (A common trap is committing to a formula like 3n² − n + 3, which already fails at n=2: it gives 13, not 11 — always re-check a candidate closed form against the early terms before trusting it.)",
    commonErrors: [
      { value: 89, feedback: "You held the FIRST differences constant (added 24 again — a linear guess). Here the SECOND differences are constant, so the next gap is 30, giving 65 + 30 = 95.", misconception: "constant_first_difference" },
    ],
    baseIntermediates: [95, 89],
    source: "Sequences & Pattern Recognition",
    followups: {
      probe: {
        // GENERALIZE-N: extend the SAME quadratic one growing-gap step further —
        // the demo's approachable second beat (kept intact by design).
        type: "generalize-n",
        difficulty: "hard",
        prompt: "Continue the SAME sequence one more step: what is the term AFTER 95?",
        answerKind: "numeric",
        answer: 131,
        decimals: 0,
        modelReasoning:
          "The gaps grow by a constant 6 (…, 24, 30, 36, …), so after the 30 that produced 95 the next gap is 36: 95 + 36 = 131.",
        commonErrors: [
          { value: 95, feedback: "That's the term you just gave — advance one more step by the same rule.", misconception: "repeated_answer" },
          { value: 125, feedback: "You reused the last gap of 30. The SECOND difference is 6, so the next gap is 36, giving 95 + 36 = 131.", misconception: "reused_gap" },
        ],
      },
      adversarial: {
        // GENERALIZE / invert: fit the closed-form coefficients of a NEW quadratic
        // from scratch — strictly harder than continuing the demo.
        type: "generalize-n",
        difficulty: "stretch",
        prompt:
          "Now take a DIFFERENT sequence: 4, 9, 18, 31, 48, … It is also quadratic, aₙ = a·n² + b·n + c (with n = 1 for the first term). What are a, b, and c — and why do just three of the shown terms pin all three down?",
        answerKind: "reasoning",
        conclusionTargets: [2],
        conclusionKeywords: [[
          "three points",
          "3 points",
          "three equations",
          "3 equations",
          "three unknowns",
          "3 unknowns",
          "three coefficients",
          "3 coefficients",
          "three terms",
          "3 terms",
          "system",
          "degrees of freedom",
        ]],
        // Require BOTH the leading coefficient value (a = 2) AND the "three
        // points determine three coefficients" idea, so a near-miss on either
        // half is not credited.
        conclusionMode: "all",
        // MECHANISM gate: a committed-correct answer must also convey WHY three
        // points pin the three coefficients (or the second-difference shortcut);
        // a bare "a = 2, trust me" routes to clarify instead of passing.
        mechanismSignals: [
          "three points", "3 points", "three equations", "3 equations",
          "three unknowns", "3 unknowns", "three coefficients",
          "3 coefficients", "three terms", "3 terms", "three data",
          "system", "degrees of freedom", "second difference", "half the",
        ],
        modelAnswer: "a = 2, b = −1, c = 3 — the closed form is aₙ = 2n² − n + 3.",
        modelReasoning:
          "A quadratic has three unknowns, so plugging in any three shown terms (n=1→4, n=2→9, n=3→18) gives three equations that solve uniquely to a = 2, b = −1, c = 3. Shortcut: a is always HALF the constant second difference — here the first differences are 5, 9, 13, 17 (second difference 4), so a = 4/2 = 2.",
      },
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  ESTIMATION generators (structured Fermi with a computable answer)          */
/* -------------------------------------------------------------------------- */

/**
 * HARD market-making-anchor Fermi. A quant estimation question, NOT a one-line
 * "seats × price": the candidate must DECOMPOSE an options-market-maker's quote
 * throughput and spot the NON-OBVIOUS traps — (i) every strike lists BOTH a call
 * and a put (the ×2 most people drop), and (ii) a 6.5-hour session is 23,400
 * SECONDS, not 6.5 (a units trap). Only after that decomposition does the
 * multi-factor chain close. The PROBE (add-constraint) LAYERS A NEW bandwidth
 * estimate on top — bytes-per-message → total gigabytes, a further multi-factor
 * chain with its own unit conversion (never the contract-count sub-estimate the
 * base already computed); the ADVERSARIAL (generalize-n) tests that the candidate
 * knows the total is LINEAR in the refresh rate (so a 2× rate ⇒ exactly 2× messages).
 */
function genEstOptionsQuotes(rng: Rng): MockNumericQuestion {
  const underlyings = rng.pick([50, 100, 200]);
  const expiries = rng.pick([4, 6, 8]);
  const strikes = rng.pick([10, 20]);
  const refreshPerSec = rng.pick([2, 5]);
  const SESSION_SECONDS = 23400; // 6.5-hour trading session
  const contracts = underlyings * expiries * strikes * 2; // ×2 = call + put
  const ans = contracts * refreshPerSec * SESSION_SECONDS;
  const doubled = ans * 2;
  const droppedCallPut = contracts / 2; // forgot the call+put doubling
  // ADD-CONSTRAINT probe: layer a bandwidth estimate on top — 40 bytes/message,
  // expressed in gigabytes (a further multi-factor step + unit conversion).
  const BYTES_PER_MSG = 40;
  const gb = round((ans * BYTES_PER_MSG) / 1e9, 2); // total gigabytes
  return {
    id: `est-mmquotes-${underlyings}-${expiries}-${strikes}-${refreshPerSec}`,
    prompt:
      `An options market-maker streams a two-sided quote on every listed contract for ` +
      `${underlyings} underlyings. Each underlying lists about ${expiries} expirations, and ` +
      `each expiration about ${strikes} strikes — with BOTH a call and a put at every strike. ` +
      `If the maker refreshes each contract's quote on average ${refreshPerSec} times per second ` +
      `throughout a single 6.5-hour (23,400-second) session, estimate the TOTAL number of quote ` +
      `messages sent in that session.`,
    answer: ans,
    difficulty: "expert",
    concept: "Estimation (multi-constraint decomposition)",
    explanation:
      `Decompose the stream: total messages = (number of contracts) × (refreshes per second) × (seconds in the session). ` +
      `Count contracts first — every strike lists BOTH a call and a put, so Contracts = ${underlyings} × ${expiries} × ${strikes} × 2 = ${contracts.toLocaleString()}. ` +
      `Then Messages = ${contracts.toLocaleString()} × ${refreshPerSec}/s × 23,400 s = ${ans.toLocaleString()}. ` +
      `The two easy-to-miss steps are that ×2 for call/put and converting the 6.5-hour session into 23,400 seconds.`,
    unit: "",
    commonErrors: [
      { value: contracts * refreshPerSec * 6.5, feedback: "You used 6.5 (hours) instead of 23,400 seconds — convert the session to seconds first.", misconception: "forgot_seconds_conversion" },
      { value: droppedCallPut * refreshPerSec * SESSION_SECONDS, feedback: "You dropped the ×2 — each strike lists BOTH a call and a put.", misconception: "dropped_call_put" },
    ],
    baseIntermediates: [contracts, ans, doubled, droppedCallPut, contracts * refreshPerSec * 6.5],
    source: "mock estimation",
    followups: {
      probe: {
        // ADD-CONSTRAINT: extend the throughput estimate into a BANDWIDTH estimate
        // (bytes → gigabytes) — a further multi-factor chain with a unit trap, not
        // the contract-count sub-estimate the base already required.
        type: "add-constraint",
        difficulty: "stretch",
        prompt: `Each quote message is about ${BYTES_PER_MSG} bytes on the wire. Estimate the TOTAL data volume of the session in GIGABYTES (1 GB = 1,000,000,000 bytes).`,
        answerKind: "numeric",
        answer: gb,
        decimals: 2,
        modelReasoning: `Bytes = ${ans.toLocaleString()} messages × ${BYTES_PER_MSG} bytes = ${(ans * BYTES_PER_MSG).toLocaleString()} bytes; ÷ 1e9 ≈ ${gb} GB.`,
        commonErrors: [
          { value: ans, feedback: "That's the message COUNT; multiply by 40 bytes and convert to GB (÷ 1e9).", misconception: "gave_count_not_bytes" },
          { value: round(ans * BYTES_PER_MSG, 0), feedback: "Those are BYTES; divide by 1,000,000,000 to get gigabytes.", misconception: "forgot_gb_conversion" },
        ],
      },
      adversarial: {
        type: "generalize-n",
        difficulty: "expert",
        prompt: `Suppose the maker DOUBLED its refresh rate (to ${refreshPerSec * 2} per second), holding everything else fixed. What would the session message total be, and is the total LINEAR or non-linear in the refresh rate?`,
        answerKind: "reasoning",
        conclusionTargets: [doubled],
        conclusionKeywords: [["linear", "proportional", "proportionally", "double", "doubles", "twice", "two times", "2x", "scales"]],
        modelAnswer: `${doubled.toLocaleString()} messages — the total is LINEAR in the refresh rate.`,
        modelReasoning: `Messages = contracts × rate × seconds, and only the rate changes, so doubling it exactly doubles the total to ${doubled.toLocaleString()}. It scales proportionally (linearly) with the refresh rate.`,
      },
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  Pools by difficulty                                                        */
/* -------------------------------------------------------------------------- */

type Gen = (rng: Rng) => MockNumericQuestion;

/**
 * DIFFICULTY-FLOOR PURGE: the old MEDIUM pool held freshman freebies
 * (`genTwoDiceSum` = 7, `genDieEv` = 3.5, basic `genCoinExactK`, one-line
 * `genEvBet`). They are gone. Every item below is a genuine interview-hard
 * question — even the "easiest" (exactly-two-of-three) is a classic trap
 * (candidates drop the ×3 choose factor or the (1−p) leg). No firm preset draws
 * this tier anymore (all prob/EV slots are hard/stretch); it is kept only as a
 * defensively-hardened floor and for the deterministic grading corpora.
 */
const PROB_EV_MEDIUM: Gen[] = [
  genExactlyTwoOfThree,
  genConditionalUrn,
  genGeometricFlips,
  () => genExpectedMaxTwoDice(),
];

const PROB_EV_HARD: Gen[] = [
  genConditionalUrn,
  genGeometricFlips,
  genConditionalGeometric,
  () => genDieReroll(),
  () => genExpectedMaxTwoDice(),
  () => genThreeDiceMax(),
  genGamblersRuin,
  () => genBankOrRoll(),
  () => genMontyHall(),
  genCouponCollector,
  genBirthdayCollision,
];

const PROB_EV_STRETCH: Gen[] = [
  genCombosConstraint,
  genBayesDisease,
  genLatticePaths,
  genPatternFlips,
  genGamblersRuin,
  () => genCitadelStones(),
  genCouponCollector,
  genBirthdayCollision,
  genDerangement,
];

/**
 * DIFFICULTY-FLOOR PURGE: the trivial "seats × price", cars, searches, and
 * heartbeats one-line Fermis are gone. Estimation is no longer a firm-preset
 * slot (those seconds were reallocated to hard probability/EV + market-making);
 * the single retained generator is a genuinely-hard, multi-constraint quant
 * decomposition, kept for the grading corpora and any non-preset caller.
 */
const ESTIMATION_POOL: Gen[] = [genEstOptionsQuotes];

const SEQUENCE_MEDIUM: Gen[] = [
  genSeqArithmetic,
  genSeqGeometric,
  genSeqFibonacci,
];

const SEQUENCE_HARD: Gen[] = [
  genSeqQuadratic,
  genSeqAlternatingOp,
  genSeqCubic,
];

/**
 * PER-QUESTION MECHANISM signal bank, keyed by question-id PREFIX (longest match
 * wins). These populate `MockNumericQuestion.requiredReasoning` for the reachable
 * reasoning-graded MAIN questions so a `sound` verdict requires the candidate to
 * convey the JUSTIFYING MECHANISM — not merely restate the final answer/arithmetic
 * or assert correctness. Lists are deliberately GENEROUS (many synonyms) so genuine
 * concise reasoning still matches and is never over-rejected. Only reasoning-tier
 * questions are listed; pure-speed/medium-only families are intentionally omitted.
 */
const MAIN_MECHANISM_BY_ID: Record<string, string[]> = {
  // --- probability / EV (HARD + STRETCH) ---------------------------------
  "pev-urn": [
    "conditional", "condition on", "conditioning", "at least one", "both red",
    "divide", "divided by", "ratio", "without replacement", "removes",
    "remove the", "eliminat", "both-blue", "both blue", "no-red", "no red",
    "combination", "c(", "bayes", "p(both", "restrict",
  ],
  "pev-geo": [
    "geometric series", "geometric", "series", "sum the", "1/(2", "2 - p",
    "2-p", "first attempt", "first move", "head start", "goes first",
    "own turns", "odd turns", "each round", "converge", "(1-p)", "(1 - p)",
  ],
  "pev-condgeo": [
    "memoryless", "no memory", "doesn't depend", "does not depend",
    "independent of", "same distribution", "resets", "geometric",
    "conditional", "p(n>1", "past", "history", "irrelevant",
  ],
  "pev-choose": [
    "complement", "complementary", "subtract", "minus", "c(", "combination",
    "choose", "total minus", "contain both", "n-2", "fix", "unordered",
    "forbidden", "both together",
  ],
  "pev-die-reroll": [
    "continuation", "continuation value", "threshold", "reroll", "keep",
    "3.5", "below 3.5", "above 3.5", "stopping", "half the time", "1/2",
    "4 5 6", "4,5,6", "more selective",
  ],
  "pev-max2dice": [
    "order statistic", "p(max", "max = m", "max=m", "2m", "2m-1", "cdf",
    "m/6", "distribution of the max", "161/36", "symmetry", "e[min",
    "pulled higher", "larger of", "each value",
  ],
  "pev-ord3": [
    "order statistic", "p(max", "(m/6)", "m/6", "cube", "cubed", "^3",
    "p(max <= m", "p(max ≤ m", "119/24", "more dice", "toward 6", "monoton",
    "pulled higher", "largest of", "almost certain",
  ],
  "pev-ruin": [
    "ratio", "q/p", "r = q/p", "r=q/p", "(1 - r", "(1-r", "r^", "not linear",
    "not a/n", "biased", "martingale", "edge", "recursion", "geometric",
    "monoton", "toward 1",
  ],
  "pev-bankroll": [
    "continuation", "continuation value", "threshold", "reroll", "keep",
    "3.5", "hold out", "maximum", "bank", "below the continuation",
    "half the time", "1/2", "4 5 6", "4,5,6",
  ],
  "pev-monty": [
    "host knows", "host opens", "informed", "information", "conditional",
    "not independent", "1/3", "2/3", "two-thirds", "funnel", "concentrat",
    "reveal", "on purpose", "collapse", "9/10", "not 50/50", "not 1/2",
  ],
  "pev-bayes": [
    "base rate", "base-rate", "prevalence", "prior", "posterior", "bayes",
    "false positive", "false-positive", "sensitivity", "p(disease",
    "numerator", "how common", "natural frequenc", "denominator", "dominat",
  ],
  "pev-lattice": [
    "parity", "odd", "even", "opposite parit", "coordinate sum",
    "coordinate-sum", "same time", "same parity", "manhattan", "coincide",
    "impossible", "intersect", "paths cross", "monotone", "t =", "sum rises",
  ],
  "pev-pattern": [
    "overlap", "self-overlap", "self overlap", "prefix", "automaton",
    "recursion", "restart", "wasted", "reuse", "expected wait", "waiting time",
    "longer", "no memory", "partial match",
  ],
  "pev-citadel-stones": [
    "bayes", "posterior", "prior", "update", "evidence", "k=2", "k=3",
    "both black", "1/3", "3/4", "0.75", "composition", "conditioning",
    "likelihood", "black-heavy", "shifts", "ev", "-0.5", "negative",
  ],
  "pev-sig-confbet": [
    "law of total probability", "total probability", "weight", "average the",
    "5/6", "4/6", "2/3", "3/4", "0.75", "both branches", "each branch",
    "condition on", "kelly", "2p - 1", "2p-1", "edge",
  ],
  "pev-twoof3": [
    "choose", "3 ways", "three ways", "c(3,2)", "×3", "*3", "3 *", "p^2",
    "p²", "(1-p)", "(1 - p)", "exactly two", "one fails", "third",
    "combination", "binomial",
  ],
  "pev-coupon": [
    "coupon", "geometric", "harmonic", "h_", "1 + 1/2", "sum of", "each new",
    "new face", "k/(", "k/k", "missing face", "1/p", "k ln k", "k log k",
    "add the waits", "cover time",
  ],
  "pev-birthday": [
    "complement", "1 -", "1 −", "all distinct", "no two", "product", "d-1",
    "d - 1", "(d-i)", "pigeonhole", "birthday", "collision", "shared",
    "π(", "distinct days",
  ],
  "pev-derange": [
    "derangement", "inclusion", "exclusion", "inclusion-exclusion",
    "inclusion–exclusion", "(-1)^k", "alternating", "1/e", "!n", "n!",
    "no fixed point", "fixed point", "subfactorial", "e^-1",
  ],
  // --- estimation --------------------------------------------------------
  "est-mmquotes": [
    "contracts", "call and put", "call + put", "call/put", "×2", "x2",
    "times 2", "23,400", "23400", "second", "6.5 hour", "refresh",
    "per second", "multiply", "decompos", "underlying", "expiration",
    "strike", "product",
  ],
  // --- sequences (HARD families + pinned Optiver demo) --------------------
  "seqn-poly-demo": [...MECH.quadratic],
  "seqn-poly": [
    "second difference", "second differences", "2nd difference", "quadratic",
    "squared", "n^2", "parabola", "polynomial", "second-order",
    "differences grow", "gaps grow", "gap grows", "constant second",
  ],
  "seqn-alt": [
    "alternate", "alternating", "add then multiply", "then multiply",
    "every other", "cycle", "two operations", "switch operation",
    "operations alternate",
  ],
  "seqn-cubic": [
    "third difference", "third differences", "3rd difference", "cubic",
    "cubed", "n^3", "polynomial", "third-order", "degree 3", "degree three",
    "differences of the differences", "three levels",
  ],
};

/** Look up the mechanism signals for a question id (longest id-prefix wins). */
function mechanismSignalsForId(id: string): string[] | undefined {
  const keys = Object.keys(MAIN_MECHANISM_BY_ID).sort(
    (a, b) => b.length - a.length,
  );
  for (const k of keys) if (id.startsWith(k)) return MAIN_MECHANISM_BY_ID[k];
  return undefined;
}

/**
 * TOPIC-FAMILY map, keyed by question-id PREFIX (longest match wins). Broad for
 * sequences (one family so three sequence problems never run back-to-back) and
 * FINE-GRAINED for probability/EV so two adjacent prob-EV slots draw genuinely
 * different topics. Consumed by `familyForId` → `MockNumericQuestion.family` →
 * the assembler's diversity constraints and the acceptance gate.
 */
const FAMILY_BY_ID_PREFIX: Record<string, TopicFamily> = {
  "pev-twoof3": "independent-events",
  "pev-urn": "conditional-prob",
  "pev-condgeo": "conditional-prob",
  "pev-geo": "geometric-race",
  "pev-choose": "combinatorics",
  "pev-die-reroll": "optimal-stopping",
  "pev-bankroll": "optimal-stopping",
  "pev-max2dice": "order-statistics",
  "pev-ord3": "order-statistics",
  "pev-bayes": "bayes",
  "pev-citadel": "bayes",
  "pev-lattice": "random-walk",
  "pev-ruin": "gamblers-ruin",
  "pev-monty": "monty",
  "pev-sig-confbet": "bet-sizing",
  "pev-coupon": "coupon-collector",
  "pev-birthday": "birthday",
  "pev-derange": "derangements",
  "pev-pattern": "waiting-time",
  "est-": "estimation",
  "seqn-": "sequences",
};

/** The topic-FAMILY for a question id (longest id-prefix wins), or undefined. */
export function familyForId(id: string): TopicFamily | undefined {
  const keys = Object.keys(FAMILY_BY_ID_PREFIX).sort(
    (a, b) => b.length - a.length,
  );
  for (const k of keys) if (id.startsWith(k)) return FAMILY_BY_ID_PREFIX[k];
  return undefined;
}

/** Attach the topic-family tag (from the id) if the generator didn't set one. */
export function attachFamily(q: MockNumericQuestion): MockNumericQuestion {
  if (q.family) return q;
  const family = familyForId(q.id);
  return family ? { ...q, family } : q;
}

/**
 * Attach the MAIN reasoning-quality mechanism gate to a freshly-drawn question
 * (if the generator did not already author one). Pure: returns the same object
 * with `requiredReasoning` populated when signals exist for its id.
 */
export function attachRequiredReasoning(
  q: MockNumericQuestion,
): MockNumericQuestion {
  if (q.requiredReasoning) return q;
  const signals = mechanismSignalsForId(q.id);
  return signals ? { ...q, requiredReasoning: { mechanismSignals: signals } } : q;
}

/** Difficulty label used in preset specs ("stretch" is the hardest tier). */
export type PoolDifficulty = "easy" | "medium" | "hard" | "stretch";

/**
 * Draw ONE numeric question (with its concept-specific follow-ups) for a given
 * question type + difficulty from the seeded RNG. `mental-math` is handled by
 * the engine's own MM pools (and deliberately gets NO follow-up); this covers
 * probability-ev, sequences, and estimation.
 */
export function drawNumericQuestion(
  rng: Rng,
  qtype: Exclude<MockQuestionType, "mental-math">,
  difficulty: PoolDifficulty,
): MockNumericQuestion {
  if (qtype === "probability-ev") {
    const pool =
      difficulty === "stretch"
        ? PROB_EV_STRETCH
        : difficulty === "hard"
          ? PROB_EV_HARD
          : PROB_EV_MEDIUM;
    return attachFamily(attachRequiredReasoning(rng.pick(pool)(rng)));
  }
  if (qtype === "sequences") {
    const pool = difficulty === "medium" ? SEQUENCE_MEDIUM : SEQUENCE_HARD;
    return attachFamily(attachRequiredReasoning(rng.pick(pool)(rng)));
  }
  // estimation
  return attachFamily(attachRequiredReasoning(rng.pick(ESTIMATION_POOL)(rng)));
}

/**
 * Draw a numeric question whose topic-family is NOT in `avoid` (so the assembler
 * never places two same-family scored items back-to-back and can cap a family).
 * Deterministic rejection sampling over the seeded RNG; if every family in the
 * pool is excluded (small pools), it falls back to an unconstrained draw so a
 * build never fails. `sequences`/`estimation` pools are single-family, so `avoid`
 * only meaningfully constrains the fine-grained probability/EV pools.
 */
export function drawNumericQuestionAvoiding(
  rng: Rng,
  qtype: Exclude<MockQuestionType, "mental-math">,
  difficulty: PoolDifficulty,
  avoid: ReadonlySet<TopicFamily>,
  cap = 64,
): MockNumericQuestion {
  let last = drawNumericQuestion(rng, qtype, difficulty);
  for (let i = 0; i < cap; i++) {
    if (!last.family || !avoid.has(last.family)) return last;
    last = drawNumericQuestion(rng, qtype, difficulty);
  }
  return last;
}

/**
 * FIRM-SIGNATURE archetypes a preset item can PIN by id (so a specific slot
 * always draws that firm's flagship problem + cascade). Each is a full
 * `MockNumericQuestion` with its own concept-specific follow-ups.
 */
export type ArchetypeId =
  | "lattice-paths" // Optiver anchor: lattice meeting + parity trap
  | "bank-or-roll" // Jane Street mutation cascade
  | "sig-confidence-bet" // SIG confidence → bet-size
  | "monty-hold-firm" // IMC challenge-a-correct-answer
  | "citadel-bet" // Citadel bet-on-your-own-probability
  | "optiver-quadratic-demo"; // Optiver demo pin: fixed 5,11,23,41,65 quadratic

const ARCHETYPE_GENS: Record<ArchetypeId, Gen> = {
  "lattice-paths": (rng) => genLatticePaths(rng),
  "bank-or-roll": () => genBankOrRoll(),
  "sig-confidence-bet": () => genSigConfidenceBet(),
  "monty-hold-firm": () => genMontyHall(),
  "citadel-bet": () => genCitadelStones(),
  "optiver-quadratic-demo": () => genOptiverQuadraticDemo(),
};

/** The topic-family each pinned archetype belongs to (for assembler diversity). */
const ARCHETYPE_FAMILY: Record<ArchetypeId, TopicFamily> = {
  "lattice-paths": "random-walk",
  "bank-or-roll": "optimal-stopping",
  "sig-confidence-bet": "bet-sizing",
  "monty-hold-firm": "monty",
  "citadel-bet": "bayes",
  "optiver-quadratic-demo": "sequences",
};

/** The topic-family of a pinned archetype id. */
export function archetypeFamily(id: ArchetypeId): TopicFamily {
  return ARCHETYPE_FAMILY[id];
}

/** Draw ONE pinned firm-signature archetype question (with its follow-ups). */
export function drawArchetype(rng: Rng, id: ArchetypeId): MockNumericQuestion {
  return attachFamily(attachRequiredReasoning(ARCHETYPE_GENS[id](rng)));
}

/** Exposed for tests. */
export const _pools = {
  PROB_EV_MEDIUM,
  PROB_EV_HARD,
  PROB_EV_STRETCH,
  ESTIMATION_POOL,
  SEQUENCE_MEDIUM,
  SEQUENCE_HARD,
  ARCHETYPE_GENS,
};

/** Map a preset difficulty label to the `Difficulty` a NumericQuestion carries. */
export function toContentDifficulty(d: PoolDifficulty): Difficulty {
  return d === "stretch" ? "expert" : d;
}
