import { useCallback, useEffect, useRef, useState } from "react";
import { useProgress } from "@/context/ProgressContext";
import { TIMED_DIAGNOSTIC_FORMAT } from "@/lib/oa/config";
import { createOaSession, resumeOaSession } from "@/lib/oa/timedSession";
import type { OaSessionState } from "@/lib/oa/types";
import {
  buildTimedResult,
  drawTimedDiagnostic,
  timedDiagnosticPasses,
  topicKeysForSession,
  type TimedDiagnosticResult,
} from "@/lib/oa/timedDiagnostic";
import { OaRunner } from "@/components/oa/OaRunner";
import type { StageComponentProps } from "../stageRegistry";

/**
 * TimedDiagnosticStage — the guided pipeline's Stage 3 screen (P4). Implements
 * the {@link StageComponentProps} contract: it renders the stage's ONE task and
 * calls `onComplete(result)` exactly once when finished, owning no navigation.
 *
 * WHAT IT DOES (GUIDED_PIPELINE_PLAN.md §2 Stage 3):
 *  - Serves the 30-question / 45-minute `TIMED_DIAGNOSTIC_FORMAT` through the
 *    EXISTING OA runner (`OaRunner`) — one question at a time with a live 45:00
 *    section countdown and an `n / 30` progress readout.
 *  - RELOAD-PROOF by construction: the in-progress session is persisted in
 *    `progress.oaTimed.active` (absolute `deadlineTs`), and on mount we RESUME it
 *    via `resumeOaSession` — so leaving/reloading never resets the clock, and a
 *    deadline that passed while away AUTO-SUBMITS straight to completion.
 *  - On finish, scores per topic and hands the `progress.pipeline.timed` payload
 *    (`{correct,total,sections:[{label,correct,total,topicKeys,at}]}`) back via
 *    `onComplete(result)` — the guided shell forwards it to whatever persists
 *    pipeline progress. The 0.90 section gate is applied via a parameterized
 *    `meetsMasteryGate`, never touching the global 0.80 content bar.
 *
 * Minimalist dark UI: a compact task header + the shared, theme-styled runner.
 */
export function TimedDiagnosticStage({ onComplete }: StageComponentProps) {
  const { progress, saveOaSession, clearOaActiveSession } = useProgress();

  const [session, setSession] = useState<OaSessionState | null>(null);
  const [result, setResult] = useState<TimedDiagnosticResult | null>(null);

  // Guards so the mount-time resume/start runs once and completion fires once.
  const initedRef = useRef(false);
  const finishedRef = useRef(false);

  // Finalize a terminal session: score per-topic, clear the resumable session,
  // and report the result upward exactly once (contract's `onComplete`).
  const finish = useCallback(
    (finished: OaSessionState) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      const topicKeys = topicKeysForSession(finished);
      const built = buildTimedResult(finished, topicKeys);
      clearOaActiveSession();
      setSession(null);
      setResult(built);
      onComplete(built);
    },
    [clearOaActiveSession, onComplete],
  );

  // Resume a persisted in-progress diagnostic, or start a fresh one — once.
  useEffect(() => {
    if (initedRef.current) return;
    initedRef.current = true;

    const active = progress.oaTimed?.active;
    if (active && active.formatId === TIMED_DIAGNOSTIC_FORMAT.id) {
      const resumed = resumeOaSession(active, Date.now());
      if (resumed.status === "running") {
        setSession(resumed);
        // Persist any reconciliation (e.g. a tick past a boundary) so the store
        // and the on-screen session never disagree.
        if (resumed !== active) saveOaSession(resumed);
      } else {
        // The 45:00 deadline passed while away — auto-submit into completion.
        finish(resumed);
      }
      return;
    }

    // Fresh start: draw 30 hard, topic-tagged questions deterministically and
    // seed the reload-proof section clock from the wall clock.
    const seed = Date.now() % 2_000_000_000;
    const { questions } = drawTimedDiagnostic(
      seed,
      TIMED_DIAGNOSTIC_FORMAT.questionCount,
    );
    const fresh = createOaSession(TIMED_DIAGNOSTIC_FORMAT, questions, {
      nowTs: Date.now(),
    });
    saveOaSession(fresh);
    setSession(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="space-y-5" data-testid="timed-diagnostic-stage">
      <header className="space-y-1">
        <span className="label text-accent">Stage 3 · Timed diagnostic</span>
        <h2 className="font-display text-2xl font-bold text-primary">
          30 questions · 45 minutes
        </h2>
        <p className="text-sm text-secondary">
          Hard questions across multiple topics on one strict wall clock. It
          keeps running if you leave and auto-submits at 0:00 — this measures the
          speed of your correct thinking.
        </p>
      </header>

      {session && (
        <OaRunner
          session={session}
          onChange={(next) => {
            setSession(next);
            saveOaSession(next);
          }}
          onFinish={finish}
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
            <span className="label text-muted">Timed accuracy</span>
            <div className="num text-5xl font-black leading-none text-accent">
              {result.correct}
              <span className="text-2xl text-muted"> / {result.total}</span>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-secondary">
            Your per-topic timed performance has been recorded. Continuing to the
            next stage.
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
