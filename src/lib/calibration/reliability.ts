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

/**
 * Sufficiency thresholds (WS-CAL). Below `MIN_PAIRS` pooled pairs the panel
 * refuses to show numbers (this is what kills the "n=1" nonsense); the headline
 * "~80%" read additionally needs `MIN_BIN` pairs in the P_TARGET band.
 */
export const MIN_PAIRS = 25;
export const MIN_BIN = 5;
/** Dead-band on the signed gap within which the learner reads as "well-calibrated". */
export const CALIB_DEAD_BAND = 0.02;

export type CalibrationLean = "over" | "under" | "well";

/**
 * ONE evidence-weighted signed calibration read, derived from a single number so
 * the headline, chip, and caption can NEVER contradict. `signed > 0` ⇒
 * confidence exceeds accuracy ⇒ over-confident (points BELOW the diagonal).
 */
export interface CalibrationRead {
  /** signed = Σ_k (n_k/N)(conf_k − acc_k). Positive ⇒ over-confident. */
  signed: number;
  lean: CalibrationLean;
  /** One plain-language sentence derived from `lean` (the primary read). */
  label: string;
}

export interface ReliabilityDiagramData {
  bins: ReliabilityBin[];
  /** Σ_k (n_k/N)|conf_k − acc_k| — the ECE-style reliability gap. */
  relGap: number;
  /** mean((pred − outcome)²). */
  brier: number;
  count: number;
  /**
   * True once ≥ `MIN_PAIRS` pooled pairs exist. When false the UI renders an
   * encouraging progress state instead of any numbers (the sufficiency gate).
   */
  sufficient: boolean;
  /** Minimum pooled pairs required to show the panel (for the progress copy). */
  minPairs: number;
  /**
   * Single signed calibration read (over/under/well) with its plain-language
   * label. Present whenever there is ≥1 pair; the UI only surfaces it once
   * `sufficient` is true.
   */
  calibration?: CalibrationRead;
  /**
   * Headline calibration read at the P_TARGET band: among predictions near 80%,
   * the fraction actually correct — "when you say 80%, you're right X%".
   * `undefined` unless ≥ `MIN_BIN` predictions land in the band (no more n=1).
   */
  headline?: { predicted: number; observed: number; count: number };
}

/** Plain-language label for a signed calibration read. */
export function calibrationLabel(signed: number): CalibrationRead {
  if (signed > CALIB_DEAD_BAND) {
    return {
      signed,
      lean: "over",
      label:
        "You tend to be over-confident — you're right a bit less often than you feel.",
    };
  }
  if (signed < -CALIB_DEAD_BAND) {
    return {
      signed,
      lean: "under",
      label:
        "You tend to be under-confident — you're actually better than you think.",
    };
  }
  return {
    signed,
    lean: "well",
    label: "You're well-calibrated — your confidence matches your accuracy.",
  };
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
    return {
      bins: [],
      relGap: 0,
      brier: 0,
      count: 0,
      sufficient: false,
      minPairs: MIN_PAIRS,
    };
  }
  const bins: ReliabilityBin[] = reliabilityBins(pairs, nBins).map((b) => ({
    pMid: b.conf,
    predicted: b.conf,
    observed: b.acc,
    count: b.count,
  }));
  const { relGap, brier } = brierGap(pairs);

  // ONE evidence-weighted signed gap → both labels (never contradict).
  const signed = bins.reduce(
    (s, b) => s + (b.count / count) * (b.predicted - b.observed),
    0,
  );
  const calibration = calibrationLabel(signed);

  // Headline "~80%" read: only when ≥ MIN_BIN pairs land in the band (no n=1).
  const band = pairs.filter(
    (p) => p.pred >= P_TARGET_BAND[0] && p.pred <= P_TARGET_BAND[1],
  );
  const headline =
    band.length >= MIN_BIN
      ? {
          predicted: P_TARGET,
          observed: band.reduce((s, p) => s + p.outcome, 0) / band.length,
          count: band.length,
        }
      : undefined;

  return {
    bins,
    relGap,
    brier,
    count,
    sufficient: count >= MIN_PAIRS,
    minPairs: MIN_PAIRS,
    calibration,
    headline,
  };
}
