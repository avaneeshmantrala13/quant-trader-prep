// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

/**
 * The DEVELOPER demo login is a demo escape hatch: entering `developer`/`123456`
 * must flag the session `isDeveloper` and adopt the stable dev userId, AND now
 * also drive a REAL Cognito sign-in as the throwaway demo user (via the SAME
 * `storage.logIn` path) so the session carries a valid ID token for the
 * JWT-gated `/ai` endpoint. Real credentials must be entirely unaffected, and a
 * Cognito failure must degrade gracefully to local-only dev mode.
 */

const logInSpy = vi.fn(
  async (): Promise<{ ok: boolean; error?: string }> => ({ ok: true }),
);
const signUpSpy = vi.fn(async () => ({ ok: true }));
const logOutSpy = vi.fn();
let SESSION: string | null = "real-user";

vi.mock("@/lib/storage", () => ({
  storage: {
    getSession: () => SESSION,
    logIn: (...a: unknown[]) => logInSpy(...(a as [])),
    signUp: (...a: unknown[]) => signUpSpy(...(a as [])),
    logOut: () => logOutSpy(),
    loadProgress: () => ({}),
    saveProgress: () => {},
  },
}));

// eslint-disable-next-line import/first
import { AuthProvider, useAuth } from "./AuthContext";
// eslint-disable-next-line import/first
import {
  DEV_COGNITO_PASSWORD,
  DEV_COGNITO_USERNAME,
  isDevSessionActive,
} from "@/lib/dev/devAccount";
// eslint-disable-next-line import/first
import { installMemoryLocalStorage } from "@/test/memoryLocalStorage";

function Harness() {
  const { username, isDeveloper, logIn, signUp, logOut } = useAuth();
  return (
    <div>
      <span data-testid="username">{username ?? "null"}</span>
      <span data-testid="isDeveloper">{String(isDeveloper)}</span>
      <button data-testid="dev-login" onClick={() => void logIn("developer", "123456")} />
      <button data-testid="dev-signup" onClick={() => void signUp("Developer", "123456")} />
      <button data-testid="real-login" onClick={() => void logIn("alice", "hunter2")} />
      <button data-testid="logout" onClick={() => logOut()} />
    </div>
  );
}

function renderAuth() {
  return render(
    <AuthProvider>
      <Harness />
    </AuthProvider>,
  );
}

const click = async (id: string) =>
  await act(async () => {
    fireEvent.click(screen.getByTestId(id));
  });

beforeEach(() => {
  installMemoryLocalStorage();
  logInSpy.mockClear();
  signUpSpy.mockClear();
  logOutSpy.mockClear();
  SESSION = "real-user";
});
afterEach(cleanup);

describe("AuthContext — developer demo login", () => {
  it("flags the developer session AND drives a real Cognito sign-in with the demo user", async () => {
    renderAuth();
    expect(screen.getByTestId("isDeveloper").textContent).toBe("false");

    await click("dev-login");
    expect(screen.getByTestId("isDeveloper").textContent).toBe("true");
    // The app-facing username stays the STABLE dev id (all dev powers/scoping).
    expect(screen.getByTestId("username").textContent).toBe("developer");
    // The typed `developer`/`123456` creds map to a REAL Cognito sign-in as the
    // throwaway demo user — so the session carries a valid ID token for `/ai`.
    expect(logInSpy).toHaveBeenCalledTimes(1);
    expect(logInSpy).toHaveBeenCalledWith(
      DEV_COGNITO_USERNAME,
      DEV_COGNITO_PASSWORD,
    );
    // The session is persisted (reload-proof).
    expect(isDevSessionActive()).toBe(true);
  });

  it("also enters developer mode from the sign-up path (case-insensitive) and signs into Cognito", async () => {
    renderAuth();
    await click("dev-signup");
    expect(screen.getByTestId("isDeveloper").textContent).toBe("true");
    expect(screen.getByTestId("username").textContent).toBe("developer");
    // Sign-up path bypasses the real signUp but still establishes the Cognito
    // demo session via logIn (never signUp — the demo user already exists).
    expect(signUpSpy).not.toHaveBeenCalled();
    expect(logInSpy).toHaveBeenCalledWith(
      DEV_COGNITO_USERNAME,
      DEV_COGNITO_PASSWORD,
    );
  });

  it("still enters local-only dev mode when the Cognito sign-in fails (graceful fallback)", async () => {
    logInSpy.mockResolvedValueOnce({ ok: false, error: "offline" });
    renderAuth();
    await click("dev-login");
    // Cognito failed, but the demo must NOT hard-break: dev powers stay on.
    expect(screen.getByTestId("isDeveloper").textContent).toBe("true");
    expect(screen.getByTestId("username").textContent).toBe("developer");
    expect(isDevSessionActive()).toBe(true);
    expect(logInSpy).toHaveBeenCalledTimes(1);
  });

  it("does NOT flag developer for a real account (backend is used)", async () => {
    renderAuth();
    await click("real-login");
    expect(logInSpy).toHaveBeenCalledTimes(1);
    expect(logInSpy).toHaveBeenCalledWith("alice", "hunter2");
    expect(screen.getByTestId("isDeveloper").textContent).toBe("false");
    // Real session username comes from the backend session.
    expect(screen.getByTestId("username").textContent).toBe("real-user");
    expect(isDevSessionActive()).toBe(false);
  });

  it("clears the developer session on sign out", async () => {
    renderAuth();
    await click("dev-login");
    expect(screen.getByTestId("isDeveloper").textContent).toBe("true");
    await click("logout");
    expect(screen.getByTestId("isDeveloper").textContent).toBe("false");
    expect(screen.getByTestId("username").textContent).toBe("null");
    expect(isDevSessionActive()).toBe(false);
    expect(logOutSpy).toHaveBeenCalledTimes(1);
  });

  it("restores a persisted developer session on mount and refreshes the Cognito session", async () => {
    // Simulate a reload where the dev session flag is already set.
    localStorage.setItem("qtp.dev.session", "1");
    await act(async () => {
      renderAuth();
    });
    expect(screen.getByTestId("isDeveloper").textContent).toBe("true");
    expect(screen.getByTestId("username").textContent).toBe("developer");
    // The mount effect re-authenticates the demo user so the ID token stays
    // valid across reloads (the stored token expires ~1h).
    expect(logInSpy).toHaveBeenCalledWith(
      DEV_COGNITO_USERNAME,
      DEV_COGNITO_PASSWORD,
    );
  });
});
