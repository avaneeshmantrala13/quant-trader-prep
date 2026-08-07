import {
  brierGap,
  reliabilityBins,
  type CalibrationPair,
} from "@/lib/mastery/reliability";
import { P_TARGET } from "@/lib/mastery/config";
import { topicKeyOf } from "@/lib/mastery/topicKey";
import { FLOOR_TOPIC_KEY } from "@/lib/tradingFloor/config";

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

/**
 * The ONLY surfaces where the learner GENUINELY STATES a confidence/probability,
 * so a (pred, outcome) pair is a real ELICITED-confidence forecast — not the
 * mastery model's own success estimate. Keyed by topicKey → human source name.
 *
 *  - Fermi estimation (`fermi::_core`): the learner commits an explicit 90%
 *    confidence interval; the logged pair is (0.9, hit?) — a direct calibration
 *    of their OWN stated interval.
 *  - Trading Floor (`trading-floor`): the learner quotes a probability/price on
 *    a binary market; the pair is (their price, outcome) — a direct forecast.
 *
 * Quiz / numeric lessons log `predictSuccess(θ, …)` — the MODEL's success
 * probability, which the learner never states — so they are DELIBERATELY
 * EXCLUDED from the calibration panel. Pooling them would label the model's
 * self-estimate as the learner's "confidence", which is dishonest (FIX 2).
 */
export const ELICITED_CONFIDENCE_SOURCES: Record<string, string> = {
  [topicKeyOf("fermi")]: "Estimation warm-ups (your 90% intervals)",
  [FLOOR_TOPIC_KEY]: "Trading-Floor price quotes",
};

/** True when a topic's pairs reflect confidence the learner actually stated. */
export function isElicitedConfidenceTopic(topicKey: string): boolean {
  return topicKey in ELICITED_CONFIDENCE_SOURCES;
}

/**
 * The single, canonical sentence naming the ONLY two activities that produce a
 * confidence-rated data point. Shared by every theme's calibration panel so the
 * gating copy is identical everywhere and can NEVER imply that ordinary lessons
 * or quizzes count toward calibration (they never do — see
 * `ELICITED_CONFIDENCE_SOURCES`). FIX 2.
 */
export const ELICITED_ACTIVITIES_SENTENCE =
  "your Fermi estimation 90% intervals and your Trading-Floor price quotes";

/**
 * How many MORE elicited-confidence pairs are still needed before the panel
 * unlocks, given the current pooled ELICITED count. Never negative. This is the
 * honest "N more of those" number the gating copy shows — it decrements only as
 * real elicited pairs (Fermi CIs / Floor quotes) accrue, never on normal topics.
 */
export function elicitedPairsNeeded(
  count: number,
  minPairs = MIN_PAIRS,
): number {
  return Math.max(0, minPairs - count);
}
/**
 * Tolerance (dead-band) on the SIGNED calibration gap within which the learner
 * reads as "well-calibrated". A ±3-point gap between average confidence and
 * average accuracy is within sampling noise, so e.g. "say 80% / right 82%"
 * (signed = −0.02) reads well-calibrated rather than being flagged as a lean.
 */
export const CALIB_DEAD_BAND = 0.03;

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
  /**
   * Plain-language provenance line naming WHERE this confidence came from (the
   * elicited-confidence drills), so the panel is self-explanatory and never
   * implies that ordinary question-answering measured the learner's confidence.
   * `undefined` when there is no elicited data. FIX 2.
   */
  sourceNote?: string;
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

  // ONE evidence-weighted SIGNED calibration error is the single source of
  // truth: signed = Σ_k (n_k/N)(conf_k − acc_k) = mean(predicted) − mean(observed).
  // The verdict chip, its plain-language label, and the "above/below the
  // diagonal" caption in every dashboard all read from this one number's sign,
  // so they can NEVER contradict (signed > tol ⇒ over-confident ⇒ curve BELOW
  // the diagonal; signed < −tol ⇒ under-confident ⇒ curve ABOVE the diagonal).
  const signed = bins.reduce(
    (s, b) => s + (b.count / count) * (b.predicted - b.observed),
    0,
  );
  const calibration = calibrationLabel(signed);

  // Headline "~80%" read: among predictions near P_TARGET, the fraction actually
  // correct — shown only when ≥ MIN_BIN pairs land in the band (no n=1). It is
  // ALSO gated on directional agreement with the aggregate lean: a concrete
  // example that bucks the overall verdict (e.g. "right 82% when you say ~80%",
  // which plots ABOVE the diagonal, next to an OVER-confident chip that says the
  // curve runs BELOW it) is exactly the self-contradiction this panel must never
  // show, so we withhold it rather than surface a headline that fights the read.
  const band = pairs.filter(
    (p) => p.pred >= P_TARGET_BAND[0] && p.pred <= P_TARGET_BAND[1],
  );
  let headline: ReliabilityDiagramData["headline"];
  if (band.length >= MIN_BIN) {
    const bandPredicted = band.reduce((s, p) => s + p.pred, 0) / band.length;
    const bandObserved = band.reduce((s, p) => s + p.outcome, 0) / band.length;
    // Local signed gap for the band; > 0 ⇒ the band point sits BELOW the
    // diagonal (over-confident there), < 0 ⇒ ABOVE it (under-confident there).
    const bandSigned = bandPredicted - bandObserved;
    const contradictsVerdict =
      (calibration.lean === "over" && bandSigned < 0) ||
      (calibration.lean === "under" && bandSigned > 0);
    if (!contradictsVerdict) {
      headline = {
        predicted: P_TARGET,
        observed: bandObserved,
        count: band.length,
      };
    }
  }

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
