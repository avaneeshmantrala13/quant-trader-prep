import type { ReactNode } from "react";
import type {
  IllustrationComponent,
  LevelIllustrationContext,
} from "../types";
import { Chip, Die, PlayingCard, type Suit } from "./suits";

/**
 * Per-level card-room vignettes for the Casino Felt theme. Each motif gets its
 * own tabletop scene rendered in the lesson briefing — a felt strip framed with
 * a gold hairline, holding cards / chips / dice. Purely decorative, token-driven
 * (so contrast-safe in both modes), and it varies subtly by level index.
 */

function Frame({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative flex h-32 items-center justify-center gap-3 overflow-hidden rounded-md border border-subtle bg-surface-muted px-4"
      style={{
        boxShadow: "inset 0 0 0 1px rgb(var(--color-gold) / 0.25)",
      }}
    >
      {children}
    </div>
  );
}

const RANKS = ["A", "K", "Q", "J", "10", "9", "8", "7"];
const SUITS: Suit[] = ["spade", "heart", "club", "diamond"];

/** A small poker hand — a fan of cards that shifts by level. */
function CardFanScene(offset: number): IllustrationComponent {
  return function CardFan({ className }: { className?: string }) {
    const cards = [0, 1, 2, 3, 4].map((i) => ({
      rank: RANKS[(offset + i) % RANKS.length],
      suit: SUITS[(offset + i) % SUITS.length],
      rot: (i - 2) * 9,
      dx: (i - 2) * 22,
      dy: Math.abs(i - 2) * 6,
    }));
    return (
      <Frame>
        <div className={"relative h-24 w-52 " + (className ?? "")}>
          {cards.map((c, i) => (
            <div
              key={i}
              className="absolute left-1/2 top-1/2"
              style={{
                transform: `translate(-50%,-50%) translate(${c.dx}px, ${c.dy}px) rotate(${c.rot}deg)`,
                zIndex: 10 - Math.abs(i - 2),
              }}
            >
              <PlayingCard className="h-24 w-auto drop-shadow" suit={c.suit} rank={c.rank} />
            </div>
          ))}
        </div>
      </Frame>
    );
  };
}

/** Three stacks of poker chips — heights vary with the level index. */
function ChipStackScene(offset: number): IllustrationComponent {
  return function ChipStack({ className }: { className?: string }) {
    const stacks = [3 + (offset % 3), 5, 2 + (offset % 4)];
    const tone = ["text-bear", "text-accent", "text-primary"];
    const step = 9;
    return (
      <Frame>
        <div className={"flex items-end gap-6 " + (className ?? "")}>
          {stacks.map((count, s) => (
            <div
              key={s}
              className="relative w-11"
              style={{ height: count * step + 40 }}
            >
              {Array.from({ length: count }).map((_, i) => (
                <div
                  key={i}
                  className="absolute left-0 h-11 w-11"
                  style={{ bottom: i * step }}
                >
                  <Chip className={"h-full w-full " + tone[s]} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </Frame>
    );
  };
}

/** Two dice — faces derived from the level index. */
function DiceScene(offset: number): IllustrationComponent {
  return function Dice({ className }: { className?: string }) {
    const a = ((offset * 2) % 6) + 1;
    const b = ((offset * 3 + 2) % 6) + 1;
    return (
      <Frame>
        <div className={"flex items-center gap-4 " + (className ?? "")}>
          <Die className="h-16 w-16 -rotate-6 drop-shadow" value={a} />
          <Die className="h-16 w-16 rotate-6 drop-shadow" value={b} />
          <Chip className="ml-1 h-12 w-12 text-accent" />
        </div>
      </Frame>
    );
  };
}

/** A roulette-style wheel of alternating red/black pockets + a center chip. */
function WheelScene(): IllustrationComponent {
  return function Wheel({ className }: { className?: string }) {
    const pockets = Array.from({ length: 24 });
    return (
      <Frame>
        <div className={"relative h-24 w-24 " + (className ?? "")}>
          <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
            <circle
              cx="50"
              cy="50"
              r="47"
              fill="rgb(var(--color-surface-raised))"
              stroke="rgb(var(--color-gold))"
              strokeWidth="2"
            />
            {pockets.map((_, i) => {
              const a0 = (i / pockets.length) * Math.PI * 2;
              const a1 = ((i + 1) / pockets.length) * Math.PI * 2;
              const x0 = 50 + Math.cos(a0) * 47;
              const y0 = 50 + Math.sin(a0) * 47;
              const x1 = 50 + Math.cos(a1) * 47;
              const y1 = 50 + Math.sin(a1) * 47;
              return (
                <path
                  key={i}
                  d={`M50 50 L${x0} ${y0} A47 47 0 0 1 ${x1} ${y1} Z`}
                  fill={
                    i % 2 === 0
                      ? "rgb(var(--color-bear))"
                      : "rgb(var(--color-text-primary))"
                  }
                  fillOpacity="0.85"
                />
              );
            })}
            <circle cx="50" cy="50" r="20" fill="rgb(var(--color-gold))" />
            <circle
              cx="50"
              cy="50"
              r="20"
              fill="none"
              stroke="rgb(var(--color-surface-raised))"
              strokeWidth="2"
            />
          </svg>
        </div>
      </Frame>
    );
  };
}

export function getCasinoLevelIllustration(
  ctx: LevelIllustrationContext,
): IllustrationComponent | null {
  const i = Math.max(0, ctx.levelIndex);
  switch (ctx.motif) {
    case "probability":
      return DiceScene(i);
    case "mentalMath":
      return ChipStackScene(i);
    case "brainteasers":
      return CardFanScene(i);
    case "interviewGames":
      return CardFanScene(i + 2);
    case "calibration":
      return WheelScene();
    default:
      return null;
  }
}
