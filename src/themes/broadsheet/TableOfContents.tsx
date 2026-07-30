import { Link } from "react-router-dom";
import type {
  TocComingSoonTrack,
  TocLessonItem,
  TocTrack,
  TocViewProps,
} from "../types";
import { startsSection, TocSectionDivider } from "../tocSection";
import { INK } from "./pageArt";
import { CheckIcon, LockIcon, MOTIF_ICON } from "@/components/icons";

/**
 * BROADSHEET — Table of Contents rendered as a vintage newspaper index page,
 * "The Quant Ledger — In This Edition": an editorial masthead, each track as a
 * numbered newspaper SECTION with a small-caps header + rule + tagline, and
 * lessons as classic index entries with dotted LEADER LINES running to a
 * right-aligned detail (difficulty · questions), status medallions (engraved
 * seal = mastered, lock = locked, numeral = unlocked), a drop-cap lead, and
 * fleuron rules. Navigation + locking are owned by the page — this only styles.
 */

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

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

function RuleWithFleuron() {
  return (
    <div className="mx-auto mt-3 flex max-w-md items-center gap-3 opacity-80">
      <span className="h-px flex-1 bg-subtle" />
      <Fleuron />
      <span className="h-px flex-1 bg-subtle" />
    </div>
  );
}

/* --------------------------------- masthead ------------------------------ */

function PageMasthead({ intro }: { intro: string }) {
  return (
    <header className="panel-ruled overflow-hidden">
      <div className="flex items-center justify-between border-b border-subtle px-4 py-1.5">
        <span className="label text-[9px]">Vol. MMXXVI · No. 1</span>
        <span className="label text-[9px] text-accent">In This Edition</span>
        <span className="label hidden text-[9px] sm:inline">Price: Free</span>
      </div>
      <div className="px-4 py-6 text-center">
        <h1 className="font-display text-4xl font-black leading-none tracking-tight text-primary sm:text-5xl">
          Table of Contents
        </h1>
        <RuleWithFleuron />
        <p className="mx-auto mt-3 max-w-2xl text-left text-[15px] leading-relaxed text-secondary sm:text-center">
          <span className="float-left mr-2 font-display text-5xl font-black leading-[0.72] text-primary sm:hidden">
            {intro.charAt(0)}
          </span>
          {intro.slice(1)}
        </p>
      </div>
    </header>
  );
}

/* --------------------------------- section ------------------------------- */

function TrackSection({
  track,
  index,
  lessonHref,
  isLocked,
}: {
  track: TocTrack;
  index: number;
  lessonHref: TocViewProps["lessonHref"];
  isLocked: TocViewProps["isLocked"];
}) {
  const Icon = MOTIF_ICON[track.motif];
  const pct = track.totalCount
    ? Math.round((track.masteredCount / track.totalCount) * 100)
    : 0;
  return (
    <section className="panel overflow-hidden">
      <header className="flex items-center gap-4 border-b-[3px] border-border-strong p-4 sm:p-5">
        <span className="hidden font-display text-4xl font-black leading-none text-accent sm:block">
          {ROMAN[index] ?? index + 1}
        </span>
        <span className="grid h-11 w-11 shrink-0 place-items-center border border-border-strong text-primary">
          <Icon width={24} height={24} />
        </span>
        <div className="min-w-0 flex-1">
          <span className="label text-accent">
            Section {ROMAN[index] ?? index + 1}
          </span>
          <h2 className="mt-0.5 font-display text-xl font-black leading-tight text-primary sm:text-2xl">
            {track.title}
          </h2>
          <p className="mt-0.5 text-sm italic text-secondary">{track.tagline}</p>
        </div>
        <div className="hidden shrink-0 flex-col items-end sm:flex">
          <span className="label text-[9px]">Mastered</span>
          <span className="num text-xl font-semibold text-primary">
            {track.masteredCount}/{track.totalCount}
          </span>
          <span className="mt-1 h-1.5 w-20 overflow-hidden border border-subtle bg-surface">
            <span
              className="block h-full bg-bull"
              style={{ width: `${pct}%` }}
            />
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
          <LessonEntry
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

/* ------------------------------ status medallion ------------------------- */

function Medallion({
  state,
  locked,
  index,
}: {
  state: TocLessonItem["state"];
  locked: boolean;
  index: number;
}) {
  const mastered = state === "mastered";
  return (
    <span
      className={[
        "relative grid h-8 w-8 shrink-0 place-items-center border-2 font-mono text-xs font-semibold",
        mastered
          ? "border-bull bg-bull text-bg"
          : locked
            ? "border-subtle bg-surface-muted text-muted"
            : "border-accent bg-surface text-accent",
      ].join(" ")}
    >
      {mastered ? (
        <CheckIcon width={18} height={18} />
      ) : locked ? (
        <LockIcon width={15} height={15} />
      ) : (
        <span>{String(index + 1).padStart(2, "0")}</span>
      )}
      {/* engraved double-ring seal on mastered */}
      {mastered && (
        <span className="pointer-events-none absolute -inset-[3px] border border-bull opacity-50" />
      )}
    </span>
  );
}

function LessonEntry({
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
  const unit = lesson.mode === "flashcard" ? " cards" : "Q";

  const inner = (
    <div className="flex items-start gap-3 px-4 py-3.5 sm:gap-4">
      <Medallion state={lesson.state} locked={locked} index={index} />
      <div className="min-w-0 flex-1">
        {/* Index line with dotted leader → right-aligned detail */}
        <div className="flex items-end gap-2.5">
          <h3 className="font-display text-[15px] font-semibold leading-tight text-primary">
            {lesson.title}
          </h3>
          <span
            aria-hidden="true"
            className="mb-[5px] hidden h-px flex-1 border-b border-dotted border-subtle sm:block"
          />
          <span className="mb-[1px] flex shrink-0 items-center gap-2">
            <span className="chip border-subtle text-secondary">
              {lesson.difficultyLabel}
            </span>
            <span className="num text-[11px] text-muted">
              {lesson.questionCount}
              {unit}
            </span>
          </span>
        </div>

        <p className="mt-1 text-sm leading-relaxed text-secondary">
          {lesson.description}
        </p>

        {/* Status line */}
        <div className="mt-1.5 flex items-center gap-2">
          {mastered && (
            <span className="chip border-bull text-bull">✦ Mastered</span>
          )}
          {locked && (
            <span className="chip border-subtle text-muted">Locked</span>
          )}
          {!locked && (
            <span className="label text-accent">
              {mastered ? "Review the dispatch →" : "Read on →"}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  if (locked) {
    return (
      <li
        aria-disabled="true"
        title="Master the previous lesson first"
        className="cursor-not-allowed opacity-55"
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
        className="group block transition-colors hover:bg-surface-muted"
      >
        {inner}
      </Link>
    </li>
  );
}

/* ------------------------------- coming soon ----------------------------- */

function ComingSoonSection({ items }: { items: TocComingSoonTrack[] }) {
  return (
    <section className="panel overflow-hidden">
      <header className="flex items-center gap-2 border-b-[3px] border-border-strong px-4 py-3">
        <span className="label">Also in This Edition — Forthcoming</span>
        <span className="h-px flex-1 bg-subtle" />
      </header>
      <ol className="divide-y divide-subtle">
        {items.map((t) => {
          const Icon = MOTIF_ICON[t.motif];
          return (
            <li key={t.id} className="opacity-70">
              <div className="flex items-start gap-3 px-4 py-3.5 sm:gap-4">
                <span className="grid h-8 w-8 shrink-0 place-items-center border border-subtle text-muted">
                  <Icon width={18} height={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-end gap-2.5">
                    <h3 className="font-display text-[15px] font-semibold leading-tight text-primary">
                      {t.title}
                    </h3>
                    <span
                      aria-hidden="true"
                      className="mb-[5px] hidden h-px flex-1 border-b border-dotted border-subtle sm:block"
                    />
                    <span className="label mb-[1px] shrink-0 text-primary">
                      Forthcoming
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-primary">
                    {t.description}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/* ---------------------------------- root --------------------------------- */

export function BroadsheetTableOfContents({
  intro,
  tracks,
  comingSoon,
  lessonHref,
  isLocked,
}: TocViewProps) {
  return (
    <div className="space-y-6">
      <PageMasthead intro={intro} />

      {tracks.map((track, i) => (
        <TrackSection
          key={track.id}
          track={track}
          index={i}
          lessonHref={lessonHref}
          isLocked={isLocked}
        />
      ))}

      {comingSoon.length > 0 && <ComingSoonSection items={comingSoon} />}

      {/* Colophon */}
      <div className="flex items-center justify-center gap-3 py-2 opacity-70">
        <span className="h-px w-16 bg-subtle" />
        <Fleuron />
        <span className="label text-[9px]">End of Index</span>
        <Fleuron />
        <span className="h-px w-16 bg-subtle" />
      </div>
    </div>
  );
}
