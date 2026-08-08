/**
 * lib/dev/devAccount.ts — the client-side DEVELOPER demo account (a demo escape
 * hatch, NOT production auth).
 *
 * WHY THIS EXISTS. To demo every guided-pipeline stage without grinding through
 * the real gates, a hardcoded local credential (`developer` / `123456`) logs in
 * as a stable dev user. It:
 *   - lives in its OWN userId namespace ({@link DEV_USER_ID}) so demo progress
 *     never pollutes a real account's `qtp.progress.<username>` blob, and
 *   - flags the session as `isDeveloper` (persisted in localStorage so it
 *     survives a reload) so the app can reveal a dev-only skip control.
 *
 * SCOPE. This is deliberately simple and local-only: it short-circuits the
 * normal `StorageProvider` auth (Cognito / local) BEFORE any backend call, so
 * it works identically on every backend. It is intercepted in
 * {@link AuthContext}'s `logIn`/`signUp` and gates ONLY the dev features — real
 * accounts are entirely unaffected.
 */

/** The username a demo user types to enter developer mode. */
export const DEV_USERNAME = "developer";

/** The (hardcoded, demo-only) password for the developer account. */
export const DEV_PASSWORD = "123456";

/**
 * The stable userId the developer session runs under. Progress is namespaced by
 * this handle (`qtp.progress.developer`), so the demo has its OWN independent
 * progress that never bleeds into a real user's.
 */
export const DEV_USER_ID = DEV_USERNAME;

/** localStorage key recording that a developer session is active (reload-proof). */
const DEV_SESSION_KEY = "qtp.dev.session";

/**
 * TRUE iff `(username, password)` are the developer credentials. The username is
 * trimmed and matched case-INSENSITIVELY (mirroring the storage layer's
 * `username.toLowerCase()` convention); the password must match exactly. Pure —
 * no side effects — so it is trivially unit-testable and safe to call anywhere.
 */
export function isDeveloperCredentials(
  username: string,
  password: string,
): boolean {
  return (
    username.trim().toLowerCase() === DEV_USERNAME && password === DEV_PASSWORD
  );
}

/** TRUE if a developer session is currently persisted (survives reloads). */
export function isDevSessionActive(): boolean {
  try {
    return localStorage.getItem(DEV_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

/** Persist that a developer session is active. */
export function startDevSession(): void {
  try {
    localStorage.setItem(DEV_SESSION_KEY, "1");
  } catch {
    /* storage full / unavailable — non-fatal for the demo */
  }
}

/** Clear the persisted developer session (on sign out). */
export function endDevSession(): void {
  try {
    localStorage.removeItem(DEV_SESSION_KEY);
  } catch {
    /* ignore */
  }
}
