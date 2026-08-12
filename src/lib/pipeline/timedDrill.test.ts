import { describe, expect, it } from "vitest";
import { emptyProgress, type UserProgress } from "@/types/progress";
import type { TopicMastery } from "@/types/mastery";
import { topicKeyOf } from "@/lib/mastery/topicKey";
import {
  COMPETENCY_BRAINTEASER,
  TRADING_SUBTOPIC_KEYS,
  allTimedSectionsClear,
  passesDrillingGate,
  scoredContentTopicKeys,
} from "./gates";
import { pickNextDrillTarget } from "./drilling";
import { resolveStage } from "./stateMachine";
import {
  buildTimedDrillSection,
  mergeTimedSection,
  sectionIsSingleTopicFor,
} from "./timedDrill";

const COND = "probability::Conditional Probability";
const EV = "probability::Expected Value";
const RATES = topicKeyOf("math-questions", "Rates, Algebra & Word Problems");

function mastered(): TopicMastery {
  return { theta: 2, n: 62, alpha: 60, beta: 2, lastSeen: "t", misconceptions: {} };
}

/**
 * A "good untimed / bad timed" learner sitting in the drilling stage: EVERY
 * scored content node + both competencies are mastered, all onboarding stamps
 * are set, but one recorded timed section (`COND`) is below the 0.90 bar.
 */
function goodUntimedBadTimed(): UserProgress {
  const p = emptyProgress();
  const tm: Record<string, TopicMastery> = {};
  for (const key of scoredContentTopicKeys()) tm[key] = mastered();
  tm[COMPETENCY_BRAINTEASER] = mastered();
  for (const key of TRADING_SUBTOPIC_KEYS) tm[key] = mastered();
  p.topicMastery = tm;
  p.pipeline = {
    stage: "drilling",
    untimedDoneAt: "t1",
    timedDoneAt: "t2",
    gameOaDoneAt: "t3",
    diagnosisComputedAt: "t4",
    timed: {
      correct: 5,
      total: 10,
      sections: [{ label: "Cond", correct: 5, total: 10, topicKeys: [COND] }],
    },
  };
  return p;
}

describe("timed drill — the good-untimed/bad-timed stall is broken", () => {
  it("(a) the timed-weak topic is served as a SHOT-CLOCKED timed drill, not numeric", () => {
    const p = goodUntimedBadTimed();
    expect(passesDrillingGate(p)).toBe(false);
    const t = pickNextDrillTarget(p);
    expect(t?.kind).toBe("timed");
    expect(t?.serve).toBe("timed-drill");
    expect(t?.topicKey).toBe(COND);
  });

  it("(b) a passing timed retake clears the gate and resolves the stage to mock", () => {
    const p = goodUntimedBadTimed();
    expect(resolveStage(p)).toBe("drilling");

    // A fast, accurate shot-clocked retake of the weak topic (5/5 = 100%).
    p.pipeline!.timed = mergeTimedSection(
      p.pipeline!.timed,
      buildTimedDrillSection(COND, 5, 5, "t5"),
    );

    expect(allTimedSectionsClear(p)).toBe(true);
    expect(passesDrillingGate(p)).toBe(true);
    // The loop is done — no next target — and the router advances to mock.
    expect(pickNextDrillTarget(p)).toBeNull();
    expect(resolveStage(p)).toBe("mock");
  });

  it("(c) a FAILING timed retake keeps the learner in drilling", () => {
    const p = goodUntimedBadTimed();
    // 4/5 = 0.80 < 0.90 — still under the timed bar.
    p.pipeline!.timed = mergeTimedSection(
      p.pipeline!.timed,
      buildTimedDrillSection(COND, 4, 5, "t5"),
    );
    expect(allTimedSectionsClear(p)).toBe(false);
    expect(passesDrillingGate(p)).toBe(false);
    expect(resolveStage(p)).toBe("drilling");
    // Still routed back to the same topic as a timed drill.
    const t = pickNextDrillTarget(p);
    expect(t?.serve).toBe("timed-drill");
    expect(t?.topicKey).toBe(COND);
  });
});

describe("mergeTimedSection — supersedes the topic's failing section (no double-count)", () => {
  it("replaces the prior single-topic section for the same topicKey", () => {
    const prior = {
      correct: 12,
      total: 20,
      sections: [
        { label: "EV", correct: 9, total: 10, topicKeys: [EV] },
        { label: "Cond", correct: 3, total: 10, topicKeys: [COND] },
      ],
    };
    const merged = mergeTimedSection(prior, buildTimedDrillSection(COND, 5, 5, "t"));
    // Only ONE section per topic remains — the failing Cond entry is gone.
    const condSections = merged.sections.filter((s) =>
      sectionIsSingleTopicFor(s, COND),
    );
    expect(condSections).toHaveLength(1);
    expect(condSections[0]).toMatchObject({ correct: 5, total: 5 });
    // Totals recomputed across the superseded set (9/10 + 5/5).
    expect(merged.total).toBe(15);
    expect(merged.correct).toBe(14);
    // The other topic's section is untouched.
    expect(merged.sections.some((s) => sectionIsSingleTopicFor(s, EV))).toBe(true);
  });

  it("preserves no-timed-evidence ⇒ not cleared semantics (empty prior ⇒ single section)", () => {
    const merged = mergeTimedSection(undefined, buildTimedDrillSection(RATES, 4, 5, "t"));
    expect(merged.sections).toHaveLength(1);
    expect(merged.sections[0].topicKeys).toEqual([RATES]);
    expect(merged.total).toBe(5);
  });

  it("does NOT supersede a multi-topic section (keeps other topics' evidence)", () => {
    const prior = {
      correct: 6,
      total: 10,
      sections: [
        { label: "combo", correct: 6, total: 10, topicKeys: [COND, EV] },
      ],
    };
    const merged = mergeTimedSection(prior, buildTimedDrillSection(COND, 5, 5, "t"));
    // The multi-topic section survives; the retake is added alongside it.
    expect(merged.sections).toHaveLength(2);
    expect(
      merged.sections.some((s) => (s.topicKeys?.length ?? 0) === 2),
    ).toBe(true);
  });
});
