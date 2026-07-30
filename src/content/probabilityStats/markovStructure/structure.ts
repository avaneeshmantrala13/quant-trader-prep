import Fraction from "fraction.js";
import { F } from "../coreSolvers";

/**
 * Exact solver for **Markov structural theory** — the transition-matrix / n-step
 * (Pⁿ) formalism (Chapman–Kolmogorov) — Bucket 2 "Extra Relevant Knowledge"
 * (UT M362M). State classification (recurrence/transience/periodicity/
 * communicating classes) is taught conceptually in the quiz generators.
 */

/** (P²)_{ij} = Σ_k P_{ik}·P_{kj} — the 2-step Chapman–Kolmogorov entry. Exact. */
export function twoStepEntry(P: Fraction[][], i: number, j: number): Fraction {
  let s = F(0);
  for (let k = 0; k < P.length; k++) s = s.add(P[i][k].mul(P[k][j]));
  return s;
}
