import type { CSSProperties } from "react";

/**
 * Shared gold "chrome" ornaments for the Casino Felt theme's page views: a gold
 * hairline ring, an ornate corner filigree set, a gold-rule divider, and a
 * reduced-motion-safe gleam that drifts across a surface. All are token-driven
 * (`rgb(var(--color-gold) …)`) so they adapt to dark felt / pale baize, and
 * purely decorative (aria-hidden, non-interactive).
 */

export const GOLD = "rgb(var(--color-gold))";

/** A faint inset gold hairline to trim a felt panel. */
export const goldRing: CSSProperties = {
  boxShadow: "inset 0 0 0 1px rgb(var(--color-gold) / 0.24)",
};

/** Injects the (idempotent) gleam keyframes + reduced-motion gate. */
export function CasinoOrnamentStyle() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
@keyframes casino-toc-gleam{0%{transform:translateX(-140%) skewX(-12deg)}100%{transform:translateX(560%) skewX(-12deg)}}
@media (prefers-reduced-motion: reduce){.casino-toc-anim{animation:none !important}}
`,
      }}
    />
  );
}

/** A slow gold gleam sweeping across the parent (which must clip overflow). */
export function Gleam({ durationS = 9 }: { durationS?: number }) {
  return (
    <div
      aria-hidden="true"
      className="casino-toc-anim pointer-events-none absolute inset-y-0 left-0 w-[16%]"
      style={{
        background:
          "linear-gradient(90deg, transparent, rgb(var(--color-gold) / 0.14), transparent)",
        animation: `casino-toc-gleam ${durationS}s ease-in-out infinite`,
      }}
    />
  );
}

/** One ornate gold corner scroll (top-left orientation). */
function Corner({ style }: { style?: CSSProperties }) {
  return (
    <svg
      width={40}
      height={40}
      viewBox="0 0 40 40"
      aria-hidden="true"
      className="absolute"
      style={style}
    >
      <g fill="none" stroke={GOLD} strokeOpacity={0.4} strokeWidth={1.3} strokeLinecap="round">
        <path d="M6 6 Q6 20 20 20 Q11 20 11 12 Q20 12 20 6" />
        <path d="M6 24 Q14 24 14 16" />
        <path d="M24 6 Q24 14 16 14" />
        <circle cx={20} cy={20} r={1.4} fill={GOLD} fillOpacity={0.55} stroke="none" />
      </g>
    </svg>
  );
}

/** The four-corner filigree frame for a felt panel. */
export function CornerFiligree() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <Corner style={{ top: 4, left: 4 }} />
      <Corner style={{ top: 4, right: 4, transform: "scaleX(-1)" }} />
      <Corner style={{ bottom: 4, left: 4, transform: "scaleY(-1)" }} />
      <Corner style={{ bottom: 4, right: 4, transform: "scale(-1,-1)" }} />
    </div>
  );
}

/** A centered gold-rule divider (hairline that fades at both ends). */
export function GoldRule({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`h-px w-full ${className}`}
      style={{
        background:
          "linear-gradient(90deg, transparent, rgb(var(--color-gold) / 0.5) 20%, rgb(var(--color-gold) / 0.5) 80%, transparent)",
      }}
    />
  );
}
