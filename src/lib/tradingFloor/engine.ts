/**
 * THE TRADING FLOOR — the pure round-loop state machine.
 *
 * Mirrors `arena/session.ts`: immutable state, pure `(state, …) => state`
 * transitions, and time advanced only by explicit `tick(state, deltaMs)` calls.
 * The whole run is a deterministic function of `(scenario, seed, config)`: same
 * inputs ⇒ same truth, same reveals, same counterparty stream ⇒ identical
 * `FloorResult` (the basis for replay + ranking).
 *
 * REUSED math (never re-declared): `makerQuote` / `resolveFill` (fills),
 * `maxDrawdown` / `gradeVsBenchmark` (scoring), `brierGap` (calibration).
 *
 * NOTE: a `Scenario.reveal` MUST be a pure function of `(truth, r)` and must not
 * consume the rng — the engine calls it to peek the next reveal (for the
 * benchmark mark and the lookahead bot) without disturbing the counterparty
 * stream. All shipped scenarios honor this (reveals are lookups into `truth`).
 */
import { Rng } from "@/lib/rng";
import {
  makerQuote,
  resolveFill,
  maxDrawdown,
  gradeVsBenchmark,
} from "@/lib/simulations/liveMarket";
import { brierGap } from "@/lib/mastery/reliability";
import { drawCounterparty } from "./bot";
import { benchmarkPnl } from "./benchmark";
import { consistency, roundDeltas } from "./scoring";
import type {
  FloorConfig,
  FloorResult,
  FloorState,
  RevealInfo,
  RoundRecord,
  Scenario,
  UserQuote,
} from "./types";

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Fresh, quoting session: draws truth, reveals round 0, starts the shot clock. */
export function startFloor<Truth>(
  scenario: Scenario<Truth>,
  config: FloorConfig,
  seed: number,
): FloorState<Truth> {
  const rng = new Rng(seed);
  const truth = scenario.drawTruth(rng);
  const first = scenario.reveal(truth, 0, rng);
  return {
    phase: scenario.rounds > 0 ? "quoting" : "finished",
    round: 0,
    totalRounds: scenario.rounds,
    cash: 0,
    inventory: 0,
    pnlPath: [],
    fairPath: [],
    inventoryPath: [],
    fills: [],
    pickedOff: 0,
    quotes: [],
    calibration: [],
    revealed: [first],
    remainingMs: config.shotClockMs,
    records: [],
    scenario,
    config,
    truth,
    rng,
  };
}

/** Fair + posterior sd entering the current (quoting) round. */
export function currentFair<Truth>(state: FloorState<Truth>): number {
  return state.scenario.fair(state.truth, state.revealed);
}
export function currentPosteriorSd<Truth>(state: FloorState<Truth>): number {
  return state.scenario.posterior(state.truth, state.revealed).sd;
}

/**
 * Resolve the current round against a quote. Shared by `postQuote` (a real
 * human quote) and the shot-clock timeout (`standAside` ⇒ size 0, no fill, no
 * calibration credit — a stalled maker is never rewarded).
 */
function resolveRound<Truth>(
  state: FloorState<Truth>,
  quote: UserQuote,
  standAside: boolean,
): FloorState<Truth> {
  if (state.phase !== "quoting") return state;
  const { scenario, config, truth, rng } = state;
  const r = state.round;
  const revealed = state.revealed;
  const fairNow = scenario.fair(truth, revealed);
  const posteriorSd = scenario.posterior(truth, revealed).sd;

  // Peek the next reveal (pure lookup) → the mark fair and the lookahead fair.
  const hasNext = r + 1 < state.totalRounds;
  const nextInfo = hasNext ? scenario.reveal(truth, r + 1, rng) : null;
  const revealedAfter = nextInfo ? [...revealed, nextInfo] : revealed;
  const markFair = hasNext
    ? scenario.fair(truth, revealedAfter)
    : scenario.settle(truth);

  // The informed bot peeks one reveal ahead on hard difficulty.
  const trueFairForBot = config.bot.lookahead ? markFair : fairNow;
  const cp = drawCounterparty(rng, trueFairForBot, config.bot);

  const size = standAside
    ? 0
    : Math.max(0, Math.min(config.maxSize, Math.round(quote.size)));

  const mmQuote = makerQuote(quote.mid, state.inventory, {
    halfSpread: quote.half,
    skew: quote.skew,
  });
  const fill = resolveFill(mmQuote, cp.fairForFill, cp.noise, config.bot.noiseMaxHalf);
  const traded = !standAside && size > 0 && fill.side !== "none";

  let cash = state.cash;
  let inventory = state.inventory;
  if (traded) {
    if (fill.side === "userSells") {
      cash += fill.price * size;
      inventory -= size;
    } else if (fill.side === "userBuys") {
      cash -= fill.price * size;
      inventory += size;
    }
  }

  const pickedOff = state.pickedOff + (traded && fill.adverse ? 1 : 0);
  const markedPnl = cash + inventory * markFair;

  const record: RoundRecord = {
    round: r,
    fairNow,
    posteriorSd,
    fairForFill: cp.fairForFill,
    informed: cp.informed,
    noise: cp.noise,
    markFair,
  };

  const calibration =
    scenario.kind === "binary" && !standAside
      ? [
          ...state.calibration,
          { pred: clamp01(quote.mid), outcome: scenario.settle(truth) as 0 | 1 },
        ]
      : state.calibration;

  const nextRound = r + 1;
  const finished = nextRound >= state.totalRounds;

  return {
    ...state,
    phase: finished ? "finished" : "revealed",
    round: nextRound,
    cash,
    inventory,
    pnlPath: [...state.pnlPath, markedPnl],
    fairPath: [...state.fairPath, fairNow],
    inventoryPath: [...state.inventoryPath, inventory],
    fills: [
      ...state.fills,
      {
        side: traded ? fill.side : "none",
        price: traded ? fill.price : 0,
        adverse: traded ? fill.adverse : false,
        size: traded ? size : 0,
        round: r,
      },
    ],
    pickedOff,
    quotes: [...state.quotes, quote],
    calibration,
    revealed: revealedAfter,
    records: [...state.records, record],
    remainingMs: 0,
  };
}

/** Post a human quote for the current round (advances to the reveal phase). */
export function postQuote<Truth>(
  state: FloorState<Truth>,
  quote: UserQuote,
): FloorState<Truth> {
  return resolveRound(state, quote, false);
}

/** Advance from the reveal phase into quoting the next round (resets the clock). */
export function advanceReveal<Truth>(
  state: FloorState<Truth>,
): FloorState<Truth> {
  if (state.phase !== "revealed") return state;
  return { ...state, phase: "quoting", remainingMs: state.config.shotClockMs };
}

/**
 * Advance the shot clock by `deltaMs`. Only meaningful while quoting; on timeout
 * it auto-resolves the round with a stand-aside (size-0) quote so a stalled user
 * neither profits nor accrues calibration credit.
 */
export function tick<Truth>(
  state: FloorState<Truth>,
  deltaMs: number,
): FloorState<Truth> {
  if (state.phase !== "quoting") return state;
  const remainingMs = Math.max(0, state.remainingMs - Math.max(0, deltaMs));
  if (remainingMs <= 0) {
    const fairNow = state.scenario.fair(state.truth, state.revealed);
    return resolveRound(state, { mid: fairNow, half: 0, skew: 0, size: 0 }, true);
  }
  return { ...state, remainingMs };
}

/** The reveal shown entering the current quoting round (for the round board). */
export function currentReveal<Truth>(
  state: FloorState<Truth>,
): RevealInfo | undefined {
  return state.revealed[state.revealed.length - 1];
}

/**
 * Settle the book and compute the final metrics + honest-desk comparison on the
 * identical recorded stream. Idempotent given a finished (or fully-resolved)
 * state.
 */
export function finishFloor<Truth>(state: FloorState<Truth>): FloorResult {
  const { scenario, config } = state;
  const userPnl = state.pnlPath;
  const benchPnl = benchmarkPnl(state.records, config);
  const userFinal = userPnl.length ? userPnl[userPnl.length - 1] : 0;
  const benchFinal = benchPnl.length ? benchPnl[benchPnl.length - 1] : 0;
  const filledRounds = state.fills.filter((f) => f.side !== "none").length;
  const brier =
    scenario.kind === "binary" && state.calibration.length > 0
      ? brierGap(state.calibration).brier
      : 0;

  return {
    rounds: state.totalRounds,
    userPnl,
    benchPnl,
    userFinal,
    benchFinal,
    userMaxDrawdown: maxDrawdown(userPnl),
    fills: filledRounds,
    pickedOff: state.pickedOff,
    scenarioId: scenario.id,
    kind: scenario.kind,
    configId: config.id,
    finalTruth: scenario.settle(state.truth),
    fairPath: state.fairPath,
    inventoryPath: state.inventoryPath,
    calibrationPairs: state.calibration,
    consistency: consistency(roundDeltas(userPnl)),
    brier,
    grade: gradeVsBenchmark(userFinal, benchFinal),
  };
}
