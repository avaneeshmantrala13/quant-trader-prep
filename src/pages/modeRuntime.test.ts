// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { emptyProgress, type UserProgress } from "@/types/progress";

/**
 * Runtime servability of the Goal-Mode surfaces (WS0–WS4): the dashboard renders
 * in BOTH modes, the course page renders, and the diagnostic's mandatory first
 * screen renders — none crash. Plus the two hard invariants: Case B (interview)
 * keeps today's dashboard, and toggling A↔B preserves all progress (mode reads
 * none of the topicKey-keyed mastery store).
 */

const SEED: UserProgress = {
  ...emptyProgress(),
  levelProgress: { "ev-1": { bestScore: 1, mastered: true, attempts: 2 } },
  topicMastery: {
    "probability::Expected Value": {
      theta: 0.5,
      n: 5,
      alpha: 5,
      beta: 1,
      lastSeen: "2026-01-01T00:00:00.000Z",
      misconceptions: {},
    },
  },
};

vi.mock("@/lib/storage", () => ({
  storage: {
    getSession: () => "mode-runtime-test",
    loadProgress: () => structuredClone(SEED),
    saveProgress: () => {},
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
import { BaseDashboard } from "@/themes/BaseDashboard";
// eslint-disable-next-line import/first
import { CourseTrackPage } from "@/pages/CourseTrackPage";
// eslint-disable-next-line import/first
import { DiagnosticPage } from "@/pages/DiagnosticPage";
// eslint-disable-next-line import/first
import { ModeToggle } from "@/components/mode/ModeToggle";
// eslint-disable-next-line import/first
import { resolveGoalMode } from "@/lib/mode/goalMode";
// eslint-disable-next-line import/first
import type { DashboardViewProps } from "@/themes/types";

function wrap(children: ReactNode, initialPath = "/") {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: [initialPath] },
      createElement(
        AuthProvider,
        null,
        createElement(ProgressProvider, null, children),
      ),
    ),
  );
}

function dashProps(goalMode: "course" | "interview"): DashboardViewProps {
  return {
    goalMode,
    courses:
      goalMode === "course"
        ? [
            {
              id: "m362k",
              label: "Intro to Probability",
              blurb: "b",
              href: "/course/m362k",
              masteredCount: 1,
              totalCount: 13,
              pct: 1 / 13,
              nextTopic: { name: "Core Probability", href: "/x" },
              topics: [
                {
                  topicKey: "probability::Expected Value",
                  name: "Expected Value",
                  verdict: "STRONG",
                  hasEvidence: true,
                  mastered: true,
                  shared: false,
                  href: "/y",
                },
              ],
            },
          ]
        : [],
    hasTimingData: false,
    diagnosticDone: true,
    diagnosticHref: "/diagnostic",
    contentsHref: "/contents",
    recommended: undefined,
    topics: [],
    weaknesses: [],
    due: [],
    reliability: {
      bins: [],
      relGap: 0,
      brier: 0,
      count: 0,
      sufficient: false,
      minPairs: 25,
    },
  };
}

afterEach(cleanup);

describe("dashboard renders in both modes", () => {
  it("Case B (interview) shows the weakness ranking, not course cards", () => {
    wrap(createElement(BaseDashboard, dashProps("interview")));
    expect(screen.getByText(/Mastery & Calibration/i)).toBeTruthy();
    expect(screen.getByText(/Weakest First/i)).toBeTruthy();
    expect(screen.queryByText(/Course Readiness/i)).toBeNull();
  });

  it("Case A (course) shows course-readiness cards, not the weakness ranking", () => {
    wrap(createElement(BaseDashboard, dashProps("course")));
    expect(screen.getAllByText(/Course Readiness/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Intro to Probability/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Weakest First/i)).toBeNull();
  });
});

describe("course page renders", () => {
  it("renders the course label + curated topics without crashing", () => {
    wrap(
      createElement(
        Routes,
        null,
        createElement(Route, {
          path: "/course/:courseId",
          element: createElement(CourseTrackPage),
        }),
      ),
      "/course/m362k",
    );
    expect(screen.getAllByText(/Intro to Probability/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Course progress/i)).toBeTruthy();
  });
});

describe("diagnostic mandatory first screen", () => {
  it("renders the mode-select first, offering both focuses", () => {
    wrap(createElement(DiagnosticPage));
    expect(screen.getByText(/What are you here to do\?/i)).toBeTruthy();
    expect(screen.getByText(/Master my probability courses/i)).toBeTruthy();
    expect(
      screen.getByText(/Prep for quant trading interviews/i),
    ).toBeTruthy();
  });
});

describe("toggling A↔B preserves all progress (mode reads no mastery)", () => {
  function Probe() {
    const { progress } = useProgress();
    return createElement(
      "div",
      null,
      createElement("span", { "data-testid": "mode" }, resolveGoalMode(progress)),
      createElement(
        "span",
        { "data-testid": "mastered" },
        String(progress.levelProgress["ev-1"]?.mastered),
      ),
      createElement(
        "span",
        { "data-testid": "theta" },
        String(progress.topicMastery?.["probability::Expected Value"]?.theta),
      ),
      createElement(ModeToggle, { size: "sm" }),
    );
  }

  it("switching to Course mastery keeps level mastery + topic mastery intact", () => {
    wrap(createElement(Probe));
    // Defaults to interview (SEED has no goalMode).
    expect(screen.getByTestId("mode").textContent).toBe("interview");
    expect(screen.getByTestId("mastered").textContent).toBe("true");
    expect(screen.getByTestId("theta").textContent).toBe("0.5");

    fireEvent.click(screen.getByText("Course mastery"));

    expect(screen.getByTestId("mode").textContent).toBe("course");
    // Progress is UNTOUCHED by the mode switch.
    expect(screen.getByTestId("mastered").textContent).toBe("true");
    expect(screen.getByTestId("theta").textContent).toBe("0.5");
  });
});
