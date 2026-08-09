// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import {
  MENTAL_MATH_SPRINT_FORMAT,
  MENTAL_MATH_SPRINT_ITEM_COUNT,
  TIMED_DIAGNOSTIC_FORMAT,
} from "@/lib/oa/config";
import { createOaSession, submitOaSession } from "@/lib/oa/timedSession";
import { drawTimedDiagnostic } from "@/lib/oa/timedDiagnostic";
import { drawMentalMathSprint } from "@/lib/oa/mentalMathSprint";
import { MENTAL_MATH_TOPIC_KEY } from "@/content/mentalMath/subtopics";
import type { OaSessionState } from "@/lib/oa/types";
import type { ItemAttempt } from "@/types/mastery";

/**
 * The stage reads `{ progress, saveOaSession, clearOaActiveSession,
 * recordItemAttempt }` from the progress context, so we mock the context and
 * drive `progress` per test. `vi.hoisted` makes the spies available inside the
 * hoisted `vi.mock` factory.
 */
const { mockRef, saveOaSession, clearOaActiveSession, recordItemAttempt } =
  vi.hoisted(() => ({
    mockRef: {
      current: {} as {
        oaTimed?: { active?: OaSessionState; results: unknown[] };
      },
    },
    saveOaSession: vi.fn(),
    clearOaActiveSession: vi.fn(),
    recordItemAttempt: vi.fn((_a: ItemAttempt) => ({}) as unknown),
  }));

vi.mock("@/context/ProgressContext", () => ({
  useProgress: () => ({
    progress: mockRef.current,
    saveOaSession,
    clearOaActiveSession,
    recordItemAttempt,
  }),
}));

import { TimedDiagnosticStage } from "./TimedDiagnosticStage";

/** Build a TERMINAL (finished) mental-math sprint (nothing answered ⇒ all misses). */
function finishedSprint(seed: number): OaSessionState {
  const draw = drawMentalMathSprint(seed, MENTAL_MATH_SPRINT_ITEM_COUNT);
  const fresh = createOaSession(MENTAL_MATH_SPRINT_FORMAT, draw.questions, {
    nowTs: Date.now() - 60 * 60 * 1000,
    questionBudgetsMs: draw.budgetsMs,
  });
  return submitOaSession(fresh, Date.now() - 60 * 60 * 1000);
}

/** Build a hard section (phase 2) carrying a finished sprint section. */
function hardSection(seed: number, nowTs: number): OaSessionState {
  const { questions } = drawTimedDiagnostic(seed, TIMED_DIAGNOSTIC_FORMAT.questionCount);
  const base = createOaSession(TIMED_DIAGNOSTIC_FORMAT, questions, { nowTs });
  return {
    ...base,
    carriedSections: [
      {
        label: "Mental-math sprint",
        correct: 7.5,
        total: MENTAL_MATH_SPRINT_ITEM_COUNT,
        topicKeys: [MENTAL_MATH_TOPIC_KEY],
        at: new Date(nowTs).toISOString(),
      },
    ],
  };
}

beforeEach(() => {
  mockRef.current = {};
  saveOaSession.mockReset();
  clearOaActiveSession.mockReset();
  recordItemAttempt.mockReset();
  recordItemAttempt.mockImplementation(() => ({}));
});
afterEach(cleanup);

describe("TimedDiagnosticStage — Stage 3 two-phase runner", () => {
  it("starts with the mental-math SPRINT (per-question shot clock), persisted", () => {
    const onComplete = vi.fn();
    render(<TimedDiagnosticStage onComplete={onComplete} />);

    // It seeded exactly one in-progress SPRINT session into the OA store.
    expect(saveOaSession).toHaveBeenCalled();
    const session = saveOaSession.mock.calls[0][0] as OaSessionState;
    expect(session.formatId).toBe(MENTAL_MATH_SPRINT_FORMAT.id);
    expect(session.kind).toBe("sprint");
    expect(session.questions).toHaveLength(MENTAL_MATH_SPRINT_ITEM_COUNT);
    // Per-question shot-clock budgets are threaded through, and the first
    // question's clock is seeded from its OWN budget (reload-proof).
    expect(session.questionBudgetsMs).toHaveLength(MENTAL_MATH_SPRINT_ITEM_COUNT);
    expect(session.questionDeadlineTs).toBe(
      session.startedAtTs + (session.questionBudgetsMs as number[])[0],
    );

    // The sprint's per-question clock UI is mounted (not the section clock).
    expect(screen.getByText("This question")).toBeTruthy();
    expect(screen.getByText("Mental-math sprint")).toBeTruthy();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("scores a finished sprint into mental-math mastery, then rolls into the hard section", () => {
    mockRef.current = { oaTimed: { active: finishedSprint(4242), results: [] } };

    const onComplete = vi.fn();
    render(<TimedDiagnosticStage onComplete={onComplete} />);

    // Every sprint item drove the AUTHORITATIVE mental-math node.
    expect(recordItemAttempt).toHaveBeenCalledTimes(MENTAL_MATH_SPRINT_ITEM_COUNT);
    for (const call of recordItemAttempt.mock.calls) {
      const a = call[0] as ItemAttempt;
      expect(a.topicKey).toBe(MENTAL_MATH_TOPIC_KEY);
      expect(a.credit).toBe(0); // nothing answered before expiry ⇒ zero credit
    }

    // The hard section is now the persisted active session, carrying the sprint.
    const last = saveOaSession.mock.calls.at(-1)?.[0] as OaSessionState;
    expect(last.formatId).toBe(TIMED_DIAGNOSTIC_FORMAT.id);
    expect(last.kind).toBe("section");
    expect(last.carriedSections).toHaveLength(1);
    expect(last.carriedSections?.[0].topicKeys).toEqual([MENTAL_MATH_TOPIC_KEY]);

    // The whole stage is NOT finished yet (the hard section just started).
    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.getByText("Section time")).toBeTruthy();
  });

  it("resumes a still-running hard section (phase 2) without restarting it", () => {
    mockRef.current = {
      oaTimed: { active: hardSection(9001, Date.now() - 60 * 1000), results: [] },
    };

    const onComplete = vi.fn();
    render(<TimedDiagnosticStage onComplete={onComplete} />);

    // Phase 2: the section clock runner is shown, nothing recorded/finished, and
    // no fresh sprint is drawn over it.
    expect(screen.getByText("Section time")).toBeTruthy();
    expect(recordItemAttempt).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("auto-submits an expired hard section and reports the COMBINED result", () => {
    // A hard section whose 45-minute deadline passed while away, carrying the
    // already-scored sprint section.
    mockRef.current = {
      oaTimed: {
        active: hardSection(555, Date.now() - 60 * 60 * 1000),
        results: [],
      },
    };

    const onComplete = vi.fn();
    render(<TimedDiagnosticStage onComplete={onComplete} />);

    expect(onComplete).toHaveBeenCalledTimes(1);
    const result = onComplete.mock.calls[0][0] as {
      correct: number;
      total: number;
      sections: { label: string; correct: number; total: number; topicKeys?: string[] }[];
    };
    // Combined total = sprint (12) + hard (30). The carried sprint section is present.
    expect(result.total).toBe(MENTAL_MATH_SPRINT_ITEM_COUNT + 30);
    expect(result.sections[0].label).toBe("Mental-math sprint");
    expect(result.sections[0].total).toBe(MENTAL_MATH_SPRINT_ITEM_COUNT);
    // The resumable session is cleared and the completion panel is shown.
    expect(clearOaActiveSession).toHaveBeenCalled();
    expect(screen.getByTestId("timed-diagnostic-done")).toBeTruthy();
  });
});
