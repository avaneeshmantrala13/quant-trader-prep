import type { Rng } from "@/lib/rng";
import type { NumericQuestion } from "@/types/content";
import type FractionType from "fraction.js";
import { F, chooseBig, decText, fracText, numDp } from "./combinatorics";
import { numericErrors } from "./_shared";
import { hyperAtLeastProb, hyperExactlyProb, hyperNoneProb } from "./solvers";

/**
 * Parametric numeric generators for the Probability & Statistics →
 * **Combinatorial Analysis** subcategory, FAMILY 2 (hypergeometric draws:
 * sampling WITHOUT replacement from a finite population split into "special" and
 * "ordinary" items).
 *
 * Every ground-truth answer comes straight from the EXACT solvers in
 * `./solvers.ts` (`hyperExactlyProb`, `hyperNoneProb`, `hyperAtLeastProb`) — the
 * generators never recompute a probability by hand. Each distractor
 * (`numeric` commonErrors) is a re-derived, NAMED misconception, guaranteed
 * finite, positive, and ≠ the answer at the grading precision (`numericErrors`
 * dedupes, drops non-finite/negative values, and never re-emits the answer).
 *
 * All items are freshly themed with objects and stories that do NOT appear in
 * the source dataset.
 */

/* ========================================================================== */
/* =================  1 — EXACTLY j SPECIAL (hypergeometric)  ============== */
/* ========================================================================== */

const EXACTLY_THEME = [
  { container: "bin", noun: "microchips", adj: "defective" },
  { container: "carton", noun: "light bulbs", adj: "burnt-out" },
  { container: "tank", noun: "fish", adj: "marked" },
];

/**
 * Hypergeometric P(exactly `j` special in a draw of `k`) from `N` items with `m`
 * special, via `hyperExactlyProb`: C(m,j)·C(N−m,k−j) / C(N,k). Distractors: the
 * with-replacement BINOMIAL approximation C(k,j)(m/N)^j((N−m)/N)^{k−j}, an
 * off-by-one on j (exactly j+1), and dropping the ordinary-item multiplier
 * C(N−m,k−j) so only C(m,j)/C(N,k) remains.
 */
export function genHyperExactly(rng: Rng): NumericQuestion {
  const th = rng.pick(EXACTLY_THEME);
  const N = rng.int(20, 30);
  const m = rng.int(4, 8);
  const k = rng.int(5, 8);
  const j = rng.pick([1, 2, 3]); // j ≤ m and k−j ≤ N−m always hold in this range

  const value = hyperExactlyProb(N, m, k, j);
  const dp = numDp(value);
  const answer = Number(decText(value, dp));

  // (a) BINOMIAL with-replacement approximation: C(k,j)(m/N)^j((N−m)/N)^{k−j}.
  const p = F(m, N);
  const q = F(N - m, N);
  const binom = F(chooseBig(k, j).toString())
    .mul(p.pow(j) as FractionType)
    .mul(q.pow(k - j) as FractionType);
  // (b) off-by-one on j: exactly (j+1) special.
  const wrongJ = hyperExactlyProb(N, m, k, j + 1);
  // (c) forgot the ordinary-item multiplier C(N−m,k−j): C(m,j)/C(N,k).
  const noOrdinary = F(chooseBig(m, j).toString()).div(F(chooseBig(N, k).toString()));

  const { errors, push } = numericErrors(answer, dp);
  push(
    binom,
    `C(${k},${j})·(m/N)^${j}·((N−m)/N)^${k - j} = ${fracText(binom)} is the WITH-REPLACEMENT binomial approximation. Drawing without replacement changes the composition each pick, so the exact count is hypergeometric C(m,j)·C(N−m,k−j)/C(N,k).`,
  );
  push(
    wrongJ,
    `${fracText(wrongJ)} is P(exactly ${j + 1} special) — an off-by-one on j. You want exactly ${j}, i.e. C(${m},${j})·C(${N - m},${k - j})/C(${N},${k}).`,
  );
  push(
    noOrdinary,
    `C(${m},${j})/C(${N},${k}) = ${fracText(noOrdinary)} forgets the C(N−m,k−j) = C(${N - m},${k - j}) ways to fill the remaining ${k - j} picks from the ${N - m} ordinary ${th.noun}.`,
  );

  const prompt =
    `A ${th.container} holds ${N} ${th.noun}, of which ${m} are ${th.adj}. ` +
    `You draw ${k} of them at random, all at once (without replacement). ` +
    `What is the probability that exactly ${j} of the ${k} drawn are ${th.adj}? (Round to ${dp} decimals.)`;
  const explanation =
    `This is a hypergeometric draw: choose which ${j} of the ${m} ${th.adj} ${th.noun} appear — C(${m},${j}) ways — and fill the remaining ${k - j} picks from the ${N - m} ordinary ${th.noun} — C(${N - m},${k - j}) ways — over all C(${N},${k}) equally-likely draws of ${k}. ` +
    `So P = C(${m},${j})·C(${N - m},${k - j})/C(${N},${k}) = ${fracText(value)} ≈ ${decText(value, dp)}. ` +
    `Note the with-replacement binomial guess ${fracText(binom)} is only an approximation here.`;

  return {
    id: `ca-hyperexactly-${N}-${m}-${k}-${j}`,
    prompt,
    answer,
    decimals: dp,
    difficulty: "easy",
    concept: "Hypergeometric (exactly j special)",
    explanation,
    unit: "",
    commonErrors: errors,
    source: "Combinatorial Analysis · Hypergeometric draws",
  };
}

/* ========================================================================== */
/* =================  2 — NO SPECIAL (hypergeometric)  ==================== */
/* ========================================================================== */

const NONE_THEME = [
  { container: "jar", noun: "marbles", adj: "crimson" },
  { container: "bag", noun: "tiles", adj: "wild" },
  { container: "box", noun: "ornaments", adj: "gold" },
];

/**
 * Hypergeometric P(NO special in a draw of `k`) from `N` items with `m` special,
 * via `hyperNoneProb`: C(N−m,k)/C(N,k). Distractors: the with-replacement
 * approximation ((N−m)/N)^k, the complement slip 1 − answer (which is P(at least
 * one special)), and a single-fraction slip that uses only the first pick's
 * miss probability (N−m)/N.
 */
export function genHyperNone(rng: Rng): NumericQuestion {
  const th = rng.pick(NONE_THEME);
  const N = rng.int(40, 52);
  const m = rng.int(2, 6);
  const k = rng.int(6, 12);

  const value = hyperNoneProb(N, m, k);
  const dp = numDp(value);
  const answer = Number(decText(value, dp));

  // (a) with-replacement approximation ((N−m)/N)^k.
  const withRepl = F(N - m, N).pow(k) as FractionType;
  // (b) complement confusion: 1 − answer = P(at least one special).
  const complement = F(1).sub(value);
  // (c) single-fraction slip: only the first pick's miss probability (N−m)/N.
  const firstOnly = F(N - m, N);

  const { errors, push } = numericErrors(answer, dp);
  push(
    withRepl,
    `((N−m)/N)^${k} = (${N - m}/${N})^${k} = ${fracText(withRepl)} assumes WITH replacement (constant miss probability). Without replacement the pool shrinks each pick, giving C(${N - m},${k})/C(${N},${k}).`,
  );
  push(
    complement,
    `${fracText(complement)} = 1 − answer is P(at LEAST one ${th.adj} ${th.noun}), the complement of "none" — you subtracted from 1 one time too many.`,
  );
  push(
    firstOnly,
    `(N−m)/N = ${N - m}/${N} = ${fracText(firstOnly)} is only the chance the FIRST pick misses; all ${k} picks must miss, so multiply the shrinking fractions ⇒ C(${N - m},${k})/C(${N},${k}).`,
  );

  const prompt =
    `A ${th.container} contains ${N} ${th.noun}, exactly ${m} of which are ${th.adj}. ` +
    `You draw ${k} of them at random without replacement. ` +
    `What is the probability that NONE of the ${k} drawn are ${th.adj}? (Round to ${dp} decimals.)`;
  const explanation =
    `Avoiding all ${m} ${th.adj} ${th.noun} means every one of the ${k} picks comes from the ${N - m} ordinary ${th.noun}: C(${N - m},${k}) favorable draws over C(${N},${k}) total. ` +
    `So P = C(${N - m},${k})/C(${N},${k}) = ${fracText(value)} ≈ ${decText(value, dp)}. ` +
    `The with-replacement guess (${N - m}/${N})^${k} = ${fracText(withRepl)} ignores the shrinking pool.`;

  return {
    id: `ca-hypernone-${N}-${m}-${k}`,
    prompt,
    answer,
    decimals: dp,
    difficulty: "easy",
    concept: "Hypergeometric (no special drawn)",
    explanation,
    unit: "",
    commonErrors: errors,
    source: "Combinatorial Analysis · Hypergeometric draws",
  };
}

/* ========================================================================== */
/* =================  3 — AT LEAST j SPECIAL (hypergeometric)  ============= */
/* ========================================================================== */

const ATLEAST_THEME = [
  { container: "shelf", noun: "novels", adj: "signed" },
  { container: "tray", noun: "seedlings", adj: "sprouted" },
  { container: "rack", noun: "test tubes", adj: "contaminated" },
];

/**
 * Hypergeometric P(at least `j` special in a draw of `k`) from `N` items with
 * `m` special, via `hyperAtLeastProb`: Σ_{t≥j} P(exactly t). Distractors: taking
 * only the exactly-`j` term (forgetting the upper tail t>j), the with-replacement
 * BINOMIAL tail Σ_{t≥j} C(k,t)(m/N)^t((N−m)/N)^{k−t}, and the complement slip
 * 1 − answer.
 */
export function genHyperAtLeast(rng: Rng): NumericQuestion {
  const th = rng.pick(ATLEAST_THEME);
  const N = rng.int(20, 30);
  const m = rng.int(4, 8);
  const k = rng.int(5, 8);
  const j = rng.pick([1, 2]);

  const value = hyperAtLeastProb(N, m, k, j);
  const dp = numDp(value);
  const answer = Number(decText(value, dp));

  // (a) exactly-j only: forgot the upper tail t > j.
  const exactlyOnly = hyperExactlyProb(N, m, k, j);
  // (b) with-replacement BINOMIAL tail Σ_{t≥j} C(k,t)(m/N)^t((N−m)/N)^{k−t}.
  const p = F(m, N);
  const q = F(N - m, N);
  let binomTail = F(0);
  for (let t = j; t <= k; t++) {
    binomTail = binomTail.add(
      F(chooseBig(k, t).toString())
        .mul(p.pow(t) as FractionType)
        .mul(q.pow(k - t) as FractionType),
    );
  }
  // (c) complement slip: 1 − answer.
  const complement = F(1).sub(value);

  const { errors, push } = numericErrors(answer, dp);
  push(
    exactlyOnly,
    `${fracText(exactlyOnly)} is P(exactly ${j} special) only — "at least ${j}" also includes ${j + 1}, ${j + 2}, … up to ${Math.min(m, k)}, so you dropped the upper tail.`,
  );
  push(
    binomTail,
    `${fracText(binomTail)} is the WITH-REPLACEMENT binomial tail Σ_{t≥${j}} C(${k},t)(m/N)^t((N−m)/N)^{${k}−t}; drawing without replacement makes it hypergeometric.`,
  );
  push(
    complement,
    `${fracText(complement)} = 1 − answer is the complement (P(at most ${j - 1} special)); "at least ${j}" is not subtracted from 1.`,
  );

  const prompt =
    `A ${th.container} holds ${N} ${th.noun}, of which ${m} are ${th.adj}. ` +
    `You draw ${k} of them at random without replacement. ` +
    `What is the probability that at least ${j} of the ${k} drawn are ${th.adj}? (Round to ${dp} decimals.)`;
  const explanation =
    `"At least ${j}" sums the hypergeometric probabilities of exactly ${j}, ${j + 1}, …, up to ${Math.min(m, k)} ${th.adj} ${th.noun}: P = Σ_{t≥${j}} C(${m},t)·C(${N - m},${k}−t)/C(${N},${k}) = ${fracText(value)} ≈ ${decText(value, dp)}. ` +
    `Taking only the exactly-${j} slice gives ${fracText(exactlyOnly)}, which undercounts by dropping the upper tail.`;

  return {
    id: `ca-hyperatleast-${N}-${m}-${k}-${j}`,
    prompt,
    answer,
    decimals: dp,
    difficulty: "easy",
    concept: "Hypergeometric (at least j special)",
    explanation,
    unit: "",
    commonErrors: errors,
    source: "Combinatorial Analysis · Hypergeometric draws",
  };
}
