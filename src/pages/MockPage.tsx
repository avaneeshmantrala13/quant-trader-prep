import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/context/ThemeContext";
import { GameChrome } from "@/components/games/GameChrome";
import { StampSeal } from "@/components/visuals/StampSeal";
import { BrainIcon, CheckIcon, CloseIcon } from "@/components/icons";
import { celebrate } from "@/lib/celebrate";
import {
  buildInterview,
  createSession,
  currentStep as getCurrentStep,
  mockReducer,
  toPersistableSummary,
  loadActiveSession,
  saveActiveSession,
  clearActiveSession,
  type MathTier,
  type MathStep,
  type BrainteaserStep,
  type BehavioralStep,
  type MockSession,
  type MockResponse,
} from "@/lib/mock";
import { useMockSpeech } from "@/components/mock/useMockSpeech";
import { AnswerField } from "@/components/mock/AnswerField";

/**
 * `/mock` — the AI-voice Mock Interview (TASK T10).
 *
 * A self-contained, full-screen themed page (its own layout, like FermiPage). It
 * is a thin renderer over the pure engine in `@/lib/mock`: it builds a seeded
 * interview, drives the state machine via `mockReducer`, and speaks/listens
 * through the feature-detected wrapper. With no microphone / SpeechRecognition
 * the mic affordances simply vanish and the drill runs entirely on typed input.
 * No transcript is ever persisted — only the PII-free summary is derived.
 */

const TIER_LABEL: Record<MathTier, string> = {
  easy: "Warm-up",
  medium: "Standard",
  hard: "Optiver pace",
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
function makeInitialSession(speechSupported: boolean): MockSession {
  const resumed = loadActiveSession();
  if (resumed && resumed.status === "running") return resumed;
  return createSession(buildInterview({ seed: randomSeed(), tier: "medium" }), {
    speechSupported,
  });
}

export function MockPage() {
  const navigate = useNavigate();
  const { themeDef } = useTheme();
  const speech = useMockSpeech();

  // Resolve the initial (possibly resumed) session exactly once per mount.
  const initialRef = useRef<MockSession | null>(null);
  if (initialRef.current === null) {
    initialRef.current = makeInitialSession(speech.canListen);
  }

  const [tier, setTier] = useState<MathTier>(initialRef.current.script.tier);
  const [voiceOn, setVoiceOn] = useState(true);
  const [session, setSession] = useState<MockSession>(initialRef.current);

  // Persist the in-progress session on every change so it survives navigation.
  // Only a `running` session is resumable; on `intro`/`summary` we CLEAR the
  // persisted blob (nothing to resume once you finish or reset to a new one).
  useEffect(() => {
    if (session.status === "running") {
      saveActiveSession(session);
    } else {
      clearActiveSession();
    }
  }, [session]);

  const dispatch = (action: Parameters<typeof mockReducer>[1]) =>
    setSession((s) => mockReducer(s, action));

  const step = getCurrentStep(session);
  const total = session.script.steps.length;

  const beginInterview = () => {
    const script = buildInterview({ seed: randomSeed(), tier });
    setSession(
      mockReducer(
        createSession(script, { speechSupported: speech.canListen }),
        { type: "start" },
      ),
    );
  };

  const newInterview = () => {
    speech.cancelSpeech();
    const script = buildInterview({ seed: randomSeed(), tier });
    setSession(createSession(script, { speechSupported: speech.canListen }));
  };

  // Speak each prompt aloud as it appears (best-effort; silent if unsupported).
  const spokenKey = `${session.status}:${session.index}`;
  const lastSpokenRef = useRef<string>("");
  useEffect(() => {
    if (!voiceOn || !speech.canSpeak) return;
    if (session.status !== "running" || !step) return;
    if (lastSpokenRef.current === spokenKey) return;
    lastSpokenRef.current = spokenKey;
    speech.speak(step.prompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spokenKey, voiceOn, session.status]);

  return (
    <GameChrome
      title="AI Mock Interview"
      onBack={() => {
        speech.cancelSpeech();
        navigate("/");
      }}
      progress={
        session.status === "running"
          ? (session.index + 1) / total
          : undefined
      }
      headerRight={
        session.status === "running" ? (
          <span className="num text-xs text-secondary">
            {String(session.index + 1).padStart(2, "0")}/{total}
          </span>
        ) : undefined
      }
    >
        {session.status === "intro" && (
          <MockIntro
            tier={tier}
            setTier={setTier}
            canSpeak={speech.canSpeak}
            canListen={speech.canListen}
            voiceOn={voiceOn}
            setVoiceOn={setVoiceOn}
            intro={session.script.intro}
            onStart={beginInterview}
          />
        )}

        {session.status === "running" && step && (
          <StepView
            key={step.id}
            session={session}
            speech={speech}
            onRecordMath={(raw, viaSpeech, elapsedMs) =>
              dispatch({ type: "recordMath", raw, viaSpeech, elapsedMs })
            }
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
          <MockSummaryView
            session={session}
            themeCelebration={themeDef.celebration ?? celebrate}
            onRestart={newInterview}
            onDone={() => navigate("/")}
          />
        )}
    </GameChrome>
  );
}

/* -------------------------------------------------------------------------- */
/*  Intro                                                                      */
/* -------------------------------------------------------------------------- */

function MockIntro({
  tier,
  setTier,
  canSpeak,
  canListen,
  voiceOn,
  setVoiceOn,
  intro,
  onStart,
}: {
  tier: MathTier;
  setTier: (t: MathTier) => void;
  canSpeak: boolean;
  canListen: boolean;
  voiceOn: boolean;
  setVoiceOn: (v: boolean) => void;
  intro: string;
  onStart: () => void;
}) {
  const speechAvailable = canSpeak || canListen;
  return (
    <div className="animate-print-in space-y-5">
      <article className="panel-ruled p-6">
        <div className="flex items-center justify-between">
          <span className="label text-accent">Mock Interview</span>
          <span className="grid h-9 w-9 place-items-center border border-border-strong text-accent">
            <BrainIcon width={20} height={20} />
          </span>
        </div>
        <h2 className="mt-2 font-display text-2xl font-semibold leading-tight text-primary">
          Sit across from an AI interviewer
        </h2>
        <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-secondary">
          <p>{intro}</p>
          <p>
            Three parts:{" "}
            <span className="font-semibold text-primary">mental math</span> out
            loud (scored, with follow-ups),{" "}
            <span className="font-semibold text-primary">brainteasers</span>{" "}
            under time (think aloud, then reveal), and{" "}
            <span className="font-semibold text-primary">behavioral</span>{" "}
            questions (reflect-only — nothing judged).
          </p>
        </div>

        {/* Difficulty */}
        <div className="mt-5">
          <div className="label text-accent">Mental-math pace</div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(["easy", "medium", "hard"] as MathTier[]).map((t) => (
              <button
                key={t}
                onClick={() => setTier(t)}
                aria-pressed={tier === t}
                className={`border-2 px-3 py-2 text-sm font-semibold transition-colors ${
                  tier === t
                    ? "border-accent bg-accent text-accent-contrast"
                    : "border-border-strong text-secondary hover:border-accent"
                }`}
              >
                {TIER_LABEL[t]}
              </button>
            ))}
          </div>
        </div>

        {/* Voice status + toggle */}
        <div className="mt-5 border-l-2 border-accent bg-surface-muted px-4 py-3">
          <div className="label text-accent">Voice</div>
          {speechAvailable ? (
            <div className="mt-1 space-y-2">
              <p className="text-sm leading-relaxed text-secondary">
                Your browser supports speech. {canSpeak && "The interviewer can read questions aloud"}
                {canSpeak && canListen && " and "}
                {canListen && "you can dictate answers with the mic"}. You can
                always type instead.
              </p>
              {canSpeak && (
                <label className="flex cursor-pointer items-center gap-2 text-sm text-primary">
                  <input
                    type="checkbox"
                    checked={voiceOn}
                    onChange={(e) => setVoiceOn(e.target.checked)}
                    className="h-4 w-4 accent-[var(--tw-accent,currentColor)]"
                  />
                  Read questions aloud
                </label>
              )}
            </div>
          ) : (
            <p className="mt-1 text-sm leading-relaxed text-secondary">
              Speech isn't available in this browser, so this runs as a fully
              typed interview — every question and answer works exactly the same.
            </p>
          )}
        </div>

        <p className="mt-4 border-t border-subtle pt-3 font-mono text-xs uppercase tracking-wider text-muted">
          Privacy · Your in-progress interview is saved on THIS device only so
          you can resume where you left off — nothing is sent anywhere, and it's
          cleared automatically when you finish or start a new interview.
        </p>
      </article>

      <button onClick={onStart} className="btn-primary w-full">
        Start Interview ▸
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Running — dispatch to the right card by step kind                         */
/* -------------------------------------------------------------------------- */

type SpeechApi = ReturnType<typeof useMockSpeech>;

function StepView({
  session,
  speech,
  onRecordMath,
  onRecordReflect,
  onNext,
}: {
  session: MockSession;
  speech: SpeechApi;
  onRecordMath: (raw: string, viaSpeech: boolean, elapsedMs: number) => void;
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
      <MathCard
        step={step}
        response={response}
        speech={speech}
        isLast={isLast}
        onRecord={onRecordMath}
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
        onRecord={onRecordReflect}
        onNext={onNext}
      />
    );
  }
  return (
    <BehavioralCard
      step={step}
      response={response}
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
/*  Math card (scored)                                                         */
/* -------------------------------------------------------------------------- */

function MathCard({
  step,
  response,
  speech,
  isLast,
  onRecord,
  onNext,
}: {
  step: MathStep;
  response: MockResponse | null;
  speech: SpeechApi;
  isLast: boolean;
  onRecord: (raw: string, viaSpeech: boolean, elapsedMs: number) => void;
  onNext: () => void;
}) {
  const [raw, setRaw] = useState("");
  const startRef = useRef<number>(Date.now());
  const answered = response !== null;
  const score = response?.score;

  const submit = () => {
    if (answered || raw.trim() === "") return;
    const elapsedMs = Date.now() - startRef.current;
    onRecord(raw, speech.listening || speech.interim !== "", elapsedMs);
    speech.stopListening();
  };

  return (
    <div className="animate-print-in space-y-4">
      <div className="panel p-5">
        <div className="flex items-center justify-between border-b border-subtle pb-2">
          <span className="label text-accent">Mental Math · Out loud</span>
          <StageBadge label={step.concept ?? "Arithmetic"} />
        </div>
        <p className="mt-3 font-display text-xl font-semibold leading-relaxed text-primary">
          {step.prompt}
        </p>
      </div>

      <div className="panel p-5">
        <label className="label text-accent">Your answer</label>
        <div className="mt-2">
          <AnswerField
            value={raw}
            onChange={setRaw}
            onSubmit={submit}
            speech={speech}
            disabled={answered}
            inputMode="decimal"
            placeholder="Say or type a number — e.g. 144, 0.25, 3/8"
            ariaLabel={`Your answer to: ${step.prompt}`}
            submitLabel="Answer ▸"
          />
        </div>
        {!answered && (
          <p className="mt-2 text-xs text-muted">
            Target ~{Math.round(step.targetMs / 1000)}s. Speak or type; equivalent
            forms (fractions, %, decimals) all count.
          </p>
        )}
      </div>

      {answered && score && (
        <div className="animate-print-in space-y-4">
          <div className="border border-subtle">
            <div
              className={`flex items-center justify-between px-4 py-2 ${
                score.correct ? "bg-bull text-bg" : "bg-bear text-bg"
              }`}
            >
              <span className="font-mono text-xs font-semibold uppercase tracking-label">
                {score.correct ? "● Correct" : "● Not quite"}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-label opacity-90">
                {score.timing === "fast"
                  ? "Fast"
                  : score.timing === "ok"
                    ? "On pace"
                    : "Slow"}{" "}
                · {(score.elapsedMs / 1000).toFixed(1)}s
              </span>
            </div>
            <div className="space-y-1 bg-surface p-4 text-sm text-primary">
              <p>
                <span className="label text-secondary">You said · </span>
                <span className="num font-semibold">
                  {score.parsed ?? "(unparsed)"}
                </span>
              </p>
              {!score.correct && score.matchedError && (
                <p className="text-secondary">{score.matchedError.feedback}</p>
              )}
              <p className="text-secondary">{step.explanation}</p>
            </div>
          </div>

          <FollowUps title="Interviewer follow-ups" items={step.followUps} />

          <button onClick={onNext} className="btn-primary w-full">
            {isLast ? "See Results ▸" : "Next Question ▸"}
          </button>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Brainteaser card (timed, reflect + self-assess)                            */
/* -------------------------------------------------------------------------- */

function BrainteaserCard({
  step,
  response,
  speech,
  isLast,
  onRecord,
  onNext,
}: {
  step: BrainteaserStep;
  response: MockResponse | null;
  speech: SpeechApi;
  isLast: boolean;
  onRecord: (
    raw: string,
    viaSpeech: boolean,
    selfAssessed?: "got" | "missed",
  ) => void;
  onNext: () => void;
}) {
  const [raw, setRaw] = useState("");
  const [remaining, setRemaining] = useState(step.timeLimitSec);
  const revealed = response !== null;

  useEffect(() => {
    if (revealed) return;
    const id = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(id);
  }, [revealed]);

  const reveal = (selfAssessed?: "got" | "missed") => {
    onRecord(raw, false, selfAssessed);
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
            Think out loud — jot your reasoning (optional)
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
            This is reflect-only — nothing here is scored. Reveal when ready (or
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

          {response?.selfAssessed === undefined ? (
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
            <button onClick={onNext} className="btn-primary w-full">
              {isLast ? "See Results ▸" : "Next Question ▸"}
            </button>
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
  response,
  speech,
  isLast,
  onRecord,
  onNext,
}: {
  step: BehavioralStep;
  response: MockResponse | null;
  speech: SpeechApi;
  isLast: boolean;
  onRecord: (raw: string, viaSpeech: boolean) => void;
  onNext: () => void;
}) {
  const [raw, setRaw] = useState("");
  const answered = response !== null;

  const submit = () => {
    onRecord(raw, false);
    speech.stopListening();
  };

  return (
    <div className="animate-print-in space-y-4">
      <div className="panel p-5">
        <div className="flex items-center justify-between border-b border-subtle pb-2">
          <span className="label text-accent">Behavioral · Fit</span>
          <StageBadge label="Reflect-only" />
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

      {!answered && (
        <div className="panel p-5">
          <label className="label text-accent">Your response</label>
          <div className="mt-2">
            <AnswerField
              value={raw}
              onChange={setRaw}
              onSubmit={submit}
              speech={speech}
              multiline
              placeholder="Speak or type your answer — this is for your own review"
              ariaLabel="Your behavioral response"
              submitLabel="Done ▸"
            />
          </div>
          <p className="mt-2 text-xs text-muted">
            Nothing here is scored. Your draft is kept only on this device to let
            you resume, and is cleared when you finish. Answer as you would live,
            then self-review against the hints.
          </p>
        </div>
      )}

      {answered && (
        <div className="animate-print-in space-y-4">
          <div className="panel p-5">
            <span className="label text-accent">
              What a strong answer tends to cover
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
          <button onClick={onNext} className="btn-primary w-full">
            {isLast ? "See Results ▸" : "Next Question ▸"}
          </button>
        </div>
      )}
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

/* -------------------------------------------------------------------------- */
/*  Summary                                                                    */
/* -------------------------------------------------------------------------- */

function MockSummaryView({
  session,
  themeCelebration,
  onRestart,
  onDone,
}: {
  session: MockSession;
  themeCelebration: () => void;
  onRestart: () => void;
  onDone: () => void;
}) {
  const summary = useMemo(() => toPersistableSummary(session), [session]);
  const pct =
    summary.mathTotal > 0
      ? Math.round((summary.mathCorrect / summary.mathTotal) * 100)
      : 0;
  const strong = pct >= 70;

  useEffect(() => {
    if (strong) setTimeout(themeCelebration, 260);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="animate-print-in space-y-5">
      <div className="panel-ruled p-6 text-center">
        <span className="label">Debrief</span>
        <div className="relative mt-4 flex justify-center">
          <StampSeal
            label={strong ? "Sharp" : "Keep Reps Up"}
            sub={strong ? "Math Held Up" : "Tighten the Arithmetic"}
            tone={strong ? "bull" : "accent"}
          />
        </div>

        <div className="mx-auto mt-6 grid max-w-md grid-cols-3 divide-x divide-subtle border-y border-subtle">
          <div className="px-2 py-3">
            <div className="label text-[9px]">Math</div>
            <div className="num mt-1 text-xl font-semibold text-primary">
              {summary.mathCorrect}/{summary.mathTotal}
            </div>
          </div>
          <div className="px-2 py-3">
            <div className="label text-[9px]">Avg time</div>
            <div className="num mt-1 text-xl font-semibold text-secondary">
              {summary.mathAvgElapsedMs != null
                ? `${(summary.mathAvgElapsedMs / 1000).toFixed(1)}s`
                : "—"}
            </div>
          </div>
          <div className="px-2 py-3">
            <div className="label text-[9px]">Teasers</div>
            <div className="num mt-1 text-xl font-semibold text-secondary">
              {summary.brainteaserGotIt}/{summary.brainteaserSeen}
            </div>
          </div>
        </div>

        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-secondary">
          Behavioral answers are yours alone — reflect on them against the hints.
          Now that you've finished, this session's saved draft has been cleared
          from this device, and nothing was ever sent anywhere.
        </p>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button onClick={onRestart} className="btn-primary flex-1">
            New Interview
          </button>
          <button onClick={onDone} className="btn-secondary flex-1">
            Back Home
          </button>
        </div>
      </div>

      {/* Per-question blotter */}
      <div className="panel">
        <div className="border-b-[3px] border-border-strong px-4 py-2.5">
          <span className="label">Blotter · Review</span>
        </div>
        <ul>
          {session.script.steps.map((s) => {
            const r = session.responses.find((x) => x.stepId === s.id);
            const verdict =
              s.kind === "math"
                ? r?.score?.correct
                  ? "correct"
                  : "wrong"
                : s.kind === "brainteaser"
                  ? r?.selfAssessed === "got"
                    ? "correct"
                    : r?.selfAssessed === "missed"
                      ? "wrong"
                      : "reflect"
                  : "reflect";
            const tone =
              verdict === "correct"
                ? "bg-bull text-bg"
                : verdict === "wrong"
                  ? "bg-bear text-bg"
                  : "bg-surface-muted text-muted";
            const glyph =
              verdict === "correct" ? "✓" : verdict === "wrong" ? "✕" : "·";
            const label =
              s.kind === "math"
                ? "Mental math"
                : s.kind === "brainteaser"
                  ? "Brainteaser"
                  : "Behavioral";
            return (
              <li
                key={s.id}
                className="flex items-start gap-3 border-b border-subtle p-4 last:border-b-0"
              >
                <span
                  className={`num mt-0.5 grid h-6 w-6 shrink-0 place-items-center text-xs font-semibold ${tone}`}
                >
                  {glyph}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="label text-[9px] text-muted">{label}</div>
                  <div className="mt-0.5 truncate text-sm text-primary">
                    {s.prompt}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
