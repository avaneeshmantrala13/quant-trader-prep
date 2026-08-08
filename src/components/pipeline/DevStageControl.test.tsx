// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import type { Stage } from "@/lib/pipeline/stateMachine";

/**
 * The developer skip control is the ONLY UI surface for the bypass. These tests
 * pin (a) that it is gated behind `isDeveloper`, (b) that advance / jump / resume
 * drive the shared `forcedStage` override, and (c) that a NON-developer session
 * can never acquire a forced stage — the override is inert without the flag.
 */

let SESSION: string | null = "real-user";
vi.mock("@/lib/storage", () => ({
  storage: {
    getSession: () => SESSION,
    logIn: async () => ({ ok: true }),
    signUp: async () => ({ ok: true }),
    logOut: () => {},
    loadProgress: () => ({}),
    saveProgress: () => {},
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
import { DevStageControl } from "./DevStageControl";
// eslint-disable-next-line import/first
import { installMemoryLocalStorage } from "@/test/memoryLocalStorage";

/** A probe exposing the shared forced stage + a raw setter to prove gating. */
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

function renderControl(current: Stage = "diagnostic-untimed") {
  return render(
    <AuthProvider>
      <DevPipelineProvider>
        <DevStageControl current={current} />
        <Probe />
      </DevPipelineProvider>
    </AuthProvider>,
  );
}

const click = (id: string) =>
  act(() => {
    fireEvent.click(screen.getByTestId(id));
  });

beforeEach(() => {
  installMemoryLocalStorage();
  SESSION = "real-user";
});
afterEach(cleanup);

describe("DevStageControl — isDeveloper gating", () => {
  it("renders nothing for a normal (non-developer) user", () => {
    renderControl();
    expect(screen.queryByTestId("dev-stage-control")).toBeNull();
  });

  it("renders the control for a developer session", () => {
    localStorage.setItem("qtp.dev.session", "1"); // dev session before mount
    renderControl();
    expect(screen.getByTestId("dev-stage-control")).toBeTruthy();
  });
});

describe("DevStageControl — force-advance / set-stage drive the override", () => {
  beforeEach(() => localStorage.setItem("qtp.dev.session", "1"));

  it("advances to the NEXT stage regardless of gates", () => {
    renderControl("diagnostic-untimed");
    expect(screen.getByTestId("forced").textContent).toBe("none");
    click("dev-advance");
    expect(screen.getByTestId("forced").textContent).toBe("diagnostic-timed");
  });

  it("jumps directly to ANY stage via the selector", () => {
    renderControl("diagnostic-untimed");
    act(() => {
      fireEvent.change(screen.getByTestId("dev-jump"), {
        target: { value: "greenlight" },
      });
    });
    expect(screen.getByTestId("forced").textContent).toBe("greenlight");
  });

  it("resume clears the override (back to the live gate-derived stage)", () => {
    renderControl("diagnostic-untimed");
    click("dev-advance");
    expect(screen.getByTestId("forced").textContent).toBe("diagnostic-timed");
    click("dev-resume");
    expect(screen.getByTestId("forced").textContent).toBe("none");
  });
});

describe("DevStageControl — a normal user cannot acquire a forced stage", () => {
  it("keeps forcedStage null for a non-developer even if setForcedStage is called", () => {
    renderControl(); // SESSION real-user ⇒ not a developer
    expect(screen.getByTestId("forced").textContent).toBe("none");
    // Even directly poking the setter cannot bypass — the provider forces null.
    click("raw-force-mock");
    expect(screen.getByTestId("forced").textContent).toBe("none");
  });
});
