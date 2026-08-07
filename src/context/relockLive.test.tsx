// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { emptyProgress, type UserProgress } from "@/types/progress";
import { applyDiagnosticSeed } from "@/lib/mastery/mastery";
import { isTopicUnlocked } from "@/lib/mastery/unlock";
import { CONDITIONAL, prereqNode } from "@/content/remediation/prereqDAG";
import type { ItemAttempt } from "@/types/mastery";

/**
 * PART-B LIVE-PATH GUARD (integration) — swing-and-relock → prerequisite probe.
 *
 * Proves the recovered `relock` module is genuinely ON the runtime path (not dead
 * code): we mount the REAL `ProgressProvider` and drive the REAL
 * `recordItemAttempt` — the single mastery-fold entry point every graded
 * quiz/numeric attempt flows through — seeded so `CONDITIONAL` is held at a
 * diagnostic LOW-CONFIDENCE unlock (2/2 ⇒ α=3, β=1, mean 0.75 > the 0.70 unlock
 * bar, but NOT confidently mastered). One FAILING attempt swings its Beta mean
 * back under the bar and RE-LOCKS it.
 *
 * We then assert `recordItemAttempt`:
 *   • re-locked the topic (`isTopicUnlocked` flips true → false), AND
 *   • returned a `relock` remediation action that DESCENDS to a genuine
 *     prerequisite of `CONDITIONAL` (the ~0.85 ZPD probe target).
 *
 * If the relock wiring were removed from `recordItemAttempt` (or the module
 * deleted again), `relock` would be null — this test would fail, guarding the
 * live path against the dead-code regression.
 */

function seededProgress(): UserProgress {
  const p = emptyProgress();
  // A strong 2/2 diagnostic seed: unlocked, but low-confidence (fragile).
  p.topicMastery = {
    [CONDITIONAL]: applyDiagnosticSeed(undefined, {
      successes: 2,
      failures: 0,
      at: "2026-01-01T00:00:00.000Z",
    }),
  };
  return p;
}

let CURRENT: UserProgress = seededProgress();
vi.mock("@/lib/storage", () => ({
  storage: {
    getSession: () => "relock-live",
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
import { AuthProvider } from "./AuthContext";
// eslint-disable-next-line import/first
import {
  ProgressProvider,
  useProgress,
  type ItemAttemptResult,
} from "./ProgressContext";

function fail(topicKey: string): ItemAttempt {
  return {
    topicKey,
    tier: "medium",
    correct: false,
    mode: "quiz",
    kOptions: 4,
    at: "2026-02-01T00:00:00.000Z",
  };
}

/** Fires ONE failing attempt on CONDITIONAL and surfaces the relock result. */
function Harness() {
  const { progress, recordItemAttempt } = useProgress();
  const [res, setRes] = useState<ItemAttemptResult | null>(null);
  const m = progress.topicMastery?.[CONDITIONAL];
  return (
    <div>
      <button onClick={() => setRes(recordItemAttempt(fail(CONDITIONAL)))}>
        fail
      </button>
      <div data-testid="unlocked">{isTopicUnlocked(m) ? "yes" : "no"}</div>
      <div data-testid="relock-kind">
        {res ? (res.relock ? res.relock.kind : "none") : "unrun"}
      </div>
      <div data-testid="relock-target">
        {res && res.relock && res.relock.kind === "descend"
          ? res.relock.toTopicKey
          : ""}
      </div>
    </div>
  );
}

afterEach(() => {
  cleanup();
  CURRENT = seededProgress();
});

describe("recordItemAttempt surfaces a relock remediation on the live path", () => {
  it("re-locks a failed low-confidence unlock and routes to the prerequisite probe", () => {
    CURRENT = seededProgress();
    render(
      <AuthProvider>
        <ProgressProvider>
          <Harness />
        </ProgressProvider>
      </AuthProvider>,
    );

    // Before the attempt: CONDITIONAL is unlocked (diagnostic seed).
    expect(screen.getByTestId("unlocked").textContent).toBe("yes");
    expect(screen.getByTestId("relock-kind").textContent).toBe("unrun");

    fireEvent.click(screen.getByRole("button", { name: "fail" }));

    // The single failing item swung the Beta mean under the unlock bar → RE-LOCK.
    expect(screen.getByTestId("unlocked").textContent).toBe("no");

    // …and `recordItemAttempt` returned a planned descent to a real prerequisite.
    expect(screen.getByTestId("relock-kind").textContent).toBe("descend");
    const target = screen.getByTestId("relock-target").textContent ?? "";
    expect(prereqNode(CONDITIONAL)!.prereqs).toContain(target);
  });
});
