import { useId, type ReactElement } from "react";
import type {
  LevelIllustrationContext,
  MapStationComponent,
  MapStationState,
} from "../types";

/**
 * Map-station artwork for the "chalkboard" theme.
 *
 * Each level node on a track map gets a distinct HAND-DRAWN CHALK DOODLE
 * landmark, drawn in the 116×116 layer that sits CENTERED BEHIND the 68×68 node
 * button. The recognizable emblem rises ABOVE the button (top band) and a
 * sketchy chalk ring frames the node, so the level number/lock/check on the
 * button stays fully legible — we complement it, never cover it.
 *
 * Doodles are pure inline SVG using theme tokens (`--color-border-strong` reads
 * chalk-white on the dark board and ink on the light page; `--color-accent`
 * gives each its pastel-chalk pop). A subtle turbulence filter adds the
 * imperfect chalk wobble. Locked nodes dim; mastered nodes gain a small twinkle
 * flourish that is disabled under `prefers-reduced-motion` (global rule).
 * Layer is pointer-events-none + aria-hidden.
 */

type TrackKey =
  | "probability"
  | "mental-math"
  | "brainteasers"
  | "interview-games";

interface Ink {
  ink: string; // chalk/ink — main strokes
  pop: string; // stateful accent (accent / bull / dim)
  op: number; // base opacity (dimmed when locked)
  soft: number; // secondary opacity
}

function stateColor(state?: MapStationState): string {
  if (state === "mastered") return "rgb(var(--color-bull))";
  if (state === "locked") return "rgb(var(--color-border-strong))";
  return "rgb(var(--color-accent))";
}

/* -------------------------------------------------------------------------- */
/*  Shared bits: sketchy ring, chalk dust, twinkle flourish                    */
/* -------------------------------------------------------------------------- */

// A hand-drawn chalk ring framing the node; each track gets its own style.
function Ring({ track, c }: { track: TrackKey; c: Ink }) {
  const stroke = c.pop;
  const common = {
    cx: 50,
    cy: 50,
    fill: "none" as const,
    stroke,
    strokeLinecap: "round" as const,
  };
  if (track === "probability") {
    // dotted chalk ring
    return (
      <circle
        {...common}
        r={45}
        strokeWidth={2}
        strokeDasharray="1 6"
        opacity={c.soft}
      />
    );
  }
  if (track === "mental-math") {
    // double thin ring (like a graded circle)
    return (
      <>
        <circle {...common} r={46} strokeWidth={1.4} opacity={c.soft} />
        <circle {...common} r={41} strokeWidth={1} opacity={c.soft * 0.7} />
      </>
    );
  }
  if (track === "brainteasers") {
    // single wobbly ring (path so the filter warps it nicely)
    return (
      <path
        d="M50 5 C74 5 95 26 95 50 C95 74 74 95 50 95 C26 95 5 74 5 50 C5 26 26 5 50 5 Z"
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        opacity={c.soft}
      />
    );
  }
  // interview-games: dash-dot ticker ring
  return (
    <circle
      {...common}
      r={45}
      strokeWidth={2}
      strokeDasharray="6 4 1 4"
      opacity={c.soft}
    />
  );
}

// A few faint chalk-dust specks for texture.
function ChalkDust({ c }: { c: Ink }) {
  const dots: [number, number, number][] = [
    [16, 30, 0.8],
    [84, 26, 0.7],
    [22, 74, 0.6],
    [80, 78, 0.9],
    [50, 96, 0.7],
  ];
  return (
    <g fill={c.ink} opacity={c.op * 0.5}>
      {dots.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} />
      ))}
    </g>
  );
}

// Mastered flourish: a couple of chalk sparkles with a gentle twinkle.
function Sparkles({ cls }: { cls: string }) {
  const star = (x: number, y: number, s: number) =>
    `M${x} ${y - s} L${x + s * 0.28} ${y - s * 0.28} L${x + s} ${y} L${x + s * 0.28} ${y + s * 0.28} L${x} ${y + s} L${x - s * 0.28} ${y + s * 0.28} L${x - s} ${y} L${x - s * 0.28} ${y - s * 0.28} Z`;
  return (
    <g fill="rgb(var(--color-bull))">
      <path className={cls} d={star(14, 16, 4)} />
      <path className={cls} d={star(86, 20, 3)} style={{ animationDelay: "0.6s" }} />
      <path className={cls} d={star(82, 66, 3.4)} style={{ animationDelay: "1.1s" }} />
    </g>
  );
}

/* -------------------------------------------------------------------------- */
/*  Per-track doodle families (topper emblem in the upper band)               */
/* -------------------------------------------------------------------------- */

const S = (c: Ink) => ({
  fill: "none" as const,
  stroke: c.ink,
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  opacity: c.op,
});

function label(c: Ink, x: number, y: number, size: number, text: string) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      fontFamily="var(--font-display)"
      fontSize={size}
      fill={c.ink}
      opacity={c.op}
    >
      {text}
    </text>
  );
}

// ---- probability -----------------------------------------------------------

// pr-1: a flipped coin.
function ProbCoin(c: Ink) {
  return (
    <g>
      <circle {...S(c)} cx={50} cy={16} r={13} />
      <circle
        cx={50}
        cy={16}
        r={9.5}
        fill="none"
        stroke={c.pop}
        strokeWidth={1}
        strokeDasharray="2 3"
        opacity={c.soft}
      />
      {label(c, 50, 21, 13, "½")}
      <path {...S(c)} strokeWidth={1.6} d="M30 8 C26 12 26 20 30 24" opacity={c.soft} />
      <path {...S(c)} strokeWidth={1.6} d="M70 8 C74 12 74 20 70 24" opacity={c.soft} />
    </g>
  );
}

// pr-2: a die.
function ProbDie(c: Ink) {
  const pip = (x: number, y: number) => (
    <circle cx={x} cy={y} r={1.9} fill={c.ink} opacity={c.op} />
  );
  return (
    <g>
      <rect {...S(c)} x={38} y={4} width={24} height={24} rx={4} />
      {pip(44, 10)}
      {pip(56, 10)}
      {pip(50, 16)}
      {pip(44, 22)}
      {pip(56, 22)}
    </g>
  );
}

// pr-3: a bell curve with mean tick.
function ProbBell(c: Ink) {
  return (
    <g>
      <path {...S(c)} strokeWidth={1.4} d="M26 30 H74" opacity={c.soft} />
      <path {...S(c)} d="M28 30 C42 30 44 5 50 5 C56 5 58 30 72 30" />
      <path
        d="M50 8 V30"
        stroke={c.pop}
        strokeWidth={1.4}
        strokeDasharray="2 3"
        opacity={c.op}
      />
    </g>
  );
}

// pr-4: an urn with drawn balls.
function ProbUrn(c: Ink) {
  return (
    <g>
      <path {...S(c)} d="M40 12 C40 26 42 30 50 30 C58 30 60 26 60 12" />
      <ellipse {...S(c)} cx={50} cy={12} rx={10} ry={3.2} />
      <circle cx={46} cy={20} r={2.4} fill={c.ink} opacity={c.op} />
      <circle cx={53} cy={22} r={2.4} fill={c.pop} opacity={c.op} />
      <circle
        cx={72}
        cy={10}
        r={2.6}
        fill="none"
        stroke={c.ink}
        strokeWidth={1.4}
        opacity={c.soft}
      />
    </g>
  );
}

// pr-5: branching probability tree.
function ProbTree(c: Ink) {
  const node = (x: number, y: number) => (
    <circle cx={x} cy={y} r={2.2} fill={c.ink} opacity={c.op} />
  );
  return (
    <g>
      <g {...S(c)} strokeWidth={1.8}>
        <path d="M28 16 L46 7" />
        <path d="M28 16 L46 25" />
        <path d="M46 7 L68 4" stroke={c.pop} />
        <path d="M46 7 L68 12" />
        <path d="M46 25 L68 20" />
        <path d="M46 25 L68 28" stroke={c.pop} />
      </g>
      {node(28, 16)}
      {node(46, 7)}
      {node(46, 25)}
      {node(68, 4)}
      {node(68, 12)}
      {node(68, 20)}
      {node(68, 28)}
    </g>
  );
}

// ---- mental-math -----------------------------------------------------------

// mm-1: a worked sum.
function MathSum(c: Ink) {
  return (
    <g>
      {label(c, 44, 16, 15, "7+8")}
      <path {...S(c)} strokeWidth={2} d="M30 22 C42 25 58 25 70 21" stroke={c.pop} />
      {label(c, 60, 32, 11, "=15")}
    </g>
  );
}

// mm-2: an abacus.
function MathAbacus(c: Ink) {
  const bead = (x: number, y: number, hl?: boolean) => (
    <circle cx={x} cy={y} r={2.4} fill={hl ? c.pop : c.ink} opacity={c.op} />
  );
  return (
    <g>
      <rect {...S(c)} x={32} y={4} width={36} height={26} rx={2} />
      <line {...S(c)} strokeWidth={1.2} x1={32} y1={12} x2={68} y2={12} opacity={c.soft} />
      <line {...S(c)} strokeWidth={1.2} x1={32} y1={20} x2={68} y2={20} opacity={c.soft} />
      {bead(38, 12)}
      {bead(44, 12)}
      {bead(62, 12, true)}
      {bead(38, 20, true)}
      {bead(56, 20)}
      {bead(62, 20)}
      {bead(38, 27)}
      {bead(50, 27)}
    </g>
  );
}

// mm-3: tally marks.
function MathTally(c: Ink) {
  const bundle = (ox: number) => (
    <g {...S(c)} strokeWidth={2}>
      <path d={`M${ox} 6 V26`} />
      <path d={`M${ox + 4} 6 V26`} />
      <path d={`M${ox + 8} 6 V26`} />
      <path d={`M${ox + 12} 6 V26`} />
      <path d={`M${ox - 2} 24 L${ox + 14} 8`} stroke={c.pop} />
    </g>
  );
  return (
    <g>
      {bundle(34)}
      {bundle(54)}
    </g>
  );
}

// mm-4: a stopwatch scribble.
function MathStopwatch(c: Ink) {
  return (
    <g>
      <circle {...S(c)} cx={50} cy={18} r={12} />
      <path {...S(c)} d="M46 4 H54" />
      <path {...S(c)} d="M50 4 V8" />
      <path {...S(c)} d="M62 8 L66 4" strokeWidth={1.6} opacity={c.soft} />
      <path {...S(c)} strokeWidth={2} d="M50 18 L50 10" stroke={c.pop} />
      <path {...S(c)} strokeWidth={2} d="M50 18 L57 20" stroke={c.pop} />
      <circle cx={50} cy={18} r={1.6} fill={c.ink} opacity={c.op} />
    </g>
  );
}

// ---- brainteasers ----------------------------------------------------------

// bt-1: a lightbulb.
function TeaseBulb(c: Ink) {
  return (
    <g>
      <path
        {...S(c)}
        d="M50 4 C40 4 33 11 33 20 C33 26 37 28 39 32 L61 32 C63 28 67 26 67 20 C67 11 60 4 50 4 Z"
      />
      <path {...S(c)} strokeWidth={1.6} d="M41 34 H59" />
      <path {...S(c)} strokeWidth={1.6} d="M43 37 H57" />
      <path {...S(c)} strokeWidth={1.4} d="M45 24 C47 18 53 18 55 24" stroke={c.pop} />
      <g {...S(c)} strokeWidth={1.6} stroke={c.pop} opacity={c.soft}>
        <path d="M50 0 V-1" />
        <path d="M26 8 L30 11" />
        <path d="M74 8 L70 11" />
      </g>
    </g>
  );
}

// bt-2: a maze.
function TeaseMaze(c: Ink) {
  return (
    <g {...S(c)}>
      <rect x={36} y={4} width={28} height={28} rx={1} />
      <path d="M36 12 H52" />
      <path d="M58 12 V26 H42" />
      <path d="M50 20 H44 V16" />
      <path d="M50 20 H56" />
      <circle cx={50} cy={18} r={1.8} fill={c.pop} stroke="none" opacity={c.op} />
    </g>
  );
}

// bt-3: a chess knight.
function TeaseKnight(c: Ink) {
  return (
    <g>
      <path
        {...S(c)}
        d="M42 32 L42 24 C42 18 44 14 50 10 L47 6 L52 5 C60 6 66 12 66 22 L66 32 Z"
      />
      <path {...S(c)} strokeWidth={1.6} d="M38 32 H68" />
      <circle cx={56} cy={16} r={1.4} fill={c.pop} stroke="none" opacity={c.op} />
      <path {...S(c)} strokeWidth={1.4} d="M50 12 L46 15" opacity={c.soft} />
    </g>
  );
}

// ---- interview-games -------------------------------------------------------

// ig-1: a candlestick chart.
function GameCandles(c: Ink) {
  const candle = (
    x: number,
    top: number,
    h: number,
    hi: number,
    lo: number,
    up: boolean,
  ) => (
    <g stroke={c.ink} opacity={c.op}>
      <line x1={x} y1={hi} x2={x} y2={lo} strokeWidth={1.4} />
      <rect
        x={x - 3}
        y={top}
        width={6}
        height={h}
        fill={up ? c.pop : "none"}
        stroke={c.ink}
        strokeWidth={1.4}
      />
    </g>
  );
  return (
    <g>
      <path
        d="M28 32 H72"
        stroke={c.ink}
        strokeWidth={1.2}
        opacity={c.soft}
        strokeLinecap="round"
      />
      {candle(36, 16, 8, 10, 28, false)}
      {candle(50, 10, 10, 5, 24, true)}
      {candle(64, 14, 7, 8, 26, true)}
    </g>
  );
}

// ig-2: a supply / demand cross.
function GameCross(c: Ink) {
  return (
    <g>
      <path {...S(c)} strokeWidth={1.2} d="M30 32 V4 M30 32 H72" opacity={c.soft} />
      <path {...S(c)} d="M32 8 L70 30" stroke={c.pop} />
      <path {...S(c)} d="M32 30 L70 8" />
      <circle cx={51} cy={19} r={2.2} fill={c.ink} stroke="none" opacity={c.op} />
    </g>
  );
}

// ig-3: a BID / ASK market stall.
function GameStall(c: Ink) {
  return (
    <g>
      {/* awning */}
      <path {...S(c)} d="M32 12 L36 5 H64 L68 12 Z" stroke={c.pop} />
      <path {...S(c)} strokeWidth={1.2} d="M40 5 L38 12 M50 5 L50 12 M60 5 L62 12" opacity={c.soft} />
      {/* counter */}
      <path {...S(c)} d="M35 12 V30 M65 12 V30 M32 30 H68" />
      {label(c, 50, 25, 8, "BID·ASK")}
    </g>
  );
}

// ig-4: a target with a dart.
function GameTarget(c: Ink) {
  return (
    <g>
      <circle {...S(c)} cx={50} cy={18} r={13} />
      <circle {...S(c)} strokeWidth={1.4} cx={50} cy={18} r={8} opacity={c.soft} />
      <circle cx={50} cy={18} r={3} fill={c.pop} stroke="none" opacity={c.op} />
      <path {...S(c)} strokeWidth={2} d="M60 6 L50 18" stroke={c.pop} />
      <path {...S(c)} strokeWidth={1.6} d="M60 6 L57 8 M60 6 L58 9" opacity={c.soft} />
    </g>
  );
}

// ig-5: a trophy.
function GameTrophy(c: Ink) {
  return (
    <g>
      <path {...S(c)} d="M40 4 H60 V12 C60 20 55 24 50 24 C45 24 40 20 40 12 Z" />
      <path {...S(c)} strokeWidth={1.6} d="M40 6 C33 6 33 14 40 15" opacity={c.soft} />
      <path {...S(c)} strokeWidth={1.6} d="M60 6 C67 6 67 14 60 15" opacity={c.soft} />
      <path {...S(c)} d="M50 24 V29 M43 32 H57 M46 29 H54" />
      {label(c, 50, 16, 9, "1")}
      <path d="M50 8 l1.2 2.6 2.8 .3 -2 2 .6 2.8 -2.6 -1.4 -2.6 1.4 .6 -2.8 -2 -2 2.8 -.3 z" fill={c.pop} opacity={c.op} />
    </g>
  );
}

/* -------------------------------------------------------------------------- */
/*  Registry — one station component per (track, levelIndex)                   */
/* -------------------------------------------------------------------------- */

type DoodleFn = (c: Ink) => ReactElement;

const FAMILIES: Record<TrackKey, DoodleFn[]> = {
  probability: [ProbCoin, ProbDie, ProbBell, ProbUrn, ProbTree],
  "mental-math": [MathSum, MathAbacus, MathTally, MathStopwatch],
  brainteasers: [TeaseBulb, TeaseMaze, TeaseKnight],
  "interview-games": [
    GameCandles,
    GameCross,
    GameStall,
    GameTarget,
    GameTrophy,
  ],
};

function makeStation(track: TrackKey, doodle: DoodleFn): MapStationComponent {
  return function ChalkStation({
    className,
    state,
  }: {
    className?: string;
    state?: MapStationState;
  }) {
    const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
    const fid = `cbk-f-${uid}`;
    const twinkle = `cbk-tw-${uid}`;
    const locked = state === "locked";
    const c: Ink = {
      ink: "rgb(var(--color-border-strong))",
      pop: stateColor(state),
      op: locked ? 0.42 : 0.95,
      soft: locked ? 0.32 : 0.6,
    };
    return (
      <svg
        viewBox="0 0 100 100"
        className={className}
        aria-hidden="true"
        fill="none"
      >
        <defs>
          <filter id={fid} x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.9"
              numOctaves={1}
              seed={(track.length + doodle.name.length) % 7}
              result="n"
            />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="1.3" />
          </filter>
        </defs>
        {state === "mastered" && (
          <style>{`@keyframes ${twinkle}{0%,100%{opacity:.35;transform:scale(.9)}50%{opacity:1;transform:scale(1.15)}}.${twinkle}{transform-box:fill-box;transform-origin:center;animation:${twinkle} 2.4s ease-in-out infinite}`}</style>
        )}
        <g filter={`url(#${fid})`}>
          <Ring track={track} c={c} />
          <ChalkDust c={c} />
          {doodle(c)}
          {state === "mastered" && <Sparkles cls={twinkle} />}
        </g>
      </svg>
    );
  };
}

const STATIONS: Record<string, MapStationComponent> = {};
for (const [track, fns] of Object.entries(FAMILIES) as [
  TrackKey,
  DoodleFn[],
][]) {
  fns.forEach((fn, i) => {
    STATIONS[`${track}#${i}`] = makeStation(track, fn);
  });
}

export function getChalkboardStation(
  ctx: LevelIllustrationContext,
): MapStationComponent | null {
  return STATIONS[`${ctx.trackId}#${ctx.levelIndex}`] ?? null;
}
