import type { ReactNode } from "react";
import type {
  LevelIllustrationContext,
  MapStationComponent,
  MapStationState,
} from "../types";

/**
 * Cyberpunk MAP STATIONS — each level node is a distinct NEON STOREFRONT on the
 * back-alley, rendered as a 116×116 (viewBox 100) layer CENTERED BEHIND the
 * 68×68 node button. The opaque button sits on top (number / lock / check), so
 * every storefront is composed with its identity in the ring AROUND the node: a
 * hanging SIGNBOARD across the top strip (the shop's neon sign), flanking props
 * in the side/bottom strips, and a neon PLAQUE FRAME (corner brackets) that
 * frames the number like a lit shop sign. A mono "address" code sits at the
 * bottom; mastered nodes light an "OPEN" badge; locked shops go dark + shuttered.
 *
 * Stations differ per LEVEL (a per-track family cycled by `levelIndex`) AND per
 * TRACK — probability = gambling dens (arcade / pachinko / fortune / dice den /
 * coin booth), mental-math = number shops (calc-house / ramen bar / FX booth /
 * clock shop), brainteasers = puzzle dens (locksmith / maze arcade / tile
 * parlor), interview-games = night-market trade bars (ticker terminal / big
 * board / izakaya / server bar / champion podium) — so probability L1 ≠
 * mental-math L1.
 *
 * All color flows through theme tokens (neon cyan / magenta / green on the
 * blue-black night, deep ink on the dusk variant). Art dims + shutters when
 * `locked`. Static inline SVG (a few gentle flickers/pulses carry `cp-anim`) —
 * reduced-motion-safe. Layer is aria-hidden + pointer-events-none (host-applied).
 */

/* -------------------------------------------------------------------------- */
/*  Palette + shared storefront shell                                          */
/* -------------------------------------------------------------------------- */

interface Pal {
  locked: boolean;
  mastered: boolean;
  cyan: string;
  magenta: string;
  green: string;
  gold: string;
  ink: string;
  surface: string;
  raised: string;
}

function pal(state?: MapStationState): Pal {
  const locked = state === "locked";
  const dim = "rgb(var(--color-text-muted))";
  return {
    locked,
    mastered: state === "mastered",
    cyan: locked ? dim : "rgb(var(--color-accent))",
    magenta: locked ? dim : "rgb(var(--color-accent-2))",
    green: locked ? dim : "rgb(var(--color-bull))",
    gold: locked ? dim : "rgb(var(--color-gold))",
    ink: locked ? dim : "rgb(var(--color-border-strong))",
    surface: "rgb(var(--color-surface))",
    raised: "rgb(var(--color-surface-raised))",
  };
}

/** Neon "OPEN" badge shown on mastered nodes (bottom strip, clear of the number). */
function OpenBadge({ p }: { p: Pal }) {
  return (
    <g className="cp-anim cp-flicker">
      <rect x={34} y={82} width={32} height={13} rx={2.5} fill="rgb(var(--color-bg))" stroke={p.green} strokeWidth={1.4} />
      <text x={50} y={91.5} textAnchor="middle" fontSize={7} fontFamily="'Share Tech Mono', monospace" letterSpacing={0.6} fill={p.green}>
        OPEN
      </text>
    </g>
  );
}

/** Shuttered / dark affordance for a locked shop (a rolled-down grille). */
function Shutter({ p }: { p: Pal }) {
  return (
    <g stroke={p.ink} strokeOpacity={0.5} strokeWidth={0.7}>
      {[84, 87, 90, 93].map((y, i) => (
        <line key={i} x1={30} y1={y} x2={70} y2={y} />
      ))}
    </g>
  );
}

/**
 * Shared storefront shell: a plaque frame (corner brackets) around the number, a
 * hanging signboard backing across the top strip, an "address" code, and the
 * mastered/locked affordances. Each station draws its own sign + props via
 * `children`, using the peripheral strips (the centre is under the node button).
 */
function Shell({
  className,
  state,
  code,
  accent,
  children,
}: {
  className?: string;
  state?: MapStationState;
  code: string;
  accent: string;
  children: (p: Pal) => ReactNode;
}) {
  const p = pal(state);
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" aria-hidden="true" style={{ opacity: p.locked ? 0.5 : 1 }}>
      {/* neon plaque frame — corner brackets that light the node like a sign */}
      <g stroke={accent} strokeWidth={1.5} strokeLinecap="round" opacity={0.8}>
        <path d="M4 18 V4 H18" />
        <path d="M82 4 H96 V18" />
        <path d="M4 82 V96 H18" />
        <path d="M82 96 H96 V82" />
      </g>
      {/* hanging wires + signboard backing across the top strip */}
      <line x1={32} y1={0} x2={32} y2={4} stroke={accent} strokeOpacity={0.6} strokeWidth={1} />
      <line x1={68} y1={0} x2={68} y2={4} stroke={accent} strokeOpacity={0.6} strokeWidth={1} />
      <rect x={15} y={3} width={70} height={20} rx={2.5} fill="rgb(var(--color-surface-raised))" fillOpacity={0.5} stroke={accent} strokeOpacity={0.5} strokeWidth={0.9} />
      <g opacity={p.locked ? 0.85 : 1}>{children(p)}</g>
      {/* shop "address" code */}
      <text x={50} y={99} textAnchor="middle" fontSize={6} fontFamily="'Share Tech Mono', monospace" letterSpacing={1.2} fill="rgb(var(--color-text-muted))">
        {code}
      </text>
      {p.locked && <Shutter p={p} />}
      {p.mastered && <OpenBadge p={p} />}
    </svg>
  );
}

function make(
  code: string,
  accentPick: (p: Pal) => string,
  draw: (p: Pal) => ReactNode,
): MapStationComponent {
  return function CyberStore({ className, state }) {
    const accent = accentPick(pal(state));
    return (
      <Shell className={className} state={state} code={code} accent={accent}>
        {draw}
      </Shell>
    );
  };
}

/** Small helper: draw a flickering neon "tube" line. */
function tube(d: string, stroke: string, w = 1.6, cls = "cp-anim cp-flicker") {
  return <path d={d} fill="none" stroke={stroke} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" className={cls} />;
}

/* ========================================================================== */
/*  PROBABILITY — gambling / arcade dens                                       */
/* ========================================================================== */

// pr-1 · neon ARCADE — a marquee with a joystick sign.
const PrArcade = make("ARCADE-01", (p) => p.cyan, (p) => (
  <>
    {tube("M26 13 H74", p.magenta, 2)}
    <circle cx={34} cy={13} r={3} fill="none" stroke={p.cyan} strokeWidth={1.4} className="cp-anim cp-flicker" />
    <rect x={44} y={9} width={7} height={7} rx={1} fill={p.gold} fillOpacity={0.5} stroke={p.gold} strokeWidth={1} />
    <rect x={56} y={9} width={7} height={7} rx={1} fill={p.cyan} fillOpacity={0.4} stroke={p.cyan} strokeWidth={1} />
    {/* side arcade cabinet glow */}
    <rect x={2} y={40} width={12} height={30} rx={1.5} fill={p.cyan} fillOpacity={0.12} stroke={p.cyan} strokeWidth={1} />
    <rect x={86} y={40} width={12} height={30} rx={1.5} fill={p.magenta} fillOpacity={0.12} stroke={p.magenta} strokeWidth={1} />
  </>
));

// pr-2 · PACHINKO / slots parlor — three reels + falling ball.
const PrSlots = make("SLOTS-02", (p) => p.magenta, (p) => (
  <>
    {[30, 42, 54].map((x, i) => (
      <g key={i}>
        <rect x={x} y={7} width={9} height={12} rx={1.2} fill={p.raised} fillOpacity={0.5} stroke={p.cyan} strokeWidth={1} className="cp-anim cp-flickerB" />
        <line x1={x + 1.5} y1={13} x2={x + 7.5} y2={13} stroke={p.magenta} strokeWidth={1} />
      </g>
    ))}
    <rect x={64} y={9} width={8} height={8} rx={4} fill="none" stroke={p.gold} strokeWidth={1.2} />
    {/* pachinko pins on a side */}
    {[[6, 44], [12, 52], [6, 60], [12, 68]].map(([cx, cy], i) => (
      <circle key={i} cx={cx} cy={cy} r={1.3} fill={p.cyan} className="cp-anim cp-pulse" />
    ))}
    <circle cx={92} cy={50} r={2} fill={p.magenta} className="cp-anim cp-pulse" />
  </>
));

// pr-3 · FORTUNE den — a crystal ball / eye sign.
const PrFortune = make("FORTUNE-03", (p) => p.magenta, (p) => (
  <>
    <circle cx={50} cy={13} r={7} fill={p.magenta} fillOpacity={0.14} stroke={p.magenta} strokeWidth={1.4} className="cp-anim cp-glow" />
    <path d="M45 20 L55 20 L57 22 L43 22 Z" fill={p.gold} fillOpacity={0.4} stroke={p.gold} strokeWidth={0.8} />
    {/* radiating fortune stars in the corners */}
    {[[8, 46], [92, 46], [10, 68], [90, 70]].map(([cx, cy], i) => (
      <path key={i} d={`M${cx} ${cy - 3} L${cx + 1} ${cy} L${cx + 3} ${cy} L${cx + 1} ${cy + 1} L${cx} ${cy + 3} L${cx - 1} ${cy + 1} L${cx - 3} ${cy} L${cx - 1} ${cy} Z`} fill={p.cyan} fillOpacity={0.7} className="cp-anim cp-pulse" />
    ))}
  </>
));

// pr-4 · DICE den — a pair of glowing dice on the sign.
const PrDiceDen = make("DICE-04", (p) => p.cyan, (p) => {
  const die = (x: number, pips: [number, number][]) => (
    <g>
      <rect x={x} y={7} width={13} height={13} rx={2} fill={p.raised} fillOpacity={0.55} stroke={p.cyan} strokeWidth={1.3} />
      {pips.map(([px, py], i) => (
        <circle key={i} cx={x + 6.5 + px * 3.4} cy={13.5 + py * 3.4} r={1.1} fill={p.magenta} />
      ))}
    </g>
  );
  return (
    <>
      {die(34, [[-1, -1], [0, 0], [1, 1]])}
      {die(53, [[-1, -1], [1, -1], [-1, 1], [1, 1]])}
      {/* side neon chips */}
      <circle cx={8} cy={54} r={5} fill="none" stroke={p.gold} strokeWidth={1.2} strokeDasharray="2 2" />
      <circle cx={92} cy={58} r={5} fill="none" stroke={p.magenta} strokeWidth={1.2} strokeDasharray="2 2" />
    </>
  );
});

// pr-5 · COIN booth — a lucky-coin sign (abstract, no real currency).
const PrCoin = make("LUCK-05", (p) => p.gold, (p) => (
  <>
    <circle cx={50} cy={13} r={7.5} fill={p.gold} fillOpacity={0.16} stroke={p.gold} strokeWidth={1.5} className="cp-anim cp-glow" />
    <rect x={47} y={9.5} width={6} height={7} fill="none" stroke={p.gold} strokeWidth={1.2} />
    {/* coin-return chutes on the sides */}
    <rect x={3} y={48} width={10} height={16} rx={1.5} fill={p.gold} fillOpacity={0.1} stroke={p.gold} strokeWidth={1} />
    <rect x={87} y={48} width={10} height={16} rx={1.5} fill={p.cyan} fillOpacity={0.1} stroke={p.cyan} strokeWidth={1} />
    <circle cx={8} cy={72} r={1.6} fill={p.gold} className="cp-anim cp-pulse" />
  </>
));

/* ========================================================================== */
/*  MENTAL MATH — number shops                                                */
/* ========================================================================== */

// mm-1 · CALC house — a seven-segment digit sign.
const MmCalc = make("CALC-01", (p) => p.cyan, (p) => {
  const seg = (x: number) => (
    <g transform={`translate(${x} 0)`} stroke={p.cyan} strokeWidth={1.6} strokeLinecap="round">
      <line x1={0} y1={8} x2={6} y2={8} />
      <line x1={0} y1={13} x2={6} y2={13} opacity={0.4} />
      <line x1={0} y1={18} x2={6} y2={18} />
      <line x1={0} y1={8} x2={0} y2={13} />
      <line x1={6} y1={8} x2={6} y2={13} />
      <line x1={6} y1={13} x2={6} y2={18} />
    </g>
  );
  return (
    <>
      <g className="cp-anim cp-flicker">
        {seg(36)}
        {seg(48)}
        {seg(60)}
      </g>
      {/* keypad glow on a side */}
      <g fill={p.magenta} fillOpacity={0.6}>
        {[[6, 48], [12, 48], [6, 55], [12, 55], [6, 62], [12, 62]].map(([cx, cy], i) => (
          <rect key={i} x={cx - 2} y={cy - 2} width={4} height={4} rx={0.8} />
        ))}
      </g>
    </>
  );
});

// mm-2 · RAMEN bar — a steaming bowl sign.
const MmRamen = make("RAMEN-02", (p) => p.magenta, (p) => (
  <>
    <path d="M38 12 Q50 20 62 12 Z" fill={p.gold} fillOpacity={0.3} stroke={p.gold} strokeWidth={1.3} />
    <line x1={38} y1={12} x2={62} y2={12} stroke={p.magenta} strokeWidth={1.4} />
    {/* steam */}
    {tube("M44 10 Q42 6 45 4", p.cyan, 1.2, "cp-anim cp-glow")}
    {tube("M52 10 Q54 6 51 3", p.cyan, 1.2, "cp-anim cp-glow")}
    {/* hanging noodle-price lanterns on the sides */}
    <circle cx={8} cy={50} r={5} fill={p.magenta} fillOpacity={0.16} stroke={p.magenta} strokeWidth={1.2} className="cp-anim cp-buzz" />
    <circle cx={92} cy={54} r={5} fill={p.gold} fillOpacity={0.16} stroke={p.gold} strokeWidth={1.2} className="cp-anim cp-buzz" />
  </>
));

// mm-3 · FX booth — an exchange rate board (abstract up/down marks).
const MmExchange = make("EXCH-03", (p) => p.cyan, (p) => (
  <>
    {tube("M28 13 L36 13", p.green, 1.6)}
    <path d="M40 16 L43 9 L46 16 Z" fill={p.green} fillOpacity={0.7} />
    {tube("M52 13 L60 13", p.magenta, 1.6)}
    <path d="M64 9 L67 16 L70 9 Z" fill={p.magenta} fillOpacity={0.7} />
    {/* rate ticks down a side */}
    {[46, 54, 62, 70].map((y, i) => (
      <line key={i} x1={4} y1={y} x2={12} y2={y} stroke={i % 2 ? p.magenta : p.green} strokeWidth={1.2} opacity={0.7} />
    ))}
  </>
));

// mm-4 · CLOCK shop — a speed-drill timer sign.
const MmClock = make("TIME-04", (p) => p.gold, (p) => {
  const ticks: ReactNode[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    ticks.push(
      <line key={i} x1={50 + Math.cos(a) * 8} y1={13 + Math.sin(a) * 8} x2={50 + Math.cos(a) * (i % 3 === 0 ? 6 : 7)} y2={13 + Math.sin(a) * (i % 3 === 0 ? 6 : 7)} stroke={p.cyan} strokeWidth={i % 3 === 0 ? 1.3 : 0.7} />,
    );
  }
  return (
    <>
      <circle cx={50} cy={13} r={8.5} fill="none" stroke={p.gold} strokeWidth={1.4} />
      {ticks}
      <line x1={50} y1={13} x2={54} y2={8} stroke={p.magenta} strokeWidth={1.4} strokeLinecap="round" className="cp-anim cp-pulse" />
      <circle cx={50} cy={13} r={1.4} fill={p.gold} />
    </>
  );
});

/* ========================================================================== */
/*  BRAINTEASERS — puzzle dens                                                */
/* ========================================================================== */

// bt-1 · LOCKSMITH — a glowing padlock sign.
const BtLock = make("LOCK-01", (p) => p.magenta, (p) => (
  <>
    <rect x={43} y={11} width={14} height={11} rx={1.6} fill={p.raised} fillOpacity={0.5} stroke={p.cyan} strokeWidth={1.3} />
    <path d="M45 11 V8 Q45 4 50 4 Q55 4 55 8 V11" fill="none" stroke={p.magenta} strokeWidth={1.5} className="cp-anim cp-flicker" />
    <circle cx={50} cy={16} r={1.6} fill={p.magenta} />
    {/* hanging keys on the sides */}
    <g stroke={p.gold} strokeWidth={1.2} fill="none">
      <circle cx={8} cy={48} r={2.4} />
      <line x1={8} y1={50.4} x2={8} y2={58} />
      <line x1={8} y1={55} x2={11} y2={55} />
    </g>
  </>
));

// bt-2 · MAZE arcade — a labyrinth sign.
const BtMaze = make("MAZE-02", (p) => p.cyan, (p) => (
  <>
    {tube("M32 7 H68 V19 H38 V11 H62 V15", p.cyan, 1.4)}
    <circle cx={32} cy={7} r={1.6} fill={p.green} />
    <circle cx={62} cy={15} r={1.6} fill={p.magenta} className="cp-anim cp-pulse" />
    {/* corner circuit dots */}
    {[[7, 50], [93, 52], [9, 70], [91, 72]].map(([cx, cy], i) => (
      <circle key={i} cx={cx} cy={cy} r={1.4} fill={p.cyan} fillOpacity={0.7} />
    ))}
  </>
));

// bt-3 · TILE parlor — mahjong/riddle tiles sign.
const BtTiles = make("TILE-03", (p) => p.green, (p) => (
  <>
    {[34, 45, 56, 67].map((x, i) => (
      <g key={i}>
        <rect x={x} y={8} width={9} height={12} rx={1.4} fill={p.raised} fillOpacity={0.55} stroke={i % 2 ? p.magenta : p.cyan} strokeWidth={1.1} className={i === 1 ? "cp-anim cp-flickerB" : undefined} />
        <circle cx={x + 4.5} cy={14} r={1.2} fill={i % 2 ? p.cyan : p.magenta} />
      </g>
    ))}
    <line x1={4} y1={56} x2={14} y2={56} stroke={p.green} strokeWidth={1.2} />
    <line x1={86} y1={60} x2={96} y2={60} stroke={p.green} strokeWidth={1.2} />
  </>
));

/* ========================================================================== */
/*  INTERVIEW GAMES — night-market trade bars                                 */
/* ========================================================================== */

// ig-1 · TICKER TERMINAL — a candlestick sign.
const IgTerminal = make("MKT-01", (p) => p.cyan, (p) => {
  const candles: [number, number, number, boolean][] = [
    [34, 6, 14, true],
    [44, 8, 12, false],
    [54, 5, 15, true],
    [64, 9, 11, true],
  ];
  return (
    <>
      {candles.map(([x, top, len, up], i) => {
        const col = up ? p.green : p.magenta;
        return (
          <g key={i} stroke={col} strokeWidth={1.2}>
            <line x1={x} y1={top} x2={x} y2={top + len} />
            <rect x={x - 2} y={top + 3} width={4} height={len - 6} fill={col} fillOpacity={0.4} stroke={col} />
          </g>
        );
      })}
      <line x1={28} y1={20} x2={72} y2={20} stroke={p.ink} strokeWidth={0.7} opacity={0.5} />
    </>
  );
});

// ig-2 · BIG BOARD — a ticker billboard scrolling marks.
const IgBoard = make("TAPE-02", (p) => p.magenta, (p) => (
  <>
    <rect x={26} y={7} width={48} height={13} rx={1.5} fill={p.raised} fillOpacity={0.5} stroke={p.magenta} strokeWidth={1.2} className="cp-anim cp-flicker" />
    <g className="cp-anim cp-dash" stroke={p.cyan} strokeWidth={1.4}>
      <line x1={30} y1={13.5} x2={70} y2={13.5} strokeDasharray="4 4" />
    </g>
    <path d="M31 17 L34 14 L37 17" fill="none" stroke={p.green} strokeWidth={1} />
    <path d="M63 10 L66 13 L69 10" fill="none" stroke={p.magenta} strokeWidth={1} />
    {/* speaker cones on the sides */}
    <path d="M4 50 L10 46 L10 62 L4 58 Z" fill={p.magenta} fillOpacity={0.12} stroke={p.magenta} strokeWidth={1} />
    <path d="M96 52 L90 48 L90 64 L96 60 Z" fill={p.cyan} fillOpacity={0.12} stroke={p.cyan} strokeWidth={1} />
  </>
));

// ig-3 · IZAKAYA — hanging lanterns + bottle rack.
const IgIzakaya = make("BAR-03", (p) => p.magenta, (p) => (
  <>
    <circle cx={38} cy={13} r={5.5} fill={p.magenta} fillOpacity={0.18} stroke={p.magenta} strokeWidth={1.3} className="cp-anim cp-buzz" />
    <circle cx={52} cy={13} r={5.5} fill={p.gold} fillOpacity={0.18} stroke={p.gold} strokeWidth={1.3} className="cp-anim cp-buzz" />
    <circle cx={64} cy={12} r={4} fill={p.cyan} fillOpacity={0.18} stroke={p.cyan} strokeWidth={1.2} />
    {/* bottle silhouettes down a side */}
    {[48, 58, 68].map((y, i) => (
      <g key={i}>
        <rect x={6} y={y} width={4} height={9} rx={1} fill={p.cyan} fillOpacity={0.2} stroke={p.cyan} strokeWidth={0.8} />
        <line x1={8} y1={y} x2={8} y2={y - 2} stroke={p.cyan} strokeWidth={0.8} />
      </g>
    ))}
  </>
));

// ig-4 · SERVER bar — a rack of blinking lights.
const IgServer = make("NODE-04", (p) => p.green, (p) => (
  <>
    <rect x={30} y={7} width={40} height={13} rx={1.5} fill={p.raised} fillOpacity={0.5} stroke={p.cyan} strokeWidth={1.2} />
    {[10, 13.5, 17].map((y, i) => (
      <g key={i}>
        <line x1={34} y1={y} x2={58} y2={y} stroke={p.ink} strokeWidth={0.7} opacity={0.5} />
        <circle cx={63} cy={y} r={1.3} fill={p.green} className="cp-anim cp-flickerB" />
        <circle cx={67} cy={y} r={1.3} fill={i === 1 ? p.magenta : p.cyan} />
      </g>
    ))}
    <circle cx={8} cy={54} r={1.6} fill={p.green} className="cp-anim cp-pulse" />
    <circle cx={92} cy={58} r={1.6} fill={p.cyan} className="cp-anim cp-pulse" />
  </>
));

// ig-5 · CHAMPION podium — a neon trophy, the grand finale.
const IgTrophy = make("WIN-05", (p) => p.gold, (p) => (
  <>
    <path d="M43 5 h14 v4 q0 8 -7 10 q-7 -2 -7 -10 Z" fill={p.gold} fillOpacity={0.3} stroke={p.gold} strokeWidth={1.5} className="cp-anim cp-glow" />
    <path d="M43 7 q-5 1 -5 -4 M57 7 q5 1 5 -4" fill="none" stroke={p.gold} strokeWidth={1.2} />
    <line x1={50} y1={19} x2={50} y2={22} stroke={p.gold} strokeWidth={1.4} />
    {/* starbursts */}
    {[[10, 48], [90, 50]].map(([cx, cy], i) => (
      <path key={i} d={`M${cx} ${cy - 4} L${cx + 1} ${cy - 1} L${cx + 4} ${cy} L${cx + 1} ${cy + 1} L${cx} ${cy + 4} L${cx - 1} ${cy + 1} L${cx - 4} ${cy} L${cx - 1} ${cy - 1} Z`} fill={p.magenta} className="cp-anim cp-pulse" />
    ))}
  </>
));

/* -------------------------------------------------------------------------- */
/*  Registry + resolver                                                        */
/* -------------------------------------------------------------------------- */

const FAMILIES: Record<string, MapStationComponent[]> = {
  probability: [PrArcade, PrSlots, PrFortune, PrDiceDen, PrCoin],
  "mental-math": [MmCalc, MmRamen, MmExchange, MmClock],
  brainteasers: [BtLock, BtMaze, BtTiles],
  "interview-games": [IgTerminal, IgBoard, IgIzakaya, IgServer, IgTrophy],
};

export function getCyberpunkStation(
  ctx: LevelIllustrationContext,
): MapStationComponent | null {
  const family = FAMILIES[ctx.trackId];
  if (!family || family.length === 0) return null; // no family → plain node
  const i = ((ctx.levelIndex % family.length) + family.length) % family.length;
  return family[i];
}
