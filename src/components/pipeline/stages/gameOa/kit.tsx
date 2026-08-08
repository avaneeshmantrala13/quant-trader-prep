import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useProgress } from "@/context/ProgressContext";
import { buildTradingSubtopicAttempt } from "@/lib/mastery/tradingSubtopics";

/**
 * ============================================================================
 *  GAME-OA BATTERY — shared embedded-station kit
 * ============================================================================
 * Every battery station (make-a-market, trading floor, cards MM, next-card,
 * arbitrage, fermi, number-logic, beat-the-odds, stockmaster, number-box,
 * shape-shift) is a small in-stage screen that REUSES its game's pure engine and
 * folds each scored round's credit into its own trading-intuition SUBTOPIC node
 * via the SAME `recordItemAttempt` Beta path every node uses (like the
 * brainteaser competency's flashcard fold). Stations own NO navigation and NO
 * router/providers — they render inside the guided shell and call
 * {@link StationProps.onComplete} exactly once when their short session ends.
 *
 * This kit provides:
 *  - the {@link StationProps} / {@link StationSummary} contract,
 *  - {@link useStationFold}: records a round's credit into a subtopic + tallies,
 *  - {@link McqStation}: a generic five-option MCQ runner for the option/correct
 *    -index engines (NumberLogic, NumberBox, BeatTheOdds, ShapeShift), and
 *  - small presentational helpers shared across the bespoke stations.
 */

/** A finished station's tally handed back to the battery driver. */
export interface StationSummary {
  /** Scored rounds/items folded into the subtopic. */
  attempts: number;
  /** Total credit earned across those rounds (∈ [0, attempts]). */
  credits: number;
  /** Human score for the debrief, e.g. "7 / 10" or "P&L +8". */
  scoreLabel: string;
}

/** Props every battery station receives. */
export interface StationProps {
  /** Called once when the station's short session ends. */
  onComplete: (summary: StationSummary) => void;
}

/**
 * Fold rounds of a station into its subtopic's Beta and keep a running tally.
 * `record(credit)` folds one round (credit ∈ [0,1]) via `recordItemAttempt`; the
 * returned `attempts` / `credits` refs let the station build its
 * {@link StationSummary} at the end.
 */
export function useStationFold(subtopicKey: string) {
  const { recordItemAttempt } = useProgress();
  const attemptsRef = useRef(0);
  const creditsRef = useRef(0);

  const record = useCallback(
    (credit: number, at: string = new Date().toISOString()) => {
      attemptsRef.current += 1;
      creditsRef.current += Math.max(0, Math.min(1, credit));
      recordItemAttempt(buildTradingSubtopicAttempt(subtopicKey, credit, at));
    },
    [recordItemAttempt, subtopicKey],
  );

  const summary = useCallback(
    (scoreLabel: string): StationSummary => ({
      attempts: attemptsRef.current,
      credits: Math.round(creditsRef.current * 100) / 100,
      scoreLabel,
    }),
    [],
  );

  return { record, summary, attemptsRef, creditsRef };
}

/* ========================================================================== */
/*  Generic MCQ station (option / correctIndex engines)                        */
/* ========================================================================== */

/** One MCQ round: a prompt, five option renderers, and the right index. */
export interface McqRound {
  /** Stable key (for React) — usually the item id. */
  id: string | number;
  /** Prompt content shown above the options. */
  prompt: ReactNode;
  /** Option contents (any length; usually five). */
  options: ReactNode[];
  correctIndex: number;
  /** Optional post-answer explanation. */
  explanation?: ReactNode;
  /** Small chip label (e.g. the difficulty tier or family). */
  tag?: string;
}

/**
 * Run a fixed list of MCQ rounds, folding `credit = correct ? 1 : 0` into the
 * subtopic for each. Deterministic + turn-based (no wall clock), so it is stable
 * in tests. Calls `onComplete` with a `${correct}/${total}` score once the last
 * round is acknowledged.
 */
export function McqStation({
  subtopicKey,
  rounds,
  optionLayout = "list",
  onComplete,
}: StationProps & {
  subtopicKey: string;
  rounds: McqRound[];
  /** "list" = stacked option buttons; "grid" = 5-wide (for shapes). */
  optionLayout?: "list" | "grid";
}) {
  const { record, summary } = useStationFold(subtopicKey);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const correctRef = useRef(0);
  const doneRef = useRef(false);

  const round = rounds[index];
  const isLast = index >= rounds.length - 1;

  const choose = (i: number) => {
    if (picked !== null) return;
    const correct = i === round.correctIndex;
    if (correct) correctRef.current += 1;
    record(correct ? 1 : 0);
    setPicked(i);
  };

  const advance = () => {
    if (isLast) {
      if (doneRef.current) return;
      doneRef.current = true;
      onComplete(summary(`${correctRef.current} / ${rounds.length}`));
      return;
    }
    setPicked(null);
    setIndex((n) => n + 1);
  };

  if (!round) return null;

  return (
    <div className="space-y-4" data-testid="mcq-station">
      <StationProgress
        index={index}
        total={rounds.length}
        correct={correctRef.current}
      />

      <div className="panel-ruled p-5">
        {round.tag && (
          <span className="label text-accent">{round.tag}</span>
        )}
        <div className="mt-1 font-display text-lg font-semibold leading-snug text-primary">
          {round.prompt}
        </div>
      </div>

      <div
        className={
          optionLayout === "grid"
            ? "grid grid-cols-3 gap-3 sm:grid-cols-5"
            : "grid grid-cols-1 gap-2 sm:grid-cols-2"
        }
      >
        {round.options.map((opt, i) => {
          const isCorrect = i === round.correctIndex;
          const isPicked = i === picked;
          const tone =
            picked === null
              ? "border-subtle hover:border-accent"
              : isCorrect
                ? "border-bull text-bull"
                : isPicked
                  ? "border-bear text-bear"
                  : "border-subtle opacity-60";
          return (
            <button
              key={i}
              type="button"
              className={`btn-ghost justify-center border ${tone}`}
              onClick={() => choose(i)}
              disabled={picked !== null}
              aria-label={`option ${i + 1}`}
            >
              {opt}
            </button>
          );
        })}
      </div>

      {picked !== null && (
        <div className="space-y-3">
          <div
            className={`verdict ${
              picked === round.correctIndex ? "bg-bull text-bg" : "bg-bear text-bg"
            }`}
          >
            {picked === round.correctIndex ? "● Correct" : "● Not quite"}
          </div>
          {round.explanation && (
            <p className="reveal text-secondary">{round.explanation}</p>
          )}
          <button
            type="button"
            className="btn-primary w-full"
            onClick={advance}
            data-testid="station-advance"
          >
            {isLast ? "Finish game →" : "Next →"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ========================================================================== */
/*  Shared presentational bits                                                  */
/* ========================================================================== */

/** A compact "round X / N · correct" progress row. */
export function StationProgress({
  index,
  total,
  correct,
  label = "Round",
}: {
  index: number;
  total: number;
  correct?: number;
  label?: string;
}) {
  return (
    <div className="rule-row">
      <span className="label text-muted">
        {label}{" "}
        <span className="num text-primary">{Math.min(index + 1, total)}</span> /{" "}
        <span className="num">{total}</span>
      </span>
      {correct != null && (
        <span className="chip num border-bull text-bull">{correct} correct</span>
      )}
    </div>
  );
}

/** Format a number tidily (integers grouped; decimals to 2 places). */
export function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return Number.isInteger(n) ? n.toLocaleString() : n.toFixed(2);
}

/** Deterministic-ish seed for a station mount. */
export function freshSeed(): number {
  return Math.floor(Math.random() * 1e9);
}

/** Small helper to build the "credits ⇒ mastery seeding" note. */
export function useMountSeed(): number {
  return useMemo(() => freshSeed(), []);
}

/* ========================================================================== */
/*  Shot clock — the reusable live countdown for the timed stations            */
/* ========================================================================== */

/**
 * Display/tick granularity for the embedded shot clocks. Small enough to feel
 * live, coarse enough to stay cheap. The clock is driven by `setInterval` +
 * `Date.now()` (rather than the stand-alone pages' `requestAnimationFrame` +
 * `performance.now()`) precisely because BOTH are faked by Vitest's default
 * `vi.useFakeTimers()`, so the timed-station tests are fully deterministic:
 * `vi.advanceTimersByTime(ms)` drives the countdown and fires the timeout.
 */
export const CLOCK_TICK_MS = 100;

/**
 * A live shot clock for an embedded station. Mirrors the stand-alone pages'
 * wall-clock loop (a periodic tick advancing a deadline) but is generic so every
 * timed station shares one implementation:
 *
 *  - starts (or restarts, when `resetKey` changes) a `durationMs` countdown while
 *    `running`; freezes when `running` is false (e.g. during a per-question
 *    reveal) and resumes on the next round,
 *  - calls `onExpire` EXACTLY ONCE when the deadline passes (the caller then
 *    auto-resolves the round as a timeout — a miss / stand-aside),
 *  - exposes `remainingMs` (for a {@link TimerBar}) and `readElapsedMs()` (the
 *    precise elapsed-at-click read the speed-weighted scorers need).
 *
 * The `onExpire` callback is kept in a ref so a caller can close over fresh state
 * without restarting the interval every render.
 */
export function useShotClock({
  durationMs,
  running,
  onExpire,
  resetKey,
  tickMs = CLOCK_TICK_MS,
}: {
  durationMs: number;
  running: boolean;
  onExpire: () => void;
  /** Restart the countdown whenever this changes (e.g. the round index). */
  resetKey?: unknown;
  tickMs?: number;
}): { remainingMs: number; fraction: number; readElapsedMs: () => number } {
  const [remainingMs, setRemainingMs] = useState(durationMs);
  const deadlineRef = useRef(0);
  const firedRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (!running) return;
    deadlineRef.current = Date.now() + durationMs;
    firedRef.current = false;
    setRemainingMs(durationMs);
    const step = () => {
      const rem = Math.max(0, deadlineRef.current - Date.now());
      setRemainingMs(rem);
      if (rem <= 0 && !firedRef.current) {
        firedRef.current = true;
        clearInterval(id);
        onExpireRef.current();
      }
    };
    const id = setInterval(step, tickMs);
    return () => clearInterval(id);
  }, [running, durationMs, tickMs, resetKey]);

  const readElapsedMs = useCallback(
    () =>
      Math.max(
        0,
        Math.min(
          durationMs,
          durationMs - Math.max(0, deadlineRef.current - Date.now()),
        ),
      ),
    [durationMs],
  );

  return {
    remainingMs,
    fraction: durationMs > 0 ? Math.max(0, Math.min(1, 1 - remainingMs / durationMs)) : 1,
    readElapsedMs,
  };
}

/** Format a shot-clock remaining time: `m:ss` for ≥1 min, else `Xs`. */
export function formatClock(ms: number): string {
  const clamped = Math.max(0, ms);
  if (clamped >= 60_000) {
    const totalSec = Math.ceil(clamped / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  return `${(clamped / 1000).toFixed(clamped < 10_000 ? 1 : 0)}s`;
}

/** A compact shot-clock readout: a draining bar + a mono time, red when low. */
export function TimerBar({
  remainingMs,
  durationMs,
  label = "Shot clock",
}: {
  remainingMs: number;
  durationMs: number;
  label?: string;
}) {
  const pct = durationMs > 0 ? Math.max(0, Math.min(100, (remainingMs / durationMs) * 100)) : 0;
  const low = remainingMs <= Math.min(5000, durationMs * 0.25);
  return (
    <div className="rule-row !border-b-0" data-testid="shot-clock">
      <span className="label text-muted">{label}</span>
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-28 overflow-hidden rounded-full bg-surface">
          <div
            className={`h-full ${low ? "bg-bear" : "bg-accent"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span
          className={`num text-sm tabular-nums ${low ? "text-bear" : "text-secondary"}`}
          data-testid="shot-clock-remaining"
        >
          {formatClock(remainingMs)}
        </span>
      </div>
    </div>
  );
}

/* ========================================================================== */
/*  Timed rapid-MCQ station (whole-run clock, streaming)                        */
/* ========================================================================== */

/**
 * A whole-run, time-pressured MCQ runner for the rapid Optiver Zap-N / OA papers
 * (Number Box, Shape Shift, NumberLogic) whose stand-alone modes stream items
 * against a SINGLE paper clock. Unlike {@link McqStation} it does NOT pause on a
 * per-item reveal — it streams forward the instant an option is picked, and when
 * the `budgetMs` clock runs out it folds every UNANSWERED item as a miss
 * (credit 0) and finishes, so a slow solver's subtopic Beta reflects the time
 * pressure exactly as the real section does (unanswered ⇒ not scored ⇒ misses).
 * Credit is `correct ? 1 : 0` (these sections score correctness, not speed).
 */
export function TimedRapidMcqStation({
  subtopicKey,
  rounds,
  budgetMs,
  optionLayout = "list",
  onComplete,
}: StationProps & {
  subtopicKey: string;
  rounds: McqRound[];
  /** Whole-run budget for this slice (scaled from the game's stand-alone clock). */
  budgetMs: number;
  optionLayout?: "list" | "grid";
}) {
  const { record, summary } = useStationFold(subtopicKey);
  const [index, setIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const correctRef = useRef(0);
  const answeredRef = useRef(0);
  const doneRef = useRef(false);

  const finish = useCallback(
    (timedOut: boolean) => {
      if (doneRef.current) return;
      doneRef.current = true;
      // Ran out of time (or items): every not-yet-attempted item is a miss.
      for (let i = answeredRef.current; i < rounds.length; i += 1) record(0);
      setFinished(true);
      onComplete(
        summary(
          `${correctRef.current} / ${rounds.length}${timedOut ? " · timed out" : ""}`,
        ),
      );
    },
    [record, rounds.length, onComplete, summary],
  );

  const { remainingMs } = useShotClock({
    durationMs: budgetMs,
    running: !finished,
    onExpire: () => finish(true),
  });

  const round = rounds[index];

  const choose = (i: number) => {
    if (doneRef.current || !round) return;
    const correct = i === round.correctIndex;
    if (correct) correctRef.current += 1;
    answeredRef.current += 1;
    record(correct ? 1 : 0);
    if (index + 1 >= rounds.length) finish(false);
    else setIndex((n) => n + 1);
  };

  if (!round) return null;

  return (
    <div className="space-y-4" data-testid="timed-mcq-station">
      <TimerBar remainingMs={remainingMs} durationMs={budgetMs} />
      <StationProgress
        index={index}
        total={rounds.length}
        correct={correctRef.current}
        label="Item"
      />

      <div className="panel-ruled p-5">
        {round.tag && <span className="label text-accent">{round.tag}</span>}
        <div className="mt-1 font-display text-lg font-semibold leading-snug text-primary">
          {round.prompt}
        </div>
      </div>

      <div
        className={
          optionLayout === "grid"
            ? "grid grid-cols-3 gap-3 sm:grid-cols-5"
            : "grid grid-cols-1 gap-2 sm:grid-cols-2"
        }
      >
        {round.options.map((opt, i) => (
          <button
            key={i}
            type="button"
            className="btn-ghost justify-center border border-subtle hover:border-accent"
            onClick={() => choose(i)}
            aria-label={`option ${i + 1}`}
          >
            {opt}
          </button>
        ))}
      </div>

      <p className="text-center text-xs text-muted">
        Beat the clock — every item you don't reach counts as a miss.
      </p>
    </div>
  );
}
