import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { GameChrome } from "@/components/games/GameChrome";
import { StampSeal } from "@/components/visuals/StampSeal";
import { BoltIcon } from "@/components/icons";
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
  createStockmasterSession,
  currentTrial,
  recordAndAdvance,
  summarizeStockmaster,
  type StockmasterSession,
} from "@/lib/games/stockmaster/engine";

/**
 * STOCKMASTER (`/stockmaster`) — the Optiver Zap-N attention / indicator-
 * tracking mini-game, as a fast go/no-go reflex task. Ticks flash by with a
 * price ARROW and a SIGNAL light; you BUY only on a GO tick (arrow up AND signal
 * green) and hold otherwise. Scored on speed (fast hits) and discipline (no
 * false alarms). Real-time gameplay; the pure engine grades; durable resume.
 */

type Phase = "intro" | "play" | "summary";

const GAME_ID = "stockmaster";

export function StockmasterPage() {
  const navigate = useNavigate();
  const { themeDef } = useTheme();
  const { username } = useAuth();

  const [phase, setPhase] = useState<Phase>("intro");
  const [session, setSession] = useState<StockmasterSession | null>(null);
  const [frac, setFrac] = useState(0); // fraction of current trial window elapsed
  const [flash, setFlash] = useState<"hit" | "miss" | "reject" | "false" | null>(null);

  const trial = session ? currentTrial(session) : undefined;
  const trialStartRef = useRef(0);
  const respondedIdxRef = useRef(-1);

  /* ---- durable resume ------------------------------------------------- */
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const env = loadGameSession<StockmasterSession>(
      browserSessionStore(),
      GAME_ID,
      undefined,
      username,
    );
    if (env?.status === "active" && env.snapshot.status === "running") {
      setSession(env.snapshot);
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
    respondedIdxRef.current = -1;
    setSession(createStockmasterSession({ seed }));
    setFlash(null);
    setPhase("play");
  }, []);

  const restart = useCallback(() => {
    clearGameSession(browserSessionStore(), GAME_ID, username);
    respondedIdxRef.current = -1;
    setSession(null);
    setPhase("intro");
  }, [username]);

  // Respond to the CURRENT trial (reacted = the player clicked in time). Guarded
  // so a click and the timeout can't both fire for the same trial index.
  const respond = useCallback(
    (reacted: boolean) => {
      setSession((prev) => {
        if (!prev || prev.status !== "running") return prev;
        if (respondedIdxRef.current === prev.index) return prev;
        respondedIdxRef.current = prev.index;
        const t = prev.trialWindowMs;
        const elapsed = performance.now() - trialStartRef.current;
        const reactionFraction = Math.max(0, Math.min(1, elapsed / t));
        const cur = currentTrial(prev)!;
        if (reacted) setFlash(cur.isGo ? "hit" : "false");
        else setFlash(cur.isGo ? "miss" : "reject");
        return recordAndAdvance(prev, reacted, reactionFraction);
      });
    },
    [],
  );

  // Per-trial real-time loop: reset the clock on each new trial, animate the
  // window, and auto-time-out (a no-react response) when it closes.
  useEffect(() => {
    if (phase !== "play" || !session || session.status !== "running") return;
    trialStartRef.current = performance.now();
    setFrac(0);
    let raf = 0;
    const window = session.trialWindowMs;
    const loop = () => {
      const elapsed = performance.now() - trialStartRef.current;
      const f = Math.min(1, elapsed / window);
      setFrac(f);
      if (f >= 1) {
        respond(false);
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase, session, respond]);

  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(null), 220);
    return () => clearTimeout(id);
  }, [flash, session?.index]);

  useEffect(() => {
    if (session?.status === "finished" && phase === "play") {
      setPhase("summary");
      const sum = summarizeStockmaster(session);
      submitLocalScore(browserBoardStore(), GAME_ID, {
        score: sum.score,
        atMs: Date.now(),
        meta: { hits: sum.hits, falseAlarms: sum.falseAlarms },
      });
      void submitGameScore(GAME_ID, sum.score);
      if (sum.score > 0) setTimeout(themeDef.celebration ?? celebrate, 260);
    }
  }, [session, phase, themeDef.celebration]);

  const timeLeft = 1 - frac;

  return (
    <GameChrome
      title="Stockmaster"
      onBack={() => navigate("/games")}
      backLabel="Back to games"
      progress={phase === "play" && session ? session.index / session.count : undefined}
      headerRight={
        phase === "play" && session ? (
          <span className="num text-xs font-semibold tabular-nums text-secondary">
            {session.index + 1}/{session.count}
          </span>
        ) : undefined
      }
    >
      {phase === "intro" && <Intro onStart={start} />}

      {phase === "play" && session && trial && (
        <div className="animate-print-in space-y-6" key={session.index}>
          {/* Reaction window bar */}
          <div className="h-2 w-full overflow-hidden border border-subtle bg-surface">
            <div
              className={`h-full ${timeLeft > 0.5 ? "bg-bull" : timeLeft > 0.25 ? "bg-warning" : "bg-bear"}`}
              style={{ width: `${timeLeft * 100}%` }}
            />
          </div>

          {/* The tick: arrow + signal light */}
          <article
            className={`panel-ruled grid place-items-center gap-4 p-10 text-center transition-colors ${
              flash === "hit" || flash === "reject"
                ? "border-bull"
                : flash === "miss" || flash === "false"
                  ? "border-bear"
                  : ""
            }`}
          >
            <div className="flex items-center gap-8">
              <div
                className={`font-display text-7xl font-black leading-none ${
                  trial.arrow === "up" ? "text-bull" : "text-bear"
                }`}
                aria-label={`arrow ${trial.arrow}`}
              >
                {trial.arrow === "up" ? "▲" : "▼"}
              </div>
              <div className="grid place-items-center gap-1">
                <span
                  className={`block h-16 w-16 rounded-full border-4 ${
                    trial.signal === "green"
                      ? "border-bull bg-bull/30"
                      : "border-bear bg-bear/30"
                  }`}
                  aria-label={`signal ${trial.signal}`}
                />
                <span className="label text-muted">{trial.signal}</span>
              </div>
            </div>
            <p className="text-sm text-secondary">
              Buy only when the arrow is <span className="text-bull">up</span> AND the light is{" "}
              <span className="text-bull">green</span>.
            </p>
          </article>

          <button
            onClick={() => respond(true)}
            className="btn-primary w-full !py-5 text-lg"
          >
            BUY ▲
          </button>
          <p className="text-center text-xs text-muted">
            Or do nothing to pass. Wrong buys and missed signals both cost you.
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
          <span className="label text-accent">Optiver-style Assessment · Stockmaster</span>
          <span className="grid h-9 w-9 place-items-center border border-border-strong text-accent">
            <BoltIcon width={18} height={18} />
          </span>
        </div>
        <h2 className="mt-2 font-display text-2xl font-semibold leading-tight text-primary">
          Track the indicator, react fast
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-secondary">
          A fast attention drill like Optiver's Stockmaster. Ticks flash by, each showing a price
          arrow and a signal light. Hit BUY the instant you see a GO tick — arrow up AND light green —
          and hold on everything else. Fast, correct buys score the most; false buys and missed
          signals both cost you. It's a sustained-attention and impulse-control test, so stay locked in.
        </p>
      </article>
      <button onClick={onStart} className="btn-primary w-full">
        Open the tape ▸
      </button>
    </div>
  );
}

function Summary({
  session,
  onReplay,
  onDone,
}: {
  session: StockmasterSession;
  onReplay: () => void;
  onDone: () => void;
}) {
  const sum = useMemo(() => summarizeStockmaster(session), [session]);
  const strong = sum.score > 0 && sum.falseAlarms + sum.misses <= sum.hits;
  return (
    <div className="animate-print-in space-y-5">
      <article className="panel-ruled relative overflow-hidden p-6 text-center">
        <StampSeal label={strong ? "Locked In" : "Keep Drilling"} tone={strong ? "bull" : "accent"} />
        <span className="label text-accent">Score</span>
        <div className="mt-3 font-display text-5xl font-black text-primary">
          <CountUp value={sum.score} />
        </div>
        <p className="mt-2 text-sm text-secondary">{sum.accuracyPct}% of ticks judged correctly</p>
      </article>

      <div className="grid grid-cols-4 divide-x divide-subtle border-y border-subtle text-center">
        <Stat label="Hits" value={sum.hits} tone="text-bull" />
        <Stat label="Misses" value={sum.misses} tone="text-bear" />
        <Stat label="Rejects" value={sum.correctRejects} tone="text-secondary" />
        <Stat label="False buys" value={sum.falseAlarms} tone="text-bear" />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button onClick={onReplay} className="btn-primary flex-1">
          Play again
        </button>
        <button onClick={onDone} className="btn-secondary flex-1">
          Back to games
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="px-2 py-3">
      <div className="label text-[9px] text-muted">{label}</div>
      <div className={`num mt-1 text-lg font-semibold ${tone}`}>{value}</div>
    </div>
  );
}
