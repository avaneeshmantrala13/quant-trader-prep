/**
 * ============================================================================
 *  SIMULATIONS — JOINT DENSITY & DOUBLE INTEGRALS MODEL
 * ============================================================================
 * Pure, dependency-light math for the "Joint Distributions" group of the
 * Simulations tab: a bivariate-normal joint density f(x, y) over the plane and
 * the DOUBLE INTEGRAL of that density over a rectangular sub-region —
 *
 *     P((X, Y) ∈ region) = ∫∫_region f(x, y) dx dy
 *
 * i.e. the probability/volume trapped under the density surface above the
 * chosen rectangle. We provide three complementary views of that number:
 *   • an EXACT closed form when the two variables are independent (ρ = 0), the
 *     integral factorises into a product of two 1-D normal probabilities;
 *   • a deterministic NUMERICAL double integral (2-D composite Simpson) that
 *     works for any correlation ρ — this is the value the UI shows live;
 *   • a seedable MONTE-CARLO estimate (fraction of correlated draws that land
 *     in the region) so the empirical count can be watched converging onto it.
 *
 * No React / DOM here — everything is trivially unit-testable and reused by
 * `JointDensityGroup.tsx`.
 */
import { Rng } from "@/lib/rng";

/**
 * A bivariate normal (X, Y): marginal means/std-devs plus the correlation ρ.
 * ρ ∈ (−1, 1); ρ = 0 makes X and Y independent (the density factorises).
 */
export interface BivariateNormalParams {
  muX: number;
  muY: number;
  sigmaX: number;
  sigmaY: number;
  /** Correlation coefficient ρ ∈ (−1, 1). */
  rho: number;
}

/** An axis-aligned integration region [x0, x1] × [y0, y1]. */
export interface Region {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** A rectangular plotting window in data coordinates. */
export interface Domain {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

const INV_SQRT_2PI = 1 / Math.sqrt(2 * Math.PI);

/** Standard-normal pdf φ(z). */
function stdNormalPdf(z: number): number {
  return INV_SQRT_2PI * Math.exp(-0.5 * z * z);
}

/**
 * Standard-normal CDF Φ(z) via the Abramowitz & Stegun 7.1.26 erf
 * approximation (same convention as the content solvers). Accurate to ~1e-7.
 */
export function standardNormalCdf(z: number): number {
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

/**
 * The bivariate-normal joint density f(x, y). With standardised coordinates
 * zx = (x − μx)/σx, zy = (y − μy)/σy and correlation ρ:
 *
 *   f(x, y) = 1 / (2π σx σy √(1 − ρ²))
 *             · exp( − (zx² − 2ρ zx zy + zy²) / (2(1 − ρ²)) )
 *
 * The 1/(2π σx σy √(1−ρ²)) prefactor is exactly what makes the surface's total
 * volume ∫∫ f = 1.
 */
export function bivariateNormalPdf(
  x: number,
  y: number,
  p: BivariateNormalParams,
): number {
  const { muX, muY, sigmaX, sigmaY, rho } = p;
  const oneMinusRho2 = 1 - rho * rho;
  const zx = (x - muX) / sigmaX;
  const zy = (y - muY) / sigmaY;
  const norm =
    1 / (2 * Math.PI * sigmaX * sigmaY * Math.sqrt(oneMinusRho2));
  const exponent =
    -(zx * zx - 2 * rho * zx * zy + zy * zy) / (2 * oneMinusRho2);
  return norm * Math.exp(exponent);
}

/**
 * A sensible plotting window: each axis spans μ ± k·σ (default k = 3.4), which
 * captures ~99.9% of the marginal mass so the surface tails off inside frame.
 */
export function displayDomain(p: BivariateNormalParams, k = 3.4): Domain {
  return {
    xMin: p.muX - k * p.sigmaX,
    xMax: p.muX + k * p.sigmaX,
    yMin: p.muY - k * p.sigmaY,
    yMax: p.muY + k * p.sigmaY,
  };
}

/** A sampled density surface over a grid, ready for a heatmap render. */
export interface DensityGrid {
  /** The x sample coordinates (length nx, left→right). */
  xs: number[];
  /** The y sample coordinates (length ny, bottom→top). */
  ys: number[];
  /** z[j][i] = f(xs[i], ys[j]); row j indexes y, column i indexes x. */
  z: number[][];
  /** The largest density value on the grid (for colour normalisation). */
  zMax: number;
}

/**
 * Sample the joint density on an `nx × ny` grid across `domain` for the
 * heatmap. Cell centres are used so the shaded cells tile the window exactly.
 */
export function densityGrid(
  p: BivariateNormalParams,
  domain: Domain,
  nx: number,
  ny: number,
): DensityGrid {
  const xs: number[] = new Array(nx);
  const ys: number[] = new Array(ny);
  const dx = (domain.xMax - domain.xMin) / nx;
  const dy = (domain.yMax - domain.yMin) / ny;
  for (let i = 0; i < nx; i++) xs[i] = domain.xMin + (i + 0.5) * dx;
  for (let j = 0; j < ny; j++) ys[j] = domain.yMin + (j + 0.5) * dy;

  const z: number[][] = new Array(ny);
  let zMax = 0;
  for (let j = 0; j < ny; j++) {
    const row = new Array<number>(nx);
    for (let i = 0; i < nx; i++) {
      const v = bivariateNormalPdf(xs[i], ys[j], p);
      row[i] = v;
      if (v > zMax) zMax = v;
    }
    z[j] = row;
  }
  return { xs, ys, z, zMax };
}

/**
 * DOUBLE INTEGRAL of the density over a rectangular region via 2-D composite
 * Simpson's rule (deterministic, no RNG). This is the probability/volume
 * ∫∫_region f(x, y) dx dy = P((X, Y) ∈ region), valid for ANY correlation ρ.
 *
 * `subdivisions` is forced even (Simpson needs an even count per axis). The
 * default (120) integrates a Gaussian to well under 1e-4 absolute error.
 */
export function rectProbability(
  p: BivariateNormalParams,
  region: Region,
  subdivisions = 120,
): number {
  const x0 = Math.min(region.x0, region.x1);
  const x1 = Math.max(region.x0, region.x1);
  const y0 = Math.min(region.y0, region.y1);
  const y1 = Math.max(region.y0, region.y1);
  if (x1 <= x0 || y1 <= y0) return 0;

  const n = subdivisions % 2 === 0 ? subdivisions : subdivisions + 1;
  const hx = (x1 - x0) / n;
  const hy = (y1 - y0) / n;

  // Simpson weight for node index i over [0, n]: 1 at the ends, 4 at odd
  // interior nodes, 2 at even interior nodes.
  const w = (i: number): number => {
    if (i === 0 || i === n) return 1;
    return i % 2 === 1 ? 4 : 2;
  };

  let sum = 0;
  for (let j = 0; j <= n; j++) {
    const y = y0 + j * hy;
    const wy = w(j);
    for (let i = 0; i <= n; i++) {
      const x = x0 + i * hx;
      sum += w(i) * wy * bivariateNormalPdf(x, y, p);
    }
  }
  const integral = ((hx * hy) / 9) * sum;
  // Guard tiny negative/over-unit drift from floating-point accumulation.
  return Math.min(1, Math.max(0, integral));
}

/**
 * EXACT rectangle probability when X and Y are INDEPENDENT (ρ = 0): the double
 * integral separates into a product of two 1-D normal-interval probabilities,
 *   P = [Φ(zx1) − Φ(zx0)] · [Φ(zy1) − Φ(zy0)].
 * Used to validate the numerical integrator; only correct at ρ = 0.
 */
export function rectProbabilityIndependent(
  p: BivariateNormalParams,
  region: Region,
): number {
  const x0 = Math.min(region.x0, region.x1);
  const x1 = Math.max(region.x0, region.x1);
  const y0 = Math.min(region.y0, region.y1);
  const y1 = Math.max(region.y0, region.y1);
  const px =
    standardNormalCdf((x1 - p.muX) / p.sigmaX) -
    standardNormalCdf((x0 - p.muX) / p.sigmaX);
  const py =
    standardNormalCdf((y1 - p.muY) / p.sigmaY) -
    standardNormalCdf((y0 - p.muY) / p.sigmaY);
  return px * py;
}

/** One correlated draw (X, Y) from the bivariate normal. */
export interface JointSample {
  x: number;
  y: number;
  /** Whether this draw landed inside the current integration region. */
  inside: boolean;
}

/** The result of a Monte-Carlo estimate of the region's probability. */
export interface MonteCarloResult {
  /** Number of draws that landed inside the region. */
  inside: number;
  /** Total draws taken. */
  total: number;
  /** Empirical P((X, Y) ∈ region) = inside / total. */
  proportion: number;
  /** A capped sample of draws for the scatter overlay. */
  points: JointSample[];
}

/**
 * Draw two independent standard normals via the Box–Muller transform.
 * Returns them as a pair so a single `rng.next()` cadence stays reproducible.
 */
function standardNormalPair(rng: Rng): [number, number] {
  // Avoid log(0) by nudging u1 off exactly zero.
  const u1 = Math.max(rng.next(), 1e-12);
  const u2 = rng.next();
  const r = Math.sqrt(-2 * Math.log(u1));
  return [r * Math.cos(2 * Math.PI * u2), r * Math.sin(2 * Math.PI * u2)];
}

/**
 * Monte-Carlo estimate of P((X, Y) ∈ region): draw `samples` correlated points
 * from the bivariate normal and count the fraction inside the rectangle.
 * Correlation is induced by the Cholesky map
 *   X = μx + σx·z1,   Y = μy + σy·(ρ·z1 + √(1−ρ²)·z2)
 * on independent standard normals z1, z2. The `proportion` is computed over ALL
 * draws, but at most `maxPoints` (default 1200) are returned for display.
 * Deterministic for a given `seed`.
 */
export function monteCarloRectProbability(
  p: BivariateNormalParams,
  region: Region,
  samples: number,
  seed: number,
  maxPoints = 1200,
): MonteCarloResult {
  const rng = new Rng(seed);
  const n = Math.max(0, Math.floor(samples));
  const x0 = Math.min(region.x0, region.x1);
  const x1 = Math.max(region.x0, region.x1);
  const y0 = Math.min(region.y0, region.y1);
  const y1 = Math.max(region.y0, region.y1);
  const chol = Math.sqrt(Math.max(0, 1 - p.rho * p.rho));

  // Keep points spaced out so the overlay is a representative thinned sample.
  const keepEvery = n > maxPoints ? Math.ceil(n / maxPoints) : 1;
  const points: JointSample[] = [];
  let inside = 0;
  for (let i = 0; i < n; i++) {
    const [z1, z2] = standardNormalPair(rng);
    const x = p.muX + p.sigmaX * z1;
    const y = p.muY + p.sigmaY * (p.rho * z1 + chol * z2);
    const isIn = x >= x0 && x <= x1 && y >= y0 && y <= y1;
    if (isIn) inside++;
    if (i % keepEvery === 0 && points.length < maxPoints) {
      points.push({ x, y, inside: isIn });
    }
  }
  return {
    inside,
    total: n,
    proportion: n > 0 ? inside / n : 0,
    points,
  };
}

/**
 * A marginal-mass check on a single axis: P(a ≤ X ≤ b) for the X marginal
 * (X ~ N(μx, σx²)). Handy for the annotation that the region's row/column
 * "shadows" onto each axis are ordinary 1-D normal probabilities.
 */
export function marginalXProbability(
  p: BivariateNormalParams,
  a: number,
  b: number,
): number {
  return (
    standardNormalCdf((Math.max(a, b) - p.muX) / p.sigmaX) -
    standardNormalCdf((Math.min(a, b) - p.muX) / p.sigmaX)
  );
}

/** As {@link marginalXProbability} but for the Y marginal N(μy, σy²). */
export function marginalYProbability(
  p: BivariateNormalParams,
  a: number,
  b: number,
): number {
  return (
    standardNormalCdf((Math.max(a, b) - p.muY) / p.sigmaY) -
    standardNormalCdf((Math.min(a, b) - p.muY) / p.sigmaY)
  );
}

/** Peak density value at the mode (x, y) = (μx, μy) — used to scale contours. */
export function peakDensity(p: BivariateNormalParams): number {
  return bivariateNormalPdf(p.muX, p.muY, p);
}

/** Re-export for callers that want the pdf height at a point without the peak. */
export { stdNormalPdf };
