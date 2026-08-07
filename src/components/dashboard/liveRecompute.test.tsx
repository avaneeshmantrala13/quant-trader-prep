// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { emptyProgress, type UserProgress } from "@/types/progress";
import { topicKeyOf } from "@/lib/mastery/topicKey";
import { MIN_PAIRS } from "@/lib/calibration/reliability";
import type { ItemAttempt } from "@/types/mastery";

/**
 * LIVE-RECOMPUTE GUARD (integration) — the roadmap + calibration dashboard must
 * be REACTIVE to `ProgressContext`, never frozen on a mount-time snapshot.
 *
 * These mount the REAL `ProgressProvider` and drive the REAL context writers
 * (`recordItemAttempt`, `recordCalibrationPair`) inside a SINGLE mounted tree
 * (no remount / reload), then assert the derived views recompute in place:
 *
 *  - Bug 1: mastering Geometric Probability flips its KST roadmap node to
 *    `mastered` (green) immediately.
 *  - Bug 2: a NEW elicited-confidence pair (a Fermi 90% CI) increments the
 *    calibration count immediately, and the panel unlocks the moment the
 *    elicited threshold is met — while ordinary topic mastery (which elicits no
 *    confidence) never moves the count.
 *
 * If either hook regressed to reading a cached snapshot, the counts/colours
 * would stay stale here and the test would fail.
 */

const GEOMETRIC = topicKeyOf("probability", "Geometric Probability");
const FERMI = topicKeyOf("fermi");

let CURRENT: UserProgress = emptyProgress();
vi.mock("@/lib/storage", () => ({
  storage: {
    getSession: () => "live-recompute",
    loadProgress: () => CURRENT,
    saveProgress: (_u: string, next: UserProgress) => {
      CURRENT = next;
    },
    getTheme: () => "dark",
    setTheme: () => {},
    getThemeId: () => "broadsheet",
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
// eslint-disable-next-line import/first
import { useRoadmapData } from "@/components/roadmap/useRoadmapData";
// eslint-disable-next-line import/first
import { useDashboardData } from "@/components/dashboard/useDashboardData";

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

function RoadmapHarness() {
  const { recordItemAttempt } = useProgress();
  const model = useRoadmapData();
  const row = model.rows.find((r) => r.node.topicKey === GEOMETRIC);
  return (
    <div>
      <button
        onClick={() => {
          // Fold enough clean correct items to push CI_low past the 0.8 bar.
          for (let i = 0; i < 40; i++) recordItemAttempt(correct(GEOMETRIC));
        }}
      >
        master
      </button>
      <div data-testid="geo-mastered">{row?.progress.mastered ? "yes" : "no"}</div>
    </div>
  );
}

function CalibrationHarness() {
  const { recordItemAttempt, recordCalibrationPair } = useProgress();
  const model = useDashboardData("2026-02-01T00:00:00.000Z");
  return (
    <div>
      <button onClick={() => recordCalibrationPair(FERMI, 0.9, 1)}>elicit</button>
      <button
        onClick={() => {
          for (let i = 0; i < MIN_PAIRS; i++) recordCalibrationPair(FERMI, 0.9, 1);
        }}
      >
        elicit-many
      </button>
      <button onClick={() => recordItemAttempt(correct(GEOMETRIC))}>topic</button>
      <div data-testid="cal-count">{model.reliability.count}</div>
      <div data-testid="cal-sufficient">
        {model.reliability.sufficient ? "yes" : "no"}
      </div>
    </div>
  );
}

afterEach(() => {
  cleanup();
  CURRENT = emptyProgress();
});

describe("roadmap + calibration recompute live on progress change", () => {
  it("Bug 1: mastering Geometric Probability turns its roadmap node green in place", () => {
    CURRENT = emptyProgress();
    render(
      <AuthProvider>
        <ProgressProvider>
          <RoadmapHarness />
        </ProgressProvider>
      </AuthProvider>,
    );

    expect(screen.getByTestId("geo-mastered").textContent).toBe("no");
    fireEvent.click(screen.getByRole("button", { name: "master" }));
    // No remount / reload — the node recolours to mastered from live context.
    expect(screen.getByTestId("geo-mastered").textContent).toBe("yes");
  });

  it("Bug 2: a new elicited pair updates the calibration count immediately; topics don't", () => {
    CURRENT = emptyProgress();
    render(
      <AuthProvider>
        <ProgressProvider>
          <CalibrationHarness />
        </ProgressProvider>
      </AuthProvider>,
    );

    expect(screen.getByTestId("cal-count").textContent).toBe("0");
    expect(screen.getByTestId("cal-sufficient").textContent).toBe("no");

    // Mastering a normal topic elicits NO confidence → the count must NOT move.
    fireEvent.click(screen.getByRole("button", { name: "topic" }));
    expect(screen.getByTestId("cal-count").textContent).toBe("0");

    // A genuine elicited pair (Fermi 90% CI) increments the count immediately.
    fireEvent.click(screen.getByRole("button", { name: "elicit" }));
    expect(screen.getByTestId("cal-count").textContent).toBe("1");

    // Reaching the elicited threshold unlocks the graph without a reload.
    fireEvent.click(screen.getByRole("button", { name: "elicit-many" }));
    expect(Number(screen.getByTestId("cal-count").textContent)).toBeGreaterThanOrEqual(
      MIN_PAIRS,
    );
    expect(screen.getByTestId("cal-sufficient").textContent).toBe("yes");
  });
});
