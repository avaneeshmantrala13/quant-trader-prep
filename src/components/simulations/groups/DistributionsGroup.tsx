/**
 * DistributionsGroup — the "Distributions & the Central Limit Theorem" section
 * of the Simulations tab. Renders three interactive, seedable sims:
 *   • binomial          — empirical vs exact binomial pmf
 *   • clt               — sample means of a lumpy source becoming a bell curve
 *   • order-statistics  — distribution of the min / max / median of n uniforms
 *
 * All numeric work lives in `@/lib/simulations/distributions`; this file is
 * pure presentation (controls + charts + readouts) using the shared themed
 * SimCard / LineChart / BarChart primitives and semantic theme tokens.
 */
import { useMemo, useState } from "react";
import { SIM_BY_ID } from "@/lib/simulations/catalog";
import { SimCard } from "@/components/simulations/SimCard";
import { LineChart } from "@/components/simulations/charts/LineChart";
import { BarChart } from "@/components/simulations/charts/BarChart";
import {
  binomialPmf,
  simulateBinomialCounts,
  simulateSampleMeans,
  sourceMean,
  sourceVariance,
  normalPdf,
  histogramProportions,
  orderStatisticPdf,
  orderStatisticMean,
  simulateOrderStatistic,
} from "@/lib/simulations/distributions";
import type {
  SourceKind,
  OrderStatisticKind,
} from "@/lib/simulations/distributions";

const MAX_SAMPLES = 20000;

/* ---------------------------------------------------------------------------
 *  Small shared control primitives (kept local to this group).
 * ------------------------------------------------------------------------ */

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}

function Slider(props: SliderProps): JSX.Element {
  const { label, value, min, max, step = 1, onChange, format } = props;
  return (
    <label className="block space-y-1">
      <span className="flex items-baseline justify-between gap-3">
        <span className="label">{label}</span>
        <span className="num text-sm text-primary">
          {format ? format(value) : value}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-accent"
      />
    </label>
  );
}

interface ReadoutProps {
  items: { label: string; value: string }[];
}

function Readout(props: ReadoutProps): JSX.Element {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-sm bg-surface-muted px-4 py-3">
      {props.items.map((it) => (
        <div key={it.label} className="space-y-0.5">
          <div className="label">{it.label}</div>
          <div className="num text-base text-primary">{it.value}</div>
        </div>
      ))}
    </div>
  );
}

function RunAgainButton({ onClick }: { onClick: () => void }): JSX.Element {
  return (
    <button type="button" className="btn-secondary" onClick={onClick}>
      Run again
    </button>
  );
}

/* ---------------------------------------------------------------------------
 *  BINOMIAL
 * ------------------------------------------------------------------------ */

function BinomialSim(): JSX.Element {
  const meta = SIM_BY_ID["binomial"];
  const [n, setN] = useState(20);
  const [p, setP] = useState(0.35);
  const [samples, setSamples] = useState(4000);
  const [seed, setSeed] = useState(1);

  const { bars, empMean } = useMemo(() => {
    const props = simulateBinomialCounts(n, p, Math.min(samples, MAX_SAMPLES), seed);
    const pmf = binomialPmf(n, p);
    const built = props.map((prop, k) => ({
      label: String(k),
      value: prop,
      theoretical: pmf[k],
    }));
    let m = 0;
    for (let k = 0; k < props.length; k++) m += k * props[k];
    return { bars: built, empMean: m };
  }, [n, p, samples, seed]);

  const peakIndex = Math.min(bars.length - 1, Math.max(0, Math.round(n * p)));

  return (
    <SimCard
      id={meta.id}
      title={meta.title}
      whatShows={meta.whatShows}
      topics={meta.topics}
      howToRead="Each bar is how often you observed k successes; the dashed markers are the exact binomial pmf. More samples ⇒ the bars converge onto the markers, and the whole distribution is centered near its mean n·p."
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Slider label="Trials per draw (n)" value={n} min={1} max={40} onChange={setN} />
          <Slider
            label="Success prob (p)"
            value={p}
            min={0}
            max={1}
            step={0.01}
            onChange={setP}
            format={(v) => v.toFixed(2)}
          />
          <Slider
            label="Samples"
            value={samples}
            min={100}
            max={MAX_SAMPLES}
            step={100}
            onChange={setSamples}
            format={(v) => v.toLocaleString()}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <RunAgainButton onClick={() => setSeed((s) => s + 1)} />
        </div>
        <BarChart
          bars={bars}
          yLabel="proportion"
          theoreticalAs="marker"
          maxXLabels={14}
          formatY={(y) => y.toFixed(2)}
          annotations={[
            {
              barIndex: peakIndex,
              side: "up",
              text: "peak near n·p",
            },
          ]}
          ariaLabel={`Empirical proportions of successes over ${samples} draws of ${n} Bernoulli(${p}) trials, with the exact binomial pmf overlaid as markers.`}
        />
        <Readout
          items={[
            { label: "Empirical mean", value: empMean.toFixed(3) },
            { label: "Theoretical n·p", value: (n * p).toFixed(3) },
          ]}
        />
      </div>
    </SimCard>
  );
}

/* ---------------------------------------------------------------------------
 *  CENTRAL LIMIT THEOREM
 * ------------------------------------------------------------------------ */

const CLT_BINS = 24;

function cltDomain(kind: SourceKind, param: number): [number, number] {
  switch (kind) {
    case "uniform":
      return [0, 1];
    case "bernoulli":
      return [0, 1];
    case "dice":
      return [1, param];
  }
}

function CltSim(): JSX.Element {
  const meta = SIM_BY_ID["clt"];
  const [kind, setKind] = useState<SourceKind>("dice");
  const [param, setParam] = useState(6); // bernoulli p (×100) or dice faces
  const [sampleSize, setSampleSize] = useState(10);
  const [numSamples, setNumSamples] = useState(4000);
  const [seed, setSeed] = useState(1);

  const bernoulliP = kind === "bernoulli" ? param / 100 : param;

  const { empSeries, normalSeries, empMean, sd } = useMemo(() => {
    const effectiveParam = kind === "bernoulli" ? param / 100 : param;
    const means = simulateSampleMeans(
      kind,
      effectiveParam,
      sampleSize,
      Math.min(numSamples, MAX_SAMPLES),
      seed,
    );
    const [lo, hi] = cltDomain(kind, effectiveParam);
    const binWidth = (hi - lo) / CLT_BINS;
    const hist = histogramProportions(means, CLT_BINS, [lo, hi]);
    // Convert fraction-per-bin to a density so it shares the pdf's y-axis.
    const emp = hist.map((b) => ({ x: b.center, y: b.prop / binWidth }));

    const mu = sourceMean(kind, effectiveParam);
    const sigma = Math.sqrt(sourceVariance(kind, effectiveParam) / sampleSize);
    const normal = hist.map((b) => ({
      x: b.center,
      y: normalPdf(b.center, mu, sigma),
    }));

    const overall = means.length
      ? means.reduce((a, b) => a + b, 0) / means.length
      : 0;
    return { empSeries: emp, normalSeries: normal, empMean: overall, sd: sigma };
  }, [kind, param, sampleSize, numSamples, seed]);

  const [lo, hi] = cltDomain(kind, bernoulliP);
  const mu = sourceMean(kind, bernoulliP);
  const bellPeak = normalSeries.length
    ? Math.max(...normalSeries.map((pt) => pt.y))
    : 0;

  return (
    <SimCard
      id={meta.id}
      title={meta.title}
      whatShows={meta.whatShows}
      topics={meta.topics}
      howToRead="Each point is how often a sample mean landed in that bin (a density); the dashed curve is the limiting normal. Larger sample size n ⇒ the histogram tightens into a smoother, more normal bell — always centered on the true mean μ, with spread σ = sd/√n."
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block space-y-1">
            <span className="label">Source</span>
            <select
              className="input"
              value={kind}
              onChange={(e) => {
                const k = e.target.value as SourceKind;
                setKind(k);
                if (k === "dice") setParam(6);
                else if (k === "bernoulli") setParam(40);
              }}
            >
              <option value="uniform">Uniform(0,1)</option>
              <option value="bernoulli">Bernoulli(p)</option>
              <option value="dice">Dice (1..m)</option>
            </select>
          </label>

          {kind === "bernoulli" ? (
            <Slider
              label="Bernoulli p"
              value={param}
              min={1}
              max={99}
              onChange={setParam}
              format={(v) => (v / 100).toFixed(2)}
            />
          ) : kind === "dice" ? (
            <Slider label="Faces (m)" value={param} min={2} max={20} onChange={setParam} />
          ) : (
            <div className="flex items-end">
              <p className="text-sm text-muted">No parameter for uniform.</p>
            </div>
          )}

          <Slider
            label="Sample size (n)"
            value={sampleSize}
            min={1}
            max={50}
            onChange={setSampleSize}
          />
          <Slider
            label="# sample means"
            value={numSamples}
            min={200}
            max={MAX_SAMPLES}
            step={200}
            onChange={setNumSamples}
            format={(v) => v.toLocaleString()}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <RunAgainButton onClick={() => setSeed((s) => s + 1)} />
          <p className="text-sm text-muted">
            Larger n ⇒ tighter bell (σ shrinks like 1/√n).
          </p>
        </div>
        <LineChart
          series={[
            { points: empSeries, colorClass: "stroke-accent", width: 2, label: "empirical" },
            {
              points: normalSeries,
              colorClass: "stroke-bear",
              dashed: true,
              width: 2,
              label: "normal",
            },
          ]}
          xDomain={[lo, hi]}
          xLabel="sample mean"
          yLabel="density"
          annotations={[
            {
              x: mu,
              y: bellPeak,
              side: "up",
              text: "bell centers on μ; tighter as n grows",
            },
          ]}
          formatX={(x) => x.toFixed(2)}
          ariaLabel="Histogram of sample means (density) with the limiting normal curve overlaid."
        />
        <Readout
          items={[
            { label: "Empirical mean", value: empMean.toFixed(3) },
            { label: "Theoretical μ", value: sourceMean(kind, bernoulliP).toFixed(3) },
            { label: "σ = sd/√n", value: sd.toFixed(3) },
          ]}
        />
      </div>
    </SimCard>
  );
}

/* ---------------------------------------------------------------------------
 *  ORDER STATISTICS
 * ------------------------------------------------------------------------ */

const OS_BINS = 30;

function OrderStatisticsSim(): JSX.Element {
  const meta = SIM_BY_ID["order-statistics"];
  const [kind, setKind] = useState<OrderStatisticKind>("max");
  const [n, setN] = useState(8);
  const [samples, setSamples] = useState(4000);
  const [seed, setSeed] = useState(1);

  const { empSeries, pdfSeries, empMean } = useMemo(() => {
    const vals = simulateOrderStatistic(kind, n, Math.min(samples, MAX_SAMPLES), seed);
    const binWidth = 1 / OS_BINS;
    const hist = histogramProportions(vals, OS_BINS, [0, 1]);
    const emp = hist.map((b) => ({ x: b.center, y: b.prop / binWidth }));

    const xs: number[] = [];
    for (let i = 0; i < 80; i++) xs.push(i / 79);
    const pdf = xs.map((x) => ({ x, y: orderStatisticPdf(kind, n, x) }));

    const overall = vals.length
      ? vals.reduce((a, b) => a + b, 0) / vals.length
      : 0;
    return { empSeries: emp, pdfSeries: pdf, empMean: overall };
  }, [kind, n, samples, seed]);

  const theoMean = orderStatisticMean(kind, n);
  const pdfPeak = pdfSeries.length
    ? Math.max(...pdfSeries.map((pt) => pt.y))
    : 0;
  const concentrateText =
    kind === "max"
      ? "the max piles up near 1"
      : kind === "min"
        ? "the min piles up near 0"
        : "the median clusters near ½";

  return (
    <SimCard
      id={meta.id}
      title={meta.title}
      whatShows={meta.whatShows}
      topics={meta.topics}
      howToRead={`The curve is the density of the ${kind} of n uniforms. With more samples the empirical line matches the theoretical pdf, and as n grows the extremes concentrate near the edge — ${concentrateText}.`}
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block space-y-1">
            <span className="label">Statistic</span>
            <select
              className="input"
              value={kind}
              onChange={(e) => setKind(e.target.value as OrderStatisticKind)}
            >
              <option value="min">Minimum</option>
              <option value="max">Maximum</option>
              <option value="median">Median</option>
            </select>
          </label>
          <Slider label="Sample size (n)" value={n} min={1} max={25} onChange={setN} />
          <Slider
            label="Samples"
            value={samples}
            min={200}
            max={MAX_SAMPLES}
            step={200}
            onChange={setSamples}
            format={(v) => v.toLocaleString()}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <RunAgainButton onClick={() => setSeed((s) => s + 1)} />
        </div>
        <LineChart
          series={[
            { points: empSeries, colorClass: "stroke-accent", width: 2, label: "empirical" },
            {
              points: pdfSeries,
              colorClass: "stroke-bear",
              dashed: true,
              width: 2,
              label: "theoretical pdf",
            },
          ]}
          xDomain={[0, 1]}
          xLabel="statistic value"
          yLabel="density"
          annotations={[
            {
              x: theoMean,
              y: pdfPeak * 0.6,
              side: theoMean > 0.5 ? "left" : "right",
              text: concentrateText,
            },
          ]}
          formatX={(x) => x.toFixed(2)}
          ariaLabel={`Empirical density of the ${kind} of ${n} uniforms with the theoretical pdf overlaid.`}
        />
        <Readout
          items={[
            { label: "Empirical mean", value: empMean.toFixed(3) },
            { label: "Theoretical mean", value: orderStatisticMean(kind, n).toFixed(3) },
          ]}
        />
      </div>
    </SimCard>
  );
}

/* ---------------------------------------------------------------------------
 *  GROUP
 * ------------------------------------------------------------------------ */

export function DistributionsGroup(): JSX.Element {
  return (
    <div className="space-y-6">
      <BinomialSim />
      <CltSim />
      <OrderStatisticsSim />
    </div>
  );
}
