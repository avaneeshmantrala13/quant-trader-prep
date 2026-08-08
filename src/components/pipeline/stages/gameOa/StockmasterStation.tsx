import { useMemo, useRef, useState } from "react";
import {
  buildStockmasterTrials,
  classify,
  scoreOutcome,
  DEFAULT_TRIAL_WINDOW_MS,
  STOCK_POINTS,
  type Outcome,
  type StockTrial,
} from "@/lib/games/stockmaster/engine";
import { tradingSubtopicByGame } from "@/lib/mastery/tradingSubtopics";
import {
  StationProgress,
  TimerBar,
  useMountSeed,
  useShotClock,
  useStationFold,
  type StationProps,
} from "./kit";

const SUBTOPIC = tradingSubtopicByGame("stockmaster").key;

export const STOCKMASTER_ROUNDS = 10;

/** Best-case hit points (instant), used to normalize hit credit to [0,1]. */
const HIT_MAX = STOCK_POINTS.hitBase + STOCK_POINTS.hitSpeedBonus;

function outcomeLabel(o: Outcome): string {
  switch (o) {
    case "hit":
      return "● Hit — reacted in time";
    case "miss":
      return "● Miss — that was a GO";
    case "correct-reject":
      return "● Correct hold";
    case "false-alarm":
      return "● False alarm — should have held";
  }
}

/**
 * Stockmaster battery station — the Optiver Zap-N go/no-go attention screen, run
 * LIVE against the engine's per-trial shot clock (`DEFAULT_TRIAL_WINDOW_MS`,
 * ~1.4s). It STREAMS like the stand-alone page: each tick is shown for the
 * window, then either the player reacts or the clock lapses into an auto
 * `reacted = false` response, and the next tick appears immediately (no manual
 * advance). The engine's `classify` + `scoreOutcome` grade each trial; credit
 * folds into `competency::attention-go-no-go` with time pressure baked in — a GO
 * you don't click in time is a MISS (credit 0), and a hit's credit is
 * speed-weighted by the engine's own reaction bonus (instant ⇒ 1.0, buzzer ⇒
 * 0.5); a correct hold is full credit.
 */
export default function StockmasterStation({ onComplete }: StationProps) {
  const { record, summary } = useStationFold(SUBTOPIC);
  const seed = useMountSeed();
  const trials = useMemo<StockTrial[]>(
    () => buildStockmasterTrials(seed, STOCKMASTER_ROUNDS),
    [seed],
  );
  const [index, setIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const [last, setLast] = useState<Outcome | null>(null);
  const correctRef = useRef(0);
  const doneRef = useRef(false);
  const windowMs = DEFAULT_TRIAL_WINDOW_MS;

  const trial = trials[index];

  const resolve = (reacted: boolean, reactionFraction: number) => {
    if (doneRef.current || !trial) return;
    const outcome = classify(trial, reacted);
    if (outcome === "hit" || outcome === "correct-reject") correctRef.current += 1;
    // Speed-weighted, matching the engine's scoreOutcome: hits carry the reaction
    // bonus; a correct hold is full credit; miss / false-alarm earn nothing.
    let credit = 0;
    if (outcome === "hit") credit = scoreOutcome("hit", reactionFraction) / HIT_MAX;
    else if (outcome === "correct-reject") credit = 1;
    record(credit);
    setLast(outcome);
    if (index + 1 >= trials.length) {
      doneRef.current = true;
      setFinished(true);
      onComplete(summary(`${correctRef.current} / ${trials.length} correct`));
    } else {
      setIndex((n) => n + 1);
    }
  };

  const clock = useShotClock({
    durationMs: windowMs,
    running: !finished && !!trial,
    resetKey: index,
    onExpire: () => resolve(false, 1),
  });

  const react = () =>
    resolve(true, Math.max(0, Math.min(1, clock.readElapsedMs() / windowMs)));

  if (!trial) return null;

  return (
    <div className="space-y-4" data-testid="stockmaster-station">
      <TimerBar remainingMs={clock.remainingMs} durationMs={windowMs} label="Tick" />
      <StationProgress
        index={index}
        total={trials.length}
        correct={correctRef.current}
        label="Tick"
      />

      <div className="note text-sm text-secondary">
        React on a <span className="text-bull">GO</span> tick — arrow{" "}
        <span className="text-bull">up</span> AND signal{" "}
        <span className="text-bull">green</span>. Withhold on everything else; a
        tick you let lapse resolves on its own.
      </div>

      <div className="panel-ruled flex items-center justify-center gap-10 p-8">
        <div className="text-center">
          <div className="label text-muted">Price</div>
          <div
            className={`num text-5xl font-black ${
              trial.arrow === "up" ? "text-bull" : "text-bear"
            }`}
            aria-label={`arrow ${trial.arrow}`}
          >
            {trial.arrow === "up" ? "▲" : "▼"}
          </div>
        </div>
        <div className="text-center">
          <div className="label text-muted">Signal</div>
          <div
            className="mx-auto mt-2 h-10 w-10 rounded-full"
            style={{
              backgroundColor:
                trial.signal === "green"
                  ? "var(--color-bull, #16a34a)"
                  : "var(--color-bear, #dc2626)",
            }}
            aria-label={`signal ${trial.signal}`}
          />
        </div>
      </div>

      <button
        type="button"
        className="btn-primary w-full"
        onClick={react}
        aria-label="react"
      >
        React ▲
      </button>

      {last && (
        <div className="rule-row !border-b-0">
          <span className="label text-muted">Last</span>
          <span
            className={`text-sm ${
              last === "hit" || last === "correct-reject" ? "text-bull" : "text-bear"
            }`}
          >
            {outcomeLabel(last)}
          </span>
        </div>
      )}
    </div>
  );
}
