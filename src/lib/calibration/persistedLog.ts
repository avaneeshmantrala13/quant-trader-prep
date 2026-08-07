import type { PersistedCalibrationPair } from "@/types/progress";
import type { CalibrationPair } from "@/lib/mastery/reliability";
import {
  ELICITED_CONFIDENCE_SOURCES,
  isElicitedConfidenceTopic,
} from "./reliability";

/**
 * Cross-session persisted calibration log (WS-CAL). The session-only ring buffer
 * (`sessionLog.ts`) resets on every reload, which keeps the reliability sample
 * tiny and is the root of the "n=1" nonsense. This capped, additive log lives on
 * `UserProgress.calibrationLog` so the panel ACCRUES across sessions and can
 * reach the sufficiency threshold. Pure functions (immutable); the writer lives
 * in `ProgressContext`.
 */

/** Global cap on the persisted log (oldest dropped first). */
export const PERSISTED_CALIB_CAP = 500;

/** Append one graded pair, keeping only the most-recent `cap` (immutable). */
export function appendPersistedPair(
  log: PersistedCalibrationPair[] | undefined,
  entry: PersistedCalibrationPair,
  cap = PERSISTED_CALIB_CAP,
): PersistedCalibrationPair[] {
  const next = [...(log ?? []), entry];
  if (next.length > cap) next.splice(0, next.length - cap);
  return next;
}

/** Strip topic keys → pooled `CalibrationPair[]` for the whole-dashboard diagram. */
export function toCalibrationPairs(
  log: PersistedCalibrationPair[] | undefined,
): CalibrationPair[] {
  return (log ?? []).map((p) => ({ pred: p.pred, outcome: p.outcome }));
}

/**
 * The pooled pairs the calibration panel is ALLOWED to show: ONLY those from
 * surfaces where the learner genuinely stated a confidence
 * (`ELICITED_CONFIDENCE_SOURCES`). Model-predicted quiz/numeric pairs are dropped
 * so the panel never presents the mastery model's self-estimate as the learner's
 * confidence (FIX 2). Order-preserving; strips topic keys like `toCalibrationPairs`.
 */
export function elicitedConfidencePairs(
  log: PersistedCalibrationPair[] | undefined,
): CalibrationPair[] {
  return (log ?? [])
    .filter((p) => isElicitedConfidenceTopic(p.topicKey))
    .map((p) => ({ pred: p.pred, outcome: p.outcome }));
}

/**
 * A plain-language provenance line for the calibration panel, naming the drills
 * that actually elicited confidence (and how many pairs each contributed).
 * Returns `undefined` when NO elicited-confidence data exists, so the caller can
 * gate the panel off entirely rather than explain an empty source. FIX 2.
 */
export function elicitedConfidenceSourceNote(
  log: PersistedCalibrationPair[] | undefined,
): string | undefined {
  const counts = new Map<string, number>();
  for (const p of log ?? []) {
    if (isElicitedConfidenceTopic(p.topicKey)) {
      counts.set(p.topicKey, (counts.get(p.topicKey) ?? 0) + 1);
    }
  }
  const total = [...counts.values()].reduce((s, n) => s + n, 0);
  if (total === 0) return undefined;
  const names = [...counts.keys()].map((k) => ELICITED_CONFIDENCE_SOURCES[k]);
  const sources =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  const times = total === 1 ? "1 time" : `${total} times`;
  return `Based on the ${times} you gave an explicit confidence estimate — in ${sources}.`;
}

/** Pairs for a single topic (for a per-topic reliability read). */
export function persistedPairsForTopic(
  log: PersistedCalibrationPair[] | undefined,
  topicKey: string,
): CalibrationPair[] {
  return (log ?? [])
    .filter((p) => p.topicKey === topicKey)
    .map((p) => ({ pred: p.pred, outcome: p.outcome }));
}
