import { MASTERY_CI } from "./config";

/**
 * Beta-Binomial posterior machinery (Bayes Rules! ch.3; Jeffreys/binom.bayes,
 * PHASE_1 §1/§5). The per-topic success posterior is Beta(α,β); the mean is the
 * point accuracy estimate and the equal-tail credible interval gives the
 * uncertainty-aware "how good, how sure" used by the dashboard verdict.
 *
 * `regularizedIncompleteBeta` is the Lentz continued-fraction from Numerical
 * Recipes (betai / betacf), and `betaQuantile` inverts it by bisection. These
 * are the only numerically interesting functions here and are tested against
 * known closed-form values + a round-trip identity.
 */

const FPMIN = 1e-300;

// Lanczos approximation for ln Γ(x) (g=7, n=9 coefficients).
const LANCZOS_G = 7;
const LANCZOS_C = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028,
  771.32342877765313, -176.61502916214059, 12.507343278686905,
  -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];

/** ln Γ(x) via the Lanczos approximation (reflection for x < 0.5). */
export function lnGamma(x: number): number {
  if (x < 0.5) {
    return (
      Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x)
    );
  }
  let xx = x - 1;
  let a = LANCZOS_C[0];
  const t = xx + LANCZOS_G + 0.5;
  for (let i = 1; i < LANCZOS_G + 2; i++) {
    a += LANCZOS_C[i] / (xx + i);
  }
  return 0.5 * Math.log(2 * Math.PI) + (xx + 0.5) * Math.log(t) - t + Math.log(a);
}

// Continued-fraction evaluation of the incomplete beta (Numerical Recipes betacf).
function betacf(x: number, a: number, b: number): number {
  const MAXIT = 200;
  const EPS = 3e-12;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/**
 * Regularized incomplete beta I_x(a,b) via the Lentz continued fraction, using
 * the symmetry I_x(a,b) = 1 − I_{1−x}(b,a) for x > (a+1)/(a+b+2) (fast branch).
 */
export function regularizedIncompleteBeta(
  x: number,
  a: number,
  b: number,
): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lnBeta = lnGamma(a) + lnGamma(b) - lnGamma(a + b);
  const bt = Math.exp(a * Math.log(x) + b * Math.log(1 - x) - lnBeta);
  if (x < (a + 1) / (a + b + 2)) {
    return (bt * betacf(x, a, b)) / a;
  }
  return 1 - (bt * betacf(1 - x, b, a)) / b;
}

/**
 * Inverse regularized incomplete beta (quantile) by bisection on [0,1] until
 * |I_x − p| ≤ 1e-8 or 200 iterations.
 */
export function betaQuantile(p: number, a: number, b: number): number {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  let lo = 0;
  let hi = 1;
  let mid = 0.5;
  for (let i = 0; i < 200; i++) {
    mid = (lo + hi) / 2;
    const val = regularizedIncompleteBeta(mid, a, b);
    if (Math.abs(val - p) <= 1e-8) return mid;
    if (val < p) lo = mid;
    else hi = mid;
  }
  return mid;
}

/**
 * Posterior after one observation with optional per-step decay ρ applied to the
 * prior counts (default ρ=1 ⇒ no decay). Then α += y, β += (1 − y).
 */
export function betaUpdate(
  a: number,
  b: number,
  y: 0 | 1,
  rho = 1,
): { alpha: number; beta: number } {
  return { alpha: rho * a + y, beta: rho * b + (1 - y) };
}

/** Posterior mean a/(a+b). */
export function betaMean(a: number, b: number): number {
  return a / (a + b);
}

/** Equal-tail credible interval [lo, hi] at level `ci` (default MASTERY_CI) + mean. */
export function betaMeanCI(
  a: number,
  b: number,
  ci = MASTERY_CI,
): { mean: number; lo: number; hi: number } {
  const tail = (1 - ci) / 2;
  return {
    mean: betaMean(a, b),
    lo: betaQuantile(tail, a, b),
    hi: betaQuantile(1 - tail, a, b),
  };
}
