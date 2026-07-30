/**
 * ============================================================================
 *  SIMULATIONS — TWO-EVENT PROBABILITY (VENN) MODEL
 * ============================================================================
 * Pure, deterministic helpers for reasoning about two events A and B living in
 * the same sample space: the algebra of unions / intersections / complements,
 * the feasible range of the overlap P(A∩B), and a seedable Monte-Carlo of two
 * INDEPENDENT events converging on P(A)·P(B).
 *
 * No React / DOM here — everything is trivially unit-testable and reused by
 * `VennGroup.tsx`.
 */
import { Rng } from "@/lib/rng";
import { cumulativeProportion } from "@/lib/simulations/shared";

export interface VennInput {
  pA: number;
  pB: number;
  pAnd: number;
}

export interface VennMetrics {
  pA: number;
  pB: number;
  pAnd: number;
  pOr: number;
  pOnlyA: number;
  pOnlyB: number;
  pNeither: number;
  pAgivenB: number;
  pBgivenA: number;
  independent: boolean;
  mutuallyExclusive: boolean;
}

/**
 * Feasible range of the overlap P(A∩B) given the marginals P(A), P(B):
 * it can be no larger than the smaller event and, by inclusion–exclusion
 * (P(A∪B) ≤ 1), no smaller than P(A)+P(B)−1.
 */
export function intersectionBounds(pA: number, pB: number): [number, number] {
  return [Math.max(0, pA + pB - 1), Math.min(pA, pB)];
}

/** Clamp a requested overlap into the feasible `intersectionBounds`. */
export function clampIntersection(
  pA: number,
  pB: number,
  pAnd: number,
): number {
  const [lo, hi] = intersectionBounds(pA, pB);
  return Math.min(hi, Math.max(lo, pAnd));
}

/** Overlap implied by independence: P(A∩B) = P(A)·P(B). */
export function independentIntersection(pA: number, pB: number): number {
  return pA * pB;
}

/** Full derived probability table for two events with the given overlap. */
export function vennMetrics(input: VennInput): VennMetrics {
  const { pA, pB, pAnd } = input;
  const pOr = pA + pB - pAnd;
  const pOnlyA = pA - pAnd;
  const pOnlyB = pB - pAnd;
  const pNeither = 1 - pOr;
  const pAgivenB = pB > 0 ? pAnd / pB : 0;
  const pBgivenA = pA > 0 ? pAnd / pA : 0;
  const independent = Math.abs(pAnd - pA * pB) < 1e-9;
  const mutuallyExclusive = pAnd < 1e-9;

  return {
    pA,
    pB,
    pAnd,
    pOr,
    pOnlyA,
    pOnlyB,
    pNeither,
    pAgivenB,
    pBgivenA,
    independent,
    mutuallyExclusive,
  };
}

/**
 * Monte-Carlo two INDEPENDENT events: each trial draws A with prob `pA` and B
 * with prob `pB` independently, recording whether BOTH occurred. Returns the
 * running proportion of "both" over trials — it converges to P(A)·P(B).
 */
export function simulateTwoIndependent(
  pA: number,
  pB: number,
  trials: number,
  seed: number,
): number[] {
  const rng = new Rng(seed);
  const both: boolean[] = new Array(Math.max(0, trials));
  for (let i = 0; i < trials; i++) {
    const a = rng.chance(pA);
    const b = rng.chance(pB);
    both[i] = a && b;
  }
  return cumulativeProportion(both);
}
