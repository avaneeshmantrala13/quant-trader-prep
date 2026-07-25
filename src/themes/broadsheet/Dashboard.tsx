import { Link } from "react-router-dom";
import type {
  DashboardMisconception,
  DashboardTopicEntry,
  DashboardViewProps,
} from "../types";
import type { ReliabilityDiagramData } from "@/lib/calibration/reliability";
import type { MasteryState } from "@/lib/mastery/verdict";
import { MASTERY_BAR } from "@/lib/mastery/config";
import { ChevronLeftIcon } from "@/components/icons";
import { INK, BullBear, StockChart } from "./pageArt";

/**
 * BROADSHEET — the Mastery & Calibration dashboard rendered as a vintage
 * financial-newspaper "Markets & Analyst's Report" page ("The Quant Ledger").
 *
 * A serif masthead + dateline, thin column rules and hairlines (no gradient
 * cards), and an editorial ledger feel throughout: the recommended focus is the
 * front-page "Analyst's Call", the weakness ranking is a ruled "Watchlist", the
 * reviews-due list is the "Standing Orders" book, and the reliability diagram is
 * the "Calibration Report". Per-topic entries read like curated ledger listings
 * with a mean±CI mastery bar (0.80 par marked) and a distinct STRONG / WEAK /
 * UNCERTAIN verdict stamp (UNCERTAIN is first-class — never rounded away).
 *
 * PURE presentational consumer of `DashboardViewProps`: no data fetching, no
 * mastery math, no route building — it only styles what the page hands it and
 * links via each entry's own `href`.
 */

const pct = (x: number) => `${Math.round(x * 100)}%`;

/* ---------------------------- editorial ornaments ------------------------- */

function Fleuron({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill="none"
      stroke={INK}
      strokeWidth={0.9}
      aria-hidden="true"
    >
      <path d="M6 0.8 L11.2 6 L6 11.2 L0.8 6 Z" />
      <circle cx="6" cy="6" r="0.7" fill={INK} stroke="none" />
    </svg>
  );
}

function RuleWithFleuron({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 opacity-80 ${className}`}>
      <span className="h-px flex-1 bg-subtle" />
      <Fleuron />
      <span className="h-px flex-1 bg-subtle" />
    </div>
  );
}

/** Small-caps editorial section header with a rule under it. */
function SectionHead({
  kicker,
  title,
  aside,
}: {
  kicker: string;
  title: string;
  aside?: string;
}) {
  return (
    <header className="mb-3 border-b-[3px] border-border-strong pb-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="label text-accent">{kicker}</span>
        {aside && <span className="label text-muted">{aside}</span>}
      </div>
      <h2 className="mt-0.5 font-display text-xl font-black leading-tight text-primary sm:text-2xl">
        {title}
      </h2>
    </header>
  );
}

/* ------------------------------ verdict stamp ----------------------------- */

/**
 * The three FIRST-CLASS mastery states, each rendered as a distinct engraved
 * "stamp". UNCERTAIN gets its own dashed, accent-ochre treatment so it can never
 * be mistaken for a rounded STRONG or WEAK.
 */
const VERDICT: Record<
  MasteryState,
  { word: string; note: string; glyph: string; box: string; text: string }
> = {
  STRONG: {
    word: "Strong",
    note: "Position established",
    glyph: "▲",
    box: "border-bull bg-[rgb(var(--color-bull)/0.10)]",
    text: "text-bull",
  },
  WEAK: {
    word: "Weak",
    note: "Marked down",
    glyph: "▼",
    box: "border-bear bg-[rgb(var(--color-bear)/0.10)]",
    text: "text-bear",
  },
  UNCERTAIN: {
    word: "Uncertain",
    note: "Unconfirmed",
    glyph: "◆",
    box: "border-2 border-dashed border-accent bg-[rgb(var(--color-accent)/0.08)]",
    text: "text-accent",
  },
};

function VerdictStamp({ state }: { state: MasteryState }) {
  const v = VERDICT[state];
  return (
    <span
      title={`${v.word} — calibration-aware verdict (${v.note})`}
      className={`inline-flex shrink-0 items-center gap-1.5 border px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-label ${v.box} ${v.text}`}
    >
      <span aria-hidden="true">{v.glyph}</span>
      {v.word}
    </span>
  );
}

/* ------------------------------- mastery bar ------------------------------ */

/**
 * A ruled ledger gauge: the 95% credible-interval band, the posterior mean tick,
 * and the 0.80 "par" line the topic must clear to be considered mastered. Shows
 * an honest empty rail (no fabricated fill) until the topic has graded evidence.
 */
function MasteryBar({ topic }: { topic: DashboardTopicEntry }) {
  const has = topic.hasEvidence;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="label text-secondary">Mastery</span>
        <span className="num text-[13px] text-primary">
          {has ? pct(topic.mean) : "—"}
          {has && (
            <span className="ml-1 text-[11px] text-muted">
              (95% CI {pct(topic.ciLow)}–{pct(topic.ciHigh)})
            </span>
          )}
        </span>
      </div>
      <div className="relative mt-2 h-3 w-full border border-border-strong bg-surface-muted">
        {/* faint tick lattice so the rail reads like a ledger gauge */}
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, rgb(var(--color-border)/0.9) 0, rgb(var(--color-border)/0.9) 1px, transparent 1px, transparent 20%)",
          }}
        />
        {has && (
          <div
            className="hatch absolute top-0 h-full"
            style={{
              left: `${topic.ciLow * 100}%`,
              width: `${Math.max(topic.ciHigh - topic.ciLow, 0) * 100}%`,
            }}
            title={`95% CI ${pct(topic.ciLow)}–${pct(topic.ciHigh)}`}
            aria-hidden="true"
          />
        )}
        {has && (
          <div
            className="absolute top-[-3px] h-[calc(100%+6px)] w-[2px] bg-primary"
            style={{ left: `${topic.mean * 100}%` }}
            title={`mean ${pct(topic.mean)}`}
            aria-hidden="true"
          />
        )}
        {/* 0.80 par line */}
        <div
          className="absolute top-[-5px] h-[calc(100%+10px)] w-px border-l border-dashed border-border-strong"
          style={{ left: `${MASTERY_BAR * 100}%` }}
          title={`par ${pct(MASTERY_BAR)}`}
          aria-hidden="true"
        />
      </div>
      <div className="mt-1 flex items-center justify-between">
        <span className="label text-[9px] text-muted">0%</span>
        <span
          className="label text-[9px] text-muted"
          style={{ marginRight: `${(1 - MASTERY_BAR) * 100}%` }}
        >
          ↑ Par {pct(MASTERY_BAR)}
        </span>
      </div>
    </div>
  );
}

/* ----------------------------- misconceptions ----------------------------- */

function Errata({ items }: { items: DashboardMisconception[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <span className="label text-bear">Errata &amp; Corrections</span>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {items.map((m) => (
          <span
            key={m.key}
            className="inline-flex items-center gap-1 border border-bear/60 px-2 py-0.5 text-[11px] italic leading-snug text-bear"
          >
            {m.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------- topic entry ----------------------------- */

function TopicEntry({ topic }: { topic: DashboardTopicEntry }) {
  return (
    <article className="flex break-inside-avoid flex-col gap-3 border border-subtle bg-surface p-4">
      <header className="flex items-start justify-between gap-2 border-b border-subtle pb-2">
        <div className="min-w-0">
          <span className="label text-muted">{topic.trackTitle}</span>
          <h3 className="font-display text-[17px] font-bold leading-tight text-primary">
            {topic.name}
          </h3>
        </div>
        <VerdictStamp state={topic.verdict} />
      </header>

      <MasteryBar topic={topic} />

      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className="chip border-subtle text-secondary"
          title="Elo skill (logit)"
        >
          θ {topic.theta.toFixed(2)}
        </span>
        <span className="chip border-subtle text-muted">
          {topic.gradedCount} graded
        </span>
        {topic.reviewDue && (
          <span className="chip border-accent text-accent">◷ Review due</span>
        )}
      </div>

      <Errata items={topic.misconceptions} />

      <Link
        to={topic.href}
        className="group mt-auto flex items-center justify-between border-t border-subtle pt-2 text-accent transition-colors hover:text-accent-hover"
      >
        <span className="label text-accent group-hover:text-accent-hover">
          Trade this topic
        </span>
        <span aria-hidden="true" className="font-mono text-sm">
          →
        </span>
      </Link>
    </article>
  );
}

/* ------------------------------ weakness ledger --------------------------- */

function WatchlistLedger({ topics }: { topics: DashboardTopicEntry[] }) {
  if (topics.length === 0) {
    return (
      <p className="text-sm italic text-secondary">
        No graded evidence on the tape yet — trade a few items (or run the
        warm-up) to rank your weak spots.
      </p>
    );
  }
  return (
    <ol className="border border-subtle">
      {/* column headings */}
      <li className="flex items-center gap-3 border-b-2 border-border-strong bg-surface-muted px-3 py-1.5">
        <span className="label w-6 shrink-0 text-[9px] text-muted">#</span>
        <span className="label flex-1 text-[9px] text-muted">Instrument</span>
        <span className="label shrink-0 text-[9px] text-muted">
          CI_low · band
        </span>
      </li>
      {topics.map((t, i) => (
        <li
          key={t.topicKey}
          className="border-b border-dotted border-subtle last:border-b-0"
        >
          <Link
            to={t.href}
            className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-surface-muted"
          >
            <span className="num w-6 shrink-0 text-xs font-semibold text-muted">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-primary">
                {t.name}
              </span>
              <span className="label text-muted">{t.trackTitle}</span>
            </span>
            <span className="shrink-0 text-right">
              <span className="num block text-sm font-semibold text-bear">
                {pct(t.ciLow)}
              </span>
              <span className="num block text-[11px] text-muted">
                {pct(t.ciLow)}–{pct(t.ciHigh)}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

/* --------------------------- standing orders (due) ------------------------ */

function StandingOrders({ topics }: { topics: DashboardTopicEntry[] }) {
  if (topics.length === 0) {
    return (
      <p className="text-sm italic text-secondary">
        The order book is clear — mastered topics resurface here on their SM-2
        spaced-review schedule.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-subtle border border-subtle">
      {topics.map((t) => (
        <li key={t.topicKey}>
          <Link
            to={t.href}
            className="flex items-center justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-surface-muted"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-primary">
                {t.name}
              </span>
              <span className="label text-muted">{t.trackTitle}</span>
            </span>
            <span className="label shrink-0 text-accent">Review →</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/* --------------------------- calibration report --------------------------- */

const SIZE = 236;
const PAD = 30;
const rx = (p: number) => PAD + p * (SIZE - 2 * PAD);
const ry = (p: number) => SIZE - PAD - p * (SIZE - 2 * PAD);

function CalibrationReport({ data }: { data: ReliabilityDiagramData }) {
  if (data.count === 0) {
    return (
      <div className="grid min-h-[200px] place-items-center border border-dashed border-border-strong bg-surface-muted p-6 text-center">
        <div className="max-w-sm">
          <span className="label text-muted">Insufficient Returns</span>
          <p className="mt-2 text-sm italic leading-relaxed text-secondary">
            No confidence data has crossed the wire yet. As you answer graded
            items this session, this column will report how often your
            ~80%-confidence calls actually pay out — no curve is printed until
            the figures are real.
          </p>
        </div>
      </div>
    );
  }

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
  const leanCls =
    lean === "over-confident"
      ? "border-bear text-bear"
      : lean === "under-confident"
        ? "border-accent text-accent"
        : "border-bull text-bull";

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="mx-auto shrink-0 border border-subtle bg-surface-raised sm:mx-0"
        role="img"
        aria-label="Calibration report: predicted confidence versus observed accuracy"
      >
        {/* faint ledger grid */}
        <g stroke="rgb(var(--color-border))" strokeWidth={0.5} strokeOpacity={0.7}>
          {[0.25, 0.5, 0.75].map((g) => (
            <line key={`v${g}`} x1={rx(g)} y1={ry(0)} x2={rx(g)} y2={ry(1)} />
          ))}
          {[0.25, 0.5, 0.75].map((g) => (
            <line key={`h${g}`} x1={rx(0)} y1={ry(g)} x2={rx(1)} y2={ry(g)} />
          ))}
        </g>
        {/* plot frame */}
        <rect
          x={PAD}
          y={PAD}
          width={SIZE - 2 * PAD}
          height={SIZE - 2 * PAD}
          fill="none"
          stroke={INK}
          strokeWidth={1.2}
        />
        {/* 45° perfect-calibration diagonal */}
        <line
          x1={rx(0)}
          y1={ry(0)}
          x2={rx(1)}
          y2={ry(1)}
          stroke={INK}
          strokeDasharray="3 3"
          strokeWidth={1}
        />
        {/* learner curve */}
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
            r={3 + Math.min(b.count, 40) / 10}
            fill="rgb(var(--color-accent))"
            stroke="rgb(var(--color-surface-raised))"
            strokeWidth={0.8}
          >
            <title>
              said {pct(b.predicted)} · right {pct(b.observed)} · n={b.count}
            </title>
          </circle>
        ))}
        <text
          x={SIZE / 2}
          y={SIZE - 8}
          textAnchor="middle"
          fill="rgb(var(--color-text-muted))"
          className="font-mono"
          style={{ fontSize: 9, letterSpacing: "0.1em" }}
        >
          PREDICTED CONFIDENCE →
        </text>
        <text
          x={11}
          y={SIZE / 2}
          textAnchor="middle"
          transform={`rotate(-90 11 ${SIZE / 2})`}
          fill="rgb(var(--color-text-muted))"
          className="font-mono"
          style={{ fontSize: 9, letterSpacing: "0.1em" }}
        >
          OBSERVED ACCURACY →
        </text>
      </svg>

      <div className="min-w-0 flex-1 space-y-3">
        {data.headline ? (
          <p className="border-l-2 border-border-strong pl-3 font-display text-base italic leading-snug text-primary">
            "When you call it <span className="num not-italic">~80%</span>,
            you're right{" "}
            <span className="num font-bold not-italic text-accent">
              {pct(data.headline.observed)}
            </span>{" "}
            of the time."
            <span className="mt-0.5 block font-sans text-[11px] not-italic text-muted">
              — the tape, n={data.headline.count}
            </span>
          </p>
        ) : (
          <p className="text-sm italic text-secondary">
            No calls have landed in the ~80% band yet.
          </p>
        )}
        <dl className="grid grid-cols-2 gap-px border border-subtle bg-subtle text-center">
          <div className="bg-surface px-2 py-2">
            <dt className="label text-[9px] text-muted">Brier gap</dt>
            <dd className="num mt-0.5 text-lg font-semibold text-primary">
              {data.relGap.toFixed(3)}
            </dd>
          </div>
          <div className="bg-surface px-2 py-2">
            <dt className="label text-[9px] text-muted">Brier score</dt>
            <dd className="num mt-0.5 text-lg font-semibold text-primary">
              {data.brier.toFixed(3)}
            </dd>
          </div>
        </dl>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`chip ${leanCls}`}>{lean}</span>
          <span className="num text-[11px] text-muted">
            {data.count} calls logged
          </span>
        </div>
        <p className="text-[11px] leading-relaxed text-muted">
          Points below the dashed diagonal read as over-confident; points above,
          under-confident.
        </p>
      </div>
    </div>
  );
}

/* ----------------------------------- root --------------------------------- */

export function BroadsheetDashboard({
  diagnosticDone,
  diagnosticHref,
  contentsHref,
  recommended,
  topics,
  weaknesses,
  due,
  reliability,
}: DashboardViewProps) {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="relative min-h-[100dvh] bg-bg">
      {/* Running head — sticky nameplate strip */}
      <header className="sticky top-0 z-20 border-b-[3px] border-border-strong bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2">
          <Link
            to={contentsHref}
            className="btn-ghost !min-h-0 !px-2 !py-1.5"
            aria-label="Back to contents"
          >
            <ChevronLeftIcon width={18} height={18} />
          </Link>
          <div className="min-w-0 flex-1 truncate font-display text-sm font-bold tracking-tight text-primary">
            The Quant Ledger
            <span className="ml-2 hidden font-sans text-[11px] font-normal uppercase tracking-label text-muted sm:inline">
              Markets &amp; Analyst's Report
            </span>
          </div>
          <Link
            to={diagnosticHref}
            className="btn-ghost !min-h-0 shrink-0 !px-2 !py-1.5 text-xs"
          >
            {diagnosticDone ? "Retake warm-up ↻" : "Run warm-up ▸"}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-7 px-4 py-6">
        {/* ===================== MASTHEAD ===================== */}
        <section className="panel-ruled overflow-hidden">
          <div className="flex items-center justify-between border-b border-subtle px-4 py-1.5">
            <span className="label text-[9px]">Vol. MMXXVI · The Desk</span>
            <span className="label text-[9px] text-accent">Read-Only Edition</span>
            <span className="label hidden text-[9px] sm:inline">
              Late Final
            </span>
          </div>
          <div className="px-4 py-6 text-center">
            <span className="label text-accent">Mastery &amp; Calibration</span>
            <h1 className="mt-1 font-display text-4xl font-black leading-none tracking-tight text-primary sm:text-6xl">
              Markets &amp; Analyst's Report
            </h1>
            <div className="mx-auto mt-3 flex max-w-md items-center justify-center gap-3 opacity-80">
              <span className="h-px flex-1 bg-border-strong" />
              <span className="label text-[9px] text-muted">{today}</span>
              <span className="h-px flex-1 bg-border-strong" />
            </div>
            <p className="mx-auto mt-3 max-w-2xl text-[14px] italic leading-relaxed text-secondary">
              A standing account of your positions across the curriculum — where
              conviction is earned, where it is merely claimed, and where the
              tape says to trade next.
            </p>
          </div>
          {/* engraved financial vignettes flanking the fold */}
          <div className="flex items-center justify-center gap-8 border-t border-subtle px-4 py-3">
            <BullBear w={112} />
            <span className="hidden sm:block">
              <StockChart w={120} />
            </span>
          </div>
        </section>

        {/* Diagnostic notice / bulletin */}
        {!diagnosticDone && (
          <aside className="flex items-start gap-3 border-y-2 border-accent bg-[rgb(var(--color-accent)/0.06)] px-4 py-3">
            <span className="label mt-0.5 shrink-0 text-accent">Bulletin</span>
            <p className="text-sm leading-relaxed text-secondary">
              You haven't filed the calibration warm-up yet — it sets where your
              practice opens.{" "}
              <Link
                to={diagnosticHref}
                className="font-semibold text-accent underline underline-offset-2 hover:text-accent-hover"
              >
                Run it now ▸
              </Link>
            </p>
          </aside>
        )}

        {/* ===================== ABOVE THE FOLD ===================== */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Lead story — the Analyst's Call */}
          <section className="panel p-5 lg:col-span-2">
            <SectionHead kicker="The Analyst's Call" title="Recommended Next Focus" />
            {recommended ? (
              <div className="sm:flex sm:items-end sm:justify-between sm:gap-6">
                <div className="min-w-0">
                  <span className="label text-muted">{recommended.trackTitle}</span>
                  <p className="mt-1 font-display text-2xl font-black leading-tight text-primary sm:text-3xl">
                    {recommended.name}
                  </p>
                  <p className="mt-2 max-w-prose text-sm italic leading-relaxed text-secondary">
                    Surfaced as the most confidently-weak position on the book —
                    its 95% floor sits lowest, so the desk recommends opening
                    here.
                  </p>
                  <div className="mt-3 inline-flex items-baseline gap-2 border border-border-strong px-3 py-1">
                    <span className="label text-[9px] text-muted">CI_low</span>
                    <span className="num text-xl font-bold text-bear">
                      {pct(recommended.ciLow)}
                    </span>
                  </div>
                </div>
                <Link
                  to={recommended.href}
                  className="btn-primary mt-4 w-full shrink-0 text-center text-sm sm:mt-0 sm:w-auto"
                >
                  Practice {recommended.name} ▸
                </Link>
              </div>
            ) : (
              <p className="text-sm italic leading-relaxed text-secondary">
                No clear weak spot on the tape yet — open a fresh topic, or file
                the calibration warm-up to seed your starting position.
              </p>
            )}
          </section>

          {/* Sidebar — Standing Orders count + status ticker */}
          <aside className="panel flex flex-col p-5">
            <SectionHead kicker="Standing Orders" title="Reviews Due" />
            <div className="flex items-baseline gap-3">
              <span className="num text-5xl font-black leading-none text-primary">
                {due.length}
              </span>
              <span className="label text-muted">
                {due.length === 1 ? "topic" : "topics"} on the book
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Mastered topics resurface on their SM-2 spaced-review schedule.
            </p>
            <RuleWithFleuron className="my-3" />
            <div className="flex items-center justify-between text-sm">
              <span className="label text-muted">Warm-up</span>
              <span
                className={`chip ${
                  diagnosticDone ? "border-bull text-bull" : "border-accent text-accent"
                }`}
              >
                {diagnosticDone ? "✦ Filed" : "◷ Pending"}
              </span>
            </div>
          </aside>
        </div>

        {/* ===================== DUE FOR REVIEW ===================== */}
        {due.length > 0 && (
          <section className="panel p-5">
            <SectionHead
              kicker="The Order Book"
              title="Due for Review"
              aside={`${due.length} standing`}
            />
            <StandingOrders topics={due} />
          </section>
        )}

        {/* ===================== WATCHLIST + CALIBRATION ===================== */}
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="panel p-5">
            <SectionHead
              kicker="The Watchlist"
              title="Weakest First"
              aside={`${weaknesses.length} with evidence`}
            />
            <p className="mb-3 text-[11px] italic text-muted">
              Ranked ascending by CI_low — the confidently-weak surface first.
            </p>
            <WatchlistLedger topics={weaknesses} />
          </section>

          <section className="panel p-5">
            <SectionHead kicker="The Tape" title="Calibration Report" />
            <CalibrationReport data={reliability} />
          </section>
        </div>

        {/* ===================== FULL LEDGER ===================== */}
        <section className="panel p-5">
          <SectionHead
            kicker="The Full Ledger"
            title="All Topics"
            aside={`${topics.length} listed`}
          />
          {topics.length === 0 ? (
            <p className="text-sm italic text-secondary">
              No topics listed on the ledger.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {topics.map((t) => (
                <TopicEntry key={t.topicKey} topic={t} />
              ))}
            </div>
          )}
        </section>

        {/* ===================== COLOPHON ===================== */}
        <footer className="space-y-3 pt-1">
          <div className="flex items-center justify-center gap-3 opacity-70">
            <span className="h-px w-16 bg-subtle" />
            <Fleuron />
            <span className="label text-[9px]">End of Report</span>
            <Fleuron />
            <span className="h-px w-16 bg-subtle" />
          </div>
          <div className="flex justify-center">
            <Link to={contentsHref} className="btn-secondary text-xs">
              ◂ Back to the Table of Contents
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
