import type { ReactElement } from "react";

/**
 * Engraving vignettes + faux-article columns for the broadsheet map board.
 * All monochrome "ink" (theme-tokened, so it adapts light/dark) at LOW opacity —
 * the richness is in the fine line-work and composition, never in contrast.
 */

export const INK = "rgb(var(--color-border-strong))";
export const TILE_H = 552; // 4 node-rows; the page tiles seamlessly at this height

/** Fine parallel crosshatch inside a box (engraving shading). */
function hatch(
  x: number,
  y: number,
  w: number,
  h: number,
  gap: number,
  op: number,
  key: string,
): ReactElement {
  const lines: ReactElement[] = [];
  for (let d = -h; d < w; d += gap) {
    const x1 = x + Math.max(0, d);
    const y1 = y + Math.max(0, -d);
    const x2 = x + Math.min(w, d + h);
    const y2 = y + Math.min(h, w - d);
    lines.push(<line key={`${key}-${d}`} x1={x1} y1={y1} x2={x2} y2={y2} />);
  }
  return (
    <g stroke={INK} strokeWidth={0.5} strokeOpacity={op}>
      {lines}
    </g>
  );
}

/* -------------------------------------------------------------------------- */
/*  Engraving vignettes (fixed-size, undistorted; each self-framed)           */
/* -------------------------------------------------------------------------- */

/** Bull & Bear facing off — the classic financial vignette. */
export function BullBear({ w = 128 }: { w?: number }) {
  return (
    <svg width={w} height={w * 0.62} viewBox="0 0 128 80" aria-hidden="true">
      <rect x="1" y="1" width="126" height="78" fill="none" stroke={INK} strokeOpacity={0.28} strokeWidth={1} />
      <line x1="8" y1="64" x2="120" y2="64" stroke={INK} strokeOpacity={0.3} strokeWidth={1} />
      {/* Bull (left, charging right) */}
      <g stroke={INK} strokeOpacity={0.42} strokeWidth={1.4} fill="none" strokeLinejoin="round">
        <path d="M14 62 L18 44 Q22 32 38 31 L54 31 Q60 31 61 38 L60 46 L57 62" />
        <path d="M54 31 Q57 24 63 24 M54 33 Q49 27 45 29" />
        <path d="M20 62 v-6 M32 62 v-6 M46 62 v-6 M55 62 v-5" />
        <path d="M14 47 q-5 2 -7 7" />
      </g>
      {hatch(30, 34, 26, 22, 3.2, 0.16, "bull")}
      {/* Bear (right, hunched, reaching down-left) */}
      <g stroke={INK} strokeOpacity={0.42} strokeWidth={1.4} fill="none" strokeLinejoin="round">
        <path d="M116 62 L112 40 Q108 28 92 30 Q78 32 74 44 L72 62" />
        <path d="M92 30 q3 -6 -1 -9 M97 30 q4 -5 9 -4" />
        <path d="M80 62 v-6 M92 62 v-6 M104 62 v-6 M113 62 v-5" />
        <path d="M74 46 q-6 4 -10 12" />
      </g>
      {hatch(78, 34, 30, 24, 3.2, 0.16, "bear")}
    </svg>
  );
}

/** A framed engraved stock chart — trend line + candlesticks + axis. */
export function StockChart({ w = 132 }: { w?: number }) {
  const candles: ReactElement[] = [];
  const data = [40, 34, 37, 26, 30, 20, 24, 12] as const;
  data.forEach((y, i) => {
    const x = 20 + i * 12;
    const up = i % 2 === 0;
    const h = 6 + ((i * 5) % 11);
    candles.push(
      <g key={i} stroke={INK} strokeOpacity={0.4} strokeWidth={1.1}>
        <line x1={x} y1={y - 6} x2={x} y2={y + h + 6} />
        <rect x={x - 3.5} y={y} width={7} height={h} fill={INK} fillOpacity={up ? 0.05 : 0.24} />
      </g>,
    );
  });
  return (
    <svg width={w} height={w * 0.66} viewBox="0 0 132 88" aria-hidden="true">
      <rect x="1" y="1" width="130" height="86" fill="none" stroke={INK} strokeOpacity={0.28} strokeWidth={1} />
      {/* axes + faint gridlines */}
      <g stroke={INK} strokeOpacity={0.18} strokeWidth={0.6}>
        <line x1="14" y1="10" x2="14" y2="70" strokeOpacity={0.34} />
        <line x1="14" y1="70" x2="124" y2="70" strokeOpacity={0.34} />
        <line x1="14" y1="26" x2="124" y2="26" />
        <line x1="14" y1="42" x2="124" y2="42" />
        <line x1="14" y1="58" x2="124" y2="58" />
      </g>
      {candles}
      {/* trend line */}
      <path
        d="M20 46 L32 40 L44 43 L56 32 L68 36 L80 26 L92 30 L112 16"
        fill="none"
        stroke={INK}
        strokeOpacity={0.5}
        strokeWidth={1.3}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A neoclassical exchange building — pediment + colonnade + steps. */
export function Exchange({ w = 120 }: { w?: number }) {
  const cols: ReactElement[] = [];
  for (let i = 0; i < 6; i++) {
    const x = 24 + i * 14;
    cols.push(<line key={i} x1={x} y1={34} x2={x} y2={62} stroke={INK} strokeOpacity={0.42} strokeWidth={2.2} />);
  }
  return (
    <svg width={w} height={w * 0.72} viewBox="0 0 120 86" aria-hidden="true">
      <rect x="1" y="1" width="118" height="84" fill="none" stroke={INK} strokeOpacity={0.28} strokeWidth={1} />
      <path d="M16 34 L60 12 L104 34 Z" fill="none" stroke={INK} strokeOpacity={0.44} strokeWidth={1.6} strokeLinejoin="round" />
      {hatch(30, 16, 60, 16, 3, 0.14, "ped")}
      <line x1="14" y1="34" x2="106" y2="34" stroke={INK} strokeOpacity={0.44} strokeWidth={1.8} />
      {cols}
      <line x1="14" y1="62" x2="106" y2="62" stroke={INK} strokeOpacity={0.44} strokeWidth={1.8} />
      <path d="M10 66 H110 M6 70 H114 M2 74 H118" stroke={INK} strokeOpacity={0.34} strokeWidth={1.4} />
    </svg>
  );
}

/** A compass-rose "statistics" figure — radials + degree ticks + needle. */
export function CompassRose({ w = 96 }: { w?: number }) {
  const ticks: ReactElement[] = [];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const r1 = i % 6 === 0 ? 30 : 34;
    const x1 = 48 + Math.cos(a) * r1;
    const y1 = 48 + Math.sin(a) * r1;
    const x2 = 48 + Math.cos(a) * 38;
    const y2 = 48 + Math.sin(a) * 38;
    ticks.push(<line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK} strokeOpacity={0.34} strokeWidth={i % 6 === 0 ? 1.3 : 0.7} />);
  }
  return (
    <svg width={w} height={w} viewBox="0 0 96 96" aria-hidden="true">
      <circle cx="48" cy="48" r="40" fill="none" stroke={INK} strokeOpacity={0.3} strokeWidth={1} />
      <circle cx="48" cy="48" r="30" fill="none" stroke={INK} strokeOpacity={0.2} strokeWidth={0.7} />
      {ticks}
      <path d="M48 16 L54 48 L48 80 L42 48 Z" fill={INK} fillOpacity={0.1} stroke={INK} strokeOpacity={0.42} strokeWidth={1.1} strokeLinejoin="round" />
      <path d="M16 48 L48 42 L80 48 L48 54 Z" fill="none" stroke={INK} strokeOpacity={0.28} strokeWidth={0.9} strokeLinejoin="round" />
      <circle cx="48" cy="48" r="2.4" fill={INK} fillOpacity={0.5} />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  Faux justified article columns (stretched layer)                          */
/* -------------------------------------------------------------------------- */

function prng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * A full tile of five newspaper columns of faux justified body type, suggested
 * with faint horizontal rules (one <path> of segments per column) plus periodic
 * headline bars, rule-unders and drop-caps. Drawn in a preserveAspectRatio=none
 * SVG (percentage-x, pixel-y at TILE_H), so it tiles seamlessly per page.
 */
export function FauxColumns() {
  const rand = prng(0x9e37);
  const cols: ReactElement[] = [];
  const NCOL = 5;
  for (let c = 0; c < NCOL; c++) {
    const x0 = c * 20 + 3;
    const x1 = c * 20 + 17;
    const cw = x1 - x0;
    let d = "";
    const extras: ReactElement[] = [];
    let y = 10;
    let para = 0;
    while (y < 540) {
      // occasional headline bar + rule
      if (para > 0 && rand() < 0.22) {
        const hw = cw * (0.55 + rand() * 0.4);
        extras.push(<rect key={`h-${c}-${y}`} x={x0} y={y} width={hw} height={3.2} fill={INK} fillOpacity={0.22} />);
        y += 6.5;
        extras.push(<line key={`hr-${c}-${y}`} x1={x0} y1={y} x2={x1} y2={y} stroke={INK} strokeWidth={0.6} strokeOpacity={0.3} />);
        y += 4.5;
      }
      // paragraph
      const lines = 3 + Math.floor(rand() * 5);
      const dropCap = rand() < 0.5 && lines >= 4;
      if (dropCap) {
        extras.push(<rect key={`dc-${c}-${y}`} x={x0} y={y} width={7} height={9} fill={INK} fillOpacity={0.16} />);
      }
      for (let l = 0; l < lines; l++) {
        const last = l === lines - 1;
        const indent = dropCap && l < 2 ? 9 : 0;
        const w = last ? cw * (0.4 + rand() * 0.3) : cw - indent;
        const ly = y + l * 3.4 + 3;
        d += `M${(x0 + indent).toFixed(1)} ${ly.toFixed(1)} L${(x0 + indent + w).toFixed(1)} ${ly.toFixed(1)} `;
      }
      y += lines * 3.4 + 5;
      para++;
    }
    cols.push(
      <g key={c}>
        <path d={d} stroke={INK} strokeWidth={1} strokeOpacity={0.14} vectorEffect="non-scaling-stroke" />
        {extras}
      </g>,
    );
  }
  return (
    <svg
      viewBox={`0 0 100 ${TILE_H}`}
      preserveAspectRatio="none"
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      {cols}
    </svg>
  );
}
