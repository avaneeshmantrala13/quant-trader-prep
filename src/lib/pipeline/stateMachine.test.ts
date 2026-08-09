import { describe, expect, it } from "vitest";
import { emptyProgress, type UserProgress } from "@/types/progress";
import type { TopicMastery } from "@/types/mastery";
import { COMPETENCY_BRAINTEASER, TRADING_SUBTOPIC_KEYS, scoredContentTopicKeys } from "./gates";
import {
  tradingSubtopicByGame,
  type TradingGameId,
} from "@/lib/mastery/tradingSubtopics";
import {
  FIRST_STAGE,
  TERMINAL_STAGE,
  currentStage,
  nextStage,
  resolveStage,
  stageIndex,
  stageOrder,
  type Stage,
} from "./stateMachine";

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

/** All scored content + both competency nodes mastered. */
function allMasteredMap(): Record<string, TopicMastery> {
  const tm: Record<string, TopicMastery> = {};
  for (const key of scoredContentTopicKeys()) tm[key] = mastered();
  tm[COMPETENCY_BRAINTEASER] = mastered();
  for (const key of TRADING_SUBTOPIC_KEYS) tm[key] = mastered();
  return tm;
}

/** A progress blob that satisfies EVERY gate through greenlight. */
function greenlitProgress(): UserProgress {
  const p = emptyProgress();
  p.topicMastery = allMasteredMap();
  p.pipeline = {
    stage: "greenlight",
    untimedDoneAt: "2026-01-01",
    timedDoneAt: "2026-01-02",
    gameOaDoneAt: "2026-01-03",
    diagnosisComputedAt: "2026-01-04",
    drillingClearedAt: "2026-01-05",
    mockClearedAt: "2026-01-06",
    greenlitAt: "2026-01-07",
    timed: {
      correct: 28,
      total: 30,
      sections: [{ label: "timed-diagnostic", correct: 28, total: 30 }],
    },
    mocks: [
      { at: "2026-01-05", scorePct: 91, wouldPass: "yes" },
      { at: "2026-01-06", scorePct: 93, wouldPass: "yes" },
      { at: "2026-01-07", scorePct: 96, wouldPass: "yes" },
    ],
  };
  return p;
}

describe("stateMachine — order + navigation helpers", () => {
  it("has the 7 in-app stages in spec order", () => {
    expect(stageOrder).toEqual([
      "diagnostic-untimed",
      "diagnostic-timed",
      "game-oa",
      "diagnosis",
      "drilling",
      "mock",
      "greenlight",
    ]);
    expect(FIRST_STAGE).toBe("diagnostic-untimed");
    expect(TERMINAL_STAGE).toBe("greenlight");
  });

  it("nextStage walks forward and returns null at the terminal stage", () => {
    expect(nextStage("diagnostic-untimed")).toBe("diagnostic-timed");
    expect(nextStage("diagnosis")).toBe("drilling");
    expect(nextStage("mock")).toBe("greenlight");
    expect(nextStage("greenlight")).toBeNull();
    // Unknown stage ⇒ null.
    expect(nextStage("nope" as Stage)).toBeNull();
  });

  it("stageIndex reflects position (−1 when unknown)", () => {
    expect(stageIndex("diagnostic-untimed")).toBe(0);
    expect(stageIndex("greenlight")).toBe(6);
    expect(stageIndex("nope" as Stage)).toBe(-1);
  });

  it("currentStage defaults an undefined pipeline to the first stage", () => {
    expect(currentStage(emptyProgress())).toBe("diagnostic-untimed");
    const p = emptyProgress();
    p.pipeline = { stage: "drilling" };
    expect(currentStage(p)).toBe("drilling");
  });
});

describe("stateMachine — resolveStage (stamps + live gates)", () => {
  it("defaults a pre-pipeline user to the untimed diagnostic", () => {
    expect(resolveStage(emptyProgress())).toBe("diagnostic-untimed");
  });

  it("advances through the early stamp-gated stages one at a time", () => {
    const p = emptyProgress();
    p.pipeline = { stage: "diagnostic-untimed", untimedDoneAt: "t" };
    expect(resolveStage(p)).toBe("diagnostic-timed");
    p.pipeline.timedDoneAt = "t";
    expect(resolveStage(p)).toBe("game-oa");
    p.pipeline.gameOaDoneAt = "t";
    expect(resolveStage(p)).toBe("diagnosis");
    p.pipeline.diagnosisComputedAt = "t";
    // Diagnosis done but no mastery/timed evidence ⇒ stuck in drilling.
    expect(resolveStage(p)).toBe("drilling");
  });

  it("holds at drilling until the aggregate gate passes, then advances to mock", () => {
    const p = greenlitProgress();
    // Strip mastery: drilling gate fails ⇒ resolves to drilling.
    p.topicMastery = {};
    expect(resolveStage(p)).toBe("drilling");
    // Restore mastery but only 2 mocks ⇒ drilling clears, mock does not.
    p.topicMastery = allMasteredMap();
    p.pipeline!.mocks = [
      { at: "2026-01-06", scorePct: 93, wouldPass: "yes" },
      { at: "2026-01-07", scorePct: 96, wouldPass: "yes" },
    ];
    expect(resolveStage(p)).toBe("mock");
  });

  it("reaches greenlight when every gate passes", () => {
    expect(resolveStage(greenlitProgress())).toBe("greenlight");
  });

  it("UN-GREENLIGHTS: a relocked node re-derives drilling even with greenlitAt stamped", () => {
    const p = greenlitProgress();
    expect(resolveStage(p)).toBe("greenlight");
    // A node decays below the 0.80 bar (relock). Despite the latched
    // greenlitAt/drillingClearedAt stamps, the LIVE gate re-evaluation must pull
    // the user back to drilling (RESOLVED DECISION §10.5).
    p.topicMastery!["probability::Expected Value"] = weak();
    expect(resolveStage(p)).toBe("drilling");
    // The audit stamp is still present — it is NOT the source of truth.
    expect(p.pipeline!.greenlitAt).toBe("2026-01-07");
  });

  it("UN-GREENLIGHTS: a broken mock streak re-derives the mock stage", () => {
    const p = greenlitProgress();
    p.pipeline!.mocks = [
      { at: "2026-01-05", scorePct: 91, wouldPass: "yes" },
      { at: "2026-01-06", scorePct: 72, wouldPass: "no" },
      { at: "2026-01-07", scorePct: 96, wouldPass: "yes" },
    ];
    expect(resolveStage(p)).toBe("mock");
  });
});

describe("stateMachine — greenlight is GATED on game-OA competency", () => {
  /**
   * Every Game-OA battery game. A user must NOT be able to reach greenlight while
   * ANY of these game subtopics is below the 0.80 mastery bar — even with every
   * downstream stamp (drillingClearedAt / mockClearedAt / greenlitAt) latched.
   */
  const GAME_OA: TradingGameId[] = [
    "make-market",
    "trading-floor",
    "cards-mm",
    "next-card",
    "arbitrage",
    "fermi",
    "numberlogic",
    "beat-the-odds",
    "stockmaster",
    "number-box",
    "shape-shift",
  ];

  it.each(GAME_OA)(
    "cannot greenlight while the %s game subtopic is below the bar; clearing it unblocks",
    (game) => {
      const key = tradingSubtopicByGame(game).key;
      const p = greenlitProgress();
      // Baseline: every gate passes ⇒ greenlight.
      expect(resolveStage(p)).toBe("greenlight");
      // A single weak game-OA subtopic drops the rolled-up trading gate, so the
      // aggregate drilling gate re-opens and the router pulls the user BACK to
      // drilling — greenlight is unreachable despite the stamped greenlitAt.
      p.topicMastery![key] = weak();
      expect(resolveStage(p)).toBe("drilling");
      expect(p.pipeline!.greenlitAt).toBe("2026-01-07");
      // Clearing that exact game (re-mastering it in drilling) unblocks the gate
      // and the user advances all the way to greenlight again.
      p.topicMastery![key] = mastered();
      expect(resolveStage(p)).toBe("greenlight");
    },
  );

  it("a weak Zap-N (Stockmaster) go/no-go subtopic ALONE keeps the user in drilling", () => {
    const p = greenlitProgress();
    p.topicMastery![tradingSubtopicByGame("stockmaster").key] = weak();
    // Only the cognitive attention game is weak — still blocks greenlight.
    expect(resolveStage(p)).toBe("drilling");
  });
});
