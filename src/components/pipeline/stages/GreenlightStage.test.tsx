// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { emptyProgress, type UserProgress } from "@/types/progress";

/**
 * Stage-8 (GREENLIGHT) component tests (Phase P7). The terminal celebratory
 * screen shown once every gate is cleared: it announces readiness, reflects the
 * cleared streak from `progress.pipeline.mocks`, and never forces an advance
 * (`onComplete` stays optional / uncalled).
 */

let CURRENT: UserProgress = emptyProgress();
vi.mock("@/lib/storage", () => ({
  storage: {
    getSession: () => "greenlight-user",
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

// Confetti is purely decorative; keep the terminal screen deterministic + quiet.
vi.mock("@/lib/celebrate", () => ({ celebrate: vi.fn() }));

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
import GreenlightStage from "./GreenlightStage";
// eslint-disable-next-line import/first
import { celebrate } from "@/lib/celebrate";

function clearedProgress(): UserProgress {
  return {
    ...emptyProgress(),
    pipeline: {
      stage: "greenlight",
      mocks: [
        { at: "t", scorePct: 91, wouldPass: "yes" },
        { at: "t", scorePct: 96, wouldPass: "yes" },
        { at: "t", scorePct: 93, wouldPass: "yes" },
      ],
    },
  };
}

beforeEach(() => {
  CURRENT = clearedProgress();
  vi.clearAllMocks();
});
afterEach(cleanup);

function renderStage(onComplete: (r?: unknown) => void = () => {}) {
  return render(
    <AuthProvider>
      <ProgressProvider>
        <GreenlightStage onComplete={onComplete} />
      </ProgressProvider>
    </AuthProvider>,
  );
}

describe("GreenlightStage — terminal cleared screen", () => {
  it("renders the cleared 'greenlit to apply' state", () => {
    renderStage();
    expect(screen.getByTestId("greenlight-stage")).toBeTruthy();
    expect(screen.getByText(/greenlit to apply to quant firms/i)).toBeTruthy();
  });

  it("reflects the cleared streak and best mock from progress", () => {
    renderStage();
    // 3 consecutive ≥90% ⇒ streak 3/3; best of {91,96,93} = 96%.
    expect(screen.getByText("3 / 3")).toBeTruthy();
    expect(screen.getByText("96%")).toBeTruthy();
  });

  it("lists every cleared gate including the 3-consecutive-mock gate", () => {
    renderStage();
    expect(screen.getByText(/3 consecutive mocks ≥ 90%/i)).toBeTruthy();
  });

  it("is terminal — it never calls onComplete (no forced advance)", () => {
    const onComplete = vi.fn();
    renderStage(onComplete);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("fires the on-brand celebration once on mount", () => {
    renderStage();
    expect(celebrate).toHaveBeenCalledTimes(1);
  });
});
