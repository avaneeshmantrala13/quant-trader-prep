import type { ReactNode } from "react";
import type {
  LevelIllustrationContext,
  MapStationComponent,
  MapStationState,
} from "../types";

/**
 * Broadsheet map stations — small ENGRAVED vignettes in the newsprint style:
 * hairline ink linework + fine cross-hatching, monochrome, framed like a little
 * engraving plate with a ruled plinth. Ink is `--color-border-strong` so it
 * reads as ink on paper (light) / warm line on black (dark); locked nodes are
 * dimmed; a small gold star crowns a mastered node.
 *
 * Each level gets its OWN emblem, and every track has its own motif family, so
 * probability L1 (a die) reads completely differently from mental-math L1 (an
 * abacus). The 68px node button sits on top and draws the number/lock/check —
 * these vignettes frame and crown it (peek above, flank, and a plinth below).
 */

type Emblem = () => ReactNode;

/* ----------------------------- shared engraving furniture ---------------- */

/** Delicate double-ruled plate frame (the engraving vignette border). */
function Frame() {
  return (
    <g fill="none">
      <rect x="4" y="4" width="92" height="92" strokeWidth="0.9" opacity="0.75" />
      <rect x="7" y="7" width="86" height="86" strokeWidth="0.5" opacity="0.5" />
      {/* corner ticks */}
      <g strokeWidth="0.8" opacity="0.7">
        <path d="M4 14 V4 H14 M96 14 V4 H86 M4 86 V96 H14 M96 86 V96 H86" />
      </g>
    </g>
  );
}

/** A ruled plinth just beneath the node. */
function Plinth() {
  return (
    <g fill="none">
      <line x1="30" y1="82" x2="70" y2="82" strokeWidth="1.2" />
      <line x1="34" y1="85" x2="66" y2="85" strokeWidth="0.6" opacity="0.6" />
    </g>
  );
}

/** Small gold laurel star that crowns a mastered node. */
function MasterMark() {
  return (
    <path
      d="M50 0.5 l1.3 2.9 3.1 .3 -2.3 2.1 .7 3 -2.8 -1.5 -2.8 1.5 .7 -3 -2.3 -2.1 3.1 -.3 Z"
      fill="rgb(var(--color-gold))"
      stroke="none"
    />
  );
}

/** Horizontal engraving hatch inside a box (cheap shading, no clip needed). */
function Hatch({
  x,
  y,
  w,
  h,
  gap = 2.4,
  opacity = 0.45,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  gap?: number;
  opacity?: number;
}) {
  const rows: ReactNode[] = [];
  for (let yy = y; yy <= y + h + 0.001; yy += gap) {
    rows.push(<line key={yy} x1={x} y1={yy} x2={x + w} y2={yy} />);
  }
  return (
    <g strokeWidth="0.5" opacity={opacity}>
      {rows}
    </g>
  );
}

/* ------------------------------- probability ----------------------------- */

const Die: Emblem = () => (
  <>
    <path d="M40 8 L46 3 L66 3 L60 8 Z" strokeWidth="1.1" />
    <path d="M60 8 L66 3 L66 20 L60 25 Z" strokeWidth="1.1" />
    <rect x="40" y="8" width="20" height="17" rx="1.5" strokeWidth="1.4" />
    <g fill="currentColor" stroke="none">
      <circle cx="44.5" cy="12.5" r="1.3" />
      <circle cx="55.5" cy="12.5" r="1.3" />
      <circle cx="50" cy="16.5" r="1.3" />
      <circle cx="44.5" cy="20.5" r="1.3" />
      <circle cx="55.5" cy="20.5" r="1.3" />
    </g>
    <Hatch x={60} y={9} w={6} h={15} gap={2} opacity={0.4} />
  </>
);

const Coin: Emblem = () => (
  <>
    <ellipse cx="50" cy="14" rx="13" ry="9" strokeWidth="1.4" />
    <ellipse cx="50" cy="14" rx="9.5" ry="6" strokeWidth="0.7" opacity="0.7" />
    <path d="M50 9 v10 M46.5 11 h7 M46.5 17 h7" strokeWidth="1" />
    <path d="M31 7 q6 -5 12 -2" strokeWidth="0.7" opacity="0.6" />
    <path d="M69 7 q-6 -5 -12 -2" strokeWidth="0.7" opacity="0.6" />
  </>
);

const BellCurve: Emblem = () => (
  <>
    <path d="M28 25 Q28 6 50 6 Q72 6 72 25" strokeWidth="1.1" />
    <line x1="30" y1="25" x2="70" y2="25" strokeWidth="1.2" />
    <path
      d="M33 24 C41 24 43 10 50 10 C57 10 59 24 67 24"
      strokeWidth="1.5"
    />
    <line x1="50" y1="10" x2="50" y2="24" strokeWidth="0.6" opacity="0.6" />
  </>
);

const Urn: Emblem = () => (
  <>
    <path
      d="M41 6 h18 l-2.5 4 q6.5 4 6.5 10 q0 8.5 -13 8.5 q-13 0 -13 -8.5 q0 -6 6.5 -10 l-2.5 -4 Z"
      strokeWidth="1.3"
    />
    <line x1="38" y1="6" x2="62" y2="6" strokeWidth="1.3" />
    <g fill="currentColor" stroke="none">
      <circle cx="45" cy="21" r="1.7" />
      <circle cx="52" cy="19" r="1.7" />
      <circle cx="49" cy="24" r="1.7" />
      <circle cx="55" cy="23" r="1.7" />
    </g>
  </>
);

const Paths: Emblem = () => (
  <>
    <path d="M28 4 L50 16 L72 4" strokeWidth="1.2" strokeDasharray="2.4 2.4" />
    <path d="M28 26 L50 14 L72 26" strokeWidth="1.2" strokeDasharray="2.4 2.4" />
    <circle cx="50" cy="15" r="2.6" fill="currentColor" stroke="none" />
    <g fill="currentColor" stroke="none">
      <circle cx="28" cy="4" r="1.4" />
      <circle cx="72" cy="4" r="1.4" />
      <circle cx="28" cy="26" r="1.4" />
      <circle cx="72" cy="26" r="1.4" />
    </g>
  </>
);

/* ------------------------------- mental math ----------------------------- */

const Abacus: Emblem = () => (
  <>
    <rect x="30" y="4" width="40" height="22" rx="1" strokeWidth="1.4" />
    <line x1="30" y1="11.5" x2="70" y2="11.5" strokeWidth="0.7" />
    <line x1="30" y1="18.5" x2="70" y2="18.5" strokeWidth="0.7" />
    <g fill="currentColor" stroke="none">
      <rect x="34" y="8.5" width="4" height="6" rx="1.5" />
      <rect x="40" y="8.5" width="4" height="6" rx="1.5" />
      <rect x="60" y="15.5" width="4" height="6" rx="1.5" />
      <rect x="54" y="15.5" width="4" height="6" rx="1.5" />
      <rect x="48" y="15.5" width="4" height="6" rx="1.5" />
    </g>
  </>
);

const Ledger: Emblem = () => (
  <>
    <path d="M50 6 v20" strokeWidth="1" />
    <path d="M50 6 Q39 3 31 6 V24 Q39 21 50 24 Z" strokeWidth="1.3" />
    <path d="M50 6 Q61 3 69 6 V24 Q61 21 50 24 Z" strokeWidth="1.3" />
    <g strokeWidth="0.6" opacity="0.6">
      <line x1="34" y1="10" x2="46" y2="9.2" />
      <line x1="34" y1="13" x2="46" y2="12.2" />
      <line x1="34" y1="16" x2="46" y2="15.2" />
      <line x1="54" y1="9.2" x2="66" y2="10" />
      <line x1="54" y1="12.2" x2="66" y2="13" />
      <line x1="54" y1="15.2" x2="66" y2="16" />
    </g>
  </>
);

const SlideRule: Emblem = () => (
  <>
    <rect x="26" y="11" width="48" height="9" rx="1" strokeWidth="1.4" />
    <line x1="26" y1="15.5" x2="74" y2="15.5" strokeWidth="0.6" opacity="0.6" />
    <g strokeWidth="0.7">
      {[30, 36, 42, 48, 54, 60, 66, 72].map((x) => (
        <line key={x} x1={x} y1="11" x2={x} y2="14" />
      ))}
    </g>
    <rect x="45" y="8" width="8" height="15" strokeWidth="1.2" />
  </>
);

const CountingHouse: Emblem = () => (
  <>
    <g strokeWidth="1.2">
      {[0, 1, 2, 3].map((i) => (
        <ellipse key={`a${i}`} cx="39" cy={24 - i * 3.4} rx="7" ry="2.4" />
      ))}
      {[0, 1, 2].map((i) => (
        <ellipse key={`b${i}`} cx="55" cy={24 - i * 3.4} rx="6" ry="2.2" />
      ))}
    </g>
    <path d="M65 5 L53 19" strokeWidth="1.2" />
    <path d="M65 5 Q60 9 55 10 Q60 11 58 15" strokeWidth="0.8" opacity="0.7" />
  </>
);

/* ------------------------------- brainteasers ---------------------------- */

const Rings: Emblem = () => (
  <>
    <circle cx="42" cy="16" r="9" strokeWidth="1.5" />
    <circle cx="58" cy="16" r="9" strokeWidth="1.5" />
    <circle cx="50" cy="9" r="7" strokeWidth="1.2" opacity="0.9" />
  </>
);

const Labyrinth: Emblem = () => (
  <>
    <rect x="34" y="3" width="32" height="23" strokeWidth="1.4" />
    <path
      d="M40 26 V9 H60 V21 H46 V15 H54 V19"
      strokeWidth="1"
      fill="none"
    />
    <line x1="34" y1="15" x2="38" y2="15" strokeWidth="1" />
    <line x1="66" y1="12" x2="62" y2="12" strokeWidth="1" />
  </>
);

const Bulb: Emblem = () => (
  <>
    <circle cx="50" cy="13" r="9" strokeWidth="1.5" />
    <path d="M45 20.5 h10 M46 23.5 h8" strokeWidth="1.2" />
    <path d="M47 13 q3 -4.5 6 0" strokeWidth="0.9" />
    <g strokeWidth="0.8" opacity="0.6">
      <line x1="50" y1="1" x2="50" y2="3.5" />
      <line x1="36" y1="6" x2="38" y2="8" />
      <line x1="64" y1="6" x2="62" y2="8" />
      <line x1="33" y1="14" x2="36" y2="14" />
      <line x1="67" y1="14" x2="64" y2="14" />
    </g>
  </>
);

/* ---------------------------- interview games ---------------------------- */

const Bull: Emblem = () => (
  <>
    <path
      d="M31 24 Q32 12 43 12 L57 12 Q68 12 68 20 L68 24"
      strokeWidth="1.5"
    />
    <path d="M43 12 Q40 6 35 7 M57 12 Q60 6 65 7" strokeWidth="1.2" />
    <circle cx="63.5" cy="16" r="0.9" fill="currentColor" stroke="none" />
    <path d="M31 24 v3 M67 24 v3 M45 24 v2 M55 24 v2" strokeWidth="1.1" />
    <Hatch x={40} y={14} w={26} h={8} gap={2} opacity={0.3} />
  </>
);

const Exchange: Emblem = () => (
  <>
    <path d="M28 12 L50 3 L72 12 Z" strokeWidth="1.4" />
    <line x1="27" y1="12" x2="73" y2="12" strokeWidth="1.2" />
    <g strokeWidth="1.2">
      {[33, 40, 47, 54, 61].map((x) => (
        <line key={x} x1={x} y1="14" x2={x} y2="25" />
      ))}
    </g>
    <line x1="28" y1="25" x2="72" y2="25" strokeWidth="1.4" />
    <line x1="25" y1="28" x2="75" y2="28" strokeWidth="1" opacity="0.7" />
  </>
);

const Ticker: Emblem = () => (
  <>
    <rect x="44" y="3" width="12" height="23" strokeWidth="1.4" />
    <line x1="44" y1="8" x2="56" y2="8" strokeWidth="0.6" opacity="0.6" />
    <path d="M28 11 q11 -5 22 0 t22 0" strokeWidth="1.2" />
    <g strokeWidth="0.7" opacity="0.75">
      {[31, 37, 61, 67].map((x) => (
        <line key={x} x1={x} y1="8.5" x2={x + 3} y2="12.5" />
      ))}
    </g>
  </>
);

const Stall: Emblem = () => (
  <>
    <path d="M30 12 H70 L65 5 H35 Z" strokeWidth="1.4" />
    <g strokeWidth="0.8" opacity="0.8">
      {[40, 48, 56, 64].map((x) => (
        <line key={x} x1={x} y1="5" x2={x - 2.5} y2="12" />
      ))}
    </g>
    <path
      d="M30 12 q5 4 10 0 q5 4 10 0 q5 4 10 0 q5 4 10 0"
      strokeWidth="1"
    />
    <line x1="32" y1="12" x2="32" y2="26" strokeWidth="1.1" />
    <line x1="68" y1="12" x2="68" y2="26" strokeWidth="1.1" />
  </>
);

const Medallion: Emblem = () => (
  <>
    <circle cx="50" cy="14" r="11" strokeWidth="1.4" />
    <circle cx="50" cy="14" r="8" strokeWidth="0.6" opacity="0.6" />
    <path
      d="M43 15 l4 -2.5 l3 1.8 l3 -1.8 l4 2.5"
      strokeWidth="1.2"
      fill="none"
    />
    <path d="M46 15 l3.5 2 M54 15 l-3.5 2" strokeWidth="1.1" />
    <path d="M41 23 q3 2 6 1 M59 23 q-3 2 -6 1" strokeWidth="0.8" opacity="0.7" />
  </>
);

/* ------------------------------- assembly -------------------------------- */

const EMBLEMS: Record<string, Emblem[]> = {
  probability: [Die, Coin, BellCurve, Urn, Paths],
  "mental-math": [Abacus, Ledger, SlideRule, CountingHouse],
  brainteasers: [Rings, Labyrinth, Bulb],
  "interview-games": [Bull, Exchange, Ticker, Stall, Medallion],
};

function makeStation(Emblem: Emblem): MapStationComponent {
  return function BroadsheetStation({
    className,
    state,
  }: {
    className?: string;
    state?: MapStationState;
  }) {
    const locked = state === "locked";
    return (
      <svg
        viewBox="0 0 100 100"
        className={className}
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          color: locked
            ? "rgb(var(--color-border))"
            : "rgb(var(--color-border-strong))",
          opacity: locked ? 0.5 : 0.95,
        }}
      >
        <Frame />
        <Plinth />
        <g>
          <Emblem />
        </g>
        {state === "mastered" && <MasterMark />}
      </svg>
    );
  };
}

// Build each station component once so node identity is stable across renders.
const REGISTRY: Record<string, MapStationComponent> = {};
for (const [track, list] of Object.entries(EMBLEMS)) {
  list.forEach((emblem, i) => {
    REGISTRY[`${track}:${i}`] = makeStation(emblem);
  });
}

export function getBroadsheetStation(
  ctx: LevelIllustrationContext,
): MapStationComponent | null {
  return REGISTRY[`${ctx.trackId}:${ctx.levelIndex}`] ?? null;
}
