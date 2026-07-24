import type { ReactNode } from "react";
import type {
  LevelIllustrationContext,
  MapStationComponent,
  MapStationState,
} from "../types";
import { SUIT_PATH, type Suit } from "./suits";

/**
 * Casino Felt — MAP STATIONS.
 *
 * Each level node on the progression map is decorated as a distinct card-room
 * landmark, rendered as a 116×116 layer CENTERED BEHIND the 68×68 node button.
 * Because the opaque button sits on top (holding the level number / lock /
 * check), every landmark is composed so its identifying detail lives in the
 * ~24px ring AROUND the node (top / sides / bottom / corners) and frames the
 * number rather than covering it.
 *
 * All color comes from theme tokens (gold trim, felt surface, cream/ink,
 * card-red) so it adapts to light + dark. Art is dimmed when `locked` and gains
 * a gold sparkle flourish when `mastered`. Pure static inline SVG — no motion,
 * so it's trivially reduced-motion-safe and 60fps. Layer is aria-hidden and
 * pointer-events-none (applied by the host in TrackPage).
 */

/* -------------------------------------------------------------------------- */
/*  Palette + shared primitives                                               */
/* -------------------------------------------------------------------------- */

interface Pal {
  locked: boolean;
  mastered: boolean;
  gold: string;
  accent: string;
  ink: string;
  red: string;
  green: string;
  felt: string;
  feltRaised: string;
}

function pal(state?: MapStationState): Pal {
  const locked = state === "locked";
  const mastered = state === "mastered";
  // When locked, collapse the palette to a single muted metal so the landmark
  // reads as a dormant/greyed monument. Otherwise use full card-room color.
  const dim = "rgb(var(--color-border-strong))";
  return {
    locked,
    mastered,
    gold: locked ? dim : "rgb(var(--color-gold))",
    accent: locked ? dim : "rgb(var(--color-accent))",
    ink: locked ? dim : "rgb(var(--color-text-primary))",
    red: locked ? dim : "rgb(var(--color-bear))",
    green: locked ? dim : "rgb(var(--color-bull))",
    felt: "rgb(var(--color-surface))",
    feltRaised: "rgb(var(--color-surface-raised))",
  };
}

/** Standard sizing box + state-driven opacity + mastered flourish. */
function Station({
  className,
  state,
  children,
}: {
  className?: string;
  state?: MapStationState;
  children: (p: Pal) => ReactNode;
}) {
  const p = pal(state);
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <g opacity={p.locked ? 0.42 : 0.95}>{children(p)}</g>
      {p.mastered && <Flourish />}
    </svg>
  );
}

function makeStation(
  draw: (p: Pal) => ReactNode,
): MapStationComponent {
  return function CasinoStation({ className, state }) {
    return (
      <Station className={className} state={state}>
        {draw}
      </Station>
    );
  };
}

/** Four-point gold sparkle. */
function Sparkle({ x, y, s }: { x: number; y: number; s: number }) {
  const t = s * 0.3;
  return (
    <path
      d={`M${x} ${y - s} L${x + t} ${y - t} L${x + s} ${y} L${x + t} ${y + t} L${x} ${y + s} L${x - t} ${y + t} L${x - s} ${y} L${x - t} ${y - t} Z`}
      fill="rgb(var(--color-gold))"
    />
  );
}

/** Gold sparkle flourish shown on mastered nodes. */
function Flourish() {
  return (
    <g>
      <Sparkle x={15} y={15} s={5.5} />
      <Sparkle x={85} y={16} s={4} />
      <Sparkle x={14} y={85} s={4} />
      <Sparkle x={86} y={85} s={5.5} />
    </g>
  );
}

/** A gold "picture frame" hugging the node — the shared plaque for landmarks. */
function frame(p: Pal, inset = 15, r = 8) {
  const s = 100 - inset * 2;
  return (
    <>
      <rect
        x={inset}
        y={inset}
        width={s}
        height={s}
        rx={r}
        fill={p.felt}
        stroke={p.gold}
        strokeWidth={2.2}
      />
      <rect
        x={inset + 3}
        y={inset + 3}
        width={s - 6}
        height={s - 6}
        rx={Math.max(2, r - 3)}
        fill="none"
        stroke={p.gold}
        strokeWidth={0.8}
        opacity={0.7}
      />
    </>
  );
}

/** A poker chip. */
function chip(cx: number, cy: number, r: number, fill: string, p: Pal, key?: number) {
  const spots: ReactNode[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.25;
    const sx = cx + Math.cos(a) * r * 0.82;
    const sy = cy + Math.sin(a) * r * 0.82;
    spots.push(
      <rect
        key={i}
        x={sx - r * 0.11}
        y={sy - r * 0.2}
        width={r * 0.22}
        height={r * 0.4}
        rx={r * 0.06}
        fill={p.gold}
        transform={`rotate(${(a * 180) / Math.PI + 90} ${sx} ${sy})`}
      />,
    );
  }
  return (
    <g key={key}>
      <circle cx={cx} cy={cy} r={r} fill={fill} stroke={p.gold} strokeWidth={1.6} />
      {spots}
      <circle
        cx={cx}
        cy={cy}
        r={r * 0.52}
        fill="none"
        stroke={p.gold}
        strokeWidth={1.1}
        strokeDasharray="2 2"
      />
    </g>
  );
}

const PIPS: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [
    [-0.5, -0.5],
    [0.5, 0.5],
  ],
  3: [
    [-0.55, -0.55],
    [0, 0],
    [0.55, 0.55],
  ],
  4: [
    [-0.5, -0.5],
    [0.5, -0.5],
    [-0.5, 0.5],
    [0.5, 0.5],
  ],
  5: [
    [-0.55, -0.55],
    [0.55, -0.55],
    [0, 0],
    [-0.55, 0.55],
    [0.55, 0.55],
  ],
  6: [
    [-0.5, -0.6],
    [0.5, -0.6],
    [-0.5, 0],
    [0.5, 0],
    [-0.5, 0.6],
    [0.5, 0.6],
  ],
};

/** A die face with pips. */
function die(cx: number, cy: number, size: number, rot: number, value: number, p: Pal) {
  const h = size / 2;
  return (
    <g transform={`translate(${cx} ${cy}) rotate(${rot})`}>
      <rect
        x={-h}
        y={-h}
        width={size}
        height={size}
        rx={size * 0.2}
        fill={p.feltRaised}
        stroke={p.gold}
        strokeWidth={2}
      />
      {(PIPS[value] ?? PIPS[6]).map(([ux, uy], i) => (
        <circle key={i} cx={ux * h} cy={uy * h} r={size * 0.1} fill={p.red} />
      ))}
    </g>
  );
}

/** A playing card (rounded rect) with a gold hairline + suit pip. */
function card(
  cx: number,
  cy: number,
  w: number,
  hh: number,
  rot: number,
  suit: Suit,
  p: Pal,
  key?: number,
) {
  const red = suit === "heart" || suit === "diamond";
  const ink = red ? p.red : p.ink;
  return (
    <g key={key} transform={`translate(${cx} ${cy}) rotate(${rot})`}>
      <rect
        x={-w / 2}
        y={-hh / 2}
        width={w}
        height={hh}
        rx={w * 0.16}
        fill={p.feltRaised}
        stroke={p.gold}
        strokeWidth={1.6}
      />
      <path
        d={SUIT_PATH[suit]}
        fill={ink}
        transform={`translate(${-w / 2 + 1.5} ${-hh / 2 + 2}) scale(${w / 48})`}
      />
    </g>
  );
}

/** A face-down card back (gold lattice). */
function cardBack(
  cx: number,
  cy: number,
  w: number,
  hh: number,
  rot: number,
  p: Pal,
  key?: number,
) {
  return (
    <g key={key} transform={`translate(${cx} ${cy}) rotate(${rot})`}>
      <rect
        x={-w / 2}
        y={-hh / 2}
        width={w}
        height={hh}
        rx={w * 0.16}
        fill={p.accent}
        stroke={p.gold}
        strokeWidth={1.6}
      />
      <rect
        x={-w / 2 + 2.2}
        y={-hh / 2 + 2.2}
        width={w - 4.4}
        height={hh - 4.4}
        rx={w * 0.1}
        fill="none"
        stroke={p.gold}
        strokeWidth={0.8}
      />
      <line x1={-w / 2 + 2} y1={0} x2={w / 2 - 2} y2={0} stroke={p.gold} strokeWidth={0.6} />
      <line x1={0} y1={-hh / 2 + 2} x2={0} y2={hh / 2 - 2} stroke={p.gold} strokeWidth={0.6} />
    </g>
  );
}

/** Annular sector path (for wheels/dials). */
function sector(
  cx: number,
  cy: number,
  r0: number,
  r1: number,
  a0: number,
  a1: number,
): string {
  const x0 = cx + Math.cos(a0) * r1;
  const y0 = cy + Math.sin(a0) * r1;
  const x1 = cx + Math.cos(a1) * r1;
  const y1 = cy + Math.sin(a1) * r1;
  const x2 = cx + Math.cos(a1) * r0;
  const y2 = cy + Math.sin(a1) * r0;
  const x3 = cx + Math.cos(a0) * r0;
  const y3 = cy + Math.sin(a0) * r0;
  return `M${x0} ${y0} A${r1} ${r1} 0 0 1 ${x1} ${y1} L${x2} ${y2} A${r0} ${r0} 0 0 0 ${x3} ${y3} Z`;
}

/* -------------------------------------------------------------------------- */
/*  PROBABILITY — pr-1 … pr-5                                                  */
/* -------------------------------------------------------------------------- */

// pr-1: a pair of dice tumbling in the corners.
const PrDice = makeStation((p) => (
  <>
    {frame(p)}
    {die(23, 77, 26, -14, 5, p)}
    {die(78, 24, 23, 12, 2, p)}
  </>
));

// pr-2: a flipping gold coin (with motion arcs) and a landed coin.
const PrCoin = makeStation((p) => (
  <>
    {frame(p)}
    {/* flip arcs */}
    <path
      d="M30 34 Q50 6 70 34"
      fill="none"
      stroke={p.gold}
      strokeWidth={1.4}
      strokeDasharray="3 3"
      opacity={0.8}
    />
    <path d="M70 34 l-1.5 -5 l5 1.5 Z" fill={p.gold} />
    {/* airborne coin (top) */}
    <g transform="translate(50 16)">
      <circle r={13} fill={p.feltRaised} stroke={p.gold} strokeWidth={2.4} />
      <circle r={9} fill="none" stroke={p.gold} strokeWidth={1} />
      <text
        x={0}
        y={4.5}
        textAnchor="middle"
        fontFamily="var(--font-display)"
        fontSize={12}
        fontWeight={700}
        fill={p.gold}
      >
        $
      </text>
    </g>
    {/* landed coin (bottom, edge highlight) */}
    <g transform="translate(50 84)">
      <ellipse rx={13} ry={5} fill={p.feltRaised} stroke={p.gold} strokeWidth={2} />
      <ellipse cx={0} cy={-1.5} rx={13} ry={5} fill="none" stroke={p.gold} strokeWidth={0.8} />
    </g>
  </>
));

// pr-3: a roulette wheel — a full ring of red/black pockets around the node.
const PrRoulette = makeStation((p) => {
  const n = 22;
  const wedges: ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = ((i + 1) / n) * Math.PI * 2;
    wedges.push(
      <path
        key={i}
        d={sector(50, 50, 34, 47, a0, a1)}
        fill={i % 2 === 0 ? p.red : p.ink}
        stroke={p.gold}
        strokeWidth={0.5}
      />,
    );
  }
  return (
    <>
      <circle cx={50} cy={50} r={47.5} fill="none" stroke={p.gold} strokeWidth={2.2} />
      {wedges}
      <circle cx={50} cy={50} r={33.5} fill="none" stroke={p.gold} strokeWidth={1.6} />
      {/* top pointer + ball */}
      <path d="M50 1 l5 8 l-10 0 Z" fill={p.gold} />
      <circle cx={50} cy={40.5} r={2.6} fill={p.feltRaised} stroke={p.gold} strokeWidth={1} />
    </>
  );
});

// pr-4: a fan of playing cards spreading up from behind the node.
const PrCardFan = makeStation((p) => {
  const suits: Suit[] = ["spade", "heart", "club", "diamond", "spade"];
  const cards: ReactNode[] = [];
  const pivotY = 86;
  for (let i = 0; i < 5; i++) {
    const rot = (i - 2) * 26;
    const rad = (rot * Math.PI) / 180;
    const dist = 40;
    const cx = 50 + Math.sin(rad) * dist;
    const cy = pivotY - Math.cos(rad) * dist;
    cards.push(card(cx, cy, 20, 30, rot, suits[i], p, i));
  }
  return <>{cards}</>;
});

// pr-5: a probability "urn" / drawstring bag spilling chips.
const PrUrn = makeStation((p) => (
  <>
    {/* bag body */}
    <path
      d="M24 40 Q18 74 30 88 Q50 98 70 88 Q82 74 76 40 Q68 34 50 34 Q32 34 24 40 Z"
      fill={p.felt}
      stroke={p.gold}
      strokeWidth={2.2}
    />
    {/* tied neck */}
    <path
      d="M38 40 Q50 30 62 40"
      fill="none"
      stroke={p.gold}
      strokeWidth={2}
    />
    <rect x={40} y={22} width={20} height={9} rx={3} fill={p.feltRaised} stroke={p.gold} strokeWidth={1.6} />
    <path d="M42 22 Q50 12 58 22" fill="none" stroke={p.gold} strokeWidth={1.4} />
    {/* spilling chips */}
    {chip(21, 84, 8, p.red, p, 1)}
    {chip(80, 86, 7.5, p.accent, p, 2)}
  </>
));

/* -------------------------------------------------------------------------- */
/*  MENTAL MATH — mm-1 … mm-4                                                  */
/* -------------------------------------------------------------------------- */

/** A stack of chip discs (side view) rising from a base. */
function chipStack(cx: number, baseY: number, count: number, tone: string, p: Pal) {
  const rows: ReactNode[] = [];
  const step = 6.5;
  for (let i = 0; i < count; i++) {
    const y = baseY - i * step;
    rows.push(
      <ellipse
        key={i}
        cx={cx}
        cy={y}
        rx={11}
        ry={4}
        fill={i === count - 1 ? p.accent : tone}
        stroke={p.gold}
        strokeWidth={1.2}
      />,
    );
  }
  return <g>{rows}</g>;
}

// mm-1: chip stacks being counted (tall stacks flanking the node).
const MmChips = makeStation((p) => (
  <>
    <line x1={8} y1={92} x2={92} y2={92} stroke={p.gold} strokeWidth={1.6} />
    {chipStack(15, 90, 6, p.red, p)}
    {chipStack(85, 90, 5, p.ink, p)}
    {chipStack(50, 90, 4, p.red, p)}
  </>
));

// mm-2: a card-counting table — a dealer arc, a card shoe, and a count marker.
const MmCountTable = makeStation((p) => (
  <>
    {/* felt table arc across the bottom */}
    <path d="M6 96 Q50 58 94 96" fill={p.felt} stroke={p.gold} strokeWidth={2.2} />
    <path d="M12 96 Q50 66 88 96" fill="none" stroke={p.gold} strokeWidth={0.8} opacity={0.7} />
    {/* betting circles on the rail */}
    <circle cx={24} cy={86} r={4.5} fill="none" stroke={p.gold} strokeWidth={1.2} />
    <circle cx={50} cy={80} r={4.5} fill="none" stroke={p.gold} strokeWidth={1.2} />
    <circle cx={76} cy={86} r={4.5} fill="none" stroke={p.gold} strokeWidth={1.2} />
    {/* card shoe dealing a card (top-right) */}
    <g transform="translate(76 20) rotate(10)">
      <rect x={-12} y={-8} width={24} height={16} rx={2.5} fill={p.feltRaised} stroke={p.gold} strokeWidth={1.6} />
      <rect x={-6} y={-14} width={14} height={9} rx={1.5} fill={p.felt} stroke={p.gold} strokeWidth={1.2} />
    </g>
    {/* running-count marker (top-left) */}
    <g transform="translate(20 20)">
      <circle r={9} fill={p.feltRaised} stroke={p.gold} strokeWidth={1.6} />
      <text x={0} y={4} textAnchor="middle" fontFamily="var(--font-display)" fontSize={11} fontWeight={700} fill={p.green}>
        +
      </text>
    </g>
  </>
));

// mm-3: a cashier cage — a barred, arched teller window over a coin ledge.
const MmCage = makeStation((p) => {
  const bars: ReactNode[] = [];
  for (let x = 26; x <= 74; x += 8) {
    bars.push(
      <line key={x} x1={x} y1={18} x2={x} y2={30} stroke={p.gold} strokeWidth={1.6} />,
    );
  }
  return (
    <>
      {frame(p, 14, 6)}
      {/* arched cage top */}
      <path d="M20 30 L20 20 Q50 4 80 20 L80 30" fill="none" stroke={p.gold} strokeWidth={2.4} />
      {bars}
      <line x1={22} y1={18} x2={78} y2={18} stroke={p.gold} strokeWidth={1.6} />
      {/* teller ledge + coins */}
      <rect x={30} y={80} width={40} height={7} rx={2} fill={p.feltRaised} stroke={p.gold} strokeWidth={1.6} />
      <circle cx={40} cy={80} r={4} fill={p.accent} stroke={p.gold} strokeWidth={1} />
      <circle cx={50} cy={80} r={4} fill={p.accent} stroke={p.gold} strokeWidth={1} />
      <circle cx={60} cy={80} r={4} fill={p.accent} stroke={p.gold} strokeWidth={1} />
    </>
  );
});

// mm-4: a speed-deal timer — a stopwatch ring with ticks + fast-dealt cards.
const MmTimer = makeStation((p) => {
  const ticks: ReactNode[] = [];
  const n = 12;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const r1 = 46;
    const r0 = i % 3 === 0 ? 40 : 43;
    ticks.push(
      <line
        key={i}
        x1={50 + Math.cos(a) * r0}
        y1={50 + Math.sin(a) * r0}
        x2={50 + Math.cos(a) * r1}
        y2={50 + Math.sin(a) * r1}
        stroke={p.gold}
        strokeWidth={i % 3 === 0 ? 2 : 1}
      />,
    );
  }
  return (
    <>
      <circle cx={50} cy={50} r={47} fill="none" stroke={p.gold} strokeWidth={2.2} />
      {ticks}
      {/* stopwatch crown + button */}
      <rect x={46} y={0.5} width={8} height={6} rx={1.5} fill={p.feltRaised} stroke={p.gold} strokeWidth={1.4} />
      <line x1={50} y1={6} x2={50} y2={9} stroke={p.gold} strokeWidth={2} />
      {/* speed-dealt cards flying bottom-right */}
      {cardBack(78, 82, 15, 21, 24, p, 1)}
      <line x1={58} y1={92} x2={70} y2={86} stroke={p.gold} strokeWidth={1.2} opacity={0.8} />
      <line x1={56} y1={86} x2={66} y2={81} stroke={p.gold} strokeWidth={1} opacity={0.6} />
    </>
  );
});

/* -------------------------------------------------------------------------- */
/*  BRAINTEASERS — bt-1 … bt-3                                                 */
/* -------------------------------------------------------------------------- */

// bt-1: three-card monte / shell game — three face-down cards + shuffle arrows.
const BtMonte = makeStation((p) => (
  <>
    {/* question mark above */}
    <text x={50} y={16} textAnchor="middle" fontFamily="var(--font-display)" fontSize={16} fontWeight={700} fill={p.gold}>
      ?
    </text>
    {/* swap arrows */}
    <path d="M30 70 Q50 58 70 70" fill="none" stroke={p.gold} strokeWidth={1.4} strokeDasharray="3 3" />
    <path d="M70 70 l-1.5 -5 l5 1.5 Z" fill={p.gold} />
    {/* three cards at the bottom */}
    {cardBack(24, 80, 18, 26, -8, p, 1)}
    {cardBack(50, 84, 18, 26, 0, p, 2)}
    {cardBack(76, 80, 18, 26, 8, p, 3)}
  </>
));

// bt-2: an ornate puzzle box with interlocking gold key-fret corners + keyhole.
const BtPuzzle = makeStation((p) => {
  const key = (x: number, y: number, rot: number, i: number) => (
    <path
      key={i}
      d="M0 0 h10 v3 h-7 v4 h4 v3 h-7 v-3 h-4 Z"
      fill="none"
      stroke={p.gold}
      strokeWidth={1.4}
      transform={`translate(${x} ${y}) rotate(${rot})`}
    />
  );
  return (
    <>
      {frame(p, 14, 4)}
      {key(18, 18, 0, 1)}
      {key(86, 18, 90, 2)}
      {key(86, 86, 180, 3)}
      {key(18, 86, 270, 4)}
      {/* keyhole plate top-center */}
      <circle cx={50} cy={22} r={5} fill={p.feltRaised} stroke={p.gold} strokeWidth={1.6} />
      <circle cx={50} cy={21} r={1.6} fill={p.gold} />
      <rect x={49} y={21} width={2} height={4} fill={p.gold} />
    </>
  );
});

// bt-3: a locked vault door — bolts around the rim, a combination dial, hinges.
const BtVault = makeStation((p) => {
  const bolts: ReactNode[] = [];
  const n = 12;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    bolts.push(
      <circle
        key={i}
        cx={50 + Math.cos(a) * 39}
        cy={50 + Math.sin(a) * 39}
        r={2.2}
        fill={p.gold}
      />,
    );
  }
  const dial: ReactNode[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    dial.push(
      <line
        key={i}
        x1={50 + Math.cos(a) * 5}
        y1={14 + Math.sin(a) * 5}
        x2={50 + Math.cos(a) * 8}
        y2={14 + Math.sin(a) * 8}
        stroke={p.gold}
        strokeWidth={1}
      />,
    );
  }
  return (
    <>
      <circle cx={50} cy={50} r={45} fill="none" stroke={p.gold} strokeWidth={2.4} />
      <circle cx={50} cy={50} r={39} fill="none" stroke={p.gold} strokeWidth={1} opacity={0.7} />
      {bolts}
      {/* hinges on the left edge */}
      <rect x={2} y={34} width={7} height={9} rx={1.5} fill={p.feltRaised} stroke={p.gold} strokeWidth={1.4} />
      <rect x={2} y={57} width={7} height={9} rx={1.5} fill={p.feltRaised} stroke={p.gold} strokeWidth={1.4} />
      {/* combination dial at top */}
      <circle cx={50} cy={14} r={9} fill={p.feltRaised} stroke={p.gold} strokeWidth={1.8} />
      {dial}
      <line x1={50} y1={14} x2={50} y2={7} stroke={p.gold} strokeWidth={1.6} />
    </>
  );
});

/* -------------------------------------------------------------------------- */
/*  INTERVIEW GAMES — ig-1 … ig-5                                              */
/* -------------------------------------------------------------------------- */

// ig-1: a poker table — an oval felt with community-card slots + dealer button.
const IgPoker = makeStation((p) => (
  <>
    <ellipse cx={50} cy={50} rx={47} ry={40} fill={p.felt} stroke={p.gold} strokeWidth={2.4} />
    <ellipse cx={50} cy={50} rx={42} ry={35} fill="none" stroke={p.gold} strokeWidth={0.8} opacity={0.6} />
    {/* community-card slots across the top arc */}
    {[34, 42, 50, 58, 66].map((x, i) => (
      <rect key={i} x={x - 3} y={13} width={6} height={9} rx={1.2} fill="none" stroke={p.gold} strokeWidth={1.1} />
    ))}
    {/* dealer button (bottom) */}
    <circle cx={50} cy={86} r={6} fill={p.feltRaised} stroke={p.gold} strokeWidth={1.6} />
    <text x={50} y={89.5} textAnchor="middle" fontFamily="var(--font-display)" fontSize={8} fontWeight={700} fill={p.gold}>
      D
    </text>
  </>
));

// ig-2: a bid/ask trading pit — up (bid) & down (ask) arrows flanking a rail.
const IgPit = makeStation((p) => (
  <>
    {/* pit rail */}
    <path d="M6 90 Q50 78 94 90" fill="none" stroke={p.gold} strokeWidth={2.2} />
    {/* BID — green up arrow, left */}
    <g transform="translate(13 46)">
      <path d="M0 -14 L9 2 L3 2 L3 14 L-3 14 L-3 2 L-9 2 Z" fill={p.green} stroke={p.gold} strokeWidth={1.2} />
    </g>
    <text x={13} y={72} textAnchor="middle" fontFamily="var(--font-display)" fontSize={9} fontWeight={700} fill={p.green}>
      BID
    </text>
    {/* ASK — red down arrow, right */}
    <g transform="translate(87 44)">
      <path d="M0 14 L9 -2 L3 -2 L3 -14 L-3 -14 L-3 -2 L-9 -2 Z" fill={p.red} stroke={p.gold} strokeWidth={1.2} />
    </g>
    <text x={87} y={72} textAnchor="middle" fontFamily="var(--font-display)" fontSize={9} fontWeight={700} fill={p.red}>
      ASK
    </text>
    {/* spread bracket at top */}
    <path d="M24 14 H76" fill="none" stroke={p.gold} strokeWidth={1.2} />
    <path d="M24 11 V17 M76 11 V17" stroke={p.gold} strokeWidth={1.2} />
  </>
));

// ig-3: an auction podium — a lectern, a raised paddle, and a gavel.
const IgAuction = makeStation((p) => (
  <>
    {/* podium / lectern at the bottom */}
    <path d="M34 96 L38 74 L62 74 L66 96 Z" fill={p.felt} stroke={p.gold} strokeWidth={2} />
    <rect x={36} y={70} width={28} height={6} rx={1.5} fill={p.feltRaised} stroke={p.gold} strokeWidth={1.6} />
    {/* auction paddle, top-left */}
    <g transform="translate(18 26) rotate(-18)">
      <rect x={-8} y={-12} width={16} height={14} rx={2} fill={p.feltRaised} stroke={p.gold} strokeWidth={1.6} />
      <text x={0} y={-2} textAnchor="middle" fontFamily="var(--font-display)" fontSize={9} fontWeight={700} fill={p.ink}>
        7
      </text>
      <rect x={-1.5} y={2} width={3} height={12} rx={1} fill={p.gold} />
    </g>
    {/* gavel, top-right */}
    <g transform="translate(80 24) rotate(28)">
      <rect x={-9} y={-5} width={18} height={10} rx={2.5} fill={p.feltRaised} stroke={p.gold} strokeWidth={1.6} />
      <rect x={-1.6} y={5} width={3.2} height={16} rx={1.5} fill={p.gold} />
    </g>
    <line x1={70} y1={40} x2={84} y2={40} stroke={p.gold} strokeWidth={2} />
  </>
));

// ig-4: a high-roller VIP booth — velvet-rope stanchions + a VIP plaque.
const IgBooth = makeStation((p) => (
  <>
    {/* stanchion posts */}
    <line x1={14} y1={44} x2={14} y2={90} stroke={p.gold} strokeWidth={3} />
    <line x1={86} y1={44} x2={86} y2={90} stroke={p.gold} strokeWidth={3} />
    <circle cx={14} cy={40} r={4.5} fill={p.gold} />
    <circle cx={86} cy={40} r={4.5} fill={p.gold} />
    <ellipse cx={14} cy={91} rx={7} ry={2.5} fill={p.gold} opacity={0.8} />
    <ellipse cx={86} cy={91} rx={7} ry={2.5} fill={p.gold} opacity={0.8} />
    {/* draped velvet rope swag over the top */}
    <path d="M14 42 Q50 74 86 42" fill="none" stroke={p.red} strokeWidth={3.2} />
    <path d="M14 42 Q50 74 86 42" fill="none" stroke={p.gold} strokeWidth={0.9} opacity={0.7} />
    {/* VIP plaque */}
    <rect x={35} y={8} width={30} height={13} rx={3} fill={p.feltRaised} stroke={p.gold} strokeWidth={1.8} />
    <text x={50} y={18} textAnchor="middle" fontFamily="var(--font-display)" fontSize={9} fontWeight={700} fill={p.gold} letterSpacing="1">
      VIP
    </text>
  </>
));

// ig-5: the grand jackpot — a laurel-wreathed trophy with a star + spilling coins.
const IgJackpot = makeStation((p) => (
  <>
    {/* star / crown at the very top */}
    <Sparkle x={50} y={10} s={7} />
    {/* laurel branches arcing up the sides */}
    <path d="M22 84 Q6 56 20 30" fill="none" stroke={p.green} strokeWidth={2} />
    <path d="M78 84 Q94 56 80 30" fill="none" stroke={p.green} strokeWidth={2} />
    {[38, 52, 66].map((y, i) => (
      <g key={i}>
        <ellipse cx={13} cy={y} rx={4} ry={2} fill={p.green} transform={`rotate(-40 13 ${y})`} />
        <ellipse cx={87} cy={y} rx={4} ry={2} fill={p.green} transform={`rotate(40 87 ${y})`} />
      </g>
    ))}
    {/* trophy handles */}
    <path d="M26 40 Q14 44 22 58" fill="none" stroke={p.gold} strokeWidth={2.4} />
    <path d="M74 40 Q86 44 78 58" fill="none" stroke={p.gold} strokeWidth={2.4} />
    {/* trophy stem + base */}
    <rect x={45} y={80} width={10} height={7} fill={p.feltRaised} stroke={p.gold} strokeWidth={1.4} />
    <path d="M34 96 L38 87 L62 87 L66 96 Z" fill={p.feltRaised} stroke={p.gold} strokeWidth={1.8} />
    {/* spilling coins at the base */}
    <circle cx={26} cy={90} r={5} fill={p.accent} stroke={p.gold} strokeWidth={1.2} />
    <circle cx={74} cy={90} r={5} fill={p.accent} stroke={p.gold} strokeWidth={1.2} />
    <circle cx={20} cy={94} r={4} fill={p.accent} stroke={p.gold} strokeWidth={1} />
  </>
));

/* -------------------------------------------------------------------------- */
/*  Registry + resolver                                                       */
/* -------------------------------------------------------------------------- */

const FAMILIES: Record<string, MapStationComponent[]> = {
  probability: [PrDice, PrCoin, PrRoulette, PrCardFan, PrUrn],
  "mental-math": [MmChips, MmCountTable, MmCage, MmTimer],
  brainteasers: [BtMonte, BtPuzzle, BtVault],
  "interview-games": [IgPoker, IgPit, IgAuction, IgBooth, IgJackpot],
};

export function getCasinoStation(
  ctx: LevelIllustrationContext,
): MapStationComponent | null {
  const family = FAMILIES[ctx.trackId];
  if (!family || family.length === 0) return null; // e.g. calibration-gym → plain node
  const i = ((ctx.levelIndex % family.length) + family.length) % family.length;
  return family[i];
}
