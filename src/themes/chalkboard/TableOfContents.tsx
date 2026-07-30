import { Link } from "react-router-dom";
import type { CSSProperties } from "react";
import type { Difficulty } from "@/types/content";
import { MOTIF_ICON } from "@/components/icons";
import type {
  TocComingSoonTrack,
  TocLessonItem,
  TocTrack,
  TocViewProps,
} from "../types";
import { startsSection, TocSectionDivider } from "../tocSection";

/**
 * CHALKBOARD — Table of Contents (`/contents`).
 *
 * A classroom "course outline on the board": a hand-written syllabus where each
 * track is an underlined chalk UNIT heading with a doodle icon + chalk tagline,
 * and every lesson is a hand-written outline item with a chalk checkbox
 * (empty / ✓ when mastered / padlock when locked), chalk-star difficulty, a
 * scribbled question-count note, and the one-sentence description in chalk.
 * Per-track progress shows as a chalk "n/N" with a row of filled/hollow marks.
 *
 * Navigation + locking are OWNED BY THE PAGE — this only styles: unlocked /
 * mastered rows link via `lessonHref`; locked rows are visible but
 * non-interactive with a lock affordance (`isLocked`). Everything is
 * token-driven (chalk-white on slate in dark, ink on paper in light), WCAG-AA,
 * responsive 360px → ≥1280px, with a reduced-motion-safe chalk-draw-on for the
 * underlines and mastered checks.
 */

const STARS: Record<Difficulty, number> = {
  intro: 1,
  easy: 2,
  medium: 3,
  hard: 4,
  expert: 5,
};

const INK = "rgb(var(--color-border-strong))";
const ACC = "rgb(var(--color-accent))";
const MUTED = "rgb(var(--color-text-muted))";
const BULL = "rgb(var(--color-bull))";

/* -------------------------------------------------------------------------- */
/*  Chalk-draw animation (reduced-motion gated, injected once)                 */
/* -------------------------------------------------------------------------- */

const ANIM_CSS = `
@keyframes cbt-draw{from{stroke-dashoffset:var(--d,220)}to{stroke-dashoffset:0}}
.cbt-draw{stroke-dasharray:var(--d,220);stroke-dashoffset:0;animation:cbt-draw var(--t,1.3s) ease-out both}
@media (prefers-reduced-motion: reduce){.cbt-draw{animation:none}}
`;

function ChalkTocAnimations() {
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
        className="cbt-draw"
        style={drawVars(220, "1.2s", delay)}
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

/** A doodled chalk circle framing the track's motif icon. */
function ChalkIcon({ motif }: { motif: TocTrack["motif"] }) {
  const Icon = MOTIF_ICON[motif];
  return (
    <span className="relative grid h-12 w-12 shrink-0 place-items-center text-primary sm:h-14 sm:w-14">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 56 56"
        fill="none"
        aria-hidden="true"
      >
        <path
          className="cbt-draw"
          style={drawVars(190, "1.4s")}
          d="M28 4 C41 4 52 14 52 28 C52 42 41 52 28 52 C15 52 4 41 4 27 C4 14 15 4 28 4 Z"
          stroke={ACC}
          strokeOpacity={0.75}
          strokeWidth={2}
          strokeLinecap="round"
        />
      </svg>
      <Icon width={24} height={24} />
    </span>
  );
}

/** The lesson's state marker: number in a chalk box, ✓ when mastered, padlock when locked. */
function ChalkMarker({
  state,
  locked,
  index,
}: {
  state: TocLessonItem["state"];
  locked: boolean;
  index: number;
}) {
  const mastered = state === "mastered";
  const color = mastered ? BULL : locked ? MUTED : ACC;
  return (
    <svg
      width={44}
      height={44}
      viewBox="0 0 44 44"
      fill="none"
      className="shrink-0"
      aria-hidden="true"
    >
      {/* hand-drawn checkbox (slightly irregular) */}
      <path
        d="M8 7 L37 5.5 L39 37 L6.5 38.5 Z"
        stroke={color}
        strokeOpacity={locked ? 0.5 : 0.85}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {mastered ? (
        <path
          className="cbt-draw"
          style={drawVars(60, "0.7s")}
          d="M13 22 L20 30 L34 12"
          stroke={BULL}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : locked ? (
        <g stroke={MUTED} strokeWidth={2} strokeLinecap="round">
          <rect x={15} y={22} width={15} height={12} rx={2} fill="none" />
          <path d="M18 22 v-3 a4.5 4.5 0 0 1 9 0 v3" fill="none" />
          <circle cx={22.5} cy={28} r={1.4} fill={MUTED} stroke="none" />
        </g>
      ) : (
        <text
          x={22}
          y={29}
          textAnchor="middle"
          fontFamily="var(--font-display)"
          fontSize={18}
          fill={ACC}
        >
          {String(index + 1).padStart(2, "0")}
        </text>
      )}
    </svg>
  );
}

/** Difficulty as a row of five chalk stars. */
function DiffStars({
  difficulty,
  label,
}: {
  difficulty: Difficulty;
  label: string;
}) {
  const n = STARS[difficulty];
  return (
    <span
      className="inline-flex items-center gap-[1px] align-middle"
      title={`Difficulty: ${label}`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          aria-hidden="true"
          style={{
            fontSize: 12,
            lineHeight: 1,
            color: i <= n ? ACC : "rgb(var(--color-text-muted) / 0.45)",
          }}
        >
          {i <= n ? "★" : "☆"}
        </span>
      ))}
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** Per-track progress: "n/N" + a row of filled/hollow chalk marks. */
function ProgressBadge({
  mastered,
  total,
}: {
  mastered: number;
  total: number;
}) {
  return (
    <div className="hidden shrink-0 flex-col items-end sm:flex">
      <span className="label text-[9px]">Mastered</span>
      <span className="font-display text-3xl font-bold leading-none text-primary">
        {mastered}
        <span className="text-muted">/{total}</span>
      </span>
      <span className="mt-1.5 inline-flex gap-1" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className="block h-2 w-2 rounded-full border"
            style={{
              borderColor: INK,
              background: i < mastered ? BULL : "transparent",
              opacity: i < mastered ? 0.9 : 0.4,
            }}
          />
        ))}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Lesson row                                                                 */
/* -------------------------------------------------------------------------- */

function LessonRow({
  lesson,
  index,
  locked,
  href,
}: {
  lesson: TocLessonItem;
  index: number;
  locked: boolean;
  href: string;
}) {
  const mastered = lesson.state === "mastered";
  const countNote = `${lesson.questionCount} ${
    lesson.mode === "flashcard" ? "cards" : "Q"
  }`;

  const inner = (
    <>
      <ChalkMarker state={lesson.state} locked={locked} index={index} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <h3 className="font-display text-lg font-bold leading-tight text-primary">
            {lesson.title}
          </h3>
          <DiffStars
            difficulty={lesson.difficulty}
            label={lesson.difficultyLabel}
          />
          <span className="font-mono text-[11px] text-muted">— {countNote}</span>
          {mastered && (
            <span
              className="font-display text-sm font-semibold"
              style={{ color: BULL }}
            >
              ✓ mastered
            </span>
          )}
          {locked && (
            <span className="font-display text-sm text-muted">· locked</span>
          )}
        </div>
        <p className="mt-1 font-sans text-sm leading-relaxed text-secondary">
          {lesson.description}
        </p>
      </div>
      {!locked && (
        <span
          className="hidden shrink-0 self-center font-display text-base font-semibold text-accent sm:block"
          aria-hidden="true"
        >
          {mastered ? "review →" : "start →"}
        </span>
      )}
    </>
  );

  const row = "flex items-start gap-3 rounded-md px-2.5 py-3 sm:gap-4 sm:px-3";

  if (locked) {
    return (
      <li
        aria-disabled="true"
        title="Master the previous lesson to unlock"
        className={`${row} cursor-not-allowed opacity-60`}
      >
        {inner}
      </li>
    );
  }

  return (
    <li>
      <Link
        to={href}
        aria-label={`${lesson.title} — ${lesson.state}`}
        className={`${row} transition-colors hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:outline-none`}
      >
        {inner}
      </Link>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/*  Track (unit) section                                                        */
/* -------------------------------------------------------------------------- */

function TrackSection({
  track,
  unit,
  lessonHref,
  isLocked,
}: {
  track: TocTrack;
  unit: number;
  lessonHref: TocViewProps["lessonHref"];
  isLocked: TocViewProps["isLocked"];
}) {
  return (
    <section className="relative overflow-hidden rounded-lg border-2 border-border-strong/30 bg-surface">
      <div
        className="tex-grid pointer-events-none absolute inset-0 opacity-[0.1] dark:opacity-[0.07]"
        aria-hidden="true"
      />
      <header className="relative flex items-start gap-3 p-4 sm:gap-4 sm:p-6">
        <ChalkIcon motif={track.motif} />
        <div className="min-w-0 flex-1">
          <span className="label text-accent">Unit {unit}</span>
          <h2 className="mt-0.5 font-display text-2xl font-black leading-tight text-primary sm:text-3xl">
            {track.title}
          </h2>
          <ChalkUnderline
            className="mt-0.5 h-2.5 w-44 max-w-[70%]"
            delay={0.15}
          />
          <p className="mt-1.5 font-sans text-sm italic text-secondary">
            “{track.tagline}”
          </p>
        </div>
        <ProgressBadge mastered={track.masteredCount} total={track.totalCount} />
      </header>

      {/* mobile progress line (badge is sm+ only) */}
      <div className="relative -mt-2 px-4 pb-1 sm:hidden">
        <span className="font-display text-sm text-muted">
          {track.masteredCount}/{track.totalCount} mastered
        </span>
      </div>

      <ol className="relative space-y-0.5 px-2 pb-4 sm:px-4">
        {track.lessons.flatMap((lesson, i) => [
          ...(startsSection(track.lessons, i)
            ? [
                <TocSectionDivider
                  key={`section-${lesson.id}`}
                  section={lesson.section as string}
                  className="rounded-md"
                />,
              ]
            : []),
          <LessonRow
            key={lesson.id}
            lesson={lesson}
            index={i}
            locked={isLocked(lesson)}
            href={lessonHref(lesson.trackId, lesson.id)}
          />,
        ])}
      </ol>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Coming-soon teaser tracks                                                   */
/* -------------------------------------------------------------------------- */

function ComingSoonCard({ track }: { track: TocComingSoonTrack }) {
  const Icon = MOTIF_ICON[track.motif];
  return (
    <div className="relative overflow-hidden rounded-lg border-2 border-dashed border-border-strong/30 bg-surface p-4 opacity-80">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border-strong/40 text-muted">
          <Icon width={20} height={20} />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-lg font-bold text-primary">
              {track.title}
            </h3>
            <span
              className="font-display text-xs font-semibold"
              style={{ color: ACC }}
            >
              soon…
            </span>
          </div>
          <p className="mt-1 font-sans text-sm text-secondary">
            {track.description}
          </p>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Root                                                                        */
/* -------------------------------------------------------------------------- */

export function ChalkboardTableOfContents({
  intro,
  tracks,
  comingSoon,
  lessonHref,
  isLocked,
}: TocViewProps) {
  return (
    <div className="space-y-6 pb-8">
      <ChalkTocAnimations />

      {/* Syllabus header — a hand-written board title. */}
      <header className="relative overflow-hidden rounded-lg border-2 border-border-strong/35 bg-surface p-5 sm:p-7">
        <div
          className="tex-grid pointer-events-none absolute inset-0 opacity-[0.12] dark:opacity-[0.08]"
          aria-hidden="true"
        />
        {/* corner scribble */}
        <span
          className="pointer-events-none absolute right-4 top-3 font-display text-2xl sm:right-6 sm:text-3xl"
          style={{ color: ACC, opacity: 0.5 }}
          aria-hidden="true"
        >
          Σ p = 1
        </span>
        <div className="relative">
          <span className="label text-accent">The Syllabus</span>
          <h1 className="mt-1 font-display text-4xl font-black leading-none text-primary sm:text-5xl">
            Course Outline
          </h1>
          <ChalkUnderline className="mt-1 h-3 w-72 max-w-[85%]" />
          <p className="mt-3 max-w-2xl font-sans text-[15px] leading-relaxed text-secondary">
            {intro}
          </p>
        </div>
      </header>

      {tracks.map((track, i) => (
        <TrackSection
          key={track.id}
          track={track}
          unit={i + 1}
          lessonHref={lessonHref}
          isLocked={isLocked}
        />
      ))}

      {comingSoon.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="label text-muted">Coming Soon</span>
            <span
              className="h-px flex-1"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(90deg, rgb(var(--color-border-strong)) 0 6px, transparent 6px 12px)",
                opacity: 0.35,
              }}
              aria-hidden="true"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {comingSoon.map((t) => (
              <ComingSoonCard key={t.id} track={t} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
