/**
 * Shared cartoon animation keyframes + reusable "face" primitives for the Kids
 * theme. Everything is transform/opacity-only (GPU-friendly, 60fps). Animated
 * elements carry the `kids-anim` class so the injected `prefers-reduced-motion`
 * rule can freeze them at their calm initial pose (a tidy static fallback).
 *
 * Outlines use `rgb(var(--color-border-strong))` (the theme "ink") so lines stay
 * dark on the light variant and light on the dark variant — never invisible.
 */

export const INK = "rgb(var(--color-border-strong))";

/** Injected once per illustration/background; identical CSS dedupes fine. */
export const KIDS_ANIM_CSS = `
@keyframes kids-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
@keyframes kids-float-slow{0%,100%{transform:translateY(0)}50%{transform:translateY(-20px)}}
@keyframes kids-driftX{0%{transform:translateX(-12vw)}100%{transform:translateX(112vw)}}
@keyframes kids-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
@keyframes kids-flip{0%{transform:rotateY(0)}100%{transform:rotateY(360deg)}}
@keyframes kids-bob{0%,100%{transform:translateY(0) rotate(-2.5deg)}50%{transform:translateY(-7px) rotate(2.5deg)}}
@keyframes kids-tumble{0%{transform:translateY(0) rotate(-8deg)}25%{transform:translateY(-16px) rotate(7deg)}50%{transform:translateY(0) rotate(15deg)}75%{transform:translateY(-8px) rotate(5deg)}100%{transform:translateY(0) rotate(-8deg)}}
@keyframes kids-sparkle{0%,100%{opacity:.25;transform:scale(.7)}50%{opacity:1;transform:scale(1.1)}}
@keyframes kids-sway{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(6deg)}}
@keyframes kids-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.16)}}
@keyframes kids-bounce{0%,100%{transform:translateY(2px)}50%{transform:translateY(-22px)}}
@keyframes kids-blink{0%,90%,100%{transform:scaleY(1)}95%{transform:scaleY(.08)}}
@keyframes kids-rollA{0%{transform:translate(0,0)}100%{transform:translate(150px,-110px)}}
@keyframes kids-rollB{0%{transform:translate(0,0)}100%{transform:translate(-150px,110px)}}
@keyframes kids-antwalk{0%{transform:translate(0,0)}50%{transform:translate(58px,-42px)}100%{transform:translate(116px,0)}}
@keyframes kids-anthop{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
@keyframes kids-jiggle{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(4deg)}}
@media (prefers-reduced-motion: reduce){.kids-anim{animation:none !important}}
svg[data-kids-locked="true"] .kids-anim{animation:none !important}
`;

/** Renders the shared keyframe stylesheet. Cheap + idempotent to include. */
export function KidsAnimations() {
  return <style dangerouslySetInnerHTML={{ __html: KIDS_ANIM_CSS }} />;
}

/* -------------------------------------------------------------------------- */
/*  Reusable cartoon face primitives (consistent character style)             */
/* -------------------------------------------------------------------------- */

/** A pair of friendly googly eyes with optional periodic blink. */
export function Eyes({
  cx,
  cy,
  gap = 14,
  r = 8,
  look = 0,
  blink = false,
  delay = 0,
}: {
  cx: number;
  cy: number;
  gap?: number;
  r?: number;
  look?: number;
  blink?: boolean;
  delay?: number;
}) {
  const pr = Math.max(2.5, r * 0.42);
  const eye = (ex: number) => (
    <g
      className={blink ? "kids-anim" : undefined}
      style={
        blink
          ? {
              transformBox: "fill-box",
              transformOrigin: "center",
              animation: `kids-blink 4.2s ease-in-out ${delay}s infinite`,
            }
          : undefined
      }
    >
      <circle cx={ex} cy={cy} r={r} fill="#ffffff" stroke={INK} strokeWidth={2.4} />
      <circle cx={ex + look} cy={cy + r * 0.18} r={pr} fill={INK} />
      <circle cx={ex + look - pr * 0.35} cy={cy + r * 0.18 - pr * 0.35} r={pr * 0.32} fill="#ffffff" />
    </g>
  );
  return (
    <>
      {eye(cx - gap)}
      {eye(cx + gap)}
    </>
  );
}

/** Rosy round cheeks. */
export function Cheeks({ cx, cy, gap = 26, r = 5 }: { cx: number; cy: number; gap?: number; r?: number }) {
  return (
    <>
      <circle cx={cx - gap} cy={cy} r={r} fill="#ff9db1" opacity={0.85} />
      <circle cx={cx + gap} cy={cy} r={r} fill="#ff9db1" opacity={0.85} />
    </>
  );
}

/** A cheerful curved smile. */
export function Smile({ cx, cy, w = 22, depth = 10 }: { cx: number; cy: number; w?: number; depth?: number }) {
  return (
    <path
      d={`M ${cx - w} ${cy} Q ${cx} ${cy + depth} ${cx + w} ${cy}`}
      fill="none"
      stroke={INK}
      strokeWidth={3}
      strokeLinecap="round"
    />
  );
}

/** A four-point twinkle star used for sparkle accents. */
export function Twinkle({
  x,
  y,
  s = 6,
  color = "#fff4a8",
  delay = 0,
}: {
  x: number;
  y: number;
  s?: number;
  color?: string;
  delay?: number;
}) {
  return (
    <path
      className="kids-anim"
      style={{
        transformBox: "fill-box",
        transformOrigin: "center",
        animation: `kids-sparkle 2.4s ease-in-out ${delay}s infinite`,
      }}
      d={`M ${x} ${y - s} Q ${x + s * 0.28} ${y - s * 0.28} ${x + s} ${y} Q ${x + s * 0.28} ${y + s * 0.28} ${x} ${y + s} Q ${x - s * 0.28} ${y + s * 0.28} ${x - s} ${y} Q ${x - s * 0.28} ${y - s * 0.28} ${x} ${y - s} Z`}
      fill={color}
      stroke={INK}
      strokeWidth={1.4}
    />
  );
}
