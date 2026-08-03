import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/context/ThemeContext";
import { CheckIcon, ChevronDownIcon, PaletteIcon } from "@/components/icons";

/**
 * Compact NAMED-THEME switcher (broadsheet / minimalist / kids / …). It mirrors
 * the light/dark toggle's header placement so a visitor can change the app's
 * look BEFORE creating an account or taking the diagnostic — not just from the
 * post-auth `/themes` gallery. The selected theme is persisted to localStorage
 * by `ThemeProvider` (device-level), so the choice carries straight into the
 * authenticated session.
 *
 * Behavior matches the AppShell nav menu: a button opens a `role="menu"`
 * popover of radio-style options (Esc / click-outside close, focus moves to the
 * active option on open). Purely presentational over `useTheme()` — it never
 * touches storage directly.
 */
export function ThemeSwitcher({
  align = "right",
  showLabel = true,
}: {
  /** Which edge the popover anchors to (headers vary). */
  align?: "left" | "right";
  /** Show the active theme label next to the palette icon (hidden on narrow). */
  showLabel?: boolean;
}) {
  const { themes, themeId, setThemeId, themeDef, theme } = useTheme();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const raf = window.requestAnimationFrame(() => {
      const active = menuRef.current?.querySelector<HTMLElement>(
        '[role="menuitemradio"][aria-checked="true"]',
      );
      (active ??
        menuRef.current?.querySelector<HTMLElement>('[role="menuitemradio"]'))
        ?.focus();
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    const onPointer = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !btnRef.current?.contains(t)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      window.cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Change theme (current: ${themeDef.label})`}
        title="Change theme"
        className="btn-ghost !min-h-0 gap-1.5 !px-2 !py-1.5"
      >
        <PaletteIcon width={16} height={16} />
        {showLabel && (
          <span className="label hidden text-[9px] sm:inline">
            {themeDef.label}
          </span>
        )}
        <ChevronDownIcon
          aria-hidden="true"
          width={12}
          height={12}
          className={`shrink-0 transition-transform ${open ? "" : "-rotate-90"}`}
        />
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Choose a theme"
          className={`absolute top-full z-50 mt-2 w-60 overflow-hidden rounded-md border border-border-strong bg-surface p-1 shadow-2xl motion-safe:animate-print-in ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          <div className="label px-3 pb-1 pt-2 text-[9px] text-muted">Theme</div>
          {themes.map((t) => {
            const active = t.id === themeId;
            const accent = `rgb(${t.colors[theme].accent})`;
            const surface = `rgb(${t.colors[theme].surface})`;
            return (
              <button
                key={t.id}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  setThemeId(t.id);
                  setOpen(false);
                  btnRef.current?.focus();
                }}
                className={`flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-left transition-colors ${
                  active
                    ? "bg-surface-muted"
                    : "hover:bg-surface-muted"
                }`}
              >
                <span
                  aria-hidden="true"
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-sm border border-border-strong"
                  style={{ background: surface }}
                >
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ background: accent }}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-[11px] font-semibold uppercase tracking-label text-primary">
                    {t.label}
                  </span>
                  <span className="block truncate text-[10px] leading-tight text-muted">
                    {t.description}
                  </span>
                </span>
                {active && (
                  <CheckIcon
                    aria-hidden="true"
                    width={14}
                    height={14}
                    className="shrink-0 text-accent"
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
