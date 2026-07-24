/**
 * Shared neon palette + keyframes for the Cyberpunk "neon night city" theme.
 *
 * Every color flows through a theme token so the SAME artwork reads as bright
 * neon-against-blue-black (dark — the natural home) and a hazy dusk-neon on a
 * pale lavender base (light) — never invisible, never washed out. All motion is
 * transform / opacity / stroke-only (GPU-friendly) and each animated element
 * carries the `cp-anim` class so the injected `prefers-reduced-motion` rule
 * freezes it into a clean, fully-rendered static state (matching how the app's
 * other themes gate motion).
 */

import type { ReactElement } from "react";

/* Token-driven neon inks (space-separated RGB channels behind each var). */
export const CYAN = "rgb(var(--color-accent))"; // electric cyan/blue
export const MAGENTA = "rgb(var(--color-accent-2))"; // hot magenta/pink
export const INK = "rgb(var(--color-border-strong))"; // bright rule / ink line
export const MUTED = "rgb(var(--color-text-muted))";
export const GREEN = "rgb(var(--color-bull))"; // neon mint (open/mastered)
export const GOLD = "rgb(var(--color-gold))"; // warm amber window/lamp light
export const AMBER = "rgb(var(--color-warning))";
export const SURFACE = "rgb(var(--color-surface))";
export const SURFACE_RAISED = "rgb(var(--color-surface-raised))";
export const SURFACE_MUTED = "rgb(var(--color-surface-muted))";
export const BG = "rgb(var(--color-bg))";

/**
 * Shared keyframe stylesheet. Cheap + idempotent to render more than once.
 *  • cp-flicker / cp-flickerB — neon sign buzz (opacity only, two rhythms).
 *  • cp-buzz     — a fast subtle tube-buzz.
 *  • cp-glow     — a slow glow breathing.
 *  • cp-hazeX    — drifting atmospheric haze (horizontal).
 *  • cp-hazeY    — slow vertical fog rise.
 *  • cp-shimmer  — a wet-reflection light sweeping across the asphalt.
 *  • cp-rain     — thin rain streaks falling (translateY).
 *  • cp-sway     — a hanging signboard swinging a hair.
 *  • cp-pulse    — a beacon/bulb pulsing.
 *  • cp-dash     — marching dashes for wires / crosswalks.
 *  • cp-scan     — a slow light bar sweeping down.
 *  • cp-rise     — embers / sparks drifting upward.
 */
export const CYBERPUNK_ANIM_CSS = `
@keyframes cp-flicker{0%,100%{opacity:.92}41%{opacity:.55}44%{opacity:.95}52%{opacity:.6}54%{opacity:.9}}
@keyframes cp-flickerB{0%,100%{opacity:.85}18%{opacity:.5}22%{opacity:.9}70%{opacity:.62}74%{opacity:.9}}
@keyframes cp-buzz{0%,100%{opacity:.9}50%{opacity:.74}}
@keyframes cp-glow{0%,100%{opacity:.4}50%{opacity:.85}}
@keyframes cp-hazeX{0%{transform:translate3d(-6%,0,0)}100%{transform:translate3d(6%,0,0)}}
@keyframes cp-hazeY{0%{transform:translateY(3%)}100%{transform:translateY(-3%)}}
@keyframes cp-shimmer{0%{transform:translateX(-120%)}55%{transform:translateX(220%)}100%{transform:translateX(220%)}}
@keyframes cp-rain{0%{transform:translateY(-30%)}100%{transform:translateY(130%)}}
@keyframes cp-sway{0%,100%{transform:rotate(-1.4deg)}50%{transform:rotate(1.4deg)}}
@keyframes cp-pulse{0%,100%{opacity:.4;transform:scale(.82)}50%{opacity:.95;transform:scale(1.1)}}
@keyframes cp-dash{to{stroke-dashoffset:-24}}
@keyframes cp-scan{0%{transform:translateY(-100%)}100%{transform:translateY(100%)}}
@keyframes cp-rise{0%{transform:translateY(6%);opacity:0}14%{opacity:.85}100%{transform:translateY(-140%);opacity:0}}
.cp-flicker{animation:cp-flicker 5s steps(1,end) infinite}
.cp-flickerB{animation:cp-flickerB 7s steps(1,end) infinite}
.cp-buzz{animation:cp-buzz 2.4s ease-in-out infinite}
.cp-glow{animation:cp-glow 6s ease-in-out infinite}
.cp-sway{animation:cp-sway 6.5s ease-in-out infinite;transform-box:fill-box;transform-origin:top center}
.cp-pulse{animation:cp-pulse 3.2s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
.cp-dash{stroke-dasharray:5 7;animation:cp-dash 1.8s linear infinite}
@media (prefers-reduced-motion: reduce){.cp-anim{animation:none !important}}
`;

export function CyberpunkAnimations() {
  return <style dangerouslySetInnerHTML={{ __html: CYBERPUNK_ANIM_CSS }} />;
}

/* -------------------------------------------------------------------------- */
/*  Invented neon "sign glyphs" — abstract glowing marks (NOT real script).    */
/*  A small library of blocky/stroke marks so signboards read as glowing shop  */
/*  signage without reproducing any real language or brand.                    */
/* -------------------------------------------------------------------------- */

/** Path data for a set of abstract, blocky neon glyphs (drawn in a 0..20 box). */
export const SIGN_GLYPHS: string[] = [
  "M4 3 H16 M10 3 V17 M5 17 H15", // ┬-ish
  "M4 4 H16 V16 H4 Z M4 10 H16", // boxed bar
  "M5 3 V17 M5 3 H14 A3 3 0 0 1 14 9 H5 M11 9 L15 17", // R-like
  "M4 3 H16 M6 3 V17 M14 3 V17 M6 10 H14", // H-in-frame
  "M10 3 V17 M4 7 L10 3 L16 7 M4 13 L10 17 L16 13", // diamond spine
  "M4 5 H16 M4 10 H16 M4 15 H12", // three bars
  "M10 2 A8 8 0 1 0 10 18 A8 8 0 1 0 10 2 M10 6 V14 M6 10 H14", // circle + plus
  "M5 3 L15 3 L10 11 Z M10 11 V17", // Y-ish
  "M4 3 H16 L4 17 H16", // Z
  "M4 17 V6 L10 3 L16 6 V17 M8 17 V11 H12 V17", // house/store
];

/** A soft neon drop-glow filter (used by signs). Give it a unique id per use. */
export function neonFilter(id: string, blur = 2.2): ReactElement {
  return (
    <filter id={id} x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation={blur} result="b" />
      <feMerge>
        <feMergeNode in="b" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  );
}
