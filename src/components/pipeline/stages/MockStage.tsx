import { useEffect, useMemo, useRef, useState } from "react";
import { useProgress } from "@/context/ProgressContext";
import {
  buildInterview,
  buildReasoningClarifyPrompt,
  createSession,
  currentStep as getCurrentStep,
  gradeReasoning,
  mockReducer,
  type BehavioralStep,
  type BrainteaserStep,
  type MockAction,
  type MockResponse,
  type MockSession,
} from "@/lib/mock";
import { MOCK_CONSECUTIVE, MOCK_GATE_PCT } from "@/lib/pipeline/gates";
import {
  assembleThoroughMock,
  buildMockResult,
  currentMockStreak,
  type ThoroughMockSpec,
} from "@/lib/pipeline/mockLoop";
import { AnswerField } from "@/components/mock/AnswerField";
import { MathInterviewCard } from "@/components/mock/MathInterviewCard";
import { MarketMakingCard } from "@/components/mock/MarketMakingCard";
import { ReasoningPanel } from "@/components/mock/ReasoningPanel";
import { ClarifyBlock } from "@/components/mock/ClarifyBlock";
import { useMockSpeech } from "@/components/mock/useMockSpeech";
import type { StageComponentProps } from "../stageRegistry";

/**
 * ============================================================================
 *  STAGE 7 — MOCK INTERVIEW  (guided pipeline, Phase P7)
 * ============================================================================
 * Runs ONE full, thorough, all-topics, TIMED firm-style mock through the
 * EXISTING mock-interview engine (spec §2 Stage 7 / §3.6 / §10.4). Nothing about
 * the engine is rebuilt — this is a thin renderer:
 *   • the interview is assembled by `assembleThoroughMock` (mockLoop), which
 *     cycles the firm presets (Optiver → Jane Street → SIG) and is NOT weighted
 *     toward the user's weaknesses — a real mock covers everything;
 *   • `buildInterview` / `createSession` / `mockReducer` drive the deterministic
 *     script + state machine, and the exported cards render each step: the
 *     scored numeric card (`MathInterviewCard` — clarify flow, strict reasoning
 *     grading, model-answer-on-flaw) and `MarketMakingCard`; brainteaser +
 *     behavioral steps render through the same graders (`gradeReasoning`,
 *     `ClarifyBlock`, `ReasoningPanel`);
 *   • the neural-TTS voice speaks each prompt (best-effort, via `useMockSpeech`).
 *
 * When the interview finishes it computes the mock's `scorePct` + `wouldPass`
 * verdict via `buildMockResult` (which REUSES `computePerformance` +
 * `deterministicDiagnosis`) and hands a {@link PipelineMockResult} back through
 * `onComplete(result)`. The coordinator appends it to `progress.pipeline.mocks`
 * and re-resolves the stage; a sub-90% mock resets the streak (§10.4), so the
 * user simply re-enters this stage for the next mock.
 *
 * CONTRACT: a {@link StageComponent} — receives only `onComplete`, owns no
 * navigation, and calls `onComplete` exactly once.
 */

type SpeechApi = ReturnType<typeof useMockSpeech>;

function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31) >>> 0;
}

export default function MockStage({ onComplete }: StageComponentProps) {
  const { progress } = useProgress();
  const speech = useMockSpeech();

  // The current consecutive-≥90% streak, resolved ONCE per mount, decides both
  // the live "Mock N of 3" readout AND which firm preset this mock cycles to.
  const streakRef = useRef<number>(currentMockStreak(progress));
  const specRef = useRef<ThoroughMockSpec | null>(null);
  if (specRef.current === null) {
    specRef.current = assembleThoroughMock({
      mockIndex: streakRef.current,
      seed: randomSeed(),
    });
  }
  const spec = specRef.current;

  const [session, setSession] = useState<MockSession>(() =>
    mockReducer(
      createSession(buildInterview(spec.config), {
        speechSupported: speech.canListen,
      }),
      { type: "start" },
    ),
  );
  const [elapsedSec, setElapsedSec] = useState(0);
  const doneRef = useRef(false);

  const dispatch = (action: MockAction) =>
    setSession((s) => mockReducer(s, action));

  const step = getCurrentStep(session);
  const total = session.script.steps.length;

  // A running session clock — the mock is TIMED (per-question targets live on
  // each card; this is the overall wall clock for the sitting).
  useEffect(() => {
    if (session.status !== "running") return;
    const id = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [session.status]);

  // Speak each prompt aloud as it appears (best-effort; silent if unsupported).
  const spokenKey = `${session.status}:${session.index}`;
  const lastSpokenRef = useRef<string>("");
  useEffect(() => {
    if (!speech.canSpeak) return;
    if (session.status !== "running" || !step) return;
    if (lastSpokenRef.current === spokenKey) return;
    lastSpokenRef.current = spokenKey;
    speech.speak(step.prompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spokenKey, session.status]);

  // Compute the result once the interview reaches its summary (pure + reused).
  const result = useMemo(
    () => (session.status === "summary" ? buildMockResult(session) : null),
    [session],
  );

  const finish = () => {
    if (doneRef.current || !result) return;
    doneRef.current = true;
    onComplete(result);
  };

  const mockNumber = streakRef.current + 1;

  return (
    <section className="panel space-y-5 p-6" data-testid="mock-stage">
      <header className="space-y-1">
        <span className="label text-accent">Stage 7 · Mock interview</span>
        <h2 className="font-display text-2xl font-bold text-primary">
          {spec.presetName}
        </h2>
        <p className="text-sm text-secondary">
          A thorough, timed, firm-style mock across every topic — not tuned to
          your weak spots, because a real interview isn't. Clear{" "}
          <span className="num">≥{MOCK_GATE_PCT}%</span> on{" "}
          <span className="num">{MOCK_CONSECUTIVE}</span> in a row to pass.
        </p>
      </header>

      <div className="rule-row flex-wrap" data-testid="mock-streak">
        <span className="label text-muted">
          Mock {Math.min(mockNumber, MOCK_CONSECUTIVE)} of {MOCK_CONSECUTIVE}{" "}
          consecutive ≥{MOCK_GATE_PCT}%
        </span>
        <span className="num chip border-subtle text-secondary">
          {session.status === "running"
            ? `${String(session.index + 1).padStart(2, "0")} / ${total}`
            : "done"}
          {" · "}
          {mmss(elapsedSec)}
        </span>
      </div>

      {session.status === "running" && step && (
        <StepView
          key={step.id}
          session={session}
          speech={speech}
          dispatch={dispatch}
          onNext={() => {
            speech.stopListening();
            dispatch({ type: "next" });
          }}
        />
      )}

      {session.status === "summary" && result && (
        <MockSummary
          result={result}
          streak={streakRef.current}
          onFinish={finish}
        />
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Summary — score vs the 90% bar + the live streak, then hand back          */
/* -------------------------------------------------------------------------- */

function MockSummary({
  result,
  streak,
  onFinish,
}: {
  result: { scorePct: number; wouldPass: string };
  streak: number;
  onFinish: () => void;
}) {
  const passed = result.scorePct >= MOCK_GATE_PCT && result.wouldPass !== "no";
  // A pass advances the streak by one; a fail resets it to 0 (§10.4).
  const nextStreak = passed ? Math.min(streak + 1, MOCK_CONSECUTIVE) : 0;
  const cleared = passed && nextStreak >= MOCK_CONSECUTIVE;
  return (
    <div className="space-y-4" data-testid="mock-summary">
      <div className="panel-ruled p-6 text-center">
        <span className={`label ${passed ? "text-bull" : "text-bear"}`}>
          {passed ? `Cleared ≥ ${MOCK_GATE_PCT}%` : `Below the ${MOCK_GATE_PCT}% bar`}
        </span>
        <div
          className="num mt-2 font-display text-6xl font-black leading-none text-primary"
          data-testid="mock-score"
        >
          {result.scorePct}%
        </div>
        <p className="mt-3 text-sm leading-relaxed text-secondary">
          {passed
            ? nextStreak >= MOCK_CONSECUTIVE
              ? "Three in a row — the mock gate is cleared."
              : `Streak now ${nextStreak} of ${MOCK_CONSECUTIVE}. Keep it going.`
            : "Streak reset to 0 — a real mock is all-or-nothing. Drill, then run it again."}
        </p>
      </div>

      <button
        type="button"
        className="btn-primary w-full"
        onClick={onFinish}
        data-testid="mock-finish"
      >
        {cleared ? "Continue to greenlight →" : passed ? "Next mock →" : "Back to drilling →"}
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Step dispatch — one card per step kind (reuses the exported mock cards)   */
/* -------------------------------------------------------------------------- */

function StepView({
  session,
  speech,
  dispatch,
  onNext,
}: {
  session: MockSession;
  speech: SpeechApi;
  dispatch: (a: MockAction) => void;
  onNext: () => void;
}) {
  const step = getCurrentStep(session)!;
  const response = session.responses.find((r) => r.stepId === step.id) ?? null;
  const isLast = session.index === session.script.steps.length - 1;

  if (step.kind === "math") {
    return (
      <MathInterviewCard
        step={step}
        response={response}
        speech={speech}
        isLast={isLast}
        dispatch={dispatch}
        onNext={onNext}
      />
    );
  }
  if (step.kind === "brainteaser") {
    return (
      <BrainteaserCard
        step={step}
        response={response}
        speech={speech}
        isLast={isLast}
        dispatch={dispatch}
        onNext={onNext}
      />
    );
  }
  if (step.kind === "marketMaking") {
    return (
      <MarketMakingCard
        step={step}
        response={response}
        isLast={isLast}
        dispatch={dispatch}
        onNext={onNext}
      />
    );
  }
  return (
    <BehavioralCard step={step} speech={speech} isLast={isLast} onNext={onNext} />
  );
}

/* -------------------------------------------------------------------------- */
/*  Brainteaser card (timed reveal + self-assess + reasoning grade + clarify) */
/* -------------------------------------------------------------------------- */

function BrainteaserCard({
  step,
  response,
  speech,
  isLast,
  dispatch,
  onNext,
}: {
  step: BrainteaserStep;
  response: MockResponse | null;
  speech: SpeechApi;
  isLast: boolean;
  dispatch: (a: MockAction) => void;
  onNext: () => void;
}) {
  const [raw, setRaw] = useState("");
  const [clarifyVal, setClarifyVal] = useState("");
  const [remaining, setRemaining] = useState(step.timeLimitSec);
  const revealed = response !== null;
  const selfAssessed = response?.selfAssessed;
  const grade = response?.reasoningGrade ?? null;
  const clarify = response?.clarify ?? null;
  const clarifyStartRef = useRef<number>(0);

  useEffect(() => {
    if (revealed) return;
    const id = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(id);
  }, [revealed]);

  // Grade reasoning QUALITY once self-assessed (AI or deterministic). Self-graded
  // correctness (got/missed) is the candidate's; the grade never flips it.
  const gradingRef = useRef(false);
  useEffect(() => {
    if (selfAssessed === undefined || grade || gradingRef.current) return;
    gradingRef.current = true;
    let cancelled = false;
    gradeReasoning(
      {
        prompt: step.prompt,
        correctAnswer: step.answer,
        correct: selfAssessed === "got",
        reasoning: response?.reasoningRaw ?? "",
        isMentalMath: false,
      },
      { concept: step.concept },
    )
      .then((g) => {
        if (!cancelled)
          dispatch({ type: "applyReasoningGrade", stepId: step.id, grade: g });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selfAssessed, grade]);

  // MIXED / contradictory reasoning forces ONE commit (same gate as the math card).
  const clarifyAskedRef = useRef(false);
  useEffect(() => {
    if (!grade || grade.quality !== "ambiguous") return;
    if (clarify || clarifyAskedRef.current) return;
    clarifyAskedRef.current = true;
    clarifyStartRef.current = Date.now();
    dispatch({
      type: "askClarify",
      stepId: step.id,
      target: "main",
      prompt:
        grade.clarifyPrompt ??
        buildReasoningClarifyPrompt({
          prompt: step.prompt,
          correctAnswer: step.answer,
          correct: selfAssessed === "got",
          reasoning: response?.reasoningRaw ?? "",
          isMentalMath: false,
        }),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grade, clarify]);

  const reasoningResolved =
    grade != null &&
    (grade.quality !== "ambiguous" || (clarify?.graded ?? false));

  const submitClarify = () => {
    if (clarifyVal.trim() === "" || clarify?.graded) return;
    const elapsedMs = Date.now() - (clarifyStartRef.current || Date.now());
    dispatch({
      type: "recordClarify",
      stepId: step.id,
      target: "main",
      raw: clarifyVal,
      viaSpeech: false,
      elapsedMs,
    });
    speech.stopListening();
  };

  const reveal = (sa?: "got" | "missed") => {
    dispatch({ type: "recordReflect", raw, viaSpeech: false, selfAssessed: sa });
    speech.stopListening();
  };

  const mmssLeft = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;

  return (
    <div className="animate-print-in space-y-4">
      <div className="panel p-5">
        <div className="flex items-center justify-between border-b border-subtle pb-2">
          <span className="label text-accent">Brainteaser · Under time</span>
          <span
            className={`num chip ${remaining <= 15 && !revealed ? "border-bear text-bear" : "border-subtle text-secondary"}`}
          >
            {revealed ? "revealed" : `${mmssLeft} left`}
          </span>
        </div>
        <p className="mt-3 text-[15px] font-medium leading-relaxed text-primary">
          {step.prompt}
        </p>
      </div>

      {!revealed && (
        <div className="panel p-5">
          <label className="label text-accent">
            Think out loud: jot your reasoning (optional)
          </label>
          <div className="mt-2">
            <AnswerField
              value={raw}
              onChange={setRaw}
              onSubmit={() => reveal()}
              speech={speech}
              multiline
              placeholder="Sketch your approach, bounds, key insight…"
              ariaLabel="Your reasoning for the brainteaser"
              submitLabel="Reveal ▸"
            />
          </div>
        </div>
      )}

      {revealed && (
        <div className="animate-print-in space-y-4">
          <div className="panel p-5">
            <span className="label text-accent">Answer</span>
            <p className="mt-2 whitespace-pre-line text-[15px] font-semibold leading-relaxed text-primary">
              {step.answer}
            </p>
            <div className="mt-3 border-t border-subtle pt-3">
              <span className="label text-secondary">Why</span>
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-secondary">
                {step.explanation}
              </p>
            </div>
          </div>

          {selfAssessed === undefined ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => reveal("got")}
                className="rounded border border-bull px-4 py-3 font-mono text-[11px] font-semibold uppercase tracking-label text-bull transition-colors hover:bg-bull hover:text-bg"
                style={{ minHeight: 44 }}
              >
                I got it
              </button>
              <button
                type="button"
                onClick={() => reveal("missed")}
                className="rounded border border-border-strong px-4 py-3 font-mono text-[11px] font-semibold uppercase tracking-label text-secondary transition-colors hover:border-bear hover:text-bear"
                style={{ minHeight: 44 }}
              >
                I missed it
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <ReasoningPanel grade={grade} loading={!grade} />
              {clarify && (
                <ClarifyBlock
                  clarify={clarify}
                  value={clarifyVal}
                  onChange={setClarifyVal}
                  onSubmit={submitClarify}
                  speech={speech}
                />
              )}
              {reasoningResolved && (
                <button
                  type="button"
                  onClick={onNext}
                  className="btn-primary w-full"
                >
                  {isLast ? "See Results ▸" : "Next Question ▸"}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Behavioral card (reflect-only, never scored)                              */
/* -------------------------------------------------------------------------- */

function BehavioralCard({
  step,
  speech,
  isLast,
  onNext,
}: {
  step: BehavioralStep;
  speech: SpeechApi;
  isLast: boolean;
  onNext: () => void;
}) {
  const [raw, setRaw] = useState("");
  const advance = () => {
    speech.stopListening();
    onNext();
  };
  return (
    <div className="animate-print-in space-y-4">
      <div className="aside">
        <div className="label text-accent">Prep flashcard · NOT scored</div>
        <p className="mt-1 text-sm leading-relaxed text-secondary">
          Behavioral questions don't factor into your mock score — rehearse an
          answer, then move on.
        </p>
      </div>
      <div className="panel p-5">
        <div className="flex items-center justify-between border-b border-subtle pb-2">
          <span className="label text-accent">Behavioral · Fit</span>
          <span className="chip border-subtle text-secondary">Unscored</span>
        </div>
        <p className="mt-3 font-display text-lg font-semibold leading-relaxed text-primary">
          {step.prompt}
        </p>
        {step.followUp && (
          <p className="mt-2 text-sm italic text-secondary">
            Follow-up: {step.followUp}
          </p>
        )}
        <ul className="mt-3 space-y-1.5 text-sm text-secondary">
          {step.reflectionHints.map((h, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 bg-accent" />
              <span>{h}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="panel p-5">
        <label className="label text-accent">
          Rehearse a response (optional, for your own review)
        </label>
        <div className="mt-2">
          <AnswerField
            value={raw}
            onChange={setRaw}
            onSubmit={advance}
            speech={speech}
            multiline
            placeholder="Speak or type — nothing here is scored"
            ariaLabel="Your behavioral rehearsal"
            submitLabel={isLast ? "See Results ▸" : "Next ▸"}
          />
        </div>
      </div>
      <button type="button" onClick={advance} className="btn-primary w-full">
        {isLast ? "See Results ▸" : "Next Flashcard ▸"}
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  helpers                                                                   */
/* -------------------------------------------------------------------------- */

function mmss(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
