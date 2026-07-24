import type { Theme, ThemeColorTokens } from "@/themes/types";

/**
 * Lightweight, STATIC representative preview of each theme's real backdrop, for
 * the Themes gallery swatches. It intentionally does NOT mount the themes' full
 * `Background` components, because those are `fixed inset-0` full-viewport layers
 * that read the GLOBAL `--color-*` CSS variables (the currently-active theme) and
 * run continuous animations — none of which is correct inside a small, inactive,
 * off-mode preview card. Instead we paint a scaled-down signature scene using
 * THIS theme's own token values for the requested light/dark variant (passed as
 * literal `rgb(...)`, never via CSS vars), so every card shows how that theme
 * actually looks — and cyberpunk reads as a neon night-alley in both modes.
 *
 * These are pure gradients/SVG with NO animation, so all 12 mini-scenes (6
 * themes × light/dark) stay cheap. The informative sample text sits on a SOLID
 * surface plate in the swatch itself (see `ThemesPage`), so legibility never
 * depends on the art here — the scene can be as rich as it likes behind it.
 */

const rgb = (c: string) => `rgb(${c})`;
const rgba = (c: string, a: number) => `rgb(${c} / ${a})`;

interface ArtProps {
  c: ThemeColorTokens;
  mode: "light" | "dark";
}

/** Cyberpunk — a neon night-city back-alley (the theme's signature look). */
function CyberpunkArt({ c, mode }: ArtProps) {
  // Neon glows read brighter on the dark alley; on the light "neon-dusk" panel
  // the deep-ink accents stay crisp with a gentler bloom.
  const bloom = mode === "dark" ? 0.42 : 0.24;
  const glow = mode === "dark" ? 0.55 : 0.32;
  return (
    <div className="absolute inset-0">
      {/* Night gradient sky → wet street + cyan/magenta corner blooms. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            `linear-gradient(180deg, ${rgb(c.bg)} 0%, ${rgb(c.surfaceMuted)} 60%, ${rgb(c.bg)} 100%),` +
            `radial-gradient(ellipse 75% 60% at 4% 0%, ${rgba(c.accent, bloom)} 0%, transparent 60%),` +
            `radial-gradient(ellipse 75% 60% at 98% 6%, ${rgba(c.accent2, bloom)} 0%, transparent 60%),` +
            `radial-gradient(ellipse 95% 45% at 50% 58%, ${rgba(c.warning, bloom * 0.5)} 0%, transparent 72%)`,
        }}
      />

      {/* Distant skyline silhouette + window lights near the fog horizon. */}
      <svg
        className="absolute inset-x-0"
        style={{ top: "26%", height: "42%" }}
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M0 40 V22 H7 V14 H14 V26 H20 V10 H29 V18 H35 V7 H43 V16 H50 V12 H58 V22 H65 V8 H73 V17 H80 V13 H88 V24 H94 V11 H100 V40 Z"
          fill={rgba(c.surface, 0.6)}
        />
        {SKYLINE_WINDOWS.map((w, i) => (
          <rect
            key={i}
            x={w.x}
            y={4 + w.y}
            width={w.w}
            height={w.h}
            fill={w.warm ? rgb(c.gold) : rgb(c.accent)}
            opacity={w.o}
          />
        ))}
      </svg>

      {/* Glowing neon signboards mounted on both alley walls. */}
      {SIGNS.map((s, i) => {
        const tone = s.tone === "cyan" ? c.accent : c.accent2;
        return (
          <div
            key={i}
            className="absolute"
            style={{
              [s.side]: `${s.off}%`,
              top: `${s.top}%`,
              width: `${s.w}%`,
              height: `${s.h}%`,
              borderRadius: 2,
              border: `1.5px solid ${rgb(tone)}`,
              background: rgba(c.surfaceRaised, 0.4),
              boxShadow: `0 0 6px ${rgba(tone, glow)}, 0 0 14px ${rgba(tone, glow * 0.5)}, inset 0 0 6px ${rgba(tone, glow * 0.6)}`,
            }}
          >
            {/* tiny glyph bars so the sign reads as lit signage, not a blank box */}
            <div
              className="absolute inset-[22%] flex flex-col justify-between"
              style={{ gap: 2 }}
            >
              {Array.from({ length: s.bars }).map((_, b) => (
                <span
                  key={b}
                  style={{
                    height: 1.5,
                    background: rgb(tone),
                    boxShadow: `0 0 3px ${rgb(tone)}`,
                    width: b % 2 ? "70%" : "100%",
                  }}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* Wet-asphalt reflection band with mirrored neon columns. */}
      <div
        className="absolute inset-x-0 bottom-0"
        style={{
          height: "30%",
          backgroundImage:
            `linear-gradient(90deg, transparent 8%, ${rgba(c.accent, glow * 0.5)} 11%, transparent 15%, transparent 40%, ${rgba(c.accent2, glow * 0.5)} 44%, transparent 48%, transparent 72%, ${rgba(c.accent, glow * 0.45)} 76%, transparent 80%),` +
            `repeating-linear-gradient(180deg, ${rgba(c.accent, 0.12)} 0 1px, transparent 1px 6px)`,
          maskImage:
            "linear-gradient(180deg, transparent 0%, rgb(0 0 0 / 0.9) 55%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(180deg, transparent 0%, rgb(0 0 0 / 0.9) 55%, transparent 100%)",
          filter: "blur(0.6px)",
        }}
      />

      {/* Cinematic corner vignette for depth. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 120% 120% at 50% 38%, transparent 50%, rgb(0 0 0 / 0.45) 100%)",
        }}
      />
    </div>
  );
}

/** Casino — deep baize felt, gold rail, card suits. */
function CasinoArt({ c }: ArtProps) {
  return (
    <div className="absolute inset-0">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            `radial-gradient(ellipse 80% 62% at 50% 40%, ${rgba(c.surface, 0.6)} 0%, transparent 70%),` +
            `repeating-linear-gradient(45deg, ${rgba(c.border, 0.14)} 0 1px, transparent 1px 5px),` +
            `repeating-linear-gradient(-45deg, ${rgba(c.border, 0.14)} 0 1px, transparent 1px 5px)`,
          background: rgb(c.bg),
        }}
      />
      {/* faint card suits */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <path
          d="M22 60 C22 48 34 44 34 34 C34 44 46 48 46 60 C46 68 39 70 35 66 L35 74 L33 74 L33 66 C29 70 22 68 22 60 Z"
          fill={rgba(c.textPrimary, 0.14)}
        />
        <path
          d="M74 30 C74 22 66 22 66 30 C66 22 58 22 58 30 C58 38 66 44 66 46 C66 44 74 38 74 30 Z"
          fill={rgba(c.bear, 0.28)}
        />
      </svg>
      {/* gold table rail */}
      <div
        className="absolute inset-[8px] rounded-md"
        style={{
          border: `1px solid ${rgba(c.gold, 0.55)}`,
          boxShadow: `inset 0 0 24px rgb(0 0 0 / 0.35)`,
        }}
      />
    </div>
  );
}

/** Kids — candy sky blobs + a balloon and confetti. */
function KidsArt({ c }: ArtProps) {
  return (
    <div className="absolute inset-0">
      <div
        className="absolute inset-0"
        style={{
          background: rgb(c.bg),
          backgroundImage:
            `radial-gradient(45% 40% at 14% 14%, ${rgba(c.accent, 0.28)} 0%, transparent 70%),` +
            `radial-gradient(45% 40% at 88% 20%, ${rgba(c.accent2, 0.28)} 0%, transparent 70%),` +
            `radial-gradient(50% 45% at 82% 90%, ${rgba(c.success, 0.24)} 0%, transparent 70%),` +
            `radial-gradient(50% 45% at 10% 90%, ${rgba(c.gold, 0.24)} 0%, transparent 70%)`,
        }}
      />
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        {/* balloon */}
        <g>
          <path
            d="M70 20 C60 20 59 33 63 39 C66 43 74 43 77 39 C81 33 80 20 70 20 Z"
            fill={rgba(c.accent2, 0.55)}
            stroke={rgba(c.borderStrong, 0.5)}
            strokeWidth={1.2}
          />
          <path
            d="M70 43 q4 6 -1 12"
            fill="none"
            stroke={rgba(c.borderStrong, 0.4)}
            strokeWidth={1}
          />
        </g>
        {/* confetti */}
        <rect x="20" y="24" width="5" height="5" rx="1" fill={rgba(c.gold, 0.6)} transform="rotate(20 22 26)" />
        <rect x="38" y="60" width="5" height="5" rx="1" fill={rgba(c.accent, 0.6)} transform="rotate(-15 40 62)" />
        <rect x="30" y="78" width="5" height="5" rx="1" fill={rgba(c.success, 0.6)} transform="rotate(30 32 80)" />
      </svg>
    </div>
  );
}

/** Chalkboard — ruled slate/paper with a chalked bell curve. */
function ChalkboardArt({ c }: ArtProps) {
  return (
    <div className="absolute inset-0">
      <div
        className="absolute inset-0"
        style={{
          background: rgb(c.bg),
          backgroundImage:
            `radial-gradient(120% 90% at 50% 0%, ${rgba(c.surfaceRaised, 0.4)} 0%, transparent 55%),` +
            `repeating-linear-gradient(180deg, transparent 0 13px, ${rgba(c.texGrid, 0.5)} 13px 14px)`,
        }}
      />
      {/* red margin rule */}
      <div
        className="absolute inset-y-0"
        style={{ left: "16%", width: 1, background: rgba(c.accent, 0.45) }}
      />
      {/* chalked bell curve */}
      <svg
        className="absolute left-1/2 top-1/2 h-1/2 w-3/4 -translate-x-1/2 -translate-y-1/2"
        viewBox="0 0 200 90"
        fill="none"
        stroke={rgba(c.borderStrong, 0.55)}
        aria-hidden="true"
      >
        <path d="M6 78 H194" strokeWidth={1.4} strokeLinecap="round" opacity={0.5} />
        <path
          d="M12 78 C60 78 74 14 100 14 C126 14 140 78 188 78"
          strokeWidth={1.8}
          strokeLinecap="round"
        />
        <path d="M100 20 V78" strokeWidth={1} strokeDasharray="3 4" opacity={0.5} />
      </svg>
    </div>
  );
}

/** Broadsheet — newsprint columns, masthead rule, print texture. */
function BroadsheetArt({ c }: ArtProps) {
  return (
    <div className="absolute inset-0" style={{ background: rgb(c.bg) }}>
      {/* masthead heavy rule + thin under-rule */}
      <div
        className="absolute inset-x-3 top-3"
        style={{ height: 3, background: rgba(c.borderStrong, 0.85) }}
      />
      <div
        className="absolute inset-x-3"
        style={{ top: 9, height: 1, background: rgba(c.borderStrong, 0.5) }}
      />
      {/* column separators + faux print lines */}
      <div
        className="absolute inset-x-3"
        style={{
          top: "26%",
          bottom: "10%",
          backgroundImage:
            `repeating-linear-gradient(90deg, transparent 0 31%, ${rgba(c.border, 0.7)} 31% calc(31% + 1px), transparent calc(31% + 1px) 34%),` +
            `repeating-linear-gradient(180deg, ${rgba(c.textMuted, 0.28)} 0 1px, transparent 1px 6px)`,
        }}
      />
      {/* halftone dots */}
      <div
        className="absolute inset-0"
        style={{
          opacity: 0.5,
          backgroundImage: `radial-gradient(${rgba(c.textMuted, 0.22)} 0.5px, transparent 0.6px)`,
          backgroundSize: "4px 4px",
        }}
      />
    </div>
  );
}

/** Minimalist — near-empty flat page with a single restrained accent rule. */
function MinimalistArt({ c }: ArtProps) {
  return (
    <div className="absolute inset-0" style={{ background: rgb(c.bg) }}>
      <div
        className="absolute"
        style={{
          left: "10%",
          top: "26%",
          width: "46%",
          height: 2,
          background: rgb(c.accent),
        }}
      />
      <div
        className="absolute"
        style={{
          left: "10%",
          right: "10%",
          bottom: "30%",
          height: 1,
          background: rgba(c.border, 0.9),
        }}
      />
    </div>
  );
}

/** Renders THIS theme's signature scaled-down scene for the given mode. */
export function ThemePreviewArt({ t, mode }: { t: Theme; mode: "light" | "dark" }) {
  const c = t.colors[mode];
  switch (t.id) {
    case "cyberpunk":
      return <CyberpunkArt c={c} mode={mode} />;
    case "casino":
      return <CasinoArt c={c} mode={mode} />;
    case "kids":
      return <KidsArt c={c} mode={mode} />;
    case "chalkboard":
      return <ChalkboardArt c={c} mode={mode} />;
    case "broadsheet":
      return <BroadsheetArt c={c} mode={mode} />;
    case "minimalist":
      return <MinimalistArt c={c} mode={mode} />;
    default:
      // Generic themed fallback: page wash + soft accent/accent2 corner blooms so
      // any future theme still gets a token-driven, on-brand preview.
      return (
        <div
          className="absolute inset-0"
          style={{
            background: rgb(c.bg),
            backgroundImage:
              `radial-gradient(60% 50% at 8% 6%, ${rgba(c.accent, 0.22)} 0%, transparent 70%),` +
              `radial-gradient(60% 50% at 92% 94%, ${rgba(c.accent2, 0.22)} 0%, transparent 70%)`,
          }}
        />
      );
  }
}

/* Deterministic decorative data (module-level so it never re-allocates). */
const SKYLINE_WINDOWS = Array.from({ length: 30 }, (_, i) => {
  const r = (n: number) =>
    ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
  return {
    x: r(1) * 98,
    y: r(2) * 30,
    w: 0.5 + r(3) * 1,
    h: 0.7 + r(4) * 1.3,
    warm: r(5) > 0.5,
    o: 0.3 + r(6) * 0.5,
  };
});

const SIGNS = [
  { side: "left", off: 4, top: 12, w: 12, h: 26, tone: "cyan", bars: 3 },
  { side: "right", off: 6, top: 8, w: 16, h: 12, tone: "magenta", bars: 2 },
  { side: "right", off: 5, top: 40, w: 11, h: 22, tone: "cyan", bars: 3 },
  { side: "left", off: 7, top: 46, w: 15, h: 11, tone: "magenta", bars: 2 },
] as const;
