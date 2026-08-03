import Fraction from "fraction.js";

/**
 * Exact solvers for common-value / winner's-curse auction reasoning.
 *
 * The whole point of the winner's curse is that a naive bidder who bids their
 * (unbiased) signal OVERPAYS, because *winning* is bad news about the common
 * value V: you only win when your signal was the highest, and the highest of n
 * noisy signals systematically overstates V. Every quantity here is derived
 * with EXACT rationals (`fraction.js`) from a clean discrete/uniform model, so
 * ground-truth answers are exact and never hardcoded.
 *
 * MODEL (order-statistic / "wallet" common-value auction):
 *   - A common value V (in $) is unknown.
 *   - Each of n bidders observes an independent, UNBIASED signal s = V + ε,
 *     where the noise ε is uniform on the integer dollars {−m, …, m}
 *     (K = 2m+1 equally-likely atoms, mean 0).
 *   - Bids increase in the signal, so you win exactly when YOUR signal is the
 *     highest of the n. Conditional on winning, your own noise is distributed
 *     as the MAXIMUM of n i.i.d. noises, hence
 *         E[V | you won] = s − E[max of n noises].
 *     The amount to SHADE your bid below your signal is exactly
 *         shade(m, n) = E[max of n noises] ≥ 0,
 *     which increases (weakly) with n — the more rivals you beat, the worse the
 *     news, so the more you must shade.
 *
 * ACQUIRING-A-COMPANY MODEL (a second, purely-conditional family):
 *   - A firm's value V is uniform on the integers {0, 1, …, M}.
 *   - The owner sells iff V ≤ b (your bid), so you win exactly when V is low.
 *   - Conditional on winning, E[V | V ≤ b] = b/2 — half of what you offered —
 *     which is why a synergy multiple must exceed 2× for any positive bid to be
 *     +EV.
 */

/** Convenience Fraction constructor (mirrors interviewGames/tradingSolvers). */
export const F = (n: number | string, d?: number): Fraction =>
  d === undefined ? new Fraction(n as never) : new Fraction(n as never, d);

/** Exact integer power (base, exp small here — kept exact, no float pow). */
function ipow(base: number, exp: number): number {
  let r = 1;
  for (let i = 0; i < exp; i++) r *= base;
  return r;
}

/** The noise support {−m, …, m} as an explicit ascending integer list. */
export function noiseSupport(m: number): number[] {
  const out: number[] = [];
  for (let v = -m; v <= m; v++) out.push(v);
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Order-statistic winner's-curse model                                       */
/* -------------------------------------------------------------------------- */

/**
 * Exact E[max of n i.i.d. draws] from uniform noise on {−m, …, m}.
 *
 * With K = 2m+1 atoms, index j = v+m ∈ {0, …, 2m} so value v = j−m and the
 * number of atoms ≤ v is (j+1). Then
 *   P(max ≤ v) = ((j+1)/K)^n,   P(max = v) = ((j+1)^n − j^n)/K^n,
 *   E[max]     = Σ_j (j−m)·((j+1)^n − j^n) / K^n   (an exact rational).
 * For n = 1 this is 0 (the symmetric mean); it is strictly increasing in n.
 */
export function expectedMaxOfN(m: number, n: number): Fraction {
  const K = 2 * m + 1;
  const den = ipow(K, n);
  let num = 0;
  for (let j = 0; j <= 2 * m; j++) {
    const atomsWithThisMax = ipow(j + 1, n) - ipow(j, n);
    num += (j - m) * atomsWithThisMax;
  }
  return F(num, den);
}

/** By symmetry E[min of n] = −E[max of n] (the "loser's blessing"). */
export function expectedMinOfN(m: number, n: number): Fraction {
  return expectedMaxOfN(m, n).neg();
}

/**
 * How much to shade your bid below your signal to neutralize the winner's
 * curse: exactly E[max of n noises]. Weakly increasing in n.
 */
export function winnersCurseShade(m: number, n: number): Fraction {
  return expectedMaxOfN(m, n);
}

/** E[V | you won with the highest of n signals] = signal − shade(m, n). */
export function evGivenWin(signal: number, m: number, n: number): Fraction {
  return F(signal).sub(expectedMaxOfN(m, n));
}

/**
 * Expected profit CONDITIONAL ON WINNING when you pay `bid` and your signal is
 * `signal`: E[V | win] − bid. Positive ⇒ the bid is +EV, negative ⇒ the bid
 * falls to the winner's curse.
 */
export function conditionalProfit(
  signal: number,
  bid: number,
  m: number,
  n: number,
): Fraction {
  return evGivenWin(signal, m, n).sub(F(bid));
}

/* -------------------------------------------------------------------------- */
/*  Acquiring-a-company model (uniform value, win iff V ≤ bid)                  */
/* -------------------------------------------------------------------------- */

/** Unconditional E[V] for V uniform on {0, …, M}: exactly M/2. */
export function acquireUnconditionalEv(M: number): Fraction {
  return F(M, 2);
}

/** E[V | V ≤ b] for V uniform on {0, …, M}: mean of {0, …, b} = b/2 (exact). */
export function acquireEvGivenWin(b: number): Fraction {
  return F(b, 2);
}

/**
 * Exact expected profit of bidding `b` (> 0) when a synergy multiple `f`
 * (= fNum/fDen) is applied to the value you win:
 *   P(win)·(f·E[V | win] − b) = ((b+1)/(M+1))·(f·b/2 − b).
 * Its SIGN equals the sign of (f/2 − 1), so any positive bid is +EV iff f > 2,
 * −EV iff f < 2, break-even iff f = 2 — independent of b and M.
 */
export function acquireExpectedProfit(
  M: number,
  b: number,
  fNum: number,
  fDen: number,
): Fraction {
  const pWin = F(b + 1, M + 1);
  const valueIfWin = F(fNum, fDen).mul(acquireEvGivenWin(b));
  return pWin.mul(valueIfWin.sub(F(b)));
}

/** True iff any positive bid is +EV in the acquiring-a-company model (f > 2). */
export function acquireIsPositiveEv(fNum: number, fDen: number): boolean {
  return fNum > 2 * fDen;
}

/* -------------------------------------------------------------------------- */
/*  Formatting                                                                 */
/* -------------------------------------------------------------------------- */

/** Round a Fraction to `dp` decimals as a Number (for numeric-mode answers). */
export function fracToRounded(f: Fraction, dp = 4): number {
  return Number(f.valueOf().toFixed(dp));
}
