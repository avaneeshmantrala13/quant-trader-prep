import { describe, expect, it } from "vitest";
import { emptyProgress, type UserProgress } from "@/types/progress";
import type { TopicMastery } from "@/types/mastery";
import {
  COMPETENCY_BRAINTEASER,
  MOCK_CONSECUTIVE,
  MOCK_GATE_PCT,
  TIMED_GATE,
  TRADING_SUBTOPIC_KEYS,
  allContentNodesMastered,
  allTimedSectionsClear,
  brainteaserReasoningMastered,
  nodeContentMastered,
  passesDrillingGate,
  passesMockGate,
  scoredContentTopicKeys,
  timedSectionMeetsGate,
  tradingIntuitionMastered,
} from "./gates";

/** A TopicMastery whose Beta CI_low sits well above the 0.80 bar (mastered). */
function mastered(): TopicMastery {
  return {
    theta: 2,
    n: 62,
    alpha: 60,
    beta: 2,
    lastSeen: "2026-01-01T00:00:00.000Z",
    misconceptions: {},
  };
}

/** A weak TopicMastery whose CI_low is far below the 0.80 bar (not mastered). */
function weak(): TopicMastery {
  return {
    theta: -0.5,
    n: 5,
    alpha: 2,
    beta: 4,
    lastSeen: "2026-01-01T00:00:00.000Z",
    misconceptions: {},
  };
}

/** Master every trading-intuition subtopic (the aggregate gate rolls these up). */
function masterAllTradingSubtopics(tm: Record<string, TopicMastery>): void {
  for (const key of TRADING_SUBTOPIC_KEYS) tm[key] = mastered();
}

/** Progress with EVERY scored content node + BOTH competency nodes mastered. */
function allMastered(): UserProgress {
  const p = emptyProgress();
  const tm: Record<string, TopicMastery> = {};
  for (const key of scoredContentTopicKeys()) tm[key] = mastered();
  tm[COMPETENCY_BRAINTEASER] = mastered();
  masterAllTradingSubtopics(tm);
  p.topicMastery = tm;
  return p;
}

describe("gates — scored content node set (spec §3.1)", () => {
  it("excludes external stubs, brainteaser nodes, and the 5 academic course-completeness topics (21 scored nodes)", () => {
    const keys = scoredContentTopicKeys();
    expect(keys).toHaveLength(21);
    expect(keys.some((k) => k.startsWith("brainteasers::"))).toBe(false);
    expect(keys).not.toContain("fermi::_core");
    expect(keys).not.toContain("arena::_core");
    // The 5 purely-academic topics (scored:false) are excluded from the gate.
    expect(keys).not.toContain("probability::Moment Generating Functions");
    expect(keys).not.toContain("probability::Gamma Distribution");
    expect(keys).not.toContain("probability::Joint Distributions");
    expect(keys).not.toContain("probability::Limit Theorems");
    expect(keys).not.toContain("probability::Continuous-Time Markov Chains");
    // A couple of real scored nodes ARE present.
    expect(keys).toContain("probability::Expected Value");
    expect(keys).toContain("mental-math::_core");
    // Quant-relevant advanced topics that STAY scored.
    expect(keys).toContain("probability::Branching Processes");
    expect(keys).toContain("probability::Markov Chain Structure");
  });
});

describe("gates — content mastery (0.80 bar)", () => {
  it("nodeContentMastered is true only when the Beta CI_low clears 0.80", () => {
    const p = emptyProgress();
    p.topicMastery = {
      "probability::Expected Value": mastered(),
      "probability::Core Probability": weak(),
    };
    expect(nodeContentMastered(p, "probability::Expected Value")).toBe(true);
    expect(nodeContentMastered(p, "probability::Core Probability")).toBe(false);
    // Absent bucket ⇒ n=0 ⇒ wide prior CI ⇒ not mastered.
    expect(nodeContentMastered(p, "probability::Markov Chains")).toBe(false);
  });

  it("allContentNodesMastered flips to false when a single node relocks", () => {
    const p = allMastered();
    expect(allContentNodesMastered(p)).toBe(true);
    // Relock one node below the bar (Beta decayed): the gate must fail again.
    p.topicMastery!["probability::Expected Value"] = weak();
    expect(allContentNodesMastered(p)).toBe(false);
  });
});

describe("gates — timed sections (0.90 bar, distinct from 0.80)", () => {
  it("uses the 0.90 threshold, not the 0.80 content bar", () => {
    expect(TIMED_GATE).toBe(0.9);
    // 9/10 = 0.90 exactly ⇒ passes; 8/10 = 0.80 ⇒ fails the timed gate even
    // though 0.80 WOULD clear the content bar.
    expect(timedSectionMeetsGate({ correct: 9, total: 10 })).toBe(true);
    expect(timedSectionMeetsGate({ correct: 8, total: 10 })).toBe(false);
    // A section at 0.85 clears content (0.80) but NOT timed (0.90).
    expect(timedSectionMeetsGate({ correct: 17, total: 20 })).toBe(false);
  });

  it("allTimedSectionsClear requires evidence AND every section ≥ 0.90", () => {
    const p = emptyProgress();
    // No timed evidence ⇒ not cleared.
    expect(allTimedSectionsClear(p)).toBe(false);
    p.pipeline = {
      stage: "drilling",
      timed: {
        correct: 27,
        total: 30,
        sections: [
          { label: "a", correct: 9, total: 10 },
          { label: "b", correct: 10, total: 10 },
        ],
      },
    };
    expect(allTimedSectionsClear(p)).toBe(true);
    // One sub-0.90 section drops the whole gate.
    p.pipeline.timed!.sections.push({ label: "c", correct: 8, total: 10 });
    expect(allTimedSectionsClear(p)).toBe(false);
  });
});

describe("gates — competency nodes (0.80 bar, P2 stubs)", () => {
  it("are not mastered without evidence, and mastered when their bucket clears", () => {
    const p = emptyProgress();
    expect(brainteaserReasoningMastered(p)).toBe(false);
    expect(tradingIntuitionMastered(p)).toBe(false);
    const tm: Record<string, TopicMastery> = {
      [COMPETENCY_BRAINTEASER]: mastered(),
    };
    masterAllTradingSubtopics(tm);
    p.topicMastery = tm;
    expect(brainteaserReasoningMastered(p)).toBe(true);
    expect(tradingIntuitionMastered(p)).toBe(true);
  });
});

describe("gates — Stage-6 aggregate (all content + timed + competencies)", () => {
  function fullyCleared(): UserProgress {
    const p = allMastered();
    p.pipeline = {
      stage: "drilling",
      timed: {
        correct: 28,
        total: 30,
        sections: [{ label: "timed-diagnostic", correct: 28, total: 30 }],
      },
    };
    return p;
  }

  it("passes only when ALL four sub-gates hold", () => {
    expect(passesDrillingGate(fullyCleared())).toBe(true);
  });

  it("fails if a content node relocks (un-clears drilling → un-greenlight)", () => {
    const p = fullyCleared();
    p.topicMastery!["mental-math::_core"] = weak();
    expect(passesDrillingGate(p)).toBe(false);
  });

  it("fails if the timed overlay is missing or below 0.90", () => {
    const p = fullyCleared();
    p.pipeline!.timed = undefined;
    expect(passesDrillingGate(p)).toBe(false);
  });

  it("fails if either competency node is not mastered", () => {
    const p = fullyCleared();
    // A single weak trading SUBTOPIC drops the rolled-up trading gate.
    p.topicMastery![TRADING_SUBTOPIC_KEYS[0]] = weak();
    expect(passesDrillingGate(p)).toBe(false);
  });
});

describe("gates — mock stage (≥90% on 3 consecutive, §10.4)", () => {
  it("exposes the resolved-decision constants", () => {
    expect(MOCK_GATE_PCT).toBe(90);
    expect(MOCK_CONSECUTIVE).toBe(3);
  });

  it("requires at least 3 mocks", () => {
    const p = emptyProgress();
    p.pipeline = {
      stage: "mock",
      mocks: [
        { at: "2026-01-01", scorePct: 95, wouldPass: "yes" },
        { at: "2026-01-02", scorePct: 95, wouldPass: "yes" },
      ],
    };
    expect(passesMockGate(p)).toBe(false);
  });

  it("passes when the last 3 mocks are ≥90% and not 'no'", () => {
    const p = emptyProgress();
    p.pipeline = {
      stage: "mock",
      mocks: [
        { at: "2026-01-01", scorePct: 90, wouldPass: "borderline" },
        { at: "2026-01-02", scorePct: 92, wouldPass: "yes" },
        { at: "2026-01-03", scorePct: 99, wouldPass: "yes" },
      ],
    };
    expect(passesMockGate(p)).toBe(true);
  });

  it("fails if any of the last 3 is below 90% or a 'no' verdict", () => {
    const belowBar = emptyProgress();
    belowBar.pipeline = {
      stage: "mock",
      mocks: [
        { at: "2026-01-01", scorePct: 95, wouldPass: "yes" },
        { at: "2026-01-02", scorePct: 89, wouldPass: "yes" },
        { at: "2026-01-03", scorePct: 95, wouldPass: "yes" },
      ],
    };
    expect(passesMockGate(belowBar)).toBe(false);

    const verdictNo = emptyProgress();
    verdictNo.pipeline = {
      stage: "mock",
      mocks: [
        { at: "2026-01-01", scorePct: 95, wouldPass: "yes" },
        { at: "2026-01-02", scorePct: 95, wouldPass: "yes" },
        { at: "2026-01-03", scorePct: 95, wouldPass: "no" },
      ],
    };
    expect(passesMockGate(verdictNo)).toBe(false);
  });

  it("only the MOST RECENT 3 matter (an early failure before a clean streak is fine)", () => {
    const p = emptyProgress();
    p.pipeline = {
      stage: "mock",
      mocks: [
        { at: "2026-01-01", scorePct: 40, wouldPass: "no" },
        { at: "2026-01-02", scorePct: 91, wouldPass: "yes" },
        { at: "2026-01-03", scorePct: 93, wouldPass: "yes" },
        { at: "2026-01-04", scorePct: 97, wouldPass: "yes" },
      ],
    };
    expect(passesMockGate(p)).toBe(true);
  });

  it("back-compat: an ABSENT reasoningOk (historical logs) is treated as OK", () => {
    const p = emptyProgress();
    p.pipeline = {
      stage: "mock",
      mocks: [
        { at: "2026-01-01", scorePct: 95, wouldPass: "yes" },
        { at: "2026-01-02", scorePct: 95, wouldPass: "borderline" },
        { at: "2026-01-03", scorePct: 95, wouldPass: "yes" },
      ],
    };
    expect(passesMockGate(p)).toBe(true);
  });
});

describe("gates — mock stage requires REASONING QUALITY (greenlight gate)", () => {
  it("right ANSWERS but POOR reasoning (reasoningOk:false) does NOT satisfy the gate", () => {
    const p = emptyProgress();
    // Every mock clears the 90% score bar with a non-"no" verdict, but one has
    // correct answers backed by poor reasoning → must NOT greenlight.
    p.pipeline = {
      stage: "mock",
      mocks: [
        { at: "2026-01-01", scorePct: 100, wouldPass: "yes", reasoningOk: true },
        { at: "2026-01-02", scorePct: 100, wouldPass: "yes", reasoningOk: true },
        {
          at: "2026-01-03",
          scorePct: 100,
          wouldPass: "borderline",
          reasoningOk: false,
        },
      ],
    };
    expect(passesMockGate(p)).toBe(false);
  });

  it("SOUND reasoning (reasoningOk:true) on 3 clean mocks DOES satisfy the gate", () => {
    const p = emptyProgress();
    p.pipeline = {
      stage: "mock",
      mocks: [
        { at: "2026-01-01", scorePct: 92, wouldPass: "yes", reasoningOk: true },
        { at: "2026-01-02", scorePct: 95, wouldPass: "yes", reasoningOk: true },
        { at: "2026-01-03", scorePct: 99, wouldPass: "yes", reasoningOk: true },
      ],
    };
    expect(passesMockGate(p)).toBe(true);
  });

  it("a poor-reasoning mock breaks an otherwise-clean streak (must re-earn it)", () => {
    const p = emptyProgress();
    p.pipeline = {
      stage: "mock",
      mocks: [
        { at: "2026-01-01", scorePct: 95, wouldPass: "yes", reasoningOk: true },
        // poor reasoning in the MIDDLE of the recent 3 → gate fails
        { at: "2026-01-02", scorePct: 95, wouldPass: "yes", reasoningOk: false },
        { at: "2026-01-03", scorePct: 95, wouldPass: "yes", reasoningOk: true },
      ],
    };
    expect(passesMockGate(p)).toBe(false);
  });
});
