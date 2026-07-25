import { DEPTH_CAP } from "./config";

/**
 * Session-local remediation state machine (PHASE_4 §3/§9) — a small, PURE,
 * in-memory record of one descent: which node we started from, where we are
 * now, how many edges we've descended (capped at {@link DEPTH_CAP}), the path
 * taken, and the climb-back ladder position. Nothing here is persisted; a new
 * lesson session starts fresh via {@link startRemediation}.
 *
 * All transitions return NEW objects (never mutate the input) so the LessonPage
 * wiring can hold it in React state and tests stay deterministic.
 */

export type RemediationPhase =
  | "descending" // walking down the DAG, probing prerequisites
  | "teaching" // frontier / floor reached — showing corrective content
  | "climbing" // climb-back: re-serving the parent, interleaved
  | "exited"; // remediation finished (slip / no-gap / climbed out)

export interface RemediationSession {
  originTopicKey: string;
  currentTopicKey: string;
  /** Edges descended so far this session (0 at the origin). */
  depth: number;
  /** Nodes visited, origin first. */
  path: string[];
  /** SM-2 ladder index for the climb-back review (0-based). */
  reviewStep: number;
  phase: RemediationPhase;
}

/** Fresh session anchored at the origin topic (depth 0, at the origin node). */
export function startRemediation(originTopicKey: string): RemediationSession {
  return {
    originTopicKey,
    currentTopicKey: originTopicKey,
    depth: 0,
    path: [originTopicKey],
    reviewStep: 0,
    phase: "descending",
  };
}

/** True once the session has descended the maximum number of edges. */
export function atDepthCap(s: RemediationSession): boolean {
  return s.depth >= DEPTH_CAP;
}

/**
 * Descend one edge to `toTopicKey`: depth += 1 (clamped at {@link DEPTH_CAP}),
 * append to the path, stay in the `descending` phase. A no-op (returns the same
 * shape) once at the cap so callers can't over-descend.
 */
export function descendTo(
  s: RemediationSession,
  toTopicKey: string,
): RemediationSession {
  if (atDepthCap(s)) {
    return { ...s, phase: "teaching" };
  }
  return {
    ...s,
    currentTopicKey: toTopicKey,
    depth: s.depth + 1,
    path: [...s.path, toTopicKey],
    phase: "descending",
  };
}

/** Enter the teaching phase at the current node (frontier / floor reached). */
export function enterTeaching(s: RemediationSession): RemediationSession {
  return { ...s, phase: "teaching" };
}

/**
 * Begin the climb-back: re-serve the parent (one edge up the path) interleaved
 * with the repaired node. Moves `currentTopicKey` up to the parent and flips to
 * the `climbing` phase. At the origin there is nowhere to climb ⇒ exit.
 */
export function beginClimb(s: RemediationSession): RemediationSession {
  if (s.depth <= 0) return { ...s, phase: "exited" };
  const parent = s.path[s.depth - 1];
  return { ...s, currentTopicKey: parent, depth: s.depth - 1, phase: "climbing" };
}

/** Finish remediation this session. */
export function exitRemediation(s: RemediationSession): RemediationSession {
  return { ...s, phase: "exited" };
}
