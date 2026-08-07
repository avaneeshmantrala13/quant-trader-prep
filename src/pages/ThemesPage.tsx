import { useTheme } from "@/context/ThemeContext";
import type { Theme, ThemeColorTokens } from "@/themes/types";
import { ThemePreviewArt } from "./ThemePreviewArt";

const rgb = (channels: string) => `rgb(${channels})`;

/**
 * A faithful mini-preview of one theme variant (light or dark). The theme's
 * signature scene (`ThemePreviewArt`, painted from THIS theme's tokens for the
 * given mode) fills the card, so each swatch shows how the theme actually looks
 * — cyberpunk reads as a neon night-alley, casino as felt, etc. The informative
 * sample (heading, accent chip, bull/bear, annotation) sits on a SOLID surface
 * plate so it stays WCAG-AA legible regardless of how rich the scene behind is.
 */
function Swatch({ t, mode }: { t: Theme; mode: "light" | "dark" }) {
  const c: ThemeColorTokens = t.colors[mode];
  return (
    <div
      className="relative h-44 flex-1 overflow-hidden border"
      style={{ background: rgb(c.bg), borderColor: rgb(c.border) }}
    >
      {/* THIS theme's signature backdrop, rendered in the correct light/dark. */}
      <ThemePreviewArt t={t} mode={mode} />

      {/* Mode label on a small solid pill so it stays legible over the scene. */}
      <div
        className="absolute left-1.5 top-1.5 rounded-sm px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-widest"
        style={{
          background: rgb(c.surface),
          color: rgb(c.textMuted),
          border: `1px solid ${rgb(c.border)}`,
        }}
      >
        {mode}
      </div>

      {/* Legibility plate: solid surface guarantees AA for every text token. */}
      <div
        className="absolute inset-x-2 bottom-2 border p-2 shadow-sm"
        style={{ background: rgb(c.surface), borderColor: rgb(c.border) }}
      >
        <div
          className="text-[11px] font-semibold leading-none"
          style={{ color: rgb(c.textPrimary), fontFamily: t.typography.display }}
        >
          Aa Bb 123
        </div>
        <div className="mt-1.5 flex items-center gap-1">
          <span
            className="px-1.5 py-0.5 text-[8px] font-semibold uppercase"
            style={{
              background: rgb(c.accent),
              color: rgb(c.accentContrast),
              fontFamily: t.typography.mono,
            }}
          >
            Accent
          </span>
          <span className="font-mono text-[10px]" style={{ color: rgb(c.bull) }}>
            ▲
          </span>
          <span className="font-mono text-[10px]" style={{ color: rgb(c.bear) }}>
            ▼
          </span>
        </div>
        <div className="mt-1 text-[8px]" style={{ color: rgb(c.textMuted) }}>
          muted annotation
        </div>
      </div>
    </div>
  );
}

function ThemeCard({
  t,
  active,
  onApply,
}: {
  t: Theme;
  active: boolean;
  onApply: () => void;
}) {
  return (
    <div className={`panel overflow-hidden ${active ? "ring-2 ring-accent" : ""}`}>
      <div className="flex items-start justify-between gap-2 border-b border-subtle p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-lg font-semibold text-primary">
              {t.label}
            </h3>
            {t.wip && (
              <span className="chip border-accent text-accent">In progress</span>
            )}
          </div>
          <p className="mt-1 text-sm text-secondary">{t.description}</p>
        </div>
      </div>

      <div className="flex gap-2 p-3">
        <Swatch t={t} mode="light" />
        <Swatch t={t} mode="dark" />
      </div>

      <div className="border-t border-subtle p-3">
        <button
          onClick={onApply}
          disabled={active}
          className={active ? "btn-secondary w-full" : "btn-primary w-full"}
        >
          {active ? "● Active" : "Apply Theme"}
        </button>
      </div>
    </div>
  );
}

export function ThemesPage() {
  const { themes, themeId, setThemeId } = useTheme();

  return (
    <div className="space-y-6">
      <header className="border-b-[3px] border-border-strong pb-4">
        <span className="label text-accent">Appearance</span>
        <h1 className="mt-1 font-display text-3xl font-black leading-tight text-primary sm:text-4xl">
          Themes
        </h1>
        <p className="mt-1 font-mono text-xs uppercase tracking-wider text-muted">
          Same course · same content · a new look. Light / dark still toggles
          within any theme.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {themes.map((t) => (
          <ThemeCard
            key={t.id}
            t={t}
            active={t.id === themeId}
            onApply={() => setThemeId(t.id)}
          />
        ))}
      </section>

      <p className="label text-[9px]">
        Themes change only aesthetics, never the questions, copy, or your
        progress. Your choice is saved to this browser.
      </p>
    </div>
  );
}
