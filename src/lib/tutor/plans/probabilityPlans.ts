/**
 * Rung-2 GUIDED PLAN OF ATTACK resolver for Core Probability + Conditional
 * Probability (PHASE_2 §5, rung 2 redesign).
 *
 * Owns the probability slice of the rung-2 ladder: given a `PlanContext`
 * (family / misconception tag / section), returns a SHORT roadmap of LEADING
 * QUESTIONS naming WHAT the learner must figure out at each step — never the
 * operation, rule, or answer, and never any rung-4 visualization content.
 * Bridges rung 1 (names the mistake) to rung 3 (worked walkthrough). Returns
 * `null` for anything outside this domain so the aggregator falls through.
 */

import type { PlanContext, PlanResolver, AttackPlan } from "./types";
import { MISCONCEPTION } from "../misconception";

const PLAN_INDEP_AND: AttackPlan =
  "Let's make a plan. (1) Are these two events independent, or does one shift once the other has happened? (2) Does the wording join them with 'and' or with 'or', and what does that tell you about whether an overlap matters here? (3) Once you know how they combine into a single event, what one quantity are you left computing?";

const PLAN_UNION: AttackPlan =
  "Let's make a plan. (1) Can both of these events happen at the same time, or are they mutually exclusive? (2) If they can both happen, is there an overlap you'd otherwise be counting twice? (3) What single 'A or B' quantity are you ultimately after once that overlap is accounted for?";

const PLAN_AT_LEAST_ONE: AttackPlan =
  "Let's make a plan. (1) Instead of every way it could happen, what is the single opposite case where it never happens at all? (2) How likely is that leftover, none-of-them case across all the trials together? (3) Once you have the chance of 'none', what does that leave for 'at least one'?";

const PLAN_COMPLEMENT: AttackPlan =
  "Let's make a plan. (1) Which event does the question actually want — the one described, or its opposite? (2) Is the number you've found the chance of that event, or the chance of everything else? (3) How do those two pieces relate so you can report the exact one that was asked?";

const PLAN_CONDITIONAL: AttackPlan =
  "Let's make a plan. (1) Which direction is being asked — the chance of A given B, or of B given A? (2) Which group does the 'given' fact restrict you to before you look at anything else? (3) Within only that restricted group, what fraction has the feature you care about?";

const PLAN_COND_EXP: AttackPlan =
  "Let's make a plan. (1) What quantity are you averaging, and what other quantity are you told to hold fixed while you average it? (2) For each fixed value of that conditioning quantity, what does the inner average become — a plain number, or something that still depends on it? (3) How likely is each value of the conditioning quantity, so those inner averages can be combined into the single overall expectation the question is really after?";

const PLAN_BAYES: AttackPlan =
  "Let's make a plan. (1) Which direction is the question asking — the chance of the cause given the evidence, or the evidence given the cause? (2) How common is the condition to begin with, before any test result is seen? (3) Among everyone who shows this evidence, which subgroup are you trying to isolate?";

const PLAN_GAMBLERS: AttackPlan =
  "Let's make a plan. (1) Does each trial actually influence the next one, or does every trial stand on its own? (2) What did the earlier results really change about the upcoming trial — anything, or nothing? (3) So what is the honest chance for the very next trial on its own?";

const PLAN_OUTCOME: AttackPlan =
  "Let's make a plan. (1) Are you judging from one single result, or from what happens over many repeated trials? (2) Over the long run, how often would this outcome really turn up? (3) What steady long-run frequency are you actually being asked to report?";

const PLAN_COUNTING: AttackPlan =
  "Let's make a plan. (1) What is the full set of equally-likely outcomes you're choosing from? (2) Which of those outcomes actually satisfy every condition the question states? (3) How does the count that qualifies relate to the whole set to give the probability?";

/** family → plan (most specific). */
const PLAN_BY_FAMILY: Record<string, AttackPlan> = {
  genIntersectionIndep: PLAN_INDEP_AND,
  genIntersectionIndepNumeric: PLAN_INDEP_AND,
  genBothNumeric: PLAN_INDEP_AND,
  genUnion: PLAN_UNION,
  genUnionNumeric: PLAN_UNION,
  genAtLeastOne: PLAN_AT_LEAST_ONE,
  genAtLeastOneNumeric: PLAN_AT_LEAST_ONE,
  genComplement: PLAN_COMPLEMENT,
  genConditional: PLAN_CONDITIONAL,
  genConditionalNumeric: PLAN_CONDITIONAL,
  genBayes: PLAN_BAYES,
  genBayesNumeric: PLAN_BAYES,
  genTableNumeric: PLAN_COUNTING,
  genGivenSumNumeric: PLAN_COUNTING,
  genAllOnNumeric: PLAN_COUNTING,
};

/** misconception tag → plan (second priority). */
const PLAN_BY_MISCONCEPTION: Record<string, AttackPlan> = {
  [MISCONCEPTION.conjunctionFallacy]: PLAN_INDEP_AND,
  [MISCONCEPTION.andMeansAdd]: PLAN_INDEP_AND,
  [MISCONCEPTION.orMeansAddNoOverlap]: PLAN_UNION,
  [MISCONCEPTION.complementConfusion]: PLAN_COMPLEMENT,
  [MISCONCEPTION.atLeastOneNaive]: PLAN_AT_LEAST_ONE,
  [MISCONCEPTION.gamblersFallacy]: PLAN_GAMBLERS,
  [MISCONCEPTION.outcomeApproach]: PLAN_OUTCOME,
  [MISCONCEPTION.baseRateNeglect]: PLAN_BAYES,
  [MISCONCEPTION.reversedConditional]: PLAN_CONDITIONAL,
  [MISCONCEPTION.likelihoodAsPosterior]: PLAN_BAYES,
};

/**
 * Section-keyword fallback (third priority). Matched case-insensitively against
 * `${section} ${family}`; ordered most-specific first so e.g. "at least one"
 * wins before the broader "core probability" catch-all.
 */
const KEYWORD_PLANS: ReadonlyArray<readonly [string, AttackPlan]> = [
  ["bayes", PLAN_BAYES],
  ["at-least-one", PLAN_AT_LEAST_ONE],
  ["at least one", PLAN_AT_LEAST_ONE],
  ["complement", PLAN_COMPLEMENT],
  // "conditional expectation" (E[X|Y] / tower rule / random sums) must win
  // before the plain "conditional" P(A|B) plan — order matters here.
  ["conditional expectation", PLAN_COND_EXP],
  ["conditional", PLAN_CONDITIONAL],
  ["independent", PLAN_INDEP_AND],
  ["union", PLAN_UNION],
  ["core probability", PLAN_COUNTING],
];

/**
 * Resolve a rung-2 guided plan for the probability domain. Priority:
 * family → misconception tag → section keyword → `null`.
 */
export const resolveProbabilityPlan: PlanResolver = (ctx: PlanContext) => {
  const { section, family, misconceptionTag } = ctx;

  const byFamily = family ? PLAN_BY_FAMILY[family] : undefined;
  if (byFamily) return byFamily;

  const byTag = misconceptionTag
    ? PLAN_BY_MISCONCEPTION[misconceptionTag]
    : undefined;
  if (byTag) return byTag;

  const haystack = `${section ?? ""} ${family ?? ""}`.toLowerCase();
  for (const [keyword, plan] of KEYWORD_PLANS) {
    if (haystack.includes(keyword)) return plan;
  }

  return null;
};
