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
} as const;

/** family id → plan (the generator/template name, most specific signal). */
function planFromFamily(family: string): AttackPlan | null {
  const f = family.toLowerCase();
  if (f.includes("geometr")) return PLANS.geometric;
  if (/matrix|mixed[\s_-]?strateg|beauty|nash/.test(f)) return PLANS.gameTheory;
  if (
    f.includes("genmental") ||
    f.includes("addition") ||
    f.includes("multiplication") ||
    f.includes("percent")
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
  if (h.includes("geometr")) return PLANS.geometric;
  if (
    h.includes("game theory") ||
    h.includes("puzzle") ||
    h.includes("nash") ||
    h.includes("mixed strateg")
  ) {
    return PLANS.gameTheory;
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
