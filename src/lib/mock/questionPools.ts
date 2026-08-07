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
  QuestionFollowups,
  RequiredReasoning,
} from "./types";
import {
  latticePathsIntersectProb,
  expectedMaxDice,
  expectedMinDice,
  expectedFlipsForPattern,
  gamblersRuinReachTop,
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
  return {
    id: `pev-twoof3-${pPct}`,
    prompt: `Three independent events each occur with probability ${pPct}%. What is the probability that EXACTLY two of the three occur?`,
    answer: ans,
    decimals: 4,
    difficulty: "medium",
    concept: "Independent events",
    explanation: `Choose which 2 of 3 occur (3 ways): 3 · p² · (1−p) = 3 · ${round(p * p, 4)} · ${round(1 - p, 2)} = ${ans}.`,
    unit: "",
    commonErrors: [
      { value: round(p * p, 4), feedback: "You computed p² for one specific pair but forgot (1−p) for the third event and the ×3 choices.", misconception: "forgot_complement_and_count" },
      { value: round(p * p * p, 4), feedback: "That's all three occurring — you need exactly two.", misconception: "all_three" },
    ],
    source: "mock probability/EV",
    followups: {
      probe: {
        prompt: `For the SAME three independent ${pPct}% events, what is the probability that AT LEAST ONE occurs?`,
        answerKind: "numeric",
        answer: atLeastOne,
        decimals: 4,
        modelReasoning: `Use the complement: P(at least one) = 1 − P(none) = 1 − (1−p)³ = 1 − ${round(1 - p, 2)}³ = ${atLeastOne}.`,
        commonErrors: [
          { value: round(3 * p, 4), feedback: "You added the probabilities (3p); overlapping events are double-counted. Use 1 − (1−p)³.", misconception: "added_probabilities" },
        ],
      },
      adversarial: {
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
  return {
    id: `pev-urn-${red}-${blue}`,
    prompt: `An urn has ${red} red and ${blue} blue balls. You draw two without replacement. Given that AT LEAST ONE of the two drawn balls is red, what is the probability that BOTH are red?`,
    answer: ans,
    decimals: 4,
    difficulty: "hard",
    concept: "Conditional probability",
    explanation: `P(both red | ≥1 red) = P(both red) / P(≥1 red). With C(·,2) counts: P(both red) = ${red}·${red - 1} / (${T}·${T - 1}); P(≥1 red) = 1 − ${blue}·${blue - 1}/(${T}·${T - 1}). The ${T}·${T - 1} cancels, giving ${red}·${red - 1} / (${T}·${T - 1} − ${blue}·${blue - 1}) = ${ans}.`,
    unit: "",
    commonErrors: [
      { value: bothRedUncond, feedback: "That's the UNCONDITIONAL P(both red). You must divide by P(at least one red) (< 1), so the conditional is larger.", misconception: "forgot_to_condition" },
      { value: secondGivenFirst, feedback: "That's P(second red | first red) — a different, simpler conditioning. Here you condition on 'at least one of the two is red'.", misconception: "wrong_conditioning_event" },
    ],
    source: "mock probability/EV",
    followups: {
      probe: {
        prompt: `First nail the piece that drives it: drawing two without replacement, what is the probability that BOTH balls are red (no conditioning)?`,
        answerKind: "numeric",
        answer: bothRedUncond,
        decimals: 4,
        modelReasoning: `Without replacement, P(both red) = (${red}/${T})·(${red - 1}/${T - 1}) = ${bothRedUncond} — the second draw has one fewer red out of one fewer ball.`,
        commonErrors: [
          { value: withReplacement, feedback: "That treats the draws as WITH replacement ((red/total)²). Without replacement the second draw has one fewer red of one fewer ball.", misconception: "used_with_replacement" },
        ],
      },
      adversarial: {
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
  return {
    id: `pev-geo-${k}`,
    prompt: `Two players alternate attempts at a task; on each attempt a player succeeds with probability 1/${k}, independently. They take turns until someone succeeds, and whoever succeeds FIRST wins. What is the probability that the player who moves first wins?`,
    answer: first,
    decimals: 4,
    difficulty: "hard",
    concept: "Geometric distribution",
    explanation: `The first mover wins on attempt 1, 3, 5, …: P = p + (1−p)²p + (1−p)⁴p + ⋯ = p / (1 − (1−p)²) = 1/(2 − p). With p = 1/${k}, that is ${k}/(2·${k} − 1) = ${first}.`,
    unit: "",
    commonErrors: [
      { value: 0.5, feedback: "It isn't 50/50 — moving first is a real edge because you get the first attempt every round.", misconception: "assumed_symmetric" },
      { value: round(1 / k, 4), feedback: `1/${k} is the single-attempt success chance, not the whole-game win probability (you must sum the geometric series over your own turns).`, misconception: "used_single_attempt" },
    ],
    source: "mock probability/EV",
    followups: {
      probe: {
        prompt: `In the SAME alternating game, what is the probability that the SECOND player (who moves second) wins?`,
        answerKind: "numeric",
        answer: second,
        decimals: 4,
        modelReasoning: `A draw is impossible, so the second mover wins whenever the first doesn't: 1 − ${first} = ${second}.`,
        commonErrors: [
          { value: first, feedback: "That's the FIRST mover's win probability. Since a draw is impossible, the second mover's is 1 minus it.", misconception: "swapped_players" },
        ],
      },
      adversarial: {
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
  return {
    id: `pev-condgeo-${m}`,
    prompt: `You flip a biased coin that lands HEADS with probability 1/3, repeatedly, until the first heads. Given that you needed MORE than one flip, what is the probability you needed exactly ${m} flips?`,
    answer: ans,
    decimals: 4,
    difficulty: "hard",
    concept: "Conditional probability (memorylessness)",
    explanation: `P(N=${m}) = (2/3)^${m - 1}·(1/3) and P(N>1) = 2/3, so P(N=${m} | N>1) = (2/3)^${m - 1}·(1/3) / (2/3) = (2/3)^${m - 2}·(1/3) = ${ans}.`,
    unit: "",
    commonErrors: [
      { value: uncond, feedback: `That's the UNCONDITIONAL P(exactly ${m} flips); you must divide by P(>1 flip) = 2/3.`, misconception: "forgot_conditioning" },
    ],
    source: "mock probability/EV",
    followups: {
      probe: {
        prompt: `Same biased coin — given you needed more than one flip, what is the probability you needed exactly ${m + 1} flips?`,
        answerKind: "numeric",
        answer: nextM,
        decimals: 4,
        modelReasoning: `Same conditional form one step further out: P(N=${m + 1} | N>1) = (2/3)^${m - 1}·(1/3) = ${nextM}.`,
      },
      adversarial: {
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
  return {
    id: `pev-choose-${n}-${k}`,
    prompt: `A committee of ${k} must be chosen from ${n} distinct candidates, but two of them (A and B) refuse to serve TOGETHER — a committee may contain A, or B, or neither, but never both. How many valid committees are there? (Order doesn't matter.)`,
    answer: ans,
    difficulty: "hard",
    concept: "Combinatorics",
    explanation: `Take all C(${n},${k}) = ${total} committees, then subtract those containing BOTH A and B (fix their 2 seats, choose the rest): C(${n - 2},${k - 2}) = ${bothTogether}. Valid = ${total} − ${bothTogether} = ${ans}.`,
    unit: "",
    commonErrors: [
      { value: total, feedback: "That's ALL committees; you still have to remove the ones with A and B together.", misconception: "ignored_constraint" },
      { value: ordered, feedback: "That counts ORDERED selections (permutations); a committee is unordered — divide by k!.", misconception: "permutation_not_combination" },
    ],
    source: "mock probability/EV",
    followups: {
      probe: {
        prompt: `From the same ${n} candidates, how many committees of ${k} contain BOTH A and B (exactly the ones the rule forbids)?`,
        answerKind: "numeric",
        answer: bothTogether,
        decimals: 0,
        modelReasoning: `Fix A and B into 2 of the ${k} seats, then choose the remaining ${k - 2} from the other ${n - 2}: C(${n - 2},${k - 2}) = ${bothTogether}.`,
        commonErrors: [
          { value: choose(n - 2, k - 1), feedback: `That fixes only ONE required seat. To force BOTH A and B in, fix 2 seats and choose the remaining ${k - 2} from the other ${n - 2}.`, misconception: "fixed_one_not_both" },
        ],
      },
      adversarial: {
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
  return {
    id: `pev-die-reroll`,
    prompt: `You roll a fair six-sided die. You may keep it, or reroll ONCE and must then take the second roll. Playing optimally, what is the expected value of your final number?`,
    answer: ev,
    decimals: 2,
    difficulty: "hard",
    concept: "Optimal stopping / multi-stage EV",
    explanation: `Reroll only when the first roll is below the reroll value 3.5 (so keep 4,5,6). EV = ½·(4+5+6)/3 + ½·3.5 = ½·5 + ½·3.5 = 4.25.`,
    unit: "",
    commonErrors: [
      { value: 3.5, feedback: "3.5 is the EV with NO option to reroll — the reroll strictly improves it.", misconception: "ignored_option" },
      { value: 5, feedback: "That's the EV of the kept high rolls only; you also reroll half the time (EV 3.5).", misconception: "kept_leg_only" },
    ],
    source: "mock probability/EV",
    followups: {
      probe: {
        prompt: `In the optimal strategy, what is the HIGHEST first-roll value on which you still choose to REROLL?`,
        answerKind: "numeric",
        answer: 3,
        decimals: 0,
        modelReasoning: `The continuation value is 3.5, so you reroll anything below it — 1, 2, and 3 — and keep 4, 5, 6. The highest reroll value is 3.`,
        commonErrors: [
          { value: 4, feedback: "You'd keep a 4 (it beats the reroll value of 3.5); you only reroll 1, 2, 3.", misconception: "threshold_off_by_one" },
        ],
      },
      adversarial: {
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
  return {
    id: `pev-max2dice`,
    prompt: `Two fair six-sided dice are rolled. What is the expected value of the LARGER of the two (the maximum)?`,
    answer: eMax,
    decimals: 4,
    difficulty: "hard",
    concept: "Order statistics",
    explanation: `P(max = m) = (2m−1)/36, so E[max] = Σ m·(2m−1)/36 = 161/36 ≈ ${eMax}.`,
    unit: "",
    commonErrors: [
      { value: 3.5, feedback: "3.5 is the EV of one die; the max of two is pulled higher.", misconception: "used_single_die" },
    ],
    source: "mock probability/EV",
    followups: {
      probe: {
        prompt: `For the same two dice, what is the expected value of the SMALLER of the two (the minimum)?`,
        answerKind: "numeric",
        answer: eMin,
        decimals: 4,
        modelReasoning: `By symmetry E[max] + E[min] = E[sum] = 7, so E[min] = 7 − 161/36 = 91/36 ≈ ${eMin}.`,
      },
      adversarial: {
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
  return {
    id: `pev-bayes-${prevPct}-${fprPct}`,
    prompt: `A disease affects ${prevPct}% of people. A test is 100% sensitive (never misses a real case) but has a ${fprPct}% false-positive rate. Given a POSITIVE test, what is the probability the person actually has the disease?`,
    answer: post,
    decimals: 4,
    difficulty: "expert",
    concept: "Bayes' theorem (base rates)",
    explanation: `P(disease|+) = P·1 / (P·1 + (1−P)·FPR) = ${p} / (${p} + ${round((1 - p) * fpr, 4)}) = ${post}.`,
    unit: "",
    commonErrors: [
      { value: round(1 - fpr, 4), feedback: "That's just (1 − false-positive rate); it ignores the tiny base rate, which dominates here.", misconception: "ignored_base_rate" },
    ],
    source: "mock probability/EV",
    followups: {
      probe: {
        prompt: `Think in natural frequencies: out of 10,000 people tested, roughly how many test POSITIVE in total (true + false positives)?`,
        answerKind: "numeric",
        answer: positivesPer10k,
        decimals: 0,
        modelReasoning: `Of 10,000, about ${Math.round(10000 * p)} truly have it (all test positive) and ${Math.round(10000 * (1 - p) * fpr)} healthy people false-positive, totalling ≈ ${positivesPer10k.toLocaleString()} positives.`,
      },
      adversarial: {
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
    source: "mock probability/EV",
    followups: {
      probe: {
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
  return {
    id: `pev-ruin-${a}-${N}`,
    prompt: `You start with $${a} and bet $1 at a time on a coin that pays you with probability 0.6 each flip (win +$1, lose −$1), stopping only when you reach $0 (broke) or $${N} (target). What is the probability you reach $${N} before going broke?`,
    answer: reach,
    decimals: 4,
    difficulty: "hard",
    concept: "Gambler's ruin (martingale)",
    explanation: `With win prob p = 0.6, loss q = 0.4, let r = q/p = 2/3. The biased ruin formula gives P(reach ${N}) = (1 − r^${a})/(1 − r^${N}) = ${reach}. (The martingale is now r^{wealth}, not wealth itself, so the answer is NOT linear a/N.)`,
    unit: "",
    commonErrors: [
      { value: reachFair, feedback: `${reachFair} is the FAIR-coin answer a/N. With a 0.6 edge your chance is higher — you must use (1 − r^a)/(1 − r^N).`, misconception: "used_fair_formula" },
      { value: 0.6, feedback: "0.6 is the per-flip win probability, not the whole-game survival probability.", misconception: "used_single_flip" },
    ],
    source: "mock probability/EV",
    followups: {
      probe: {
        prompt: `Baseline check: if the coin were instead FAIR (win probability 0.5), what would the probability of reaching $${N} from $${a} be?`,
        answerKind: "numeric",
        answer: reachFair,
        decimals: 4,
        modelReasoning: `A fair random walk hits the target with probability equal to your stake over the target: a/N = ${a}/${N} = ${reachFair}.`,
        commonErrors: [
          { value: 0.5, feedback: "It isn't 50/50 unless you start halfway — the fair-walk hitting probability is your stake over the target, a/N.", misconception: "assumed_half" },
        ],
      },
      adversarial: {
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
  return {
    id: `pev-ord3-max`,
    prompt: `Three fair six-sided dice are rolled. What is the expected value of the LARGEST of the three?`,
    answer: eMax,
    decimals: 4,
    difficulty: "hard",
    concept: "Order statistics",
    explanation: `P(max ≤ m) = (m/6)³, so P(max = m) = (m³ − (m−1)³)/216 and E[max] = Σ m·P(max = m) = 119/24 ≈ ${eMax}.`,
    unit: "",
    commonErrors: [
      { value: 4.4722, feedback: "That's E[max] for TWO dice; a third die pulls the maximum higher still.", misconception: "used_two_dice" },
      { value: 3.5, feedback: "3.5 is one die's mean; the max of three is well above it.", misconception: "used_single_die" },
    ],
    source: "mock probability/EV",
    followups: {
      probe: {
        prompt: `For the same three dice, what is the expected value of the SMALLEST of the three?`,
        answerKind: "numeric",
        answer: eMin,
        decimals: 4,
        modelReasoning: `By symmetry E[min] = 7 − E[max] = 7 − 119/24 = 49/24 ≈ ${eMin} (min of three sits well below the single-die mean 3.5).`,
        commonErrors: [
          { value: 3.5, feedback: "The minimum of three dice is pulled BELOW one die's mean of 3.5.", misconception: "used_single_die" },
        ],
      },
      adversarial: {
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
    explanation: `Set up the expected-wait recursion on the automaton of matched prefixes; solving it gives E[flips to "${pair.main}"] = ${mainE}. Self-overlap (a failed match that re-uses a prefix) is what makes some patterns wait longer than others of the same length.`,
    unit: "",
    commonErrors: [
      { value: 2 ** pair.main.length, feedback: "The expected wait is NOT just 2^length; overlap structure changes it (e.g. HH waits 6 but HT only 4).", misconception: "used_two_to_the_length" },
    ],
    source: "mock probability/EV",
    followups: {
      probe: {
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
  // One free optional reroll of a fair 6-die; keep 4,5,6 (continuation 3.5).
  const ev = 4.25; // ½·(4+5+6)/3 + ½·3.5
  // Probe: rerolling now COSTS 0.5. Continuation = 3.5 − 0.5 = 3.0 ⇒ keep 3,4,5,6.
  const withCostEv = 4.0; // (4/6)·4.5 + (2/6)·3.0
  return {
    id: `pev-bankroll`,
    prompt: `Bank-or-roll: you roll a fair six-sided die. You may BANK the shown value, or ROLL once more and must then take that second roll. Playing optimally, what is the expected value of the number you bank?`,
    answer: ev,
    decimals: 2,
    difficulty: "hard",
    concept: "Optimal stopping (bank-or-roll)",
    explanation: `Reroll only when the first roll is below the continuation value 3.5 (so bank 4, 5, 6). EV = ½·(4+5+6)/3 + ½·3.5 = ½·5 + ½·3.5 = 4.25.`,
    unit: "",
    commonErrors: [
      { value: 3.5, feedback: "3.5 is the EV with NO option to reroll — the reroll strictly improves it.", misconception: "ignored_option" },
      { value: 5, feedback: "That's the EV of only the banked high rolls; you also reroll half the time (EV 3.5).", misconception: "kept_leg_only" },
    ],
    source: "mock probability/EV",
    followups: {
      probe: {
        // MUTATION 1: change a structural rule (a reroll now costs 0.5).
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
    source: "mock probability/EV",
    followups: {
      probe: {
        // Deepen: same principle scaled to 10 doors (a pattern-matcher slips).
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
  // black. Posterior: P(k=3)=3/4, P(k=2)=1/4 ⇒ P(third black)=3/4.
  const posterior = 0.75;
  const bothBlack = round(1 / 3, 4); // P(first two both black), marginal
  const betEv = -0.5; // even-money bet the stone is WHITE, at your P(white)=1/4
  return {
    id: `pev-citadel-stones`,
    prompt: `A bag has 3 stones; each was independently colored black or white by a fair coin, so the number of black stones is equally likely to be 0, 1, 2, or 3. You draw two stones WITHOUT replacement and both are black. What is the probability the remaining (third) stone is also black?`,
    answer: posterior,
    decimals: 4,
    difficulty: "expert",
    concept: "Bayesian updating (unknown composition) + commitment",
    explanation: `Only k=2 or k=3 black can yield two black draws. P(2 black)=P(3 black)=1/4 prior; P(draw both black | k=2)=1/3, | k=3)=1. Posterior P(k=3 | both black)=(1/4·1)/(1/4·1/3 + 1/4·1)=3/4. If k=3 the last stone is black (prob 1); if k=2 it is white (prob 0). So P(third black)=3/4.`,
    unit: "",
    commonErrors: [
      { value: 0.5, feedback: "The two black draws are evidence the bag is black-heavy — they shift the posterior toward all-black, so it is not 1/2.", misconception: "ignored_bayesian_update" },
    ],
    source: "mock probability/EV",
    followups: {
      probe: {
        // Deepen: the marginal that drives the Bayes denominator.
        prompt: `In that same setup, BEFORE conditioning, what is the probability that the first two draws are both black? (The denominator of your Bayes update.)`,
        answerKind: "numeric",
        answer: bothBlack,
        decimals: 4,
        modelReasoning: `Average over compositions: only k=2 (prob 1/4, draw-both-black chance 1/3) and k=3 (prob 1/4, chance 1) contribute, giving 1/4·1/3 + 1/4·1 = 1/3 ≈ ${bothBlack}.`,
      },
      adversarial: {
        // Citadel: bet on your OWN number. You believe black w.p. 0.75.
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
  const stake = 50; // Kelly f = 2p − 1 = 0.5 of a $100 bankroll
  return {
    id: `pev-sig-confbet`,
    prompt: `A fair coin is flipped and then a fair six-sided die is rolled. If the coin came up HEADS, you win when the die shows 2 or higher; if it came up TAILS, you win when the die shows 3 or higher. What is the probability that you win? (This is the edge you will size a bet to in the follow-ups.)`,
    answer: p,
    decimals: 4,
    difficulty: "hard",
    concept: "Confidence → bet-sizing (edge)",
    explanation: `Law of total probability: P(win) = 1/2·P(die ≥ 2) + 1/2·P(die ≥ 3) = 1/2·(5/6) + 1/2·(4/6) = 5/12 + 4/12 = 9/12 = 3/4 = 0.75.`,
    unit: "",
    commonErrors: [
      { value: round(5 / 6, 4), feedback: "That's only the HEADS branch (die ≥ 2). You must weight both coin outcomes equally.", misconception: "single_branch" },
      { value: 0.5, feedback: "Average the two conditional win probabilities (5/6 and 2/3), each with weight 1/2 — that gives 3/4, not 1/2.", misconception: "ignored_conditionals" },
    ],
    source: "mock probability/EV",
    followups: {
      probe: {
        // Deepen: isolate one branch of the total-probability decomposition.
        prompt: `Break it into cases: GIVEN the coin came up tails, what is the probability you win?`,
        answerKind: "numeric",
        answer: givenTails,
        decimals: 4,
        modelReasoning: `Given tails you win when the die shows 3 or higher — that's 4 of 6 faces, so P(win | tails) = 4/6 ≈ ${givenTails}.`,
      },
      adversarial: {
        // SIG confidence→bet-size: size to edge; more edge ⇒ more stake.
        prompt: `Now bet on it. You are 75% to win an EVEN-MONEY bet (win $1 / lose $1). The Kelly rule sizes your stake at fraction f = (2p − 1) of your bankroll. How many dollars of a $100 bankroll should you stake — and should that stake be MORE or LESS than if you were only 60% confident?`,
        answerKind: "reasoning",
        conclusionTargets: [stake],
        conclusionKeywords: [["more", "larger", "bigger", "greater", "higher", "increase"]],
        modelAnswer: `Stake $${stake}, and that's MORE than at 60% confidence.`,
        modelReasoning: `Kelly says f = 2p − 1 = 2(0.75) − 1 = 0.5, so stake 0.5·$100 = $${stake}. A bigger edge means a bigger fraction, so at 60% (f = 0.2 → $20) you'd bet less — more confidence, more stake.`,
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
  const farPos = b.shown + 4;
  const farValue = b.term(farPos - 1);
  return {
    id: `${b.idBase}-${shownTerms.join("-")}`,
    prompt: `What number comes next in the sequence?  ${shownTerms.join(", ")}, ___`,
    answer,
    unit: "",
    difficulty: b.difficulty,
    concept: b.concept,
    explanation: `${b.ruleText} So the next term is ${answer}.`,
    commonErrors: b.errors ? b.errors(b.term, b.shown) : undefined,
    source: "Sequences & Pattern Recognition",
    followups: {
      probe: {
        prompt: `Continue the SAME sequence one more step: what is the term AFTER ${answer}?`,
        answerKind: "numeric",
        answer: nextNext,
        decimals: 0,
        modelReasoning: `${b.ruleText} Applying it once more after ${answer} gives ${nextNext}.`,
        commonErrors: [
          { value: answer, feedback: "That's the term you just gave — advance one more step by the same rule.", misconception: "repeated_answer" },
        ],
      },
      adversarial: {
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
      "The first differences are 6, 12, 18, 24 — each larger by a constant 6, so the SECOND difference is constant (a quadratic pattern). The next gap is 30, so the next term is 65 + 30 = 95. In closed form aₙ = 3n² − 3n + 5 (n counted from the first term).",
    commonErrors: [
      { value: 89, feedback: "You held the FIRST differences constant (added 24 again — a linear guess). Here the SECOND differences are constant, so the next gap is 30, giving 65 + 30 = 95.", misconception: "constant_first_difference" },
    ],
    source: "Sequences & Pattern Recognition",
    followups: {
      probe: {
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
 * multi-factor chain close. The PROBE isolates the contract-count sub-estimate
 * (the exact place the ×2 bites); the ADVERSARIAL tests that the candidate knows
 * the total is LINEAR in the refresh rate (so a 2× rate ⇒ exactly 2× messages).
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
      `Contracts = ${underlyings} × ${expiries} × ${strikes} × 2 (call + put) = ${contracts.toLocaleString()}. ` +
      `Messages = ${contracts.toLocaleString()} × ${refreshPerSec}/s × 23,400 s = ${ans.toLocaleString()}. ` +
      `The two easy-to-miss steps are the ×2 for call/put and converting 6.5 hours to 23,400 seconds.`,
    unit: "",
    commonErrors: [
      { value: contracts * refreshPerSec * 6.5, feedback: "You used 6.5 (hours) instead of 23,400 seconds — convert the session to seconds first.", misconception: "forgot_seconds_conversion" },
      { value: droppedCallPut * refreshPerSec * SESSION_SECONDS, feedback: "You dropped the ×2 — each strike lists BOTH a call and a put.", misconception: "dropped_call_put" },
    ],
    source: "mock estimation",
    followups: {
      probe: {
        prompt: `First nail the sub-estimate: how many distinct option CONTRACTS (calls and puts, across all strikes and expirations) is the maker quoting?`,
        answerKind: "numeric",
        answer: contracts,
        decimals: 0,
        modelReasoning: `Contracts = underlyings × expirations × strikes × 2 (a call AND a put per strike) = ${underlyings} × ${expiries} × ${strikes} × 2 = ${contracts.toLocaleString()}.`,
        commonErrors: [
          { value: droppedCallPut, feedback: "That's strikes×expirations×underlyings but forgets that each strike has a call AND a put — double it.", misconception: "dropped_call_put" },
        ],
      },
      adversarial: {
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
];

const PROB_EV_STRETCH: Gen[] = [
  genCombosConstraint,
  genBayesDisease,
  genLatticePaths,
  genPatternFlips,
  genGamblersRuin,
  () => genCitadelStones(),
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
 * Attach the MAIN reasoning-quality mechanism gate to a freshly-drawn question
 * (if the generator did not already author one). Pure: returns the same object
 * with `requiredReasoning` populated when signals exist for its id.
 */
function attachRequiredReasoning(q: MockNumericQuestion): MockNumericQuestion {
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
    return attachRequiredReasoning(rng.pick(pool)(rng));
  }
  if (qtype === "sequences") {
    const pool = difficulty === "medium" ? SEQUENCE_MEDIUM : SEQUENCE_HARD;
    return attachRequiredReasoning(rng.pick(pool)(rng));
  }
  // estimation
  return attachRequiredReasoning(rng.pick(ESTIMATION_POOL)(rng));
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

/** Draw ONE pinned firm-signature archetype question (with its follow-ups). */
export function drawArchetype(rng: Rng, id: ArchetypeId): MockNumericQuestion {
  return attachRequiredReasoning(ARCHETYPE_GENS[id](rng));
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
