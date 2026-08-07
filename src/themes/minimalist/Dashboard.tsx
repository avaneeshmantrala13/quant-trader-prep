import { Link } from "react-router-dom";
import type {
  DashboardMisconception,
  DashboardTopicEntry,
  DashboardViewProps,
} from "../types";
import type { MasteryState } from "@/lib/mastery/verdict";
import {
  ELICITED_ACTIVITIES_SENTENCE,
  elicitedPairsNeeded,
  type ReliabilityDiagramData,
} from "@/lib/calibration/reliability";
import { MASTERY_BAR } from "@/lib/mastery/config";
import { ChevronLeftIcon } from "@/components/icons";
import { CourseReadinessCards } from "@/components/dashboard/CourseReadinessCards";
import { MinimalBackground } from "./Background";

/**
 * MINIMALIST — Mastery & Calibration Dashboard (`/dashboard`) renderer.
 *
 * A Swiss / International-typographic "instrument panel": the numbers and bars
 * ARE the design. A strong modular grid, precise mono data type, hairline
 * dividers under bold ink section rules, generous negative space, and the ONE
 * restrained signal-red accent used only where it means something — the 0.80
 * mastery target line, the reliability curve, and priority/attention cues.
 * Flat throughout: no gradients, no drop-shadow cards, no background grid.
 *
 * A PURE presentational consumer of `DashboardViewProps` — it fetches nothing,
 * computes no mastery math, and builds no routes; every link uses a provided
 * `href`. Renders every section the BaseDashboard does (recommended focus,
 * per-topic entries with mean±95% CI + 0.80 target, distinct STRONG/WEAK/
 * UNCERTAIN verdicts, misconception chips, review flags, weakness ranking,
 * reviews-due, reliability diagram with an honest insufficient-data state, and
 * the diagnostic nudge + back-to-contents affordances).
 */

const pctNum = (x: number) => Math.round(x * 100);
const pct = (x: number) => `${pctNum(x)}%`;

/* -------------------------------------------------------------------------- */
/*  Root                                                                       */
/* -------------------------------------------------------------------------- */

export function MinimalistDashboard({
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
  const evidenced = topics.filter((t) => t.hasEvidence).length;
  const strong = topics.filter((t) => t.verdict === "STRONG").length;
  const courseMode = goalMode === "course";

  return (
    <div className="relative min-h-[100dvh] bg-bg font-sans">
      <MinimalBackground />

      <div className="relative z-10 mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
        {/* ---- Utility bar: back · section marker · warm-up ---- */}
        <div className="flex items-center gap-3">
          <Link
            to={contentsHref}
            aria-label="Back to contents"
            className="group -ml-1 inline-flex items-center gap-1.5 text-secondary transition-colors hover:text-primary"
          >
            <ChevronLeftIcon width={16} height={16} />
            <span className="label leading-none">Contents</span>
          </Link>
          <span className="h-px flex-1 bg-border-strong" />
          <Link
            to={diagnosticHref}
            className="label leading-none text-secondary transition-colors hover:text-accent"
          >
            {diagnosticDone ? "Retake warm-up ↻" : "Run warm-up ▸"}
          </Link>
        </div>

        {/* ---- Masthead ---- */}
        <header className="mt-6 flex flex-col gap-8 sm:mt-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <span className="label text-accent">Mastery Desk · Read-Only</span>
            <h1 className="mt-2 font-display text-4xl font-extrabold leading-[0.95] tracking-tight text-primary sm:text-5xl">
              Mastery &amp;
              <br />
              Calibration
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-secondary">
              A read-only instrument panel over your graded evidence: where you
              are confidently strong, confidently weak, and how well-calibrated
              your confidence actually is.
            </p>
          </div>

          <dl className="grid shrink-0 grid-cols-3 gap-x-6 gap-y-4 sm:flex sm:items-end sm:gap-8">
            <Stat label="Topics" value={String(topics.length)} />
            <Stat label="Evidenced" value={`${evidenced}/${topics.length}`} />
            <Stat label="Strong" value={String(strong)} />
            <Stat label="Reviews due" value={String(due.length)} accent />
          </dl>
        </header>

        {!diagnosticDone && (
          <DiagnosticNudge diagnosticHref={diagnosticHref} className="mt-8" />
        )}

        {/* ---- 01 · Recommended next focus ---- */}
        <Section n={1} title="Next Focus" aside="Confidently weakest">
          {recommended ? (
            <div className="grid grid-cols-1 gap-6 border border-subtle bg-surface p-6 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-10 sm:p-8">
              <div className="min-w-0">
                <span className="label text-muted">{recommended.trackTitle}</span>
                <h3 className="mt-1 font-display text-2xl font-bold leading-tight tracking-tight text-primary sm:text-3xl">
                  {recommended.name}
                </h3>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-secondary">
                  Surfaced as your most confidently-weak topic: even the optimistic
                  end of its interval sits low, so practice here moves the needle
                  most.
                </p>
              </div>

              <div className="flex items-end justify-between gap-6 sm:flex-col sm:items-end sm:gap-4">
                <div className="text-right">
                  <div className="num text-5xl font-semibold leading-none tabular-nums text-primary">
                    {pctNum(recommended.ciLow)}
                    <span className="text-2xl text-muted">%</span>
                  </div>
                  <div className="label mt-1.5">CI-low floor</div>
                </div>
                <Link
                  to={recommended.href}
                  className="btn-primary shrink-0 whitespace-nowrap text-center"
                >
                  Practice ▸
                </Link>
              </div>
            </div>
          ) : (
            <EmptyState>
              No clear weak spot yet. Explore a new topic or run the calibration
              warm-up to seed your starting point.
            </EmptyState>
          )}
        </Section>

        {/* ---- 02 · Course readiness (Case A) or weakness ranking (Case B) ---- */}
        {courseMode ? (
          <Section n={2} title="Course Readiness" aside="By course">
            <CourseReadinessCards courses={courses} />
          </Section>
        ) : (
          <Section
            n={2}
            title="Weakest First"
            aside={`${weaknesses.length} evidenced · by CI-low`}
          >
            <WeaknessRanking topics={weaknesses} />
          </Section>
        )}

        {/* ---- 03 · Reviews due ---- */}
        <Section
          n={3}
          title="Due for Review"
          aside={due.length > 0 ? `${due.length} resurfacing` : "SM-2 schedule"}
        >
          <ReviewsDueList topics={due} />
        </Section>

        {/* ---- 04 · Calibration reliability ---- */}
        <Section n={4} title="Calibration" aside="Reliability curve">
          <Reliability data={reliability} />
        </Section>

        {/* ---- 05 · Every topic ---- */}
        <Section n={5} title="All Topics" aside="Full curriculum">
          <BarLegend />
          {topics.length === 0 ? (
            <EmptyState>No topics available.</EmptyState>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-px border border-subtle bg-subtle sm:grid-cols-2 lg:grid-cols-3">
              {topics.map((t) => (
                <TopicCell key={t.topicKey} topic={t} />
              ))}
            </div>
          )}
        </Section>

        {/* ---- Colophon: diagnostic nudge + back ---- */}
        <footer className="mt-16 border-t-2 border-border-strong pt-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-md text-sm text-secondary">
              {diagnosticDone
                ? "Warm-up complete. Retake it any time to re-seed where your practice starts."
                : "Haven't run the calibration warm-up yet; it tunes where your practice begins."}
            </p>
            <div className="flex items-center gap-5">
              <Link
                to={diagnosticHref}
                className="label text-secondary transition-colors hover:text-accent"
              >
                {diagnosticDone ? "Retake warm-up ↻" : "Run warm-up ▸"}
              </Link>
              <Link
                to={contentsHref}
                className="label text-secondary transition-colors hover:text-primary"
              >
                ← Contents
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Section scaffolding                                                        */
/* -------------------------------------------------------------------------- */

function Section({
  n,
  title,
  aside,
  children,
}: {
  n: number;
  title: string;
  aside?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12 sm:mt-14">
      <header className="flex items-end gap-4 border-b-2 border-border-strong pb-3">
        <span className="num shrink-0 text-sm font-medium tabular-nums text-muted">
          {String(n).padStart(2, "0")}
        </span>
        <h2 className="min-w-0 flex-1 font-display text-xl font-bold leading-tight tracking-tight text-primary sm:text-2xl">
          {title}
        </h2>
        {aside && <span className="label shrink-0 text-right">{aside}</span>}
      </header>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="text-left">
      <dd
        className={`num text-2xl font-semibold tabular-nums sm:text-3xl ${
          accent ? "text-accent" : "text-primary"
        }`}
      >
        {value}
      </dd>
      <dt className="label mt-1">{label}</dt>
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-dashed border-subtle bg-surface px-4 py-6 text-sm leading-relaxed text-secondary">
      {children}
    </div>
  );
}

function DiagnosticNudge({
  diagnosticHref,
  className = "",
}: {
  diagnosticHref: string;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col gap-2 border-l-2 border-accent bg-surface py-3 pl-4 pr-3 sm:flex-row sm:items-center sm:justify-between ${className}`}
    >
      <p className="text-sm text-secondary">
        You haven't run the calibration warm-up yet; it tunes where your
        practice starts.
      </p>
      <Link
        to={diagnosticHref}
        className="label shrink-0 text-accent underline underline-offset-4 transition-colors hover:text-accent-hover"
      >
        Run it now ▸
      </Link>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Verdict tag — STRONG / WEAK / UNCERTAIN, all first-class + distinct        */
/* -------------------------------------------------------------------------- */

const VERDICT: Record<
  MasteryState,
  { label: string; glyph: string; text: string; border: string }
> = {
  STRONG: {
    label: "Strong",
    glyph: "▲",
    text: "text-bull",
    border: "border-bull/50",
  },
  WEAK: {
    label: "Weak",
    glyph: "▼",
    text: "text-bear",
    border: "border-bear/50",
  },
  // UNCERTAIN is NEVER rounded to STRONG/WEAK: its own neutral-ink tag with an
  // accent diamond so it reads as a distinct, deliberate third state.
  UNCERTAIN: {
    label: "Uncertain",
    glyph: "◆",
    text: "text-primary",
    border: "border-border-strong",
  },
};

function VerdictTag({ state }: { state: MasteryState }) {
  const v = VERDICT[state];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-sm border bg-surface px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-label ${v.border} ${v.text}`}
      title={`${v.label}: calibration-aware verdict`}
    >
      <span
        aria-hidden="true"
        className={state === "UNCERTAIN" ? "text-accent" : undefined}
      >
        {v.glyph}
      </span>
      {v.label}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Mastery bar — mean · 95% CI band · 0.80 target (the signature data-viz)     */
/* -------------------------------------------------------------------------- */

function MasteryBar({
  mean,
  ciLow,
  ciHigh,
  hasEvidence,
}: {
  mean: number;
  ciLow: number;
  ciHigh: number;
  hasEvidence: boolean;
}) {
  const label = hasEvidence
    ? `Mastery mean ${pct(mean)}, 95% CI ${pct(ciLow)} to ${pct(
        ciHigh,
      )}, target ${pct(MASTERY_BAR)}`
    : `No evidence yet; target ${pct(MASTERY_BAR)}`;
  return (
    <div
      role="img"
      aria-label={label}
      className="relative h-1.5 w-full bg-surface-muted"
    >
      {/* 95% credible-interval band */}
      {hasEvidence && (
        <div
          aria-hidden="true"
          className="absolute top-0 h-full bg-primary/25"
          style={{
            left: `${ciLow * 100}%`,
            width: `${Math.max(ciHigh - ciLow, 0) * 100}%`,
          }}
        />
      )}
      {/* posterior mean tick */}
      {hasEvidence && (
        <div
          aria-hidden="true"
          className="absolute top-[-3px] h-[calc(100%+6px)] w-[2px] -translate-x-1/2 bg-primary"
          style={{ left: `${mean * 100}%` }}
        />
      )}
      {/* 0.80 mastery target — the single restrained accent */}
      <div
        aria-hidden="true"
        className="absolute top-[-4px] h-[calc(100%+8px)] w-px bg-accent"
        style={{ left: `${MASTERY_BAR * 100}%` }}
      />
    </div>
  );
}

function BarLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px]">
      <LegendItem>
        <span className="inline-block h-2 w-4 bg-primary/25 align-middle" />
        95% CI
      </LegendItem>
      <LegendItem>
        <span className="inline-block h-3 w-[2px] bg-primary align-middle" />
        Mean
      </LegendItem>
      <LegendItem>
        <span className="inline-block h-3 w-px bg-accent align-middle" />
        0.80 target
      </LegendItem>
    </div>
  );
}

function LegendItem({ children }: { children: React.ReactNode }) {
  return (
    <span className="label inline-flex items-center gap-1.5 normal-case tracking-normal text-muted">
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Per-topic cell                                                             */
/* -------------------------------------------------------------------------- */

function MisconceptionChips({ items }: { items: DashboardMisconception[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="label text-bear">Where you struggle</div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {items.map((m) => (
          <span
            key={m.key}
            className="rounded-sm border border-bear/40 px-2 py-0.5 font-mono text-[11px] font-medium normal-case tracking-normal text-bear"
          >
            {m.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function TopicCell({ topic }: { topic: DashboardTopicEntry }) {
  const has = topic.hasEvidence;
  return (
    <article className="flex flex-col gap-4 bg-surface p-5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="label text-muted">{topic.trackTitle}</div>
          <h3 className="mt-1 font-display text-base font-semibold leading-snug tracking-tight text-primary">
            {topic.name}
          </h3>
        </div>
        <VerdictTag state={topic.verdict} />
      </header>

      {/* Mastery readout + bar */}
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="label text-secondary">Mastery</span>
          <span className="num text-sm tabular-nums text-primary">
            {has ? pct(topic.mean) : "—"}
            {has && (
              <span className="ml-1.5 text-[11px] text-muted">
                CI {pct(topic.ciLow)}–{pct(topic.ciHigh)}
              </span>
            )}
          </span>
        </div>
        <div className="mt-2.5">
          <MasteryBar
            mean={topic.mean}
            ciLow={topic.ciLow}
            ciHigh={topic.ciHigh}
            hasEvidence={has}
          />
        </div>
      </div>

      {/* Meta readouts */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <MetaStat label="θ" value={topic.theta.toFixed(2)} />
        <MetaStat label="graded" value={String(topic.gradedCount)} />
        {topic.reviewDue && (
          <span className="num text-[11px] font-semibold uppercase tracking-label text-accent">
            ● Review due
          </span>
        )}
      </div>

      <MisconceptionChips items={topic.misconceptions} />

      <Link
        to={topic.href}
        className="mt-auto inline-flex items-center gap-1 border-t border-subtle pt-3 font-mono text-[11px] font-semibold uppercase tracking-label text-secondary transition-colors hover:text-accent"
      >
        Practice this →
      </Link>
    </article>
  );
}

function MetaStat({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="label leading-none text-muted">{label}</span>
      <span className="num text-xs tabular-nums text-secondary">{value}</span>
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Weakness ranking                                                           */
/* -------------------------------------------------------------------------- */

function WeaknessRanking({ topics }: { topics: DashboardTopicEntry[] }) {
  if (topics.length === 0) {
    return (
      <EmptyState>
        No graded evidence yet. Practice a few items (or run the warm-up) to
        rank your weak spots.
      </EmptyState>
    );
  }
  return (
    <ol className="divide-y divide-subtle border border-subtle">
      {topics.map((t, i) => (
        <li key={t.topicKey}>
          <Link
            to={t.href}
            className="group grid grid-cols-[1.5rem_1fr_auto] items-center gap-x-4 px-4 py-3.5 transition-colors hover:bg-surface-muted sm:grid-cols-[1.5rem_1fr_9rem_auto] sm:gap-x-6"
          >
            <span className="num text-xs font-medium tabular-nums text-muted">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <div className="truncate text-[15px] font-semibold leading-snug tracking-tight text-primary">
                {t.name}
              </div>
              <div className="label text-muted">{t.trackTitle}</div>
            </div>
            {/* Inline CI strip — data-forward, aligned to a fixed track. */}
            <div className="col-start-2 mt-2 flex items-center gap-3 sm:col-start-3 sm:mt-0 sm:block">
              <div className="w-full sm:w-36">
                <MasteryBar
                  mean={t.mean}
                  ciLow={t.ciLow}
                  ciHigh={t.ciHigh}
                  hasEvidence={t.hasEvidence}
                />
              </div>
            </div>
            <div className="col-start-3 row-start-1 text-right sm:col-start-4">
              <div className="num text-sm font-semibold tabular-nums text-primary">
                {pct(t.ciLow)}
              </div>
              <div className="num text-[11px] tabular-nums text-muted">
                {pct(t.ciLow)}–{pct(t.ciHigh)}
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ol>
  );
}

/* -------------------------------------------------------------------------- */
/*  Reviews due                                                                */
/* -------------------------------------------------------------------------- */

function ReviewsDueList({ topics }: { topics: DashboardTopicEntry[] }) {
  if (topics.length === 0) {
    return (
      <EmptyState>
        Nothing due for review. Mastered topics resurface here on their SM-2
        spaced-review schedule.
      </EmptyState>
    );
  }
  return (
    <ul className="divide-y divide-subtle border border-subtle">
      {topics.map((t) => (
        <li key={t.topicKey}>
          <Link
            to={t.href}
            className="group flex items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-surface-muted"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 shrink-0 bg-accent"
              />
              <div className="min-w-0">
                <div className="truncate text-[15px] font-semibold leading-snug tracking-tight text-primary">
                  {t.name}
                </div>
                <div className="label text-muted">{t.trackTitle}</div>
              </div>
            </div>
            <span className="label shrink-0 text-secondary transition-colors group-hover:text-accent">
              Review →
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */
/*  Reliability diagram                                                        */
/* -------------------------------------------------------------------------- */

const R_SIZE = 300;
const R_PAD = 34;
const rx = (p: number) => R_PAD + p * (R_SIZE - 2 * R_PAD);
const ry = (p: number) => R_SIZE - R_PAD - p * (R_SIZE - 2 * R_PAD);
const GUIDES = [0.25, 0.5, 0.75];

function Reliability({ data }: { data: ReliabilityDiagramData }) {
  if (!data.sufficient) {
    const progress = Math.min(100, (data.count / data.minPairs) * 100);
    return (
      <div className="border border-dashed border-subtle bg-surface px-6 py-8">
        <div className="max-w-sm">
          <div className="label text-accent">Calibration · warming up</div>
          <p className="mt-2 text-sm leading-relaxed text-secondary">
            This tracks only surfaces where you STATE a confidence. Just two
            produce a data point: {ELICITED_ACTIVITIES_SENTENCE}. Normal lessons
            and quizzes don't count toward it.
          </p>
          <p className="mt-3 num text-sm tabular-nums text-primary">
            You're at {data.count}/{data.minPairs} —{" "}
            {elicitedPairsNeeded(data.count, data.minPairs)} more of those to
            unlock the graph.
          </p>
          <div
            role="img"
            aria-label={`Calibration progress: ${data.count} of ${data.minPairs} elicited-confidence data points (Fermi 90% intervals and Trading-Floor quotes)`}
            className="mt-2 h-1.5 w-full bg-surface-muted"
          >
            <div
              aria-hidden="true"
              className="h-full bg-accent"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  // ONE plain-language read from the shared calibration signal → chip + caption
  // can never contradict. Over-confident ⇒ points BELOW the diagonal.
  const lean = data.calibration
    ? data.calibration.lean === "over"
      ? {
          text: "Over-confident",
          cls: "border-bear/50 text-bear",
          caption:
            "Your curve sits below the dashed diagonal: confidence runs ahead of accuracy.",
        }
      : data.calibration.lean === "under"
        ? {
            text: "Under-confident",
            cls: "border-accent/50 text-accent",
            caption:
              "Your curve sits above the dashed diagonal: accuracy runs ahead of confidence.",
          }
        : {
            text: "Well-calibrated",
            cls: "border-bull/50 text-bull",
            caption:
              "Your curve hugs the dashed diagonal: confidence matches accuracy.",
          }
    : null;

  return (
    <div className="grid grid-cols-1 gap-6 border border-subtle bg-surface p-5 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-8 sm:p-6">
      <svg
        viewBox={`0 0 ${R_SIZE} ${R_SIZE}`}
        className="h-auto w-full max-w-[280px] justify-self-center"
        role="img"
        aria-label="Reliability diagram: predicted confidence versus observed accuracy"
      >
        {/* Interior guide hairlines (Swiss grid discipline). */}
        {GUIDES.map((g) => (
          <g key={g}>
            <line
              x1={rx(g)}
              y1={ry(0)}
              x2={rx(g)}
              y2={ry(1)}
              stroke="rgb(var(--color-border))"
              strokeWidth={1}
            />
            <line
              x1={rx(0)}
              y1={ry(g)}
              x2={rx(1)}
              y2={ry(g)}
              stroke="rgb(var(--color-border))"
              strokeWidth={1}
            />
          </g>
        ))}

        {/* Plot frame */}
        <rect
          x={rx(0)}
          y={ry(1)}
          width={R_SIZE - 2 * R_PAD}
          height={R_SIZE - 2 * R_PAD}
          fill="none"
          stroke="rgb(var(--color-border-strong))"
          strokeWidth={1.25}
        />

        {/* 0.80 target guides — the single accent, echoing the mastery bar. */}
        <line
          x1={rx(MASTERY_BAR)}
          y1={ry(0)}
          x2={rx(MASTERY_BAR)}
          y2={ry(1)}
          stroke="rgb(var(--color-accent))"
          strokeOpacity={0.35}
          strokeWidth={1}
        />

        {/* 45° perfect-calibration diagonal */}
        <line
          x1={rx(0)}
          y1={ry(0)}
          x2={rx(1)}
          y2={ry(1)}
          stroke="rgb(var(--color-border-strong))"
          strokeDasharray="3 4"
          strokeWidth={1}
        />

        {/* Learner curve */}
        <polyline
          points={data.bins
            .map((b) => `${rx(b.predicted)},${ry(b.observed)}`)
            .join(" ")}
          fill="none"
          stroke="rgb(var(--color-accent))"
          strokeWidth={2}
        />
        {data.bins.map((b, i) => (
          <circle
            key={i}
            cx={rx(b.predicted)}
            cy={ry(b.observed)}
            r={2.5 + Math.min(b.count, 40) / 12}
            fill="rgb(var(--color-accent))"
          >
            <title>
              said {pct(b.predicted)} · right {pct(b.observed)} · n={b.count}
            </title>
          </circle>
        ))}

        {/* Axis labels */}
        <text
          x={R_SIZE / 2}
          y={R_SIZE - 8}
          textAnchor="middle"
          className="fill-current font-mono text-[9px] uppercase tracking-label text-muted"
        >
          Predicted →
        </text>
        <text
          x={12}
          y={R_SIZE / 2}
          textAnchor="middle"
          transform={`rotate(-90 12 ${R_SIZE / 2})`}
          className="fill-current font-mono text-[9px] uppercase tracking-label text-muted"
        >
          Observed →
        </text>
      </svg>

      <div className="min-w-0 space-y-5">
        {data.headline && (
          <p className="text-lg leading-relaxed text-primary">
            When you say <span className="num font-semibold">~80%</span>, you're
            right{" "}
            <span className="num font-semibold text-accent">
              {pct(data.headline.observed)}
            </span>{" "}
            of the time{" "}
            <span className="num text-sm text-muted">
              (n={data.headline.count})
            </span>
            .
          </p>
        )}

        {data.sourceNote && (
          <p className="text-xs leading-relaxed text-muted">
            {data.sourceNote}
          </p>
        )}

        {data.calibration && (
          <div>
            <p className="text-lg font-medium leading-relaxed text-primary">
              {data.calibration.label}
            </p>
            {lean && (
              <span
                className={`mt-2 inline-flex items-center rounded-sm border bg-surface px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-label ${lean.cls}`}
              >
                {lean.text}
              </span>
            )}
          </div>
        )}

        <p className="border-t border-subtle pt-3 text-xs leading-relaxed text-muted">
          {lean
            ? lean.caption
            : "Points below the dashed diagonal are over-confident; above are under-confident."}
        </p>

        <details className="border-t border-subtle pt-3">
          <summary className="label cursor-pointer text-secondary transition-colors hover:text-primary">
            Advanced details
          </summary>
          <dl className="mt-3 flex flex-wrap items-end gap-x-8 gap-y-4">
            <ReliabilityStat label="Brier gap" value={data.relGap.toFixed(3)} />
            <ReliabilityStat label="Brier" value={data.brier.toFixed(3)} />
            <ReliabilityStat label="Pairs" value={String(data.count)} />
          </dl>
        </details>
      </div>
    </div>
  );
}

function ReliabilityStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dd className="num text-lg font-semibold tabular-nums text-primary">
        {value}
      </dd>
      <dt className="label mt-1">{label}</dt>
    </div>
  );
}
