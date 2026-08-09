import { describe, expect, it } from "vitest";

import { Rng } from "@/lib/rng";
import { directionalNudge } from "@/lib/tutor/hintLadder";
import { confrontForTag, MISCONCEPTION } from "@/lib/tutor/misconception";
import { adaptHardOaToFreeResponse } from "@/lib/oa/hardContent/frAdapters";
import { combinedRatesFloorGenerator } from "./floorGenerators";
import { UNTIMED_BLUEPRINT } from "./untimedBlueprint";

/**
 * V3/V4 — drill `commonErrors` carry canonical MISCONCEPTION tags so the rung-1
 * DIRECTIONAL nudge (and, where applicable, the rung-4 confront) fires on drill
 * items instead of the content-free generic fallback. These lock the three
 * tagging surfaces the audit called out: the parametric floor generator
 * (`combinedRatesFloorGenerator`), the blueprint `q()` floor exemplars, and the
 * `frAdapters` distractor projection.
 */

/* -- combinedRatesFloorGenerator ------------------------------------------- */

describe("V3/V4 — combinedRatesFloorGenerator tags trip a rung-1 nudge", () => {
  it("every commonError carries a tag that resolves to a non-empty directional nudge", () => {
    for (const seed of [1, 7, 42, 2024, 99999]) {
      const q = combinedRatesFloorGenerator(new Rng(seed));
      expect(q.commonErrors && q.commonErrors.length).toBeGreaterThan(0);
      for (const e of q.commonErrors!) {
        expect(e.misconception, `${q.id} untagged error @${e.value}`).toBeTruthy();
        expect(
          directionalNudge(e.misconception, e.feedback),
          `${e.misconception} produced no nudge`,
        ).not.toBe("");
      }
    }
  });

  it("the two classic traps route to the intended buckets (averaging vs combine-add)", () => {
    // averaged the TIMES → the equal-weight/averaging nudge.
    expect(directionalNudge("averaged_times_not_rates", "You averaged the times.")).toMatch(
      /equal weight|larger or occur/i,
    );
    // added the TIMES → the "stacking pieces over/under-counts" combine-add nudge.
    expect(directionalNudge("summed_times_not_combined", "You added the times.")).toMatch(
      /stacking the pieces|over- or under-count/i,
    );
  });
});

/* -- blueprint q() floor exemplars ----------------------------------------- */

describe("V3/V4 — generator-backed floor exemplars are misconception-tagged", () => {
  it("every numGen floor item's static commonErrors carry a MISCONCEPTION tag (mastery fold)", () => {
    const floorGenItems = UNTIMED_BLUEPRINT.filter(
      (it) =>
        it.kind === "numeric-authored" &&
        it.tier === "floor" &&
        !!it.generator &&
        !!it.question.commonErrors?.length,
    );
    // The 12 previously-static stall topics + combined-rates are all backed now.
    expect(floorGenItems.length).toBeGreaterThanOrEqual(12);
    for (const it of floorGenItems) {
      if (it.kind !== "numeric-authored") continue;
      for (const e of it.question.commonErrors!) {
        // Every wrong value folds to a CANONICAL misconceptionKey (not the
        // instance-specific `err:<value>` fallback) so mastery aggregates it.
        expect(e.misconception, `${it.question.id} untagged @${e.value}`).toBeTruthy();
      }
    }
  });

  it("each numGen floor item exposes at least one tag that also fires a rung-1 nudge", () => {
    const floorGenItems = UNTIMED_BLUEPRINT.filter(
      (it) =>
        it.kind === "numeric-authored" && it.tier === "floor" && !!it.generator,
    );
    for (const it of floorGenItems) {
      if (it.kind !== "numeric-authored" || !it.question.commonErrors?.length) continue;
      const anyNudges = it.question.commonErrors.some(
        (e) => directionalNudge(e.misconception, e.feedback) !== "",
      );
      expect(anyNudges, `${it.question.id} fires no directional nudge`).toBe(true);
    }
  });
});

/* -- frAdapters distractor projection -------------------------------------- */

describe("V3/V4 — frAdapters projects the MCQ misconception tag onto commonErrors", () => {
  it("Bayesian families surface canonical tags that trip the nf-tree confront + a nudge", () => {
    for (const family of ["hardCoinBias", "hardHiddenComposition"] as const) {
      const { question } = adaptHardOaToFreeResponse(family, new Rng(2024));
      const tags = (question.commonErrors ?? [])
        .map((e) => e.misconception)
        .filter((t): t is string => !!t);
      // The projection is non-vacuous: at least one distractor carried a tag.
      expect(tags.length, `${family} projected no tags`).toBeGreaterThan(0);
      // A canonical base-rate/likelihood tag → the deterministic nf-tree confront.
      expect(
        tags.some((t) => confrontForTag(t) === "nf-tree"),
        `${family} has no nf-tree confront tag`,
      ).toBe(true);
      // Every projected tag also produces a rung-1 directional nudge.
      for (const t of tags) {
        expect(directionalNudge(t, ""), `${t} produced no nudge`).not.toBe("");
      }
    }
  });

  it("base_rate_neglect and likelihood_as_posterior are the canonical Bayesian tags used", () => {
    const { question } = adaptHardOaToFreeResponse("hardCoinBias", new Rng(11));
    const tags = new Set(
      (question.commonErrors ?? []).map((e) => e.misconception).filter(Boolean),
    );
    expect(
      tags.has(MISCONCEPTION.baseRateNeglect) ||
        tags.has(MISCONCEPTION.likelihoodAsPosterior),
    ).toBe(true);
  });
});
