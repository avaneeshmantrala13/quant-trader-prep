import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";
import { storage, type ThemeChoice } from "@/lib/storage";
import { DEFAULT_THEME_ID, applyTheme, getTheme } from "@/themes";
import type { Theme } from "@/themes/types";

/**
 * THEME CONTEXT — hard-locked to the single `minimalist` theme (guided-pipeline
 * strip-down, spec §7.2). There is no longer a named-theme switcher or `/themes`
 * gallery, so the context no longer exposes `themeId` / `setThemeId` / `themes`.
 *
 * A working LIGHT/DARK toggle is intentionally KEPT (RESOLVED DECISION §10.7):
 * `theme` / `toggleTheme` / `setTheme` switch the color MODE (which flips the
 * `.dark` class + persists the choice) WITHIN the locked minimalist theme.
 * `themeDef` is always the minimalist theme, so every consumer that reads a
 * theme's optional hooks (Background, Dashboard, TableOfContents, map stations)
 * keeps working unchanged.
 */
interface ThemeContextValue {
  /** Light/dark color MODE. */
  theme: ThemeChoice;
  /** Flip between light and dark. */
  toggleTheme: () => void;
  /** Set the light/dark color mode explicitly. */
  setTheme: (t: ThemeChoice) => void;
  /** The active (locked) named theme — always `minimalist`. */
  themeDef: Theme;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** The single locked theme. Resolved once — `getTheme` always returns it. */
const LOCKED_THEME: Theme = getTheme(DEFAULT_THEME_ID);

function resolveInitialMode(): ThemeChoice {
  const saved = storage.getTheme();
  if (saved) return saved;
  if (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }
  return "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeChoice>(resolveInitialMode);

  // Apply the locked theme's tokens once (before paint to minimize any flash).
  // Persist the id too so a returning session keeps reading "minimalist".
  useLayoutEffect(() => {
    applyTheme(LOCKED_THEME);
    storage.setThemeId(LOCKED_THEME.id);
  }, []);

  // Light/dark mode toggling (works within the locked minimalist theme).
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
    storage.setTheme(theme);
  }, [theme]);

  const value: ThemeContextValue = {
    theme,
    toggleTheme: () =>
      setThemeState((t) => (t === "dark" ? "light" : "dark")),
    setTheme: (t) => setThemeState(t),
    themeDef: LOCKED_THEME,
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
