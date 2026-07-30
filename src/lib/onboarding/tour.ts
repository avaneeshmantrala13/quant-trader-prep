/**
 * Pure logic for the new-user ONBOARDING TOUR (approved redesign — additive,
 * no layout overhaul). The tour is a short, themed, step-by-step overlay that
 * appears once, right after the learner finishes the diagnostic for the first
 * time, and orients them to the app's tabs + recommended order.
 *
 * This module holds NO React and NO side effects so the trigger + flag logic
 * is deterministically unit-testable. It is purely additive: it never touches
 * `recordAttempt`, `recordItemAttempt`, `LevelProgress.mastered`, locking,
 * scoring, or the v1→v2 migration. It only reads/writes the additive
 * `onboardingTourDoneAt` UI flag.
 */

import type { UserProgress } from "@/types/progress";

/**
 * Authed paths where the tour must NOT auto-appear: the login screen and the
 * diagnostic itself. The tour is meant to greet the learner once they land in
 * the app AFTER completing the diagnostic (the diagnostic navigates to an
 * in-app route on finish), so it stays out of the way on these paths.
 */
export const ONBOARDING_TOUR_EXEMPT_PATHS = ["/login", "/diagnostic"];

/**
 * True when the onboarding tour should auto-appear: the diagnostic is done,
 * the tour has NOT been shown yet, and the learner is on an in-app route (not
 * `/login` or `/diagnostic`). Once `onboardingTourDoneAt` is set (any non-empty
 * stamp), this is always false — the tour "shows once" and is thereafter only
 * re-openable on demand via the "Show tutorial" affordance.
 */
export function shouldShowOnboardingTour(
  diagnosticDoneAt: string | undefined,
  onboardingTourDoneAt: string | undefined,
  pathname: string,
): boolean {
  if (!diagnosticDoneAt) return false;
  if (onboardingTourDoneAt) return false;
  return !ONBOARDING_TOUR_EXEMPT_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/**
 * Stamp the additive `onboardingTourDoneAt` flag in place so the tour never
 * auto-reappears. Mirrors how the diagnostic stamps `diagnosticDoneAt`:
 * additive-only, touches no other field. Returns the same object for
 * convenience. Safe to call repeatedly (last stamp wins).
 */
export function markOnboardingTourDoneInPlace(
  p: UserProgress,
  at?: string,
): UserProgress {
  p.onboardingTourDoneAt = at ?? new Date().toISOString();
  return p;
}
