import { useCallback, useEffect, useRef, useState } from "react";
import { useProgress } from "@/context/ProgressContext";
import {
  MENTAL_MATH_SPRINT_FORMAT,
  TIMED_DIAGNOSTIC_FORMAT,
} from "@/lib/oa/config";
import { createOaSession, resumeOaSession } from "@/lib/oa/timedSession";
import type { OaSessionState } from "@/lib/oa/types";
import {
  buildTimedResult,
  drawTimedDiagnostic,
  timedDiagnosticPasses,
  topicKeysForSession,
  type TimedDiagnosticResult,
} from "@/lib/oa/timedDiagnostic";
import {
  buildMentalMathSprintSections,
  drawMentalMathSprint,
  mentalMathSprintAttempts,
  mentalMathSprintBudgetsForSession,
  mentalMathSprintSubtopicsForSession,
  scoreMentalMathSprint,
} from "@/lib/oa/mentalMathSprint";
import { OaRunner } from "@/components/oa/OaRunner";
import type { StageComponentProps } from "../stageRegistry";

/** Which phase of the two-phase timed diagnostic the runner is showing. */
type TimedPhase = "sprint" | "hard";

/** Prefer the carried sprint sections stored on a resumed hard session. */
function carriedSprintSections(
  session: OaSessionState,
): TimedDiagnosticResult["sections"] {
  return (session.carriedSections ?? []) as TimedDiagnosticResult["sections"];
}

/** Render a possibly-fractional (speed-weighted) score cleanly. */
function fmtScore(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/**
 * TimedDiagnosticStage — the guided pipeline's Stage 3 screen (P4). Implements
 * the {@link StageComponentProps} contract: it renders the stage's tasks and
 * calls `onComplete(result)` exactly once when finished, owning no navigation.
 *
 * TWO PHASES (both on the SHARED reload-proof `timedSession.ts` engine + `OaRunner`):
 *  1. MENTAL-MATH SPRINT (`MENTAL_MATH_SPRINT_FORMAT`, `sprint` kind): a short
 *     burst of exact mental-arithmetic MCQs, each on its OWN per-question shot
 *     clock (~10–18 s by subtopic, threaded through `questionBudgetsMs`). Timeout
 *     auto-advances = a MISS. On finish it is SPEED-WEIGHTED (fast+correct >
 *     slow+correct > wrong) and wired into the AUTHORITATIVE `mental-math::_core`
 *     mastery via `recordItemAttempt`, plus one aggregate timed section.
 *  2. HARD SECTION (`TIMED_DIAGNOSTIC_FORMAT`, `section` kind): the 30-question /
 *     45-minute multi-topic section, scored per topic (unchanged).
 *
 * RELOAD-PROOF by construction. The in-progress session (either phase) is
 * persisted in `progress.oaTimed.active` (absolute deadlines); on mount we RESUME
 * whichever phase is live via `resumeOaSession`. The sprint runs FIRST so the long
 * 45-minute hard section is always the persisted `active` session during phase 2,
 * and the sprint's already-scored aggregate section is CARRIED on the hard
 * session (`carriedSections`) so a phase-2 reload never loses it. Sprint mastery
 * is recorded durably the instant the sprint finishes.
 *
 * On the final finish it hands the combined `progress.pipeline.timed` payload
 * (`{correct,total,sections:[…sprint, …per-topic]}`) back via `onComplete`.
 */
export function TimedDiagnosticStage({ onComplete }: StageComponentProps) {
  const { progress, saveOaSession, clearOaActiveSession, recordItemAttempt } =
    useProgress();

  const [session, setSession] = useState<OaSessionState | null>(null);
  const [phase, setPhase] = useState<TimedPhase>("sprint");
  const [result, setResult] = useState<TimedDiagnosticResult | null>(null);

  // Guards: mount-time resume/start runs once; the sprint hand-off fires once;
  // final completion fires once.
  const initedRef = useRef(false);
  const sprintHandledRef = useRef(false);
  const finishedRef = useRef(false);
  // The sprint's already-scored aggregate section, kept for the final combine
  // (also persisted on the hard session's `carriedSections` for reload safety).
  const sprintSectionsRef = useRef<TimedDiagnosticResult["sections"]>([]);

  // Start (or resume into) the HARD SECTION phase, carrying the finished sprint's
  // sections so a phase-2 reload can recover them.
  const startHardSection = useCallback(
    (sprintSections: TimedDiagnosticResult["sections"]) => {
      const seed = Date.now() % 2_000_000_000;
      const { questions } = drawTimedDiagnostic(
        seed,
        TIMED_DIAGNOSTIC_FORMAT.questionCount,
      );
      const base = createOaSession(TIMED_DIAGNOSTIC_FORMAT, questions, {
        nowTs: Date.now(),
      });
      const hard: OaSessionState =
        sprintSections.length > 0
          ? { ...base, carriedSections: sprintSections }
          : base;
      saveOaSession(hard);
      setSession(hard);
      setPhase("hard");
    },
    [saveOaSession],
  );

  // Finalize the whole stage: combine the sprint section with the hard section's
  // per-topic tally, clear the resumable session, and report upward ONCE.
  const finishAll = useCallback(
    (finishedHard: OaSessionState) => {
      if (finishedRef.current) return;
      finishedRef.current = true;

      const topicKeys = topicKeysForSession(finishedHard);
      const hardResult = buildTimedResult(finishedHard, topicKeys);
      const sprintSections = sprintSectionsRef.current.length
        ? sprintSectionsRef.current
        : carriedSprintSections(finishedHard);

      const sections = [...sprintSections, ...hardResult.sections];
      const correct = Number(
        sections.reduce((s, x) => s + x.correct, 0).toFixed(4),
      );
      const total = sections.reduce((s, x) => s + x.total, 0);
      const combined: TimedDiagnosticResult = { correct, total, sections };

      clearOaActiveSession();
      setSession(null);
      setResult(combined);
      onComplete(combined);
    },
    [clearOaActiveSession, onComplete],
  );

  // Finalize the SPRINT phase: SPEED-WEIGHT the outcomes, drive mental-math
  // mastery, keep the aggregate section, then start the hard section. Runs once.
  const finishSprint = useCallback(
    (finishedSprint: OaSessionState) => {
      if (sprintHandledRef.current) return;
      sprintHandledRef.current = true;

      const subtopics = mentalMathSprintSubtopicsForSession(finishedSprint);
      const budgetsMs = mentalMathSprintBudgetsForSession(finishedSprint);
      const outcomes = scoreMentalMathSprint(finishedSprint, subtopics, budgetsMs);
      const at = new Date().toISOString();
      // Route the speed-weighted results into the AUTHORITATIVE mental-math node.
      for (const attempt of mentalMathSprintAttempts(outcomes, at)) {
        recordItemAttempt(attempt);
      }
      const sprintSections = buildMentalMathSprintSections(outcomes, at);
      sprintSectionsRef.current = sprintSections;
      startHardSection(sprintSections);
    },
    [recordItemAttempt, startHardSection],
  );

  // Route a terminal session from the runner to the right phase handler.
  const handleFinish = useCallback(
    (finished: OaSessionState) => {
      if (finished.formatId === MENTAL_MATH_SPRINT_FORMAT.id) {
        finishSprint(finished);
      } else {
        finishAll(finished);
      }
    },
    [finishSprint, finishAll],
  );

  // Resume a persisted in-progress phase, or start a fresh sprint — once.
  useEffect(() => {
    if (initedRef.current) return;
    initedRef.current = true;

    const active = progress.oaTimed?.active;

    // Phase 1 — a persisted mental-math sprint.
    if (active && active.formatId === MENTAL_MATH_SPRINT_FORMAT.id) {
      const resumed = resumeOaSession(active, Date.now());
      if (resumed.status === "running") {
        setSession(resumed);
        setPhase("sprint");
        if (resumed !== active) saveOaSession(resumed);
      } else {
        // The sprint ran out while away — score it and roll into the hard section.
        finishSprint(resumed);
      }
      return;
    }

    // Phase 2 — a persisted hard section (the sprint already completed earlier).
    if (active && active.formatId === TIMED_DIAGNOSTIC_FORMAT.id) {
      sprintHandledRef.current = true;
      sprintSectionsRef.current = carriedSprintSections(active);
      const resumed = resumeOaSession(active, Date.now());
      if (resumed.status === "running") {
        setSession(resumed);
        setPhase("hard");
        if (resumed !== active) saveOaSession(resumed);
      } else {
        // The 45:00 deadline passed while away — auto-submit into completion.
        finishAll(resumed);
      }
      return;
    }

    // Fresh start: draw the deterministic mental-math sprint and seed the
    // reload-proof per-question clocks from the wall clock.
    const seed = Date.now() % 2_000_000_000;
    const draw = drawMentalMathSprint(
      seed,
      MENTAL_MATH_SPRINT_FORMAT.questionCount,
    );
    const fresh = createOaSession(MENTAL_MATH_SPRINT_FORMAT, draw.questions, {
      nowTs: Date.now(),
      questionBudgetsMs: draw.budgetsMs,
    });
    saveOaSession(fresh);
    setSession(fresh);
    setPhase("sprint");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="space-y-5" data-testid="timed-diagnostic-stage">
      <header className="space-y-1">
        <span className="label text-accent">Stage 3 · Timed diagnostic</span>
        {phase === "sprint" && !result ? (
          <>
            <h2 className="font-display text-2xl font-bold text-primary">
              Mental-math sprint
            </h2>
            <p className="text-sm text-secondary">
              A rapid burst of exact mental arithmetic — each question on its own
              short shot clock. It auto-advances when time runs out and a timeout
              counts as a miss. This is scored on speed <em>and</em> accuracy.
            </p>
          </>
        ) : (
          <>
            <h2 className="font-display text-2xl font-bold text-primary">
              30 questions · 45 minutes
            </h2>
            <p className="text-sm text-secondary">
              Hard questions across multiple topics on one strict wall clock. It
              keeps running if you leave and auto-submits at 0:00 — this measures
              the speed of your correct thinking.
            </p>
          </>
        )}
      </header>

      {session && (
        <OaRunner
          session={session}
          onChange={(next) => {
            setSession(next);
            saveOaSession(next);
          }}
          onFinish={handleFinish}
          // Diagnostic: never reveal the concept/trick (attribution still runs).
          hideTopic
        />
      )}

      {result && (
        <div className="panel-ruled space-y-4 p-6" data-testid="timed-diagnostic-done">
          <span
            className={`chip ${
              timedDiagnosticPasses(result)
                ? "border-bull text-bull"
                : "border-bear text-bear"
            }`}
          >
            {timedDiagnosticPasses(result) ? "Cleared ≥ 90%" : "Below the 90% bar"}
          </span>
          <div className="space-y-1">
            <span className="label text-muted">Timed accuracy (speed-weighted)</span>
            <div className="num text-5xl font-black leading-none text-accent">
              {fmtScore(result.correct)}
              <span className="text-2xl text-muted"> / {result.total}</span>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-secondary">
            Your mental-math sprint and per-topic timed performance have been
            recorded. Continuing to the next stage.
          </p>
        </div>
      )}

      {!session && !result && (
        <div className="panel flex items-center gap-2.5 p-6 font-mono text-sm text-muted">
          <span className="cursor" aria-hidden />
          Preparing your timed diagnostic…
        </div>
      )}
    </section>
  );
}

export default TimedDiagnosticStage;
