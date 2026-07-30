import { describe, expect, it } from "vitest";
import {
  buildDiagnosticPlan,
  buildFollowUpPlan,
  needsTiebreak,
  outcomesFromAnswers,
  routingTier,
  type PlanItem,
} from "./run";
import { diagnosticToSeeds } from "./diagnosticSeed";
import { applyDiagnosticSeed } from "@/lib/mastery/mastery";
import {
  DIAGNOSTIC_BLUEPRINT,
  ROUTER_SLOT_INDEX,
  diagnosticBaseItemCount,
  diagnosticMaxItemCount,
} from "@/content/diagnostic/blueprint";
import { topicKeyOf } from "@/lib/mastery/topicKey";

const CONDITIONAL = topicKeyOf("probability", "Conditional Probability");
const MARKOV = topicKeyOf("probability", "Markov Chains");

/** Answer every plan item correctly. */
function allCorrect(plan: PlanItem[]): number[] {
  return plan.map((p) => p.item.correctIndex);
}

/** Wrong-answer index for a plan item (rotates off the correct choice). */
function wrong(p: PlanItem): number {
  return (p.item.correctIndex + 1) % p.item.choices.length;
}

describe("buildDiagnosticPlan (base, always-on slots)", () => {
  it("produces itemsPerTopic items for every NON-gated topic", () => {
    const plan = buildDiagnosticPlan(7);
    expect(plan).toHaveLength(diagnosticBaseItemCount());
    DIAGNOSTIC_BLUEPRINT.forEach((slot, slotIndex) => {
      const slotItems = plan.filter((p) => p.slotIndex === slotIndex);
      if (slot.gatedOnTopicKey) {
        expect(slotItems).toHaveLength(0); // gated slot injected later
      } else {
        expect(slotItems).toHaveLength(slot.itemsPerTopic);
        expect(slotItems.map((p) => p.indexInSlot)).toEqual(
          slot.itemsPerTopic === 2 ? [0, 1] : [0],
        );
      }
    });
  });
});

describe("routingTier (global adaptive start)", () => {
  it("routes UP to hard when the router slot is all correct", () => {
    const plan = buildDiagnosticPlan(3);
    const answers = plan.map((p) =>
      p.slotIndex === ROUTER_SLOT_INDEX ? p.item.correctIndex : null,
    );
    expect(routingTier(plan, answers)).toBe("hard");
  });

  it("routes DOWN to easy when the router slot is all wrong", () => {
    const plan = buildDiagnosticPlan(3);
    const answers = plan.map((p) =>
      p.slotIndex === ROUTER_SLOT_INDEX ? wrong(p) : null,
    );
    expect(routingTier(plan, answers)).toBe("easy");
  });

  it("stays medium on a mixed/empty router signal", () => {
    const plan = buildDiagnosticPlan(3);
    expect(routingTier(plan, plan.map(() => null))).toBe("medium");
  });

  it("applies the routing tier to non-router slots' outcomes", () => {
    const plan = buildDiagnosticPlan(11);
    // Router all correct → hard; answer a later slot's item 1 to inspect tier.
    const answers = plan.map((p) =>
      p.slotIndex === ROUTER_SLOT_INDEX
        ? p.item.correctIndex
        : p.indexInSlot === 0
          ? p.item.correctIndex
          : null,
    );
    const outcomes = outcomesFromAnswers(plan, answers);
    const laterSlot = DIAGNOSTIC_BLUEPRINT.findIndex(
      (s, i) => i !== ROUTER_SLOT_INDEX && !s.gatedOnTopicKey,
    );
    const key = DIAGNOSTIC_BLUEPRINT[laterSlot].topicKey;
    const first = outcomes.find((o) => o.topicKey === key);
    expect(first?.tier).toBe("hard"); // routed up from the router signal
  });
});

describe("needsTiebreak", () => {
  it("is true only when the two graded items split", () => {
    expect(needsTiebreak([{ correct: true }, { correct: false }])).toBe(true);
    expect(needsTiebreak([{ correct: false }, { correct: true }])).toBe(true);
    expect(needsTiebreak([{ correct: true }, { correct: true }])).toBe(false);
    expect(needsTiebreak([{ correct: false }, { correct: false }])).toBe(false);
    expect(needsTiebreak([{ correct: true }])).toBe(false);
  });
});

describe("buildFollowUpPlan — tiebreak injection", () => {
  it("injects a 3rd item ONLY for split base slots", () => {
    const base = buildDiagnosticPlan(21);
    // Split slot 0 (item 0 correct, item 1 wrong); everything else all correct.
    const answers = base.map((p) => {
      if (p.slotIndex === ROUTER_SLOT_INDEX && p.indexInSlot === 1) return wrong(p);
      return p.item.correctIndex;
    });
    const follow = buildFollowUpPlan(21, base, answers);
    const tiebreaks = follow.filter((p) => p.indexInSlot === 2);
    expect(tiebreaks).toHaveLength(1);
    expect(tiebreaks[0].slotIndex).toBe(ROUTER_SLOT_INDEX);
  });

  it("injects no tiebreak when no base slot splits", () => {
    const base = buildDiagnosticPlan(22);
    const follow = buildFollowUpPlan(22, base, allCorrect(base));
    expect(follow.filter((p) => p.indexInSlot === 2)).toHaveLength(0);
  });
});

describe("buildFollowUpPlan — gated Markov probe", () => {
  it("includes Markov when the Conditional item is answered correctly", () => {
    const base = buildDiagnosticPlan(31);
    const follow = buildFollowUpPlan(31, base, allCorrect(base));
    expect(follow.some((p) => p.topicKey === MARKOV)).toBe(true);
  });

  it("omits Markov when the Conditional item is answered WRONG", () => {
    const base = buildDiagnosticPlan(31);
    const answers = base.map((p) =>
      p.topicKey === CONDITIONAL && p.indexInSlot === 0 ? wrong(p) : p.item.correctIndex,
    );
    const follow = buildFollowUpPlan(31, base, answers);
    expect(follow.some((p) => p.topicKey === MARKOV)).toBe(false);
  });
});

describe("outcomesFromAnswers", () => {
  it("tags item 1 at the base tier and item 2 via the multistage bump", () => {
    const plan = buildDiagnosticPlan(3);
    // Router mixed (item0 correct, item1 wrong) → medium base for later slots,
    // and within the router slot item 2 bumps from its own startTier.
    const answers = plan.map((p) =>
      p.indexInSlot === 0 ? p.item.correctIndex : wrong(p),
    );
    const outcomes = outcomesFromAnswers(plan, answers);
    const firstSlot = outcomes.filter(
      (x) => x.topicKey === DIAGNOSTIC_BLUEPRINT[ROUTER_SLOT_INDEX].topicKey,
    );
    expect(firstSlot[0]).toMatchObject({ tier: "medium", correct: true });
    expect(firstSlot[1]).toMatchObject({ tier: "hard", correct: false });
    expect(firstSlot[1].misconceptionTag).toBeDefined();
  });

  it("surfaces a real misconception tag on a router-slot miss (item tag or authored fallback)", () => {
    const plan = buildDiagnosticPlan(5);
    // Miss the router slot's first item. pr-1 is now free-response numeric with
    // tagged `commonErrors` (Phase-2), so a miss surfaces the item's OWN semantic
    // tag; a tag-less item would fall back to the blueprint's authored tag.
    // Either way the resolved tag must be a real semantic tag — never a raw
    // idx:<i> / err:<value> fallback.
    const answers = plan.map((p) =>
      p.slotIndex === ROUTER_SLOT_INDEX && p.indexInSlot === 0 ? wrong(p) : null,
    );
    const outcomes = outcomesFromAnswers(plan, answers);
    const missed = outcomes.find(
      (o) => o.topicKey === DIAGNOSTIC_BLUEPRINT[ROUTER_SLOT_INDEX].topicKey,
    );
    expect(missed?.misconceptionTag).toBeDefined();
    expect(missed?.misconceptionTag).not.toMatch(/^(idx|err):/);
  });

  it("skips unanswered items", () => {
    const plan = buildDiagnosticPlan(1);
    expect(outcomesFromAnswers(plan, plan.map(() => null))).toHaveLength(0);
  });
});

describe("integration: a full run (base + gated + tiebreak) seeds priors", () => {
  it("folds an all-correct run into n≥2 priors including Markov", () => {
    const base = buildDiagnosticPlan(42);
    const baseAnswers = allCorrect(base);
    const follow = buildFollowUpPlan(42, base, baseAnswers);
    const plan = [...base, ...follow];
    const answers = [...baseAnswers, ...allCorrect(follow)];
    const seeds = diagnosticToSeeds(outcomesFromAnswers(plan, answers));
    // Markov is unlocked on an all-correct run.
    expect(seeds.some((s) => s.topicKey === MARKOV)).toBe(true);
    for (const seed of seeds) {
      const mastery = applyDiagnosticSeed(undefined, seed);
      // Every probed topic gets evidence (1-item breadth probes seed n≥1;
      // 2-item core topics seed n≥2).
      expect(mastery.n).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("worst-case item budget stays ≤ 30", () => {
  it("all gates open + every 2-item base slot splits ⇒ ≤ 30 items", () => {
    const base = buildDiagnosticPlan(77);
    // For every base slot: item 0 CORRECT (opens any gate keyed on it), item 1
    // WRONG (splits a 2-item slot ⇒ tiebreak). 1-item base slots: correct.
    const answers = base.map((p) =>
      p.indexInSlot === 0 ? p.item.correctIndex : wrong(p),
    );
    const follow = buildFollowUpPlan(77, base, answers);
    const total = base.length + follow.length;
    expect(total).toBe(diagnosticMaxItemCount());
    expect(total).toBeLessThanOrEqual(30);
    // Sanity: all 7 gated probes opened, and 6 tiebreaks were injected.
    const gatedInjected = follow.filter((p) => p.indexInSlot < 2).length;
    const tiebreaks = follow.filter((p) => p.indexInSlot === 2).length;
    expect(gatedInjected).toBe(9); // 1+1+2+1+2+1+1
    expect(tiebreaks).toBe(6);
  });
});
