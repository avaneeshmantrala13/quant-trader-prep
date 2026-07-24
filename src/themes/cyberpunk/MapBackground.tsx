import type { CSSProperties, ReactElement } from "react";
import { useMapTiles } from "../useMapTiles";
import {
  CYAN,
  CYBERPUNK_ANIM_CSS,
  GOLD,
  MAGENTA,
  MUTED,
  SIGN_GLYPHS,
  SURFACE,
  SURFACE_RAISED,
} from "./neon";

/**
 * Cyberpunk MAP BOARD background — a NEON BACK-ALLEY the level path winds down
 * (shared across every cyberpunk track). A wet, reflective street follows the
 * winding node route; storefronts, glowing awnings, hanging vertical signboards,
 * a holo-billboard and sodium streetlamps line the walls, tangled cables sag
 * overhead, and neon light columns shimmer in the puddles — all receding into a
 * hazy blue-black night.
 *
 * TILING (matches the board's variable `levels × 138px` height): the scene is a
 * vertical stack of SEAMLESS 552px tiles (= 4 node-rows). The wet-street lane
 * completes exactly one sine period per tile so it lines up across every seam,
 * and every fixed storefront sits fully inside a tile. Adjacent tiles MIRROR
 * horizontally (each glyph counter-flipped so signs stay upright), so the
 * alley continues seamlessly without reading as a hard loop. The parent clips
 * overflow, so a bounded tile count — grown by `useMapTiles` — covers boards of
 * any track length (no cut-off, no per-level node explosion).
 *
 * LEGIBILITY: the whole scene is held at low opacity with thin neon strokes and
 * faint fills, tokened so it's neon-on-blue-black (dark) / deep-ink-on-dusk
 * (light), so the path (z-10) and nodes/stations/numbers (z-20) always stay
 * WCAG-AA. Motion is transform/opacity/stroke-only and frozen under
 * `prefers-reduced-motion` via `.cp-anim`.
 */

// (Row height matches TrackPage ROW_H = 138; not needed directly here.)
const TILE_H = 552; // 4 node-rows; the street does one sine period/tile
const MIN_TILES = 6; // first-paint / short-board floor; grows to fill any height
const AMP = 28; // street sway (% of width) — echoes the node path's ±32%
const HALF = 9; // street half-width (% of width)

/* -------------------------------------------------------------------------- */
/*  Winding wet-street lane — one seamless sine period across the tile          */
/* -------------------------------------------------------------------------- */

function laneCenter(y: number): number {
  return 50 + AMP * Math.sin((2 * Math.PI * y) / TILE_H);
}
function ribbon(half: number): string {
  const N = 44;
  let right = "";
  let left = "";
  for (let i = 0; i <= N; i++) {
    const y = (TILE_H * i) / N;
    right += `${i === 0 ? "M" : "L"}${(laneCenter(y) + half).toFixed(2)} ${y.toFixed(1)} `;
  }
  for (let i = N; i >= 0; i--) {
    const y = (TILE_H * i) / N;
    left += `L${(laneCenter(y) - half).toFixed(2)} ${y.toFixed(1)} `;
  }
  return `${right}${left}Z`;
}
function spine(): string {
  const N = 44;
  let s = "";
  for (let i = 0; i <= N; i++) {
    const y = (TILE_H * i) / N;
    s += `${i === 0 ? "M" : "L"}${laneCenter(y).toFixed(2)} ${y.toFixed(1)} `;
  }
  return s;
}
const STREET = ribbon(HALF);
const CURB = ribbon(HALF + 1.4);
const SPINE = spine();
const REFLECT_L = (() => {
  // a neon reflection column offset just left of centre
  const N = 44;
  let s = "";
  for (let i = 0; i <= N; i++) {
    const y = (TILE_H * i) / N;
    s += `${i === 0 ? "M" : "L"}${(laneCenter(y) - HALF * 0.42).toFixed(2)} ${y.toFixed(1)} `;
  }
  return s;
})();
const REFLECT_R = (() => {
  const N = 44;
  let s = "";
  for (let i = 0; i <= N; i++) {
    const y = (TILE_H * i) / N;
    s += `${i === 0 ? "M" : "L"}${(laneCenter(y) + HALF * 0.42).toFixed(2)} ${y.toFixed(1)} `;
  }
  return s;
})();

/** Stretched (percentage-x, pixel-y) layer: the wet street + neon reflections. */
function StreetLayer() {
  return (
    <svg
      viewBox={`0 0 100 ${TILE_H}`}
      preserveAspectRatio="none"
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      {/* curb glow */}
      <path d={CURB} fill="none" stroke={CYAN} strokeOpacity={0.22} strokeWidth={3} vectorEffect="non-scaling-stroke" />
      {/* wet asphalt body */}
      <path d={STREET} fill={SURFACE} fillOpacity={0.5} stroke={CYAN} strokeOpacity={0.4} strokeWidth={1.1} vectorEffect="non-scaling-stroke" />
      {/* magenta reflection streak */}
      <path d={REFLECT_L} fill="none" stroke={MAGENTA} strokeOpacity={0.28} strokeWidth={2} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {/* cyan reflection streak */}
      <path d={REFLECT_R} fill="none" stroke={CYAN} strokeOpacity={0.3} strokeWidth={2} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {/* dashed centre lane markers running down the street (the "route") */}
      <path d={SPINE} fill="none" stroke={GOLD} strokeOpacity={0.45} strokeWidth={1.2} strokeDasharray="3 9" strokeLinecap="round" vectorEffect="non-scaling-stroke" className="cp-anim cp-dash" />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  Fixed-size (undistorted) neon alley landmarks                               */
/* -------------------------------------------------------------------------- */

function glyphMark(g: number, x: number, y: number, s: number, tone: string) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s / 20})`}>
      <path d={SIGN_GLYPHS[g % SIGN_GLYPHS.length]} fill="none" stroke={tone} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

/** A lit storefront: facade, striped awning, sign, glowing doorway + windows. */
function Storefront({ w = 128, tone = CYAN, glyph = 0 }: { w?: number; tone?: string; glyph?: number }) {
  const h = w * 0.92;
  return (
    <svg width={w} height={h} viewBox="0 0 128 118" aria-hidden="true">
      {/* facade */}
      <rect x={8} y={22} width={112} height={94} fill={SURFACE_RAISED} fillOpacity={0.4} stroke={tone} strokeOpacity={0.5} strokeWidth={1.3} />
      {/* signboard above with an invented glyph */}
      <rect x={20} y={6} width={88} height={16} rx={2} fill={SURFACE} fillOpacity={0.5} stroke={tone} strokeOpacity={0.7} strokeWidth={1.2} className="cp-anim cp-flicker" />
      {glyphMark(glyph, 30, 8, 13, tone)}
      {glyphMark(glyph + 3, 52, 8, 13, MAGENTA)}
      {glyphMark(glyph + 6, 74, 8, 13, tone)}
      {/* striped awning */}
      <path d="M8 34 L120 34 L112 46 L16 46 Z" fill={tone} fillOpacity={0.14} stroke={tone} strokeOpacity={0.45} strokeWidth={1} />
      {[24, 40, 56, 72, 88, 104].map((x, i) => (
        <line key={i} x1={x} y1={34} x2={x - 3} y2={46} stroke={i % 2 ? MAGENTA : tone} strokeOpacity={0.4} strokeWidth={1} />
      ))}
      {/* glowing doorway */}
      <rect x={52} y={58} width={24} height={58} fill={tone} fillOpacity={0.16} stroke={tone} strokeOpacity={0.5} strokeWidth={1} />
      {/* lit windows */}
      <rect x={18} y={58} width={26} height={22} fill={GOLD} fillOpacity={0.12} stroke={GOLD} strokeOpacity={0.35} strokeWidth={0.8} className="cp-anim cp-buzz" />
      <rect x={84} y={58} width={26} height={22} fill={MAGENTA} fillOpacity={0.12} stroke={MAGENTA} strokeOpacity={0.4} strokeWidth={0.8} />
    </svg>
  );
}

/** A hanging vertical signboard swinging from a wire, stacked glyphs. */
function HangingSign({ h = 128, tone = MAGENTA, glyphs = [1, 4, 7] }: { h?: number; tone?: string; glyphs?: number[] }) {
  const n = glyphs.length;
  const boardH = 18 + n * 22;
  return (
    <svg width={h * 0.34} height={h} viewBox={`0 0 44 ${18 + boardH + 6}`} aria-hidden="true">
      {/* wire */}
      <line x1={22} y1={0} x2={22} y2={14} stroke={MUTED} strokeOpacity={0.6} strokeWidth={1.2} />
      <g className="cp-anim cp-sway">
        <rect x={7} y={14} width={30} height={boardH} rx={3} fill={SURFACE_RAISED} fillOpacity={0.42} stroke={tone} strokeOpacity={0.7} strokeWidth={1.3} className="cp-anim cp-flickerB" />
        {glyphs.map((g, i) => glyphMark(g, 12, 20 + i * 22, 20, i % 2 ? CYAN : tone))}
      </g>
    </svg>
  );
}

/** A holographic billboard on posts, flashing a big glyph. */
function Billboard({ w = 118, glyph = 5 }: { w?: number; glyph?: number }) {
  const h = w * 0.82;
  return (
    <svg width={w} height={h} viewBox="0 0 118 96" aria-hidden="true">
      <line x1={30} y1={96} x2={30} y2={54} stroke={MUTED} strokeOpacity={0.5} strokeWidth={2} />
      <line x1={88} y1={96} x2={88} y2={54} stroke={MUTED} strokeOpacity={0.5} strokeWidth={2} />
      <rect x={8} y={8} width={102} height={48} rx={3} fill={SURFACE_RAISED} fillOpacity={0.42} stroke={CYAN} strokeOpacity={0.6} strokeWidth={1.4} className="cp-anim cp-flicker" />
      {glyphMark(glyph, 24, 18, 30, MAGENTA)}
      {glyphMark(glyph + 4, 66, 18, 30, CYAN)}
      <rect x={8} y={8} width={102} height={48} rx={3} fill="none" stroke={MAGENTA} strokeOpacity={0.18} strokeWidth={3} />
    </svg>
  );
}

/** A sodium streetlamp casting a warm pool. */
function Streetlamp({ h = 140 }: { h?: number }) {
  return (
    <svg width={h * 0.4} height={h} viewBox="0 0 56 140" aria-hidden="true">
      <line x1={16} y1={140} x2={16} y2={20} stroke={MUTED} strokeOpacity={0.55} strokeWidth={2.2} />
      <path d="M16 20 Q16 10 30 10 L44 10" fill="none" stroke={MUTED} strokeOpacity={0.55} strokeWidth={2} />
      <ellipse cx={44} cy={14} rx={5} ry={3} fill={GOLD} fillOpacity={0.6} stroke={GOLD} strokeOpacity={0.8} strokeWidth={0.8} className="cp-anim cp-buzz" />
      {/* warm light pool */}
      <path d="M30 20 L58 118 L30 130 L2 118 Z" fill={GOLD} fillOpacity={0.06} />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  Placements within one 552px tile (left %, top px) — all fully inside        */
/* -------------------------------------------------------------------------- */

type Placement = { el: ReactElement; left: number; top: number };

const PLACEMENTS: Placement[] = [
  { el: <Storefront w={132} tone={CYAN} glyph={0} />, left: 2, top: 14 },
  { el: <HangingSign h={140} tone={MAGENTA} glyphs={[2, 5, 8]} />, left: 78, top: 8 },
  { el: <Billboard w={116} glyph={4} />, left: 60, top: 120 },
  { el: <Streetlamp h={150} />, left: 4, top: 150 },
  { el: <Storefront w={120} tone={MAGENTA} glyph={3} />, left: 74, top: 226 },
  { el: <HangingSign h={120} tone={CYAN} glyphs={[6, 1]} />, left: 20, top: 258 },
  { el: <Streetlamp h={132} />, left: 86, top: 372 },
  { el: <Storefront w={124} tone={CYAN} glyph={7} />, left: 3, top: 392 },
  { el: <Billboard w={98} glyph={9} />, left: 52, top: 430 },
  { el: <HangingSign h={112} tone={MAGENTA} glyphs={[0, 4, 2]} />, left: 44, top: 300 },
];

/** Overhead cables sagging across the whole alley (stretched, per tile). */
function CableSpan() {
  return (
    <svg viewBox={`0 0 100 ${TILE_H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <g fill="none" stroke={MUTED} strokeOpacity={0.4} strokeWidth={0.4} vectorEffect="non-scaling-stroke">
        <path d={`M0 40 Q50 70 100 46`} />
        <path d={`M0 250 Q50 286 100 262`} />
        <path d={`M0 470 Q50 440 100 486`} />
      </g>
    </svg>
  );
}

function AlleyTile({ index }: { index: number }) {
  const mirror = index % 2 === 1;
  return (
    <div className="absolute left-0 right-0" style={{ top: index * TILE_H, height: TILE_H }}>
      <StreetLayer />
      <CableSpan />
      {/*
        Alternate tiles mirror the STOREFRONT LAYOUT horizontally so the vertical
        repeat never reads as a hard loop. The outer scaleX(-1) mirrors each
        landmark's POSITION; we counter-flip each placed element with an inverse
        scaleX(-1) so glyphs / awnings never render mirror-reversed.
      */}
      <div className="absolute inset-0" style={mirror ? ({ transform: "scaleX(-1)" } as CSSProperties) : undefined}>
        {PLACEMENTS.map((pl, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              left: `${pl.left}%`,
              top: pl.top,
              ...(mirror ? ({ transform: "scaleX(-1)" } as CSSProperties) : {}),
            }}
          >
            {pl.el}
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Root                                                                        */
/* -------------------------------------------------------------------------- */

export function CyberpunkMapBackground() {
  const [rootRef, tiles] = useMapTiles(TILE_H, MIN_TILES);
  return (
    <div ref={rootRef} aria-hidden="true" className="absolute inset-0 overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: CYBERPUNK_ANIM_CSS }} />

      {/* Night-alley base: a deep vertical gradient down the street. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgb(var(--color-bg)) 0%, rgb(var(--color-surface-muted)) 100%)",
        }}
      />

      {/* Cyan/magenta ambient wash from the signage. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 60% 30% at 12% 8%, rgb(var(--color-accent) / 0.14) 0%, transparent 60%)," +
            "radial-gradient(ellipse 60% 30% at 88% 30%, rgb(var(--color-accent-2) / 0.14) 0%, transparent 60%)",
        }}
      />

      {/* Fine wet-pavement sheen — a faint grid tinted by the grid token. */}
      <div
        className="absolute inset-0 opacity-40 dark:opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(rgb(var(--tex-grid) / 0.45) 1px, transparent 1px)," +
            "linear-gradient(90deg, rgb(var(--tex-grid) / 0.45) 1px, transparent 1px)",
          backgroundSize: "30px 30px",
        }}
      />

      {/* Repeating neon alley — muted so stations/numbers stay the focus. */}
      <div className="absolute inset-0 opacity-[0.72] dark:opacity-[0.62]">
        {Array.from({ length: tiles }, (_, k) => (
          <AlleyTile key={k} index={k} />
        ))}
      </div>

      {/* Rain haze veil + a slow light sweep for depth. */}
      <div
        className="absolute inset-0 opacity-[0.05] dark:opacity-[0.09]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(8deg, rgb(var(--color-text-primary) / 0.6) 0 1px, transparent 1px 9px)",
        }}
      />
      <div
        className="cp-anim absolute inset-x-0 h-24"
        style={{
          background:
            "linear-gradient(180deg, transparent, rgb(var(--color-accent) / 0.08), transparent)",
          animation: "cp-scan 12s linear infinite",
        }}
      />

      {/* Alley-mouth vignette hugging the board edge. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          boxShadow:
            "inset 0 0 80px rgb(0 0 0 / 0.5), inset 0 0 0 1px rgb(var(--color-accent) / 0.12)",
        }}
      />

      {/* A small neon "district" marquee, top-left. */}
      <div className="absolute left-3 top-3 border border-accent/50 bg-surface/60 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.3em] text-accent opacity-80">
        Neon District · Open
      </div>
    </div>
  );
}
