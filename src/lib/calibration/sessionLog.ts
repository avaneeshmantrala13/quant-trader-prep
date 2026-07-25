import type { CalibrationPair } from "@/lib/mastery/reliability";

/**
 * In-memory, bounded (pred, outcome) log for the reliability diagram — PHASE_5
 * §5. Persisting a full per-item history would require a Phase-1-owned
 * `UserProgress` schema change during a parallel run; the spec's DEFAULT is an
 * in-memory SESSION log (a small ring buffer per topic), so this holds no
 * persisted state and resets on reload. The primary round players (Phase 2/4,
 * owners of `LessonPage`) can push a `(predictSuccess, outcome)` pair per graded
 * item via {@link recordCalibrationPair}; until they wire it, the dashboard
 * simply renders the "insufficient data" state — it never fabricates a curve.
 *
 * The pure ring-buffer functions (`appendPair`, `pooledPairs`) are tested; the
 * module singleton (`sessionCalibrationLog`) is the app-wide store the dashboard
 * reads.
 */

/** Last-N cap per topic (PHASE_5 §5: "e.g. last 100 per topic"). */
export const CALIB_LOG_CAP = 100;

export type TopicCalibrationLog = Record<string, CalibrationPair[]>;

/**
 * Append a pair to a topic's log, keeping only the most-recent `cap` (immutable:
 * returns a new log; never mutates the input).
 */
export function appendPair(
  log: TopicCalibrationLog,
  topicKey: string,
  pair: CalibrationPair,
  cap = CALIB_LOG_CAP,
): TopicCalibrationLog {
  const prev = log[topicKey] ?? [];
  const nextTopic = [...prev, pair];
  if (nextTopic.length > cap) nextTopic.splice(0, nextTopic.length - cap);
  return { ...log, [topicKey]: nextTopic };
}

/** All pairs for one topic (empty when none logged). */
export function topicPairs(
  log: TopicCalibrationLog,
  topicKey: string,
): CalibrationPair[] {
  return log[topicKey] ?? [];
}

/** Pooled pairs across all topics (for the whole-dashboard reliability diagram). */
export function pooledPairs(log: TopicCalibrationLog): CalibrationPair[] {
  return Object.values(log).flat();
}

/**
 * App-wide session store (mutable singleton). Kept intentionally tiny: the pure
 * functions above do the work; this just holds the current session's log for the
 * dashboard to read. Not persisted; not tested (trivial wrapper).
 */
export const sessionCalibrationLog: { current: TopicCalibrationLog } = {
  current: {},
};

/** Push one graded item's (predicted, outcome) pair into the session store. */
export function recordCalibrationPair(
  topicKey: string,
  pred: number,
  outcome: 0 | 1,
): void {
  sessionCalibrationLog.current = appendPair(sessionCalibrationLog.current, topicKey, {
    pred,
    outcome,
  });
}
