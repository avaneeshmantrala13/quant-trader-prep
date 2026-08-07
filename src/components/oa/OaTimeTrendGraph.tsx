import type { OaAvgTimePoint } from "@/lib/oa/stats";
import type { OaFormatKind } from "@/lib/oa/types";

/**
 * OaTimeTrendGraph — a hand-rolled SVG line graph (no chart lib) mirroring the
 * `ReliabilityDiagram` aesthetic. Plots AVERAGE TIME PER QUESTION (y, seconds)
 * across timed sessions over time (x = session order, evenly spaced by index so
 * sparse/clustered timestamps still read cleanly). Each point carries the real
 * completion date in its `<title>` tooltip.
 *
 * Honest empty/low-n states: 0 points renders a "no timed sessions yet"
 * placeholder (never a fake axis), 1 point renders just the single dot (no line
 * you'd misread as a trend).
 */

const W = 360;
const H = 240;
const PAD = 34;

const secOf = (ms: number) => ms / 1000;
const fmtSec = (ms: number) => secOf(ms).toFixed(1);

/** Round a max up to a friendly axis top (…, 10, 20, 50, 100, 150 …). */
function niceMax(v: number): number {
  if (v <= 0) return 10;
  const steps = [10, 15, 20, 25, 30, 45, 60, 90, 120, 180, 240, 300];
  for (const s of steps) if (v <= s) return s;
  return Math.ceil(v / 60) * 60;
}

/** Short per-point kind tint (line stays accent; dots hint the format). */
function kindTint(kind: OaFormatKind): string {
  switch (kind) {
    case "sprint":
      return "rgb(var(--color-bear))";
    case "section":
      return "rgb(var(--color-gold))";
    default:
      return "rgb(var(--color-accent))";
  }
}

function fmtDate(at: number): string {
  const d = new Date(at);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function OaTimeTrendGraph({ points }: { points: OaAvgTimePoint[] }) {
  // Honest empty state — no fabricated axis for zero sessions.
  if (points.length === 0) {
    return (
      <div className="grid min-h-[180px] place-items-center border border-dashed border-subtle bg-surface-muted p-6 text-center">
        <div>
          <div className="label text-muted">Average time per question</div>
          <p className="mt-2 max-w-sm text-sm text-secondary">
            No timed sessions yet. Finish a timed section and your average time
            per question will start charting here.
          </p>
        </div>
      </div>
    );
  }

  const maxSec = niceMax(
    Math.max(...points.map((p) => secOf(p.avgMsPerQuestion))),
  );

  // Evenly space x by index so clustered/sparse timestamps still read well.
  const innerW = W - 2 * PAD;
  const innerH = H - 2 * PAD;
  const sx = (i: number) =>
    PAD + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const sy = (sec: number) => H - PAD - (sec / maxSec) * innerH;

  const coords = points.map((p, i) => ({
    x: sx(i),
    y: sy(secOf(p.avgMsPerQuestion)),
    p,
    i,
  }));

  // A few y gridline ticks for readability (0, mid, max).
  const yTicks = [0, maxSec / 2, maxSec];

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      className="w-full max-w-full"
      role="img"
      aria-label="Average time per question across timed sessions over time"
    >
      {/* Plot frame */}
      <rect
        x={PAD}
        y={PAD}
        width={innerW}
        height={innerH}
        fill="none"
        stroke="rgb(var(--color-border-strong))"
        strokeWidth={1}
      />

      {/* y gridlines + tick labels */}
      {yTicks.map((t, i) => (
        <g key={i}>
          <line
            x1={PAD}
            y1={sy(t)}
            x2={W - PAD}
            y2={sy(t)}
            stroke="rgb(var(--color-border-strong))"
            strokeDasharray="3 3"
            strokeWidth={1}
            opacity={t === 0 ? 0 : 0.5}
          />
          <text
            x={PAD - 6}
            y={sy(t) + 3}
            textAnchor="end"
            className="fill-current text-[9px] text-muted"
          >
            {t.toFixed(0)}s
          </text>
        </g>
      ))}

      {/* Trend line — only when there are ≥2 points (one dot isn't a trend) */}
      {coords.length > 1 && (
        <polyline
          points={coords.map((c) => `${c.x},${c.y}`).join(" ")}
          fill="none"
          stroke="rgb(var(--color-accent))"
          strokeWidth={2}
        />
      )}

      {/* Points */}
      {coords.map((c) => (
        <circle
          key={c.i}
          cx={c.x}
          cy={c.y}
          r={4}
          fill={kindTint(c.p.kind)}
          stroke="rgb(var(--color-surface))"
          strokeWidth={1}
        >
          <title>
            session {c.i + 1} · {fmtSec(c.p.avgMsPerQuestion)}s/q · {c.p.kind} ·{" "}
            {fmtDate(c.p.at)}
          </title>
        </circle>
      ))}

      {/* Axis labels */}
      <text
        x={W / 2}
        y={H - 6}
        textAnchor="middle"
        className="fill-current text-[9px] text-muted"
      >
        Sessions over time →
      </text>
      <text
        x={12}
        y={H / 2}
        textAnchor="middle"
        transform={`rotate(-90 12 ${H / 2})`}
        className="fill-current text-[9px] text-muted"
      >
        Avg s / question →
      </text>
    </svg>
  );
}
