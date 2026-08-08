import type { ItemAttempt, TopicMastery } from "@/types/mastery";
import { applyItemAttempt } from "./mastery";
import { topicKeyOf } from "./topicKey";

/**
 * ============================================================================
 *  TRADING-INTUITION SUBTOPICS  (Game-OA battery decomposition)
 * ============================================================================
 *
 * The aggregate `competency::trading-intuition` node (spec §3.2 / §10.8) is
 * DECOMPOSED here into one first-class competency SUBTOPIC per market game in
 * the Game-OA battery. Each subtopic is a distinct, well-named skill fed by ONE
 * game, folded into its own Beta posterior through the SAME `applyItemAttempt`
 * entry point every other node uses (via {@link buildTradingSubtopicAttempt}) —
 * so a subtopic is "mastered" ⇔ its Beta `CI_low ≥ 0.80`, identical to a content
 * node.
 *
 * The aggregate `tradingIntuitionMastered` gate (see `@/lib/pipeline/gates`)
 * ROLLS UP these subtopics: it holds ⇔ EVERY subtopic clears its bar. Any weak
 * SPECIFIC subtopic therefore keeps the Stage-6 drilling gate open and routes
 * the learner back to that exact game (see `@/lib/pipeline/diagnosis` +
 * `@/lib/pipeline/drilling`).
 *
 * This module is PURE data + helpers (no React), imported by `skillGraph.ts`
 * (to register the nodes), the gates/diagnosis/drilling orchestrators, and the
 * battery stage screens. It must NOT import `skillGraph`'s node list to avoid a
 * cycle — it references content-node prerequisite keys by their canonical
 * `topicKeyOf(...)` string, which is exactly how `skillGraph.ts` builds them.
 */

/** Stable game ids for the eleven battery stations. */
export type TradingGameId =
  | "make-market"
  | "trading-floor"
  | "cards-mm"
  | "next-card"
  | "arbitrage"
  | "fermi"
  | "numberlogic"
  | "beat-the-odds"
  | "stockmaster"
  | "number-box"
  | "shape-shift";

/** One trading-intuition subtopic: a distinct skill fed by exactly one game. */
export interface TradingSubtopic {
  /** Competency node topicKey (`competency::<slug>`). */
  key: string;
  /** The battery game that feeds this subtopic. */
  gameId: TradingGameId;
  /** Learner-facing skill name. */
  label: string;
  /** One-line description of the competency this game trains. */
  blurb: string;
  /** `SKILL_TIERS` id the node sits in on the roadmap. */
  tier: string;
  /** Prerequisite content-node topicKeys (all REAL, non-external nodes). */
  prereqs: string[];
  /** Roadmap importance weight (1–3). */
  weight: number;
}

/* -- Real content-node prerequisite keys (mirror skillGraph.ts constants) --- */
const MENTAL = topicKeyOf("mental-math");
const RATES = topicKeyOf("math-questions", "Rates, Algebra & Word Problems");
const NUMBER_THEORY = topicKeyOf("math-questions", "Number Theory & Counting");
const GEOMETRY = topicKeyOf("math-questions", "Geometry & Derivations");
const CORE_PROB = topicKeyOf("probability", "Core Probability");
const CONDITIONAL = topicKeyOf("probability", "Conditional Probability");
const EXPECTED_VALUE = topicKeyOf("probability", "Expected Value");
const BETTING = topicKeyOf("probability", "Betting & Sizing");
const INTERVIEW_GAMES = topicKeyOf("interview-games");

/**
 * THE decomposition. Ordered to match the battery play order (market-making
 * first, cognitive/Optiver drills last). Every `key` is `competency::<slug>` and
 * every `prereqs` entry is a real scored content node, so the external-node
 * invariant in `skillGraph.test.ts` (external nodes rest only on real nodes)
 * holds.
 */
export const TRADING_SUBTOPICS: TradingSubtopic[] = [
  {
    key: topicKeyOf("competency", "spread-setting"),
    gameId: "make-market",
    label: "Spread-setting & adverse-selection avoidance",
    blurb:
      "Quote a tight two-sided market on a hard-to-value quantity and capture the spread from uninformed flow without getting picked off.",
    tier: "processes",
    prereqs: [EXPECTED_VALUE, INTERVIEW_GAMES],
    weight: 3,
  },
  {
    key: topicKeyOf("competency", "inventory-management"),
    gameId: "trading-floor",
    label: "Live quoting & inventory management",
    blurb:
      "Run a live desk: keep quoting through the shot clock, manage accumulating inventory, and beat the honest-desk benchmark.",
    tier: "processes",
    prereqs: [INTERVIEW_GAMES, EXPECTED_VALUE],
    weight: 3,
  },
  {
    key: topicKeyOf("competency", "conditional-pricing"),
    gameId: "cards-mm",
    label: "Conditional pricing / value of information",
    blurb:
      "Price a market on a hidden card sum, updating your fair as cards reveal — the value-of-information trade behind market making.",
    tier: "processes",
    prereqs: [CONDITIONAL, EXPECTED_VALUE],
    weight: 2,
  },
  {
    key: topicKeyOf("competency", "card-counting-kelly"),
    gameId: "next-card",
    label: "Card counting, conditional probability & Kelly sizing",
    blurb:
      "Track the depleting deck, price the next-card bet from conditional probability, and size it with Kelly.",
    tier: "processes",
    prereqs: [CONDITIONAL, BETTING],
    weight: 2,
  },
  {
    key: topicKeyOf("competency", "arbitrage-devig"),
    gameId: "arbitrage",
    label: "Overround removal / arbitrage detection",
    blurb:
      "Convert odds to implied probabilities, strip the vig, and spot the Dutch-book / basket arbitrage.",
    tier: "processes",
    prereqs: [CORE_PROB, EXPECTED_VALUE],
    weight: 2,
  },
  {
    key: topicKeyOf("competency", "estimation"),
    gameId: "fermi",
    label: "Estimation & decomposition (Fermi)",
    blurb:
      "Decompose an unfamiliar quantity into estimable factors and land within an order of magnitude of the truth.",
    tier: "processes",
    prereqs: [RATES],
    weight: 2,
  },
  {
    key: topicKeyOf("competency", "sequence-patterns"),
    gameId: "numberlogic",
    label: "Sequence pattern recognition",
    blurb:
      "Recover the generating rule of a number sequence (arithmetic / geometric / quadratic differences) under time.",
    tier: "foundations",
    prereqs: [NUMBER_THEORY],
    weight: 2,
  },
  {
    key: topicKeyOf("competency", "rapid-ev"),
    gameId: "beat-the-odds",
    label: "Rapid probability / EV under time",
    blurb:
      "Answer fast-fire probability and expected-value questions correctly before the per-question clock runs out.",
    tier: "processes",
    prereqs: [EXPECTED_VALUE],
    weight: 2,
  },
  {
    key: topicKeyOf("competency", "attention-go-no-go"),
    gameId: "stockmaster",
    label: "Attention & go / no-go control",
    blurb:
      "Sustained-attention go/no-go: react to the signal, withhold on the lure — the Optiver Zap-N reflex screen.",
    tier: "foundations",
    prereqs: [MENTAL],
    weight: 1,
  },
  {
    key: topicKeyOf("competency", "modular-arithmetic"),
    gameId: "number-box",
    label: "Modular arithmetic under time",
    blurb:
      "Pick the box whose value satisfies the modular rule — fast modular / remainder arithmetic.",
    tier: "foundations",
    prereqs: [MENTAL, NUMBER_THEORY],
    weight: 1,
  },
  {
    key: topicKeyOf("competency", "mental-rotation"),
    gameId: "shape-shift",
    label: "Mental rotation",
    blurb:
      "Decide whether two shapes match under rotation/reflection — spatial working memory under time.",
    tier: "foundations",
    prereqs: [GEOMETRY],
    weight: 1,
  },
];

/** Every trading subtopic key, in battery order. */
export const TRADING_SUBTOPIC_KEYS: string[] = TRADING_SUBTOPICS.map(
  (s) => s.key,
);

const BY_KEY = new Map<string, TradingSubtopic>(
  TRADING_SUBTOPICS.map((s) => [s.key, s]),
);
const BY_GAME = new Map<TradingGameId, TradingSubtopic>(
  TRADING_SUBTOPICS.map((s) => [s.gameId, s]),
);

/** Look up the subtopic fed by a game (throws if the id is unknown). */
export function tradingSubtopicByGame(gameId: TradingGameId): TradingSubtopic {
  const s = BY_GAME.get(gameId);
  if (!s) throw new Error(`Unknown trading game id: ${gameId}`);
  return s;
}

/** Look up a subtopic by its competency key (undefined if not a subtopic). */
export function tradingSubtopicByKey(key: string): TradingSubtopic | undefined {
  return BY_KEY.get(key);
}

/** True iff `key` is one of the trading-intuition subtopic nodes. */
export function isTradingSubtopic(key: string): boolean {
  return BY_KEY.has(key);
}

/** Clamp a number into [0,1] (defensive; mirrors `competency.ts`). */
export function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/**
 * Credit for ONE scored item/round of a battery game, given whether it was
 * "good" plus an optional graded fraction. A binary game (right/wrong) passes
 * `correct`; a partially-scored game (e.g. Fermi's 0 / 0.5 / 1 bands) passes the
 * fractional `credit` directly. Always lands in [0,1].
 */
export function tradingRoundCredit(
  correct: boolean,
  fraction?: number,
): number {
  if (fraction != null) return clamp01(fraction);
  return correct ? 1 : 0;
}

/**
 * Build the `ItemAttempt` for one battery/drill round of a trading subtopic —
 * folded into that subtopic's Beta via the SAME `applyItemAttempt` path every
 * node uses (like the brainteaser competency's flashcard fold). `credit ∈ [0,1]`
 * is the edge-capturing / correctness verdict for the round.
 */
export function buildTradingSubtopicAttempt(
  subtopicKey: string,
  credit: number,
  at: string = new Date().toISOString(),
): ItemAttempt {
  const c = clamp01(credit);
  return {
    topicKey: subtopicKey,
    tier: "medium",
    correct: c >= 1,
    mode: "flashcard",
    credit: c,
    at,
  };
}

/**
 * Fold one round's credit into a subtopic node (PURE, for local mirrors/tests).
 * Mirrors `foldMarketMakingRound` in `competency.ts` but for an arbitrary
 * subtopic key.
 */
export function foldTradingSubtopic(
  prev: TopicMastery | undefined,
  subtopicKey: string,
  credit: number,
  at: string = new Date().toISOString(),
): TopicMastery {
  const attempt = buildTradingSubtopicAttempt(subtopicKey, credit, at);
  return applyItemAttempt(prev, undefined, attempt, prev?.n ?? 0).mastery;
}

/** The aggregate trading-intuition node key these subtopics roll up to. */
export const COMPETENCY_TRADING_AGGREGATE = topicKeyOf(
  "competency",
  "trading-intuition",
);
