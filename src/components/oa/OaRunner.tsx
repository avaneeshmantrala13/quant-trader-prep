import { useEffect, useRef } from "react";
import type { OaSessionState } from "@/lib/oa/types";
import {
  advanceSprint,
  currentQuestion,
  navigateTo,
  recordAnswer,
  remainingQuestionMs,
  remainingSectionMs,
  resumeOaSession,
  submitOaSession,
} from "@/lib/oa/timedSession";
import { useWallClock } from "./useWallClock";

/** mm:ss (ceil to the second), shared with the arena's timer formatting. */
function clock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * OaRunner — the presentational runner for a Timed OA session. It owns NO
 * session logic: every transition delegates to the pure `lib/oa/timedSession`
 * engine, and the single wall clock (`useWallClock`) feeds it `nowTs`.
 *
 * Reload-proof by construction: on mount and on every clock tick it reconciles
 * the persisted session against the wall clock via `resumeOaSession` (section
 * expiry / sprint auto-advance), calling `onChange` to persist changes and
 * `onFinish` exactly once when the session becomes terminal.
 */
export function OaRunner({
  session,
  onChange,
  onFinish,
}: {
  session: OaSessionState;
  /** Persist + update page state with a new (still-running) session. */
  onChange: (next: OaSessionState) => void;
  /** Called ONCE when the session becomes terminal (page shows the report). */
  onFinish: (finished: OaSessionState) => void;
}) {
  const nowTs = useWallClock(true);

  // When the current question was first shown — the anchor for the WALL-CLOCK
  // view time we attribute to it (accrued into the engine's `elapsedMs`).
  const viewStartTs = useRef<number>(Date.now());
  const lastIndexRef = useRef<number>(session.index);
  const finishedRef = useRef<boolean>(false);

  // Keep the callbacks fresh without re-subscribing the reconcile effect on
  // every parent render (the page passes inline closures).
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  // Reset the view anchor whenever the question changes for ANY reason —
  // including engine-driven auto-advance (sprint timeout / away-skip) that
  // doesn't route through a user action.
  useEffect(() => {
    if (session.index !== lastIndexRef.current) {
      lastIndexRef.current = session.index;
      viewStartTs.current = Date.now();
    }
  }, [session.index]);

  // THE reconcile loop: on mount + every tick, settle the session against the
  // wall clock. `resumeOaSession` is idempotent and handles section expiry and
  // sprint auto-advance/away-skip; a terminal result fires `onFinish` once.
  useEffect(() => {
    if (finishedRef.current) return;

    const reconciled = resumeOaSession(session, nowTs);
    if (reconciled.status !== "running") {
      finishedRef.current = true;
      onFinishRef.current(reconciled);
      return;
    }
    if (reconciled !== session) {
      onChangeRef.current(reconciled);
      return;
    }
    // Running but exhausted (index past the end) — submit rather than render
    // an empty question.
    if (!currentQuestion(session)) {
      finishedRef.current = true;
      onFinishRef.current(submitOaSession(session, nowTs));
    }
  }, [nowTs, session]);

  /**
   * Attribute the wall-clock time spent viewing the current question, keeping
   * whatever choice is already recorded, then re-anchor the view clock.
   */
  const commitElapsed = (state: OaSessionState): OaSessionState => {
    const current = state.answers[state.index];
    const next = recordAnswer(
      state,
      state.index,
      current ? current.chosen : null,
      nowTs - viewStartTs.current,
      nowTs,
    );
    viewStartTs.current = nowTs;
    return next;
  };

  const select = (choiceIdx: number) => {
    if (finishedRef.current) return;
    if (session.kind === "sprint") {
      // Set the choice, bank the view time, then auto-advance to a fresh clock.
      const withChoice = recordAnswer(session, session.index, choiceIdx, 0, nowTs);
      const committed = commitElapsed(withChoice);
      onChange(advanceSprint(committed, nowTs));
    } else {
      // Section / measured: record the choice + view time, but DON'T advance —
      // the learner navigates freely.
      const next = recordAnswer(
        session,
        session.index,
        choiceIdx,
        nowTs - viewStartTs.current,
        nowTs,
      );
      viewStartTs.current = nowTs;
      onChange(next);
    }
  };

  const skipSprint = () => {
    if (finishedRef.current) return;
    // Chosen stays null; bank view time, then advance.
    const skipped = recordAnswer(
      session,
      session.index,
      null,
      nowTs - viewStartTs.current,
      nowTs,
    );
    viewStartTs.current = nowTs;
    onChange(advanceSprint(skipped, nowTs));
  };

  const goTo = (index: number) => {
    if (finishedRef.current) return;
    onChange(navigateTo(commitElapsed(session), index));
  };

  const endSession = () => {
    if (finishedRef.current) return;
    const done = submitOaSession(commitElapsed(session), nowTs);
    finishedRef.current = true;
    onFinish(done);
  };

  // Nothing to render once terminal — the PAGE renders the report.
  if (session.status !== "running") return null;

  const question = currentQuestion(session);
  if (!question) return null;

  const answer = session.answers[session.index];
  const chosen = answer ? answer.chosen : null;
  const total = session.questions.length;

  const sectionMs = remainingSectionMs(session, nowTs);
  const questionMs = remainingQuestionMs(session, nowTs);
  const answeredCount = session.answers.filter((a) => a.chosen != null).length;
  const measuredElapsedMs =
    (answer ? answer.elapsedMs : 0) + Math.max(0, nowTs - viewStartTs.current);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* ---- header: clock / stopwatch + progress ---- */}
      <div className="flex items-end justify-between">
        <div>
          {session.kind === "sprint" && questionMs != null && (
            <>
              <span className="label">This question</span>
              <div
                className={`num text-4xl font-black ${
                  questionMs <= 10_000 ? "text-bear" : "text-primary"
                }`}
              >
                {clock(questionMs)}
              </div>
            </>
          )}
          {session.kind === "section" && sectionMs != null && (
            <>
              <span className="label">Section time</span>
              <div
                className={`num text-4xl font-black ${
                  sectionMs < 60_000 ? "text-bear" : "text-primary"
                }`}
              >
                {clock(sectionMs)}
              </div>
            </>
          )}
          {session.kind === "measured" && (
            <>
              <span className="label">This question</span>
              <div className="num text-4xl font-black text-primary">
                {(measuredElapsedMs / 1000).toFixed(1)}s
              </div>
            </>
          )}
        </div>
        <div className="text-right">
          <span className="label">Question</span>
          <div className="num text-2xl font-bold text-accent">
            {session.index + 1} / {total}
          </div>
          {session.kind !== "sprint" && (
            <div className="label mt-1 text-[10px] text-muted">
              {answeredCount} answered
            </div>
          )}
        </div>
      </div>

      {/* ---- prompt ---- */}
      <div className="panel p-6">
        {question.concept && (
          <div className="label mb-2 text-accent">{question.concept}</div>
        )}
        <p className="whitespace-pre-line text-lg font-semibold text-primary">
          {question.prompt}
        </p>
      </div>

      {/* ---- choices ---- */}
      <div className="grid gap-3">
        {question.choices.map((choice, i) => {
          const isChosen = chosen === i;
          return (
            <button
              key={i}
              onClick={() => select(i)}
              className={`flex items-start gap-3 border px-4 py-3 text-left transition-colors ${
                isChosen
                  ? "border-strong bg-surface-muted text-primary"
                  : "border-subtle bg-surface text-secondary hover:border-strong hover:text-primary"
              }`}
              aria-pressed={isChosen}
            >
              <span
                className={`num font-bold ${
                  isChosen ? "text-accent" : "text-muted"
                }`}
              >
                {String.fromCharCode(65 + i)}
              </span>
              <span className="num">{choice}</span>
            </button>
          );
        })}
      </div>

      {/* ---- per-kind navigation / actions ---- */}
      {session.kind === "sprint" && (
        <div className="flex gap-3">
          <button onClick={skipSprint} className="btn-secondary flex-1">
            Skip
          </button>
        </div>
      )}

      {session.kind === "section" && session.noBack && (
        // Module-locked: forward-only, no palette / no going back. The learner
        // answers in order and advances; the last question submits.
        <div className="space-y-4">
          <div className="label text-[10px] text-muted">
            Module-locked — you can&apos;t return to an earlier question.
          </div>
          {session.index < total - 1 ? (
            <button
              onClick={() => goTo(session.index + 1)}
              className="btn-primary w-full"
            >
              Next question →
            </button>
          ) : (
            <button onClick={endSession} className="btn-primary w-full">
              Submit section
            </button>
          )}
        </div>
      )}

      {session.kind === "section" && !session.noBack && (
        <div className="space-y-4">
          {/* Question palette for free navigation. */}
          <div className="flex flex-wrap gap-2">
            {session.questions.map((q, i) => {
              const done = session.answers[i]?.chosen != null;
              const isCurrent = i === session.index;
              return (
                <button
                  key={q.id}
                  onClick={() => goTo(i)}
                  className={`num h-8 w-8 border text-xs font-bold ${
                    isCurrent
                      ? "border-strong bg-accent text-bg"
                      : done
                        ? "border-subtle bg-surface-muted text-primary"
                        : "border-subtle bg-surface text-muted hover:text-primary"
                  }`}
                  aria-current={isCurrent}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => goTo(session.index - 1)}
              disabled={session.index === 0}
              className="btn-secondary flex-1 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => goTo(session.index + 1)}
              disabled={session.index >= total - 1}
              className="btn-secondary flex-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
          <button onClick={endSession} className="btn-primary w-full">
            Submit section
          </button>
        </div>
      )}

      {session.kind === "measured" && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <button
              onClick={() => goTo(session.index - 1)}
              disabled={session.index === 0}
              className="btn-secondary flex-1 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => goTo(session.index + 1)}
              disabled={session.index >= total - 1}
              className="btn-secondary flex-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
          <button onClick={endSession} className="btn-primary w-full">
            Finish
          </button>
        </div>
      )}

      {/* ---- always-available end-early affordance ---- */}
      <button onClick={endSession} className="btn-ghost w-full text-xs">
        End early &amp; submit
      </button>
    </div>
  );
}
