// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { emptyProgress, type UserProgress } from "@/types/progress";
import type { TopicMastery } from "@/types/mastery";
import {
  COMPETENCY_BRAINTEASER,
  TRADING_SUBTOPIC_KEYS,
  scoredContentTopicKeys,
} from "@/lib/pipeline/gates";

/**
 * Stage-6 (drilling loop) tests (Phase P6): the screen serves the weakest topic
 * first through the numeric hint-ladder path, shows live progress toward the
 * gate, and calls `onComplete` EXACTLY when `passesDrillingGate` holds (and only
 * once). The credit-reduction math itself is locked in `drilling.test.ts`.
 */

let CURRENT: UserProgress = emptyProgress();
vi.mock("@/lib/storage", () => ({
  storage: {
    getSession: () => "drilling-user",
    loadProgress: () => CURRENT,
    saveProgress: (_u: string, next: UserProgress) => {
      CURRENT = next;
    },
    getTheme: () => "light",
    setTheme: () => {},
    getThemeId: () => "minimalist",
    setThemeId: () => {},
    logOut: () => {},
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
import { ProgressProvider } from "@/context/ProgressContext";
// eslint-disable-next-line import/first
import DrillingStage from "./DrillingStage";

function mastered(): TopicMastery {
  return { theta: 2, n: 62, alpha: 60, beta: 2, lastSeen: "t", misconceptions: {} };
}

/** Content + both competencies mastered, with a cleared timed section. */
function fullyClearedProgress(): UserProgress {
  const p = emptyProgress();
  const tm: Record<string, TopicMastery> = {};
  for (const key of scoredContentTopicKeys()) tm[key] = mastered();
  tm[COMPETENCY_BRAINTEASER] = mastered();
  for (const key of TRADING_SUBTOPIC_KEYS) tm[key] = mastered();
  p.topicMastery = tm;
  p.pipeline = {
    stage: "drilling",
    timed: {
      correct: 28,
      total: 30,
      sections: [{ label: "timed", correct: 28, total: 30 }],
    },
  };
  return p;
}

beforeEach(() => {
  CURRENT = emptyProgress();
});
afterEach(cleanup);

function renderStage(onComplete: (r?: unknown) => void) {
  return render(
    <AuthProvider>
      <ProgressProvider>
        <DrillingStage onComplete={onComplete} />
      </ProgressProvider>
    </AuthProvider>,
  );
}

describe("DrillingStage — serves weakest-first and shows live gate progress", () => {
  it("serves a numeric content drill and reports open content when nothing is mastered", () => {
    const onComplete = vi.fn();
    renderStage(onComplete);
    expect(screen.getByTestId("drilling-stage")).toBeTruthy();
    // A weakest-first content drill is in flight (the untimed hint-ladder path).
    expect(screen.getByTestId("drilling-numeric")).toBeTruthy();
    // The gate panel names the topic being drilled.
    expect(screen.getByTestId("drilling-target")).toBeTruthy();
    // Not done ⇒ no completion yet.
    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.queryByTestId("drilling-cleared")).toBeNull();
  });
});

describe("DrillingStage — completion is governed by passesDrillingGate", () => {
  it("calls onComplete once and shows 'Cleared' when the whole gate already holds", () => {
    CURRENT = fullyClearedProgress();
    const onComplete = vi.fn();
    renderStage(onComplete);
    expect(screen.getByTestId("drilling-cleared")).toBeTruthy();
    expect(onComplete).toHaveBeenCalledTimes(1);
    // No drill round is served once the gate holds.
    expect(screen.queryByTestId("drilling-numeric")).toBeNull();
  });

  it("does NOT complete while any bar is still open", () => {
    // Everything mastered EXCEPT the brainteaser competency ⇒ gate open.
    const p = fullyClearedProgress();
    p.topicMastery![COMPETENCY_BRAINTEASER] = {
      theta: -1,
      n: 4,
      alpha: 1,
      beta: 4,
      lastSeen: "t",
      misconceptions: {},
    };
    CURRENT = p;
    const onComplete = vi.fn();
    renderStage(onComplete);
    expect(onComplete).not.toHaveBeenCalled();
    // The brainteaser competency is routed next.
    expect(screen.getByTestId("drilling-brainteaser")).toBeTruthy();
  });
});
