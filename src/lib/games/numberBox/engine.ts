/**
 * ============================================================================
 *  NUMBER BOX — modular-arithmetic rapid drill (pure engine)
 * ============================================================================
 * Mimics the Optiver "Number Box" Zap-N mini-game: fast modular-math drills
 * where you compute the residue of an expression (mod m) or fill the box that
 * makes a congruence hold. A whole-run clock streams items forward; a skilled,
 * fast solver clears the paper.
 *
 * Pure, deterministic, and seedable — a snapshot of (seed + index + answers)
 * rehydrates the exact run. Brand-new module; no shared generators are touched.
 */
import { Rng } from "@/lib/rng";

/* ========================================================================== */
/*  Types                                                                      */
/* ========================================================================== */

export type NumberBoxKind = "add" | "sub" | "mul" | "fill" | "power";

export interface NumberBoxItem {
  id: number;
  kind: NumberBoxKind;
  /** The rendered expression, e.g. "17 + 8 ≡ ?  (mod 12)". */
  prompt: string;
  modulus: number;
  /** The exact correct residue in [0, modulus). */
  answer: number;
  /** Five distinct residues (shuffled), always containing `answer`. */
  options: number[];
  correctIndex: number;
  tier: 1 | 2 | 3;
  explanation: string;
}

interface NBSpec {
  kind: NumberBoxKind;
  prompt: string;
  modulus: number;
  answer: number;
  explanation: string;
}

/** Positive residue in [0, m). */
export function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/* ========================================================================== */
/*  Generators                                                                 */
/* ========================================================================== */

function genAdd(rng: Rng, m: number): NBSpec {
  const a = rng.int(m, m * 4);
  const b = rng.int(m, m * 4);
  const answer = mod(a + b, m);
  return {
    kind: "add",
    prompt: `${a} + ${b} ≡ ?  (mod ${m})`,
    modulus: m,
    answer,
    explanation: `${a} + ${b} = ${a + b}; ${a + b} mod ${m} = ${answer}.`,
  };
}

function genSub(rng: Rng, m: number): NBSpec {
  const a = rng.int(m, m * 4);
  const b = rng.int(m, m * 4);
  const answer = mod(a - b, m);
  return {
    kind: "sub",
    prompt: `${a} − ${b} ≡ ?  (mod ${m})`,
    modulus: m,
    answer,
    explanation: `${a} − ${b} = ${a - b}; taken mod ${m} (wrapping into 0…${m - 1}) = ${answer}.`,
  };
}

function genMul(rng: Rng, m: number): NBSpec {
  const a = rng.int(2, m + 3);
  const b = rng.int(2, m + 3);
  const answer = mod(a * b, m);
  return {
    kind: "mul",
    prompt: `${a} × ${b} ≡ ?  (mod ${m})`,
    modulus: m,
    answer,
    explanation: `${a} × ${b} = ${a * b}; ${a * b} mod ${m} = ${answer}.`,
  };
}

/** a + [ ? ] ≡ t (mod m) — solve for the missing residue. */
function genFill(rng: Rng, m: number): NBSpec {
  const a = rng.int(m, m * 3);
  const t = rng.int(0, m - 1);
  const answer = mod(t - a, m);
  return {
    kind: "fill",
    prompt: `${a} + [ ? ] ≡ ${t}  (mod ${m})`,
    modulus: m,
    answer,
    explanation: `Need ? ≡ ${t} − ${a} (mod ${m}) = ${answer}, since ${a} + ${answer} = ${a + answer} ≡ ${t} (mod ${m}).`,
  };
}

/** a² ≡ ? (mod m) — a small modular power. */
function genPower(rng: Rng, m: number): NBSpec {
  const a = rng.int(3, m + 4);
  const answer = mod(a * a, m);
  return {
    kind: "power",
    prompt: `${a}² ≡ ?  (mod ${m})`,
    modulus: m,
    answer,
    explanation: `${a}² = ${a * a}; ${a * a} mod ${m} = ${answer}.`,
  };
}

/* ========================================================================== */
/*  Tiering                                                                     */
/* ========================================================================== */

const TIER_MODULI: Record<1 | 2 | 3, number[]> = {
  1: [6, 7, 8],
  2: [9, 10, 11],
  3: [11, 12, 13],
};

const TIER_GENS: Record<1 | 2 | 3, ((rng: Rng, m: number) => NBSpec)[]> = {
  1: [genAdd, genSub],
  2: [genAdd, genSub, genMul, genFill],
  3: [genMul, genFill, genPower, genSub],
};

export function nbTierForIndex(idx: number, count: number): 1 | 2 | 3 {
  const frac = idx / Math.max(1, count - 1);
  if (frac < 0.34) return 1;
  if (frac < 0.68) return 2;
  return 3;
}

/* ========================================================================== */
/*  Options                                                                     */
/* ========================================================================== */

/** Five distinct residues in [0, m) including the answer, shuffled. */
export function buildResidueOptions(
  rng: Rng,
  answer: number,
  m: number,
): number[] {
  const set = new Set<number>([answer]);
  // Prefer near-miss residues (off-by-one) then random ones.
  const preferred = [mod(answer + 1, m), mod(answer - 1, m), mod(answer + 2, m)];
  for (const p of preferred) {
    if (set.size >= 5) break;
    set.add(p);
  }
  let guard = 0;
  while (set.size < 5 && guard < 200) {
    set.add(rng.int(0, m - 1));
    guard += 1;
  }
  return rng.shuffle([...set].slice(0, 5));
}

/* ========================================================================== */
/*  Item + paper                                                               */
/* ========================================================================== */

export const DEFAULT_NUMBERBOX_COUNT = 30;
/** ~2 minutes of rapid-fire, matching the Zap-N mini-game feel. */
export const DEFAULT_NUMBERBOX_BUDGET_MS = 120 * 1000;

export function buildNumberBoxItem(
  rng: Rng,
  id: number,
  tier: 1 | 2 | 3,
): NumberBoxItem {
  const m = rng.pick(TIER_MODULI[tier]);
  const spec = rng.pick(TIER_GENS[tier])(rng, m);
  const options = buildResidueOptions(rng, spec.answer, spec.modulus);
  return {
    id,
    kind: spec.kind,
    prompt: spec.prompt,
    modulus: spec.modulus,
    answer: spec.answer,
    options,
    correctIndex: options.indexOf(spec.answer),
    tier,
    explanation: spec.explanation,
  };
}

export function buildNumberBoxPaper(
  seed: number,
  count: number = DEFAULT_NUMBERBOX_COUNT,
): NumberBoxItem[] {
  const rng = new Rng(seed);
  const out: NumberBoxItem[] = [];
  for (let i = 0; i < count; i++) {
    out.push(buildNumberBoxItem(rng, i, nbTierForIndex(i, count)));
  }
  return out;
}

/* ========================================================================== */
/*  Session                                                                    */
/* ========================================================================== */

export interface NumberBoxSession {
  seed: number;
  count: number;
  deadlineTs: number;
  index: number;
  answers: (number | null)[];
  status: "running" | "finished";
}

export function createNumberBoxSession(opts: {
  seed: number;
  nowTs: number;
  count?: number;
  budgetMs?: number;
}): NumberBoxSession {
  const count = opts.count ?? DEFAULT_NUMBERBOX_COUNT;
  return {
    seed: opts.seed,
    count,
    deadlineTs: opts.nowTs + (opts.budgetMs ?? DEFAULT_NUMBERBOX_BUDGET_MS),
    index: 0,
    answers: Array.from({ length: count }, () => null),
    status: "running",
  };
}

export function answerNumberBox(
  s: NumberBoxSession,
  choiceIndex: number,
): NumberBoxSession {
  if (s.status !== "running") return s;
  const answers = s.answers.slice();
  answers[s.index] = choiceIndex;
  return { ...s, answers };
}

export function advanceNumberBox(
  s: NumberBoxSession,
  nowTs: number,
): NumberBoxSession {
  if (s.status !== "running") return s;
  const next = s.index + 1;
  if (next >= s.count || nowTs >= s.deadlineTs) {
    return { ...s, status: "finished" };
  }
  return { ...s, index: next };
}

export function isNumberBoxExpired(s: NumberBoxSession, nowTs: number): boolean {
  return nowTs >= s.deadlineTs;
}

export function remainingMs(s: NumberBoxSession, nowTs: number): number {
  return Math.max(0, s.deadlineTs - nowTs);
}

/* ========================================================================== */
/*  Scoring                                                                    */
/* ========================================================================== */

export interface NumberBoxSummary {
  total: number;
  answered: number;
  correct: number;
  wrong: number;
  /** Optiver-style net: +1 correct, −1 wrong, 0 unanswered (floored at 0). */
  netScore: number;
  accuracyPct: number;
}

export function summarizeNumberBox(
  s: NumberBoxSession,
  items: NumberBoxItem[] = buildNumberBoxPaper(s.seed, s.count),
): NumberBoxSummary {
  let correct = 0;
  let wrong = 0;
  let answered = 0;
  items.forEach((it, i) => {
    const a = s.answers[i];
    if (a == null) return;
    answered += 1;
    if (a === it.correctIndex) correct += 1;
    else wrong += 1;
  });
  return {
    total: items.length,
    answered,
    correct,
    wrong,
    netScore: Math.max(0, correct - wrong),
    accuracyPct: answered ? Math.round((correct / answered) * 100) : 0,
  };
}
