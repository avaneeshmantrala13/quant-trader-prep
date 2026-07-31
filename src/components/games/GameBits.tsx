import { useEffect, useRef, useState } from "react";

/**
 * ============================================================================
 *  GAME BITS — shared, theme-token-only visual primitives for the interview
 *  games. Everything here resolves through the existing CSS variables so it
 *  works in both the newsprint (light) and terminal (dark) themes, and all
 *  motion is short + respects `prefers-reduced-motion` (killed globally in
 *  index.css). No new colors, no drop shadows — just sharper, more alive
 *  renditions of cards, dice, probabilities and live numbers.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/*  Cards                                                                       */
/* -------------------------------------------------------------------------- */

export interface CardLike {
  /** 2–14, where 11=J 12=Q 13=K 14=A. */
  rank: number;
  suit: "♠" | "♥" | "♦" | "♣";
}

export function rankLabel(rank: number): string {
  if (rank === 14) return "A";
  if (rank === 13) return "K";
  if (rank === 12) return "Q";
  if (rank === 11) return "J";
  return String(rank);
}

const isRed = (suit: string) => suit === "♥" || suit === "♦";

type CardSize = "sm" | "md" | "lg";

const CARD_DIMS: Record<CardSize, string> = {
  sm: "h-14 w-10",
  md: "h-20 w-14",
  lg: "h-24 w-16",
};

const RANK_TEXT: Record<CardSize, string> = {
  sm: "text-sm",
  md: "text-lg",
  lg: "text-2xl",
};

/**
 * A proper playing card: big centre rank, corner rank+pip (top-left /
 * bottom-right like a real face), optional face-value footnote, and a hatched
 * back when face-down. Deals in with a short slide+tilt unless `still`.
 */
export function PlayingCard({
  card,
  faceDown,
  faceValue,
  size = "md",
  still,
  flip,
  className = "",
}: {
  card?: CardLike;
  faceDown?: boolean;
  /** Small numeric value note (e.g. counting value under the active ace mode). */
  faceValue?: number;
  size?: CardSize;
  /** Skip the deal-in animation (e.g. static summary rows). */
  still?: boolean;
  /** Use the flip reveal animation instead of deal-in (for the resolving card). */
  flip?: boolean;
  className?: string;
}) {
  const dims = CARD_DIMS[size];
  const anim = still ? "" : flip ? "animate-card-flip" : "animate-deal-in";

  if (faceDown || !card) {
    return (
      <div
        className={`grid place-items-center rounded-md border-2 border-border-strong bg-surface-muted ${dims} ${anim} ${className}`}
      >
        <div className="hatch h-3/4 w-2/3 rounded-sm border border-subtle opacity-70" />
      </div>
    );
  }

  const tone = isRed(card.suit) ? "text-bear" : "text-primary";
  const label = rankLabel(card.rank);

  return (
    <div
      className={`relative grid place-items-center rounded-md border-2 border-border-strong bg-surface ${dims} ${anim} ${className}`}
    >
      {/* top-left corner */}
      <span className={`absolute left-1 top-0.5 flex flex-col items-center leading-none ${tone}`}>
        <span className={`font-display font-bold ${size === "sm" ? "text-[10px]" : "text-xs"}`}>{label}</span>
        <span className={size === "sm" ? "text-[8px]" : "text-[10px]"}>{card.suit}</span>
      </span>

      {/* centre rank */}
      <span className={`font-display font-bold ${RANK_TEXT[size]} ${tone}`}>{label}</span>

      {/* bottom-right corner (rotated) */}
      <span className={`absolute bottom-0.5 right-1 flex rotate-180 flex-col items-center leading-none ${tone}`}>
        <span className={`font-display font-bold ${size === "sm" ? "text-[10px]" : "text-xs"}`}>{label}</span>
        <span className={size === "sm" ? "text-[8px]" : "text-[10px]"}>{card.suit}</span>
      </span>

      {faceValue !== undefined && size !== "sm" && (
        <span className="num absolute bottom-0.5 left-1 text-[9px] text-muted">={faceValue}</span>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Dice — real pip layouts                                                     */
/* -------------------------------------------------------------------------- */

// Which of the 9 cells (3×3 grid) are filled for each face 1–6.
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export function Die({
  value,
  size = 56,
  still,
}: {
  value: number;
  size?: number;
  still?: boolean;
}) {
  const on = new Set(PIPS[value] ?? []);
  return (
    <div
      className={`grid rounded-md border-2 border-accent bg-surface p-1.5 ${still ? "" : "animate-deal-in"}`}
      style={{ width: size, height: size, gridTemplateColumns: "repeat(3, 1fr)", gridTemplateRows: "repeat(3, 1fr)" }}
      role="img"
      aria-label={`die showing ${value}`}
    >
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className="grid place-items-center">
          {on.has(i) && <span className="block h-1.5 w-1.5 rounded-full bg-accent sm:h-2 sm:w-2" />}
        </span>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Probability bar with Kelly slice                                            */
/* -------------------------------------------------------------------------- */

/**
 * Horizontal probability bar: fill = p (0–1). An optional Kelly marker shows
 * the even-money optimal stake fraction (2p−1) as a tick, turning a text-only
 * teaching line into something you see. Colour keys off whether the side has
 * an edge (p>0.5 → bull, else muted).
 */
export function ProbBar({
  p,
  kelly,
  label,
  highlight,
  animate = true,
}: {
  p: number;
  kelly?: number;
  label?: string;
  /** Draw with the "best side" accent treatment. */
  highlight?: boolean;
  animate?: boolean;
}) {
  const pctFill = Math.max(0, Math.min(1, p)) * 100;
  const edge = p > 0.5;
  const fillTone = highlight ? "bg-accent" : edge ? "bg-bull" : "bg-muted";

  return (
    <div>
      {label && (
        <div className="mb-0.5 flex items-center justify-between text-[12px]">
          <span className={highlight ? "font-semibold text-accent" : "text-secondary"}>{label}</span>
          <span className="num text-muted">{Math.round(p * 100)}%</span>
        </div>
      )}
      <div className="relative h-2.5 w-full overflow-hidden rounded-sm border border-subtle bg-surface">
        <div
          className={`h-full origin-left ${fillTone} ${animate ? "animate-bar-grow" : ""}`}
          style={{ width: `${pctFill}%` }}
        />
        {/* 50% break-even guide */}
        <div className="absolute inset-y-0 left-1/2 w-px bg-border-strong/40" aria-hidden="true" />
        {kelly !== undefined && kelly > 0 && (
          <div
            className="absolute inset-y-0 w-0.5 bg-accent-2"
            style={{ left: `calc(${pctFill}% - 1px)` }}
            title={`Kelly ${Math.round(kelly * 100)}%`}
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  CountUp — a tweened, pulsing live number                                    */
/* -------------------------------------------------------------------------- */

/**
 * Animates from the previous value to the next over ~450ms and gives a short
 * scale pulse (green up / red down) on change. Uses rAF; falls back to the
 * final value instantly under reduced motion (the transform is a no-op there).
 */
export function CountUp({
  value,
  className = "",
  format = (n) => Math.round(n).toLocaleString(),
}: {
  value: number;
  className?: string;
  format?: (n: number) => string;
}) {
  const [display, setDisplay] = useState(value);
  const [pulse, setPulse] = useState<"up" | "down" | null>(null);
  const fromRef = useRef(value);
  const rafRef = useRef<number>();

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
    setPulse(to > from ? "up" : "down");
    const dur = 450;
    const t0 = performance.now();

    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setDisplay(to);
        fromRef.current = to;
      }
    };
    rafRef.current = requestAnimationFrame(step);
    const clear = window.setTimeout(() => setPulse(null), 340);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.clearTimeout(clear);
    };
  }, [value]);

  const pulseClass =
    pulse === "up" ? "animate-count-pulse text-bull" : pulse === "down" ? "animate-count-pulse text-bear" : "";

  return <span className={`num inline-block ${pulseClass} ${className}`}>{format(display)}</span>;
}

/* -------------------------------------------------------------------------- */
/*  RoundPips — spatial "round 2 of 4" indicator                                */
/* -------------------------------------------------------------------------- */

export function RoundPips({ total, current }: { total: number; current: number }) {
  return (
    <span className="flex items-center gap-1" aria-label={`round ${current + 1} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`block h-1.5 w-1.5 rounded-full transition-colors ${
            i < current ? "bg-accent" : i === current ? "bg-accent ring-2 ring-accent/30" : "bg-subtle"
          }`}
        />
      ))}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  FloatDelta — a P&L number that drifts up and fades (rise-fade)              */
/* -------------------------------------------------------------------------- */

export function FloatDelta({ amount, prefix = "" }: { amount: number; prefix?: string }) {
  const sign = amount < 0 ? "−" : "+";
  const tone = amount < 0 ? "text-bear" : "text-bull";
  return (
    <span
      key={amount}
      className={`num animate-rise-fade pointer-events-none absolute left-1/2 -translate-x-1/2 text-lg font-bold ${tone}`}
    >
      {sign}
      {prefix}
      {Math.abs(amount).toLocaleString()}
    </span>
  );
}
