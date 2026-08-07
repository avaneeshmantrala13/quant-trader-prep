/**
 * ============================================================================
 *  STOCKMASTER — rapid attention / indicator-tracking mini-game (pure engine)
 * ============================================================================
 * Mimics the Optiver "Stockmaster" Zap-N mini-game: a fast go/no-go attention
 * task. A stream of market "ticks" flashes by; each tick shows a price ARROW
 * (up/down) and a SIGNAL light (green/red). The rule: REACT (buy) only on a
 * GO tick — arrow UP *and* signal GREEN — and WITHHOLD on everything else. It
 * scores speed (fast hits) and accuracy (no false alarms, no misses), exactly
 * the sustained-attention + inhibition an indicator-tracking test probes.
 *
 * The engine is PURE: it generates the deterministic trial stream from a seed
 * and grades responses; the page owns the real-time per-trial countdown. A
 * snapshot of (seed + config + responses + index) rehydrates a run exactly.
 */
import { Rng } from "@/lib/rng";

/* ========================================================================== */
/*  Trials                                                                     */
/* ========================================================================== */

export type Arrow = "up" | "down";
export type Signal = "green" | "red";

export interface StockTrial {
  id: number;
  arrow: Arrow;
  signal: Signal;
  /** A "go" trial (the player SHOULD react): arrow up AND signal green. */
  isGo: boolean;
}

/** The rule, isolated so the UI can explain it and tests can assert it. */
export function isGoTick(arrow: Arrow, signal: Signal): boolean {
  return arrow === "up" && signal === "green";
}

export const DEFAULT_STOCKMASTER_COUNT = 30;
/** Each tick is visible ~1.4s; react before it flips away. */
export const DEFAULT_TRIAL_WINDOW_MS = 1400;

/**
 * Build a deterministic trial stream. ~40% of ticks are GO so the player must
 * both react quickly AND inhibit on the majority no-go ticks. Same seed ⇒ same
 * stream.
 */
export function buildStockmasterTrials(
  seed: number,
  count: number = DEFAULT_STOCKMASTER_COUNT,
): StockTrial[] {
  const rng = new Rng(seed);
  const trials: StockTrial[] = [];
  for (let i = 0; i < count; i++) {
    // Bias toward a healthy mix of go/no-go without ever being all one kind.
    let arrow: Arrow = rng.chance(0.5) ? "up" : "down";
    let signal: Signal = rng.chance(0.5) ? "green" : "red";
    // Nudge ~40% to be genuine GO ticks.
    if (rng.chance(0.4)) {
      arrow = "up";
      signal = "green";
    }
    trials.push({ id: i, arrow, signal, isGo: isGoTick(arrow, signal) });
  }
  return trials;
}

/* ========================================================================== */
/*  Grading                                                                    */
/* ========================================================================== */

export type Outcome = "hit" | "miss" | "correct-reject" | "false-alarm";

/** Classify a response to a trial (reacted = the player clicked in the window). */
export function classify(trial: StockTrial, reacted: boolean): Outcome {
  if (trial.isGo) return reacted ? "hit" : "miss";
  return reacted ? "false-alarm" : "correct-reject";
}

/** Points per outcome (speed bonus applies to a hit only). */
export const STOCK_POINTS = {
  hitBase: 100,
  hitSpeedBonus: 100,
  correctReject: 30,
  miss: -40,
  falseAlarm: -60,
} as const;

/**
 * Score one graded trial. `reactionFraction` is the share of the trial window
 * elapsed at the moment of reaction (0 = instant, 1 = at the buzzer); it only
 * affects a hit's speed bonus.
 */
export function scoreOutcome(
  outcome: Outcome,
  reactionFraction: number,
): number {
  switch (outcome) {
    case "hit": {
      const frac = Math.max(0, Math.min(1, reactionFraction));
      return Math.round(STOCK_POINTS.hitBase + STOCK_POINTS.hitSpeedBonus * (1 - frac));
    }
    case "correct-reject":
      return STOCK_POINTS.correctReject;
    case "miss":
      return STOCK_POINTS.miss;
    case "false-alarm":
      return STOCK_POINTS.falseAlarm;
  }
}

/* ========================================================================== */
/*  Session                                                                    */
/* ========================================================================== */

export interface StockResponse {
  reacted: boolean;
  /** 0 = instant, 1 = at the buzzer; only meaningful when `reacted`. */
  reactionFraction: number;
  outcome: Outcome;
  points: number;
}

export interface StockmasterSession {
  seed: number;
  count: number;
  trialWindowMs: number;
  index: number;
  responses: (StockResponse | null)[];
  status: "running" | "finished";
}

export function createStockmasterSession(opts: {
  seed: number;
  count?: number;
  trialWindowMs?: number;
}): StockmasterSession {
  const count = opts.count ?? DEFAULT_STOCKMASTER_COUNT;
  return {
    seed: opts.seed,
    count,
    trialWindowMs: opts.trialWindowMs ?? DEFAULT_TRIAL_WINDOW_MS,
    index: 0,
    responses: Array.from({ length: count }, () => null),
    status: "running",
  };
}

export function trialsFor(s: StockmasterSession): StockTrial[] {
  return buildStockmasterTrials(s.seed, s.count);
}

export function currentTrial(s: StockmasterSession): StockTrial | undefined {
  return trialsFor(s)[s.index];
}

/**
 * Record the response to the CURRENT trial and advance. `reacted` = the player
 * clicked React before the window closed; `reactionFraction` is when. A trial
 * that times out with no click is a `reacted=false` response. Finishes at the
 * end of the stream.
 */
export function recordAndAdvance(
  s: StockmasterSession,
  reacted: boolean,
  reactionFraction: number,
): StockmasterSession {
  if (s.status !== "running") return s;
  const trial = currentTrial(s);
  if (!trial) return { ...s, status: "finished" };
  const outcome = classify(trial, reacted);
  const points = scoreOutcome(outcome, reactionFraction);
  const responses = s.responses.slice();
  responses[s.index] = {
    reacted,
    reactionFraction: reacted ? reactionFraction : 1,
    outcome,
    points,
  };
  const next = s.index + 1;
  const status = next >= s.count ? "finished" : "running";
  return { ...s, responses, index: next, status };
}

/* ========================================================================== */
/*  Summary                                                                    */
/* ========================================================================== */

export interface StockmasterSummary {
  total: number;
  responded: number;
  hits: number;
  misses: number;
  correctRejects: number;
  falseAlarms: number;
  score: number;
  maxScore: number;
  /** Correct decisions (hits + correct rejects) over total trials, %. */
  accuracyPct: number;
}

export function summarizeStockmaster(s: StockmasterSession): StockmasterSummary {
  const trials = trialsFor(s);
  let hits = 0;
  let misses = 0;
  let correctRejects = 0;
  let falseAlarms = 0;
  let responded = 0;
  let score = 0;
  let maxScore = 0;
  trials.forEach((t, i) => {
    // Best case per trial: instant hit on a go, correct-reject on a no-go.
    maxScore += t.isGo
      ? STOCK_POINTS.hitBase + STOCK_POINTS.hitSpeedBonus
      : STOCK_POINTS.correctReject;
    const resp = s.responses[i];
    if (!resp) return;
    responded += 1;
    score += resp.points;
    switch (resp.outcome) {
      case "hit":
        hits += 1;
        break;
      case "miss":
        misses += 1;
        break;
      case "correct-reject":
        correctRejects += 1;
        break;
      case "false-alarm":
        falseAlarms += 1;
        break;
    }
  });
  return {
    total: trials.length,
    responded,
    hits,
    misses,
    correctRejects,
    falseAlarms,
    score,
    maxScore,
    accuracyPct: trials.length
      ? Math.round(((hits + correctRejects) / trials.length) * 100)
      : 0,
  };
}
