// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { MakeMarketPage } from "./MakeMarketPage";
import { Rng } from "@/lib/rng";
import { dealScenario } from "@/content/games/makeMarketScenarios";
import {
  browserSessionStore,
  clearGameSession,
  loadGameSession,
  saveGameSession,
} from "@/lib/leaderboard/gameSession";

/**
 * Game-page runtime wiring for the durable save/resume the leaderboard work
 * added. We seed an ACTIVE Make-a-Market session in localStorage, then render
 * the page and assert it RESUMES mid-round (not the setup screen). Complements
 * the pure `gameSession`/`localBoard` round-trip tests.
 */

function renderPage() {
  return render(
    <AuthProvider>
      <ThemeProvider>
        <MemoryRouter>
          <MakeMarketPage />
        </MemoryRouter>
      </ThemeProvider>
    </AuthProvider>,
  );
}

afterEach(cleanup);
beforeEach(() => {
  // This jsdom setup doesn't expose a global `localStorage`; install a small
  // in-memory polyfill so the durable-session store has somewhere to write.
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

  // ThemeProvider reads prefers-color-scheme; jsdom has no matchMedia.
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

describe("MakeMarketPage — durable resume", () => {
  it("shows the setup deal CTA when there is no saved session", () => {
    renderPage();
    expect(screen.getByText(/Deal & open the market/i)).toBeTruthy();
  });

  it("resumes a saved in-progress round instead of resetting to setup", async () => {
    const scenario = dealScenario(new Rng(42));
    saveGameSession(
      browserSessionStore(),
      "make-market",
      {
        phase: "interval",
        scenario,
        fills: [],
        roundIdx: 1,
        log: [],
        coach: null,
      },
      Date.now(),
    );

    // Sanity: the seed actually persisted and is loadable via the same store.
    expect(loadGameSession(browserSessionStore(), "make-market")?.status).toBe("active");

    renderPage();

    // The hydrate effect swaps setup → the resumed round view: the saved
    // scenario prompt + the interval form render, and the setup CTA is gone.
    expect(await screen.findByText(scenario.prompt)).toBeTruthy();
    expect(screen.getByText(/Quote interval/i)).toBeTruthy();
    expect(screen.queryByText(/Deal & open the market/i)).toBeNull();

    clearGameSession(browserSessionStore(), "make-market");
  });
});
