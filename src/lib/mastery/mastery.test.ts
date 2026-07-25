import { describe, expect, it } from "vitest";
import {
  applyDiagnosticSeed,
  applyItemAttempt,
  applyReviewSchedule,
} from "./mastery";
import type { ItemAttempt, TopicMastery } from "@/types/mastery";

const AT = "2026-01-01T00:00:00.000Z";

function quiz(correct: boolean, misconceptions?: string[]): ItemAttempt {
  return {
    topicKey: "probability::_core",
    tier: "medium",
    correct,
    mode: "quiz",
    kOptions: 4,
    chosenIndex: correct ? 0 : 1,
    misconceptions,
    at: AT,
  };
}

describe("applyItemAttempt", () => {
  it("correct MCQ increments α and n, raises θ, seeds tier difficulty", () => {
    const { mastery, tierD } = applyItemAttempt(undefined, undefined, quiz(true), 0);
    expect(mastery.alpha).toBe(2); // 1 + 1
    expect(mastery.beta).toBe(1);
    expect(mastery.n).toBe(1);
    expect(mastery.theta).toBeGreaterThan(0);
    expect(tierD).toBeLessThan(0.5); // seeded 0.5 (medium) then d += Kd·(P−1) < 0.5
  });

  it("wrong answer increments β and bumps the resolved misconception flag", () => {
    const { mastery } = applyItemAttempt(
      undefined,
      undefined,
      quiz(false, ["probability::_core::idx:1"]),
      0,
    );
    expect(mastery.beta).toBe(2); // 1 + 1
    expect(mastery.theta).toBeLessThan(0);
    expect(mastery.misconceptions["probability::_core::idx:1"]).toBe(1);
  });

  it("a later correct answer decays existing misconception flags", () => {
    const first = applyItemAttempt(
      undefined,
      undefined,
      quiz(false, ["probability::_core::idx:1"]),
      0,
    );
    const second = applyItemAttempt(first.mastery, first.tierD, quiz(true), 1);
    expect(second.mastery.misconceptions["probability::_core::idx:1"]).toBe(0.5);
  });

  it("numeric attempts use the no-guess predicted success (no kOptions)", () => {
    const numeric: ItemAttempt = {
      topicKey: "probability::_core",
      tier: "easy",
      correct: true,
      mode: "numeric",
      chosenValue: 42,
      at: AT,
    };
    const { mastery } = applyItemAttempt(undefined, undefined, numeric, 0);
    // no-guess P(0, -0.5) = σ(0.5) ≈ 0.622; θ += 1·(1 − 0.622) ≈ 0.378
    expect(mastery.theta).toBeCloseTo(1 - 1 / (1 + Math.exp(-0.5)), 6);
  });

  it("does not mutate the input mastery object (purity)", () => {
    const prev: TopicMastery = {
      theta: 0,
      n: 1,
      alpha: 1,
      beta: 1,
      lastSeen: AT,
      misconceptions: { "probability::_core::idx:1": 1 },
    };
    const snapshot = structuredClone(prev);
    applyItemAttempt(prev, 0.5, quiz(true), 1);
    expect(prev).toEqual(snapshot);
  });
});

describe("applyDiagnosticSeed", () => {
  it("sets α = 1 + successes, β = 1 + failures, n = successes + failures", () => {
    const m = applyDiagnosticSeed(undefined, { successes: 3, failures: 2 });
    expect(m.alpha).toBe(4);
    expect(m.beta).toBe(3);
    expect(m.n).toBe(5);
    expect(m.theta).toBe(0);
  });

  it("honors thetaSeed and preserves prior misconceptions", () => {
    const prev: TopicMastery = {
      theta: 0,
      n: 0,
      alpha: 1,
      beta: 1,
      lastSeen: AT,
      misconceptions: { "t::x": 2 },
    };
    const m = applyDiagnosticSeed(prev, {
      successes: 1,
      failures: 0,
      thetaSeed: 1.2,
    });
    expect(m.theta).toBe(1.2);
    expect(m.misconceptions).toEqual({ "t::x": 2 });
  });
});

describe("applyReviewSchedule", () => {
  const DUE = "2026-01-02T00:00:00.000Z";

  it("writes reviewDue/reviewStep onto an existing topic, leaving mastery scalars intact", () => {
    const prev: TopicMastery = {
      theta: 0.7,
      n: 9,
      alpha: 8,
      beta: 3,
      lastSeen: AT,
      misconceptions: { "t::x": 2 },
    };
    const next = applyReviewSchedule(prev, DUE, 2);
    expect(next.reviewDue).toBe(DUE);
    expect(next.reviewStep).toBe(2);
    // Everything else is carried through untouched.
    expect(next.theta).toBe(0.7);
    expect(next.n).toBe(9);
    expect(next.alpha).toBe(8);
    expect(next.beta).toBe(3);
    expect(next.misconceptions).toEqual({ "t::x": 2 });
  });

  it("creates a fresh Beta(1,1) entry when the topic has no mastery yet", () => {
    const next = applyReviewSchedule(undefined, DUE, 0);
    expect(next.reviewDue).toBe(DUE);
    expect(next.reviewStep).toBe(0);
    expect(next.alpha).toBe(1);
    expect(next.beta).toBe(1);
    expect(next.n).toBe(0);
    expect(next.theta).toBe(0);
    expect(next.misconceptions).toEqual({});
  });

  it("does not mutate the input mastery object (purity)", () => {
    const prev: TopicMastery = {
      theta: 0,
      n: 1,
      alpha: 1,
      beta: 1,
      lastSeen: AT,
      misconceptions: {},
    };
    const snapshot = structuredClone(prev);
    applyReviewSchedule(prev, DUE, 3);
    expect(prev).toEqual(snapshot);
  });
});
