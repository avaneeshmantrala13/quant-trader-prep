import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import type { MotifKey } from "@/types/content";
import { CheckIcon, LockIcon, MOTIF_ICON } from "@/components/icons";
import type {
  TocComingSoonTrack,
  TocLessonItem,
  TocTrack,
  TocViewProps,
} from "../types";
import { startsSection, TocSectionDivider } from "../tocSection";
import { CyberpunkAnimations } from "./neon";

/**
 * CYBERPUNK — Table of Contents (`/contents`) as a NEON DISTRICT DIRECTORY: a
 * glowing "street index of signs" for the night-city. The page owns navigation
 * + locking; this file only styles.
 *
 *  • Page header  → a lit marquee: a neon title, the shared intro, and a status
 *    strip of counters (BLOCKS / SIGNS / LIT) over a faint street grid.
 *  • Each track   → a "BLOCK": a motif icon in a neon plaque, a block code,
 *    title/tagline, and a neon progress bar + m/n "lit" readout.
 *  • Each lesson  → a STOREFRONT listing with a neon number plaque (number /
 *    check / lock), a mono shop "address", the one-sentence description,
 *    difficulty + count chips, and OPEN/DARK affordances. Locked shops are
 *    dimmed + non-interactive.
 *
 * All colors are theme tokens (neon on blue-black / deep ink on dusk) so every
 * state clears WCAG-AA in both modes — neon "pop" is decorative glow only, never
 * body text on a neon fill. Responsive 360px → ≥1280px.
 */

const MOTIF_CODE: Record<MotifKey, string> = {
  probability: "PRB",
  mentalMath: "NUM",
  brainteasers: "PZL",
  interviewGames: "MKT",
  calibration: "CAL",
};

const pad2 = (n: number) => String(n).padStart(2, "0");
const blockHex = (i: number) => `0x${(i + 1).toString(16).toUpperCase().padStart(2, "0")}`;

export function CyberpunkTableOfContents({
  intro,
  tracks,
  comingSoon,
  lessonHref,
  isLocked,
}: TocViewProps) {
  const totalShops = tracks.reduce((s, t) => s + t.totalCount, 0);
  const lit = tracks.reduce((s, t) => s + t.masteredCount, 0);

  return (
    <div className="space-y-6">
      <CyberpunkAnimations />

      <MarqueeHeader intro={intro} blocks={tracks.length} shops={totalShops} lit={lit} />

      {tracks.map((track, i) => (
        <BlockModule key={track.id} track={track} index={i} lessonHref={lessonHref} isLocked={isLocked} />
      ))}

      {comingSoon.length > 0 && <DarkStorefronts tracks={comingSoon} />}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page header — lit marquee                                                  */
/* -------------------------------------------------------------------------- */

function MarqueeHeader({
  intro,
  blocks,
  shops,
  lit,
}: {
  intro: string;
  blocks: number;
  shops: number;
  lit: number;
}) {
  return (
    <header className="panel-ruled relative overflow-hidden p-5 sm:p-6">
      {/* neon-dusk wash + faint street grid */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 60% 80% at 4% 0%, rgb(var(--color-accent) / 0.14) 0%, transparent 60%)," +
            "radial-gradient(ellipse 60% 80% at 98% 100%, rgb(var(--color-accent-2) / 0.14) 0%, transparent 60%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage:
            "linear-gradient(rgb(var(--color-accent) / 0.6) 1px, transparent 1px)," +
            "linear-gradient(90deg, rgb(var(--color-accent) / 0.6) 1px, transparent 1px)",
          backgroundSize: "30px 30px",
        }}
      />
      <div className="pointer-events-none absolute left-3 top-3 h-4 w-4 border-l-2 border-t-2 border-accent opacity-70" />
      <div className="pointer-events-none absolute right-3 top-3 h-4 w-4 border-r-2 border-t-2 border-accent-2 opacity-70" />

      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <span className="label text-accent">// Neon District · Directory</span>
          <h1
            className="mt-1 font-display text-2xl font-black uppercase tracking-wide text-primary sm:text-3xl"
            style={{ textShadow: "0 0 18px rgb(var(--color-accent) / 0.45)" }}
          >
            Table of Contents
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-secondary">{intro}</p>
        </div>

        <div className="grid shrink-0 grid-cols-3 gap-2 font-mono">
          <StatCell label="Blocks" value={pad2(blocks)} tone="accent" />
          <StatCell label="Signs" value={pad2(shops)} tone="accent-2" />
          <StatCell label="Lit" value={`${pad2(lit)}/${pad2(shops)}`} tone="bull" />
        </div>
      </div>
    </header>
  );
}

function StatCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "accent" | "accent-2" | "bull";
}) {
  const border = tone === "accent" ? "border-accent" : tone === "accent-2" ? "border-accent-2" : "border-bull";
  const text = tone === "accent" ? "text-accent" : tone === "accent-2" ? "text-accent-2" : "text-bull";
  return (
    <div className={`border ${border} bg-surface/60 px-2.5 py-1.5`} style={{ boxShadow: "0 0 10px rgb(var(--color-accent) / 0.12)" }}>
      <div className="text-[7px] uppercase tracking-[0.16em] text-muted">{label}</div>
      <div className={`num text-[15px] font-semibold leading-tight ${text}`}>{value}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Block module (one track = one lit block)                                   */
/* -------------------------------------------------------------------------- */

const TONE_VAR: Record<"accent" | "accent-2" | "bull", string> = {
  accent: "--color-accent",
  "accent-2": "--color-accent-2",
  bull: "--color-bull",
};

function NeonPlaque({
  tone,
  children,
}: {
  tone: "accent" | "accent-2" | "bull";
  children: ReactNode;
}) {
  const v = TONE_VAR[tone];
  return (
    <span
      className="relative grid h-12 w-12 shrink-0 place-items-center rounded-md"
      style={{
        border: `1.5px solid rgb(var(${v}))`,
        background: "rgb(var(--color-surface-raised) / 0.7)",
        boxShadow: `0 0 12px rgb(var(${v}) / 0.4)`,
      }}
    >
      {children}
    </span>
  );
}

function BlockModule({
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
  const code = MOTIF_CODE[track.motif] ?? "SYS";
  const frac = track.totalCount > 0 ? track.masteredCount / track.totalCount : 0;

  return (
    <section className="panel overflow-hidden">
      <header className="relative flex flex-wrap items-center gap-4 border-b-2 border-accent/40 p-4 sm:p-5">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              "linear-gradient(90deg, rgb(var(--color-accent) / 0.06), transparent 40%, rgb(var(--color-accent-2) / 0.06))",
          }}
        />
        <NeonPlaque tone="accent">
          <span className="text-accent">
            <Icon width={22} height={22} />
          </span>
        </NeonPlaque>
        <div className="relative min-w-0 flex-1">
          <span className="label text-accent-2">
            Block {blockHex(index)} · {code}
          </span>
          <h2
            className="mt-0.5 font-display text-xl font-black uppercase tracking-wide text-primary sm:text-2xl"
            style={{ textShadow: "0 0 14px rgb(var(--color-accent) / 0.35)" }}
          >
            {track.title}
          </h2>
          <p className="mt-0.5 text-sm text-secondary">{track.tagline}</p>
        </div>
        <div className="relative flex shrink-0 items-center gap-3">
          <div className="hidden w-28 sm:block">
            <div className="h-2 overflow-hidden rounded-sm border border-accent/50 bg-surface-muted">
              <div
                className="h-full bg-accent"
                style={{
                  width: `${Math.round(frac * 100)}%`,
                  boxShadow: "0 0 8px rgb(var(--color-accent) / 0.9)",
                }}
              />
            </div>
            <div className="mt-1 text-right font-mono text-[9px] uppercase tracking-wider text-muted">
              {Math.round(frac * 100)}% lit
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="label text-[9px]">Lit</span>
            <span className="num text-lg font-semibold text-primary">
              {track.masteredCount}/{track.totalCount}
            </span>
          </div>
        </div>
      </header>

      <ol className="divide-y divide-subtle">
        {track.lessons.flatMap((lesson, i) => [
          ...(startsSection(track.lessons, i)
            ? [<TocSectionDivider key={`section-${lesson.id}`} section={lesson.section as string} />]
            : []),
          <ShopRow
            key={lesson.id}
            code={`${code}-${pad2(i + 1)}`}
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
/*  Lesson (storefront) row                                                    */
/* -------------------------------------------------------------------------- */

function NumberPlaque({
  mastered,
  locked,
  index,
}: {
  mastered: boolean;
  locked: boolean;
  index: number;
}) {
  const v = mastered ? "--color-bull" : locked ? "--color-text-muted" : "--color-accent";
  const text = mastered ? "text-bull" : locked ? "text-muted" : "text-accent";
  return (
    <span
      className="relative grid h-11 w-11 shrink-0 place-items-center rounded-md"
      style={{
        border: `1.5px solid rgb(var(${v}))`,
        background: "rgb(var(--color-surface) / 0.9)",
        boxShadow: locked ? "none" : `0 0 10px rgb(var(${v}) / 0.45)`,
      }}
    >
      <span className={`num text-sm font-semibold ${text}`}>
        {mastered ? <CheckIcon width={20} height={20} /> : locked ? <LockIcon width={16} height={16} /> : pad2(index + 1)}
      </span>
    </span>
  );
}

function ShopRow({
  code,
  index,
  lesson,
  locked,
  href,
}: {
  code: string;
  index: number;
  lesson: TocLessonItem;
  locked: boolean;
  href: string;
}) {
  const mastered = lesson.state === "mastered";
  const unit = lesson.mode === "flashcard" ? " cards" : "Q";

  const inner = (
    <>
      <NumberPlaque mastered={mastered} locked={locked} index={index} />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={`num text-[11px] font-semibold ${locked ? "text-muted" : "text-accent-2"}`}>{code}</span>
          <h3 className="font-display text-base font-semibold uppercase tracking-wide text-primary">{lesson.title}</h3>
          <span className="chip border-subtle text-secondary">{lesson.difficultyLabel}</span>
          <span className="num text-[11px] text-muted">
            {lesson.questionCount}
            {unit}
          </span>
          {mastered && <span className="chip border-bull text-bull">Lit</span>}
          {locked && <span className="chip border-subtle text-muted">Dark</span>}
        </div>
        <p className="mt-1 text-sm leading-relaxed text-secondary">{lesson.description}</p>
      </div>

      <div className="hidden shrink-0 flex-col items-end gap-1 self-center sm:flex">
        {mastered ? (
          <span className="label text-bull">● Open</span>
        ) : locked ? (
          <span className="label text-muted">Shuttered</span>
        ) : (
          <span className="label text-accent">Step in →</span>
        )}
      </div>
    </>
  );

  const rowClass = "flex items-start gap-3 p-4 sm:gap-4";

  if (locked) {
    return (
      <li aria-disabled="true" title="Light up the previous shop first" className={`${rowClass} cursor-not-allowed opacity-60`}>
        {inner}
      </li>
    );
  }

  return (
    <li>
      <Link to={href} aria-label={`${lesson.title} — ${lesson.state}`} className={`${rowClass} transition-colors hover:bg-surface-muted`}>
        {inner}
      </Link>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/*  Coming-soon / not-yet-lit storefronts                                     */
/* -------------------------------------------------------------------------- */

function DarkStorefronts({ tracks }: { tracks: TocComingSoonTrack[] }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="label text-accent-2">// Not Yet Lit · Coming Soon</span>
        <span className="h-px flex-1 bg-subtle" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {tracks.map((t) => {
          const Icon = MOTIF_ICON[t.motif];
          const code = MOTIF_CODE[t.motif] ?? "SYS";
          return (
            <div key={t.id} className="panel border-dashed p-4 opacity-70" style={{ borderStyle: "dashed" }}>
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-dashed border-subtle text-muted">
                  <Icon width={20} height={20} />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="num text-[11px] font-semibold text-muted">BLOCK — · {code}</span>
                    <h3 className="font-display text-lg font-semibold uppercase tracking-wide text-primary">{t.title}</h3>
                    <span className="chip border-subtle text-primary">Wiring up</span>
                  </div>
                  <p className="mt-1 text-sm text-primary">{t.description}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
