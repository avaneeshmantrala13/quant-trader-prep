/**
 * Exact, PURE solvers for the Sequences & Pattern-Recognition family (T2).
 *
 * Each solver is built around a KNOWN generating rule (arithmetic, geometric,
 * finite-difference, interleaved, Fibonacci-like, alternating-operation, letter
 * shifts, odd-one-out, analogy). Given the rule's parameters it returns:
 *   - the terms actually SHOWN to the learner,
 *   - the true next term / answer (correct-by-construction), and
 *   - a list of NAMED "misreads", each a specific reasoning error (off-by-one
 *     continuation, wrong operation, used the previous term, treated one rule as
 *     another) with a stable misconception `tag` and a `why` explanation.
 *
 * Generators call these solvers and NEVER hardcode answer lists. Every misread
 * value is FORMAT-PARITY with the answer (all integers, or all single letters)
 * so the multiple-choice options can never leak the answer by shape.
 */

/* -------------------------------------------------------------------------- */
/*  Shared shapes                                                              */
/* -------------------------------------------------------------------------- */

/** A specific numeric wrong answer plus WHY a learner might produce it. */
export interface Misread {
  value: number;
  /** Stable, machine-readable misconception id. */
  tag: string;
  /** Human explanation of the reasoning error. */
  why: string;
}

/** A solved numeric sequence: shown terms, the true next term, and misreads. */
export interface SeqSolution {
  seq: number[];
  answer: number;
  misreads: Misread[];
}

/** A specific single-letter wrong answer plus WHY. */
export interface LetterMisread {
  value: string;
  tag: string;
  why: string;
}

/** A solved letter sequence: shown letters, the true next letter, misreads. */
export interface LetterSolution {
  seq: string[];
  answer: string;
  misreads: LetterMisread[];
}

const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i);

/* -------------------------------------------------------------------------- */
/*  Letter ↔ position mapping (1-indexed, wrapping A..Z)                        */
/* -------------------------------------------------------------------------- */

/** 'A'→1, 'B'→2, … 'Z'→26 (case-insensitive). */
export function letterToPos(ch: string): number {
  return ch.toUpperCase().charCodeAt(0) - 64;
}

/** Position → letter, wrapping cyclically so 27→'A', 0→'Z', −1→'Y'. */
export function posToLetter(pos: number): string {
  const m = (((pos - 1) % 26) + 26) % 26;
  return String.fromCharCode(65 + m);
}

/* -------------------------------------------------------------------------- */
/*  1. Arithmetic, constant common difference d                               */
/* -------------------------------------------------------------------------- */

export function arithmetic(a0: number, d: number, n: number): SeqSolution {
  const term = (i: number) => a0 + d * i;
  const seq = range(n).map(term);
  const answer = term(n);
  const misreads: Misread[] = [
    {
      value: term(n + 1),
      tag: "off_by_one_continuation",
      why: `Skipped a term, extrapolated to the term AFTER next instead of adding ${d} once.`,
    },
    {
      value: term(n - 1),
      tag: "used_previous_term",
      why: `Repeated the last term shown instead of advancing by the common difference ${d}.`,
    },
    {
      value: term(n) - 2 * d,
      tag: "wrong_sign_difference",
      why: `Subtracted the common difference ${d} instead of adding it.`,
    },
  ];
  return { seq, answer, misreads };
}

/* -------------------------------------------------------------------------- */
/*  2. Geometric, constant ratio r                                            */
/* -------------------------------------------------------------------------- */

export function geometric(a0: number, r: number, n: number): SeqSolution {
  const term = (i: number) => a0 * r ** i;
  const seq = range(n).map(term);
  const answer = term(n);
  const last = term(n - 1);
  const prev = term(n - 2);
  const misreads: Misread[] = [
    {
      value: term(n + 1),
      tag: "off_by_one_continuation",
      why: `Multiplied by the ratio ${r} one time too many.`,
    },
    {
      value: last + (last - prev),
      tag: "treated_as_arithmetic",
      why: "Added the last gap (treated a geometric sequence as arithmetic) instead of multiplying by the ratio.",
    },
    {
      value: last + r,
      tag: "added_ratio",
      why: `Added the ratio ${r} instead of multiplying by it.`,
    },
  ];
  return { seq, answer, misreads };
}

/* -------------------------------------------------------------------------- */
/*  3. Polynomial / finite-difference, constant SECOND difference (quadratic)  */
/* -------------------------------------------------------------------------- */

export function quadratic(
  aCoef: number,
  bCoef: number,
  cCoef: number,
  n: number,
): SeqSolution {
  const term = (i: number) => aCoef * i * i + bCoef * i + cCoef;
  const seq = range(n).map(term);
  const answer = term(n);
  const last = term(n - 1);
  const prev = term(n - 2);
  const firstDiff = last - prev; // last observed first difference
  const secondDiff = 2 * aCoef; // constant second difference
  const misreads: Misread[] = [
    {
      value: last + firstDiff,
      tag: "constant_first_difference",
      why: "Assumed the FIRST differences stay constant (linear), ignoring that the SECOND differences are constant.",
    },
    {
      value: last + firstDiff + 2 * secondDiff,
      tag: "over_accelerated",
      why: "Added the second difference twice, over-accelerated the growth.",
    },
    {
      value: last,
      tag: "used_previous_term",
      why: "Returned the last term shown without advancing at all.",
    },
  ];
  return { seq, answer, misreads };
}

/* -------------------------------------------------------------------------- */
/*  4. Interleaved, two interwoven arithmetic strands (even/odd positions)     */
/* -------------------------------------------------------------------------- */

export function interleaved(
  a0x: number,
  dx: number,
  a0y: number,
  dy: number,
  n: number,
): SeqSolution {
  // Even global indices come from strand X, odd from strand Y.
  const term = (i: number) =>
    i % 2 === 0 ? a0x + dx * (i / 2) : a0y + dy * ((i - 1) / 2);
  const seq = range(n).map(term);
  const nextIsX = n % 2 === 0;
  const xShown = Math.ceil(n / 2);
  const yShown = Math.floor(n / 2);
  const xNext = a0x + dx * xShown;
  const yNext = a0y + dy * yShown;
  const answer = nextIsX ? xNext : yNext;
  const otherNext = nextIsX ? yNext : xNext;
  const last = term(n - 1);
  const prev = term(n - 2); // last term of the SAME strand as the next one
  const misreads: Misread[] = [
    {
      value: last + Math.abs(last - prev),
      tag: "treated_as_single_sequence",
      why: "Merged the two interwoven strands and extended from the last term by the most recent visible gap.",
    },
    {
      value: otherNext,
      tag: "wrong_subsequence",
      why: "Continued the OTHER interleaved strand instead of the one whose turn it is.",
    },
    {
      value: prev,
      tag: "used_previous_term",
      why: "Repeated the previous term of the same strand instead of advancing it.",
    },
  ];
  return { seq, answer, misreads };
}

/* -------------------------------------------------------------------------- */
/*  5. Fibonacci-like, each term = sum of the previous two (general seeds)      */
/* -------------------------------------------------------------------------- */

export function fibonacciLike(s0: number, s1: number, n: number): SeqSolution {
  const seq: number[] = [s0, s1];
  for (let i = 2; i < n; i++) seq.push(seq[i - 1] + seq[i - 2]);
  const last = seq[n - 1];
  const prev = seq[n - 2];
  const prev2 = seq[n - 3];
  const answer = last + prev;
  const misreads: Misread[] = [
    {
      value: 2 * last,
      tag: "doubled_last",
      why: "Doubled the last term instead of adding the two preceding terms.",
    },
    {
      value: last + prev2,
      tag: "skipped_a_term",
      why: "Added the last term and the term TWO back, skipping the immediate predecessor.",
    },
    {
      value: last,
      tag: "used_previous_term",
      why: "Returned the last term shown without adding the term before it.",
    },
  ];
  return { seq, answer, misreads };
}

/* -------------------------------------------------------------------------- */
/*  6. Alternating-operation, cycle "+a" then "×b"                             */
/* -------------------------------------------------------------------------- */

export function alternatingOp(
  s: number,
  a: number,
  b: number,
  n: number,
): SeqSolution {
  const seq: number[] = [s];
  // Step producing term i uses op index (i-1): even → "+a", odd → "×b".
  for (let i = 1; i < n; i++) {
    const last = seq[i - 1];
    seq.push((i - 1) % 2 === 0 ? last + a : last * b);
  }
  const last = seq[n - 1];
  const prev = seq[n - 2];
  const nextIsAdd = (n - 1) % 2 === 0;
  const answer = nextIsAdd ? last + a : last * b;
  const otherOp = nextIsAdd ? last * b : last + a;
  const appliedToPrev = nextIsAdd ? prev + a : prev * b;
  const misreads: Misread[] = [
    {
      value: otherOp,
      tag: "wrong_operation",
      why: nextIsAdd
        ? `Multiplied by ${b} when the cycle called for adding ${a}.`
        : `Added ${a} when the cycle called for multiplying by ${b}.`,
    },
    {
      value: appliedToPrev,
      tag: "applied_to_wrong_term",
      why: "Applied the correct operation to the wrong (earlier) term.",
    },
    {
      value: last,
      tag: "used_previous_term",
      why: "Returned the last term without applying the next operation.",
    },
  ];
  return { seq, answer, misreads };
}

/* -------------------------------------------------------------------------- */
/*  7. Alphabetic, constant Caesar shift +k                                    */
/* -------------------------------------------------------------------------- */

export function caesar(p0: number, k: number, n: number): LetterSolution {
  const pos = (i: number) => p0 + k * i;
  const seq = range(n).map((i) => posToLetter(pos(i)));
  const answer = posToLetter(pos(n));
  const misreads: LetterMisread[] = [
    {
      value: posToLetter(pos(n + 1)),
      tag: "off_by_one_continuation",
      why: `Shifted +${k} one time too many (skipped a letter).`,
    },
    {
      value: posToLetter(pos(n - 1)),
      tag: "used_previous_term",
      why: "Repeated the last letter instead of shifting forward.",
    },
    {
      value: posToLetter(pos(n) - 2 * k),
      tag: "wrong_direction",
      why: `Shifted the wrong way (as if −${k}).`,
    },
  ];
  return { seq, answer, misreads };
}

/* -------------------------------------------------------------------------- */
/*  8. Alphabetic, alternating shifts (+a, +b, +a, …)                          */
/* -------------------------------------------------------------------------- */

export function alternatingShift(
  p0: number,
  a: number,
  b: number,
  n: number,
): LetterSolution {
  const positions: number[] = [p0];
  for (let i = 1; i < n; i++) {
    positions.push(positions[i - 1] + ((i - 1) % 2 === 0 ? a : b));
  }
  const lastPos = positions[n - 1];
  const nextIsA = (n - 1) % 2 === 0;
  const shift = nextIsA ? a : b;
  const otherShift = nextIsA ? b : a;
  const seq = positions.map(posToLetter);
  const answer = posToLetter(lastPos + shift);
  const misreads: LetterMisread[] = [
    {
      value: posToLetter(lastPos + otherShift),
      tag: "wrong_shift_in_cycle",
      why: `Used the other shift (+${otherShift}) when the cycle called for +${shift}.`,
    },
    {
      value: posToLetter(lastPos),
      tag: "used_previous_term",
      why: "Repeated the last letter instead of applying the next shift.",
    },
    {
      value: posToLetter(lastPos + shift + otherShift),
      tag: "applied_both_shifts",
      why: "Applied both shifts at once instead of just the next one.",
    },
  ];
  return { seq, answer, misreads };
}

/* -------------------------------------------------------------------------- */
/*  9. Odd-one-out, the one value that violates an encoded divisibility rule    */
/* -------------------------------------------------------------------------- */

/**
 * Given the four displayed values and the divisor rule `m`, return the UNIQUE
 * value that is NOT a multiple of `m` (the one that does not belong). Throws if
 * the caller did not construct exactly one violator, this is the exact
 * "verifier" that keeps the generator honest.
 */
export function findOddByDivisor(values: number[], m: number): number {
  const violators = values.filter((v) => v % m !== 0);
  if (violators.length !== 1) {
    throw new Error(
      `odd-one-out expects exactly one non-multiple of ${m}, got ${violators.length}`,
    );
  }
  return violators[0];
}

/* -------------------------------------------------------------------------- */
/*  10. Analogy, "a₁ : b₁ :: a₂ : b₂ :: c : ?" under a multiplicative rule      */
/* -------------------------------------------------------------------------- */

export interface AnalogySolution {
  a1: number;
  b1: number;
  a2: number;
  b2: number;
  answer: number;
  misreads: Misread[];
}

/**
 * Numeric analogy under the rule "multiply by r". A SINGLE example pair
 * `a : ar` is genuinely ambiguous — the additive reading `c + (ar − a)` is an
 * equally defensible rule, so a learner who adds the gap is not actually wrong
 * (audit S1). We therefore anchor the rule with TWO example pairs with distinct
 * inputs (`a1 ≠ a2`). Two points determine a unique affine map `y = m·x + k`;
 * because both pairs satisfy `y = r·x` (so `k = 0`), that unique affine rule IS
 * "×r". The additive reading "add a constant gap" requires
 * `b1 − a1 = b2 − a2`, i.e. `a1(r−1) = a2(r−1)`, which fails whenever
 * `a1 ≠ a2` — so it is now a genuine misconception, not a co-valid reading, and
 * `c·r` is the only defensible answer.
 */
export function analogyMul(
  a1: number,
  a2: number,
  r: number,
  c: number,
): AnalogySolution {
  const b1 = a1 * r;
  const b2 = a2 * r;
  const answer = c * r;
  // The additive gap differs between the two pairs (a1 ≠ a2 ⇒ different gap),
  // which is exactly why the "add the gap" reading is ruled out; we surface the
  // most-recent pair's gap as the tempting-but-wrong additive answer.
  const gap = b2 - a2;
  const misreads: Misread[] = [
    {
      value: c + gap,
      tag: "copied_absolute_gap",
      why: `Added the last pair's absolute gap (${gap}) to ${c}. That "add a constant" reading fails the FIRST pair (${a1}→${b1} adds ${b1 - a1}, not ${gap}); only ×${r} fits both examples.`,
    },
    {
      value: b2,
      tag: "copied_example_output",
      why: "Reused the previous pair's output instead of applying the rule to c.",
    },
    {
      value: c + r,
      tag: "added_ratio",
      why: `Added the ratio ${r} instead of multiplying by it.`,
    },
  ];
  return { a1, b1, a2, b2, answer, misreads };
}
