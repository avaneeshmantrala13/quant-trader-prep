import type { Theme } from "./types";
import { minimalistTheme } from "./minimalist";

/**
 * Theme registry — HARD-LOCKED to the single `minimalist` theme (guided-pipeline
 * strip-down, spec §7.2). The five alternate themes (broadsheet / casino /
 * chalkboard / cyberpunk / kids), the `/themes` gallery, and the named-theme
 * switcher were removed: the guided pipeline presents one calm, minimalist
 * surface. A light/dark toggle still works within minimalist (RESOLVED DECISION
 * §10.7) — that is a color-MODE switch handled by `ThemeContext`, not a theme
 * swap. `DEFAULT_THEME_ID` stays "minimalist" and is the only registered theme.
 */
export const THEMES: Theme[] = [minimalistTheme];

export const DEFAULT_THEME_ID = "minimalist";

/**
 * Resolve a theme by id. With only `minimalist` registered every lookup returns
 * it, so the app can never render an unregistered/removed theme. Kept as a
 * function (rather than inlining `minimalistTheme`) so existing call sites and
 * future re-additions keep working unchanged.
 */
export function getTheme(_id?: string | null): Theme {
  return minimalistTheme;
}

export { type Theme } from "./types";
export { applyTheme } from "./types";
