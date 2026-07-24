import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { CheckIcon, LockIcon } from "@/components/icons";
import type {
  TocComingSoonTrack,
  TocLessonItem,
  TocTrack,
  TocViewProps,
} from "../types";
import { startsSection, TocSectionDivider } from "../tocSection";
import { INK, KidsAnimations, Twinkle } from "./animations";
import { Bunting, MOTIF_MASCOT, Star } from "./TocArt";

/**
 * KIDS / CARTOON — Table of Contents (`/contents`).
 *
 * A joyful storybook "adventure menu": each track is a big rounded candy card
 * (its own color) fronted by a bobbing motif mascot and a chunky star progress
 * bar; each lesson is a bubbly card with a round number badge, its one-sentence
 * blurb, difficulty shown as cute stars, question/mode count, and a
 * locked/unlocked/mastered affordance (gold star sticker for mastered, padlock
 * for locked). Cohesive with the carnival map board + station mascots.
 *
 * Navigation + locking are owned by the page: unlocked/mastered lessons are
 * <Link>s to `lessonHref(...)`; locked lessons render visible but inert with a
 * padlock. This component only styles. Text always sits on token surfaces
 * (candy is used for decoration/accents) to stay WCAG-AA in light + dark.
 */

/** Candy accent cycled per track for a colorful, distinct feel. */
const TRACK_COLORS = ["#5aa9ff", "#57c785", "#f472b6", "#ff9f45", "#a78bfa"];

const DIFF_STARS: Record<string, number> = {
  intro: 1,
  easy: 2,
  medium: 3,
  hard: 4,
  expert: 5,
};

export function KidsTableOfContents({
  intro,
  tracks,
  comingSoon,
  lessonHref,
  isLocked,
}: TocViewProps) {
  const totalStars = tracks.reduce((s, t) => s + t.masteredCount, 0);
  const totalLessons = tracks.reduce((s, t) => s + t.totalCount, 0);

  return (
    <div className="space-y-6 font-sans">
      <KidsAnimations />
      <PageHeader
        intro={intro}
        totalStars={totalStars}
        totalLessons={totalLessons}
      />

      {tracks.map((track, i) => (
        <TrackCard
          key={track.id}
          track={track}
          color={TRACK_COLORS[i % TRACK_COLORS.length]}
          index={i}
          lessonHref={lessonHref}
          isLocked={isLocked}
        />
      ))}

      {comingSoon.length > 0 && <ComingSoon tracks={comingSoon} />}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Header                                                                     */
/* -------------------------------------------------------------------------- */

function PageHeader({
  intro,
  totalStars,
  totalLessons,
}: {
  intro: string;
  totalStars: number;
  totalLessons: number;
}) {
  return (
    <header className="relative overflow-hidden rounded-[26px] border-[3px] border-border-strong bg-surface p-5 sm:p-7">
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
      <Bunting className="pointer-events-none absolute inset-x-0 top-0 h-5 w-full opacity-90" />

      <div className="relative flex flex-col gap-4 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1 rounded-full border-2 border-border-strong bg-surface-muted px-3 py-0.5 text-xs font-extrabold uppercase tracking-wide text-secondary">
            <Star filled size={13} /> Adventure Menu
          </span>
          <h1 className="mt-2 font-display text-3xl font-black leading-tight text-primary sm:text-4xl">
            Table of Contents
          </h1>
          <p className="mt-1 max-w-xl text-sm font-semibold text-secondary sm:text-base">
            {intro}
          </p>
        </div>

        {/* Star tally sticker */}
        <div
          className="relative flex shrink-0 items-center gap-3 self-start rounded-[20px] border-[3px] border-border-strong bg-surface-raised px-4 py-3 sm:self-auto"
          style={{ transform: "rotate(-2deg)" }}
        >
          <div
            className="kids-anim grid h-12 w-12 place-items-center"
            style={{ animation: "kids-bob 3s ease-in-out infinite" } as CSSProperties}
          >
            <svg viewBox="0 0 24 24" className="h-full w-full" aria-hidden="true">
              <path
                d="M12 2 L15 9 L22.5 9.6 L16.8 14.5 L18.6 22 L12 17.8 L5.4 22 L7.2 14.5 L1.5 9.6 L9 9 Z"
                fill="#ffcf4d"
                stroke={INK}
                strokeWidth={1.6}
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="leading-tight">
            <div className="font-display text-2xl font-black text-primary">
              {totalStars}
              <span className="text-base text-muted">/{totalLessons}</span>
            </div>
            <div className="text-xs font-bold uppercase tracking-wide text-muted">
              Stars earned
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/*  Track section card                                                         */
/* -------------------------------------------------------------------------- */

function TrackCard({
  track,
  color,
  index,
  lessonHref,
  isLocked,
}: {
  track: TocTrack;
  color: string;
  index: number;
  lessonHref: TocViewProps["lessonHref"];
  isLocked: TocViewProps["isLocked"];
}) {
  const Mascot = MOTIF_MASCOT[track.motif];
  const pct = track.totalCount
    ? Math.round((track.masteredCount / track.totalCount) * 100)
    : 0;

  return (
    <section
      className="relative overflow-hidden rounded-[24px] border-[3px] bg-surface"
      style={{ borderColor: color }}
    >
      {/* soft candy wash of the track color */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{ backgroundColor: color }}
      />
      {/* chunky color rail down the side */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 w-2"
        style={{ backgroundColor: color }}
      />

      <div className="relative p-4 sm:p-5">
        {/* Section header */}
        <div className="flex items-start gap-3 sm:gap-4">
          <div
            className="kids-anim grid h-16 w-16 shrink-0 place-items-center rounded-[20px] border-[3px] border-border-strong bg-surface-raised sm:h-[72px] sm:w-[72px]"
            style={{ animation: `kids-bob ${3 + (index % 3) * 0.4}s ease-in-out infinite` } as CSSProperties}
          >
            <Mascot className="h-11 w-11 sm:h-14 sm:w-14" />
          </div>

          <div className="min-w-0 flex-1">
            <span
              className="inline-flex items-center gap-1.5 rounded-full border-2 bg-surface-muted px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-secondary"
              style={{ borderColor: color }}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
              World {index + 1}
            </span>
            <h2 className="mt-1 font-display text-xl font-black leading-tight text-primary sm:text-2xl">
              {track.title}
            </h2>
            <p className="mt-0.5 text-sm font-semibold text-secondary">
              {track.tagline}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4 flex items-center gap-3">
          <div className="relative h-4 flex-1 overflow-hidden rounded-full border-2 border-border-strong bg-surface-muted">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${pct}%`, backgroundColor: color }}
            />
          </div>
          <span className="flex shrink-0 items-center gap-1 font-display text-sm font-black text-primary">
            <Star filled size={15} />
            {track.masteredCount}/{track.totalCount}
          </span>
        </div>

        {/* Lessons */}
        <ol className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {track.lessons.flatMap((lesson, i) => [
            ...(startsSection(track.lessons, i)
              ? [
                  <TocSectionDivider
                    key={`section-${lesson.id}`}
                    section={lesson.section as string}
                    className="rounded-full lg:col-span-2"
                  />,
                ]
              : []),
            <LessonCard
              key={lesson.id}
              index={i}
              lesson={lesson}
              color={color}
              locked={isLocked(lesson)}
              href={lessonHref(lesson.trackId, lesson.id)}
            />,
          ])}
        </ol>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Lesson card                                                                */
/* -------------------------------------------------------------------------- */

function DifficultyStars({ difficulty }: { difficulty: string }) {
  const n = DIFF_STARS[difficulty] ?? 3;
  return (
    <span className="flex items-center gap-0.5" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <Star key={i} filled={i < n} size={13} />
      ))}
    </span>
  );
}

function LessonCard({
  index,
  lesson,
  color,
  locked,
  href,
}: {
  index: number;
  lesson: TocLessonItem;
  color: string;
  locked: boolean;
  href: string;
}) {
  const mastered = lesson.state === "mastered";
  const num = String(index + 1).padStart(2, "0");
  const countLabel = `${lesson.questionCount}${lesson.mode === "flashcard" ? " cards" : " Q"}`;

  const badge = (
    <span
      className={[
        "relative grid h-12 w-12 shrink-0 place-items-center rounded-full border-[3px] font-display text-base font-black",
        mastered
          ? "border-border-strong bg-bull text-bg"
          : locked
            ? "border-subtle bg-surface-muted text-muted"
            : "border-border-strong bg-surface text-primary",
      ].join(" ")}
      style={!mastered && !locked ? { boxShadow: `inset 0 0 0 3px ${color}22` } : undefined}
    >
      {mastered ? (
        <CheckIcon width={24} height={24} />
      ) : locked ? (
        <LockIcon width={20} height={20} />
      ) : (
        <span>{num}</span>
      )}
    </span>
  );

  const inner = (
    <>
      {/* mastered gold-star corner sticker */}
      {mastered && (
        <svg
          viewBox="0 0 24 24"
          className="pointer-events-none absolute -right-2 -top-2 h-8 w-8"
          style={{ transform: "rotate(12deg)" }}
          aria-hidden="true"
        >
          <path
            d="M12 2 L15 9 L22.5 9.6 L16.8 14.5 L18.6 22 L12 17.8 L5.4 22 L7.2 14.5 L1.5 9.6 L9 9 Z"
            fill="#ffcf4d"
            stroke={INK}
            strokeWidth={1.6}
            strokeLinejoin="round"
          />
        </svg>
      )}

      <div className="flex items-start gap-3">
        {badge}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display text-base font-black leading-tight text-primary">
              {lesson.title}
            </h3>
            <span className="shrink-0 rounded-full border-2 border-subtle bg-surface-muted px-2 py-0.5 text-[11px] font-bold text-secondary">
              {countLabel}
            </span>
          </div>
          <p className="mt-1 text-sm font-medium leading-relaxed text-secondary">
            {lesson.description}
          </p>
          <div className="mt-2.5 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5">
              <DifficultyStars difficulty={lesson.difficulty} />
              <span className="text-[11px] font-bold uppercase tracking-wide text-muted">
                {lesson.difficultyLabel}
              </span>
            </span>
            {locked ? (
              <span className="flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wide text-muted">
                <LockIcon width={12} height={12} /> Locked
              </span>
            ) : (
              <span
                className={`font-display text-sm font-black ${mastered ? "text-bull" : "text-accent"}`}
              >
                {mastered ? "Replay ▸" : "Play ▸"}
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  );

  const base =
    "relative block rounded-[18px] border-[3px] bg-surface p-3.5";

  if (locked) {
    return (
      <li>
        <div
          aria-disabled="true"
          title="Master the previous lesson to unlock this one"
          className={`${base} cursor-not-allowed border-subtle opacity-60`}
        >
          {inner}
        </div>
      </li>
    );
  }

  return (
    <li>
      <Link
        to={href}
        aria-label={`${lesson.title} — ${lesson.state}`}
        className={`${base} transition-transform duration-150 hover:-translate-y-1 hover:shadow-lg`}
        style={{ borderColor: mastered ? "rgb(var(--color-bull))" : color }}
      >
        {inner}
      </Link>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/*  Coming soon                                                                */
/* -------------------------------------------------------------------------- */

function ComingSoon({ tracks }: { tracks: TocComingSoonTrack[] }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1 font-display text-sm font-black uppercase tracking-wide text-secondary">
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
            <Twinkle x={8} y={8} s={7} />
          </svg>{" "}
          Coming Soon
        </span>
        <span className="h-1 flex-1 rounded-full bg-surface-muted" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {tracks.map((t) => {
          const Mascot = MOTIF_MASCOT[t.motif];
          return (
            <div
              key={t.id}
              className="relative overflow-hidden rounded-[22px] border-[3px] border-dashed border-subtle bg-surface p-4 opacity-80"
            >
              <div className="flex items-start gap-3">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-[18px] border-[3px] border-subtle bg-surface-muted grayscale">
                  <Mascot className="h-11 w-11" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-lg font-black text-primary">
                      {t.title}
                    </h3>
                    <span className="rounded-full border-2 border-border-strong bg-surface-muted px-2 py-0.5 text-[11px] font-extrabold uppercase text-secondary">
                      Soon!
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-secondary">
                    {t.description}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
