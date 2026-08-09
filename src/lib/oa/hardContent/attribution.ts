import { topicKeyOf } from "@/lib/mastery/topicKey";

/**
 * ============================================================================
 *  CANONICAL hard-family → scored-KST-node attribution (M5 unification)
 * ============================================================================
 *
 * ONE source of truth for "which scored KST node does each hard OA archetype
 * test?", consumed by BOTH diagnostics — the TIMED diagnostic plan
 * (`timedDiagnostic.ts`) and the UNTIMED blueprint's hard-ceiling adapters
 * (`content/diagnostic/untimedBlueprint.ts`). Previously each diagnostic carried
 * its own inline mapping, and two families drifted apart:
 *
 *   • `hardOneReroll` — a keep-or-reroll EXPECTED-VALUE decision — was tagged
 *     Expected Value in one place and Interview Games in the other.
 *   • `hardPatternWait` — an expected-wait-for-a-pattern first-step / martingale
 *     argument — was tagged Markov Chains in one place and Conditional
 *     Expectation in the other.
 *
 * Unifying here fixes both to a SINGLE canonical node each (hardOneReroll →
 * Expected Value; hardPatternWait → Conditional Expectation) so a learner's hard
 * evidence folds into the same node no matter which diagnostic served it. Every
 * value is a real `SKILL_GRAPH` node key (asserted in the tests).
 */

const T_MARKOV = topicKeyOf("probability", "Markov Chains");
const T_EXPECTED_VALUE = topicKeyOf("probability", "Expected Value");
const T_CONDITIONAL_EXPECTATION = topicKeyOf("probability", "Conditional Expectation");
const T_INTERVIEW_GAMES = topicKeyOf("interview-games");
const T_CONDITIONAL = topicKeyOf("probability", "Conditional Probability");
const T_ORDER_STATS = topicKeyOf("probability", "Order Statistics");
const T_BETTING = topicKeyOf("probability", "Betting & Sizing");

/**
 * The canonical map: every hard OA `family` id → the ONE scored KST node it
 * attributes to. Keys must exactly match `HARD_OA_BUILDERS` family ids; values
 * must be real `SKILL_GRAPH` node keys (both invariants are locked by tests).
 */
export const HARD_FAMILY_TOPIC: Readonly<Record<string, string>> = {
  // Random walks / Markov chains / hitting & waiting / first-passage.
  hardPathIntersect: T_MARKOV,
  hardRuinDuration: T_MARKOV,
  hardGraphHitting: T_MARKOV,
  hardStepLanding: T_MARKOV,
  hardCycleMeeting: T_MARKOV,
  // First-step / martingale expected wait for a pattern (M5 fix: cond-exp, not Markov).
  hardPatternWait: T_CONDITIONAL_EXPECTATION,
  // Expectation (coupon collector) + keep-or-reroll EV (M5 fix: EV, not interview-games).
  hardResetCollector: T_EXPECTED_VALUE,
  hardOneReroll: T_EXPECTED_VALUE,
  // Optimal stopping / market-making / pricing games.
  hardSecretary: T_INTERVIEW_GAMES,
  hardInformedLift: T_INTERVIEW_GAMES,
  hardBasketNav: T_INTERVIEW_GAMES,
  hardMakeMarket: T_INTERVIEW_GAMES,
  // Conditional probability / Bayesian updating / next-card pricing.
  hardHiddenComposition: T_CONDITIONAL,
  hardCoinBias: T_CONDITIONAL,
  hardNextCard: T_CONDITIONAL,
  // Order statistics.
  hardDiceOrderStat: T_ORDER_STATS,
  // Betting & sizing (Kelly + de-vig / overround removal).
  hardKelly: T_BETTING,
  hardDeVig: T_BETTING,
};

/**
 * The canonical scored KST node for a hard OA `family`. Throws on an unknown
 * family so a mistyped id can never silently orphan a mastery update (the same
 * fail-fast contract the diagnostics rely on).
 */
export function topicForHardFamily(family: string): string {
  const topicKey = HARD_FAMILY_TOPIC[family];
  if (!topicKey) {
    throw new Error(`attribution: unknown hard OA family "${family}"`);
  }
  return topicKey;
}
