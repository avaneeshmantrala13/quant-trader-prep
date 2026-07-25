import {
  brierGap,
  reliabilityBins,
  type CalibrationPair,
} from "@/lib/mastery/reliability";
import { P_TARGET } from "@/lib/mastery/config";

/**
 * Reliability-diagram SHAPING for the Phase-5 dashboard (Murphy Brier
 * decomposition; Dimitriadis, Gneiting & Jordan 2021 — PHASE_5 §5).
 *
 * The numerical primitives (`reliabilityBins`, `brierGap`) are OWNED BY PHASE 1
 * (`src/lib/mastery/reliability.ts`) and are CONSUMED here, never forked — this
 * module only adds the diagram-shaping helper + thin gap/score accessors and the
 * "when you say 80%, you're right X%" headline. Plotting `predicted` (x) vs
 * `observed` (y) against the 45° diagonal is done by the SVG component.
 */

/** One diagram point: predicted confidence (x) vs observed accuracy (y). */
export interface ReliabilityBin {
  /** Bin midpoint on the confidence axis (== predicted; kept for the x-position). */
  pMid: number;
  /** Mean predicted probability in the bin (confidence, x). */
  predicted: number;
  /** Observed fraction correct in the bin (accuracy, y). */
  observed: number;
  count: number;
}

export interface ReliabilityDiagramData {
  bins: ReliabilityBin[];
  /** Σ_k (n_k/N)|conf_k − acc_k| — the ECE-style reliability gap. */
  relGap: number;
  /** mean((pred − outcome)²). */
  brier: number;
  count: number;
  /**
   * Headline calibration read at the P_TARGET band: among predictions near 80%,
   * the fraction actually correct — "when you say 80%, you're right X%".
   * `undefined` when no predictions land in the band.
   */
  headline?: { predicted: number; observed: number; count: number };
}

/** Σ_k (n_k/N)|conf_k − acc_k| over equal-frequency bins (Phase-1 binning). */
export function brierReliabilityGap(
  pairs: CalibrationPair[],
  nBins = 10,
): number {
  const n = pairs.length;
  if (n === 0) return 0;
  const bins = reliabilityBins(pairs, nBins);
  return bins.reduce(
    (s, bin) => s + (bin.count / n) * Math.abs(bin.conf - bin.acc),
    0,
  );
}

/** mean((pred − outcome)²) — delegates to the Phase-1 Brier computation. */
export function brierScore(pairs: CalibrationPair[]): number {
  return brierGap(pairs).brier;
}

const P_TARGET_BAND: [number, number] = [P_TARGET - 0.05, P_TARGET + 0.05];

/**
 * Shape a per-topic (or pooled) calibration log into diagram-ready bins + the
 * gap/brier/headline stats. Returns empty `bins` (count 0) when there is no data
 * — the UI shows an "insufficient data" state rather than fabricating a curve.
 */
export function reliabilityDiagram(
  pairs: CalibrationPair[],
  nBins = 10,
): ReliabilityDiagramData {
  const count = pairs.length;
  if (count === 0) {
    return { bins: [], relGap: 0, brier: 0, count: 0 };
  }
  const bins: ReliabilityBin[] = reliabilityBins(pairs, nBins).map((b) => ({
    pMid: b.conf,
    predicted: b.conf,
    observed: b.acc,
    count: b.count,
  }));
  const { relGap, brier } = brierGap(pairs);

  const band = pairs.filter(
    (p) => p.pred >= P_TARGET_BAND[0] && p.pred <= P_TARGET_BAND[1],
  );
  const headline =
    band.length > 0
      ? {
          predicted: P_TARGET,
          observed:
            band.reduce((s, p) => s + p.outcome, 0) / band.length,
          count: band.length,
        }
      : undefined;

  return { bins, relGap, brier, count, headline };
}
