// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import type { UserProgress } from "@/types/progress";

/**
 * The developer "Reset demo progress" control is a demo-polish escape hatch.
 * These tests pin (a) that it is gated strictly behind `isDeveloper`, (b) that
 * invoking it wipes the developer namespace + clears the forced-stage override
 * and reloads to the entry point (which re-derives the FIRST stage), and (c)
 * that a NON-developer session can neither see nor reach it.
 */

let SESSION: string | null = "real-user";
vi.mock("@/lib/storage", () => ({
  storage: {
    getSession: () => SESSION,
    logIn: async () => ({ ok: true }),
    signUp: async () => ({ ok: true }),
    logOut: () => {},
    loadProgress: () => ({}),
    saveProgress: (u: string, next: UserProgress) => {
      localStorage.setItem(`qtp.progress.${u}`, JSON.stringify(next));
    },
  },
}));

// eslint-disable-next-line import/first
import { AuthProvider } from "@/context/AuthContext";
// eslint-disable-next-line import/first
import {
  DevPipelineProvider,
  useDevPipeline,
} from "@/context/DevPipelineContext";
// eslint-disable-next-line import/first
import { DevResetControl } from "./DevResetControl";
// eslint-disable-next-line import/first
import { installMemoryLocalStorage } from "@/test/memoryLocalStorage";

/** A probe exposing the shared forced stage + a raw setter to seed one. */
function Probe() {
  const { forcedStage, setForcedStage } = useDevPipeline();
  return (
    <div>
      <span data-testid="forced">{forcedStage ?? "none"}</span>
      <button
        data-testid="raw-force-mock"
        onClick={() => setForcedStage("mock")}
      />
    </div>
  );
}

function renderControl() {
  return render(
    <AuthProvider>
      <DevPipelineProvider>
        <DevResetControl />
        <Probe />
      </DevPipelineProvider>
    </AuthProvider>,
  );
}

const click = (id: string) =>
  act(() => {
    fireEvent.click(screen.getByTestId(id));
  });

let assignSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  installMemoryLocalStorage();
  SESSION = "real-user";
  assignSpy = vi.fn();
  Object.defineProperty(window, "location", {
    value: { assign: assignSpy },
    writable: true,
    configurable: true,
  });
});
afterEach(cleanup);

describe("DevResetControl — isDeveloper gating", () => {
  it("renders nothing for a normal (non-developer) user", () => {
    renderControl();
    expect(screen.queryByTestId("dev-reset-control")).toBeNull();
    expect(screen.queryByTestId("dev-reset")).toBeNull();
  });

  it("renders the reset control for a developer session", () => {
    localStorage.setItem("qtp.dev.session", "1"); // dev session before mount
    renderControl();
    expect(screen.getByTestId("dev-reset-control")).toBeTruthy();
    expect(screen.getByTestId("dev-reset")).toBeTruthy();
  });
});

describe("DevResetControl — invoking fully resets the developer demo", () => {
  beforeEach(() => localStorage.setItem("qtp.dev.session", "1"));

  it("clears the forced stage + developer namespace and reloads to stage 1", () => {
    renderControl();

    // Seed a dev-only forced stage + some stale developer progress AFTER mount
    // (the one-time deploy reset has already run + latched its token by now).
    click("raw-force-mock");
    expect(screen.getByTestId("forced").textContent).toBe("mock");
    expect(localStorage.getItem("qtp.dev.forcedStage::developer")).toBe("mock");
    localStorage.setItem("qtp.progress.developer", JSON.stringify({ xp: 999 }));
    localStorage.setItem("qtp.mock.active.v3::developer", "{}");

    click("dev-reset");

    // Forced stage override cleared (in-memory + persisted key).
    expect(screen.getByTestId("forced").textContent).toBe("none");
    expect(localStorage.getItem("qtp.dev.forcedStage::developer")).toBeNull();
    // Developer session stores wiped; progress re-seeded to a clean doc.
    expect(localStorage.getItem("qtp.mock.active.v3::developer")).toBeNull();
    expect(
      JSON.parse(localStorage.getItem("qtp.progress.developer") as string).xp,
    ).toBe(0);
    // Reloaded to the entry point (router re-derives the first pipeline stage).
    expect(assignSpy).toHaveBeenCalledWith("/");
  });
});

describe("DevResetControl — a normal user cannot reach the reset", () => {
  it("exposes no control and can never trigger a wipe", () => {
    renderControl(); // SESSION real-user ⇒ not a developer
    expect(screen.queryByTestId("dev-reset")).toBeNull();
    expect(assignSpy).not.toHaveBeenCalled();
  });
});
