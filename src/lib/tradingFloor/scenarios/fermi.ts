/**
 * THE TRADING FLOOR — Fermi quantity scenario (rigorous by construction).
 *
 * Wraps a `FERMI_ITEM`: each canonical factor is revealed one at a time; your
 * fair value entering a step is the running product using the REALIZED values of
 * revealed factors and the reference values of the unrevealed ones. To make that
 * fair an exact MARTINGALE we perturb each realized factor by a mean-1
 * multiplier (a mean-1 lognormal, with the opposite log-correction for `div`
 * factors so `E[1/multiplier] = 1` too), so `E[fair after next reveal] = fair
 * now`. `settle` is the fully-realized product; `computeFermiReference` remains
 * the expected settlement.
 */
import type { Rng } from "@/lib/rng";
import { formatFermiNumber, type FermiFactor } from "@/lib/fermi/grader";
import type { FermiItem } from "@/content/fermi/items";
import { normal } from "../bot";
import type { Posterior, Scenario } from "../types";

/** Multiplicative uncertainty per factor (log-sd). Moderate so fair stays sane. */
const FACTOR_SIGMA = 0.3;

interface FermiTruth {
  item: FermiItem;
  factors: FermiFactor[];
  /** Realized value of each factor (base × mean-1 multiplier). */
  realized: number[];
}

function isDiv(f: FermiFactor): boolean {
  return f.op === "div";
}

/** Contribution of one factor's value to the running product (× or ÷). */
function applyFactor(acc: number, f: FermiFactor, value: number): number {
  return isDiv(f) ? acc / value : acc * value;
}

/** Running product over factors, using `valueAt(i)` for factor i. */
function product(
  factors: FermiFactor[],
  valueAt: (i: number) => number,
): number {
  return factors.reduce((acc, f, i) => applyFactor(acc, f, valueAt(i)), 1);
}

/** Build a Fermi quantity scenario from a specific item. */
export function fermiScenario(item: FermiItem): Scenario<FermiTruth> {
  const factors = item.factors;
  return {
    id: `fermi-${item.id}`,
    kind: "quantity",
    title: item.quantity,
    prompt: item.prompt,
    unit: item.unit,
    rounds: factors.length,
    drawTruth(rng: Rng) {
      const realized = factors.map((f) => {
        // Mean-1 lognormal; div factors use +σ²/2 so E[1/multiplier]=1 too.
        const correction = isDiv(f)
          ? FACTOR_SIGMA * FACTOR_SIGMA * 0.5
          : -FACTOR_SIGMA * FACTOR_SIGMA * 0.5;
        const mult = Math.exp(normal(rng, 0, FACTOR_SIGMA) + correction);
        return f.value * mult;
      });
      return { item, factors, realized };
    },
    reveal(truth, r) {
      const f = truth.factors[r];
      const v = truth.realized[r];
      const op = isDiv(f) ? "÷" : "×";
      const unit = f.unit ? ` ${f.unit}` : "";
      return {
        round: r,
        label: `${op} ${f.label} ≈ ${formatFermiNumber(v)}${unit}`,
        detail: `Reference ${op} ${formatFermiNumber(f.value)}${unit}`,
        value: v,
      };
    },
    fair(truth, revealed) {
      const seen = revealed.length;
      return product(truth.factors, (i) =>
        i < seen ? truth.realized[i] : truth.factors[i].value,
      );
    },
    settle(truth) {
      return product(truth.factors, (i) => truth.realized[i]);
    },
    posterior(truth, revealed): Posterior {
      const seen = revealed.length;
      const remaining = truth.factors.length - seen;
      const mean = product(truth.factors, (i) =>
        i < seen ? truth.realized[i] : truth.factors[i].value,
      );
      // Lognormal-ish spread: absolute sd grows with the unrealized factors.
      const sd = mean * FACTOR_SIGMA * Math.sqrt(Math.max(0, remaining));
      return { mean, sd };
    },
  };
}
