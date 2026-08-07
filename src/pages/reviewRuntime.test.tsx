// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { emptyProgress, type UserProgress } from "@/types/progress";

/**
 * End-to-end runtime proof that the SRS Review surface GENUINELY works: due
 * cards surface, revealing shows the answer, and a graded review reschedules the
 * card (pushing it out of the due window) AND persists the new store through the
 * ProgressContext → storage path — all in its own lane (mastery untouched).
 */

const SEED_INTERVIEW: UserProgress = { ...emptyProgress(), goalMode: "interview" };
const SEED_COURSE: UserProgress = { ...emptyProgress(), goalMode: "course" };

// Mutable saved-progress capture so we can assert PERSISTENCE (not just memory).
let saved: UserProgress[] = [];
let seed: UserProgress = SEED_INTERVIEW;

vi.mock("@/lib/storage", () => ({
  storage: {
    getSession: () => "srs-runtime-test",
    loadProgress: () => structuredClone(seed),
    saveProgress: (_u: string, p: UserProgress) => {
      saved.push(structuredClone(p));
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
import { ThemeProvider } from "@/context/ThemeContext";
// eslint-disable-next-line import/first
import { AuthProvider } from "@/context/AuthContext";
// eslint-disable-next-line import/first
import { ProgressProvider, useProgress } from "@/context/ProgressContext";
// eslint-disable-next-line import/first
import { ReviewPage } from "@/pages/ReviewPage";
// eslint-disable-next-line import/first
import { coerceSrsStore } from "@/lib/srs/store";

function Probe() {
  const { progress } = useProgress();
  const store = coerceSrsStore(progress.srs);
  const scheduled = Object.values(store.cards).filter((c) => c.reps === 1).length;
  return createElement(
    "div",
    null,
    createElement("span", { "data-testid": "probe-reviews" }, String(store.reviews)),
    createElement("span", { "data-testid": "probe-scheduled" }, String(scheduled)),
    // A mastery bucket we can watch stays EMPTY (SRS never folds into mastery).
    createElement(
      "span",
      { "data-testid": "probe-topics" },
      String(Object.keys(progress.topicMastery ?? {}).length),
    ),
  );
}

function wrap(children: ReactNode) {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: ["/review"] },
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

afterEach(() => {
  cleanup();
  saved = [];
  seed = SEED_INTERVIEW;
});

describe("Review page (SRS) — due cards surface and a graded review reschedules + persists", () => {
  it("surfaces a due card, reveals the answer, and reschedules on Good", async () => {
    seed = SEED_INTERVIEW;
    vi.useFakeTimers();
    try {
      wrap(createElement("div", null, createElement(ReviewPage), createElement(Probe)));

      // A brand-new fact-core deck is entirely due — the first card surfaces.
      const dueBefore = Number(screen.getByTestId("srs-due-count").textContent);
      expect(dueBefore).toBeGreaterThan(0);
      expect(screen.getByTestId("srs-front")).toBeTruthy();
      // Answer hidden until revealed.
      expect(screen.queryByTestId("srs-back")).toBeNull();

      fireEvent.click(screen.getByTestId("srs-reveal"));
      expect(screen.getByTestId("srs-back")).toBeTruthy();

      // Grade "Good" (SM-2 grade 4).
      fireEvent.click(screen.getByTestId("srs-grade-4"));

      // The review folded into the store: one review, one scheduled card.
      expect(screen.getByTestId("probe-reviews").textContent).toBe("1");
      expect(screen.getByTestId("probe-scheduled").textContent).toBe("1");
      // It left the due window (rescheduled ahead), so the due count dropped.
      const dueAfter = Number(screen.getByTestId("srs-due-count").textContent);
      expect(dueAfter).toBe(dueBefore - 1);
      // OWN LANE: no topic mastery was created by an SRS review.
      expect(screen.getByTestId("probe-topics").textContent).toBe("0");

      // PERSISTENCE: flush the 250ms debounced save and assert the store was
      // written through storage (reload-proof across sessions).
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(saved.length).toBeGreaterThan(0);
      const last = saved[saved.length - 1];
      expect(last.srs?.reviews).toBe(1);
      expect(Object.keys(last.srs?.cards ?? {})).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("is mode-scoped: Case A shows the broad Course Review (no fact-core arena link)", () => {
    seed = SEED_COURSE;
    wrap(createElement(ReviewPage));
    expect(screen.getByText(/Course Review/i)).toBeTruthy();
    // The "graduate to timed / Speed Arena" affordance is a Case-B fact-core
    // feature only.
    expect(screen.queryByText(/Go to Speed Arena/i)).toBeNull();
  });

  it("is mode-scoped: Case B shows Fact-Core Review + the Speed Arena linkage", () => {
    seed = SEED_INTERVIEW;
    wrap(createElement(ReviewPage));
    expect(screen.getByText(/Fact-Core Review/i)).toBeTruthy();
    expect(screen.getByText(/Go to Speed Arena/i)).toBeTruthy();
  });
});
