import type { ComponentType, CSSProperties, ReactNode } from "react";
import type {
  LevelIllustrationContext,
  MapStationComponent,
  MapStationState,
} from "../types";
import { INK, KidsAnimations, Twinkle } from "./animations";

/**
 * MAP STATIONS for the Kids / Cartoon theme — every level node on the track
 * maps becomes a distinct, colorful amusement-park landmark (Candy-Crush
 * style). Art is keyed by `trackId` + `levelIndex`, so each track is its own
 * family of attractions and no two nodes look alike (17 total).
 *
 * Rendering: a decorative SVG layer centered BEHIND the 68px node button inside
 * a 116px box, so the recognizable pieces (roofs, wheels, signs, bases, side
 * flags) live in the ring AROUND the button and frame the level number without
 * covering it. All outlines use the adaptive "ink" token so they never vanish;
 * candy fills read on both light and dark. Motion is transform/opacity-only,
 * frozen when locked (`data-kids-locked`) and under prefers-reduced-motion.
 */

/* Candy palette (mid-tone hues that read on light AND dark, always ink-outlined). */
const RED = "#ff6b6b";
const BLUE = "#5aa9ff";
const YEL = "#ffd93d";
const GRN = "#57c785";
const PUR = "#a78bfa";
const PNK = "#f472b6";
const ORG = "#ff9f45";
const CRM = "#fff4e0";
const TEAL = "#33c2b5";
const GOLD = "#ffcf4d";
const W = 2.4; // default outline width

/* -------------------------------------------------------------------------- */
/*  Frame + shared primitives                                                  */
/* -------------------------------------------------------------------------- */

function StationFrame({
  className,
  state,
  children,
}: {
  className?: string;
  state?: MapStationState;
  children: ReactNode;
}) {
  const locked = state === "locked";
  const mastered = state === "mastered";
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      aria-hidden="true"
      data-kids-locked={locked ? "true" : undefined}
    >
      <KidsAnimations />
      <g
        style={
          locked ? { filter: "grayscale(1)", opacity: 0.5 } : undefined
        }
      >
        {children}
      </g>
      {mastered && (
        <g>
          <Twinkle x={12} y={16} s={7} color={GOLD} delay={0} />
          <Twinkle x={88} y={20} s={6} color={GOLD} delay={0.5} />
          <Twinkle x={82} y={90} s={5} color={GOLD} delay={1} />
        </g>
      )}
    </svg>
  );
}

/** Wrap a prop-less art component into a full MapStationComponent. */
function station(Art: ComponentType): MapStationComponent {
  return function Station({
    className,
    state,
  }: {
    className?: string;
    state?: MapStationState;
  }) {
    return (
      <StationFrame className={className} state={state}>
        <Art />
      </StationFrame>
    );
  };
}

/** A little grassy/candy base platform below the node. */
function Base({ color = CRM }: { color?: string }) {
  return (
    <g>
      <rect x={14} y={83} width={72} height={13} rx={5} fill={color} stroke={INK} strokeWidth={W} />
      <line x1={20} y1={89} x2={80} y2={89} stroke={INK} strokeWidth={1.3} opacity={0.4} />
    </g>
  );
}

/** A swaying pennant flag on a short pole. */
function Flag({ x, y, h = 15, color, delay = 0 }: { x: number; y: number; h?: number; color: string; delay?: number }) {
  return (
    <g
      className="kids-anim"
      style={{ transformBox: "view-box", transformOrigin: `${x}px ${y + h}px`, animation: `kids-sway 3s ease-in-out ${delay}s infinite` } as CSSProperties}
    >
      <line x1={x} y1={y} x2={x} y2={y + h} stroke={INK} strokeWidth={2} strokeLinecap="round" />
      <path d={`M${x} ${y} L${x + 13} ${y + 3.5} L${x} ${y + 7} Z`} fill={color} stroke={INK} strokeWidth={1.4} strokeLinejoin="round" />
    </g>
  );
}

/** A twinkling marquee bulb. */
function Bulb({ x, y, delay = 0, color = "#fff4a8" }: { x: number; y: number; delay?: number; color?: string }) {
  return (
    <circle
      className="kids-anim"
      cx={x}
      cy={y}
      r={2.3}
      fill={color}
      stroke={INK}
      strokeWidth={0.8}
      style={{ transformBox: "view-box", transformOrigin: `${x}px ${y}px`, animation: `kids-sparkle 2s ease-in-out ${delay}s infinite` } as CSSProperties}
    />
  );
}

/** A soft swag of bunting between two points (row of tiny triangles). */
function Bunting({ x1, x2, y, n = 6, colors = [RED, YEL, GRN, BLUE, PNK] }: { x1: number; x2: number; y: number; n?: number; colors?: string[] }) {
  const items: ReactNode[] = [];
  const dip = 5;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = x1 + (x2 - x1) * t;
    const cy = y + Math.sin(t * Math.PI) * dip;
    items.push(
      <path
        key={i}
        d={`M${x - 3} ${cy} L${x + 3} ${cy} L${x} ${cy + 6} Z`}
        fill={colors[i % colors.length]}
        stroke={INK}
        strokeWidth={1}
        strokeLinejoin="round"
      />,
    );
  }
  return (
    <g>
      <path d={`M${x1} ${y} Q${(x1 + x2) / 2} ${y + dip + 2} ${x2} ${y}`} fill="none" stroke={INK} strokeWidth={1.2} />
      {items}
    </g>
  );
}

/* ========================================================================== */
/*  PROBABILITY — amusement-park progression                                   */
/* ========================================================================== */

/** pr-1 — Bouncy House (inflatable castle). */
function BouncyHouseArt() {
  const turret = (x: number, color: string) => (
    <g>
      <rect x={x} y={14} width={20} height={32} rx={5} fill={color} stroke={INK} strokeWidth={W} />
      <path d={`M${x - 2} ${14} L${x + 10} ${4} L${x + 22} ${14} Z`} fill={GOLD} stroke={INK} strokeWidth={W} strokeLinejoin="round" />
      <Flag x={x + 10} y={-4} h={9} color={PNK} />
    </g>
  );
  return (
    <g className="kids-anim" style={{ transformBox: "view-box", transformOrigin: "50px 90px", animation: "kids-bob 2.6s ease-in-out infinite" } as CSSProperties}>
      <Base color={GRN} />
      <rect x={18} y={30} width={64} height={56} rx={12} fill={BLUE} stroke={INK} strokeWidth={W} />
      <rect x={30} y={44} width={40} height={42} rx={9} fill={CRM} stroke={INK} strokeWidth={2} />
      {turret(6, RED)}
      {turret(74, RED)}
      <Bunting x1={22} x2={78} y={12} n={6} />
    </g>
  );
}

/** pr-2 — Arcade (neon marquee). */
function ArcadeArt() {
  return (
    <g>
      <Base color={PUR} />
      <rect x={16} y={34} width={68} height={52} rx={8} fill={PUR} stroke={INK} strokeWidth={W} />
      <rect x={10} y={68} width={8} height={18} rx={3} fill={PNK} stroke={INK} strokeWidth={2} />
      <rect x={82} y={68} width={8} height={18} rx={3} fill={PNK} stroke={INK} strokeWidth={2} />
      {/* marquee sign */}
      <rect x={12} y={5} width={76} height={22} rx={7} fill={YEL} stroke={INK} strokeWidth={W} />
      <rect x={20} y={11} width={60} height={10} rx={3} fill={CRM} stroke={INK} strokeWidth={1.6} />
      <path d="M30 19 L30 13 L34 13 M44 13 L44 19 M40 16 L48 16 M54 13 L58 19 L62 13 M70 13 L70 19 L74 19" fill="none" stroke={INK} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" opacity={0.55} />
      {[16, 27, 38, 49, 60, 71, 84].map((x, i) => (
        <Bulb key={`t${x}`} x={x} y={5} delay={i * 0.2} />
      ))}
      {[16, 84].map((x, i) => (
        <Bulb key={`s${x}`} x={x} y={16} delay={0.3 + i * 0.2} />
      ))}
    </g>
  );
}

/** pr-3 — Carnival Tent (big top). */
function CarnivalTentArt() {
  const stripes: ReactNode[] = [];
  const cols = [RED, CRM, RED, CRM, RED, CRM, RED];
  const n = cols.length;
  for (let i = 0; i < n; i++) {
    const x1 = 12 + (76 * i) / n;
    const x2 = 12 + (76 * (i + 1)) / n;
    stripes.push(
      <path key={i} d={`M50 6 L${x1} 44 L${x2} 44 Z`} fill={cols[i]} stroke="none" />,
    );
  }
  return (
    <g>
      <Base color={ORG} />
      <rect x={18} y={40} width={64} height={46} rx={6} fill={CRM} stroke={INK} strokeWidth={W} />
      <path d="M32 86 L32 52 Q50 44 68 52 L68 86" fill={RED} stroke={INK} strokeWidth={2} opacity={0.85} />
      {/* poles + flags */}
      <line x1={12} y1={22} x2={12} y2={86} stroke={INK} strokeWidth={2.4} />
      <line x1={88} y1={22} x2={88} y2={86} stroke={INK} strokeWidth={2.4} />
      <Flag x={12} y={16} h={12} color={BLUE} delay={0.2} />
      <Flag x={88} y={16} h={12} color={GRN} delay={0.6} />
      {/* striped roof */}
      <g>{stripes}</g>
      <path d="M50 6 L12 44 L88 44 Z" fill="none" stroke={INK} strokeWidth={W} strokeLinejoin="round" />
      <path d="M12 44 q6 6 12 0 q6 6 12 0 q6 6 12 0 q6 6 12 0 q6 6 12 0 q6 6 12 0" fill="none" stroke={INK} strokeWidth={1.8} />
      <Flag x={50} y={-2} h={10} color={YEL} />
    </g>
  );
}

/** pr-4 — Ferris Wheel (rotating). */
function FerrisWheelArt() {
  const R = 40;
  const cx = 50;
  const cy = 46;
  const cabColors = [RED, YEL, GRN, BLUE, PUR, PNK, ORG, TEAL];
  const spokes: ReactNode[] = [];
  const cabins: ReactNode[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(a) * R;
    const y = cy + Math.sin(a) * R;
    spokes.push(<line key={`sp${i}`} x1={cx} y1={cy} x2={x} y2={y} stroke={INK} strokeWidth={1.6} />);
    cabins.push(
      <g key={`cb${i}`}>
        <line x1={x} y1={y} x2={x} y2={y + 3} stroke={INK} strokeWidth={1.4} />
        <rect x={x - 5} y={y - 2} width={10} height={9} rx={3} fill={cabColors[i]} stroke={INK} strokeWidth={1.8} />
      </g>,
    );
  }
  return (
    <g>
      {/* static support + base */}
      <path d={`M${cx} ${cy} L28 92 M${cx} ${cy} L72 92`} stroke={INK} strokeWidth={3} strokeLinecap="round" fill="none" />
      <rect x={18} y={90} width={64} height={7} rx={3.5} fill={ORG} stroke={INK} strokeWidth={2} />
      {/* rotating wheel */}
      <g
        className="kids-anim"
        style={{ transformBox: "view-box", transformOrigin: `${cx}px ${cy}px`, animation: "kids-spin 16s linear infinite" } as CSSProperties}
      >
        <circle cx={cx} cy={cy} r={R} fill="none" stroke={INK} strokeWidth={3} />
        <circle cx={cx} cy={cy} r={R - 5} fill="none" stroke={INK} strokeWidth={1.2} opacity={0.5} />
        {spokes}
        {cabins}
        <circle cx={cx} cy={cy} r={6} fill={GOLD} stroke={INK} strokeWidth={2} />
      </g>
    </g>
  );
}

/** pr-5 — Rollercoaster (loop + cart). */
function RollercoasterArt() {
  return (
    <g>
      <rect x={12} y={90} width={76} height={7} rx={3.5} fill={GRN} stroke={INK} strokeWidth={2} />
      {/* support posts */}
      {[
        [22, 40],
        [50, 30],
        [78, 46],
      ].map(([x, y], i) => (
        <line key={i} x1={x} y1={y} x2={x} y2={90} stroke={INK} strokeWidth={2} opacity={0.6} />
      ))}
      {/* track + loop */}
      <path d="M4 58 C 16 14 34 14 42 36 C 48 54 64 6 96 40" fill="none" stroke={INK} strokeWidth={3.2} strokeLinecap="round" />
      <circle cx={22} cy={30} r={9} fill="none" stroke={RED} strokeWidth={3} />
      <path d="M4 62 C 16 18 34 18 42 40 C 48 58 64 10 96 44" fill="none" stroke={PNK} strokeWidth={2} strokeLinecap="round" opacity={0.7} />
      {/* cart */}
      <g className="kids-anim" style={{ transformBox: "view-box", transformOrigin: "78px 30px", animation: "kids-float 2.2s ease-in-out infinite" } as CSSProperties}>
        <rect x={72} y={22} width={16} height={9} rx={3} fill={YEL} stroke={INK} strokeWidth={2} />
        <circle cx={76} cy={32} r={2.2} fill={INK} />
        <circle cx={84} cy={32} r={2.2} fill={INK} />
        <circle cx={77} cy={20} r={2} fill={RED} stroke={INK} strokeWidth={0.8} />
        <circle cx={83} cy={20} r={2} fill={BLUE} stroke={INK} strokeWidth={0.8} />
      </g>
    </g>
  );
}

/* ========================================================================== */
/*  MENTAL-MATH — math-carnival                                                 */
/* ========================================================================== */

/** mm-1 — Number-Balloon Stand. */
function BalloonStandArt() {
  const balloon = (x: number, y: number, color: string, label: string, delay: number) => (
    <g className="kids-anim" style={{ transformBox: "view-box", transformOrigin: `${x}px ${y}px`, animation: `kids-float 2.8s ease-in-out ${delay}s infinite` } as CSSProperties}>
      <line x1={x} y1={y + 10} x2={50} y2={78} stroke={INK} strokeWidth={1} opacity={0.5} />
      <ellipse cx={x} cy={y} rx={10} ry={12} fill={color} stroke={INK} strokeWidth={2} />
      <path d={`M${x} ${y + 12} l-2.5 4 h5 z`} fill={color} stroke={INK} strokeWidth={1.4} />
      <text x={x} y={y + 4} textAnchor="middle" fontSize="11" fontWeight="800" fill={INK} fontFamily="inherit">{label}</text>
    </g>
  );
  return (
    <g>
      {/* counter */}
      <rect x={16} y={78} width={68} height={18} rx={5} fill={ORG} stroke={INK} strokeWidth={W} />
      <rect x={22} y={83} width={56} height={9} rx={2} fill={CRM} stroke={INK} strokeWidth={1.4} />
      {balloon(26, 16, RED, "7", 0)}
      {balloon(50, 8, YEL, "+", 0.5)}
      {balloon(74, 16, BLUE, "3", 1)}
      {balloon(38, 30, GRN, "5", 0.3)}
      {balloon(62, 30, PNK, "=", 0.8)}
    </g>
  );
}

/** mm-2 — Calculator Kiosk. */
function CalculatorKioskArt() {
  const btns: ReactNode[] = [];
  const bcol = [RED, YEL, GRN, BLUE, ORG, PUR];
  let k = 0;
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      btns.push(
        <rect key={`b${r}${c}`} x={30 + c * 14} y={16 + r * 8} width={10} height={6} rx={2} fill={bcol[k % bcol.length]} stroke={INK} strokeWidth={1.2} />,
      );
      k++;
    }
  }
  return (
    <g>
      <Base color={GRN} />
      <rect x={16} y={34} width={68} height={52} rx={8} fill={GRN} stroke={INK} strokeWidth={W} />
      {/* awning */}
      <path d="M12 34 q6 7 12 0 q6 7 12 0 q6 7 12 0 q6 7 12 0 q6 7 12 0" fill={RED} stroke={INK} strokeWidth={2} />
      <rect x={12} y={30} width={76} height={5} rx={2} fill={CRM} stroke={INK} strokeWidth={1.6} />
      {/* calculator sign */}
      <rect x={24} y={4} width={52} height={26} rx={6} fill={CRM} stroke={INK} strokeWidth={W} />
      <rect x={30} y={7} width={40} height={7} rx={2} fill="#dff7ea" stroke={INK} strokeWidth={1.4} />
      <text x={50} y={13} textAnchor="middle" fontSize="6" fontWeight="800" fill={INK} fontFamily="inherit" className="kids-anim" style={{ animation: "kids-sparkle 2.4s ease-in-out infinite" } as CSSProperties}>1234</text>
      {btns}
    </g>
  );
}

/** mm-3 — Abacus Ride. */
function AbacusRideArt() {
  const bead = (x: number, y: number, color: string) => (
    <circle cx={x} cy={y} r={3.4} fill={color} stroke={INK} strokeWidth={1.4} />
  );
  return (
    <g>
      {/* ride car */}
      <rect x={18} y={76} width={64} height={16} rx={6} fill={PUR} stroke={INK} strokeWidth={W} />
      <circle cx={30} cy={94} r={5} fill={INK} />
      <circle cx={70} cy={94} r={5} fill={INK} />
      <circle cx={30} cy={94} r={2} fill={CRM} />
      <circle cx={70} cy={94} r={2} fill={CRM} />
      {/* abacus frame */}
      <rect x={14} y={6} width={72} height={42} rx={7} fill={CRM} stroke={INK} strokeWidth={W} />
      <g className="kids-anim" style={{ transformBox: "view-box", transformOrigin: "50px 14px", animation: "kids-bob 3s ease-in-out infinite" } as CSSProperties}>
        <line x1={18} y1={14} x2={82} y2={14} stroke={INK} strokeWidth={1.6} />
        {bead(26, 14, RED)}
        {bead(34, 14, YEL)}
        {bead(72, 14, GRN)}
      </g>
      <line x1={18} y1={26} x2={82} y2={26} stroke={INK} strokeWidth={1.6} />
      {bead(30, 26, BLUE)}
      {bead(60, 26, ORG)}
      {bead(68, 26, PNK)}
    </g>
  );
}

/** mm-4 — Speed-Timer Booth (stopwatch). */
function TimerBoothArt() {
  const ticks: ReactNode[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const x1 = 50 + Math.cos(a) * 16;
    const y1 = 28 + Math.sin(a) * 16;
    const x2 = 50 + Math.cos(a) * 19;
    const y2 = 28 + Math.sin(a) * 19;
    ticks.push(<line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK} strokeWidth={1.2} />);
  }
  return (
    <g>
      <Base color={BLUE} />
      <rect x={20} y={40} width={60} height={46} rx={7} fill={BLUE} stroke={INK} strokeWidth={W} />
      {/* speed lines */}
      {[18, 24, 30].map((y, i) => (
        <line key={i} x1={4} y1={y} x2={14} y2={y} stroke={PNK} strokeWidth={2} strokeLinecap="round" opacity={0.7} />
      ))}
      {/* stopwatch */}
      <rect x={46} y={2} width={8} height={6} rx={2} fill={RED} stroke={INK} strokeWidth={1.6} />
      <circle cx={50} cy={28} r={21} fill={CRM} stroke={INK} strokeWidth={W} />
      {ticks}
      <g className="kids-anim" style={{ transformBox: "view-box", transformOrigin: "50px 28px", animation: "kids-spin 2.6s linear infinite" } as CSSProperties}>
        <line x1={50} y1={28} x2={50} y2={15} stroke={RED} strokeWidth={2.4} strokeLinecap="round" />
        <line x1={50} y1={28} x2={59} y2={31} stroke={INK} strokeWidth={2} strokeLinecap="round" />
      </g>
      <circle cx={50} cy={28} r={2.6} fill={INK} />
    </g>
  );
}

/* ========================================================================== */
/*  BRAINTEASERS — puzzle-land                                                  */
/* ========================================================================== */

/** bt-1 — Maze Tent. */
function MazeTentArt() {
  return (
    <g>
      <Base color={TEAL} />
      <rect x={16} y={40} width={68} height={46} rx={7} fill={TEAL} stroke={INK} strokeWidth={W} />
      <line x1={12} y1={40} x2={50} y2={40} stroke={INK} strokeWidth={1.4} opacity={0.5} />
      {/* maze sign */}
      <rect x={28} y={4} width={44} height={30} rx={6} fill={CRM} stroke={INK} strokeWidth={W} />
      <path d="M34 30 L34 10 L44 10 L44 22 L38 22 M50 30 L50 16 L60 16 L60 28 M66 10 L66 24" fill="none" stroke={PUR} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      <line x1={16} y1={22} x2={16} y2={86} stroke={INK} strokeWidth={2.2} />
      <Flag x={16} y={16} h={11} color={ORG} />
    </g>
  );
}

/** bt-2 — Jigsaw Hut. */
function JigsawHutArt() {
  return (
    <g>
      <Base color={ORG} />
      <rect x={20} y={44} width={60} height={42} rx={6} fill={ORG} stroke={INK} strokeWidth={W} />
      {/* jigsaw roof: rect with knobs */}
      <path
        d="M16 40 L16 20 Q16 12 24 12 Q30 12 30 8 Q30 3 36 3 Q42 3 42 8 Q42 12 48 12 L52 12 Q58 12 58 8 Q58 3 64 3 Q70 3 70 8 Q70 12 76 12 Q84 12 84 20 L84 40 Z"
        fill={YEL}
        stroke={INK}
        strokeWidth={W}
        strokeLinejoin="round"
      />
      <line x1={50} y1={12} x2={50} y2={40} stroke={INK} strokeWidth={1.4} opacity={0.4} />
      {/* floating puzzle pieces */}
      <g className="kids-anim" style={{ transformBox: "view-box", transformOrigin: "10px 60px", animation: "kids-bob 3s ease-in-out infinite" } as CSSProperties}>
        <path d="M4 54 h6 q2 -3 4 0 h6 v6 q3 2 0 4 v6 h-16 z" fill={BLUE} stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
      </g>
      <g className="kids-anim" style={{ transformBox: "view-box", transformOrigin: "90px 62px", animation: "kids-bob 3.4s ease-in-out 0.6s infinite" } as CSSProperties}>
        <path d="M84 56 h6 v6 q3 2 0 4 v6 h-16 v-6 q-3 -2 0 -4 v-6 q3 -3 6 0 z" fill={PNK} stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
      </g>
    </g>
  );
}

/** bt-3 — Lightbulb-Idea Lab. */
function IdeaLabArt() {
  const rays: ReactNode[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const x1 = 50 + Math.cos(a) * 17;
    const y1 = 20 + Math.sin(a) * 17;
    const x2 = 50 + Math.cos(a) * 24;
    const y2 = 20 + Math.sin(a) * 24;
    rays.push(
      <line
        key={i}
        className="kids-anim"
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="#ffb703"
        strokeWidth={2.4}
        strokeLinecap="round"
        style={{ transformBox: "view-box", transformOrigin: `${(x1 + x2) / 2}px ${(y1 + y2) / 2}px`, animation: `kids-sparkle 2s ease-in-out ${i * 0.15}s infinite` } as CSSProperties}
      />,
    );
  }
  const flask = (x: number, color: string) => (
    <g>
      <path d={`M${x} 60 L${x} 68 L${x - 4} 80 Q${x - 5} 84 ${x} 84 L${x + 8} 84 Q${x + 13} 84 ${x + 12} 80 L${x + 8} 68 L${x + 8} 60 Z`} fill={color} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
      <line x1={x - 1} y1={60} x2={x + 9} y2={60} stroke={INK} strokeWidth={2} />
    </g>
  );
  return (
    <g>
      <Base color={BLUE} />
      <rect x={18} y={40} width={64} height={46} rx={7} fill={BLUE} stroke={INK} strokeWidth={W} />
      {flask(2, GRN)}
      {flask(86, PNK)}
      {rays}
      <g className="kids-anim" style={{ transformBox: "view-box", transformOrigin: "50px 22px", animation: "kids-bob 3.2s ease-in-out infinite" } as CSSProperties}>
        <circle cx={50} cy={20} r={14} fill={YEL} stroke={INK} strokeWidth={W} />
        <rect x={44} y={32} width={12} height={7} rx={2} fill="#c9d1d9" stroke={INK} strokeWidth={1.8} />
        <path d="M46 36 h8 M47 39 h6" stroke={INK} strokeWidth={1.4} strokeLinecap="round" />
        <path d="M44 20 q6 6 12 0" fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" />
      </g>
    </g>
  );
}

/* ========================================================================== */
/*  INTERVIEW-GAMES — trading fair                                              */
/* ========================================================================== */

/** ig-1 — Market Stall (lemonade stand). */
function MarketStallArt() {
  return (
    <g>
      {/* counter */}
      <rect x={14} y={76} width={72} height={18} rx={5} fill={YEL} stroke={INK} strokeWidth={W} />
      {[24, 36, 48, 60, 72].map((x, i) => (
        <line key={i} x1={x} y1={78} x2={x} y2={92} stroke={INK} strokeWidth={1} opacity={0.35} />
      ))}
      {/* posts */}
      <line x1={14} y1={30} x2={14} y2={76} stroke={INK} strokeWidth={2.4} />
      <line x1={86} y1={30} x2={86} y2={76} stroke={INK} strokeWidth={2.4} />
      {/* awning */}
      <path d="M10 14 L90 14 L90 26 q-8 8 -16 0 q-8 8 -16 0 q-8 8 -16 0 q-8 8 -16 0 q-8 8 -16 0 Z" fill={RED} stroke={INK} strokeWidth={W} strokeLinejoin="round" />
      {[18, 34, 50, 66, 82].map((x, i) => (
        <path key={i} d={`M${x - 8} 14 L${x + 8} 14 L${x + 4} 26 q-4 5 -8 0 Z`} fill={i % 2 ? CRM : RED} stroke="none" />
      ))}
      <path d="M10 14 L90 14 L90 26 q-8 8 -16 0 q-8 8 -16 0 q-8 8 -16 0 q-8 8 -16 0 q-8 8 -16 0 Z" fill="none" stroke={INK} strokeWidth={W} strokeLinejoin="round" />
      {/* lemonade cup + jug on corners */}
      <g>
        <path d="M4 70 L6 82 Q6 84 8 84 L11 84 Q13 84 13 82 L15 70 Z" fill={CRM} stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
        <rect x={6} y={72} width={7} height={5} fill={YEL} />
      </g>
      <g>
        <rect x={84} y={68} width={13} height={16} rx={3} fill="#dff2ff" stroke={INK} strokeWidth={1.8} />
        <rect x={84} y={76} width={13} height={8} rx={2} fill={YEL} opacity={0.8} />
        <path d="M97 72 q4 2 0 6" fill="none" stroke={INK} strokeWidth={1.6} />
      </g>
      <Flag x={50} y={4} h={9} color={GRN} />
    </g>
  );
}

/** ig-2 — Trading Post (bid/ask boards). */
function TradingPostArt() {
  return (
    <g>
      <Base color={BLUE} />
      <rect x={16} y={40} width={68} height={46} rx={7} fill={BLUE} stroke={INK} strokeWidth={W} />
      {/* ticker */}
      <rect x={14} y={34} width={72} height={7} rx={2} fill={INK} />
      {[20, 30, 40, 50, 60, 70, 80].map((x, i) => (
        <circle key={i} cx={x} cy={37.5} r={1.4} fill={i % 2 ? GRN : YEL} />
      ))}
      {/* up board */}
      <g className="kids-anim" style={{ transformBox: "view-box", transformOrigin: "26px 18px", animation: "kids-pulse 1.6s ease-in-out infinite" } as CSSProperties}>
        <rect x={8} y={6} width={34} height={26} rx={6} fill={GRN} stroke={INK} strokeWidth={W} />
        <path d="M25 26 L25 12 M18 19 L25 11 L32 19" fill="none" stroke={CRM} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      </g>
      {/* down board */}
      <g className="kids-anim" style={{ transformBox: "view-box", transformOrigin: "74px 18px", animation: "kids-pulse 1.6s ease-in-out 0.8s infinite" } as CSSProperties}>
        <rect x={58} y={6} width={34} height={26} rx={6} fill={RED} stroke={INK} strokeWidth={W} />
        <path d="M75 12 L75 26 M68 19 L75 27 L82 19" fill="none" stroke={CRM} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </g>
  );
}

/** ig-3 — Auction Booth (gavel). */
function AuctionBoothArt() {
  return (
    <g>
      {/* podium */}
      <path d="M28 94 L32 74 L68 74 L72 94 Z" fill={PUR} stroke={INK} strokeWidth={W} strokeLinejoin="round" />
      <rect x={34} y={80} width={32} height={9} rx={2} fill={CRM} stroke={INK} strokeWidth={1.6} />
      {/* sound block */}
      <rect x={22} y={30} width={20} height={7} rx={3} fill={ORG} stroke={INK} strokeWidth={2} />
      {/* gavel */}
      <g className="kids-anim" style={{ transformBox: "view-box", transformOrigin: "70px 34px", animation: "kids-jiggle 1.3s ease-in-out infinite" } as CSSProperties}>
        <rect x={48} y={8} width={26} height={13} rx={5} fill={ORG} stroke={INK} strokeWidth={W} />
        <line x1={55} y1={9} x2={55} y2={20} stroke={INK} strokeWidth={1.8} />
        <line x1={67} y1={9} x2={67} y2={20} stroke={INK} strokeWidth={1.8} />
        <rect x={59} y={18} width={6} height={22} rx={3} fill={GOLD} stroke={INK} strokeWidth={2} transform="rotate(32 62 29)" />
      </g>
      <Bunting x1={16} x2={84} y={6} n={7} />
    </g>
  );
}

/** ig-4 — Game / Poker Tent. */
function PokerTentArt() {
  const suit = (x: number, y: number, type: "h" | "s" | "d" | "c", color: string) => {
    const paths: Record<string, string> = {
      h: `M${x} ${y + 4} C ${x - 4} ${y - 2} ${x - 7} ${y + 2} ${x} ${y + 7} C ${x + 7} ${y + 2} ${x + 4} ${y - 2} ${x} ${y + 4} Z`,
      s: `M${x} ${y - 3} C ${x + 6} ${y + 3} ${x + 4} ${y + 6} ${x} ${y + 5} C ${x - 4} ${y + 6} ${x - 6} ${y + 3} ${x} ${y - 3} Z`,
      d: `M${x} ${y - 4} L${x + 4} ${y + 1} L${x} ${y + 6} L${x - 4} ${y + 1} Z`,
      c: `M${x} ${y - 2} m-2 4 a2.4 2.4 0 1 1 4 0 a2.4 2.4 0 1 1 3 2 a2.4 2.4 0 1 1 -8 0 z`,
    };
    return <path d={paths[type]} fill={color} stroke={INK} strokeWidth={1.4} strokeLinejoin="round" />;
  };
  return (
    <g>
      <Base color={GRN} />
      <rect x={16} y={42} width={68} height={44} rx={7} fill={RED} stroke={INK} strokeWidth={W} />
      <path d="M50 6 L12 44 L88 44 Z" fill={GRN} stroke={INK} strokeWidth={W} strokeLinejoin="round" />
      {/* suit bunting */}
      <g className="kids-anim" style={{ transformBox: "view-box", transformOrigin: "50px 12px", animation: "kids-sway 3.4s ease-in-out infinite" } as CSSProperties}>
        {suit(24, 30, "s", INK)}
        {suit(38, 20, "h", RED)}
        {suit(50, 14, "d", RED)}
        {suit(62, 20, "c", INK)}
        {suit(76, 30, "h", RED)}
      </g>
      {/* chips */}
      <g>
        <circle cx={9} cy={80} r={7} fill={BLUE} stroke={INK} strokeWidth={2} />
        <circle cx={9} cy={80} r={4} fill="none" stroke={CRM} strokeWidth={1.6} strokeDasharray="2 2" />
      </g>
      <g>
        <circle cx={91} cy={82} r={7} fill={YEL} stroke={INK} strokeWidth={2} />
        <circle cx={91} cy={82} r={4} fill="none" stroke={INK} strokeWidth={1.4} strokeDasharray="2 2" />
      </g>
    </g>
  );
}

/** ig-5 — Grand-Prize Stage (finale). */
function GrandStageArt() {
  const curtain = (x: number, dir: 1 | -1) => (
    <g>
      <path d={`M${x} 6 L${x + dir * 22} 6 L${x + dir * 22} 82 Q${x + dir * 11} 88 ${x} 82 Z`} fill={RED} stroke={INK} strokeWidth={W} strokeLinejoin="round" />
      {[6, 12, 18].map((o, i) => (
        <line key={i} x1={x + dir * o} y1={8} x2={x + dir * o} y2={80} stroke={INK} strokeWidth={1.1} opacity={0.35} />
      ))}
      <circle cx={x + dir * 11} cy={50} r={3} fill={GOLD} stroke={INK} strokeWidth={1.4} />
    </g>
  );
  return (
    <g>
      {/* stage platform */}
      <rect x={10} y={82} width={80} height={13} rx={4} fill={PUR} stroke={INK} strokeWidth={W} />
      <line x1={30} y1={82} x2={26} y2={95} stroke={INK} strokeWidth={1.2} opacity={0.4} />
      <line x1={70} y1={82} x2={74} y2={95} stroke={INK} strokeWidth={1.2} opacity={0.4} />
      {/* side curtains */}
      {curtain(4, 1)}
      {curtain(96, -1)}
      {/* top valance */}
      <path d="M4 4 L96 4 L96 16 q-9 8 -18 0 q-9 8 -18 0 q-9 8 -18 0 q-9 8 -18 0 q-9 8 -18 0 Z" fill={GRN} stroke={INK} strokeWidth={W} strokeLinejoin="round" />
      {[12, 26, 40, 54, 68, 82].map((x, i) => (
        <Bulb key={i} x={x} y={5} delay={i * 0.18} />
      ))}
      {/* grand star */}
      <g className="kids-anim" style={{ transformBox: "view-box", transformOrigin: "50px 16px", animation: "kids-pulse 1.4s ease-in-out infinite" } as CSSProperties}>
        <path
          d="M50 4 L54 13 L64 14 L56 21 L58 31 L50 25 L42 31 L44 21 L36 14 L46 13 Z"
          fill={GOLD}
          stroke={INK}
          strokeWidth={2}
          strokeLinejoin="round"
        />
      </g>
    </g>
  );
}

/* ========================================================================== */
/*  Registry                                                                   */
/* ========================================================================== */

const STATIONS: Record<string, MapStationComponent[]> = {
  probability: [
    station(BouncyHouseArt),
    station(ArcadeArt),
    station(CarnivalTentArt),
    station(FerrisWheelArt),
    station(RollercoasterArt),
  ],
  "mental-math": [
    station(BalloonStandArt),
    station(CalculatorKioskArt),
    station(AbacusRideArt),
    station(TimerBoothArt),
  ],
  brainteasers: [
    station(MazeTentArt),
    station(JigsawHutArt),
    station(IdeaLabArt),
  ],
  "interview-games": [
    station(MarketStallArt),
    station(TradingPostArt),
    station(AuctionBoothArt),
    station(PokerTentArt),
    station(GrandStageArt),
  ],
};

export function getKidsStation(
  ctx: LevelIllustrationContext,
): MapStationComponent | null {
  const arr = STATIONS[ctx.trackId];
  if (!arr) return null;
  return arr[ctx.levelIndex] ?? null;
}
