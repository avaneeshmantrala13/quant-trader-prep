import { Link } from "react-router-dom";
import type { TocLessonItem, TocTrack, TocViewProps } from "../types";
import { CheckIcon, LockIcon } from "@/components/icons";
import { startsSection, TocSectionDivider } from "../tocSection";

/**
 * MINIMALIST — Table of Contents (`/contents`) renderer.
 *
 * A design-studio "index page": impeccable typographic hierarchy, strict grid
 * alignment, and generous whitespace do all the work — no gradients, glass, or
 * ornament. Sections are numbered (01, 02, …) under strong ink rules; lessons
 * are a tidy aligned list — marker · title · one-line muted description on the
 * left, difficulty + count set in clean monospace on the right. The ONE
 * restrained accent appears only where it means something: the thin per-section
 * progress bar, the mastered tick, and the hover "Open →" affordance. Locked
 * lessons stay visible but dimmed and non-interactive with a minimal lock glyph.
 *
 * Navigation + locking are owned by the page (props) — this only styles.
 */
export function MinimalistTableOfContents({
  intro,
  tracks,
  comingSoon,
  lessonHref,
  isLocked,
}: TocViewProps) {
  const totalLessons = tracks.reduce((n, t) => n + t.totalCount, 0);
  const totalMastered = tracks.reduce((n, t) => n + t.masteredCount, 0);

  return (
    <div className="font-sans pb-4">
      {/* ---- Masthead ---- */}
      <header>
        <div className="flex items-center gap-3">
          <span className="label text-accent">The Curriculum</span>
          <span className="h-px flex-1 bg-border-strong" />
          <span className="label">Full Index</span>
        </div>

        <div className="mt-5 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-4xl font-extrabold leading-[0.95] tracking-tight text-primary sm:text-5xl">
              Table of
              <br />
              Contents
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-secondary">
              {intro}
            </p>
          </div>

          <dl className="flex shrink-0 items-end gap-6 sm:gap-9">
            <Stat label="Sections" value={String(tracks.length)} />
            <Stat label="Lessons" value={String(totalLessons)} />
            <Stat
              label="Mastered"
              value={`${totalMastered}/${totalLessons}`}
              accent
            />
          </dl>
        </div>
      </header>

      {/* ---- Sections ---- */}
      <div className="mt-14 space-y-14">
        {tracks.map((track, i) => (
          <TrackSection
            key={track.id}
            index={i}
            track={track}
            lessonHref={lessonHref}
            isLocked={isLocked}
          />
        ))}

        {comingSoon.length > 0 && (
          <ComingSoonSection index={tracks.length} tracks={comingSoon} />
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

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
    <div className="text-right sm:text-left">
      <div
        className={`num text-2xl font-semibold tabular-nums ${
          accent ? "text-accent" : "text-primary"
        }`}
      >
        {value}
      </div>
      <div className="label mt-1">{label}</div>
    </div>
  );
}

function SectionNumber({ n }: { n: number }) {
  return (
    <span className="num shrink-0 text-sm font-medium tabular-nums text-muted">
      {String(n).padStart(2, "0")}
    </span>
  );
}

function ProgressReadout({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="shrink-0 text-right">
      <div className="num text-sm font-semibold tabular-nums text-primary">
        {done} <span className="text-muted">/ {total}</span>
      </div>
      <div className="mt-1.5 h-[3px] w-24 bg-surface-muted">
        <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function TrackSection({
  index,
  track,
  lessonHref,
  isLocked,
}: {
  index: number;
  track: TocTrack;
  lessonHref: TocViewProps["lessonHref"];
  isLocked: TocViewProps["isLocked"];
}) {
  return (
    <section>
      <header className="flex items-end gap-4 border-b-2 border-border-strong pb-3">
        <SectionNumber n={index + 1} />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-bold leading-tight tracking-tight text-primary sm:text-2xl">
            {track.title}
          </h2>
          <p className="mt-0.5 truncate text-sm text-secondary">
            {track.tagline}
          </p>
        </div>
        <ProgressReadout done={track.masteredCount} total={track.totalCount} />
      </header>

      <ol className="divide-y divide-subtle">
        {track.lessons.flatMap((lesson, i) => [
          ...(startsSection(track.lessons, i)
            ? [
                <TocSectionDivider
                  key={`section-${lesson.id}`}
                  section={lesson.section as string}
                  className="-mx-3 rounded-sm"
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

/* -------------------------------------------------------------------------- */

const ROW_GRID =
  "grid grid-cols-[1.75rem_1fr] gap-x-3 sm:grid-cols-[1.75rem_1fr_9rem_4.5rem] sm:gap-x-5";

function Marker({
  mastered,
  locked,
  num,
}: {
  mastered: boolean;
  locked: boolean;
  num: string;
}) {
  return (
    <span className="row-span-2 flex justify-center pt-1 sm:row-span-1 sm:pt-0.5">
      {mastered ? (
        <CheckIcon width={17} height={17} className="text-accent" />
      ) : locked ? (
        <LockIcon width={14} height={14} className="text-muted" />
      ) : (
        <span className="num text-xs font-medium tabular-nums text-muted">
          {num}
        </span>
      )}
    </span>
  );
}

function LessonMeta({ lesson }: { lesson: TocLessonItem }) {
  return (
    <div className="col-start-2 mt-2 flex items-center gap-3 sm:col-start-3 sm:mt-0.5 sm:flex-col sm:items-end sm:gap-0.5">
      <span className="label leading-none">{lesson.difficultyLabel}</span>
      <span className="num text-[11px] tabular-nums text-muted">
        {lesson.questionCount} {lesson.mode === "flashcard" ? "cards" : "Q"}
      </span>
    </div>
  );
}

function LessonBody({ lesson }: { lesson: TocLessonItem }) {
  return (
    <div className="min-w-0">
      <h3 className="text-[15px] font-semibold leading-snug tracking-tight text-primary">
        {lesson.title}
      </h3>
      <p className="mt-0.5 text-[13px] leading-relaxed text-muted">
        {lesson.description}
      </p>
    </div>
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

  const marker = <Marker mastered={mastered} locked={locked} num={num} />;
  const body = <LessonBody lesson={lesson} />;
  const meta = <LessonMeta lesson={lesson} />;

  if (locked) {
    return (
      <li
        aria-disabled="true"
        title="Master the previous lesson to unlock"
        className={`${ROW_GRID} cursor-not-allowed items-start py-4 opacity-55`}
      >
        {marker}
        {body}
        {meta}
        <span className="label col-start-2 mt-1 self-center sm:col-start-4 sm:mt-0 sm:justify-self-end">
          Locked
        </span>
      </li>
    );
  }

  return (
    <li>
      <Link
        to={href}
        aria-label={`${lesson.title} — ${lesson.state}`}
        className={`group ${ROW_GRID} -mx-3 items-start rounded-sm px-3 py-4 transition-colors hover:bg-surface-muted`}
      >
        {marker}
        {body}
        {meta}
        <span className="label col-start-2 mt-1 self-center text-secondary transition-colors group-hover:text-accent sm:col-start-4 sm:mt-0 sm:justify-self-end">
          {mastered ? "Review →" : "Open →"}
        </span>
      </Link>
    </li>
  );
}

/* -------------------------------------------------------------------------- */

function ComingSoonSection({
  index,
  tracks,
}: {
  index: number;
  tracks: TocViewProps["comingSoon"];
}) {
  return (
    <section>
      <header className="flex items-end gap-4 border-b-2 border-border-strong pb-3">
        <SectionNumber n={index + 1} />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-bold tracking-tight text-primary sm:text-2xl">
            Coming Soon
          </h2>
          <p className="mt-0.5 text-sm text-secondary">
            On the roadmap — not yet open.
          </p>
        </div>
      </header>

      <ol className="divide-y divide-subtle">
        {tracks.map((t) => (
          <li
            key={t.id}
            className={`${ROW_GRID} items-start py-4 opacity-55`}
            aria-disabled="true"
          >
            <span className="row-span-2 flex justify-center pt-1 sm:row-span-1 sm:pt-0.5">
              <LockIcon width={14} height={14} className="text-muted" />
            </span>
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold tracking-tight text-primary">
                {t.title}
              </h3>
              <p className="mt-0.5 text-[13px] leading-relaxed text-muted">
                {t.description}
              </p>
            </div>
            <span className="label col-start-2 mt-2 self-center sm:col-start-3 sm:mt-0.5 sm:justify-self-end">
              Soon
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
