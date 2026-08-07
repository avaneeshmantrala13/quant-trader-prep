// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { emptyProgress } from "@/types/progress";
import { MISCONCEPTION } from "@/lib/tutor/misconception";
import { CONDITIONAL } from "@/content/remediation/prereqDAG";
import type { RemediationInput } from "@/lib/remediation/policy";

/**
 * The finish-time remediation FLOW component renders (and is always escapable).
 *
 * This mounts the real `FinishRemediation` — the descent → probe → climb-back UI
 * auto-launched on a weak finish — with a bottomed-out origin, and asserts it:
 *   1. actually descends and serves a Foundation Probe (not a dead end), and
 *   2. always offers a way OUT to the results (never an inescapable loop).
 */

vi.mock("@/lib/storage", () => ({
  storage: {
    getSession: () => "finish-remediation-test",
    loadProgress: () => emptyProgress(),
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
import { ProgressProvider } from "@/context/ProgressContext";
// eslint-disable-next-line import/first
import { FinishRemediation } from "@/pages/LessonPage";

/** A bottomed-out origin (θ=-2) that fails Conditional Probability with a
 *  reversed-conditional gap ⇒ the policy descends the prereq DAG. */
const weakOrigin: RemediationInput = {
  topicKey: CONDITIONAL,
  theta: -2,
  alpha: 1,
  beta: 3,
  n: 4,
  consecutiveMisses: 2,
  atFloorTier: true,
  misconceptionTag: MISCONCEPTION.reversedConditional,
  responseFast: false,
  depthThisSession: 0,
};

function mount(onDone: () => void) {
  return render(
    createElement(
      AuthProvider,
      null,
      createElement(
        ProgressProvider,
        null,
        createElement(FinishRemediation, { origin: weakOrigin, onDone }),
      ),
    ),
  );
}

afterEach(cleanup);

describe("FinishRemediation component", () => {
  it("descends and serves a Foundation Probe on a weak finish", () => {
    mount(() => {});
    // The intro explains WHY the learner is being remediated…
    expect(
      screen.getByText(/Foundation Check Before You Move On/i),
    ).toBeTruthy();
    // …and a real prerequisite probe is served (not a dead end / blank panel).
    expect(screen.getByText(/Foundation Probe/i)).toBeTruthy();
  });

  it("always offers an escape to the results (no inescapable loop)", () => {
    const onDone = vi.fn();
    mount(onDone);
    const skip = screen.getByText(/Skip remediation: see my results/i);
    fireEvent.click(skip);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
