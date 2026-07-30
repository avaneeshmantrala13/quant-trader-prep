/**
 * Rung-2 "GUIDED PLAN OF ATTACK" contract (PHASE_2 §5, rung 2 redesign).
 *
 * Rung 2 bridges rung 1 (which NAMES the mistake only) → rung 3 (a worked
 * walkthrough on different numbers). It is a SHORT step-roadmap phrased as
 * LEADING QUESTIONS that name WHAT the learner must figure out at each step —
 * never the operation, rule, or the answer, and never a "draw it / simulate it"
 * visualization (that is rung 4's job). Per-domain resolvers author these plans
 * in disjoint files and the central `planOfAttack` aggregates them.
 */

/** Context for resolving a rung-2 plan. Mirrors `HintContext` in hintTopicHelp. */
export interface PlanContext {
  /** `Level.section` topic string. */
  section?: string;
  /** `question.family` — the generator (template) name. */
  family?: string;
  /** The tripped misconception tag, when known. */
  misconceptionTag?: string;
}

/**
 * A rung-2 guided plan: a short roadmap of LEADING QUESTIONS about WHAT to
 * determine at each step. MUST NOT contain the item's answer, a corrective
 * operation/rule spelled out, or "visualize/draw/simulate" content.
 */
export type AttackPlan = string;

/**
 * A per-domain resolver. Returns a plan when it recognizes `ctx` (by family,
 * misconception tag, or section keywords WITHIN ITS OWN DOMAIN), else `null` so
 * the aggregator tries the next resolver and finally the generic plan.
 */
export type PlanResolver = (ctx: PlanContext) => AttackPlan | null;
