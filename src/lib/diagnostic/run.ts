import type { Difficulty, Question } from "@/types/content";
import {
  DIAGNOSTIC_BLUEPRINT,
  ROUTER_SLOT_INDEX,
  type DiagnosticSlot,
} from "@/content/diagnostic/blueprint";
import { drawSlotItems } from "@/content/diagnostic/items";
import type { DiagnosticOutcome } from "./diagnosticSeed";
import { nextTier } from "./multistage";

/**
 * Pure orchestration of ONE diagnostic run (PHASE_3 §3/§5 + redesign): build the
 * always-on BASE plan, then — from the base answers — a FOLLOW-UP plan that
 * (a) injects the GATED Markov probe only when Conditional was passed and
 * (b) adds an adaptive tiebreak 3rd item on any topic whose two items split.
 * Answers fold into per-item outcomes with a lightly-multistage tier schedule:
 * a global ROUTING tier from the first slot sets the base tier for the rest,
 * and item 2 bumps within-slot via `nextTier`. Kept out of the page so it is
 * deterministic and unit-testable (vitest node env).
 */

export interface PlanItem {
  slotIndex: number;
  /** 0-based position within the slot (0/1 = the pair; 2 = injected tiebreak). */
  indexInSlot: number;
  topicKey: string;
  item: Question;
}

/** Sub-seed for a slot's primary pair; +offset variants keep injected items fresh. */
function slotSeed(seed: number, slotIndex: number): number {
  return seed + slotIndex * 1000 + 1;
}

/**
 * Materialize the ALWAYS-ON base plan (every non-gated slot × itemsPerTopic)
 * from one seed. Gated slots (the Markov probe) are injected later by
 * {@link buildFollowUpPlan} once the base answers are known.
 */
export function buildDiagnosticPlan(seed: number): PlanItem[] {
  const plan: PlanItem[] = [];
  DIAGNOSTIC_BLUEPRINT.forEach((slot, slotIndex) => {
    if (slot.gatedOnTopicKey) return;
    drawSlotItems(slot, slotSeed(seed, slotIndex)).forEach((item, indexInSlot) => {
      plan.push({ slotIndex, indexInSlot, topicKey: slot.topicKey, item });
    });
  });
  return plan;
}

/** Was the FIRST item of the slot with this topicKey answered correctly? */
function firstItemCorrect(
  plan: PlanItem[],
  answers: (number | null)[],
  topicKey: string,
): boolean {
  for (let i = 0; i < plan.length; i++) {
    const p = plan[i];
    if (p.topicKey === topicKey && p.indexInSlot === 0) {
      const a = answers[i];
      return a !== null && a === p.item.correctIndex;
    }
  }
  return false;
}

/** True when a topic's two graded items split (exactly one correct). */
export function needsTiebreak(slotOutcomes: { correct: boolean }[]): boolean {
  if (slotOutcomes.length < 2) return false;
  const correct = slotOutcomes.filter((o) => o.correct).length;
  return correct === 1;
}

/**
 * The global ROUTING tier derived from the router slot's early items: both
 * correct ⇒ start remaining slots at `hard`, none correct ⇒ `easy`, mixed (or
 * nothing graded yet) ⇒ `medium`. Only the first 1–2 items steer this.
 */
export function routingTier(
  plan: PlanItem[],
  answers: (number | null)[],
): Difficulty {
  const graded = plan
    .map((p, i) => ({ p, a: answers[i] }))
    .filter((x) => x.p.slotIndex === ROUTER_SLOT_INDEX && x.a != null);
  if (graded.length === 0) return "medium";
  const correct = graded.filter((x) => x.a === x.p.item.correctIndex).length;
  if (correct === graded.length) return "hard";
  if (correct === 0) return "easy";
  return "medium";
}

/**
 * Build the FOLLOW-UP plan from the completed base run:
 *  1. GATED slots (Markov) — only if their `gatedOnTopicKey` first item passed.
 *  2. TIEBREAK 3rd items — one per non-gated slot whose two items split.
 * Injected items draw from a distinct sub-seed so they differ from the pair.
 */
export function buildFollowUpPlan(
  seed: number,
  basePlan: PlanItem[],
  baseAnswers: (number | null)[],
): PlanItem[] {
  const followups: PlanItem[] = [];

  // 1) Gated probes (e.g. Markov, gated on Conditional passing).
  DIAGNOSTIC_BLUEPRINT.forEach((slot, slotIndex) => {
    if (!slot.gatedOnTopicKey) return;
    if (!firstItemCorrect(basePlan, baseAnswers, slot.gatedOnTopicKey)) return;
    drawSlotItems(slot, slotSeed(seed, slotIndex)).forEach((item, indexInSlot) => {
      followups.push({ slotIndex, indexInSlot, topicKey: slot.topicKey, item });
    });
  });

  // 2) Adaptive tiebreak on any base slot whose two items split.
  DIAGNOSTIC_BLUEPRINT.forEach((slot, slotIndex) => {
    if (slot.gatedOnTopicKey) return;
    const outcomes = gradedSlotOutcomes(basePlan, baseAnswers, slotIndex);
    if (!needsTiebreak(outcomes)) return;
    const extra = drawSlotItems(slot, seed + slotIndex * 1000 + 500)[0];
    if (extra) {
      followups.push({
        slotIndex,
        indexInSlot: 2,
        topicKey: slot.topicKey,
        item: extra,
      });
    }
  });

  return followups;
}

/** Per-slot graded correctness (answered items only), ordered by position. */
function gradedSlotOutcomes(
  plan: PlanItem[],
  answers: (number | null)[],
  slotIndex: number,
): { correct: boolean }[] {
  return plan
    .map((p, i) => ({ p, a: answers[i] }))
    .filter((x) => x.p.slotIndex === slotIndex && x.a != null)
    .sort((x, y) => x.p.indexInSlot - y.p.indexInSlot)
    .map((x) => ({ correct: x.a === x.p.item.correctIndex }));
}

/**
 * Fold answers (chosen choice index per plan item; `null` = unanswered) into
 * per-topic outcomes. The base tier is the global ROUTING tier (the router slot
 * keeps its own `startTier`); item 2 bumps via `nextTier(baseTier, item1Correct)`
 * and an injected tiebreak (indexInSlot 2) is scored at the base tier. A miss
 * carries the tripped trap tag (authored `Question.misconceptions[i]`, else the
 * slot's authored `misconceptionTag`, else the `idx:<i>` fallback).
 */
export function outcomesFromAnswers(
  plan: PlanItem[],
  answers: (number | null)[],
): DiagnosticOutcome[] {
  const route = routingTier(plan, answers);

  const bySlot = new Map<number, { entry: PlanItem; chosen: number | null }[]>();
  plan.forEach((entry, i) => {
    const arr = bySlot.get(entry.slotIndex) ?? [];
    arr.push({ entry, chosen: answers[i] ?? null });
    bySlot.set(entry.slotIndex, arr);
  });

  const outcomes: DiagnosticOutcome[] = [];
  for (const [slotIndex, arr] of bySlot) {
    const slot = DIAGNOSTIC_BLUEPRINT[slotIndex];
    arr.sort((a, b) => a.entry.indexInSlot - b.entry.indexInSlot);
    const baseTier: Difficulty =
      slotIndex === ROUTER_SLOT_INDEX ? slot.startTier : route;

    const first = arr.find((x) => x.entry.indexInSlot === 0);
    const firstCorrect =
      !!first && first.chosen !== null && first.chosen === first.entry.item.correctIndex;

    for (const { entry, chosen } of arr) {
      if (chosen === null) continue;
      const correct = chosen === entry.item.correctIndex;
      const tier =
        entry.indexInSlot === 1 ? nextTier(baseTier, firstCorrect) : baseTier;
      const misconceptionTag = correct
        ? undefined
        : itemMisconceptionTag(entry.item, chosen, slot);
      outcomes.push({ topicKey: slot.topicKey, tier, correct, misconceptionTag });
    }
  }
  return outcomes;
}

/** Authored per-choice tag → slot's authored topic tag → `idx:<i>` fallback. */
function itemMisconceptionTag(
  item: Question,
  chosen: number,
  slot: DiagnosticSlot,
): string {
  const authored = item.misconceptions?.[chosen];
  if (authored && authored.length > 0) return authored;
  if (slot.misconceptionTag) return slot.misconceptionTag;
  return `idx:${chosen}`;
}
