// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { ProgressProvider } from "@/context/ProgressContext";
import { ThemeProvider } from "@/context/ThemeContext";
import {
  browserSessionStore,
  clearGameSession,
  saveGameSession,
} from "@/lib/leaderboard/gameSession";

import { NumberLogicPage } from "./NumberLogicPage";
import { BeatTheOddsPage } from "./BeatTheOddsPage";
import { NumberBoxPage } from "./NumberBoxPage";
import { ShapeShiftPage } from "./ShapeShiftPage";
import { StockmasterPage } from "./StockmasterPage";

import { createNumberLogicSession } from "@/lib/games/numberLogic/engine";
import { createBtoSession } from "@/lib/games/beatTheOdds/engine";
import { createNumberBoxSession } from "@/lib/games/numberBox/engine";
import { createShapeShiftSession } from "@/lib/games/shapeShift/engine";
import { createStockmasterSession } from "@/lib/games/stockmaster/engine";

/**
 * PER-GAME RUNTIME SANITY + DURABLE RESUME for the Optiver-style Assessment
 * cluster. Two properties per page: it renders its intro without crashing, and
 * a seeded ACTIVE session makes it RESUME the in-progress drill on mount instead
 * of resetting to the intro. Mirrors `gamesRuntime.test.tsx`.
 */

const GAME_IDS = [
  "numberlogic",
  "beat-the-odds",
  "number-box",
  "shape-shift",
  "stockmaster",
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
  if (typeof globalThis.requestAnimationFrame !== "function") {
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), 16) as unknown as number) as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = ((id: number) =>
      clearTimeout(id)) as typeof cancelAnimationFrame;
  }
});

function seed(gameId: string, snapshot: unknown) {
  saveGameSession(browserSessionStore(), gameId, snapshot, Date.now(), "active");
}

/* ========================================================================== */
/*  1. PLAYABLE — each page renders its intro without crashing                 */
/* ========================================================================== */

describe("Optiver-style OA pages render (playable sanity)", () => {
  it("NumberLogic shows its intro CTA", () => {
    renderPage(<NumberLogicPage />);
    expect(screen.getAllByText(/NumberLogic/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Start the paper/i)).toBeTruthy();
  });

  it("Beat the Odds shows its intro CTA", () => {
    renderPage(<BeatTheOddsPage />);
    expect(screen.getAllByText(/Beat the Odds/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Start the clock/i)).toBeTruthy();
  });

  it("Number Box shows its intro CTA", () => {
    renderPage(<NumberBoxPage />);
    expect(screen.getAllByText(/Number Box/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Start the drill/i)).toBeTruthy();
  });

  it("Shape Shift shows its intro CTA", () => {
    renderPage(<ShapeShiftPage />);
    expect(screen.getAllByText(/Shape Shift/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Start rotating/i)).toBeTruthy();
  });

  it("Stockmaster shows its intro CTA", () => {
    renderPage(<StockmasterPage />);
    expect(screen.getAllByText(/Stockmaster/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Open the tape/i)).toBeTruthy();
  });
});

/* ========================================================================== */
/*  2. SAVES PROGRESS — a seeded active session resumes instead of resetting   */
/* ========================================================================== */

describe("Optiver-style OA pages resume a saved in-progress drill (persistence)", () => {
  it("NumberLogic resumes an in-progress paper", async () => {
    seed("numberlogic", createNumberLogicSession({ seed: 7, nowTs: Date.now() }));
    renderPage(<NumberLogicPage />);
    expect(await screen.findByText(/Find the next term/i)).toBeTruthy();
    expect(screen.queryByText(/Start the paper/i)).toBeNull();
  });

  it("Beat the Odds resumes an in-progress round", async () => {
    seed("beat-the-odds", createBtoSession({ seed: 7, nowTs: Date.now() }));
    renderPage(<BeatTheOddsPage />);
    expect(await screen.findByText(/Pick the closest/i)).toBeTruthy();
    expect(screen.queryByText(/Start the clock/i)).toBeNull();
  });

  it("Number Box resumes an in-progress drill", async () => {
    seed("number-box", createNumberBoxSession({ seed: 7, nowTs: Date.now() }));
    renderPage(<NumberBoxPage />);
    expect(await screen.findByText(/Solve the box/i)).toBeTruthy();
    expect(screen.queryByText(/Start the drill/i)).toBeNull();
  });

  it("Shape Shift resumes an in-progress round", async () => {
    seed("shape-shift", createShapeShiftSession({ seed: 7, nowTs: Date.now() }));
    renderPage(<ShapeShiftPage />);
    expect(await screen.findByText(/Apply the transform/i)).toBeTruthy();
    expect(screen.queryByText(/Start rotating/i)).toBeNull();
  });

  it("Stockmaster resumes an in-progress tape", async () => {
    seed("stockmaster", createStockmasterSession({ seed: 7 }));
    renderPage(<StockmasterPage />);
    expect(await screen.findByText(/Buy only when the arrow/i)).toBeTruthy();
    expect(screen.queryByText(/Open the tape/i)).toBeNull();
  });
});
