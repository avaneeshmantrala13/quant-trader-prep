// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { emptyProgress, type UserProgress } from "@/types/progress";
import type { TopicMastery } from "@/types/mastery";
import type { Diagnosis } from "@/lib/pipeline/diagnosis";
import {
  COMPETENCY_BRAINTEASER,
  TRADING_SUBTOPIC_KEYS,
  scoredContentTopicKeys,
} from "@/lib/pipeline/gates";

/**
 * Stage-5 (backend diagnosis) tests (Phase P6): the screen renders the ranked
 * weakest→strongest report + the drill plan from the pure `computeDiagnosis`,
 * and pressing Continue hands the computed diagnosis back via `onComplete`
 * exactly once so the coordinator can stamp `diagnosisComputedAt` and advance.
 */

let CURRENT: UserProgress = emptyProgress();
vi.mock("@/lib/storage", () => ({
  storage: {
    getSession: () => "diagnosis-user",
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
import DiagnosisStage from "./DiagnosisStage";

function mastered(): TopicMastery {
  return { theta: 2, n: 62, alpha: 60, beta: 2, lastSeen: "t", misconceptions: {} };
}

/** Content + both competencies mastered, with a cleared timed section. */
function fullyClearedProgress(): UserProgress {
  const p = emptyProgress();
  const tm: Record<string, TopicMastery> = {};
  for (const key of scoredContentTopicKeys()) tm[key] = mastered();
  tm[COMPETENCY_BRAINTEASER] = mastered();
  for (const key of TRADING_SUBTOPIC_KEYS) tm[key] = mastered();
  p.topicMastery = tm;
  p.pipeline = {
    stage: "diagnosis",
    timed: {
      correct: 28,
      total: 30,
      sections: [{ label: "timed", correct: 28, total: 30 }],
    },
  };
  return p;
}

beforeEach(() => {
  CURRENT = emptyProgress();
});
afterEach(cleanup);

function renderStage(onComplete: (r?: unknown) => void) {
  return render(
    <AuthProvider>
      <ProgressProvider>
        <DiagnosisStage onComplete={onComplete} />
      </ProgressProvider>
    </AuthProvider>,
  );
}

describe("DiagnosisStage — renders the ranked report + drill plan", () => {
  it("shows the ranked weakness list and a non-empty plan for a fresh learner", () => {
    renderStage(() => {});
    expect(screen.getByTestId("diagnosis-stage")).toBeTruthy();
    // A fresh learner has every content node + both competencies open.
    expect(screen.getByTestId("diagnosis-ranked").children.length).toBeGreaterThan(0);
    expect(screen.getByTestId("diagnosis-plan")).toBeTruthy();
    expect(screen.queryByTestId("diagnosis-plan-empty")).toBeNull();
  });

  it("shows the cleared 'no drilling required' state when every bar is met", () => {
    CURRENT = fullyClearedProgress();
    renderStage(() => {});
    expect(screen.getByTestId("diagnosis-plan-empty")).toBeTruthy();
    expect(screen.queryByTestId("diagnosis-plan")).toBeNull();
  });
});

describe("DiagnosisStage — Continue hands back the diagnosis via onComplete", () => {
  it("calls onComplete once with a diagnosis payload (ranked + plan + cleared)", () => {
    const onComplete = vi.fn();
    renderStage(onComplete);
    fireEvent.click(screen.getByTestId("diagnosis-continue"));
    expect(onComplete).toHaveBeenCalledTimes(1);
    const payload = onComplete.mock.calls[0][0] as Diagnosis;
    expect(Array.isArray(payload.ranked)).toBe(true);
    expect(Array.isArray(payload.plan)).toBe(true);
    expect(payload.ranked.length).toBeGreaterThan(0);
    expect(payload.cleared).toBe(false);
  });

  it("does NOT call onComplete on mount (it is a read-only report until Continue)", () => {
    const onComplete = vi.fn();
    renderStage(onComplete);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("calls onComplete only once even if Continue is pressed twice", () => {
    const onComplete = vi.fn();
    renderStage(onComplete);
    const btn = screen.getByTestId("diagnosis-continue");
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
