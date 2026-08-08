// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { TIMED_DIAGNOSTIC_FORMAT } from "@/lib/oa/config";
import { createOaSession } from "@/lib/oa/timedSession";
import { drawTimedDiagnostic } from "@/lib/oa/timedDiagnostic";
import type { OaSessionState } from "@/lib/oa/types";

/**
 * The stage reads only `{ progress, saveOaSession, clearOaActiveSession }` from
 * the progress context, so we mock the context (avoiding Auth/storage) and drive
 * `progress` per test. `vi.hoisted` makes the spies available inside the hoisted
 * `vi.mock` factory.
 */
const { mockRef, saveOaSession, clearOaActiveSession } = vi.hoisted(() => ({
  mockRef: { current: {} as { oaTimed?: { active?: OaSessionState; results: unknown[] } } },
  saveOaSession: vi.fn(),
  clearOaActiveSession: vi.fn(),
}));

vi.mock("@/context/ProgressContext", () => ({
  useProgress: () => ({
    progress: mockRef.current,
    saveOaSession,
    clearOaActiveSession,
  }),
}));

import { TimedDiagnosticStage } from "./TimedDiagnosticStage";

beforeEach(() => {
  mockRef.current = {};
  saveOaSession.mockReset();
  clearOaActiveSession.mockReset();
});
afterEach(cleanup);

describe("TimedDiagnosticStage — Stage 3 runner", () => {
  it("starts a fresh 30-question / 45-minute section and persists it (reload-proof)", () => {
    const onComplete = vi.fn();
    render(<TimedDiagnosticStage onComplete={onComplete} />);

    // It seeded exactly one in-progress session into the OA store.
    expect(saveOaSession).toHaveBeenCalled();
    const session = saveOaSession.mock.calls[0][0] as OaSessionState;
    expect(session.formatId).toBe(TIMED_DIAGNOSTIC_FORMAT.id);
    expect(session.kind).toBe("section");
    expect(session.questions).toHaveLength(30);
    // Reload-proof: an ABSOLUTE section deadline 45 minutes out.
    expect(session.deadlineTs).toBe(session.startedAtTs + 45 * 60 * 1000);

    // The live section countdown + n/30 runner is mounted (not yet finished).
    expect(screen.getByText("Section time")).toBeTruthy();
    expect(screen.getByTestId("timed-diagnostic-stage")).toBeTruthy();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("auto-submits an expired in-progress session on mount and reports the result", () => {
    // A session started an hour ago ⇒ its 45-minute deadline passed while away.
    const { questions } = drawTimedDiagnostic(555, 30);
    const active = createOaSession(TIMED_DIAGNOSTIC_FORMAT, questions, {
      nowTs: Date.now() - 60 * 60 * 1000,
    });
    mockRef.current = { oaTimed: { active, results: [] } };

    const onComplete = vi.fn();
    render(<TimedDiagnosticStage onComplete={onComplete} />);

    // Completed exactly once, with the pipeline.timed payload shape.
    expect(onComplete).toHaveBeenCalledTimes(1);
    const result = onComplete.mock.calls[0][0] as {
      correct: number;
      total: number;
      sections: { label: string; correct: number; total: number; topicKeys?: string[] }[];
    };
    expect(result.total).toBe(30);
    expect(result.correct).toBe(0); // nothing was answered before expiry
    expect(Array.isArray(result.sections)).toBe(true);
    expect(result.sections.length).toBeGreaterThan(0);
    for (const s of result.sections) {
      expect(s.topicKeys).toHaveLength(1);
      expect(s.total).toBeGreaterThan(0);
    }
    // The resumable session is cleared and the completion panel is shown.
    expect(clearOaActiveSession).toHaveBeenCalled();
    expect(screen.getByTestId("timed-diagnostic-done")).toBeTruthy();
  });

  it("resumes a still-running in-progress session without restarting it", () => {
    const { questions } = drawTimedDiagnostic(9001, 30);
    const active = createOaSession(TIMED_DIAGNOSTIC_FORMAT, questions, {
      nowTs: Date.now() - 60 * 1000, // 1 min ago; ~44 min left
    });
    mockRef.current = { oaTimed: { active, results: [] } };

    const onComplete = vi.fn();
    render(<TimedDiagnosticStage onComplete={onComplete} />);

    // Still running: the runner is shown, nothing completed, no fresh draw saved
    // over it (the resumed session already matched, so no reconciliation write).
    expect(screen.getByText("Section time")).toBeTruthy();
    expect(onComplete).not.toHaveBeenCalled();
  });
});
