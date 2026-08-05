import type { ReactNode } from "react";
import { ThemeBackground } from "@/components/visuals/ThemeBackground";
import { ChevronLeftIcon } from "@/components/icons";

/**
 * GameChrome — the outer scaffold every self-contained game/drill page shares:
 * a full-height themed backdrop, a sticky top header (back button, title, an
 * optional thin progress bar, and an optional right-hand status slot), and the
 * centered `<main>` content column.
 *
 * This was byte-for-byte duplicated across ~11 pages (Fermi, Drill, EV-timed,
 * Make-a-Market, Next-Card, Dice & Cards, Fruit Market, Cards-MM, Mock, …).
 * The page-specific parts that legitimately vary are exposed as props:
 *   - `progress` (0..1) → renders the accent bar; omit/undefined → no bar.
 *   - `headerRight` → the counter / P&L pill / chip balance shown at far right.
 *   - `maxWidth` → most pages use `3xl`; the group-quote games use `4xl`.
 *   - `onBack` / `backLabel` → most go home; Next-Card goes to `/games`.
 * Everything else (the phase state machine, intros, summaries) stays in each
 * page — those genuinely differ per game and are NOT abstracted here.
 */
export function GameChrome({
  title,
  onBack,
  backLabel = "Back home",
  titleExtra,
  subtitle,
  progress,
  headerRight,
  maxWidth = "3xl",
  children,
}: {
  title: string;
  onBack: () => void;
  backLabel?: string;
  /** Inline node shown next to the title (e.g. round pips). */
  titleExtra?: ReactNode;
  /**
   * Text line shown under the title (e.g. "Round 2 / 5"). Used by the
   * market-making games in place of the accent progress bar. If both
   * `subtitle` and `progress` are given, `subtitle` renders above the bar.
   */
  subtitle?: ReactNode;
  /** 0..1 fraction; when defined, renders the accent progress bar. */
  progress?: number;
  /** Far-right header slot: counter, position pill, chip balance, etc. */
  headerRight?: ReactNode;
  maxWidth?: "3xl" | "4xl";
  children: ReactNode;
}) {
  const widthClass = maxWidth === "4xl" ? "max-w-4xl" : "max-w-3xl";
  return (
    <div className="relative min-h-[100dvh]">
      <ThemeBackground />

      <header className="sticky top-0 z-20 border-b-[3px] border-border-strong bg-surface">
        <div
          className={`mx-auto flex ${widthClass} items-center gap-3 px-4 py-2.5`}
        >
          <button
            onClick={onBack}
            className="btn-ghost !min-h-0 !px-2 !py-1.5"
            aria-label={backLabel}
          >
            <ChevronLeftIcon width={18} height={18} />
          </button>
          <div className="min-w-0 flex-1">
            {titleExtra ? (
              <div className="flex items-center gap-2">
                <span className="truncate font-display text-sm font-semibold text-primary">
                  {title}
                </span>
                {titleExtra}
              </div>
            ) : (
              <div className="truncate font-display text-sm font-semibold text-primary">
                {title}
              </div>
            )}
            {subtitle !== undefined && (
              <div className="label mt-0.5 text-muted">{subtitle}</div>
            )}
            {progress !== undefined && (
              <div className="mt-1 h-1.5 w-full border border-subtle bg-surface">
                <div
                  className="h-full bg-accent transition-all"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            )}
          </div>
          {headerRight}
        </div>
      </header>

      <main className={`relative z-10 mx-auto ${widthClass} px-4 py-6`}>
        {children}
      </main>
    </div>
  );
}
