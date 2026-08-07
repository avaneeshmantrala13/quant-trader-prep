import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { GameChrome } from "@/components/games/GameChrome";
import { StampSeal } from "@/components/visuals/StampSeal";
import { GaugeIcon } from "@/components/icons";
import { celebrate } from "@/lib/celebrate";
import { CountUp } from "@/components/games/GameBits";
import { browserBoardStore, submitLocalScore } from "@/lib/leaderboard/localBoard";
import { submitGameScore } from "@/lib/leaderboard/client";
import {
  browserSessionStore,
  clearGameSession,
  loadGameSession,
  saveGameSession,
} from "@/lib/leaderboard/gameSession";
import type { BtoFormat } from "@/content/games/beatTheOddsQuestions";
import {
  advanceBto,
  answerBto,
  createBtoSession,
  currentQuestion,
  isQuestionExpired,
  paperFor,
  remainingMs,
  summarizeBto,
  type BeatTheOddsSession,
} from "@/lib/games/beatTheOdds/engine";

/**
 * BEAT THE ODDS (`/beat-the-odds`) — the Optiver-style fast probability/EV
 * section: ~20 questions, ~90 seconds each, five-option "pick the closest",
 * strictly forward (no back-nav), difficulty escalating. Exact-verified items
 * from the standalone generators; durable, user-scoped resume.
 */

type Phase = "intro" | "drill" | "summary";

const GAME_ID = "beat-the-odds";
const TICK_MS = 200;

function fmtOption(v: number, format: BtoFormat): string {
  if (format === "percent") return `${(v * 100).toFixed(1)}%`;
  if (format === "ev") return `$${v.toFixed(2)}`;
  return String(v);
}

function fmtClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `0:${String(total).padStart(2, "0")}`;
}

export function BeatTheOddsPage() {
  const navigate = useNavigate();
  const { themeDef } = useTheme();
  const { username } = useAuth();

  const [phase, setPhase] = useState<Phase>("intro");
  const [session, setSession] = useState<BeatTheOddsSession | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const q = session ? currentQuestion(session) : undefined;
  const answered = session ? session.answers[session.index] != null : false;

  /* ---- durable resume ------------------------------------------------- */
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const env = loadGameSession<BeatTheOddsSession>(
      browserSessionStore(),
      GAME_ID,
      undefined,
      username,
    );
    if (env?.status === "active" && env.snapshot.status === "running") {
      setSession(env.snapshot);
      setNow(Date.now());
      setPhase("drill");
    }
  }, [username]);

  useEffect(() => {
    if (!hydratedRef.current || !session) return;
    if (session.status === "running") {
      saveGameSession(browserSessionStore(), GAME_ID, session, Date.now(), "active", username);
    } else {
      clearGameSession(browserSessionStore(), GAME_ID, username);
    }
  }, [session, username]);

  const start = useCallback(() => {
    const seed = Math.floor(Math.random() * 2 ** 31);
    setSession(createBtoSession({ seed, nowTs: Date.now() }));
    setNow(Date.now());
    setPhase("drill");
  }, []);

  const restart = useCallback(() => {
    clearGameSession(browserSessionStore(), GAME_ID, username);
    setSession(null);
    setPhase("intro");
  }, [username]);

  const commit = useCallback((chosen: number | null, timedOut = false) => {
    setSession((prev) => (prev ? answerBto(prev, chosen, Date.now(), timedOut) : prev));
  }, []);

  const next = useCallback(() => {
    setSession((prev) => (prev ? advanceBto(prev, Date.now()) : prev));
    setNow(Date.now());
  }, []);

  // Per-question countdown; auto-commit a timeout at zero.
  useEffect(() => {
    if (phase !== "drill" || !session || session.status !== "running" || answered) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (isQuestionExpired(session, t)) commit(null, true);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [phase, session, answered, commit]);

  // Flip to summary when finished.
  useEffect(() => {
    if (session?.status === "finished" && phase === "drill") {
      setPhase("summary");
      const sum = summarizeBto(session);
      submitLocalScore(browserBoardStore(), GAME_ID, {
        score: sum.score,
        atMs: Date.now(),
        meta: { correct: sum.correct, total: sum.total },
      });
      void submitGameScore(GAME_ID, sum.score);
      if (sum.accuracyPct >= 60) setTimeout(themeDef.celebration ?? celebrate, 260);
    }
  }, [session, phase, themeDef.celebration]);

  const remaining = session ? remainingMs(session, now) : 0;
  const total = session?.count ?? 20;
  const low = session ? remaining <= session.budgetMs * 0.25 && !answered : false;
  const answer = session?.answers[session.index] ?? null;

  return (
    <GameChrome
      title="Beat the Odds"
      onBack={() => navigate("/games")}
      backLabel="Back to games"
      progress={phase === "drill" && session ? session.index / total : undefined}
      headerRight={
        phase === "drill" && session ? (
          <span
            className={`num text-xs font-semibold tabular-nums ${low ? "text-bear animate-pulse" : "text-secondary"}`}
          >
            {String(session.index + 1).padStart(2, "0")}/{total} · {fmtClock(remaining)}
          </span>
        ) : undefined
      }
    >
      {phase === "intro" && <Intro total={total} onStart={start} />}

      {phase === "drill" && session && q && (
        <div className="animate-print-in space-y-4" key={session.index}>
          <div className="panel p-3">
            <div className="flex items-center justify-between">
              <span className="label text-accent">{q.category} · Tier {q.tier}</span>
              <span className={`num font-mono text-lg font-bold tabular-nums ${low ? "text-bear" : "text-primary"}`}>
                {fmtClock(remaining)}
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full border border-subtle bg-surface">
              <div
                className={`h-full transition-all ${low ? "bg-bear" : "bg-accent"}`}
                style={{ width: `${Math.max(0, Math.min(1, remaining / session.budgetMs)) * 100}%` }}
              />
            </div>
          </div>

          <article className="panel-ruled p-5">
            <p className="font-display text-lg font-semibold leading-relaxed text-primary">{q.prompt}</p>
          </article>

          <div className="grid gap-2 sm:grid-cols-5">
            {q.options.map((opt, i) => {
              const chosen = answer?.chosen === i;
              const isCorrect = i === q.correctIndex;
              let tone = "border-border-strong bg-surface hover:border-accent text-primary";
              if (answered) {
                if (isCorrect) tone = "border-bull bg-bull/10 text-primary";
                else if (chosen) tone = "border-bear bg-bear/10 text-primary";
                else tone = "border-subtle bg-surface text-muted";
              }
              return (
                <button
                  key={i}
                  disabled={answered}
                  onClick={() => commit(i)}
                  className={`num border-2 px-2 py-4 text-center font-display text-base font-bold transition-colors disabled:cursor-default ${tone}`}
                >
                  {fmtOption(opt, q.format)}
                </button>
              );
            })}
          </div>

          {!answered && (
            <p className="text-xs text-muted">
              Pick the closest. No going back — the clock is running.
            </p>
          )}

          {answered && (
            <article className="panel-ruled border-l-4 border-l-accent p-4 animate-print-in">
              <div className="label text-accent">
                {answer?.correct ? "Correct" : "Worked answer"}
              </div>
              <p className="mt-1 text-sm text-secondary">{q.explanation}</p>
              <button onClick={next} className="btn-primary mt-4 w-full">
                {session.index + 1 >= total ? "See your score →" : "Next question →"}
              </button>
            </article>
          )}
        </div>
      )}

      {phase === "summary" && session && (
        <Summary session={session} onReplay={restart} onDone={() => navigate("/games")} />
      )}
    </GameChrome>
  );
}

function Intro({ total, onStart }: { total: number; onStart: () => void }) {
  return (
    <div className="animate-print-in space-y-5">
      <article className="panel-ruled p-6">
        <div className="flex items-center justify-between">
          <span className="label text-accent">Optiver-style Assessment · Beat the Odds</span>
          <span className="grid h-9 w-9 place-items-center border border-border-strong text-accent">
            <GaugeIcon width={18} height={18} />
          </span>
        </div>
        <h2 className="mt-2 font-display text-2xl font-semibold leading-tight text-primary">
          Fast probability & expected value
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-secondary">
          {total} rapid probability-theory and EV questions, ~90 seconds each, five options, pick the
          closest. Strictly forward — like the real Beat the Odds, there's no going back. Difficulty
          escalates from dice/coin/card odds into conditional probability and expectations. A correct
          answer scores a base plus a speed bonus that decays as the clock runs; harder items pay more.
        </p>
      </article>
      <button onClick={onStart} className="btn-primary w-full">
        Start the clock ▸
      </button>
    </div>
  );
}

function Summary({
  session,
  onReplay,
  onDone,
}: {
  session: BeatTheOddsSession;
  onReplay: () => void;
  onDone: () => void;
}) {
  const paper = useMemo(() => paperFor(session), [session]);
  const sum = useMemo(() => summarizeBto(session), [session]);
  const strong = sum.accuracyPct >= 60;
  return (
    <div className="animate-print-in space-y-5">
      <article className="panel-ruled relative overflow-hidden p-6 text-center">
        <StampSeal label={strong ? "Sharp & Fast" : "Keep Drilling"} tone={strong ? "bull" : "accent"} />
        <span className="label text-accent">Score</span>
        <div className="mt-3 font-display text-5xl font-black text-primary">
          <CountUp value={sum.score} />
        </div>
        <p className="mt-2 text-sm text-secondary">
          {sum.correct}/{sum.total} correct · {sum.accuracyPct}% accuracy
        </p>
      </article>

      <article className="panel-ruled p-4">
        <div className="label text-accent">Review</div>
        <ul className="mt-2 divide-y divide-subtle">
          {paper.map((it, i) => {
            const a = session.answers[i];
            const right = a?.correct ?? false;
            return (
              <li key={i} className="flex items-start gap-3 py-2 text-[13px]">
                <span
                  className={`num mt-0.5 grid h-6 w-6 shrink-0 place-items-center text-xs font-semibold ${
                    !a ? "bg-surface-muted text-muted" : right ? "bg-bull text-bg" : "bg-bear text-bg"
                  }`}
                >
                  {!a ? "—" : right ? "✓" : "✕"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-secondary">{it.prompt}</div>
                  <div className="num mt-0.5 text-xs text-muted">
                    Answer {fmtOption(it.answer, it.format)} · +{a?.points ?? 0} pts
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </article>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button onClick={onReplay} className="btn-primary flex-1">
          New round
        </button>
        <button onClick={onDone} className="btn-secondary flex-1">
          Back to games
        </button>
      </div>
    </div>
  );
}
