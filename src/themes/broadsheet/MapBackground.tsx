import type { CSSProperties, ReactElement } from "react";
import {
  BullBear,
  CompassRose,
  Exchange,
  FauxColumns,
  INK,
  StockChart,
  TILE_H,
} from "./pageArt";
import { useMapTiles } from "../useMapTiles";

/**
 * BROADSHEET MAP BOARD — the level path threads DOWN a vintage financial
 * newspaper spread ("The Quant Ledger"). It's a full engraved page, not a
 * texture: an ornate masthead, five columns of faux justified body-type with
 * headline bars & drop-caps, 19th-century engravings as column art (bull & bear,
 * a stock-chart plate, a neoclassical exchange, a compass-rose statistics
 * figure), section rules with fleurons, a newsprint/halftone grain, and two
 * gently crawling ticker-tape strips.
 *
 * TILING: the board height varies (levels × 138px), so the page is a stack of
 * identical, SEAMLESS 552px "page" tiles (4 node-rows each). The vertical column
 * gutters are one continuous full-height gradient (never seams); each tile's
 * faux articles begin/end on a paragraph gap and are topped by a running-head
 * rule, so tile boundaries read as intentional page breaks. Engravings sit fully
 * inside a tile and MIRROR on alternate tiles so the repeat never reads as a
 * hard loop. The parent clips overflow; we render enough tiles for tall boards.
 *
 * LEGIBILITY: everything is monochrome "ink" at low opacity (and the whole page
 * is muted further in dark mode), so the amber path, level numbers, lock/check,
 * station art and labels on top always stay clearly legible / WCAG-AA. Motion is
 * transform-only and frozen under prefers-reduced-motion.
 */

const MIN_TILES = 6; // first-paint / short-board floor; grows to fill any height

const CSS = `
@keyframes qtp-bs-ticker{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@media (prefers-reduced-motion: reduce){.bs-anim{animation:none !important}}
`;

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

/* ------------------------------- small parts ----------------------------- */

function Fleuron({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke={INK} strokeWidth={0.9} aria-hidden="true">
      <path d="M6 0.8 L11.2 6 L6 11.2 L0.8 6 Z" />
      <circle cx="6" cy="6" r="0.7" fill={INK} stroke="none" />
    </svg>
  );
}

function Kicker({ label, left, top }: { label: string; left: number; top: number }) {
  return (
    <div className="absolute" style={{ left: `${left}%`, top }}>
      <span
        className="font-display text-[11px] font-black uppercase tracking-[0.16em]"
        style={{ color: INK, opacity: 0.24 }}
      >
        {label}
      </span>
    </div>
  );
}

/** A running-head rule marking the top of each page tile. */
function RunningHead() {
  return (
    <div className="absolute inset-x-6 top-2 flex items-center gap-2" style={{ opacity: 0.28 }}>
      <div className="h-px flex-1" style={{ background: INK }} />
      <span className="font-display text-[8px] uppercase tracking-[0.22em]" style={{ color: INK }}>
        The Quant Ledger
      </span>
      <div className="h-px flex-1" style={{ background: INK }} />
    </div>
  );
}

/** A mid-page section rule with a central fleuron. */
function SectionRule({ top }: { top: number }) {
  return (
    <div className="absolute inset-x-8 flex items-center gap-2" style={{ top, opacity: 0.24 }}>
      <div className="h-px flex-1" style={{ background: INK }} />
      <Fleuron />
      <div className="h-px flex-1" style={{ background: INK }} />
    </div>
  );
}

/* ------------------------------- one page tile --------------------------- */

type Placement = { el: ReactElement; left: number; top: number };

const PLATES: Placement[] = [
  { el: <BullBear w={128} />, left: 1, top: 40 },
  { el: <StockChart w={130} />, left: 72, top: 128 },
  { el: <Exchange w={118} />, left: 2, top: 330 },
  { el: <CompassRose w={92} />, left: 79, top: 406 },
];

const KICKERS: { label: string; left: number; top: number }[] = [
  { label: "Markets", left: 23, top: 18 },
  { label: "Commodities", left: 60, top: 250 },
  { label: "The Funds", left: 22, top: 300 },
  { label: "Dispatches", left: 44, top: 508 },
];

function PageTile({ index }: { index: number }) {
  const mirror = index % 2 === 1;
  return (
    <div className="absolute left-0 right-0" style={{ top: index * TILE_H, height: TILE_H }}>
      <FauxColumns />
      <RunningHead />
      <SectionRule top={276} />
      {/* Engravings mirror on alternate tiles so the repeat isn't obvious. */}
      <div
        className="absolute inset-0"
        style={mirror ? ({ transform: "scaleX(-1)" } as CSSProperties) : undefined}
      >
        {PLATES.map((p, i) => (
          <div key={i} className="absolute" style={{ left: `${p.left}%`, top: p.top }}>
            {p.el}
          </div>
        ))}
      </div>
      {/* Small-caps kickers stay un-mirrored so they read correctly. */}
      {KICKERS.map((k, i) => (
        <Kicker key={i} {...k} />
      ))}
    </div>
  );
}

/* --------------------------------- masthead ------------------------------ */

function Masthead() {
  return (
    <div className="absolute inset-x-0 top-0 flex flex-col items-center px-6 pt-1" style={{ opacity: 0.16 }}>
      <div className="flex w-full max-w-[520px] items-center gap-3">
        <div className="h-px flex-1" style={{ background: INK }} />
        <span className="font-mono text-[7px] uppercase tracking-[0.2em]" style={{ color: INK }}>
          Vol. MMXXVI · No. 1
        </span>
        <div className="h-px flex-1" style={{ background: INK }} />
      </div>
      <div
        className="font-display text-2xl font-black leading-none tracking-tight sm:text-3xl"
        style={{ color: "rgb(var(--color-text-primary))" }}
      >
        The Quant Ledger
      </div>
      <div className="mt-1 h-[3px] w-full max-w-[560px] border-y" style={{ borderColor: INK }} />
      <div className="mt-1 font-mono text-[7px] uppercase tracking-[0.24em]" style={{ color: INK }}>
        Markets · Probability · Estimation · Market Making
      </div>
    </div>
  );
}

/* --------------------------------- ticker -------------------------------- */

const TAPE =
  "AAPL 213.40 ▲   E[HH] 6.00   KELLY.f 0.20 ▼   BAYES 0.167 ▲   REROLL 4.25 ▲   σ(DIE) 1.708 ▼   COUPON 14.70 ▲   1/e 0.368   BALLOT 0.250 ▼   ANT.CUBE 10.0 ▲   ";

function Ticker({ top, dur, reverse = false }: { top: number | string; dur: number; reverse?: boolean }) {
  const line = (
    <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider" style={{ color: "rgb(var(--color-text-muted))" }}>
      {TAPE.repeat(4)}
    </span>
  );
  return (
    <div
      className="absolute inset-x-0 overflow-hidden border-y"
      style={{ top, height: 17, borderColor: "rgb(var(--color-border) / 0.6)", background: "rgb(var(--color-surface-muted) / 0.5)" }}
    >
      <div
        className="bs-anim flex w-max whitespace-nowrap"
        style={{ animation: `qtp-bs-ticker ${dur}s linear infinite`, animationDirection: reverse ? "reverse" : "normal", opacity: 0.5 }}
      >
        {line}
        {line}
      </div>
    </div>
  );
}

/* ---------------------------------- root --------------------------------- */

export function BroadsheetMapBackground() {
  const [rootRef, tiles] = useMapTiles(TILE_H, MIN_TILES);
  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden"
    >
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* Paper base (adaptive light/dark) */}
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(180deg, rgb(var(--color-surface)) 0%, rgb(var(--color-surface-muted)) 100%)" }}
      />
      {/* Halftone stipple (engraving plate feel) */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(rgb(var(--color-border-strong) / 0.5) 0.5px, transparent 0.6px)",
          backgroundSize: "6px 6px",
          opacity: 0.05,
        }}
      />
      {/* Continuous column gutters (seamless full height) */}
      <div
        className="absolute inset-0"
        style={{ backgroundImage: "repeating-linear-gradient(to right, rgb(var(--color-border) / 0.6) 0 1px, transparent 1px 20%)" }}
      />
      {/* Newsprint grain */}
      <div
        className="absolute inset-0"
        style={{ backgroundImage: GRAIN, backgroundRepeat: "repeat", backgroundSize: "150px 150px", opacity: 0.04 }}
      />

      {/* The engraved page, muted so the nodes/path stay the focus */}
      <div className="absolute inset-0 opacity-90 dark:opacity-70">
        {Array.from({ length: tiles }, (_, k) => (
          <PageTile key={k} index={k} />
        ))}
      </div>

      {/* One-off ornate masthead at the very top of the page */}
      <Masthead />

      {/* Gently crawling ticker-tape strips (reduced-motion-safe) */}
      <Ticker top={94} dur={80} />
      <Ticker top="64%" dur={104} reverse />
    </div>
  );
}
