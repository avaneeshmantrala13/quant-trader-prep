/**
 * ============================================================================
 *  BEAT THE ODDS — question generators (pure content, no React)
 * ============================================================================
 * Fresh, self-contained generators for the Optiver-style "Beat the Odds"
 * section: fast probability-theory + expected-value questions in a "pick the
 * closest of five" format. Each item is EXACT-verified — the generator computes
 * the true numeric answer from first principles, so the drill can score it
 * deterministically and prove winnability.
 *
 * This is a BRAND-NEW module. It intentionally does NOT import or mutate the
 * shared `src/content/probabilityStats/**` generators the mock interview relies
 * on; it stands alone so the two surfaces never entangle.
 */
import { Rng, gcd } from "@/lib/rng";

/* ========================================================================== */
/*  Types                                                                      */
/* ========================================================================== */

/** How a numeric answer should be rendered by the drill UI. */
export type BtoFormat = "percent" | "ev" | "fraction";

export interface BtoQuestion {
  id: number;
  category: string;
  tier: 1 | 2 | 3;
  prompt: string;
  format: BtoFormat;
  /** Exact numeric answer (probability in [0,1], or an EV / count). */
  answer: number;
  /** Five numeric options (shuffled), always containing `answer` once. */
  options: number[];
  correctIndex: number;
  explanation: string;
}

interface BtoSpec {
  category: string;
  tier: 1 | 2 | 3;
  prompt: string;
  format: BtoFormat;
  answer: number;
  /** Common-mistake distractors; may be fewer than 4 (filled by jitter). */
  distractors: number[];
  explanation: string;
}

/* ========================================================================== */
/*  Small combinatorics helpers                                                */
/* ========================================================================== */

export function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  let num = 1;
  for (let i = 0; i < k; i++) num = (num * (n - i)) / (i + 1);
  return Math.round(num);
}

function fracString(p: number): string {
  // Render a probability as a reduced fraction when it is a clean /36, /52, etc.
  for (const denom of [2, 3, 4, 6, 8, 9, 12, 13, 16, 18, 26, 36, 52, 221]) {
    const numer = p * denom;
    if (Math.abs(numer - Math.round(numer)) < 1e-9) {
      const n = Math.round(numer);
      const g = gcd(n, denom) || 1;
      return `${n / g}/${denom / g}`;
    }
  }
  return p.toFixed(4);
}

/* ========================================================================== */
/*  Generators — probability                                                   */
/* ========================================================================== */

/** P(sum of two fair dice equals a target). */
function genDiceSum(rng: Rng): BtoSpec {
  const target = rng.int(2, 12);
  const ways = Array.from({ length: 11 }, (_, i) => 6 - Math.abs(7 - (i + 2)));
  const count = ways[target - 2];
  const answer = count / 36;
  return {
    category: "Dice probability",
    tier: 1,
    prompt: `Roll two fair six-sided dice. What is the probability the sum equals ${target}?`,
    format: "percent",
    answer,
    distractors: [
      (count + 1) / 36,
      (count - 1 > 0 ? count - 1 : count + 2) / 36,
      1 / 6,
      count / 6 / 6 === answer ? 6 / 36 : 6 / 36,
    ],
    explanation: `There are ${count} of 36 equally-likely ordered outcomes summing to ${target} (${fracString(answer)}).`,
  };
}

/** P(exactly k heads in n fair coin flips). */
function genCoinHeads(rng: Rng): BtoSpec {
  const n = rng.pick([3, 4, 5]);
  const k = rng.int(0, n);
  const ways = choose(n, k);
  const answer = ways / 2 ** n;
  return {
    category: "Coin probability",
    tier: 1,
    prompt: `Flip a fair coin ${n} times. What is the probability of exactly ${k} head${k === 1 ? "" : "s"}?`,
    format: "percent",
    answer,
    distractors: [
      choose(n, k + 1) / 2 ** n,
      choose(n, Math.max(0, k - 1)) / 2 ** n,
      k / n,
      1 / 2 ** n,
    ],
    explanation: `C(${n},${k}) = ${ways} favourable strings out of 2^${n} = ${2 ** n} (${fracString(answer)}).`,
  };
}

/** P(drawing a particular kind of card from a shuffled 52-card deck). */
function genCardDraw(rng: Rng): BtoSpec {
  const kinds = [
    { label: "a face card (J, Q, K)", favourable: 12 },
    { label: "an ace", favourable: 4 },
    { label: "a heart", favourable: 13 },
    { label: "a red card", favourable: 26 },
    { label: "a card higher than 10 (J, Q, K, or A)", favourable: 16 },
  ];
  const kind = rng.pick(kinds);
  const answer = kind.favourable / 52;
  return {
    category: "Card probability",
    tier: 1,
    prompt: `Draw one card at random from a standard 52-card deck. What is the probability it is ${kind.label}?`,
    format: "percent",
    answer,
    distractors: [
      (kind.favourable + 2) / 52,
      (kind.favourable - 2 > 0 ? kind.favourable - 2 : kind.favourable + 4) / 52,
      kind.favourable / 13,
      13 / 52,
    ],
    explanation: `${kind.favourable} of 52 cards qualify (${fracString(answer)}).`,
  };
}

/** P(both of two draws without replacement are red, from r red + b blue). */
function genUrnTwoDraw(rng: Rng): BtoSpec {
  const r = rng.int(3, 6);
  const b = rng.int(2, 5);
  const total = r + b;
  const answer = (r / total) * ((r - 1) / (total - 1));
  return {
    category: "Urn probability",
    tier: 2,
    prompt: `An urn holds ${r} red and ${b} blue balls. You draw two without replacement. What is the probability BOTH are red?`,
    format: "percent",
    answer,
    distractors: [
      (r / total) * (r / total), // wrongly assumed replacement
      (r / total) * ((r - 1) / total),
      choose(r, 2) / choose(total, 2) === answer ? r / total : r / total,
      ((r - 1) / total) * ((r - 1) / (total - 1)),
    ],
    explanation: `(${r}/${total}) × (${r - 1}/${total - 1}) = ${(answer * 100).toFixed(1)}% (no replacement, so the second fraction shrinks).`,
  };
}

/** Simple two-branch conditional / total-probability question. */
function genConditional(rng: Rng): BtoSpec {
  // Two bags; pick one at random, then draw a red.
  const bagA = { red: rng.int(1, 4), total: rng.int(5, 8) };
  const bagB = { red: rng.int(3, 6), total: rng.int(7, 10) };
  if (bagA.red > bagA.total) bagA.red = bagA.total - 1;
  if (bagB.red > bagB.total) bagB.red = bagB.total - 1;
  const pRed = 0.5 * (bagA.red / bagA.total) + 0.5 * (bagB.red / bagB.total);
  return {
    category: "Total probability",
    tier: 3,
    prompt: `Bag A has ${bagA.red} red of ${bagA.total} balls; Bag B has ${bagB.red} red of ${bagB.total}. You pick a bag at random (50/50), then draw one ball. What is the probability it is red?`,
    format: "percent",
    answer: pRed,
    distractors: [
      bagA.red / bagA.total,
      bagB.red / bagB.total,
      (bagA.red + bagB.red) / (bagA.total + bagB.total),
    ],
    explanation: `½·(${bagA.red}/${bagA.total}) + ½·(${bagB.red}/${bagB.total}) = ${(pRed * 100).toFixed(1)}%.`,
  };
}

/* ========================================================================== */
/*  Generators — expected value                                                */
/* ========================================================================== */

/** EV of a simple win/lose wager. */
function genBetEV(rng: Rng): BtoSpec {
  // Roll a die; if it shows >= threshold you win `win`, else lose `loss`.
  const threshold = rng.int(3, 5);
  const win = rng.int(2, 6);
  const loss = rng.int(1, 4);
  const pWin = (6 - threshold + 1) / 6;
  const answer = pWin * win - (1 - pWin) * loss;
  return {
    category: "Expected value",
    tier: 2,
    prompt: `Roll a fair die. If it shows ${threshold} or higher you win $${win}; otherwise you lose $${loss}. What is the expected value of one play?`,
    format: "ev",
    answer,
    distractors: [
      pWin * win, // forgot the loss term
      pWin * win - loss, // mis-weighted loss
      0.5 * win - 0.5 * loss, // assumed 50/50
    ],
    explanation: `P(win)=${6 - threshold + 1}/6. EV = (${6 - threshold + 1}/6)·$${win} − (${threshold - 1}/6)·$${loss} = $${answer.toFixed(2)}.`,
  };
}

/** EV of a single die face (or a scaled/shifted payout). */
function genDieFaceEV(rng: Rng): BtoSpec {
  const mult = rng.pick([1, 2, 3]);
  const add = rng.pick([0, 1, 2, 5]);
  const answer = mult * 3.5 + add;
  return {
    category: "Expected value",
    tier: 1,
    prompt: `You roll a fair six-sided die and are paid $${mult}× the face value${add ? ` plus a $${add} bonus` : ""}. What is the expected payout?`,
    format: "ev",
    answer,
    distractors: [mult * 3 + add, mult * 4 + add, mult * 3.5],
    explanation: `E[face] = 3.5, so EV = ${mult}·3.5${add ? ` + ${add}` : ""} = $${answer.toFixed(2)}.`,
  };
}

/** EV of the maximum of two fair dice (exact: 161/36 ≈ 4.472). */
function genMaxTwoDiceEV(): BtoSpec {
  // E[max] = sum_{k=1..6} k·(2k-1)/36 = 161/36.
  const answer = 161 / 36;
  return {
    category: "Expected value",
    tier: 3,
    prompt: `Roll two fair six-sided dice and take the LARGER of the two faces (ties count that face). What is the expected value of the larger face?`,
    format: "ev",
    answer,
    distractors: [3.5, 4, 4.5],
    explanation: `E[max] = Σ k·P(max=k) with P(max=k)=(2k−1)/36, giving 161/36 ≈ ${answer.toFixed(3)}.`,
  };
}

/* ========================================================================== */
/*  Family selection by tier                                                   */
/* ========================================================================== */

type BtoGen = (rng: Rng) => BtoSpec;

const TIER_GENS: Record<1 | 2 | 3, BtoGen[]> = {
  1: [genDiceSum, genCoinHeads, genCardDraw, genDieFaceEV],
  2: [genUrnTwoDraw, genBetEV, genCoinHeads, genCardDraw],
  3: [genConditional, genMaxTwoDiceEV, genUrnTwoDraw, genBetEV],
};

export function btoTierForIndex(idx: number, count: number): 1 | 2 | 3 {
  const frac = idx / Math.max(1, count - 1);
  if (frac < 0.34) return 1;
  if (frac < 0.68) return 2;
  return 3;
}

/* ========================================================================== */
/*  Option construction                                                        */
/* ========================================================================== */

/** Round a value the way its format is compared (keeps options distinct). */
export function normalizeForFormat(v: number, format: BtoFormat): number {
  const r = format === "percent" ? Math.round(v * 1e6) / 1e6 : Math.round(v * 100) / 100;
  // Collapse a signed −0 to +0 so option/answer identity comparisons hold.
  return r === 0 ? 0 : r;
}

/**
 * Build five distinct options (answer + four traps), normalized to the
 * format's precision and shuffled. Probabilities are clamped to (0,1).
 */
export function buildBtoOptions(
  rng: Rng,
  spec: BtoSpec,
): { options: number[]; correctIndex: number } {
  const norm = (v: number) => normalizeForFormat(v, spec.format);
  const answer = norm(spec.answer);
  const set = new Set<number>([answer]);
  const clampProb = (v: number) =>
    spec.format === "percent" ? Math.max(0.0001, Math.min(0.9999, v)) : v;

  for (const d of spec.distractors) {
    if (set.size >= 5) break;
    const v = norm(clampProb(d));
    if (Number.isFinite(v) && v !== answer) set.add(v);
  }
  // Fill any shortfall with jittered plausible values distinct from all others.
  let step = spec.format === "percent" ? 0.03 : 0.5;
  let sign = 1;
  let mult = 1;
  while (set.size < 5) {
    const v = norm(clampProb(spec.answer + sign * step * mult));
    if (Number.isFinite(v) && !set.has(v)) set.add(v);
    sign = -sign;
    if (sign === 1) mult += 1;
    if (mult > 40) break; // safety
  }
  const options = rng.shuffle([...set].slice(0, 5));
  return { options, correctIndex: options.indexOf(answer) };
}

/* ========================================================================== */
/*  Paper construction                                                         */
/* ========================================================================== */

export const DEFAULT_BTO_COUNT = 20;

/** Build one fully-formed question for the given tier. */
export function buildBtoQuestion(
  rng: Rng,
  id: number,
  tier: 1 | 2 | 3,
): BtoQuestion {
  const spec = rng.pick(TIER_GENS[tier])(rng);
  const { options, correctIndex } = buildBtoOptions(rng, spec);
  return {
    id,
    category: spec.category,
    tier,
    prompt: spec.prompt,
    format: spec.format,
    answer: normalizeForFormat(spec.answer, spec.format),
    options,
    correctIndex,
    explanation: spec.explanation,
  };
}

/**
 * Build a full `count`-question Beat-the-Odds paper for `seed`, difficulty
 * escalating tier 1 → 3. Deterministic: same seed ⇒ same paper.
 */
export function buildBeatTheOddsPaper(
  seed: number,
  count: number = DEFAULT_BTO_COUNT,
): BtoQuestion[] {
  const rng = new Rng(seed);
  const out: BtoQuestion[] = [];
  for (let i = 0; i < count; i++) {
    out.push(buildBtoQuestion(rng, i, btoTierForIndex(i, count)));
  }
  return out;
}
