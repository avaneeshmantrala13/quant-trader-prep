/**
 * LineChart — a responsive, themed SVG line chart shared by every simulation
 * that plots convergence / trajectories (running means, proportions, bankroll
 * curves, …). Responsive via a fixed 640×`height` viewBox scaled with
 * `h-auto w-full` — no ResizeObserver. All colors come from semantic Tailwind
 * stroke/fill token classes so it themes correctly across all 6 themes.
 */
import {
  arrowHeadPoints,
  estimateCaptionWidth,
  placeAnnotation,
  type AnnotationSide,
  type PlotBox,
  type Point,
} from "@/lib/simulations/annotations";

export interface LinePoint {
  x: number;
  y: number;
}

export interface LineSeries {
  points: LinePoint[];
  /** Tailwind stroke class, default "stroke-accent". */
  colorClass?: string;
  dashed?: boolean;
  /** stroke width in viewBox px, default 2. */
  width?: number;
  label?: string;
}

export interface RefLine {
  y: number;
  label?: string;
  /** Tailwind stroke class, default "stroke-bear". */
  colorClass?: string;
  dashed?: boolean; // default true
}

/**
 * A small explanatory callout: a leader line + arrowhead pointing at a DATA
 * coordinate `{x, y}` with a short caption. Positioning/clamping math lives in
 * the pure `@/lib/simulations/annotations` module (unit-tested). Keep captions
 * short — they render as a compact, AA-legible token-themed label.
 */
export interface ChartAnnotation {
  /** Target data coordinate the arrow points at. */
  x: number;
  y: number;
  text: string;
  /** Which side the caption sits on (leader direction). Default "up". */
  side?: AnnotationSide;
  /** Leader-line length in viewBox px. Default 26. */
  distance?: number;
  /** Caption font size in viewBox px. Default 10. */
  fontSize?: number;
}

export interface LineChartProps {
  series: LineSeries[];
  xLabel?: string;
  yLabel?: string;
  xDomain?: [number, number]; // auto-fit from data if omitted
  yDomain?: [number, number]; // auto-fit (with small padding) if omitted
  height?: number; // viewBox height, default 240
  refLines?: RefLine[];
  formatX?: (x: number) => string; // default String
  formatY?: (y: number) => string; // default (y) => y.toFixed(2)
  /** Explanatory callouts pointing at data coordinates. */
  annotations?: ChartAnnotation[];
  /** Accessible description. */
  ariaLabel?: string;
}

/** A callout already resolved to a viewBox-pixel tip (chart-agnostic). */
export interface ResolvedAnnotation {
  tip: Point;
  text: string;
  side?: AnnotationSide;
  distance?: number;
  fontSize?: number;
}

/**
 * Shared SVG layer that renders leader-line + arrowhead + captioned callouts,
 * clamped inside `box` via the pure `annotations` helpers. Used by both
 * LineChart and BarChart so callouts look identical across chart types. All
 * colors are semantic tokens (`stroke-muted`, `fill-surface`, `fill-primary`).
 */
export function AnnotationLayer(props: {
  annotations: ResolvedAnnotation[];
  box: PlotBox;
}): JSX.Element | null {
  const { annotations, box } = props;
  if (annotations.length === 0) return null;
  return (
    <g className="pointer-events-none">
      {annotations.map((a, i) => {
        const side = a.side ?? "up";
        const distance = a.distance ?? 26;
        const fontSize = a.fontSize ?? 10;
        const p = placeAnnotation({
          tip: a.tip,
          side,
          distance,
          text: a.text,
          fontSize,
          box,
        });
        const width = estimateCaptionWidth(a.text, fontSize);
        const padX = 3;
        const padY = 2;
        let rectX = p.anchor.x - padX;
        if (p.textAnchor === "end") rectX = p.anchor.x - width - padX;
        else if (p.textAnchor === "middle") rectX = p.anchor.x - width / 2 - padX;
        let rectY = p.anchor.y - fontSize / 2 - padY;
        if (p.baseline === "auto") rectY = p.anchor.y - fontSize - padY;
        else if (p.baseline === "hanging") rectY = p.anchor.y - padY;
        return (
          <g key={`ann-${i}`}>
            <line
              x1={p.anchor.x}
              y1={p.anchor.y}
              x2={p.tip.x}
              y2={p.tip.y}
              className="stroke-muted"
              strokeWidth={1}
            />
            <polyline
              points={arrowHeadPoints(p.tip, p.anchor, 5)}
              fill="none"
              className="stroke-muted"
              strokeWidth={1}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <rect
              x={rectX}
              y={rectY}
              width={width + padX * 2}
              height={fontSize + padY * 2}
              rx={2}
              className="fill-surface"
              fillOpacity={0.82}
            />
            <text
              x={p.anchor.x}
              y={p.anchor.y}
              textAnchor={p.textAnchor}
              dominantBaseline={p.baseline}
              fontSize={fontSize}
              className="fill-primary font-mono"
            >
              {a.text}
            </text>
          </g>
        );
      })}
    </g>
  );
}

const WIDTH = 640;
const M = { left: 44, right: 16, top: 12, bottom: 34 } as const;
const TICK_COUNT = 5;

/** Evenly spaced tick values across [min, max]; collapses a zero-width span. */
function ticks(min: number, max: number, count: number): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (min === max) return [min];
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    out.push(min + ((max - min) * i) / (count - 1));
  }
  return out;
}

export function LineChart(props: LineChartProps): JSX.Element {
  const {
    series,
    xLabel,
    yLabel,
    xDomain,
    yDomain,
    height = 240,
    refLines = [],
    formatX = (x) => String(x),
    formatY = (y) => y.toFixed(2),
    annotations = [],
    ariaLabel,
  } = props;

  const plotLeft = M.left;
  const plotRight = WIDTH - M.right;
  const plotTop = M.top;
  const plotBottom = height - M.bottom;
  const plotW = plotRight - plotLeft;
  const plotH = plotBottom - plotTop;

  // ---- Domains --------------------------------------------------------------
  const allPoints = series.flatMap((s) => s.points);
  const refYs = refLines.map((r) => r.y);
  const hasData = allPoints.length > 0;

  let xMin: number;
  let xMax: number;
  if (xDomain) {
    [xMin, xMax] = xDomain;
  } else if (hasData) {
    xMin = Math.min(...allPoints.map((p) => p.x));
    xMax = Math.max(...allPoints.map((p) => p.x));
  } else {
    xMin = 0;
    xMax = 1;
  }
  if (xMin === xMax) {
    xMin -= 0.5;
    xMax += 0.5;
  }

  let yMin: number;
  let yMax: number;
  if (yDomain) {
    [yMin, yMax] = yDomain;
  } else {
    const ys = [...allPoints.map((p) => p.y), ...refYs];
    if (ys.length > 0) {
      const lo = Math.min(...ys);
      const hi = Math.max(...ys);
      const pad = (hi - lo) * 0.08 || Math.abs(hi) * 0.08 || 1;
      yMin = lo - pad;
      yMax = hi + pad;
    } else {
      yMin = 0;
      yMax = 1;
    }
  }
  if (yMin === yMax) {
    yMin -= 0.5;
    yMax += 0.5;
  }

  const sx = (x: number): number =>
    plotLeft + ((x - xMin) / (xMax - xMin)) * plotW;
  const sy = (y: number): number =>
    plotBottom - ((y - yMin) / (yMax - yMin)) * plotH;

  const xTicks = ticks(xMin, xMax, TICK_COUNT);
  const yTicks = ticks(yMin, yMax, TICK_COUNT);

  const label = ariaLabel ?? "Line chart";

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${height}`}
      className="h-auto w-full"
      role="img"
      aria-label={label}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Axis frame */}
      <line
        x1={plotLeft}
        y1={plotTop}
        x2={plotLeft}
        y2={plotBottom}
        className="stroke-subtle"
        strokeWidth={1}
      />
      <line
        x1={plotLeft}
        y1={plotBottom}
        x2={plotRight}
        y2={plotBottom}
        className="stroke-subtle"
        strokeWidth={1}
      />

      {/* Y ticks + labels */}
      {yTicks.map((t, i) => {
        const y = sy(t);
        return (
          <g key={`y-${i}`}>
            <line
              x1={plotLeft - 4}
              y1={y}
              x2={plotLeft}
              y2={y}
              className="stroke-subtle"
              strokeWidth={1}
            />
            <text
              x={plotLeft - 7}
              y={y}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={11}
              className="fill-muted font-mono"
            >
              {formatY(t)}
            </text>
          </g>
        );
      })}

      {/* X ticks + labels */}
      {xTicks.map((t, i) => {
        const x = sx(t);
        return (
          <g key={`x-${i}`}>
            <line
              x1={x}
              y1={plotBottom}
              x2={x}
              y2={plotBottom + 4}
              className="stroke-subtle"
              strokeWidth={1}
            />
            <text
              x={x}
              y={plotBottom + 15}
              textAnchor="middle"
              fontSize={11}
              className="fill-muted font-mono"
            >
              {formatX(t)}
            </text>
          </g>
        );
      })}

      {/* Reference lines */}
      {refLines.map((r, i) => {
        const y = sy(r.y);
        const dashed = r.dashed ?? true;
        return (
          <g key={`ref-${i}`}>
            <line
              x1={plotLeft}
              y1={y}
              x2={plotRight}
              y2={y}
              className={r.colorClass ?? "stroke-bear"}
              strokeWidth={1.5}
              strokeDasharray={dashed ? "6 5" : undefined}
            />
            {r.label ? (
              <text
                x={plotRight - 4}
                y={y - 4}
                textAnchor="end"
                fontSize={11}
                className="fill-muted font-mono"
              >
                {r.label}
              </text>
            ) : null}
          </g>
        );
      })}

      {/* Series */}
      {series.map((s, i) => {
        if (s.points.length === 0) return null;
        const pts = s.points.map((p) => `${sx(p.x)},${sy(p.y)}`).join(" ");
        return (
          <polyline
            key={`series-${i}`}
            points={pts}
            fill="none"
            className={s.colorClass ?? "stroke-accent"}
            strokeWidth={s.width ?? 2}
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray={s.dashed ? "6 5" : undefined}
          />
        );
      })}

      {/* Explanatory callouts (leader line + arrowhead + caption) */}
      <AnnotationLayer
        box={{
          left: plotLeft,
          right: plotRight,
          top: plotTop,
          bottom: plotBottom,
        }}
        annotations={annotations.map((a) => ({
          tip: { x: sx(a.x), y: sy(a.y) },
          text: a.text,
          side: a.side,
          distance: a.distance,
          fontSize: a.fontSize,
        }))}
      />

      {/* Axis labels */}
      {xLabel ? (
        <text
          x={plotLeft + plotW / 2}
          y={height - 4}
          textAnchor="middle"
          fontSize={11}
          className="fill-muted font-mono"
        >
          {xLabel}
        </text>
      ) : null}
      {yLabel ? (
        <text
          x={12}
          y={plotTop + plotH / 2}
          textAnchor="middle"
          fontSize={11}
          className="fill-muted font-mono"
          transform={`rotate(-90 12 ${plotTop + plotH / 2})`}
        >
          {yLabel}
        </text>
      ) : null}
    </svg>
  );
}
