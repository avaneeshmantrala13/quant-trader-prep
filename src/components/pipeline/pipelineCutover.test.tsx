// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { emptyProgress, type UserProgress } from "@/types/progress";
import { resolveStage } from "@/lib/pipeline/stateMachine";
import {
  COMPETENCY_BRAINTEASER,
  TRADING_SUBTOPIC_KEYS,
  scoredContentTopicKeys,
} from "@/lib/pipeline/gates";

/**
 * ============================================================================
 *  GUIDED-PIPELINE CUTOVER — END-TO-END ADVANCE PATH (integration)
 * ============================================================================
 * Drives the FULL login→greenlight advance through the live persistence seam
 * `ProgressContext.completePipelineStage`, asserting that `resolveStage` moves
 * correctly at each step:
 *
 *   fresh → untimed → timed → game-oa → diagnosis → drilling (gate) →
 *   3 mocks ≥90% → greenlight
 *
 * and — the crux of RESOLVED DECISION §10.5 — that the gates stay authoritative:
 * a relocked content node or a broken mock streak RE-DERIVES an earlier stage
 * even with the downstream `greenlitAt` / `mockClearedAt` audit stamps present.
 */

let CURRENT: UserProgress = emptyProgress();
vi.mock("@/lib/storage", () => ({
  storage: {
    getSession: () => "cutover-user",
    loadProgress: () => CURRENT,
    saveProgress: (_u: string, next: UserProgress) => {
      CURRENT = next;
    },
    getTheme: () => "light",
    setTheme: () => {},
    getThemeId: () => "minimalist",
    setThemeId: () => {},
    logOut: () => {},
    signUp: async () => ({ ok: true }),
    logIn: async () => ({ ok: true }),
  },
}));

// eslint-disable-next-line import/first
import { AuthProvider } from "@/context/AuthContext";
// eslint-disable-next-line import/first
import { ProgressProvider, useProgress } from "@/context/ProgressContext";

/** Mastery seeds that push EVERY scored node + both competencies over the bar. */
function masterAllSeeds() {
  return [
    ...scoredContentTopicKeys().map((topicKey) => ({
      topicKey,
      successes: 60,
      failures: 1,
    })),
    { topicKey: COMPETENCY_BRAINTEASER, successes: 60, failures: 1 },
    // The trading gate rolls up its subtopics — seed each one over the bar.
    ...TRADING_SUBTOPIC_KEYS.map((topicKey) => ({
      topicKey,
      successes: 60,
      failures: 1,
    })),
  ];
}

/**
 * A test harness that exposes the live resolved stage + the audit stamps and a
 * button per advance action, so a test can drive the seam like the shell does.
 */
function Harness() {
  const { progress, completePipelineStage, applyDiagnosticSeeds } = useProgress();
  const p = progress.pipeline;
  return (
    <div>
      <span data-testid="stage">{resolveStage(progress)}</span>
      <span data-testid="mocks">{p?.mocks?.length ?? 0}</span>
      <span data-testid="drillingClearedAt">{String(!!p?.drillingClearedAt)}</span>
      <span data-testid="mockClearedAt">{String(!!p?.mockClearedAt)}</span>
      <span data-testid="greenlitAt">{String(!!p?.greenlitAt)}</span>

      <button
        data-testid="finish-untimed"
        onClick={() =>
          completePipelineStage("diagnostic-untimed", {
            at: "2026-01-01T00:00:00.000Z",
            overallScore: 0.5,
            itemsAnswered: 100,
          })
        }
      />
      <button
        data-testid="finish-timed"
        onClick={() =>
          completePipelineStage("diagnostic-timed", {
            correct: 28,
            total: 30,
            sections: [
              {
                label: "timed-diagnostic",
                correct: 28,
                total: 30,
                topicKeys: ["probability::Markov Chains"],
              },
            ],
          })
        }
      />
      <button
        data-testid="finish-gameoa"
        onClick={() =>
          completePipelineStage("game-oa", {
            rounds: 16,
            pnl: 12,
            verdict: "Edge-capturing",
          })
        }
      />
      <button
        data-testid="finish-diagnosis"
        onClick={() => completePipelineStage("diagnosis")}
      />
      <button
        data-testid="finish-drilling"
        onClick={() => completePipelineStage("drilling")}
      />
      <button
        data-testid="master-all"
        onClick={() => applyDiagnosticSeeds(masterAllSeeds())}
      />
      <button
        data-testid="good-mock"
        onClick={() =>
          completePipelineStage("mock", {
            at: `2026-02-0${(progress.pipeline?.mocks?.length ?? 0) + 1}`,
            scorePct: 95,
            wouldPass: "yes",
          })
        }
      />
      <button
        data-testid="bad-mock"
        onClick={() =>
          completePipelineStage("mock", {
            at: "2026-03-01",
            scorePct: 50,
            wouldPass: "no",
          })
        }
      />
      <button
        data-testid="relock-node"
        onClick={() =>
          applyDiagnosticSeeds([
            { topicKey: scoredContentTopicKeys()[0], successes: 0, failures: 9 },
          ])
        }
      />
    </div>
  );
}

function renderHarness() {
  return render(
    <AuthProvider>
      <ProgressProvider>
        <Harness />
      </ProgressProvider>
    </AuthProvider>,
  );
}

const stage = () => screen.getByTestId("stage").textContent;
const click = (id: string) =>
  act(() => {
    fireEvent.click(screen.getByTestId(id));
  });

beforeEach(() => {
  CURRENT = emptyProgress();
});
afterEach(cleanup);

/** Drive the whole happy path to greenlight (leaves the tree at greenlight). */
function advanceToGreenlight() {
  click("finish-untimed");
  click("finish-timed");
  click("finish-gameoa");
  click("finish-diagnosis"); // no mastery yet ⇒ holds at drilling
  click("master-all"); // raise every node/competency over the bar
  click("finish-drilling"); // gate now holds ⇒ advances to mock
  click("good-mock");
  click("good-mock");
  click("good-mock"); // 3 consecutive ≥90% ⇒ greenlight
}

describe("guided pipeline — full advance path via completePipelineStage", () => {
  it("moves the resolved stage forward at every step", () => {
    renderHarness();
    expect(stage()).toBe("diagnostic-untimed");

    click("finish-untimed");
    expect(stage()).toBe("diagnostic-timed");

    click("finish-timed");
    expect(stage()).toBe("game-oa");

    click("finish-gameoa");
    expect(stage()).toBe("diagnosis");

    // Diagnosis stamped, but no mastery/timed clearance ⇒ the drilling gate
    // fails, so the user is held at drilling.
    click("finish-diagnosis");
    expect(stage()).toBe("drilling");

    // Completing "drilling" WITHOUT clearing the gate does NOT advance and does
    // NOT stamp the audit marker — the live gate is authoritative.
    click("finish-drilling");
    expect(stage()).toBe("drilling");
    expect(screen.getByTestId("drillingClearedAt").textContent).toBe("false");

    // Raise every node/competency over the bar (the drilling loop's job) — the
    // live gate now holds, so the stage re-derives forward to mock.
    click("master-all");
    expect(stage()).toBe("mock");

    // Completing drilling now stamps the (audit-only) drillingClearedAt marker.
    click("finish-drilling");
    expect(screen.getByTestId("drillingClearedAt").textContent).toBe("true");
    expect(stage()).toBe("mock");

    // Mock gate: 3 consecutive ≥90%. One/two are not enough.
    click("good-mock");
    expect(screen.getByTestId("mocks").textContent).toBe("1");
    expect(stage()).toBe("mock");
    click("good-mock");
    expect(stage()).toBe("mock");
    click("good-mock");
    // Third consecutive ≥90% clears the gate → greenlight (terminal).
    expect(stage()).toBe("greenlight");
    expect(screen.getByTestId("mockClearedAt").textContent).toBe("true");
    expect(screen.getByTestId("greenlitAt").textContent).toBe("true");
  });

  it("UN-GREENLIGHTS: a relocked content node re-derives drilling (stamp is not the truth)", () => {
    renderHarness();
    advanceToGreenlight();
    expect(stage()).toBe("greenlight");

    // A node decays below the 0.80 bar (relock). Despite the latched greenlitAt
    // stamp, the live gate re-evaluation pulls the user back to drilling.
    click("relock-node");
    expect(stage()).toBe("drilling");
    // The audit stamp is still present — it is NOT the source of truth.
    expect(screen.getByTestId("greenlitAt").textContent).toBe("true");
  });

  it("UN-GREENLIGHTS: a sub-90% mock breaks the streak and re-derives the mock stage", () => {
    renderHarness();
    advanceToGreenlight();
    expect(stage()).toBe("greenlight");

    // A fresh sub-90% mock breaks the 3-consecutive streak ⇒ back to mock.
    click("bad-mock");
    expect(stage()).toBe("mock");
  });
});
