# Theme System — author guide & contract

> **STRIP-DOWN NOTICE (guided-pipeline P1, spec §7.2).** The app is now
> hard-locked to the single **minimalist** theme. The five alternate themes
> (broadsheet / casino / chalkboard / cyberpunk / kids), the `/themes` gallery
> page, and the named-theme switcher have been REMOVED. A working **light/dark
> toggle is kept** (RESOLVED DECISION §10.7) — that is a color-MODE switch inside
> the locked minimalist theme, not a theme swap. The multi-theme contract below
> is retained for reference (and in case themes are ever re-enabled), but
> `THEMES` in `src/themes/index.ts` now contains only `minimalist` and
> `getTheme()` always resolves to it.

Quant Trader Prep supports **N named visual themes**. A theme changes **only aesthetics** — never content, copy, layout structure, or which questions/levels exist. Everything themeable flows through semantic CSS-variable tokens, so a new theme supplies token values (+ optional assets) and never rewrites components.

At runtime the active theme injects a `<style id="qtp-theme">` block that sets the token variables for `:root` (light) and `.dark` (dark). The existing light/dark toggle still works **within** any theme.

---

## Where things live

| File | Role | Editable by theme authors? |
|---|---|---|
| `src/themes/types.ts` | The **contract** (`Theme` interface + token→CSS mapping + `applyTheme`) | **No — complete** |
| `src/themes/base.ts` | Base (broadsheet) token values to inherit | No — read-only, import from it |
| `src/themes/index.ts` | The **registry** (all 6 themes registered) | **No — complete** |
| `src/pages/TrackPage.tsx` | The **level-map component** (renders `getMapStation` per node) | **No — complete** |
| `src/pages/TableOfContentsPage.tsx` | The **Table-of-Contents page** (`/contents`): gathers data, computes lesson state, owns navigation + locking, and mounts the theme's `TableOfContents` (or the base one) | **No — complete** |
| `src/themes/BaseTableOfContents.tsx` | The **default ToC renderer** (used when a theme omits `TableOfContents`; also the reference impl to delegate to) | No — read-only, import from it |
| `src/themes/<id>/` | **One theme module** (incl. `stations.tsx`, `MapBackground.tsx`, `TableOfContents.tsx`) | **Yes — this is the ONLY place you edit** |

Each of the 5 parallel themes is fully isolated to its own folder — no shared-file edits, no conflicts:

- `src/themes/minimalist/` → id `minimalist`
- `src/themes/kids/` → id `kids`
- `src/themes/cyberpunk/` → id `cyberpunk`
- `src/themes/chalkboard/` → id `chalkboard`
- `src/themes/casino/` → id `casino`

(`broadsheet` is the default reference theme.)

---

## The `Theme` contract (from `src/themes/types.ts`)

```ts
export interface Theme {
  id: string;            // must equal the folder name under src/themes/
  label: string;         // shown in the Themes gallery
  description: string;   // one-line card description
  colors: { light: ThemeColorTokens; dark: ThemeColorTokens };
  typography: ThemeTypography;
  shape: ThemeShape;

  Background?: ComponentType;                       // full-screen app backdrop
  MapBackground?: ComponentType;                    // level-path board backdrop (per theme)
  getLevelIllustration?: (
    ctx: LevelIllustrationContext,
  ) => IllustrationComponent | null | undefined;   // per-level lesson art
  getMapStation?: (
    ctx: LevelIllustrationContext,
  ) => MapStationComponent | null | undefined;     // per-node map "station" art
  TableOfContents?: TableOfContentsComponent;       // whole-page /contents renderer
  celebration?: () => void;                         // mastery flourish override

  wip?: boolean;         // shows an "In progress" chip; remove when done
}
```

Supporting types:

```ts
export interface ThemeColorTokens {
  bg; surface; surfaceRaised; surfaceMuted; border; borderStrong;
  textPrimary; textSecondary; textMuted;
  accent; accentHover; accentContrast; accent2; accent2Hover;
  gold; success; successSoft; danger; dangerSoft; warning;
  bull; bear; texGrid;      // all are "R G B" channel strings, e.g. "249 237 224"
  grainOpacity;             // "0"–"1", e.g. "0.05"
}
export interface ThemeTypography {
  display: string; body: string; mono: string;   // CSS font-family stacks
  fontLinks?: string[];                           // web-font stylesheet URLs to inject
}
export interface ThemeShape { radiusSm: string; radius: string; radiusMd: string; }

export interface LevelIllustrationContext {
  trackId: string; levelId: string; levelIndex: number; motif: MotifKey;
}
export type IllustrationComponent = ComponentType<{ className?: string }>;

export type MapStationState = "locked" | "unlocked" | "mastered";
export type MapStationComponent = ComponentType<{
  className?: string;
  state?: MapStationState;
}>;

// ---- Table of Contents (whole-page /contents renderer) ----
export type TocLessonState = "locked" | "unlocked" | "mastered";

export interface TocLessonItem {
  id: string;              // level id, e.g. "pr-1"
  trackId: string;         // owning track id, e.g. "probability"
  title: string;
  subtitle?: string;       // the level's subtitle (optional secondary line)
  description: string;     // one-sentence blurb of what the lesson teaches
  difficulty: Difficulty;
  difficultyLabel: string; // resolved label, e.g. "Easy"
  state: TocLessonState;   // computed by the PAGE (never by the theme)
  questionCount: number;   // # questions / flashcards
  mode: LevelMode;         // "quiz" | "flashcard"
}

export interface TocTrack {
  id: string; title: string; tagline: string; description: string;
  motif: MotifKey;
  lessons: TocLessonItem[];
  masteredCount: number; totalCount: number;
}

export interface TocComingSoonTrack {
  id: string; title: string; tagline: string; description: string; motif: MotifKey;
}

export interface TocViewProps {
  tracks: TocTrack[];                 // playable sections, in curriculum order
  comingSoon: TocComingSoonTrack[];   // teaser tracks (e.g. Calibration Gym)
  onSelectLesson: (trackId: string, lessonId: string) => void; // no-op for locked
  lessonHref: (trackId: string, lessonId: string) => string;   // same route the map uses
  isLocked: (lesson: TocLessonItem) => boolean;
}

export type TableOfContentsComponent = ComponentType<TocViewProps>;
```

### Hard rules (enforced by review; contrast is non-negotiable)
- **(a) Aesthetics only** — do not change content/copy/layout/logic.
- **(b) Contrast** — `textPrimary/Secondary/Muted` must be WCAG-AA against `bg` **and** `surface`, and `accentContrast` must be AA against `accent`, in **both** light and dark.
- **(c) Responsive** — must not break components from 360px → ≥1280px.

---

## How to author your theme

Edit only `src/themes/<id>/index.ts` (rename to `index.tsx` if you add components).

### 1) Token values — inherit the base, override what you need
```ts
import type { Theme } from "../types";
import { BASE_LIGHT, BASE_DARK, BASE_TYPOGRAPHY, BASE_SHAPE } from "../base";

export const minimalistTheme: Theme = {
  id: "minimalist",
  label: "Minimalist",
  description: "Clean, quiet, monochrome.",
  colors: {
    light: { ...BASE_LIGHT, bg: "255 255 255", accent: "17 17 17", accentContrast: "255 255 255" },
    dark:  { ...BASE_DARK,  bg: "10 10 10",   accent: "240 240 240", accentContrast: "10 10 10" },
  },
  typography: { ...BASE_TYPOGRAPHY, display: '"Inter", system-ui, sans-serif' },
  shape: { ...BASE_SHAPE, radius: "0px", radiusSm: "0px", radiusMd: "0px" },
  // wip: true  ← remove when finished
};
```
Colors are **space-separated RGB channels** (not `#hex`, not `rgb()`), because Tailwind consumes them as `rgb(var(--token) / <alpha>)`.

### 2) Background component (optional) — the animated/decorative backdrop
Add a component in your folder and reference it:
```tsx
// src/themes/minimalist/Background.tsx
export function MinimalBackground() {
  return <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 /* ... */" />;
}
// index.tsx
import { MinimalBackground } from "./Background";
export const minimalistTheme: Theme = { /* ... */, Background: MinimalBackground };
```
It's rendered full-screen behind all content (the app uses `<ThemeBackground/>`, which falls back to the default DeskBackground if you omit it). Must be `pointer-events-none`, sit behind content, respect `prefers-reduced-motion`, and stay 60fps.

### 3) Per-level illustration hook (optional; e.g. the kids cartoon)
```ts
import type { IllustrationComponent, LevelIllustrationContext } from "../types";
function DiceScene() { return /* an SVG/animation component */; }

export const kidsTheme: Theme = {
  /* ... */
  getLevelIllustration: (ctx: LevelIllustrationContext): IllustrationComponent | null => {
    if (ctx.trackId === "probability" && ctx.levelIndex === 0) return DiceScene;
    return null; // no illustration for this level
  },
};
```
The returned component is rendered in the lesson briefing (below the level subtitle). It receives an optional `className`. Return `null`/`undefined` for levels you don't illustrate. `ctx.motif` is one of `probability | mentalMath | brainteasers | interviewGames | calibration`.

### 4a) Map board background (the decorated level-path environment)
ONE component per theme (`MapBackground`), **shared across all of that theme's tracks** (mental-math and brainteasers reuse the same board). It decorates the whole level-path board behind the winding path + nodes + stations — like Candy-Crush's level environment.

```tsx
// src/themes/kids/MapBackground.tsx
export function KidsMapBackground() {
  return (
    <div aria-hidden="true" className="absolute inset-0 h-full w-full /* your art */" />
  );
}
// index.tsx →  MapBackground: KidsMapBackground
```

Rendering contract (already wired in `TrackPage.tsx`, do not edit):
- Your component is placed in an **absolutely-positioned, full-board wrapper** that is `inset-0`, `pointer-events-none`, `aria-hidden`, and sits at **z-0 — BELOW** the path SVG (z-10), the nodes (z-20), and the stations. So it never steals node clicks and never covers the numbers/lock/check.
- **Sizing / coordinate space:** the wrapper fills the FULL, scrollable board (not just the viewport). The board is `position: relative`, **width = 100%** of the map panel (responsive, up to ~1100px wide), **height = `levels × 138px`** (so 3–5 levels → **414–690px**, i.e. the board is portrait-ish and grows with level count). Make your art **fill its parent** (`absolute inset-0` or `h-full w-full`) and **cover the whole height** — either stretch to 100%/100% or **tile seamlessly** (CSS `background-repeat` or an SVG `<pattern>`), since you don't know the exact pixel height. Nodes wind along a sine path (x oscillates ±32% around center, y steps every 138px), so keep the design even/tiling rather than a single fixed focal point that only reads at one height.
- **Legibility (CRITICAL):** keep it a **subtle-to-medium environment**, not a busy overlay. The path lines, level numbers, station art, and node labels must stay clearly visible and WCAG-AA. Use low-contrast/low-opacity fills, theme tokens (`rgb(var(--color-...))`), and avoid high-frequency clutter directly under the nodes. Respect `prefers-reduced-motion` if animated. Keep it lightweight (CSS/SVG).
- **Fallback:** if a theme omits `MapBackground`, the board shows the default plotting-paper grid (`.tex-grid`). The current stub renders that same grid, so the map is unchanged until you implement — replace it with your environment (opaque or layered over the grid as you like).

### 4) Map stations (per-node landmark art on the progression map)
Decorate each level node on the Candy-Crush map as a **distinct "station."** Stations must differ **per level** AND **per track** — use `ctx.trackId` + `ctx.levelIndex`.

```ts
import type {
  LevelIllustrationContext,
  MapStationComponent,
  MapStationState,
} from "../types";

function BouncyHouse({ className, state }: { className?: string; state?: MapStationState }) {
  return <svg viewBox="0 0 100 100" className={className} aria-hidden="true">/* ... */</svg>;
}
// ...one component per (track, level)

export function getKidsStation(ctx: LevelIllustrationContext): MapStationComponent | null {
  if (ctx.trackId === "probability") {
    return [BouncyHouse, Arcade, FerrisWheel, CandyCastle, RocketPad][ctx.levelIndex] ?? null;
  }
  // ...other tracks
  return null; // plain node
}
```

Rendering contract (already wired in `TrackPage.tsx`, do not edit):
- The returned component is rendered as a **decorative layer centered BEHIND the node button**, in a **116×116 px box**; the app passes `className="h-full w-full"` — fill it (e.g. an `<svg viewBox="0 0 100 100" className={className}>`). The node button is 68×68 and sits on top (`z-10`).
- Your layer is `pointer-events-none` (it never steals the node's click) and `aria-hidden`.
- You receive `state?: "locked" | "unlocked" | "mastered"` — dim/gray a locked station, and you may add a "complete" flourish for mastered. The button already renders the number/lock/check + state colors, so the station should COMPLEMENT it, not hide it.
- Return `null`/`undefined` for any node to keep the plain node (safe fallback).
- Keep art lightweight (inline SVG preferred) and responsive; use theme tokens via `rgb(var(--color-...))` or `currentColor` so it tracks light/dark.

Wire it in your theme index: `getMapStation: getKidsStation`.

### 5) Celebration flourish (optional)
```ts
export const casinoTheme: Theme = {
  /* ... */,
  celebration: () => { /* fire your own confetti/animation on mastery */ },
};
```
If omitted, the default (amber/green "tick" burst) runs. Respect `prefers-reduced-motion`.

### 6) Table of Contents page (whole-page `/contents` renderer)
ONE component per theme (`TableOfContents`) that renders the **entire** Table-of-Contents page in your theme's aesthetic — every section and every lesson, as a browsable index. Reached from the landing page's **"See All Sections"** CTA and the `/contents` route.

```tsx
// src/themes/kids/TableOfContents.tsx
import type { TocViewProps } from "../types";
import { BaseTableOfContents } from "../BaseTableOfContents";

export function KidsTableOfContents(props: TocViewProps) {
  // Start by delegating to the base renderer, then progressively restyle:
  return <BaseTableOfContents {...props} />;
}
// index.tsx →  TableOfContents: KidsTableOfContents
```

Rendering contract (already wired in `TableOfContentsPage.tsx`, do not edit):
- Your component is mounted inside the standard authenticated **app shell** (`max-w-6xl`, `px-4 py-6 sm:py-8` main padding, page scroll). Render a normal in-flow block; don't create your own full-screen fixed layout.
- **Data:** you receive `TocViewProps` — `tracks` (playable sections in curriculum order, each with `lessons[]` + `masteredCount`/`totalCount`), `comingSoon` (teaser tracks like the Calibration Gym; render as disabled/teaser or omit), plus behavior helpers.
- **Behavior is OWNED by the page — style only.** Navigate unlocked/mastered lessons with `lessonHref(trackId, lessonId)` (a router `<Link>`/`<a>`) or by calling `onSelectLesson(trackId, lessonId)`; the page's `onSelectLesson` is a **no-op for locked lessons**. Use `isLocked(lesson)` (equivalently `lesson.state === "locked"`) to render locked lessons **visible but non-interactive** with a lock affordance — matching how the map greys locked nodes. **Do NOT** recompute unlock/mastery rules or hand-build lesson routes.
- **Show everything:** render all `tracks` and all their `lessons` (17 lessons across 4 tracks today), each with its `title`, one-sentence `description` (blurb), `difficultyLabel`, `questionCount` + `mode`, and a locked/unlocked/mastered indicator.
- **Legibility / responsive (CRITICAL):** must be WCAG-AA in **both** light and dark, and must not break from **360px → ≥1280px** (stack on mobile, grid/columns on desktop as you like). Use theme tokens (`rgb(var(--color-...))`) and the shared component classes (`.panel`, `.chip`, `.label`, `.num`, …) so it tracks the active theme automatically.
- **Fallback:** if a theme omits `TableOfContents`, the page renders `BaseTableOfContents` (already token-driven), so `/contents` always works. Replace the stub body with your bespoke design; **keep the `<Name>TableOfContents` export name + `TocViewProps` signature.**

Wire it in your theme index: `TableOfContents: KidsTableOfContents`.

---

## Tracks & levels (how many stations to make per track)

Stations vary by track AND level. Each track's nodes appear in this order (index 0-based). The `calibration-gym` track is "coming soon" and has **no map**, so it needs no stations.

| Track id | # levels | Level ids (in order) |
|---|---|---|
| `probability` | 9 | pr-1 … pr-5, then bs-1, bs-2, bs-3, bs-4 (Betting & Sizing) |
| `mental-math` | 4 | mm-1, mm-2, mm-3, mm-4 |
| `brainteasers` | 3 | bt-1, bt-2, bt-3 |
| `interview-games` | 4 | ig-1, ig-2, ig-3, ig-4 |

Stations resolve by `ctx.trackId` + `ctx.levelIndex` (0…n−1), cycling through each track's station family (`levelIndex % family.length`), so appending levels reuses existing station art with no new art required. `ctx.levelId` is the exact id above.

---

## Token / class reference for authors

Components consume these Tailwind classes → CSS variables (you only set the variables via tokens):

- Backgrounds: `bg-bg`, `bg-surface`, `bg-surface-raised`, `bg-surface-muted`
- Text: `text-primary`, `text-secondary`, `text-muted`, `text-accent`, `text-bull`, `text-bear`, `text-accent-contrast`
- Borders/rules: `border-subtle` (→ `border`), `border-border-strong` (→ `borderStrong`)
- Accents/signals: `bg-accent` / `accent-hover`, `bg-bull`, `bg-bear`, `success(-soft)`, `danger(-soft)`, `gold`, `warning`, `accent-2`
- Fonts: `font-display` (→ `--font-display`), `font-sans` (→ body), `font-mono`
- Radii: `rounded-sm|rounded|rounded-md` (→ `--radius-*`); `rounded-full` is always pill
- Texture hooks: `.tex-grid` uses `--tex-grid`; grain uses `--grain-opacity`

Reusable component classes (already token-driven): `.panel`, `.panel-ruled`, `.btn(-primary|-secondary|-ghost)`, `.input`, `.label`, `.chip`, `.num`, `.cursor`.

---

## Previewing a single theme while developing

- Run `npm run dev`, log in, open the **Themes** tab (top nav), and click **Apply** on your theme. Your choice persists to `localStorage` (`qtp.themeId`).
- Toggle light/dark with the header sun/moon to verify **both** variants.
- The Themes gallery card renders a live light+dark mini-swatch of your tokens/fonts — a fast contrast check.
- To make your theme the temporary default while iterating, you can set `DEFAULT_THEME_ID` locally in `src/themes/index.ts` — but revert it (do not commit registry edits).

## Verify before handing off
- `npm run build` clean, `npm run test` passes (the registry contract test in `src/themes/themes.test.ts` will validate your token completeness), `npm run dev` runs.
- No invisible/low-contrast text in light **or** dark. Responsive at 360px and ≥1280px.
