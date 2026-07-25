import type { ReactNode } from "react";
import type {
  IllustrationComponent,
  LevelIllustrationContext,
} from "../types";
import { Cheeks, Eyes, INK, KidsAnimations, Smile, Twinkle } from "./animations";

/**
 * Per-level cartoon illustrations for the Kids theme. Each is a self-contained
 * animated SVG in a consistent character style (bold "ink" outlines that adapt
 * to light/dark, white googly eyes, rosy cheeks, big smiles, candy fills).
 *
 * Probability levels each get a bespoke scene; the other tracks share a
 * charming motif-based illustration. All motion is transform/opacity-only and
 * freezes into a tidy static pose under `prefers-reduced-motion`.
 */

const VIEW = "0 0 320 180";

function Frame({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={
        "kids-illus relative w-full overflow-hidden rounded-md border-2 border-border-strong bg-surface-muted " +
        (className ?? "")
      }
    >
      <KidsAnimations />
      <svg
        viewBox={VIEW}
        className="block h-40 w-full sm:h-48"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="kids-glow" cx="50%" cy="42%" r="65%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect x="0" y="0" width="320" height="180" fill="url(#kids-glow)" />
        {children}
      </svg>
    </div>
  );
}

function Floor({ cx = 160, cy = 158, rx = 70 }: { cx?: number; cy?: number; rx?: number }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={9} fill={INK} opacity={0.12} />;
}

/* ========================================================================== */
/*  PROBABILITY — one bespoke scene per level                                  */
/* ========================================================================== */

/** pr-1 Foundations — a grinning coin doing a flip. */
function CoinFlipScene({ className }: { className?: string }) {
  return (
    <Frame className={className}>
      <Floor rx={46} />
      <Twinkle x={70} y={44} delay={0} />
      <Twinkle x={250} y={58} s={7} delay={0.7} />
      <Twinkle x={230} y={120} s={5} color="#a7e0ff" delay={1.1} />
      <g
        className="kids-anim"
        style={{ transformBox: "fill-box", transformOrigin: "center", animation: "kids-float 3.2s ease-in-out infinite" }}
      >
        <g
          className="kids-anim"
          style={{ transformBox: "fill-box", transformOrigin: "160px 92px", animation: "kids-flip 3s ease-in-out infinite" }}
        >
          <circle cx={160} cy={92} r={46} fill="#ffcf4d" stroke={INK} strokeWidth={4} />
          <circle cx={160} cy={92} r={37} fill="none" stroke="#f5b021" strokeWidth={3} />
          <Cheeks cx={160} cy={98} gap={30} r={6} />
          <Eyes cx={160} cy={84} gap={16} r={9} blink />
          <Smile cx={160} cy={100} w={20} depth={11} />
        </g>
      </g>
    </Frame>
  );
}

/** pr-2 Conditional & Bayes — two tumbling googly-eyed dice. */
function DiceTumbleScene({ className }: { className?: string }) {
  const die = (x: number, y: number, color: string, dur: number, delay: number, pips: [number, number][]) => (
    <g
      className="kids-anim"
      style={{ transformBox: "fill-box", transformOrigin: "center", animation: `kids-tumble ${dur}s ease-in-out ${delay}s infinite` }}
    >
      <rect x={x} y={y} width={72} height={72} rx={16} fill={color} stroke={INK} strokeWidth={4} />
      <Eyes cx={x + 36} cy={y + 26} gap={16} r={9} blink delay={delay} />
      <Smile cx={x + 36} cy={y + 44} w={16} depth={8} />
      {pips.map(([px, py], i) => (
        <circle key={i} cx={x + px} cy={y + py} r={4} fill={INK} opacity={0.55} />
      ))}
    </g>
  );
  return (
    <Frame className={className}>
      <Floor cx={110} cy={160} rx={40} />
      <Floor cx={214} cy={160} rx={40} />
      <Twinkle x={60} y={40} delay={0.2} />
      <Twinkle x={264} y={48} s={6} delay={0.9} />
      {die(64, 66, "#ff6b6b", 2.8, 0, [[14, 58], [58, 14]])}
      {die(178, 60, "#5aa9ff", 3.4, 0.5, [[14, 14], [58, 58], [58, 14]])}
    </Frame>
  );
}

/** pr-3 Expectation & Distributions — a friendly bell-curve character. */
function BellCurveScene({ className }: { className?: string }) {
  const curve = "M 40 140 C 90 140 108 44 160 44 C 212 44 230 140 280 140";
  return (
    <Frame className={className}>
      <line x1={30} y1={140} x2={290} y2={140} stroke={INK} strokeWidth={3} strokeLinecap="round" />
      {[70, 115, 160, 205, 250].map((x) => (
        <line key={x} x1={x} y1={140} x2={x} y2={146} stroke={INK} strokeWidth={2.5} />
      ))}
      <path d={`${curve} L 280 140 L 40 140 Z`} fill="#a78bfa" opacity={0.35} />
      <path d={curve} fill="none" stroke={INK} strokeWidth={4} strokeLinecap="round" />
      {/* face sitting on the hump */}
      <Cheeks cx={160} cy={92} gap={30} r={6} />
      <Eyes cx={160} cy={78} gap={16} r={9} blink />
      <Smile cx={160} cy={94} w={18} depth={10} />
      {/* a little ball bouncing over the peak */}
      <g
        className="kids-anim"
        style={{ transformBox: "fill-box", transformOrigin: "center", animation: "kids-bounce 1.5s ease-in-out infinite" }}
      >
        <circle cx={160} cy={40} r={9} fill="#ffd93d" stroke={INK} strokeWidth={3} />
      </g>
      <Twinkle x={250} y={54} s={6} delay={0.6} />
    </Frame>
  );
}

/** pr-4 Hard Interview — a cute ant walking the edges of a cube. */
function AntCubeScene({ className }: { className?: string }) {
  const Ant = () => (
    <g
      className="kids-anim"
      style={{ animation: "kids-antwalk 5s ease-in-out infinite" }}
    >
      <g
        className="kids-anim"
        style={{ transformBox: "fill-box", transformOrigin: "center", animation: "kids-anthop 1s ease-in-out infinite" }}
      >
        {/* legs */}
        <path d="M96 118 l-8 8 M104 120 l-2 10 M112 118 l8 8" stroke={INK} strokeWidth={2.5} strokeLinecap="round" fill="none" />
        {/* body segments */}
        <circle cx={98} cy={112} r={9} fill="#7c3aed" stroke={INK} strokeWidth={3} />
        <circle cx={110} cy={110} r={11} fill="#7c3aed" stroke={INK} strokeWidth={3} />
        {/* head */}
        <circle cx={124} cy={108} r={10} fill="#8b5cf6" stroke={INK} strokeWidth={3} />
        <path d="M130 100 q6 -8 2 -14 M126 99 q2 -9 -3 -14" stroke={INK} strokeWidth={2.4} fill="none" strokeLinecap="round" />
        <circle cx={122} cy={92} r={2.6} fill="#ffd93d" stroke={INK} strokeWidth={1} />
        <circle cx={129} cy={90} r={2.6} fill="#ffd93d" stroke={INK} strokeWidth={1} />
        <circle cx={126} cy={106} r={2.6} fill="#fff" />
        <circle cx={126} cy={106} r={1.2} fill={INK} />
      </g>
    </g>
  );
  return (
    <Frame className={className}>
      {/* isometric cube */}
      <g stroke={INK} strokeWidth={3.5} fill="none" strokeLinejoin="round" strokeLinecap="round">
        <rect x={170} y={54} width={80} height={80} rx={6} fill="#5aa9ff" fillOpacity={0.25} />
        <rect x={200} y={30} width={80} height={80} rx={6} fill="#5aa9ff" fillOpacity={0.18} />
        <line x1={170} y1={54} x2={200} y2={30} />
        <line x1={250} y1={54} x2={280} y2={30} />
        <line x1={170} y1={134} x2={200} y2={110} />
        <line x1={250} y1={134} x2={280} y2={110} />
      </g>
      {[[170, 54], [250, 54], [170, 134], [250, 134], [200, 30], [280, 30], [200, 110], [280, 110]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={4.5} fill="#ffd93d" stroke={INK} strokeWidth={2} />
      ))}
      <Ant />
    </Frame>
  );
}

/** pr-5 Lattice Paths & Collisions — two blobs walking a grid to meet. */
function LatticeScene({ className }: { className?: string }) {
  const gx = 60;
  const gy = 36;
  const step = 40;
  const grid: ReactNode[] = [];
  for (let i = 0; i <= 5; i++) {
    grid.push(<line key={`v${i}`} x1={gx + i * step} y1={gy} x2={gx + i * step} y2={gy + 4 * step} stroke={INK} strokeWidth={1.5} opacity={0.35} />);
  }
  for (let j = 0; j <= 4; j++) {
    grid.push(<line key={`h${j}`} x1={gx} y1={gy + j * step} x2={gx + 5 * step} y2={gy + j * step} stroke={INK} strokeWidth={1.5} opacity={0.35} />);
  }
  const Blob = ({ color, anim }: { color: string; anim: string }) => (
    <g className="kids-anim" style={{ animation: anim }}>
      <circle cx={0} cy={0} r={15} fill={color} stroke={INK} strokeWidth={3} />
      <circle cx={-5} cy={-3} r={3.4} fill="#fff" />
      <circle cx={5} cy={-3} r={3.4} fill="#fff" />
      <circle cx={-5} cy={-3} r={1.5} fill={INK} />
      <circle cx={5} cy={-3} r={1.5} fill={INK} />
      <path d="M-6 5 Q0 10 6 5" fill="none" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
    </g>
  );
  return (
    <Frame className={className}>
      {grid}
      {/* pulsing meeting star at the centre */}
      <g
        className="kids-anim"
        style={{ transformBox: "fill-box", transformOrigin: "center", animation: "kids-pulse 1.2s ease-in-out infinite" }}
      >
        <Twinkle x={gx + 2.5 * step} y={gy + 2 * step} s={12} color="#ffd93d" />
      </g>
      <g style={{ transform: `translate(${gx}px, ${gy + 4 * step}px)` }}>
        <Blob color="#5aa9ff" anim="kids-rollA 4s ease-in-out infinite" />
      </g>
      <g style={{ transform: `translate(${gx + 5 * step}px, ${gy}px)` }}>
        <Blob color="#f472b6" anim="kids-rollB 4s ease-in-out infinite" />
      </g>
    </Frame>
  );
}

/* ========================================================================== */
/*  MOTIF-BASED — shared by the other tracks                                   */
/* ========================================================================== */

/** mentalMath — a friendly calculator pal juggling numbers. */
function CalculatorScene({ className }: { className?: string }) {
  return (
    <Frame className={className}>
      <Floor rx={54} />
      <g
        className="kids-anim"
        style={{ transformBox: "fill-box", transformOrigin: "center", animation: "kids-bob 3s ease-in-out infinite" }}
      >
        <rect x={112} y={54} width={96} height={100} rx={18} fill="#57c785" stroke={INK} strokeWidth={4} />
        {/* arms */}
        <path d="M112 96 q-22 6 -26 26" fill="none" stroke={INK} strokeWidth={4} strokeLinecap="round" />
        <path d="M208 96 q22 6 26 26" fill="none" stroke={INK} strokeWidth={4} strokeLinecap="round" />
        {/* screen with face */}
        <rect x={124} y={66} width={72} height={30} rx={7} fill="#eafff2" stroke={INK} strokeWidth={3} />
        <Eyes cx={160} cy={78} gap={13} r={6.5} blink />
        <Smile cx={160} cy={88} w={12} depth={6} />
        {/* buttons */}
        {[0, 1, 2].map((r) =>
          [0, 1, 2].map((c) => (
            <rect key={`${r}-${c}`} x={128 + c * 22} y={104 + r * 15} width={16} height={11} rx={4} fill="#fff4e0" stroke={INK} strokeWidth={2} />
          )),
        )}
      </g>
      {/* juggled number bubbles */}
      {[
        { x: 92, y: 60, n: "7", c: "#ffd93d", d: 0 },
        { x: 226, y: 52, n: "3", c: "#5aa9ff", d: 0.5 },
        { x: 236, y: 108, n: "+", c: "#f472b6", d: 1 },
      ].map((b, i) => (
        <g
          key={i}
          className="kids-anim"
          style={{ transformBox: "fill-box", transformOrigin: "center", animation: `kids-float 2.6s ease-in-out ${b.d}s infinite` }}
        >
          <circle cx={b.x} cy={b.y} r={14} fill={b.c} stroke={INK} strokeWidth={3} />
          <text x={b.x} y={b.y + 5} textAnchor="middle" fontSize="15" fontWeight="800" fill={INK} fontFamily="inherit">
            {b.n}
          </text>
        </g>
      ))}
    </Frame>
  );
}

/** brainteasers — a lightbulb having a bright idea. */
function IdeaBulbScene({ className }: { className?: string }) {
  return (
    <Frame className={className}>
      {/* radiating rays */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => {
        const rad = (deg * Math.PI) / 180;
        const x1 = 160 + Math.cos(rad) * 52;
        const y1 = 86 + Math.sin(rad) * 52;
        const x2 = 160 + Math.cos(rad) * 70;
        const y2 = 86 + Math.sin(rad) * 70;
        return (
          <line
            key={i}
            className="kids-anim"
            style={{ transformBox: "fill-box", transformOrigin: "center", animation: `kids-sparkle 2s ease-in-out ${i * 0.18}s infinite` }}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#ffb703"
            strokeWidth={4}
            strokeLinecap="round"
          />
        );
      })}
      <g
        className="kids-anim"
        style={{ transformBox: "fill-box", transformOrigin: "center", animation: "kids-bob 3.2s ease-in-out infinite" }}
      >
        <circle cx={160} cy={82} r={40} fill="#ffe27a" stroke={INK} strokeWidth={4} />
        {/* base */}
        <path d="M144 118 h32 M147 126 h26 M151 134 h18" stroke={INK} strokeWidth={4} strokeLinecap="round" />
        <rect x={146} y={112} width={28} height={8} rx={3} fill="#c9d1d9" stroke={INK} strokeWidth={2.5} />
        <Cheeks cx={160} cy={90} gap={26} r={5.5} />
        <Eyes cx={160} cy={76} gap={15} r={8.5} blink />
        <Smile cx={160} cy={92} w={17} depth={9} />
      </g>
    </Frame>
  );
}

/** interviewGames — a market-maker mascot quoting a two-sided market. */
function MarketMakerScene({ className }: { className?: string }) {
  return (
    <Frame className={className}>
      <Floor rx={48} />
      <g
        className="kids-anim"
        style={{ transformBox: "fill-box", transformOrigin: "center", animation: "kids-bob 3s ease-in-out infinite" }}
      >
        {/* head/body */}
        <circle cx={160} cy={96} r={46} fill="#5aa9ff" stroke={INK} strokeWidth={4} />
        {/* headset */}
        <path d="M120 92 a40 40 0 0 1 80 0" fill="none" stroke={INK} strokeWidth={4} />
        <rect x={114} y={88} width={10} height={16} rx={4} fill="#ff6b6b" stroke={INK} strokeWidth={2.5} />
        <rect x={196} y={88} width={10} height={16} rx={4} fill="#ff6b6b" stroke={INK} strokeWidth={2.5} />
        <path d="M119 104 q-6 12 8 16" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
        <circle cx={128} cy={122} r={3.5} fill="#ff6b6b" stroke={INK} strokeWidth={2} />
        <Cheeks cx={160} cy={104} gap={30} r={6} />
        <Eyes cx={160} cy={90} gap={16} r={9} blink />
        <Smile cx={160} cy={106} w={18} depth={10} />
      </g>
      {/* floating bid / ask bubbles */}
      <g
        className="kids-anim"
        style={{ transformBox: "fill-box", transformOrigin: "center", animation: "kids-float 2.8s ease-in-out infinite" }}
      >
        <circle cx={64} cy={64} r={20} fill="#57c785" stroke={INK} strokeWidth={3} />
        <path d="M64 74 v-18 M56 64 l8 -9 l8 9" fill="none" stroke={INK} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g
        className="kids-anim"
        style={{ transformBox: "fill-box", transformOrigin: "center", animation: "kids-float 2.8s ease-in-out 0.7s infinite" }}
      >
        <circle cx={256} cy={70} r={20} fill="#ff6b6b" stroke={INK} strokeWidth={3} />
        <path d="M256 60 v18 M248 68 l8 9 l8 -9" fill="none" stroke={INK} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </Frame>
  );
}

/** calibration — a smiling bullseye with a dart on target. */
function CalibrationScene({ className }: { className?: string }) {
  return (
    <Frame className={className}>
      <Floor rx={50} />
      <g
        className="kids-anim"
        style={{ transformBox: "fill-box", transformOrigin: "center", animation: "kids-bob 3.4s ease-in-out infinite" }}
      >
        <circle cx={150} cy={92} r={54} fill="#ff6b6b" stroke={INK} strokeWidth={4} />
        <circle cx={150} cy={92} r={38} fill="#fff4e0" stroke={INK} strokeWidth={3} />
        <circle cx={150} cy={92} r={22} fill="#5aa9ff" stroke={INK} strokeWidth={3} />
        <Eyes cx={150} cy={86} gap={13} r={7} blink />
        <Smile cx={150} cy={100} w={14} depth={8} />
      </g>
      {/* dart hitting the centre */}
      <g
        className="kids-anim"
        style={{ transformBox: "fill-box", transformOrigin: "150px 92px", animation: "kids-jiggle 1.4s ease-in-out infinite" }}
      >
        <line x1={150} y1={92} x2={244} y2={40} stroke={INK} strokeWidth={4} strokeLinecap="round" />
        <path d="M244 40 l14 -3 l-4 13 z" fill="#ffd93d" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
        <circle cx={150} cy={92} r={4.5} fill="#ffd93d" stroke={INK} strokeWidth={2} />
      </g>
      <Twinkle x={78} y={54} delay={0.3} />
      <Twinkle x={96} y={128} s={5} delay={1} />
    </Frame>
  );
}

/* ========================================================================== */
/*  Mapping                                                                    */
/* ========================================================================== */

const PROBABILITY_BY_INDEX: IllustrationComponent[] = [
  CoinFlipScene, // pr-1 Foundations
  DiceTumbleScene, // pr-2 Conditional & Bayes
  BellCurveScene, // pr-3 Expectation & Distributions
  AntCubeScene, // pr-4 Hard Interview Problems
  LatticeScene, // pr-5 Lattice Paths & Collisions
];

const MOTIF_FALLBACK = {
  probability: CoinFlipScene,
  mathQuestions: CalculatorScene,
  mentalMath: CalculatorScene,
  brainteasers: IdeaBulbScene,
  interviewGames: MarketMakerScene,
  calibration: CalibrationScene,
} as const;

export function getKidsIllustration(
  ctx: LevelIllustrationContext,
): IllustrationComponent | null {
  if (ctx.trackId === "probability") {
    return (
      PROBABILITY_BY_INDEX[ctx.levelIndex] ??
      MOTIF_FALLBACK.probability
    );
  }
  return MOTIF_FALLBACK[ctx.motif] ?? null;
}
