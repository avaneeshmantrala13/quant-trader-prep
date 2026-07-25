import type { ComponentType } from "react";
import type { Difficulty, LevelMode, MotifKey } from "@/types/content";
import type { MasteryState } from "@/lib/mastery/verdict";
import type { ReliabilityDiagramData } from "@/lib/calibration/reliability";

/**
 * ============================================================================
 *  QUANT TRADER PREP — THEME CONTRACT
 * ============================================================================
 * A theme changes ONLY aesthetics. It NEVER changes content, copy, layout
 * structure, or which questions/levels exist. Every themeable style flows
 * through the semantic tokens below, so a new theme supplies token values (and
 * optional assets) — never per-component rewrites.
 *
 * HARD RULES every theme MUST satisfy:
 *   (a) Aesthetics only — no content/copy/layout/logic changes.
 *   (b) Contrast — text must be WCAG-AA (>=4.5:1 body, >=3:1 large) against its
 *       own backgrounds in BOTH light and dark variants. Never let text vanish.
 *   (c) Responsive — must not break components at 360px → ≥1280px.
 *
 * Authoring a theme = editing ONLY files inside `src/themes/<id>/`.
 * `src/themes/types.ts` and `src/themes/index.ts` are COMPLETE — do not edit.
 */

/**
 * Color tokens. Color values are space-separated RGB CHANNELS (e.g. "249 237
 * 224"), because Tailwind consumes them as `rgb(var(--token) / <alpha>)` to
 * support opacity. `grainOpacity` is a plain 0–1 number string.
 */
export interface ThemeColorTokens {
  bg: string; // page background
  surface: string; // panels/cards
  surfaceRaised: string; // elevated surface
  surfaceMuted: string; // subtle fills, tracks
  border: string; // hairline borders
  borderStrong: string; // heavy rules / ink lines
  textPrimary: string; // headlines & body — must pass AA on bg/surface
  textSecondary: string; // secondary text — must pass AA
  textMuted: string; // muted/annotation text — must pass AA
  accent: string; // primary brand accent
  accentHover: string;
  accentContrast: string; // text/icon color ON accent — must pass AA on accent
  accent2: string; // secondary accent (used sparingly)
  accent2Hover: string;
  gold: string;
  success: string;
  successSoft: string; // soft success background
  danger: string;
  dangerSoft: string; // soft danger background
  warning: string;
  bull: string; // "up"/correct green
  bear: string; // "down"/incorrect red
  texGrid: string; // grid/plotting-paper line color (RGB channels)
  grainOpacity: string; // 0–1, texture grain strength (e.g. "0.05")
}

export interface ThemeTypography {
  /** CSS font-family stack for display/serif headlines. */
  display: string;
  /** CSS font-family stack for body/UI text. */
  body: string;
  /** CSS font-family stack for data/mono/labels. */
  mono: string;
  /** Optional web-font stylesheet URLs injected while this theme is active. */
  fontLinks?: string[];
}

export interface ThemeShape {
  radiusSm: string; // maps to Tailwind `rounded-sm`
  radius: string; // maps to Tailwind `rounded` (DEFAULT)
  radiusMd: string; // maps to Tailwind `rounded-md`
}

/** Context passed to a theme's per-level illustration provider. */
export interface LevelIllustrationContext {
  trackId: string;
  levelId: string;
  levelIndex: number;
  motif: MotifKey;
}

/** A component that renders a decorative illustration (no required props). */
export type IllustrationComponent = ComponentType<{ className?: string }>;

/** The unlock state of a level node on the progression map. */
export type MapStationState = "locked" | "unlocked" | "mastered";

/**
 * A per-node "station" decoration on the Candy-Crush progression map. Rendered
 * as a decorative layer CENTERED BEHIND the level node button (pointer-events
 * are disabled so it never steals a click). It receives the node's unlock
 * `state` so art can differ for locked/unlocked/mastered, and a `className`
 * (the app passes a square sizing box — fill it, e.g. `h-full w-full`).
 */
export type MapStationComponent = ComponentType<{
  className?: string;
  state?: MapStationState;
}>;

/* -------------------------------------------------------------------------- */
/*  TABLE OF CONTENTS — per-theme whole-page rendering contract               */
/* -------------------------------------------------------------------------- */

/**
 * Unlock/mastery state of a single lesson, mirroring the progression map's
 * node state. Computed by the ToC PAGE from the shared progress logic — a theme
 * never recomputes it.
 */
export type TocLessonState = "locked" | "unlocked" | "mastered";

/**
 * One lesson row in the Table of Contents. This is a flattened, display-ready
 * projection of a `Level` — a theme only styles these fields, it does not read
 * the raw content model.
 */
export interface TocLessonItem {
  /** The level id, e.g. "pr-1". */
  id: string;
  /** The id of the track this lesson belongs to, e.g. "probability". */
  trackId: string;
  /** Lesson title (same copy as the level title). */
  title: string;
  /** Short teaching subtitle (the level's subtitle) — optional secondary line. */
  subtitle?: string;
  /** One-sentence description of what the lesson teaches (the level's blurb). */
  description: string;
  /**
   * Optional subcategory/section label (the level's `section`). When a track
   * bundles several topic families into one flat list, consecutive lessons
   * sharing a `section` form a labeled segment; the ToC renders a divider
   * whenever it changes. Undefined for tracks with a single (unlabeled) family,
   * so those render with no dividers exactly as before.
   */
  section?: string;
  /** Difficulty tier. */
  difficulty: Difficulty;
  /** Human-friendly difficulty label, e.g. "Easy" (already resolved). */
  difficultyLabel: string;
  /** Unlock/mastery state — computed by the page, never by the theme. */
  state: TocLessonState;
  /** Number of questions / flashcards in the lesson. */
  questionCount: number;
  /** Play style: "quiz" | "flashcard". */
  mode: LevelMode;
}

/**
 * A track (section) grouping its lessons for the Table of Contents. `lessons`
 * are in curriculum order; `masteredCount`/`totalCount` are precomputed.
 */
export interface TocTrack {
  id: string;
  title: string;
  /** Short section tagline. */
  tagline: string;
  /** Longer section description. */
  description: string;
  motif: MotifKey;
  lessons: TocLessonItem[];
  /** How many of this track's lessons are mastered. */
  masteredCount: number;
  /** Total lessons in this track. */
  totalCount: number;
}

/**
 * A teaser-only ("coming soon") track, e.g. the Calibration Gym. It has no
 * playable lessons — a theme may render it as a disabled/teaser card or omit it.
 */
export interface TocComingSoonTrack {
  id: string;
  title: string;
  tagline: string;
  description: string;
  motif: MotifKey;
}

/**
 * Props passed to a theme's whole-page Table of Contents renderer. The PAGE
 * (`src/pages/TableOfContentsPage.tsx`) owns ALL behavior — data gathering,
 * state computation, navigation, and locking — so a theme's `TableOfContents`
 * component ONLY styles what it receives. It must:
 *   • render every `tracks[i]` section and its `lessons`,
 *   • call `onSelectLesson(trackId, lessonId)` when an unlocked/mastered lesson
 *     is activated (locked lessons must be shown but non-navigating),
 *   • use `isLocked(lesson)` for the locked/disabled affordance,
 *   • stay responsive (360px → ≥1280px), respect light/dark, and be WCAG-AA.
 */
export interface TocViewProps {
  /**
   * Shared, theme-agnostic explainer paragraph shown under the page title.
   * The SAME plain text across every theme (no theme-specific analogy) — a
   * theme styles this text slot in its own aesthetic but never rewrites the
   * copy. Defined ONCE by the page (`src/pages/TableOfContentsPage.tsx`).
   */
  intro: string;
  /** Playable tracks, in curriculum order, each with its lessons + states. */
  tracks: TocTrack[];
  /** Teaser-only tracks (e.g. Calibration Gym); may be rendered or ignored. */
  comingSoon: TocComingSoonTrack[];
  /**
   * Navigate to a lesson. A no-op for locked lessons (the page guards this), so
   * a theme can wire it to any row without re-checking the lock itself — though
   * it should still visually disable locked rows via `isLocked`.
   */
  onSelectLesson: (trackId: string, lessonId: string) => void;
  /**
   * Resolve the route a lesson links to — the SAME route the map uses
   * (`/track/:trackId/level/:levelId`). Useful for rendering an `<a href>` /
   * router `<Link>` for unlocked lessons instead of a button.
   */
  lessonHref: (trackId: string, lessonId: string) => string;
  /** True when a lesson is locked (not yet playable). */
  isLocked: (lesson: TocLessonItem) => boolean;
}

/** A theme's whole-page Table of Contents renderer. */
export type TableOfContentsComponent = ComponentType<TocViewProps>;

/* -------------------------------------------------------------------------- */
/*  DASHBOARD — per-theme whole-page rendering contract                        */
/* -------------------------------------------------------------------------- */

/**
 * A single friendly misconception chip. `label` is ALWAYS a short,
 * human-readable description of the concept the learner struggles with
 * (resolved by `@/lib/dashboard/misconceptionLabels`) — NEVER a raw key like
 * "idx:1" or "<topicKey>::option 0". `key` is the underlying namespaced
 * misconception key, exposed only as a stable React key / de-dupe id.
 */
export interface DashboardMisconception {
  /** Stable id (the raw namespaced misconception key). NOT for display. */
  key: string;
  /** Short, human-readable description of the struggle. Safe to render. */
  label: string;
}

/**
 * One fully display-ready per-topic entry. This is a flattened projection of a
 * Phase-1 `TopicVerdict` (+ friendly labels + a deep link) — a theme ONLY styles
 * these fields; it never reads the raw mastery model, recomputes a verdict, or
 * fetches data.
 */
export interface DashboardTopicEntry {
  /** Canonical topic identity (`${trackId}::${section}`). Use as a React key. */
  topicKey: string;
  /** Nice, human-readable topic name (e.g. "Conditional Probability & Bayes"). */
  name: string;
  /** Parent track title (e.g. "Probability & Statistics"). */
  trackTitle: string;
  /**
   * Calibration-aware verdict. UNCERTAIN is FIRST-CLASS — a theme must render it
   * distinctly and NEVER round it to STRONG or WEAK.
   */
  verdict: MasteryState;
  /** True once the topic has any graded evidence (n > 0); else the bar is empty. */
  hasEvidence: boolean;
  /** Beta posterior MEAN mastery in [0,1] (meaningful only when hasEvidence). */
  mean: number;
  /** 95% credible-interval LOWER bound in [0,1] (the "confidently weak" signal). */
  ciLow: number;
  /** 95% credible-interval UPPER bound in [0,1]. */
  ciHigh: number;
  /** Elo skill θ on the logit scale. */
  theta: number;
  /** Number of graded items in this topic. */
  gradedCount: number;
  /** True when a spaced (SM-2) review is currently due for this topic. */
  reviewDue: boolean;
  /** Friendly misconception chips (already humanized; never raw keys). */
  misconceptions: DashboardMisconception[];
  /** Deep-link route to practice this topic (its first level). */
  href: string;
}

/**
 * The recommended NEXT FOCUS — the top unlocked, non-mastered weakness. Absent
 * when there is no clear weak spot yet (e.g. no graded evidence).
 */
export interface DashboardRecommendation {
  topicKey: string;
  /** Nice topic name. */
  name: string;
  /** Parent track title. */
  trackTitle: string;
  /** CI_low in [0,1] — why this surfaced (worst, most-confident). */
  ciLow: number;
  /** Deep-link route to start practicing it. */
  href: string;
}

/**
 * Props passed to a theme's whole-page Dashboard renderer. The PAGE
 * (`src/pages/DashboardPage.tsx`) owns ALL data + behavior: it reads Phase-1
 * verdicts via `useDashboardData`, orders them with the pure ranking/reliability
 * modules, resolves friendly misconception labels, and builds every route here.
 * A theme's `Dashboard` component is a PURE PRESENTATIONAL CONSUMER of these
 * props — no data fetching, no mastery math, no locking, no route construction.
 * It must:
 *   • render the recommended focus, the per-topic entries, the weakness ranking,
 *     the reviews-due list, and the reliability diagram,
 *   • link topics/reviews via their provided `href` (locked/gating never applies
 *     — the dashboard is read-only over already-unlocked-or-evidenced topics),
 *   • stay responsive (360px → ≥1280px), respect light/dark, and be WCAG-AA.
 */
export interface DashboardViewProps {
  /** True once the learner has completed the calibration warm-up (diagnostic). */
  diagnosticDone: boolean;
  /** Route to (re)run the calibration warm-up. */
  diagnosticHref: string;
  /** Route back to the Table of Contents (the dashboard's "back" affordance). */
  contentsHref: string;
  /** The recommended next focus, or undefined when there's no clear weak spot. */
  recommended?: DashboardRecommendation;
  /** Every topic in the curriculum, curriculum order (cards / grid). */
  topics: DashboardTopicEntry[];
  /** Evidenced topics ranked ascending by CI_low (worst-most-confident first). */
  weaknesses: DashboardTopicEntry[];
  /** Topics with a spaced review due now (earliest-due first). */
  due: DashboardTopicEntry[];
  /**
   * Pooled reliability-diagram data: points (`bins`), the Brier reliability gap
   * (`relGap`) + Brier score, the total pair count, and the "when you say ~80%,
   * you're right X%" headline. `count === 0` ⇒ render the honest
   * insufficient-data state (never fabricate a curve).
   */
  reliability: ReliabilityDiagramData;
}

/** A theme's whole-page Dashboard renderer. */
export type DashboardComponent = ComponentType<DashboardViewProps>;

export interface Theme {
  /** Stable unique id; must equal the folder name under `src/themes/`. */
  id: string;
  /** Human-friendly name shown in the Themes gallery. */
  label: string;
  /** One-line description shown on the theme card. */
  description: string;
  /** Colors for BOTH light and dark variants (light/dark toggle still works). */
  colors: { light: ThemeColorTokens; dark: ThemeColorTokens };
  typography: ThemeTypography;
  shape: ThemeShape;

  // ---- optional hooks, all consumed generically by the app ----
  /** Full-screen animated/decorative backdrop (behind all content). */
  Background?: ComponentType;
  /**
   * Decorative background for the level-path BOARD on the track maps (behind
   * the winding path + nodes + stations). ONE component per theme, shared
   * across all of that theme's tracks. It is rendered into an absolutely-
   * positioned, full-board (`inset-0`), `pointer-events-none` + `aria-hidden`
   * layer BELOW the path/nodes — so it must stay subtle and never hurt the
   * legibility of the path, level numbers, stations, or labels. Omit it to fall
   * back to the default plotting-paper grid.
   */
  MapBackground?: ComponentType;
  /**
   * Optional per-level illustration provider. Return a component to render an
   * illustration/animation in the lesson briefing for the given level, or
   * null/undefined for none. (This is how the "kids" theme supplies a cartoon
   * animation per probability level.)
   */
  getLevelIllustration?: (
    ctx: LevelIllustrationContext,
  ) => IllustrationComponent | null | undefined;
  /**
   * Optional per-node "station" decoration for the progression map. Return a
   * component to decorate the given level's node as a distinct landmark (like a
   * Candy-Crush station), or null/undefined to keep the plain node. Use
   * `ctx.trackId` + `ctx.levelIndex` so a station differs per level AND per
   * track (probability level 1 ≠ mental-math level 1). The returned component
   * is rendered CENTERED BEHIND the node button (see MapStationComponent).
   */
  getMapStation?: (
    ctx: LevelIllustrationContext,
  ) => MapStationComponent | null | undefined;
  /**
   * Optional whole-page renderer for the Table of Contents (`/contents`). The
   * ToC page computes all data + behavior and hands it to this component via
   * `TocViewProps`; the theme ONLY styles the page in its own aesthetic
   * (sections, lesson rows, locked/unlocked/mastered affordances). Navigation
   * and locking are handled by the page — a theme never reimplements them. Omit
   * it to fall back to the app's BASE Table-of-Contents renderer, so the page
   * always works even before a theme implements this hook.
   */
  TableOfContents?: TableOfContentsComponent;
  /**
   * Optional whole-page renderer for the Mastery Dashboard (`/dashboard`). The
   * dashboard page computes ALL data + routes and hands them to this component
   * via `DashboardViewProps`; the theme ONLY styles the page in its own
   * aesthetic (headline focus, per-topic cards, weakness ranking, reviews-due,
   * reliability diagram). It performs NO data fetching, mastery math, or route
   * construction. Omit it to fall back to the app's `BaseDashboard`, so the page
   * always works even before a theme implements this hook. Per-theme
   * implementations live at `src/themes/<id>/Dashboard.tsx`.
   */
  Dashboard?: DashboardComponent;
  /** Optional celebration flourish, overrides the default confetti on mastery. */
  celebration?: () => void;

  /** Marks a stub not yet implemented by its parallel worker (shows a chip). */
  wip?: boolean;
}

/* -------------------------------------------------------------------------- */
/*  Token → CSS variable mapping + runtime application (complete; do not edit) */
/* -------------------------------------------------------------------------- */

const COLOR_VAR_MAP: Record<
  Exclude<keyof ThemeColorTokens, "grainOpacity">,
  string
> = {
  bg: "--color-bg",
  surface: "--color-surface",
  surfaceRaised: "--color-surface-raised",
  surfaceMuted: "--color-surface-muted",
  border: "--color-border",
  borderStrong: "--color-border-strong",
  textPrimary: "--color-text-primary",
  textSecondary: "--color-text-secondary",
  textMuted: "--color-text-muted",
  accent: "--color-accent",
  accentHover: "--color-accent-hover",
  accentContrast: "--color-accent-contrast",
  accent2: "--color-accent-2",
  accent2Hover: "--color-accent-2-hover",
  gold: "--color-gold",
  success: "--color-success",
  successSoft: "--color-success-soft",
  danger: "--color-danger",
  dangerSoft: "--color-danger-soft",
  warning: "--color-warning",
  bull: "--color-bull",
  bear: "--color-bear",
  texGrid: "--tex-grid",
};

function colorDecls(c: ThemeColorTokens): string {
  const parts = (
    Object.keys(COLOR_VAR_MAP) as (keyof typeof COLOR_VAR_MAP)[]
  ).map((k) => `${COLOR_VAR_MAP[k]}:${c[k]};`);
  parts.push(`--grain-opacity:${c.grainOpacity};`);
  return parts.join("");
}

/** Build the CSS text (`:root` light + `.dark` dark) for a theme. */
export function themeToCss(t: Theme): string {
  const base =
    `--font-display:${t.typography.display};` +
    `--font-body:${t.typography.body};` +
    `--font-mono:${t.typography.mono};` +
    `--radius-sm:${t.shape.radiusSm};` +
    `--radius:${t.shape.radius};` +
    `--radius-md:${t.shape.radiusMd};`;
  return `:root{${base}${colorDecls(t.colors.light)}}.dark{${colorDecls(t.colors.dark)}}`;
}

/** Apply a theme's tokens + fonts to the document (called by ThemeProvider). */
export function applyTheme(t: Theme): void {
  if (typeof document === "undefined") return;
  let style = document.getElementById("qtp-theme") as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = "qtp-theme";
    document.head.appendChild(style);
  }
  style.textContent = themeToCss(t);

  document.querySelectorAll("link[data-theme-font]").forEach((n) => n.remove());
  for (const href of t.typography.fontLinks ?? []) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.setAttribute("data-theme-font", "");
    document.head.appendChild(link);
  }
  document.documentElement.dataset.theme = t.id;
}
