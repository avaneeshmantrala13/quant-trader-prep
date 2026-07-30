/**
 * Rung-2 "GUIDED PLAN OF ATTACK" aggregator (PHASE_2 §5, rung 2 redesign).
 *
 * Rung 2 bridges rung 1 (which NAMES the mistake only) → rung 3 (a worked
 * walkthrough on different numbers). It is a short step-roadmap phrased as
 * LEADING QUESTIONS about WHAT the learner must figure out at each step — never
 * the operation, rule, or the answer, and never "draw / visualize / simulate"
 * content (that is rung 4). Per-domain resolvers author the plans in disjoint
 * `./plans/*` files; this module tries them in order and falls back to a strong
 * topic-neutral generic plan.
 */

import type { AttackPlan, PlanContext } from "./plans/types";
import { resolveProbabilityPlan } from "./plans/probabilityPlans";
import { resolveEvCombinatoricsPlan } from "./plans/evCombinatoricsPlans";
import { resolveStochasticPlan } from "./plans/stochasticPlans";
import { resolveGamesMiscPlan } from "./plans/gamesMiscPlans";

/** Per-domain resolvers, tried in order; first non-null wins. */
const RESOLVERS = [
  resolveProbabilityPlan,
  resolveEvCombinatoricsPlan,
  resolveStochasticPlan,
  resolveGamesMiscPlan,
];

/**
 * The topic-neutral fallback plan when no domain resolver recognizes the item.
 * Still question-driven and free of any operation/rule/answer.
 */
export const GENERIC_PLAN: AttackPlan =
  "Let's make a plan before you recompute. " +
  "(1) In one sentence, what exactly is the question asking you to find? " +
  "(2) Which of the given numbers actually matter for that, and what does each one represent? " +
  "(3) What has to be worked out FIRST before you can reach the final quantity, and what single step would you run last? " +
  "Sort those out, then try your answer again.";

/**
 * Resolve a rung-2 guided plan for the item's context. Priority is delegated to
 * each domain resolver (family → misconception → section); the aggregator order
 * only matters for the (rare) cross-domain overlap. Always returns a non-empty
 * plan.
 */
export function planOfAttack(ctx: PlanContext): AttackPlan {
  for (const resolve of RESOLVERS) {
    const plan = resolve(ctx);
    if (plan) return plan;
  }
  return GENERIC_PLAN;
}
