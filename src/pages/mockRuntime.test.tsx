// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { MockPage } from "./MockPage";
import {
  buildInterview,
  createSession,
  loadActiveSession,
  mockReducer,
  saveActiveSession,
} from "@/lib/mock";

/**
 * Runtime wiring for the mock-interview END / RESET / EXIT affordances. We seed
 * a RUNNING session in localStorage (so the page resumes into the running view),
 * then assert the header exposes an "End interview" control, the confirm dialog
 * warns about the single-sitting rule, and each action does the right thing —
 * crucially that ending clears the persisted blob so it can never force-resume.
 *
 * `username` is null here (logged-out anon scope), which is exactly the "any
 * account" path: nothing gates reset/exit on a particular user.
 */

function renderPage() {
  return render(
    <AuthProvider>
      <ThemeProvider>
        <MemoryRouter>
          <MockPage />
        </MemoryRouter>
      </ThemeProvider>
    </AuthProvider>,
  );
}

/** Seed a fresh RUNNING session under the anonymous (logged-out) user scope. */
function seedRunningSession() {
  const script = buildInterview({ seed: 4242, preset: "optiver" });
  let s = createSession(script, { speechSupported: false });
  s = mockReducer(s, { type: "start" });
  saveActiveSession(s, null);
}

afterEach(cleanup);
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
  Object.defineProperty(window, "localStorage", {
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

describe("MockPage — running view exposes an end/reset affordance", () => {
  it("shows an 'End interview' control while running", () => {
    seedRunningSession();
    renderPage();
    // Resumed into the running view (not the intro).
    expect(screen.queryByText(/Start Interview/i)).toBeNull();
    expect(screen.getByRole("button", { name: /end interview/i })).toBeTruthy();
  });

  it("'End & start over' warns, clears the saved session, and returns to intro", () => {
    seedRunningSession();
    expect(loadActiveSession(null)).not.toBeNull();

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /end interview/i }));

    const dialog = screen.getByRole("dialog");
    // The single-sitting warning is present.
    expect(
      within(dialog).getByText(/single sitting/i),
    ).toBeTruthy();

    fireEvent.click(
      within(dialog).getByRole("button", { name: "End & start over" }),
    );

    // Back on the intro (can pick a preset + start a new interview)...
    expect(screen.getByText(/Start Interview/i)).toBeTruthy();
    // ...and the persisted blob is gone, so it can never force-resume.
    expect(loadActiveSession(null)).toBeNull();
  });

  it("'Keep going' dismisses the end dialog with no change", () => {
    seedRunningSession();
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /end interview/i }));

    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Keep going" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    // Still running, still saved.
    expect(loadActiveSession(null)).not.toBeNull();
  });
});

describe("MockPage — back arrow warns instead of silently leaving", () => {
  it("opens a three-option warning while running", () => {
    seedRunningSession();
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /back home/i }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/single sitting/i)).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Resume later" })).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "End interview" })).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Keep going" })).toBeTruthy();
  });

  it("'Resume later' keeps the saved session for next time", () => {
    seedRunningSession();
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /back home/i }));

    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Resume later" }));

    // Saved session survives so it resumes on the next visit.
    expect(loadActiveSession(null)).not.toBeNull();
  });

  it("'End interview' from the back dialog discards the saved session", () => {
    seedRunningSession();
    expect(loadActiveSession(null)).not.toBeNull();

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /back home/i }));

    const dialog = screen.getByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "End interview" }),
    );

    // Discarded: nothing left to force-resume.
    expect(loadActiveSession(null)).toBeNull();
  });
});
