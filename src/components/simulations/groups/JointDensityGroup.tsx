/**
 * JointDensityGroup — the "Joint Distributions" section of the Simulations tab.
 *
 *   • joint-density-integral — a live bivariate-normal joint density f(x, y)
 *     drawn as a heatmap with labeled axes, plus an ADJUSTABLE rectangular
 *     integration region whose DOUBLE INTEGRAL ∫∫ f dx dy (= the probability /
 *     volume trapped under the surface over that rectangle) is computed
 *     numerically and updates live. A seedable Monte-Carlo overlay scatters
 *     correlated draws and watches the empirical fraction-in-region converge
 *     onto the exact double integral.
 *
 * Real-world framing: (X, Y) are the same-day returns of two CORRELATED assets
 * — an index ETF and a tech stock. The double integral over a box answers a
 * concrete desk question: "what's the probability BOTH land in this range at
 * once?" — the joint-tail risk you can't get from either stock alone.
 *
 * The density heatmap and the numerical integral are exact/deterministic; the
 * scatter is seedable (a "Run again" button bumps the seed). All colours come
 * from semantic theme tokens so it renders across all six themes.
 */
import { useMemo, useState } from "react";
import { SimCard } from "@/components/simulations/SimCard";
import { SIM_BY_ID } from "@/lib/simulations/catalog";
import { roundTo } from "@/lib/simulations/shared";
import {
  densityGrid,
  displayDomain,
  marginalXProbability,
  marginalYProbability,
  monteCarloRectProbability,
  rectProbability,
  type BivariateNormalParams,
  type Region,
} from "@/lib/simulations/jointDensity";

const MAX_SAMPLES = 40000;

// Fixed real-world scenario: two correlated daily returns (in %). Only the
// correlation ρ and the integration region are user-adjustable — that keeps
// the focus on what the DOUBLE INTEGRAL does as the region/shape changes.
const SCENARIO: Omit<BivariateNormalParams, "rho"> = {
  muX: 0, // Index ETF mean daily return (%)
  muY: 0, // Tech stock mean daily return (%)
  sigmaX: 1.0, // Index ETF daily volatility (%)
  sigmaY: 1.6, // Tech stock daily volatility (%)
};

// Heatmap resolution (cells) and SVG geometry.
const NX = 56;
const NY = 48;
const VIEW_W = 440;
const VIEW_H = 380;
const M = { left: 48, right: 16, top: 16, bottom: 42 } as const;

function pct(x: number): string {
  return `${roundTo(x * 100, 1)}%`;
}

function fmt(x: number): string {
  return x.toFixed(2);
}

export function JointDensityGroup(): JSX.Element {
  return (
    <div className="space-y-6">
      <JointDensityIntegralCard />
    </div>
  );
}

function JointDensityIntegralCard(): JSX.Element {
  const meta = SIM_BY_ID["joint-density-integral"];

  const [rho, setRho] = useState(0.6);
  const [seed, setSeed] = useState(1);
  const [samples, setSamples] = useState(6000);

  // Integration-region edges (in return %). Defaults: both assets between
  // roughly −1σ and +1σ — the "both have a normal up-ish day" box.
  const [x0, setX0] = useState(-1);
  const [x1, setX1] = useState(2);
  const [y0, setY0] = useState(-1.5);
  const [y1, setY1] = useState(3);

  const params: BivariateNormalParams = { ...SCENARIO, rho };
  const domain = useMemo(() => displayDomain(params, 3.4), [rho]);

  const grid = useMemo(
    () => densityGrid(params, domain, NX, NY),
    [rho, domain],
  );

  // Clamp the region into the plotting window and keep lo < hi.
  const region: Region = {
    x0: Math.min(x0, x1),
    x1: Math.max(x0, x1),
    y0: Math.min(y0, y1),
    y1: Math.max(y0, y1),
  };

  // The DOUBLE INTEGRAL — deterministic numerical value, updates live.
  const prob = useMemo(
    () => rectProbability(params, region, 120),
    [rho, region.x0, region.x1, region.y0, region.y1],
  );

  // Monte-Carlo overlay: correlated draws, fraction inside the region.
  const mc = useMemo(
    () => monteCarloRectProbability(params, region, samples, seed, 1200),
    [rho, region.x0, region.x1, region.y0, region.y1, samples, seed],
  );

  // The region's 1-D "shadows" onto each axis (marginal probabilities). For
  // independent assets P(both) = product of these; correlation breaks that.
  const marginalX = marginalXProbability(params, region.x0, region.x1);
  const marginalY = marginalYProbability(params, region.y0, region.y1);
  const productIfIndependent = marginalX * marginalY;

  // ---- SVG scales -----------------------------------------------------------
  const plotLeft = M.left;
  const plotRight = VIEW_W - M.right;
  const plotTop = M.top;
  const plotBottom = VIEW_H - M.bottom;
  const plotW = plotRight - plotLeft;
  const plotH = plotBottom - plotTop;

  const sx = (x: number): number =>
    plotLeft + ((x - domain.xMin) / (domain.xMax - domain.xMin)) * plotW;
  const sy = (y: number): number =>
    plotBottom - ((y - domain.yMin) / (domain.yMax - domain.yMin)) * plotH;

  const cellW = plotW / NX;
  const cellH = plotH / NY;

  const xTicks = [domain.xMin, SCENARIO.muX, domain.xMax];
  const yTicks = [domain.yMin, SCENARIO.muY, domain.yMax];

  const covariance = rho * SCENARIO.sigmaX * SCENARIO.sigmaY;

  return (
    <SimCard
      id={meta.id}
      title={meta.title}
      whatShows={meta.whatShows}
      topics={meta.topics}
      howToRead="The heatmap is the joint density f(x, y): brighter = more likely that pair of returns. The bright dashed box is your integration region. The DOUBLE INTEGRAL ∫∫ f dx dy over that box is the volume of the surface sitting above it, i.e. P(both returns land in the box). Drag the region edges and the probability updates live; hit 'Run again' to scatter correlated draws (green = inside the box) and watch the empirical fraction close in on that exact integral. Slide ρ toward +1 and the mass squeezes onto the diagonal (the two assets move together), so diagonal boxes get more probable while off-diagonal boxes get less."
    >
      <p className="text-sm text-secondary">
        A joint distribution describes two random quantities <em>at once</em>.
        Here <span className="text-accent">X</span> is an{" "}
        <span className="text-accent">index ETF</span>&apos;s daily return and{" "}
        <span className="text-accent-2">Y</span> is a correlated{" "}
        <span className="text-accent-2">tech stock</span>&apos;s daily return
        (both in %). The surface f(x, y) says how likely each <em>pair</em> of
        returns is; the total volume under it is 1. The{" "}
        <strong>double integral</strong> of f over a rectangle is the{" "}
        <strong>probability that both returns land inside that box on the same
        day</strong>: the joint-tail question you can&apos;t answer from either
        stock alone.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ---- Controls ---- */}
        <div className="space-y-4">
          <Slider
            label="Correlation ρ"
            value={rho}
            min={-0.95}
            max={0.95}
            step={0.01}
            onChange={setRho}
            display={fmt(rho)}
          />
          <p className="-mt-2 text-xs text-muted">
            ρ = 0 → independent (surface is an axis-aligned mound); ρ → ±1 →
            returns move together/opposite (mass tilts onto a diagonal ridge).
            Cov(X, Y) = ρ·σₓ·σᵧ ={" "}
            <span className="num text-primary">{fmt(covariance)}</span>.
          </p>

          <div className="panel-ruled space-y-3 p-4">
            <div className="label text-secondary">
              Integration region (the double-integral limits)
            </div>
            <Slider
              label="Index ETF (X) from"
              value={x0}
              min={domain.xMin}
              max={domain.xMax}
              step={0.05}
              onChange={setX0}
              display={`${fmt(x0)}%`}
            />
            <Slider
              label="Index ETF (X) to"
              value={x1}
              min={domain.xMin}
              max={domain.xMax}
              step={0.05}
              onChange={setX1}
              display={`${fmt(x1)}%`}
            />
            <Slider
              label="Tech stock (Y) from"
              value={y0}
              min={domain.yMin}
              max={domain.yMax}
              step={0.05}
              onChange={setY0}
              display={`${fmt(y0)}%`}
            />
            <Slider
              label="Tech stock (Y) to"
              value={y1}
              min={domain.yMin}
              max={domain.yMax}
              step={0.05}
              onChange={setY1}
              display={`${fmt(y1)}%`}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setX0(-1);
                setX1(2);
                setY0(-1.5);
                setY1(3);
              }}
            >
              Reset region
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                // "Both fall" box — lower-left quadrant tail.
                setX0(domain.xMin);
                setX1(0);
                setY0(domain.yMin);
                setY1(0);
              }}
            >
              Both down (joint tail)
            </button>
          </div>

          <Slider
            label="Monte-Carlo draws"
            value={samples}
            min={200}
            max={MAX_SAMPLES}
            step={200}
            onChange={(v) => setSamples(Math.round(v))}
            display={samples.toLocaleString()}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setSeed((s) => s + 1)}
          >
            Run again
          </button>
        </div>

        {/* ---- Heatmap + region + scatter ---- */}
        <div className="flex flex-col items-center">
          <svg
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            className="h-auto w-full max-w-md"
            role="img"
            aria-label="Bivariate-normal joint density heatmap with an adjustable rectangular integration region and Monte-Carlo scatter of correlated draws."
          >
            {/* Plot background */}
            <rect
              x={plotLeft}
              y={plotTop}
              width={plotW}
              height={plotH}
              className="fill-surface-muted stroke-border-strong"
              strokeWidth={1.5}
            />

            {/* Density heatmap — one cell per grid sample, opacity ∝ f. */}
            {grid.z.map((row, j) =>
              row.map((v, i) => {
                const opacity = grid.zMax > 0 ? (v / grid.zMax) * 0.92 : 0;
                if (opacity < 0.015) return null;
                return (
                  <rect
                    key={`c-${j}-${i}`}
                    x={sx(grid.xs[i]) - cellW / 2}
                    y={sy(grid.ys[j]) - cellH / 2}
                    width={cellW + 0.6}
                    height={cellH + 0.6}
                    className="fill-accent"
                    fillOpacity={opacity}
                  />
                );
              }),
            )}

            {/* Monte-Carlo draws: green inside the region, muted outside. */}
            {mc.points.map((p, i) => (
              <circle
                key={`p-${i}`}
                cx={sx(p.x)}
                cy={sy(p.y)}
                r={1.1}
                className={p.inside ? "fill-bull" : "fill-muted"}
                fillOpacity={p.inside ? 0.9 : 0.35}
              />
            ))}

            {/* Integration region rectangle (the double-integral limits). */}
            <rect
              x={sx(region.x0)}
              y={sy(region.y1)}
              width={Math.max(0, sx(region.x1) - sx(region.x0))}
              height={Math.max(0, sy(region.y0) - sy(region.y1))}
              className="fill-accent-2 stroke-accent-2"
              fillOpacity={0.12}
              strokeWidth={2}
              strokeDasharray="6 4"
            />

            {/* Mean crosshair (the mode of the surface). */}
            <line
              x1={sx(SCENARIO.muX)}
              y1={plotTop}
              x2={sx(SCENARIO.muX)}
              y2={plotBottom}
              className="stroke-subtle"
              strokeWidth={0.75}
              strokeDasharray="2 3"
            />
            <line
              x1={plotLeft}
              y1={sy(SCENARIO.muY)}
              x2={plotRight}
              y2={sy(SCENARIO.muY)}
              className="stroke-subtle"
              strokeWidth={0.75}
              strokeDasharray="2 3"
            />

            {/* Region label */}
            <text
              x={(sx(region.x0) + sx(region.x1)) / 2}
              y={sy(region.y1) - 4}
              textAnchor="middle"
              fontSize={10}
              className="fill-primary font-mono"
            >
              ∫∫ region = {pct(prob)}
            </text>

            {/* Axis ticks + labels */}
            {xTicks.map((t, i) => (
              <g key={`xt-${i}`}>
                <line
                  x1={sx(t)}
                  y1={plotBottom}
                  x2={sx(t)}
                  y2={plotBottom + 4}
                  className="stroke-subtle"
                  strokeWidth={1}
                />
                <text
                  x={sx(t)}
                  y={plotBottom + 15}
                  textAnchor="middle"
                  fontSize={10}
                  className="fill-muted font-mono"
                >
                  {fmt(t)}
                </text>
              </g>
            ))}
            {yTicks.map((t, i) => (
              <g key={`yt-${i}`}>
                <line
                  x1={plotLeft - 4}
                  y1={sy(t)}
                  x2={plotLeft}
                  y2={sy(t)}
                  className="stroke-subtle"
                  strokeWidth={1}
                />
                <text
                  x={plotLeft - 7}
                  y={sy(t)}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize={10}
                  className="fill-muted font-mono"
                >
                  {fmt(t)}
                </text>
              </g>
            ))}

            {/* Axis titles */}
            <text
              x={plotLeft + plotW / 2}
              y={VIEW_H - 6}
              textAnchor="middle"
              fontSize={11}
              className="fill-secondary font-mono"
            >
              X: index ETF return (%)
            </text>
            <text
              x={14}
              y={plotTop + plotH / 2}
              textAnchor="middle"
              fontSize={11}
              className="fill-secondary font-mono"
              transform={`rotate(-90 14 ${plotTop + plotH / 2})`}
            >
              Y: tech stock return (%)
            </text>
          </svg>
          <p className="mt-2 text-center text-xs text-muted">
            Brighter = denser (more likely). The dashed box is the region you
            integrate over; green dots are draws that landed inside it.
          </p>
        </div>
      </div>

      {/* ---- Readouts ---- */}
      <div className="panel-ruled grid grid-cols-2 gap-x-6 gap-y-2 p-4 sm:grid-cols-4">
        <div className="flex flex-col">
          <span className="label text-secondary">∫∫ f dx dy (exact)</span>
          <span className="num text-primary">{pct(prob)}</span>
          <span className="text-[10px] leading-tight text-muted">
            volume under the surface over the box
          </span>
        </div>
        <div className="flex flex-col">
          <span className="label text-secondary">Monte-Carlo estimate</span>
          <span className="num text-accent">{pct(mc.proportion)}</span>
          <span className="text-[10px] leading-tight text-muted">
            {mc.inside.toLocaleString()} of {mc.total.toLocaleString()} draws
            inside
          </span>
        </div>
        <div className="flex flex-col">
          <span className="label text-secondary">|MC − exact| error</span>
          <span className="num text-primary">
            {pct(Math.abs(mc.proportion - prob))}
          </span>
          <span className="text-[10px] leading-tight text-muted">
            shrinks as draws increase
          </span>
        </div>
        <div className="flex flex-col">
          <span className="label text-secondary">If independent</span>
          <span className="num text-primary">{pct(productIfIndependent)}</span>
          <span className="text-[10px] leading-tight text-muted">
            P(X∈box)·P(Y∈box) = {pct(marginalX)}·{pct(marginalY)}
          </span>
        </div>
      </div>

      <p className="text-xs leading-relaxed text-muted">
        The last cell shows why correlation matters: if the two returns were{" "}
        <em>independent</em>, the joint probability would just be the product of
        the two 1-D (marginal) probabilities. When ρ ≠ 0 the true double
        integral pulls <em>away</em> from that product, and that gap is exactly the
        joint-tail risk (or diversification benefit) that a single stock&apos;s
        distribution hides.
      </p>
    </SimCard>
  );
}

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  display: string;
}

function Slider(props: SliderProps): JSX.Element {
  const { label, value, min, max, step, onChange, display } = props;
  return (
    <label className="block space-y-1">
      <span className="label flex items-center justify-between text-secondary">
        <span>{label}</span>
        <span className="num text-primary">{display}</span>
      </span>
      <input
        type="range"
        className="w-full accent-accent"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
