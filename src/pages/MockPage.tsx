import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { GameChrome } from "@/components/games/GameChrome";
import { BrainIcon, CheckIcon, CloseIcon } from "@/components/icons";
import { celebrate } from "@/lib/celebrate";
import {
  buildInterview,
  createSession,
  currentStep as getCurrentStep,
  gradeReasoning,
  buildReasoningClarifyPrompt,
  mockReducer,
  loadActiveSession,
  saveActiveSession,
  clearActiveSession,
  MOCK_PRESETS,
  PRESET_ORDER,
  referenceFirms,
  type MockAction,
  type PresetId,
  type BrainteaserStep,
  type BehavioralStep,
  type MockSession,
  type MockResponse,
} from "@/lib/mock";
import { useMockSpeech } from "@/components/mock/useMockSpeech";
import { AnswerField } from "@/components/mock/AnswerField";
import { MathInterviewCard } from "@/components/mock/MathInterviewCard";
import { MarketMakingCard } from "@/components/mock/MarketMakingCard";
import { ReasoningPanel } from "@/components/mock/ReasoningPanel";
import { ClarifyBlock } from "@/components/mock/ClarifyBlock";
import { DiagnosisReport } from "@/components/mock/DiagnosisReport";

/**
 * `/mock` — the AI-voice Mock Interview (TASK T10).
 *
 * A self-contained, full-screen themed page (its own layout, like FermiPage). It
 * is a thin renderer over the pure engine in `@/lib/mock`: it builds a seeded
 * interview, drives the state machine via `mockReducer`, and optionally listens
 * for dictated answers through the feature-detected wrapper. With no microphone
 * / SpeechRecognition the mic affordances simply vanish and the drill runs
 * entirely on typed input. No transcript is ever persisted — only the PII-free
 * summary is derived.
 */

const DEFAULT_PRESET: PresetId = "optiver";

/**
 * Plain-English, jargon-free one-liners for each firm style, shown on the intro
 * cards. Kept here (not in the pure preset data) so the copy stays first-timer
 * friendly without touching interview logic or the firm-pattern tests.
 */
const FIRM_BLURB: Record<PresetId, string> = {
  optiver: "Spot number patterns and quick odds, racing the clock.",
  janestreet: "Think out loud through puzzles, then set fair buy and sell prices.",
  sig: "Weigh the odds and decide how much you'd bet — calculator allowed.",
};

/**
 * Plain-English one-liners for the REFERENCE-ONLY firms — the seven with a
 * documented interview profile but no runnable mock. Shown read-only so a user
 * can see how those interviews work without ever being offered a mock that
 * can't actually assemble. Keyed by the blueprint's display name so the list
 * stays driven by `referenceFirms()` (the single source of truth for what is /
 * isn't wired). A firm without a blurb simply falls back to its blueprint gate.
 */
const REFERENCE_BLURB: Record<string, string> = {
  "Citadel Securities":
    "Probability and game-theory puzzles, then a market-making round where you bet on your own read.",
  IMC: "Mental math and pattern puzzles, then a trading game where they trade against you.",
  DRW: "A few very hard problems — then defend your answer by making a market on it.",
  "Five Rings": "Fast, typed probability and estimation — speed is the whole test.",
  HRT: "A coding stage plus green-book probability and expected-value math.",
  "Jump Trading": "Rapid mental math and probability, then market-intuition questions.",
  "Akuna Capital":
    "Arithmetic and sequence sprints, then a group betting game ranked by profit.",
};

function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31) >>> 0;
}

/**
 * Seed the page's session ONCE per mount: resume a persisted, still-running
 * interview (so leaving and returning to `/mock` picks up where you left off),
 * otherwise start a fresh intro. A persisted `intro`/`summary` blob is ignored
 * as a resume target — only an in-progress `running` session is resumable.
 */
function makeInitialSession(
  speechSupported: boolean,
  userId: string | null,
): MockSession {
  const resumed = loadActiveSession(userId);
  if (resumed && resumed.status === "running") return resumed;
  return createSession(
    buildInterview({ seed: randomSeed(), preset: DEFAULT_PRESET }),
    { speechSupported },
  );
}

export function MockPage() {
  const navigate = useNavigate();
  const { themeDef } = useTheme();
  const { username } = useAuth();
  const speech = useMockSpeech();

  // Resolve the initial (possibly resumed) session exactly once per mount,
  // scoped to the CURRENT user so we never resume another account's interview.
  const initialRef = useRef<MockSession | null>(null);
  if (initialRef.current === null) {
    initialRef.current = makeInitialSession(speech.canListen, username);
  }

  const [presetId, setPresetId] = useState<PresetId>(
    initialRef.current.script.presetId ?? DEFAULT_PRESET,
  );
  const [session, setSession] = useState<MockSession>(initialRef.current);
  // Which confirmation dialog (if any) is open while an interview is running:
  // "end" (the header End button) or "back" (the back arrow). `null` = closed.
  const [confirm, setConfirm] = useState<null | "end" | "back">(null);

  // Persist the in-progress session on every change so it survives navigation.
  // Only a `running` session is resumable; on `intro`/`summary` we CLEAR the
  // persisted blob (nothing to resume once you finish or reset to a new one).
  useEffect(() => {
    if (session.status === "running") {
      saveActiveSession(session, username);
    } else {
      clearActiveSession(username);
    }
  }, [session, username]);

  const dispatch = (action: Parameters<typeof mockReducer>[1]) =>
    setSession((s) => mockReducer(s, action));

  const step = getCurrentStep(session);
  const total = session.script.steps.length;

  const beginInterview = () => {
    const script = buildInterview({ seed: randomSeed(), preset: presetId });
    setSession(
      mockReducer(
        createSession(script, { speechSupported: speech.canListen }),
        { type: "start" },
      ),
    );
  };

  const newInterview = () => {
    const script = buildInterview({ seed: randomSeed(), preset: presetId });
    setSession(createSession(script, { speechSupported: speech.canListen }));
  };

  // --- End / exit affordances (only meaningful while `running`) --------------

  // Back arrow: while running, warn instead of silently leaving the saved
  // session behind (which would force-resume next time). On intro/summary there
  // is nothing in progress to lose, so leave immediately.
  const handleBack = () => {
    if (session.status === "running") {
      setConfirm("back");
      return;
    }
    navigate("/");
  };

  // "End & start over": discard the in-progress attempt and drop the user back
  // on the intro so they can pick a preset and start fresh. `clearActiveSession`
  // removes the user-scoped blob so it can never force-resume.
  const endAndStartOver = () => {
    clearActiveSession(username);
    newInterview();
    setConfirm(null);
  };

  // "End interview" from the back dialog: discard AND leave the page.
  const endAndExit = () => {
    clearActiveSession(username);
    setConfirm(null);
    navigate("/");
  };

  // "Resume later" from the back dialog: keep the saved session and leave; it
  // resumes on the next visit to `/mock`.
  const resumeLater = () => {
    setConfirm(null);
    navigate("/");
  };

  return (
    <GameChrome
      title="AI Mock Interview"
      onBack={handleBack}
      progress={
        session.status === "running"
          ? (session.index + 1) / total
          : undefined
      }
      headerRight={
        session.status === "running" ? (
          <div className="flex items-center gap-2">
            <span className="num text-xs text-secondary">
              {String(session.index + 1).padStart(2, "0")}/{total}
            </span>
            <button
              type="button"
              onClick={() => setConfirm("end")}
              aria-label="End interview"
              className="flex items-center gap-1 border-2 border-bear px-2 py-1 text-xs font-semibold text-bear transition-colors hover:bg-bear hover:text-bg"
            >
              <CloseIcon width={14} height={14} />
              End
            </button>
          </div>
        ) : undefined
      }
    >
        {session.status === "intro" && (
          <MockIntro
            presetId={presetId}
            setPresetId={setPresetId}
            canListen={speech.canListen}
            onStart={beginInterview}
          />
        )}

        {session.status === "running" && step && (
          <StepView
            key={step.id}
            session={session}
            speech={speech}
            dispatch={dispatch}
            onRecordReflect={(raw, viaSpeech, selfAssessed) =>
              dispatch({ type: "recordReflect", raw, viaSpeech, selfAssessed })
            }
            onNext={() => {
              speech.stopListening();
              dispatch({ type: "next" });
            }}
          />
        )}

        {session.status === "summary" && (
          <DiagnosisReport
            session={session}
            themeCelebration={themeDef.celebration ?? celebrate}
            onRestart={newInterview}
            onDone={() => navigate("/")}
          />
        )}

        {confirm === "end" && (
          <ConfirmDialog
            title="End this interview?"
            body="Real interviews run in a single sitting, so ending early means this attempt won't be completed. You can end now and start a new one."
            actions={[
              {
                label: "End & start over",
                variant: "danger",
                onClick: endAndStartOver,
              },
              {
                label: "Keep going",
                variant: "ghost",
                onClick: () => setConfirm(null),
              },
            ]}
            onDismiss={() => setConfirm(null)}
          />
        )}

        {confirm === "back" && (
          <ConfirmDialog
            title="Leave this interview?"
            body="Real interviews run in a single sitting. You can resume this attempt later, or end it now and nothing will be saved to resume."
            actions={[
              {
                label: "Resume later",
                variant: "primary",
                onClick: resumeLater,
              },
              {
                label: "End interview",
                variant: "danger",
                onClick: endAndExit,
              },
              {
                label: "Keep going",
                variant: "ghost",
                onClick: () => setConfirm(null),
              },
            ]}
            onDismiss={() => setConfirm(null)}
          />
        )}
    </GameChrome>
  );
}

/* -------------------------------------------------------------------------- */
/*  Confirm dialog (themed, inline) — end / leave a running interview          */
/* -------------------------------------------------------------------------- */

interface ConfirmAction {
  label: string;
  onClick: () => void;
  variant: "primary" | "danger" | "ghost";
}

/**
 * A small, self-contained themed confirm dialog. Deliberately inline to this
 * page (the only caller) rather than a new global component. Escape / scrim
 * click both dismiss (the safe, no-change action). Buttons stack full-width so
 * the two- and three-option variants share one layout.
 */
function ConfirmDialog({
  title,
  body,
  actions,
  onDismiss,
}: {
  title: string;
  body: string;
  actions: ConfirmAction[];
  onDismiss: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  const variantClass = (v: ConfirmAction["variant"]): string => {
    if (v === "primary") return "btn-primary w-full";
    if (v === "danger")
      return "w-full border-2 border-bear px-4 py-3 text-sm font-semibold text-bear transition-colors hover:bg-bear hover:text-bg";
    return "w-full border-2 border-border-strong px-4 py-3 text-sm font-semibold text-secondary transition-colors hover:border-accent hover:text-primary";
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={onDismiss}
        className="fixed inset-0 cursor-default bg-black/60"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="panel relative z-10 w-full max-w-md p-6 shadow-2xl motion-safe:animate-print-in"
      >
        <h2 className="font-display text-lg font-semibold leading-tight text-primary">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-secondary">{body}</p>
        <div className="mt-5 space-y-2">
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={a.onClick}
              className={variantClass(a.variant)}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Intro                                                                      */
/* -------------------------------------------------------------------------- */

function MockIntro({
  presetId,
  setPresetId,
  canListen,
  onStart,
}: {
  presetId: PresetId;
  setPresetId: (p: PresetId) => void;
  canListen: boolean;
  onStart: () => void;
}) {
  return (
    <div className="animate-print-in mx-auto max-w-2xl space-y-8">
      {/* Heading + one-line explanation */}
      <header className="space-y-3 text-center">
        <span className="mx-auto grid h-11 w-11 place-items-center border border-border-strong text-accent">
          <BrainIcon width={22} height={22} />
        </span>
        <h2 className="font-display text-2xl font-semibold leading-tight text-primary sm:text-3xl">
          Practice a real quant interview
        </h2>
        <p className="mx-auto max-w-md text-[15px] leading-relaxed text-secondary">
          An AI interviewer asks questions, listens to your answers, and grades
          you — then hands back an honest report.
        </p>
      </header>

      {/* Primary choice: pick a firm style */}
      <div className="space-y-3">
        <p className="text-center text-sm font-medium text-muted">
          Pick a style to practice
        </p>
        <div className="grid gap-3">
          {PRESET_ORDER.map((id) => {
            const p = MOCK_PRESETS[id];
            const active = presetId === id;
            return (
              <button
                key={id}
                onClick={() => setPresetId(id)}
                aria-pressed={active}
                className={`flex items-center gap-4 rounded-sm border-2 px-4 py-3 text-left transition-colors ${
                  active
                    ? "border-accent bg-surface-muted"
                    : "border-border-strong hover:border-accent"
                }`}
              >
                <span
                  className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${
                    active ? "border-accent" : "border-border-strong"
                  }`}
                >
                  {active && (
                    <span className="h-2.5 w-2.5 rounded-full bg-accent" />
                  )}
                </span>
                <span className="flex-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span
                      className={`font-display text-base font-semibold ${active ? "text-accent" : "text-primary"}`}
                    >
                      {p.name}
                    </span>
                    <span className="num shrink-0 text-xs text-muted">
                      {p.items.length} questions
                    </span>
                  </span>
                  <span className="mt-1 block text-sm leading-relaxed text-secondary">
                    {FIRM_BLURB[id]}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Obvious primary action */}
      <button onClick={onStart} className="btn-primary w-full">
        Start Interview ▸
      </button>

      {/* Reference profiles: the other firms we DON'T run a full mock for yet.
          Read-only + non-startable so the runnable choice above stays honest. */}
      <ReferenceProfiles />

      {/* Secondary, tucked-away details */}
      <div className="space-y-2 text-center text-xs leading-relaxed text-muted">
        {!canListen && (
          <p>Speech isn't available here, so you'll type your answers.</p>
        )}
        <p>
          Saved on this device only so you can resume — nothing is sent
          anywhere, and it clears when you finish.
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Reference profiles — the firms we DON'T run a full mock for (read-only)     */
/* -------------------------------------------------------------------------- */

/**
 * The seven reference-only firms (Citadel, IMC, DRW, Five Rings, HRT, Jump,
 * Akuna): documented interview styles with NO runnable preset. Rendered as
 * NON-INTERACTIVE, non-startable rows — deliberately not buttons — so the picker
 * above only ever offers the three mocks that can actually assemble, while the
 * rest are still surfaced honestly as "reference" material. Driven entirely by
 * `referenceFirms()`, so if a firm is ever wired to a preset it drops off this
 * list automatically.
 */
function ReferenceProfiles() {
  const firms = referenceFirms();
  if (firms.length === 0) return null;
  return (
    <section
      aria-label="Reference profiles"
      className="space-y-3 border-t border-subtle pt-6"
      data-testid="reference-profiles"
    >
      <div className="space-y-1 text-center">
        <p className="text-sm font-medium text-muted">
          Other firms · reference profiles
        </p>
        <p className="mx-auto max-w-md text-xs leading-relaxed text-muted">
          We don't run a full mock for these yet. Here's how their interviews
          are known to work — for reference, not a drill you can start.
        </p>
      </div>
      <ul className="grid gap-2">
        {firms.map((f) => (
          <li
            key={f.firm}
            className="flex items-start gap-3 rounded-sm border border-subtle px-4 py-3"
          >
            <span className="flex-1">
              <span className="flex items-baseline justify-between gap-3">
                <span className="font-display text-sm font-semibold text-secondary">
                  {f.firm}
                </span>
                <span className="chip shrink-0 border-subtle text-muted">
                  Reference
                </span>
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-muted">
                {REFERENCE_BLURB[f.firm] ?? f.gate}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Running — dispatch to the right card by step kind                         */
/* -------------------------------------------------------------------------- */

type SpeechApi = ReturnType<typeof useMockSpeech>;

function StepView({
  session,
  speech,
  dispatch,
  onRecordReflect,
  onNext,
}: {
  session: MockSession;
  speech: SpeechApi;
  dispatch: (a: MockAction) => void;
  onRecordReflect: (
    raw: string,
    viaSpeech: boolean,
    selfAssessed?: "got" | "missed",
  ) => void;
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
        onRecord={onRecordReflect}
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
    <BehavioralCard
      step={step}
      speech={speech}
      isLast={isLast}
      onRecord={onRecordReflect}
      onNext={onNext}
    />
  );
}

function StageBadge({ label }: { label: string }) {
  return <span className="chip border-subtle text-secondary">{label}</span>;
}

/* -------------------------------------------------------------------------- */
/*  Brainteaser card (timed, reflect + self-assess + reasoning grade)          */
/* -------------------------------------------------------------------------- */

function BrainteaserCard({
  step,
  response,
  speech,
  isLast,
  dispatch,
  onRecord,
  onNext,
}: {
  step: BrainteaserStep;
  response: MockResponse | null;
  speech: SpeechApi;
  isLast: boolean;
  dispatch: (a: MockAction) => void;
  onRecord: (
    raw: string,
    viaSpeech: boolean,
    selfAssessed?: "got" | "missed",
  ) => void;
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

  // Once the candidate self-assesses, grade their reasoning quality (AI or
  // deterministic). Correctness (got/missed) is theirs — the LLM only judges
  // how they reasoned, never flips the verdict.
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
    ).then((g) => {
      if (!cancelled) dispatch({ type: "applyReasoningGrade", stepId: step.id, grade: g });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selfAssessed, grade]);

  // When the brainteaser reasoning is MIXED / contradictory / hedged, force ONE
  // clarifying commit before advancing (same rock-solid gate as the math card).
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
    onRecord(raw, false, sa);
    speech.stopListening();
  };

  const mmss = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;

  return (
    <div className="animate-print-in space-y-4">
      <div className="panel p-5">
        <div className="flex items-center justify-between border-b border-subtle pb-2">
          <span className="label text-accent">Brainteaser · Under time</span>
          <span
            className={`num chip ${remaining <= 15 && !revealed ? "border-bear text-bear" : "border-subtle text-secondary"}`}
          >
            {revealed ? "revealed" : `${mmss} left`}
          </span>
        </div>
        <p className="mt-3 text-[15px] font-medium leading-relaxed text-primary">
          {step.prompt}
        </p>
        {step.concept && (
          <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-muted">
            Theme · {step.concept}
          </p>
        )}
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
          <p className="mt-2 text-xs text-muted">
            This is reflect-only: nothing here is scored. Reveal when ready (or
            when time's up).
          </p>
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

          <FollowUps title="Probing follow-ups" items={step.probes} />

          {selfAssessed === undefined ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => reveal("got")}
                className="flex items-center justify-center gap-2 border-2 border-bull px-4 py-3 text-sm font-semibold text-bull hover:bg-bull hover:text-bg"
              >
                <CheckIcon width={16} height={16} /> I got it
              </button>
              <button
                onClick={() => reveal("missed")}
                className="flex items-center justify-center gap-2 border-2 border-border-strong px-4 py-3 text-sm font-semibold text-secondary hover:border-bear hover:text-bear"
              >
                <CloseIcon width={16} height={16} /> I missed it
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
                <button onClick={onNext} className="btn-primary w-full">
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
/*  Behavioral card (reflect-only, never scored)                               */
/* -------------------------------------------------------------------------- */

function BehavioralCard({
  step,
  speech,
  isLast,
  onRecord,
  onNext,
}: {
  step: BehavioralStep;
  speech: SpeechApi;
  isLast: boolean;
  onRecord: (raw: string, viaSpeech: boolean) => void;
  onNext: () => void;
}) {
  const [raw, setRaw] = useState("");

  // Behavioral prompts are UNSCORED prep flashcards presented at the very end:
  // record any reflection transiently (for resume) but never gate the flow on it.
  const advance = () => {
    onRecord(raw, false);
    speech.stopListening();
    onNext();
  };

  return (
    <div className="animate-print-in space-y-4">
      <div className="border-l-2 border-accent bg-surface-muted px-4 py-3">
        <div className="label text-accent">Prep flashcard · NOT scored</div>
        <p className="mt-1 text-sm leading-relaxed text-secondary">
          Behavioral questions do not factor into your mock score — they're
          practice prompts. Rehearse an answer out loud, then check it against
          what a strong response covers.
        </p>
      </div>

      <div className="panel p-5">
        <div className="flex items-center justify-between border-b border-subtle pb-2">
          <span className="label text-accent">Behavioral · Fit</span>
          <StageBadge label="Unscored" />
        </div>
        <p className="mt-3 font-display text-lg font-semibold leading-relaxed text-primary">
          {step.prompt}
        </p>
        {step.followUp && (
          <p className="mt-2 text-sm italic text-secondary">
            Follow-up: {step.followUp}
          </p>
        )}
      </div>

      <div className="panel p-5">
        <span className="label text-accent">
          What a strong answer covers
        </span>
        <ul className="mt-2 space-y-1.5 text-sm text-secondary">
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
        <p className="mt-2 text-xs text-muted">
          Kept only on this device to let you resume; cleared when you finish.
        </p>
      </div>

      <button onClick={advance} className="btn-primary w-full">
        {isLast ? "See Results ▸" : "Next Flashcard ▸"}
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Shared: follow-up probe list                                               */
/* -------------------------------------------------------------------------- */

function FollowUps({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="border-l-2 border-accent bg-surface-muted px-4 py-3">
      <div className="label text-accent">{title}</div>
      <ul className="mt-2 space-y-1.5 text-sm text-secondary">
        {items.map((q, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="num mt-0.5 text-xs font-semibold text-accent">
              Q{i + 1}
            </span>
            <span>{q}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

