import type { Difficulty } from "@/types/content";
import { DIFFICULTY_META } from "@/types/content";
import type { TierDifficultyMap } from "@/types/mastery";
import { predictSuccess, seedTierDifficulty } from "@/lib/mastery/elo";
import { tierDifficultyKey } from "@/lib/mastery/topicKey";
import {
  MISCONCEPTION_EDGE,
  prereqNode,
  type PrereqNode,
} from "@/content/remediation/prereqDAG";
import {
  BOTTOM_OUT_MISSES,
  BOTTOM_OUT_PMAX,
  DEPTH_CAP,
  PROBE_P,
} from "./config";

/**
 * The pure remediation decision cascade (PHASE_4 §5, RESEARCH_REMEDIATION §2.3).
 *
 * `remediationStep` maps the learner's state at ONE node to the next action:
 * retry in place (Kapur — don't remediate the first stumble), descend an edge
 * (KST — probe the implicated prerequisite at ~85%), teach the composition edge
 * up (outer fringe = first passed probe), teach at the floor (Vygotsky), or
 * exit (a fast+confident miss is a slip, not a gap). All decisions are a pure
 * function of Phase-1 scalars + session counters — no LLM, no clock, no network.
 */

export type RemediationAction =
  | { kind: "retry-in-place"; tier: Difficulty } // STEP A (Kapur: first miss / not bottomed)
  | { kind: "descend"; toTopicKey: string; probeTier: Difficulty } // STEP C/D
  | { kind: "teach-link"; atTopicKey: string } // frontier found: teach the edge up
  | { kind: "floor-teach"; atTopicKey: string } // floor reached
  | { kind: "exit"; reason: "slip" | "cap" | "no-gap" }; // stop remediation

export interface RemediationInput {
  /** The node currently under evaluation (origin on first call, prereq while descending). */
  topicKey: string;
  theta: number;
  alpha: number;
  beta: number;
  n: number;
  /** Consecutive misses AT THIS NODE this session (0 ⇒ the probe just passed). */
  consecutiveMisses: number;
  /** True once the serving tier has been lowered to intro for this node. */
  atFloorTier: boolean;
  /** The tag the tripping misconception implicated (already stripped of the topicKey prefix). */
  misconceptionTag?: string;
  /** Fast + confident wrong answer ⇒ likely a slip, not a knowledge gap. */
  responseFast?: boolean;
  /** Edges descended so far this session (drives the depth cap). */
  depthThisSession: number;
  /**
   * ORIGIN-ONLY override (Part B, low-confidence unlock relock). When true and we
   * are at the origin node, skip the Kapur first-stumble grace and bottom-out
   * gate and descend to the ~85% prerequisite immediately: a topic that was only
   * held at a diagnostic-seeded LOW-CONFIDENCE unlock and then failed is a
   * confirmed gap (the mastery was never earned), so it routes straight to the
   * prerequisite probe. Floors still teach in place. Ignored while descending
   * (depth > 0) so the descent still terminates normally.
   */
  forceDescend?: boolean;
}

const TIER_ORDER: Difficulty[] = (
  Object.keys(DIFFICULTY_META) as Difficulty[]
).sort((a, b) => DIFFICULTY_META[a].order - DIFFICULTY_META[b].order);

/**
 * Probe tier = the tier whose guessing-free predicted success is CLOSEST to
 * {@link PROBE_P} (0.85) for this learner/topic (Wilson 85% Rule). Uses the
 * stored per-(topic,tier) Elo difficulty when present, else the tier seed
 * (a learner reaching a fresh prerequisite typically has no per-tier history).
 * Ties break to the EASIER tier (Vygotsky: don't overshoot the ZPD).
 */
export function probeTierFor(
  theta: number,
  topicKey: string,
  tierD: TierDifficultyMap,
): Difficulty {
  let best: Difficulty = TIER_ORDER[0];
  let bestGap = Infinity;
  for (const tier of TIER_ORDER) {
    const d = tierD[tierDifficultyKey(topicKey, tier)] ?? seedTierDifficulty(tier);
    const p = predictSuccess(theta, d);
    const gap = Math.abs(p - PROBE_P);
    // Strictly-less keeps the FIRST (easier) tier on a tie.
    if (gap < bestGap) {
      bestGap = gap;
      best = tier;
    }
  }
  return best;
}

/**
 * Choose which prerequisite edge to descend (PHASE_4 §5 STEP C):
 *  1. the `MISCONCEPTION_EDGE[tag]` target IF it is a prerequisite of `node`;
 *  2. else the prerequisite with the LOWEST current mastery (min posterior
 *     mean, θ as tie-break);
 *  3. else (no prereqs) `undefined`.
 */
export function chooseDescentEdge(
  node: PrereqNode,
  misconceptionTag: string | undefined,
  masteryOf: (k: string) => { mean: number; theta: number } | undefined,
): string | undefined {
  if (node.prereqs.length === 0) return undefined;

  if (misconceptionTag) {
    const implicated = MISCONCEPTION_EDGE[misconceptionTag];
    if (implicated && node.prereqs.includes(implicated)) return implicated;
  }

  let chosen = node.prereqs[0];
  let chosenScore = scoreOf(masteryOf(chosen));
  for (const k of node.prereqs.slice(1)) {
    const s = scoreOf(masteryOf(k));
    if (s.mean < chosenScore.mean - 1e-12 ||
      (Math.abs(s.mean - chosenScore.mean) <= 1e-12 && s.theta < chosenScore.theta)) {
      chosen = k;
      chosenScore = s;
    }
  }
  return chosen;
}

function scoreOf(
  m: { mean: number; theta: number } | undefined,
): { mean: number; theta: number } {
  // Unseen prereqs are treated as maximally weak so they sort to the front.
  return m ?? { mean: -Infinity, theta: -Infinity };
}

/**
 * The decision cascade for the node in `inp` (PHASE_4 §5). See module doc for
 * the ordered rules; STOP is the first of: probe passed (teach-link), floor
 * (floor-teach), depth cap (teach-link at lowest reached), or non-gap (exit).
 */
export function remediationStep(inp: RemediationInput): RemediationAction {
  const node = prereqNode(inp.topicKey);
  // Unknown topic ⇒ nothing to remediate against; resume normal play.
  if (!node) return { kind: "exit", reason: "no-gap" };

  // Non-gap override (highest priority): a fast + confident miss is a slip.
  if (inp.responseFast) return { kind: "exit", reason: "slip" };

  // --- At a descended PREREQUISITE probe (STEP D) --------------------------
  if (inp.depthThisSession > 0) {
    // PASS ⇒ frontier found: teach the composition edge up and STOP (KST outer
    // fringe = the first passed probe).
    if (inp.consecutiveMisses === 0) {
      return { kind: "teach-link", atTopicKey: inp.topicKey };
    }
    // FAIL ⇒ recurse one edge further down, unless we've hit the floor or cap.
    if (node.floor) return { kind: "floor-teach", atTopicKey: inp.topicKey };
    if (inp.depthThisSession >= DEPTH_CAP) {
      return { kind: "teach-link", atTopicKey: inp.topicKey };
    }
    return descendAction(node, inp);
  }

  // --- At the ORIGIN node (STEP A/B) ---------------------------------------
  // Part B override — a failed LOW-CONFIDENCE (diagnostic-seeded) unlock is a
  // confirmed prerequisite gap: descend to the ~0.85 prereq now (floors teach).
  if (inp.forceDescend) {
    if (node.floor) return { kind: "floor-teach", atTopicKey: inp.topicKey };
    return descendAction(node, inp);
  }

  // STEP A — Kapur: don't remediate the first stumble; keep easing in place.
  if (inp.consecutiveMisses < BOTTOM_OUT_MISSES) {
    return {
      kind: "retry-in-place",
      tier: probeTierFor(inp.theta, inp.topicKey, {}),
    };
  }

  // STEP B — bottomed out? Only leave the node when BOTH hold: ≥2 misses at the
  // floor tier AND predicted success at the easiest tier < 0.50. Otherwise keep
  // easing within the node.
  const pIntro = predictSuccess(inp.theta, seedTierDifficulty("intro"));
  const bottomedOut =
    inp.consecutiveMisses >= BOTTOM_OUT_MISSES &&
    inp.atFloorTier &&
    pIntro < BOTTOM_OUT_PMAX;
  if (!bottomedOut) {
    return {
      kind: "retry-in-place",
      tier: probeTierFor(inp.theta, inp.topicKey, {}),
    };
  }

  // We want to leave the node downward. Floor ⇒ teach here (Vygotsky).
  if (node.floor) return { kind: "floor-teach", atTopicKey: inp.topicKey };

  // STEP C/D — choose the implicated edge and descend, probing at ~85%.
  return descendAction(node, inp);
}

/** Build a `descend` action (or `floor-teach` at a safety dead end). */
function descendAction(
  node: PrereqNode,
  inp: RemediationInput,
): RemediationAction {
  const target = descentTarget(node, inp.misconceptionTag);
  if (!target) {
    // A non-floor dead end shouldn't exist (prereqDAG.test guards this), but be
    // safe: if we cannot descend, teach here as if at a floor.
    return { kind: "floor-teach", atTopicKey: inp.topicKey };
  }
  return {
    kind: "descend",
    toTopicKey: target,
    probeTier: probeTierFor(inp.theta, target, {}),
  };
}

/**
 * The descent target used by {@link remediationStep} (which has no mastery
 * snapshot): the misconception-implicated prereq when it is an edge of `node`,
 * else the first-listed prerequisite (deterministic). Callers that DO hold a
 * mastery snapshot should prefer {@link chooseDescentEdge} for the
 * lowest-mastery fallback.
 */
function descentTarget(
  node: PrereqNode,
  misconceptionTag: string | undefined,
): string | undefined {
  if (misconceptionTag) {
    const implicated = MISCONCEPTION_EDGE[misconceptionTag];
    if (implicated && node.prereqs.includes(implicated)) return implicated;
  }
  return node.prereqs[0];
}
