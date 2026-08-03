/**
 * THE TRADING FLOOR — pure engine TYPES.
 *
 * An adversarial, round-by-round make-a-market game. You quote a two-sided
 * market on a hidden quantity; an informed-with-noise counterparty picks you
 * off only when your quote is on the wrong side of fair, while uninformed noise
 * pays you the spread when you're competitive; the truth is revealed a step at a
 * time and you re-quote. For binary (0/1) contracts this is a proper scoring
 * rule, so honest calibration is the P&L-maximizing strategy (see the plan §4).
 *
 * Everything in `src/lib/tradingFloor/**` is PURE and framework-free (no React /
 * DOM), deterministic given `(scenario, seed, config)`, and unit-tested — the
 * React layer owns only the wall clock + input. Math primitives are IMPORTED
 * from the proven live-market / calibration engines, never re-declared.
 */
import type {
  Quote,
  Fill,
  Noise,
  LiveRunResult,
  BenchmarkGrade,
} from "@/lib/simulations/liveMarket";
import type { CalibrationPair } from "@/lib/mastery/reliability";
import type { Rng } from "@/lib/rng";

export type { Quote, Fill, Noise, LiveRunResult, BenchmarkGrade };

/** One reveal shown ENTERING a round: a UI label plus a numeric payload. */
export interface RevealInfo {
  /** 0-indexed round this info became available. */
  round: number;
  /** Short UI label, e.g. "Die 3 → 5" or "×  People per household ≈ 2.5". */
  label: string;
  /** Optional longer detail for the round board. */
  detail?: string;
  /** Numeric payload some scenarios expose (unused by generic UI). */
  value?: number;
}

/** A posterior read used by the honest benchmark desk + the coach panel. */
export interface Posterior {
  mean: number;
  sd: number;
}

/**
 * A hidden ground truth plus the machinery to reveal info and price fair value.
 * One interface lets dice / Fermi / (future) live-path scenarios share the SAME
 * round loop, bot, and scorer. `Truth` is drawn once from the seed; `reveal`,
 * `fair`, `settle`, and `posterior` are pure given `truth`.
 */
export interface Scenario<Truth = unknown> {
  id: string;
  /** "binary" ⇒ a 0/1 contract (calibration core); "quantity" ⇒ a real total. */
  kind: "binary" | "quantity";
  title: string;
  /** One-line prompt shown above the quote pad. */
  prompt: string;
  /** Unit label, e.g. "points", or "" for a probability. */
  unit: string;
  /** Reveals (== quotes) per session. */
  rounds: number;
  /** Draw the hidden truth deterministically from the seed. */
  drawTruth(rng: Rng): Truth;
  /** The info that becomes available ENTERING round `r` (0-indexed). */
  reveal(truth: Truth, r: number, rng: Rng): RevealInfo;
  /**
   * Textbook fair value given everything revealed so far. For a binary contract
   * this is `P(event | info) ∈ [0,1]`; for a quantity it is `E[value | info]`.
   * Designed to be a MARTINGALE: `E[fair after next reveal] == fair now`.
   */
  fair(truth: Truth, revealed: RevealInfo[]): number;
  /** Settlement value (== fair once everything is revealed). */
  settle(truth: Truth): number;
  /** Posterior mean (== fair) + sd used by the honest desk half-spread. */
  posterior(truth: Truth, revealed: RevealInfo[]): Posterior;
}

/** The four levers a human maker posts each round. */
export interface UserQuote {
  /** Your fair-value estimate (for a binary contract, your probability in [0,1]). */
  mid: number;
  /** Half-spread — your uncertainty premium (≥ 0). */
  half: number;
  /** Inventory skew: the quote centers at `mid − skew·inventory`. */
  skew: number;
  /** Contracts you're willing to trade this round (0 ⇒ stand aside). */
  size: number;
}

/** The informed-with-noise counterparty model (see the plan §3.3). */
export interface BotConfig {
  /** Chance the round's counterparty is informed (else pure noise). */
  informedProb: number;
  /** The informed bot's estimate is `trueFair + N(0, edgeNoiseSd)`. */
  edgeNoiseSd: number;
  /** Chance uninformed flow trades on a straddling quote. */
  noiseProb: number;
  /** Widest half-spread that still wins uninformed flow. */
  noiseMaxHalf: number;
  /** 0 ⇒ bot knows the current fair; 1 ⇒ bot peeks at the NEXT reveal. */
  lookahead: 0 | 1;
}

/** A full difficulty preset: bot + session shape + benchmark levers. */
export interface FloorConfig {
  /** Preset id (also the local-PB / leaderboard bucket key input). */
  id: string;
  label: string;
  bot: BotConfig;
  /** Max quote size the pad allows. */
  maxSize: number;
  /** Per-round quote shot-clock in ms. */
  shotClockMs: number;
  /** Inventory skew the honest benchmark desk runs (defaults to 0). */
  benchSkew?: number;
}

export type FloorPhase = "quoting" | "revealed" | "finished";

/** One realized round fill (extends the live-market `Fill` with size + round). */
export interface RoundFill extends Fill {
  size: number;
  round: number;
}

/**
 * The per-round counterparty draw + marks, RECORDED so the honest benchmark desk
 * can be replayed on the IDENTICAL stream at finish (the basketball twin-stream
 * pattern). Purely internal bookkeeping.
 */
export interface RoundRecord {
  round: number;
  /** Textbook fair entering the round (what the honest desk quotes around). */
  fairNow: number;
  /** Posterior sd entering the round (the honest desk's half-spread). */
  posteriorSd: number;
  /** The fair value the counterparty transacted against (informed adds noise). */
  fairForFill: number;
  /** Whether the round's counterparty was informed. */
  informed: boolean;
  /** The uninformed noise draw (only relevant when not informed). */
  noise: Noise;
  /** Fair used to mark inventory after the round (next fair, or settle). */
  markFair: number;
}

/** Immutable round-loop state; all transitions are pure `(state, …) => state`. */
export interface FloorState<Truth = unknown> {
  phase: FloorPhase;
  /** Current (not-yet-resolved) round, 0-indexed. */
  round: number;
  totalRounds: number;
  cash: number;
  inventory: number;
  /** Marked cumulative P&L after each resolved round. */
  pnlPath: number[];
  /** Fair entering each round (recorded at quote time). */
  fairPath: number[];
  /** Inventory after each resolved round. */
  inventoryPath: number[];
  fills: RoundFill[];
  pickedOff: number;
  quotes: UserQuote[];
  /** Binary rounds only: `{ pred: mid, outcome: y }`. */
  calibration: CalibrationPair[];
  revealed: RevealInfo[];
  remainingMs: number;
  /** Internal: per-round records for the benchmark replay. */
  records: RoundRecord[];
  /** Internal: the scenario, config, drawn truth, and live rng. */
  scenario: Scenario<Truth>;
  config: FloorConfig;
  truth: Truth;
  rng: Rng;
}

/** The scored result of a finished session (slots into the live-market panels). */
export interface FloorResult extends LiveRunResult {
  scenarioId: string;
  kind: "binary" | "quantity";
  configId: string;
  finalTruth: number;
  fairPath: number[];
  inventoryPath: number[];
  /** Binary only: the (pred, outcome) pairs for the reliability diagram. */
  calibrationPairs: CalibrationPair[];
  /** Sharpe-like consistency: mean / sd of per-round P&L deltas. */
  consistency: number;
  /** Brier score over the binary calibration pairs (0 for quantity packs). */
  brier: number;
  grade: BenchmarkGrade;
}

/** The rankable/config unit: builds a fresh scenario from a seed. */
export interface ScenarioPack {
  id: string;
  title: string;
  /** One-line description for the setup screen. */
  blurb: string;
  kind: "binary" | "quantity";
  build(rng: Rng): Scenario;
}
