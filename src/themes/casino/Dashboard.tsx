import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronLeftIcon } from "@/components/icons";
import { MASTERY_BAR, P_TARGET, P_TARGET_BAND } from "@/lib/mastery/config";
import type { MasteryState } from "@/lib/mastery/verdict";
import type { ReliabilityDiagramData } from "@/lib/calibration/reliability";
import type {
  DashboardMisconception,
  DashboardTopicEntry,
  DashboardViewProps,
} from "../types";
import { Chip, Club, Diamond, Heart, Spade } from "./suits";
import {
  CasinoOrnamentStyle,
  CornerFiligree,
  Gleam,
  GoldRule,
  GOLD,
  goldRing,
} from "./ornaments";

/**
 * CASINO — Mastery Dashboard (`/dashboard`).
 *
 * A high-roller's PLAYER-STATS SHEET on green felt: a gold-trimmed pit desk with
 * the recommended next hand, per-topic "seat" cards (mastery shown as a felt
 * chip-rail gauge with the 95% CI band + the 0.80 house line), calibration-aware
 * verdicts as elegant hand badges (UNCERTAIN is a first-class "Hand in Play"),
 * a "weakest hands" ranking, the review-due call list, and a felt reliability
 * table (predicted vs observed, honest when no hands have been dealt yet).
 *
 * PURE PRESENTATIONAL: it only styles the `DashboardViewProps` it receives — no
 * data, math, locking, or route building. Every link uses a provided `href`.
 * Tokens + shared classes keep it WCAG-AA in light/dark; nothing is flipped with
 * live text inside it, so no mirrored-glyph bugs.
 */

const pct = (x: number) => `${Math.round(x * 100)}%`;

/* -------------------------------------------------------------------------- */
/*  Verdict badge — three DISTINCT, first-class hand states                    */
/* -------------------------------------------------------------------------- */

const VERDICT: Record<
  MasteryState,
  { label: string; note: string; glyph: string; cls: string }
> = {
  STRONG: {
    label: "Made Hand",
    note: "Strong — proven above the house line",
    glyph: "♠",
    cls: "border-bull bg-bull/10 text-bull",
  },
  WEAK: {
    label: "Cold Deck",
    note: "Weak — confidently below the house line",
    glyph: "▼",
    cls: "border-bear bg-bear/10 text-bear",
  },
  UNCERTAIN: {
    label: "Hand in Play",
    note: "Uncertain — the hand has not been called yet",
    glyph: "◆",
    cls: "border-gold bg-gold/15 text-accent",
  },
};

function VerdictBadge({ state }: { state: MasteryState }) {
  const v = VERDICT[state];
  return (
    <span className={`chip shrink-0 ${v.cls}`} style={goldRing} title={v.note}>
      <span aria-hidden="true">{v.glyph}</span>
      {v.label}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Mastery gauge — a felt chip-rail with the 95% CI band + 0.80 house line    */
/* -------------------------------------------------------------------------- */

function MasteryRail({ topic }: { topic: DashboardTopicEntry }) {
  const { hasEvidence, mean, ciLow, ciHigh } = topic;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="label text-secondary">Hand Strength</span>
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
        className="relative mt-2 h-3.5 w-full rounded-full border border-gold/40 bg-surface-muted"
        style={goldRing}
      >
        {/* 95% credible-interval band — the felt "spread" of the hand. */}
        {hasEvidence && (
          <div
            className="absolute inset-y-0 rounded-full bg-gold/35"
            style={{
              left: `${ciLow * 100}%`,
              width: `${Math.max(ciHigh - ciLow, 0) * 100}%`,
            }}
            aria-hidden="true"
          />
        )}
        {/* Mean marker — a gold chip riding the rail. */}
        {hasEvidence && (
          <span
            className="absolute top-1/2 grid h-4 w-4 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-gold bg-gold"
            style={{ left: `${mean * 100}%`, ...goldRing }}
            title={`mean ${pct(mean)}`}
            aria-hidden="true"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-bg" />
          </span>
        )}
        {/* 0.80 "house line" — the mastery bar. */}
        <div
          className="absolute top-[-3px] h-[calc(100%+6px)] w-px bg-border-strong"
          style={{ left: `${MASTERY_BAR * 100}%` }}
          title={`house line ${pct(MASTERY_BAR)}`}
          aria-hidden="true"
        />
      </div>

      <div className="mt-1 flex justify-between">
        <span className="label text-[9px] text-muted">Fold</span>
        <span
          className="label text-[9px] text-accent"
          style={{ marginRight: `${(1 - MASTERY_BAR) * 100}%` }}
        >
          House line {pct(MASTERY_BAR)}
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Per-topic "seat" card                                                      */
/* -------------------------------------------------------------------------- */

function MisconceptionChips({ items }: { items: DashboardMisconception[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="label text-bear">Tells to fix</div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {items.map((m) => (
          <span key={m.key} className="chip border-bear/60 bg-bear/5 text-bear">
            {m.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function TopicSeat({ topic }: { topic: DashboardTopicEntry }) {
  return (
    <article
      className="panel relative flex flex-col gap-3 overflow-hidden p-4"
      style={goldRing}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="label text-muted">{topic.trackTitle}</div>
          <h3 className="truncate font-display text-base font-semibold text-primary">
            {topic.name}
          </h3>
        </div>
        <VerdictBadge state={topic.verdict} />
      </header>

      <MasteryRail topic={topic} />

      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className="chip border-gold/50 text-secondary"
          title="Elo skill (logit scale)"
        >
          θ {topic.theta.toFixed(2)}
        </span>
        <span className="chip border-gold/50 text-muted">
          {topic.gradedCount} dealt
        </span>
        {topic.reviewDue && (
          <span
            className="chip border-accent bg-gold/10 text-accent"
            style={goldRing}
          >
            <span aria-hidden="true">◉</span> Review due
          </span>
        )}
      </div>

      <MisconceptionChips items={topic.misconceptions} />

      <Link
        to={topic.href}
        className="btn-secondary mt-auto w-full text-center text-sm"
      >
        Play this hand ▸
      </Link>
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/*  Weakness ranking                                                           */
/* -------------------------------------------------------------------------- */

function WeaknessRanking({ topics }: { topics: DashboardTopicEntry[] }) {
  if (topics.length === 0) {
    return (
      <p className="text-sm text-secondary">
        No graded evidence yet — play a few hands (or run the warm-up) to rank
        where the house has the edge.
      </p>
    );
  }
  return (
    <ol
      className="overflow-hidden rounded-sm border border-gold/40"
      style={goldRing}
    >
      {topics.map((t, i) => (
        <li key={t.topicKey}>
          {i > 0 && <GoldRule />}
          <Link
            to={t.href}
            className="flex items-center justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-surface-muted"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="num grid h-8 w-8 shrink-0 place-items-center rounded-full border border-gold bg-surface-raised text-xs font-semibold text-primary"
                style={goldRing}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-primary">
                  {t.name}
                </div>
                <div className="label text-muted">{t.trackTitle}</div>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="num text-sm text-accent">
                CI_low {pct(t.ciLow)}
              </div>
              <div className="num text-xs text-muted">
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

function ReviewsCallList({ topics }: { topics: DashboardTopicEntry[] }) {
  if (topics.length === 0) {
    return (
      <p className="text-sm text-secondary">
        Nothing due for review — mastered hands resurface here on their SM-2
        schedule.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {topics.map((t) => (
        <li
          key={t.topicKey}
          className="flex items-center justify-between gap-3 rounded-sm border border-gold/50 bg-surface px-3 py-2.5"
          style={goldRing}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <Chip className="h-6 w-6 shrink-0 text-accent" />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-primary">
                {t.name}
              </div>
              <div className="label text-muted">{t.trackTitle}</div>
            </div>
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
/*  Reliability diagram — a felt calibration table                            */
/* -------------------------------------------------------------------------- */

const SIZE = 240;
const PAD = 30;
const sx = (p: number) => PAD + p * (SIZE - 2 * PAD);
const sy = (p: number) => SIZE - PAD - p * (SIZE - 2 * PAD);

function ReliabilityTable({ data }: { data: ReliabilityDiagramData }) {
  if (data.count === 0) {
    return (
      <div
        className="grid min-h-[180px] place-items-center rounded-sm border border-dashed border-gold/50 bg-surface-muted p-6 text-center"
        style={goldRing}
      >
        <div className="max-w-xs">
          <Chip className="mx-auto h-9 w-9 text-accent/70" />
          <div className="label mt-2 text-accent">No hands dealt yet</div>
          <p className="mt-2 text-sm text-secondary">
            Not enough data yet. As you answer graded items this session, we plot
            how often your ~80%-confidence calls are actually right.
          </p>
        </div>
      </div>
    );
  }

  // Net signed miscalibration → over/under-confidence read.
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
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="h-auto w-full max-w-[260px] shrink-0 sm:w-[240px]"
        role="img"
        aria-label="Reliability diagram: predicted confidence versus observed accuracy"
      >
        {/* Felt plot bed. */}
        <rect
          x={PAD}
          y={PAD}
          width={SIZE - 2 * PAD}
          height={SIZE - 2 * PAD}
          fill="rgb(var(--color-surface-muted))"
          stroke={GOLD}
          strokeOpacity={0.55}
          strokeWidth={1}
        />
        {/* 0.75–0.85 target band — where the "~80%" headline is read. */}
        <rect
          x={sx(P_TARGET_BAND[0])}
          y={PAD}
          width={sx(P_TARGET_BAND[1]) - sx(P_TARGET_BAND[0])}
          height={SIZE - 2 * PAD}
          fill={GOLD}
          fillOpacity={0.12}
        />
        {/* Quarter gridlines. */}
        {[0.25, 0.5, 0.75].map((g) => (
          <g key={g} stroke={GOLD} strokeOpacity={0.15} strokeWidth={1}>
            <line x1={sx(g)} y1={sy(0)} x2={sx(g)} y2={sy(1)} />
            <line x1={sx(0)} y1={sy(g)} x2={sx(1)} y2={sy(g)} />
          </g>
        ))}
        {/* 45° perfect-calibration diagonal. */}
        <line
          x1={sx(0)}
          y1={sy(0)}
          x2={sx(1)}
          y2={sy(1)}
          stroke={GOLD}
          strokeOpacity={0.6}
          strokeDasharray="4 3"
          strokeWidth={1}
        />
        {/* Learner curve. */}
        <polyline
          points={data.bins
            .map((b) => `${sx(b.predicted)},${sy(b.observed)}`)
            .join(" ")}
          fill="none"
          stroke="rgb(var(--color-accent))"
          strokeWidth={2}
        />
        {/* Chip points, sized by count. */}
        {data.bins.map((b, i) => (
          <circle
            key={i}
            cx={sx(b.predicted)}
            cy={sy(b.observed)}
            r={3 + Math.min(b.count, 40) / 10}
            fill="rgb(var(--color-accent))"
            stroke={GOLD}
            strokeWidth={0.8}
          >
            <title>
              said {pct(b.predicted)} · right {pct(b.observed)} · n={b.count}
            </title>
          </circle>
        ))}
        {/* Axis labels. */}
        <text
          x={SIZE / 2}
          y={SIZE - 8}
          textAnchor="middle"
          fill="rgb(var(--color-text-muted))"
          className="text-[9px]"
        >
          Predicted confidence →
        </text>
        <text
          x={12}
          y={SIZE / 2}
          textAnchor="middle"
          transform={`rotate(-90 12 ${SIZE / 2})`}
          fill="rgb(var(--color-text-muted))"
          className="text-[9px]"
        >
          Observed accuracy →
        </text>
      </svg>

      <div className="min-w-0 space-y-2.5">
        {data.headline && (
          <p className="text-sm text-primary">
            When you call{" "}
            <span className="num font-semibold">~{pct(P_TARGET)}</span>, you are
            right{" "}
            <span className="num font-semibold text-accent">
              {pct(data.headline.observed)}
            </span>{" "}
            of the time{" "}
            <span className="text-muted">(n={data.headline.count})</span>.
          </p>
        )}
        <div className="flex flex-wrap gap-1.5">
          <span className="chip border-gold/50 text-secondary">
            Brier gap {data.relGap.toFixed(3)}
          </span>
          <span className="chip border-gold/50 text-secondary">
            Brier {data.brier.toFixed(3)}
          </span>
          <span
            className={`chip ${
              lean === "over-confident"
                ? "border-bear bg-bear/10 text-bear"
                : lean === "under-confident"
                  ? "border-accent bg-gold/10 text-accent"
                  : "border-bull bg-bull/10 text-bull"
            }`}
            style={goldRing}
          >
            {lean}
          </span>
        </div>
        <p className="text-xs text-muted">
          Points below the gold line = over-confident; above = under-confident.
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

/** Section heading with a suit pip + a fading gold rule. */
function SectionRule({
  suit,
  children,
}: {
  suit: "spade" | "heart" | "diamond" | "club";
  children: ReactNode;
}) {
  const Pip =
    suit === "heart"
      ? Heart
      : suit === "diamond"
        ? Diamond
        : suit === "club"
          ? Club
          : Spade;
  const red = suit === "heart" || suit === "diamond";
  return (
    <div className="mb-3 flex items-center gap-3">
      <Pip className={`h-4 w-4 shrink-0 ${red ? "text-bear" : "text-accent"}`} />
      <h2 className="label whitespace-nowrap text-accent">{children}</h2>
      <GoldRule className="flex-1" />
    </div>
  );
}

export function CasinoDashboard({
  diagnosticDone,
  diagnosticHref,
  contentsHref,
  recommended,
  topics,
  weaknesses,
  due,
  reliability,
}: DashboardViewProps) {
  return (
    <div className="relative min-h-[100dvh] bg-bg">
      <CasinoOrnamentStyle />

      {/* Felt table backdrop — this route renders outside the app shell. */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, rgb(var(--color-border) / 0.05) 0 1px, transparent 1px 4px), repeating-linear-gradient(-45deg, rgb(var(--color-border) / 0.05) 0 1px, transparent 1px 4px)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 80% 60% at 50% 30%, rgb(var(--color-surface) / 0.5) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute inset-[10px] rounded-md md:inset-[20px]"
          style={{ border: "1px solid rgb(var(--color-gold) / 0.3)" }}
        />
      </div>

      {/* Gold-on-felt pit-desk header. */}
      <header className="sticky top-0 z-20 border-b border-gold/50 bg-surface">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5">
          <Link
            to={contentsHref}
            className="btn-ghost !min-h-0 !px-2 !py-1.5"
            aria-label="Back to contents"
          >
            <ChevronLeftIcon width={18} height={18} />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-sm font-semibold tracking-wide text-primary">
              Player Stats Sheet
            </div>
          </div>
          <Link
            to={diagnosticHref}
            className="btn-ghost !min-h-0 shrink-0 !px-2 !py-1.5 text-xs"
          >
            {diagnosticDone ? "Reshuffle warm-up ↻" : "Deal warm-up ▸"}
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-5xl space-y-6 px-4 py-6">
        {/* 1) Headline: recommended next hand + reviews-due + diagnostic nudge. */}
        <section
          className="panel relative overflow-hidden p-5 sm:p-7"
          style={goldRing}
        >
          <Gleam />
          <CornerFiligree />
          <div className="relative">
            <span className="label text-accent">The Pit · Read-Only</span>
            <h1 className="mt-1 font-display text-3xl font-black tracking-wide text-primary sm:text-4xl">
              Mastery &amp; Calibration
            </h1>

            {!diagnosticDone && (
              <p
                className="mt-3 rounded-sm border border-gold/60 bg-surface-raised px-3 py-2 text-sm text-secondary"
                style={goldRing}
              >
                You have not run the calibration warm-up yet — it sets where your
                table starts.{" "}
                <Link
                  to={diagnosticHref}
                  className="font-semibold text-accent underline underline-offset-2"
                >
                  Deal it now ▸
                </Link>
              </p>
            )}

            <div className="mt-4 grid gap-3 sm:grid-cols-5">
              {/* Recommended next focus. */}
              <div className="panel p-4 sm:col-span-3" style={goldRing}>
                <div className="label flex items-center gap-1.5 text-secondary">
                  <Spade className="h-3.5 w-3.5 text-accent" />
                  Recommended next hand
                </div>
                {recommended ? (
                  <>
                    <div className="mt-1 font-display text-lg font-semibold text-primary">
                      {recommended.name}
                    </div>
                    <div className="label text-muted">
                      {recommended.trackTitle} · CI_low {pct(recommended.ciLow)}
                    </div>
                    <Link
                      to={recommended.href}
                      className="btn-primary mt-3 block w-full text-center text-sm"
                    >
                      Ante up on {recommended.name} ▸
                    </Link>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-secondary">
                    No clear weak spot yet — explore a new table or deal the
                    warm-up to seed your starting point.
                  </p>
                )}
              </div>

              {/* Reviews due count. */}
              <div className="panel flex flex-col p-4 sm:col-span-2" style={goldRing}>
                <div className="label flex items-center gap-1.5 text-secondary">
                  <Chip className="h-3.5 w-3.5 text-accent" />
                  Reviews due
                </div>
                <div className="num mt-1 text-4xl font-semibold text-accent">
                  {due.length}
                </div>
                <p className="mt-auto pt-1 text-xs text-muted">
                  Mastered hands resurface on their SM-2 spaced-review schedule.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 2) Reviews due call list. */}
        {due.length > 0 && (
          <section className="panel p-5" style={goldRing}>
            <SectionRule suit="heart">Called Back for Review</SectionRule>
            <ReviewsCallList topics={due} />
          </section>
        )}

        {/* 3) Weakness ranking by CI_low. */}
        <section className="panel p-5" style={goldRing}>
          <SectionRule suit="club">Weakest Hands · by CI_low</SectionRule>
          <p className="-mt-1 mb-3 text-xs text-muted">
            {weaknesses.length} table{weaknesses.length === 1 ? "" : "s"} with
            evidence, worst-and-most-certain first.
          </p>
          <WeaknessRanking topics={weaknesses} />
        </section>

        {/* 4) Calibration reliability table. */}
        <section className="panel p-5" style={goldRing}>
          <SectionRule suit="diamond">Calibration · The House Ledger</SectionRule>
          <ReliabilityTable data={reliability} />
        </section>

        {/* 5) Per-topic seat cards. */}
        <section>
          <SectionRule suit="spade">Every Seat at the Table</SectionRule>
          {topics.length === 0 ? (
            <p className="text-sm text-secondary">No topics available.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {topics.map((t) => (
                <TopicSeat key={t.topicKey} topic={t} />
              ))}
            </div>
          )}
        </section>

        {/* 6) Diagnostic nudge + back to contents. */}
        <section
          className="panel flex flex-col items-center gap-3 p-5 text-center sm:flex-row sm:justify-between sm:text-left"
          style={goldRing}
        >
          <div>
            <div className="label text-accent">Tune Your Table</div>
            <p className="mt-1 text-sm text-secondary">
              {diagnosticDone
                ? "Re-deal the calibration warm-up any time to re-tune where your practice starts."
                : "Deal the calibration warm-up to tune where your practice starts."}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-center gap-2">
            <Link to={diagnosticHref} className="btn-primary text-sm">
              {diagnosticDone ? "Reshuffle warm-up ↻" : "Deal warm-up ▸"}
            </Link>
            <Link to={contentsHref} className="btn-secondary text-sm">
              ← Back to the Card Room
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
