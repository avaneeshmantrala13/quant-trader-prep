import type { ReactNode } from "react";
import type {
  IllustrationComponent,
  LevelIllustrationContext,
} from "../types";

/**
 * Per-motif lesson-briefing illustrations for the Cyberpunk theme — clean neon
 * line-art framed as a lit SHOPFRONT WINDOW on the night-alley, inheriting the
 * theme via CSS-variable strokes so it reads bright neon-on-blue-black (dark)
 * and deep ink-on-dusk (light). Keyed by track motif; a hanging neon marquee
 * caption gives each its street sign.
 */

const CYAN = "rgb(var(--color-accent))";
const MAGENTA = "rgb(var(--color-accent-2))";
const INK = "rgb(var(--color-border-strong))";
const MUTED = "rgb(var(--color-text-muted))";
const GREEN = "rgb(var(--color-bull))";
const RAISED = "rgb(var(--color-surface-raised))";

const WRAP =
  "relative w-full max-w-md overflow-hidden rounded-md border border-accent/50 bg-surface-raised p-3";

function Frame({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <figure
      className={className ? `${WRAP} ${className}` : WRAP}
      style={{ boxShadow: "0 0 18px rgb(var(--color-accent) / 0.18), inset 0 0 24px rgb(var(--color-accent) / 0.05)" }}
    >
      {/* neon dusk wash behind the window */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 60% 60% at 12% 0%, rgb(var(--color-accent) / 0.12) 0%, transparent 60%)," +
            "radial-gradient(ellipse 60% 60% at 92% 100%, rgb(var(--color-accent-2) / 0.12) 0%, transparent 60%)",
        }}
      />
      <svg viewBox="0 0 200 120" className="relative h-auto w-full" role="img">
        {children}
      </svg>
      <figcaption
        className="relative mt-1 font-mono text-[10px] uppercase tracking-[0.28em] text-accent"
        style={{ textShadow: "0 0 10px rgb(var(--color-accent) / 0.5)" }}
      >
        {label}
      </figcaption>
    </figure>
  );
}

/** Probability — a neon event tree / signal-flow graph. */
const ProbabilityTree: IllustrationComponent = ({ className }) => (
  <Frame label="// odds parlor" className={className}>
    <g stroke={CYAN} strokeWidth={1.3} fill="none" strokeLinecap="round">
      <line x1={20} y1={60} x2={70} y2={30} />
      <line x1={20} y1={60} x2={70} y2={90} />
      <line x1={70} y1={30} x2={130} y2={18} />
      <line x1={70} y1={30} x2={130} y2={46} />
      <line x1={70} y1={90} x2={130} y2={74} />
      <line x1={70} y1={90} x2={130} y2={102} />
    </g>
    <g stroke={MAGENTA} strokeWidth={1.1} strokeDasharray="3 3">
      <line x1={130} y1={18} x2={180} y2={18} />
      <line x1={130} y1={46} x2={180} y2={46} />
      <line x1={130} y1={74} x2={180} y2={74} />
      <line x1={130} y1={102} x2={180} y2={102} />
    </g>
    {[
      [20, 60],
      [70, 30],
      [70, 90],
      [130, 18],
      [130, 46],
      [130, 74],
      [130, 102],
    ].map(([cx, cy], i) => (
      <circle key={i} cx={cx} cy={cy} r={3.2} fill={RAISED} stroke={CYAN} strokeWidth={1.4} />
    ))}
    <text x={74} y={24} fontSize={8} fill={MUTED} fontFamily="var(--font-mono)">
      p
    </text>
  </Frame>
);

/** Mental math — a neon ALU / calculator core. */
const ComputeCore: IllustrationComponent = ({ className }) => (
  <Frame label="// number bar" className={className}>
    <rect x={60} y={26} width={80} height={68} rx={4} fill={RAISED} stroke={MAGENTA} strokeWidth={1.6} />
    <text x={100} y={70} textAnchor="middle" fontFamily="var(--font-display)" fontSize={26} fontWeight={800} fill={CYAN}>
      Σ
    </text>
    <g stroke={CYAN} strokeWidth={1.2}>
      {[40, 54, 68].map((y, i) => (
        <line key={`l${i}`} x1={40} y1={y} x2={60} y2={y} />
      ))}
      {[40, 54, 68].map((y, i) => (
        <line key={`r${i}`} x1={140} y1={y} x2={160} y2={y} />
      ))}
    </g>
    <g fill={GREEN}>
      <circle cx={40} cy={40} r={2.4} />
      <circle cx={160} cy={54} r={2.4} />
    </g>
  </Frame>
);

/** Brainteasers — a neon cyber-lock / gate. */
const CyberLock: IllustrationComponent = ({ className }) => (
  <Frame label="// the lockup" className={className}>
    <rect x={72} y={54} width={56} height={44} rx={5} fill={RAISED} stroke={CYAN} strokeWidth={1.6} />
    <path d="M82 54 V40 Q82 22 100 22 Q118 22 118 40 V54" fill="none" stroke={MAGENTA} strokeWidth={1.8} />
    <circle cx={100} cy={72} r={6} fill="none" stroke={CYAN} strokeWidth={1.6} />
    <line x1={100} y1={72} x2={100} y2={86} stroke={CYAN} strokeWidth={1.6} />
    <g stroke={GREEN} strokeWidth={1.1} strokeDasharray="3 3">
      <line x1={40} y1={64} x2={72} y2={64} />
      <line x1={128} y1={64} x2={160} y2={64} />
    </g>
  </Frame>
);

/** Interview games — a neon market terminal (candles + book). */
const MarketTerminal: IllustrationComponent = ({ className }) => (
  <Frame label="// trading floor" className={className}>
    <rect x={16} y={14} width={168} height={92} rx={4} fill={RAISED} stroke={CYAN} strokeWidth={1.4} />
    <line x1={16} y1={30} x2={184} y2={30} stroke={INK} strokeWidth={0.8} opacity={0.5} />
    {(
      [
        [40, 40, 78, 50, true],
        [60, 34, 66, 44, false],
        [80, 46, 88, 54, true],
        [100, 32, 60, 42, true],
        [120, 44, 80, 50, false],
      ] as [number, number, number, number, boolean][]
    ).map(([x, top, bot, bodyTop, up], i) => {
      const col = up ? GREEN : MAGENTA;
      return (
        <g key={i} stroke={col} strokeWidth={1.3}>
          <line x1={x} y1={top} x2={x} y2={bot} />
          <rect x={x - 4} y={bodyTop} width={8} height={16} fill={col} fillOpacity={0.35} stroke={col} />
        </g>
      );
    })}
    {/* order book on the right */}
    {[40, 50, 68, 78].map((y, i) => (
      <rect key={i} x={150} y={y} width={26} height={7} fill={y > 60 ? GREEN : MAGENTA} fillOpacity={0.3} stroke={y > 60 ? GREEN : MAGENTA} strokeWidth={0.8} />
    ))}
  </Frame>
);

/** Calibration — a neon confidence gauge. */
const CalibrationGauge: IllustrationComponent = ({ className }) => (
  <Frame label="// the odds board" className={className}>
    <path d="M40 92 A60 60 0 0 1 160 92" fill="none" stroke={CYAN} strokeWidth={1.6} />
    {Array.from({ length: 9 }, (_, i) => {
      const a = Math.PI - (i / 8) * Math.PI;
      const r1 = 60;
      const r0 = i % 2 === 0 ? 50 : 54;
      return (
        <line
          key={i}
          x1={100 + Math.cos(a) * r1}
          y1={92 - Math.sin(a) * r1}
          x2={100 + Math.cos(a) * r0}
          y2={92 - Math.sin(a) * r0}
          stroke={MAGENTA}
          strokeWidth={1.1}
        />
      );
    })}
    <line x1={100} y1={92} x2={134} y2={54} stroke={CYAN} strokeWidth={2} strokeLinecap="round" className="cp-anim cp-pulse" />
    <circle cx={100} cy={92} r={4} fill={CYAN} />
    <text x={30} y={106} fontSize={8} fill={MUTED} fontFamily="var(--font-mono)">
      0%
    </text>
    <text x={158} y={106} fontSize={8} fill={MUTED} fontFamily="var(--font-mono)">
      100%
    </text>
  </Frame>
);

const BY_MOTIF: Record<LevelIllustrationContext["motif"], IllustrationComponent> =
  {
    probability: ProbabilityTree,
    mathQuestions: ComputeCore,
    mentalMath: ComputeCore,
    brainteasers: CyberLock,
    interviewGames: MarketTerminal,
    calibration: CalibrationGauge,
  };

export function getCyberpunkIllustration(
  ctx: LevelIllustrationContext,
): IllustrationComponent | null {
  return BY_MOTIF[ctx.motif] ?? null;
}
