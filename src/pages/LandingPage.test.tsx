// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";
import { ProgressProvider } from "@/context/ProgressContext";
import { LandingPage } from "./LandingPage";

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

beforeEach(() => {
  // jsdom here exposes no global `localStorage`; install a small in-memory
  // polyfill so the theme choice can persist across the switch.
  const mem = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
      setItem: (k: string, v: string) => void mem.set(k, String(v)),
      removeItem: (k: string) => void mem.delete(k),
      clear: () => mem.clear(),
      key: (i: number) => Array.from(mem.keys())[i] ?? null,
      get length() {
        return mem.size;
      },
    },
    configurable: true,
    writable: true,
  });
});
afterEach(cleanup);

function renderLanding() {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <AuthProvider>
          <ProgressProvider>
            <LandingPage />
          </ProgressProvider>
        </AuthProvider>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe("LandingPage — pre-auth theme switching", () => {
  it("exposes a usable theme switcher before login and persists the choice", () => {
    renderLanding();
    const trigger = screen.getByRole("button", { name: /change theme/i });
    fireEvent.click(trigger);
    const menu = screen.getByRole("menu", { name: /choose a theme/i });
    fireEvent.click(within(menu).getByText("Cyberpunk"));
    expect(localStorage.getItem("qtp.themeId")).toBe("cyberpunk");
    expect(document.documentElement.dataset.theme).toBe("cyberpunk");
  });
});

describe("LandingPage — honest feature showcase", () => {
  it("promotes the Hint Ladder and never the retired Socratic tutor", () => {
    renderLanding();
    expect(screen.getAllByText(/The Hint Ladder/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Socratic/i)).toBeNull();
  });
});
