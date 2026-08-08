/**
 * lib/dev/devReset.ts — a FULL, repeatable reset of the DEVELOPER demo account
 * (a demo-polish escape hatch, NOT production logic).
 *
 * WHY THIS EXISTS. The `developer` demo (see {@link ./devAccount}) persists its
 * OWN namespaced progress (`qtp.progress.developer`), a dev `forcedStage`
 * override (`qtp.dev.forcedStage::developer`), and every per-user "session"
 * store scoped via {@link userScopedKey} (`…::developer` — mock, arbitrage,
 * EV-under-time, Fermi, game sessions). To give a clean live demo we need a
 * one-click way to wipe ALL of that and return to the very first pipeline stage,
 * without ever touching a REAL account's data.
 *
 * SCOPE / SAFETY. We only ever remove keys that belong to the developer scope:
 *   - the developer progress blob `qtp.progress.developer`, and
 *   - every key suffixed `::developer` (the {@link userScopedKey} convention).
 * The persisted DEV SESSION flag (`qtp.dev.session`) is deliberately LEFT ALONE
 * so a reset keeps you logged in as the developer — it just drops you back at a
 * fresh diagnostic. Global/shared keys (accounts, theme, real users' progress)
 * are never matched, so a normal account is byte-for-byte unaffected.
 */

import { storage } from "@/lib/storage";
import { emptyProgress } from "@/types/progress";
import { scopeId } from "@/lib/userScope";
import { DEV_USER_ID } from "./devAccount";

/**
 * A deploy-scoped token. Bump this string to force ONE clean reset of the
 * developer demo the first time each browser loads the new build (see
 * {@link maybeRunOneTimeDevReset}). This is how a deployed demo "starts clean"
 * WITHOUT a wipe-on-every-login that would break persistence mid-demo.
 */
export const DEV_PROGRESS_RESET_TOKEN = "2026-08-08";

/** localStorage key recording the last reset token this browser has applied. */
const DEV_RESET_TOKEN_KEY = "qtp.dev.resetToken";

/**
 * TRUE iff `key` belongs to the developer demo namespace: either the developer
 * progress blob or a per-user session key scoped to the developer via
 * {@link userScopedKey} (`base::developer`). Pure — trivially unit-testable.
 */
function isDeveloperScopedKey(key: string): boolean {
  const scope = scopeId(DEV_USER_ID); // "developer"
  return key === `qtp.progress.${scope}` || key.endsWith(`::${scope}`);
}

/**
 * FULLY reset the developer demo: remove every developer-scoped localStorage key
 * (progress, forced stage, and all per-user session stores), then re-seed a
 * clean default progress doc so the next load is instant and lands on the first
 * pipeline stage (a fresh diagnostic). Idempotent and repeatable; never touches
 * the dev session flag or any real account. Callers reload/redirect afterward so
 * the live React contexts re-hydrate from the wiped state.
 */
export function resetDeveloperProgress(): void {
  try {
    // Collect first, then remove — never mutate while iterating by index.
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && isDeveloperScopedKey(k)) toRemove.push(k);
    }
    for (const k of toRemove) localStorage.removeItem(k);
  } catch {
    /* storage unavailable — non-fatal for the demo */
  }
  // Re-init the developer namespace with a fresh, empty progress doc.
  try {
    storage.saveProgress(DEV_USER_ID, emptyProgress());
  } catch {
    /* ignore */
  }
}

/**
 * Run {@link resetDeveloperProgress} AT MOST ONCE per deploy token, per browser.
 * Called on developer-session start (login and reload-restore) so a browser that
 * still holds stale demo progress from a prior build gets wiped clean exactly
 * once when the new build first loads — and never again, so progress persists
 * normally for the rest of the demo. A no-op once the current token is stored.
 */
export function maybeRunOneTimeDevReset(): void {
  let applied: string | null = null;
  try {
    applied = localStorage.getItem(DEV_RESET_TOKEN_KEY);
  } catch {
    /* ignore */
  }
  if (applied === DEV_PROGRESS_RESET_TOKEN) return;
  resetDeveloperProgress();
  try {
    localStorage.setItem(DEV_RESET_TOKEN_KEY, DEV_PROGRESS_RESET_TOKEN);
  } catch {
    /* ignore */
  }
}
