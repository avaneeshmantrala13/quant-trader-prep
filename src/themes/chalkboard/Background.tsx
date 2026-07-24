import { useId } from "react";

/**
 * Chalkboard ambient backdrop.
 *
 * Dark mode reads as a green classroom slate; light mode as a ruled
 * composition-book page. Both share the same faint hand-sketched probability
 * doodles that draw themselves in the corners — a coin, a little probability
 * tree, a normal (bell) curve, and tally marks — plus a slow drift of chalk
 * dust motes. Everything is pure SVG/CSS with GPU-friendly transforms, sits
 * behind all content, is `pointer-events-none`, and (via the global
 * `prefers-reduced-motion` rule in index.css) snaps to a fully-drawn, static
 * state for motion-sensitive users.
 *
 * All strokes use `--color-border-strong` (chalk-white on the dark board, ink
 * on the light page) so the same component adapts to both variants.
 */
export function ChalkboardBackground() {
  // Unique keyframe/id namespace so nothing collides with other themes.
  const raw = useId();
  const ns = `cb-${raw.replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <style>{`
        @keyframes ${ns}-draw {
          0%   { stroke-dashoffset: var(--dash); opacity: 0; }
          8%   { opacity: 1; }
          55%  { stroke-dashoffset: 0; opacity: 1; }
          88%  { stroke-dashoffset: 0; opacity: 1; }
          100% { stroke-dashoffset: 0; opacity: 0.55; }
        }
        @keyframes ${ns}-float {
          0%   { transform: translate3d(0,0,0); opacity: 0; }
          15%  { opacity: var(--mote-o); }
          85%  { opacity: var(--mote-o); }
          100% { transform: translate3d(var(--mote-x), var(--mote-y), 0); opacity: 0; }
        }
        @keyframes ${ns}-sway {
          0%,100% { transform: translateY(0) rotate(-0.4deg); }
          50%     { transform: translateY(-6px) rotate(0.4deg); }
        }
        .${ns}-draw {
          stroke-dasharray: var(--dash);
          stroke-dashoffset: 0;
          animation: ${ns}-draw var(--dur, 14s) ease-in-out infinite;
        }
        .${ns}-mote {
          animation: ${ns}-float var(--dur, 20s) linear infinite;
        }
        .${ns}-sway {
          animation: ${ns}-sway 11s ease-in-out infinite;
        }
      `}</style>

      {/* Board / paper wash — a soft vignette that deepens the surface. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 0%, rgb(var(--color-surface-raised) / 0.35) 0%, transparent 55%)",
        }}
      />

      {/* Faint ruled / plotting grid — the composition-book lines. */}
      <div className="tex-grid absolute inset-0 opacity-[0.35] dark:opacity-25" />

      {/* Red margin rule (schoolhouse notebook) — subtle in dark, clear in light. */}
      <div
        className="absolute inset-y-0 left-8 w-px opacity-30 sm:left-14"
        style={{ background: "rgb(var(--color-accent))" }}
      />

      {/* Drifting chalk dust. */}
      <svg
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
        preserveAspectRatio="none"
      >
        {DUST.map((d, i) => (
          <circle
            key={i}
            className={`${ns}-mote`}
            cx={`${d.cx}%`}
            cy={`${d.cy}%`}
            r={d.r}
            fill="rgb(var(--color-border-strong))"
            style={
              {
                "--dur": `${d.dur}s`,
                "--mote-x": `${d.dx}px`,
                "--mote-y": `${d.dy}px`,
                "--mote-o": d.o,
                animationDelay: `${d.delay}s`,
              } as React.CSSProperties
            }
          />
        ))}
      </svg>

      {/* Top-center: a normal (bell) curve drawing itself. */}
      <svg
        className={`${ns}-sway absolute left-1/2 top-[8%] hidden h-[26%] w-[46%] -translate-x-1/2 sm:block`}
        viewBox="0 0 200 90"
        fill="none"
        stroke="rgb(var(--color-border-strong))"
        aria-hidden="true"
      >
        {/* baseline */}
        <path
          className={`${ns}-draw`}
          d="M6 78 H194"
          strokeWidth={1.4}
          strokeLinecap="round"
          style={{ "--dash": 190, "--dur": "13s" } as React.CSSProperties}
          opacity={0.5}
        />
        {/* bell curve */}
        <path
          className={`${ns}-draw`}
          d="M12 78 C60 78 74 14 100 14 C126 14 140 78 188 78"
          strokeWidth={1.8}
          strokeLinecap="round"
          style={{ "--dash": 260, "--dur": "16s" } as React.CSSProperties}
          opacity={0.55}
        />
        {/* mean tick */}
        <path
          className={`${ns}-draw`}
          d="M100 20 V80"
          strokeWidth={1.2}
          strokeDasharray="3 4"
          style={{ "--dash": 60, "--dur": "16s" } as React.CSSProperties}
          opacity={0.4}
        />
      </svg>

      {/* Top-right: a small probability tree. */}
      <svg
        className={`absolute right-[4%] top-[10%] hidden h-[20%] w-[20%] md:block`}
        viewBox="0 0 120 120"
        fill="none"
        stroke="rgb(var(--color-border-strong))"
        aria-hidden="true"
      >
        <g
          strokeWidth={1.6}
          strokeLinecap="round"
          style={{ "--dash": 90, "--dur": "15s" } as React.CSSProperties}
        >
          <path className={`${ns}-draw`} d="M14 60 L58 26" opacity={0.5} />
          <path className={`${ns}-draw`} d="M14 60 L58 94" opacity={0.5} />
          <path className={`${ns}-draw`} d="M58 26 L104 12" opacity={0.45} />
          <path className={`${ns}-draw`} d="M58 26 L104 42" opacity={0.45} />
          <path className={`${ns}-draw`} d="M58 94 L104 78" opacity={0.45} />
          <path className={`${ns}-draw`} d="M58 94 L104 108" opacity={0.45} />
        </g>
        <g fill="rgb(var(--color-border-strong))" opacity={0.5}>
          <circle cx="14" cy="60" r="3.2" />
          <circle cx="58" cy="26" r="2.6" />
          <circle cx="58" cy="94" r="2.6" />
          <circle cx="104" cy="12" r="2.2" />
          <circle cx="104" cy="42" r="2.2" />
          <circle cx="104" cy="78" r="2.2" />
          <circle cx="104" cy="108" r="2.2" />
        </g>
      </svg>

      {/* Bottom-left: a flipped coin (H). */}
      <svg
        className={`${ns}-sway absolute bottom-[9%] left-[5%] hidden h-[16%] w-[16%] sm:block`}
        viewBox="0 0 100 100"
        fill="none"
        stroke="rgb(var(--color-border-strong))"
        aria-hidden="true"
      >
        <circle
          className={`${ns}-draw`}
          cx="50"
          cy="50"
          r="34"
          strokeWidth={2}
          style={{ "--dash": 220, "--dur": "17s" } as React.CSSProperties}
          opacity={0.5}
        />
        <circle
          className={`${ns}-draw`}
          cx="50"
          cy="50"
          r="27"
          strokeWidth={1}
          strokeDasharray="2 4"
          style={{ "--dash": 175, "--dur": "17s" } as React.CSSProperties}
          opacity={0.35}
        />
        <text
          x="50"
          y="63"
          textAnchor="middle"
          fontFamily="var(--font-display)"
          fontSize="34"
          fill="rgb(var(--color-border-strong))"
          stroke="none"
          opacity={0.5}
        >
          H
        </text>
      </svg>

      {/* Bottom-right: tally marks (four + a slash). */}
      <svg
        className={`absolute bottom-[11%] right-[6%] hidden h-[10%] w-[14%] sm:block`}
        viewBox="0 0 100 60"
        fill="none"
        stroke="rgb(var(--color-border-strong))"
        strokeWidth={2.4}
        strokeLinecap="round"
        aria-hidden="true"
      >
        <g
          style={{ "--dash": 50, "--dur": "12s" } as React.CSSProperties}
          opacity={0.5}
        >
          <path className={`${ns}-draw`} d="M14 8 V52" />
          <path className={`${ns}-draw`} d="M28 8 V52" />
          <path className={`${ns}-draw`} d="M42 8 V52" />
          <path className={`${ns}-draw`} d="M56 8 V52" />
          <path
            className={`${ns}-draw`}
            d="M6 46 L64 14"
            style={{ "--dash": 70, "--dur": "12s" } as React.CSSProperties}
          />
        </g>
      </svg>

      {/* Chalk-dust grain overlay driven by the theme's grainOpacity. */}
      <div
        className="absolute inset-0 mix-blend-screen dark:mix-blend-screen"
        style={{
          opacity: "var(--grain-opacity)",
          backgroundImage:
            "radial-gradient(rgb(var(--color-border-strong) / 0.9) 0.5px, transparent 0.6px)",
          backgroundSize: "3px 3px",
        }}
      />
    </div>
  );
}

interface Mote {
  cx: number;
  cy: number;
  r: number;
  dx: number;
  dy: number;
  dur: number;
  delay: number;
  o: string;
}

// Deterministic scatter of drifting chalk-dust motes.
const DUST: Mote[] = Array.from({ length: 22 }, (_, i) => {
  const s = Math.sin(i * 12.9898) * 43758.5453;
  const r1 = s - Math.floor(s);
  const t = Math.sin(i * 78.233) * 12345.678;
  const r2 = t - Math.floor(t);
  const u = Math.sin(i * 37.719) * 9876.54;
  const r3 = u - Math.floor(u);
  return {
    cx: Math.round(r1 * 100),
    cy: Math.round(30 + r2 * 70),
    r: 0.6 + r3 * 1.4,
    dx: Math.round((r2 - 0.5) * 60),
    dy: -Math.round(80 + r1 * 160),
    dur: Math.round(16 + r3 * 18),
    delay: Math.round(r1 * -20),
    o: (0.1 + r3 * 0.18).toFixed(2),
  };
});
