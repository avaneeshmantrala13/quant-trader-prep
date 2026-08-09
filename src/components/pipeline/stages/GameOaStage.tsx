import { Suspense, useMemo, useRef, useState } from "react";
import { useProgress } from "@/context/ProgressContext";
import type { StageComponentProps } from "../stageRegistry";
import { drillingProgress } from "@/lib/pipeline/drilling";
import { BATTERY, type BatteryStation } from "./gameOa/battery";
import type { StationSummary } from "./gameOa/kit";

/**
 * ============================================================================
 *  STAGE 4 — GAME-OA / TRADING-INTUITION BATTERY  (guided pipeline)
 * ============================================================================
 * The Game-OA stage is a full Optiver-style BATTERY played entirely INSIDE the
 * guided shell (no free-roam nav, no games hub). It sequences the learner
 * through the eleven embedded game stations in {@link BATTERY} — make-a-market,
 * the trading floor, cards MM, next-card betting, arbitrage & de-vig, Fermi,
 * NumberLogic, Beat the Odds, Stockmaster, Number Box, Shape Shift — each of
 * which REUSES its game's pure engine (nothing is rebuilt) and folds its scored
 * rounds into its OWN trading-intuition subtopic Beta.
 *
 * GATING (spec): the aggregate `competency::trading-intuition` gate ROLLS UP the
 * eleven subtopics — Game-OA/Stage-6 is "done" only once EVERY subtopic clears
 * its 0.80 bar. One battery pass SEEDS every subtopic; any that stay weak keep
 * the Stage-6 drilling gate open and route the learner back to that EXACT game
 * (`@/lib/pipeline/diagnosis` + `drilling` → `DrillingStage`). This stage owns no
 * gate logic of its own; it only plays the games and folds credit through the
 * same `recordItemAttempt` Beta path every node uses.
 *
 * CONTRACT: a {@link StageComponent} — receives only `onComplete` and calls it
 * once, at the end of the battery, with the `{ rounds, pnl, verdict }` payload
 * the coordinator persists into `progress.pipeline.gameOa`.
 */

/** The result payload handed to `onComplete` → `progress.pipeline.gameOa`. */
export interface GameOaResult {
  rounds: number;
  pnl: number;
  verdict: string;
}

interface StationResult {
  station: BatteryStation;
  summary: StationSummary;
}

type Phase = "intro" | "playing" | "summary";

export default function GameOaStage({ onComplete }: StageComponentProps) {
  const { progress } = useProgress();
  const [phase, setPhase] = useState<Phase>("intro");
  const [stationIdx, setStationIdx] = useState(0);
  const [results, setResults] = useState<StationResult[]>([]);
  const doneRef = useRef(false);
  // One stable base seed per battery mount, so every station's content is
  // seed-reproducible (same base ⇒ same battery) — derived per station with a
  // large odd stride so no two stations share a stream.
  const seedBaseRef = useRef<number>(Math.floor(Math.random() * 1e9));

  const station = BATTERY[stationIdx];
  const stationSeed = (seedBaseRef.current + stationIdx * 1_000_003) >>> 0;

  const handleStationComplete = (summary: StationSummary) => {
    setResults((prev) => [...prev, { station, summary }]);
    if (stationIdx >= BATTERY.length - 1) {
      setPhase("summary");
    } else {
      setStationIdx((n) => n + 1);
    }
  };

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onComplete(buildBatteryResult(results, progress));
  };

  return (
    <section className="panel space-y-5 p-6" data-testid="game-oa-stage">
      <header className="space-y-1">
        <span className="label text-accent">Stage 4 · Trading intuition</span>
        <h2 className="font-display text-2xl font-bold text-primary">
          The Optiver battery
        </h2>
        <p className="text-sm text-secondary">
          A sequence of {BATTERY.length} market &amp; cognitive games. Each one
          scores a distinct trading skill; the aggregate read decides when you're
          through, and any weak skill routes you back to that game in drilling.
        </p>
      </header>

      {phase === "intro" && (
        <Intro onStart={() => setPhase("playing")} />
      )}

      {phase === "playing" && station && (
        <div className="space-y-4">
          <div className="rule-row">
            <span className="label text-muted">
              Game <span className="num text-primary">{stationIdx + 1}</span> /{" "}
              <span className="num">{BATTERY.length}</span> · {station.title}
            </span>
            <span className="chip border-accent text-accent">
              {station.skillLabel}
            </span>
          </div>
          <Suspense fallback={<StationFallback />}>
            {/* Remount per station so its internal session state resets cleanly.
                A deterministic per-station seed keeps the battery reproducible. */}
            <station.Component
              key={station.subtopicKey}
              seed={stationSeed}
              onComplete={handleStationComplete}
            />
          </Suspense>
        </div>
      )}

      {phase === "summary" && (
        <BatterySummary results={results} progress={progress} onFinish={finish} />
      )}
    </section>
  );
}

/* ========================================================================== */
/*  Result payload                                                             */
/* ========================================================================== */

/**
 * Build the `{ rounds, pnl, verdict }` payload from the finished battery.
 * `rounds` totals scored rounds across all games; `pnl` is the total edge-credit
 * banked (a battery-wide "score", not a dollar P&L); `verdict` reports how many
 * of the eleven subtopics now clear their mastery bar.
 */
export function buildBatteryResult(
  results: StationResult[],
  progress: Parameters<typeof drillingProgress>[0],
): GameOaResult {
  const rounds = results.reduce((s, r) => s + r.summary.attempts, 0);
  const pnl = Math.round(results.reduce((s, r) => s + r.summary.credits, 0));
  const dp = drillingProgress(progress);
  return {
    rounds,
    pnl,
    verdict: `${dp.tradingSubtopicsMastered}/${dp.tradingSubtopicTotal} trading skills mastered`,
  };
}

/* ========================================================================== */
/*  Presentational                                                            */
/* ========================================================================== */

function Intro({ onStart }: { onStart: () => void }) {
  return (
    <div className="space-y-4">
      <div className="note space-y-2">
        <p className="label text-accent">The battery</p>
        <ul className="grid grid-cols-1 gap-1.5 text-secondary sm:grid-cols-2">
          {BATTERY.map((b, i) => (
            <li key={b.subtopicKey} className="flex items-start gap-2">
              <span className="num mt-px text-muted">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span>
                <span className="text-primary">{b.title}</span>{" "}
                <span className="text-muted">— {b.skillLabel}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <button
        type="button"
        className="btn-primary w-full"
        onClick={onStart}
        data-testid="battery-start"
      >
        Start the battery →
      </button>
    </div>
  );
}

function StationFallback() {
  return (
    <div className="panel-ruled p-8 text-center text-sm text-muted">
      Loading game…
    </div>
  );
}

function BatterySummary({
  results,
  progress,
  onFinish,
}: {
  results: StationResult[];
  progress: Parameters<typeof drillingProgress>[0];
  onFinish: () => void;
}) {
  const dp = useMemo(() => drillingProgress(progress), [progress]);
  const masteredByKey = new Map(
    dp.tradingSubtopics.map((s) => [s.key, s.mastered]),
  );

  return (
    <div className="space-y-4" data-testid="game-oa-summary">
      <div className="panel-ruled p-6 text-center">
        <span className="label text-accent">Trading-intuition read</span>
        <div className="mt-2 font-display text-4xl font-black leading-tight text-primary">
          {dp.tradingSubtopicsMastered}/{dp.tradingSubtopicTotal}
        </div>
        <p className="mt-2 text-sm text-secondary">
          trading skills over the 0.80 mastery bar. The rest route to drilling by
          game.
        </p>
      </div>

      <ul className="space-y-1.5">
        {results.map(({ station, summary }) => {
          const mastered = masteredByKey.get(station.subtopicKey) ?? false;
          return (
            <li key={station.subtopicKey} className="rule-row">
              <span className="text-sm text-secondary">
                <span className="text-primary">{station.title}</span>{" "}
                <span className="text-muted">· {summary.scoreLabel}</span>
              </span>
              <span
                className={`chip ${
                  mastered ? "border-bull text-bull" : "border-accent text-accent"
                }`}
              >
                {mastered ? "mastered" : "drill"}
              </span>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        className="btn-primary w-full"
        onClick={onFinish}
        data-testid="game-oa-finish"
      >
        Finish stage →
      </button>
    </div>
  );
}
