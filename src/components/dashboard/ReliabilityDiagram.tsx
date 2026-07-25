import type { ReliabilityDiagramData } from "@/lib/calibration/reliability";

const SIZE = 240;
const PAD = 28;
const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Map a [0,1] probability to the SVG x / y (y inverted so 1.0 is at the top). */
const sx = (p: number) => PAD + p * (SIZE - 2 * PAD);
const sy = (p: number) => SIZE - PAD - p * (SIZE - 2 * PAD);

/**
 * Accuracy × calibration reliability diagram (PHASE_5 §5/§6; Murphy /
 * Dimitriadis-Gneiting-Jordan 2021). Hand-rolled SVG (no chart lib): predicted
 * confidence on x, observed accuracy on y, against the 45° "perfect
 * calibration" diagonal. Points above the line = under-confident; below =
 * over-confident. Renders an honest "insufficient data" state when no
 * (pred, outcome) pairs have been logged this session — it never fabricates.
 */
export function ReliabilityDiagram({
  data,
}: {
  data: ReliabilityDiagramData;
}) {
  if (data.count === 0) {
    return (
      <div className="grid min-h-[180px] place-items-center border border-dashed border-subtle bg-surface-muted p-6 text-center">
        <div>
          <div className="label text-muted">Reliability diagram</div>
          <p className="mt-2 max-w-xs text-sm text-secondary">
            Not enough data yet. As you answer graded items this session, we plot
            how often your ~80%-confidence answers are actually right.
          </p>
        </div>
      </div>
    );
  }

  // Net signed miscalibration → over/under-confidence annotation.
  const signed = data.bins.reduce(
    (s, b) => s + (b.count / data.count) * (b.predicted - b.observed),
    0,
  );
  const lean =
    Math.abs(signed) < 0.02
      ? "well-calibrated"
      : signed > 0
        ? "over-confident"
        : "under-confident";

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="shrink-0"
        role="img"
        aria-label="Reliability diagram: predicted confidence versus observed accuracy"
      >
        {/* Plot frame */}
        <rect
          x={PAD}
          y={PAD}
          width={SIZE - 2 * PAD}
          height={SIZE - 2 * PAD}
          fill="none"
          stroke="rgb(var(--color-border-strong))"
          strokeWidth={1}
        />
        {/* 45° perfect-calibration diagonal */}
        <line
          x1={sx(0)}
          y1={sy(0)}
          x2={sx(1)}
          y2={sy(1)}
          stroke="rgb(var(--color-border-strong))"
          strokeDasharray="3 3"
          strokeWidth={1}
        />
        {/* Learner curve */}
        <polyline
          points={data.bins.map((b) => `${sx(b.predicted)},${sy(b.observed)}`).join(" ")}
          fill="none"
          stroke="rgb(var(--color-accent))"
          strokeWidth={2}
        />
        {data.bins.map((b, i) => (
          <circle
            key={i}
            cx={sx(b.predicted)}
            cy={sy(b.observed)}
            r={3 + Math.min(b.count, 40) / 10}
            fill="rgb(var(--color-accent))"
          >
            <title>
              said {pct(b.predicted)} · right {pct(b.observed)} · n={b.count}
            </title>
          </circle>
        ))}
        {/* Axis labels */}
        <text x={SIZE / 2} y={SIZE - 6} textAnchor="middle" className="fill-current text-[9px] text-muted">
          Predicted confidence →
        </text>
        <text
          x={10}
          y={SIZE / 2}
          textAnchor="middle"
          transform={`rotate(-90 10 ${SIZE / 2})`}
          className="fill-current text-[9px] text-muted"
        >
          Observed accuracy →
        </text>
      </svg>

      <div className="min-w-0 space-y-2">
        {data.headline && (
          <p className="text-sm text-primary">
            When you say <span className="num font-semibold">~80%</span>, you're
            right{" "}
            <span className="num font-semibold text-accent">
              {pct(data.headline.observed)}
            </span>{" "}
            of the time{" "}
            <span className="text-muted">(n={data.headline.count})</span>.
          </p>
        )}
        <div className="flex flex-wrap gap-1.5">
          <span className="chip border-subtle text-secondary">
            Brier gap {data.relGap.toFixed(3)}
          </span>
          <span className="chip border-subtle text-secondary">
            Brier {data.brier.toFixed(3)}
          </span>
          <span
            className={`chip ${
              lean === "over-confident"
                ? "border-bear text-bear"
                : lean === "under-confident"
                  ? "border-accent text-accent"
                  : "border-bull text-bull"
            }`}
          >
            {lean}
          </span>
        </div>
        <p className="text-xs text-muted">
          Points below the dashed line = over-confident; above = under-confident.
        </p>
      </div>
    </div>
  );
}
