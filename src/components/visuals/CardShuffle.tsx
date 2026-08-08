import { useEffect, useMemo, useState, type CSSProperties } from "react";

/**
 * CARD-SHUFFLE INTRO — a dramatic, one-shot entrance flourish for the entry
 * screens (Landing / Login). It renders as a FIXED, viewport-centered overlay
 * that plays ONCE on mount and then clears itself away (fades/scales out and
 * unmounts), leaving the page underneath plain — no persistent fan of cards.
 *
 * A large deck of playing cards riffles in from two halves, gathers into a neat
 * stack, spreads WIDE with a slight overshoot, then the whole deck lifts and
 * dissolves. A nod to the "Quant Factory" trading-desk motif.
 *
 * Craft / performance notes:
 * - Pure CSS `transform` + `opacity` (GPU-friendly). No canvas, no rAF loop.
 *   The riffle is one keyframe (`qf-card-shuffle` in index.css) parameterised
 *   per card via CSS custom properties; the clear-away is one more keyframe.
 * - It is `pointer-events: none` for its entire life, so it never blocks clicks,
 *   and it fully UNMOUNTS when finished (a JS timer removes it from the tree).
 * - `prefers-reduced-motion`: we skip the whole thing and render NOTHING, so a
 *   reduced-motion user lands directly on the clean, plain entry screen.
 */

type Suit = "spade" | "diamond";

interface CardFace {
  rank: string;
  suit: Suit;
}

/** A composed hand — reads clearly as "playing cards", stays monochrome-ink. */
const HAND: CardFace[] = [
  { rank: "A", suit: "spade" },
  { rank: "K", suit: "diamond" },
  { rank: "Q", suit: "spade" },
  { rank: "10", suit: "diamond" },
  { rank: "J", suit: "spade" },
  { rank: "9", suit: "diamond" },
  { rank: "A", suit: "diamond" },
];

/**
 * Total lifetime of the intro (ms), kept in sync with the CSS timings:
 *   riffle 1.25s + last-card stagger (~0.36s) → settle ≈ 1.6s
 *   clear-away keyframe: delay 1.7s + duration 0.55s → done ≈ 2.25s
 * We unmount a hair after that.
 */
const INTRO_LIFETIME_MS = 2400;

function SuitGlyph({ suit, className }: { suit: Suit; className?: string }) {
  // In-house hairline/filled SVG pips (no emoji), tinted with the ink-blue
  // accent so the fan stays on-palette rather than red/black playing-card kitsch.
  if (suit === "spade") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
        <path d="M12 2C9 6 4 8.6 4 13a4.4 4.4 0 0 0 7.1 3.5c-.2 1.9-.9 3.2-2.1 4.5h6c-1.2-1.3-1.9-2.6-2.1-4.5A4.4 4.4 0 0 0 20 13c0-4.4-5-7-8-11Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <path d="M12 2 4 12l8 10 8-10Z" />
    </svg>
  );
}

interface CardStyle extends CSSProperties {
  "--from-x": string;
  "--from-y": string;
  "--from-r": string;
  "--fan-x": string;
  "--fan-y": string;
  "--fan-r": string;
  "--delay": string;
}

/** True when the user prefers reduced motion (guarded for SSR / tests). */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function CardShuffleIntro() {
  // Skip entirely under reduced motion — land straight on the plain screen.
  const [visible, setVisible] = useState(() => !prefersReducedMotion());

  useEffect(() => {
    if (!visible) return;
    const t = window.setTimeout(() => setVisible(false), INTRO_LIFETIME_MS);
    return () => window.clearTimeout(t);
  }, [visible]);

  const cards = useMemo(() => {
    const n = HAND.length;
    const mid = (n - 1) / 2;
    return HAND.map((face, i) => {
      const off = i - mid; // signed distance from the centre card
      // Final "held fan" — a big, confident spread with a downward parabola so
      // the outer cards dip like a real hand.
      const fanR = off * 9; // degrees
      const fanX = off * 62; // px
      const fanY = off * off * 6; // px (parabolic dip)
      // Riffle start: cards fly in from two alternating halves of the deck.
      const side = i % 2 === 0 ? -1 : 1;
      const style: CardStyle = {
        "--from-x": `${side * (300 + i * 16)}px`,
        "--from-y": `${-140 - i * 10}px`,
        "--from-r": `${side * (34 + i * 4)}deg`,
        "--fan-x": `${fanX}px`,
        "--fan-y": `${fanY}px`,
        "--fan-r": `${fanR}deg`,
        "--delay": `${i * 60}ms`,
        zIndex: i,
      };
      return { face, style, key: i };
    });
  }, []);

  if (!visible) return null;

  return (
    <div
      className="qf-intro pointer-events-none fixed inset-0 z-[70] grid place-items-center overflow-hidden"
      aria-hidden="true"
    >
      {/* Subtle paper wash that focuses the eye, then fades with the deck. */}
      <div className="qf-intro-backdrop absolute inset-0 bg-bg/70" />

      <div className="qf-intro-deck qf-shuffle relative grid place-items-center">
        {cards.map(({ face, style, key }) => (
          <div key={key} className="qf-shuffle-card" style={style}>
            <div className="qf-card">
              <span className="qf-card-corner qf-card-corner-tl">
                <span className="qf-card-rank">{face.rank}</span>
                <SuitGlyph suit={face.suit} className="qf-card-mini" />
              </span>
              <SuitGlyph suit={face.suit} className="qf-card-center" />
              <span className="qf-card-corner qf-card-corner-br">
                <span className="qf-card-rank">{face.rank}</span>
                <SuitGlyph suit={face.suit} className="qf-card-mini" />
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
