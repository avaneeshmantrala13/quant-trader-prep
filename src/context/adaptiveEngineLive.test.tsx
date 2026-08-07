// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { emptyProgress, type UserProgress } from "@/types/progress";
import { tierDifficultyKey } from "@/lib/mastery/topicKey";
import type { ItemAttempt } from "@/types/mastery";

/**
 * T12 LIVE-PATH GUARD (integration).
 *
 * Proves the adaptive engine is genuinely on the RUNTIME path — not just imported
 * by a type. We mount the REAL `ProgressProvider` and drive the REAL
 * `recordItemAttempt` (the single mastery-fold entry point every quiz / numeric /
 * flashcard / remediation attempt flows through). After a handful of graded
 * attempts we assert the persisted `UserProgress` carries:
 *   • a per-(topic,tier) Glicko difficulty rating that MOVED off the default
 *     (updateItemDifficulty was invoked in the fold), and
 *   • a fitted per-topic IRT ability (estimateAbility2PL was invoked once the
 *     rolling buffer crossed IRT_MIN_RESPONSES).
 *
 * If the engine were deleted (or un-wired from `recordItemAttempt`) neither field
 * would appear and this test would fail — the guard against dead code returning.
 */

let CURRENT: UserProgress = emptyProgress();
vi.mock("@/lib/storage", () => ({
  storage: {
    getSession: () => "t12-live",
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
import { ProgressProvider, useProgress } from "./ProgressContext";

const TOPIC = "probability::_core";
const TIER = "medium" as const;

function attempt(correct: boolean, i: number): ItemAttempt {
  return {
    topicKey: TOPIC,
    tier: TIER,
    correct,
    mode: "numeric",
    at: `2026-05-01T00:00:${String(i).padStart(2, "0")}.000Z`,
  };
}

/** A tiny consumer that fires N graded attempts and renders the engine state. */
function Harness({ n }: { n: number }) {
  const { progress, recordItemAttempt } = useProgress();
  const g = progress.glickoDifficulty?.[tierDifficultyKey(TOPIC, TIER)];
  const irt = progress.topicMastery?.[TOPIC]?.irtAbility;
  return (
    <div>
      <button
        onClick={() => {
          for (let i = 0; i < n; i++) recordItemAttempt(attempt(true, i));
        }}
      >
        run
      </button>
      <div data-testid="glicko">{g ? String(g.rating) : "none"}</div>
      <div data-testid="irt">{irt !== undefined ? "fit" : "none"}</div>
    </div>
  );
}

afterEach(() => {
  cleanup();
  CURRENT = emptyProgress();
});

describe("recordItemAttempt drives the adaptive engine (live ProgressContext path)", () => {
  it("persists a Glicko difficulty rating and a fitted IRT ability", () => {
    CURRENT = emptyProgress();
    render(
      <AuthProvider>
        <ProgressProvider>
          <Harness n={6} />
        </ProgressProvider>
      </AuthProvider>,
    );

    // Before any attempt: no engine state.
    expect(screen.getByTestId("glicko").textContent).toBe("none");
    expect(screen.getByTestId("irt").textContent).toBe("none");

    fireEvent.click(screen.getByRole("button", { name: "run" }));

    // Glicko was folded in: a rating now exists and moved off the 1500 default
    // (6 correct answers ⇒ the item looks easier ⇒ rating < 1500).
    const rating = Number(screen.getByTestId("glicko").textContent);
    expect(Number.isFinite(rating)).toBe(true);
    expect(rating).toBeLessThan(1500);

    // IRT ability was fit once the rolling buffer crossed the threshold.
    expect(screen.getByTestId("irt").textContent).toBe("fit");
  });
});
