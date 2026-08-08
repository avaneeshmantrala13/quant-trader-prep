import type { ItemAttempt } from "@/types/mastery";
import type { UserProgress } from "@/types/progress";
import { creditForEpisode, type HintRungReached } from "@/lib/tutor/creditSchedule";
import { resolveNumericMisconceptionKeys } from "@/lib/tutor/misconception";
import {
  brainteaserCredit,
  COMPETENCY_BRAINTEASER,
} from "@/lib/mastery/competency";
import {
  TRADING_SUBTOPIC_KEYS,
  tradingSubtopicByKey,
} from "@/lib/mastery/tradingSubtopics";
import {
  materializeUntimedItem,
  type MaterializedBrainteaserItem,
  type MaterializedNumericItem,
} from "@/lib/diagnostic/untimedRun";
import { flashcardSignature, numericSignature } from "@/lib/regenerate";
import {
  UNTIMED_BLUEPRINT,
  type UntimedItem,
} from "@/content/diagnostic/untimedBlueprint";
import {
  allTimedSectionsClear,
  brainteaserReasoningMastered,
  nodeContentMastered,
  passesDrillingGate,
  scoredContentTopicKeys,
  tradingIntuitionMastered,
  tradingSubtopicMastered,
} from "./gates";
import { buildDrillPlan, type DiagnosisMetric } from "./diagnosis";

/**
 * ============================================================================
 *  STAGE 6 — DRILLING LOOP orchestration  (guided pipeline, Phase P6)
 * ============================================================================
 *
 * PURE + deterministic. This module decides WHAT to drill next and HOW to serve
 * it, REUSING the existing engines end-to-end — the Stage-5 diagnosis
 * (`diagnosis.ts`), the untimed-diagnostic item bank + materializer
 * (`@/content/diagnostic/untimedBlueprint`, `@/lib/diagnostic/untimedRun`), the
 * answer-withholding hint ladder's credit schedule (`@/lib/tutor/creditSchedule`),
 * the misconception attribution (`@/lib/tutor/misconception`), and the P2
 * competency scorer (`@/lib/mastery/competency`). It rebuilds NONE of them.
 *
 * The loop is "done" EXACTLY when `passesDrillingGate(progress)` is true
 * (every scored content node ≥ 0.80 + timed sections ≥ 0.90 + both
 * competencies mastered). {@link pickNextDrillTarget} therefore returns `null`
 * IFF that gate holds — so the stage advances precisely then.
 *
 * ── HINT-CREDIT REDUCTION (spec decision) ───────────────────────────────────
 * A drilled content item is graded through the SAME hint-episode credit
 * schedule as a lesson: {@link buildContentDrillAttempt} sets the `ItemAttempt`'s
 * `credit = creditForEpisode(correct, highestRung)`, which decays with the
 * highest rung used (1.0 no-hint → 0.04 after the full reveal). Because
 * `recordItemAttempt` folds that fractional credit into the Beta posterior, a
 * hinted correct answer moves mastery LESS than an unhinted one — so mastery
 * must be earned with progressively less help. (`drilling.test.ts` locks this.)
 */

/** Items served per drill round (matches the lesson round size). */
export const DRILL_ROUND_SIZE = 5;

/** How the drilling stage should SERVE a target's items. */
export type DrillServe =
  | "numeric" // content hint-ladder free-response items
  | "brainteaser" // competency flashcards (hybrid grading)
  | "trading" // make-a-market rounds
  | "timed-info"; // no per-topic route left; a strict timed section is owed

/** THE next thing to drill (or a residual timed-overlay signal). */
export interface DrillTarget {
  kind: DiagnosisMetric;
  /** How the stage serves it (see {@link DrillServe}). */
  serve: DrillServe;
  /** The KST node to drill (null only for the residual `timed-info` case). */
  topicKey: string | null;
  label: string;
  reason: string;
}

/* -------------------------------------------------------------------------- */
/*  Next-target selection (weakest-first)                                     */
/* -------------------------------------------------------------------------- */

/**
 * Map the metric of a drill-plan entry to how the stage serves it: content /
 * timed-weak topics are re-drilled through the numeric hint-ladder path (which
 * also folds into content mastery); the competencies route to flashcards / MM.
 */
function serveFor(metric: DiagnosisMetric): DrillServe {
  switch (metric) {
    case "brainteaser":
      return "brainteaser";
    case "trading":
      return "trading";
    case "content":
    case "timed":
      return "numeric";
  }
}

/**
 * Pick the NEXT drill target, weakest-first, or `null` when the whole Stage-6
 * gate holds. Order (spec §2 / §4): the weakest unmastered content node
 * (prerequisite-respecting via the plan) → the weakest unmastered competency →
 * any timed-weak topic re-drill. When the gate is NOT met yet but the plan is
 * empty (e.g. the timed overlay is owed but no per-topic timed weakness is
 * recorded), a residual `timed-info` target is returned so the loop never
 * FALSELY completes — `null` is reserved strictly for "gate passed".
 */
export function pickNextDrillTarget(progress: UserProgress): DrillTarget | null {
  if (passesDrillingGate(progress)) return null;
  const plan = buildDrillPlan(progress);
  const head = plan[0];
  if (head) {
    return {
      kind: head.metric,
      serve: serveFor(head.metric),
      topicKey: head.key,
      label: head.label,
      reason: head.reason,
    };
  }
  // Gate not met + empty plan ⇒ only the timed section overlay remains and there
  // is no per-topic weakness to route it to. Surface it explicitly.
  return {
    kind: "timed",
    serve: "timed-info",
    topicKey: null,
    label: "Strict timed section",
    reason: "A timed multi-topic section (≥ 90%) is still required",
  };
}

/* -------------------------------------------------------------------------- */
/*  Item drawing (reuses the untimed-diagnostic bank + materializer)          */
/* -------------------------------------------------------------------------- */

/** Distinct sub-seed per drawn item so a round is fresh yet reproducible. */
function drawSeed(seed: number, i: number): number {
  return (seed + i * 6151 + 17) >>> 0;
}

/**
 * The STABLE content signature of a drawn content item (normalized prompt +
 * exact answer). Two draws collide IFF the learner would perceive the SAME
 * rendered question. This is the dedup key that guarantees no exact-duplicate
 * question within a drill session.
 */
export function contentSignature(item: MaterializedNumericItem): string {
  return numericSignature(item.question);
}

/** The stable content signature of a drawn brainteaser (prompt + answer). */
export function brainteaserSignature(item: MaterializedBrainteaserItem): string {
  return flashcardSignature(item.flashcard);
}

/** Reseed attempts before accepting that a family can't produce a novel draw. */
const DRAW_RESEED_CAP = 8;

/** All non-brainteaser blueprint items authored/adapted for a given topic. */
export function contentItemsForTopic(topicKey: string): UntimedItem[] {
  return UNTIMED_BLUEPRINT.filter(
    (it) => it.topicKey === topicKey && it.kind !== "brainteaser",
  );
}

/**
 * Draw one weakest-first CONTENT drill round for `topicKey`, GUARANTEEING every
 * served item is novel: no two items in the returned round share a content
 * signature, and none collides with `avoid` (the session-wide set of signatures
 * already served this drill session). Cycles the topic's blueprint items
 * (floor / ceiling / hard-adapter), materialized via the SAME
 * `materializeUntimedItem` the untimed diagnostic uses; on a collision it
 * RESEEDS the same family (parametric families draw genuinely different numbers)
 * and, if that family is a static singleton that cannot vary, rotates to the
 * next distinct blueprint item — so distinct instances are cycled before any
 * repeat rather than sampling with replacement.
 *
 * Empty ⇒ no items (a topic with no bank entry is skipped by the caller).
 * Deterministic given `seed`. Returns up to `count` items (fewer only if the
 * topic genuinely cannot produce that many distinct instances — never a repeat).
 */
export function drawContentDrill(
  topicKey: string,
  seed: number,
  count: number = DRILL_ROUND_SIZE,
  avoid?: ReadonlySet<string>,
): MaterializedNumericItem[] {
  const pool = contentItemsForTopic(topicKey);
  if (pool.length === 0) return [];
  const seen = new Set<string>(avoid);
  const out: MaterializedNumericItem[] = [];
  for (let i = 0; i < count; i++) {
    let chosen: MaterializedNumericItem | null = null;
    // Rotate the pool starting at position i so each slot prefers a different
    // family; fall through to later families when the preferred one is exhausted.
    for (let p = 0; p < pool.length && !chosen; p++) {
      const item = pool[(i + p) % pool.length];
      const isStatic = item.kind === "numeric-authored" && !item.generator;
      for (let r = 0; r < DRAW_RESEED_CAP; r++) {
        const m = materializeUntimedItem(item, drawSeed(seed, i * 131 + p * 17 + r), i);
        if (m.kind !== "numeric") break;
        const sig = contentSignature(m);
        if (!seen.has(sig)) {
          seen.add(sig);
          chosen = m;
          break;
        }
        // A static singleton can't vary on reseed — stop and try another family.
        if (isStatic) break;
      }
    }
    if (chosen) out.push(chosen);
  }
  return out;
}

/** All brainteaser blueprint items (fed into `competency::brainteaser-reasoning`). */
export function brainteaserBlueprintItems(): UntimedItem[] {
  return UNTIMED_BLUEPRINT.filter((it) => it.kind === "brainteaser");
}

/**
 * Draw one BRAINTEASER drill round (competency::brainteaser-reasoning),
 * GUARANTEEING every served card is novel: no two cards share a content
 * signature and none collides with `avoid` (the session-wide set). Cycles the
 * brainteaser families (all parametric), reseeding on a collision so each draw
 * is a genuinely different instance. Deterministic given `seed`.
 */
export function drawBrainteaserDrill(
  seed: number,
  count: number = DRILL_ROUND_SIZE,
  avoid?: ReadonlySet<string>,
): MaterializedBrainteaserItem[] {
  const pool = brainteaserBlueprintItems();
  if (pool.length === 0) return [];
  const seen = new Set<string>(avoid);
  const out: MaterializedBrainteaserItem[] = [];
  for (let i = 0; i < count; i++) {
    let chosen: MaterializedBrainteaserItem | null = null;
    for (let p = 0; p < pool.length && !chosen; p++) {
      const item = pool[(i + p) % pool.length];
      for (let r = 0; r < DRAW_RESEED_CAP; r++) {
        const m = materializeUntimedItem(item, drawSeed(seed, i * 131 + p * 17 + r), i);
        if (m.kind !== "brainteaser") break;
        const sig = brainteaserSignature(m);
        if (!seen.has(sig)) {
          seen.add(sig);
          chosen = m;
          break;
        }
      }
    }
    if (chosen) out.push(chosen);
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Attempt builders (credit-weighted; hint usage reduces mastery credit)     */
/* -------------------------------------------------------------------------- */

/** The resolved outcome of ONE free-response content drill's hint episode. */
export interface ContentDrillResult {
  correct: boolean;
  /** Highest hint rung reached before the correct answer (0 = none). */
  highestRung: HintRungReached;
  /** The learner's final entered value. */
  finalValue: number;
  /** The learner's FIRST wrong value, if any (drives misconception attribution). */
  firstWrongValue?: number;
}

/**
 * Build the `ItemAttempt` for a resolved content drill. The credit is the
 * hint-schedule credit `creditForEpisode(correct, highestRung)` — the SAME
 * credit-weighted path a lesson uses — so folding it via `recordItemAttempt`
 * gives a hinted correct answer LESS mastery than an unhinted one (spec
 * decision). Misconceptions are resolved from the first wrong value for precise
 * attribution (decision §10.10); a clean first-try solve carries none.
 */
export function buildContentDrillAttempt(
  item: MaterializedNumericItem,
  r: ContentDrillResult,
  at: string = new Date().toISOString(),
): ItemAttempt {
  const credit = creditForEpisode(r.correct, r.highestRung);
  const misconceptions =
    r.firstWrongValue != null
      ? resolveNumericMisconceptionKeys(
          item.topicKey,
          item.question,
          r.firstWrongValue,
        )
      : [];
  return {
    topicKey: item.topicKey,
    tier: item.tier,
    correct: r.correct,
    mode: "numeric",
    chosenValue: r.finalValue,
    credit,
    highestRung: r.highestRung,
    misconceptions,
    at,
  };
}

/**
 * Build the `ItemAttempt` for one brainteaser drill outcome — folded into
 * `competency::brainteaser-reasoning` via the P2 scorer's `brainteaserCredit`
 * (clean got ⇒ 1, miss ⇒ 0), through the SAME `applyItemAttempt` Beta path.
 */
export function buildBrainteaserDrillAttempt(
  got: boolean,
  at: string = new Date().toISOString(),
): ItemAttempt {
  const credit = brainteaserCredit({ got, at });
  return {
    topicKey: COMPETENCY_BRAINTEASER,
    tier: "medium",
    correct: credit >= 1,
    mode: "flashcard",
    credit,
    at,
  };
}

/**
 * A make-a-market round outcome distilled to the trading credit inputs. Trading
 * drill rounds are folded into their per-game SUBTOPIC node directly by the
 * battery station components (via `buildTradingSubtopicAttempt` in
 * `@/lib/mastery/tradingSubtopics`), so there is no MM-specific attempt builder
 * here anymore — the drilling loop simply re-mounts the weak subtopic's game.
 */

/* -------------------------------------------------------------------------- */
/*  Live gate progress (for the stage's progress panel)                       */
/* -------------------------------------------------------------------------- */

/** One trading subtopic's live mastery status (for the drilling gate panel). */
export interface TradingSubtopicStatus {
  key: string;
  label: string;
  gameId: string;
  mastered: boolean;
}

/** The four sub-gates' live status + how many content nodes remain. */
export interface DrillingProgress {
  contentMastered: number;
  contentTotal: number;
  timedClear: boolean;
  brainteaserMastered: boolean;
  /** True ⇔ EVERY trading subtopic clears its bar (the roll-up gate). */
  tradingMastered: boolean;
  /** How many trading subtopics are mastered, and the total. */
  tradingSubtopicsMastered: number;
  tradingSubtopicTotal: number;
  /** Per-subtopic breakdown, in battery order. */
  tradingSubtopics: TradingSubtopicStatus[];
  /** True ⇔ `passesDrillingGate` — the whole Stage-6 gate holds. */
  done: boolean;
}

/** Snapshot the four sub-gates from LIVE progress (relock-aware, no latching). */
export function drillingProgress(progress: UserProgress): DrillingProgress {
  const keys = scoredContentTopicKeys();
  const contentMastered = keys.filter((k) =>
    nodeContentMastered(progress, k),
  ).length;
  const tradingSubtopics: TradingSubtopicStatus[] = TRADING_SUBTOPIC_KEYS.map(
    (key) => {
      const sub = tradingSubtopicByKey(key);
      return {
        key,
        label: sub?.label ?? key,
        gameId: sub?.gameId ?? "",
        mastered: tradingSubtopicMastered(progress, key),
      };
    },
  );
  return {
    contentMastered,
    contentTotal: keys.length,
    timedClear: allTimedSectionsClear(progress),
    brainteaserMastered: brainteaserReasoningMastered(progress),
    tradingMastered: tradingIntuitionMastered(progress),
    tradingSubtopicsMastered: tradingSubtopics.filter((s) => s.mastered).length,
    tradingSubtopicTotal: tradingSubtopics.length,
    tradingSubtopics,
    done: passesDrillingGate(progress),
  };
}
