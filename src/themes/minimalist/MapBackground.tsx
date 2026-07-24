import type { CSSProperties } from "react";
import { useMapTiles } from "../useMapTiles";

/**
 * MINIMALIST map board — a deliberately "expensive", gallery-worthy Swiss /
 * International-style ART COMPOSITION the level path travels through (shared
 * across every minimalist track). The "cool" comes from bold, confident
 * composition in generous negative space — NOT from clutter, gradients, or
 * glassy AI-slop.
 *
 * THE COMPOSITION (bottom → top):
 *   • a flat surface field (no gradients);
 *   • oversized thin CONCENTRIC ARCS — a Müller-Brockmann "target" — that
 *     alternate sides down the board, with exactly ONE ring per section drawn
 *     in the theme's restrained accent as a single dramatic gesture;
 *   • a single sweeping meandering CONTOUR hairline that elegantly echoes the
 *     winding node sine path;
 *   • a precise left-margin COORDINATE RULER of hairline ticks (Swiss rigor);
 *   • one bold ACCENT "bullseye" dot per section, gently pulsing.
 *
 * FULL-HEIGHT / SEAMLESS: the board height is variable (levels × 138px). The
 * scene is a stack of identical 552px tiles (= 4 node-rows) placed at absolute
 * top offsets; the contour completes exactly one sine period per tile so it
 * lines up across every seam, and the concentric arcs sit fully inside their
 * tile (so tiles never overlap). Enough tiles are rendered to cover very tall
 * boards; the parent clips the excess. The whole stack breathes with a tiny
 * translateY parallax (period = seam-safe), so there is never a visible seam or
 * a gap at any height.
 *
 * LEGIBILITY: every mark is theme-tokened (`rgb(var(--color-…))`, light + dark
 * aware) and kept at very low contrast, so the path (z-10), nodes / numbers /
 * lock-check / station art (z-20), and labels always stay the focus and fully
 * WCAG-AA. Motion is transform/opacity only and frozen under
 * `prefers-reduced-motion`.
 */

const TILE_H = 552; // 4 node-rows; contour does exactly one sine period per tile
const MIN_TILES = 7; // first-paint / short-board floor; grows to fill any height
const ROW_H = 138; // node-row cadence (matches TrackPage) → ruler major ticks
const AMP = 30; // contour sway (% of width) — echoes the node path's ±32%

const INK = "rgb(var(--color-border-strong))"; // adaptive ink (dark→light aware)
const ACCENT = "rgb(var(--color-accent))";

const CSS = `
@keyframes min-breath{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
@keyframes min-pulse{0%,100%{opacity:.34;transform:scale(1)}50%{opacity:.68;transform:scale(1.18)}}
@media (prefers-reduced-motion: reduce){.min-anim{animation:none !important}}
`;

/* -------------------------------------------------------------------------- */
/*  Sweeping contour — one seamless sine period across the tile height         */
/* -------------------------------------------------------------------------- */

function contourPath(): string {
  const N = 44;
  let d = "";
  for (let i = 0; i <= N; i++) {
    const y = (TILE_H * i) / N;
    const x = 50 + AMP * Math.sin((2 * Math.PI * y) / TILE_H);
    d += `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(1)} `;
  }
  return d.trim();
}
const CONTOUR = contourPath();

/** Stretched (percent-x, pixel-y) layer: the meandering guide contour. */
function ContourLayer() {
  return (
    <svg
      viewBox={`0 0 100 ${TILE_H}`}
      preserveAspectRatio="none"
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      <path
        d={CONTOUR}
        fill="none"
        stroke={INK}
        strokeOpacity={0.14}
        strokeWidth={1.25}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  Undistorted concentric-arc "target" + its bullseye accent dot              */
/* -------------------------------------------------------------------------- */

const RINGS = [40, 100, 160, 220, 270]; // fit fully within the 552px tile
const ACCENT_RING = 160; // the single ring drawn as the dramatic accent gesture
const CENTER = 276; // tile vertical mid → circles stay inside their tile

function ConcentricTarget() {
  return (
    <svg
      width={TILE_H}
      height={TILE_H}
      viewBox={`0 0 ${TILE_H} ${TILE_H}`}
      aria-hidden="true"
      className="block"
    >
      {RINGS.map((r) =>
        r === ACCENT_RING ? (
          <circle
            key={r}
            cx={CENTER}
            cy={CENTER}
            r={r}
            fill="none"
            stroke={ACCENT}
            strokeOpacity={0.3}
            strokeWidth={2.2}
          />
        ) : (
          <circle
            key={r}
            cx={CENTER}
            cy={CENTER}
            r={r}
            fill="none"
            stroke={INK}
            strokeOpacity={0.09}
            strokeWidth={1.4}
          />
        ),
      )}
      {/* Bold bullseye — the single restrained accent focal point (pulsing). */}
      <circle
        className="min-anim"
        cx={CENTER}
        cy={CENTER}
        r={5.5}
        fill={ACCENT}
        style={
          {
            transformBox: "fill-box",
            transformOrigin: "center",
            animation: "min-pulse 5.6s ease-in-out infinite",
          } as CSSProperties
        }
      />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  One composed tile (contour is continuous; the target alternates sides)     */
/* -------------------------------------------------------------------------- */

function BoardTile({ index }: { index: number }) {
  const leftPct = index % 2 === 0 ? 72 : 28; // alternate sides for poster rhythm
  return (
    <div
      className="absolute left-0 right-0"
      style={{ top: index * TILE_H, height: TILE_H }}
    >
      {/* Oversized concentric target, centered on the tile's vertical mid. */}
      <div
        className="absolute"
        style={{
          left: `${leftPct}%`,
          top: TILE_H / 2,
          transform: "translate(-50%, -50%)",
        }}
      >
        <ConcentricTarget />
      </div>
      {/* Continuous winding contour (never mirrored → seamless across tiles). */}
      <ContourLayer />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Root                                                                       */
/* -------------------------------------------------------------------------- */

/** Precise left-margin coordinate ruler — hairline minor ticks (every 46px)
 *  with a stronger major tick on the 138px node-row cadence. Non-tiled CSS so
 *  it seamlessly covers the full board height at any size. */
const rulerStyle: CSSProperties = {
  backgroundImage: [
    `linear-gradient(to bottom, ${INK} 0, ${INK} 1px, transparent 1px, transparent 100%)`,
    `linear-gradient(to bottom, ${INK} 0, ${INK} 1px, transparent 1px, transparent 100%)`,
  ].join(", "),
  backgroundSize: [`7px ${ROW_H / 3}px`, `13px ${ROW_H}px`].join(", "),
  backgroundPosition: ["0 0", "0 0"].join(", "),
  backgroundRepeat: ["repeat-y", "repeat-y"].join(", "),
  opacity: 0.16,
};

export function MinimalistMapBackground() {
  const [rootRef, tiles] = useMapTiles(TILE_H, MIN_TILES);
  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="absolute inset-0 h-full w-full overflow-hidden"
    >
      <style>{CSS}</style>

      {/* Flat surface field — clean, no gradients. */}
      <div className="absolute inset-0 bg-surface" />

      {/* The composition, breathing with a tiny seam-safe parallax. */}
      <div
        className="min-anim absolute inset-0"
        style={{ animation: "min-breath 26s ease-in-out infinite" }}
      >
        {Array.from({ length: tiles }, (_, k) => (
          <BoardTile key={k} index={k} />
        ))}
      </div>

      {/* Swiss coordinate ruler down the left margin. */}
      <div className="absolute bottom-0 left-[18px] top-0 w-[13px]" style={rulerStyle} />
    </div>
  );
}
