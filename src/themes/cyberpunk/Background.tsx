import { useMemo } from "react";
import { CYBERPUNK_ANIM_CSS, SIGN_GLYPHS } from "./neon";

/**
 * Cyberpunk backdrop — an immersive NEON NIGHT-CITY back-alley.
 *
 * Layers (all pure CSS/SVG, GPU-friendly, behind all content, `-z-10`):
 *   1. A deep vertical night gradient (blue-black sky → wet street) with cyan +
 *      magenta corner blooms and a warm horizon haze.
 *   2. A distant skyline of building silhouettes freckled with tiny window
 *      lights, receding into fog.
 *   3. Drifting atmospheric HAZE — big soft cyan / magenta / violet radial
 *      clouds sliding slowly across the alley.
 *   4. Tangled OVERHEAD CABLES sagging across the top, strung with a couple of
 *      warm hanging lamps that pulse.
 *   5. Glowing vertical + horizontal NEON SIGNBOARDS mounted along both alley
 *      walls (invented abstract glyphs — never real script), each buzzing on
 *      its own flicker rhythm.
 *   6. Thin RAIN streaks falling through the scene.
 *   7. A WET-ASPHALT reflection band along the bottom: mirrored neon light
 *      columns + a shimmer sweeping across the puddles.
 *   8. A corner vignette for cinematic depth.
 *
 * Every hue is a theme token so it reads as vivid neon-on-blue-black (dark) and
 * a soft neon-dusk wash (light). `pointer-events-none`, `aria-hidden`, and every
 * animated node carries `cp-anim`, so it is fully static under
 * `prefers-reduced-motion`.
 */

/* Deterministic pseudo-random so the scene is stable across renders. */
function rand(i: number, n: number): number {
  return (((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1) + 1) % 1;
}

interface SignSpec {
  side: "left" | "right";
  top: number; // %
  offset: number; // px from the wall
  w: number;
  h: number;
  vertical: boolean;
  tone: "cyan" | "magenta";
  glyphs: number[];
  flicker: "cp-flicker" | "cp-flickerB" | "cp-buzz";
  size: number; // overall scale
}

function buildSigns(): SignSpec[] {
  const flick = ["cp-flicker", "cp-flickerB", "cp-buzz"] as const;
  return Array.from({ length: 9 }, (_, i) => {
    const side = i % 2 === 0 ? "left" : "right";
    const vertical = rand(i, 1) > 0.42;
    const tone = rand(i, 2) > 0.5 ? "cyan" : "magenta";
    const glyphN = vertical ? 2 + Math.floor(rand(i, 3) * 2) : 1;
    const glyphs = Array.from({ length: glyphN }, (_, g) =>
      Math.floor(rand(i, 5 + g) * SIGN_GLYPHS.length),
    );
    return {
      side,
      top: 6 + i * 9.5 + rand(i, 4) * 4,
      offset: 2 + rand(i, 6) * 9,
      w: vertical ? 26 : 46,
      h: vertical ? 34 + glyphN * 24 : 34,
      vertical,
      tone,
      glyphs,
      flicker: flick[i % 3],
      size: 0.82 + rand(i, 7) * 0.5,
    };
  });
}

interface RainSpec {
  left: number;
  delay: number;
  duration: number;
  len: number;
  opacity: number;
}
function buildRain(): RainSpec[] {
  return Array.from({ length: 22 }, (_, i) => ({
    left: rand(i, 11) * 100,
    delay: -rand(i, 12) * 3,
    duration: 0.9 + rand(i, 13) * 1.1,
    len: 30 + rand(i, 14) * 60,
    opacity: 0.06 + rand(i, 15) * 0.12,
  }));
}

const toneVar = (t: "cyan" | "magenta") =>
  t === "cyan" ? "var(--color-accent)" : "var(--color-accent-2)";

/** A single glowing neon signboard mounted on an alley wall. */
function Signboard({ spec }: { spec: SignSpec }) {
  const c = `rgb(${toneVar(spec.tone)})`;
  const soft = `rgb(${toneVar(spec.tone)} / 0.5)`;
  const pos =
    spec.side === "left"
      ? { left: `${spec.offset}%` }
      : { right: `${spec.offset}%` };
  return (
    <div
      className={`cp-anim ${spec.flicker} absolute`}
      style={{
        ...pos,
        top: `${spec.top}%`,
        width: spec.w * spec.size,
        height: spec.h * spec.size,
      }}
    >
      {/* bracket arm to the wall */}
      <span
        className="absolute top-3 h-[2px]"
        style={{
          background: soft,
          width: 12,
          [spec.side === "left" ? "right" : "left"]: "100%",
        }}
      />
      {/* the sign panel */}
      <div
        className="relative h-full w-full"
        style={{
          borderRadius: 4,
          border: `1.5px solid ${c}`,
          background:
            "rgb(var(--color-surface-raised) / 0.35)",
          boxShadow: `0 0 14px ${soft}, 0 0 34px rgb(${toneVar(spec.tone)} / 0.25), inset 0 0 10px rgb(${toneVar(spec.tone)} / 0.28)`,
        }}
      >
        <svg
          viewBox={`0 0 20 ${spec.glyphs.length * 20}`}
          preserveAspectRatio="xMidYMid meet"
          className="absolute inset-[14%]"
          style={{ filter: `drop-shadow(0 0 2px ${c})` }}
          aria-hidden="true"
        >
          {spec.glyphs.map((g, gi) => (
            <g key={gi} transform={`translate(0 ${gi * 20})`}>
              <path
                d={SIGN_GLYPHS[g]}
                fill="none"
                stroke={c}
                strokeWidth={1.4}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

/** Distant skyline silhouette + window lights, near the fog horizon. */
function Skyline() {
  const windows = useMemo(
    () =>
      Array.from({ length: 46 }, (_, i) => ({
        x: rand(i, 21) * 100,
        y: rand(i, 22) * 100,
        w: 0.5 + rand(i, 23) * 1.1,
        h: 0.7 + rand(i, 24) * 1.4,
        warm: rand(i, 25) > 0.5,
        op: 0.25 + rand(i, 26) * 0.5,
      })),
    [],
  );
  return (
    <svg
      className="absolute inset-x-0"
      style={{ top: "22%", height: "40%" }}
      viewBox="0 0 100 40"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {/* stepped rooftop silhouette */}
      <path
        d="M0 40 V20 H6 V13 H13 V24 H19 V9 H27 V17 H33 V6 H41 V15 H48 V11 H55 V21 H62 V7 H70 V16 H77 V12 H84 V22 H90 V10 H97 V18 H100 V40 Z"
        fill="rgb(var(--color-surface) / 0.55)"
        stroke="rgb(var(--color-accent) / 0.18)"
        strokeWidth={0.3}
      />
      {windows.map((w, i) => (
        <rect
          key={i}
          x={w.x * 0.97}
          y={4 + w.y * 0.34}
          width={w.w}
          height={w.h}
          fill={
            w.warm
              ? "rgb(var(--color-gold))"
              : "rgb(var(--color-accent))"
          }
          opacity={w.op}
        />
      ))}
    </svg>
  );
}

/** Sagging overhead cables + a couple of warm hanging lamps. */
function Cables() {
  return (
    <svg
      className="absolute inset-x-0 top-0 h-[26%]"
      viewBox="0 0 100 26"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <g
        fill="none"
        stroke="rgb(var(--color-text-muted) / 0.5)"
        strokeWidth={0.35}
        vectorEffect="non-scaling-stroke"
      >
        <path d="M-2 3 Q30 11 52 6 T102 9" />
        <path d="M-2 8 Q26 2 60 12 T102 4" />
        <path d="M-2 14 Q40 22 74 15 T102 18" />
        <path d="M20 0 L23 26 M78 0 L74 26" strokeWidth={0.5} />
      </g>
      {/* warm hanging lamps */}
      {[
        [30, 8.6],
        [60, 11.4],
        [80, 9.2],
      ].map(([x, y], i) => (
        <g key={i}>
          <line
            x1={x}
            y1={0}
            x2={x}
            y2={y}
            stroke="rgb(var(--color-text-muted) / 0.5)"
            strokeWidth={0.3}
          />
          <circle
            className="cp-anim cp-pulse"
            cx={x}
            cy={y}
            r={0.9}
            fill="rgb(var(--color-gold))"
            style={{ filter: "drop-shadow(0 0 2px rgb(var(--color-gold)))" }}
          />
        </g>
      ))}
    </svg>
  );
}

export function CyberpunkBackground() {
  const signs = useMemo(buildSigns, []);
  const rain = useMemo(buildRain, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-bg"
    >
      <style dangerouslySetInnerHTML={{ __html: CYBERPUNK_ANIM_CSS }} />

      {/* 1. Night gradient sky → wet street, with cyan/magenta corner blooms. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgb(var(--color-bg)) 0%, rgb(var(--color-surface-muted)) 62%, rgb(var(--color-bg)) 100%)," +
            "radial-gradient(ellipse 70% 55% at 6% 0%, rgb(var(--color-accent) / 0.20) 0%, transparent 60%)," +
            "radial-gradient(ellipse 70% 55% at 96% 8%, rgb(var(--color-accent-2) / 0.20) 0%, transparent 60%)," +
            "radial-gradient(ellipse 90% 40% at 50% 46%, rgb(var(--color-warning) / 0.10) 0%, transparent 70%)",
        }}
      />

      {/* 2. Distant skyline + window lights. */}
      <Skyline />

      {/* 3. Drifting haze clouds. */}
      <div
        className="cp-anim absolute -inset-x-[10%] top-[10%] h-[60%]"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 40% 60% at 30% 40%, rgb(var(--color-accent) / 0.16) 0%, transparent 70%)," +
            "radial-gradient(ellipse 46% 54% at 74% 50%, rgb(var(--color-accent-2) / 0.16) 0%, transparent 70%)",
          animation: "cp-hazeX 26s ease-in-out infinite alternate",
        }}
      />
      <div
        className="cp-anim absolute inset-x-0 top-[28%] h-[46%]"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 55% 50% at 52% 50%, rgb(var(--color-accent) / 0.10) 0%, transparent 72%)",
          animation: "cp-hazeY 20s ease-in-out infinite alternate",
        }}
      />

      {/* 4. Overhead cables + lamps. */}
      <Cables />

      {/* 5. Neon signboards on both alley walls. */}
      {signs.map((s, i) => (
        <Signboard key={i} spec={s} />
      ))}

      {/* 6. Falling rain streaks. */}
      <div className="absolute inset-0 overflow-hidden">
        {rain.map((r, i) => (
          <span
            key={i}
            className="cp-anim absolute top-0 w-px"
            style={{
              left: `${r.left}%`,
              height: r.len,
              opacity: r.opacity,
              background:
                "linear-gradient(180deg, transparent, rgb(var(--color-text-primary)))",
              animation: `cp-rain ${r.duration}s linear ${r.delay}s infinite`,
            }}
          />
        ))}
      </div>

      {/* 7. Wet-asphalt reflection band. */}
      <div className="absolute inset-x-0 bottom-0 h-[26%] overflow-hidden">
        {/* mirrored neon light columns shimmering in the puddles */}
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "linear-gradient(90deg, transparent 6%, rgb(var(--color-accent) / 0.22) 8%, transparent 12%, transparent 30%, rgb(var(--color-accent-2) / 0.24) 33%, transparent 37%, transparent 62%, rgb(var(--color-accent) / 0.2) 65%, transparent 69%, transparent 86%, rgb(var(--color-accent-2) / 0.2) 89%, transparent 93%)",
            maskImage:
              "linear-gradient(180deg, transparent 0%, rgb(0 0 0 / 0.9) 55%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(180deg, transparent 0%, rgb(0 0 0 / 0.9) 55%, transparent 100%)",
            filter: "blur(1.5px)",
          }}
        />
        {/* horizontal wet ripples */}
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "repeating-linear-gradient(180deg, rgb(var(--color-accent) / 0.10) 0 1px, transparent 1px 7px)",
          }}
        />
        {/* shimmer sweeping across the puddles */}
        <div
          className="cp-anim absolute inset-y-0 left-0 w-[30%]"
          style={{
            background:
              "linear-gradient(100deg, transparent, rgb(var(--color-accent) / 0.14) 50%, transparent)",
            animation: "cp-shimmer 11s ease-in-out infinite",
          }}
        />
      </div>

      {/* 8. Cinematic vignette. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 120% 120% at 50% 40%, transparent 52%, rgb(0 0 0 / 0.5) 100%)",
        }}
      />
    </div>
  );
}
