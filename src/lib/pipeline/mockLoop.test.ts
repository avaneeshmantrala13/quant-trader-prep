import { describe, expect, it } from "vitest";
import { emptyProgress, type PipelineMockResult } from "@/types/progress";
import { MOCK_CONSECUTIVE, MOCK_GATE_PCT, passesMockGate } from "./gates";
import {
  buildInterview,
  createSession,
  currentStep,
  mockReducer,
  type MockSession,
  type PresetId,
} from "@/lib/mock";
import {
  ALL_MOCK_TOPIC_AREAS,
  assembleThoroughMock,
  assembleThoroughMockCycle,
  buildMockResult,
  consecutivePassesRemaining,
  currentMockStreak,
  mockCountsAsPass,
  mockGateBatteryTopicAreas,
  mockGateCleared,
  mockPassStreak,
  mocksRemaining,
  presetForMockIndex,
  topicAreasForPreset,
} from "./mockLoop";

/**
 * PURE unit tests for the Stage-7 mock loop (Phase P7): the consecutive-pass
 * streak math (reusing gates.ts constants), the thorough all-topics /
 * non-weakness-weighted assembly, and the `PipelineMockResult` builder.
 */

function mk(scorePct: number, wouldPass = "yes"): PipelineMockResult {
  return { at: "t", scorePct, wouldPass };
}

/* -------------------------------------------------------------------------- */
/*  Streak math                                                                */
/* -------------------------------------------------------------------------- */

describe("mock streak math (≥90% on 3 consecutive; a fail resets)", () => {
  it("a mock counts as a pass iff scorePct ≥ 90", () => {
    expect(mockCountsAsPass(mk(90))).toBe(true);
    expect(mockCountsAsPass(mk(100))).toBe(true);
    expect(mockCountsAsPass(mk(89))).toBe(false);
    expect(mockCountsAsPass(mk(0))).toBe(false);
  });

  it("an empty log has streak 0 and needs all 3", () => {
    expect(mockPassStreak([])).toBe(0);
    expect(consecutivePassesRemaining([])).toBe(MOCK_CONSECUTIVE);
  });

  it("2 passes then a fail resets the streak to 0", () => {
    const mocks = [mk(95), mk(92), mk(80)];
    expect(mockPassStreak(mocks)).toBe(0);
    expect(consecutivePassesRemaining(mocks)).toBe(3);
  });

  it("counts only the trailing run of ≥90% mocks", () => {
    expect(mockPassStreak([mk(80), mk(95), mk(93)])).toBe(2);
    expect(mockPassStreak([mk(95), mk(93)])).toBe(2);
    expect(consecutivePassesRemaining([mk(80), mk(95), mk(93)])).toBe(1);
  });

  it("3 straight ≥90% clears the gate", () => {
    const mocks = [mk(90), mk(95), mk(100)];
    expect(mockPassStreak(mocks)).toBe(MOCK_CONSECUTIVE);
    const progress = { ...emptyProgress(), pipeline: { stage: "mock" as const, mocks } };
    expect(mockGateCleared(progress)).toBe(true);
    // mockGateCleared delegates to the SAME gate predicate.
    expect(mockGateCleared(progress)).toBe(passesMockGate(progress));
    expect(mocksRemaining(progress)).toBe(0);
    expect(currentMockStreak(progress)).toBe(3);
  });

  it("a 4th sub-90% mock relocks the gate and resets the streak", () => {
    const mocks = [mk(90), mk(95), mk(100), mk(88)];
    expect(mockPassStreak(mocks)).toBe(0);
    const progress = { ...emptyProgress(), pipeline: { stage: "mock" as const, mocks } };
    expect(mockGateCleared(progress)).toBe(false);
    expect(mocksRemaining(progress)).toBe(3);
  });

  it("a passing mock with a 'no' verdict counts for the streak but not the gate", () => {
    // The streak is purely scorePct; the AUTHORITATIVE gate also needs
    // wouldPass !== 'no', so this documents the (deliberate) split.
    const mocks = [mk(95, "no"), mk(95, "yes"), mk(95, "yes")];
    expect(mockPassStreak(mocks)).toBe(3);
    const progress = { ...emptyProgress(), pipeline: { stage: "mock" as const, mocks } };
    expect(mockGateCleared(progress)).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/*  Thorough, all-topics, non-weakness-weighted assembly                       */
/* -------------------------------------------------------------------------- */

describe("thorough all-topics mock assembly (not weakness-weighted)", () => {
  it("cycles the firm presets across the three mocks", () => {
    expect(presetForMockIndex(0)).toBe("optiver");
    expect(presetForMockIndex(1)).toBe("janestreet");
    expect(presetForMockIndex(2)).toBe("sig");
    expect(presetForMockIndex(3)).toBe("optiver"); // wraps
    expect(presetForMockIndex(-1)).toBe("sig"); // negative-safe
  });

  it("assembles a spec from ONLY {mockIndex, seed} — it cannot be weakness-weighted", () => {
    const spec = assembleThoroughMock({ mockIndex: 0, seed: 123 });
    expect(spec.preset).toBe("optiver");
    expect(spec.config).toEqual({ seed: 123, preset: "optiver" });
    expect(spec.topicAreas.length).toBeGreaterThan(0);
    // Deterministic in its inputs: same args ⇒ byte-identical spec (no hidden
    // mastery/weakness dependence).
    expect(assembleThoroughMock({ mockIndex: 0, seed: 123 })).toEqual(spec);
  });

  it("covers EVERY topic area across the full 3-mock cycle", () => {
    const cycle = assembleThoroughMockCycle(42);
    expect(cycle).toHaveLength(MOCK_CONSECUTIVE);
    expect(cycle.map((s) => s.preset)).toEqual(["optiver", "janestreet", "sig"]);
    // The battery spans every area the firm mocks cover.
    expect(mockGateBatteryTopicAreas()).toEqual(ALL_MOCK_TOPIC_AREAS);
    expect(ALL_MOCK_TOPIC_AREAS).toEqual([
      "brainteaser",
      "market-making",
      "mental-math",
      "probability-ev",
      "sequences",
    ]);
    // Each individual mock covers a non-empty subset of the battery.
    for (const s of cycle) {
      expect(s.topicAreas.length).toBeGreaterThan(0);
      for (const area of s.topicAreas) {
        expect(ALL_MOCK_TOPIC_AREAS).toContain(area);
      }
    }
  });

  it("draws a broad range of areas per preset (not a single-topic drill)", () => {
    expect(topicAreasForPreset("optiver")).toEqual([
      "market-making",
      "probability-ev",
      "sequences",
    ]);
    expect(topicAreasForPreset("janestreet")).toContain("probability-ev");
    expect(topicAreasForPreset("janestreet")).toContain("brainteaser");
    expect(topicAreasForPreset("janestreet")).toContain("market-making");
  });

  it("flows the pinned firm-signature hard archetypes through unchanged", () => {
    // The Optiver mock pins the quadratic-sequence demo AND the lattice/parity
    // anchor — both must appear in the assembled, engine-built script.
    const spec = assembleThoroughMock({ mockIndex: 0, seed: 7 });
    const script = buildInterview(spec.config);
    const ids = script.steps.map((s) => s.id);
    expect(ids.some((id) => id.startsWith("mock-math") && id.includes("seqn-poly-demo"))).toBe(true);
    expect(ids.some((id) => id.includes("pev-lattice"))).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/*  buildMockResult (reuses computePerformance + deterministicDiagnosis)       */
/* -------------------------------------------------------------------------- */

/**
 * Drive a session to `summary` PURELY through the reducer, answering each math
 * step with `answerFor(step)` and self-assessing brainteasers; market-making /
 * behavioral steps are skipped (they don't feed `scorePct`).
 */
function driveSession(
  preset: PresetId,
  answerFor: (answer: number) => string,
): MockSession {
  let s = mockReducer(
    createSession(buildInterview({ seed: 99, preset }), { speechSupported: false }),
    { type: "start" },
  );
  let guard = 0;
  while (s.status === "running" && guard++ < 200) {
    const step = currentStep(s)!;
    if (step.kind === "math") {
      s = mockReducer(s, {
        type: "recordMath",
        raw: answerFor(step.answer),
        viaSpeech: false,
        elapsedMs: 1000,
      });
    } else if (step.kind === "brainteaser") {
      s = mockReducer(s, {
        type: "recordReflect",
        raw: "",
        viaSpeech: false,
        selfAssessed: "got",
      });
    }
    s = mockReducer(s, { type: "next" });
  }
  return s;
}

describe("buildMockResult — correctly-shaped PipelineMockResult from a session", () => {
  it("an all-correct run yields a high scorePct and a passing verdict", () => {
    const s = driveSession("optiver", (a) => String(a));
    const r = buildMockResult(s, "2026-01-01T00:00:00.000Z");
    expect(r.at).toBe("2026-01-01T00:00:00.000Z");
    expect(typeof r.scorePct).toBe("number");
    expect(r.scorePct).toBeGreaterThanOrEqual(MOCK_GATE_PCT);
    expect(["yes", "borderline", "no"]).toContain(r.wouldPass);
    expect(r.wouldPass).not.toBe("no");
  });

  it("an all-wrong run yields a low scorePct and a failing verdict", () => {
    const s = driveSession("optiver", () => "-987654321");
    const r = buildMockResult(s);
    expect(r.scorePct).toBeLessThan(MOCK_GATE_PCT);
    expect(r.wouldPass).toBe("no");
    expect(typeof r.at).toBe("string");
  });
});

/* -------------------------------------------------------------------------- */
/*  Greenlight requires REASONING QUALITY, not just correct numbers            */
/* -------------------------------------------------------------------------- */

/**
 * Drive a session to `summary` answering every math step correctly AND attaching
 * a reasoning grade of the given `quality` to each math step (mirrors the UI's
 * `applyReasoningGrade`). Lets us build a mock that is ALL CORRECT but with a
 * chosen reasoning quality.
 */
function driveSessionWithReasoning(
  preset: PresetId,
  quality: "sound" | "flawed" | "vague",
): MockSession {
  let s = mockReducer(
    createSession(buildInterview({ seed: 99, preset }), {
      speechSupported: false,
    }),
    { type: "start" },
  );
  let guard = 0;
  while (s.status === "running" && guard++ < 200) {
    const step = currentStep(s)!;
    if (step.kind === "math") {
      s = mockReducer(s, {
        type: "recordMath",
        raw: String(step.answer),
        viaSpeech: false,
        elapsedMs: 1000,
      });
      s = mockReducer(s, {
        type: "applyReasoningGrade",
        stepId: step.id,
        grade: { quality, issues: [], probe: "", source: "deterministic" },
      });
    } else if (step.kind === "brainteaser") {
      s = mockReducer(s, {
        type: "recordReflect",
        raw: "",
        viaSpeech: false,
        selfAssessed: "got",
      });
    }
    s = mockReducer(s, { type: "next" });
  }
  return s;
}

describe("greenlight requires reasoning QUALITY (buildMockResult.reasoningOk)", () => {
  it("all answers correct but FLAWED reasoning ⇒ reasoningOk=false ⇒ NOT greenlit", () => {
    const s = driveSessionWithReasoning("optiver", "flawed");
    const r = buildMockResult(s, "2026-01-03T00:00:00.000Z");
    // Score clears the bar (all correct) but reasoning is flawed.
    expect(r.scorePct).toBeGreaterThanOrEqual(MOCK_GATE_PCT);
    expect(r.reasoningOk).toBe(false);

    const p = emptyProgress();
    p.pipeline = { stage: "mock", mocks: [r, r, r] };
    expect(passesMockGate(p)).toBe(false);
  });

  it("all answers correct WITH sound reasoning ⇒ reasoningOk=true ⇒ greenlit", () => {
    const s = driveSessionWithReasoning("optiver", "sound");
    const r = buildMockResult(s, "2026-01-03T00:00:00.000Z");
    expect(r.scorePct).toBeGreaterThanOrEqual(MOCK_GATE_PCT);
    expect(r.reasoningOk).toBe(true);

    const p = emptyProgress();
    p.pipeline = { stage: "mock", mocks: [r, r, r] };
    expect(passesMockGate(p)).toBe(true);
  });
});
