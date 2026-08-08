import type { Difficulty } from "@/types/content";
import type { ItemAttempt, TopicMastery } from "@/types/mastery";
import { applyItemAttempt } from "./mastery";
import {
  COMPETENCY_BRAINTEASER,
  COMPETENCY_TRADING,
} from "@/lib/roadmap/skillGraph";

/**
 * COMPETENCY SCORER (spec §3.2 / §3.3 / §4.5, RESOLVED DECISIONS §10.3, §10.8).
 *
 * The two competency KST nodes — `competency::brainteaser-reasoning` and
 * `competency::trading-intuition` (declared in `@/lib/roadmap/skillGraph`, gated
 * by `@/lib/pipeline/gates`) — have NO in-place probe ladder. Instead of the
 * hint-ladder credit path, their evidence comes from:
 *
 *   (a) brainteaser flashcard self-eval / objectively-graded outcomes, and
 *   (b) market-making (make-a-market) round P&L / edge-capturing verdicts.
 *
 * This module is the single place those two kinds of outcome are folded into
 * their node's {@link TopicMastery}. It reuses the EXACT same mastery entry point
 * as every other node — `applyItemAttempt` — by first computing a fractional
 * `credit ∈ [0,1]` and passing it as `ItemAttempt.credit`. So the Beta posterior
 * on each competency node is updated identically to a free-response item, and the
 * SAME `deriveVerdict(...).mastered` (Beta CI_low ≥ 0.80) that gates every content
 * node also gates these two — no bespoke gate math.
 *
 * PURE: like `applyItemAttempt`, every function returns a fresh `TopicMastery`
 * and never mutates its input.
 */

/** The two competency node topicKeys, re-exported for callers/tests. */
export { COMPETENCY_BRAINTEASER, COMPETENCY_TRADING };

/**
 * Competency evidence rides the same Elo/Glicko machinery as any item, but its
 * "difficulty tier" is not a content difficulty. We fix it at `"medium"` so the
 * parallel Elo/Glicko/IRT signals stay well-defined; NONE of them affect the
 * Beta CI_low that actually gates the node (see `mastery.ts`).
 */
const COMPETENCY_TIER: Difficulty = "medium";

/**
 * Fold ONE outcome into a competency node via `applyItemAttempt` with a computed
 * `credit`. `dExposures` (the prior graded count `n`) keeps the parallel Elo
 * learning-rate honest; it never touches the Beta gate.
 */
function foldCompetencyOutcome(
  prev: TopicMastery | undefined,
  topicKey: string,
  credit: number,
  at: string,
): TopicMastery {
  const attempt: ItemAttempt = {
    topicKey,
    tier: COMPETENCY_TIER,
    // `correct` is the binary view used only by the parallel Glicko/analytics
    // path; the Beta + Elo score reads the fractional `credit` we pass.
    correct: credit >= 1,
    mode: "flashcard",
    credit,
    at,
  };
  return applyItemAttempt(prev, undefined, attempt, prev?.n ?? 0).mastery;
}

/* -------------------------------------------------------------------------- */
/*  (a) Brainteaser reasoning — self-eval / objectively-graded flashcards      */
/* -------------------------------------------------------------------------- */

/**
 * One brainteaser outcome. Per RESOLVED DECISION §10.3 (hybrid gate): when a
 * brainteaser has a numeric answer the learner commits a number that is graded
 * objectively (`got` = the commit was correct); when there is genuinely no
 * numeric answer it is the learner's self-assessment ("I got it" / "I missed
 * it"). Either way the signal collapses to a single boolean `got`.
 */
export interface BrainteaserOutcome {
  got: boolean;
  at: string;
}

/**
 * Map a brainteaser outcome to a competency credit. Per the decision-#3 hybrid
 * note the signal is binary: a clean got ⇒ credit 1, a miss ⇒ credit 0. Kept as
 * a named function so a future partial-credit refinement has one home.
 */
export function brainteaserCredit(outcome: BrainteaserOutcome): number {
  return outcome.got ? 1 : 0;
}

/** Fold one brainteaser self-eval / graded outcome into `brainteaser-reasoning`. */
export function foldBrainteaserOutcome(
  prev: TopicMastery | undefined,
  outcome: BrainteaserOutcome,
): TopicMastery {
  return foldCompetencyOutcome(
    prev,
    COMPETENCY_BRAINTEASER,
    brainteaserCredit(outcome),
    outcome.at,
  );
}

/* -------------------------------------------------------------------------- */
/*  (b) Trading intuition — market-making round verdict / P&L                  */
/* -------------------------------------------------------------------------- */

/**
 * The outcome of ONE make-a-market round, distilled to what the competency
 * scorer needs (spec §3.2 / §10.8: "edge-capturing MM verdict over N rounds").
 * These are all derivable from the make-a-market engine
 * (`@/lib/games/makeMarket/engine.ts`):
 *
 *  - `pnl` — the round's mark-to-true P&L (`markToTrue` of the round's fills).
 *  - `pickedOff` — TRUE iff the round's fill was an adverse INFORMED pick-off
 *    (`CounterpartyAction.kind === "informed"`): the truth was outside your
 *    market, the classic mistake.
 *  - `edgeScale` — the OPTIONAL positive normaliser for a "good" round's P&L
 *    (e.g. half-spread × size the round could earn). When omitted a positive
 *    P&L already earns full credit; it only softens partial credit.
 */
export interface MarketMakingRoundOutcome {
  pnl: number;
  pickedOff?: boolean;
  edgeScale?: number;
  at: string;
}

/** Clamp to [0,1] (defensive; mirrors `mastery.ts`). */
function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/**
 * Map a market-making round to a trading-intuition credit ∈ [0,1] — the
 * "edge-capturing verdict" (decision §10.8). The verdict rewards capturing the
 * spread from uninformed flow and punishes adverse selection:
 *
 *  - An informed PICK-OFF (`pickedOff`) is the archetypal error (mid off, truth
 *    outside the market) ⇒ credit 0, regardless of any incidental P&L.
 *  - Otherwise a POSITIVE round P&L (earned the spread / captured edge) ⇒ credit
 *    1 when no `edgeScale` is given, or `clamp01(pnl / edgeScale)` when it is
 *    (so a round that captured most of the available edge scores near 1).
 *  - A break-even / negative non-pick-off round ⇒ credit 0 (no edge captured).
 *
 * This makes a run of genuinely edge-capturing rounds push the Beta CI_low past
 * 0.80 while sloppy / adversely-selected play keeps it below (unit-tested).
 */
export function marketMakingCredit(outcome: MarketMakingRoundOutcome): number {
  if (outcome.pickedOff) return 0;
  if (outcome.pnl <= 0) return 0;
  if (outcome.edgeScale && outcome.edgeScale > 0) {
    return clamp01(outcome.pnl / outcome.edgeScale);
  }
  return 1;
}

/** Fold one market-making round verdict into `trading-intuition`. */
export function foldMarketMakingRound(
  prev: TopicMastery | undefined,
  outcome: MarketMakingRoundOutcome,
): TopicMastery {
  return foldCompetencyOutcome(
    prev,
    COMPETENCY_TRADING,
    marketMakingCredit(outcome),
    outcome.at,
  );
}
