import type { TopicMastery } from "@/types/mastery";
import { isTopicUnlocked } from "@/lib/mastery/unlock";
import { prereqNode } from "@/content/remediation/prereqDAG";
import {
  chooseDescentEdge,
  probeTierFor,
  remediationStep,
  type RemediationAction,
  type RemediationInput,
} from "./policy";
import { PROBE_P } from "./config";

/**
 * SWING-AND-RELOCK → prerequisite remediation (Part B).
 *
 * When a topic that the learner only held at a diagnostic-seeded LOW-CONFIDENCE
 * unlock is FAILED, its Beta mean swings back under the unlock bar and the topic
 * RE-LOCKS (see `@/lib/mastery/unlock`). That failure is a confirmed
 * prerequisite gap — NOT a first-stumble to ease past (Kapur) — so it routes
 * straight to the ~85% ZPD prerequisite probe (Vygotsky; the existing
 * `PROBE_P ≈ 0.85` path), instead of the usual "retry in place".
 *
 * This is a thin, PURE wrapper over the same tested `remediationStep` cascade,
 * with the origin-only {@link RemediationInput.forceDescend} override set. It
 * reuses `chooseDescentEdge` / `probeTierFor` (PROBE_P) verbatim, so the
 * descent target + probe tier are identical to normal remediation.
 */

/** True iff `prev` was unlocked and `next` is no longer — i.e. it just RE-LOCKED. */
export function didRelock(
  prev: TopicMastery | undefined,
  next: TopicMastery | undefined,
): boolean {
  return isTopicUnlocked(prev) && !isTopicUnlocked(next);
}

export interface RelockRemediationInput {
  /** The origin (just-relocked) topicKey. */
  topicKey: string;
  /** Origin mastery AFTER the failing round folded (drives the probe tier / θ). */
  mastery: TopicMastery | undefined;
  /** The misconception tag behind the failing answer (picks the descent edge). */
  misconceptionTag?: string;
  /** Lookup for prereq mastery (lowest-mastery fallback edge). Optional. */
  masteryOf?: (topicKey: string) => { mean: number; theta: number } | undefined;
}

/**
 * Plan the prerequisite-remediation action for a relocked low-confidence unlock.
 * Returns a `descend` to the ~0.85 prereq (or `floor-teach` at a graph floor),
 * or `{ kind: "exit", reason: "no-gap" }` when the topic is not a DAG node / has
 * no prerequisite to descend to. Never mutates its inputs.
 */
export function planRelockRemediation(
  inp: RelockRemediationInput,
): RemediationAction {
  const node = prereqNode(inp.topicKey);
  if (!node || node.prereqs.length === 0) {
    return { kind: "exit", reason: "no-gap" };
  }

  const theta = inp.mastery?.theta ?? 0;
  const origin: RemediationInput = {
    topicKey: inp.topicKey,
    theta,
    alpha: inp.mastery?.alpha ?? 1,
    beta: inp.mastery?.beta ?? 1,
    n: inp.mastery?.n ?? 0,
    // A failed low-confidence unlock is a genuine repeated-miss gap signal.
    consecutiveMisses: 2,
    atFloorTier: false,
    misconceptionTag: inp.misconceptionTag,
    responseFast: false,
    depthThisSession: 0,
    forceDescend: true,
  };

  const action = remediationStep(origin);
  if (action.kind !== "descend") return action;

  // Prefer the lowest-mastery / misconception-implicated edge when a snapshot is
  // available; otherwise keep the deterministic first-prereq target from the
  // policy. Re-target the probe tier at PROBE_P for the chosen edge.
  if (inp.masteryOf) {
    const target = chooseDescentEdge(node, inp.misconceptionTag, inp.masteryOf);
    if (target) {
      return {
        kind: "descend",
        toTopicKey: target,
        probeTier: probeTierFor(theta, target, {}),
      };
    }
  }
  return action;
}

/** The ~85% prerequisite-probe target this path aims for (re-exported for clarity). */
export const RELOCK_PROBE_P = PROBE_P;
