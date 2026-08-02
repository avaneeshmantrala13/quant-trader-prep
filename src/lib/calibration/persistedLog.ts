import type { PersistedCalibrationPair } from "@/types/progress";
import type { CalibrationPair } from "@/lib/mastery/reliability";

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

/** Pairs for a single topic (for a per-topic reliability read). */
export function persistedPairsForTopic(
  log: PersistedCalibrationPair[] | undefined,
  topicKey: string,
): CalibrationPair[] {
  return (log ?? [])
    .filter((p) => p.topicKey === topicKey)
    .map((p) => ({ pred: p.pred, outcome: p.outcome }));
}
