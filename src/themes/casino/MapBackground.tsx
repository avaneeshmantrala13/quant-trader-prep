import type { CSSProperties, ReactElement } from "react";
import { SUIT_PATH, type Suit } from "./suits";
import { useMapTiles } from "../useMapTiles";

/**
 * Casino Felt — MAP BOARD BACKGROUND (shared across every casino track).
 *
 * A top-down view of an opulent gaming floor the level path winds across: a rich
 * green felt table with a winding gold-trimmed betting lane, and scattered
 * gold-line CARD-ROOM LANDMARKS — a slowly turning roulette wheel with numbered
 * pockets, a fanned royal flush, stacked poker chips, a pair of dice, a mini
 * craps/blackjack layout, and a four-suit medallion — plus ornate corner
 * filigree, a gold table-rail vignette, faint suit/chip watermarks and a soft
 * gleam that drifts across the gold.
 *
 * TILING: board height varies (levels × 138px, can be tall), so the scene is a
 * stack of identical, SEAMLESS 552px tiles (absolute top offsets). The winding
 * lane completes exactly one sine period per tile so it lines up across seams,
 * and every landmark sits fully inside its tile. The parent clips overflow, so
 * we render enough tiles to cover very tall boards; alternate tiles mirror
 * horizontally so the repeat never reads as a hard loop.
 *
 * LEGIBILITY: kept intentionally muted (thin gold hairlines, low fill/stroke
 * opacity, tokened felt) and the whole repeating scene is dialed back with a
 * wrapper opacity, so the path, level numbers, lock/check, station art and
 * labels stay clearly legible (WCAG-AA) in both dark felt + light baize. Motion
 * is transform/opacity-only and frozen under `prefers-reduced-motion`.
 */

const TILE_H = 552; // 4 node-rows; lane does exactly one sine period per tile
const MIN_TILES = 6; // first-paint / short-board floor; grows to fill any height
const AMP = 27; // lane sway (% of width) — echoes the node path's ±32%
const HALF = 9; // lane half-width (% of width)

const GOLD = "rgb(var(--color-gold))";
const INK = "rgb(var(--color-text-primary))";
const RED = "rgb(var(--color-bear))";
const FELT = "rgb(var(--color-surface))";
const FELT_RAISED = "rgb(var(--color-surface-raised))";

/* -------------------------------------------------------------------------- */
/*  Gentle, reduced-motion-safe motion (transform/opacity only)                */
/* -------------------------------------------------------------------------- */

const CASINO_MAP_ANIM_CSS = `
@keyframes casino-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
@keyframes casino-shimmer{0%{transform:translateX(-110%);opacity:0}45%{opacity:1}55%{opacity:1}100%{transform:translateX(430%);opacity:0}}
@keyframes casino-sparkle{0%,100%{opacity:.12;transform:scale(.7)}50%{opacity:.7;transform:scale(1.08)}}
@keyframes casino-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
@media (prefers-reduced-motion: reduce){.casino-anim{animation:none !important}}
`;

function CasinoMapAnimations() {
  return <style dangerouslySetInnerHTML={{ __html: CASINO_MAP_ANIM_CSS }} />;
}

const spin = (secs: number): CSSProperties => ({
  transformBox: "fill-box",
  transformOrigin: "center",
  animation: `casino-spin ${secs}s linear infinite`,
});

/* -------------------------------------------------------------------------- */
/*  Winding felt betting lane — one seamless sine period across the tile        */
/* -------------------------------------------------------------------------- */

function laneCenter(y: number): number {
  return 50 + AMP * Math.sin((2 * Math.PI * y) / TILE_H);
}
function laneRibbon(): string {
  const N = 40;
  let right = "";
  let left = "";
  for (let i = 0; i <= N; i++) {
    const y = (TILE_H * i) / N;
    const c = laneCenter(y);
    right += `${i === 0 ? "M" : "L"}${(c + HALF).toFixed(2)} ${y.toFixed(1)} `;
  }
  for (let i = N; i >= 0; i--) {
    const y = (TILE_H * i) / N;
    const c = laneCenter(y);
    left += `L${(c - HALF).toFixed(2)} ${y.toFixed(1)} `;
  }
  return `${right}${left}Z`;
}
function laneSpine(): string {
  const N = 40;
  let s = "";
  for (let i = 0; i <= N; i++) {
    const y = (TILE_H * i) / N;
    s += `${i === 0 ? "M" : "L"}${laneCenter(y).toFixed(2)} ${y.toFixed(1)} `;
  }
  return s;
}
const LANE = laneRibbon();
const SPINE = laneSpine();

/** Stretched (percentage-x, pixel-y) layer: the felt lane + gold trim. */
function LaneLayer() {
  return (
    <svg
      viewBox={`0 0 100 ${TILE_H}`}
      preserveAspectRatio="none"
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      {/* soft drop for depth */}
      <path d={LANE} fill={INK} fillOpacity={0.05} transform="translate(0 3)" />
      {/* raised felt ribbon with gold hairline edges */}
      <path
        d={LANE}
        fill={FELT_RAISED}
        fillOpacity={0.5}
        stroke={GOLD}
        strokeOpacity={0.32}
        strokeWidth={1.2}
        vectorEffect="non-scaling-stroke"
      />
      {/* dashed gold centre line — the "route" laid on the felt */}
      <path
        d={SPINE}
        fill="none"
        stroke={GOLD}
        strokeOpacity={0.3}
        strokeWidth={1}
        strokeDasharray="1 4"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  Fixed-size (undistorted) gold-line casino landmarks                        */
/* -------------------------------------------------------------------------- */

function sector(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
  const p = (r: number, a: number) => `${cx + Math.cos(a) * r} ${cy + Math.sin(a) * r}`;
  return `M${p(r1, a0)} A${r1} ${r1} 0 0 1 ${p(r1, a1)} L${p(r0, a1)} A${r0} ${r0} 0 0 0 ${p(r0, a0)} Z`;
}

const WHEEL_NUMS = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23];

function RouletteWheel({ size = 150 }: { size?: number }) {
  const cx = 60;
  const cy = 60;
  const n = WHEEL_NUMS.length;
  const pockets: ReactElement[] = [];
  const spokes: ReactElement[] = [];
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2;
    const mid = (a0 + a1) / 2;
    pockets.push(
      <path
        key={`p${i}`}
        d={sector(cx, cy, 40, 54, a0, a1)}
        fill={i % 2 === 0 ? RED : INK}
        fillOpacity={0.16}
        stroke={GOLD}
        strokeOpacity={0.4}
        strokeWidth={0.6}
      />,
    );
    pockets.push(
      <text
        key={`t${i}`}
        x={cx + Math.cos(mid) * 47}
        y={cy + Math.sin(mid) * 47 + 1.8}
        textAnchor="middle"
        fontFamily="var(--font-mono)"
        fontSize={5}
        fill={GOLD}
        fillOpacity={0.6}
        transform={`rotate(${(mid * 180) / Math.PI + 90} ${cx + Math.cos(mid) * 47} ${cy + Math.sin(mid) * 47})`}
      >
        {WHEEL_NUMS[i]}
      </text>,
    );
    spokes.push(
      <line
        key={`s${i}`}
        x1={cx + Math.cos(a0) * 8}
        y1={cy + Math.sin(a0) * 8}
        x2={cx + Math.cos(a0) * 30}
        y2={cy + Math.sin(a0) * 30}
        stroke={GOLD}
        strokeOpacity={0.35}
        strokeWidth={0.8}
      />,
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
      <circle cx={cx} cy={cy} r={57} fill="none" stroke={GOLD} strokeOpacity={0.5} strokeWidth={1.6} />
      <circle cx={cx} cy={cy} r={54} fill={FELT} fillOpacity={0.25} stroke={GOLD} strokeOpacity={0.3} strokeWidth={0.8} />
      {/* rotating rotor: pockets + spokes + hub */}
      <g className="casino-anim" style={spin(64)}>
        {pockets}
        <circle cx={cx} cy={cy} r={30} fill="none" stroke={GOLD} strokeOpacity={0.4} strokeWidth={1} />
        {spokes}
        <circle cx={cx} cy={cy} r={9} fill={FELT_RAISED} fillOpacity={0.6} stroke={GOLD} strokeOpacity={0.5} strokeWidth={1} />
        {/* the travelling glint — a bright pip on the rim */}
        <circle cx={cx} cy={cy - 47} r={2.4} fill={GOLD} fillOpacity={0.85} />
      </g>
      {/* static top pointer */}
      <path d={`M${cx} 1 l4 8 l-8 0 Z`} fill={GOLD} fillOpacity={0.6} />
    </svg>
  );
}

function chipStack(cx: number, baseY: number, count: number, tone: string, step = 6) {
  const rows: ReactElement[] = [];
  for (let i = 0; i < count; i++) {
    const y = baseY - i * step;
    rows.push(
      <ellipse
        key={i}
        cx={cx}
        cy={y}
        rx={16}
        ry={5.5}
        fill={i === count - 1 ? tone : FELT_RAISED}
        fillOpacity={i === count - 1 ? 0.28 : 0.5}
        stroke={GOLD}
        strokeOpacity={0.42}
        strokeWidth={1}
      />,
    );
  }
  return <g>{rows}</g>;
}

function ChipStacks({ size = 96 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" aria-hidden="true">
      {chipStack(28, 84, 7, RED)}
      {chipStack(64, 84, 5, INK)}
      {/* a loose chip with a dashed edge */}
      <g transform="translate(48 30)">
        <circle r={11} fill={FELT_RAISED} fillOpacity={0.5} stroke={GOLD} strokeOpacity={0.45} strokeWidth={1.2} />
        <circle r={6} fill="none" stroke={GOLD} strokeOpacity={0.4} strokeWidth={1} strokeDasharray="2 2" />
      </g>
    </svg>
  );
}

function cardShape(
  x: number,
  y: number,
  rot: number,
  suit: Suit,
  rank: string,
  key: number,
) {
  const red = suit === "heart" || suit === "diamond";
  const ink = red ? RED : INK;
  return (
    <g key={key} transform={`translate(${x} ${y}) rotate(${rot})`}>
      <rect
        x={-15}
        y={-21}
        width={30}
        height={42}
        rx={4}
        fill={FELT_RAISED}
        fillOpacity={0.62}
        stroke={GOLD}
        strokeOpacity={0.5}
        strokeWidth={1.2}
      />
      <text x={-11} y={-11} fontFamily="var(--font-display)" fontSize={9} fontWeight={700} fill={ink} fillOpacity={0.72}>
        {rank}
      </text>
      <path d={SUIT_PATH[suit]} fill={ink} fillOpacity={0.66} transform="translate(-6 -3) scale(0.42)" />
    </g>
  );
}

function RoyalFlush({ size = 156 }: { size?: number }) {
  const ranks = ["10", "J", "Q", "K", "A"];
  const cards = ranks.map((r, i) => {
    const rot = (i - 2) * 15;
    const rad = (rot * Math.PI) / 180;
    const px = 78 + Math.sin(rad) * 46;
    const py = 96 - Math.cos(rad) * 46;
    return cardShape(px, py, rot, "spade", r, i);
  });
  return (
    <svg width={size} height={size * 0.72} viewBox="0 0 156 112" aria-hidden="true">
      {cards}
    </svg>
  );
}

function pips(value: number): [number, number][] {
  const m: Record<number, [number, number][]> = {
    2: [[-0.5, -0.5], [0.5, 0.5]],
    3: [[-0.55, -0.55], [0, 0], [0.55, 0.55]],
    5: [[-0.55, -0.55], [0.55, -0.55], [0, 0], [-0.55, 0.55], [0.55, 0.55]],
  };
  return m[value] ?? m[5];
}
function DicePair({ size = 96 }: { size?: number }) {
  const dieAt = (cx: number, cy: number, s: number, rot: number, value: number, key: number) => {
    const h = s / 2;
    return (
      <g key={key} transform={`translate(${cx} ${cy}) rotate(${rot})`}>
        <rect x={-h} y={-h} width={s} height={s} rx={s * 0.2} fill={FELT_RAISED} fillOpacity={0.6} stroke={GOLD} strokeOpacity={0.5} strokeWidth={1.4} />
        {pips(value).map(([ux, uy], i) => (
          <circle key={i} cx={ux * h} cy={uy * h} r={s * 0.1} fill={RED} fillOpacity={0.72} />
        ))}
      </g>
    );
  };
  return (
    <svg width={size} height={size * 0.66} viewBox="0 0 96 64" aria-hidden="true">
      <g className="casino-anim" style={{ animation: "casino-bob 6s ease-in-out infinite" }}>
        {dieAt(32, 34, 34, -12, 5, 1)}
        {dieAt(66, 30, 30, 10, 2, 2)}
      </g>
    </svg>
  );
}

function BettingLayout({ size = 178 }: { size?: number }) {
  const gold = { fill: "none", stroke: GOLD, strokeOpacity: 0.42, strokeWidth: 1.2 } as const;
  const label = (x: number, y: number, t: string, fs = 8) => (
    <text x={x} y={y} textAnchor="middle" fontFamily="var(--font-display)" fontSize={fs} fontWeight={600} letterSpacing="2" fill={GOLD} fillOpacity={0.5}>
      {t}
    </text>
  );
  return (
    <svg width={size} height={size * 0.62} viewBox="0 0 178 110" aria-hidden="true">
      {/* dealer arc */}
      <path d="M18 18 A80 80 0 0 1 160 18" {...gold} />
      {label(89, 12, "BLACKJACK PAYS 3 TO 2", 7)}
      {/* betting boxes */}
      <rect x={16} y={44} width={44} height={30} rx={5} {...gold} />
      <rect x={67} y={44} width={44} height={30} rx={5} {...gold} />
      <rect x={118} y={44} width={44} height={30} rx={5} {...gold} />
      {label(38, 63, "1ST 12", 8)}
      {label(89, 63, "2ND 12", 8)}
      {label(140, 63, "3RD 12", 8)}
      {/* pass-line sweep */}
      <path d="M14 100 Q14 86 30 86 L148 86 Q164 86 164 100" {...gold} />
      {label(89, 106, "PASS LINE", 8)}
    </svg>
  );
}

function SuitMedallion({ size = 98 }: { size?: number }) {
  const c = 49;
  const dots: ReactElement[] = [];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    dots.push(<circle key={i} cx={c + Math.cos(a) * 40} cy={c + Math.sin(a) * 40} r={1} fill={GOLD} fillOpacity={0.4} />);
  }
  const suit = (s: Suit, dx: number, dy: number) => {
    const red = s === "heart" || s === "diamond";
    return (
      <path
        d={SUIT_PATH[s]}
        fill={red ? RED : INK}
        fillOpacity={0.6}
        transform={`translate(${dx} ${dy}) scale(0.5)`}
      />
    );
  };
  return (
    <svg width={size} height={size} viewBox="0 0 98 98" aria-hidden="true">
      <circle cx={c} cy={c} r={44} fill={FELT} fillOpacity={0.22} stroke={GOLD} strokeOpacity={0.5} strokeWidth={1.6} />
      <circle cx={c} cy={c} r={36} fill="none" stroke={GOLD} strokeOpacity={0.3} strokeWidth={0.8} />
      {/* slow filigree of dots */}
      <g className="casino-anim" style={spin(120)}>{dots}</g>
      {suit("spade", 41, 12)}
      {suit("heart", 41, 62)}
      {suit("diamond", 66, 37)}
      {suit("club", 16, 37)}
      <circle cx={c} cy={c} r={5} fill={GOLD} fillOpacity={0.45} />
    </svg>
  );
}

function Sparkle({ s = 9, delay = 0 }: { s?: number; delay?: number }) {
  const t = s * 0.3;
  return (
    <svg width={s * 2} height={s * 2} viewBox={`0 0 ${s * 2} ${s * 2}`} aria-hidden="true">
      <path
        className="casino-anim"
        style={{ transformBox: "fill-box", transformOrigin: "center", animation: `casino-sparkle 3.4s ease-in-out ${delay}s infinite` }}
        d={`M${s} ${s - s} Q${s + t} ${s - t} ${s + s} ${s} Q${s + t} ${s + t} ${s} ${s + s} Q${s - t} ${s + t} ${s - s} ${s} Q${s - t} ${s - t} ${s} ${s - s} Z`}
        fill={GOLD}
        fillOpacity={0.7}
      />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  Placements within one 552px tile (left %, top px) — all fully inside        */
/* -------------------------------------------------------------------------- */

type Placement = { el: ReactElement; left: number; top: number };

const PLACEMENTS: Placement[] = [
  { el: <RouletteWheel size={150} />, left: 58, top: 20 },
  { el: <RoyalFlush size={150} />, left: 2, top: 66 },
  { el: <SuitMedallion size={92} />, left: 78, top: 196 },
  { el: <DicePair size={92} />, left: 8, top: 236 },
  { el: <BettingLayout size={172} />, left: 46, top: 296 },
  { el: <ChipStacks size={96} />, left: 6, top: 404 },
  { el: <ChipStacks size={78} />, left: 80, top: 430 },
  { el: <Sparkle s={9} delay={0} />, left: 40, top: 150 },
  { el: <Sparkle s={7} delay={1.3} />, left: 88, top: 120 },
  { el: <Sparkle s={8} delay={0.6} />, left: 26, top: 356 },
  { el: <Sparkle s={7} delay={1.9} />, left: 66, top: 486 },
];

function CasinoTile({ index }: { index: number }) {
  const mirror = index % 2 === 1;
  return (
    <div className="absolute left-0 right-0" style={{ top: index * TILE_H, height: TILE_H }}>
      <LaneLayer />
      {/*
        Alternate tiles mirror the LANDMARK LAYOUT horizontally so the vertical
        repeat never reads as a hard loop. The outer scaleX(-1) mirrors each
        landmark's POSITION (a wheel on the left appears on the right next tile),
        but it would also flip the artwork itself — turning rank glyphs, pip
        counts, roulette numbers and betting labels into unreadable mirror-image
        text. We therefore counter-flip each placed element with an inverse
        scaleX(-1) on mirrored tiles: positions stay mirrored (layout variety
        preserved) while every glyph/number reads normally left-to-right.
      */}
      <div className="absolute inset-0" style={mirror ? ({ transform: "scaleX(-1)" } as CSSProperties) : undefined}>
        {PLACEMENTS.map((p, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              left: `${p.left}%`,
              top: p.top,
              ...(mirror ? ({ transform: "scaleX(-1)" } as CSSProperties) : {}),
            }}
          >
            {p.el}
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Global chrome (fixed regardless of board height)                           */
/* -------------------------------------------------------------------------- */

/** An ornate gold corner scroll. Placed + flipped into each board corner. */
function CornerFiligree({ style }: { style?: CSSProperties }) {
  return (
    <svg width={72} height={72} viewBox="0 0 72 72" aria-hidden="true" className="absolute" style={style}>
      <g fill="none" stroke={GOLD} strokeOpacity={0.4} strokeWidth={1.4} strokeLinecap="round">
        <path d="M4 4 L34 4 Q10 8 8 34 L4 34 Z" fill={GOLD} fillOpacity={0.06} />
        <path d="M10 10 Q10 30 30 30 Q18 30 18 18 Q30 18 30 10" />
        <path d="M12 40 Q22 40 22 30" />
        <path d="M40 12 Q40 22 30 22" />
        <circle cx={30} cy={30} r={1.6} fill={GOLD} fillOpacity={0.5} stroke="none" />
      </g>
    </svg>
  );
}

function SuitWatermark() {
  return (
    <g fill={GOLD} stroke="none">
      <path d={SUIT_PATH.spade} transform="translate(26 30) rotate(-12) scale(1.5)" />
      <path d={SUIT_PATH.heart} transform="translate(128 20) rotate(10) scale(1.3)" />
      <path d={SUIT_PATH.diamond} transform="translate(60 138) rotate(-6) scale(1.35)" />
      <path d={SUIT_PATH.club} transform="translate(150 128) rotate(14) scale(1.4)" />
    </g>
  );
}

export function CasinoMapBackground() {
  const [rootRef, tiles] = useMapTiles(TILE_H, MIN_TILES);
  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden"
    >
      <CasinoMapAnimations />

      {/* Felt base — a subtle vertical gradient across the table. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgb(var(--color-surface)) 0%, rgb(var(--color-surface-muted)) 100%)",
        }}
      />

      {/* Woven felt weave — a fine crosshatch tinted by the border token. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, rgb(var(--color-border) / 0.05) 0 1px, transparent 1px 4px), repeating-linear-gradient(-45deg, rgb(var(--color-border) / 0.05) 0 1px, transparent 1px 4px)",
        }}
      />

      {/* Faint suit watermark — tiles to any height. */}
      <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <pattern id="casino-map-marks" width={200} height={200} patternUnits="userSpaceOnUse">
            <g opacity={0.04}>
              <SuitWatermark />
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#casino-map-marks)" />
      </svg>

      {/* Centre spotlight sheen for table depth. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 68% 40% at 50% 32%, rgb(var(--color-surface-raised) / 0.5) 0%, transparent 72%)",
        }}
      />

      {/* Repeating gaming-floor scene — muted so stations/numbers stay the focus. */}
      <div className="absolute inset-0 opacity-[0.72] dark:opacity-[0.6]">
        {Array.from({ length: tiles }, (_, k) => (
          <CasinoTile key={k} index={k} />
        ))}
      </div>

      {/* Soft gold gleam drifting across the felt. */}
      <div
        className="casino-anim absolute inset-y-0 left-0 w-[26%]"
        style={{
          background:
            "linear-gradient(100deg, transparent 0%, rgb(var(--color-gold) / 0.12) 50%, transparent 100%)",
          animation: "casino-shimmer 12s ease-in-out infinite",
        }}
      />

      {/* Ornate gold corner filigree in each board corner. */}
      <CornerFiligree style={{ top: 6, left: 6 }} />
      <CornerFiligree style={{ top: 6, right: 6, transform: "scaleX(-1)" }} />
      <CornerFiligree style={{ bottom: 6, left: 6, transform: "scaleY(-1)" }} />
      <CornerFiligree style={{ bottom: 6, right: 6, transform: "scale(-1,-1)" }} />

      {/* Gold table-rail vignette hugging the board edge. */}
      <div
        className="absolute inset-[10px] rounded-md"
        style={{
          border: "1px solid rgb(var(--color-gold) / 0.28)",
          boxShadow:
            "inset 0 0 0 4px rgb(var(--color-bg) / 0.22), inset 0 0 90px rgb(0 0 0 / 0.32)",
        }}
      />
    </div>
  );
}
