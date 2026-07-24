import { useMemo } from "react";

/**
 * The ambient "trader's desk" backdrop: a faint ledger grid, a slowly drifting
 * row of candlestick silhouettes, and a price path that draws itself. Pure
 * SVG/CSS — GPU-friendly transforms only, sits behind all content, and is fully
 * static under `prefers-reduced-motion` (handled globally in index.css).
 */

interface Candle {
  x: number;
  open: number;
  close: number;
  high: number;
  low: number;
  bull: boolean;
}

// Deterministic pseudo-random so the silhouette is stable across renders.
function buildCandles(n: number): Candle[] {
  const out: Candle[] = [];
  let level = 120;
  for (let i = 0; i < n; i++) {
    const drift = Math.sin(i * 0.7) * 10 + Math.cos(i * 1.9) * 6;
    const body = 10 + Math.abs(Math.sin(i * 2.3)) * 34;
    const open = level;
    const close = level + (i % 2 === 0 ? -1 : 1) * body * Math.sign(drift || 1);
    const high = Math.max(open, close) + 8 + Math.abs(Math.cos(i * 1.3)) * 14;
    const low = Math.min(open, close) - 8 - Math.abs(Math.sin(i * 1.1)) * 14;
    out.push({ x: i * 40 + 20, open, close, high, low, bull: close < open });
    level = close + drift * 0.4;
    level = Math.max(60, Math.min(190, level));
  }
  return out;
}

function CandleRow() {
  const candles = useMemo(() => buildCandles(28), []);
  const width = 28 * 40;
  return (
    <svg
      width={width}
      height={240}
      viewBox={`0 0 ${width} 240`}
      preserveAspectRatio="none"
      className="h-full w-1/2 shrink-0"
      aria-hidden="true"
    >
      {candles.map((c, i) => {
        const color = c.bull
          ? "rgb(var(--color-bull))"
          : "rgb(var(--color-bear))";
        const top = Math.min(c.open, c.close);
        const h = Math.max(3, Math.abs(c.open - c.close));
        return (
          <g key={i} stroke={color} fill={color}>
            <line x1={c.x} x2={c.x} y1={c.high} y2={c.low} strokeWidth={2} />
            <rect
              x={c.x - 9}
              y={top}
              width={18}
              height={h}
              rx={1}
              fillOpacity={c.bull ? 0.9 : 0.55}
            />
          </g>
        );
      })}
    </svg>
  );
}

export function DeskBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* Ledger / plotting-paper grid */}
      <div className="tex-grid absolute inset-0 opacity-60" />

      {/* Self-drawing price path across the upper third */}
      <svg
        className="absolute left-0 right-0 top-[12%] h-[36%] w-full"
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
      >
        <path
          d="M0,30 L8,26 L14,31 L22,18 L30,22 L38,11 L46,17 L54,7 L64,14 L72,5 L82,12 L90,3 L100,9"
          fill="none"
          stroke="rgb(var(--color-accent))"
          strokeWidth={0.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          className="animate-draw-path opacity-[0.22]"
          style={{ strokeDasharray: 300 }}
        />
      </svg>

      {/* Drifting candlestick silhouettes along the bottom */}
      <div className="absolute bottom-0 left-0 h-[240px] w-full opacity-[0.12] dark:opacity-[0.16]">
        <div className="animate-candle-drift flex h-full w-[200%]">
          <CandleRow />
          <CandleRow />
        </div>
      </div>
    </div>
  );
}
