// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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

  it("highlights the ADVERSARIAL follow-up reasoning with the same green/red path", () => {
    // A dice-max step whose adversarial follow-up is reasoning-graded. The main
    // answer + probe are resolved, and the adversarial was answered WRONG, so the
    // follow-up review must show the candidate's own words with a red root span.
    const step: MathStep = {
      kind: "math",
      id: "test-adv-1",
      qtype: "probability-ev",
      regime: "reasoning",
      prompt:
        "Two fair six-sided dice are rolled. What is the expected value of the LARGER of the two (the maximum)?",
      answer: 4.4722,
      decimals: 4,
      family: "order-statistics",
      explanation: "P(max = m) = (2m − 1)/36, so E[max] = 161/36 ≈ 4.4722.",
      followUps: [],
      authoredProbe: {
        prompt: "What is E[ |a − b| ] for the same two dice?",
        source: "authored",
        role: "probe",
        label: "Follow-up 1 of 2 · Probe",
        answerKind: "numeric",
        answer: 1.9444,
        decimals: 4,
        targetMs: 30000,
      },
      authoredAdversarial: {
        prompt: "Use E[max] + E[min] = E[sum] to CHECK your answer — state E[max] + E[min].",
        source: "authored",
        role: "adversarial",
        label: "Follow-up 2 of 2 · Adversarial",
        answerKind: "reasoning",
        conclusionTargets: [7],
        targetMs: 30000,
      },
      targetMs: 45000,
    };

    const okScore = {
      parsed: 4.4722,
      correct: true,
      elapsedMs: 10000,
      targetMs: 45000,
      timing: "ok" as const,
      score: 1,
    };
    const response: MockResponse = {
      stepId: step.id,
      stage: "math",
      raw: "4.4722",
      viaSpeech: false,
      reasoningRaw: "By order statistics E[max] = 161/36 ≈ 4.4722.",
      reasoningGrade: {
        quality: "sound",
        issues: [],
        probe: "",
        source: "deterministic",
      },
      score: okScore,
      followups: {
        probe: {
          presentation: step.authoredProbe!,
          raw: "1.9444",
          viaSpeech: false,
          graded: true,
          score: { ...okScore, parsed: 1.9444 },
        },
        adversarial: {
          presentation: step.authoredAdversarial!,
          raw: "The two dice are independent so I'll just guess the answer is 5.",
          viaSpeech: false,
          graded: true,
          score: {
            parsed: 5,
            correct: false,
            elapsedMs: 8000,
            targetMs: 30000,
            timing: "ok",
            score: 0,
            verdict: "missed",
          },
        },
      },
    };

    render(
      <MathInterviewCard
        step={step}
        response={response}
        speech={noopSpeech}
        isLast
        dispatch={vi.fn()}
        onNext={vi.fn()}
      />,
    );

    // The adversarial follow-up's own reasoning is shown back with highlights.
    const fu = screen.getByTestId("followup-submitted-reasoning");
    expect(fu).toBeTruthy();
    expect(fu.textContent).toContain("independent so I'll just guess");
    // A red root-cause span is present on the wrong follow-up reasoning.
    const flawed = within(fu).getAllByTestId("reasoning-span-flawed");
    expect(flawed.length).toBeGreaterThanOrEqual(1);
  });

  it("reveals the model explanation only on click when reasoning is not sound", () => {
    // A wrong-reasoning base question: the red mistake is shown, and a collapsed
    // "See model explanation" toggle reveals the canonical answer + reasoning.
    const reasoning = "1 divided by 2 is 5, so the next term is 95.";
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

    const toggle = screen.getByTestId("model-explanation-toggle");
    expect(toggle).toBeTruthy();
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    // Default collapsed — the model-answer content is not on screen yet.
    expect(screen.queryByText("Model answer")).toBeNull();

    // Clicking expands it to show the canonical answer + model reasoning.
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Model answer")).toBeTruthy();

    // Clicking again collapses it (accessible toggle).
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Model answer")).toBeNull();
  });

  it("does NOT show the model-explanation toggle when reasoning is sound", () => {
    const resp = answeredResponse("The second difference is constant at 6, so 95.");
    resp.reasoningGrade = {
      quality: "sound",
      issues: [],
      probe: "",
      source: "deterministic",
    };
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
    expect(screen.queryByTestId("model-explanation-toggle")).toBeNull();
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
