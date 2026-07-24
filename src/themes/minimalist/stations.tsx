import type { ReactNode } from "react";
import type {
  LevelIllustrationContext,
  MapStationComponent,
  MapStationState,
} from "../types";

/**
 * MINIMALIST map stations — Swiss / functional line-icon landmarks.
 *
 * Each station is a single CLEAN line-icon glyph rendered in the top clear
 * strip of the 100×100 (116px) box, ABOVE the 68px node button so it never
 * covers the level number/lock/check. Thin, precise strokes, generous negative
 * space, flat (no gradients/shadows). One glyph FAMILY per track so tracks read
 * differently; a distinct glyph per level within a track.
 *
 * Color discipline (near-monochrome, accent used sparingly):
 *   • locked    → dim ink hairline (border-strong @ low opacity)
 *   • unlocked  → the ONE restrained accent (marks the live/current node)
 *   • mastered  → calm ink glyph + a tiny gold "completed" pin (subtle flourish)
 */

const SW = 2.3; // stroke width in viewBox units (~2.7px at 116px)

interface GlyphStyle {
  stroke: string;
  fill: string;
  opacity: number;
}

function glyphStyle(state?: MapStationState): GlyphStyle {
  if (state === "locked") {
    return {
      stroke: "rgb(var(--color-border-strong))",
      fill: "rgb(var(--color-border-strong))",
      opacity: 0.32,
    };
  }
  if (state === "mastered") {
    return {
      stroke: "rgb(var(--color-text-primary))",
      fill: "rgb(var(--color-text-primary))",
      opacity: 0.82,
    };
  }
  // unlocked / current
  return {
    stroke: "rgb(var(--color-accent))",
    fill: "rgb(var(--color-accent))",
    opacity: 1,
  };
}

/* ------------------------------------------------------------------ */
/*  Glyphs — all geometry lives in the top band (x∈[34,66], y∈[3,19]) */
/*  so nothing overlaps the node button centered at (50,50).          */
/* ------------------------------------------------------------------ */

type Glyph = (s: GlyphStyle) => ReactNode;

const strokeProps = (s: GlyphStyle) => ({
  stroke: s.stroke,
  strokeWidth: SW,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  fill: "none",
});

/* --- probability: minimal "chance" glyphs --- */

// pr-1 · half-filled circle (a coin / a probability p)
const pr1: Glyph = (s) => (
  <g>
    <circle cx="50" cy="11" r="6.5" {...strokeProps(s)} />
    <path d="M50 4.5 A6.5 6.5 0 0 0 50 17.5 Z" fill={s.fill} stroke="none" />
  </g>
);

// pr-2 · a die showing two (outcomes)
const pr2: Glyph = (s) => (
  <g>
    <rect x="42.5" y="3.5" width="15" height="15" rx="2.5" {...strokeProps(s)} />
    <circle cx="46.5" cy="14.5" r="1.5" fill={s.fill} stroke="none" />
    <circle cx="53.5" cy="7.5" r="1.5" fill={s.fill} stroke="none" />
  </g>
);

// pr-3 · a bell curve (distribution)
const pr3: Glyph = (s) => (
  <g>
    <path
      d="M36 18 C43.5 18 45.5 4 50 4 C54.5 4 56.5 18 64 18"
      {...strokeProps(s)}
    />
    <line x1="35" y1="18" x2="65" y2="18" {...strokeProps(s)} opacity={0.55} />
  </g>
);

// pr-4 · a tiny histogram (frequencies)
const pr4: Glyph = (s) => (
  <g>
    <line x1="35" y1="18.5" x2="65" y2="18.5" {...strokeProps(s)} opacity={0.55} />
    <rect x="40" y="12" width="4" height="6.5" fill={s.fill} stroke="none" />
    <rect x="47" y="5.5" width="4" height="13" fill={s.fill} stroke="none" />
    <rect x="54" y="9" width="4" height="9.5" fill={s.fill} stroke="none" />
  </g>
);

// pr-5 · a split (50/50) circle
const pr5: Glyph = (s) => (
  <g>
    <circle cx="50" cy="11" r="6.5" {...strokeProps(s)} />
    <line x1="50" y1="4.5" x2="50" y2="17.5" {...strokeProps(s)} />
  </g>
);

/* --- mental-math: numeric / operator glyphs --- */

// mm-1 · plus
const mm1: Glyph = (s) => (
  <g>
    <line x1="50" y1="3.5" x2="50" y2="18.5" {...strokeProps(s)} />
    <line x1="42.5" y1="11" x2="57.5" y2="11" {...strokeProps(s)} />
  </g>
);

// mm-2 · times (×)
const mm2: Glyph = (s) => (
  <g>
    <line x1="44" y1="5" x2="56" y2="17" {...strokeProps(s)} />
    <line x1="56" y1="5" x2="44" y2="17" {...strokeProps(s)} />
  </g>
);

// mm-3 · divide (÷)
const mm3: Glyph = (s) => (
  <g>
    <line x1="42.5" y1="11" x2="57.5" y2="11" {...strokeProps(s)} />
    <circle cx="50" cy="5.5" r="1.6" fill={s.fill} stroke="none" />
    <circle cx="50" cy="16.5" r="1.6" fill={s.fill} stroke="none" />
  </g>
);

// mm-4 · square root (√)
const mm4: Glyph = (s) => (
  <path d="M37 12 L41 12 L46.5 18.5 L53 3.5 L64 3.5" {...strokeProps(s)} />
);

/* --- brainteasers: simple puzzle glyphs --- */

// bt-1 · a jigsaw piece
const bt1: Glyph = (s) => (
  <path
    d="M43 18.5 L43 8 L47 8 C47 4 53 4 53 8 L57 8 L57 18.5 Z"
    {...strokeProps(s)}
  />
);

// bt-2 · two interlocking circles (a Venn / linked puzzle)
const bt2: Glyph = (s) => (
  <g>
    <circle cx="45.5" cy="11" r="5.2" {...strokeProps(s)} />
    <circle cx="54.5" cy="11" r="5.2" {...strokeProps(s)} />
  </g>
);

// bt-3 · a small labyrinth (maze)
const bt3: Glyph = (s) => (
  <path
    d="M58 5 L42 5 L42 17 L54.5 17 L54.5 9.5 L47 9.5 L47 13.5"
    {...strokeProps(s)}
  />
);

/* --- interview-games: minimal market glyphs --- */

// ig-1 · a candlestick
const ig1: Glyph = (s) => (
  <g>
    <line x1="50" y1="3.5" x2="50" y2="18.5" {...strokeProps(s)} />
    <rect x="46" y="7" width="8" height="8" fill={s.fill} stroke="none" />
  </g>
);

// ig-2 · an up-trend arrow
const ig2: Glyph = (s) => (
  <g>
    <path d="M39 17.5 L61 5.5" {...strokeProps(s)} />
    <path d="M52.5 5.5 L61 5.5 L61 14" {...strokeProps(s)} />
  </g>
);

// ig-3 · a bid / ask bracket
const ig3: Glyph = (s) => (
  <g>
    <path d="M46 4 L41 4 L41 18 L46 18" {...strokeProps(s)} />
    <path d="M54 4 L59 4 L59 18 L54 18" {...strokeProps(s)} />
  </g>
);

// ig-4 · a price path (line chart)
const ig4: Glyph = (s) => (
  <path d="M36 16 L44 9.5 L49.5 14 L56 4.5 L64 8.5" {...strokeProps(s)} />
);

// ig-5 · a balance scale (fair value)
const ig5: Glyph = (s) => (
  <g>
    <line x1="50" y1="4" x2="50" y2="15" {...strokeProps(s)} />
    <line x1="38" y1="8" x2="62" y2="8" {...strokeProps(s)} />
    <line x1="45" y1="17.5" x2="55" y2="17.5" {...strokeProps(s)} />
    <path d="M38 8 L38 11" {...strokeProps(s)} />
    <path d="M62 8 L62 11" {...strokeProps(s)} />
    <circle cx="38" cy="12.5" r="2" {...strokeProps(s)} />
    <circle cx="62" cy="12.5" r="2" {...strokeProps(s)} />
  </g>
);

const GLYPHS: Record<string, Glyph[]> = {
  probability: [pr1, pr2, pr3, pr4, pr5],
  "mental-math": [mm1, mm2, mm3, mm4],
  brainteasers: [bt1, bt2, bt3],
  "interview-games": [ig1, ig2, ig3, ig4, ig5],
};

export function getMinimalistStation(
  ctx: LevelIllustrationContext,
): MapStationComponent | null {
  const family = GLYPHS[ctx.trackId];
  const glyph = family?.[ctx.levelIndex];
  if (!glyph) return null;

  function MinimalistStation({
    className,
    state,
  }: {
    className?: string;
    state?: MapStationState;
  }) {
    const s = glyphStyle(state);
    return (
      <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
        <g opacity={s.opacity}>{glyph(s)}</g>
        {state === "mastered" && (
          <circle
            cx="66"
            cy="5"
            r="1.9"
            fill="rgb(var(--color-gold))"
            opacity={0.9}
          />
        )}
      </svg>
    );
  }

  return MinimalistStation;
}
