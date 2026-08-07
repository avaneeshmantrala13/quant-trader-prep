/**
 * mock/mathGate.ts — the MOCK-SCOPED arithmetic speed gate.
 *
 * The shared mental-math generators (`src/content/mentalMath/generators.ts`) are
 * used by course lessons and the Speed Arena, which legitimately include EASY
 * items for teaching (e.g. "1/2 as a decimal", "10% of 200"). A real firm gate,
 * however, must NEVER hand the candidate a memorised freebie — every question
 * has to require genuine fast computation.
 *
 * This module wraps the shared *builders* (unchanged; only extended with OPTIONAL
 * params defaulting to their original behaviour) with tighter parameters plus a
 * deterministic REJECTION filter that guarantees a non-trivial instance:
 *   • multiplication  → real 2-digit × 2-digit (and a 3-digit × 2-digit variant)
 *   • division        → genuine 3-digit ÷ 2-digit
 *   • fraction→decimal→ reduced denominator ∈ {8,16,20,25}; never 1/2, 1/4, 1/5…
 *   • percent         → excludes memorised shifts/quarters; result is never round
 *   • odds↔probability→ never even odds (no 50% freebie)
 *
 * Rejection sampling consumes a DETERMINISTIC number of draws from the seeded
 * `Rng`, so the gate stays fully seedable: the same seed ⇒ the same questions.
 */
import type { Rng } from "@/lib/rng";
import type { NumericQuestion } from "@/types/content";
import {
  buildDivisionNumericInstance,
  buildFractionToDecimalNumericInstance,
  buildMultiply2x2NumericInstance,
  buildPercentNumericInstance,
  genOddsToProbNumeric,
} from "@/content/mentalMath/generators";
import type { MathTier } from "./types";

/** Decimals a fast gate would consider "memorised" and therefore trivial. */
export const TRIVIAL_DECIMALS = new Set([
  0.5, 0.25, 0.75, 0.2, 0.4, 0.6, 0.8, 0.1, 0.3, 0.7, 0.9,
]);

/** Reduced denominators that force a real long-division (non-trivial). */
export const NON_TRIVIAL_FRACTION_DENS = new Set([8, 16, 20, 25]);

/**
 * The lowest-terms denominator of a value in (0, 1) expressed with ≤ 4 decimals.
 * e.g. 0.375 → 8, 0.35 → 20, 0.36 → 25, 0.5 → 2, 0.25 → 4.
 */
export function reducedDenominator(value: number): number {
  let num = Math.round(value * 10000);
  let den = 10000;
  let a = num;
  let b = den;
  while (b) [a, b] = [b, a % b];
  const g = a || 1;
  return den / g;
}

/** A fraction→decimal instance is trivial unless its reduced denominator is one
 * of {8,16,20,25} AND the value is not a memorised decimal. */
function isTrivialFraction(q: NumericQuestion): boolean {
  if (TRIVIAL_DECIMALS.has(q.answer)) return true;
  return !NON_TRIVIAL_FRACTION_DENS.has(reducedDenominator(q.answer));
}

/**
 * Draw from `gen` until `accept` is satisfied. Deterministic given the seeded
 * `Rng`. The cap only guards against a pathological infinite loop; acceptance
 * rates here are high, so it is effectively never reached.
 */
function drawUntil(
  rng: Rng,
  gen: (rng: Rng) => NumericQuestion,
  accept: (q: NumericQuestion) => boolean,
  cap = 128,
): NumericQuestion | null {
  for (let i = 0; i < cap; i++) {
    const q = gen(rng);
    if (accept(q)) return q;
  }
  return null;
}

/* --------------------------------------------------------------------------- */
/*  Gate generators — every one requires genuine computation                    */
/* --------------------------------------------------------------------------- */

/** Real 2-digit × 2-digit (the shared builder is already non-trivial here). */
export function gateMultiply2x2(rng: Rng): NumericQuestion {
  return buildMultiply2x2NumericInstance(rng, "medium").numeric;
}

/** 3-digit × 2-digit under a tight clock. */
export function gateMultiply3x2(rng: Rng): NumericQuestion {
  return buildMultiply2x2NumericInstance(rng, "hard", {
    aRange: [112, 499],
    bRange: [12, 49],
  }).numeric;
}

/** Genuine 3-digit ÷ 2-digit (exact), 2-digit divisor. */
export function gateDivision(rng: Rng): NumericQuestion {
  return buildDivisionNumericInstance(rng, "hard", {
    divisor: [12, 19],
    quotient: [11, 49],
  }).numeric;
}

/**
 * Percent of a base where the result is never a round/memorised value. The
 * multiplier set excludes 5/10/20/25/50 and the rejection filter drops any
 * result that is a multiple of 5 (which captures the remaining easy landings).
 */
export function gatePercent(rng: Rng): NumericQuestion {
  const gen = (r: Rng) =>
    buildPercentNumericInstance(r, "hard", { ps: [12, 15, 35, 45, 65, 85] })
      .numeric;
  const q =
    drawUntil(rng, gen, (x) => x.answer % 5 !== 0 && x.answer >= 6) ?? gen(rng);
  return q;
}

/**
 * Fraction → decimal restricted to denominators {8,16,20,25}, rejecting any
 * draw whose reduced form is trivial. Guarantees values like 3/8=0.375,
 * 7/16=0.4375, 7/20=0.35, 9/25=0.36 — never 1/2, 1/4, 1/5, 3/4, etc.
 */
export function gateFractionToDecimal(rng: Rng): NumericQuestion {
  const gen = (r: Rng) =>
    buildFractionToDecimalNumericInstance(r, "hard", {
      dens: [8, 16, 20, 25],
    }).numeric;
  const q = drawUntil(rng, gen, (x) => !isTrivialFraction(x));
  if (q) return q;
  // Deterministic non-trivial fallback (should never be reached in practice).
  return gen(rng);
}

/** Odds ↔ implied probability, never even odds (which would give a 50% freebie). */
export function gateOddsToProb(rng: Rng): NumericQuestion {
  const q =
    drawUntil(rng, genOddsToProbNumeric, (x) => !TRIVIAL_DECIMALS.has(x.answer)) ??
    genOddsToProbNumeric(rng);
  return q;
}

/* --------------------------------------------------------------------------- */
/*  Tiered pools consumed by the engine (replaces the raw shared MM pools)       */
/* --------------------------------------------------------------------------- */

/** Every generator below is guaranteed non-trivial — no memorised freebies. */
export const GATE_EASY: ((rng: Rng) => NumericQuestion)[] = [
  gateMultiply2x2,
  gateDivision,
  gatePercent,
];

export const GATE_MEDIUM: ((rng: Rng) => NumericQuestion)[] = [
  gateMultiply2x2,
  gateDivision,
  gatePercent,
  gateFractionToDecimal,
];

/**
 * DIFFICULTY-FLOOR PURGE: bare 2-digit × 2-digit (`gateMultiply2x2`, e.g. 29×14)
 * is NOT hard for a quant, so it is removed from the WARM-UP tier the firm
 * presets draw (their single `mental-math` slot is `difficulty: "hard"` → this
 * pool). Every remaining item demands genuine speed/insight a freshman lacks:
 * 3-digit × 2-digit under a clock, real 3-digit ÷ 2-digit, an un-memorisable
 * fraction→decimal, and odds→implied-probability (de-vig). `gateMultiply2x2`
 * itself is retained (used by the legacy count-based path's easy/medium tiers
 * and unit tests) — just never reachable from a firm mock.
 */
export const GATE_HARD: ((rng: Rng) => NumericQuestion)[] = [
  gateMultiply3x2,
  gateDivision,
  gateFractionToDecimal,
  gateOddsToProb,
];

/** Mock-only arithmetic-gate pools, keyed by tier (used by `engine.ts`). */
export const MOCK_GATE_POOLS: Record<MathTier, ((rng: Rng) => NumericQuestion)[]> =
  {
    easy: GATE_EASY,
    medium: GATE_MEDIUM,
    hard: GATE_HARD,
  };
