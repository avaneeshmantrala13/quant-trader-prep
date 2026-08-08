// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { emptyProgress, type UserProgress } from "@/types/progress";

/**
 * The developer Knowledge State Tree viewer is a demo-only aid. These tests pin
 * that it is gated behind `isDeveloper`: a developer sees a "View knowledge-state
 * tree" button that opens the reused roadmap graph (live mastery); a NORMAL user
 * sees nothing and has no entry point (there is no route to reach either).
 */

let CURRENT: UserProgress = emptyProgress();
let SESSION: string | null = "real-user";
vi.mock("@/lib/storage", () => ({
  storage: {
    getSession: () => SESSION,
    loadProgress: () => CURRENT,
    saveProgress: (_u: string, next: UserProgress) => {
      CURRENT = next;
    },
    logIn: async () => ({ ok: true }),
    signUp: async () => ({ ok: true }),
    logOut: () => {},
    getTheme: () => "light",
    setTheme: () => {},
    getThemeId: () => "minimalist",
    setThemeId: () => {},
  },
}));

// eslint-disable-next-line import/first
import { AuthProvider } from "@/context/AuthContext";
// eslint-disable-next-line import/first
import { ProgressProvider } from "@/context/ProgressContext";
// eslint-disable-next-line import/first
import { DevKstView } from "./DevKstView";
// eslint-disable-next-line import/first
import { installMemoryLocalStorage } from "@/test/memoryLocalStorage";

function renderView() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <ProgressProvider>
          <DevKstView />
        </ProgressProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

const click = (id: string) =>
  act(() => {
    fireEvent.click(screen.getByTestId(id));
  });

beforeEach(() => {
  installMemoryLocalStorage();
  CURRENT = emptyProgress();
  SESSION = "real-user";
});
afterEach(cleanup);

describe("DevKstView — isDeveloper gating", () => {
  it("renders nothing for a normal (non-developer) user", () => {
    renderView();
    expect(screen.queryByTestId("dev-kst-view")).toBeNull();
    expect(screen.queryByTestId("dev-kst-open")).toBeNull();
  });

  it("renders the open control for a developer session", () => {
    localStorage.setItem("qtp.dev.session", "1"); // dev session before mount
    renderView();
    expect(screen.getByTestId("dev-kst-view")).toBeTruthy();
    expect(screen.getByTestId("dev-kst-open")).toBeTruthy();
    // The KST is not shown until explicitly opened.
    expect(screen.queryByTestId("dev-kst-modal")).toBeNull();
  });
});

describe("DevKstView — opening the live KST graph", () => {
  beforeEach(() => localStorage.setItem("qtp.dev.session", "1"));

  it("opens the reused roadmap graph and closes again", () => {
    renderView();
    click("dev-kst-open");

    // The modal mounts the reused SkillGraph, rendering the live KST.
    expect(screen.getByTestId("dev-kst-modal")).toBeTruthy();
    expect(
      screen.getByRole("img", {
        name: /developer knowledge state graph/i,
      }),
    ).toBeTruthy();

    // Close dismisses the overlay.
    click("dev-kst-close");
    expect(screen.queryByTestId("dev-kst-modal")).toBeNull();
  });
});

describe("DevKstView — a normal user cannot reach the KST", () => {
  it("exposes no button and no modal for a non-developer", () => {
    renderView(); // SESSION real-user ⇒ not a developer
    expect(screen.queryByTestId("dev-kst-open")).toBeNull();
    expect(screen.queryByTestId("dev-kst-modal")).toBeNull();
  });
});
