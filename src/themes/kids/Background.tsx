import { INK, KidsAnimations } from "./animations";

/**
 * A gentle, playful backdrop: soft candy sky-blobs plus a slow parade of
 * floating cartoon props (coins, dice, balloons, clouds, confetti). Everything
 * is `pointer-events-none`, sits at `-z-10` behind all content, and is kept at
 * low opacity so text stays perfectly legible. Transform/opacity-only for 60fps;
 * the injected reduced-motion rule freezes it into a calm static scene.
 */

function Coin({ x, y, d, dur, delay }: { x: string; y: string; d: number; dur: number; delay: number }) {
  return (
    <div className="absolute" style={{ left: x, top: y }}>
      <div
        className="kids-anim"
        style={{ animation: `kids-float ${dur}s ease-in-out ${delay}s infinite` }}
      >
        <svg width={d} height={d} viewBox="0 0 40 40" aria-hidden="true">
          <circle cx={20} cy={20} r={17} fill="#ffcf4d" stroke={INK} strokeWidth={2.5} />
          <circle cx={20} cy={20} r={12} fill="none" stroke="#f5b021" strokeWidth={2} />
          <path d="M20 12 v16 M16 15 h6 a3 3 0 0 1 0 6 h-6 M16 21 h7 a3 3 0 0 1 0 6 h-7" fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}

function Balloon({ x, y, h, color, dur, delay }: { x: string; y: string; h: number; color: string; dur: number; delay: number }) {
  return (
    <div className="absolute" style={{ left: x, top: y }}>
      <div
        className="kids-anim"
        style={{ transformOrigin: "bottom center", animation: `kids-sway ${dur}s ease-in-out ${delay}s infinite` }}
      >
        <svg width={h * 0.7} height={h} viewBox="0 0 40 58" aria-hidden="true">
          <path d="M20 40 C 4 40 2 20 8 10 C 12 3 28 3 32 10 C 38 20 36 40 20 40 Z" fill={color} stroke={INK} strokeWidth={2.4} />
          <path d="M20 40 l-3 5 h6 z" fill={color} stroke={INK} strokeWidth={2} />
          <path d="M20 45 q6 6 -1 13" fill="none" stroke={INK} strokeWidth={1.6} />
          <ellipse cx={14} cy={16} rx={3} ry={5} fill="#ffffff" opacity={0.5} />
        </svg>
      </div>
    </div>
  );
}

function Dice({ x, y, d, dur, delay }: { x: string; y: string; d: number; dur: number; delay: number }) {
  return (
    <div className="absolute" style={{ left: x, top: y }}>
      <div
        className="kids-anim"
        style={{ transformBox: "fill-box", transformOrigin: "center", animation: `kids-tumble ${dur}s ease-in-out ${delay}s infinite` }}
      >
        <svg width={d} height={d} viewBox="0 0 40 40" aria-hidden="true">
          <rect x={5} y={5} width={30} height={30} rx={8} fill="#ff6b6b" stroke={INK} strokeWidth={2.5} />
          <circle cx={14} cy={14} r={3} fill="#fff" />
          <circle cx={26} cy={26} r={3} fill="#fff" />
          <circle cx={20} cy={20} r={3} fill="#fff" />
        </svg>
      </div>
    </div>
  );
}

function Cloud({ x, y, w, dur, delay }: { x: string; y: string; w: number; dur: number; delay: number }) {
  return (
    <div className="absolute" style={{ top: y, left: 0, right: 0 }}>
      <div
        className="kids-anim absolute"
        style={{ left: x, animation: `kids-driftX ${dur}s linear ${delay}s infinite` }}
      >
        <svg width={w} height={w * 0.6} viewBox="0 0 60 36" aria-hidden="true">
          <path d="M12 30 a10 10 0 0 1 2 -19 a12 12 0 0 1 22 -2 a9 9 0 0 1 12 21 z" fill="#ffffff" stroke={INK} strokeWidth={2.4} />
        </svg>
      </div>
    </div>
  );
}

function Confetti({ x, y, color, dur, delay }: { x: string; y: string; color: string; dur: number; delay: number }) {
  return (
    <div
      className="kids-anim absolute rounded-[2px]"
      style={{ left: x, top: y, width: 9, height: 9, background: color, transformOrigin: "center", animation: `kids-jiggle ${dur}s ease-in-out ${delay}s infinite` }}
    />
  );
}

export function KidsBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <KidsAnimations />

      {/* Soft candy sky wash — very low opacity so it never fights text */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(50% 40% at 15% 12%, rgba(90,169,255,0.14), transparent 70%)," +
            "radial-gradient(45% 40% at 88% 18%, rgba(255,157,177,0.14), transparent 70%)," +
            "radial-gradient(55% 45% at 80% 92%, rgba(87,199,133,0.12), transparent 70%)," +
            "radial-gradient(50% 45% at 10% 88%, rgba(167,139,250,0.12), transparent 70%)",
        }}
      />

      <div className="opacity-70 dark:opacity-50">
        <Cloud x="-10%" y="9%" w={78} dur={46} delay={0} />
        <Cloud x="-10%" y="26%" w={54} dur={64} delay={12} />
        <Cloud x="-10%" y="70%" w={66} dur={54} delay={26} />

        <Coin x="12%" y="30%" d={34} dur={7} delay={0} />
        <Coin x="82%" y="58%" d={28} dur={9} delay={1.5} />
        <Coin x="46%" y="80%" d={24} dur={8} delay={0.8} />

        <Dice x="86%" y="24%" d={34} dur={9} delay={0.4} />
        <Dice x="22%" y="66%" d={28} dur={11} delay={1.2} />

        <Balloon x="6%" y="52%" h={54} color="#57c785" dur={7} delay={0.6} />
        <Balloon x="90%" y="72%" h={46} color="#a78bfa" dur={8} delay={1.1} />
        <Balloon x="70%" y="6%" h={42} color="#ff9f45" dur={9} delay={0.2} />

        <Confetti x="34%" y="16%" color="#ffd93d" dur={3.2} delay={0} />
        <Confetti x="60%" y="40%" color="#5aa9ff" dur={3.8} delay={0.5} />
        <Confetti x="28%" y="46%" color="#f472b6" dur={3.4} delay={0.9} />
        <Confetti x="74%" y="86%" color="#57c785" dur={3.6} delay={0.3} />
      </div>
    </div>
  );
}
