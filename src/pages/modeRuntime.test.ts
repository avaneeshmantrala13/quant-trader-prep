// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { emptyProgress, type UserProgress } from "@/types/progress";

/**
 * Runtime servability of the Goal-Mode surfaces. Course remediation is now
 * BACKEND-ONLY: the still-present course code (the `BaseDashboard` course-mode
 * view + the `CourseTrackPage`) must keep rendering when driven directly, but the
 * FRONTEND is quant-only — the diagnostic goes STRAIGHT into the quant
 * assessment with no "course vs interview" pre-question, and there is no mode
 * toggle.
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
import { ThemeProvider } from "@/context/ThemeContext";
// eslint-disable-next-line import/first
import { AuthProvider } from "@/context/AuthContext";
// eslint-disable-next-line import/first
import { ProgressProvider } from "@/context/ProgressContext";
// eslint-disable-next-line import/first
import { BaseDashboard } from "@/themes/BaseDashboard";
// eslint-disable-next-line import/first
import { CourseTrackPage } from "@/pages/CourseTrackPage";
// eslint-disable-next-line import/first
import { DiagnosticPage } from "@/pages/DiagnosticPage";
// eslint-disable-next-line import/first
import type { DashboardViewProps } from "@/themes/types";

function wrap(children: ReactNode, initialPath = "/") {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: [initialPath] },
      createElement(
        ThemeProvider,
        null,
        createElement(
          AuthProvider,
          null,
          createElement(ProgressProvider, null, children),
        ),
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

describe("diagnostic goes straight into the quant assessment", () => {
  it("renders the warm-up intro with no 'course vs interview' pre-question", () => {
    wrap(createElement(DiagnosticPage));
    // The intro (first screen) renders directly — both lanes are offered.
    expect(screen.getByText(/calibrate your starting point/i)).toBeTruthy();
    expect(screen.getAllByText(/Full warm-up/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/self-report/i).length).toBeGreaterThan(0);
    // The removed mode-select pre-question never appears on the frontend.
    expect(screen.queryByText(/What are you here to do\?/i)).toBeNull();
    expect(screen.queryByText(/Master my probability courses/i)).toBeNull();
  });
});
