import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { GameChrome } from "@/components/games/GameChrome";
import { StampSeal } from "@/components/visuals/StampSeal";
import { SigmaIcon } from "@/components/icons";
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
import {
  advanceNumberLogic,
  answerNumberLogic,
  buildNumberLogicPaper,
  createNumberLogicSession,
  DEFAULT_NUMBERLOGIC_COUNT,
  isPaperExpired,
  summarizeNumberLogic,
  type NumberLogicSession,
} from "@/lib/games/numberLogic/engine";

/**
 * NUMBERLOGIC (`/numberlogic`) — the Optiver-style progressive number-sequence
 * test: 26 "what comes next?" items over a ~25-minute whole-paper clock,
 * difficulty escalating from arithmetic/geometric steps into ratio+offset,
 * second-difference, interleaved, and Fibonacci-style patterns. Pure engine;
 * this is a thin themed renderer that persists a durable, user-scoped session.
 */

type Phase = "intro" | "drill" | "summary";

const GAME_ID = "numberlogic";
const TICK_MS = 500;

function fmtClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function NumberLogicPage() {
  const navigate = useNavigate();
  const { themeDef } = useTheme();
  const { username } = useAuth();

  const [phase, setPhase] = useState<Phase>("intro");
  const [session, setSession] = useState<NumberLogicSession | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const items = useMemo(
    () => (session ? buildNumberLogicPaper(session.seed, session.answers.length) : []),
    [session],
  );
  const current = session ? items[session.index] : undefined;
  const answered = session ? session.answers[session.index] != null : false;

  /* ---- durable resume ------------------------------------------------- */
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const env = loadGameSession<NumberLogicSession>(
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
    setSession(createNumberLogicSession({ seed, nowTs: Date.now() }));
    setNow(Date.now());
    setPhase("drill");
  }, []);

  const restart = useCallback(() => {
    clearGameSession(browserSessionStore(), GAME_ID, username);
    setSession(null);
    setPhase("intro");
  }, [username]);

  const choose = useCallback((choiceIndex: number) => {
    setSession((prev) => (prev ? answerNumberLogic(prev, choiceIndex) : prev));
  }, []);

  const next = useCallback(() => {
    setSession((prev) => (prev ? advanceNumberLogic(prev, Date.now()) : prev));
    setNow(Date.now());
  }, []);

  // Whole-paper countdown; finish when the clock elapses.
  useEffect(() => {
    if (phase !== "drill" || !session || session.status !== "running") return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (isPaperExpired(session, t)) {
        setSession((prev) => (prev ? { ...prev, status: "finished" } : prev));
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [phase, session]);

  // Flip to summary when the session finishes.
  useEffect(() => {
    if (session?.status === "finished" && phase === "drill") {
      setPhase("summary");
      const sum = summarizeNumberLogic(session, buildNumberLogicPaper(session.seed, session.answers.length));
      submitLocalScore(browserBoardStore(), GAME_ID, {
        score: sum.score,
        atMs: Date.now(),
        meta: { correct: sum.correct, total: sum.total },
      });
      void submitGameScore(GAME_ID, sum.score);
      if (sum.accuracyPct >= 60) setTimeout(themeDef.celebration ?? celebrate, 260);
    }
  }, [session, phase, themeDef.celebration]);

  const remaining = session ? Math.max(0, session.deadlineTs - now) : 0;
  const total = session?.answers.length ?? DEFAULT_NUMBERLOGIC_COUNT;

  return (
    <GameChrome
      title="NumberLogic"
      onBack={() => navigate("/games")}
      backLabel="Back to games"
      progress={phase === "drill" && session ? session.index / total : undefined}
      headerRight={
        phase === "drill" && session ? (
          <span className="num text-xs font-semibold tabular-nums text-secondary">
            {String(session.index + 1).padStart(2, "0")}/{total} · {fmtClock(remaining)}
          </span>
        ) : undefined
      }
    >
      {phase === "intro" && <Intro total={total} onStart={start} />}

      {phase === "drill" && session && current && (
        <div className="animate-print-in space-y-5" key={session.index}>
          <article className="panel-ruled p-6">
            <div className="flex items-center justify-between">
              <span className="label text-accent">Find the next term</span>
              <span className="chip border-subtle text-secondary">Tier {current.tier}</span>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {current.terms.map((t, i) => (
                <span
                  key={i}
                  className="num grid h-12 min-w-12 place-items-center border border-border-strong bg-surface px-3 font-display text-xl font-bold text-primary"
                >
                  {t}
                </span>
              ))}
              <span className="num grid h-12 min-w-12 place-items-center border-2 border-dashed border-accent px-3 font-display text-xl font-black text-accent">
                ?
              </span>
            </div>
          </article>

          <div className="grid gap-2 sm:grid-cols-5">
            {current.options.map((opt, i) => {
              const chosen = session.answers[session.index] === i;
              const isCorrect = i === current.correctIndex;
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
                  onClick={() => choose(i)}
                  className={`num border-2 px-3 py-4 text-center font-display text-lg font-bold transition-colors disabled:cursor-default ${tone}`}
                >
                  {opt}
                </button>
              );
            })}
          </div>

          {answered && (
            <article className="panel-ruled border-l-4 border-l-accent p-4 animate-print-in">
              <div className="label text-accent">
                {session.answers[session.index] === current.correctIndex ? "Correct" : "The pattern"}
              </div>
              <p className="mt-1 text-sm text-secondary">{current.rule}</p>
              <button onClick={next} className="btn-primary mt-4 w-full">
                {session.index + 1 >= total ? "See your score →" : "Next sequence →"}
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
          <span className="label text-accent">Optiver-style Assessment · NumberLogic</span>
          <span className="grid h-9 w-9 place-items-center border border-border-strong text-accent">
            <SigmaIcon width={18} height={18} />
          </span>
        </div>
        <h2 className="mt-2 font-display text-2xl font-semibold leading-tight text-primary">
          What comes next in the sequence?
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-secondary">
          {total} progressive number-sequence puzzles under one ~25-minute clock, exactly like
          Optiver's NumberLogic. Early items are plain arithmetic or geometric steps; later ones
          hide the rule inside a ratio-plus-offset recurrence, a growing second difference, two
          interleaved sequences, or a Fibonacci-style running sum. Read the pattern, pick the next
          term. Harder items are worth more.
        </p>
        <div className="mt-4 border-l-2 border-accent bg-surface-muted px-4 py-3 text-sm text-secondary">
          Tip: always check the differences first, then the ratios, then look for two sequences
          woven together.
        </div>
      </article>
      <button onClick={onStart} className="btn-primary w-full">
        Start the paper ▸
      </button>
    </div>
  );
}

function Summary({
  session,
  onReplay,
  onDone,
}: {
  session: NumberLogicSession;
  onReplay: () => void;
  onDone: () => void;
}) {
  const items = useMemo(
    () => buildNumberLogicPaper(session.seed, session.answers.length),
    [session],
  );
  const sum = useMemo(() => summarizeNumberLogic(session, items), [session, items]);
  const strong = sum.accuracyPct >= 60;
  return (
    <div className="animate-print-in space-y-5">
      <article className="panel-ruled relative overflow-hidden p-6 text-center">
        <StampSeal label={strong ? "Pattern Sharp" : "Keep Drilling"} tone={strong ? "bull" : "accent"} />
        <span className="label text-accent">Weighted score</span>
        <div className="mt-3 font-display text-5xl font-black text-primary">
          <CountUp value={sum.score} />
        </div>
        <p className="mt-2 text-sm text-secondary">
          {sum.correct}/{sum.total} correct · {sum.accuracyPct}% accuracy · {sum.answered} attempted
        </p>
      </article>

      <article className="panel-ruled p-4">
        <div className="label text-accent">Answer key</div>
        <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {items.map((it, i) => {
            const a = session.answers[i];
            const right = a === it.correctIndex;
            return (
              <div
                key={i}
                className={`flex items-center justify-between border px-2 py-1.5 text-[12px] ${
                  a == null
                    ? "border-subtle text-muted"
                    : right
                      ? "border-bull/50 text-bull"
                      : "border-bear/50 text-bear"
                }`}
              >
                <span className="num">#{i + 1}</span>
                <span className="num font-semibold">{it.answer}</span>
                <span>{a == null ? "—" : right ? "✓" : "✕"}</span>
              </div>
            );
          })}
        </div>
      </article>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button onClick={onReplay} className="btn-primary flex-1">
          New paper
        </button>
        <button onClick={onDone} className="btn-secondary flex-1">
          Back to games
        </button>
      </div>
    </div>
  );
}
