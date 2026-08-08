// @vitest-environment jsdom
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { emptyProgress, type UserProgress } from "@/types/progress";

/**
 * Timed battery-station tests. Every station whose stand-alone mode has a shot
 * clock now runs LIVE inside the battery; these lock the time-pressure wiring:
 *
 *  - the shared {@link useShotClock} drains a `Date.now()`-based deadline via
 *    `setInterval`, so `vi.useFakeTimers()` + `advanceTimersByTime` make the
 *    countdown and its timeout fully deterministic (no rAF/performance.now flake),
 *  - a per-question TIMEOUT (Beat the Odds) auto-commits a MISS,
 *  - a whole-run TIMEOUT (Number Box, streaming) folds every unreached item as a
 *    miss and finishes,
 *  - a per-trial TIMEOUT (Stockmaster) auto-resolves the tick and streams on,
 *
 * each folding exactly one attempt per round into the game's subtopic Beta.
 */

let CURRENT: UserProgress = emptyProgress();
vi.mock("@/lib/storage", () => ({
  storage: {
    getSession: () => "timed-user",
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

// eslint-disable-next-line import/first
import { AuthProvider } from "@/context/AuthContext";
// eslint-disable-next-line import/first
import { ProgressProvider, useProgress } from "@/context/ProgressContext";
// eslint-disable-next-line import/first
import { tradingSubtopicByGame } from "@/lib/mastery/tradingSubtopics";
// eslint-disable-next-line import/first
import { DEFAULT_BTO_BUDGET_MS } from "@/lib/games/beatTheOdds/engine";
// eslint-disable-next-line import/first
import {
  DEFAULT_NUMBERBOX_BUDGET_MS,
  DEFAULT_NUMBERBOX_COUNT,
} from "@/lib/games/numberBox/engine";
// eslint-disable-next-line import/first
import { DEFAULT_TRIAL_WINDOW_MS } from "@/lib/games/stockmaster/engine";
// eslint-disable-next-line import/first
import type { StationSummary } from "./kit";
// eslint-disable-next-line import/first
import BeatTheOddsStation from "./BeatTheOddsStation";
// eslint-disable-next-line import/first
import NumberBoxStation, { NUMBERBOX_ROUNDS } from "./NumberBoxStation";
// eslint-disable-next-line import/first
import StockmasterStation, { STOCKMASTER_ROUNDS } from "./StockmasterStation";

const BTO_KEY = tradingSubtopicByGame("beat-the-odds").key;
const NB_KEY = tradingSubtopicByGame("number-box").key;
const STOCK_KEY = tradingSubtopicByGame("stockmaster").key;
const NB_BUDGET_MS = Math.round(
  (DEFAULT_NUMBERBOX_BUDGET_MS * NUMBERBOX_ROUNDS) / DEFAULT_NUMBERBOX_COUNT,
);

/** Probe that surfaces the folded attempt count `n` for a subtopic. */
function NProbe({ topicKey }: { topicKey: string }) {
  const { getTopicMastery } = useProgress();
  return <span data-testid="n">{getTopicMastery(topicKey)?.n ?? 0}</span>;
}

function renderStation(
  Station: React.ComponentType<{ onComplete: (s: StationSummary) => void }>,
  topicKey: string,
  onComplete: (s: StationSummary) => void,
) {
  return render(
    <AuthProvider>
      <ProgressProvider>
        <Station onComplete={onComplete} />
        <NProbe topicKey={topicKey} />
      </ProgressProvider>
    </AuthProvider>,
  );
}

const n = () => Number(screen.getByTestId("n").textContent);

beforeEach(() => {
  CURRENT = emptyProgress();
  // Fake ONLY the clock primitives the shot clock uses, so provider async
  // (real setTimeout / microtasks) is untouched and stays non-flaky.
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

/* -------------------------------------------------------------------------- */
/*  Beat the Odds — per-question shot clock                                     */
/* -------------------------------------------------------------------------- */

describe("BeatTheOddsStation — per-question clock", () => {
  it("shows a live shot clock and auto-commits a MISS on timeout", async () => {
    renderStation(BeatTheOddsStation, BTO_KEY, () => {});
    expect(screen.getByTestId("beat-the-odds-station")).toBeTruthy();
    expect(screen.getByTestId("shot-clock")).toBeTruthy();
    expect(n()).toBe(0);

    // Let the whole per-question budget elapse → the engine times the item out.
    await act(async () => {
      vi.advanceTimersByTime(DEFAULT_BTO_BUDGET_MS + 200);
    });

    // The timeout folded exactly one (miss) attempt and revealed "out of time".
    expect(n()).toBe(1);
    expect(screen.getByText(/Out of time/i)).toBeTruthy();
    // The Next control appears so the battery can advance.
    expect(screen.getByTestId("station-advance")).toBeTruthy();
  });

  it("answering an option folds an attempt and resets the clock for the next", async () => {
    renderStation(BeatTheOddsStation, BTO_KEY, () => {});
    fireEvent.click(screen.getByLabelText("option 1"));
    expect(n()).toBe(1);
    expect(screen.getByTestId("station-advance")).toBeTruthy();

    fireEvent.click(screen.getByTestId("station-advance"));
    // Back to answering the next question with a fresh clock.
    expect(screen.getByTestId("shot-clock")).toBeTruthy();
    expect(screen.getByLabelText("option 1")).toBeTruthy();
  });
});

/* -------------------------------------------------------------------------- */
/*  Number Box — whole-run streaming clock                                      */
/* -------------------------------------------------------------------------- */

describe("NumberBoxStation — whole-run clock, streaming", () => {
  it("streams every item and folds one attempt per item to completion", () => {
    const onComplete = vi.fn();
    renderStation(NumberBoxStation, NB_KEY, onComplete);
    expect(screen.getByTestId("timed-mcq-station")).toBeTruthy();
    expect(screen.getByTestId("shot-clock")).toBeTruthy();

    for (let i = 0; i < NUMBERBOX_ROUNDS; i += 1) {
      fireEvent.click(screen.getByLabelText("option 1"));
    }

    expect(onComplete).toHaveBeenCalledTimes(1);
    const summary = onComplete.mock.calls[0][0] as StationSummary;
    expect(summary.attempts).toBe(NUMBERBOX_ROUNDS);
    expect(n()).toBe(NUMBERBOX_ROUNDS);
  });

  it("on timeout folds every UNREACHED item as a miss and finishes", async () => {
    const onComplete = vi.fn();
    renderStation(NumberBoxStation, NB_KEY, onComplete);

    // Answer only the first two, then let the whole-run clock run out.
    fireEvent.click(screen.getByLabelText("option 1"));
    fireEvent.click(screen.getByLabelText("option 1"));
    expect(n()).toBe(2);

    await act(async () => {
      vi.advanceTimersByTime(NB_BUDGET_MS + 500);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
    const summary = onComplete.mock.calls[0][0] as StationSummary;
    // Two answered + six timed-out misses = one attempt per item.
    expect(summary.attempts).toBe(NUMBERBOX_ROUNDS);
    expect(summary.scoreLabel).toMatch(/timed out/i);
    expect(n()).toBe(NUMBERBOX_ROUNDS);
  });
});

/* -------------------------------------------------------------------------- */
/*  Stockmaster — per-trial window, streaming                                   */
/* -------------------------------------------------------------------------- */

describe("StockmasterStation — per-trial shot clock", () => {
  it("reacting to each tick streams through the run to completion", () => {
    const onComplete = vi.fn();
    renderStation(StockmasterStation, STOCK_KEY, onComplete);
    expect(screen.getByTestId("stockmaster-station")).toBeTruthy();
    expect(screen.getByTestId("shot-clock")).toBeTruthy();

    for (let i = 0; i < STOCKMASTER_ROUNDS; i += 1) {
      fireEvent.click(screen.getByLabelText("react"));
    }

    expect(onComplete).toHaveBeenCalledTimes(1);
    const summary = onComplete.mock.calls[0][0] as StationSummary;
    expect(summary.attempts).toBe(STOCKMASTER_ROUNDS);
    expect(n()).toBe(STOCKMASTER_ROUNDS);
  });

  it("letting every tick lapse auto-resolves each and still folds all trials", async () => {
    const onComplete = vi.fn();
    renderStation(StockmasterStation, STOCK_KEY, onComplete);

    for (let i = 0; i < STOCKMASTER_ROUNDS; i += 1) {
      await act(async () => {
        vi.advanceTimersByTime(DEFAULT_TRIAL_WINDOW_MS + 50);
      });
    }

    expect(onComplete).toHaveBeenCalledTimes(1);
    const summary = onComplete.mock.calls[0][0] as StationSummary;
    expect(summary.attempts).toBe(STOCKMASTER_ROUNDS);
    expect(n()).toBe(STOCKMASTER_ROUNDS);
  });
});
