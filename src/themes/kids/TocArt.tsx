import type { ReactElement } from "react";
import type { MotifKey } from "@/types/content";
import { Cheeks, Eyes, INK, Smile } from "./animations";

/**
 * Charming little cartoon art used by the Kids Table-of-Contents: one friendly
 * mascot "sticker" per motif (reusing the shared face primitives so it matches
 * the map board + station landmarks), plus a candy star for difficulty/progress
 * and a bunting swag for the page header. All outlines use the adaptive "ink"
 * token so lines never vanish in light or dark.
 */

const RED = "#ff6b6b";
const YEL = "#ffd93d";
const GRN = "#57c785";
const BLU = "#5aa9ff";
const PUR = "#a78bfa";
const ORG = "#ff9f45";
const PNK = "#f472b6";
const CRM = "#fff4e0";
const GOLD = "#ffcf4d";

type MascotProps = { className?: string };

/** probability — a grinning die. */
function DieMascot({ className }: MascotProps) {
  return (
    <svg viewBox="0 0 72 72" className={className} aria-hidden="true">
      <rect x={12} y={12} width={48} height={48} rx={14} fill={BLU} stroke={INK} strokeWidth={3} />
      <circle cx={22} cy={22} r={3} fill={CRM} />
      <circle cx={50} cy={22} r={3} fill={CRM} />
      <Cheeks cx={36} cy={44} gap={19} r={4.5} />
      <Eyes cx={36} cy={34} gap={11} r={7} blink />
      <Smile cx={36} cy={46} w={12} depth={7} />
    </svg>
  );
}

/** mentalMath — a happy calculator. */
function CalcMascot({ className }: MascotProps) {
  return (
    <svg viewBox="0 0 72 72" className={className} aria-hidden="true">
      <rect x={16} y={10} width={40} height={52} rx={11} fill={GRN} stroke={INK} strokeWidth={3} />
      <rect x={22} y={16} width={28} height={16} rx={5} fill="#eafff2" stroke={INK} strokeWidth={2} />
      <Eyes cx={36} cy={24} gap={8} r={4.5} blink />
      {[0, 1, 2].map((r) =>
        [0, 1, 2].map((c) => (
          <rect key={`${r}-${c}`} x={23 + c * 9} y={38 + r * 7} width={6} height={5} rx={1.6} fill={[YEL, RED, BLU, ORG, PUR, GRN, PNK, YEL, RED][r * 3 + c]} stroke={INK} strokeWidth={1} />
        )),
      )}
    </svg>
  );
}

/** brainteasers — a bright idea lightbulb. */
function BulbMascot({ className }: MascotProps) {
  return (
    <svg viewBox="0 0 72 72" className={className} aria-hidden="true">
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => {
        const a = (deg * Math.PI) / 180;
        return (
          <line
            key={i}
            x1={36 + Math.cos(a) * 26}
            y1={32 + Math.sin(a) * 26}
            x2={36 + Math.cos(a) * 32}
            y2={32 + Math.sin(a) * 32}
            stroke="#ffb703"
            strokeWidth={3}
            strokeLinecap="round"
          />
        );
      })}
      <circle cx={36} cy={30} r={20} fill={YEL} stroke={INK} strokeWidth={3} />
      <rect x={28} y={48} width={16} height={9} rx={3} fill="#c9d1d9" stroke={INK} strokeWidth={2.4} />
      <path d="M30 52 h12 M31 56 h10" stroke={INK} strokeWidth={1.6} strokeLinecap="round" />
      <Cheeks cx={36} cy={36} gap={15} r={4} />
      <Eyes cx={36} cy={28} gap={10} r={6} blink />
      <Smile cx={36} cy={38} w={11} depth={6} />
    </svg>
  );
}

/** interviewGames — a smiley playing card. */
function CardMascot({ className }: MascotProps) {
  return (
    <svg viewBox="0 0 72 72" className={className} aria-hidden="true">
      <rect x={16} y={10} width={40} height={52} rx={9} fill={CRM} stroke={INK} strokeWidth={3} />
      <path d="M25 22 c -3 -4 -8 -1 -8 3 c 0 4 8 8 8 8 c 0 0 8 -4 8 -8 c 0 -4 -5 -7 -8 -3 z" fill={RED} stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
      <Cheeks cx={38} cy={46} gap={16} r={4} />
      <Eyes cx={38} cy={38} gap={10} r={6} blink />
      <Smile cx={38} cy={48} w={11} depth={6} />
    </svg>
  );
}

/** calibration — a cheerful bullseye. */
function TargetMascot({ className }: MascotProps) {
  return (
    <svg viewBox="0 0 72 72" className={className} aria-hidden="true">
      <circle cx={36} cy={36} r={26} fill={RED} stroke={INK} strokeWidth={3} />
      <circle cx={36} cy={36} r={18} fill={CRM} stroke={INK} strokeWidth={2} />
      <circle cx={36} cy={36} r={10} fill={BLU} stroke={INK} strokeWidth={2} />
      <Eyes cx={36} cy={34} gap={7} r={4.5} blink />
      <Smile cx={36} cy={41} w={8} depth={5} />
    </svg>
  );
}

export const MOTIF_MASCOT: Record<
  MotifKey,
  (props: MascotProps) => ReactElement
> = {
  probability: DieMascot,
  mentalMath: CalcMascot,
  brainteasers: BulbMascot,
  interviewGames: CardMascot,
  calibration: TargetMascot,
};

/** A five-point candy star — filled (gold) or empty (outline). */
export function Star({
  filled,
  size = 16,
  className,
}: {
  filled: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M12 2 L15 9 L22.5 9.6 L16.8 14.5 L18.6 22 L12 17.8 L5.4 22 L7.2 14.5 L1.5 9.6 L9 9 Z"
        fill={filled ? GOLD : "rgb(var(--color-surface-muted))"}
        stroke={INK}
        strokeWidth={1.6}
        strokeLinejoin="round"
        opacity={filled ? 1 : 0.5}
      />
    </svg>
  );
}

/** A soft bunting swag of triangle flags for the page header. */
export function Bunting({ className }: { className?: string }) {
  const cols = [RED, YEL, GRN, BLU, PUR, ORG, RED, YEL, GRN, BLU, PUR, ORG];
  const n = cols.length;
  return (
    <svg viewBox="0 0 240 20" preserveAspectRatio="none" className={className} aria-hidden="true">
      <path d="M0 4 Q120 12 240 4" fill="none" stroke={INK} strokeWidth={1.4} opacity={0.55} />
      {cols.map((c, i) => {
        const x = (240 / n) * (i + 0.5);
        const y = 4 + Math.sin((i / (n - 1)) * Math.PI) * 5;
        return (
          <path key={i} d={`M${x - 8} ${y} L${x + 8} ${y} L${x} ${y + 12} Z`} fill={c} stroke={INK} strokeWidth={1} strokeLinejoin="round" opacity={0.85} />
        );
      })}
    </svg>
  );
}
