/**
 * lib/oa/config.ts — the DATA-DRIVEN catalog of the timed practice formats.
 * Counts, durations, and scoring live here (and nowhere else) so the feature is
 * trivially tunable. Every number is informed by the firm research
 * (`datasets/FIRM_TIMED_ASSESSMENTS.md` + `QUANT_OA_RESEARCH_CLUSTER1/2.md`) and
 * cross-checked against the OA benchmark catalog (`content/arena/oaFormats.ts`).
 *
 * The three ORIGINAL formats (Sprint / Section / Measured) are joined by four
 * research-derived, firm-INSPIRED formats (Rapid Mixed Battery, Blitz, Derivation
 * Set, Deep Set) — each modelled on a real firm's tested skills + pacing and tuned
 * a notch STRICTER than reality. All seven reuse the same pure engine + scoring
 * (no new session kinds); Derivation is a module-locked section (forward-only).
 *
 * Design defaults (see FIRM_TIMED_ASSESSMENTS.md §1, §4):
 *  - Sprint: a "Timed Probability Sprint" at ~90 s/q (§4 row 2), 12 Qs, Optiver
 *    "Beat the Odds" +1/−1/0 penalty scoring (§1 Optiver). Strict per-question
 *    clock, auto-advance, no going back — the short-brutal pacing (Five Rings
 *    ~60–80 s/q, `five-rings-20`) rounded to a clean 90 s.
 *  - Section: 30 min / 17 Qs (~105 s/q), one running section clock, free
 *    navigation, +1/0/0 (DRW/SIG — no wrong penalty), auto-submit at time up,
 *    with an optional hard-mode −1 penalty toggle. Grounded in the mixed-battery
 *    / short-brutal windows (DRW 6–8 Qs / 45–60 min; Belvedere 30–40 Qs / 60 min
 *    ≈ 100–120 s/q; SIG 20-min eval).
 *  - Measured: untimed practice; still records time-per-question so the average
 *    feeds the dashboard trend graph. Paced against the sprint 90 s/q budget so
 *    "% within budget" stays a meaningful cross-format reference.
 */
import type { OaFormatConfig, OaFormatKind, OaScoringRule } from "./types";

/** Max completed OA results retained per user (keeps the store bounded). */
export const MAX_OA_RESULTS = 100;

/** +1 correct / −1 wrong / 0 skip — Optiver "Beat the Odds" penalty scoring. */
const OPTIVER_STYLE: OaScoringRule = { correct: 1, wrong: -1, skip: 0 };
/** +1 correct / 0 wrong / 0 skip — DRW/SIG style (no wrong penalty). */
const COUNT_STYLE: OaScoringRule = { correct: 1, wrong: 0, skip: 0 };

export const SPRINT_FORMAT: OaFormatConfig = {
  id: "sprint-default",
  kind: "sprint",
  label: "Per-Question Sprint",
  blurb:
    "One question at a time on a strict ~90s clock. It auto-advances when time runs out and you can't go back — Optiver Beat-the-Odds scoring (+1 / −1 / 0).",
  questionCount: 12,
  perQuestionSec: 90,
  freeNavigation: false,
  autoAdvance: true,
  scoring: OPTIVER_STYLE,
  budgetMs: 90_000,
  oaFormatId: "five-rings-20",
  sourceNote:
    "FIRM_TIMED_ASSESSMENTS.md §4 row 2 (timed probability sprint ~90 s/q); §1 Optiver +1/−1 penalty; short-brutal pace (Five Rings).",
};

export const SECTION_FORMAT: OaFormatConfig = {
  id: "section-default",
  kind: "section",
  label: "Section Exam",
  blurb:
    "17 questions, one 30-minute section clock. Navigate freely, flag and revisit, and it auto-submits at time up. +1 correct / 0 otherwise (optional hard-mode −1 penalty).",
  questionCount: 17,
  sectionSec: 30 * 60,
  freeNavigation: true,
  autoAdvance: false,
  scoring: COUNT_STYLE,
  hardModePenalty: -1,
  // Per-question fair share = 1800s / 17 ≈ 105.9 s → ms.
  budgetMs: Math.round(((30 * 60) / 17) * 1000),
  sourceNote:
    "FIRM_TIMED_ASSESSMENTS.md §1 short-brutal / §2 mixed battery (DRW 6–8/45–60min; Belvedere 30–40/60min ≈ 100–120 s/q; SIG 20-min eval); +1/0 DRW/SIG scoring.",
};

/* -------------------------------------------------------------------------- */
/*  Research-derived, firm-INSPIRED formats (QUANT_OA_RESEARCH_CLUSTER1/2.md). */
/*  Each mirrors a firm's tested skills + pacing, tuned a notch STRICTER than   */
/*  the real screen. They reuse the same pure engine + scoring as the three     */
/*  originals (no new kinds); Derivation is a module-locked SECTION (see the     */
/*  `freeNavigation:false` ⇒ `OaSessionState.noBack` forward-only lock).        */
/* -------------------------------------------------------------------------- */

export const RAPID_BATTERY_FORMAT: OaFormatConfig = {
  id: "rapid-battery",
  kind: "sprint",
  label: "Rapid Mixed Battery",
  blurb:
    "40 rapid-fire questions on a brutal ~15s clock — mixed probability, EV, and quick-quant. It auto-advances and you can't go back. Penalty scoring (+1 / −1 / 0) rewards knowing when to skip.",
  questionCount: 40,
  perQuestionSec: 15,
  freeNavigation: false,
  autoAdvance: true,
  scoring: OPTIVER_STYLE,
  budgetMs: 15_000,
  oaFormatId: "citadel-50-12",
  firmAttribution: "Citadel-style",
  contentPool: "rapidMixed",
  sourceNote:
    "CLUSTER1 §2 / CLUSTER2 TL;DR: Citadel Sec. mixed cognitive/quant battery ≈50 Q/12 min (~14.4 s/q); made stricter to 15 s/q over 40 Q with Optiver-style +1/−1 penalty to reward calibrated skipping.",
};

export const BLITZ_FORMAT: OaFormatConfig = {
  id: "blitz",
  kind: "section",
  label: "Blitz",
  blurb:
    "20 questions on one 16-minute clock (~48s each) — probability, combinatorics, and estimation with no calculator. Navigate freely and it auto-submits at time. +1 correct / 0 otherwise.",
  questionCount: 20,
  sectionSec: 16 * 60,
  freeNavigation: true,
  autoAdvance: false,
  scoring: COUNT_STYLE,
  hardModePenalty: -1,
  // Per-question fair share = 960s / 20 = 48s → ms.
  budgetMs: Math.round(((16 * 60) / 20) * 1000),
  oaFormatId: "five-rings-20",
  firmAttribution: "Five Rings-style",
  contentPool: "blitz",
  sourceNote:
    "CLUSTER2 §4: Five Rings ~15–20 typed Q / <20 min (~60–75 s/q), no-calculator probability + combinatorics + estimation; tightened to ~48 s/q over 20 Q.",
};

export const DERIVATION_FORMAT: OaFormatConfig = {
  id: "derivation-set",
  kind: "section",
  label: "Derivation Set",
  blurb:
    "12 harder multi-step derivations on one 36-minute clock (~3 min each). Module-locked: you answer in order and can't go back, and it auto-submits at time. +1 correct / 0 otherwise.",
  questionCount: 12,
  sectionSec: 36 * 60,
  // Module-lock: no free navigation ⇒ the engine seeds `noBack` (forward-only).
  freeNavigation: false,
  autoAdvance: false,
  scoring: COUNT_STYLE,
  // Per-question fair share = 2160s / 12 = 180s → ms.
  budgetMs: Math.round(((36 * 60) / 12) * 1000),
  oaFormatId: "sig-quant-eval",
  firmAttribution: "IMC-style",
  contentPool: "derivation",
  sourceNote:
    "CLUSTER1 §5 / CLUSTER2 IMC row: IMC math module ~15 Q / ~60 min (~3–4 min/q), module-locked (no back-nav, no time carryover); tightened to ~3 min/q over 12 Q.",
};

export const DEEP_SET_FORMAT: OaFormatConfig = {
  id: "deep-set",
  kind: "section",
  label: "Deep Set",
  blurb:
    "6 deep, multi-step problems (probability, Markov chains, recursion) on one 36-minute clock (~6 min each). Navigate freely — leave the hardest one blank and still advance. +1 correct / 0 otherwise.",
  questionCount: 6,
  sectionSec: 36 * 60,
  freeNavigation: true,
  autoAdvance: false,
  scoring: COUNT_STYLE,
  // Per-question fair share = 2160s / 6 = 360s → ms.
  budgetMs: Math.round(((36 * 60) / 6) * 1000),
  oaFormatId: "drw-6-45",
  firmAttribution: "DRW-style",
  contentPool: "deepSet",
  sourceNote:
    "CLUSTER2 §3: DRW 6 Q / 45 min (~7.5 min/q), +1/0-wrong/0-skip, free navigation, probability / linear algebra / Markov chains; tightened to ~6 min/q over 6 Q. (Linear-algebra archetype not yet in the pool — see report.)",
};

export const MEASURED_FORMAT: OaFormatConfig = {
  id: "measured-default",
  kind: "measured",
  label: "Measured (Untimed)",
  blurb:
    "No time limit — think it through. We track your time per question and show your average so you can watch your speed improve over time.",
  questionCount: 12,
  freeNavigation: true,
  autoAdvance: false,
  scoring: COUNT_STYLE,
  // No clock; pace against the sprint 90 s/q reference for a comparable "% within budget".
  budgetMs: 90_000,
  sourceNote:
    "FIRM_TIMED_ASSESSMENTS.md §4 (accuracy-first practice); untimed measured mode feeds the average-time trend.",
};

/**
 * TIMED DIAGNOSTIC — guided-pipeline Stage 3 (GUIDED_PIPELINE_PLAN.md §2, §3.3
 * metric (b), §3.6 0.90 gate). 30 hard, MULTI-topic questions on ONE strict
 * 45-minute wall-clock section timer, measuring the SPEED of correct thinking.
 *
 * It is a `section` kind, so it reuses the EXACT reload-proof engine every other
 * section format uses (`timedSession.ts`: an absolute `deadlineTs` seeded at
 * creation and recomputed as `deadline − now`, persisted via `progress.oaTimed`),
 * so a reload never resets the clock and `resumeOaSession` auto-submits at 0:00.
 *
 * DELIBERATELY NOT in {@link OA_FORMATS}: it is not a user-pickable `/oa` preset.
 * The pipeline's `TimedDiagnosticStage` references this preset directly and draws
 * its own hard, topic-TAGGED items from the hard generators/verifiers via
 * `lib/oa/timedDiagnostic.ts` (so `contentPool` is intentionally omitted — the
 * default mixed pool is never used for it). Scoring records a per-topic timed
 * tally (metric b) and gates each section with `meetsMasteryGate(score, 0.90)`
 * where 0.90 is passed as a PARAMETER — it never touches the 0.80 content bar.
 */
export const TIMED_DIAGNOSTIC_FORMAT: OaFormatConfig = {
  id: "timed-diagnostic",
  kind: "section",
  label: "Timed diagnostic",
  blurb:
    "30 hard, multi-topic questions on one 45-minute wall clock. It keeps running if you leave and auto-submits at 0:00 — this measures the speed of your correct thinking. +1 correct / 0 otherwise.",
  questionCount: 30,
  sectionSec: 45 * 60,
  // Free navigation within the one running section clock (revisit/flag freely).
  freeNavigation: true,
  autoAdvance: false,
  scoring: COUNT_STYLE,
  // Per-question fair share = 2700s / 30 = 90s → ms.
  budgetMs: Math.round(((45 * 60) / 30) * 1000),
  sourceNote:
    "GUIDED_PIPELINE_PLAN.md §2 (Stage 3 UX) / §3.3 metric (b) timed performance / §3.6 (0.90 timed gate): 30 Q / 45 min strict wall-clock, hard multi-topic, speed of correct thinking. Section pass gated at ≥0.90 via meetsMasteryGate (threshold param); the 0.80 content-mastery bar is left untouched.",
};

/**
 * MENTAL-MATH SPRINT — the timed mental-arithmetic burst that runs as the FIRST
 * phase of the guided pipeline's Timed Diagnostic (Stage 3), BEFORE the 30-Q hard
 * section. It makes mental math a REAL, time-pressured, scored skill: a short
 * burst of exact-arithmetic items, each on its OWN per-question shot clock so an
 * easy add gets ~10 s while an odds→probability conversion gets ~18 s (the actual
 * budget per item comes from `MENTAL_MATH_SPRINT_BUDGETS_MS` in
 * `lib/oa/mentalMathSprint.ts`, threaded through the session's optional
 * `questionBudgetsMs`; `perQuestionSec`/`budgetMs` here are only the uniform
 * FALLBACK the engine uses if that array is ever absent).
 *
 * It is a `sprint` kind, so it reuses the EXACT reload-proof per-question engine
 * (`timedSession.ts`: an absolute `questionDeadlineTs` recomputed as `deadline −
 * now`, auto-advancing on timeout so a TIMEOUT = MISS) and the shared `OaRunner`
 * shot-clock kit every other sprint uses. Its speed-weighted results (fast+correct
 * > slow+correct > wrong/timeout) are the AUTHORITATIVE scored signal for the
 * `mental-math::_core` KST node — see `mentalMathSprint.ts`.
 *
 * DELIBERATELY NOT in {@link OA_FORMATS}: like {@link TIMED_DIAGNOSTIC_FORMAT} it
 * is not a user-pickable `/oa` preset; the `TimedDiagnosticStage` references it
 * directly (`contentPool` omitted — it draws its own mental-math items).
 */
export const MENTAL_MATH_SPRINT_ITEM_COUNT = 12;

export const MENTAL_MATH_SPRINT_FORMAT: OaFormatConfig = {
  id: "timed-diagnostic-mm-sprint",
  kind: "sprint",
  label: "Mental-math sprint",
  blurb:
    "A rapid burst of exact mental arithmetic — each question on its own short shot clock (≈10–18 s by difficulty). It auto-advances when the clock runs out and you can't go back; a timeout counts as a miss. Scored on SPEED + accuracy.",
  questionCount: MENTAL_MATH_SPRINT_ITEM_COUNT,
  // Uniform FALLBACK pace only; the real per-question budgets come from
  // MENTAL_MATH_SPRINT_BUDGETS_MS via the session's optional questionBudgetsMs.
  perQuestionSec: 12,
  freeNavigation: false,
  autoAdvance: true,
  // The sprint is scored by the SPEED-WEIGHTED credit in mentalMathSprint.ts, not
  // by this rule (kept only to satisfy the shared session/scoring contract).
  scoring: COUNT_STYLE,
  budgetMs: 12_000,
  sourceNote:
    "GUIDED_PIPELINE_PLAN.md §3.3 metric (b): mental math as a time-pressured scored skill. Per-question shot clock (≈10–18 s by subtopic), timeout = miss, speed-weighted (fast+correct > slow+correct > wrong). Feeds mental-math::_core mastery + the 0.90 timed gate.",
};

/**
 * All timed formats, ordered fastest-pace → slowest (the UI difficulty
 * gradient), with the untimed Measured mode last. Per-question pace (sec/q):
 * Rapid 15 · Blitz 48 · Sprint 90 · Section ~106 · Derivation 180 · Deep 360.
 */
export const OA_FORMATS: readonly OaFormatConfig[] = [
  RAPID_BATTERY_FORMAT,
  BLITZ_FORMAT,
  SPRINT_FORMAT,
  SECTION_FORMAT,
  DERIVATION_FORMAT,
  DEEP_SET_FORMAT,
  MEASURED_FORMAT,
] as const;

/** Lookup a format config by id. */
export function oaFormatById(id: string): OaFormatConfig | undefined {
  return OA_FORMATS.find((f) => f.id === id);
}

/** Lookup a format config by kind (the three kinds are 1:1 with a default config). */
export function oaFormatByKind(kind: OaFormatKind): OaFormatConfig {
  const f = OA_FORMATS.find((x) => x.kind === kind);
  // Every kind has exactly one default format; assert for the type-narrowing.
  if (!f) throw new Error(`No OA format for kind ${kind}`);
  return f;
}

/**
 * Resolve the EFFECTIVE scoring rule for a format, applying the optional
 * hard-mode wrong penalty when enabled. Pure — the single place the hard-mode
 * toggle is folded into a concrete rule (so the session/scoring never re-derive
 * it inconsistently).
 */
export function resolveScoring(
  config: OaFormatConfig,
  hardMode: boolean,
): OaScoringRule {
  if (hardMode && config.hardModePenalty != null) {
    return { ...config.scoring, wrong: config.hardModePenalty };
  }
  return { ...config.scoring };
}
