import { describe, expect, it } from "vitest";
import { emptyProgress, type UserProgress } from "@/types/progress";
import type { TopicMastery } from "@/types/mastery";
import { applyItemAttempt } from "@/lib/mastery/mastery";
import {
  COMPETENCY_BRAINTEASER,
  TRADING_SUBTOPIC_KEYS,
  passesDrillingGate,
  scoredContentTopicKeys,
} from "./gates";
import {
  buildContentDrillAttempt,
  drawBrainteaserDrill,
  drawContentDrill,
  drillingProgress,
  pickNextDrillTarget,
  DRILL_ROUND_SIZE,
} from "./drilling";

const EV = "probability::Expected Value";
const COND = "probability::Conditional Probability";

function mastered(): TopicMastery {
  return { theta: 2, n: 62, alpha: 60, beta: 2, lastSeen: "t", misconceptions: {} };
}
function weak(): TopicMastery {
  return { theta: -1, n: 6, alpha: 1, beta: 6, lastSeen: "t", misconceptions: {} };
}

/** Content + both competencies mastered, one cleared timed section. */
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
      sections: [{ label: "timed", correct: 28, total: 30 }],
    },
  };
  return p;
}

describe("drilling — next-target selection (weakest-first)", () => {
  it("targets an unmastered content node via the numeric hint-ladder path", () => {
    const t = pickNextDrillTarget(emptyProgress());
    expect(t).not.toBeNull();
    expect(t!.kind).toBe("content");
    expect(t!.serve).toBe("numeric");
    expect(t!.topicKey).not.toBeNull();
    expect(scoredContentTopicKeys()).toContain(t!.topicKey);
  });

  it("returns null EXACTLY when the whole drilling gate holds", () => {
    const p = allMastered();
    expect(passesDrillingGate(p)).toBe(true);
    expect(pickNextDrillTarget(p)).toBeNull();
    expect(drillingProgress(p).done).toBe(true);
  });

  it("routes the brainteaser competency once content + timed + trading clear", () => {
    const p = allMastered();
    p.topicMastery![COMPETENCY_BRAINTEASER] = weak();
    const t = pickNextDrillTarget(p);
    expect(t?.kind).toBe("brainteaser");
    expect(t?.serve).toBe("brainteaser");
    expect(t?.topicKey).toBe(COMPETENCY_BRAINTEASER);
  });

  it("routes the weak trading SUBTOPIC (by its own key) when it is the only thing left", () => {
    const p = allMastered();
    const weakKey = TRADING_SUBTOPIC_KEYS[0];
    p.topicMastery![weakKey] = weak();
    const t = pickNextDrillTarget(p);
    expect(t?.kind).toBe("trading");
    expect(t?.serve).toBe("trading");
    // The target is the SPECIFIC subtopic node, so drilling re-mounts its game.
    expect(t?.topicKey).toBe(weakKey);
  });

  it("re-drills a content-mastered but timed-weak topic via the numeric path", () => {
    const p = allMastered();
    p.pipeline!.timed = {
      correct: 0,
      total: 0,
      sections: [{ label: "Cond", correct: 5, total: 10, topicKeys: [COND] }],
    };
    const t = pickNextDrillTarget(p);
    expect(t?.kind).toBe("timed");
    expect(t?.serve).toBe("numeric");
    expect(t?.topicKey).toBe(COND);
  });

  it("surfaces a residual timed-info signal when the overlay is owed but unrouted", () => {
    const p = allMastered();
    p.pipeline!.timed = { correct: 0, total: 0, sections: [] };
    expect(passesDrillingGate(p)).toBe(false);
    const t = pickNextDrillTarget(p);
    expect(t?.kind).toBe("timed");
    expect(t?.serve).toBe("timed-info");
    expect(t?.topicKey).toBeNull();
  });
});

describe("drilling — item drawing reuses the untimed bank", () => {
  it("draws a full deterministic numeric round for a content topic", () => {
    const a = drawContentDrill(EV, 999);
    const b = drawContentDrill(EV, 999);
    expect(a).toHaveLength(DRILL_ROUND_SIZE);
    expect(a.every((it) => it.kind === "numeric")).toBe(true);
    expect(a.every((it) => it.topicKey === EV)).toBe(true);
    // Deterministic given the seed.
    expect(a.map((it) => it.question.answer)).toEqual(
      b.map((it) => it.question.answer),
    );
  });

  it("draws a full brainteaser round for the reasoning competency", () => {
    const items = drawBrainteaserDrill(7);
    expect(items).toHaveLength(DRILL_ROUND_SIZE);
    expect(items.every((it) => it.kind === "brainteaser")).toBe(true);
  });
});

describe("drilling — hint usage reduces mastery credit", () => {
  it("gives a hinted correct answer strictly less credit than an unhinted one", () => {
    const item = drawContentDrill(EV, 123, 1)[0];
    const unhinted = buildContentDrillAttempt(item, {
      correct: true,
      highestRung: 0,
      finalValue: item.question.answer,
    });
    const hinted = buildContentDrillAttempt(item, {
      correct: true,
      highestRung: 2,
      finalValue: item.question.answer,
    });
    expect(unhinted.credit).toBe(1);
    expect(hinted.credit).toBeCloseTo(0.45, 5);
    expect(hinted.credit!).toBeLessThan(unhinted.credit!);
  });

  it("folds less mastery for a hinted solve through the shared Beta path", () => {
    const item = drawContentDrill(EV, 321, 1)[0];
    const unhinted = buildContentDrillAttempt(item, {
      correct: true,
      highestRung: 0,
      finalValue: item.question.answer,
    });
    const hinted = buildContentDrillAttempt(item, {
      correct: true,
      highestRung: 3,
      finalValue: item.question.answer,
    });
    const mUnhinted = applyItemAttempt(undefined, undefined, unhinted, 0).mastery;
    const mHinted = applyItemAttempt(undefined, undefined, hinted, 0).mastery;
    // More credit ⇒ a larger positive Beta pseudo-count on the success side.
    expect(mUnhinted.alpha).toBeGreaterThan(mHinted.alpha);
  });
});
