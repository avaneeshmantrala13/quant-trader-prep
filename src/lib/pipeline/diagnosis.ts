import type { UserProgress } from "@/types/progress";
import { deriveVerdict } from "@/lib/mastery/verdict";
import { prereqClosure } from "@/lib/mastery/unlockGraph";
import { skillByKey } from "@/lib/roadmap/skillGraph";
import {
  COMPETENCY_BRAINTEASER,
  TIMED_GATE,
  TRADING_SUBTOPIC_KEYS,
  brainteaserReasoningMastered,
  nodeContentMastered,
  passesDrillingGate,
  scoredContentTopicKeys,
  tradingIntuitionMastered,
} from "./gates";
import { tradingSubtopicByKey } from "@/lib/mastery/tradingSubtopics";

/**
 * ============================================================================
 *  STAGE 5 — BACKEND DIAGNOSIS  (guided pipeline, Phase P6)
 * ============================================================================
 *
 * PURE + deterministic ranking of the learner across the FOUR metrics
 * (GUIDED_PIPELINE_PLAN.md §3 / §4), read entirely off a LIVE `UserProgress`:
 *
 *   (a) CONTENT      — per-topic KST mastery: the EXISTING Beta verdict
 *                      (`deriveVerdict(...).mastered`, i.e. CI_low ≥ 0.80) for
 *                      each scored `SKILL_GRAPH` node (`scoredContentTopicKeys`).
 *   (b) TIMED        — per-topic timed accuracy from
 *                      `progress.pipeline.timed.sections` (metric b), gated at
 *                      ≥ 0.90 (`TIMED_GATE`).
 *   (c) BRAINTEASER  — the `competency::brainteaser-reasoning` node's Beta verdict.
 *   (d) TRADING      — the `competency::trading-intuition` node's Beta verdict.
 *
 * It produces a WEAKEST→STRONGEST ordering across all four metrics plus a
 * concrete, prerequisite-respecting DRILL PLAN (which topics to drill, in what
 * order). Nothing here mutates progress or re-implements mastery math — it only
 * READS the existing gate + verdict primitives, so the report and the drilling
 * loop (`drilling.ts`) share one source of truth.
 */

/** Which of the four metrics a weakness/drill entry belongs to (spec §3). */
export type DiagnosisMetric = "content" | "timed" | "brainteaser" | "trading";

/**
 * One node's standing on ONE metric. `strength ∈ [0,1]` is higher-is-stronger,
 * so a weakest→strongest view sorts by `strength` ASCENDING. For content /
 * competency metrics the strength is the Beta CI_low (the SAME quantity the
 * 0.80 gate reads); for the timed metric it is the topic's timed accuracy
 * (`correct/total`, gated at 0.90).
 */
export interface MetricWeakness {
  /** topicKey (content / timed) or competency-node key (brainteaser / trading). */
  key: string;
  /** Learner-facing label (from `SKILL_GRAPH`, falling back to the key). */
  label: string;
  metric: DiagnosisMetric;
  /** Higher = stronger. Weakest-first = ascending. */
  strength: number;
  /** Whether this node clears its bar (content/competency 0.80; timed 0.90). */
  mastered: boolean;
  /** Beta mean (content/competency) or accuracy (timed) — for the report. */
  mean: number;
  /** Beta CI_low (content/competency only; undefined for timed). */
  lo?: number;
  /** Graded evidence count: Beta n (content/competency) or timed total. */
  n: number;
}

/** One ordered step of the drill plan (weakest-first, prereq-respecting). */
export interface DrillPlanEntry {
  key: string;
  label: string;
  metric: DiagnosisMetric;
  /** Why this entry is queued (weak content / timed-weak / competency). */
  reason: string;
  /** The node's strength ∈ [0,1] at plan time (higher = stronger). */
  strength: number;
}

/** THE Stage-5 diagnosis: ranked weaknesses across all metrics + a drill plan. */
export interface Diagnosis {
  /** Every metric's weakness, one combined list, weakest→strongest. */
  ranked: MetricWeakness[];
  /** Per-metric grouped views (each already weakest-first). */
  content: MetricWeakness[];
  timed: MetricWeakness[];
  /** Brainteaser-reasoning + trading-intuition competencies (weakest-first). */
  competencies: MetricWeakness[];
  /** The ordered drill plan the loop consumes (weakest-first, prereq-safe). */
  plan: DrillPlanEntry[];
  /** True ⇔ `passesDrillingGate` — nothing left to drill. */
  cleared: boolean;
}

/* -------------------------------------------------------------------------- */
/*  Per-metric weakness extraction                                            */
/* -------------------------------------------------------------------------- */

function labelFor(key: string): string {
  return skillByKey(key)?.label ?? key;
}

/**
 * (a) CONTENT weaknesses — one entry per scored KST node, ranked by the Beta
 * CI_low (the quantity the 0.80 gate reads). An absent bucket ⇒ n=0 ⇒ the wide
 * prior CI_low, so untouched topics correctly sort as very weak.
 */
export function contentWeaknesses(progress: UserProgress): MetricWeakness[] {
  return scoredContentTopicKeys()
    .map((key) => {
      const v = deriveVerdict(progress.topicMastery?.[key], key);
      return {
        key,
        label: labelFor(key),
        metric: "content" as const,
        strength: v.lo,
        mastered: v.mastered,
        mean: v.mean,
        lo: v.lo,
        n: v.n,
      } satisfies MetricWeakness;
    })
    .sort(byStrength);
}

/** One topic's aggregated timed tally across `pipeline.timed.sections`. */
interface TimedTopicTally {
  topicKey: string;
  correct: number;
  total: number;
}

/**
 * Aggregate `pipeline.timed.sections` into per-topic {correct,total} tallies.
 * A section without explicit `topicKeys` is attributed to its `label` so no
 * evidence is silently dropped; sections spanning several topics credit each.
 */
export function timedTopicTallies(progress: UserProgress): TimedTopicTally[] {
  const sections = progress.pipeline?.timed?.sections ?? [];
  const order: string[] = [];
  const byKey = new Map<string, TimedTopicTally>();
  for (const s of sections) {
    const keys = s.topicKeys && s.topicKeys.length > 0 ? s.topicKeys : [s.label];
    for (const key of keys) {
      let tally = byKey.get(key);
      if (!tally) {
        tally = { topicKey: key, correct: 0, total: 0 };
        byKey.set(key, tally);
        order.push(key);
      }
      tally.correct += s.correct;
      tally.total += s.total;
    }
  }
  return order.map((k) => byKey.get(k) as TimedTopicTally);
}

/**
 * (b) TIMED weaknesses — one entry per topic with timed evidence, ranked by the
 * timed accuracy (`correct/total`, gated at {@link TIMED_GATE} = 0.90).
 */
export function timedWeaknesses(progress: UserProgress): MetricWeakness[] {
  return timedTopicTallies(progress)
    .filter((t) => t.total > 0)
    .map((t) => {
      const acc = t.correct / t.total;
      return {
        key: t.topicKey,
        label: labelFor(t.topicKey),
        metric: "timed" as const,
        strength: acc,
        mastered: acc >= TIMED_GATE,
        mean: acc,
        n: t.total,
      } satisfies MetricWeakness;
    })
    .sort(byStrength);
}

/** One competency node's weakness entry (Beta CI_low strength, 0.80 bar). */
function competencyWeakness(
  progress: UserProgress,
  key: string,
  metric: "brainteaser" | "trading",
): MetricWeakness {
  const v = deriveVerdict(progress.topicMastery?.[key], key);
  return {
    key,
    label: labelFor(key),
    metric,
    strength: v.lo,
    mastered: v.mastered,
    mean: v.mean,
    lo: v.lo,
    n: v.n,
  };
}

/**
 * (c)+(d) The competency weaknesses, weakest-first: the brainteaser-reasoning
 * node PLUS one entry per trading-intuition SUBTOPIC (spread-setting, inventory
 * management, conditional pricing, card counting/Kelly, arbitrage/de-vig,
 * estimation, sequence patterns, rapid EV, attention, modular arithmetic, mental
 * rotation). Each trading subtopic carries the `"trading"` metric and its own
 * node key, so `buildDrillPlan` queues a weak subtopic individually and the
 * drilling loop routes it back to that exact game.
 */
export function competencyWeaknesses(progress: UserProgress): MetricWeakness[] {
  return [
    competencyWeakness(progress, COMPETENCY_BRAINTEASER, "brainteaser"),
    ...TRADING_SUBTOPIC_KEYS.map((key) =>
      competencyWeakness(progress, key, "trading"),
    ),
  ].sort(byStrength);
}

/** Deterministic weakest-first comparator: strength asc, then key asc. */
function byStrength(a: MetricWeakness, b: MetricWeakness): number {
  if (a.strength !== b.strength) return a.strength - b.strength;
  return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
}

/* -------------------------------------------------------------------------- */
/*  Drill plan (weakest-first, prerequisite-respecting)                       */
/* -------------------------------------------------------------------------- */

/**
 * Order unmastered CONTENT weaknesses weakest-first BUT never place a node
 * before an (also-unmastered, in-plan) prerequisite — spec §4.3. A Kahn-style
 * selection: repeatedly emit the WEAKEST node all of whose in-plan transitive
 * prereqs are already emitted. Deterministic (strength then key tie-break); a
 * (theoretically impossible) cycle degrades gracefully to pure weakest-first.
 */
export function orderContentDrillTargets(
  unmastered: MetricWeakness[],
): MetricWeakness[] {
  const inPlan = new Set(unmastered.map((w) => w.key));
  const closureOf = new Map<string, Set<string>>(
    unmastered.map((w) => [w.key, prereqClosure(w.key)]),
  );
  const emitted = new Set<string>();
  const out: MetricWeakness[] = [];
  const remaining = [...unmastered];
  while (remaining.length > 0) {
    const readyIdx = remaining.findIndex((w) => {
      const closure = closureOf.get(w.key) ?? new Set<string>();
      for (const p of closure) {
        if (inPlan.has(p) && !emitted.has(p)) return false;
      }
      return true;
    });
    // No ready node (only possible under an unexpected cycle) ⇒ take the weakest
    // remaining so we always make progress.
    const idx = readyIdx === -1 ? 0 : readyIdx;
    const [picked] = remaining.splice(idx, 1);
    emitted.add(picked.key);
    out.push(picked);
  }
  return out;
}

/**
 * Build the ordered DRILL PLAN (spec §4.3): unmastered content nodes first
 * (weakest-first, prereq-respecting), then the unmastered competencies
 * (weakest-first), then any timed-weak topic NOT already queued as content —
 * an overlay re-drill so a topic that is content-mastered but slow under the
 * clock still gets routed.
 */
export function buildDrillPlan(progress: UserProgress): DrillPlanEntry[] {
  const plan: DrillPlanEntry[] = [];
  const queued = new Set<string>();

  const unmasteredContent = contentWeaknesses(progress).filter((w) => !w.mastered);
  for (const w of orderContentDrillTargets(unmasteredContent)) {
    plan.push({
      key: w.key,
      label: w.label,
      metric: "content",
      reason: "Content mastery below the 0.80 bar",
      strength: w.strength,
    });
    queued.add(w.key);
  }

  for (const w of competencyWeaknesses(progress).filter((c) => !c.mastered)) {
    const sub = tradingSubtopicByKey(w.key);
    plan.push({
      key: w.key,
      label: w.label,
      metric: w.metric,
      reason:
        w.metric === "brainteaser"
          ? "Brainteaser-reasoning competency not yet mastered"
          : sub
            ? `Trading subtopic "${sub.label}" below the 0.80 bar — re-drill the ${sub.gameId} game`
            : "Trading-intuition competency not yet mastered",
      strength: w.strength,
    });
    queued.add(w.key);
  }

  for (const w of timedWeaknesses(progress).filter((t) => !t.mastered)) {
    if (queued.has(w.key)) continue;
    plan.push({
      key: w.key,
      label: w.label,
      metric: "timed",
      reason: "Timed accuracy below the 0.90 bar",
      strength: w.strength,
    });
    queued.add(w.key);
  }

  return plan;
}

/* -------------------------------------------------------------------------- */
/*  The whole diagnosis                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Compute the full Stage-5 diagnosis from live progress: the four per-metric
 * weakness lists, one combined weakest→strongest ranking, and the ordered drill
 * plan. `cleared` mirrors {@link passesDrillingGate}.
 */
export function computeDiagnosis(progress: UserProgress): Diagnosis {
  const content = contentWeaknesses(progress);
  const timed = timedWeaknesses(progress);
  const competencies = competencyWeaknesses(progress);
  const ranked = [...content, ...timed, ...competencies].sort(byStrength);
  return {
    ranked,
    content,
    timed,
    competencies,
    plan: buildDrillPlan(progress),
    cleared: passesDrillingGate(progress),
  };
}

/** Re-exports for callers/tests that want the underlying gate helpers. */
export {
  nodeContentMastered,
  brainteaserReasoningMastered,
  tradingIntuitionMastered,
  scoredContentTopicKeys,
};
