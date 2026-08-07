import { describe, expect, it } from "vitest";
import {
  buildInterview,
  createSession,
  currentStep,
  defaultInputMode,
  isCurrentAnswered,
  mockReducer,
  toPersistableSummary,
  type MockSession,
} from "./engine";
import type { MathStep, MockScript } from "./types";

/**
 * Engine tests: deterministic-by-seed question selection, the reducer flow, the
 * graceful-degradation guarantee (a "speech unsupported" session still yields a
 * fully usable typed flow), and the PII contract (no transcript is ever
 * persisted in the summary).
 */

const CONFIG = {
  seed: 12345,
  mathCount: 3,
  brainteaserCount: 2,
  behavioralCount: 2,
  tier: "medium" as const,
};

describe("buildInterview — deterministic by seed", () => {
  it("produces byte-identical scripts for the same config", () => {
    const a = buildInterview(CONFIG);
    const b = buildInterview(CONFIG);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("produces different scripts for different seeds", () => {
    const a = buildInterview({ ...CONFIG, seed: 1 });
    const b = buildInterview({ ...CONFIG, seed: 2 });
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it("has the requested counts and fixed math→brainteaser→marketMaking→behavioral order", () => {
    const s = buildInterview(CONFIG);
    const kinds = s.steps.map((x) => x.kind);
    expect(kinds.filter((k) => k === "math").length).toBe(3);
    expect(kinds.filter((k) => k === "brainteaser").length).toBe(2);
    expect(kinds.filter((k) => k === "marketMaking").length).toBe(1);
    expect(kinds.filter((k) => k === "behavioral").length).toBe(2);
    // Order: math, then brainteasers, then market-making, then behavioral.
    expect(kinds).toEqual([
      "math",
      "math",
      "math",
      "brainteaser",
      "brainteaser",
      "marketMaking",
      "behavioral",
      "behavioral",
    ]);
  });

  it("math steps expose a graded answer and reflect-only follow-ups", () => {
    const s = buildInterview(CONFIG);
    const math = s.steps.filter(
      (x): x is MathStep => x.kind === "math",
    );
    for (const m of math) {
      expect(Number.isFinite(m.answer)).toBe(true);
      expect(m.targetMs).toBeGreaterThan(0);
      expect(m.followUps.length).toBeGreaterThan(0);
      // Prompt should not carry the "(Enter ...)" instruction from the source.
      expect(m.prompt).not.toMatch(/\(Enter/);
    }
  });

  it("applies sensible defaults when counts are omitted", () => {
    const s = buildInterview({ seed: 7 });
    const kinds = s.steps.map((x) => x.kind);
    expect(kinds.filter((k) => k === "math").length).toBe(3);
    expect(kinds.filter((k) => k === "brainteaser").length).toBe(2);
    expect(kinds.filter((k) => k === "behavioral").length).toBe(2);
  });
});

describe("defaultInputMode — graceful-degradation decision", () => {
  it("prefers speech when supported, typed otherwise", () => {
    expect(defaultInputMode(true)).toBe("speech");
    expect(defaultInputMode(false)).toBe("typed");
  });
});

/** Drive a whole session to completion, recording a response for every step. */
function runToSummary(
  script: MockScript,
  speechSupported: boolean,
  mathAnswer: (step: MathStep) => string,
): MockSession {
  let s = createSession(script, { speechSupported });
  s = mockReducer(s, { type: "start" });
  expect(s.status).toBe("running");

  while (s.status === "running") {
    const step = currentStep(s);
    if (!step) break;
    if (step.kind === "math") {
      s = mockReducer(s, {
        type: "recordMath",
        raw: mathAnswer(step),
        viaSpeech: speechSupported,
        elapsedMs: 8000,
      });
    } else if (step.kind === "marketMaking") {
      // Quote a tight, well-centred market each round until it settles.
      const mid = step.trueValue;
      let guard = 0;
      while (guard++ < 20) {
        s = mockReducer(s, {
          type: "submitMmQuote",
          stepId: step.id,
          quote: { bid: mid - 2, ask: mid + 2, bidSize: 2, askSize: 2 },
        });
        const mm = s.responses.find((r) => r.stepId === step.id)?.mm;
        if (mm?.done) break;
      }
    } else {
      s = mockReducer(s, {
        type: "recordReflect",
        raw: "my spoken reflection",
        viaSpeech: speechSupported,
        selfAssessed: step.kind === "brainteaser" ? "got" : undefined,
      });
    }
    expect(isCurrentAnswered(s)).toBe(true);
    s = mockReducer(s, { type: "next" });
  }
  return s;
}

describe("state machine — usable flow with AND without speech", () => {
  it("reaches summary and scores math when speech is UNSUPPORTED (typed fallback)", () => {
    const script = buildInterview(CONFIG);
    const s = runToSummary(script, false, (step) => String(step.answer));
    expect(s.status).toBe("summary");
    const summary = toPersistableSummary(s);
    expect(summary.mathTotal).toBe(3);
    expect(summary.mathCorrect).toBe(3); // typed exact answers all correct
    expect(summary.behavioralAnswered).toBe(2);
    expect(summary.brainteaserGotIt).toBe(2);
  });

  it("produces the SAME graded outcome whether via speech or typed", () => {
    const script = buildInterview(CONFIG);
    const typed = toPersistableSummary(
      runToSummary(script, false, (step) => String(step.answer)),
    );
    const spoken = toPersistableSummary(
      runToSummary(script, true, (step) => String(step.answer)),
    );
    // Only the viaSpeech flag differs; correctness/timing/score are identical.
    expect(spoken.mathCorrect).toBe(typed.mathCorrect);
    expect(
      spoken.responses.map((r) => ({ ...r, viaSpeech: undefined })),
    ).toEqual(typed.responses.map((r) => ({ ...r, viaSpeech: undefined })));
  });

  it("marks wrong math answers incorrect", () => {
    const script = buildInterview(CONFIG);
    const s = runToSummary(script, false, () => "definitely wrong");
    const summary = toPersistableSummary(s);
    expect(summary.mathCorrect).toBe(0);
  });

  it("restart returns to the intro with a clean slate", () => {
    const script = buildInterview(CONFIG);
    let s = runToSummary(script, false, (step) => String(step.answer));
    s = mockReducer(s, { type: "restart" });
    expect(s.status).toBe("intro");
    expect(s.responses).toEqual([]);
    expect(s.index).toBe(0);
  });

  it("ignores recordMath on a non-math step (no accidental scoring)", () => {
    const script = buildInterview(CONFIG);
    let s = createSession(script, { speechSupported: false });
    s = mockReducer(s, { type: "start" });
    // jump to the first brainteaser
    while (currentStep(s)?.kind === "math") s = mockReducer(s, { type: "next" });
    const before = s;
    s = mockReducer(s, {
      type: "recordMath",
      raw: "5",
      viaSpeech: false,
      elapsedMs: 1000,
    });
    expect(s).toBe(before); // unchanged
  });
});

describe("PII contract — no transcript is ever persisted", () => {
  it("the persistable summary omits raw transcript text entirely", () => {
    const script = buildInterview(CONFIG);
    const SECRET = "my very identifying spoken sentence 555-12-3456";
    let s = createSession(script, { speechSupported: true });
    s = mockReducer(s, { type: "start" });
    while (s.status === "running") {
      const step = currentStep(s);
      if (!step) break;
      if (step.kind === "math") {
        s = mockReducer(s, {
          type: "recordMath",
          raw: SECRET,
          viaSpeech: true,
          elapsedMs: 5000,
        });
      } else {
        s = mockReducer(s, {
          type: "recordReflect",
          raw: SECRET,
          viaSpeech: true,
          selfAssessed: "missed",
        });
      }
      s = mockReducer(s, { type: "next" });
    }

    const summary = toPersistableSummary(s);
    const serialized = JSON.stringify(summary);
    expect(serialized).not.toContain(SECRET);
    expect(serialized).not.toContain("raw");
    for (const r of summary.responses) {
      expect(r).not.toHaveProperty("raw");
    }
  });

  it("keeps raw transcripts only in transient in-memory session state", () => {
    const script = buildInterview({ ...CONFIG, mathCount: 1, brainteaserCount: 0, behavioralCount: 0 });
    let s = createSession(script, { speechSupported: false });
    s = mockReducer(s, { type: "start" });
    s = mockReducer(s, {
      type: "recordMath",
      raw: "seventy",
      viaSpeech: false,
      elapsedMs: 3000,
    });
    // Present transiently in the live session...
    expect(s.responses[0].raw).toBe("seventy");
    // ...but stripped from the persistable projection.
    expect(toPersistableSummary(s).responses[0]).not.toHaveProperty("raw");
  });
});
