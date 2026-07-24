import { Link } from "react-router-dom";
import type { TocLessonItem, TocTrack, TocViewProps } from "./types";
import { CheckIcon, LockIcon, MOTIF_ICON } from "@/components/icons";
import { startsSection, TocSectionDivider } from "./tocSection";

/**
 * BASE Table of Contents renderer — the default, theme-agnostic view mounted by
 * `src/pages/TableOfContentsPage.tsx` whenever the active theme does NOT supply
 * its own `TableOfContents` component. It is styled purely with the semantic
 * theme tokens / component classes (`.panel`, `.chip`, `.label`, …), so it
 * already tracks every theme's colors, fonts, and light/dark automatically.
 *
 * It is also the reference implementation for the per-theme contract: a theme's
 * `TableOfContents` may `import { BaseTableOfContents } from "../BaseTableOfContents"`
 * and delegate to it (that is what the initial stubs do), then progressively
 * replace it with a bespoke design.
 *
 * IMPORTANT: navigation and locking are OWNED by the page/props. This renderer
 * only:
 *   • links unlocked/mastered lessons to `lessonHref(...)`,
 *   • renders locked lessons as non-interactive with a lock affordance,
 *   • never recomputes state or unlock rules.
 */
export function BaseTableOfContents({
  intro,
  tracks,
  comingSoon,
  lessonHref,
  isLocked,
}: TocViewProps) {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <header className="panel-ruled p-5">
        <span className="label text-accent">The Curriculum · Full Index</span>
        <h1 className="mt-0.5 font-display text-2xl font-black text-primary sm:text-3xl">
          Table of Contents
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-secondary">{intro}</p>
      </header>

      {tracks.map((track) => (
        <TrackSection key={track.id} track={track} lessonHref={lessonHref} isLocked={isLocked} />
      ))}

      {/* Coming-soon / teaser tracks */}
      {comingSoon.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="label">Coming Soon</span>
            <span className="h-px flex-1 bg-subtle" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {comingSoon.map((t) => {
              const Icon = MOTIF_ICON[t.motif];
              return (
                <div key={t.id} className="panel p-4 opacity-70">
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center border border-subtle text-muted">
                      <Icon width={20} height={20} />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-display text-lg font-semibold text-primary">
                          {t.title}
                        </h3>
                        <span className="chip border-subtle text-muted">Soon</span>
                      </div>
                      <p className="mt-1 text-sm text-secondary">{t.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function TrackSection({
  track,
  lessonHref,
  isLocked,
}: {
  track: TocTrack;
  lessonHref: TocViewProps["lessonHref"];
  isLocked: TocViewProps["isLocked"];
}) {
  const Icon = MOTIF_ICON[track.motif];
  return (
    <section className="panel overflow-hidden">
      <header className="flex items-start gap-4 border-b-[3px] border-border-strong p-4 sm:p-5">
        <span className="grid h-11 w-11 shrink-0 place-items-center border border-border-strong text-primary">
          <Icon width={24} height={24} />
        </span>
        <div className="min-w-0 flex-1">
          <span className="label text-accent">Section</span>
          <h2 className="mt-0.5 font-display text-xl font-black text-primary sm:text-2xl">
            {track.title}
          </h2>
          <p className="mt-0.5 text-sm text-secondary">{track.tagline}</p>
        </div>
        <div className="hidden shrink-0 flex-col items-end sm:flex">
          <span className="label text-[9px]">Mastered</span>
          <span className="num text-xl font-semibold text-primary">
            {track.masteredCount}/{track.totalCount}
          </span>
        </div>
      </header>

      <ol className="divide-y divide-subtle">
        {track.lessons.flatMap((lesson, i) => [
          ...(startsSection(track.lessons, i)
            ? [
                <TocSectionDivider
                  key={`section-${lesson.id}`}
                  section={lesson.section as string}
                />,
              ]
            : []),
          <LessonRow
            key={lesson.id}
            index={i}
            lesson={lesson}
            locked={isLocked(lesson)}
            href={lessonHref(lesson.trackId, lesson.id)}
          />,
        ])}
      </ol>
    </section>
  );
}

function LessonRow({
  index,
  lesson,
  locked,
  href,
}: {
  index: number;
  lesson: TocLessonItem;
  locked: boolean;
  href: string;
}) {
  const mastered = lesson.state === "mastered";
  const num = String(index + 1).padStart(2, "0");

  const inner = (
    <>
      {/* State/number badge */}
      <span
        className={[
          "grid h-11 w-11 shrink-0 place-items-center border-2 font-mono text-sm font-semibold",
          mastered
            ? "border-bull bg-bull text-bg"
            : locked
              ? "border-subtle bg-surface-muted text-muted"
              : "border-accent bg-surface text-accent",
        ].join(" ")}
      >
        {mastered ? (
          <CheckIcon width={22} height={22} />
        ) : locked ? (
          <LockIcon width={18} height={18} />
        ) : (
          <span>{num}</span>
        )}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="font-display text-base font-semibold text-primary">
            {lesson.title}
          </h3>
          <span className="chip border-subtle text-secondary">
            {lesson.difficultyLabel}
          </span>
          <span className="num text-[11px] text-muted">
            {lesson.questionCount}
            {lesson.mode === "flashcard" ? " cards" : "Q"}
          </span>
          {mastered && (
            <span className="chip border-bull text-bull">Mastered</span>
          )}
          {locked && <span className="chip border-subtle text-muted">Locked</span>}
        </div>
        <p className="mt-1 text-sm leading-relaxed text-secondary">
          {lesson.description}
        </p>
      </div>

      {!locked && (
        <span className="label hidden shrink-0 self-center text-accent sm:block">
          {mastered ? "Review →" : "Start →"}
        </span>
      )}
    </>
  );

  const rowClass = "flex items-start gap-3 p-4 sm:gap-4";

  if (locked) {
    return (
      <li
        aria-disabled="true"
        title={`Master “${
          index > 0 ? "the previous lesson" : lesson.title
        }” first`}
        className={`${rowClass} cursor-not-allowed opacity-60`}
      >
        {inner}
      </li>
    );
  }

  return (
    <li>
      <Link
        to={href}
        className={`${rowClass} transition-colors hover:bg-surface-muted`}
        aria-label={`${lesson.title} — ${lesson.state}`}
      >
        {inner}
      </Link>
    </li>
  );
}
