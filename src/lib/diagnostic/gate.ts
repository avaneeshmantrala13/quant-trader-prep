/**
 * Pure guard logic for the REQUIRED-once onboarding diagnostic (approved
 * redesign). The diagnostic is a required ONBOARDING STEP — NOT a lesson lock:
 * once `diagnosticDoneAt` is stamped (by either the full warm-up or the
 * 20-second self-report fast lane), the learner is never force-routed again.
 *
 * This never touches `locking.ts`, `recordAttempt`, mastery-unlock, or the
 * v1→v2 migration — individual lessons still unlock purely via mastery.
 */

/** Authed paths exempt from the onboarding redirect (the diagnostic itself + login). */
export const DIAGNOSTIC_EXEMPT_PATHS = ["/diagnostic", "/login"];

/**
 * True when an authed learner must be redirected to `/diagnostic`: only when
 * the diagnostic has NOT been completed AND they aren't already on an exempt
 * path. Once `diagnosticDoneAt` is set (any non-empty stamp), always false.
 */
export function shouldRedirectToDiagnostic(
  pathname: string,
  diagnosticDoneAt?: string,
): boolean {
  if (diagnosticDoneAt) return false;
  return !DIAGNOSTIC_EXEMPT_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}
