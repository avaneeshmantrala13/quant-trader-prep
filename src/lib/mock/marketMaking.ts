/**
 * mock/marketMaking.ts — the mock-interview MARKET-MAKING sub-game.
 *
 * Fully DETERMINISTIC and LLM-free. The candidate quotes a two-sided market
 * each round; a mixed informed+uninformed counterparty trades against them and
 * PICKS OFF bad / stupid-wide / offside quotes, producing a P&L. This reuses the
 * exact Make-Me-a-Market math (`counterpartyTight`, `markToTrue`, `netPosition`,
 * `validateQuote`) rather than editing the shared game engine, so the adversarial
 * flow is identical to the standalone game.
 *
 *   • Quote a tight, well-CENTRED market → uninformed noise pays your half-spread
 *     (positive EV).
 *   • Quote OFFSIDE (ask below / bid above the truth) → informed flow lifts the
 *     good side for size-scaled losses.
 *   • Quote STUPID-WIDE → almost no flow crosses, you earn ~nothing.
 *
 * PURE: no React, DOM, storage, or network. Same seed ⇒ identical outcomes.
 */
import { Rng } from "@/lib/rng";
import {
  counterpartyTight,
  markToTrue,
  netPosition,
  validateQuote,
  round2,
  type Fill,
  type Quote,
  type QuoteValidation,
} from "@/lib/games/makeMarket/engine";
import type {
  MarketMakingStep,
  MathTier,
  MmRoundResult,
  MmState,
} from "./types";

/* -------------------------------------------------------------------------- */
/*  Scenario generation (computable true values so pick-offs are meaningful)   */
/* -------------------------------------------------------------------------- */

interface Scenario {
  prompt: string;
  trueValue: number;
  concept: string;
}

/**
 * INTERVIEW-GRADE market-making scenarios. Every quantity is exactly computable
 * (so pick-offs stay meaningful) but requires a genuine INSIGHT — a closed-form
 * summation, a combinatorial count, or an expected value — rather than the
 * freshman arithmetic ("make a market on 12 × 14", "N% of X", "items in D
 * dozen") that a real screen would never ask. These are the classics actually
 * posed on trading floors: Gauss sums, handshake/diagonal counts, sum-of-squares,
 * and dice/coin expected values. The candidate is still graded on the QUOTE
 * (centring, spread, adverse selection), not the arithmetic.
 */
const SCENARIOS: ((rng: Rng) => Scenario)[] = [
  // Gauss sum 1..n — the canonical "make a market on the sum 1 to 100" opener.
  (rng) => {
    const n = rng.int(40, 100);
    return {
      prompt: `Make me a market on the sum of every integer from 1 to ${n}.`,
      trueValue: (n * (n + 1)) / 2,
      concept: "series-sum",
    };
  },
  // Handshakes / pairs among n people — C(n,2). A staple combinatorial market.
  (rng) => {
    const n = rng.int(15, 40);
    return {
      prompt:
        `There are ${n} people in a room and every pair shakes hands exactly ` +
        `once. Make me a market on the total number of handshakes.`,
      trueValue: (n * (n - 1)) / 2,
      concept: "pairs-combinatorics",
    };
  },
  // Diagonals of a convex n-gon — n(n-3)/2. Insight beats brute force.
  (rng) => {
    const n = rng.int(8, 20);
    return {
      prompt: `Make me a market on the number of diagonals in a convex ${n}-gon.`,
      trueValue: (n * (n - 3)) / 2,
      concept: "polygon-diagonals",
    };
  },
  // Sum of the first n squares — n(n+1)(2n+1)/6. A closed-form few recall fast.
  (rng) => {
    const n = rng.int(8, 20);
    return {
      prompt: `Make me a market on the sum of the first ${n} perfect squares (1² + 2² + … + ${n}²).`,
      trueValue: (n * (n + 1) * (2 * n + 1)) / 6,
      concept: "series-squares",
    };
  },
  // Expected value of the sum of k fair dice — 3.5k. A genuine EV market.
  (rng) => {
    const k = rng.int(3, 8);
    return {
      prompt: `I roll ${k} fair six-sided dice. Make me a market on the EXPECTED value of their sum.`,
      trueValue: round2(3.5 * k),
      concept: "dice-ev",
    };
  },
];

/** A "nice" strict max-spread scaled to the value's magnitude (always ≥ 6). */
export function maxSpreadFor(trueValue: number): number {
  const raw = Math.max(6, Math.round(Math.abs(trueValue) * 0.05));
  // Round to a clean step so the cap reads naturally.
  const step = raw >= 40 ? 10 : raw >= 20 ? 5 : 2;
  return Math.max(6, Math.round(raw / step) * step);
}

const ROUNDS_BY_TIER: Record<MathTier, number> = { easy: 2, medium: 3, hard: 3 };
const AGGRESSION_BY_TIER: Record<MathTier, number> = {
  easy: 1,
  medium: 1.5,
  hard: 2,
};

/** Preset difficulty label (mirrors `questionPools.PoolDifficulty`). */
type MmDifficulty = "easy" | "medium" | "hard" | "stretch";
const ROUNDS_BY_DIFF: Record<MmDifficulty, number> = {
  easy: 2,
  medium: 3,
  hard: 3,
  stretch: 3,
};
const AGGRESSION_BY_DIFF: Record<MmDifficulty, number> = {
  easy: 1,
  medium: 1.5,
  hard: 2,
  stretch: 2.5,
};

/**
 * Build ONE market-making step for a preset item at a given difficulty. The
 * adversarial bot is parameterized by difficulty (more aggressive pick-offs and
 * more rounds at higher tiers). `betSizing` reframes the prompt/coaching as a
 * SIG-style "think in bets" decision without changing the deterministic math.
 */
export function buildMockMmStep(
  rng: Rng,
  difficulty: MmDifficulty,
  index: number,
  opts: { betSizing?: boolean; targetMs?: number } = {},
): MarketMakingStep {
  const gen = rng.pick(SCENARIOS);
  const sc = gen(rng);
  const maxSpread = maxSpreadFor(sc.trueValue);
  const betSizing = opts.betSizing === true;
  const contextHint = betSizing
    ? `Quote a two-sided market on this value AND decide how much you'd stake on it. ` +
      `A counterparty who knows the true value will take the side you've mispriced — ` +
      `over-confidence is punished. Centre your mid, keep the spread honest, and size to your edge (spread < ${maxSpread}).`
    : `Quote a tight two-sided market (spread < ${maxSpread}) centred on your ` +
      `estimate, with a size on each side. A counterparty who knows the true ` +
      `value will lift/hit whichever side is mispriced — stay centred and don't quote stupid-wide.`;
  return {
    kind: "marketMaking",
    id: `mock-mm-${index}-${sc.concept}-${sc.trueValue}`,
    prompt: betSizing
      ? `Think in bets: ${sc.prompt} How would you quote it, and how much would you stake?`
      : sc.prompt,
    contextHint,
    trueValue: sc.trueValue,
    maxSpread,
    totalRounds: ROUNDS_BY_DIFF[difficulty],
    aggression: AGGRESSION_BY_DIFF[difficulty],
    seed: (rng.int(1, 2 ** 30) ^ (sc.trueValue * 2654435761)) >>> 0,
    concept: sc.concept,
    difficulty,
    ...(opts.targetMs !== undefined ? { targetMs: opts.targetMs } : {}),
    ...(betSizing ? { betSizing: true } : {}),
    source: "mock market-making",
  };
}

/** Build `count` deterministic market-making steps for a tier. */
export function buildMarketMakingSteps(
  rng: Rng,
  tier: MathTier,
  count: number,
): MarketMakingStep[] {
  const steps: MarketMakingStep[] = [];
  for (let i = 0; i < Math.max(0, count); i++) {
    const gen = rng.pick(SCENARIOS);
    const sc = gen(rng);
    const maxSpread = maxSpreadFor(sc.trueValue);
    steps.push({
      kind: "marketMaking",
      id: `mock-mm-${i}-${sc.concept}-${sc.trueValue}`,
      prompt: sc.prompt,
      contextHint:
        `Quote a tight two-sided market (spread < ${maxSpread}) centred on your ` +
        `estimate, with a size on each side. A counterparty who knows the true ` +
        `value will lift/hit whichever side is mispriced — stay centred and don't quote stupid-wide.`,
      trueValue: sc.trueValue,
      maxSpread,
      totalRounds: ROUNDS_BY_TIER[tier],
      aggression: AGGRESSION_BY_TIER[tier],
      seed: (rng.int(1, 2 ** 30) ^ (sc.trueValue * 2654435761)) >>> 0,
      concept: sc.concept,
      source: "mock market-making",
    });
  }
  return steps;
}

/* -------------------------------------------------------------------------- */
/*  Play                                                                       */
/* -------------------------------------------------------------------------- */

/** A fresh, un-played MM state for a step. */
export function initMmState(step: MarketMakingStep): MmState {
  return {
    trueValue: step.trueValue,
    maxSpread: step.maxSpread,
    totalRounds: step.totalRounds,
    results: [],
    done: false,
    pnl: 0,
    picked: 0,
    verdict: "",
  };
}

/** Validate a candidate quote against the step's strict max spread. */
export function validateMmQuote(
  step: MarketMakingStep,
  quote: Quote,
): QuoteValidation {
  return validateQuote(quote, step.maxSpread);
}

/** All fills recorded so far, in Make-Me-a-Market perspective. */
function fillsOf(state: MmState): Fill[] {
  return state.results
    .filter((r) => r.fill !== null)
    .map((r) => ({
      side: r.fill!.side,
      price: r.fill!.price,
      size: r.fill!.size,
      round: r.round,
    }));
}

/**
 * Resolve one round of a candidate's quote against the deterministic bot and
 * return the NEXT MmState (immutably). Invalid quotes are rejected (state
 * returned unchanged) — the UI should validate first. When the final round
 * completes, P&L and a one-line verdict are computed.
 */
export function playMmRound(
  step: MarketMakingStep,
  state: MmState,
  quote: Quote,
): MmState {
  if (state.done) return state;
  if (!validateMmQuote(step, quote).ok) return state;

  const round = state.results.length + 1;
  const rng = new Rng((step.seed + round * 7919) >>> 0);
  const action = counterpartyTight(
    quote,
    step.trueValue,
    step.maxSpread,
    round,
    rng,
    step.aggression,
  );

  const result: MmRoundResult = {
    round,
    quote: { ...quote },
    fill: action.fill
      ? {
          side: action.fill.side,
          price: action.fill.price,
          size: action.fill.size,
        }
      : null,
    chatter: action.chatter,
    kind: action.kind ?? "pass",
  };

  const results = [...state.results, result];
  const done = round >= state.totalRounds;
  const next: MmState = { ...state, results };
  if (!done) return next;

  const fills = fillsOf(next);
  const pnl = markToTrue(fills, step.trueValue);
  const picked = results.filter((r) => r.kind === "informed").length;
  return {
    ...next,
    done: true,
    pnl,
    picked,
    verdict: verdictFor(results, pnl, step.maxSpread, step.trueValue),
  };
}

/**
 * Deterministic one-line verdict grounded in the round outcomes + P&L. The
 * verdict must reflect the QUOTE QUALITY (was it tight? centred? offside?) and
 * the P&L SIGN correctly:
 *   • A tight, centred quote that simply drew NO flow is FLAT — never "too wide".
 *   • "Quoted too wide" is reserved for markets whose spread really was wide.
 *   • A positive P&L on an OFFSIDE quote is variance, not edge — say so rather
 *     than crediting "earned the spread".
 *   • A losing quote is a pick-off / offside; break-even is flat, not positive.
 */
export function verdictFor(
  results: MmRoundResult[],
  pnl: number,
  maxSpread: number,
  trueValue: number,
): string {
  const traded = results.filter((r) => r.fill !== null);
  const informed = results.filter((r) => r.kind === "informed").length;
  const spreads = results.map((r) => r.quote.ask - r.quote.bid);
  const rounds = results.length;
  const avgSpread =
    spreads.length > 0 ? spreads.reduce((a, b) => a + b, 0) / spreads.length : 0;
  const wide = maxSpread > 0 && avgSpread >= 0.7 * maxSpread;
  // How often the truth sat OUTSIDE the quoted market (an offside quote).
  const offsideRounds = results.filter(
    (r) => trueValue < r.quote.bid || trueValue > r.quote.ask,
  ).length;
  const offside = rounds > 0 && offsideRounds * 2 > rounds; // majority offside
  const net = netPosition(
    traded.map((r) => ({
      side: r.fill!.side,
      price: r.fill!.price,
      size: r.fill!.size,
      round: r.round,
    })),
  );

  if (pnl > 0.005) {
    if (offside) {
      // Won money while quoting offside → the informed flow just didn't show.
      return `Net positive (+${pnl}), but you were offside on ${offsideRounds}/${rounds} round${rounds > 1 ? "s" : ""} — that's variance, not edge; the informed flow simply didn't show. Recentre before it costs you.`;
    }
    return informed > 0
      ? `Net positive (+${pnl}) despite ${informed} pick-off${informed > 1 ? "s" : ""} — your noise capture outweighed the adverse flow.`
      : `Earned the spread (+${pnl}) with disciplined, well-centred two-sided quotes.`;
  }

  if (pnl < -0.005) {
    if (informed > 0 || offside) {
      return `Picked off ${informed > 0 ? `${informed}× ` : ""}for ${pnl} — your market was offside; the informed flow lifted the mispriced side (net ${net}).`;
    }
    return `Down ${pnl} on the run despite a centred market — thin, unlucky flow; keep quoting tight and centred.`;
  }

  // P&L ≈ 0 — a FLAT result. Distinguish "too wide" from "tight but no flow".
  if (wide) {
    return `Quoted too wide — barely any flow crossed, so you captured ~nothing (${pnl}).`;
  }
  if (traded.length === 0) {
    return `Flat (${pnl}) — your tight, centred market simply drew no flow this run; nothing ventured, nothing captured. Keep quoting.`;
  }
  return `Roughly flat (${pnl}) — neither badly picked off nor capturing real edge; tighten and centre.`;
}
