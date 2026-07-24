import type { CSSProperties, ReactElement, ReactNode } from "react";
import { useMapTiles } from "../useMapTiles";

/**
 * CHALKBOARD MAP BOARD BACKGROUND — a professor's lecture slate (dark) / a
 * ruled composition page (light) densely covered in hand-drawn math that the
 * chalk level-path winds through. Shared across every chalkboard track.
 *
 * TILING (seamless, any height): the board height varies (levels × 138px), so
 * the scene is a stack of identical, self-contained 552px tiles positioned by
 * absolute top offset. Every chalk diagram sits FULLY inside its tile (never
 * crosses the 0/552 seam), and the continuous layers (ruled grid, chalk-dust
 * grain, margin rule) are drawn once at the root — so the repeat is seamless at
 * any height and the parent simply clips the excess. Consecutive tiles
 * alternate between two arrangements (A/B) so the loop never reads as a hard
 * repeat (we don't mirror, which would flip the formulas).
 *
 * LEGIBILITY: every chalk mark is a muted `--color-border-strong` ("ink":
 * chalk-white on the dark board, dark ink on the light page) at low opacity,
 * and the whole math scene is wrapped in a soft opacity so the path, level
 * numbers, lock/check, station art, and labels always stay WCAG-AA legible.
 *
 * MOTION: a signature chalk-draw-on (stroke-dashoffset) plays on a couple of
 * diagrams and a little chalk dust drifts — all transform/opacity/stroke-only,
 * lightweight, and frozen (fully-drawn) under `prefers-reduced-motion`.
 */

const TILE_H = 552; // 4 node-rows; diagrams sit fully inside → seamless stack
const MIN_TILES = 7; // first-paint / short-board floor; grows to fill any height

const INK = "rgb(var(--color-border-strong))";
const ACC = "rgb(var(--color-accent))"; // yellow chalk (dark) / red pen (light)
const BLU = "rgb(var(--color-accent-2))"; // blue chalk / ballpoint blue
const WRM = "rgb(var(--color-bear))"; // pink-red chalk

// Muted opacities keep the board firmly behind the nodes.
const LINE = 0.42; // primary chalk strokes
const FAINT = 0.28; // secondary strokes / rules
const TXT = 0.4; // chalk lettering

/* -------------------------------------------------------------------------- */
/*  Injected animation stylesheet (idempotent) — reduced-motion gated         */
/* -------------------------------------------------------------------------- */

const ANIM_CSS = `
@keyframes cbm-draw{0%{stroke-dashoffset:var(--dash);opacity:.12}12%{opacity:1}55%{stroke-dashoffset:0;opacity:1}90%{stroke-dashoffset:0;opacity:1}100%{stroke-dashoffset:0;opacity:.5}}
@keyframes cbm-drift{0%{transform:translate3d(0,0,0);opacity:0}18%{opacity:var(--o)}82%{opacity:var(--o)}100%{transform:translate3d(var(--dx),var(--dy),0);opacity:0}}
@keyframes cbm-tw{0%,100%{opacity:.2;transform:scale(.75)}50%{opacity:.7;transform:scale(1.12)}}
.cbm-draw{stroke-dasharray:var(--dash);stroke-dashoffset:0;animation:cbm-draw var(--dur,15s) ease-in-out infinite}
.cbm-mote{animation:cbm-drift var(--dur,24s) linear infinite}
.cbm-tw{transform-box:fill-box;transform-origin:center;animation:cbm-tw 3.2s ease-in-out infinite}
@media (prefers-reduced-motion: reduce){.cbm-draw,.cbm-mote,.cbm-tw{animation:none !important}}
`;

function ChalkAnimations() {
  return <style dangerouslySetInnerHTML={{ __html: ANIM_CSS }} />;
}

/* -------------------------------------------------------------------------- */
/*  Small chalk primitives                                                     */
/* -------------------------------------------------------------------------- */

function txt(
  x: number,
  y: number,
  s: number,
  content: ReactNode,
  color = INK,
  anchor: "start" | "middle" | "end" = "start",
): ReactElement {
  return (
    <text
      x={x}
      y={y}
      fontFamily="var(--font-display)"
      fontSize={s}
      fill={color}
      fillOpacity={TXT}
      textAnchor={anchor}
    >
      {content}
    </text>
  );
}

const draw = (dash: number, dur: string, delay = 0): CSSProperties =>
  ({
    ["--dash" as string]: dash,
    ["--dur" as string]: dur,
    animationDelay: `${delay}s`,
  }) as CSSProperties;

/* -------------------------------------------------------------------------- */
/*  Chalk diagrams (fixed-size, undistorted inline SVGs)                       */
/* -------------------------------------------------------------------------- */

// An underlined chalk section header in the display font.
function Header({ text, w = 154, color = INK }: { text: string; w?: number; color?: string }) {
  return (
    <svg width={w} height={32} viewBox={`0 0 ${w} 32`} aria-hidden="true">
      {txt(2, 19, 19, text, color)}
      <path
        d={`M2 25 q ${(w - 8) / 2} 6 ${w - 8} 0`}
        fill="none"
        stroke={color}
        strokeOpacity={LINE}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <path
        d={`M4 28.5 q ${(w - 8) / 2} 5 ${w - 10} 0`}
        fill="none"
        stroke={color}
        strokeOpacity={FAINT}
        strokeWidth={1}
        strokeLinecap="round"
      />
    </svg>
  );
}

// A branching probability tree (draws itself on).
function ProbTree() {
  const node = (x: number, y: number) => (
    <circle cx={x} cy={y} r={2.4} fill={INK} fillOpacity={LINE} />
  );
  return (
    <svg width={128} height={104} viewBox="0 0 128 104" aria-hidden="true">
      <g
        className="cbm-draw"
        style={draw(70, "16s")}
        stroke={INK}
        strokeOpacity={LINE}
        strokeWidth={1.7}
        fill="none"
        strokeLinecap="round"
      >
        <path d="M12 52 L56 24" />
        <path d="M12 52 L56 82" />
        <path d="M56 24 L112 12" />
        <path d="M56 24 L112 38" />
        <path d="M56 82 L112 70" />
        <path d="M56 82 L112 94" />
      </g>
      {node(12, 52)}
      {node(56, 24)}
      {node(56, 82)}
      {node(112, 12)}
      {node(112, 38)}
      {node(112, 70)}
      {node(112, 94)}
      {txt(30, 32, 11, "½", ACC)}
      {txt(30, 74, 11, "½", ACC)}
      {txt(82, 14, 9, "⅓", BLU)}
      {txt(82, 90, 9, "⅔", BLU)}
    </svg>
  );
}

// A normal curve with a shaded area, mean tick, and σ marks (draws on).
function BellCurve() {
  const curve = "M12 62 C40 62 45 16 66 16 C87 16 92 62 120 62";
  return (
    <svg width={132} height={78} viewBox="0 0 132 78" aria-hidden="true">
      <path
        d={`${curve} L120 62 L12 62 Z`}
        fill={ACC}
        fillOpacity={0.1}
        stroke="none"
      />
      <path d="M8 62 H124" stroke={INK} strokeOpacity={FAINT} strokeWidth={1.2} />
      <path
        className="cbm-draw"
        style={draw(210, "17s")}
        d={curve}
        fill="none"
        stroke={INK}
        strokeOpacity={LINE}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <path
        d="M66 20 V64"
        stroke={ACC}
        strokeOpacity={LINE}
        strokeWidth={1.2}
        strokeDasharray="2 3"
      />
      <path d="M44 60 V64 M88 60 V64" stroke={INK} strokeOpacity={FAINT} strokeWidth={1.1} />
      {txt(66, 74, 10, "μ", INK, "middle")}
    </svg>
  );
}

// Venn diagram for P(A∩B) (right lens draws on).
function Venn() {
  return (
    <svg width={122} height={92} viewBox="0 0 122 92" aria-hidden="true">
      <circle cx={46} cy={40} r={30} fill={BLU} fillOpacity={0.08} stroke={INK} strokeOpacity={LINE} strokeWidth={1.7} />
      <circle
        className="cbm-draw"
        style={draw(200, "18s")}
        cx={74}
        cy={40}
        r={30}
        fill="none"
        stroke={INK}
        strokeOpacity={LINE}
        strokeWidth={1.7}
      />
      {/* hatched intersection */}
      <g stroke={ACC} strokeOpacity={0.35} strokeWidth={1}>
        <path d="M54 24 L66 56 M60 22 L70 52 M50 30 L60 58" />
      </g>
      {txt(30, 44, 13, "A", INK)}
      {txt(84, 44, 13, "B", INK)}
      {txt(61, 88, 11, "P(A∩B)", INK, "middle")}
    </svg>
  );
}

// A pair of coins (H / T).
function Coins() {
  return (
    <svg width={92} height={56} viewBox="0 0 92 56" aria-hidden="true">
      <g stroke={INK} strokeOpacity={LINE} strokeWidth={1.7} fill="none">
        <circle cx={24} cy={26} r={17} />
        <circle cx={64} cy={30} r={15} />
      </g>
      <circle cx={24} cy={26} r={12.5} fill="none" stroke={ACC} strokeOpacity={0.3} strokeWidth={1} strokeDasharray="2 3" />
      {txt(24, 31, 15, "H", INK, "middle")}
      {txt(64, 35, 13, "T", WRM, "middle")}
    </svg>
  );
}

// Two dice.
function Dice() {
  const pip = (x: number, y: number) => <circle cx={x} cy={y} r={1.7} fill={INK} fillOpacity={LINE} />;
  return (
    <svg width={78} height={48} viewBox="0 0 78 48" aria-hidden="true">
      <g stroke={INK} strokeOpacity={LINE} strokeWidth={1.7} fill="none">
        <rect x={6} y={10} width={28} height={28} rx={5} />
        <rect x={44} y={6} width={26} height={26} rx={5} transform="rotate(8 57 19)" />
      </g>
      {pip(14, 18)}
      {pip(26, 18)}
      {pip(20, 24)}
      {pip(14, 30)}
      {pip(26, 30)}
      {pip(52, 14)}
      {pip(62, 24)}
    </svg>
  );
}

// Roulette / expected-value wheel doodle.
function Roulette() {
  const spokes: ReactElement[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    spokes.push(
      <line
        key={i}
        x1={34}
        y1={34}
        x2={34 + Math.cos(a) * 24}
        y2={34 + Math.sin(a) * 24}
        stroke={INK}
        strokeOpacity={FAINT}
        strokeWidth={1}
      />,
    );
  }
  return (
    <svg width={118} height={72} viewBox="0 0 118 72" aria-hidden="true">
      <circle cx={34} cy={34} r={24} fill="none" stroke={INK} strokeOpacity={LINE} strokeWidth={1.7} />
      <circle cx={34} cy={34} r={12} fill="none" stroke={INK} strokeOpacity={FAINT} strokeWidth={1.2} />
      {spokes}
      <circle cx={34} cy={34} r={2.4} fill={ACC} fillOpacity={LINE} />
      <path d="M62 30 h22" stroke={INK} strokeOpacity={LINE} strokeWidth={1.4} />
      <path d="M84 30 l-5 -3 M84 30 l-5 3" stroke={INK} strokeOpacity={LINE} strokeWidth={1.4} fill="none" />
      {txt(88, 26, 12, "E[X]", ACC)}
    </svg>
  );
}

// Tally marks.
function Tally() {
  const bundle = (ox: number) => (
    <g stroke={INK} strokeOpacity={LINE} strokeWidth={2} strokeLinecap="round">
      <path d={`M${ox} 6 V30 M${ox + 6} 6 V30 M${ox + 12} 6 V30 M${ox + 18} 6 V30`} />
      <path d={`M${ox - 3} 27 L${ox + 21} 9`} stroke={WRM} />
    </g>
  );
  return (
    <svg width={78} height={38} viewBox="0 0 78 38" aria-hidden="true">
      {bundle(8)}
      {bundle(38)}
    </svg>
  );
}

// A boxed derivation of Bayes' theorem with a ∴.
function BayesBox() {
  return (
    <svg width={166} height={54} viewBox="0 0 166 54" aria-hidden="true">
      <rect x={3} y={4} width={160} height={46} rx={6} fill="none" stroke={INK} strokeOpacity={FAINT} strokeWidth={1.4} />
      {txt(12, 24, 12, "∴", ACC)}
      {txt(26, 23, 12.5, "P(A|B) =", INK)}
      {txt(96, 17, 11, "P(B|A) P(A)", INK, "middle")}
      <path d="M62 26 H132" stroke={INK} strokeOpacity={LINE} strokeWidth={1.2} />
      {txt(96, 38, 11, "P(B)", INK, "middle")}
      {txt(150, 44, 10, "✓", BLU)}
    </svg>
  );
}

// E[X] = Σ x·p(x) with a tiny value/probability table.
function Expectation() {
  return (
    <svg width={150} height={70} viewBox="0 0 150 70" aria-hidden="true">
      {txt(4, 18, 14, "E[X] = Σ x·p(x)", INK)}
      <g stroke={INK} strokeOpacity={FAINT} strokeWidth={1}>
        <path d="M8 30 H120 M8 46 H120 M8 62 H120" />
        <path d="M8 30 V62 M64 30 V62 M120 30 V62" />
      </g>
      {txt(30, 42, 10, "x", INK, "middle")}
      {txt(92, 42, 10, "p", INK, "middle")}
      {txt(30, 58, 10, "1..6", INK, "middle")}
      {txt(92, 58, 10, "⅙", ACC, "middle")}
    </svg>
  );
}

// Binomial coefficient + a mini Pascal triangle.
function Binomial() {
  const dot = (x: number, y: number) => <circle cx={x} cy={y} r={1.8} fill={INK} fillOpacity={LINE} />;
  return (
    <svg width={140} height={66} viewBox="0 0 140 66" aria-hidden="true">
      {txt(2, 16, 12.5, "C(n,k) =", INK)}
      {txt(96, 11, 10.5, "n!", INK, "middle")}
      <path d="M74 15 H118" stroke={INK} strokeOpacity={LINE} strokeWidth={1.1} />
      {txt(96, 26, 10.5, "k!(n−k)!", INK, "middle")}
      <g>
        {dot(70, 38)}
        {dot(62, 48)}
        {dot(78, 48)}
        {dot(54, 58)}
        {dot(70, 58)}
        {dot(86, 58)}
      </g>
      {txt(108, 58, 9, "Pascal", BLU)}
    </svg>
  );
}

// A little histogram / bar chart.
function Histogram() {
  const bars = [16, 30, 42, 34, 22, 12];
  return (
    <svg width={96} height={62} viewBox="0 0 96 62" aria-hidden="true">
      <path d="M8 52 H90 M8 52 V8" stroke={INK} strokeOpacity={FAINT} strokeWidth={1.2} fill="none" />
      {bars.map((h, i) => (
        <rect
          key={i}
          x={12 + i * 13}
          y={52 - h}
          width={9}
          height={h}
          fill={i === 2 ? ACC : INK}
          fillOpacity={i === 2 ? 0.22 : 0.14}
          stroke={INK}
          strokeOpacity={LINE}
          strokeWidth={1.2}
        />
      ))}
    </svg>
  );
}

// Axes with a scatter and a chalk line of best fit.
function Scatter() {
  const pts: [number, number][] = [
    [20, 46], [30, 40], [40, 36], [52, 30], [62, 26], [74, 18],
  ];
  return (
    <svg width={100} height={64} viewBox="0 0 100 64" aria-hidden="true">
      <path d="M12 54 H92 M12 54 V6" stroke={INK} strokeOpacity={FAINT} strokeWidth={1.2} fill="none" strokeLinecap="round" />
      <path
        className="cbm-draw"
        style={draw(90, "14s")}
        d="M14 50 L90 14"
        stroke={ACC}
        strokeOpacity={LINE}
        strokeWidth={1.6}
        fill="none"
        strokeLinecap="round"
      />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={2} fill={INK} fillOpacity={LINE} />
      ))}
    </svg>
  );
}

// A big summation with limits.
function Sigma() {
  return (
    <svg width={74} height={64} viewBox="0 0 74 64" aria-hidden="true">
      {txt(10, 46, 46, "Σ", INK)}
      {txt(30, 14, 10, "n", INK)}
      {txt(28, 60, 10, "i=1", INK)}
      {txt(48, 40, 13, "pᵢxᵢ", ACC)}
    </svg>
  );
}

// A hand-drawn "∴ QED" flourish with a curved arrow.
function Qed() {
  return (
    <svg width={86} height={44} viewBox="0 0 86 44" aria-hidden="true">
      <path
        d="M6 30 C20 8 44 8 60 22"
        fill="none"
        stroke={INK}
        strokeOpacity={LINE}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeDasharray="1 4"
      />
      <path d="M60 22 l-7 -1 M60 22 l-2 -7" stroke={INK} strokeOpacity={LINE} strokeWidth={1.6} fill="none" strokeLinecap="round" />
      {txt(64, 34, 15, "∴", ACC)}
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  Placements within one 552px tile (left %, top px) — two arrangements       */
/* -------------------------------------------------------------------------- */

type Placement = { el: ReactElement; left: number; top: number };

const ARRANGE_A: Placement[] = [
  { el: <Header text="PROBABILITY" />, left: 3, top: 14 },
  { el: <ProbTree />, left: 60, top: 20 },
  { el: <Coins />, left: 34, top: 96 },
  { el: <BellCurve />, left: 6, top: 150 },
  { el: <Tally />, left: 82, top: 150 },
  { el: <Venn />, left: 52, top: 214 },
  { el: <Dice />, left: 8, top: 268 },
  { el: <BayesBox />, left: 30, top: 322 },
  { el: <Histogram />, left: 78, top: 300 },
  { el: <Sigma />, left: 10, top: 372 },
  { el: <Qed />, left: 60, top: 400 },
  { el: <Scatter />, left: 24, top: 446 },
  { el: <Binomial />, left: 62, top: 470 },
];

const ARRANGE_B: Placement[] = [
  { el: <Header text="EXPECTED VALUE" w={182} color={ACC} />, left: 4, top: 18 },
  { el: <Scatter />, left: 72, top: 20 },
  { el: <Expectation />, left: 34, top: 60 },
  { el: <Roulette />, left: 4, top: 128 },
  { el: <Venn />, left: 72, top: 120 },
  { el: <Binomial />, left: 36, top: 176 },
  { el: <Qed />, left: 12, top: 236 },
  { el: <BellCurve />, left: 56, top: 250 },
  { el: <Tally />, left: 84, top: 320 },
  { el: <ProbTree />, left: 8, top: 300 },
  { el: <BayesBox />, left: 44, top: 372 },
  { el: <Coins />, left: 6, top: 430 },
  { el: <Histogram />, left: 66, top: 430 },
  { el: <Dice />, left: 40, top: 470 },
];

function ChalkTile({ index }: { index: number }) {
  const arrangement = index % 2 === 0 ? ARRANGE_A : ARRANGE_B;
  return (
    <div className="absolute left-0 right-0" style={{ top: index * TILE_H, height: TILE_H }}>
      {arrangement.map((p, i) => (
        <div key={i} className="absolute" style={{ left: `${p.left}%`, top: p.top }}>
          {p.el}
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Drifting chalk dust                                                         */
/* -------------------------------------------------------------------------- */

interface Mote {
  left: string;
  top: string;
  size: number;
  dx: number;
  dy: number;
  dur: number;
  delay: number;
  o: string;
}

const MOTES: Mote[] = Array.from({ length: 12 }, (_, i) => {
  const r = (n: number) => {
    const s = Math.sin((i + 1) * n) * 43758.5453;
    return s - Math.floor(s);
  };
  return {
    left: `${Math.round(r(12.9898) * 100)}%`,
    top: `${Math.round(r(78.233) * 100)}%`,
    size: 1 + Math.round(r(37.719) * 2),
    dx: Math.round((r(4.17) - 0.5) * 70),
    dy: -Math.round(60 + r(9.13) * 140),
    dur: 20 + Math.round(r(1.7) * 16),
    delay: -Math.round(r(5.3) * 24),
    o: (0.08 + r(2.1) * 0.14).toFixed(2),
  };
});

function ChalkDust() {
  return (
    <div className="absolute inset-0">
      {MOTES.map((m, i) => (
        <span
          key={i}
          className="cbm-mote absolute rounded-full"
          style={
            {
              left: m.left,
              top: m.top,
              width: m.size,
              height: m.size,
              background: INK,
              ["--dx" as string]: `${m.dx}px`,
              ["--dy" as string]: `${m.dy}px`,
              ["--o" as string]: m.o,
              ["--dur" as string]: `${m.dur}s`,
              animationDelay: `${m.delay}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Root                                                                        */
/* -------------------------------------------------------------------------- */

export function ChalkboardMapBackground() {
  const [rootRef, tiles] = useMapTiles(TILE_H, MIN_TILES);
  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden"
    >
      <ChalkAnimations />

      {/* Slate / paper base wash with a soft lit vignette. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgb(var(--color-surface)) 0%, rgb(var(--color-surface-muted)) 100%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(130% 60% at 50% -8%, rgb(var(--color-surface-raised) / 0.5) 0%, transparent 62%)",
        }}
      />

      {/* Continuous ruled / graph grid (notebook + plotting paper). */}
      <div className="tex-grid absolute inset-0 opacity-40 dark:opacity-[0.22]" />

      {/* Red schoolhouse margin rule. */}
      <div
        className="absolute inset-y-0 left-[7%] w-px sm:left-[8.5%]"
        style={{ background: ACC, opacity: 0.22 }}
      />

      {/* Soft eraser sweep smudges (percentage-placed so they distribute). */}
      {[
        { t: "6%", l: "18%", w: 190, h: 50, r: -7 },
        { t: "30%", l: "64%", w: 210, h: 56, r: 6 },
        { t: "52%", l: "10%", w: 170, h: 48, r: -4 },
        { t: "74%", l: "62%", w: 200, h: 54, r: 8 },
        { t: "90%", l: "24%", w: 180, h: 48, r: -6 },
      ].map((s, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            top: s.t,
            left: s.l,
            width: s.w,
            height: s.h,
            transform: `rotate(${s.r}deg)`,
            borderRadius: "50%",
            background:
              "radial-gradient(closest-side, rgb(var(--color-border-strong) / 0.09), transparent)",
          }}
        />
      ))}

      {/* The dense hand-drawn math scene — muted so nodes/labels stay the focus. */}
      <div className="absolute inset-0 opacity-[0.5] dark:opacity-[0.42]">
        {Array.from({ length: tiles }, (_, k) => (
          <ChalkTile key={k} index={k} />
        ))}
      </div>

      {/* Drifting chalk dust. */}
      <ChalkDust />

      {/* Chalk-dust grain overlay driven by the theme grain token. */}
      <div
        className="absolute inset-0 mix-blend-screen"
        style={{
          opacity: "var(--grain-opacity)",
          backgroundImage:
            "radial-gradient(rgb(var(--color-border-strong) / 0.85) 0.5px, transparent 0.6px)",
          backgroundSize: "3px 3px",
        }}
      />

      {/* Wooden chalk tray along the very bottom edge, with chalk + eraser. */}
      <div
        className="absolute inset-x-0 bottom-0 h-3.5 sm:h-4"
        style={{
          background:
            "linear-gradient(to bottom, transparent, rgb(var(--color-surface-muted) / 0.95))",
          borderTop: "1.5px solid rgb(var(--color-border-strong) / 0.22)",
          boxShadow: "0 -1px 3px rgb(0 0 0 / 0.08)",
        }}
      />
      <div
        className="absolute bottom-1 left-[22%] h-1.5 w-11 rounded-full"
        style={{ background: "rgb(var(--color-border-strong) / 0.32)" }}
      />
      <div
        className="absolute bottom-1 left-[34%] h-1.5 w-7 rounded-full"
        style={{ background: "rgb(var(--color-accent) / 0.34)" }}
      />
      <div
        className="absolute bottom-1 left-[43%] h-1.5 w-6 rounded-full"
        style={{ background: "rgb(var(--color-accent-2) / 0.32)" }}
      />
      <div
        className="absolute bottom-[3px] right-[24%] h-2.5 w-9 rounded-[2px]"
        style={{
          background: "rgb(var(--color-surface-raised) / 0.85)",
          border: "1px solid rgb(var(--color-border-strong) / 0.25)",
        }}
      />
    </div>
  );
}
