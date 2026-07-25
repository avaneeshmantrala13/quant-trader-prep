import type { CSSProperties, ReactElement } from "react";
import { Link } from "react-router-dom";
import { MASTERY_BAR } from "@/lib/mastery/config";
import { ChevronLeftIcon } from "@/components/icons";
import type { MasteryState } from "@/lib/mastery/verdict";
import type { ReliabilityDiagramData } from "@/lib/calibration/reliability";
import type { DashboardTopicEntry, DashboardViewProps } from "../types";
import { Cheeks, Eyes, INK, KidsAnimations, Smile, Twinkle } from "./animations";
import { KidsBackground } from "./Background";
import { Star } from "./TocArt";

/**
 * KIDS / CARTOON — Mastery Dashboard (`/dashboard`).
 *
 * A joyful "My Progress Adventure" report card. Every Phase-5 signal is dressed
 * up as something a kid would cheer for: mastery becomes a chunky candy progress
 * meter (with a 95%-confidence "wiggle band" and a gold-star goal flag at 0.80),
 * the STRONG / WEAK / UNCERTAIN verdict becomes a friendly character badge
 * (Superstar / Keep Growing / Still Exploring — the last kept encouraging and
 * FIRST-CLASS, never rounded away), misconceptions become gentle "puzzles to
 * practice" stickers, and the reliability diagram becomes a cheerful "do you
 * know what you know?" chart with an honest, kind empty state.
 *
 * PURE presentational consumer of `DashboardViewProps`: no data, no mastery
 * math, no route building — every link uses the provided `href`. All text sits
 * on token surfaces (candy colors are decoration/meaning only) so body,
 * secondary, muted, on-accent, and badge text all pass WCAG-AA in light + dark.
 * Responsive 360px → ≥1280px; motion is transform/opacity-only and respects
 * `prefers-reduced-motion` via the shared `kids-anim` freeze rule.
 */

const pct = (x: number) => Math.round(x * 100);

/** Candy accents cycled per topic card (decoration only — text stays on tokens). */
const TRACK_COLORS = ["#5aa9ff", "#57c785", "#f472b6", "#ff9f45", "#a78bfa"];

const GOLD = "#ffcf4d";
const CRM = "#fff4e0";
const GRN = "#57c785";
const GRN2 = "#8bd6a3";
const BLU = "#5aa9ff";
const ORG = "#ff9f45";
const RED = "#ff6b6b";

/* -------------------------------------------------------------------------- */
/*  Friendly character mascots (decorative; reuse the shared face primitives)  */
/* -------------------------------------------------------------------------- */

type MascotProps = { className?: string };

/** STRONG — a beaming gold star. */
function StarBuddy({ className }: MascotProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <g
        className="kids-anim"
        style={
          {
            transformBox: "fill-box",
            transformOrigin: "center",
            animation: "kids-bob 3s ease-in-out infinite",
          } as CSSProperties
        }
      >
        <path
          d="M24 4 L30 18 L45 19.2 L33.6 29 L37.2 44 L24 35.6 L10.8 44 L14.4 29 L3 19.2 L18 18 Z"
          fill={GOLD}
          stroke={INK}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        <Eyes cx={24} cy={22} gap={5.5} r={4} blink />
        <Smile cx={24} cy={28} w={6} depth={4} />
      </g>
    </svg>
  );
}

/** UNCERTAIN — a curious magnifying glass (still gathering clues). */
function ExplorerBuddy({ className }: MascotProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <g
        className="kids-anim"
        style={
          {
            transformBox: "fill-box",
            transformOrigin: "center",
            animation: "kids-jiggle 3.4s ease-in-out infinite",
          } as CSSProperties
        }
      >
        <line x1={33} y1={33} x2={44} y2={44} stroke={INK} strokeWidth={5} strokeLinecap="round" />
        <circle cx={20} cy={20} r={15} fill={CRM} stroke={INK} strokeWidth={3} />
        <circle cx={20} cy={20} r={15} fill="none" stroke={BLU} strokeWidth={2} opacity={0.9} />
        <Eyes cx={20} cy={18} gap={5} r={4} blink />
        <Smile cx={20} cy={24} w={6} depth={4} />
      </g>
    </svg>
  );
}

/** WEAK — a hopeful little sprout (a bit more practice and it blooms). */
function SproutBuddy({ className }: MascotProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <g
        className="kids-anim"
        style={
          {
            transformBox: "fill-box",
            transformOrigin: "center bottom",
            animation: "kids-sway 3.2s ease-in-out infinite",
          } as CSSProperties
        }
      >
        <path d="M24 44 V26" stroke={GRN} strokeWidth={4} strokeLinecap="round" />
        <path
          d="M24 30 C 12 28 10 17 10 17 C 21 17 24 24 24 30 Z"
          fill={GRN}
          stroke={INK}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        <path
          d="M24 26 C 36 24 38 13 38 13 C 27 13 24 20 24 26 Z"
          fill={GRN2}
          stroke={INK}
          strokeWidth={2}
          strokeLinejoin="round"
        />
      </g>
      <path
        d="M15 34 h18 l-2 11 a3 3 0 0 1 -3 2.6 h-8 a3 3 0 0 1 -3 -2.6 Z"
        fill={ORG}
        stroke={INK}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Cheeks cx={24} cy={42} gap={8} r={2.6} />
      <Eyes cx={24} cy={40} gap={4.5} r={3} blink />
      <Smile cx={24} cy={44} w={4} depth={2.5} />
    </svg>
  );
}

/** Reviews — a cheerful ringing bell. */
function BellBuddy({ className }: MascotProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <g
        className="kids-anim"
        style={
          {
            transformBox: "fill-box",
            transformOrigin: "24px 8px",
            animation: "kids-sway 1.8s ease-in-out infinite",
          } as CSSProperties
        }
      >
        <circle cx={24} cy={8} r={3} fill={ORG} stroke={INK} strokeWidth={2} />
        <path
          d="M24 10 C 34 10 35 20 35 27 L 38 34 H 10 L 13 27 C 13 20 14 10 24 10 Z"
          fill={GOLD}
          stroke={INK}
          strokeWidth={2.4}
          strokeLinejoin="round"
        />
        <Eyes cx={24} cy={23} gap={5} r={3.6} blink />
        <Smile cx={24} cy={28} w={5.5} depth={3.5} />
      </g>
      <circle cx={24} cy={40} r={3.4} fill={INK} />
    </svg>
  );
}

/** Next quest — a little rocket. */
function RocketBuddy({ className }: MascotProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <g
        className="kids-anim"
        style={
          {
            transformBox: "fill-box",
            transformOrigin: "center",
            animation: "kids-float 3.6s ease-in-out infinite",
          } as CSSProperties
        }
      >
        <path
          d="M13 32 L20 32 L18 40 Z"
          fill={RED}
          stroke={INK}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        <path
          d="M35 32 L28 32 L30 40 Z"
          fill={RED}
          stroke={INK}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        <path
          d="M24 3 C 32 10 32 26 29 35 H 19 C 16 26 16 10 24 3 Z"
          fill={BLU}
          stroke={INK}
          strokeWidth={2.4}
          strokeLinejoin="round"
        />
        <circle cx={24} cy={18} r={5.5} fill={CRM} stroke={INK} strokeWidth={2} />
        <Eyes cx={24} cy={17.5} gap={3} r={2.3} />
        <path
          className="kids-anim"
          style={
            {
              transformBox: "fill-box",
              transformOrigin: "center top",
              animation: "kids-pulse 0.6s ease-in-out infinite",
            } as CSSProperties
          }
          d="M20.5 35 Q24 48 27.5 35 Z"
          fill={ORG}
          stroke={INK}
          strokeWidth={1.6}
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

/** Free-explore / calibration — a friendly bullseye. */
function TargetBuddy({ className }: MascotProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <g
        className="kids-anim"
        style={
          {
            transformBox: "fill-box",
            transformOrigin: "center",
            animation: "kids-bob 3.2s ease-in-out infinite",
          } as CSSProperties
        }
      >
        <circle cx={24} cy={24} r={19} fill={RED} stroke={INK} strokeWidth={2.6} />
        <circle cx={24} cy={24} r={13} fill={CRM} stroke={INK} strokeWidth={2} />
        <circle cx={24} cy={24} r={7} fill={BLU} stroke={INK} strokeWidth={2} />
        <Eyes cx={24} cy={22} gap={4} r={3} blink />
        <Smile cx={24} cy={26} w={5} depth={3} />
      </g>
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  Verdict styling (STRONG / WEAK / UNCERTAIN as friendly, distinct badges)   */
/* -------------------------------------------------------------------------- */

interface VerdictStyle {
  label: string;
  note: string;
  text: string;
  border: string;
  soft: string;
  fill: string;
  band: string;
  Mascot: (p: MascotProps) => ReactElement;
}

const VERDICT: Record<MasteryState, VerdictStyle> = {
  STRONG: {
    label: "Superstar!",
    note: "You've got this down.",
    text: "text-bull",
    border: "border-bull",
    soft: "bg-success-soft",
    fill: "bg-bull",
    band: "bg-bull/25",
    Mascot: StarBuddy,
  },
  UNCERTAIN: {
    label: "Still Exploring",
    note: "Keep gathering clues!",
    text: "text-accent",
    border: "border-accent",
    soft: "bg-accent/10",
    fill: "bg-accent",
    band: "bg-accent/25",
    Mascot: ExplorerBuddy,
  },
  WEAK: {
    label: "Keep Growing",
    note: "A little more practice.",
    text: "text-accent-2",
    border: "border-accent-2",
    soft: "bg-accent-2/10",
    fill: "bg-accent-2",
    band: "bg-accent-2/25",
    Mascot: SproutBuddy,
  },
};

function VerdictBadge({ state, size = "sm" }: { state: MasteryState; size?: "sm" | "lg" }) {
  const v = VERDICT[state];
  const M = v.Mascot;
  const big = size === "lg";
  return (
    <span
      className={[
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border-2 font-display font-black",
        v.border,
        v.soft,
        v.text,
        big ? "px-3 py-1 text-sm" : "px-2.5 py-1 text-xs",
      ].join(" ")}
      title={`${v.label} — ${v.note}`}
    >
      <M className={big ? "h-6 w-6" : "h-5 w-5"} />
      {v.label}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Mastery meter — progress fill + 95% CI "wiggle band" + 0.80 goal flag      */
/* -------------------------------------------------------------------------- */

function MasteryMeter({ entry }: { entry: DashboardTopicEntry }) {
  const v = VERDICT[entry.verdict];
  const goal = MASTERY_BAR * 100;
  const { hasEvidence, mean, ciLow, ciHigh } = entry;

  return (
    <div>
      {/* extra top room so the goal flag never clips */}
      <div className="relative pt-5">
        {/* 0.80 gold-star goal flag */}
        <div
          className="pointer-events-none absolute top-0 z-10 flex -translate-x-1/2 flex-col items-center"
          style={{ left: `${goal}%` }}
          title={`Goal: ${pct(MASTERY_BAR)}% mastery`}
        >
          <Star filled size={15} />
          <span className="mt-[-1px] h-3 w-[3px] rounded-full bg-border-strong" />
        </div>

        <div className="relative h-6 w-full overflow-hidden rounded-full border-[3px] border-border-strong bg-surface-muted">
          {hasEvidence ? (
            <>
              {/* 95% credible-interval "wiggle band" */}
              <div
                className={`absolute inset-y-0 ${v.band}`}
                style={{
                  left: `${ciLow * 100}%`,
                  width: `${Math.max(ciHigh - ciLow, 0) * 100}%`,
                }}
                aria-hidden="true"
              />
              {/* solid progress fill up to the mean */}
              <div
                className={`absolute inset-y-0 left-0 ${v.fill}`}
                style={{ width: `${mean * 100}%` }}
                aria-hidden="true"
              />
              {/* mean marker bubble */}
              <div
                className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-border-strong bg-surface"
                style={{ left: `${mean * 100}%` }}
                aria-hidden="true"
              />
            </>
          ) : (
            <div className="grid h-full place-items-center text-[10px] font-extrabold uppercase tracking-wide text-muted">
              Not started yet
            </div>
          )}
          {/* 0.80 goal line */}
          <div
            className="absolute inset-y-0 w-[3px] bg-border-strong/70"
            style={{ left: `${goal}%` }}
            aria-hidden="true"
          />
        </div>
      </div>

      <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-2">
        <span className="font-display text-sm font-black text-primary">
          {hasEvidence ? `${pct(mean)}% mastered` : "Let's begin!"}
        </span>
        {hasEvidence && (
          <span className="text-[11px] font-bold text-muted">
            range {pct(ciLow)}–{pct(ciHigh)}% · goal {pct(MASTERY_BAR)}%
          </span>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Small shared bits                                                          */
/* -------------------------------------------------------------------------- */

function SectionHeading({ title, kicker }: { title: string; kicker?: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Star filled size={18} />
      <div>
        <h2 className="font-display text-lg font-black leading-tight text-primary sm:text-xl">
          {title}
        </h2>
        {kicker && (
          <p className="text-xs font-bold uppercase tracking-wide text-muted">{kicker}</p>
        )}
      </div>
    </div>
  );
}

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`relative overflow-hidden rounded-[24px] border-[3px] border-border-strong bg-surface p-4 sm:p-5 ${className}`}
    >
      {children}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Root                                                                       */
/* -------------------------------------------------------------------------- */

export function KidsDashboard({
  diagnosticDone,
  diagnosticHref,
  contentsHref,
  recommended,
  topics,
  weaknesses,
  due,
  reliability,
}: DashboardViewProps) {
  const superstars = topics.filter((t) => t.verdict === "STRONG").length;
  const exploring = topics.filter((t) => t.verdict === "UNCERTAIN").length;
  const growing = topics.filter((t) => t.verdict === "WEAK").length;

  return (
    <div className="relative min-h-[100dvh] font-sans text-primary">
      <KidsAnimations />
      <KidsBackground />

      {/* Sticky candy header */}
      <header className="sticky top-0 z-20 border-b-[3px] border-border-strong bg-bg/85 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 sm:px-6">
          <Link
            to={contentsHref}
            aria-label="Back to contents"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-[3px] border-border-strong bg-surface text-primary transition-transform hover:-translate-y-0.5"
          >
            <ChevronLeftIcon width={20} height={20} />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-base font-black text-primary">
              My Progress Adventure
            </div>
          </div>
          <Link
            to={diagnosticHref}
            className="shrink-0 rounded-full border-[3px] border-border-strong bg-surface px-3 py-1.5 font-display text-xs font-black text-primary transition-transform hover:-translate-y-0.5"
          >
            {diagnosticDone ? "Retake warm-up ↻" : "Run warm-up ▸"}
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        {/* 1) Hero: title + diagnostic nudge + next quest + reviews + tally */}
        <Hero
          diagnosticDone={diagnosticDone}
          diagnosticHref={diagnosticHref}
          recommended={recommended}
          dueCount={due.length}
          superstars={superstars}
          exploring={exploring}
          growing={growing}
          totalTopics={topics.length}
        />

        {/* 2) Reviews due */}
        {due.length > 0 && (
          <Panel>
            <SectionHeading title="Time to Revisit!" kicker="Come back and keep your stars shiny" />
            <ReviewsDueList topics={due} />
          </Panel>
        )}

        {/* 3) Weakness ranking (kindly framed) */}
        <Panel>
          <SectionHeading
            title="Where to Grow Next"
            kicker={`${weaknesses.length} topic${weaknesses.length === 1 ? "" : "s"} with clues so far`}
          />
          <WeaknessList topics={weaknesses} />
        </Panel>

        {/* 4) Reliability diagram */}
        <Panel>
          <SectionHeading
            title="Do You Know What You Know?"
            kicker="How your confidence matches how often you're right"
          />
          <ReliabilityChart data={reliability} />
        </Panel>

        {/* 5) Per-topic cards */}
        <section>
          <SectionHeading title="All My Topics" kicker="Your whole adventure map" />
          {topics.length === 0 ? (
            <Panel>
              <p className="text-sm font-semibold text-secondary">
                No topics yet — pick a world to start your adventure!
              </p>
            </Panel>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {topics.map((t, i) => (
                <TopicCard
                  key={t.topicKey}
                  topic={t}
                  color={TRACK_COLORS[i % TRACK_COLORS.length]}
                />
              ))}
            </div>
          )}
        </section>

        {/* 6) Footer: diagnostic nudge + back to contents */}
        <FooterNudge
          diagnosticDone={diagnosticDone}
          diagnosticHref={diagnosticHref}
          contentsHref={contentsHref}
        />
      </main>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Hero                                                                       */
/* -------------------------------------------------------------------------- */

function Hero({
  diagnosticDone,
  diagnosticHref,
  recommended,
  dueCount,
  superstars,
  exploring,
  growing,
  totalTopics,
}: {
  diagnosticDone: boolean;
  diagnosticHref: string;
  recommended?: DashboardViewProps["recommended"];
  dueCount: number;
  superstars: number;
  exploring: number;
  growing: number;
  totalTopics: number;
}) {
  return (
    <Panel className="!p-5 sm:!p-7">
      {/* soft candy wash */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 80% at 12% 0%, rgba(90,169,255,0.16), transparent 70%)," +
            "radial-gradient(55% 80% at 88% 10%, rgba(244,114,182,0.16), transparent 70%)," +
            "radial-gradient(60% 90% at 70% 100%, rgba(87,199,133,0.14), transparent 70%)",
        }}
      />

      <div className="relative">
        <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-border-strong bg-surface-muted px-3 py-0.5 text-xs font-extrabold uppercase tracking-wide text-secondary">
          <Star filled size={13} /> Progress Report · Just for You
        </span>
        <h1 className="mt-2 font-display text-3xl font-black leading-tight text-primary sm:text-4xl">
          My Progress Adventure
        </h1>
        <p className="mt-1 max-w-xl text-sm font-semibold text-secondary sm:text-base">
          See how far you've come, spot what to practice next, and collect stars
          along the way!
        </p>

        {!diagnosticDone && (
          <div className="mt-4 flex flex-col gap-3 rounded-[18px] border-[3px] border-accent bg-accent/10 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <TargetBuddy className="h-11 w-11 shrink-0" />
              <p className="text-sm font-bold text-secondary">
                Try the warm-up quiz first — it finds the perfect place for you to
                start!
              </p>
            </div>
            <Link
              to={diagnosticHref}
              className="shrink-0 rounded-full border-[3px] border-border-strong bg-accent px-4 py-2 text-center font-display text-sm font-black text-accent-contrast transition-transform hover:-translate-y-0.5"
            >
              Play warm-up ▸
            </Link>
          </div>
        )}

        {/* Next quest + reviews */}
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <NextQuestCard recommended={recommended} />
          <ReviewsCountCard dueCount={dueCount} />
        </div>

        {/* Tally stickers */}
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <TallySticker
            value={superstars}
            label="Superstars"
            Mascot={StarBuddy}
            tint="border-bull"
          />
          <TallySticker
            value={exploring}
            label="Exploring"
            Mascot={ExplorerBuddy}
            tint="border-accent"
          />
          <TallySticker
            value={growing}
            label="Growing"
            Mascot={SproutBuddy}
            tint="border-accent-2"
          />
          <TallySticker
            value={totalTopics}
            label="Topics"
            Mascot={TargetBuddy}
            tint="border-border-strong"
          />
        </div>
      </div>
    </Panel>
  );
}

function NextQuestCard({
  recommended,
}: {
  recommended?: DashboardViewProps["recommended"];
}) {
  return (
    <div className="relative overflow-hidden rounded-[20px] border-[3px] border-border-strong bg-surface-raised p-4 lg:col-span-2">
      <div className="flex items-start gap-3">
        <div
          className="grid h-14 w-14 shrink-0 place-items-center rounded-[16px] border-[3px] border-border-strong bg-surface"
          aria-hidden="true"
        >
          <RocketBuddy className="h-11 w-11" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-extrabold uppercase tracking-wide text-muted">
            Your next quest
          </div>
          {recommended ? (
            <>
              <div className="mt-0.5 font-display text-xl font-black leading-tight text-primary">
                {recommended.name}
              </div>
              <div className="text-xs font-bold text-secondary">
                {recommended.trackTitle} · confidence so far {pct(recommended.ciLow)}%
              </div>
              <Link
                to={recommended.href}
                className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-full border-[3px] border-border-strong bg-accent px-4 py-2.5 font-display text-sm font-black text-accent-contrast transition-transform hover:-translate-y-0.5"
              >
                Practice {recommended.name} ▸
              </Link>
            </>
          ) : (
            <p className="mt-1 text-sm font-semibold text-secondary">
              No clear weak spot yet — you're free to explore any world you like!
              Try a new topic or run the warm-up to find your starting point.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewsCountCard({ dueCount }: { dueCount: number }) {
  return (
    <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-[20px] border-[3px] border-border-strong bg-surface-raised p-4 text-center">
      <BellBuddy className="h-12 w-12" />
      <div className="mt-1 font-display text-4xl font-black text-primary">{dueCount}</div>
      <div className="text-xs font-extrabold uppercase tracking-wide text-muted">
        Reviews due
      </div>
      <p className="mt-1 text-[11px] font-semibold text-secondary">
        Mastered topics pop back up on their spaced-review schedule.
      </p>
    </div>
  );
}

function TallySticker({
  value,
  label,
  Mascot,
  tint,
}: {
  value: number;
  label: string;
  Mascot: (p: MascotProps) => ReactElement;
  tint: string;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-[16px] border-[3px] ${tint} bg-surface px-3 py-2`}
    >
      <Mascot className="h-8 w-8 shrink-0" />
      <div className="min-w-0 leading-tight">
        <div className="font-display text-xl font-black text-primary">{value}</div>
        <div className="truncate text-[10px] font-extrabold uppercase tracking-wide text-muted">
          {label}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Reviews due list                                                           */
/* -------------------------------------------------------------------------- */

function ReviewsDueList({ topics }: { topics: DashboardTopicEntry[] }) {
  return (
    <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      {topics.map((t) => (
        <li
          key={t.topicKey}
          className="flex items-center justify-between gap-3 rounded-[16px] border-[3px] border-accent bg-accent/10 px-3 py-2.5"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <BellBuddy className="h-9 w-9 shrink-0" />
            <div className="min-w-0">
              <div className="truncate font-display text-sm font-black text-primary">
                {t.name}
              </div>
              <div className="truncate text-[11px] font-bold text-muted">
                {t.trackTitle}
              </div>
            </div>
          </div>
          <Link
            to={t.href}
            className="shrink-0 rounded-full border-[3px] border-border-strong bg-surface px-3 py-1.5 font-display text-xs font-black text-primary transition-transform hover:-translate-y-0.5"
          >
            Revisit ▸
          </Link>
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */
/*  Weakness ranking (kindly)                                                  */
/* -------------------------------------------------------------------------- */

function WeaknessList({ topics }: { topics: DashboardTopicEntry[] }) {
  if (topics.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-[16px] border-[3px] border-dashed border-subtle bg-surface-muted p-4">
        <SproutBuddy className="h-12 w-12 shrink-0" />
        <p className="text-sm font-semibold text-secondary">
          No clues yet! Play a few rounds (or run the warm-up) and we'll gently
          point out the best spots to grow.
        </p>
      </div>
    );
  }
  return (
    <ol className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
      {topics.map((t, i) => (
        <li
          key={t.topicKey}
          className="flex items-center gap-3 rounded-[16px] border-[3px] border-border-strong bg-surface px-3 py-2.5"
        >
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-[3px] border-border-strong bg-surface-muted font-display text-sm font-black text-primary"
            aria-hidden="true"
          >
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-sm font-black text-primary">
              {t.name}
            </div>
            <div className="flex items-center gap-2">
              <span className="truncate text-[11px] font-bold text-muted">
                {t.trackTitle}
              </span>
              <span className={`shrink-0 text-[11px] font-black ${VERDICT[t.verdict].text}`}>
                {t.hasEvidence ? `${pct(t.ciLow)}% sure` : "new!"}
              </span>
            </div>
          </div>
          <Link
            to={t.href}
            aria-label={`Practice ${t.name}`}
            className="shrink-0 rounded-full border-[3px] border-border-strong bg-accent px-3 py-1.5 font-display text-xs font-black text-accent-contrast transition-transform hover:-translate-y-0.5"
          >
            Grow ▸
          </Link>
        </li>
      ))}
    </ol>
  );
}

/* -------------------------------------------------------------------------- */
/*  Reliability chart (cartoon)                                                */
/* -------------------------------------------------------------------------- */

const RSIZE = 220;
const RPAD = 30;
const rx = (p: number) => RPAD + p * (RSIZE - 2 * RPAD);
const ry = (p: number) => RSIZE - RPAD - p * (RSIZE - 2 * RPAD);

function ReliabilityChart({ data }: { data: ReliabilityDiagramData }) {
  if (data.count === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-[16px] border-[3px] border-dashed border-subtle bg-surface-muted p-6 text-center sm:flex-row sm:text-left">
        <TargetBuddy className="h-16 w-16 shrink-0" />
        <p className="max-w-md text-sm font-semibold text-secondary">
          This chart is still asleep! Play a few graded rounds and we'll show how
          often your "pretty sure" answers turn out right. We never make it up —
          it appears once you've collected some clues.
        </p>
      </div>
    );
  }

  const signed = data.bins.reduce(
    (s, b) => s + (b.count / data.count) * (b.predicted - b.observed),
    0,
  );
  const lean =
    Math.abs(signed) < 0.02 ? "spot" : signed > 0 ? "over" : "under";
  const leanText =
    lean === "spot"
      ? "Spot on!"
      : lean === "over"
        ? "A little over-sure"
        : "Braver than you think!";
  const leanCls =
    lean === "spot"
      ? "border-bull bg-success-soft text-bull"
      : lean === "over"
        ? "border-accent-2 bg-accent-2/10 text-accent-2"
        : "border-accent bg-accent/10 text-accent";

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <svg
        width={RSIZE}
        height={RSIZE}
        viewBox={`0 0 ${RSIZE} ${RSIZE}`}
        className="mx-auto shrink-0 sm:mx-0"
        role="img"
        aria-label="Chart: how sure you felt versus how often you were right"
      >
        {/* rounded candy plot frame */}
        <rect
          x={RPAD}
          y={RPAD}
          width={RSIZE - 2 * RPAD}
          height={RSIZE - 2 * RPAD}
          rx={12}
          fill="rgb(var(--color-surface-muted))"
          stroke="rgb(var(--color-border-strong))"
          strokeWidth={2}
        />
        {/* soft grid */}
        {[0.25, 0.5, 0.75].map((g) => (
          <g key={g} stroke="rgb(var(--color-border-strong))" strokeOpacity={0.18} strokeWidth={1}>
            <line x1={rx(g)} y1={ry(0)} x2={rx(g)} y2={ry(1)} />
            <line x1={rx(0)} y1={ry(g)} x2={rx(1)} y2={ry(g)} />
          </g>
        ))}
        {/* perfect-calibration diagonal */}
        <line
          x1={rx(0)}
          y1={ry(0)}
          x2={rx(1)}
          y2={ry(1)}
          stroke="rgb(var(--color-border-strong))"
          strokeDasharray="4 4"
          strokeWidth={2}
          strokeLinecap="round"
        />
        {/* learner curve */}
        <polyline
          points={data.bins.map((b) => `${rx(b.predicted)},${ry(b.observed)}`).join(" ")}
          fill="none"
          stroke="rgb(var(--color-accent))"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {data.bins.map((b, i) => (
          <circle
            key={i}
            cx={rx(b.predicted)}
            cy={ry(b.observed)}
            r={4 + Math.min(b.count, 40) / 12}
            fill={GOLD}
            stroke={INK}
            strokeWidth={1.6}
          >
            <title>
              felt {pct(b.predicted)}% sure · right {pct(b.observed)}% · {b.count} answers
            </title>
          </circle>
        ))}
        {/* axis labels */}
        <text
          x={RSIZE / 2}
          y={RSIZE - 8}
          textAnchor="middle"
          className="fill-current text-[9px] font-bold text-muted"
        >
          How sure you felt →
        </text>
        <text
          x={12}
          y={RSIZE / 2}
          textAnchor="middle"
          transform={`rotate(-90 12 ${RSIZE / 2})`}
          className="fill-current text-[9px] font-bold text-muted"
        >
          How often right →
        </text>
      </svg>

      <div className="min-w-0 space-y-2.5">
        {data.headline && (
          <p className="text-sm font-semibold text-secondary">
            When you feel about{" "}
            <span className="font-display font-black text-primary">80% sure</span>,
            you're right{" "}
            <span className="font-display font-black text-accent">
              {pct(data.headline.observed)}%
            </span>{" "}
            of the time!{" "}
            <span className="text-muted">({data.headline.count} answers)</span>
          </p>
        )}
        <div className="flex flex-wrap gap-1.5">
          <span
            className={`inline-flex items-center rounded-full border-2 px-2.5 py-0.5 font-display text-xs font-black ${leanCls}`}
          >
            {leanText}
          </span>
          <span className="inline-flex items-center rounded-full border-2 border-subtle bg-surface-muted px-2.5 py-0.5 text-[11px] font-bold text-secondary">
            match gap {data.relGap.toFixed(2)}
          </span>
          <span className="inline-flex items-center rounded-full border-2 border-subtle bg-surface-muted px-2.5 py-0.5 text-[11px] font-bold text-secondary">
            score {data.brier.toFixed(2)}
          </span>
        </div>
        <p className="text-xs font-semibold text-muted">
          Dots below the dashed line mean "a little too sure"; above means "you
          knew more than you thought!"
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Per-topic card                                                             */
/* -------------------------------------------------------------------------- */

function TopicCard({
  topic,
  color,
}: {
  topic: DashboardTopicEntry;
  color: string;
}) {
  return (
    <article
      className="relative flex flex-col gap-3 overflow-hidden rounded-[20px] border-[3px] bg-surface p-4"
      style={{ borderColor: color }}
    >
      {/* soft candy wash + side rail */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{ backgroundColor: color }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 w-2"
        style={{ backgroundColor: color }}
      />

      <header className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[11px] font-extrabold uppercase tracking-wide text-muted">
            {topic.trackTitle}
          </div>
          <h3 className="font-display text-base font-black leading-tight text-primary">
            {topic.name}
          </h3>
        </div>
        <VerdictBadge state={topic.verdict} />
      </header>

      <div className="relative">
        <MasteryMeter entry={topic} />
      </div>

      <div className="relative flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center rounded-full border-2 border-subtle bg-surface-muted px-2 py-0.5 text-[11px] font-bold text-secondary">
          skill θ {topic.theta.toFixed(2)}
        </span>
        <span className="inline-flex items-center rounded-full border-2 border-subtle bg-surface-muted px-2 py-0.5 text-[11px] font-bold text-muted">
          {topic.gradedCount} played
        </span>
        {topic.reviewDue && (
          <span className="inline-flex items-center gap-1 rounded-full border-2 border-accent bg-accent/10 px-2 py-0.5 text-[11px] font-black text-accent">
            <BellBuddy className="h-4 w-4" /> Revisit soon
          </span>
        )}
      </div>

      {topic.misconceptions.length > 0 && (
        <div className="relative">
          <div className="flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wide text-secondary">
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
              <Twinkle x={8} y={8} s={7} />
            </svg>
            Puzzles to practice
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {topic.misconceptions.map((m) => (
              <span
                key={m.key}
                className="inline-flex items-center rounded-full border-2 border-subtle bg-surface-muted px-2 py-0.5 text-[11px] font-bold text-secondary"
              >
                {m.label}
              </span>
            ))}
          </div>
        </div>
      )}

      <Link
        to={topic.href}
        aria-label={`Practice ${topic.name}`}
        className="relative mt-auto inline-flex w-full items-center justify-center gap-1 rounded-full border-[3px] border-border-strong bg-accent px-4 py-2.5 font-display text-sm font-black text-accent-contrast transition-transform hover:-translate-y-0.5"
      >
        Play this ▸
      </Link>
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/*  Footer nudge                                                               */
/* -------------------------------------------------------------------------- */

function FooterNudge({
  diagnosticDone,
  diagnosticHref,
  contentsHref,
}: {
  diagnosticDone: boolean;
  diagnosticHref: string;
  contentsHref: string;
}) {
  return (
    <Panel className="!p-5">
      <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
        <RocketBuddy className="h-14 w-14 shrink-0" />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-black text-primary">
            Ready for more adventure?
          </h2>
          <p className="text-sm font-semibold text-secondary">
            {diagnosticDone
              ? "Retake the warm-up any time to re-check your starting point, or hop back to the adventure menu."
              : "Run the warm-up to find your perfect starting point, or hop back to the adventure menu."}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <Link
            to={diagnosticHref}
            className="rounded-full border-[3px] border-border-strong bg-accent px-4 py-2 text-center font-display text-sm font-black text-accent-contrast transition-transform hover:-translate-y-0.5"
          >
            {diagnosticDone ? "Retake warm-up ↻" : "Run warm-up ▸"}
          </Link>
          <Link
            to={contentsHref}
            className="rounded-full border-[3px] border-border-strong bg-surface px-4 py-2 text-center font-display text-sm font-black text-primary transition-transform hover:-translate-y-0.5"
          >
            Adventure menu ▸
          </Link>
        </div>
      </div>
    </Panel>
  );
}
