/**
 * VennGroup — the "Core Probability" sims about two events sharing a sample
 * space:
 *
 *   • venn-two-events        — a live, themed Venn diagram: drag P(A), P(B) and
 *                              their overlap (clamped to the feasible range) and
 *                              read off the whole probability table, with
 *                              Independent / Mutually-exclusive presets & badges.
 *   • two-independent-events — Monte-Carlo two independent events and watch the
 *                              empirical P(A and B) settle onto P(A)·P(B).
 */
import { useMemo, useState } from "react";
import { SimCard } from "@/components/simulations/SimCard";
import { LineChart } from "@/components/simulations/charts/LineChart";
import { SIM_BY_ID } from "@/lib/simulations/catalog";
import { downsample, roundTo } from "@/lib/simulations/shared";
import {
  clampIntersection,
  independentIntersection,
  intersectionBounds,
  simulateTwoIndependent,
  vennMetrics,
} from "@/lib/simulations/venn";

const MAX_TRIALS = 20000;
const PLOT_POINTS = 200;

function pct(x: number): string {
  return `${roundTo(x * 100, 1)}%`;
}

export function VennGroup(): JSX.Element {
  return (
    <div className="space-y-6">
      <VennTwoEventsCard />
      <TwoIndependentEventsCard />
    </div>
  );
}

/* ========================================================================== */
/*  venn-two-events                                                            */
/* ========================================================================== */

function VennTwoEventsCard(): JSX.Element {
  const meta = SIM_BY_ID["venn-two-events"];
  const [pA, setPA] = useState(0.5);
  const [pB, setPB] = useState(0.4);
  const [pAnd, setPAnd] = useState(0.2);

  const [lo, hi] = intersectionBounds(pA, pB);
  const overlap = clampIntersection(pA, pB, pAnd);
  const m = vennMetrics({ pA, pB, pAnd: overlap });

  const setMarginalA = (next: number): void => {
    setPA(next);
    setPAnd(clampIntersection(next, pB, pAnd));
  };
  const setMarginalB = (next: number): void => {
    setPB(next);
    setPAnd(clampIntersection(pA, next, pAnd));
  };

  const rows: { label: string; value: number; hint: string }[] = [
    { label: "P(A)", value: pA, hint: "all of circle A" },
    { label: "P(B)", value: pB, hint: "all of circle B" },
    { label: "P(A ∪ B)", value: m.pOr, hint: "either event (union)" },
    { label: "P(A ∩ B)", value: m.pAnd, hint: "the overlap (both)" },
    { label: "P(only A)", value: m.pOnlyA, hint: "A but not B" },
    { label: "P(only B)", value: m.pOnlyB, hint: "B but not A" },
    { label: "P(neither)", value: m.pNeither, hint: "complement of A ∪ B" },
    { label: "P(A | B)", value: m.pAgivenB, hint: "A given B occurred" },
    { label: "P(B | A)", value: m.pBgivenA, hint: "B given A occurred" },
  ];

  return (
    <SimCard
      id={meta.id}
      title={meta.title}
      whatShows={meta.whatShows}
      topics={meta.topics}
      howToRead="The box is the whole sample space; the two shaded circles are events A and B and the darker lens where they cross is A∩B (both happen). Everything outside the circles is 'neither' (the complement of A∪B). Each cell below names one region: the union adds the circles but subtracts the double-counted overlap, and a conditional like P(A|B) rescales to just circle B."
    >
      <div className="grid gap-6 md:grid-cols-2">
        {/* ---- Controls ---- */}
        <div className="space-y-4">
          <Slider
            label="P(A)"
            value={pA}
            min={0}
            max={1}
            step={0.01}
            onChange={setMarginalA}
            display={pct(pA)}
          />
          <Slider
            label="P(B)"
            value={pB}
            min={0}
            max={1}
            step={0.01}
            onChange={setMarginalB}
            display={pct(pB)}
          />
          <div className="space-y-1">
            <Slider
              label="Overlap P(A ∩ B)"
              value={overlap}
              min={lo}
              max={hi}
              step={0.01}
              onChange={(v) => setPAnd(clampIntersection(pA, pB, v))}
              display={pct(overlap)}
              disabled={hi - lo < 1e-9}
            />
            <p className="text-xs text-muted">
              Feasible range: {pct(lo)} – {pct(hi)}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setPAnd(independentIntersection(pA, pB))}
            >
              Independent
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setPAnd(0)}
            >
              Mutually exclusive
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {m.independent ? (
              <span className="chip text-accent">Independent</span>
            ) : null}
            {m.mutuallyExclusive ? (
              <span className="chip text-accent">Mutually exclusive</span>
            ) : null}
          </div>
        </div>

        {/* ---- Diagram ---- */}
        <VennDiagram
          pA={pA}
          pB={pB}
          pAnd={overlap}
          pOnlyA={m.pOnlyA}
          pOnlyB={m.pOnlyB}
        />
      </div>

      {/* ---- Readout table (every region labeled + a plain-English hint) ---- */}
      <div className="panel-ruled mt-2 grid grid-cols-2 gap-x-6 gap-y-2 p-4 sm:grid-cols-3 lg:grid-cols-4">
        {rows.map((r) => (
          <div key={r.label} className="flex flex-col">
            <span className="label text-secondary">{r.label}</span>
            <span className="num text-primary">{pct(r.value)}</span>
            <span className="text-[10px] leading-tight text-muted">{r.hint}</span>
          </div>
        ))}
      </div>
    </SimCard>
  );
}

interface VennDiagramProps {
  pA: number;
  pB: number;
  pAnd: number;
  pOnlyA: number;
  pOnlyB: number;
}

/**
 * A purely qualitative themed Venn diagram. Both circles use a fixed radius; we
 * only move them horizontally so the overlap width tracks P(A∩B) relative to
 * the smaller event — this reads far better than area-accurate circles that
 * collapse to slivers at the extremes.
 */
function VennDiagram(props: VennDiagramProps): JSX.Element {
  const { pA, pB, pAnd, pOnlyA, pOnlyB } = props;

  const W = 320;
  const H = 200;
  const r = 62;
  const cy = H / 2;

  const [lo, hi] = intersectionBounds(pA, pB);
  // Overlap fraction: 0 (disjoint) → 1 (fully nested). Guard the degenerate
  // span where lo === hi so presets still render a sensible picture.
  const span = hi - lo;
  const frac = span < 1e-9 ? (hi > 1e-9 ? 1 : 0) : (pAnd - lo) / span;

  // Centre distance goes from 2r (just touching, no overlap) down to ~0.4r
  // (deep overlap). Clamp so circles never fully coincide.
  const minGap = 0.4 * r;
  const dist = 2 * r - frac * (2 * r - minGap);
  const cxA = W / 2 - dist / 2;
  const cxB = W / 2 + dist / 2;

  const disjoint = pAnd < 1e-9;

  return (
    <div className="flex flex-col items-center justify-center">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full max-w-[320px]"
        role="img"
        aria-label={`Venn diagram of two events A and B with overlap ${pct(
          pAnd,
        )}`}
      >
        <defs>
          {/* Intersection = circle A clipped to circle B. */}
          <clipPath id="venn-clip-b">
            <circle cx={cxB} cy={cy} r={r} />
          </clipPath>
        </defs>

        {/* Sample space + subtle "neither" fill */}
        <rect
          x={1}
          y={1}
          width={W - 2}
          height={H - 2}
          rx={8}
          className="fill-surface-muted stroke-border-strong"
          strokeWidth={1.5}
        />

        {/* Circle A */}
        <circle
          cx={cxA}
          cy={cy}
          r={r}
          className="fill-accent stroke-accent"
          fillOpacity={0.22}
          strokeWidth={1.5}
        />
        {/* Circle B */}
        <circle
          cx={cxB}
          cy={cy}
          r={r}
          className="fill-accent-2 stroke-accent-2"
          fillOpacity={0.22}
          strokeWidth={1.5}
        />

        {/* Intersection shading (A ∩ B) */}
        {!disjoint ? (
          <circle
            cx={cxA}
            cy={cy}
            r={r}
            clipPath="url(#venn-clip-b)"
            className="fill-accent"
            fillOpacity={0.4}
          />
        ) : null}

        {/* Region labels */}
        <text
          x={10}
          y={16}
          fontSize={10}
          className="fill-muted font-mono"
        >
          sample space
        </text>
        <text
          x={W - 10}
          y={H - 8}
          textAnchor="end"
          fontSize={10}
          className="fill-muted font-mono"
        >
          neither = {pct(1 - pA - pB + pAnd)}
        </text>
        <text
          x={cxA - r / 2}
          y={cy}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={16}
          className="fill-primary font-display font-bold"
        >
          A
        </text>
        <text
          x={cxB + r / 2}
          y={cy}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={16}
          className="fill-primary font-display font-bold"
        >
          B
        </text>
        {!disjoint ? (
          <text
            x={(cxA + cxB) / 2}
            y={cy}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={10}
            className="fill-primary font-mono"
          >
            A∩B
          </text>
        ) : null}
      </svg>
      <p className="mt-2 text-center text-xs text-muted">
        A only {pct(pOnlyA)} · overlap {pct(pAnd)} · B only {pct(pOnlyB)}
      </p>
    </div>
  );
}

/* ========================================================================== */
/*  two-independent-events                                                     */
/* ========================================================================== */

function TwoIndependentEventsCard(): JSX.Element {
  const meta = SIM_BY_ID["two-independent-events"];
  const [pA, setPA] = useState(0.5);
  const [pB, setPB] = useState(1 / 6);
  const [trials, setTrials] = useState(2000);
  const [seed, setSeed] = useState(1);

  // Precompute the running proportion at MAX trials, then slice to the slider.
  const fullSeries = useMemo(
    () => simulateTwoIndependent(pA, pB, MAX_TRIALS, seed),
    [pA, pB, seed],
  );

  const product = pA * pB;
  const slice = fullSeries.slice(0, trials);
  const empirical = slice.length > 0 ? slice[slice.length - 1] : 0;

  const points = useMemo(() => {
    const indexed = slice.map((y, i) => ({ x: i + 1, y }));
    return downsample(indexed, PLOT_POINTS);
  }, [slice]);

  const yMax = Math.min(1, Math.max(product * 2.5, empirical * 1.2, 0.1));

  return (
    <SimCard
      id={meta.id}
      title={meta.title}
      whatShows={meta.whatShows}
      topics={meta.topics}
      howToRead="The solid line is the empirical share of trials where BOTH events happened; the dashed line is the product P(A)·P(B). Because the events are independent, more trials ⇒ the empirical rate settles onto that product (the error shrinks toward 0)."
    >
      <p className="text-sm text-secondary">
        A = a fair coin lands <span className="text-accent">heads</span>, B = a
        fair die shows a <span className="text-accent-2">1</span>. The two draws
        are independent, so P(A and B) = P(A)·P(B). Simulate one trial many times
        and watch the empirical rate settle onto that product.
      </p>

      <div className="grid gap-4 md:grid-cols-3">
        <Slider
          label="P(A)"
          value={pA}
          min={0}
          max={1}
          step={0.01}
          onChange={setPA}
          display={pct(pA)}
        />
        <Slider
          label="P(B)"
          value={pB}
          min={0}
          max={1}
          step={0.01}
          onChange={setPB}
          display={pct(pB)}
        />
        <Slider
          label="Trials"
          value={trials}
          min={1}
          max={MAX_TRIALS}
          step={1}
          onChange={(v) => setTrials(Math.round(v))}
          display={trials.toLocaleString()}
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setSeed((s) => s + 1)}
        >
          Run again
        </button>
      </div>

      <LineChart
        series={[
          {
            points,
            colorClass: "stroke-accent",
            label: "Empirical P(A and B)",
          },
        ]}
        xLabel="trials"
        yLabel="P(A and B)"
        yDomain={[0, yMax]}
        refLines={[
          { y: product, label: "P(A)·P(B)", colorClass: "stroke-bear" },
        ]}
        annotations={[
          {
            x: Math.max(2, trials * 0.5),
            y: product,
            side: "up",
            text: "P(A)·P(B): the target it settles on",
          },
        ]}
        formatX={(x) => (x >= 1000 ? `${Math.round(x / 1000)}k` : String(x))}
        ariaLabel="Running empirical probability that both independent events occur, converging to the product of their probabilities."
      />

      <div className="panel-ruled grid grid-cols-2 gap-x-6 gap-y-2 p-4 sm:grid-cols-3">
        <div className="flex flex-col">
          <span className="label text-secondary">Empirical P(A and B)</span>
          <span className="num text-primary">{pct(empirical)}</span>
        </div>
        <div className="flex flex-col">
          <span className="label text-secondary">P(A)·P(B)</span>
          <span className="num text-accent">{pct(product)}</span>
        </div>
        <div className="flex flex-col">
          <span className="label text-secondary">Error</span>
          <span className="num text-primary">
            {pct(Math.abs(empirical - product))}
          </span>
        </div>
      </div>
    </SimCard>
  );
}

/* ========================================================================== */
/*  Shared control                                                             */
/* ========================================================================== */

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  display: string;
  disabled?: boolean;
}

function Slider(props: SliderProps): JSX.Element {
  const { label, value, min, max, step, onChange, display, disabled } = props;
  return (
    <label className="block space-y-1">
      <span className="label flex items-center justify-between text-secondary">
        <span>{label}</span>
        <span className="num text-primary">{display}</span>
      </span>
      <input
        type="range"
        className="w-full accent-accent"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
