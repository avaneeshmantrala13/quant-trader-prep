import { describe, expect, it } from "vitest";
import { applyItemAttempt } from "./mastery";
import { probeTierFor } from "@/lib/remediation/policy";
import {
  GLICKO_DEFAULT_RATING,
  logitToGlickoRating,
} from "./glicko";
import { IRT_BUFFER_CAP, IRT_MIN_RESPONSES, TIER_SEED } from "./config";
import { Rng } from "@/lib/rng";
import type { GlickoDifficultyMap, ItemAttempt } from "@/types/mastery";

/**
 * T12 ADAPTIVE-ENGINE WIRING GUARD.
 *
 * These are the regression tests that keep the recovered engine (irt / glicko /
 * thompson) from silently becoming dead code again. They assert that the engine
 * is genuinely INVOKED on the two live paths it was wired into and that its
 * output is BEHAVIOR-AFFECTING:
 *
 *  1. The mastery fold (`applyItemAttempt`, called by `recordItemAttempt`) folds
 *     each outcome into a Glicko difficulty rating AND re-fits the 2PL IRT
 *     ability from the topic's rolling response buffer.
 *  2. Probe-tier selection (`probeTierFor`, called by the live remediation
 *     climb-back) lets the Glicko difficulty, the fitted IRT ability, and
 *     Thompson sampling CHANGE which tier is served.
 *
 * If the engine were deleted, both the fold outputs (`glicko`, `irtAbility`) and
 * the selection differences below would vanish and these tests would fail.
 */

const TOPIC = "probability::_core";

function numeric(correct: boolean, at: string): ItemAttempt {
  return { topicKey: TOPIC, tier: "medium", correct, mode: "numeric", at };
}

describe("adaptive engine — fold wiring (Glicko + IRT are invoked in applyItemAttempt)", () => {
  it("folds each outcome into a Glicko difficulty rating (correct ⇒ item looks easier)", () => {
    // First attempt: no prior Glicko rating ⇒ starts from the fresh 1500 default.
    const first = applyItemAttempt(undefined, undefined, numeric(true, "2026-01-01T00:00:00Z"), 0);
    expect(first.glicko).toBeDefined();
    // A CORRECT learner answer is evidence the item is EASIER ⇒ rating drops.
    expect(first.glicko.rating).toBeLessThan(GLICKO_DEFAULT_RATING);

    // A subsequent MISS pushes the difficulty back up (folded onto the prior).
    const second = applyItemAttempt(
      first.mastery,
      first.tierD,
      numeric(false, "2026-01-02T00:00:00Z"),
      1,
      first.glicko,
    );
    expect(second.glicko.rating).toBeGreaterThan(first.glicko.rating);
  });

  it("fits an IRT ability from the rolling buffer once enough responses accrue", () => {
    let mastery = undefined as ReturnType<typeof applyItemAttempt>["mastery"] | undefined;
    let glicko = undefined as ReturnType<typeof applyItemAttempt>["glicko"] | undefined;

    // Below the threshold: buffer fills but no ability is fit yet.
    for (let i = 0; i < IRT_MIN_RESPONSES - 1; i++) {
      const r = applyItemAttempt(mastery, undefined, numeric(true, `2026-02-0${i + 1}T00:00:00Z`), i, glicko);
      mastery = r.mastery;
      glicko = r.glicko;
    }
    expect(mastery?.irtResponses?.length).toBe(IRT_MIN_RESPONSES - 1);
    expect(mastery?.irtAbility).toBeUndefined();

    // Crossing the threshold triggers the 2PL MAP fit (estimateAbility2PL).
    const r = applyItemAttempt(mastery, undefined, numeric(true, "2026-02-09T00:00:00Z"), 5, glicko);
    expect(r.mastery.irtResponses?.length).toBe(IRT_MIN_RESPONSES);
    expect(r.mastery.irtAbility).toBeDefined();
    // All-correct responses ⇒ a positive (above-prior) ability estimate.
    expect(r.mastery.irtAbility as number).toBeGreaterThan(0);
    expect(r.mastery.irtAbilitySe as number).toBeGreaterThan(0);
  });

  it("caps the rolling IRT buffer at IRT_BUFFER_CAP (blob stays cheap)", () => {
    let mastery = undefined as ReturnType<typeof applyItemAttempt>["mastery"] | undefined;
    let glicko = undefined as ReturnType<typeof applyItemAttempt>["glicko"] | undefined;
    for (let i = 0; i < IRT_BUFFER_CAP + 10; i++) {
      const r = applyItemAttempt(mastery, undefined, numeric(i % 2 === 0, `2026-03-01T00:00:${String(i).padStart(2, "0")}Z`), i, glicko);
      mastery = r.mastery;
      glicko = r.glicko;
    }
    expect(mastery?.irtResponses?.length).toBe(IRT_BUFFER_CAP);
  });

  it("does not mutate the input mastery (purity preserved with the new fields)", () => {
    const first = applyItemAttempt(undefined, undefined, numeric(true, "2026-04-01T00:00:00Z"), 0);
    const snapshot = structuredClone(first.mastery);
    applyItemAttempt(first.mastery, first.tierD, numeric(false, "2026-04-02T00:00:00Z"), 1, first.glicko);
    expect(first.mastery).toEqual(snapshot);
  });
});

describe("adaptive engine — selection wiring (probeTierFor is engine-driven)", () => {
  it("reduces to the original Elo behavior when no adaptive opts are supplied", () => {
    // Back-compat guard: probability2PL(θ,1,d) === predictSuccess(θ,d), so the
    // 3-arg call is byte-for-byte the pre-engine selector.
    expect(probeTierFor(0.2346, TOPIC, {})).toBe("intro");
    expect(probeTierFor(2.2346, TOPIC, {})).toBe("medium");
  });

  it("Glicko difficulty ratings CHANGE which tier is selected", () => {
    const theta = 0.5;
    const tiers = ["intro", "easy", "medium", "hard", "expert"] as const;
    const base = probeTierFor(theta, TOPIC, {}); // "intro" at this θ (Elo seeds)

    // Confident (low-RD) Glicko ratings that make every tier look 2 logits EASIER
    // than its Elo seed. The ~0.85 band now lands on a HARDER tier than the
    // Elo-seed baseline would have chosen, so the served tier genuinely moves.
    const glickoD: GlickoDifficultyMap = {};
    for (const tier of tiers) {
      glickoD[`${TOPIC}#${tier}`] = {
        rating: logitToGlickoRating(TIER_SEED[tier] - 2),
        rd: 40, // confident ⇒ trusted by the selector
      };
    }
    const withGlicko = probeTierFor(theta, TOPIC, {}, { glickoD });
    expect(withGlicko).not.toBe(base);
    // Easier-looking items ⇒ the band moves UP to a harder tier.
    expect(tiers.indexOf(withGlicko)).toBeGreaterThan(tiers.indexOf(base));
  });

  it("a confident IRT ability overrides the Elo θ for tier targeting", () => {
    // Low Elo θ ⇒ an easy probe tier.
    const lowTheta = probeTierFor(-1.5, TOPIC, {});
    // Same low Elo θ, but a confident HIGH fitted IRT ability ⇒ a harder probe.
    const irtOverride = probeTierFor(-1.5, TOPIC, {}, {
      irtAbility: 2.5,
      irtAbilitySe: 0.3,
    });
    expect(irtOverride).not.toBe(lowTheta);
    expect(
      ["intro", "easy", "medium", "hard", "expert"].indexOf(irtOverride),
    ).toBeGreaterThan(
      ["intro", "easy", "medium", "hard", "expert"].indexOf(lowTheta),
    );
  });

  it("an UNCONFIDENT IRT ability is ignored (falls back to Elo θ)", () => {
    const base = probeTierFor(-1.5, TOPIC, {});
    const wideSe = probeTierFor(-1.5, TOPIC, {}, {
      irtAbility: 2.5,
      irtAbilitySe: 5, // too uncertain ⇒ not trusted
    });
    expect(wideSe).toBe(base);
  });

  it("Thompson sampling adds real exploration (a distribution over tiers), not a fixed argmin", () => {
    const deterministic = probeTierFor(0.5, TOPIC, {});
    const seen = new Set<string>();
    for (let seed = 0; seed < 80; seed++) {
      seen.add(probeTierFor(0.5, TOPIC, {}, { rng: new Rng(seed) }));
    }
    // Exploration must produce MORE than one tier across seeds...
    expect(seen.size).toBeGreaterThan(1);
    // ...while still concentrating around the deterministic ZPD choice.
    expect(seen.has(deterministic)).toBe(true);
  });

  it("Thompson selection is reproducible for a fixed seed", () => {
    const a = probeTierFor(0.5, TOPIC, {}, { rng: new Rng(1234) });
    const b = probeTierFor(0.5, TOPIC, {}, { rng: new Rng(1234) });
    expect(a).toBe(b);
  });
});
