import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { GameChrome } from "@/components/games/GameChrome";
import { StampSeal } from "@/components/visuals/StampSeal";
import { BrainIcon } from "@/components/icons";
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
  advanceNumberBox,
  answerNumberBox,
  buildNumberBoxPaper,
  createNumberBoxSession,
  isNumberBoxExpired,
  remainingMs,
  summarizeNumberBox,
  type NumberBoxSession,
} from "@/lib/games/numberBox/engine";

/**
 * NUMBER BOX (`/number-box`) — the Optiver Zap-N modular-math mini-game: rapid
 * "compute the residue (mod m)" and "fill the box" drills against a ~2-minute
 * clock. Optiver-style net scoring (+1 correct, −1 wrong). Pure engine; durable,
 * user-scoped resume.
 */

type Phase = "intro" | "play" | "summary";

const GAME_ID = "number-box";
const TICK_MS = 250;

function fmtClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function NumberBoxPage() {
  const navigate = useNavigate();
  const { themeDef } = useTheme();
  const { username } = useAuth();

  const [phase, setPhase] = useState<Phase>("intro");
  const [session, setSession] = useState<NumberBoxSession | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [flash, setFlash] = useState<"correct" | "wrong" | null>(null);

  const items = useMemo(
    () => (session ? buildNumberBoxPaper(session.seed, session.count) : []),
    [session],
  );
  const current = session ? items[session.index] : undefined;

  /* ---- durable resume ------------------------------------------------- */
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const env = loadGameSession<NumberBoxSession>(
      browserSessionStore(),
      GAME_ID,
      undefined,
      username,
    );
    if (env?.status === "active" && env.snapshot.status === "running") {
      setSession(env.snapshot);
      setNow(Date.now());
      setPhase("play");
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
    setSession(createNumberBoxSession({ seed, nowTs: Date.now() }));
    setNow(Date.now());
    setFlash(null);
    setPhase("play");
  }, []);

  const restart = useCallback(() => {
    clearGameSession(browserSessionStore(), GAME_ID, username);
    setSession(null);
    setPhase("intro");
  }, [username]);

  const pick = useCallback(
    (choiceIndex: number) => {
      setSession((prev) => {
        if (!prev || prev.status !== "running") return prev;
        const it = buildNumberBoxPaper(prev.seed, prev.count)[prev.index];
        setFlash(choiceIndex === it.correctIndex ? "correct" : "wrong");
        const answered = answerNumberBox(prev, choiceIndex);
        return advanceNumberBox(answered, Date.now());
      });
      setNow(Date.now());
    },
    [],
  );

  // Clear the flash shortly after each answer.
  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(null), 250);
    return () => clearTimeout(id);
  }, [flash, session?.index]);

  // Whole-run countdown; finish when the clock elapses.
  useEffect(() => {
    if (phase !== "play" || !session || session.status !== "running") return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (isNumberBoxExpired(session, t)) {
        setSession((prev) => (prev ? { ...prev, status: "finished" } : prev));
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [phase, session]);

  useEffect(() => {
    if (session?.status === "finished" && phase === "play") {
      setPhase("summary");
      const sum = summarizeNumberBox(session, buildNumberBoxPaper(session.seed, session.count));
      submitLocalScore(browserBoardStore(), GAME_ID, {
        score: sum.netScore,
        atMs: Date.now(),
        meta: { correct: sum.correct, wrong: sum.wrong },
      });
      void submitGameScore(GAME_ID, sum.netScore);
      if (sum.correct >= sum.wrong && sum.correct > 0) {
        setTimeout(themeDef.celebration ?? celebrate, 260);
      }
    }
  }, [session, phase, themeDef.celebration]);

  const remaining = session ? remainingMs(session, now) : 0;
  const solved = session ? session.answers.filter((a) => a != null).length : 0;

  return (
    <GameChrome
      title="Number Box"
      onBack={() => navigate("/games")}
      backLabel="Back to games"
      progress={phase === "play" && session ? session.index / session.count : undefined}
      headerRight={
        phase === "play" && session ? (
          <span className="num text-xs font-semibold tabular-nums text-secondary">
            {solved} done · {fmtClock(remaining)}
          </span>
        ) : undefined
      }
    >
      {phase === "intro" && <Intro onStart={start} />}

      {phase === "play" && session && current && (
        <div className="animate-print-in space-y-6" key={session.index}>
          <article
            className={`panel-ruled p-8 text-center transition-colors ${
              flash === "correct" ? "border-bull" : flash === "wrong" ? "border-bear" : ""
            }`}
          >
            <span className="label text-accent">Solve the box · mod {current.modulus}</span>
            <div className="num mt-4 font-display text-4xl font-black tracking-tight text-primary">
              {current.prompt}
            </div>
          </article>

          <div className="grid grid-cols-5 gap-2">
            {current.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => pick(i)}
                className="num border-2 border-border-strong bg-surface px-2 py-5 text-center font-display text-2xl font-black text-primary transition-colors hover:border-accent"
              >
                {opt}
              </button>
            ))}
          </div>
          <p className="text-center text-xs text-muted">
            Tap the residue. +1 for correct, −1 for wrong — so skip a wild guess if you're unsure.
          </p>
        </div>
      )}

      {phase === "summary" && session && (
        <Summary session={session} onReplay={restart} onDone={() => navigate("/games")} />
      )}
    </GameChrome>
  );
}

function Intro({ onStart }: { onStart: () => void }) {
  return (
    <div className="animate-print-in space-y-5">
      <article className="panel-ruled p-6">
        <div className="flex items-center justify-between">
          <span className="label text-accent">Optiver-style Assessment · Number Box</span>
          <span className="grid h-9 w-9 place-items-center border border-border-strong text-accent">
            <BrainIcon width={18} height={18} />
          </span>
        </div>
        <h2 className="mt-2 font-display text-2xl font-semibold leading-tight text-primary">
          Modular math, at speed
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-secondary">
          Rapid-fire modular arithmetic against a 2-minute clock, like Optiver's Number Box. Compute a
          sum, difference, product, or square modulo m — or fill the box that makes a congruence hold —
          and tap the residue. Scoring is Optiver-style: +1 for a correct answer, −1 for a wrong one,
          so pace yourself and don't guess wildly.
        </p>
      </article>
      <button onClick={onStart} className="btn-primary w-full">
        Start the drill ▸
      </button>
    </div>
  );
}

function Summary({
  session,
  onReplay,
  onDone,
}: {
  session: NumberBoxSession;
  onReplay: () => void;
  onDone: () => void;
}) {
  const items = useMemo(() => buildNumberBoxPaper(session.seed, session.count), [session]);
  const sum = useMemo(() => summarizeNumberBox(session, items), [session, items]);
  const strong = sum.correct >= sum.wrong && sum.correct > 0;
  return (
    <div className="animate-print-in space-y-5">
      <article className="panel-ruled relative overflow-hidden p-6 text-center">
        <StampSeal label={strong ? "Quick & Clean" : "Keep Drilling"} tone={strong ? "bull" : "accent"} />
        <span className="label text-accent">Net score</span>
        <div className="mt-3 font-display text-5xl font-black text-primary">
          <CountUp value={sum.netScore} />
        </div>
        <p className="mt-2 text-sm text-secondary">
          {sum.correct} correct · {sum.wrong} wrong · {sum.accuracyPct}% of attempts right
        </p>
      </article>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button onClick={onReplay} className="btn-primary flex-1">
          New drill
        </button>
        <button onClick={onDone} className="btn-secondary flex-1">
          Back to games
        </button>
      </div>
    </div>
  );
}
