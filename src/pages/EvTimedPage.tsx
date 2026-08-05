import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/context/ThemeContext";
import { GameChrome } from "@/components/games/GameChrome";
import { StampSeal } from "@/components/visuals/StampSeal";
import { BoltIcon } from "@/components/icons";
import { celebrate } from "@/lib/celebrate";
import { DIFFICULTY_META } from "@/types/content";
import {
  MAX_ITEM_SCORE,
  advanceEvTimed,
  answerCurrent,
  createEvTimedSession,
  currentItem,
  isAnswered,
  isQuestionExpired,
  remainingMs,
  summarize,
  type EvTimedSessionState,
} from "@/lib/evTimed/engine";
import {
  clearEvTimedSession,
  loadEvTimedSession,
  saveEvTimedSession,
} from "@/lib/evTimed/persist";

/**
 * The dedicated EV-under-time decision drill (`/ev-timed`, task T4).
 *
 * A SELF-CONTAINED, full-screen game (its own layout, like `FermiPage` / the
 * lesson player) rather than a level inside a track — it stays in a disjoint
 * namespace from the shared level/mode machinery and the concurrently-built
 * simulators. Each question is an EV / fair-value / optimal-stopping MCQ drawn
 * from the project's EXISTING exact-verified generators (via the curated
 * `@/lib/evTimed/pool`); the learner must DECIDE before a per-question clock
 * runs out.
 *
 * The countdown is the ONLY real-time concern this component owns: a single
 * `setInterval` ticks `now = Date.now()`, and remaining time is recomputed as
 * `deadline − now`, mirroring the wall-clock OA pattern. ALL scoring/state
 * transitions are delegated to the pure engine (`answerCurrent`,
 * `advanceEvTimed`), so points are deterministic given the seed + commit time.
 * Token-only Tailwind, keyboard accessible, and it never touches
 * mastery/progress.
 */

type Phase = "intro" | "drill" | "summary";

const TICK_MS = 100;

function fmtClock(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function EvTimedPage() {
  const navigate = useNavigate();
  const { themeDef } = useTheme();

  const [phase, setPhase] = useState<Phase>("intro");
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 2 ** 31));
  const [session, setSession] = useState<EvTimedSessionState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // Whether the learner has committed the CURRENT question (drives reveal).
  const answered = session ? isAnswered(session, session.index) : false;

  const start = useCallback(() => {
    const s = createEvTimedSession({ seed, nowTs: Date.now() });
    setSession(s);
    setNow(Date.now());
    setPhase("drill");
  }, [seed]);

  const restart = useCallback(() => {
    const nextSeed = Math.floor(Math.random() * 2 ** 31);
    setSeed(nextSeed);
    setSession(null);
    // Explicit restart discards the resumable run so re-entering starts fresh.
    clearEvTimedSession();
    setPhase("intro");
  }, []);

  // Resume a persisted in-progress session on mount (leave/reload-proof: the
  // session carries ABSOLUTE per-question deadlines, so an expired question just
  // auto-times-out on return). Runs once; only a still-running session resumes.
  useEffect(() => {
    const saved = loadEvTimedSession();
    if (saved && saved.status === "running") {
      setSession(saved);
      setSeed(saved.seed);
      setNow(Date.now());
      setPhase("drill");
    }
     
  }, []);

  // Durable persistence: keep the RUNNING session saved so a leave/reload
  // resumes it; a finished session ends the resumable one (mirrors the OA store).
  useEffect(() => {
    if (!session) return;
    if (session.status === "running") saveEvTimedSession(session);
    else clearEvTimedSession();
  }, [session]);

  // Commit the current answer (a real choice, or null on skip/timeout).
  const commit = useCallback(
    (chosen: number | null, atTs: number, timedOut = false) => {
      setSession((prev) =>
        prev ? answerCurrent(prev, chosen, atTs, timedOut) : prev,
      );
    },
    [],
  );

  const goNext = useCallback(() => {
    setSession((prev) => {
      if (!prev) return prev;
      const next = advanceEvTimed(prev, Date.now());
      if (next.status === "finished") {
        const anyCorrect = next.answers.some((a) => (a.score?.base ?? 0) > 0);
        if (anyCorrect) setTimeout(themeDef.celebration ?? celebrate, 260);
      }
      return next;
    });
    setNow(Date.now());
  }, [themeDef.celebration]);

  // When the session finishes, flip to the summary phase.
  useEffect(() => {
    if (session?.status === "finished" && phase === "drill") {
      setPhase("summary");
    }
  }, [session?.status, phase]);

  // The single real timer: tick while a question is live and unanswered.
  useEffect(() => {
    if (phase !== "drill" || !session || session.status !== "running") return;
    if (answered) return;
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [phase, session, answered]);

  // Auto-commit a timeout the instant the clock hits zero.
  useEffect(() => {
    if (phase !== "drill" || !session || session.status !== "running") return;
    if (answered) return;
    if (isQuestionExpired(session, now)) {
      commit(null, session.questionDeadlineTs, true);
    }
  }, [phase, session, answered, now, commit]);

  const item = session ? currentItem(session) : undefined;
  const total = session?.items.length ?? 0;
  const remaining = session ? remainingMs(session, now) : 0;

  return (
    <GameChrome
      title="EV Under Time"
      onBack={() => navigate("/")}
      progress={
        phase === "drill" && session
          ? (session.index + (answered ? 1 : 0)) / Math.max(1, total)
          : undefined
      }
      headerRight={
        phase === "drill" && session ? (
          <span className="num text-xs text-secondary">
            {String(session.index + 1).padStart(2, "0")}/{total}
          </span>
        ) : undefined
      }
    >
        {phase === "intro" && (
          <EvTimedIntro total={total || 5} onStart={start} />
        )}

        {phase === "drill" && session && item && (
          <EvTimedCard
            key={`${session.id}:${session.index}`}
            session={session}
            item={item}
            remainingMs={remaining}
            answered={answered}
            onCommit={(chosen) => commit(chosen, Date.now())}
            onNext={goNext}
          />
        )}

        {phase === "summary" && session && (
          <EvTimedSummary
            session={session}
            onRestart={restart}
            onDone={() => navigate("/")}
          />
        )}
    </GameChrome>
  );
}

/* -------------------------------------------------------------------------- */
/*  Intro — what this is + how it's scored                                     */
/* -------------------------------------------------------------------------- */

function EvTimedIntro({
  total,
  onStart,
}: {
  total: number;
  onStart: () => void;
}) {
  return (
    <div className="animate-print-in space-y-5">
      <article className="panel-ruled p-6">
        <div className="flex items-center justify-between">
          <span className="label text-accent">Timed Decision Drill</span>
          <span className="grid h-9 w-9 place-items-center border border-border-strong text-accent">
            <BoltIcon width={20} height={20} />
          </span>
        </div>
        <h2 className="mt-2 font-display text-2xl font-semibold leading-tight text-primary">
          Price the fair value — before the clock
        </h2>
        <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-secondary">
          <p>
            <span className="float-left mr-2 font-display text-5xl font-black leading-[0.8] text-primary">
              O
            </span>
            n a trading desk, knowing the fair value isn't enough — you have to
            commit to it under a running clock. Each question is an expected
            value, fair-value pricing, or optimal-stopping problem. Compute the
            EV, then DECIDE before time runs out.
          </p>
          <p>
            You'll get {total} problems, each with its own countdown. We score
            BOTH correctness and speed: a correct answer earns a base, plus a
            bonus that decays to zero as the clock winds down. A wrong (or
            timed-out) answer scores nothing.
          </p>
        </div>

        <div className="mt-5 border-l-2 border-accent bg-surface-muted px-4 py-3">
          <div className="label text-accent">How this is scored</div>
          <ul className="mt-3 space-y-1.5 text-sm">
            <li className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 shrink-0 bg-bull" />
              <span className="text-secondary">
                <span className="font-semibold text-primary">Correct</span> —
                base {"+"} a within-budget speed bonus (faster is worth more)
              </span>
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 shrink-0 bg-accent" />
              <span className="text-secondary">
                <span className="font-semibold text-primary">On the clock</span>{" "}
                — the bonus decays linearly to zero at the budget
              </span>
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 shrink-0 bg-bear" />
              <span className="text-secondary">
                <span className="font-semibold text-primary">Wrong / timeout</span>{" "}
                — zero points
              </span>
            </li>
          </ul>
        </div>

        <p className="mt-4 border-t border-subtle pt-3 font-mono text-xs uppercase tracking-wider text-muted">
          Why firms ask · Desks reward the trader who is both right AND fast.
        </p>
      </article>

      <button onClick={onStart} className="btn-primary w-full">
        Start the Clock ▸
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  One timed question: countdown → pick → reveal                              */
/* -------------------------------------------------------------------------- */

const CHOICE_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8"] as const;

function EvTimedCard({
  session,
  item,
  remainingMs: remaining,
  answered,
  onCommit,
  onNext,
}: {
  session: EvTimedSessionState;
  item: NonNullable<ReturnType<typeof currentItem>>;
  remainingMs: number;
  answered: boolean;
  onCommit: (chosen: number) => void;
  onNext: () => void;
}) {
  const q = item.question;
  const answer = session.answers[session.index];
  const chosen = answer?.chosen ?? null;
  const score = answer?.score ?? null;
  const isLast = session.index === session.items.length - 1;
  const nextRef = useRef<HTMLButtonElement>(null);

  const fracLeft = Math.max(0, Math.min(1, remaining / item.budgetMs));
  const low = remaining <= item.budgetMs * 0.25 && !answered;

  // Move focus to the primary "next" action once the question is revealed.
  useEffect(() => {
    if (answered) nextRef.current?.focus();
  }, [answered]);

  // Keyboard: number keys pick a choice; Enter advances after reveal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (!answered) {
        const idx = CHOICE_KEYS.indexOf(e.key as (typeof CHOICE_KEYS)[number]);
        if (idx >= 0 && idx < q.choices.length) {
          e.preventDefault();
          onCommit(idx);
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        onNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answered, q.choices.length, onCommit, onNext]);

  const clockTone = answered
    ? "text-muted"
    : low
      ? "text-bear"
      : "text-primary";
  const barTone = low ? "bg-bear" : "bg-accent";

  return (
    <div className="animate-print-in space-y-4">
      {/* Countdown */}
      <div className="panel p-4">
        <div className="flex items-center justify-between">
          <span className="label text-accent">Time remaining</span>
          <span
            className={`num font-mono text-2xl font-bold tabular-nums ${clockTone} ${low ? "animate-pulse" : ""}`}
            role="timer"
            aria-live={low ? "assertive" : "off"}
            aria-label={`Time remaining ${fmtClock(remaining)}`}
          >
            {fmtClock(remaining)}
          </span>
        </div>
        <div className="mt-2 h-2 w-full border border-subtle bg-surface">
          <div
            className={`h-full transition-all ${barTone}`}
            style={{ width: `${fracLeft * 100}%` }}
          />
        </div>
      </div>

      {/* Prompt */}
      <div className="panel p-5">
        <div className="flex items-center justify-between border-b border-subtle pb-2">
          <span className="label">
            Question {String(session.index + 1).padStart(2, "0")} /{" "}
            {session.items.length}
          </span>
          <div className="flex items-center gap-1.5">
            {q.concept && (
              <span className="chip border-subtle text-secondary">
                {q.concept}
              </span>
            )}
            <span className="chip border-subtle text-secondary">
              {DIFFICULTY_META[q.difficulty].label}
            </span>
          </div>
        </div>
        <p className="mt-3 font-display text-xl font-semibold leading-relaxed text-primary">
          {q.prompt}
        </p>
      </div>

      {/* Choices */}
      <div
        className="grid gap-2"
        role="radiogroup"
        aria-label="Answer choices"
      >
        {q.choices.map((choice, i) => {
          const isCorrect = i === q.correctIndex;
          const isChosen = i === chosen;
          let tone =
            "border-border-strong bg-surface hover:border-accent text-primary";
          if (answered) {
            if (isCorrect) tone = "border-bull bg-bull/10 text-primary";
            else if (isChosen) tone = "border-bear bg-bear/10 text-primary";
            else tone = "border-subtle bg-surface text-muted";
          }
          return (
            <button
              key={i}
              onClick={() => !answered && onCommit(i)}
              disabled={answered}
              role="radio"
              aria-checked={isChosen}
              className={`flex items-center gap-3 border-2 px-4 py-3 text-left transition-colors disabled:cursor-default ${tone}`}
            >
              <span className="num grid h-7 w-7 shrink-0 place-items-center border border-current font-mono text-xs font-semibold">
                {CHOICE_KEYS[i] ?? i + 1}
              </span>
              <span className="num flex-1 text-[15px] font-medium">
                {choice}
              </span>
              {answered && isCorrect && (
                <span className="font-mono text-xs font-semibold text-bull">
                  ✓
                </span>
              )}
              {answered && isChosen && !isCorrect && (
                <span className="font-mono text-xs font-semibold text-bear">
                  ✕
                </span>
              )}
            </button>
          );
        })}
      </div>

      {!answered && (
        <p className="text-xs text-muted">
          Pick with the number keys{" "}
          <span className="num">1–{q.choices.length}</span> or click. Score
          decays as the clock winds down.
        </p>
      )}

      {answered && score && (
        <Reveal
          explanation={q.explanation}
          score={score}
          timedOut={answer?.timedOut ?? false}
          isLast={isLast}
          onNext={onNext}
          nextRef={nextRef}
        />
      )}
    </div>
  );
}

function Reveal({
  explanation,
  score,
  timedOut,
  isLast,
  onNext,
  nextRef,
}: {
  explanation: string;
  score: NonNullable<EvTimedSessionState["answers"][number]["score"]>;
  timedOut: boolean;
  isLast: boolean;
  onNext: () => void;
  nextRef: React.RefObject<HTMLButtonElement>;
}) {
  const correct = score.base > 0;
  const banner = correct
    ? "bg-bull text-bg"
    : "bg-bear text-bg";
  const verdict = correct
    ? score.withinBudget
      ? "Correct — in budget"
      : "Correct — over budget"
    : timedOut
      ? "Time's up"
      : "Incorrect";

  return (
    <div className="animate-print-in space-y-4">
      <div className="border border-subtle">
        <div
          className={`flex items-center justify-between px-4 py-2 ${banner}`}
        >
          <span className="font-mono text-xs font-semibold uppercase tracking-label">
            ● {verdict}
          </span>
          <span className="num font-mono text-xs font-semibold">
            +{score.points} pts
          </span>
        </div>
        <div className="space-y-1 bg-surface p-4">
          {correct && (
            <p className="num font-mono text-xs text-secondary">
              Base {score.base}
              {score.speedBonus > 0 ? ` + speed ${score.speedBonus}` : ""} ·{" "}
              {Math.round((1 - score.timeFraction) * 100)}% of the clock left
            </p>
          )}
          <p className="text-sm leading-relaxed text-primary">{explanation}</p>
        </div>
      </div>

      <button
        ref={nextRef}
        onClick={onNext}
        className="btn-primary w-full"
      >
        {isLast ? "See Results ▸" : "Next Question ▸"}
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Summary                                                                    */
/* -------------------------------------------------------------------------- */

function EvTimedSummary({
  session,
  onRestart,
  onDone,
}: {
  session: EvTimedSessionState;
  onRestart: () => void;
  onDone: () => void;
}) {
  const sum = useMemo(() => summarize(session), [session]);
  const pct = sum.maxScore > 0 ? Math.round((sum.score / sum.maxScore) * 100) : 0;
  const strong = pct >= 60;

  return (
    <div className="animate-print-in space-y-5">
      <div className="panel-ruled p-6 text-center">
        <span className="label">Timed Scorecard</span>
        <div className="relative mt-4 flex justify-center">
          <StampSeal
            label={strong ? "Sharp & Fast" : "Keep Drilling"}
            sub={strong ? "Right on the Clock" : "Right, but Faster"}
            tone={strong ? "bull" : "accent"}
          />
        </div>

        <div className="mx-auto mt-6 grid max-w-md grid-cols-4 divide-x divide-subtle border-y border-subtle">
          <div className="px-2 py-3">
            <div className="label text-[9px]">Score</div>
            <div className="num mt-1 text-lg font-semibold text-primary">
              {sum.score}
            </div>
          </div>
          <div className="px-2 py-3">
            <div className="label text-[9px]">Correct</div>
            <div className="num mt-1 text-lg font-semibold text-secondary">
              {sum.correct}/{sum.total}
            </div>
          </div>
          <div className="px-2 py-3">
            <div className="label text-[9px]">In Budget</div>
            <div
              className={`num mt-1 text-lg font-semibold ${strong ? "text-bull" : "text-primary"}`}
            >
              {sum.withinBudget}
            </div>
          </div>
          <div className="px-2 py-3">
            <div className="label text-[9px]">Avg Time</div>
            <div className="num mt-1 text-lg font-semibold text-secondary">
              {(sum.avgElapsedMs / 1000).toFixed(1)}s
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button onClick={onRestart} className="btn-primary flex-1">
            New Round
          </button>
          <button onClick={onDone} className="btn-secondary flex-1">
            Back Home
          </button>
        </div>
      </div>

      {/* Per-item blotter */}
      <div className="panel">
        <div className="border-b-[3px] border-border-strong px-4 py-2.5">
          <span className="label">Blotter · Review</span>
        </div>
        <ul>
          {session.items.map((it, i) => {
            const a = session.answers[i];
            const s = a?.score ?? null;
            const correct = (s?.base ?? 0) > 0;
            const tone = !s
              ? "bg-surface-muted text-muted"
              : correct
                ? "bg-bull text-bg"
                : "bg-bear text-bg";
            return (
              <li
                key={i}
                className="flex items-start gap-3 border-b border-subtle p-4 last:border-b-0"
              >
                <span
                  className={`num mt-0.5 grid h-6 w-6 shrink-0 place-items-center text-xs font-semibold ${tone}`}
                >
                  {!s ? "—" : correct ? "✓" : "✕"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-primary">
                    {it.label}
                  </div>
                  <div className="num mt-0.5 font-mono text-xs text-secondary">
                    {a?.timedOut
                      ? "Timed out"
                      : `${((a?.elapsedMs ?? 0) / 1000).toFixed(1)}s`}
                    {"   "}+{s?.points ?? 0} pts
                    {"   "}max {MAX_ITEM_SCORE}
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
