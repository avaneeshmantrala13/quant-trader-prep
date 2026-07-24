import type { CSSProperties, ReactElement } from "react";
import { INK, KidsAnimations } from "./animations";
import { useMapTiles } from "../useMapTiles";

/**
 * KIDS MAP BOARD BACKGROUND — a soft, top-down CARNIVAL FAIRGROUND the level
 * path winds through (shared across every kids track). A grassy ground, a
 * meandering cream walkway echoing the node sine, and scattered park props
 * (ferris wheels, striped tents, lollipop trees, balloon bunches, drifting
 * clouds) dot the sides.
 *
 * TILING: the board height varies (levels × 138px), so the scene is a stack of
 * identical, SEAMLESS 552px tiles (absolute top offsets) — the winding walkway
 * completes exactly one sine period per tile so it lines up across the seam, and
 * discrete props sit fully inside each tile. The parent clips overflow, so we
 * render enough tiles to cover very tall boards. Alternate tiles mirror
 * horizontally so the repeat never reads as a hard loop.
 *
 * LEGIBILITY: kept intentionally soft (low opacity, muted candy fills, adaptive
 * "ink" outlines, theme-tokened grass/sky) so the bright stations + level
 * numbers on top always pop. Motion is transform-only and reduced-motion-safe.
 */

const TILE_H = 552; // 4 node-rows; walkway does exactly one sine period per tile
const MIN_TILES = 6; // first-paint / short-board floor; grows to fill any height
const AMP = 28; // walkway sway (% of width) — echoes the node path's ±32%
const HALF = 11; // walkway half-width (% of width)

/* Muted candy palette (softened further via low opacity when drawn). */
const RED = "#ff6b6b";
const YEL = "#ffd93d";
const GRN = "#57c785";
const BLU = "#5aa9ff";
const PUR = "#a78bfa";
const PNK = "#f472b6";
const ORG = "#ff9f45";

/* -------------------------------------------------------------------------- */
/*  Winding walkway — one seamless sine period across the tile height          */
/* -------------------------------------------------------------------------- */

function walkwayPath(): string {
  const N = 32;
  const center = (y: number) => 50 + AMP * Math.sin((2 * Math.PI * y) / TILE_H);
  let right = "";
  let left = "";
  for (let i = 0; i <= N; i++) {
    const y = (TILE_H * i) / N;
    const c = center(y);
    right += `${i === 0 ? "M" : "L"}${(c + HALF).toFixed(2)} ${y.toFixed(1)} `;
  }
  for (let i = N; i >= 0; i--) {
    const y = (TILE_H * i) / N;
    const c = center(y);
    left += `L${(c - HALF).toFixed(2)} ${y.toFixed(1)} `;
  }
  return `${right}${left}Z`;
}
const WALKWAY = walkwayPath();

/** The stretched (percentage-x, pixel-y) layer: walkway + soft grass tufts. */
function GroundLayer() {
  const tufts: ReactElement[] = [];
  const spots: [number, number][] = [
    [12, 70], [22, 470], [84, 120], [90, 360], [6, 250], [76, 520], [40, 30],
  ];
  spots.forEach(([x, y], i) => {
    tufts.push(
      <path
        key={i}
        d={`M${x} ${y} q1.4 -6 3 0 M${x + 2.4} ${y} q1.4 -7 3 0 M${x + 5} ${y} q1.4 -6 3 0`}
        stroke={GRN}
        strokeWidth={1.4}
        strokeOpacity={0.5}
        fill="none"
        strokeLinecap="round"
      />,
    );
  });
  return (
    <svg
      viewBox={`0 0 100 ${TILE_H}`}
      preserveAspectRatio="none"
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      {/* walkway shadow + body + soft dashed seam */}
      <path d={WALKWAY} fill={INK} fillOpacity={0.06} transform="translate(0 3)" />
      <path
        d={WALKWAY}
        fill="rgb(var(--color-surface-raised))"
        fillOpacity={0.75}
        stroke="rgb(var(--color-accent))"
        strokeOpacity={0.18}
        strokeWidth={1.2}
        vectorEffect="non-scaling-stroke"
      />
      {tufts}
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  Fixed-size (undistorted) carnival props                                    */
/* -------------------------------------------------------------------------- */

function Cloud({ w = 96, delay = 0 }: { w?: number; delay?: number }) {
  return (
    <div
      className="kids-anim"
      style={{ animation: `kids-float-slow ${9 + delay}s ease-in-out ${delay}s infinite` } as CSSProperties}
    >
      <svg width={w} height={w * 0.52} viewBox="0 0 96 50" aria-hidden="true">
        <path
          d="M20 42 a12 12 0 0 1 1 -22 a17 17 0 0 1 31 -4 a12 12 0 0 1 17 5 a11 11 0 0 1 12 21 z"
          fill="rgb(var(--color-surface-raised))"
          fillOpacity={0.85}
          stroke={INK}
          strokeOpacity={0.14}
          strokeWidth={2}
        />
      </svg>
    </div>
  );
}

function FerrisWheel({ size = 128, color = BLU }: { size?: number; color?: string }) {
  const R = 46;
  const cx = 60;
  const cy = 56;
  const spokes: ReactElement[] = [];
  const cabs: ReactElement[] = [];
  const cc = [RED, YEL, GRN, PUR, PNK, ORG];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(a) * R;
    const y = cy + Math.sin(a) * R;
    spokes.push(<line key={`s${i}`} x1={cx} y1={cy} x2={x} y2={y} stroke={INK} strokeOpacity={0.4} strokeWidth={1.6} />);
    cabs.push(<rect key={`c${i}`} x={x - 5} y={y - 4} width={10} height={9} rx={3} fill={cc[i]} fillOpacity={0.5} stroke={INK} strokeOpacity={0.4} strokeWidth={1.4} />);
  }
  return (
    <svg width={size} height={size} viewBox="0 0 120 128" aria-hidden="true">
      <path d={`M${cx} ${cy} L${cx - 26} 120 M${cx} ${cy} L${cx + 26} 120`} stroke={INK} strokeOpacity={0.4} strokeWidth={2.4} strokeLinecap="round" />
      <rect x={cx - 30} y={118} width={60} height={6} rx={3} fill={color} fillOpacity={0.4} stroke={INK} strokeOpacity={0.4} strokeWidth={1.6} />
      <g
        className="kids-anim"
        style={{ transformBox: "fill-box", transformOrigin: "center", animation: "kids-spin 26s linear infinite" } as CSSProperties}
      >
        <circle cx={cx} cy={cy} r={R} fill="none" stroke={INK} strokeOpacity={0.4} strokeWidth={2.4} />
        {spokes}
        {cabs}
        <circle cx={cx} cy={cy} r={5} fill={YEL} fillOpacity={0.55} stroke={INK} strokeOpacity={0.4} strokeWidth={1.6} />
      </g>
    </svg>
  );
}

function Tent({ w = 92, a = RED, b = "#fff4e0" }: { w?: number; a?: string; b?: string }) {
  const stripes: ReactElement[] = [];
  const cols = [a, b, a, b, a, b];
  const n = cols.length;
  for (let i = 0; i < n; i++) {
    const x1 = 8 + (76 * i) / n;
    const x2 = 8 + (76 * (i + 1)) / n;
    stripes.push(<path key={i} d={`M46 8 L${x1} 46 L${x2} 46 Z`} fill={cols[i]} fillOpacity={0.42} />);
  }
  return (
    <svg width={w} height={w * 0.78} viewBox="0 0 92 72" aria-hidden="true">
      <rect x={12} y={44} width={68} height={24} rx={5} fill={b} fillOpacity={0.4} stroke={INK} strokeOpacity={0.25} strokeWidth={2} />
      {stripes}
      <path d="M46 8 L8 46 L84 46 Z" fill="none" stroke={INK} strokeOpacity={0.3} strokeWidth={2.2} strokeLinejoin="round" />
      <g className="kids-anim" style={{ transformBox: "view-box", transformOrigin: "46px 8px", animation: "kids-sway 3.6s ease-in-out infinite" } as CSSProperties}>
        <line x1={46} y1={2} x2={46} y2={9} stroke={INK} strokeOpacity={0.35} strokeWidth={1.8} />
        <path d="M46 2 L56 4.5 L46 7 Z" fill={YEL} fillOpacity={0.5} stroke={INK} strokeOpacity={0.3} strokeWidth={1.2} />
      </g>
    </svg>
  );
}

function Tree({ h = 62, color = GRN }: { h?: number; color?: string }) {
  return (
    <svg width={h * 0.72} height={h} viewBox="0 0 44 62" aria-hidden="true">
      <rect x={19} y={40} width={6} height={20} rx={3} fill="#b07a3c" fillOpacity={0.45} stroke={INK} strokeOpacity={0.22} strokeWidth={1.6} />
      <circle cx={22} cy={26} r={16} fill={color} fillOpacity={0.4} stroke={INK} strokeOpacity={0.22} strokeWidth={2} />
      <circle cx={12} cy={32} r={9} fill={color} fillOpacity={0.4} stroke={INK} strokeOpacity={0.22} strokeWidth={2} />
      <circle cx={32} cy={32} r={9} fill={color} fillOpacity={0.4} stroke={INK} strokeOpacity={0.22} strokeWidth={2} />
    </svg>
  );
}

function Balloons({ delay = 0 }: { delay?: number }) {
  const b = (x: number, y: number, c: string) => (
    <g>
      <line x1={x} y1={y + 12} x2={26} y2={78} stroke={INK} strokeOpacity={0.25} strokeWidth={1} />
      <ellipse cx={x} cy={y} rx={10} ry={12} fill={c} fillOpacity={0.4} stroke={INK} strokeOpacity={0.25} strokeWidth={1.6} />
    </g>
  );
  return (
    <div
      className="kids-anim"
      style={{ animation: `kids-float 4.4s ease-in-out ${delay}s infinite` } as CSSProperties}
    >
      <svg width={56} height={84} viewBox="0 0 56 84" aria-hidden="true">
        {b(16, 16, RED)}
        {b(38, 14, BLU)}
        {b(27, 30, YEL)}
      </svg>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Prop placements within one 552px tile (left %, top px)                     */
/* -------------------------------------------------------------------------- */

type Placement = { el: ReactElement; left: number; top: number };

const PLACEMENTS: Placement[] = [
  { el: <FerrisWheel size={132} color={BLU} />, left: 68, top: 34 },
  { el: <Tent w={96} a={RED} />, left: 2, top: 150 },
  { el: <Tent w={82} a={PUR} b="#fff4e0" />, left: 74, top: 372 },
  { el: <Tree h={66} color={GRN} />, left: 3, top: 320 },
  { el: <Tree h={54} color={GRN} />, left: 90, top: 214 },
  { el: <Tree h={48} color={GRN} />, left: 14, top: 474 },
  { el: <Balloons delay={0.4} />, left: 84, top: 452 },
  { el: <Cloud w={104} delay={0} />, left: 6, top: 34 },
  { el: <Cloud w={78} delay={1.6} />, left: 60, top: 268 },
  { el: <Cloud w={88} delay={0.8} />, left: 30, top: 500 },
];

function CarnivalTile({ index }: { index: number }) {
  const mirror = index % 2 === 1;
  return (
    <div
      className="absolute left-0 right-0"
      style={{ top: index * TILE_H, height: TILE_H }}
    >
      <GroundLayer />
      <div
        className="absolute inset-0"
        style={mirror ? ({ transform: "scaleX(-1)" } as CSSProperties) : undefined}
      >
        {PLACEMENTS.map((p, i) => (
          <div
            key={i}
            className="absolute"
            style={{ left: `${p.left}%`, top: p.top }}
          >
            {p.el}
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Root                                                                       */
/* -------------------------------------------------------------------------- */

export function KidsMapBackground() {
  const [rootRef, tiles] = useMapTiles(TILE_H, MIN_TILES);
  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden"
    >
      <KidsAnimations />
      {/* Soft, adaptive grassy base (theme-tokened light/dark). */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgb(var(--color-surface)) 0%, rgb(var(--color-surface-muted)) 100%)",
        }}
      />
      <div className="absolute inset-0 bg-bull opacity-[0.07]" />
      {/* Repeating carnival scene, softened so stations/numbers stay the focus. */}
      <div className="absolute inset-0 opacity-80 dark:opacity-60">
        {Array.from({ length: tiles }, (_, k) => (
          <CarnivalTile key={k} index={k} />
        ))}
      </div>
    </div>
  );
}
