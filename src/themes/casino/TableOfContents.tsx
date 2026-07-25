import { Link } from "react-router-dom";
import type { MotifKey } from "@/types/content";
import { CheckIcon, LockIcon, MOTIF_ICON } from "@/components/icons";
import type { TocLessonItem, TocTrack, TocViewProps } from "../types";
import { startsSection, TocSectionDivider } from "../tocSection";
import { Club, Diamond, Heart, Spade, type Suit } from "./suits";
import {
  CasinoOrnamentStyle,
  CornerFiligree,
  Gleam,
  GoldRule,
  goldRing,
} from "./ornaments";

/**
 * CASINO — Table of Contents (`/contents`).
 *
 * An opulent card-room "PROGRAM" / table menu: a gold-on-felt header with
 * filigree + a drifting gleam, each track rendered as a luxe table on the gaming
 * floor (suit medallion, gold-rule divider, chip-stack progress), and lessons as
 * refined gold-trimmed entries — suit bullet, one-sentence description,
 * difficulty as gold pips, question count as an annotation, a gold coin-seal for
 * mastered and a greyed lock chip for locked.
 *
 * Navigation + locking are OWNED BY THE PAGE: unlocked/mastered lessons link via
 * `lessonHref`, locked lessons render visible but non-interactive via `isLocked`.
 * This file only styles. Tokens + shared classes keep it AA in light/dark.
 */

/* Which card suit represents each motif on the felt. */
const MOTIF_SUIT: Record<MotifKey, Suit> = {
  probability: "spade",
  mathQuestions: "diamond",
  mentalMath: "diamond",
  brainteasers: "club",
  interviewGames: "heart",
  calibration: "spade",
};

const DIFF_RANK: Record<string, number> = {
  intro: 1,
  easy: 2,
  medium: 3,
  hard: 4,
  expert: 5,
};

function Pip({ suit, className }: { suit: Suit; className?: string }) {
  const C = suit === "heart" ? Heart : suit === "diamond" ? Diamond : suit === "club" ? Club : Spade;
  return <C className={className} />;
}

/** A gold-ringed suit medallion (the "table" marker for a section). */
function SuitMedallion({ suit }: { suit: Suit }) {
  const red = suit === "heart" || suit === "diamond";
  return (
    <span
      className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 border-gold bg-surface-raised sm:h-14 sm:w-14"
      style={goldRing}
    >
      <Pip suit={suit} className={`h-6 w-6 sm:h-7 sm:w-7 ${red ? "text-bear" : "text-primary"}`} />
    </span>
  );
}

/** Difficulty shown as 1–5 gold pips + the resolved label. */
function DifficultyPips({ rank }: { rank: number }) {
  return (
    <span className="inline-flex items-center gap-[3px]" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={`h-1.5 w-1.5 rounded-full ${i < rank ? "bg-gold" : "border border-gold/40"}`}
        />
      ))}
    </span>
  );
}

/** Per-track progress: a gold count + a stack of filled/hollow chips. */
function TableProgress({ track }: { track: TocTrack }) {
  const { masteredCount, totalCount } = track;
  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <span className="label text-[9px]">Hands Won</span>
      <span className="num text-lg font-semibold text-accent sm:text-xl">
        {masteredCount}
        <span className="text-muted">/{totalCount}</span>
      </span>
      <span className="hidden items-center gap-[3px] sm:flex" aria-hidden="true">
        {Array.from({ length: totalCount }).map((_, i) => (
          <span
            key={i}
            className={`h-2 w-2 rounded-full ${
              i < masteredCount
                ? "bg-gold"
                : "border border-gold/40 bg-surface-muted"
            }`}
          />
        ))}
      </span>
    </div>
  );
}

/** State badge: gold coin-seal (mastered), gold-ring number (open), lock chip. */
function StateSeal({
  state,
  index,
  locked,
}: {
  state: TocLessonItem["state"];
  index: number;
  locked: boolean;
}) {
  const num = String(index + 1).padStart(2, "0");
  if (state === "mastered") {
    return (
      <span
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-gold bg-gold text-bg"
        style={goldRing}
        title="Mastered"
      >
        <CheckIcon width={22} height={22} />
      </span>
    );
  }
  if (locked) {
    return (
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-subtle bg-surface-muted text-muted">
        <LockIcon width={18} height={18} />
      </span>
    );
  }
  return (
    <span
      className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-gold bg-surface-raised font-mono text-sm font-semibold text-primary"
      style={goldRing}
    >
      {num}
    </span>
  );
}

function LessonEntry({
  index,
  lesson,
  suit,
  locked,
  href,
}: {
  index: number;
  lesson: TocLessonItem;
  suit: Suit;
  locked: boolean;
  href: string;
}) {
  const mastered = lesson.state === "mastered";
  const red = suit === "heart" || suit === "diamond";
  const rank = DIFF_RANK[lesson.difficulty] ?? 3;
  const countLabel = `${lesson.questionCount}${lesson.mode === "flashcard" ? " cards" : "Q"}`;

  const inner = (
    <>
      <StateSeal state={lesson.state} index={index} locked={locked} />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Pip
            suit={suit}
            className={`h-3.5 w-3.5 shrink-0 ${red ? "text-bear" : "text-primary"} ${locked ? "opacity-60" : ""}`}
          />
          <h3 className="font-display text-base font-semibold text-primary">
            {lesson.title}
          </h3>
          {mastered && (
            <span className="chip border-gold text-accent">◆ Mastered</span>
          )}
          {locked && (
            <span className="chip border-subtle text-muted">Locked</span>
          )}
        </div>

        {lesson.subtitle && (
          <p className="mt-0.5 font-display text-xs italic text-muted">
            {lesson.subtitle}
          </p>
        )}

        <p className="mt-1 text-sm leading-relaxed text-secondary">
          {lesson.description}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1.5">
            <DifficultyPips rank={rank} />
            <span className="label text-[9px] text-secondary">
              {lesson.difficultyLabel}
            </span>
          </span>
          <span className="text-muted/50" aria-hidden="true">
            ·
          </span>
          <span className="num text-[11px] text-muted">{countLabel}</span>
        </div>
      </div>

      {!locked && (
        <span className="label hidden shrink-0 self-center text-accent sm:block">
          {mastered ? "Review →" : "Ante Up →"}
        </span>
      )}
    </>
  );

  const rowClass = "flex items-start gap-3 p-4 sm:gap-4";

  if (locked) {
    return (
      <li
        aria-disabled="true"
        title="Master the previous hand to unlock"
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
        aria-label={`${lesson.title} — ${lesson.state}`}
        className={`${rowClass} transition-colors hover:bg-surface-muted`}
      >
        {inner}
      </Link>
    </li>
  );
}

function TrackTable({
  track,
  lessonHref,
  isLocked,
}: {
  track: TocTrack;
  lessonHref: TocViewProps["lessonHref"];
  isLocked: TocViewProps["isLocked"];
}) {
  const suit = MOTIF_SUIT[track.motif];
  const Icon = MOTIF_ICON[track.motif];
  return (
    <section className="panel relative overflow-hidden" style={goldRing}>
      <header className="flex items-start gap-4 p-4 sm:p-5">
        <SuitMedallion suit={suit} />
        <div className="min-w-0 flex-1">
          <span className="label inline-flex items-center gap-1.5 text-accent">
            <Icon width={12} height={12} />
            Table
          </span>
          <h2 className="mt-0.5 font-display text-xl font-black text-primary sm:text-2xl">
            {track.title}
          </h2>
          <p className="mt-0.5 text-sm text-secondary">{track.tagline}</p>
        </div>
        <TableProgress track={track} />
      </header>

      <GoldRule />

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
            suit={suit}
            locked={isLocked(lesson)}
            href={lessonHref(lesson.trackId, lesson.id)}
          />,
        ])}
      </ol>
    </section>
  );
}

export function CasinoTableOfContents({
  intro,
  tracks,
  comingSoon,
  lessonHref,
  isLocked,
}: TocViewProps) {
  const wonTotal = tracks.reduce((a, t) => a + t.masteredCount, 0);
  const handsTotal = tracks.reduce((a, t) => a + t.totalCount, 0);

  return (
    <div className="space-y-6">
      <CasinoOrnamentStyle />

      {/* Program header — gold on felt with filigree + a drifting gleam. */}
      <header
        className="panel relative overflow-hidden p-5 sm:p-7"
        style={goldRing}
      >
        <Gleam />
        <CornerFiligree />
        <div className="relative">
          <span className="label text-accent">The Card Room · Full Program</span>
          <h1 className="mt-1 font-display text-3xl font-black tracking-wide text-primary sm:text-4xl">
            Table of Contents
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-secondary">
            {intro}
          </p>
          <div
            className="mt-4 inline-flex items-center gap-2 rounded-full border-2 border-gold bg-surface-raised px-3 py-1"
            style={goldRing}
          >
            <span className="grid h-5 w-5 place-items-center rounded-full bg-gold text-bg text-[10px] font-bold">
              ♦
            </span>
            <span className="num text-sm font-semibold text-accent">
              {wonTotal}
              <span className="text-muted">/{handsTotal}</span>
            </span>
            <span className="label text-[9px] text-secondary">Hands Mastered</span>
          </div>
        </div>
      </header>

      {tracks.map((track) => (
        <TrackTable
          key={track.id}
          track={track}
          lessonHref={lessonHref}
          isLocked={isLocked}
        />
      ))}

      {/* Coming soon — reserved tables on the floor. */}
      {comingSoon.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="label text-accent">Reserved Tables</span>
            <GoldRule className="flex-1" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {comingSoon.map((t) => {
              const suit = MOTIF_SUIT[t.motif];
              const red = suit === "heart" || suit === "diamond";
              return (
                <div
                  key={t.id}
                  className="panel relative overflow-hidden p-4 opacity-75"
                  style={goldRing}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-gold/60 bg-surface-muted"
                      style={goldRing}
                    >
                      <Pip
                        suit={suit}
                        className={`h-5 w-5 ${red ? "text-bear" : "text-primary"} opacity-70`}
                      />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-display text-lg font-semibold text-primary">
                          {t.title}
                        </h3>
                        <span className="chip border-gold text-primary">Soon</span>
                      </div>
                      <p className="mt-1 text-sm text-primary">
                        {t.description}
                      </p>
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
