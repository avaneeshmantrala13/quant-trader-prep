import type {
  IllustrationComponent,
  LevelIllustrationContext,
} from "../types";

/**
 * Per-level chalk-sketch diagrams for the Chalkboard theme. Each motif gets a
 * small hand-drawn diagram rendered in a framed "board panel" beneath the level
 * subtitle. Strokes use `--color-border-strong` (chalk-white on the dark board,
 * ink on the light page) with pastel-chalk accents, so both variants stay
 * high-contrast. Decorative only — `aria-hidden`.
 */

function BoardFrame({
  className,
  label,
  children,
}: {
  className?: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <figure
      className={`relative overflow-hidden rounded-md border border-border-strong/40 bg-surface-muted/60 p-4 ${className ?? ""}`}
    >
      <div className="tex-grid pointer-events-none absolute inset-0 opacity-20" />
      <svg
        aria-hidden="true"
        viewBox="0 0 320 150"
        className="relative mx-auto block h-auto w-full max-w-md"
        fill="none"
        stroke="rgb(var(--color-border-strong))"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </svg>
      <figcaption className="relative mt-2 text-center font-mono text-[11px] uppercase tracking-wide text-muted">
        {label}
      </figcaption>
    </figure>
  );
}

function chalkText(props: React.SVGProps<SVGTextElement>) {
  return (
    <text
      fontFamily="var(--font-display)"
      fill="rgb(var(--color-border-strong))"
      stroke="none"
      {...props}
    />
  );
}

// probability — a coin, a die, and a bell curve.
function ProbabilitySketch({ className }: { className?: string }) {
  return (
    <BoardFrame className={className} label="chance & counting">
      {/* coin */}
      <g strokeWidth={2}>
        <circle cx="56" cy="70" r="34" opacity={0.85} />
        <circle
          cx="56"
          cy="70"
          r="27"
          strokeWidth={1}
          strokeDasharray="2 4"
          opacity={0.5}
        />
      </g>
      {chalkText({ x: 56, y: 82, textAnchor: "middle", fontSize: 30, children: "½" })}
      {/* die */}
      <g strokeWidth={2} stroke="rgb(var(--color-accent-2))" opacity={0.95}>
        <rect x="128" y="44" width="52" height="52" rx="8" />
      </g>
      <g fill="rgb(var(--color-accent-2))" stroke="none" opacity={0.95}>
        <circle cx="142" cy="58" r="3.4" />
        <circle cx="166" cy="58" r="3.4" />
        <circle cx="154" cy="70" r="3.4" />
        <circle cx="142" cy="82" r="3.4" />
        <circle cx="166" cy="82" r="3.4" />
      </g>
      {/* bell curve */}
      <path
        d="M214 104 C244 104 250 40 276 40 C302 40 308 104 306 104"
        strokeWidth={2}
        stroke="rgb(var(--color-accent))"
        opacity={0.95}
      />
      <path d="M210 104 H312" strokeWidth={1.4} opacity={0.5} />
    </BoardFrame>
  );
}

// mentalMath — worked arithmetic on the board.
function MentalMathSketch({ className }: { className?: string }) {
  return (
    <BoardFrame className={className} label="fast arithmetic">
      {chalkText({
        x: 30,
        y: 56,
        fontSize: 30,
        children: "17 × 6",
      })}
      {chalkText({
        x: 30,
        y: 98,
        fontSize: 30,
        fill: "rgb(var(--color-accent))",
        children: "= 102",
      })}
      <path
        d="M32 108 C90 116 150 116 190 106"
        strokeWidth={2.4}
        stroke="rgb(var(--color-accent))"
        opacity={0.9}
      />
      {/* carry doodle arrow */}
      <path
        d="M210 40 C250 30 280 46 292 74"
        strokeWidth={1.8}
        stroke="rgb(var(--color-accent-2))"
        opacity={0.85}
      />
      <path
        d="M292 74 L286 62 M292 74 L300 66"
        strokeWidth={1.8}
        stroke="rgb(var(--color-accent-2))"
        opacity={0.85}
      />
      {chalkText({
        x: 224,
        y: 108,
        fontSize: 20,
        fill: "rgb(var(--color-accent-2))",
        children: "10×6+7×6",
      })}
    </BoardFrame>
  );
}

// brainteasers — a lightbulb with a spark.
function BrainteaserSketch({ className }: { className?: string }) {
  return (
    <BoardFrame className={className} label="lateral thinking">
      <g strokeWidth={2.2}>
        <path
          d="M160 34 C132 34 116 56 122 82 C126 100 142 104 144 118 L176 118 C178 104 194 100 198 82 C204 56 188 34 160 34 Z"
          opacity={0.9}
        />
        <path d="M146 124 H174" strokeWidth={2} opacity={0.8} />
        <path d="M150 132 H170" strokeWidth={2} opacity={0.8} />
      </g>
      <path
        d="M148 96 C152 82 168 82 172 96"
        strokeWidth={1.6}
        stroke="rgb(var(--color-accent))"
        opacity={0.9}
      />
      {/* spark rays */}
      <g strokeWidth={2} stroke="rgb(var(--color-accent))" opacity={0.85}>
        <path d="M160 14 V26" />
        <path d="M120 24 L128 34" />
        <path d="M200 24 L192 34" />
        <path d="M104 62 H116" />
        <path d="M204 62 H216" />
      </g>
    </BoardFrame>
  );
}

// interviewGames — a tiny extensive-form game tree.
function InterviewGamesSketch({ className }: { className?: string }) {
  return (
    <BoardFrame className={className} label="strategy & games">
      <g strokeWidth={2}>
        <path d="M40 75 L120 40" opacity={0.85} />
        <path d="M40 75 L120 110" opacity={0.85} />
        <path
          d="M120 40 L210 22"
          stroke="rgb(var(--color-accent))"
          opacity={0.9}
        />
        <path d="M120 40 L210 58" opacity={0.7} />
        <path d="M120 110 L210 92" opacity={0.7} />
        <path
          d="M120 110 L210 128"
          stroke="rgb(var(--color-accent))"
          opacity={0.9}
        />
      </g>
      <g fill="rgb(var(--color-border-strong))" stroke="none">
        <circle cx="40" cy="75" r="4" />
        <circle cx="120" cy="40" r="3.4" />
        <circle cx="120" cy="110" r="3.4" />
      </g>
      {chalkText({
        x: 224,
        y: 26,
        fontSize: 18,
        fill: "rgb(var(--color-accent))",
        children: "+2",
      })}
      {chalkText({ x: 224, y: 96, fontSize: 18, children: "−1" })}
      {chalkText({
        x: 224,
        y: 132,
        fontSize: 18,
        fill: "rgb(var(--color-accent))",
        children: "+3",
      })}
    </BoardFrame>
  );
}

// calibration — a confidence dial / dartboard.
function CalibrationSketch({ className }: { className?: string }) {
  return (
    <BoardFrame className={className} label="calibrated confidence">
      <g strokeWidth={2}>
        <circle cx="160" cy="86" r="52" opacity={0.85} />
        <circle cx="160" cy="86" r="34" strokeWidth={1.4} opacity={0.6} />
        <circle cx="160" cy="86" r="16" strokeWidth={1.4} opacity={0.6} />
      </g>
      <circle
        cx="160"
        cy="86"
        r="4"
        fill="rgb(var(--color-accent))"
        stroke="none"
      />
      {/* needle */}
      <path
        d="M160 86 L120 52"
        strokeWidth={2.4}
        stroke="rgb(var(--color-accent))"
        opacity={0.95}
      />
      {/* scale ticks */}
      <g strokeWidth={2} opacity={0.7}>
        <path d="M160 26 V36" />
        <path d="M220 86 H210" />
        <path d="M160 146 V136" />
        <path d="M100 86 H110" />
      </g>
      {chalkText({ x: 232, y: 90, fontSize: 16, children: "70%" })}
    </BoardFrame>
  );
}

const BY_MOTIF: Record<LevelIllustrationContext["motif"], IllustrationComponent> =
  {
    probability: ProbabilitySketch,
    mentalMath: MentalMathSketch,
    brainteasers: BrainteaserSketch,
    interviewGames: InterviewGamesSketch,
    calibration: CalibrationSketch,
  };

export function getChalkboardIllustration(
  ctx: LevelIllustrationContext,
): IllustrationComponent | null {
  return BY_MOTIF[ctx.motif] ?? null;
}
