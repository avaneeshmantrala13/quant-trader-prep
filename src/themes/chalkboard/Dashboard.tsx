import { Link } from "react-router-dom";
import type { CSSProperties } from "react";
import { MASTERY_BAR } from "@/lib/mastery/config";
import {
  ELICITED_ACTIVITIES_SENTENCE,
  elicitedPairsNeeded,
} from "@/lib/calibration/reliability";
import type { MasteryState } from "@/lib/mastery/verdict";
import { CourseReadinessCards } from "@/components/dashboard/CourseReadinessCards";
import type {
  DashboardTopicEntry,
  DashboardViewProps,
} from "../types";

/**
 * CHALKBOARD — Mastery Dashboard (`/dashboard`).
 *
 * A hand-written PROGRESS REPORT chalked onto the classroom board: the whole
 * page is framed as a wooden-edged slate with a chalk tray, and every section
 * is a "grade report / lesson plan" block written in the theme's handwriting
 * fonts. Mastery reads as a chalk GAUGE (a hand-drawn ruler with a hatched 95%
 * credible-interval band, a chalk mean pin, and a dashed "80% pass" marker);
 * the STRONG / WEAK / UNCERTAIN verdict is a distinct chalk grade-mark (green ✓,
 * red ✗, yellow ? — UNCERTAIN is first-class, never rounded); misconceptions are
 * friendly chalk margin-notes; and the calibration reliability diagram is a
 * chalk-drawn plot with an honest "not enough data" board when empty.
 *
 * PURE PRESENTATIONAL: the page owns ALL data + routes. This component never
 * fetches, computes a verdict, or builds a route — it only links via each
 * entry's own `href`. Everything is token-driven (chalk-white on slate in dark,
 * ink on ruled paper in light), WCAG-AA, responsive 360px → ≥1280px, with a
 * reduced-motion-safe chalk-draw-on for underlines, checks, and the plot curve.
 */

const INK = "rgb(var(--color-border-strong))";
const ACC = "rgb(var(--color-accent))";
const BULL = "rgb(var(--color-bull))";
const BEAR = "rgb(var(--color-bear))";
const MUTED = "rgb(var(--color-text-muted))";

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Build an `rgb(var(--token) / alpha)` string from a CSS variable name. */
const rgba = (varName: string, a: number) => `rgb(var(${varName}) / ${a})`;

/** Verdict → chalk colour (STRONG green · WEAK red · UNCERTAIN yellow chalk). */
const VERDICT_COLOR: Record<MasteryState, string> = {
  STRONG: BULL,
  WEAK: BEAR,
  UNCERTAIN: ACC,
};
/** Verdict → the CSS colour variable driving band fills / pins. */
const VERDICT_VAR: Record<MasteryState, string> = {
  STRONG: "--color-bull",
  WEAK: "--color-bear",
  UNCERTAIN: "--color-accent",
};
/**
 * Verdict → LITERAL Tailwind classes (kept as full strings so the JIT compiler
 * detects them — never build these names dynamically).
 */
const VERDICT_CHIP: Record<MasteryState, string> = {
  STRONG: "border-bull/70 text-bull",
  WEAK: "border-bear/70 text-bear",
  UNCERTAIN: "border-accent/70 text-accent",
};
const VERDICT_LABEL: Record<MasteryState, string> = {
  STRONG: "Strong",
  WEAK: "Weak",
  UNCERTAIN: "Uncertain",
};

/* -------------------------------------------------------------------------- */
/*  Chalk-draw animation (reduced-motion gated, injected once)                 */
/* -------------------------------------------------------------------------- */

const ANIM_CSS = `
@keyframes cbd-draw{from{stroke-dashoffset:var(--d,240)}to{stroke-dashoffset:0}}
.cbd-draw{stroke-dasharray:var(--d,240);stroke-dashoffset:0;animation:cbd-draw var(--t,1.3s) ease-out both}
@media (prefers-reduced-motion: reduce){.cbd-draw{animation:none}}
`;

function ChalkDashAnimations() {
  return <style dangerouslySetInnerHTML={{ __html: ANIM_CSS }} />;
}

const drawVars = (d: number, t: string, delay = 0): CSSProperties =>
  ({
    ["--d" as string]: d,
    ["--t" as string]: t,
    animationDelay: `${delay}s`,
  }) as CSSProperties;

/* -------------------------------------------------------------------------- */
/*  Chalk primitives                                                           */
/* -------------------------------------------------------------------------- */

/** A wobbly hand-drawn chalk underline that draws itself on. */
function ChalkUnderline({
  className,
  color = ACC,
  delay = 0,
}: {
  className?: string;
  color?: string;
  delay?: number;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 200 12"
      fill="none"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        className="cbd-draw"
        style={drawVars(220, "1.1s", delay)}
        d="M3 7 q 48 5 98 1.5 t 96 -1"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M6 10 q 56 3 104 0.5"
        stroke={color}
        strokeOpacity={0.4}
        strokeWidth={1}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/**
 * A board panel — the recurring "chalked block on slate" container: a
 * hand-ruled frame with a faint composition grid behind it.
 */
function BoardPanel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`relative overflow-hidden rounded-lg border-2 border-border-strong/30 bg-surface ${className ?? ""}`}
    >
      <div
        className="tex-grid pointer-events-none absolute inset-0 opacity-[0.1] dark:opacity-[0.07]"
        aria-hidden="true"
      />
      <div className="relative">{children}</div>
    </section>
  );
}

/** An underlined chalk section heading with a small-caps eyebrow. */
function SectionHead({
  eyebrow,
  title,
  aside,
  underlineWidth = "w-40",
}: {
  eyebrow: string;
  title: string;
  aside?: React.ReactNode;
  underlineWidth?: string;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <span className="label text-accent">{eyebrow}</span>
        <h2 className="mt-0.5 font-display text-2xl font-black leading-tight text-primary sm:text-[26px]">
          {title}
        </h2>
        <ChalkUnderline
          className={`mt-0.5 h-2.5 max-w-[80%] ${underlineWidth}`}
          delay={0.1}
        />
      </div>
      {aside && <div className="shrink-0 text-right">{aside}</div>}
    </div>
  );
}

/**
 * The STRONG / WEAK / UNCERTAIN grade-mark. Each verdict is chalked distinctly
 * inside a hand-drawn box — UNCERTAIN is first-class with its own yellow "?"
 * glyph and is never collapsed into STRONG or WEAK.
 */
function VerdictMark({ state }: { state: MasteryState }) {
  const color = VERDICT_COLOR[state];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 ${VERDICT_CHIP[state]}`}
      title={`${VERDICT_LABEL[state]}: calibration-aware verdict`}
    >
      <svg width={22} height={22} viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <path
          d="M3 3 L18.5 2 L19.5 18.5 L2.5 19.5 Z"
          stroke={color}
          strokeOpacity={0.85}
          strokeWidth={1.6}
          strokeLinejoin="round"
        />
        {state === "STRONG" && (
          <path
            className="cbd-draw"
            style={drawVars(40, "0.6s")}
            d="M6 11 L10 15.5 L16.5 6"
            stroke={color}
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {state === "WEAK" && (
          <path
            className="cbd-draw"
            style={drawVars(48, "0.6s")}
            d="M6.5 6.5 L15.5 15.5 M15.5 6.5 L6.5 15.5"
            stroke={color}
            strokeWidth={2.4}
            strokeLinecap="round"
          />
        )}
        {state === "UNCERTAIN" && (
          <text
            x={11}
            y={16}
            textAnchor="middle"
            fontFamily="var(--font-display)"
            fontSize={16}
            fontWeight={700}
            fill={color}
          >
            ?
          </text>
        )}
      </svg>
      <span className="font-display text-base font-bold leading-none">
        {VERDICT_LABEL[state]}
      </span>
    </span>
  );
}

/**
 * Mastery as a chalk GAUGE: a hand-drawn ruler [0–100%] with a hatched 95%
 * credible-interval band, a chalk mean "pin", and a dashed 0.80 "pass" marker.
 * The band is tinted by the verdict so the grade reads at a glance. When there
 * is no evidence yet the track shows a faint "no marks yet" note (never a curve).
 */
function ChalkGauge({ topic }: { topic: DashboardTopicEntry }) {
  const { hasEvidence, mean, ciLow, ciHigh, verdict } = topic;
  const bandVar = VERDICT_VAR[verdict];
  const bandColor = `rgb(var(${bandVar}))`;
  const widthPct = Math.max((ciHigh - ciLow) * 100, 1.5);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="label text-secondary">Mastery</span>
        <span className="num text-sm text-primary">
          {hasEvidence ? pct(mean) : "—"}
          {hasEvidence && (
            <span className="ml-1 text-xs text-muted">
              (95% CI {pct(ciLow)}–{pct(ciHigh)})
            </span>
          )}
        </span>
      </div>

      <div
        className="relative mt-2 h-9"
        role="img"
        aria-label={
          hasEvidence
            ? `Mastery ${pct(mean)}, 95% credible interval ${pct(ciLow)} to ${pct(
                ciHigh,
              )}, pass mark at ${pct(MASTERY_BAR)}. Verdict ${VERDICT_LABEL[verdict]}.`
            : `No graded evidence yet. Pass mark at ${pct(MASTERY_BAR)}.`
        }
      >
        {/* Hand-drawn chalk ruler baseline + end caps + midpoint tick. */}
        <svg
          className="absolute inset-x-0 top-1/2 h-4 w-full -translate-y-1/2"
          viewBox="0 0 200 16"
          preserveAspectRatio="none"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M2 9 q 50 3 99 1 t 97 -1"
            stroke={INK}
            strokeOpacity={0.6}
            strokeWidth={1.4}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M2 3.5 V14.5 M199 3.5 V14.5 M100.5 5 V13"
            stroke={INK}
            strokeOpacity={0.4}
            strokeWidth={1}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* 95% CI band — a chalk-hatched region across the interval. */}
        {hasEvidence && (
          <div
            className="absolute top-1/2 h-4 -translate-y-1/2 rounded-full"
            style={{
              left: `${ciLow * 100}%`,
              width: `${widthPct}%`,
              background: rgba(bandVar, 0.22),
              boxShadow: `inset 0 0 0 1.5px ${rgba(bandVar, 0.7)}`,
            }}
          >
            <div
              className="absolute inset-0 rounded-full opacity-50"
              style={{
                backgroundImage: `repeating-linear-gradient(-45deg, ${rgba(
                  bandVar,
                  0.5,
                )} 0 1px, transparent 1px 5px)`,
              }}
            />
          </div>
        )}

        {/* Mean "pin" — a chalk vertical stroke topped with a filled dot. */}
        {hasEvidence && (
          <div
            className="absolute top-0 bottom-0 w-0.5"
            style={{
              left: `calc(${mean * 100}% - 1px)`,
              background: bandColor,
            }}
          >
            <span
              className="absolute -top-0.5 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full"
              style={{ background: bandColor }}
            />
          </div>
        )}

        {/* 0.80 pass marker — a dashed chalk line + a little pennant flag. */}
        <div
          className="absolute -top-0.5 bottom-0"
          style={{ left: `${MASTERY_BAR * 100}%` }}
        >
          <div
            className="h-full w-px"
            style={{
              backgroundImage: `repeating-linear-gradient(to bottom, ${INK} 0 3px, transparent 3px 6px)`,
              opacity: 0.75,
            }}
          />
          <svg
            width={16}
            height={11}
            viewBox="0 0 16 11"
            className="absolute -top-2 left-0"
            aria-hidden="true"
          >
            <path
              d="M1 1 L13 1 L9.5 4 L13 7 L1 7 Z"
              fill={ACC}
              fillOpacity={0.85}
              stroke={ACC}
              strokeWidth={0.8}
            />
          </svg>
        </div>

        {!hasEvidence && (
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-display text-sm italic text-muted">
            no marks yet
          </span>
        )}
      </div>

      <div className="mt-1.5 flex items-center justify-between font-mono text-[10px] text-muted">
        <span>0%</span>
        <span className="text-accent">↑ 80% pass</span>
        <span>100%</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Per-topic report card                                                       */
/* -------------------------------------------------------------------------- */

function TopicReportCard({ topic }: { topic: DashboardTopicEntry }) {
  return (
    <article className="relative flex flex-col gap-3 overflow-hidden rounded-lg border-2 border-border-strong/25 bg-surface p-4">
      <div
        className="tex-grid pointer-events-none absolute inset-0 opacity-[0.08] dark:opacity-[0.06]"
        aria-hidden="true"
      />
      <header className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="label text-muted">{topic.trackTitle}</div>
          <h3 className="font-display text-lg font-bold leading-tight text-primary">
            {topic.name}
          </h3>
        </div>
        <div className="shrink-0">
          <VerdictMark state={topic.verdict} />
        </div>
      </header>

      <div className="relative">
        <ChalkGauge topic={topic} />
      </div>

      <div className="relative flex flex-wrap items-center gap-1.5">
        <span
          className="chip border-border-strong/40 text-secondary"
          title="Elo skill (logit scale)"
        >
          θ {topic.theta.toFixed(2)}
        </span>
        <span className="chip border-border-strong/40 text-muted">
          {topic.gradedCount} graded
        </span>
        {topic.reviewDue && (
          <span className="chip border-accent text-accent" title="Spaced review due">
            ⟳ review due
          </span>
        )}
      </div>

      {topic.misconceptions.length > 0 && (
        <div className="relative">
          <div className="label text-bear">Where you slip up</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {topic.misconceptions.map((m) => (
              <span
                key={m.key}
                className="chip border-bear/60 font-sans !text-[11px] !normal-case !tracking-normal text-bear"
              >
                {m.label}
              </span>
            ))}
          </div>
        </div>
      )}

      <Link
        to={topic.href}
        className="btn-secondary relative mt-auto w-full text-center text-sm"
      >
        Practice this ▸
      </Link>
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/*  Weakness ranking (chalk grade list)                                         */
/* -------------------------------------------------------------------------- */

function WeaknessRanking({ topics }: { topics: DashboardTopicEntry[] }) {
  if (topics.length === 0) {
    return (
      <p className="font-sans text-sm text-secondary">
        No graded evidence yet. Work a few problems (or run the warm-up) and
        your weakest spots will be chalked up here, worst-most-certain first.
      </p>
    );
  }
  return (
    <ol className="space-y-1.5">
      {topics.map((t, i) => (
        <li key={t.topicKey}>
          <Link
            to={t.href}
            className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:outline-none"
          >
            <span className="font-display text-2xl font-bold leading-none text-muted">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-display text-lg font-bold leading-tight text-primary">
                  {t.name}
                </span>
                {t.reviewDue && (
                  <span className="shrink-0 font-display text-sm text-accent">
                    ⟳ due
                  </span>
                )}
              </div>
              <div className="label text-muted">{t.trackTitle}</div>
            </div>
            {/* A tiny chalk confidence bar (CI band lower→upper). */}
            <div className="hidden w-28 shrink-0 sm:block">
              <MiniCI low={t.ciLow} high={t.ciHigh} state={t.verdict} />
            </div>
            <div className="shrink-0 text-right">
              <div className="num text-sm font-semibold text-primary">
                {pct(t.ciLow)}
              </div>
              <div className="label text-muted">CI low</div>
            </div>
          </Link>
        </li>
      ))}
    </ol>
  );
}

/** A compact chalk credible-interval strip used in the weakness ranking. */
function MiniCI({
  low,
  high,
  state,
}: {
  low: number;
  high: number;
  state: MasteryState;
}) {
  const bandVar = VERDICT_VAR[state];
  return (
    <div className="relative h-2.5">
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border-strong/40" />
      <div
        className="absolute top-1/2 h-2.5 -translate-y-1/2 rounded-full"
        style={{
          left: `${low * 100}%`,
          width: `${Math.max((high - low) * 100, 2)}%`,
          background: rgba(bandVar, 0.3),
          boxShadow: `inset 0 0 0 1px ${rgba(bandVar, 0.65)}`,
        }}
      />
      <div
        className="absolute top-1/2 h-3.5 w-px -translate-y-1/2"
        style={{
          left: `${MASTERY_BAR * 100}%`,
          backgroundImage: `repeating-linear-gradient(to bottom, ${INK} 0 2px, transparent 2px 4px)`,
          opacity: 0.7,
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Reviews due (chalk reminders)                                               */
/* -------------------------------------------------------------------------- */

function ReviewsDueList({ topics }: { topics: DashboardTopicEntry[] }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {topics.map((t) => (
        <li key={t.topicKey}>
          <Link
            to={t.href}
            className="flex items-center justify-between gap-3 rounded-md border border-accent/60 bg-surface px-3 py-2.5 transition-colors hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:outline-none"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="font-display text-xl leading-none text-accent"
                aria-hidden="true"
              >
                ⟳
              </span>
              <div className="min-w-0">
                <div className="truncate font-display text-base font-bold leading-tight text-primary">
                  {t.name}
                </div>
                <div className="label text-muted">{t.trackTitle}</div>
              </div>
            </div>
            <span className="shrink-0 font-display text-base font-semibold text-accent">
              review →
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */
/*  Reliability diagram (chalk-drawn calibration plot)                          */
/* -------------------------------------------------------------------------- */

const PLOT = 260;
const PAD = 34;
const px = (p: number) => PAD + p * (PLOT - 2 * PAD);
const py = (p: number) => PLOT - PAD - p * (PLOT - 2 * PAD);

function ReliabilityChalkPlot({
  data,
}: {
  data: DashboardViewProps["reliability"];
}) {
  if (!data.sufficient) {
    const progress = Math.min(100, (data.count / data.minPairs) * 100);
    return (
      <div className="grid min-h-[200px] place-items-center rounded-md border-2 border-dashed border-border-strong/35 bg-surface-muted/40 p-6 text-center">
        <div className="max-w-sm">
          <div
            className="mx-auto mb-3 font-display text-4xl text-accent"
            aria-hidden="true"
          >
            ✎
          </div>
          <div className="label text-muted">Reliability diagram</div>
          <p className="mt-2 font-sans text-sm leading-relaxed text-secondary">
            This diagram only records work where you STATE a confidence. Just two
            do that: {ELICITED_ACTIVITIES_SENTENCE}. Regular lessons and quizzes
            don't count toward it.
          </p>
          <p className="mt-3 font-display text-base font-bold text-primary">
            You're at {data.count}/{data.minPairs} —{" "}
            {elicitedPairsNeeded(data.count, data.minPairs)} more of those to go.
          </p>
          <div className="mx-auto mt-2 h-2.5 w-full max-w-[15rem] overflow-hidden rounded-full border border-border-strong/40 bg-surface">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  const cal = data.calibration;
  const leanText =
    cal?.lean === "over"
      ? "over-confident"
      : cal?.lean === "under"
        ? "under-confident"
        : "well-calibrated";
  const leanChip =
    cal?.lean === "over"
      ? "border-bear text-bear"
      : cal?.lean === "under"
        ? "border-accent text-accent"
        : "border-bull text-bull";
  const caption =
    cal?.lean === "under"
      ? "Dots above the dashed line = under-confident; below = over-confident."
      : cal?.lean === "well"
        ? "Dots hugging the dashed line = well-calibrated; below = over-confident, above = under-confident."
        : "Dots below the dashed line = over-confident; above = under-confident.";

  const curve = data.bins
    .map((b) => `${px(b.predicted)},${py(b.observed)}`)
    .join(" ");
  const curveLen = Math.max(data.bins.length * 60, 120);

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="relative mx-auto shrink-0 rounded-md border border-border-strong/30 bg-surface-muted/40 p-1">
        <svg
          width={PLOT}
          height={PLOT}
          viewBox={`0 0 ${PLOT} ${PLOT}`}
          className="block max-w-full"
          role="img"
          aria-label="Reliability diagram: predicted confidence versus observed accuracy, chalk-drawn."
        >
          {/* Target band around the 80% pass confidence. */}
          <rect
            x={px(0.75)}
            y={py(1)}
            width={px(0.85) - px(0.75)}
            height={py(0) - py(1)}
            fill={ACC}
            fillOpacity={0.1}
          />
          {/* Hand-drawn plot frame. */}
          <path
            d={`M${PAD} ${PAD} L${PLOT - PAD} ${PAD + 1} L${PLOT - PAD - 1} ${
              PLOT - PAD
            } L${PAD} ${PLOT - PAD - 1} Z`}
            fill="none"
            stroke={INK}
            strokeOpacity={0.55}
            strokeWidth={1.4}
            strokeLinejoin="round"
          />
          {/* 45° perfect-calibration diagonal (dashed chalk). */}
          <line
            x1={px(0)}
            y1={py(0)}
            x2={px(1)}
            y2={py(1)}
            stroke={INK}
            strokeOpacity={0.5}
            strokeDasharray="4 4"
            strokeWidth={1.2}
          />
          <text
            x={px(1) - 4}
            y={py(1) + 14}
            textAnchor="end"
            fontFamily="var(--font-display)"
            fontSize={11}
            fill={INK}
            fillOpacity={0.55}
          >
            perfect
          </text>
          {/* Learner curve — draws itself on. */}
          <polyline
            className="cbd-draw"
            style={drawVars(curveLen, "1.5s", 0.2)}
            points={curve}
            fill="none"
            stroke={ACC}
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {data.bins.map((b, i) => (
            <circle
              key={i}
              cx={px(b.predicted)}
              cy={py(b.observed)}
              r={3 + Math.min(b.count, 40) / 10}
              fill={ACC}
              fillOpacity={0.9}
              stroke={INK}
              strokeOpacity={0.4}
              strokeWidth={0.8}
            >
              <title>
                said {pct(b.predicted)} · right {pct(b.observed)} · n={b.count}
              </title>
            </circle>
          ))}
          {/* Axis labels in the handwriting font. */}
          <text
            x={PLOT / 2}
            y={PLOT - 8}
            textAnchor="middle"
            fontFamily="var(--font-display)"
            fontSize={12}
            fill={MUTED}
          >
            predicted confidence →
          </text>
          <text
            x={13}
            y={PLOT / 2}
            textAnchor="middle"
            transform={`rotate(-90 13 ${PLOT / 2})`}
            fontFamily="var(--font-display)"
            fontSize={12}
            fill={MUTED}
          >
            observed accuracy →
          </text>
        </svg>
      </div>

      <div className="min-w-0 space-y-3">
        {data.headline && (
          <p className="font-sans text-[15px] leading-relaxed text-primary">
            When you say{" "}
            <span className="num font-semibold text-accent">~80%</span>, you're
            actually right{" "}
            <span className="num text-lg font-bold text-accent">
              {pct(data.headline.observed)}
            </span>{" "}
            of the time{" "}
            <span className="text-muted">(n = {data.headline.count})</span>.
          </p>
        )}
        {data.sourceNote && (
          <p className="font-sans text-xs leading-relaxed text-muted">
            {data.sourceNote}
          </p>
        )}
        {cal && (
          <p className="font-sans text-[15px] font-semibold leading-relaxed text-primary">
            {cal.label}
          </p>
        )}
        <div className="flex flex-wrap gap-1.5">
          <span className={`chip ${leanChip}`}>{leanText}</span>
        </div>
        <p className="font-sans text-xs leading-relaxed text-muted">
          {caption} The shaded stripe marks your 80% "pass" band.
        </p>
        <details className="group">
          <summary className="label cursor-pointer text-muted transition-colors hover:text-secondary">
            Advanced details
          </summary>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="chip border-border-strong/40 text-secondary">
              Brier gap {data.relGap.toFixed(3)}
            </span>
            <span className="chip border-border-strong/40 text-secondary">
              Brier {data.brier.toFixed(3)}
            </span>
          </div>
        </details>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Root                                                                        */
/* -------------------------------------------------------------------------- */

export function ChalkboardDashboard({
  goalMode,
  courses,
  diagnosticDone,
  diagnosticHref,
  contentsHref,
  recommended,
  topics,
  weaknesses,
  due,
  reliability,
}: DashboardViewProps) {
  const courseMode = goalMode === "course";
  return (
    <div className="relative min-h-[100dvh]">
      <ChalkDashAnimations />

      {/* Sticky board rail — back-to-contents + warm-up, chalk-styled. */}
      <header className="sticky top-0 z-20 border-b-2 border-border-strong/30 bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5">
          <Link
            to={contentsHref}
            className="btn-ghost !min-h-0 !px-2.5 !py-1.5 font-display !text-base !normal-case !tracking-normal"
            aria-label="Back to the course outline"
          >
            ← outline
          </Link>
          <div className="min-w-0 flex-1 text-center">
            <span className="font-display text-lg font-bold text-primary">
              Progress Report
            </span>
          </div>
          <Link
            to={diagnosticHref}
            className="btn-ghost !min-h-0 shrink-0 !px-2.5 !py-1.5 font-display !text-base !normal-case !tracking-normal"
          >
            {diagnosticDone ? "retake warm-up ↻" : "run warm-up ▸"}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 pb-12">
        {/* 1) The report-card headline: focus + reviews-due + diagnostic nudge. */}
        <BoardPanel className="p-5 sm:p-7">
          {/* corner scribble motif */}
          <span
            className="pointer-events-none absolute right-4 top-3 hidden font-display text-2xl sm:block sm:text-3xl"
            style={{ color: ACC, opacity: 0.5 }}
            aria-hidden="true"
          >
            A+ ?
          </span>
          <span className="label text-accent">Report Card · Read-Only</span>
          <h1 className="mt-1 font-display text-4xl font-black leading-none text-primary sm:text-5xl">
            Mastery &amp; Calibration
          </h1>
          <ChalkUnderline className="mt-1 h-3 w-80 max-w-[85%]" />
          <p className="mt-3 max-w-2xl font-sans text-[15px] leading-relaxed text-secondary">
            Your hand-graded progress across the syllabus: where the chalk marks
            are confident, where they're shaky, and what to practice next.
          </p>

          {!diagnosticDone && (
            <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border-2 border-dashed border-accent/60 bg-surface px-3 py-2.5">
              <span className="font-display text-lg text-accent" aria-hidden="true">
                ✎
              </span>
              <p className="font-sans text-sm text-secondary">
                <span className="font-semibold text-primary">
                  Teacher's note:
                </span>{" "}
                you haven't run the calibration warm-up yet; it tunes where your
                practice starts.{" "}
                <Link
                  to={diagnosticHref}
                  className="font-display text-base font-bold text-accent underline decoration-2 underline-offset-2"
                >
                  Run it now ▸
                </Link>
              </p>
            </div>
          )}

          <div className="mt-5 grid gap-4 sm:grid-cols-5">
            {/* Recommended next focus — a red-pen margin note. */}
            <div className="relative rounded-md border-2 border-border-strong/25 bg-surface-muted/40 p-4 sm:col-span-3">
              <div className="label text-secondary">Recommended next focus</div>
              {recommended ? (
                <>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span
                      className="font-display text-xl text-accent"
                      aria-hidden="true"
                    >
                      ▸
                    </span>
                    <span className="font-display text-2xl font-black leading-tight text-primary">
                      {recommended.name}
                    </span>
                  </div>
                  <div className="label mt-0.5 text-muted">
                    {recommended.trackTitle} · CI low{" "}
                    {pct(recommended.ciLow)}
                  </div>
                  <Link
                    to={recommended.href}
                    className="btn-primary mt-3 block w-full text-center font-display !text-base !normal-case !tracking-normal"
                  >
                    Practice {recommended.name} ▸
                  </Link>
                </>
              ) : (
                <p className="mt-1 font-sans text-sm leading-relaxed text-secondary">
                  No clear weak spot yet. Pick a fresh topic to explore, or run
                  the warm-up to seed your starting point.
                </p>
              )}
            </div>

            {/* Reviews-due tally — a chalk count. */}
            <div className="relative flex flex-col rounded-md border-2 border-border-strong/25 bg-surface-muted/40 p-4 sm:col-span-2">
              <div className="label text-secondary">Reviews due</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="num text-5xl font-bold leading-none text-primary">
                  {due.length}
                </span>
                <ChalkTally count={due.length} />
              </div>
              <p className="mt-2 font-sans text-xs leading-relaxed text-muted">
                Mastered topics resurface on their SM-2 spaced-review schedule.
              </p>
            </div>
          </div>
        </BoardPanel>

        {/* 2) Reviews due. */}
        {due.length > 0 && (
          <BoardPanel className="p-5 sm:p-6">
            <SectionHead
              eyebrow="Bring these back up"
              title="Due for Review"
              underlineWidth="w-36"
            />
            <ReviewsDueList topics={due} />
          </BoardPanel>
        )}

        {/* 3) Course readiness (Case A) or weakness ranking (Case B). */}
        {courseMode ? (
          <BoardPanel className="p-5 sm:p-6">
            <SectionHead
              eyebrow="How close each course is"
              title="Course Readiness"
              underlineWidth="w-44"
            />
            <CourseReadinessCards courses={courses} />
          </BoardPanel>
        ) : (
          <BoardPanel className="p-5 sm:p-6">
            <SectionHead
              eyebrow="Weakest first · by CI low"
              title="Shore These Up"
              underlineWidth="w-36"
              aside={
                <span className="label text-muted">
                  {weaknesses.length} with evidence
                </span>
              }
            />
            <WeaknessRanking topics={weaknesses} />
          </BoardPanel>
        )}

        {/* 4) Calibration reliability diagram. */}
        <BoardPanel className="p-5 sm:p-6">
          <SectionHead
            eyebrow="Calibration · reliability"
            title="Confidence, Graded"
            underlineWidth="w-44"
          />
          <ReliabilityChalkPlot data={reliability} />
        </BoardPanel>

        {/* 5) Per-topic report cards. */}
        <section>
          <SectionHead
            eyebrow="Every topic · full marks sheet"
            title="Topic Report Cards"
            underlineWidth="w-48"
          />
          {topics.length === 0 ? (
            <p className="font-sans text-sm text-secondary">
              No topics available.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {topics.map((t) => (
                <TopicReportCard key={t.topicKey} topic={t} />
              ))}
            </div>
          )}
        </section>

        {/* Footer: diagnostic nudge + back-to-contents, over a chalk tray. */}
        <BoardPanel className="p-5 sm:p-6">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <p className="max-w-md font-sans text-sm leading-relaxed text-secondary">
              {diagnosticDone
                ? "Confidence drifting? Re-run the calibration warm-up any time to re-tune where practice begins."
                : "Run the calibration warm-up to tune where your practice starts; it only takes a few minutes."}
            </p>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Link
                to={diagnosticHref}
                className="btn-secondary font-display !text-base !normal-case !tracking-normal"
              >
                {diagnosticDone ? "Retake warm-up ↻" : "Run warm-up ▸"}
              </Link>
              <Link
                to={contentsHref}
                className="btn-ghost font-display !text-base !normal-case !tracking-normal"
              >
                ← Back to outline
              </Link>
            </div>
          </div>
          <ChalkTray />
        </BoardPanel>
      </main>
    </div>
  );
}

/** A little row of chalk tally marks (five-bar gate) sized to a count. */
function ChalkTally({ count }: { count: number }) {
  if (count <= 0) return null;
  const shown = Math.min(count, 10);
  return (
    <svg
      width={shown * 6 + 6}
      height={26}
      viewBox={`0 0 ${shown * 6 + 6} 26`}
      aria-hidden="true"
      className="mb-1"
    >
      {Array.from({ length: shown }, (_, i) => {
        const isFifth = (i + 1) % 5 === 0;
        const x = 4 + i * 6;
        return isFifth ? (
          <path
            key={i}
            d={`M${x - 20} 20 L${x} 4`}
            stroke={ACC}
            strokeWidth={2}
            strokeLinecap="round"
          />
        ) : (
          <path
            key={i}
            d={`M${x} 4 V22`}
            stroke={INK}
            strokeOpacity={0.7}
            strokeWidth={2}
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

/** A wooden chalk tray with chalk sticks + an eraser — the board's bottom lip. */
function ChalkTray() {
  return (
    <div className="relative mt-5 h-4" aria-hidden="true">
      <div
        className="absolute inset-x-0 top-0 h-2.5 rounded-sm"
        style={{
          background:
            "linear-gradient(to bottom, rgb(var(--color-surface-muted)), rgb(var(--color-surface-raised) / 0.6))",
          borderTop: "1.5px solid rgb(var(--color-border-strong) / 0.25)",
          boxShadow: "0 1px 2px rgb(0 0 0 / 0.12)",
        }}
      />
      <span
        className="absolute top-[3px] left-[6%] h-1.5 w-10 rounded-full"
        style={{ background: "rgb(var(--color-border-strong) / 0.35)" }}
      />
      <span
        className="absolute top-[3px] left-[20%] h-1.5 w-7 rounded-full"
        style={{ background: "rgb(var(--color-accent) / 0.4)" }}
      />
      <span
        className="absolute top-[3px] left-[30%] h-1.5 w-6 rounded-full"
        style={{ background: "rgb(var(--color-accent-2) / 0.4)" }}
      />
      <span
        className="absolute top-[1px] right-[8%] h-2.5 w-9 rounded-[2px]"
        style={{
          background: "rgb(var(--color-surface-raised))",
          border: "1px solid rgb(var(--color-border-strong) / 0.3)",
        }}
      />
    </div>
  );
}
