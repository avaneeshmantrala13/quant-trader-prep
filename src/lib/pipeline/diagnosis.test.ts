import { describe, expect, it } from "vitest";
import { emptyProgress, type UserProgress } from "@/types/progress";
import type { TopicMastery } from "@/types/mastery";
import {
  COMPETENCY_BRAINTEASER,
  TRADING_SUBTOPIC_KEYS,
  scoredContentTopicKeys,
} from "./gates";
import {
  buildDrillPlan,
  competencyWeaknesses,
  computeDiagnosis,
  contentWeaknesses,
  orderContentDrillTargets,
  timedWeaknesses,
} from "./diagnosis";

/* -- Beta fixtures at various strengths (mirror gates.test.ts) -------------- */

/** CI_low well above 0.80 (mastered). */
function mastered(): TopicMastery {
  return { theta: 2, n: 62, alpha: 60, beta: 2, lastSeen: "t", misconceptions: {} };
}
/** CI_low below 0.80 (not mastered). */
function weak(): TopicMastery {
  return { theta: -0.3, n: 7, alpha: 3, beta: 4, lastSeen: "t", misconceptions: {} };
}
/** CI_low FAR below 0.80 — weaker than {@link weak}. */
function weaker(): TopicMastery {
  return { theta: -1, n: 9, alpha: 1, beta: 8, lastSeen: "t", misconceptions: {} };
}

const EV = "probability::Expected Value";
const CE = "probability::Conditional Expectation";
const COND = "probability::Conditional Probability";

/** Progress with EVERY scored content node + both competencies mastered. */
function allMastered(): UserProgress {
  const p = emptyProgress();
  const tm: Record<string, TopicMastery> = {};
  for (const key of scoredContentTopicKeys()) tm[key] = mastered();
  tm[COMPETENCY_BRAINTEASER] = mastered();
  for (const key of TRADING_SUBTOPIC_KEYS) tm[key] = mastered();
  p.topicMastery = tm;
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

describe("diagnosis — content weaknesses (metric a)", () => {
  it("ranks weakest-first by Beta CI_low and flags mastery at the 0.80 bar", () => {
    const p = emptyProgress();
    p.topicMastery = { [EV]: mastered(), [COND]: weak(), [CE]: weaker() };
    const list = contentWeaknesses(p);
    expect(list).toHaveLength(scoredContentTopicKeys().length);
    // Weakest-first: strengths are non-decreasing.
    for (let i = 1; i < list.length; i++) {
      expect(list[i].strength).toBeGreaterThanOrEqual(list[i - 1].strength);
    }
    // The mastered node is flagged; the weak ones are not.
    expect(list.find((w) => w.key === EV)?.mastered).toBe(true);
    expect(list.find((w) => w.key === COND)?.mastered).toBe(false);
    expect(list.find((w) => w.key === CE)?.mastered).toBe(false);
    // CE (weaker) ranks strictly before COND (weak).
    const idxCE = list.findIndex((w) => w.key === CE);
    const idxCOND = list.findIndex((w) => w.key === COND);
    expect(idxCE).toBeLessThan(idxCOND);
  });
});

describe("diagnosis — timed weaknesses (metric b)", () => {
  it("aggregates pipeline.timed.sections per topic and gates at 0.90", () => {
    const p = emptyProgress();
    p.pipeline = {
      stage: "drilling",
      timed: {
        correct: 0,
        total: 0,
        sections: [
          { label: "EV", correct: 9, total: 10, topicKeys: [EV] }, // 0.90 ⇒ clear
          { label: "Cond", correct: 6, total: 10, topicKeys: [COND] }, // 0.60 ⇒ weak
        ],
      },
    };
    const list = timedWeaknesses(p);
    expect(list.map((w) => w.key)).toEqual([COND, EV]); // weakest-first
    expect(list.find((w) => w.key === EV)?.mastered).toBe(true);
    expect(list.find((w) => w.key === COND)?.mastered).toBe(false);
  });

  it("is empty when there is no timed evidence", () => {
    expect(timedWeaknesses(emptyProgress())).toHaveLength(0);
  });
});

describe("diagnosis — competency weaknesses (metrics c & d)", () => {
  it("decomposes trading into its subtopics + brainteaser, ranked weakest-first", () => {
    const p = emptyProgress();
    const tm: Record<string, TopicMastery> = {
      [COMPETENCY_BRAINTEASER]: mastered(),
    };
    for (const key of TRADING_SUBTOPIC_KEYS) tm[key] = mastered();
    // One weak trading subtopic — it must rank first (weakest).
    tm[TRADING_SUBTOPIC_KEYS[0]] = weak();
    p.topicMastery = tm;

    const list = competencyWeaknesses(p);
    // One entry per trading subtopic PLUS the brainteaser competency.
    expect(list).toHaveLength(TRADING_SUBTOPIC_KEYS.length + 1);
    expect(
      list.filter((w) => w.metric === "trading"),
    ).toHaveLength(TRADING_SUBTOPIC_KEYS.length);
    // Weakest-first: the one weak subtopic leads, and it is not mastered.
    expect(list[0].metric).toBe("trading");
    expect(list[0].mastered).toBe(false);
    expect(list.find((w) => w.metric === "brainteaser")?.mastered).toBe(true);
  });
});

describe("diagnosis — combined ranking across all four metrics", () => {
  it("interleaves content, timed, and competency entries weakest-first", () => {
    const p = emptyProgress();
    p.topicMastery = { [EV]: weak(), [TRADING_SUBTOPIC_KEYS[0]]: weaker() };
    p.pipeline = {
      stage: "drilling",
      timed: {
        correct: 0,
        total: 0,
        sections: [{ label: "EV", correct: 5, total: 10, topicKeys: [EV] }],
      },
    };
    const d = computeDiagnosis(p);
    const metrics = new Set(d.ranked.map((w) => w.metric));
    expect(metrics.has("content")).toBe(true);
    expect(metrics.has("timed")).toBe(true);
    expect(metrics.has("trading")).toBe(true);
    // Globally weakest-first.
    for (let i = 1; i < d.ranked.length; i++) {
      expect(d.ranked[i].strength).toBeGreaterThanOrEqual(d.ranked[i - 1].strength);
    }
  });
});

describe("diagnosis — drill plan (weakest-first, prerequisite-respecting)", () => {
  it("never queues a node before an in-plan prerequisite even if it is weaker", () => {
    // All mastered EXCEPT EV (weak) and CE (weaker). CE depends on EV, so even
    // though CE is strictly weaker, EV MUST be drilled first.
    const p = allMastered();
    p.topicMastery![EV] = weak();
    p.topicMastery![CE] = weaker();
    const plan = buildDrillPlan(p);
    const keys = plan.map((e) => e.key);
    expect(keys).toContain(EV);
    expect(keys).toContain(CE);
    expect(keys.indexOf(EV)).toBeLessThan(keys.indexOf(CE));
    expect(plan.every((e) => e.metric === "content")).toBe(true);
  });

  it("appends unmastered competencies and timed-weak topics after content", () => {
    const p = allMastered();
    p.topicMastery![EV] = weak(); // one content node open
    p.topicMastery![TRADING_SUBTOPIC_KEYS[0]] = weak(); // one trading subtopic open
    // Make the timed overlay weak on a DIFFERENT (content-mastered) topic.
    p.pipeline!.timed = {
      correct: 0,
      total: 0,
      sections: [{ label: "Cond", correct: 5, total: 10, topicKeys: [COND] }],
    };
    const plan = buildDrillPlan(p);
    const metricsInOrder = plan.map((e) => e.metric);
    // Content first, then competency, then the timed-weak overlay.
    expect(metricsInOrder[0]).toBe("content");
    expect(metricsInOrder).toContain("trading");
    expect(metricsInOrder).toContain("timed");
    expect(metricsInOrder.indexOf("content")).toBeLessThan(
      metricsInOrder.indexOf("trading"),
    );
    expect(metricsInOrder.indexOf("trading")).toBeLessThan(
      metricsInOrder.indexOf("timed"),
    );
  });

  it("is empty and cleared when everything already clears its bar", () => {
    const d = computeDiagnosis(allMastered());
    expect(d.plan).toHaveLength(0);
    expect(d.cleared).toBe(true);
  });

  it("orderContentDrillTargets degrades to weakest-first when no prereqs apply", () => {
    // Two independent foundation nodes (no prereqs): pure weakest-first.
    const a = { key: "mental-math::_core", label: "a", metric: "content" as const, strength: 0.4, mastered: false, mean: 0.4, lo: 0.4, n: 3 };
    const b = { key: "math-questions::Rates, Algebra & Word Problems", label: "b", metric: "content" as const, strength: 0.1, mastered: false, mean: 0.1, lo: 0.1, n: 3 };
    const ordered = orderContentDrillTargets([b, a]);
    expect(ordered.map((w) => w.key)).toEqual([b.key, a.key]);
  });
});
