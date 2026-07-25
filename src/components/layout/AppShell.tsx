import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useProgress } from "@/context/ProgressContext";
import { useTheme } from "@/context/ThemeContext";
import { TRACKS } from "@/content";
import { ThemeBackground } from "@/components/visuals/ThemeBackground";
import { TickerTape } from "@/components/visuals/TickerTape";
import {
  CandlestickIcon,
  LogoutIcon,
  MoonIcon,
  SunIcon,
} from "@/components/icons";

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

function Readout({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-end leading-none">
      <span className="label text-[9px]">{label}</span>
      <span className="num text-sm font-semibold text-primary">{value}</span>
    </div>
  );
}

export function AppShell() {
  const { username, logOut } = useAuth();
  const { progress } = useProgress();
  const { theme, toggleTheme } = useTheme();

  const navItems = [
    { to: "/", label: "Home", end: true },
    { to: "/dashboard", label: "Dashboard", end: false },
    { to: "/arena", label: "Speed Arena", end: false },
    { to: "/diagnostic", label: "Recalibrate", end: false },
    ...TRACKS.map((t) => ({ to: `/track/${t.id}`, label: t.title, end: false })),
    { to: "/themes", label: "Themes", end: false },
  ];

  return (
    <div className="relative min-h-[100dvh]">
      <ThemeBackground />

      <header className="relative z-20 border-b-[3px] border-border-strong bg-surface">
        {/* Meta / dateline bar */}
        <div className="border-b border-subtle">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-1.5">
            <span className="label hidden truncate text-[9px] sm:block">
              {today()}
            </span>
            <span className="label text-[9px] text-bull">● Markets Open</span>
            <div className="flex items-center gap-1">
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

        {/* Nameplate */}
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <NavLink to="/" className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center border border-border-strong text-primary">
              <CandlestickIcon width={22} height={22} />
            </span>
            <span className="flex flex-col leading-none">
              <span className="font-display text-2xl font-black tracking-tight text-primary sm:text-3xl">
                Quant Trader Prep
              </span>
              <span className="label mt-1 hidden text-[9px] sm:block">
                The Interview Desk · Beginner → Expert Edition
              </span>
            </span>
          </NavLink>

          <div className="flex items-center gap-4">
            <Readout label="Streak" value={`${progress.streak}d`} />
            <div className="h-8 w-px bg-subtle" />
            <Readout label="XP" value={progress.xp} />
          </div>
        </div>

        {/* Section nav */}
        <nav className="border-t border-subtle">
          <div className="mx-auto max-w-6xl px-2">
            <div className="no-scrollbar flex gap-0 overflow-x-auto">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `whitespace-nowrap border-b-2 px-3.5 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-label transition-colors ${
                      isActive
                        ? "border-accent text-accent"
                        : "border-transparent text-secondary hover:text-primary"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        </nav>

        <TickerTape />
      </header>

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
    </div>
  );
}
