import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { GameChrome } from "@/components/games/GameChrome";
import { StampSeal } from "@/components/visuals/StampSeal";
import { DiceIcon } from "@/components/icons";
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
  advanceShapeShift,
  answerShapeShift,
  buildShapeShiftPaper,
  createShapeShiftSession,
  isShapeShiftExpired,
  remainingMs,
  summarizeShapeShift,
  type Shape,
  type ShapeShiftSession,
} from "@/lib/games/shapeShift/engine";

/**
 * SHAPE SHIFT (`/shape-shift`) — the Optiver Zap-N mental-rotation mini-game: a
 * small asymmetric shape is shown, and you pick — from five orientations — the
 * one after a stated rotation/mirror. Distractors are the shape's OTHER
 * orientations, so only real spatial reasoning wins. Durable, user-scoped resume.
 */

type Phase = "intro" | "play" | "summary";

const GAME_ID = "shape-shift";
const TICK_MS = 250;
const CELL = 16;

function fmtClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function ShapeGrid({ shape, tone = "accent" }: { shape: Shape; tone?: "accent" | "primary" }) {
  const filled = new Set(shape.cells.map((c) => `${c.r},${c.c}`));
  const bg = tone === "accent" ? "bg-accent" : "bg-primary";
  return (
    <div
      className="grid gap-[2px]"
      style={{ gridTemplateColumns: `repeat(${shape.cols}, ${CELL}px)` }}
    >
      {Array.from({ length: shape.rows }).map((_, r) =>
        Array.from({ length: shape.cols }).map((_, c) => (
          <span
            key={`${r},${c}`}
            className={`block ${filled.has(`${r},${c}`) ? bg : "bg-transparent"}`}
            style={{ width: CELL, height: CELL }}
          />
        )),
      )}
    </div>
  );
}

export function ShapeShiftPage() {
  const navigate = useNavigate();
  const { themeDef } = useTheme();
  const { username } = useAuth();

  const [phase, setPhase] = useState<Phase>("intro");
  const [session, setSession] = useState<ShapeShiftSession | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [flash, setFlash] = useState<"correct" | "wrong" | null>(null);

  const items = useMemo(
    () => (session ? buildShapeShiftPaper(session.seed, session.count) : []),
    [session],
  );
  const current = session ? items[session.index] : undefined;

  /* ---- durable resume ------------------------------------------------- */
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const env = loadGameSession<ShapeShiftSession>(
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
    setSession(createShapeShiftSession({ seed, nowTs: Date.now() }));
    setNow(Date.now());
    setFlash(null);
    setPhase("play");
  }, []);

  const restart = useCallback(() => {
    clearGameSession(browserSessionStore(), GAME_ID, username);
    setSession(null);
    setPhase("intro");
  }, [username]);

  const pick = useCallback((choiceIndex: number) => {
    setSession((prev) => {
      if (!prev || prev.status !== "running") return prev;
      const it = buildShapeShiftPaper(prev.seed, prev.count)[prev.index];
      setFlash(choiceIndex === it.correctIndex ? "correct" : "wrong");
      return advanceShapeShift(answerShapeShift(prev, choiceIndex), Date.now());
    });
    setNow(Date.now());
  }, []);

  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(null), 250);
    return () => clearTimeout(id);
  }, [flash, session?.index]);

  useEffect(() => {
    if (phase !== "play" || !session || session.status !== "running") return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (isShapeShiftExpired(session, t)) {
        setSession((prev) => (prev ? { ...prev, status: "finished" } : prev));
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [phase, session]);

  useEffect(() => {
    if (session?.status === "finished" && phase === "play") {
      setPhase("summary");
      const sum = summarizeShapeShift(session, buildShapeShiftPaper(session.seed, session.count));
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

  return (
    <GameChrome
      title="Shape Shift"
      onBack={() => navigate("/games")}
      backLabel="Back to games"
      progress={phase === "play" && session ? session.index / session.count : undefined}
      headerRight={
        phase === "play" && session ? (
          <span className="num text-xs font-semibold tabular-nums text-secondary">
            {String(session.index + 1).padStart(2, "0")}/{session.count} · {fmtClock(remaining)}
          </span>
        ) : undefined
      }
    >
      {phase === "intro" && <Intro onStart={start} />}

      {phase === "play" && session && current && (
        <div className="animate-print-in space-y-5" key={session.index}>
          <article
            className={`panel-ruled p-6 transition-colors ${
              flash === "correct" ? "border-bull" : flash === "wrong" ? "border-bear" : ""
            }`}
          >
            <span className="label text-accent">Apply the transform</span>
            <div className="mt-3 flex flex-wrap items-center gap-5">
              <div className="grid place-items-center border border-border-strong bg-surface p-3">
                <ShapeGrid shape={current.base} tone="primary" />
              </div>
              <div className="flex-1">
                <div className="font-display text-lg font-bold text-primary">
                  {current.transformLabel}
                </div>
                <div className="label mt-1 text-muted">Tier {current.tier}</div>
              </div>
            </div>
          </article>

          <div className="label text-secondary">Which one is the result?</div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {current.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => pick(i)}
                className="grid min-h-24 place-items-center border-2 border-border-strong bg-surface p-2 transition-colors hover:border-accent"
              >
                <ShapeGrid shape={opt} />
              </button>
            ))}
          </div>
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
          <span className="label text-accent">Optiver-style Assessment · Shape Shift</span>
          <span className="grid h-9 w-9 place-items-center border border-border-strong text-accent">
            <DiceIcon width={18} height={18} />
          </span>
        </div>
        <h2 className="mt-2 font-display text-2xl font-semibold leading-tight text-primary">
          Rotate it in your head
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-secondary">
          A fast mental-rotation drill like Optiver's Shape Shift. You're shown a shape and a
          transform — rotate 90°, rotate 180°, mirror, or a combination — and you pick the matching
          result from five options. The wrong options are the shape's other orientations, so you
          can't eliminate your way to the answer: you have to actually rotate it. Beat the clock.
        </p>
      </article>
      <button onClick={onStart} className="btn-primary w-full">
        Start rotating ▸
      </button>
    </div>
  );
}

function Summary({
  session,
  onReplay,
  onDone,
}: {
  session: ShapeShiftSession;
  onReplay: () => void;
  onDone: () => void;
}) {
  const items = useMemo(() => buildShapeShiftPaper(session.seed, session.count), [session]);
  const sum = useMemo(() => summarizeShapeShift(session, items), [session, items]);
  const strong = sum.accuracyPct >= 60;
  return (
    <div className="animate-print-in space-y-5">
      <article className="panel-ruled relative overflow-hidden p-6 text-center">
        <StampSeal label={strong ? "Spatial Ace" : "Keep Drilling"} tone={strong ? "bull" : "accent"} />
        <span className="label text-accent">Weighted score</span>
        <div className="mt-3 font-display text-5xl font-black text-primary">
          <CountUp value={sum.score} />
        </div>
        <p className="mt-2 text-sm text-secondary">
          {sum.correct}/{sum.total} correct · {sum.accuracyPct}% accuracy
        </p>
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
