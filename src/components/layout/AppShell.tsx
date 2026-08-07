import { useCallback, useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useProgress } from "@/context/ProgressContext";
import { useTheme } from "@/context/ThemeContext";
import type { GoalMode } from "@/types/progress";
import { appTitleFor } from "@/lib/mode/goalMode";
import { NavMenu } from "@/components/layout/NavMenu";
import { ThemeBackground } from "@/components/visuals/ThemeBackground";
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";
import { onboardingStepsForMode } from "@/lib/onboarding/steps";
import { shouldShowOnboardingTour } from "@/lib/onboarding/tour";
import {
  CandlestickIcon,
  LogoutIcon,
  MoonIcon,
  SunIcon,
} from "@/components/icons";

/**
 * FRONTEND GOAL MODE — course remediation is backend-only, so every frontend
 * surface operates in the quant "interview" path. The `goalMode` store field and
 * all course-mode logic (`navFor("course")`, the course blueprint, the course
 * tour, `appTitleFor("course")`, …) stay defined and importable for a future
 * re-enable; the UI simply never reads anything but this constant.
 */
const FRONTEND_GOAL_MODE: GoalMode = "interview";

function today(): string {
  return new Date()
    .toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
    .toUpperCase();
}

export function AppShell() {
  const { username, logOut } = useAuth();
  const { progress, markOnboardingTourDone } = useProgress();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  const mode = FRONTEND_GOAL_MODE;

  // New-user onboarding tour. Auto-opens ONCE, right after the diagnostic is
  // finished and the learner lands on an in-app route (trigger logic lives in
  // the pure `shouldShowOnboardingTour`). We stamp the "shown once" flag on
  // first auto-open so it never reappears on its own; it stays re-openable via
  // the "Show tutorial" affordance below.
  const [tourOpen, setTourOpen] = useState(false);
  const autoStartedRef = useRef(false);

  useEffect(() => {
    if (autoStartedRef.current) return;
    if (
      shouldShowOnboardingTour(
        progress.diagnosticDoneAt,
        progress.onboardingTourDoneAt,
        location.pathname,
      )
    ) {
      autoStartedRef.current = true;
      setTourOpen(true);
      markOnboardingTourDone();
    }
  }, [
    progress.diagnosticDoneAt,
    progress.onboardingTourDoneAt,
    location.pathname,
    markOnboardingTourDone,
  ]);

  const closeTour = useCallback(() => {
    setTourOpen(false);
    markOnboardingTourDone();
  }, [markOnboardingTourDone]);

  // The onboarding tour can reveal the shared nav menu so its coach-marks can
  // anchor to items that would otherwise be collapsed. `tourTarget` mirrors the
  // tour's active anchor and is handed to `NavMenu`, which owns the menu's
  // open/collapse state and tour-driven reveal.
  const [tourTarget, setTourTarget] = useState<string | undefined>(undefined);

  return (
    <div className="relative min-h-[100dvh]">
      <ThemeBackground />

      {/* z-50 lifts the header's stacking context ABOVE the z-30 scrim (rendered
          by NavMenu). The menu (z-40) therefore paints and receives pointer
          events above the scrim, while the scrim (z-30) still dims main/footer
          (z-10). */}
      <header className="relative z-50 border-b-[3px] border-border-strong bg-surface">
        {/* Meta / dateline bar */}
        <div className="border-b border-subtle">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-1.5">
            <span className="label hidden truncate text-[9px] sm:block">
              {today()}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setTourOpen(true)}
                className="btn-ghost !min-h-0 gap-1.5 !px-2 !py-1.5"
                aria-label="Show tutorial"
                title="Show the getting-started tutorial"
              >
                <span
                  aria-hidden="true"
                  className="grid h-4 w-4 place-items-center rounded-full border border-current text-[10px] font-bold leading-none"
                >
                  ?
                </span>
                <span className="label hidden text-[9px] sm:inline">
                  Tutorial
                </span>
              </button>
              <button
                onClick={toggleTheme}
                className="btn-ghost !min-h-0 !px-2 !py-1.5"
                aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                title="Toggle theme"
              >
                {theme === "dark" ? (
                  <SunIcon width={16} height={16} />
                ) : (
                  <MoonIcon width={16} height={16} />
                )}
              </button>
              <button
                onClick={logOut}
                className="btn-ghost !min-h-0 !px-2 !py-1.5"
                aria-label="Log out"
                title={`Log out ${username ?? ""}`}
              >
                <LogoutIcon width={16} height={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Nameplate + hamburger */}
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            {/* Hamburger: the shared full navigation menu. */}
            <NavMenu mode={mode} tourTarget={tourTarget} />

            <NavLink to="/" className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center border border-border-strong text-primary">
                <CandlestickIcon width={22} height={22} />
              </span>
              <span className="flex flex-col leading-none">
                <span className="font-display text-2xl font-black tracking-tight text-primary sm:text-3xl">
                  {appTitleFor(mode)}
                </span>
              </span>
            </NavLink>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-4 py-6 sm:py-8">
        <Outlet />
      </main>

      <footer className="relative z-10 mx-auto max-w-6xl px-4 pb-8 pt-4">
        <div className="border-t border-subtle pt-3 text-center">
          <span className="label text-[9px]">
            {appTitleFor(mode)} · Local Edition · Set in Fraunces &amp; IBM Plex
            Mono
          </span>
        </div>
      </footer>

      <OnboardingTour
        open={tourOpen}
        steps={onboardingStepsForMode(mode)}
        onClose={closeTour}
        onActiveTargetChange={setTourTarget}
      />
    </div>
  );
}
