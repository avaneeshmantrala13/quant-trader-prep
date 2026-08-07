/**
 * Rung-2 "GUIDED PLAN OF ATTACK" for the STOCHASTIC domain: Markov chains,
 * random walks / gambler's ruin, branching, variance / covariance / CLT / LLN /
 * Chebyshev, order statistics, and the continuous / stochastic distribution
 * families (Poisson, continuous, Brownian motion, gamma, MGF, joint, CTMC).
 *
 * Each plan is a short roadmap of LEADING QUESTIONS naming WHAT the learner must
 * determine at each step — never the operation, rule, answer, or a hands-on
 * modelling nudge (rung 4's job). Resolution priority: family → misconception
 * tag → section keyword → null (so the aggregator falls through to its generic).
 */

import type { PlanContext, PlanResolver, AttackPlan } from "./types";
import { MISCONCEPTION } from "../misconception";

const MARKOV_STEP: AttackPlan =
  "Let's make a plan. (1) What are the possible states, and which one are you starting from? " +
  "(2) Does where you land next depend only on where you are now, or on the whole path so far? " +
  "(3) Are you asked about the very next step, or about the long-run behavior after many steps?";

const STATIONARY: AttackPlan =
  "Let's make a plan. (1) Which states can the chain be in, and how does it move between them? " +
  "(2) Are you looking at behavior right now, or at the settled pattern the chain reaches after a long time? " +
  "(3) What single long-run quantity describes where the chain spends its time?";

const WALK: AttackPlan =
  "Let's make a plan. (1) What is the quantity that goes up or down at each step, and where does it start? " +
  "(2) What are the boundaries or stopping conditions you care about? " +
  "(3) Are you asked how likely a particular ending is, or how long it takes to get there?";

const BRANCHING: AttackPlan =
  "Let's make a plan. (1) What does one individual produce in the next generation, and how is that offspring count described? " +
  "(2) How does the size of one generation relate to the size of the next? " +
  "(3) Are you asked whether the line dies out, or how it grows over time?";

const VARIANCE_CLT: AttackPlan =
  "Let's make a plan. (1) Is the question about the spread of ONE quantity, or about how an average or total of many behaves? " +
  "(2) Are you working from a whole population, or estimating from a sample? " +
  "(3) What single summary of variability are you ultimately reporting?";

const SAMPLE_VAR: AttackPlan =
  "Let's make a plan. (1) Are you given the entire population, or just a sample taken from it? " +
  "(2) When you estimate spread from a sample, does the count you rely on match the sample size exactly, or not quite? " +
  "(3) What single measure of variability are you ultimately reporting?";

const CLT: AttackPlan =
  "Let's make a plan. (1) Are you describing one single observation, or the behavior of an average or sum of many of them? " +
  "(2) What has to be true about the pieces for the classic large-sample pattern to apply? " +
  "(3) What shape or summary does that aggregate settle toward as the count grows?";

const LLN: AttackPlan =
  "Let's make a plan. (1) Are you tracking one outcome, or the running average of many repeated trials? " +
  "(2) As the number of trials grows, what value does that running average head toward? " +
  "(3) What single quantity are you claiming it approaches in the long run?";

const CHEBYSHEV: AttackPlan =
  "Let's make a plan. (1) What is the center you are measuring distance from, and what captures the typical spread? " +
  "(2) How far from the center is the range you care about, counted in those spread-units? " +
  "(3) Are you bounding the chance of being far away, or the chance of staying close?";

const CONCENTRATION: AttackPlan =
  "Let's make a plan. (1) What single summary of the quantity are you handed to work from — its typical size, its spread, or both? " +
  "(2) How far past that center is the threshold the question asks about? " +
  "(3) Are you bounding the chance of landing beyond that threshold, and in which direction?";

const ORDER: AttackPlan =
  "Let's make a plan. (1) Are you asked about the smallest value, the largest, or one at a particular ranked position? " +
  "(2) For that extreme or ranked value, what has to hold for all the other observations? " +
  "(3) Are you reporting how it is distributed, or a single typical value for it?";

const MEMORYLESS: AttackPlan =
  "Let's make a plan. (1) Does the process reset its clock after each event, or does its future depend on how long you have already waited? " +
  "(2) Given what you already know has happened, what is left to determine about the remaining wait? " +
  "(3) What single quantity about the future are you ultimately after?";

const MGF: AttackPlan =
  "Let's make a plan. (1) What transform of the quantity are you handed or asked to build? " +
  "(2) What feature of the distribution does reading that transform in the right way reveal? " +
  "(3) Which single summary — a typical value or a measure of spread — are you ultimately extracting?";

const DISTRIBUTION: AttackPlan =
  "Let's make a plan. (1) Which family or model does this quantity follow, and what are its defining inputs? " +
  "(2) Is the question about a probability over a range, a typical value, or a summary of variability? " +
  "(3) What single number does that target quantity come down to?";

/** Family (generator/template) name → plan, when recognized within this domain. */
function byFamily(family: string): AttackPlan | null {
  const f = family.toLowerCase();
  // Markov's INEQUALITY (a mean-based tail bound) — NOT a Markov chain. Must be
  // caught before the generic `markov` branch below, which used to hand it the
  // chain "states / next-step-vs-long-run" plan.
  if (f.includes("markovbound") || (f.includes("markov") && f.includes("bound"))) {
    return CONCENTRATION;
  }
  if (f === "genchebyshev") return CHEBYSHEV;
  // Genuine sample-mean / difference-of-means CLT families (they live in the
  // Variance/Cov/CLT section but ARE about the CLT, unlike its cov/corr siblings).
  if (
    f === "gencltstatement" ||
    f === "gencltcondition" ||
    f === "genclttail" ||
    f === "gencltdiffz" ||
    f === "gencltdiffznumeric"
  ) {
    return CLT;
  }
  if (f === "genllnstatement") return LLN;
  if (f.includes("stationary")) return STATIONARY;
  if (f.includes("branching")) return BRANCHING;
  if (f.includes("walk") || f.includes("ruin")) return WALK;
  // A Markov CHAIN family (exclude the inequality, handled above).
  if (f.includes("markov") && !f.includes("bound")) return MARKOV_STEP;
  return null;
}

/** Misconception tag → plan, when the tag is one this domain owns. */
function byMisconception(tag: string): AttackPlan | null {
  if (tag === MISCONCEPTION.nVsNMinusOne) return SAMPLE_VAR;
  if (tag === MISCONCEPTION.memorylessUniform) return MEMORYLESS;
  return null;
}

/** Case-insensitive keyword match on `${section} ${family}`. */
function bySectionKeyword(haystack: string): AttackPlan | null {
  const h = haystack.toLowerCase();
  const has = (kw: string): boolean => h.includes(kw);

  if (has("order statistic")) return ORDER;
  if (has("stationary")) return STATIONARY;
  if (has("branching")) return BRANCHING;
  if (has("random walk") || has("gambler") || has("ruin")) return WALK;
  if (has("markov")) return MARKOV_STEP;
  // Covariance / variance BEFORE the CLT keyword: the section string
  // "Variance, Covariance & the CLT" literally contains "CLT", so a bare
  // `has("clt")` used to hand EVERY covariance / correlation / variance-
  // combination item the CLT plan. Those want the spread/variance plan; only a
  // genuinely central-limit item (matched by family above, or a section whose
  // primary topic is CLT/LLN) should get the CLT plan.
  if (has("covariance") || has("variance")) return VARIANCE_CLT;
  if (has("central limit") || has("clt")) return CLT;
  if (has("law of large") || has("lln")) return LLN;
  if (has("moment generating") || has("mgf")) return MGF;
  if (
    has("poisson") ||
    has("brownian") ||
    has("gamma") ||
    has("continuous") ||
    has("distribution")
  ) {
    return DISTRIBUTION;
  }
  return null;
}

/**
 * Resolve a rung-2 guided plan for the stochastic domain. Priority: family →
 * misconception tag → section keyword → `null` (unrecognized).
 */
export const resolveStochasticPlan: PlanResolver = (ctx: PlanContext) => {
  if (ctx.family) {
    const byFam = byFamily(ctx.family);
    if (byFam) return byFam;
  }

  if (ctx.misconceptionTag) {
    const byTag = byMisconception(ctx.misconceptionTag);
    if (byTag) return byTag;
  }

  const haystack = `${ctx.section ?? ""} ${ctx.family ?? ""}`.trim();
  if (haystack.length > 0) {
    const bySec = bySectionKeyword(haystack);
    if (bySec) return bySec;
  }

  return null;
};
