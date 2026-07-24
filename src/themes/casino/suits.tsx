/**
 * Shared card-room SVG primitives for the Casino Felt theme: the four playing
 * card suits, a poker chip, a rounded playing card, and dice pips. Suit shapes
 * live as raw path data (32×32 viewBox) so they can be dropped into any SVG,
 * and the icon wrappers paint with `currentColor` — callers set the hue via a
 * text token (`text-bear` for the red suits, `text-primary` for the dark ones)
 * so contrast stays token-driven in both light and dark.
 */

export type Suit = "heart" | "diamond" | "spade" | "club";

export const SUIT_PATH: Record<Suit, string> = {
  heart:
    "M16 28C16 28 3 19.5 3 10.8 3 6.2 6.1 3 9.9 3 12.7 3 14.9 4.7 16 7 17.1 4.7 19.3 3 22.1 3 25.9 3 29 6.2 29 10.8 29 19.5 16 28 16 28Z",
  diamond: "M16 2 27.5 16 16 30 4.5 16Z",
  spade:
    "M16 3C16 3 4.5 12 4.5 19c0 4 3.1 6.1 6.2 5 .6-.2 1.3-.6 1.8-1.1-.3 2.9-1.4 5.2-3.5 6.6H23c-2.1-1.4-3.2-3.7-3.5-6.6.5.5 1.2.9 1.8 1.1 3.1 1.1 6.2-1 6.2-5C27.5 12 16 3 16 3Z",
  club:
    "M13 19.4c-1.1 1.2-2.9 1.8-4.6 1.2C6 19.8 4.7 16.9 5.8 14.3c1-2.5 4-3.6 6.4-2.7-.9-.9-1.4-2.1-1.4-3.4C10.8 5.2 13.1 3 16 3s5.2 2.2 5.2 5.2c0 1.3-.5 2.5-1.4 3.4 2.4-.9 5.4.2 6.4 2.7 1.1 2.6-.2 5.5-2.6 6.3-1.7.6-3.5 0-4.6-1.2.4 2.9 1.5 6.3 3.6 8.6H9.4C11.5 25.7 12.6 22.3 13 19.4Z",
};

interface IconProps {
  className?: string;
}

function suitIcon(suit: Suit) {
  return function SuitIcon({ className }: IconProps) {
    return (
      <svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true" className={className}>
        <path d={SUIT_PATH[suit]} />
      </svg>
    );
  };
}

export const Heart = suitIcon("heart");
export const Diamond = suitIcon("diamond");
export const Spade = suitIcon("spade");
export const Club = suitIcon("club");

/** A poker chip: outer disc, gold rim, edge spots and a dashed center ring. */
export function Chip({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <circle cx="16" cy="16" r="14.5" fill="currentColor" fillOpacity="0.92" />
      <circle
        cx="16"
        cy="16"
        r="14.5"
        fill="none"
        stroke="rgb(var(--color-gold))"
        strokeWidth="1.4"
      />
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i / 8) * Math.PI * 2;
        const cx = 16 + Math.cos(a) * 13;
        const cy = 16 + Math.sin(a) * 13;
        return (
          <rect
            key={i}
            x={cx - 1.4}
            y={cy - 2.6}
            width="2.8"
            height="5.2"
            rx="1"
            fill="rgb(var(--color-accent-contrast))"
            fillOpacity="0.85"
            transform={`rotate(${(a * 180) / Math.PI + 90} ${cx} ${cy})`}
          />
        );
      })}
      <circle
        cx="16"
        cy="16"
        r="7.5"
        fill="none"
        stroke="rgb(var(--color-gold))"
        strokeWidth="1.3"
        strokeDasharray="2 2.2"
      />
    </svg>
  );
}

/**
 * A playing card with a gold hairline, a corner rank + suit index and a large
 * center pip. Reds paint via `--color-bear`, dark suits via
 * `--color-text-primary`, both on the raised surface so they always read.
 */
export function PlayingCard({
  className,
  suit = "spade",
  rank = "A",
}: IconProps & { suit?: Suit; rank?: string }) {
  const red = suit === "heart" || suit === "diamond";
  const ink = red ? "rgb(var(--color-bear))" : "rgb(var(--color-text-primary))";
  return (
    <svg viewBox="0 0 48 66" aria-hidden="true" className={className}>
      <rect
        x="1.5"
        y="1.5"
        width="45"
        height="63"
        rx="6"
        fill="rgb(var(--color-surface-raised))"
        stroke="rgb(var(--color-gold))"
        strokeWidth="1.4"
      />
      <text
        x="6.5"
        y="15"
        fontSize="12"
        fontWeight="700"
        fontFamily="var(--font-display)"
        fill={ink}
      >
        {rank}
      </text>
      <path d={SUIT_PATH[suit]} fill={ink} transform="translate(4.5 15) scale(0.42)" />
      <path d={SUIT_PATH[suit]} fill={ink} transform="translate(11 24) scale(1.05)" />
    </svg>
  );
}

/** A single die face (1–6) with pips. */
export function Die({ className, value = 6 }: IconProps & { value?: number }) {
  const layout: Record<number, [number, number][]> = {
    1: [[16, 16]],
    2: [
      [9, 9],
      [23, 23],
    ],
    3: [
      [9, 9],
      [16, 16],
      [23, 23],
    ],
    4: [
      [9, 9],
      [23, 9],
      [9, 23],
      [23, 23],
    ],
    5: [
      [9, 9],
      [23, 9],
      [16, 16],
      [9, 23],
      [23, 23],
    ],
    6: [
      [9, 8],
      [23, 8],
      [9, 16],
      [23, 16],
      [9, 24],
      [23, 24],
    ],
  };
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <rect
        x="2"
        y="2"
        width="28"
        height="28"
        rx="6"
        fill="rgb(var(--color-surface-raised))"
        stroke="rgb(var(--color-gold))"
        strokeWidth="1.6"
      />
      {(layout[value] ?? layout[6]).map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.6" fill="rgb(var(--color-bear))" />
      ))}
    </svg>
  );
}
