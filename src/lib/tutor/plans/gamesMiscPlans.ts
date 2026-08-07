/**
 * Rung-2 GUIDED PLAN OF ATTACK resolver for the "games & misc" catch-all domain:
 * Geometric Probability, Game Theory & Puzzles, Extra Knowledge, the Math /
 * Mental Math tracks, and the interview trading drills (Market Making, No-
 * Arbitrage / De-Vig, ETF / NAV Arbitrage).
 *
 * Each plan is a short roadmap of LEADING QUESTIONS naming WHAT the learner must
 * pin down at each step — it never states the operation, rule, or answer, and it
 * never asks the learner to draw / picture / simulate (that is rung 4). It exists
 * to bridge rung 1 (names the mistake) → rung 3 (worked walkthrough on different
 * numbers). Resolution priority: family → misconceptionTag → section keyword.
 */

import type { PlanResolver, AttackPlan } from "./types";
import { MISCONCEPTION } from "../misconception";

const PLANS = {
  geometric:
    "Let's make a plan. (1) What is the FULL set of equally-likely positions or values that could occur here? (2) Which part of that whole set actually counts as a success for what's being asked? (3) How would you compare the size of the success part against the size of the whole to land on the chance?",

  gameTheory:
    "Let's make a plan. (1) Who are the players here, and what full set of choices does each one have? (2) For each player, what are they actually trying to make as large or as small as possible? (3) Given how the others might respond, which choice profile could hold steady with no one wanting to switch — and what quantity is the question asking you to report?",

  mentalMath:
    "Let's make a plan. (1) Re-read the prompt: exactly which operation and which quantities is it asking you to work with? (2) Roughly, what size should a sensible answer be — tens, hundreds, thousands? (3) In what order would you handle the pieces so no place-value or step slips away?",

  marketMaking:
    "Let's make a plan. (1) What is the fair value here before any edge or margin is applied? (2) Where does your quote sit relative to that fair value, and who sits on the other side of the trade? (3) Which single number — edge, margin, or price — is the question actually asking you to report?",

  deVig:
    "Let's make a plan. (1) What do the quoted prices or odds imply if you treat each one as a raw chance? (2) By how much does that implied total sit above a single, consistent whole — where is the built-in margin hiding? (3) Once that margin is peeled away, what fair number is the question really after?",

  etfNav:
    "Let's make a plan. (1) What is each underlying component worth on its own, and how many of each sit inside one unit of the basket? (2) What is the whole basket worth once you pool those components together? (3) How does that pooled worth line up against the basket's traded price — and which gap is the question asking you to report?",

  puzzle:
    "Let's make a plan. (1) What exactly is the puzzle asking you to find, and what constraints are you handed? (2) Which pieces of information actually pin down the answer, and which are only there to distract you? (3) In what order would you resolve those pieces so the final quantity falls out cleanly?",

  sequence:
    "Let's make a plan. (1) How does each term relate to the one before it — does it step by a fixed amount, grow by a fixed factor, or follow some other repeating rule? (2) Once you name that rule, does it reproduce every term you were given? (3) What single next term (or position) does that rule then hand you?",

  ratesWord:
    "Let's make a plan. (1) What single quantity does the question ultimately want, and in what units? (2) Which given quantities feed into it, and are any of them rates that must be lined up to the same unit of time or distance before they can be combined? (3) In what order would you work the pieces so the final quantity comes out cleanly?",

  geometryDeriv:
    "Let's make a plan. (1) What figure is involved, and which of its measurements are you given versus asked for? (2) Which relationship connects the known measurements to the unknown one? (3) What single quantity are you solving for, and does its size look sensible for the figure?",
} as const;

/** family id → plan (the generator/template name, most specific signal). */
function planFromFamily(family: string): AttackPlan | null {
  const f = family.toLowerCase();
  // Sequence-rule families FIRST: `geometricNext` / `arithmeticNext` are
  // deterministic pattern problems and must NOT match the geometric-PROBABILITY
  // or mental-math keyword branches below (the old `f.includes("geometr")`
  // mis-pinned `geometricNext` to the geometric-probability plan).
  if (/analogynext|arithmeticnext|geometricnext|oddoneout|sequence/.test(f)) {
    return PLANS.sequence;
  }
  // Game-theory generator families (explicit tokens only — never a bare
  // "puzzle" substring, which "Core Puzzles" brainteasers would trip).
  if (/matrix|mixed[\s_-]?strateg|beauty|nash|genpd|genentry|genhotelling|genvolunteer|genvalue2x2|genvalue3x2|genoptim/.test(f)) {
    return PLANS.gameTheory;
  }
  // Mental-math / speed-arithmetic families. The ids are `genSubtractionNumeric`,
  // `genMultiply2x1Numeric`, `genDivisionNumeric`, … so match each operation
  // stem (the old check only caught `addition`/`multiplication`/`percent`).
  if (
    /genmental|addition|subtraction|multiply|multiplication|division|fractiontodecimal|percent|oddstoprob/.test(
      f,
    )
  ) {
    return PLANS.mentalMath;
  }
  if (/market[\s_-]?making/.test(f)) return PLANS.marketMaking;
  if (f.includes("devig") || f.includes("de-vig") || f.includes("vig")) {
    return PLANS.deVig;
  }
  if (f.includes("etf") || f.includes("nav")) return PLANS.etfNav;
  return null;
}

/**
 * misconception tag → plan. Only the region-symmetry error that shows up in
 * geometric-probability items is claimed here; every other tag is left to the
 * probability/statistics resolvers.
 */
function planFromTag(tag: string): AttackPlan | null {
  if (tag === MISCONCEPTION.forgotDivideByTwo) return PLANS.geometric;
  return null;
}

/** case-insensitive keyword on `${section} ${family}` → plan. */
function planFromSection(haystack: string): AttackPlan | null {
  const h = haystack.toLowerCase();
  // Deterministic SEQUENCE section first (before any "arithmetic"/"geometr"
  // keyword, which would otherwise mis-route arithmetic/geometric SEQUENCES to
  // the mental-math / geometric-probability plans).
  if (h.includes("sequences") || h.includes("pattern recognition")) {
    return PLANS.sequence;
  }
  // Brainteaser tracks → the general puzzle plan. Matched via the explicit
  // section names so a bare "puzzle" substring no longer hijacks them to the
  // game-theory (Nash) plan.
  if (h.includes("core puzzles") || h.includes("techniques toolkit")) {
    return PLANS.puzzle;
  }
  // Only the geometric-PROBABILITY section wants the favourable-measure plan.
  // The Math-Questions "Geometry & Derivations" section is plain-geometry word
  // problems (area/angle/volume derivations) — it must NOT match here, so we
  // require the full "geometric probability" phrase rather than the "geometr"
  // stem (which "geometry" would also trip).
  if (h.includes("geometric probability")) return PLANS.geometric;
  // Game theory: explicit phrases ONLY — never a bare "puzzle" substring (which
  // "Core Puzzles" would trip). "Game Theory & Puzzles" still matches here.
  if (
    h.includes("game theory") ||
    h.includes("nash") ||
    h.includes("mixed strateg")
  ) {
    return PLANS.gameTheory;
  }
  // Math-Questions word-problem / rates / geometry-derivation sections (they
  // previously fell through to the topic-neutral GENERIC_PLAN).
  if (
    h.includes("rates") ||
    h.includes("algebra") ||
    h.includes("word problem")
  ) {
    return PLANS.ratesWord;
  }
  if (h.includes("geometry & derivations") || h.includes("geometry and derivations")) {
    return PLANS.geometryDeriv;
  }
  if (
    h.includes("mental") ||
    h.includes("arithmetic") ||
    h.includes("zetamac") ||
    h.includes("sprint") ||
    h.includes("math question")
  ) {
    return PLANS.mentalMath;
  }
  if (h.includes("market making")) return PLANS.marketMaking;
  if (
    h.includes("de-vig") ||
    h.includes("devig") ||
    h.includes("no-arbitrage") ||
    h.includes("no arbitrage")
  ) {
    return PLANS.deVig;
  }
  if (h.includes("etf") || h.includes("nav")) return PLANS.etfNav;
  if (h.includes("interview")) return PLANS.marketMaking;
  if (h.includes("extra knowledge")) return PLANS.puzzle;
  return null;
}

export const resolveGamesMiscPlan: PlanResolver = (ctx) => {
  const family = ctx.family ?? "";
  const section = ctx.section ?? "";

  const byFamily = family ? planFromFamily(family) : null;
  if (byFamily) return byFamily;

  const byTag = ctx.misconceptionTag ? planFromTag(ctx.misconceptionTag) : null;
  if (byTag) return byTag;

  return planFromSection(`${section} ${family}`);
};
