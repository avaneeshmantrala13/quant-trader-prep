import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import type {
  DashboardRecommendation,
  DashboardTopicEntry,
  DashboardViewProps,
} from "../types";
import type { MasteryState } from "@/lib/mastery/verdict";
import {
  ELICITED_ACTIVITIES_SENTENCE,
  elicitedPairsNeeded,
  type ReliabilityDiagramData,
} from "@/lib/calibration/reliability";
import { MASTERY_BAR, P_TARGET } from "@/lib/mastery/config";
import { ChevronLeftIcon } from "@/components/icons";
import { CourseReadinessCards } from "@/components/dashboard/CourseReadinessCards";
import { CyberpunkAnimations, neonFilter } from "./neon";

/**
 * CYBERPUNK — Mastery Dashboard (`/dashboard`) as a glowing OPERATOR CONSOLE /
 * trading-terminal HUD. The page owns ALL data + routes; this file only styles
 * what it receives via `DashboardViewProps` — no data fetching, mastery math, or
 * route construction.
 *
 *  • Header      → a lit terminal bar: back-to-directory jack, console title,
 *                  and a re/calibrate switch.
 *  • Hero panel  → the "operator desk" readout: the read-only banner, the
 *                  recommended next TARGET, a reviews-due gauge, and a status
 *                  strip of counters, with an honest "calibration offline" nudge
 *                  until the warm-up is run.
 *  • Reviews due → a resurfacing queue of neon rows linking each topic.
 *  • Weakness    → a "threat board" ranked ascending by CI_low (confidently
 *                  weak surfaces first) with mini confidence gauges.
 *  • Reliability → a bespoke neon reliability scope (bins + Brier gap + the
 *                  ~80% headline) with an insufficient-signal state at count 0.
 *  • Per-topic   → HUD cards: a neon mastery gauge (mean, 95% CI band, 0.80
 *                  target), a DISTINCT STRONG/WEAK/UNCERTAIN verdict (UNCERTAIN
 *                  is first-class), friendly misconception chips + review flag.
 *
 * All color flows through theme tokens (neon on blue-black / deep ink on dusk)
 * so every state clears WCAG-AA in BOTH modes — neon is decorative glow only,
 * never body text on a neon fill. Responsive 360px → ≥1280px. Motion carries
 * `cp-anim` so it freezes under `prefers-reduced-motion`.
 */

const pct = (x: number) => `${Math.round(x * 100)}%`;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/* Tone → the CSS custom-property behind each neon ink. */
type Tone = "cyan" | "magenta" | "green" | "red";
const TONE_VAR: Record<Tone, string> = {
  cyan: "var(--color-accent)",
  magenta: "var(--color-accent-2)",
  green: "var(--color-bull)",
  red: "var(--color-bear)",
};
const TONE_TEXT: Record<Tone, string> = {
  cyan: "text-accent",
  magenta: "text-accent-2",
  green: "text-bull",
  red: "text-bear",
};

/* -------------------------------------------------------------------------- */
/*  HUD panel scaffolding                                                      */
/* -------------------------------------------------------------------------- */

function Brackets({ v }: { v: string }) {
  const s = { borderColor: `rgb(${v})` };
  return (
    <>
      <span className="pointer-events-none absolute left-0 top-0 h-3 w-3 border-l-2 border-t-2" style={s} />
      <span className="pointer-events-none absolute right-0 top-0 h-3 w-3 border-r-2 border-t-2" style={s} />
      <span className="pointer-events-none absolute bottom-0 left-0 h-3 w-3 border-b-2 border-l-2" style={s} />
      <span className="pointer-events-none absolute bottom-0 right-0 h-3 w-3 border-b-2 border-r-2" style={s} />
    </>
  );
}

function HudPanel({
  tone = "cyan",
  label,
  right,
  children,
  className = "",
}: {
  tone?: Tone;
  label?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const v = TONE_VAR[tone];
  return (
    <section
      className={`relative overflow-hidden rounded-sm border border-subtle bg-surface/80 backdrop-blur-sm ${className}`}
      style={{ boxShadow: `0 0 24px rgb(${v} / 0.08), inset 0 0 0 1px rgb(${v} / 0.06)` }}
    >
      {/* top neon rule */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
        style={{ background: `linear-gradient(90deg, transparent, rgb(${v} / 0.9), transparent)` }}
      />
      <Brackets v={v} />
      {label && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-subtle px-4 py-2.5 sm:px-5">
          <span className={`label ${TONE_TEXT[tone]}`}>{label}</span>
          {right}
        </header>
      )}
      <div className="relative p-4 sm:p-5">{children}</div>
    </section>
  );
}

/* A faint HUD readout module (label over a big mono value). */
function Readout({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: ReactNode;
  tone: Tone;
  hint?: string;
}) {
  const v = TONE_VAR[tone];
  return (
    <div
      className="relative rounded-sm border border-subtle bg-surface-muted/70 px-3 py-2"
      style={{ boxShadow: `inset 0 0 12px rgb(${v} / 0.08)` }}
    >
      <div className="label text-muted">{label}</div>
      <div className={`num text-2xl font-semibold leading-tight ${TONE_TEXT[tone]}`}>{value}</div>
      {hint && <div className="mt-0.5 text-[11px] leading-snug text-muted">{hint}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Verdict tag — STRONG / WEAK / UNCERTAIN, each DISTINCT                     */
/* -------------------------------------------------------------------------- */

const VERDICT: Record<
  MasteryState,
  { label: string; sub: string; glyph: string; tone: Tone; dashed: boolean }
> = {
  STRONG: { label: "Strong", sub: "Locked", glyph: "▲", tone: "green", dashed: false },
  WEAK: { label: "Weak", sub: "Confidently low", glyph: "▼", tone: "red", dashed: false },
  UNCERTAIN: { label: "Uncertain", sub: "Low signal", glyph: "◆", tone: "cyan", dashed: true },
};

function VerdictTag({ state }: { state: MasteryState }) {
  const d = VERDICT[state];
  const v = TONE_VAR[d.tone];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-sm px-2 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider ${TONE_TEXT[d.tone]}`}
      style={{
        border: `1.5px ${d.dashed ? "dashed" : "solid"} rgb(${v})`,
        background: `rgb(${v} / 0.08)`,
        boxShadow: `0 0 10px rgb(${v} / 0.28)`,
      }}
      title={`${d.label} — calibration-aware verdict · ${d.sub}`}
    >
      <span aria-hidden="true">{d.glyph}</span>
      {d.label}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Neon mastery gauge — mean, 95% CI band, 0.80 target                        */
/* -------------------------------------------------------------------------- */

function MasteryGauge({ topic }: { topic: DashboardTopicEntry }) {
  const target = MASTERY_BAR;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="label text-secondary">Mastery</span>
        <span className="num text-sm text-primary">
          {topic.hasEvidence ? pct(topic.mean) : "—"}
          {topic.hasEvidence && (
            <span className="ml-1 text-[11px] text-muted">
              (95% CI {pct(topic.ciLow)}–{pct(topic.ciHigh)})
            </span>
          )}
        </span>
      </div>

      {/* gauge track (marker wrapper is overflow-visible so ticks can extend) */}
      <div className="relative mt-2 h-3.5 w-full">
        <div className="absolute inset-0 overflow-hidden rounded-sm border border-subtle bg-surface-muted">
          {/* faint gauge graticule */}
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg, rgb(var(--color-accent) / 0.5) 0 1px, transparent 1px 10%)",
            }}
          />
          {topic.hasEvidence ? (
            <>
              {/* 95% CI band */}
              <div
                className="absolute inset-y-0"
                style={{
                  left: `${clamp01(topic.ciLow) * 100}%`,
                  width: `${Math.max(topic.ciHigh - topic.ciLow, 0) * 100}%`,
                  background: "rgb(var(--color-accent) / 0.35)",
                  boxShadow: "0 0 10px rgb(var(--color-accent) / 0.5)",
                }}
                aria-hidden="true"
              />
              {/* solid fill up to the mean for a "charged gauge" read */}
              <div
                className="absolute inset-y-0 left-0"
                style={{
                  width: `${clamp01(topic.mean) * 100}%`,
                  background:
                    "linear-gradient(90deg, rgb(var(--color-accent) / 0.28), rgb(var(--color-accent) / 0.55))",
                }}
                aria-hidden="true"
              />
            </>
          ) : (
            // no-signal hatch
            <div
              className="absolute inset-0 opacity-50"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(-45deg, rgb(var(--color-text-muted) / 0.35) 0 2px, transparent 2px 7px)",
              }}
              aria-hidden="true"
            />
          )}
        </div>

        {/* mean marker */}
        {topic.hasEvidence && (
          <div
            className="absolute -top-1 h-[calc(100%+8px)] w-[2px]"
            style={{
              left: `${clamp01(topic.mean) * 100}%`,
              transform: "translateX(-50%)",
              background: "rgb(var(--color-accent))",
              boxShadow: "0 0 8px rgb(var(--color-accent))",
            }}
            title={`mean ${pct(topic.mean)}`}
            aria-hidden="true"
          />
        )}
        {/* 0.80 target marker (magenta) */}
        <div
          className="absolute -top-1.5 h-[calc(100%+12px)] w-[2px]"
          style={{
            left: `${target * 100}%`,
            transform: "translateX(-50%)",
            background: "rgb(var(--color-accent-2))",
            boxShadow: "0 0 6px rgb(var(--color-accent-2) / 0.9)",
          }}
          title={`target ${pct(target)}`}
          aria-hidden="true"
        />
      </div>

      <div className="mt-1 flex items-center justify-between">
        <span className="num text-[10px] uppercase tracking-wider text-muted">
          {topic.hasEvidence ? "0 ── mastery ── 1" : "No signal"}
        </span>
        <span className="num text-[10px] uppercase tracking-wider text-accent-2">
          ▸ target {pct(target)}
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Per-topic HUD card                                                         */
/* -------------------------------------------------------------------------- */

function TopicNode({ topic }: { topic: DashboardTopicEntry }) {
  return (
    <article className="relative flex flex-col gap-3 overflow-hidden rounded-sm border border-subtle bg-surface/80 p-4 backdrop-blur-sm transition-shadow hover:shadow-[0_0_18px_rgb(var(--color-accent)/0.18)]">
      <Brackets v={TONE_VAR.cyan} />
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="label text-muted">{topic.trackTitle}</div>
          <h3
            className="font-display text-base font-semibold uppercase tracking-wide text-primary"
            title={topic.name}
          >
            {topic.name}
          </h3>
        </div>
        <VerdictTag state={topic.verdict} />
      </header>

      <MasteryGauge topic={topic} />

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="chip border-subtle text-secondary" title="Elo skill (logit)">
          θ {topic.theta.toFixed(2)}
        </span>
        <span className="chip border-subtle text-muted">{topic.gradedCount} graded</span>
        {topic.reviewDue && (
          <span
            className="cp-anim cp-buzz chip text-accent-2"
            style={{ borderColor: "rgb(var(--color-accent-2))", boxShadow: "0 0 8px rgb(var(--color-accent-2) / 0.35)" }}
          >
            ● Review due
          </span>
        )}
      </div>

      {topic.misconceptions.length > 0 && (
        <div>
          <div className="label text-bear">// Fault log</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {topic.misconceptions.map((m) => (
              <span
                key={m.key}
                className="chip text-bear"
                style={{ borderColor: "rgb(var(--color-bear) / 0.6)" }}
              >
                {m.label}
              </span>
            ))}
          </div>
        </div>
      )}

      <Link
        to={topic.href}
        className="btn-secondary mt-auto w-full text-center text-xs"
        style={{ boxShadow: "0 0 12px rgb(var(--color-accent) / 0.12)" }}
      >
        Jump in ▸
      </Link>
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/*  Recommended target                                                        */
/* -------------------------------------------------------------------------- */

function TargetPanel({ recommended }: { recommended?: DashboardRecommendation }) {
  return (
    <div
      className="relative flex h-full flex-col rounded-sm border border-subtle bg-surface-muted/70 p-4"
      style={{ boxShadow: "inset 0 0 14px rgb(var(--color-accent-2) / 0.1)" }}
    >
      <div className="label text-accent-2">// Priority Target</div>
      {recommended ? (
        <>
          <div
            className="mt-1 font-display text-lg font-bold uppercase tracking-wide text-primary"
            style={{ textShadow: "0 0 12px rgb(var(--color-accent-2) / 0.35)" }}
          >
            {recommended.name}
          </div>
          <div className="num text-[11px] uppercase tracking-wider text-muted">
            {recommended.trackTitle} · CI_low {pct(recommended.ciLow)}
          </div>
          <Link
            to={recommended.href}
            className="btn-primary mt-3 block w-full text-center text-sm"
            style={{ boxShadow: "0 0 18px rgb(var(--color-accent) / 0.35)" }}
          >
            Engage {recommended.name} ▸
          </Link>
        </>
      ) : (
        <p className="mt-1 text-sm leading-relaxed text-secondary">
          No clear weak spot yet — explore a new topic or run the warm-up to seed
          your starting point.
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Weakness "threat board"                                                    */
/* -------------------------------------------------------------------------- */

function ThreatBoard({ topics }: { topics: DashboardTopicEntry[] }) {
  if (topics.length === 0) {
    return (
      <p className="text-sm leading-relaxed text-secondary">
        No graded evidence yet — practice a few items (or run the warm-up) to rank
        your weak spots.
      </p>
    );
  }
  return (
    <ol className="divide-y divide-subtle overflow-hidden rounded-sm border border-subtle">
      {topics.map((t, i) => (
        <li key={t.topicKey} className="flex items-center gap-3 px-3 py-2.5">
          <span className="num w-6 shrink-0 text-sm font-semibold text-accent-2">
            {String(i + 1).padStart(2, "0")}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-primary">{t.name}</div>
            <div className="label text-muted">{t.trackTitle}</div>
            {/* mini confidence bar (CI_low) */}
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-sm bg-surface-muted">
              <div
                className="h-full"
                style={{
                  width: `${clamp01(t.ciLow) * 100}%`,
                  background: "rgb(var(--color-accent))",
                  boxShadow: "0 0 6px rgb(var(--color-accent) / 0.8)",
                }}
              />
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="num text-sm font-semibold text-primary">CI_low {pct(t.ciLow)}</div>
            <div className="num text-[11px] text-muted">
              {pct(t.ciLow)}–{pct(t.ciHigh)}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

/* -------------------------------------------------------------------------- */
/*  Reviews-due queue                                                          */
/* -------------------------------------------------------------------------- */

function ReviewQueue({ topics }: { topics: DashboardTopicEntry[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {topics.map((t) => (
        <li
          key={t.topicKey}
          className="flex items-center justify-between gap-3 rounded-sm border bg-surface/70 px-3 py-2"
          style={{ borderColor: "rgb(var(--color-accent-2) / 0.55)" }}
        >
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-primary">{t.name}</div>
            <div className="label text-muted">{t.trackTitle}</div>
          </div>
          <Link
            to={t.href}
            className="btn-secondary !min-h-0 shrink-0 !px-3 !py-1.5 text-xs"
          >
            Review ▸
          </Link>
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */
/*  Reliability scope (bespoke neon reliability diagram)                       */
/* -------------------------------------------------------------------------- */

const SCOPE = 240;
const SPAD = 30;
const rx = (p: number) => SPAD + p * (SCOPE - 2 * SPAD);
const ry = (p: number) => SCOPE - SPAD - p * (SCOPE - 2 * SPAD);

function ReliabilityScope({ data }: { data: ReliabilityDiagramData }) {
  if (!data.sufficient) {
    const progress = Math.min(100, (data.count / data.minPairs) * 100);
    return (
      <div
        className="rounded-sm border border-dashed p-6 text-center"
        style={{ borderColor: "rgb(var(--color-accent) / 0.4)", background: "rgb(var(--color-surface-muted) / 0.6)" }}
      >
        <div className="label text-accent">// Calibrating · Acquiring Signal</div>
        <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-secondary">
          Signal comes only from surfaces where you STATE a confidence — just two
          feed it: {ELICITED_ACTIVITIES_SENTENCE}. Normal lessons and quizzes
          don't register here.
        </p>
        <p className="num mt-3 text-sm text-accent">
          You're at {data.count}/{data.minPairs} —{" "}
          {elicitedPairsNeeded(data.count, data.minPairs)} more of those to
          acquire lock.
        </p>
        <div className="mx-auto mt-2 h-2 w-full max-w-xs overflow-hidden rounded-sm border border-subtle bg-surface-muted">
          <div
            className="h-full"
            style={{
              width: `${progress}%`,
              background: "rgb(var(--color-accent))",
              boxShadow: "0 0 8px rgb(var(--color-accent) / 0.8)",
            }}
            aria-hidden="true"
          />
        </div>
      </div>
    );
  }

  // ONE signed calibration read (shared) → chip + caption can never contradict.
  const calibration = data.calibration;
  const lean = calibration?.lean ?? "well";
  const leanText =
    lean === "over" ? "over-confident" : lean === "under" ? "under-confident" : "well-calibrated";
  const leanTone: Tone = lean === "over" ? "red" : lean === "under" ? "cyan" : "green";
  const captionText =
    lean === "over"
      ? "Points below the diagonal = over-confident (confidence > accuracy)."
      : lean === "under"
        ? "Points above the diagonal = under-confident (accuracy > confidence)."
        : "Points hug the diagonal = well-calibrated (confidence ≈ accuracy).";

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <svg
        width={SCOPE}
        height={SCOPE}
        viewBox={`0 0 ${SCOPE} ${SCOPE}`}
        className="mx-auto w-full max-w-[240px] shrink-0 sm:mx-0"
        role="img"
        aria-label="Reliability diagram: predicted confidence versus observed accuracy"
      >
        <defs>{neonFilter("cp-scope-glow", 2.4)}</defs>

        {/* scope backdrop */}
        <rect
          x={SPAD}
          y={SPAD}
          width={SCOPE - 2 * SPAD}
          height={SCOPE - 2 * SPAD}
          fill="rgb(var(--color-surface-muted) / 0.5)"
          stroke="rgb(var(--color-accent) / 0.5)"
          strokeWidth={1}
        />
        {/* faint grid graticule */}
        {[0.2, 0.4, 0.6, 0.8].map((g) => (
          <g key={g} stroke="rgb(var(--color-accent) / 0.14)" strokeWidth={0.75}>
            <line x1={rx(g)} y1={ry(0)} x2={rx(g)} y2={ry(1)} />
            <line x1={rx(0)} y1={ry(g)} x2={rx(1)} y2={ry(g)} />
          </g>
        ))}
        {/* 0.80 target crosshair (magenta) */}
        <line
          x1={rx(P_TARGET)}
          y1={ry(0)}
          x2={rx(P_TARGET)}
          y2={ry(1)}
          stroke="rgb(var(--color-accent-2) / 0.55)"
          strokeWidth={1}
          strokeDasharray="2 3"
        />
        {/* 45° perfect-calibration diagonal */}
        <line
          x1={rx(0)}
          y1={ry(0)}
          x2={rx(1)}
          y2={ry(1)}
          stroke="rgb(var(--color-border-strong))"
          strokeDasharray="3 3"
          strokeWidth={1}
        />
        {/* learner curve */}
        <polyline
          points={data.bins.map((b) => `${rx(b.predicted)},${ry(b.observed)}`).join(" ")}
          fill="none"
          stroke="rgb(var(--color-accent))"
          strokeWidth={2}
          filter="url(#cp-scope-glow)"
        />
        {data.bins.map((b, i) => (
          <circle
            key={i}
            cx={rx(b.predicted)}
            cy={ry(b.observed)}
            r={3 + Math.min(b.count, 40) / 10}
            fill="rgb(var(--color-accent))"
            filter="url(#cp-scope-glow)"
          >
            <title>
              said {pct(b.predicted)} · right {pct(b.observed)} · n={b.count}
            </title>
          </circle>
        ))}
        {/* axis labels */}
        <text x={SCOPE / 2} y={SCOPE - 8} textAnchor="middle" fill="rgb(var(--color-text-muted))" className="num text-[9px]">
          Predicted confidence →
        </text>
        <text
          x={12}
          y={SCOPE / 2}
          textAnchor="middle"
          transform={`rotate(-90 12 ${SCOPE / 2})`}
          fill="rgb(var(--color-text-muted))"
          className="num text-[9px]"
        >
          Observed accuracy →
        </text>
      </svg>

      <div className="min-w-0 space-y-2">
        {calibration && (
          <p className={`text-sm font-semibold leading-relaxed ${TONE_TEXT[leanTone]}`}>
            {calibration.label}
          </p>
        )}
        {data.headline && (
          <p className="text-sm leading-relaxed text-primary">
            When you say <span className="num font-semibold">~80%</span>, you're right{" "}
            <span className="num font-semibold text-accent">{pct(data.headline.observed)}</span>{" "}
            of the time <span className="text-muted">(n={data.headline.count})</span>.
          </p>
        )}
        {data.sourceNote && (
          <p className="text-xs leading-relaxed text-muted">{data.sourceNote}</p>
        )}
        <div className="flex flex-wrap gap-1.5">
          <span
            className={`chip ${TONE_TEXT[leanTone]}`}
            style={{ borderColor: `rgb(${TONE_VAR[leanTone]})`, boxShadow: `0 0 8px rgb(${TONE_VAR[leanTone]} / 0.28)` }}
          >
            {leanText}
          </span>
        </div>
        <p className="text-xs leading-relaxed text-muted">
          {captionText} The magenta line marks your 80% target.
        </p>
        <details className="group mt-1">
          <summary className="label cursor-pointer text-accent underline-offset-2 hover:underline">
            // Advanced details
          </summary>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="chip border-subtle text-secondary">Brier gap {data.relGap.toFixed(3)}</span>
            <span className="chip border-subtle text-secondary">Brier {data.brier.toFixed(3)}</span>
            {data.bins.map((b, i) => (
              <span key={i} className="chip border-subtle text-muted">
                {pct(b.predicted)} · n={b.count}
              </span>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Whole-page dashboard                                                       */
/* -------------------------------------------------------------------------- */

export function CyberpunkDashboard({
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
      <CyberpunkAnimations />

      {/* faint scanline + grid HUD ambiance over the neon backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgb(var(--color-accent) / 0.05) 0 1px, transparent 1px 3px)",
        }}
      />

      {/* Terminal header */}
      <header
        className="sticky top-0 z-30 border-b bg-surface/85 backdrop-blur-md"
        style={{ borderColor: "rgb(var(--color-accent) / 0.35)" }}
      >
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
          <Link
            to={contentsHref}
            className="btn-ghost !min-h-0 !px-2 !py-1.5"
            aria-label="Back to contents"
          >
            <ChevronLeftIcon width={18} height={18} />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="label leading-none text-accent">// Operator Console</div>
            <div
              className="truncate font-display text-sm font-bold uppercase tracking-wide text-primary"
              style={{ textShadow: "0 0 12px rgb(var(--color-accent) / 0.4)" }}
            >
              Mastery Terminal
            </div>
          </div>
          <Link
            to={diagnosticHref}
            className="btn-secondary !min-h-0 shrink-0 !px-3 !py-1.5 text-[11px]"
          >
            {diagnosticDone ? "Retake warm-up ↻" : "Run warm-up ▸"}
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl space-y-6 px-4 py-6">
        {/* 1) Hero — operator desk readout */}
        <HudPanel tone="cyan" className="!bg-surface/85">
          <span className="label text-accent">// Your Desk · Read-Only</span>
          <h1
            className="mt-1 font-display text-2xl font-black uppercase tracking-wide text-primary sm:text-3xl"
            style={{ textShadow: "0 0 18px rgb(var(--color-accent) / 0.45)" }}
          >
            Mastery &amp; Calibration
          </h1>

          {!diagnosticDone && (
            <p
              className="mt-3 rounded-sm border px-3 py-2 text-sm leading-relaxed text-secondary"
              style={{
                borderColor: "rgb(var(--color-accent) / 0.5)",
                background: "rgb(var(--color-accent) / 0.06)",
              }}
            >
              Calibration warm-up offline — it tunes where your practice starts.{" "}
              <Link
                to={diagnosticHref}
                className="font-semibold text-accent underline underline-offset-2"
              >
                Run it now ▸
              </Link>
            </p>
          )}

          <div className="mt-4 grid gap-3 lg:grid-cols-[1.4fr_1fr]">
            <TargetPanel recommended={recommended} />
            <div className="grid grid-cols-3 gap-3">
              <Readout
                label="Reviews due"
                value={due.length}
                tone="magenta"
                hint="SM-2 spaced"
              />
              <Readout
                label="Weak signals"
                value={weaknesses.length}
                tone="cyan"
                hint="with evidence"
              />
              <Readout
                label="Topics"
                value={topics.length}
                tone="green"
                hint="in curriculum"
              />
            </div>
          </div>
        </HudPanel>

        {/* 2) Reviews due */}
        {due.length > 0 && (
          <HudPanel tone="magenta" label="// Resurfacing Queue · Due for Review">
            <ReviewQueue topics={due} />
          </HudPanel>
        )}

        {/* 3) Course readiness (Case A) or weakness ranking (Case B) */}
        {courseMode ? (
          <HudPanel
            tone="cyan"
            label="// Course Readiness · Mission Progress"
            right={
              <span className="label text-muted">{courses.length} courses</span>
            }
          >
            <CourseReadinessCards courses={courses} />
          </HudPanel>
        ) : (
          <HudPanel
            tone="cyan"
            label="// Threat Board · Weakest First by CI_low"
            right={
              <span className="label text-muted">{weaknesses.length} topics with evidence</span>
            }
          >
            <ThreatBoard topics={weaknesses} />
          </HudPanel>
        )}

        {/* 4) Reliability scope */}
        <HudPanel tone="magenta" label="// Calibration Scope · Reliability">
          <ReliabilityScope data={reliability} />
        </HudPanel>

        {/* 5) Per-topic grid */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <span className="label text-accent">// All Topics · Signal Grid</span>
            <span className="h-px flex-1 bg-subtle" />
          </div>
          {topics.length === 0 ? (
            <p className="text-sm text-secondary">No topics available.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {topics.map((t) => (
                <TopicNode key={t.topicKey} topic={t} />
              ))}
            </div>
          )}
        </section>

        {/* diagnostic nudge + back to contents */}
        <footer className="flex flex-col items-center gap-3 pt-2 sm:flex-row sm:justify-between">
          <Link
            to={diagnosticHref}
            className="label text-accent-2 underline underline-offset-4 hover:text-accent"
          >
            {diagnosticDone ? "▸ Retake the warm-up" : "▸ Run the calibration warm-up"}
          </Link>
          <Link
            to={contentsHref}
            className="label text-muted underline underline-offset-4 hover:text-accent"
          >
            ← Back to the Neon District
          </Link>
        </footer>
      </main>
    </div>
  );
}
