// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { emptyProgress, type UserProgress } from "@/types/progress";
import { MOCK_GATE_PCT } from "@/lib/pipeline/gates";

/**
 * Stage-7 (MOCK-INTERVIEW) component tests (Phase P7). The stage runs ONE full
 * thorough all-topics timed mock through the EXISTING engine + cards, then hands
 * a correctly-shaped `PipelineMockResult` back via `onComplete(result)` — exactly
 * once. These tests DRIVE the real mock end-to-end through the DOM (they don't
 * stub the engine), so they also exercise `buildMockResult` inside the component.
 */

let CURRENT: UserProgress = emptyProgress();
vi.mock("@/lib/storage", () => ({
  storage: {
    getSession: () => "mock-user",
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

// Keep the mock's reasoning/follow-up grading on its DETERMINISTIC path with no
// network dependency: stub only the AI transport (never the grading logic), so
// the test is hermetic regardless of the local `VITE_AI_LAYER` config.
vi.mock("@/lib/aiFlavor", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/aiFlavor")>();
  return { ...actual, postAi: async () => null };
});

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  }
});

// eslint-disable-next-line import/first
import { AuthProvider } from "@/context/AuthContext";
// eslint-disable-next-line import/first
import { ProgressProvider } from "@/context/ProgressContext";
// eslint-disable-next-line import/first
import MockStage from "./MockStage";

beforeEach(() => {
  CURRENT = emptyProgress();
});
afterEach(cleanup);

function renderStage(onComplete: (r?: unknown) => void) {
  return render(
    <AuthProvider>
      <ProgressProvider>
        <MockStage onComplete={onComplete} />
      </ProgressProvider>
    </AuthProvider>,
  );
}

/** Flush microtasks so async reasoning/follow-up grades settle between actions. */
async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function setValue(label: RegExp | string, value: string): boolean {
  const els = screen.queryAllByLabelText(label);
  if (els.length === 0) return false;
  fireEvent.change(els[0], { target: { value } });
  return true;
}

function clickBtn(re: RegExp): boolean {
  const btns = screen.queryAllByRole("button", { name: re });
  if (btns.length === 0) return false;
  fireEvent.click(btns[0]);
  return true;
}

function hasLabel(label: RegExp | string): boolean {
  return screen.queryAllByLabelText(label).length > 0;
}

/**
 * Perform exactly ONE forward action against whatever the mock is currently
 * showing. Content-agnostic (the seed is random) — it always answers, resolves
 * every clarify / follow-up, plays market-making rounds, and advances. Returns
 * false when nothing was actionable this tick (an async grade is in flight).
 */
function actOnce(): boolean {
  // Clarify commit (main / probe / adversarial all share this field).
  if (hasLabel("Your committed clarification")) {
    setValue("Your committed clarification", "0");
    return clickBtn(/commit ▸/i);
  }
  // Adversarial follow-up (only ever shown after the probe is resolved).
  if (hasLabel("Your adversarial follow-up answer")) {
    setValue("Your adversarial follow-up answer", "0");
    return clickBtn(/answer ▸/i);
  }
  // Probe follow-up.
  if (hasLabel("Your probe follow-up answer")) {
    setValue("Your probe follow-up answer", "0");
    return clickBtn(/answer ▸/i);
  }
  // Main numeric answer (leave the reasoning blank on purpose).
  if (hasLabel(/^Your answer to:/)) {
    setValue(/^Your answer to:/, "0");
    return clickBtn(/lock in ▸/i);
  }
  // Brainteaser: reveal, then self-assess.
  if (hasLabel("Your reasoning for the brainteaser")) {
    return clickBtn(/reveal ▸/i);
  }
  if (screen.queryAllByRole("button", { name: /^i got it$/i }).length > 0) {
    return clickBtn(/^i got it$/i);
  }
  // Behavioral (unscored) — just advance.
  if (hasLabel("Your behavioral rehearsal")) {
    return clickBtn(/next flashcard ▸|see results ▸/i);
  }
  // Market-making: a tight, valid quote (spread 1 < every cap), then show market.
  if (hasLabel("Bid")) {
    setValue("Bid", "1");
    setValue("Ask", "2");
    return clickBtn(/show market ▸/i);
  }
  // Generic advance for any resolved card.
  return clickBtn(/next question ▸|see results ▸|next flashcard ▸/i);
}

/** Drive the entire mock to its summary screen. */
async function driveToSummary() {
  await flush();
  for (let i = 0; i < 2000; i++) {
    if (screen.queryByTestId("mock-summary")) return;
    actOnce();
    await flush();
  }
  throw new Error("mock did not reach summary within the step budget");
}

/* -------------------------------------------------------------------------- */
/*  Render + live streak readout                                               */
/* -------------------------------------------------------------------------- */

describe("MockStage — render + live streak", () => {
  it("renders the stage, the live streak, and the pinned Optiver demo first", () => {
    renderStage(() => {});
    expect(screen.getByTestId("mock-stage")).toBeTruthy();
    // Fresh progress ⇒ streak 0 ⇒ mock 1 of 3, Optiver preset.
    expect(screen.getByTestId("mock-streak").textContent).toMatch(
      /Mock 1 of 3 consecutive ≥90%/,
    );
    expect(screen.getByText(/Optiver Style/)).toBeTruthy();
    // The pinned firm-signature quadratic demo leads the Optiver mock.
    expect(screen.getByText(/5, 11, 23, 41, 65/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /lock in ▸/i })).toBeTruthy();
  });

  it("reflects an in-progress streak from progress.pipeline.mocks", () => {
    CURRENT = {
      ...emptyProgress(),
      pipeline: {
        stage: "mock",
        mocks: [
          { at: "t", scorePct: 95, wouldPass: "yes" },
          { at: "t", scorePct: 92, wouldPass: "yes" },
        ],
      },
    };
    renderStage(() => {});
    expect(screen.getByTestId("mock-streak").textContent).toMatch(
      /Mock 3 of 3 consecutive ≥90%/,
    );
  });
});

/* -------------------------------------------------------------------------- */
/*  Full run → correctly-shaped PipelineMockResult, handed back exactly once   */
/* -------------------------------------------------------------------------- */

describe("MockStage — completes and hands back a PipelineMockResult once", () => {
  it("produces a correctly-shaped result and calls onComplete exactly once", async () => {
    const onComplete = vi.fn();
    renderStage(onComplete);

    await driveToSummary();

    // Summary is up; the numeric score is rendered against the 90% bar.
    expect(screen.getByTestId("mock-summary")).toBeTruthy();
    const scoreText = screen.getByTestId("mock-score").textContent ?? "";
    expect(scoreText).toMatch(/^\d+%$/);

    const finish = screen.getByTestId("mock-finish");
    await act(async () => {
      fireEvent.click(finish);
    });
    // Pressing finish again must not fire a second completion.
    await act(async () => {
      fireEvent.click(finish);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
    const result = onComplete.mock.calls[0][0] as {
      at: string;
      scorePct: number;
      wouldPass: string;
    };
    expect(typeof result.at).toBe("string");
    expect(result.at.length).toBeGreaterThan(0);
    expect(typeof result.scorePct).toBe("number");
    expect(result.scorePct).toBeGreaterThanOrEqual(0);
    expect(result.scorePct).toBeLessThanOrEqual(100);
    expect(["yes", "borderline", "no"]).toContain(result.wouldPass);
    // The rendered score matches the handed-back score.
    expect(scoreText).toBe(`${result.scorePct}%`);
  }, 60000);

  it("MOCK_GATE_PCT is the 90% bar the summary compares against", () => {
    expect(MOCK_GATE_PCT).toBe(90);
  });
});
