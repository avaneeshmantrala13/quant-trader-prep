import { getTrack } from "@/content";
import type { Difficulty } from "@/types/content";
import { DIFFICULTY_META, isFlashcardLevel } from "@/types/content";
import type { GlickoDifficultyMap, TierDifficultyMap } from "@/types/mastery";
import { predictSuccess, seedTierDifficulty } from "@/lib/mastery/elo";
import { probability2PL } from "@/lib/mastery/irt";
import { glickoRatingToLogit } from "@/lib/mastery/glicko";
import { thompsonSelect, type ThompsonArm } from "@/lib/mastery/thompson";
import {
  GLICKO_TRUST_RD,
  IRT_TRUST_SE,
  PROBE_EXPLORE_K,
} from "@/lib/mastery/config";
import type { Rng } from "@/lib/rng";
import { tierDifficultyKey, topicKeyForLevel } from "@/lib/mastery/topicKey";
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
  /**
   * True once the serving tier has been lowered to this node's floor tier. A
   * caller may compute this against a global intro/easy threshold; the policy
   * ADDITIONALLY treats a node whose OWN easiest authored tier is already above
   * easy (a medium-only topic) — or an {@link PrereqNode.external} drill node
   * with no in-topic ladder — as at-floor, so descent is not silently disabled
   * for the majority of advanced topics (see {@link isTopicFloorTier}).
   */
  atFloorTier: boolean;
  /** The tag the tripping misconception implicated (already stripped of the topicKey prefix). */
  misconceptionTag?: string;
  /**
   * OPTIONAL mastery snapshot for the WEAKEST-prereq descent (PHASE_4 §5 STEP C).
   * When supplied, {@link remediationStep} routes a no-misconception descent to
   * the learner's lowest-mastery relevant prerequisite via {@link chooseDescentEdge}
   * (misconception edges still take precedence). Omitted ⇒ the deterministic
   * first-listed-prereq fallback (original behavior), so every existing caller is
   * unchanged.
   */
  masteryOf?: (topicKey: string) => { mean: number; theta: number } | undefined;
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
 * Optional T12 ADAPTIVE-ENGINE inputs to {@link probeTierFor}. All are additive
 * and back-compatible: with none supplied the selector reduces EXACTLY to the
 * original guessing-free Elo argmin (the 2PL `probability2PL(θ,1,d) = σ(θ−d)` is
 * identical to `predictSuccess(θ,d)`), so every existing caller is unchanged.
 */
export interface ProbeTierAdaptiveOpts {
  /**
   * Per-(topic,tier) Glicko DIFFICULTY map. When a tier's rating is confident
   * enough (RD ≤ {@link GLICKO_TRUST_RD}) its Glicko-derived logit difficulty
   * REPLACES the frozen Elo tier difficulty for that tier — a richer, evidence-
   * weighted view of how hard the item actually is for this population.
   */
  glickoD?: GlickoDifficultyMap;
  /**
   * The learner's fitted 2PL IRT ability for this topic. When present AND
   * confident (`irtAbilitySe` ≤ {@link IRT_TRUST_SE}) it REPLACES the incremental
   * Elo `theta` as the ability the tier probabilities are computed at.
   */
  irtAbility?: number;
  /** Standard error of {@link irtAbility}; gates whether it is trusted. */
  irtAbilitySe?: number;
  /**
   * Seeded RNG. When provided, tier choice uses THOMPSON SAMPLING over the tiers
   * (each a Beta arm centred on its predicted success) with the ZPD objective —
   * principled exploration around the target band instead of a hard argmin. When
   * omitted the choice is the deterministic argmin (original behavior).
   */
  rng?: Rng;
  /** Override the target success band centre (default {@link PROBE_P} = 0.85). */
  target?: number;
}

/**
 * Probe tier = the tier whose predicted success is CLOSEST to {@link PROBE_P}
 * (0.85) for this learner/topic (Wilson 85% Rule). Ties break to the EASIER tier
 * (Vygotsky: don't overshoot the ZPD).
 *
 * The T12 adaptive engine plugs in HERE (all additive; see
 * {@link ProbeTierAdaptiveOpts}): the learner ability can come from the fitted
 * IRT `irtAbility`, each tier's difficulty can come from its confident Glicko
 * rating, the per-tier success is the 2PL `probability2PL`, and a seeded RNG
 * turns the hard argmin into Thompson-sampled ZPD exploration. With no opts the
 * function is byte-for-byte the original Elo behavior.
 */
export function probeTierFor(
  theta: number,
  topicKey: string,
  tierD: TierDifficultyMap,
  opts?: ProbeTierAdaptiveOpts,
): Difficulty {
  const target = opts?.target ?? PROBE_P;

  // IRT ability (when fitted + confident) refines the incremental Elo θ.
  const ability =
    opts?.irtAbility !== undefined &&
    (opts.irtAbilitySe ?? Infinity) <= IRT_TRUST_SE
      ? opts.irtAbility
      : theta;

  // Per-tier predicted success under the (possibly Glicko-refined) difficulty.
  const tierP = TIER_ORDER.map((tier) => {
    const glicko = opts?.glickoD?.[tierDifficultyKey(topicKey, tier)];
    const b =
      glicko && glicko.rd <= GLICKO_TRUST_RD
        ? glickoRatingToLogit(glicko.rating)
        : (tierD[tierDifficultyKey(topicKey, tier)] ?? seedTierDifficulty(tier));
    return { tier, p: probability2PL(ability, 1, b) };
  });

  // Thompson exploration: each tier is a Beta arm centred on its predicted
  // success; the ZPD objective favours the tier whose sampled success is nearest
  // the target band, so under-served tiers near the ZPD still get explored.
  if (opts?.rng) {
    const arms: ThompsonArm[] = tierP.map(({ tier, p }) => ({
      key: tier,
      alpha: 1 + PROBE_EXPLORE_K * p,
      beta: 1 + PROBE_EXPLORE_K * (1 - p),
    }));
    const choice = thompsonSelect(arms, opts.rng, { objective: "zpd", target });
    if (choice.key) return choice.key as Difficulty;
  }

  // Deterministic argmin: closest predicted success to the target band centre.
  let best: Difficulty = TIER_ORDER[0];
  let bestGap = Infinity;
  for (const { tier, p } of tierP) {
    const gap = Math.abs(p - target);
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
  //
  // "At the floor tier" is judged against the TOPIC'S OWN minimum authored tier,
  // not a global intro/easy threshold: 16 of 26 scored topics have no intro/easy
  // level at all (Conditional Expectation, Poisson, Continuous, …), so the
  // caller's `atFloorTier` is never true for them and descent used to never fire.
  // A node whose easiest tier is already above easy — or an external drill node
  // with no in-topic ladder — is treated as at-floor here so it CAN bottom out.
  const minOrder = topicMinTierOrder(node);
  const atTopicFloor =
    inp.atFloorTier ||
    minOrder === undefined ||
    minOrder > DIFFICULTY_META.easy.order;
  const pIntro = predictSuccess(inp.theta, seedTierDifficulty("intro"));
  const bottomedOut =
    inp.consecutiveMisses >= BOTTOM_OUT_MISSES &&
    atTopicFloor &&
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
  // Prefer the mastery-aware chooser when the caller supplies a mastery snapshot
  // (misconception edge first, then the learner's WEAKEST relevant prereq); fall
  // back to the deterministic first-listed prereq only when no snapshot exists.
  const target = inp.masteryOf
    ? chooseDescentEdge(node, inp.misconceptionTag, inp.masteryOf)
    : descentTarget(node, inp.misconceptionTag);
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
 * The order of the EASIEST scored (non-flashcard) tier that actually EXISTS for
 * this node's own topic, or `undefined` when the topic has no registered scored
 * level (an {@link PrereqNode.external} drill node whose content lives outside
 * the playable tracks). Used to judge "is the learner already at this topic's
 * floor tier?" against the TOPIC'S OWN minimum tier rather than a global
 * intro/easy threshold — so a medium-only topic can still bottom out and descend.
 */
function topicMinTierOrder(node: PrereqNode): number | undefined {
  if (!node.levelRef) return undefined;
  const track = getTrack(node.levelRef.trackId);
  if (!track) return undefined;
  let min: number | undefined;
  for (const level of track.levels) {
    if (isFlashcardLevel(level)) continue;
    if (topicKeyForLevel(track.id, level) !== node.topicKey) continue;
    const order = DIFFICULTY_META[level.difficulty].order;
    if (min === undefined || order < min) min = order;
  }
  return min;
}

/**
 * True when `difficulty` is at (or below) the EASIEST tier the topic actually
 * authors — i.e. the learner cannot be eased any lower WITHIN this topic, so a
 * repeated miss should bottom out and descend a prerequisite edge. A topic with
 * no registered scored level (an {@link PrereqNode.external} drill node) is
 * always "at floor" (there is no in-topic ladder). This is the correct,
 * topic-relative replacement for the caller-side `DIFFICULTY_META[d].order <= 1`
 * heuristic that silently disabled descent for every medium-only topic.
 */
export function isTopicFloorTier(
  topicKey: string,
  difficulty: Difficulty,
): boolean {
  const node = prereqNode(topicKey);
  const minOrder = node ? topicMinTierOrder(node) : undefined;
  if (minOrder === undefined) return true;
  return DIFFICULTY_META[difficulty].order <= minOrder;
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
