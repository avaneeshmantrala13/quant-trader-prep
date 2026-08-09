import type { NumericQuestion, Question } from "./content";
import type { GlickoDifficultyMap, TierDifficultyMap, TopicMasteryMap } from "./mastery";
import type { OaTimedStore } from "@/lib/oa/types";
import type { SrsStore } from "@/lib/srs/store";

export interface LevelProgress {
  bestScore: number; // 0..1, best fraction correct achieved
  mastered: boolean;
  attempts: number;
  completedAt?: string;
  /**
   * Flashcard levels only: the set of problem ids the learner has marked
   * "Got it" (persisted so it survives leave/resume). No score is recorded for
   * flashcard levels.
   */
  understood?: string[];
}

/**
 * Mid-level resume state: the exact materialized question set + answers so far.
 * `questions` holds `Question[]` for quiz levels and `NumericQuestion[]` for
 * numeric levels; `answers` holds the chosen choice index (quiz) or the entered
 * numeric value (numeric), with `null` meaning "not yet answered".
 */
export interface ResumeState {
  levelId: string;
  seed: number;
  questions: (Question | NumericQuestion)[];
  index: number;
  answers: (number | null)[];
  /**
   * Numeric levels only: the per-item hint-credit earned so far, parallel to
   * `answers` (∈ [0,1] from the rung schedule; 0 for unanswered items). Needed
   * so the credit-weighted VISIBLE score survives a mid-round reload — the
   * `highestRung` reached is unrecoverable from the final entered value alone.
   * OPTIONAL so older saved blobs (and quiz levels) still load unchanged.
   */
  credits?: number[];
  lessonSkipped: boolean;
  startedAt: string;
}

/**
 * One completed diagnostic (Recalibrate) attempt, recorded so the summary can
 * chart improvement over time. `overallScore` is a 0..1 fraction (higher is
 * better); `perTopic` is an optional per-topic fraction-correct map. Additive
 * and back-compatible — nothing reads it except the improvement graph.
 */
export interface DiagnosticResult {
  /** ISO timestamp of the attempt (matches the seed stamp where practical). */
  at: string;
  /** Overall score in 0..1 (fraction correct, optionally tier-weighted). */
  overallScore: number;
  /** Number of graded items answered in this attempt. */
  itemsAnswered: number;
  /** Optional per-topic fraction correct (0..1), keyed by topicKey. */
  perTopic?: Record<string, number>;
}

/**
 * User-selectable Goal Mode. Case A "course" (UT course mastery) | Case B
 * "interview" (quant interview / OA prep, the safe default). It is a pure VIEW
 * selector — it NEVER stores progress, gates content, or affects
 * scoring/mastery/the v1→v2 migration. See `src/lib/mode/`.
 */
export type GoalMode = "course" | "interview";

/**
 * The eight-stage guided pipeline (login → greenlight). Login is stage 1 in the
 * UX but is NOT modeled here — it is handled by `ProtectedRoute`/auth — so this
 * enum starts at the first in-app stage (the untimed diagnostic) and ends at the
 * terminal `greenlight`. The ORDER of this union is authoritative for stage
 * progression (see `src/lib/pipeline/stateMachine.ts`, `stageOrder`). Spec §3.4.
 */
export type PipelineStage =
  | "diagnostic-untimed"
  | "diagnostic-timed"
  | "game-oa"
  | "diagnosis"
  | "drilling"
  | "mock"
  | "greenlight";

/**
 * One completed strict-timed multi-topic section (the timed diagnostic or an
 * in-loop timed section). Held in `PipelineState.timed.sections` for the
 * progress view / audit and the metric-(b) timed tally. Accuracy is
 * `correct / total`, gated at ≥ 0.90 (spec §3.6) via `meetsMasteryGate`.
 */
export interface TimedSectionResult {
  /** Section label / id (e.g. "timed-diagnostic" or a topic-composition tag). */
  label: string;
  /** Items answered correctly in this section. */
  correct: number;
  /** Total graded items in this section. */
  total: number;
  /** Topic keys the section drew from (feeds the per-topic timed tally, metric b). */
  topicKeys?: string[];
  /** ISO timestamp the section was completed. */
  at?: string;
}

/**
 * One completed mock-interview attempt, recorded for the Stage-7 "≥90% on 3
 * consecutive mocks" gate (RESOLVED DECISION §10.4) and the progress view.
 * `scorePct` is a percentage in [0,100]; `wouldPass` mirrors the mock
 * diagnosis verdict string ("yes" | "borderline" | "no").
 */
export interface PipelineMockResult {
  /** ISO timestamp of the mock. */
  at: string;
  /** Score as a PERCENT in [0,100] (compared against a 90 bar). */
  scorePct: number;
  /** Mock-diagnosis pass verdict ("yes" | "borderline" | "no"). */
  wouldPass: string;
  /**
   * REASONING-QUALITY gate for greenlight: `false` when this mock had CORRECT
   * answers but POOR reasoning (any correct-but-vague/flawed item, any `flawed`
   * or unresolved `ambiguous` reasoning). A mock that clears the score bar with
   * poor reasoning does NOT satisfy the greenlight gate. OPTIONAL for back-compat
   * with previously-recorded mocks: an ABSENT value is treated as "ok" (only an
   * explicit `false` blocks), so historical logs and hand-built fixtures are
   * unaffected. Freshly-built results always set it explicitly.
   */
  reasoningOk?: boolean;
}

/**
 * Stage-unlock state for the guided pipeline (spec §3.4). ADDITIVE & OPTIONAL on
 * `UserProgress` (mirrors the `diagnosticDoneAt` pattern): older saves without it
 * load unchanged and `migrateProgress` leaves it absent, so a pure stage router
 * (`resolveStage`) can default an undefined `pipeline` to the first stage. The
 * `*At` stamps are write-once completion markers a pure guard reads; the per-run
 * result holders are for the progress view / audit only.
 *
 * IMPORTANT (relock semantics, RESOLVED DECISION §10.5): the `drillingClearedAt`
 * / `mockClearedAt` / `greenlitAt` stamps are NOT the source of truth for
 * whether a user is still cleared — a decayed/relocked node must be able to
 * un-greenlight a user. Gates therefore RE-EVALUATE from live mastery/results
 * (see `src/lib/pipeline/gates.ts`); the stamps only record WHEN a gate first
 * passed, for the audit trail.
 */
export interface PipelineState {
  /** The current (last-resolved) pipeline stage. */
  stage: PipelineStage;
  /** Set when the untimed diagnostic (stage 2) is completed. */
  untimedDoneAt?: string;
  /** Set when the timed diagnostic (stage 3) is completed. */
  timedDoneAt?: string;
  /** Set when the game-OA / trading-intuition stage (stage 4) is completed. */
  gameOaDoneAt?: string;
  /** Set when the backend diagnosis (stage 5) has been computed. */
  diagnosisComputedAt?: string;
  /** Set when ALL §6 drilling gates pass (content 0.80 + timed 0.90 + competencies). */
  drillingClearedAt?: string;
  /** Set when the mock stage (≥90% on 3 consecutive mocks) clears. */
  mockClearedAt?: string;
  /** Set when the user reaches the terminal greenlight stage. */
  greenlitAt?: string;
  // ---- per-run results for the progress view / audit (reuse existing types) ----
  /** Untimed-diagnostic result (reuses the existing `DiagnosticResult`). */
  untimed?: DiagnosticResult;
  /** Timed-diagnostic result: overall tally + the per-section breakdown. */
  timed?: { correct: number; total: number; sections: TimedSectionResult[] };
  /** Game-OA result: rounds played, running P&L, and the MM verdict string. */
  gameOa?: { rounds: number; pnl: number; verdict: string };
  /** Append-only log of mock attempts (newest last), for the 3-consecutive gate. */
  mocks?: PipelineMockResult[];
}

/**
 * One persisted (predicted, outcome) calibration pair, keyed by topic. Additive
 * & optional (mirrors `diagnosticHistory`): older saves without it load
 * unchanged, and it NEVER gates content or affects scoring / mastery / the
 * v1→v2 migration. Persisting a capped log lets the dashboard's calibration
 * panel accumulate across sessions instead of resetting every reload.
 */
export interface PersistedCalibrationPair {
  topicKey: string;
  /** Predicted success probability at serve time, in [0,1]. */
  pred: number;
  /** Observed outcome (0 miss, 1 hit). */
  outcome: 0 | 1;
  /** ISO timestamp of the graded item (optional). */
  at?: string;
}

export interface UserProgress {
  version: number; // was 1; Phase 1 wrote 2; T12 adaptive engine wrote 3; T14 SRS wrote 4; ZPD repeated-mistake tally wrote 5; guided-pipeline (P0) writes 6 (see src/lib/mastery/migrate.ts)
  levelProgress: Record<string, LevelProgress>;
  resume: Record<string, ResumeState>;
  xp: number;
  streak: number;
  lastActiveDate: string; // YYYY-MM-DD
  createdAt: string;
  // ---- NEW (Phase 1 — Mastery & Calibration). All OPTIONAL so v1 saves load
  //      unchanged; migrateProgress fills them with empty maps (COORDINATION §2.2). ----
  /** Per-topic Elo θ + Beta(α,β) posterior + misconception flags (src/types/mastery.ts). */
  topicMastery?: TopicMasteryMap;
  /** Per (topic,tier) Elo difficulty d[topic,τ]. Key = `${topicKey}#${difficulty}`. */
  tierDifficulty?: TierDifficultyMap;
  /** Set once, after the diagnostic is completed or skipped (Phase 3). */
  diagnosticDoneAt?: string;
  /**
   * Set once the new-user ONBOARDING TOUR has been shown/dismissed. Purely a
   * UI "shown once" flag — additive and migration-safe (mirrors
   * `diagnosticDoneAt`). It NEVER gates content and is untouched by
   * `recordAttempt`, `recordItemAttempt`, mastery/locking, or the v1→v2
   * migration. Re-triggerable on demand via the "Show tutorial" affordance.
   */
  onboardingTourDoneAt?: string;
  /**
   * Append-only history of completed diagnostic attempts, oldest → newest.
   * Powers the Recalibrate "you're improving" graph. Additive & optional
   * (mirrors `diagnosticDoneAt`): older saves without it load unchanged, and it
   * NEVER gates content or affects scoring / mastery / the v1→v2 migration.
   */
  diagnosticHistory?: DiagnosticResult[];
  /**
   * User-selected Goal Mode (Case A "course" | Case B "interview"). Additive &
   * optional (mirrors `diagnosticDoneAt`): older saves load unchanged and are
   * treated as "interview" (Case B = today's app). A pure VIEW selector — it
   * NEVER stores progress, gates content, or affects scoring/mastery/the v1→v2
   * migration. Overlapping-topic progress is therefore shared automatically when
   * toggling A↔B (mastery stays topicKey-keyed; mode reads none of it).
   */
  goalMode?: GoalMode;
  /**
   * Append-only, capped cross-session calibration log (WS-CAL). Additive &
   * optional (mirrors `diagnosticHistory`): older saves without it load
   * unchanged, and it NEVER gates content or affects scoring / mastery / the
   * v1→v2 migration. Lets the reliability panel accrue across sessions so it can
   * reach the sufficiency threshold instead of resetting on reload.
   */
  calibrationLog?: PersistedCalibrationPair[];
  /**
   * Durable Timed OA store: the single resumable in-progress session plus the
   * capped completed-results history (src/lib/oa/types.ts). Additive & optional
   * (mirrors `diagnosticHistory` / `calibrationLog`): older saves without it
   * load unchanged, and it NEVER gates content or affects scoring / mastery /
   * the v1→v2 migration. Persisting it here makes an active session reload-proof
   * (survives leave/resume/re-login) and keeps completed results for the
   * dashboard trend graph.
   */
  oaTimed?: OaTimedStore;
  /**
   * OPTIONAL, additive (T12 adaptive engine — v2→v3). Per (topic,tier) Glicko
   * difficulty rating + RD, updated from `ItemAttempt` outcomes
   * (`src/lib/mastery/glicko.ts`). A PARALLEL, richer companion to the frozen
   * Elo `tierDifficulty` map — it NEVER replaces it and NEVER gates content or
   * affects scoring / the confident-mastery (ciLow ≥ 0.8) or unlock bars. Older
   * saves without it load unchanged; the v2→v3 migration leaves it absent.
   */
  glickoDifficulty?: GlickoDifficultyMap;
  /**
   * OPTIONAL, additive (T14 retention — v3→v4). The persisted Spaced-Repetition
   * card store: a flat `cardId → SrsCard` map of SM-2 scheduling state with
   * ABSOLUTE wall-clock `dueAtMs` (reload-proof across sessions) plus a review
   * counter (`src/lib/srs/store.ts`). Card CONTENT is regenerated deterministically
   * from the mode-scoped catalog (`src/lib/srs/deck.ts`) and joined by id, so
   * only scheduling state is stored. Its OWN lane: it NEVER gates content or
   * affects scoring / mastery / the confident-mastery + unlock bars / the
   * adaptive-engine (Glicko/IRT) fold / relock. Older saves without it load
   * unchanged; the v3→v4 migration leaves it absent unless the blob carried it.
   */
  srs?: SrsStore;
  /**
   * OPTIONAL, additive (ZPD remediation — v4→v5). Per-topic RAW misconception
   * frequency: the OUTER key is a topicKey, the INNER key is a misconception TAG
   * (the string AFTER the `topicKey::` prefix a misconception KEY carries, via
   * `misconceptionTagOf`), and the value is the CUMULATIVE hit count in that
   * topic. Unlike `TopicMastery.misconceptions` (decayed on a clean solve,
   * mastery-facing), these counts are NEVER decayed — they exist purely to power
   * the "you made this specific mistake N times" repeated-mistake feedback and
   * its targeted, UNSCORED re-prep. Its OWN lane: populated by `recordItemAttempt`
   * alongside the mastery fold, but it NEVER gates content or affects scoring /
   * mastery / the confident-mastery + unlock bars / relock / the migration. Older
   * saves without it load unchanged; the v4→v5 migration leaves it absent unless
   * the saved blob already carried it.
   */
  misconceptionsByTopic?: Record<string, Record<string, number>>;
  /**
   * OPTIONAL, additive (guided pipeline — v5→v6). The stage-unlock state for the
   * linear login→greenlight pipeline (spec §3.4). Mirrors the `diagnosticDoneAt`
   * pattern: a pure stage router (`src/lib/pipeline/stateMachine.ts`) derives the
   * current stage from these stamps + live gate results. Older saves without it
   * load unchanged; the v5→v6 migration leaves it ABSENT unless the saved blob
   * already carried it, and `resolveStage` defaults an undefined `pipeline` to
   * the first stage (untimed diagnostic). Its own additive field — it does not
   * touch the existing mastery/unlock/scoring lanes or the v1→v2 migration. The
   * pipeline itself is dormant at runtime until Phase P1 flips `PIPELINE_ENABLED`.
   */
  pipeline?: PipelineState;
}

export function emptyProgress(): UserProgress {
  const today = new Date().toISOString().slice(0, 10);
  return {
    version: 6,
    levelProgress: {},
    resume: {},
    xp: 0,
    streak: 0,
    lastActiveDate: today,
    createdAt: new Date().toISOString(),
    topicMastery: {},
    tierDifficulty: {},
    // T12 adaptive-engine state starts empty; all new estimator fields are
    // OPTIONAL, so absence here is valid and older saves load unchanged.
    glickoDifficulty: {},
  };
}
