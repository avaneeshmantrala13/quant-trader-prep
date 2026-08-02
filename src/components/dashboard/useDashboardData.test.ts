// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { emptyProgress, type GoalMode, type UserProgress } from "@/types/progress";
import { isCourseTopic } from "@/lib/mode/courseMap";
import type { DashboardTopic } from "./useDashboardData";
import { scopeTopicsToMode } from "./useDashboardData";

/**
 * Part 1 — the Case-A dashboard must ONLY ever surface course topics as a
 * weak spot / recommended focus / review. Foundations (Mental Arithmetic) and
 * quant-only topics (Kelly/Betting) must never appear on those focus surfaces
 * in course mode, while Case B (interview) keeps the current global pool.
 */

/* ----------------------------- pure filter -------------------------------- */

function dt(topicKey: string): DashboardTopic {
  return {
    topicKey,
    trackId: topicKey.split("::")[0],
    trackTitle: "T",
    label: "L",
    firstLevelId: "x-1",
    unlocked: true,
    // minimal verdict; only topicKey is read by scopeTopicsToMode
    verdict: {
      topicKey,
      state: "WEAK",
      mean: 0.4,
      lo: 0.3,
      hi: 0.6,
      n: 5,
      theta: 0,
      namedMisconceptions: [],
      mastered: false,
    },
  };
}

describe("scopeTopicsToMode", () => {
  const pool = [
    dt("mental-math::_core"), // foundation
    dt("math-questions::Rates, Algebra & Word Problems"), // foundation
    dt("probability::Expected Value"), // course (m362k primary)
    dt("probability::Conditional Probability"), // course (shared, m362m)
    dt("probability::Markov Chains"), // course (m362m primary)
    dt("probability::Betting & Sizing"), // quant-only "beyond"
    dt("interview-games::_core"), // quant-only "beyond"
    dt("brainteasers::Core Puzzles"), // quant-only "beyond"
  ];

  it("course mode keeps ONLY course topics (primary + shared)", () => {
    const scoped = scopeTopicsToMode(pool, "course").map((t) => t.topicKey);
    expect(scoped).toEqual([
      "probability::Expected Value",
      "probability::Conditional Probability",
      "probability::Markov Chains",
    ]);
    // Every survivor is a course topic; nothing foundation/quant survives.
    expect(scoped.every((k) => isCourseTopic(k))).toBe(true);
    expect(scoped).not.toContain("mental-math::_core");
    expect(scoped).not.toContain("probability::Betting & Sizing");
    expect(scoped).not.toContain("interview-games::_core");
  });

  it("interview mode is a pass-through (Case B unchanged)", () => {
    const scoped = scopeTopicsToMode(pool, "interview");
    expect(scoped).toBe(pool); // identity — no filtering, no copy
  });
});

/* --------------------------- hook integration ----------------------------- */

// A learner with graded evidence on a foundation topic, a course topic, and a
// quant-only topic — all weak — so the mode pool is what decides what surfaces.
const SEED_BASE: UserProgress = {
  ...emptyProgress(),
  diagnosticDoneAt: "2026-01-01T00:00:00.000Z",
  topicMastery: {
    "mental-math::_core": {
      theta: -0.5,
      n: 10,
      alpha: 2,
      beta: 8,
      lastSeen: "2026-01-01T00:00:00.000Z",
      misconceptions: {},
    },
    "probability::Core Probability": {
      theta: -0.2,
      n: 10,
      alpha: 4,
      beta: 6,
      lastSeen: "2026-01-01T00:00:00.000Z",
      misconceptions: {},
    },
    "probability::Betting & Sizing": {
      theta: -0.3,
      n: 10,
      alpha: 3,
      beta: 7,
      lastSeen: "2026-01-01T00:00:00.000Z",
      misconceptions: {},
    },
  },
};

let seedGoalMode: GoalMode | undefined;

vi.mock("@/lib/storage", () => ({
  storage: {
    getSession: () => "usedash-test",
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
import { useDashboardData } from "./useDashboardData";

const NOW = "2026-06-01T00:00:00.000Z";

function Probe() {
  const model = useDashboardData(NOW);
  return createElement(
    "div",
    null,
    createElement("span", { "data-testid": "mode" }, model.goalMode),
    createElement(
      "span",
      { "data-testid": "weak" },
      model.weaknesses.map((t) => t.topicKey).join("|"),
    ),
    createElement(
      "span",
      { "data-testid": "rec" },
      model.recommended?.topicKey ?? "",
    ),
  );
}

function wrap(children: ReactNode) {
  return render(
    createElement(
      AuthProvider,
      null,
      createElement(ProgressProvider, null, children),
    ),
  );
}

afterEach(cleanup);

describe("useDashboardData focus surfaces are mode-scoped", () => {
  it("Case A (course): weakness ranking + recommended contain ONLY course topics", () => {
    seedGoalMode = "course";
    wrap(createElement(Probe));

    expect(screen.getByTestId("mode").textContent).toBe("course");

    const weak = screen.getByTestId("weak").textContent!;
    const weakKeys = weak ? weak.split("|") : [];
    expect(weakKeys.length).toBeGreaterThan(0);
    // Every weakness is a course topic — no Foundations, no quant-only.
    expect(weakKeys.every((k) => isCourseTopic(k))).toBe(true);
    expect(weakKeys).not.toContain("mental-math::_core");
    expect(weakKeys).not.toContain("probability::Betting & Sizing");

    // Recommended is the unlocked course weakness (Core Probability), never
    // Mental Arithmetic or a quant-only topic.
    const rec = screen.getByTestId("rec").textContent!;
    expect(rec).toBe("probability::Core Probability");
    expect(isCourseTopic(rec)).toBe(true);
  });

  it("Case B (interview): the global pool still surfaces Foundations", () => {
    seedGoalMode = "interview";
    wrap(createElement(Probe));

    expect(screen.getByTestId("mode").textContent).toBe("interview");
    const weak = screen.getByTestId("weak").textContent!.split("|");
    // Proof the pool differs: the foundation topic IS a candidate in Case B.
    expect(weak).toContain("mental-math::_core");
    expect(weak).toContain("probability::Betting & Sizing");
  });
});
