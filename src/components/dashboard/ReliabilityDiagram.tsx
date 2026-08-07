import {
  ELICITED_ACTIVITIES_SENTENCE,
  elicitedPairsNeeded,
  type ReliabilityDiagramData,
} from "@/lib/calibration/reliability";

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
  // Sufficiency gate (WS-CAL): never show a statistic from a near-empty sample.
  // Below MIN_PAIRS we render an encouraging progress state instead of numbers —
  // this is what eliminates the misleading "n=1" panel.
  if (!data.sufficient) {
    const needed = elicitedPairsNeeded(data.count, data.minPairs);
    return (
      <div className="grid min-h-[180px] place-items-center border border-dashed border-subtle bg-surface-muted p-6 text-center">
        <div>
          <div className="label text-muted">Reliability diagram</div>
          <p className="mt-2 max-w-sm text-sm text-secondary">
            This graph needs data points where you actually STATE a confidence.
            Only two activities produce one: {ELICITED_ACTIVITIES_SENTENCE}.
            Normal lessons and quizzes don't count toward it.
          </p>
          <p className="mt-2 num text-xs text-muted">
            You're at {data.count}/{data.minPairs} —{" "}
            <span className="font-semibold text-primary">
              {needed} more
            </span>{" "}
            of those to unlock the graph.
          </p>
          <div className="mx-auto mt-2 h-1.5 w-48 max-w-full border border-subtle bg-surface">
            <div
              className="h-full bg-accent transition-all"
              style={{
                width: `${Math.min(100, (data.count / data.minPairs) * 100)}%`,
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  // ONE signed calibration read → the headline framing, the chip, and the
  // caption all derive from the SAME sign, so they can never contradict.
  const cal = data.calibration;
  const leanLabel =
    cal?.lean === "over"
      ? "over-confident"
      : cal?.lean === "under"
        ? "under-confident"
        : "well-calibrated";

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
        {/* Primary read: one plain-language sentence (derived from the signed gap). */}
        {cal && <p className="text-sm text-primary">{cal.label}</p>}

        {/* Provenance: names the drills that actually elicited a confidence, so
            the panel never implies ordinary answering measured confidence. */}
        {data.sourceNote && (
          <p className="text-xs text-muted">{data.sourceNote}</p>
        )}

        {data.headline && (
          <p className="text-sm text-secondary">
            When you say <span className="num font-semibold">~80%</span>, you're
            right{" "}
            <span className="num font-semibold text-accent">
              {pct(data.headline.observed)}
            </span>{" "}
            of the time{" "}
            <span className="text-muted">(n={data.headline.count})</span>.
          </p>
        )}

        <div>
          <span
            className={`chip ${
              leanLabel === "over-confident"
                ? "border-bear text-bear"
                : leanLabel === "under-confident"
                  ? "border-accent text-accent"
                  : "border-bull text-bull"
            }`}
          >
            {leanLabel}
          </span>
        </div>

        {/* Caption reconciled with the chip's sign (geometry: over-confident =
            confidence > accuracy = points BELOW the diagonal). */}
        <p className="text-xs text-muted">
          {leanLabel === "under-confident"
            ? "Your points sit above the diagonal: you're more accurate than you feel."
            : leanLabel === "over-confident"
              ? "Your points sit below the diagonal: you're less accurate than you feel."
              : "Your points hug the diagonal: confidence ≈ accuracy."}
        </p>

        {/* Jargon on demand: raw Brier / reliability-gap / counts behind a details accordion. */}
        <details className="group">
          <summary className="label cursor-pointer list-none text-muted hover:text-secondary">
            Advanced details ▾
          </summary>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="chip border-subtle text-secondary">
              Brier gap {data.relGap.toFixed(3)}
            </span>
            <span className="chip border-subtle text-secondary">
              Brier {data.brier.toFixed(3)}
            </span>
            <span className="chip border-subtle text-secondary">
              {data.count} pairs
            </span>
          </div>
        </details>
      </div>
    </div>
  );
}
