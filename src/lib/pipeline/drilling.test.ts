import { describe, expect, it } from "vitest";
import { emptyProgress, type UserProgress } from "@/types/progress";
import type { TopicMastery } from "@/types/mastery";
import { applyItemAttempt } from "@/lib/mastery/mastery";
import { Rng } from "@/lib/rng";
import { topicKeyOf } from "@/lib/mastery/topicKey";
import { gradeFreeResponse } from "@/lib/numeric";
import { genCombinedRatesTogether } from "@/content/diagnostic/floorGenerators";
import {
  COMPETENCY_BRAINTEASER,
  TRADING_SUBTOPIC_KEYS,
  passesDrillingGate,
  scoredContentTopicKeys,
} from "./gates";
import {
  brainteaserSignature,
  buildContentDrillAttempt,
  contentSignature,
  drawBrainteaserDrill,
  drawContentDrill,
  drillingProgress,
  drillPlanTargets,
  pickNextDrillTarget,
  DRILL_ROUND_SIZE,
} from "./drilling";

const EV = "probability::Expected Value";
const COND = "probability::Conditional Probability";
const RATES = topicKeyOf("math-questions", "Rates, Algebra & Word Problems");

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

  it("re-drills a content-mastered but timed-weak topic via the SHOT-CLOCKED timed path", () => {
    const p = allMastered();
    p.pipeline!.timed = {
      correct: 0,
      total: 0,
      sections: [{ label: "Cond", correct: 5, total: 10, topicKeys: [COND] }],
    };
    const t = pickNextDrillTarget(p);
    expect(t?.kind).toBe("timed");
    // A timed-weak topic is now practiced UNDER A CLOCK (not the untimed numeric
    // hint-ladder), so succeeding rewrites `pipeline.timed` and can clear 0.90.
    expect(t?.serve).toBe("timed-drill");
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

describe("drilling — session dedup guarantees no exact-duplicate question", () => {
  it("a multi-round rates/work drill session yields N items with N DISTINCT signatures", () => {
    // Thread the session-wide seen set exactly as DrillingStage does.
    const seen = new Set<string>();
    let total = 0;
    for (let round = 0; round < 8; round++) {
      const items = drawContentDrill(RATES, 1000 + round, DRILL_ROUND_SIZE, seen);
      for (const it of items) {
        const sig = contentSignature(it);
        // The identical rendered problem must NEVER be re-served in a session.
        expect(seen.has(sig), `repeat: ${it.question.prompt}`).toBe(false);
        seen.add(sig);
        total++;
      }
    }
    // The parametric rates family fills every slot (infinite bank feel)...
    expect(total).toBe(8 * DRILL_ROUND_SIZE);
    // ...and every served item is a distinct content signature.
    expect(seen.size).toBe(total);
  });

  it("has NO exact-duplicate within a single round (the reported ~2-question repeat)", () => {
    for (const seed of [1, 42, 777, 20240808]) {
      const items = drawContentDrill(RATES, seed, DRILL_ROUND_SIZE);
      const sigs = items.map(contentSignature);
      expect(new Set(sigs).size).toBe(sigs.length);
      expect(items.length).toBe(DRILL_ROUND_SIZE);
    }
  });

  it("the dedup helper REJECTS colliding draws (the avoid set is honored)", () => {
    const first = drawContentDrill(RATES, 7, DRILL_ROUND_SIZE);
    const avoid = new Set(first.map(contentSignature));
    // Same seed would otherwise reproduce `first`; `avoid` forces novel numbers.
    const second = drawContentDrill(RATES, 7, DRILL_ROUND_SIZE, avoid);
    expect(second.length).toBe(DRILL_ROUND_SIZE);
    for (const it of second) {
      expect(avoid.has(contentSignature(it))).toBe(false);
    }
  });

  it("brainteaser rounds are all-distinct within and across a session", () => {
    const seen = new Set<string>();
    for (let round = 0; round < 4; round++) {
      const items = drawBrainteaserDrill(500 + round, DRILL_ROUND_SIZE, seen);
      for (const it of items) {
        const sig = brainteaserSignature(it);
        expect(seen.has(sig)).toBe(false);
        seen.add(sig);
      }
    }
    expect(seen.size).toBe(4 * DRILL_ROUND_SIZE);
  });
});

describe("drilling — the combined-rates floor generator varies (real entropy, exact)", () => {
  it("produces many distinct instances across seeds (not one fixed problem)", () => {
    const sigs = new Set<string>();
    for (let s = 1; s <= 60; s++) {
      const q = genCombinedRatesTogether(new Rng(s));
      sigs.add(`${q.prompt}\u0001${q.answer}`);
    }
    expect(sigs.size).toBeGreaterThan(25);
  });

  it("is exact — combined time = ta·tb/(ta+tb) and a correct entry grades correct", () => {
    for (let s = 1; s <= 40; s++) {
      const q = genCombinedRatesTogether(new Rng(s));
      const typed =
        q.decimals != null ? q.answer.toFixed(q.decimals) : String(q.answer);
      expect(gradeFreeResponse(q, typed).correct, q.id).toBe(true);
      // The two classic traps are present and distinct from the answer.
      const errorValues = (q.commonErrors ?? []).map((e) => e.value);
      expect(errorValues.length).toBe(2);
      for (const v of errorValues) expect(v).not.toBe(q.answer);
    }
  });
});

/**
 * The ~12 content families that previously carried ONLY two static authored
 * items and no generator — the exact set that dead-ended `drawContentDrill` and
 * froze the loop (V1). Each now has a parametric floor generator, so the bank is
 * effectively infinite.
 */
const PREVIOUSLY_STATIC_STALL_TOPICS = [
  topicKeyOf("probability", "Core Probability"),
  topicKeyOf("probability", "Combinatorial Analysis"),
  topicKeyOf("math-questions", "Number Theory & Counting"),
  topicKeyOf("probability", "Continuous Distributions"),
  topicKeyOf("probability", "Poisson Distribution & Process"),
  topicKeyOf("probability", "Geometric Probability"),
  topicKeyOf("math-questions", "Geometry & Derivations"),
  topicKeyOf("probability", "Variance, Covariance & the CLT"),
  topicKeyOf("probability", "Brownian Motion"),
  topicKeyOf("probability", "Game Theory & Puzzles"),
  topicKeyOf("probability", "Branching Processes"),
  topicKeyOf("probability", "Markov Chain Structure"),
];

describe("drilling — the loop can NEVER hard-stall (V1 fix)", () => {
  it("every previously-static stall topic now fills full early rounds with NOVEL items (was 2-static)", () => {
    // The old bank was TWO static items: round 0 could not even fill, and round
    // 1 returned []. Every family now has a parametric generator, so the first
    // rounds fill completely with distinct signatures and no exact-duplicate is
    // ever re-served — a real bank, not a 2-item dead end.
    for (const topic of PREVIOUSLY_STATIC_STALL_TOPICS) {
      const seen = new Set<string>();
      let distinct = 0;
      for (let round = 0; round < 8; round++) {
        const items = drawContentDrill(topic, 5000 + round, DRILL_ROUND_SIZE, seen);
        // Round 0 ALWAYS fills a full round — the old 2-static bank could not.
        if (round === 0) {
          expect(items.length, `${topic} short round 0`).toBe(DRILL_ROUND_SIZE);
        }
        for (const it of items) {
          const sig = contentSignature(it);
          expect(seen.has(sig), `${topic} repeated: ${it.question.prompt}`).toBe(false);
          seen.add(sig);
          distinct++;
        }
      }
      // A genuinely varied bank (≥ 10 distinct) for every previously-2-static
      // family — an order of magnitude past the old 2 items. True exhaustion of a
      // finite family is handled by the stage's round-robin backstop (below),
      // never by a dead-end panel.
      expect(distinct, `${topic} bank too small`).toBeGreaterThanOrEqual(10);
    }
  });

  it("drillPlanTargets is non-empty whenever the gate is open, and empty exactly when it holds", () => {
    expect(drillPlanTargets(emptyProgress()).length).toBeGreaterThan(0);
    expect(drillPlanTargets(allMastered())).toEqual([]);
  });

  it("drillPlanTargets always ends with a servable residual, so start-next-round never dead-ends", () => {
    // Simulate the stage's walk: the FIRST servable target is chosen. Even in the
    // degenerate all-content-mastered-but-timed-owed state, the list ends in a
    // timed-info target the panel can Continue past.
    const p = allMastered();
    p.pipeline!.timed = { correct: 0, total: 0, sections: [] };
    const targets = drillPlanTargets(p);
    expect(targets.length).toBeGreaterThan(0);
    const last = targets[targets.length - 1];
    expect(last.serve).toBe("timed-info");
    // Walk exactly as DrillingStage.startNextRound does: numeric targets that
    // draw a non-empty round win; otherwise fall through to the residual.
    let servable: (typeof targets)[number] | null = null;
    for (const t of targets) {
      if (t.serve === "numeric" && t.topicKey) {
        if (drawContentDrill(t.topicKey, 1, DRILL_ROUND_SIZE).length > 0) {
          servable = t;
          break;
        }
        continue;
      }
      servable = t; // brainteaser / trading / timed-info are always servable
      break;
    }
    expect(servable).not.toBeNull();
  });

  it("weakest-first content targets each draw a full non-empty round (round-robin never needed but always safe)", () => {
    const targets = drillPlanTargets(emptyProgress());
    const numeric = targets.filter((t) => t.serve === "numeric" && t.topicKey);
    expect(numeric.length).toBeGreaterThan(0);
    for (const t of numeric) {
      const items = drawContentDrill(t.topicKey!, 314, DRILL_ROUND_SIZE);
      expect(items.length, `${t.topicKey} empty draw`).toBeGreaterThan(0);
    }
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
