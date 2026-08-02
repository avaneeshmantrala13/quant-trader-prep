// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { emptyProgress, type GoalMode, type UserProgress } from "@/types/progress";

/**
 * Part 2 (WS3) — the Case-A roadmap regroups the flat interview pathway into the
 * TWO course paths (Intro to Probability + Intro to Stochastic Processes), each
 * with per-topic state and a per-path progress indicator, and drops Foundations
 * / quant-only topics. Case B (interview / unset) keeps the interview tiers
 * exactly as today.
 */

// Core Probability seeded as confidently mastered (ci_low ≥ bar) so a path
// shows a non-zero mastered count.
const SEED_BASE: UserProgress = {
  ...emptyProgress(),
  diagnosticDoneAt: "2026-01-01T00:00:00.000Z",
  topicMastery: {
    "probability::Core Probability": {
      theta: 1.5,
      n: 42,
      alpha: 40,
      beta: 2,
      lastSeen: "2026-01-01T00:00:00.000Z",
      misconceptions: {},
    },
  },
};

let seedGoalMode: GoalMode | undefined;

vi.mock("@/lib/storage", () => ({
  storage: {
    getSession: () => "roadmap-mode-test",
    loadProgress: () => ({
      ...structuredClone(SEED_BASE),
      goalMode: seedGoalMode,
    }),
    saveProgress: () => {},
    getTheme: () => "dark",
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
import { ProgressProvider } from "@/context/ProgressContext";
// eslint-disable-next-line import/first
import { RoadmapPage } from "./RoadmapPage";
// eslint-disable-next-line import/first
import { useRoadmapData } from "@/components/roadmap/useRoadmapData";

function wrap(children: ReactNode) {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: ["/roadmap"] },
      createElement(
        AuthProvider,
        null,
        createElement(ProgressProvider, null, children),
      ),
    ),
  );
}

afterEach(cleanup);

/* --------------------------- model (structure) ---------------------------- */

function PathProbe() {
  const model = useRoadmapData();
  const k = model.coursePaths.find((p) => p.id === "m362k")!;
  const m = model.coursePaths.find((p) => p.id === "m362m")!;
  return createElement(
    "div",
    null,
    createElement("span", { "data-testid": "npaths" }, String(model.coursePaths.length)),
    createElement("span", { "data-testid": "k-topics" }, k.rows.map((r) => r.node.topicKey).join("|")),
    createElement("span", { "data-testid": "m-topics" }, m.rows.map((r) => r.node.topicKey).join("|")),
    createElement("span", { "data-testid": "k-total" }, String(k.totalCount)),
    createElement("span", { "data-testid": "m-total" }, String(m.totalCount)),
    createElement("span", { "data-testid": "k-mastered" }, String(k.masteredCount)),
    createElement("span", { "data-testid": "k-readiness" }, String(k.readiness)),
  );
}

describe("useRoadmapData course paths", () => {
  it("builds exactly two course paths from courseMap primary topics", () => {
    seedGoalMode = "course";
    wrap(createElement(PathProbe));

    expect(screen.getByTestId("npaths").textContent).toBe("2");
    expect(screen.getByTestId("k-total").textContent).toBe("13");
    expect(screen.getByTestId("m-total").textContent).toBe("6");

    const kTopics = screen.getByTestId("k-topics").textContent!.split("|");
    // Intro to Probability owns these; foundations / quant-only never appear.
    expect(kTopics).toContain("probability::Core Probability");
    expect(kTopics).toContain("probability::Expected Value");
    expect(kTopics).toContain("probability::Joint Distributions");
    expect(kTopics).not.toContain("mental-math::_core");
    expect(kTopics).not.toContain("probability::Betting & Sizing");
    expect(kTopics).not.toContain("interview-games::_core");

    const mTopics = screen.getByTestId("m-topics").textContent!.split("|");
    expect(mTopics).toContain("probability::Markov Chains");
    expect(mTopics).toContain("probability::Brownian Motion");
    expect(mTopics).toContain("probability::Conditional Expectation");
    // Shared topics live under their owning course (m362k), not duplicated here.
    expect(mTopics).not.toContain("probability::Conditional Probability");
  });

  it("per-path progress reflects mastery (Core Probability mastered)", () => {
    seedGoalMode = "course";
    wrap(createElement(PathProbe));
    expect(Number(screen.getByTestId("k-mastered").textContent)).toBeGreaterThanOrEqual(1);
    expect(Number(screen.getByTestId("k-readiness").textContent)).toBeGreaterThan(0);
  });
});

/* ----------------------------- page rendering ----------------------------- */

describe("RoadmapPage is mode-aware", () => {
  it("Case A (course): renders the two course paths, not the interview tiers", () => {
    seedGoalMode = "course";
    wrap(createElement(RoadmapPage));

    expect(screen.getAllByText("Course Roadmap").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Intro to Probability/i).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/Intro to Stochastic Processes/i).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/Course progress/i).length).toBe(2);
    // No interview-flavored roadmap chrome in course mode.
    expect(screen.queryByText(/Interview readiness/i)).toBeNull();
    expect(screen.queryByText("Skill Roadmap")).toBeNull();
  });

  it("Case B (interview): renders today's interview tiers, unchanged", () => {
    seedGoalMode = "interview";
    wrap(createElement(RoadmapPage));

    expect(screen.getByText("Skill Roadmap")).toBeTruthy();
    expect(screen.getByText(/Interview readiness/i)).toBeTruthy();
    expect(screen.queryByText("Course Roadmap")).toBeNull();
  });

  it("unset goalMode defaults to Case B (interview) roadmap", () => {
    seedGoalMode = undefined;
    wrap(createElement(RoadmapPage));
    expect(screen.getByText("Skill Roadmap")).toBeTruthy();
    expect(screen.queryByText("Course Roadmap")).toBeNull();
  });
});
