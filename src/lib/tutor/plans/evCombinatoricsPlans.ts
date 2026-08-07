/**
 * Rung-2 "GUIDED PLAN OF ATTACK" resolver for the Expected Value, Betting &
 * Sizing (Kelly), and Combinatorial Analysis domains (PHASE_2 §5, rung-2
 * redesign; see ./types.ts for the contract).
 *
 * Each plan is a SHORT roadmap of LEADING QUESTIONS naming WHAT the learner must
 * pin down at each step — never the operation, rule, or the answer, and never a
 * "draw it / simulate it" nudge (that is rung 4). It bridges rung 1 (names the
 * mistake) → rung 3 (a worked walkthrough on different numbers).
 *
 * Geometric probability is another worker's domain: this resolver returns null
 * for anything mentioning "geometr". Resolution priority per the contract:
 * family → misconception tag → section keyword → null.
 */

import type { PlanContext, PlanResolver, AttackPlan } from "./types";
import { MISCONCEPTION } from "../misconception";

/* -------------------------------------------------------------------------- */
/*  The plans (answer-free, question-driven roadmaps)                          */
/* -------------------------------------------------------------------------- */

/** Expected value / fair value: enumerate outcomes → value+chance → long-run number. */
const PLAN_EV: AttackPlan =
  "Let's make a plan. (1) What are ALL the distinct outcomes that can occur here? (2) For each outcome, what is its payoff and how likely is it — and do your chances cover every outcome, leaving nothing out? (3) Once each outcome carries both a value and a chance, what single long-run number are you trying to land on?";

/** Re-roll / optional-continue stopping decision: keep-value vs retry-value vs cut-off. */
const PLAN_REROLL: AttackPlan =
  "Let's make a plan. (1) If you simply STOP right now, what value are you locking in? (2) If instead you surrender that value for a fresh attempt, what is a typical fresh attempt worth on average? (3) Comparing keep-versus-retry, what threshold decides when trying again beats standing pat?";

/** Betting & sizing (Kelly): edge → offered odds → fraction of bankroll to stake. */
const PLAN_KELLY: AttackPlan =
  "Let's make a plan. (1) What is your EDGE here — how do your chance of winning and your chance of losing compare? (2) What do you stand to gain versus lose per unit staked — what are the odds you're actually offered? (3) Given that edge and those odds, what FRACTION of your bankroll does the sizing question really ask you to pin down?";

/** General counting: order-or-not → repeats-or-not → the single total count. */
const PLAN_COUNTING: AttackPlan =
  "Let's make a plan. (1) Are you picking a GROUP where order is irrelevant, or an ARRANGEMENT where the order itself matters? (2) Can an item repeat, or is each one used at most once? (3) After you've pinned those down, what is the single count you're assembling — the total ways for the whole selection?";

/** Arrangements / permutations: positions vs items → new-vs-same orderings → count. */
const PLAN_ARRANGEMENTS: AttackPlan =
  "Let's make a plan. (1) How many positions are you filling, and how many distinct items are available to fill them? (2) Does swapping two items give a genuinely NEW arrangement, and are any items identical so some orderings look the same? (3) With those settled, what single count of orderings is the question really after?";

/** Binomial: one-trial setup → how many successes & does order matter → probability. */
const PLAN_BINOMIAL: AttackPlan =
  "Let's make a plan. (1) What counts as ONE trial here, how many trials run, and what is the chance of a success on a single trial? (2) Exactly how many successes does the question ask about, and does the ORDER of those successes across the trials matter to the count? (3) Bringing the per-outcome chance together with the number of ways it can occur, what single probability are you after?";

/** Hypergeometric: pool composition → without-replacement pick → favorable vs total. */
const PLAN_HYPER: AttackPlan =
  "Let's make a plan. (1) How many items are in the pool, and how many of them are the 'special' kind you care about? (2) How many are you taking out, and does each pick change what's left behind for the next one? (3) With favorable selections set against all possible selections, what single probability is the target?";

/** Poker / hand counting: define the pattern → build choices in order-or-not → count/chance. */
const PLAN_POKER: AttackPlan =
  "Let's make a plan. (1) What exact card pattern defines the hand you're counting — which ranks and suits must line up? (2) Step by step, how many independent choices build one such hand, and does order among those choices matter? (3) Setting favorable hands against every possible hand, what single count or chance is the question really asking for?";

/** Arithmetic-series / growth totals: name the rule → the range → the total. */
const PLAN_SERIES: AttackPlan =
  "Let's make a plan. (1) What rule generates the terms — do they step by a fixed amount, grow by a fixed factor, or follow a divisibility rule? (2) Within the range the question specifies, what are the first and last terms and how many terms are there? (3) What single total or count are you assembling once the rule and the range are pinned down?";

/* -------------------------------------------------------------------------- */
/*  Family → plan (most specific)                                             */
/* -------------------------------------------------------------------------- */

/** Resolve a plan from `family` alone, or null if this domain doesn't own it. */
function planForFamily(family: string): AttackPlan | null {
  const f = family.toLowerCase();

  // Poker / hand-counting families are identified by tokens in the id.
  if (f.includes("poker") || f.includes("quad") || f.includes("flush")) {
    return PLAN_POKER;
  }

  switch (family) {
    // Arithmetic-series / growth families in the "Number Theory & Counting"
    // section. They must win BEFORE the "counting" section keyword below, which
    // otherwise hands "sum of the odd integers" / "sum of a range" / "doubling
    // backward by periods" the ordered-vs-unordered SELECTION plan (D5). The
    // genuine selection families (cold-storage, grid-rectangles, round-robin,
    // arrangements, count-multiples) keep PLAN_COUNTING / PLAN_ARRANGEMENTS.
    case "genSumOddsRangeNumeric":
    case "genSumRangeNumeric":
    case "genDoublingCoverageNumeric":
      return PLAN_SERIES;

    case "genExpectedValue":
    case "genExpectedValueNumeric":
    case "genFairValueNumeric":
      return PLAN_EV;

    case "genReRollDieNumeric":
      return PLAN_REROLL;

    case "genBinomial":
    case "genBinomialNumeric":
      return PLAN_BINOMIAL;

    case "genHyper":
      return PLAN_HYPER;

    case "genArrangements":
    case "genWordArrangementsNumeric":
      return PLAN_ARRANGEMENTS;

    case "genCombinations":
    case "genCombinationsNumeric":
    case "genChooseK":
    case "genGrid":
    case "genGridRectanglesNumeric":
    case "genDiceSums":
    case "genGeneralCounting":
    case "genGeneralComplement":
    case "genColdStorageNumeric":
    case "genRoundRobinNumeric":
      return PLAN_COUNTING;

    default:
      return null;
  }
}

/* -------------------------------------------------------------------------- */
/*  Misconception tag → plan                                                   */
/* -------------------------------------------------------------------------- */

/** Resolve a plan from a tripped misconception tag within this domain. */
function planForMisconception(tag: string): AttackPlan | null {
  switch (tag) {
    case MISCONCEPTION.orderedVsUnordered:
    case MISCONCEPTION.forgotDivideByTwo:
      return PLAN_COUNTING;
    case MISCONCEPTION.facesNotObjects:
      return PLAN_COUNTING;
    case MISCONCEPTION.equalWeightMixture:
      return PLAN_EV;
    default:
      return null;
  }
}

/* -------------------------------------------------------------------------- */
/*  Section / free-text keyword → plan (least specific)                        */
/* -------------------------------------------------------------------------- */

/** Resolve a plan from a case-insensitive keyword on `${section} ${family}`. */
function planForKeyword(haystack: string): AttackPlan | null {
  if (haystack.includes("kelly") || haystack.includes("betting") || haystack.includes("sizing")) {
    return PLAN_KELLY;
  }
  if (haystack.includes("binomial")) return PLAN_BINOMIAL;
  if (haystack.includes("hypergeom")) return PLAN_HYPER;
  if (haystack.includes("poker")) return PLAN_POKER;
  if (haystack.includes("arrangement") || haystack.includes("permut")) {
    return PLAN_ARRANGEMENTS;
  }
  if (
    haystack.includes("combinator") ||
    haystack.includes("counting") ||
    haystack.includes("choose")
  ) {
    return PLAN_COUNTING;
  }
  if (haystack.includes("expected value")) return PLAN_EV;
  return null;
}

/* -------------------------------------------------------------------------- */
/*  The resolver                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Rung-2 plan resolver for Expected Value + Betting/Sizing + Combinatorics.
 * Returns null for out-of-domain contexts (and always for "geometr", which
 * belongs to the geometric-probability worker).
 */
export const resolveEvCombinatoricsPlan: PlanResolver = (
  ctx: PlanContext,
): AttackPlan | null => {
  const { section, family, misconceptionTag } = ctx;

  const haystack = `${section ?? ""} ${family ?? ""}`.toLowerCase();

  // Never claim geometric probability — that is another worker's domain. Guard
  // against the "hypergeometric" false positive, which IS ours.
  if (haystack.includes("geometr") && !haystack.includes("hypergeom")) {
    return null;
  }

  // 1) family-driven (most specific)
  if (family) {
    const byFamily = planForFamily(family);
    if (byFamily) return byFamily;
  }

  // 2) misconception-driven
  if (misconceptionTag) {
    const byTag = planForMisconception(misconceptionTag);
    if (byTag) return byTag;
  }

  // 3) section / keyword-driven (least specific)
  return planForKeyword(haystack);
};
