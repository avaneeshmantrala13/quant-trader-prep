/**
 * ============================================================================
 *  NUMBERLOGIC — progressive number-sequence pattern drill (pure engine)
 * ============================================================================
 * Mimics the Optiver-style "NumberLogic" section: a ~25-minute test of ~26
 * progressive "what comes next?" number-sequence items. Difficulty escalates
 * from plain arithmetic/geometric steps into ratio+offset recurrences,
 * second-difference (quadratic) growth, interleaved twin sequences, and
 * Fibonacci-style running sums.
 *
 * This module is PURE (no React, no I/O) and fully SEEDABLE via {@link Rng}, so
 * a given seed always yields the same 26-item paper — that is what makes the
 * durable-resume snapshot (seed + index + answers) rehydrate exactly. It is a
 * BRAND-NEW module: it deliberately does not import or mutate the shared
 * `src/content/sequences/**` generators the mock interview relies on.
 *
 * Winnability: every item exposes a deterministic `answer` computed from the
 * stated `rule`, and its five options always contain that answer exactly once,
 * so a solver who reads the pattern scores 100%. Distractors are the classic
 * near-miss traps (off-by-one-step, wrong last operation, sign slips).
 */
import { Rng } from "@/lib/rng";

/* ========================================================================== */
/*  Types                                                                      */
/* ========================================================================== */

/** The pattern family behind a sequence (drives the "why" explanation chip). */
export type SequenceFamily =
  | "arithmetic"
  | "geometric"
  | "ratio-offset"
  | "second-difference"
  | "interleaved"
  | "fibonacci"
  | "alternating-ops"
  | "polynomial";

/** A single sequence item: shown terms, the true next value, and 5 options. */
export interface SequenceItem {
  /** Stable id within a session (its index), handy as a React key. */
  id: number;
  family: SequenceFamily;
  /** The visible terms of the sequence (what the solver reads). */
  terms: number[];
  /** The exact correct next term. */
  answer: number;
  /** Five options (shuffled) — always contains `answer` exactly once. */
  options: number[];
  /** Index of `answer` within `options`. */
  correctIndex: number;
  /** A one-line, human explanation of the generating rule. */
  rule: string;
  /** 1..3 difficulty tier (drives scoring weight + family selection). */
  tier: 1 | 2 | 3;
}

/** The internal spec a family generator returns before options are attached. */
interface SequenceSpec {
  family: SequenceFamily;
  terms: number[];
  answer: number;
  rule: string;
}

/* ========================================================================== */
/*  Family generators — each returns { terms, answer, rule }                   */
/* ========================================================================== */

function pm(n: number): string {
  return n < 0 ? `− ${Math.abs(n)}` : `+ ${n}`;
}

/** t_{k} = a + k·d. */
function genArithmetic(rng: Rng): SequenceSpec {
  const a = rng.int(2, 20);
  const d = rng.pick([2, 3, 4, 5, 6, 7, -3, -4, 9, 11]);
  const terms = Array.from({ length: 5 }, (_, k) => a + k * d);
  return {
    family: "arithmetic",
    terms,
    answer: a + 5 * d,
    rule: `Add ${d} each step (arithmetic, common difference ${d}).`,
  };
}

/** t_{k} = a · r^k. */
function genGeometric(rng: Rng): SequenceSpec {
  const a = rng.pick([1, 2, 3, 4, 5]);
  const r = rng.pick([2, 3]);
  const terms = Array.from({ length: 5 }, (_, k) => a * r ** k);
  return {
    family: "geometric",
    terms,
    answer: a * r ** 5,
    rule: `Multiply by ${r} each step (geometric, ratio ${r}).`,
  };
}

/** t_{k+1} = t_k · r + c (the "grow then nudge" recurrence). */
function genRatioOffset(rng: Rng): SequenceSpec {
  let start = rng.int(1, 6);
  const r = rng.pick([2, 3]);
  const c = rng.pick([1, 2, 3, -1, 4, 5]);
  // Avoid the degenerate flat start (e.g. 1×2−1 = 1) so consecutive terms differ.
  if (start * (r - 1) + c === 0) start += 1;
  const terms: number[] = [start];
  for (let i = 0; i < 5; i++) terms.push(terms[i] * r + c);
  const answer = terms.pop()!; // 6th generated term is the answer
  return {
    family: "ratio-offset",
    terms,
    answer,
    rule: `Each term = previous × ${r} ${pm(c)} (ratio-plus-offset recurrence).`,
  };
}

/**
 * Quadratic-style growth: the FIRST differences themselves grow by a constant
 * (constant SECOND difference). e.g. +2, +4, +6, +8 → 1, 3, 7, 13, 21, …
 */
function genSecondDifference(rng: Rng): SequenceSpec {
  const a = rng.int(1, 8);
  const d0 = rng.int(1, 4); // first gap
  const dd = rng.pick([1, 2, 3]); // constant second difference
  const terms: number[] = [a];
  let gap = d0;
  for (let i = 0; i < 5; i++) {
    terms.push(terms[terms.length - 1] + gap);
    gap += dd;
  }
  const answer = terms.pop()!;
  return {
    family: "second-difference",
    terms,
    answer,
    rule: `Gaps grow by ${dd} each step (constant second difference); the gaps run ${d0}, ${d0 + dd}, ${d0 + 2 * dd}, …`,
  };
}

/**
 * Two independent arithmetic sequences interleaved: odd positions step by d1,
 * even positions step by d2. The solver must "de-interleave" first.
 */
function genInterleaved(rng: Rng): SequenceSpec {
  const a1 = rng.int(1, 12);
  const d1 = rng.pick([2, 3, 4, 5, 10]);
  const a2 = rng.int(20, 40);
  const d2 = rng.pick([-2, -3, -4, 3, 6]);
  // Lay out A0 B0 A1 B1 A2 (5 shown) → next is B2.
  const terms = [a1, a2, a1 + d1, a2 + d2, a1 + 2 * d1];
  const answer = a2 + 2 * d2;
  return {
    family: "interleaved",
    terms,
    answer,
    rule: `Two interleaved sequences: positions 1,3,5,… add ${d1}; positions 2,4,6,… add ${d2}. The next value continues the second one.`,
  };
}

/** Fibonacci-style: t_{k+1} = t_k + t_{k-1} (+ optional constant c). */
function genFibonacci(rng: Rng): SequenceSpec {
  const t0 = rng.int(1, 5);
  const t1 = rng.int(t0, t0 + 5);
  const c = rng.pick([0, 0, 1, 2]);
  const terms = [t0, t1];
  for (let i = 1; i < 5; i++) terms.push(terms[i] + terms[i - 1] + c);
  const answer = terms.pop()!;
  return {
    family: "fibonacci",
    terms,
    answer,
    rule:
      c === 0
        ? `Each term is the sum of the two before it (Fibonacci-style).`
        : `Each term is the sum of the two before it, ${pm(c)} (Fibonacci-style with an offset).`,
  };
}

/** Alternating operations: ×m then +a, repeating. */
function genAlternatingOps(rng: Rng): SequenceSpec {
  const start = rng.int(1, 5);
  const m = rng.pick([2, 3]);
  const add = rng.pick([1, 2, 3, 4, 5]);
  const terms: number[] = [start];
  for (let i = 0; i < 5; i++) {
    const prev = terms[terms.length - 1];
    terms.push(i % 2 === 0 ? prev * m : prev + add);
  }
  const answer = terms.pop()!;
  return {
    family: "alternating-ops",
    terms,
    answer,
    rule: `Alternate the operations: ×${m}, then ${pm(add)}, then ×${m}, then ${pm(add)}, …`,
  };
}

/** Polynomial values k² + c or k²·b shifted, shown at k = 1..5. */
function genPolynomial(rng: Rng): SequenceSpec {
  const c = rng.int(0, 6);
  const b = rng.pick([1, 1, 2]);
  const f = (k: number) => b * k * k + c;
  const terms = [1, 2, 3, 4, 5].map(f);
  return {
    family: "polynomial",
    terms,
    answer: f(6),
    rule:
      b === 1
        ? `Perfect squares shifted: term k = k² ${c ? pm(c) : ""} (1²,2²,3²,…).`.trim()
        : `Term k = ${b}·k² ${c ? pm(c) : ""} (scaled squares).`.trim(),
  };
}

/* ========================================================================== */
/*  Family selection by difficulty tier                                        */
/* ========================================================================== */

type Generator = (rng: Rng) => SequenceSpec;

/** Which families appear at each escalating tier (1 easiest → 3 hardest). */
const TIER_FAMILIES: Record<1 | 2 | 3, Generator[]> = {
  1: [genArithmetic, genGeometric, genPolynomial],
  2: [genRatioOffset, genFibonacci, genAlternatingOps, genPolynomial],
  3: [genSecondDifference, genInterleaved, genRatioOffset, genAlternatingOps],
};

/** The tier an item at position `idx` (0-based) of a `count`-item paper sits in. */
export function tierForIndex(idx: number, count: number): 1 | 2 | 3 {
  const frac = idx / Math.max(1, count - 1);
  if (frac < 0.34) return 1;
  if (frac < 0.68) return 2;
  return 3;
}

/* ========================================================================== */
/*  Option (distractor) construction                                           */
/* ========================================================================== */

/**
 * Build five options around `answer`: the true value plus four plausible
 * near-miss traps (last-step slips, one-step-short, sign flips), de-duplicated
 * and shuffled. Deterministic given the rng.
 */
export function buildOptions(rng: Rng, terms: number[], answer: number): number[] {
  const last = terms[terms.length - 1];
  const step = answer - last;
  const candidates = new Set<number>([answer]);
  // Classic traps: repeated last term, one extra/short step, doubled step, sign slip.
  const traps = [
    last, // forgot to advance
    answer - step, // one step short (== last, but keep for non-linear)
    answer + step, // overshot a step
    answer + (answer - last === 0 ? 1 : Math.sign(step)) * 2,
    last + step * 2, // applied the step twice
    Math.round(answer / 2) === answer ? answer + 3 : answer - 3,
  ];
  for (const t of traps) {
    if (candidates.size >= 5) break;
    if (Number.isFinite(t) && t !== answer) candidates.add(t);
  }
  // Backfill with small unique jitters if we still fell short (rare).
  let jitter = 1;
  while (candidates.size < 5) {
    candidates.add(answer + jitter);
    jitter = jitter > 0 ? -jitter : -jitter + 1;
  }
  const opts = rng.shuffle([...candidates].slice(0, 5));
  return opts;
}

/* ========================================================================== */
/*  Item + session construction                                                */
/* ========================================================================== */

/** Build one fully-formed item (terms + options) for the given tier. */
export function buildItem(rng: Rng, id: number, tier: 1 | 2 | 3): SequenceItem {
  const gens = TIER_FAMILIES[tier];
  const spec = rng.pick(gens)(rng);
  const options = buildOptions(rng, spec.terms, spec.answer);
  const correctIndex = options.indexOf(spec.answer);
  return {
    id,
    family: spec.family,
    terms: spec.terms,
    answer: spec.answer,
    options,
    correctIndex,
    rule: spec.rule,
    tier,
  };
}

/** Default paper length — 26 progressive items, matching the Optiver section. */
export const DEFAULT_NUMBERLOGIC_COUNT = 26;

/** Default whole-test budget (~25 minutes) in ms. */
export const DEFAULT_NUMBERLOGIC_BUDGET_MS = 25 * 60 * 1000;

/**
 * Build a full `count`-item NumberLogic paper for `seed`, difficulty escalating
 * from tier 1 → 3 across the paper. Deterministic: same seed ⇒ same paper.
 */
export function buildNumberLogicPaper(
  seed: number,
  count: number = DEFAULT_NUMBERLOGIC_COUNT,
): SequenceItem[] {
  const rng = new Rng(seed);
  const items: SequenceItem[] = [];
  for (let i = 0; i < count; i++) {
    items.push(buildItem(rng, i, tierForIndex(i, count)));
  }
  return items;
}

/* ========================================================================== */
/*  Session state (durable, snapshot-friendly)                                 */
/* ========================================================================== */

export interface NumberLogicSession {
  seed: number;
  /** Absolute epoch-ms deadline for the WHOLE paper (wall-clock resumable). */
  deadlineTs: number;
  index: number;
  /** One entry per item; null = not yet answered. */
  answers: (number | null)[];
  status: "running" | "finished";
}

/** Create a fresh running session for `seed`, starting the whole-paper clock. */
export function createNumberLogicSession(opts: {
  seed: number;
  nowTs: number;
  count?: number;
  budgetMs?: number;
}): NumberLogicSession {
  const count = opts.count ?? DEFAULT_NUMBERLOGIC_COUNT;
  return {
    seed: opts.seed,
    deadlineTs: opts.nowTs + (opts.budgetMs ?? DEFAULT_NUMBERLOGIC_BUDGET_MS),
    index: 0,
    answers: Array.from({ length: count }, () => null),
    status: "running",
  };
}

/** Record the choice for the CURRENT item (idempotent per index). */
export function answerNumberLogic(
  s: NumberLogicSession,
  choiceIndex: number,
): NumberLogicSession {
  if (s.status !== "running") return s;
  const answers = s.answers.slice();
  answers[s.index] = choiceIndex;
  return { ...s, answers };
}

/** Advance to the next item, finishing when the paper (or clock) is done. */
export function advanceNumberLogic(
  s: NumberLogicSession,
  nowTs: number,
): NumberLogicSession {
  if (s.status !== "running") return s;
  const next = s.index + 1;
  if (next >= s.answers.length || nowTs >= s.deadlineTs) {
    return { ...s, status: "finished" };
  }
  return { ...s, index: next };
}

/** True once the whole-paper clock has elapsed. */
export function isPaperExpired(s: NumberLogicSession, nowTs: number): boolean {
  return nowTs >= s.deadlineTs;
}

/* ========================================================================== */
/*  Scoring                                                                     */
/* ========================================================================== */

export interface NumberLogicSummary {
  total: number;
  answered: number;
  correct: number;
  /** Weighted score: each correct item worth its tier (1/2/3 points). */
  score: number;
  maxScore: number;
  accuracyPct: number;
}

/** Grade a finished (or in-progress) session against its paper. */
export function summarizeNumberLogic(
  s: NumberLogicSession,
  items: SequenceItem[] = buildNumberLogicPaper(s.seed, s.answers.length),
): NumberLogicSummary {
  let correct = 0;
  let answered = 0;
  let score = 0;
  let maxScore = 0;
  items.forEach((it, i) => {
    maxScore += it.tier;
    const a = s.answers[i];
    if (a != null) answered += 1;
    if (a === it.correctIndex) {
      correct += 1;
      score += it.tier;
    }
  });
  return {
    total: items.length,
    answered,
    correct,
    score,
    maxScore,
    accuracyPct: items.length ? Math.round((correct / items.length) * 100) : 0,
  };
}
