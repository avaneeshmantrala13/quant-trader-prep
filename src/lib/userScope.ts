/**
 * lib/userScope.ts — a tiny, dependency-free helper for namespacing
 * localStorage keys by the CURRENTLY logged-in user.
 *
 * WHY THIS EXISTS. Several in-progress "session" stores (the mock interview, the
 * arbitrage / EV-under-time / Fermi drills) persist their resumable state under
 * a SINGLE global localStorage key. On a shared browser that key is the same for
 * every account, so account B would resume account A's half-finished session —
 * a cross-account state leak. Scoping each key by a stable per-user identifier
 * gives every account its OWN independent session that never bleeds across a
 * login switch, while still resuming after a reload for the SAME user.
 *
 * IDENTITY SOURCE. Callers pass the identifier they already have synchronously
 * in the React layer — the auth context's `username` (which `getSession()`
 * resolves from the Cognito password/OAuth session, and which the local backend
 * uses verbatim). It is the same stable per-user handle the progress store keys
 * its localStorage mirror by (`qtp.progress.<username>`), so session scoping and
 * progress scoping line up 1:1. When no user is known (logged out / SSR) we fall
 * back to a fixed anonymous namespace so nothing crashes and anonymous sessions
 * simply share one clearly-separated bucket.
 */

/** The namespace used when there is no logged-in user (logged out / SSR). */
export const ANON_SCOPE = "anon";

/**
 * Normalize a raw user identifier into a stable, key-safe scope token. `null`/
 * `undefined`/blank collapse to {@link ANON_SCOPE}; everything else is trimmed
 * and lower-cased (matching the progress store's `username.toLowerCase()`
 * convention) so casing differences can't accidentally fork one user's session.
 */
export function scopeId(userId: string | null | undefined): string {
  if (userId == null) return ANON_SCOPE;
  const normalized = String(userId).trim().toLowerCase();
  return normalized === "" ? ANON_SCOPE : normalized;
}

/**
 * Build a per-user localStorage key from a stable `base` key and the current
 * user id: `"<base>::<scope>"`. Deterministic and pure. The `::` separator is
 * distinct from the dotted `qtp.*` base keys so a scoped key can never collide
 * with a pre-existing global one.
 */
export function userScopedKey(
  base: string,
  userId: string | null | undefined,
): string {
  return `${base}::${scopeId(userId)}`;
}
