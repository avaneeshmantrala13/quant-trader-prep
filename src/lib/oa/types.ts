/**
 * lib/oa/types.ts — shared CONTRACT types for the Timed OA / Interview practice
 * sections (Case B). This is the single source every OA module imports from, so
 * the pure session engine, scoring/stats, question pool, persistence, and UI all
 * agree on one shape. NO logic lives here — types only — so it never collides
 * with the modules that implement against it.
 *
 * WHY A DEDICATED SESSION MODEL (not the existing arena `session.ts`). The Speed
 * Arena's session decrements an in-memory `remainingMs` via ticks — fine for a
 * mental-math drill, but it PAUSES when the tab is closed. Interview OAs must be
 * WALL-CLOCK: we persist the absolute `deadlineTs`, so leaving/reloading never
 * stops the clock, and a deadline that passed while the user was away yields an
 * `expired` (auto-submitted) session. That reload-proof guarantee is the whole
 * point of mimicking interview conditions, and it demands the timestamp-based
 * model below rather than a tick counter.
 */
import type { Difficulty } from "@/types/content";
import type { RotationState } from "@/lib/content/rotation";

/**
 * The three timed practice formats:
 *  - `sprint`   — strict per-question clock (~90 s/q), auto-advance on timeout,
 *                 NO going back; Optiver "Beat the Odds" +1/−1/0 scoring.
 *  - `section`  — one running section clock (e.g. 30 min / 17 Qs), auto-submit at
 *                 time up, optional hard-mode −1 penalty. Navigation is FREE by
 *                 default (DRW/SIG); a module-locked variant (IMC-style, carried
 *                 as `OaSessionState.noBack`) is forward-only (no going back).
 *  - `measured` — untimed; tracks time-per-question and reports the average
 *                 (feeds the dashboard trend graph).
 */
export type OaFormatKind = "sprint" | "section" | "measured";

/** Points awarded per correct / wrong / skipped (or unanswered) question. */
export interface OaScoringRule {
  correct: number;
  wrong: number;
  skip: number;
}

/**
 * A fully data-driven format definition. Counts / durations / scoring are all
 * captured here (see `lib/oa/config.ts`), informed by the firm research
 * (`datasets/FIRM_TIMED_ASSESSMENTS*.md`) and cross-checked against the OA
 * benchmark catalog (`content/arena/oaFormats.ts`) so they stay easy to tune.
 */
export interface OaFormatConfig {
  /** Stable id linking a session/result to its format (e.g. "sprint-default"). */
  id: string;
  kind: OaFormatKind;
  label: string;
  blurb: string;
  /** Questions presented per session. */
  questionCount: number;
  /** Whole-section window (seconds); omitted/0 ⇒ untimed (measured mode). */
  sectionSec?: number;
  /** Per-question window (seconds) for the strict sprint clock. */
  perQuestionSec?: number;
  /** Free navigation within the section (section exam only). */
  freeNavigation: boolean;
  /** Auto-advance to the next question when a per-question clock elapses. */
  autoAdvance: boolean;
  /** Base scoring rule (before any hard-mode toggle). */
  scoring: OaScoringRule;
  /**
   * Optional hard-mode wrong-answer penalty. When present, the format offers a
   * toggle that replaces `scoring.wrong` with this value (e.g. −1) at creation.
   */
  hardModePenalty?: number;
  /**
   * Per-question budget (ms) the pacing / "% within budget" stats are measured
   * against. Derived from the window ÷ count for timed formats.
   */
  budgetMs: number;
  /** Provenance: the `oaFormats.ts` benchmark id this format is informed by. */
  oaFormatId?: string;
  /** Research provenance note (which section of the datasets grounds it). */
  sourceNote: string;
  /**
   * Short firm-INSPIRED attribution shown on the selection card (e.g.
   * "Citadel-style"). The format mirrors the firm's tested skills + pacing; it is
   * NOT a copy of any firm's real assessment.
   */
  firmAttribution?: string;
  /**
   * Which curated generator pool feeds this format (see `questionPool.ts`,
   * `OA_CONTENT_POOLS`). Omitted ⇒ the default mixed interview pool, so the
   * original three formats keep drawing exactly as before.
   */
  contentPool?: string;
}

/** A materialized multiple-choice question drawn from the conceptual generators. */
export interface OaQuestion {
  id: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
  concept?: string;
  difficulty: Difficulty;
  source?: string;
}

/** One recorded answer, parallel (by position) to a session's questions. */
export interface OaAnswer {
  questionId: string;
  /** Chosen choice index, or `null` when skipped / not yet answered. */
  chosen: number | null;
  /** Wall-clock time spent on this question so far (ms). */
  elapsedMs: number;
}

export type OaSessionStatus = "running" | "submitted" | "expired";

/**
 * The persisted in-progress (or just-finished) session. Reload-proof by design:
 * time is stored as absolute epoch-ms deadlines, so remaining time is always
 * recomputed as `deadline − now` and never depends on an in-memory ticker.
 */
export interface OaSessionState {
  /** Unique session id, e.g. `${formatId}:${startedAtTs}`. */
  id: string;
  formatId: string;
  kind: OaFormatKind;
  /** Absolute wall-clock start (epoch ms). */
  startedAtTs: number;
  /** Absolute section deadline (epoch ms); omitted ⇒ untimed (measured). */
  deadlineTs?: number;
  /** Sprint only: absolute deadline for the CURRENT question (epoch ms). */
  questionDeadlineTs?: number;
  /**
   * SPRINT only, OPTIONAL & additive: a PER-QUESTION shot-clock budget (ms),
   * parallel to `questions`. When present the sprint clock uses
   * `questionBudgetsMs[index]` for question `index` instead of the uniform
   * `budgetMs`, so a burst can pace each item to its own difficulty (e.g. the
   * timed diagnostic's mental-math sprint: ~10 s arithmetic → ~18 s odds). Absent
   * ⇒ every question uses `budgetMs` exactly as before (byte-identical persisted
   * shape for the `/oa` sprints), so this is fully backward-compatible.
   */
  questionBudgetsMs?: number[];
  questions: OaQuestion[];
  /** Parallel to `questions`: chosen index (or null) + per-question elapsed. */
  answers: OaAnswer[];
  /** Index of the current question. */
  index: number;
  status: OaSessionStatus;
  /** Effective scoring rule (already resolves any hard-mode toggle). */
  scoring: OaScoringRule;
  /** Per-question budget (ms) for pacing / within-budget stats. */
  budgetMs: number;
  /** Whether the hard-mode wrong penalty was enabled at creation. */
  hardMode: boolean;
  /**
   * MODULE-LOCK: a section-clock format that forbids returning to an earlier
   * question (forward-only progression, IMC-style "no back-navigation"). Present
   * (and `true`) ONLY for module-locked section formats; omitted for the free-nav
   * section, sprint, and measured formats so their persisted shape is unchanged.
   */
  noBack?: boolean;
  /**
   * OPTIONAL & additive (guided pipeline Stage 3 ONLY): per-topic timed sections
   * carried forward from a PRIOR phase of a multi-phase stage, so a reload during
   * the later phase can still recover the earlier phase's already-scored result.
   * Concretely: the Timed Diagnostic runs the mental-math SPRINT first, then the
   * hard SECTION; when the hard section is created it carries the finished
   * sprint's aggregate section here, so a phase-2 reload never loses it. Ignored
   * by the pure engine and every other format (their persisted shape is
   * unchanged); it is plain-serializable `{label,correct,total,topicKeys?,at?}`.
   */
  carriedSections?: {
    label: string;
    correct: number;
    total: number;
    topicKeys?: string[];
    at?: string;
  }[];
  /** Absolute completion timestamp once submitted / expired (epoch ms). */
  completedAtTs?: number;
}

/** A finished session, saved durably for the dashboard stats + trend graph. */
export interface OaSessionResult {
  id: string;
  formatId: string;
  kind: OaFormatKind;
  startedAtTs: number;
  completedAtTs: number;
  /** `submitted` (by user or auto at time) vs `expired` (deadline passed away). */
  outcome: "submitted" | "expired";
  score: number;
  /** Best achievable score = questionCount × scoring.correct. */
  maxScore: number;
  /** Total questions the session presented. */
  total: number;
  /** Non-skipped, answered questions. */
  attempted: number;
  correct: number;
  /** correct / attempted in [0,1] (0 when nothing attempted). */
  accuracy: number;
  /** Median solve time over attempted items (ms). */
  medianMsPerQuestion: number;
  /** Mean solve time over attempted items (ms). */
  avgMsPerQuestion: number;
  /** Per-question budget these were paced against (ms). */
  budgetMs: number;
  /** Attempted items solved within budget. */
  withinBudget: number;
  /** withinBudget / attempted in [0,1]. */
  pctWithinBudget: number;
  hardMode: boolean;
}

/**
 * The durable per-user OA store, persisted inside `UserProgress` (additive &
 * optional so older saves load unchanged). Holds the single resumable in-progress
 * session plus the capped completed-results history.
 */
export interface OaTimedStore {
  /** The single in-progress session, resumed on reload (or undefined). */
  active?: OaSessionState;
  /** Completed results, oldest → newest (capped). */
  results: OaSessionResult[];
  /**
   * ADDITIVE & OPTIONAL anti-repeat rotation state: a bounded ring of the most
   * recently SERVED question signatures (see `@/lib/content/rotation`). Persists
   * across sessions so future draws can be biased AWAY from recent repeats.
   * Absent on old saves (they load unchanged); the store helpers initialize it
   * on first use. Owned/managed only via `lib/oa/store.ts`; the question pool
   * (T11) reads/updates it exclusively through those helpers.
   */
  rotation?: RotationState;
}
