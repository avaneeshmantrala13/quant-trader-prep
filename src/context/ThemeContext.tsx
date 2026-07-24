import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";
import { storage, type ThemeChoice } from "@/lib/storage";
import { DEFAULT_THEME_ID, THEMES, applyTheme, getTheme } from "@/themes";
import type { Theme } from "@/themes/types";

interface ThemeContextValue {
  /** Light/dark MODE (kept as `theme`/`toggleTheme` for backward-compat). */
  theme: ThemeChoice;
  toggleTheme: () => void;
  setTheme: (t: ThemeChoice) => void;
  /** Named visual theme. */
  themeId: string;
  setThemeId: (id: string) => void;
  themeDef: Theme;
  themes: Theme[];
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

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

function resolveInitialThemeId(): string {
  const saved = storage.getThemeId();
  return saved && THEMES.some((t) => t.id === saved) ? saved : DEFAULT_THEME_ID;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeChoice>(resolveInitialMode);
  const [themeId, setThemeIdState] = useState<string>(resolveInitialThemeId);

  // Apply the named theme's tokens (before paint to minimize any flash).
  useLayoutEffect(() => {
    applyTheme(getTheme(themeId));
    storage.setThemeId(themeId);
  }, [themeId]);

  // Light/dark mode toggling (works within any theme).
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
    themeId,
    setThemeId: (id) => setThemeIdState(id),
    themeDef: getTheme(themeId),
    themes: THEMES,
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
