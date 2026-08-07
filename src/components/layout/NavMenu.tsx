import { useCallback, useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import type { GoalMode } from "@/types/progress";
import { navFor } from "@/lib/mode/visibility";
import { ChevronDownIcon, CloseIcon, MenuIcon } from "@/components/icons";

/**
 * The app's SINGLE hamburger navigation menu — a 3-line button that opens a
 * themed, keyboard-accessible dropdown of every destination, organised into the
 * mode-aware collapsible SUBSECTIONS from `navFor(mode)`. Extracted so the exact
 * same control renders both inside the authenticated `AppShell` header AND on the
 * landing page (Home) header, per product: the home page shows the same menu the
 * rest of the app has once the learner is past their very first login.
 *
 * Optional onboarding-tour integration (`tourTarget`) lets a coach-mark reveal
 * the menu and force-open the group that holds the anchored item; when the prop
 * is omitted (e.g. on the landing page) the menu is a plain navigation control
 * with no tour behaviour.
 */

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

export interface NavMenuProps {
  /** Which mode's navigation groups to render (`navFor(mode)`). */
  mode: GoalMode;
  /**
   * The onboarding tour's CURRENT anchor target (or undefined). When set to a
   * menu ITEM (anything other than `"menu"`) the menu is revealed and the group
   * holding that item is force-expanded so the coach-mark can anchor to it. Omit
   * entirely to render a plain navigation menu with no tour integration.
   */
  tourTarget?: string;
}

export function NavMenu({ mode, tourTarget }: NavMenuProps) {
  const location = useLocation();

  // `menuOpen` tracks a USER-driven open (focus-managed, Esc / click-outside
  // close). The onboarding tour can also reveal the menu so its coach-marks can
  // anchor to items that would otherwise be collapsed (`tourTarget`) — that open
  // is passive (no focus trap / scrim) because the tour owns focus while it runs.
  const [menuOpen, setMenuOpen] = useState(false);
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
    <>
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
              // Display state (what the chevron/toggle reflect): explicit user
              // pref wins; otherwise auto-open the active group, else fall back
              // to the group's default.
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
    </>
  );
}
