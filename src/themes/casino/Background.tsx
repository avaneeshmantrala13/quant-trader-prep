import { useMemo } from "react";
import { Chip, Club, Diamond, Heart, Spade } from "./suits";

/**
 * "Casino Felt" backdrop: a deep baize table with a woven felt texture, a gold
 * table-rail vignette, and a scattering of playing-card suits and poker chips
 * that drift up the table very slowly. All colors come from theme tokens so it
 * adapts to light/dark, it's `pointer-events-none` behind all content, uses
 * GPU-friendly transforms only, and goes fully static under
 * `prefers-reduced-motion` (the global rule in index.css zeroes the durations).
 */

type FloatKind = "heart" | "diamond" | "spade" | "club" | "chip";

interface Floater {
  kind: FloatKind;
  left: number; // %
  size: number; // px
  duration: number; // s
  delay: number; // s (negative to desync)
  drift: number; // px horizontal sway
  opacity: number;
}

// Deterministic so the felt scatter is stable across renders.
function buildFloaters(): Floater[] {
  const kinds: FloatKind[] = ["heart", "spade", "chip", "diamond", "club", "chip", "spade", "heart", "club", "chip"];
  return kinds.map((kind, i) => {
    const r = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
    return {
      kind,
      left: 4 + r(1) * 92,
      size: 26 + r(2) * 34,
      duration: 34 + r(3) * 30,
      delay: -r(4) * 60,
      drift: (r(5) - 0.5) * 60,
      opacity: 0.05 + r(6) * 0.06,
    };
  });
}

function FloaterIcon({ kind, className }: { kind: FloatKind; className?: string }) {
  switch (kind) {
    case "heart":
      return <Heart className={className} />;
    case "diamond":
      return <Diamond className={className} />;
    case "spade":
      return <Spade className={className} />;
    case "club":
      return <Club className={className} />;
    case "chip":
      return <Chip className={className} />;
  }
}

export function CasinoBackground() {
  const floaters = useMemo(buildFloaters, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-bg"
    >
      <style>{`
        @keyframes casino-drift {
          0%   { transform: translate3d(0,110%,0) rotate(-8deg); }
          100% { transform: translate3d(var(--casino-drift,0px),-20%,0) rotate(8deg); }
        }
        .casino-floater { animation: casino-drift linear infinite; will-change: transform; }
      `}</style>

      {/* Woven felt weave — two fine crosshatched gradients tinted by tokens. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, rgb(var(--color-border) / 0.05) 0 1px, transparent 1px 4px), repeating-linear-gradient(-45deg, rgb(var(--color-border) / 0.05) 0 1px, transparent 1px 4px)",
        }}
      />

      {/* Center spotlight lifting the middle of the table. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 80% 60% at 50% 40%, rgb(var(--color-surface) / 0.55) 0%, transparent 70%)",
        }}
      />

      {/* Drifting suits & chips. */}
      <div className="absolute inset-0">
        {floaters.map((f, i) => (
          <div
            key={i}
            className="casino-floater absolute bottom-0"
            style={{
              left: `${f.left}%`,
              width: `${f.size}px`,
              height: `${f.size}px`,
              opacity: f.opacity,
              animationDuration: `${f.duration}s`,
              animationDelay: `${f.delay}s`,
              ["--casino-drift" as string]: `${f.drift}px`,
            }}
          >
            <FloaterIcon
              kind={f.kind}
              className={
                "h-full w-full " +
                (f.kind === "heart" || f.kind === "diamond"
                  ? "text-bear"
                  : f.kind === "chip"
                    ? "text-accent"
                    : "text-primary")
              }
            />
          </div>
        ))}
      </div>

      {/* Gold table-rail: a hairline frame inset from the edges. */}
      <div
        className="absolute inset-[14px] rounded-md md:inset-[26px]"
        style={{
          border: "1px solid rgb(var(--color-gold) / 0.35)",
          boxShadow:
            "inset 0 0 0 6px rgb(var(--color-bg) / 0.35), inset 0 0 120px rgb(0 0 0 / 0.45)",
        }}
      />

      {/* Deepen the corners for table depth. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 120% 120% at 50% 50%, transparent 55%, rgb(0 0 0 / 0.35) 100%)",
        }}
      />
    </div>
  );
}
