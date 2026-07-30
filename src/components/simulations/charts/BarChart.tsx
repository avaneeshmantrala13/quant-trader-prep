/**
 * BarChart — a responsive, themed SVG column chart used mainly for histograms
 * (dice faces, binomial counts, empirical vs theoretical distributions). Same
 * responsive strategy as LineChart: a fixed 640×`height` viewBox scaled with
 * `h-auto w-full`. An optional per-bar `theoretical` value is overlaid either
 * as a short horizontal marker across each bar or as a second thinner bar.
 * All colors come from semantic Tailwind fill/stroke token classes.
 */
import { AnnotationLayer } from "./LineChart";
import type { AnnotationSide } from "@/lib/simulations/annotations";

export interface ChartBar {
  label: string;
  value: number; // empirical bar height (>= 0)
  theoretical?: number; // optional overlay (theoretical value)
}

/**
 * An explanatory callout targeting one bar. `y` defaults to that bar's value
 * (so the arrow lands on the bar top); pass an explicit `y` to point elsewhere
 * on the column. Positioning/clamping reuse the shared pure `annotations`
 * helpers via {@link AnnotationLayer}.
 */
export interface BarAnnotation {
  barIndex: number;
  y?: number;
  text: string;
  side?: AnnotationSide;
  distance?: number;
  fontSize?: number;
}

export interface BarChartProps {
  bars: ChartBar[];
  yLabel?: string;
  height?: number; // default 240
  /** Empirical bar fill class, default "fill-accent". */
  colorClass?: string;
  /** Theoretical overlay color class, default "stroke-bear". */
  theoreticalColorClass?: string;
  /**
   * "marker" = draw theoretical as a short horizontal line across each bar;
   * "bar" = draw a second thinner paired bar. Default "marker".
   */
  theoreticalAs?: "marker" | "bar";
  yDomain?: [number, number]; // default [0, max]
  formatY?: (y: number) => string;
  /** Only render every k-th x label to avoid crowding (auto if omitted). */
  maxXLabels?: number;
  /** Explanatory callouts pointing at bars. */
  annotations?: BarAnnotation[];
  ariaLabel?: string;
}

const WIDTH = 640;
const M = { left: 44, right: 16, top: 12, bottom: 34 } as const;
const TICK_COUNT = 5;
const DEFAULT_MAX_LABELS = 12;

function ticks(min: number, max: number, count: number): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (min === max) return [min];
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    out.push(min + ((max - min) * i) / (count - 1));
  }
  return out;
}

export function BarChart(props: BarChartProps): JSX.Element {
  const {
    bars,
    yLabel,
    height = 240,
    colorClass = "fill-accent",
    theoreticalColorClass = "stroke-bear",
    theoreticalAs = "marker",
    yDomain,
    formatY = (y) => y.toFixed(2),
    maxXLabels,
    annotations = [],
    ariaLabel,
  } = props;

  const plotLeft = M.left;
  const plotRight = WIDTH - M.right;
  const plotTop = M.top;
  const plotBottom = height - M.bottom;
  const plotW = plotRight - plotLeft;
  const plotH = plotBottom - plotTop;

  // ---- Y domain -------------------------------------------------------------
  const values = bars.flatMap((b) =>
    b.theoretical !== undefined ? [b.value, b.theoretical] : [b.value],
  );
  const dataMax = values.length > 0 ? Math.max(...values) : 1;
  let yMin: number;
  let yMax: number;
  if (yDomain) {
    [yMin, yMax] = yDomain;
  } else {
    yMin = 0;
    yMax = dataMax > 0 ? dataMax : 1;
  }
  if (yMin === yMax) yMax = yMin + 1;

  const sy = (y: number): number =>
    plotBottom - ((y - yMin) / (yMax - yMin)) * plotH;

  const n = bars.length;
  const slot = n > 0 ? plotW / n : plotW;
  // Bar occupies ~72% of its slot, centered, leaving gutters between columns.
  const barW = slot * 0.72;
  const barX = (i: number): number => plotLeft + slot * i + (slot - barW) / 2;

  const yTicks = ticks(yMin, yMax, TICK_COUNT);

  // ---- X-label thinning -----------------------------------------------------
  const cap = maxXLabels ?? DEFAULT_MAX_LABELS;
  const labelEvery = n > cap ? Math.ceil(n / cap) : 1;

  const label = ariaLabel ?? "Bar chart";

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

      {/* Bars */}
      {bars.map((b, i) => {
        const x = barX(i);
        const yTop = sy(Math.max(b.value, 0));
        const h = Math.max(0, plotBottom - yTop);
        const showLabel = i % labelEvery === 0 || i === n - 1;

        // Theoretical overlay geometry.
        let overlay: JSX.Element | null = null;
        if (b.theoretical !== undefined) {
          const tY = sy(Math.max(b.theoretical, 0));
          if (theoreticalAs === "bar") {
            const tW = barW * 0.42;
            const tX = x + barW - tW;
            const tH = Math.max(0, plotBottom - tY);
            overlay = (
              <rect
                x={tX}
                y={tY}
                width={tW}
                height={tH}
                fill="none"
                className={theoreticalColorClass}
                strokeWidth={1.5}
                strokeDasharray="4 3"
              />
            );
          } else {
            overlay = (
              <line
                x1={x - 2}
                y1={tY}
                x2={x + barW + 2}
                y2={tY}
                className={theoreticalColorClass}
                strokeWidth={2}
              />
            );
          }
        }

        return (
          <g key={`bar-${i}`}>
            <rect
              x={x}
              y={yTop}
              width={barW}
              height={h}
              className={colorClass}
            />
            {overlay}
            {showLabel ? (
              <text
                x={x + barW / 2}
                y={plotBottom + 15}
                textAnchor="middle"
                fontSize={11}
                className="fill-muted font-mono"
              >
                {b.label}
              </text>
            ) : null}
          </g>
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
        annotations={annotations.map((a) => {
          const bar = bars[a.barIndex];
          const yVal = a.y ?? (bar ? Math.max(bar.value, 0) : 0);
          return {
            tip: { x: barX(a.barIndex) + barW / 2, y: sy(yVal) },
            text: a.text,
            side: a.side,
            distance: a.distance,
            fontSize: a.fontSize,
          };
        })}
      />

      {/* Y axis label */}
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
