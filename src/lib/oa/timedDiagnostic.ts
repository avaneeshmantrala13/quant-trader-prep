/**
 * lib/oa/timedDiagnostic.ts — question SELECTION + SCORING for the guided
 * pipeline's TIMED DIAGNOSTIC (Stage 3; GUIDED_PIPELINE_PLAN.md §2, §3.3 metric
 * (b), §3.6 0.90 gate, §10 decision #10 attribution).
 *
 * WHAT THIS OWNS (and why it is its own module):
 *  - The hard, MULTI-topic item bank for the timed diagnostic, drawn from the
 *    EXISTING hard generators/verifiers (`hardContent/generators.ts`, built on
 *    the exact `hardContent/solvers.ts`) — every item is correct-by-construction
 *    and each is TAGGED to a real KST topic node (`SKILL_GRAPH`) so the per-topic
 *    timed tally (metric b) attributes precisely (decision #10).
 *  - A DETERMINISTIC, reload-proof draw: `drawTimedDiagnostic(seed, count)` and
 *    the plan-only `selectTimedDiagnosticPlan(seed, count)` reproduce the exact
 *    same (family → topicKey) order from `seed` alone, so the topic tags can be
 *    RECOVERED after a reload from the persisted session's question ids
 *    (`topicKeysForSession`) without storing any extra shape.
 *  - Per-topic scoring + the 0.90 section gate, where the threshold is a
 *    PARAMETER (default {@link TIMED_GATE} = 0.90) fed to `meetsMasteryGate` — so
 *    this raises the timed bar to 0.90 WITHOUT ever touching the global 0.80
 *    content-mastery bar (`MASTERY_BAR`, unchanged).
 *
 * The timer engine itself is NOT re-implemented here: the diagnostic runs on the
 * shared `section`-kind `TIMED_DIAGNOSTIC_FORMAT` (config.ts) through the exact
 * reload-proof `timedSession.ts` engine (absolute `deadlineTs`, persisted via
 * `progress.oaTimed`), so a reload never resets the clock and it auto-submits at
 * 0:00 like every other section format.
 */
import { Rng } from "@/lib/rng";
import { meetsMasteryGate, roundScore } from "@/lib/score";
import { TIMED_GATE } from "@/lib/pipeline/gates";
import { skillByKey, skillKeySet } from "@/lib/roadmap/skillGraph";
import type { PipelineState, TimedSectionResult } from "@/types/progress";
import { HARD_OA_BUILDERS } from "./hardContent/generators";
import { topicForHardFamily } from "./hardContent/attribution";
import { toOaQuestion } from "./questionPool";
import { isCorrect } from "./scoring";
import type { OaQuestion, OaSessionState } from "./types";

/* -------------------------------------------------------------------------- */
/*  Topic-tagged hard-archetype plan (attribution, decision #10)              */
/* -------------------------------------------------------------------------- */

/** One entry in the timed-diagnostic plan: a hard generator family + its topic. */
export interface TimedPlanEntry {
  /** Key into {@link HARD_OA_BUILDERS} (a stable hard-archetype `family` id). */
  family: string;
  /** The KST topicKey this archetype attributes to (a real `SKILL_GRAPH` node). */
  topicKey: string;
}

/**
 * The ORDERED hard-archetype families the timed diagnostic draws from. Spans
 * random walks/Markov, expectation, EV-decision/optimal-stopping, market-making
 * / pricing games, Bayes, order statistics, and bet sizing so the diagnostic is
 * genuinely multi-topic.
 */
const TIMED_DIAGNOSTIC_FAMILIES: readonly string[] = [
  "hardPathIntersect",
  "hardRuinDuration",
  "hardPatternWait",
  "hardGraphHitting",
  "hardStepLanding",
  "hardCycleMeeting",
  "hardResetCollector",
  "hardOneReroll",
  "hardSecretary",
  "hardInformedLift",
  "hardHiddenComposition",
  "hardCoinBias",
  "hardDiceOrderStat",
  "hardKelly",
  "hardDeVig",
  "hardNextCard",
  "hardBasketNav",
  "hardMakeMarket",
] as const;

/**
 * THE topic-tagged plan: each hard family mapped to the scored KST node it tests
 * via the CANONICAL {@link topicForHardFamily} map — the SAME source of truth the
 * untimed blueprint's hard-ceiling adapters consume (M5 unification), so a
 * family attributes to ONE node regardless of which diagnostic serves it. Each
 * `topicKey` is a real `SKILL_GRAPH` node — asserted in the tests so a mistyped
 * tag can never orphan a mastery update.
 */
export const TIMED_DIAGNOSTIC_PLAN: readonly TimedPlanEntry[] =
  TIMED_DIAGNOSTIC_FAMILIES.map((family) => ({
    family,
    topicKey: topicForHardFamily(family),
  }));

/** The distinct topic nodes the diagnostic can draw from (audit / tests). */
export function timedDiagnosticTopics(): string[] {
  return [...new Set(TIMED_DIAGNOSTIC_PLAN.map((e) => e.topicKey))];
}

/* -------------------------------------------------------------------------- */
/*  Deterministic, reload-recoverable draw                                    */
/* -------------------------------------------------------------------------- */

/** Stable id prefix so the seed (hence the topic tags) is recoverable on reload. */
const ID_PREFIX = "timed-diag";

/** Build a question's unique, seed-encoding id: `timed-diag-<seed>-<i>`. */
function idFor(seed: number, i: number): string {
  return `${ID_PREFIX}-${seed}-${i}`;
}

/** Parse the seed back out of a `timed-diag-<seed>-<i>` id (or null if it isn't one). */
export function parseTimedDiagnosticSeed(id: string | undefined): number | null {
  if (!id) return null;
  const m = /^timed-diag-(\d+)-\d+$/.exec(id);
  return m ? Number(m[1]) : null;
}

/**
 * The plan SELECTION only (no question generation): shuffle the plan with a
 * dedicated `Rng(seed)` and cycle it to `count` entries. Self-contained and
 * deterministic from `(seed, count)` ALONE, so it can reproduce the per-index
 * topic tags after a reload without regenerating (or depending on) the
 * questions. Empty plan ⇒ empty out.
 */
export function selectTimedDiagnosticPlan(
  seed: number,
  count: number,
): TimedPlanEntry[] {
  if (TIMED_DIAGNOSTIC_PLAN.length === 0) return [];
  const rng = new Rng(seed);
  const shuffled = rng.shuffle(TIMED_DIAGNOSTIC_PLAN);
  const out: TimedPlanEntry[] = [];
  for (let i = 0; i < Math.max(0, count); i++) {
    out.push(shuffled[i % shuffled.length]);
  }
  return out;
}

/** A drawn timed-diagnostic set: the questions + their parallel topic tags. */
export interface TimedDiagnosticDraw {
  questions: OaQuestion[];
  /** `topicKeys[i]` is the KST node `questions[i]` attributes to. */
  topicKeys: string[];
}

/**
 * Deterministically draw `count` hard, topic-tagged questions from `seed`. Same
 * `(seed, count)` ⇒ identical questions (ids, prompts, correctIndex) AND
 * identical topic tags. The plan (tags) comes from {@link selectTimedDiagnosticPlan};
 * the questions are materialized from each entry's exact hard builder with a
 * SEPARATE `Rng(seed)`, so the tags are recoverable independently of generation.
 * Ids encode the seed (`timed-diag-<seed>-<i>`) so a reloaded session can
 * recover its tags via {@link topicKeysForSession}.
 */
/** Bounded redraw attempts before accepting a family cannot render a novel prompt. */
const TIMED_DEDUP_ATTEMPTS = 12;

/** Normalize a rendered prompt for exact-duplicate comparison (whitespace-insensitive). */
function normalizePrompt(p: string): string {
  return p.trim().replace(/\s+/g, " ");
}

export function drawTimedDiagnostic(
  seed: number,
  count: number,
): TimedDiagnosticDraw {
  const plan = selectTimedDiagnosticPlan(seed, count);
  const rng = new Rng(seed);
  // M7 exact-duplicate guard: within one draw, no two items may render the SAME
  // prompt (the parameter-free / small-space families used to repeat verbatim
  // when the plan cycled). On a collision, redraw the SAME family from a
  // deterministic perturbed sub-seed until the rendered prompt is novel (bounded
  // attempts). The item id stays index-encoded (`timed-diag-<seed>-<i>`), so the
  // reload-recoverable topic tags are unaffected, and the draw stays fully
  // deterministic in (seed, count).
  const seenPrompts = new Set<string>();
  const questions = plan.map((entry, i) => {
    let built = HARD_OA_BUILDERS[entry.family](rng);
    let attempt = 0;
    while (
      seenPrompts.has(normalizePrompt(built.question.prompt)) &&
      attempt < TIMED_DEDUP_ATTEMPTS
    ) {
      attempt += 1;
      const sub = new Rng((seed * 2654435761 + (i + 1) * 40503 + attempt * 97) >>> 0);
      built = HARD_OA_BUILDERS[entry.family](sub);
    }
    seenPrompts.add(normalizePrompt(built.question.prompt));
    return toOaQuestion(built.question, idFor(seed, i));
  });
  return { questions, topicKeys: plan.map((e) => e.topicKey) };
}

/**
 * Recover the per-question topic tags for a (running or finished) timed-diagnostic
 * session — the reload-proof bridge that lets scoring attribute per topic without
 * persisting any extra shape. Parses the seed from the session's first question
 * id and reproduces the deterministic plan; falls back to a repeated `""` tag if
 * the id isn't a timed-diagnostic id (defensive — never throws).
 */
export function topicKeysForSession(session: OaSessionState): string[] {
  const seed = parseTimedDiagnosticSeed(session.questions[0]?.id);
  if (seed == null) return session.questions.map(() => "");
  return selectTimedDiagnosticPlan(seed, session.questions.length).map(
    (e) => e.topicKey,
  );
}

/* -------------------------------------------------------------------------- */
/*  Per-topic scoring + the 0.90 section gate (threshold as a PARAMETER)       */
/* -------------------------------------------------------------------------- */

/** The `progress.pipeline.timed` payload shape (spec §3.4). */
export type TimedDiagnosticResult = NonNullable<PipelineState["timed"]>;

/** One topic's raw timed tally over the diagnostic (metric b). */
export interface TimedTopicTally {
  topicKey: string;
  correct: number;
  total: number;
}

/**
 * Group a finished session's answers by topic (using the parallel `topicKeys`)
 * into per-topic {correct,total} tallies, in first-seen topic order. A question
 * counts toward its topic's `total` regardless of whether it was answered;
 * `correct` uses the SAME `scoring.isCorrect` the report uses (unanswered ⇒
 * wrong), so accuracy = correct/total reflects speed-of-correct-thinking.
 */
export function timedTopicTallies(
  session: OaSessionState,
  topicKeys: string[],
): TimedTopicTally[] {
  const order: string[] = [];
  const byKey = new Map<string, TimedTopicTally>();
  const n = Math.min(session.questions.length, topicKeys.length);
  for (let i = 0; i < n; i++) {
    const key = topicKeys[i];
    let tally = byKey.get(key);
    if (!tally) {
      tally = { topicKey: key, correct: 0, total: 0 };
      byKey.set(key, tally);
      order.push(key);
    }
    tally.total += 1;
    const answer = session.answers[i];
    if (answer && isCorrect(session.questions[i], answer)) tally.correct += 1;
  }
  return order.map((k) => byKey.get(k) as TimedTopicTally);
}

/**
 * Build the `progress.pipeline.timed` result from a finished session + its topic
 * tags: ONE {@link TimedSectionResult} PER topic (metric-b per-topic timed tally,
 * decision #10), each labelled with the topic's human name, plus the overall
 * {correct,total} = the sum across sections. Written verbatim to
 * `progress.pipeline.timed` by the stage (via `onComplete`).
 */
export function buildTimedResult(
  session: OaSessionState,
  topicKeys: string[],
  at: string = new Date().toISOString(),
): TimedDiagnosticResult {
  const tallies = timedTopicTallies(session, topicKeys);
  const sections: TimedSectionResult[] = tallies.map((t) => ({
    label: skillByKey(t.topicKey)?.label ?? t.topicKey,
    correct: t.correct,
    total: t.total,
    topicKeys: [t.topicKey],
    at,
  }));
  const correct = sections.reduce((s, x) => s + x.correct, 0);
  const total = sections.reduce((s, x) => s + x.total, 0);
  return { correct, total, sections };
}

/**
 * Whether ONE timed section clears the gate: `meetsMasteryGate(sectionScore,
 * threshold)` with `sectionScore = correct/total`. `threshold` is a PARAMETER
 * (default {@link TIMED_GATE} = 0.90) — this is the ONLY place the timed bar is
 * chosen, and it is deliberately NOT the global 0.80 content bar (`MASTERY_BAR`
 * is never read or changed here).
 */
export function timedSectionPasses(
  section: { correct: number; total: number },
  threshold: number = TIMED_GATE,
): boolean {
  return meetsMasteryGate(roundScore(section.correct, section.total), threshold);
}

/**
 * Whether EVERY recorded section clears `threshold` (default 0.90). Mirrors the
 * P6 `allTimedSectionsClear` semantics on the freshly-built result. No sections
 * ⇒ not cleared.
 */
export function allTimedSectionsPass(
  result: TimedDiagnosticResult,
  threshold: number = TIMED_GATE,
): boolean {
  return (
    result.sections.length > 0 &&
    result.sections.every((s) => timedSectionPasses(s, threshold))
  );
}

/**
 * Whether the OVERALL timed diagnostic (all questions pooled) clears `threshold`
 * (default 0.90) — the aggregate "did the whole section pass" view, computed with
 * the SAME parameterized `meetsMasteryGate`.
 */
export function timedDiagnosticPasses(
  result: TimedDiagnosticResult,
  threshold: number = TIMED_GATE,
): boolean {
  return timedSectionPasses(
    { correct: result.correct, total: result.total },
    threshold,
  );
}

/** Re-export the distinct scored topic set for callers/tests (validity checks). */
export function timedDiagnosticTopicKeySet(): Set<string> {
  return skillKeySet();
}
