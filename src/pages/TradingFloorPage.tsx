/**
 * THE TRADING FLOOR (`/trading-floor`) — a full-screen, adversarial make-a-market
 * game. You quote a two-sided market on a hidden quantity round by round; an
 * informed-with-noise counterparty picks you off only when your price is on the
 * wrong side of fair, while uninformed flow pays your spread. For binary packs
 * the mid is a probability and the whole loop is a proper scoring rule, so honest
 * calibration is the P&L-maximizing strategy.
 *
 * The PURE engine (`@/lib/tradingFloor`) owns all game/clock semantics; this
 * component owns only the wall clock (a `setInterval(TICK_MS)` → `tick`) and
 * input, mirroring `ArenaRunner`. The live engine state is held in a ref so the
 * timer always advances the freshest state (the source of truth).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/context/ThemeContext";
import { useProgress } from "@/context/ProgressContext";
import { ThemeBackground } from "@/components/visuals/ThemeBackground";
import { ChevronLeftIcon, CandlestickIcon, BoltIcon } from "@/components/icons";
import { celebrate } from "@/lib/celebrate";
import { Rng } from "@/lib/rng";
import {
  SCENARIO_PACKS,
  FLOOR_CONFIGS,
  FLOOR_BOARD,
  FLOOR_TOPIC_KEY,
  floorConfigHash,
  startFloor,
  postQuote,
  advanceReveal,
  tick,
  finishFloor,
  currentFair,
  currentPosteriorSd,
  currentReveal,
  resumeFloor,
  type ScenarioPack,
  type FloorConfig,
  type FloorState,
  type FloorResult,
  type UserQuote,
  type RoundFill,
  type FloorMove,
} from "@/lib/tradingFloor";
import {
  recordLocalRun,
  trailing7DayMedian,
  type PersonalBest,
} from "@/lib/arena/localPb";
import { browserBoardStore, submitLocalScore } from "@/lib/leaderboard/localBoard";
import { submitGameScore } from "@/lib/leaderboard/client";
import {
  browserSessionStore,
  clearGameSession,
  loadGameSession,
  saveGameSession,
} from "@/lib/leaderboard/gameSession";
import { QuotePad } from "@/components/tradingFloor/QuotePad";
import { RoundBoard } from "@/components/tradingFloor/RoundBoard";
import { LivePnl, InventoryPill } from "@/components/tradingFloor/LivePnl";
import { FloorDebrief } from "@/components/tradingFloor/FloorDebrief";
import { clock, fmtNum, fmtPct } from "@/components/tradingFloor/format";

const TICK_MS = 100;

const GAME_ID = "trading-floor";

type Screen = "setup" | "playing" | "debrief";

interface PbView {
  pb: PersonalBest | null;
  isNewBest: boolean;
  median7d: number | null;
}

/**
 * Durable, reload-proof snapshot of an in-progress floor. `FloorState` holds
 * live functions + an `Rng`, so we persist only the DETERMINISTIC inputs — the
 * seed, pack/config ids, and the ordered per-round moves — and rebuild the exact
 * state on resume via `resumeFloor` (see the engine).
 */
interface FloorSession {
  packId: string;
  configId: string;
  coachOn: boolean;
  seed: number;
  moves: FloorMove[];
  /** True ⇒ the user left while quoting (land back on the quote pad). */
  resumeQuoting: boolean;
}

export function TradingFloorPage(): JSX.Element {
  const navigate = useNavigate();
  const { themeDef } = useTheme();
  const { recordCalibrationPair } = useProgress();

  const [screen, setScreen] = useState<Screen>("setup");
  const [packId, setPackId] = useState<string>(SCENARIO_PACKS[0].id);
  const [configId, setConfigId] = useState<string>(FLOOR_CONFIGS[1].id);
  const [coachOn, setCoachOn] = useState(false);

  const [state, setState] = useState<FloorState | null>(null);
  const stateRef = useRef<FloorState | null>(null);
  const setFloor = (s: FloorState) => {
    stateRef.current = s;
    setState(s);
  };

  const [result, setResult] = useState<FloorResult | null>(null);
  const [pbView, setPbView] = useState<PbView | null>(null);
  // The pack/config the CURRENT live session was started with (for the PB hash).
  const sessionRef = useRef<{ pack: ScenarioPack; config: FloorConfig } | null>(null);
  // Guards the once-per-finished side effects (PB, calibration, celebration).
  const finishedRef = useRef<FloorState | null>(null);
  // Durable save/resume bookkeeping: the seed the live run started from and the
  // ordered per-round moves (real quotes + shot-clock stand-asides) that, with
  // the seed + ids, deterministically rebuild the state on re-entry.
  const seedRef = useRef<number>(0);
  const movesRef = useRef<FloorMove[]>([]);
  const hydratedRef = useRef(false);

  const pack = useMemo(
    () => SCENARIO_PACKS.find((p) => p.id === packId) ?? SCENARIO_PACKS[0],
    [packId],
  );
  const config = useMemo(
    () => FLOOR_CONFIGS.find((c) => c.id === configId) ?? FLOOR_CONFIGS[1],
    [configId],
  );

  const start = () => {
    const seed = Math.floor(Math.random() * 1e9);
    const scenario = pack.build(new Rng(seed));
    const fresh = startFloor(scenario, config, seed);
    sessionRef.current = { pack, config };
    finishedRef.current = null;
    seedRef.current = seed;
    movesRef.current = [];
    clearGameSession(browserSessionStore(), GAME_ID);
    setResult(null);
    setPbView(null);
    setFloor(fresh);
    setScreen("playing");
  };

  const submitQuote = (quote: UserQuote) => {
    const cur = stateRef.current;
    if (!cur || cur.phase !== "quoting") return;
    movesRef.current = [...movesRef.current, { quote, standAside: false }];
    setFloor(postQuote(cur, quote));
  };

  const next = () => {
    const cur = stateRef.current;
    if (!cur || cur.phase !== "revealed") return;
    setFloor(advanceReveal(cur));
  };

  // Wall clock: advance the shot clock while quoting (the engine auto-stands
  // aside on timeout). One interval spans the whole playing screen. A timeout
  // (quoting → resolved this tick) is recorded as a stand-aside MOVE so a resumed
  // run replays it identically.
  useEffect(() => {
    if (screen !== "playing") return;
    const id = setInterval(() => {
      const cur = stateRef.current;
      if (!cur || cur.phase !== "quoting") return;
      const fairNow = currentFair(cur);
      const nextState = tick(cur, TICK_MS);
      if (nextState.phase !== "quoting") {
        // The shot clock expired: the engine auto-resolved with a size-0 stand
        // aside quoted at the current fair (see `tick`). Record it verbatim.
        movesRef.current = [
          ...movesRef.current,
          { quote: { mid: fairNow, half: 0, skew: 0, size: 0 }, standAside: true },
        ];
      }
      setFloor(nextState);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [screen]);

  // Durable resume: rebuild an in-progress floor from its saved moves on mount.
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const env = loadGameSession<FloorSession>(browserSessionStore(), GAME_ID);
    if (!env || env.status !== "active") return;
    const s = env.snapshot;
    const savedPack = SCENARIO_PACKS.find((p) => p.id === s.packId);
    const savedConfig = FLOOR_CONFIGS.find((c) => c.id === s.configId);
    if (!savedPack || !savedConfig) return;
    const scenario = savedPack.build(new Rng(s.seed));
    const rebuilt = resumeFloor(scenario, savedConfig, s.seed, s.moves, s.resumeQuoting);
    if (rebuilt.phase === "finished") return; // never resume a completed run
    sessionRef.current = { pack: savedPack, config: savedConfig };
    seedRef.current = s.seed;
    movesRef.current = s.moves;
    finishedRef.current = null;
    setPackId(s.packId);
    setConfigId(s.configId);
    setCoachOn(s.coachOn);
    setResult(null);
    setPbView(null);
    setFloor(rebuilt);
    setScreen("playing");
  }, []);

  // Snapshot the in-progress run after every resolved round / phase change so a
  // navigate-away resumes instead of resetting. The finished state clears the
  // session in the finish effect below, so we never persist a completed run.
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (screen !== "playing" || !state || state.phase === "finished") return;
    saveGameSession<FloorSession>(
      browserSessionStore(),
      GAME_ID,
      {
        packId,
        configId,
        coachOn,
        seed: seedRef.current,
        moves: movesRef.current,
        resumeQuoting: state.phase === "quoting",
      },
      Date.now(),
    );
  }, [screen, state, packId, configId, coachOn]);

  // Finish once: settle the book, record PB + calibration, celebrate a win.
  useEffect(() => {
    if (!state || state.phase !== "finished") return;
    if (finishedRef.current === state) return;
    finishedRef.current = state;

    const res = finishFloor(state);
    setResult(res);

    const session = sessionRef.current;
    if (session) {
      const hash = floorConfigHash(session.pack.id, session.config, res.rounds);
      const now = Date.now();
      const { pb, isNewBest } = recordLocalRun(
        window.localStorage,
        FLOOR_BOARD,
        hash,
        res.userFinal,
        now,
      );
      const median7d = trailing7DayMedian(
        window.localStorage,
        FLOOR_BOARD,
        hash,
        now,
      );
      setPbView({ pb, isNewBest, median7d });
    } else {
      setPbView(null);
    }

    // Unified competitive leaderboard: record the final P&L on the cross-game
    // local board (higher-is-better) + submit to the optional server board.
    // Additive alongside the existing FLOOR_BOARD personal-best above.
    submitLocalScore(browserBoardStore(), "trading-floor", {
      score: res.userFinal,
      atMs: Date.now(),
    });
    void submitGameScore("trading-floor", res.userFinal);

    // Accrue calibration exactly once per finished BINARY session.
    if (res.kind === "binary") {
      for (const p of res.calibrationPairs) {
        recordCalibrationPair(FLOOR_TOPIC_KEY, p.pred, p.outcome);
      }
    }

    if (res.userFinal >= res.benchFinal) {
      setTimeout(themeDef.celebration ?? celebrate, 260);
    }

    // Run finished: drop the durable session so it can't resurrect a done game.
    clearGameSession(browserSessionStore(), GAME_ID);
    setScreen("debrief");
  }, [state, recordCalibrationPair, themeDef.celebration]);

  return (
    <div className="relative min-h-[100dvh]">
      <ThemeBackground />

      <header className="sticky top-0 z-20 border-b-[3px] border-border-strong bg-surface">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5">
          <button
            onClick={() => navigate("/")}
            className="btn-ghost !min-h-0 !px-2 !py-1.5"
            aria-label="Back home"
          >
            <ChevronLeftIcon width={18} height={18} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-sm font-semibold text-primary">
              The Trading Floor
            </div>
          </div>
          {screen === "playing" && state && <PlayingHeader state={state} />}
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-3xl px-4 py-6">
        {screen === "setup" && (
          <Setup
            packId={packId}
            configId={configId}
            coachOn={coachOn}
            onPack={setPackId}
            onConfig={setConfigId}
            onCoach={setCoachOn}
            onStart={start}
          />
        )}

        {screen === "playing" && state && (
          <Playing
            state={state}
            coachOn={coachOn}
            onSubmit={submitQuote}
            onNext={next}
          />
        )}

        {screen === "debrief" && result && (
          <FloorDebrief
            result={result}
            pb={pbView?.pb ?? null}
            isNewBest={pbView?.isNewBest ?? false}
            median7d={pbView?.median7d ?? null}
            onRestart={() => {
              clearGameSession(browserSessionStore(), GAME_ID);
              setScreen("setup");
            }}
          />
        )}
      </main>
    </div>
  );
}

/* ========================================================================== */
/*  Playing header (shot clock, P&L, inventory, pick-offs, round x/total)      */
/* ========================================================================== */

function PlayingHeader({ state }: { state: FloorState }): JSX.Element {
  const pnl = state.pnlPath.length ? state.pnlPath[state.pnlPath.length - 1] : 0;
  const clockTone = state.remainingMs < 10_000 ? "text-bear" : "text-primary";
  const displayRound =
    state.phase === "quoting"
      ? Math.min(state.round + 1, state.totalRounds)
      : Math.min(state.round, state.totalRounds);
  return (
    <div className="flex items-center gap-3">
      {state.phase === "quoting" && (
        <div className="text-right">
          <span className="label text-[9px] text-muted">Clock</span>
          <div className={`num text-lg font-black leading-none ${clockTone}`}>
            {clock(state.remainingMs)}
          </div>
        </div>
      )}
      <LivePnl pnl={pnl} />
      <InventoryPill inventory={state.inventory} />
      <span
        className={`chip num ${state.pickedOff > 0 ? "border-bear text-bear" : "border-subtle text-secondary"}`}
        title="Times an informed trader picked you off"
      >
        PO {state.pickedOff}
      </span>
      <span className="chip num border-subtle text-secondary">
        {displayRound}/{state.totalRounds}
      </span>
    </div>
  );
}

/* ========================================================================== */
/*  Setup                                                                      */
/* ========================================================================== */

function Setup(props: {
  packId: string;
  configId: string;
  coachOn: boolean;
  onPack: (id: string) => void;
  onConfig: (id: string) => void;
  onCoach: (on: boolean) => void;
  onStart: () => void;
}): JSX.Element {
  const { packId, configId, coachOn, onPack, onConfig, onCoach, onStart } = props;
  return (
    <div className="animate-print-in space-y-5">
      <article className="panel-ruled p-6">
        <div className="flex items-center justify-between">
          <span className="label text-accent">Make-a-market · live</span>
          <span className="grid h-9 w-9 place-items-center border border-border-strong text-accent">
            <CandlestickIcon width={18} height={18} />
          </span>
        </div>
        <h2 className="mt-2 font-display text-2xl font-semibold leading-tight text-primary">
          Step onto the trading floor.
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-secondary">
          Each round you post a two-sided market on a hidden quantity as it's
          revealed a step at a time. An{" "}
          <strong className="text-primary">informed counterparty</strong> only
          trades when your price is on the wrong side of fair — a pick-off — while{" "}
          <strong className="text-primary">uninformed flow pays your spread</strong>{" "}
          when you're competitive. Quote tight where you're sure, wide where you're
          not, and skew off your inventory. Beat the honest desk on the same flow.
        </p>
      </article>

      {/* Scenario pack */}
      <article className="panel-ruled p-6">
        <div className="label text-accent">Scenario pack</div>
        <div className="mt-3 grid gap-3">
          {SCENARIO_PACKS.map((p) => {
            const selected = p.id === packId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onPack(p.id)}
                aria-pressed={selected}
                className={`border-l-4 px-4 py-3 text-left transition-colors ${
                  selected
                    ? "border-l-accent bg-surface-muted"
                    : "border-l-subtle bg-surface hover:bg-surface-muted"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-base font-semibold text-primary">
                    {p.title}
                  </span>
                  <span
                    className={`chip ${p.kind === "binary" ? "border-accent text-accent" : "border-accent-2 text-accent-2"}`}
                  >
                    {p.kind === "binary" ? "0/1 · calibration" : "quantity"}
                  </span>
                </div>
                <p className="mt-1 text-sm leading-snug text-secondary">{p.blurb}</p>
              </button>
            );
          })}
        </div>
      </article>

      {/* Difficulty */}
      <article className="panel-ruled p-6">
        <div className="label text-accent">Difficulty</div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {FLOOR_CONFIGS.map((c) => {
            const selected = c.id === configId;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onConfig(c.id)}
                aria-pressed={selected}
                className={`border px-3 py-3 text-left transition-colors ${
                  selected
                    ? "border-strong bg-surface-muted"
                    : "border-subtle bg-surface hover:bg-surface-muted"
                }`}
              >
                <div className="font-display text-sm font-semibold text-primary">
                  {c.label}
                </div>
                <div className="num mt-1 text-[11px] text-muted">
                  {Math.round(c.bot.informedProb * 100)}% informed ·{" "}
                  {clock(c.shotClockMs)} clock
                </div>
              </button>
            );
          })}
        </div>

        {/* Coach toggle */}
        <label className="mt-4 flex items-center justify-between border-l-2 border-accent bg-surface-muted px-3 py-2.5">
          <span>
            <span className="label text-accent">Coach</span>
            <span className="mt-0.5 block text-[13px] leading-snug text-secondary">
              Show the textbook fair value + posterior sd while you quote.
            </span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={coachOn}
            onClick={() => onCoach(!coachOn)}
            className={`chip ${coachOn ? "border-accent text-accent" : "border-subtle text-muted"}`}
          >
            {coachOn ? "ON" : "OFF"}
          </button>
        </label>

        <button onClick={onStart} className="btn-primary mt-5 w-full">
          Open the market →
        </button>
      </article>
    </div>
  );
}

/* ========================================================================== */
/*  Playing (round board + quote pad / reveal)                                 */
/* ========================================================================== */

function Playing(props: {
  state: FloorState;
  coachOn: boolean;
  onSubmit: (q: UserQuote) => void;
  onNext: () => void;
}): JSX.Element {
  const { state, coachOn, onSubmit, onNext } = props;
  const scenario = state.scenario;
  const kind = scenario.kind;
  const reveal = currentReveal(state);
  const coach =
    coachOn && state.phase === "quoting"
      ? { fair: currentFair(state), sd: currentPosteriorSd(state) }
      : null;

  const lastFill =
    state.fills.length > 0 ? state.fills[state.fills.length - 1] : undefined;

  return (
    <div className="animate-print-in space-y-5">
      <RoundBoard
        prompt={scenario.prompt}
        kind={kind}
        unit={scenario.unit}
        latestReveal={reveal}
        history={state.revealed}
        coach={coach}
      />

      {state.phase === "quoting" && (
        <QuotePad
          kind={kind}
          unit={scenario.unit}
          maxSize={state.config.maxSize}
          inventory={state.inventory}
          onSubmit={onSubmit}
        />
      )}

      {state.phase === "revealed" && lastFill && (
        <>
          <FillCard fill={lastFill} kind={kind} unit={scenario.unit} />
          <button onClick={onNext} className="btn-primary w-full">
            Next round →
          </button>
        </>
      )}
    </div>
  );
}

function FillCard({
  fill,
  kind,
  unit,
}: {
  fill: RoundFill;
  kind: "binary" | "quantity";
  unit: string;
}): JSX.Element {
  const traded = fill.side !== "none";
  const bought = fill.side === "userBuys";
  const price = kind === "binary" ? fmtPct(fill.price) : `${fmtNum(fill.price)} ${unit}`;
  return (
    <article
      className={`panel-ruled border-l-4 p-4 ${
        !traded ? "border-l-subtle" : fill.adverse ? "border-l-bear" : "border-l-bull"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="label text-muted">Fill</div>
        {traded && fill.adverse && (
          <span className="chip border-bear text-bear">
            <BoltIcon width={12} height={12} /> picked off
          </span>
        )}
      </div>
      {traded ? (
        <p className="num mt-1 text-base font-semibold text-primary">
          You{" "}
          <span className={bought ? "text-bull" : "text-bear"}>
            {bought ? "BOUGHT" : "SOLD"} {fill.size}
          </span>{" "}
          @ {price}
        </p>
      ) : (
        <p className="mt-1 text-base font-semibold text-muted">
          No trade — you stood aside (or nobody lifted your market).
        </p>
      )}
      {traded && !fill.adverse && (
        <p className="mt-1 text-sm text-secondary">
          Uninformed flow paid your spread — clean edge.
        </p>
      )}
      {traded && fill.adverse && (
        <p className="mt-1 text-sm text-secondary">
          An informed trader took the wrong side of your price. Recentre before
          adding size.
        </p>
      )}
    </article>
  );
}
