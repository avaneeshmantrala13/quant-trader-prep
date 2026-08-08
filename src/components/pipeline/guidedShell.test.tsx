// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { emptyProgress, type UserProgress } from "@/types/progress";
import { topicKeyOf } from "@/lib/mastery/topicKey";
import type { ItemAttempt } from "@/types/mastery";

/**
 * Guided-shell integration tests (Phase P1). The shell is FLAG-OFF in the live
 * app, but must be fully dev-testable: rendered directly it resolves the stage
 * from progress, renders the registry's stage screen, and wires the header
 * controls (Sign out + light/dark toggle) and the read-only Progress panel.
 */

const GEOMETRIC = topicKeyOf("probability", "Geometric Probability");

let CURRENT: UserProgress = emptyProgress();
const logOutSpy = vi.fn();
vi.mock("@/lib/storage", () => ({
  storage: {
    getSession: () => "guided-shell-user",
    loadProgress: () => CURRENT,
    saveProgress: (_u: string, next: UserProgress) => {
      CURRENT = next;
    },
    getTheme: () => "light",
    setTheme: () => {},
    getThemeId: () => "minimalist",
    setThemeId: () => {},
    logOut: () => logOutSpy(),
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
import { ThemeProvider } from "@/context/ThemeContext";
// eslint-disable-next-line import/first
import { ProgressProvider, useProgress } from "@/context/ProgressContext";
// eslint-disable-next-line import/first
import { GuidedShell } from "./GuidedShell";
// eslint-disable-next-line import/first
import { ProgressPanel } from "./ProgressPanel";
// eslint-disable-next-line import/first
import { PIPELINE_ENABLED } from "./RequirePipelineStage";

beforeEach(() => {
  CURRENT = emptyProgress();
  logOutSpy.mockClear();
  document.documentElement.classList.remove("dark");
});
afterEach(cleanup);

function renderShell(props?: Parameters<typeof GuidedShell>[0]) {
  return render(
    <ThemeProvider>
      <AuthProvider>
        <ProgressProvider>
          <GuidedShell {...props} />
        </ProgressProvider>
      </AuthProvider>
    </ThemeProvider>,
  );
}

describe("GuidedShell", () => {
  it("is flag-ON in the live app after the cutover", () => {
    expect(PIPELINE_ENABLED).toBe(true);
  });

  it("renders the resolved first stage in the 'Your Next Task' area", async () => {
    renderShell();
    // The task area always mounts; the untimed diagnostic is now a real screen.
    expect(await screen.findByTestId("next-task")).toBeTruthy();
    // Empty progress ⇒ resolveStage ⇒ the untimed diagnostic (stage 2).
    expect(await screen.findByTestId("untimed-diagnostic-stage")).toBeTruthy();
    const stepper = screen.getByTestId("stage-stepper");
    const active = stepper.querySelector('[data-state="active"]');
    expect(active?.getAttribute("data-step")).toBe("diagnostic-untimed");
  });

  it("renders any stage passed via stageOverride (registry-driven, real screen)", async () => {
    renderShell({ stageOverride: "greenlight" });
    // The registry now maps every stage to its REAL screen.
    expect(await screen.findByTestId("greenlight-stage")).toBeTruthy();
    // The stepper reflects the same stage.
    const stepper = screen.getByTestId("stage-stepper");
    const active = stepper.querySelector('[data-state="active"]');
    expect(active?.getAttribute("data-step")).toBe("greenlight");
  });

  it("exposes a working light/dark toggle (theme hard-locked to minimalist)", async () => {
    renderShell({ stageOverride: "diagnosis" });
    await screen.findByTestId("diagnosis-stage");
    // Starts light (storage.getTheme ⇒ "light").
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    const toggle = screen.getByRole("button", { name: /switch to dark mode/i });
    fireEvent.click(toggle);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    // Toggling back returns to light.
    fireEvent.click(screen.getByRole("button", { name: /switch to light mode/i }));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    // The visual theme is the locked minimalist one.
    expect(document.documentElement.dataset.theme).toBe("minimalist");
  });

  it("wires a Sign out control to the auth logout", async () => {
    renderShell({ stageOverride: "diagnosis" });
    await screen.findByTestId("diagnosis-stage");
    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
    expect(logOutSpy).toHaveBeenCalledTimes(1);
  });

  it("forwards stage completion (stage + payload) to onStageComplete", async () => {
    const onStageComplete = vi.fn();
    renderShell({ stageOverride: "diagnosis", onStageComplete });
    await screen.findByTestId("diagnosis-stage");
    // The real DiagnosisStage's Continue hands back the computed diagnosis.
    fireEvent.click(screen.getByTestId("diagnosis-continue"));
    expect(onStageComplete).toHaveBeenCalledTimes(1);
    expect(onStageComplete.mock.calls[0][0]).toBe("diagnosis");
    expect(onStageComplete.mock.calls[0][1]).toMatchObject({
      ranked: expect.any(Array),
    });
  });
});

/* -------------------------------------------------------------------------- */
/*  Progress panel — reads live mastery data                                   */
/* -------------------------------------------------------------------------- */

function correct(topicKey: string): ItemAttempt {
  return {
    topicKey,
    tier: "medium",
    correct: true,
    mode: "quiz",
    kOptions: 4,
    at: "2026-02-01T00:00:00.000Z",
  };
}

function PanelHarness() {
  const { recordItemAttempt } = useProgress();
  return (
    <div>
      <button
        onClick={() => {
          for (let i = 0; i < 40; i++) recordItemAttempt(correct(GEOMETRIC));
        }}
      >
        master
      </button>
      <ProgressPanel />
    </div>
  );
}

describe("ProgressPanel (read-only mastery projection)", () => {
  function renderPanel() {
    return render(
      <ThemeProvider>
        <AuthProvider>
          <ProgressProvider>
            <PanelHarness />
          </ProgressProvider>
        </AuthProvider>
      </ThemeProvider>,
    );
  }

  it("renders readiness + per-tier rows from useRoadmapData", () => {
    renderPanel();
    const panel = screen.getByTestId("progress-panel");
    expect(panel).toBeTruthy();
    // Overall readiness is shown as a percentage.
    expect(screen.getByTestId("overall-readiness").textContent).toMatch(/%$/);
    // Several curriculum tiers are projected.
    expect(screen.getAllByTestId("tier-row").length).toBeGreaterThan(0);
    // Nothing mastered yet on a fresh progress.
    expect(panel.textContent).toContain("0 of");
  });

  it("recomputes mastered counts when mastery data changes (reactive)", () => {
    renderPanel();
    const panel = screen.getByTestId("progress-panel");
    expect(panel.textContent).toContain("0 of");
    act(() => {
      screen.getByRole("button", { name: "master" }).click();
    });
    // Mastering a topic bumps the mastered count off zero.
    expect(screen.getByTestId("progress-panel").textContent).not.toContain(
      "0 of",
    );
  });
});
