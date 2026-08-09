// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MathInterviewCard } from "./MathInterviewCard";
import type { MathStep, MockResponse } from "@/lib/mock";
import type { UseMockSpeech } from "./useMockSpeech";

/**
 * Reasoning-review UX test (Task 4): once answered, the candidate's OWN
 * submitted reasoning PERSISTS on screen and renders with GOOD (green) and
 * FLAWED (red) highlight spans, with the feedback verdict below it.
 */

afterEach(cleanup);

const noopSpeech: UseMockSpeech = {
  support: { recognition: false, synthesis: false },
  canListen: false,
  canSpeak: false,
  listening: false,
  interim: "",
  speak: () => {},
  prefetch: () => {},
  startListening: () => {},
  stopListening: () => {},
  cancelSpeech: () => {},
};

/** A minimal sequences step (answer 95) with an authored mechanism signal. */
function seqStep(): MathStep {
  return {
    kind: "math",
    id: "test-seq-1",
    qtype: "sequences",
    regime: "reasoning",
    prompt: "5, 11, 23, 41, 65, … what is the next term?",
    answer: 95,
    family: "sequences",
    explanation: "Second differences are constant at 6, so the next gap is 30 → 95.",
    followUps: [],
    requiredReasoning: {
      mechanismSignals: ["second difference is constant", "constant second difference"],
    },
    targetMs: 45000,
  };
}

/** A response as if the candidate already answered (95) with mixed reasoning. */
function answeredResponse(reasoning: string): MockResponse {
  return {
    stepId: "test-seq-1",
    stage: "math",
    raw: "95",
    viaSpeech: false,
    reasoningRaw: reasoning,
    // A resolved grade so the async grading effect is a no-op in the test.
    reasoningGrade: {
      quality: "partial",
      issues: ["A stated step is off."],
      probe: "",
      source: "deterministic",
    },
    score: {
      parsed: 95,
      correct: true,
      elapsedMs: 12000,
      targetMs: 45000,
      timing: "ok",
      score: 1,
    },
  };
}

describe("MathInterviewCard — reasoning review UX", () => {
  it("persists the submitted reasoning and highlights good & flawed spans", () => {
    const reasoning =
      "The second difference is constant at 6. 24 + 6 = 30, so the next term is 95. But 1 divided by 2 is 5.";
    render(
      <MathInterviewCard
        step={seqStep()}
        response={answeredResponse(reasoning)}
        speech={noopSpeech}
        isLast
        dispatch={vi.fn()}
        onNext={vi.fn()}
      />,
    );

    // The candidate's own submitted reasoning is shown back to them.
    const panel = screen.getByTestId("submitted-reasoning");
    expect(panel).toBeTruthy();
    expect(panel.textContent).toContain("the next term is 95");
    expect(panel.textContent).toContain("1 divided by 2 is 5");

    // Green (good) spans: the mechanism + the clause reaching 95.
    const good = within(panel).getAllByTestId("reasoning-span-good");
    expect(good.length).toBeGreaterThanOrEqual(1);

    // Red (flawed) span: the false "1 divided by 2 is 5".
    const flawed = within(panel).getAllByTestId("reasoning-span-flawed");
    expect(flawed.length).toBeGreaterThanOrEqual(1);
    expect(flawed.map((n) => n.textContent).join(" ")).toMatch(/1 divided by 2 is 5/);

    // The verdict / feedback still renders below the submitted reasoning.
    expect(screen.getByText(/Reasoning quality/i)).toBeTruthy();
  });

  it("does not crash when there is no submitted reasoning", () => {
    const resp = answeredResponse("");
    render(
      <MathInterviewCard
        step={seqStep()}
        response={resp}
        speech={noopSpeech}
        isLast
        dispatch={vi.fn()}
        onNext={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("submitted-reasoning")).toBeNull();
  });
});
