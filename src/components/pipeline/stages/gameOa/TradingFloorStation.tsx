import { useEffect, useMemo, useRef, useState } from "react";
import { Rng } from "@/lib/rng";
import {
  startFloor,
  postQuote,
  advanceReveal,
  finishFloor,
  currentReveal,
  tick,
  packById,
  floorConfigById,
  type FloorResult,
  type FloorState,
  type UserQuote,
} from "@/lib/tradingFloor";
import { tradingSubtopicByGame } from "@/lib/mastery/tradingSubtopics";
import {
  CLOCK_TICK_MS,
  StationProgress,
  TimerBar,
  fmtNum,
  useStationFold,
  useStationSeed,
  type StationProps,
} from "./kit";

const SUBTOPIC = tradingSubtopicByGame("trading-floor").key;

function pnlDelta(state: FloorState): number {
  const path = state.pnlPath;
  if (path.length < 2) return path[path.length - 1] ?? 0;
  return path[path.length - 1] - path[path.length - 2];
}

/**
 * Trading Floor battery station — reuses the pure round-loop engine
 * (`startFloor` / `postQuote` / `advanceReveal` / `finishFloor`) on the
 * quantity "Running Total" pack at the forgiving Warm-up preset. It trains live
 * quoting & inventory management: quote a two-sided market (mid / half-spread /
 * size) round after round as the total is revealed pip by pip and inventory
 * accumulates. It runs LIVE against the engine's shot clock (Warm-up preset,
 * `WARMUP.shotClockMs`): the same `setInterval → tick` loop the stand-alone
 * `TradingFloorPage` uses drains the per-round clock, and if it hits zero the
 * engine auto-resolves the round as a size-0 STAND-ASIDE. A quote whose marked
 * P&L delta is non-negative folds full credit into
 * `competency::inventory-management`; a shot-clock TIMEOUT folds 0 (a stalled
 * maker is never rewarded), so the subtopic Beta reflects timed performance.
 */
export default function TradingFloorStation({ onComplete, seed: seedProp }: StationProps) {
  const { record, summary } = useStationFold(SUBTOPIC);
  const mountSeed = useStationSeed(seedProp);
  const [st, setSt] = useState<FloorState>(() => {
    const scenario = packById("running-total").build(new Rng(mountSeed));
    return startFloor(scenario, floorConfigById("warmup"), mountSeed);
  });
  const [reveal, setReveal] = useState<{ delta: number; timedOut: boolean } | null>(
    null,
  );
  const resultRef = useRef<FloorResult | null>(null);
  const doneRef = useRef(false);

  // The live engine state is mirrored in a ref so the shot-clock interval always
  // advances the freshest state (mirrors TradingFloorPage's `stateRef`).
  const stateRef = useRef(st);
  useEffect(() => {
    stateRef.current = st;
  }, [st]);

  const [mid, setMid] = useState("");
  const [half, setHalf] = useState("");
  const [size, setSize] = useState("2");

  const maxSize = st.config.maxSize;
  const info = currentReveal(st);
  const round = st.round;
  const total = st.totalRounds;
  const midOk = mid !== "" && Number.isFinite(parseFloat(mid));
  const halfOk = half !== "" && Number.isFinite(parseFloat(half)) && parseFloat(half) >= 0;

  // Live shot clock: while quoting, drain the clock with the engine's `tick`.
  // On timeout the engine flips out of "quoting" via a size-0 stand-aside; we
  // record that as a miss (credit 0) and show the reveal.
  useEffect(() => {
    if (st.phase !== "quoting" || reveal !== null) return;
    const id = setInterval(() => {
      const cur = stateRef.current;
      if (cur.phase !== "quoting") return;
      const next = tick(cur, CLOCK_TICK_MS);
      if (next.phase !== "quoting") {
        record(0);
        stateRef.current = next;
        setSt(next);
        setReveal({ delta: pnlDelta(next), timedOut: true });
      } else {
        stateRef.current = next;
        setSt(next);
      }
    }, CLOCK_TICK_MS);
    return () => clearInterval(id);
  }, [st.phase, reveal, record]);

  const submit = () => {
    if (reveal) return;
    const quote: UserQuote = {
      mid: parseFloat(mid),
      half: parseFloat(half),
      skew: 0,
      size: Math.max(0, Math.min(maxSize, parseInt(size, 10) || 0)),
    };
    const next = postQuote(st, quote);
    const delta = pnlDelta(next);
    record(delta >= 0 ? 1 : 0);
    setSt(next);
    setReveal({ delta, timedOut: false });
  };

  const advance = () => {
    if (st.phase === "finished") {
      if (doneRef.current) return;
      doneRef.current = true;
      const result = finishFloor(st);
      resultRef.current = result;
      onComplete(
        summary(
          `P&L ${result.userFinal >= 0 ? "+" : "−"}${fmtNum(
            Math.abs(result.userFinal),
          )} vs desk ${fmtNum(result.benchFinal)}`,
        ),
      );
      return;
    }
    setSt(advanceReveal(st));
    setReveal(null);
    setMid("");
    setHalf("");
  };

  const revealedChips = useMemo(
    () => st.revealed.map((r) => r.label),
    [st.revealed],
  );

  return (
    <div className="space-y-4" data-testid="trading-floor-station">
      <StationProgress index={round} total={total} label="Quote" />

      <div className="panel-ruled p-5">
        <span className="label text-accent">{st.scenario.title}</span>
        <h3 className="mt-1 font-display text-base font-semibold leading-snug text-primary">
          {st.scenario.prompt}
        </h3>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {revealedChips.map((label, i) => (
            <span key={i} className="chip num border-subtle text-secondary">
              {label}
            </span>
          ))}
        </div>
        <div className="rule-row mt-3 !border-b-0">
          <span className="label text-muted">Inventory</span>
          <span
            className={`num text-sm ${
              st.inventory === 0
                ? "text-secondary"
                : st.inventory > 0
                  ? "text-bull"
                  : "text-bear"
            }`}
          >
            {st.inventory > 0 ? "+" : ""}
            {st.inventory}
          </span>
        </div>
      </div>

      {reveal === null ? (
        <div className="space-y-3">
          <TimerBar
            remainingMs={st.remainingMs}
            durationMs={st.config.shotClockMs}
          />
          <div className="grid grid-cols-3 gap-2">
            <label className="block">
              <span className="label mb-1 block text-muted">Mid (E[total])</span>
              <input
                className="input w-full"
                inputMode="decimal"
                value={mid}
                onChange={(e) => setMid(e.target.value)}
                aria-label="mid"
              />
            </label>
            <label className="block">
              <span className="label mb-1 block text-muted">± Half-spread</span>
              <input
                className="input w-full"
                inputMode="decimal"
                value={half}
                onChange={(e) => setHalf(e.target.value)}
                aria-label="half spread"
              />
            </label>
            <label className="block">
              <span className="label mb-1 block text-muted">Size (≤{maxSize})</span>
              <input
                className="input w-full"
                inputMode="numeric"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                aria-label="size"
              />
            </label>
          </div>
          {info && (
            <p className="text-xs text-muted">
              Latest reveal: <span className="text-secondary">{info.label}</span>
            </p>
          )}
          <button
            type="button"
            className="btn-primary w-full"
            onClick={submit}
            disabled={!midOk || !halfOk}
          >
            Post quote
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div
            className={`verdict ${
              reveal.timedOut
                ? "bg-bear text-bg"
                : reveal.delta >= 0
                  ? "bg-bull text-bg"
                  : "bg-bear text-bg"
            }`}
          >
            {reveal.timedOut
              ? "● Shot clock — stood aside (no fill)"
              : reveal.delta >= 0
                ? "● Held / grew the book"
                : "● Bled on that round"}{" "}
            · round P&amp;L {reveal.delta >= 0 ? "+" : "−"}
            {fmtNum(Math.abs(reveal.delta))}
          </div>
          <button
            type="button"
            className="btn-primary w-full"
            onClick={advance}
            data-testid="station-advance"
          >
            {st.phase === "finished" ? "Finish game →" : "Next quote →"}
          </button>
        </div>
      )}
    </div>
  );
}
