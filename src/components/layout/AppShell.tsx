import { useCallback, useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useProgress } from "@/context/ProgressContext";
import { useTheme } from "@/context/ThemeContext";
import { resolveGoalMode } from "@/lib/mode/goalMode";
import { navFor } from "@/lib/mode/visibility";
import { ModeToggle } from "@/components/mode/ModeToggle";
import { ThemeBackground } from "@/components/visuals/ThemeBackground";
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";
import { onboardingStepsForMode } from "@/lib/onboarding/steps";
import { shouldShowOnboardingTour } from "@/lib/onboarding/tour";
import {
  CandlestickIcon,
  ChevronDownIcon,
  CloseIcon,
  LogoutIcon,
  MenuIcon,
  MoonIcon,
  SunIcon,
} from "@/components/icons";

/**
 * localStorage-persisted map of nav SUBSECTION id → user's explicit
 * expanded(true)/collapsed(false) preference. Only groups the user has actually
 * toggled appear here; everything else falls back to the group's `defaultOpen`.
 * SSR/privacy-mode safe (guards `localStorage`), and tolerant of malformed JSON.
 */
const NAV_OPEN_KEY = "qtp.nav.open";

function readNavOpen(): Record<string, boolean> {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(NAV_OPEN_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, boolean>;
    }
  } catch {
    /* ignore malformed / unavailable storage */
  }
  return {};
}

function writeNavOpen(map: Record<string, boolean>): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(NAV_OPEN_KEY, JSON.stringify(map));
  } catch {
    /* ignore quota / unavailable storage */
  }
}

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

  /* ---- Hamburger navigation menu ----------------------------------------- */
  // The nav is a single 3-line "hamburger" button that opens a themed, keyboard-
  // accessible menu of every destination. `menuOpen` tracks a USER-driven open
  // (focus-managed, Esc / click-outside close). The onboarding tour can also
  // reveal the menu so its coach-marks can anchor to items that would otherwise
  // be collapsed (`tourTarget`) — that open is passive (no focus trap / scrim)
  // because the tour owns focus while it runs.
  const [menuOpen, setMenuOpen] = useState(false);
  const [tourTarget, setTourTarget] = useState<string | undefined>(undefined);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuBtnRef = useRef<HTMLButtonElement | null>(null);

  // Every nav target lives inside the menu, so any anchored tour step (i.e. any
  // target other than the hamburger button itself) needs the menu revealed.
  const tourWantsMenu = tourTarget != null && tourTarget !== "menu";
  const menuVisible = menuOpen || tourWantsMenu;

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  // User-open behaviors: move focus into the menu, close on Esc (restoring focus
  // to the button), and close on an outside click. Skipped for a tour-driven
  // reveal so the tour's own focus management is never fought.
  useEffect(() => {
    if (!menuOpen) return;
    const raf = window.requestAnimationFrame(() => {
      menuRef.current
        ?.querySelector<HTMLElement>('[role="menuitem"]')
        ?.focus();
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        menuBtnRef.current?.focus();
      }
    };
    const onPointer = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        !menuRef.current?.contains(t) &&
        !menuBtnRef.current?.contains(t)
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      window.cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [menuOpen]);

  // Close the menu whenever the route changes (a menu item navigated).
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Mode-aware navigation (WS2). `navFor(mode)` returns the nav organised into
  // collapsible SUBSECTIONS (Overview / Learn / Practice / Games / Interview
  // Prep / Community / …). Case A keeps the course-relevant groups prominent and
  // the quant-heavy groups de-emphasized under a "beyond the course" framing.
  // Each item keeps its `data-tour` hook so the onboarding coach-marks still
  // anchor correctly (a collapsed group is force-expanded while the tour points
  // into it — see `tourWantsMenu` below).
  const mode = resolveGoalMode(progress);
  const navGroups = navFor(mode);

  // Per-subsection expand/collapse. `navOpen` holds only the user's EXPLICIT
  // toggles (persisted); anything absent falls back to the group's `defaultOpen`
  // (and, until the user has an opinion, to auto-expanding whichever group holds
  // the active route). Writing an explicit value always wins from then on.
  const [navOpen, setNavOpen] = useState<Record<string, boolean>>(readNavOpen);
  const setGroupOpen = useCallback((id: string, open: boolean) => {
    setNavOpen((prev) => {
      const next = { ...prev, [id]: open };
      writeNavOpen(next);
      return next;
    });
  }, []);

  return (
    <div className="relative min-h-[100dvh]">
      <ThemeBackground />

      {/* z-50 lifts the header's stacking context ABOVE the z-30 scrim (a root
          sibling). The menu (z-40, a header descendant) therefore paints and
          receives pointer events above the scrim. Event order on a menu-item
          click: mousedown (target inside menuRef → click-outside handler no-ops)
          → click → NavLink navigates + closeMenu(); route-change effect also
          closes. The scrim (z-30) still dims main/footer (z-10). */}
      <header className="relative z-50 border-b-[3px] border-border-strong bg-surface">
        {/* Meta / dateline bar */}
        <div className="border-b border-subtle">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-1.5">
            <span className="label hidden truncate text-[9px] sm:block">
              {today()}
            </span>
            <div className="flex items-center gap-1">
              <ModeToggle size="sm" />
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
            {/* Hamburger: opens the full navigation menu. */}
            <div className="relative">
              <button
                ref={menuBtnRef}
                type="button"
                data-tour="menu"
                onClick={() => setMenuOpen((o) => !o)}
                aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
                aria-haspopup="menu"
                aria-expanded={menuVisible}
                aria-controls="app-nav-menu"
                title="Navigation"
                className="btn-ghost !min-h-0 gap-1.5 !px-2.5 !py-2"
              >
                {menuOpen ? (
                  <CloseIcon width={20} height={20} />
                ) : (
                  <MenuIcon width={20} height={20} />
                )}
                <span className="label hidden text-[9px] sm:inline">Menu</span>
              </button>

              {menuVisible && (
                <div
                  id="app-nav-menu"
                  ref={menuRef}
                  role="menu"
                  aria-label="Main navigation"
                  className="absolute left-0 top-full z-40 mt-2 max-h-[70vh] w-64 overflow-y-auto rounded-md border border-border-strong bg-surface p-1 shadow-2xl motion-safe:animate-print-in"
                >
                  {navGroups.map((group, gi) => {
                    // A group is active when the current route lives inside it.
                    const groupHasActiveRoute = group.items.some((item) => {
                      const base = item.to.split("?")[0];
                      return item.end
                        ? location.pathname === base
                        : location.pathname === base ||
                            location.pathname.startsWith(`${base}/`);
                    });
                    // Display state (what the chevron/toggle reflect): explicit
                    // user pref wins; otherwise auto-open the active group, else
                    // fall back to the group's default.
                    const explicit = navOpen[group.id];
                    const displayOpen =
                      explicit !== undefined
                        ? explicit
                        : groupHasActiveRoute || group.defaultOpen;
                    // While the tour points into this group, force it open so the
                    // coach-mark can anchor to the item's `data-tour` element.
                    const tourInGroup =
                      tourTarget != null &&
                      group.items.some((item) => item.tour === tourTarget);
                    const open = displayOpen || tourInGroup;
                    const panelId = `nav-group-${group.id}`;
                    return (
                      <div
                        key={group.id}
                        className={gi > 0 ? "mt-1 border-t border-subtle pt-1" : ""}
                      >
                        <button
                          type="button"
                          onClick={() => setGroupOpen(group.id, !displayOpen)}
                          aria-expanded={open}
                          aria-controls={panelId}
                          className={`label flex w-full items-center justify-between gap-2 rounded-sm px-3 pb-1 pt-2 text-left text-[9px] transition-colors hover:text-primary ${
                            group.emphasis === "beyond"
                              ? "text-muted/80"
                              : "text-muted"
                          }`}
                        >
                          <span className="truncate">{group.heading}</span>
                          <ChevronDownIcon
                            aria-hidden="true"
                            width={12}
                            height={12}
                            className={`shrink-0 transition-transform ${
                              open ? "" : "-rotate-90"
                            }`}
                          />
                        </button>
                        {open && (
                          <div id={panelId} role="group" aria-label={group.heading}>
                            {group.items.map((item) => (
                              <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.end}
                                role="menuitem"
                                data-tour={item.tour}
                                onClick={closeMenu}
                                className={({ isActive }) =>
                                  `block rounded-sm px-3 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-label transition-colors ${
                                    isActive
                                      ? "bg-accent text-accent-contrast"
                                      : item.emphasis === "beyond"
                                        ? "text-muted hover:bg-surface-muted hover:text-primary"
                                        : "text-secondary hover:bg-surface-muted hover:text-primary"
                                  }`
                                }
                              >
                                {item.label}
                              </NavLink>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <NavLink to="/" className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center border border-border-strong text-primary">
                <CandlestickIcon width={22} height={22} />
              </span>
              <span className="flex flex-col leading-none">
                <span className="font-display text-2xl font-black tracking-tight text-primary sm:text-3xl">
                  Quant Trader Prep
                </span>
              </span>
            </NavLink>
          </div>
        </div>
      </header>

      {/* Dimming scrim for a user-opened menu (closes on click; the tour uses
          its own spotlight so no scrim is shown during a tour reveal). */}
      {menuOpen && (
        <button
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          onClick={closeMenu}
          className="fixed inset-0 z-30 cursor-default bg-black/20"
        />
      )}

      <main className="relative z-10 mx-auto max-w-6xl px-4 py-6 sm:py-8">
        <Outlet />
      </main>

      <footer className="relative z-10 mx-auto max-w-6xl px-4 pb-8 pt-4">
        <div className="border-t border-subtle pt-3 text-center">
          <span className="label text-[9px]">
            Quant Trader Prep · Local Edition · Set in Fraunces &amp; IBM Plex
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
