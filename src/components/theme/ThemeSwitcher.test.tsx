// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ThemeProvider } from "@/context/ThemeContext";
import { ThemeSwitcher } from "./ThemeSwitcher";

// jsdom lacks matchMedia; ThemeProvider probes prefers-color-scheme on mount.
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
  // This jsdom setup doesn't expose a global `localStorage`; install a small
  // in-memory polyfill so the theme choice has somewhere to persist.
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

function renderSwitcher() {
  return render(
    <ThemeProvider>
      <ThemeSwitcher />
    </ThemeProvider>,
  );
}

describe("ThemeSwitcher (pre-auth named-theme picker)", () => {
  it("shows the default theme and is collapsed until opened", () => {
    renderSwitcher();
    const trigger = screen.getByRole("button", { name: /change theme/i });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    // The active theme label (default: Minimalist) is surfaced on the trigger.
    expect(within(trigger).getByText("Minimalist")).toBeTruthy();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("opens a menu listing every registered theme as a radio option", () => {
    renderSwitcher();
    fireEvent.click(screen.getByRole("button", { name: /change theme/i }));
    const menu = screen.getByRole("menu", { name: /choose a theme/i });
    const options = within(menu).getAllByRole("menuitemradio");
    // All six registered themes are offered.
    expect(options.length).toBe(6);
    // The current theme is marked checked.
    const checked = options.filter((o) => o.getAttribute("aria-checked") === "true");
    expect(checked.length).toBe(1);
    expect(within(checked[0]).getByText("Minimalist")).toBeTruthy();
  });

  it("switching theme applies it, persists to localStorage, and updates the trigger", () => {
    renderSwitcher();
    fireEvent.click(screen.getByRole("button", { name: /change theme/i }));

    const menu = screen.getByRole("menu");
    fireEvent.click(within(menu).getByText("Broadsheet"));

    // Persisted to the same device-level key the authed session reads.
    expect(localStorage.getItem("qtp.themeId")).toBe("broadsheet");
    // Applied to the document (ThemeProvider stamps the active theme id).
    expect(document.documentElement.dataset.theme).toBe("broadsheet");
    // Menu closed and the trigger now reflects the new choice.
    expect(screen.queryByRole("menu")).toBeNull();
    const trigger = screen.getByRole("button", { name: /change theme/i });
    expect(within(trigger).getByText("Broadsheet")).toBeTruthy();
  });

  it("closes on Escape without changing the theme", () => {
    renderSwitcher();
    const trigger = screen.getByRole("button", { name: /change theme/i });
    fireEvent.click(trigger);
    expect(screen.getByRole("menu")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(localStorage.getItem("qtp.themeId")).toBe("minimalist");
  });
});
