import type { TocLessonItem } from "./types";

/**
 * SECTION DIVIDERS for the Table of Contents (shared across every theme).
 *
 * Some tracks (currently only Probability / Math) bundle several distinct topic
 * families — Core Probability, Betting & Sizing, Game Theory & Puzzles,
 * Expected Value, … — end-to-end into one flat, continuously-numbered lesson
 * list. Each family independently ramps Easy → Hard, so difficulty visibly
 * "resets" at the seams. That is expected (each is a NEW topic); the fix is
 * purely visual: label each segment so a student reads "new chapter" rather
 * than thinking the path glitched.
 *
 * This is 100% DATA-DRIVEN off `lesson.section` (projected from `Level.section`)
 * so any newly-added subcategory automatically gets a banner the moment its
 * levels appear — no per-track wiring. Tracks whose lessons have no `section`
 * (i.e. every other track) never trigger a divider, so they render unchanged.
 *
 * The divider is rendered as an `<li>` (it drops into each theme's `<ol>`) and
 * is styled with ONLY semantic theme tokens (`.label`, `bg-surface-muted`,
 * `bg-border-strong`, `text-accent`), so it adopts every theme's palette,
 * typography, and light/dark automatically while staying WCAG-AA.
 */

/**
 * True when the lesson at index `i` begins a new labeled section — i.e. it has
 * a `section` that differs from the previous lesson's. The first lesson starts
 * a section only when it actually has a `section`. Returns false for every
 * lesson in a track that has no sections at all.
 */
export function startsSection(lessons: TocLessonItem[], i: number): boolean {
  const section = lessons[i]?.section;
  if (!section) return false;
  return i === 0 || lessons[i - 1]?.section !== section;
}

/**
 * A token-styled section banner row for a ToC lesson `<ol>`. `className` lets a
 * theme adapt list mechanics (e.g. spanning both columns of a grid list).
 */
export function TocSectionDivider({
  section,
  className = "",
}: {
  section: string;
  className?: string;
}) {
  return (
    <li className={`flex items-center gap-3 bg-surface-muted px-4 py-2.5 ${className}`}>
      <span className="label shrink-0 text-accent">{section}</span>
      <span aria-hidden="true" className="h-px flex-1 bg-border-strong opacity-50" />
    </li>
  );
}
