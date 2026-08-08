// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

/**
 * The DEVELOPER demo login is a client-side escape hatch: entering
 * `developer`/`123456` must flag the session `isDeveloper`, adopt the stable
 * dev userId, and NEVER touch the real backend auth. Real credentials must be
 * entirely unaffected.
 */

const logInSpy = vi.fn(async () => ({ ok: true }));
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
import { isDevSessionActive } from "@/lib/dev/devAccount";
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

const click = (id: string) =>
  act(() => {
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
  it("logs in as the developer without calling the backend", async () => {
    renderAuth();
    expect(screen.getByTestId("isDeveloper").textContent).toBe("false");

    click("dev-login");
    expect(screen.getByTestId("isDeveloper").textContent).toBe("true");
    expect(screen.getByTestId("username").textContent).toBe("developer");
    // The real backend auth is bypassed entirely.
    expect(logInSpy).not.toHaveBeenCalled();
    // The session is persisted (reload-proof).
    expect(isDevSessionActive()).toBe(true);
  });

  it("also enters developer mode from the sign-up path (case-insensitive)", () => {
    renderAuth();
    click("dev-signup");
    expect(screen.getByTestId("isDeveloper").textContent).toBe("true");
    expect(screen.getByTestId("username").textContent).toBe("developer");
    expect(signUpSpy).not.toHaveBeenCalled();
  });

  it("does NOT flag developer for a real account (backend is used)", () => {
    renderAuth();
    click("real-login");
    expect(logInSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("isDeveloper").textContent).toBe("false");
    // Real session username comes from the backend session.
    expect(screen.getByTestId("username").textContent).toBe("real-user");
    expect(isDevSessionActive()).toBe(false);
  });

  it("clears the developer session on sign out", () => {
    renderAuth();
    click("dev-login");
    expect(screen.getByTestId("isDeveloper").textContent).toBe("true");
    click("logout");
    expect(screen.getByTestId("isDeveloper").textContent).toBe("false");
    expect(screen.getByTestId("username").textContent).toBe("null");
    expect(isDevSessionActive()).toBe(false);
    expect(logOutSpy).toHaveBeenCalledTimes(1);
  });

  it("restores a persisted developer session on mount (reload-proof)", () => {
    // Simulate a reload where the dev session flag is already set.
    localStorage.setItem("qtp.dev.session", "1");
    renderAuth();
    expect(screen.getByTestId("isDeveloper").textContent).toBe("true");
    expect(screen.getByTestId("username").textContent).toBe("developer");
  });
});
