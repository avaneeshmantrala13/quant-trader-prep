// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { emptyProgress, type UserProgress } from "@/types/progress";

/**
 * Battery-station FIX tests — lock the game-OA audit fixes at the component level:
 *   • Cards MM scores CONDITIONAL updating (shows a revealed card + posterior EV),
 *   • Next-card scores KELLY SIZING (a stake step after the side pick),
 *   • Arbitrage plays scored NUMERIC de-vig items (free-entry), not only quizzes,
 *   • Fermi runs a live per-estimate shot clock (timeout ⇒ miss),
 *   • station mounts are SEED-REPRODUCIBLE (same seed ⇒ same content).
 */

let CURRENT: UserProgress = emptyProgress();
vi.mock("@/lib/storage", () => ({
  storage: {
    getSession: () => "fix-user",
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
import type { StationProps, StationSummary } from "./kit";
// eslint-disable-next-line import/first
import CardsMarketMakingStation from "./CardsMarketMakingStation";
// eslint-disable-next-line import/first
import NextCardStation from "./NextCardStation";
// eslint-disable-next-line import/first
import ArbitrageStation, { ARBITRAGE_ROUNDS } from "./ArbitrageStation";
// eslint-disable-next-line import/first
import FermiStation, { FERMI_ITEM_BUDGET_MS } from "./FermiStation";

const CARDS_KEY = tradingSubtopicByGame("cards-mm").key;
const NEXT_KEY = tradingSubtopicByGame("next-card").key;
const FERMI_KEY = tradingSubtopicByGame("fermi").key;

function NProbe({ topicKey }: { topicKey: string }) {
  const { getTopicMastery } = useProgress();
  return <span data-testid="n">{getTopicMastery(topicKey)?.n ?? 0}</span>;
}

function renderStation(
  Station: React.ComponentType<StationProps>,
  props: StationProps,
  topicKey?: string,
) {
  return render(
    <AuthProvider>
      <ProgressProvider>
        <Station {...props} />
        {topicKey ? <NProbe topicKey={topicKey} /> : null}
      </ProgressProvider>
    </AuthProvider>,
  );
}

const n = () => Number(screen.getByTestId("n").textContent);

beforeEach(() => {
  CURRENT = emptyProgress();
});
afterEach(cleanup);

/* -------------------------------------------------------------------------- */
/*  Cards MM — conditional updating                                             */
/* -------------------------------------------------------------------------- */

describe("CardsMarketMakingStation — conditional updating", () => {
  it("reveals a card, shows a posterior EV, and folds a scored decision", () => {
    renderStation(CardsMarketMakingStation, { onComplete: () => {}, seed: 5 }, CARDS_KEY);
    expect(screen.getByTestId("cards-mm-station")).toBeTruthy();
    // A face-up card is shown before the trade decision…
    expect(screen.getByLabelText(/revealed card/i)).toBeTruthy();
    // …and the panel prices the POSTERIOR, not just the prior EV.
    expect(screen.getByText(/posterior EV/i)).toBeTruthy();
    expect(n()).toBe(0);

    fireEvent.click(screen.getByLabelText("buy"));
    expect(n()).toBe(1);
    expect(screen.getByTestId("station-advance")).toBeTruthy();
  });
});

/* -------------------------------------------------------------------------- */
/*  Next-card — Kelly sizing                                                    */
/* -------------------------------------------------------------------------- */

describe("NextCardStation — Kelly sizing", () => {
  it("asks for a stake fraction after the side pick, then folds one attempt", () => {
    renderStation(NextCardStation, { onComplete: () => {}, seed: 3 }, NEXT_KEY);
    expect(screen.getByTestId("next-card-station")).toBeTruthy();
    // Pick a side → the SIZING step appears (this is the Kelly-sizing scoring).
    fireEvent.click(screen.getByLabelText("higher"));
    expect(screen.getByTestId("next-card-sizing")).toBeTruthy();
    expect(n()).toBe(0);
    // Choose a stake fraction → the round is scored and folds one attempt.
    fireEvent.click(screen.getByLabelText("stake 20 percent"));
    expect(n()).toBe(1);
    expect(screen.getByTestId("station-advance")).toBeTruthy();
  });

  it("skipping scores immediately without a sizing step", () => {
    renderStation(NextCardStation, { onComplete: () => {}, seed: 8 }, NEXT_KEY);
    fireEvent.click(screen.getByLabelText("skip"));
    expect(screen.queryByTestId("next-card-sizing")).toBeNull();
    expect(n()).toBe(1);
  });
});

/* -------------------------------------------------------------------------- */
/*  Arbitrage — numeric de-vig restored as scored items                        */
/* -------------------------------------------------------------------------- */

describe("ArbitrageStation — numeric de-vig items", () => {
  it("plays at least one scored NUMERIC free-entry item across the run", () => {
    const onComplete = vi.fn();
    renderStation(ArbitrageStation, { onComplete, seed: 4 });
    expect(screen.getByTestId("arbitrage-station")).toBeTruthy();

    let numericSeen = 0;
    for (let i = 0; i < ARBITRAGE_ROUNDS; i += 1) {
      const numericInput = screen.queryByLabelText("numeric answer");
      if (numericInput) {
        numericSeen += 1;
        fireEvent.change(numericInput, { target: { value: "1" } });
        fireEvent.click(screen.getByRole("button", { name: /submit/i }));
      } else {
        fireEvent.click(screen.getByLabelText("option 1"));
      }
      fireEvent.click(screen.getByTestId("station-advance"));
    }

    expect(numericSeen).toBeGreaterThanOrEqual(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
    const summary = onComplete.mock.calls[0][0] as StationSummary;
    expect(summary.attempts).toBe(ARBITRAGE_ROUNDS);
  });
});

/* -------------------------------------------------------------------------- */
/*  Fermi — parametric + timed shot clock                                       */
/* -------------------------------------------------------------------------- */

describe("FermiStation — timed shot clock", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a live shot clock and auto-commits a MISS on timeout", async () => {
    renderStation(FermiStation, { onComplete: () => {}, seed: 11 }, FERMI_KEY);
    expect(screen.getByTestId("fermi-station")).toBeTruthy();
    expect(screen.getByTestId("shot-clock")).toBeTruthy();
    expect(n()).toBe(0);

    await act(async () => {
      vi.advanceTimersByTime(FERMI_ITEM_BUDGET_MS + 500);
    });

    expect(n()).toBe(1);
    expect(screen.getByText(/Out of time/i)).toBeTruthy();
    expect(screen.getByTestId("station-advance")).toBeTruthy();
  });
});

/* -------------------------------------------------------------------------- */
/*  Seed reproducibility (fix #6)                                               */
/* -------------------------------------------------------------------------- */

describe("station mounts are seed-reproducible", () => {
  function firstPrompt(node: HTMLElement): string {
    return within(node).getByRole("heading").textContent ?? "";
  }

  it("same seed ⇒ same Fermi content; different seed ⇒ different content", () => {
    const a = renderStation(FermiStation, { onComplete: () => {}, seed: 777 });
    const promptA = firstPrompt(a.container.querySelector("[data-testid=fermi-station]") as HTMLElement);
    cleanup();
    const b = renderStation(FermiStation, { onComplete: () => {}, seed: 777 });
    const promptB = firstPrompt(b.container.querySelector("[data-testid=fermi-station]") as HTMLElement);
    cleanup();
    const c = renderStation(FermiStation, { onComplete: () => {}, seed: 778 });
    const promptC = firstPrompt(c.container.querySelector("[data-testid=fermi-station]") as HTMLElement);

    expect(promptA).toBe(promptB);
    expect(promptA).not.toBe(promptC);
  });
});
