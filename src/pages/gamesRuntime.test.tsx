// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { ProgressProvider } from "@/context/ProgressContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { Rng } from "@/lib/rng";
import {
  browserSessionStore,
  clearGameSession,
  saveGameSession,
} from "@/lib/leaderboard/gameSession";

import { MakeMarketPage } from "./MakeMarketPage";
import { MarketOfCardsPage } from "./MarketOfCardsPage";
import { CardsMarketMakingPage } from "./CardsMarketMakingPage";
import { ProbabilityBettingPage } from "./ProbabilityBettingPage";
import { FruitMarketPage } from "./FruitMarketPage";
import { DiceAndCardsPage } from "./DiceAndCardsPage";
import { NextCardBettingPage } from "./NextCardBettingPage";
import { TradingFloorPage } from "./TradingFloorPage";

import { dealGame } from "@/lib/games/marketOfCards/engine";
import { dealRound as dealCardsRound } from "@/lib/games/cardsMarketMaking/engine";
import { dealRound as dealDiceRound, freshDeck as diceFreshDeck } from "@/lib/games/diceAndCards/engine";
import { buildRound as buildProbRound } from "@/content/games/probabilityBettingEvents";
import {
  freshDeck as ncFreshDeck,
  dealCycle,
  evaluateHigherLower,
  evaluateInsideOutside,
  evaluateNewSuit,
  bestOption,
} from "@/lib/games/nextCardBetting/engine";
import { resumeFloor, SCENARIO_PACKS, FLOOR_CONFIGS } from "@/lib/tradingFloor";

/**
 * PER-GAME RUNTIME SANITY + DURABLE RESUME.
 *
 * Two properties per game page:
 *  1. PLAYABLE — the page renders end-to-end without crashing and shows its
 *     setup screen (a live render, not a smoke import).
 *  2. SAVES PROGRESS — seeding an ACTIVE `gameSession` (or, for the Trading
 *     Floor, a recorded-moves snapshot) makes the page RESUME the in-progress
 *     game on mount instead of resetting to setup.
 *
 * The heavy provider stack (Auth ▸ Progress ▸ Theme ▸ Router) matches the real
 * app so pages that read any of them (the Trading Floor reads progress) mount
 * exactly as they do in production.
 */

const GAME_IDS = [
  "make-market",
  "market-of-cards",
  "cards-market-making",
  "probability-betting",
  "dice-and-cards",
  "next-card-betting",
  "trading-floor",
];

function renderPage(ui: ReactElement) {
  return render(
    <AuthProvider>
      <ProgressProvider>
        <ThemeProvider>
          <MemoryRouter>{ui}</MemoryRouter>
        </ThemeProvider>
      </ProgressProvider>
    </AuthProvider>,
  );
}

afterEach(() => {
  cleanup();
  for (const id of GAME_IDS) clearGameSession(browserSessionStore(), id);
});

beforeEach(() => {
  // jsdom here doesn't expose a global localStorage; install an in-memory one so
  // the durable-session store + auth/progress have somewhere to read/write.
  const mem = new Map<string, string>();
  const ls = {
    getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
    setItem: (k: string, v: string) => void mem.set(k, String(v)),
    removeItem: (k: string) => void mem.delete(k),
    clear: () => mem.clear(),
    key: (i: number) => Array.from(mem.keys())[i] ?? null,
    get length() {
      return mem.size;
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: ls,
    configurable: true,
    writable: true,
  });

  if (typeof window.matchMedia !== "function") {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  }
});

function seed(gameId: string, snapshot: unknown) {
  saveGameSession(browserSessionStore(), gameId, snapshot, Date.now());
}

/* ========================================================================== */
/*  1. PLAYABLE — each page renders its setup screen without crashing          */
/* ========================================================================== */

describe("game pages render (playable sanity)", () => {
  it("Make Me a Market shows its setup deal CTA", () => {
    renderPage(<MakeMarketPage />);
    expect(screen.getAllByText(/Make Me a Market/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Deal & open the market/i)).toBeTruthy();
  });

  it("Market of Cards shows its setup CTA", () => {
    renderPage(<MarketOfCardsPage />);
    expect(screen.getByText(/Market of Cards/i)).toBeTruthy();
    expect(screen.getByText(/Sit down at the table/i)).toBeTruthy();
  });

  it("Cards Market Making shows its setup CTA", () => {
    renderPage(<CardsMarketMakingPage />);
    expect(screen.getByText(/Cards Market Making/i)).toBeTruthy();
    expect(screen.getByText(/Deal the first market/i)).toBeTruthy();
  });

  it("Probability Betting shows its setup CTA", () => {
    renderPage(<ProbabilityBettingPage />);
    expect(screen.getByText(/Probability Betting/i)).toBeTruthy();
    expect(screen.getByText(/Start betting/i)).toBeTruthy();
  });

  it("Fruit Market shows its setup CTA", () => {
    renderPage(<FruitMarketPage />);
    expect(screen.getByText(/Fruit Market/i)).toBeTruthy();
    expect(screen.getByText(/Open the market/i)).toBeTruthy();
  });

  it("Dice & Cards shows its setup CTA", () => {
    renderPage(<DiceAndCardsPage />);
    expect(screen.getByText(/Dice & Cards/i)).toBeTruthy();
    expect(screen.getByText(/Start with/i)).toBeTruthy();
  });

  it("Next Card Betting shows its setup CTA", () => {
    renderPage(<NextCardBettingPage />);
    expect(screen.getByText(/Next Card Betting/i)).toBeTruthy();
    expect(screen.getByText(/Sit down with/i)).toBeTruthy();
  });

  it("The Trading Floor shows its setup CTA", () => {
    renderPage(<TradingFloorPage />);
    expect(screen.getAllByText(/The Trading Floor/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Open the market/i)).toBeTruthy();
  });
});

/* ========================================================================== */
/*  2. SAVES PROGRESS — a seeded active session resumes instead of resetting   */
/* ========================================================================== */

describe("game pages resume a saved in-progress game (persistence)", () => {
  it("Market of Cards resumes an in-progress round", async () => {
    const game = dealGame(new Rng(7), { numBots: 3, numRounds: 4, aceMode: "high" });
    seed("market-of-cards", {
      numBots: 3,
      numRounds: 4,
      aceHigh: true,
      phase: "round",
      subPhase: "quote",
      game,
      activity: [],
      botMarkets: [],
    });
    renderPage(<MarketOfCardsPage />);
    // The setup CTA is replaced by the live round.
    expect(await screen.findByText(/Market of Cards/i)).toBeTruthy();
    expect(screen.queryByText(/Sit down at the table/i)).toBeNull();
  });

  it("Cards Market Making resumes an in-progress round", async () => {
    const round = dealCardsRound(new Rng(11), { numCards: 3, aceValue: 14, replace: false });
    seed("cards-market-making", {
      numRounds: 5,
      numCards: 3,
      aceHigh: true,
      phase: "quote",
      balance: 500,
      roundIdx: 1,
      round,
      action: "none",
      size: 1,
      pnlGuess: "",
      voiGuess: "",
      outcome: null,
      log: [],
    });
    renderPage(<CardsMarketMakingPage />);
    expect(await screen.findByText(/Cards Market Making/i)).toBeTruthy();
    expect(screen.queryByText(/Deal the first market/i)).toBeNull();
  });

  it("Probability Betting resumes an in-progress round", async () => {
    const round = buildProbRound(new Rng(13), 2, true);
    seed("probability-betting", {
      numRounds: 5,
      perCategory: 2,
      aceHigh: true,
      phase: "bet",
      balance: 1000,
      roundIdx: 1,
      round,
      stakes: {},
      specialStakes: {},
      settlement: null,
      gradeLog: [],
    });
    renderPage(<ProbabilityBettingPage />);
    expect(await screen.findByText(/Probability Betting/i)).toBeTruthy();
    expect(screen.queryByText(/Start betting/i)).toBeNull();
  });

  it("Dice & Cards resumes an in-progress trade", async () => {
    const config = { numCards: 1, numDice: 1, aceMode: "high" } as const;
    const { round } = dealDiceRound(new Rng(17), diceFreshDeck(), config);
    seed("dice-and-cards", {
      config,
      phase: "trade",
      roundIdx: 0,
      balance: 500000,
      log: [],
      round,
      action: null,
      size: 1,
      pnlGuess: "",
      current: null,
    });
    renderPage(<DiceAndCardsPage />);
    // The trade screen (not setup) is shown on resume.
    expect(await screen.findByText(/The computer quotes/i)).toBeTruthy();
    expect(screen.queryByText(/Start with/i)).toBeNull();
  });

  it("Next Card Betting resumes an in-progress cycle", async () => {
    const config = { numSuits: 2, aceMode: "high" } as const;
    const state = dealCycle(new Rng(19), ncFreshDeck(config), config, []);
    const remaining = state.deck;
    const visibleSuits = [...new Set(state.visible.map((c) => c.suit))];
    const hl = evaluateHigherLower(state.reference, remaining, config.aceMode);
    const io = evaluateInsideOutside(state.low, state.high, remaining, config.aceMode);
    const ns = evaluateNewSuit(new Set(visibleSuits), remaining);
    const opps = [
      { type: "higher-lower", options: hl, best: bestOption(hl) },
      { type: "inside-outside", options: io, best: bestOption(io) },
      { type: "new-suit", options: ns, best: bestOption(ns) },
    ];
    seed("next-card-betting", {
      config,
      balance: 1000,
      phase: "bet",
      active: {
        index: 0,
        reference: state.reference,
        low: state.low,
        high: state.high,
        visibleSuits,
        startBalance: 1000,
        opps,
        aceMode: config.aceMode,
      },
      selections: {
        "higher-lower": { side: null, fraction: 0.25 },
        "inside-outside": { side: null, fraction: 0.25 },
        "new-suit": { side: null, fraction: 0.25 },
      },
      log: [],
      lastCycle: null,
      visible: state.visible,
      placed: [],
      decisions: [],
    });
    renderPage(<NextCardBettingPage />);
    expect(await screen.findByText(/Next Card Betting/i)).toBeTruthy();
    expect(screen.queryByText(/Sit down with/i)).toBeNull();
  });

  it("The Trading Floor resumes an in-progress session (recorded-moves replay)", async () => {
    const packId = SCENARIO_PACKS[0].id;
    const configId = FLOOR_CONFIGS[1].id;
    const seedNum = 123;
    // A single real quote already posted, then the user left mid-quote.
    const moves = [{ quote: { mid: 0.5, half: 1, skew: 0, size: 1 }, standAside: false }];
    // Sanity: the same inputs rebuild a non-finished, quoting state.
    const rebuilt = resumeFloor(
      SCENARIO_PACKS.find((p) => p.id === packId)!.build(new Rng(seedNum)),
      FLOOR_CONFIGS.find((c) => c.id === configId)!,
      seedNum,
      moves,
      true,
    );
    expect(rebuilt.phase).not.toBe("finished");

    seed("trading-floor", {
      packId,
      configId,
      coachOn: false,
      seed: seedNum,
      moves,
      resumeQuoting: true,
    });
    renderPage(<TradingFloorPage />);
    // The playing screen (quote pad) replaces the setup CTA on resume.
    expect(await screen.findByText(/Quote market/i)).toBeTruthy();
    expect(screen.queryByText(/Open the market/i)).toBeNull();
  });
});
