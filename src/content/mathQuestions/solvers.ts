/**
 * Exact solvers for the **Math Questions** track (deterministic math word
 * problems: rate/work, algebra & systems, counting, number theory, geometry,
 * doubling/growth, and "solving unknowns"). Every user-facing answer and every
 * misconception distractor is computed here (or in `generators.ts`) from the
 * problem parameters, never hardcoded, so each generated item is provably
 * correct and the verification tests can re-derive the same values a second,
 * independent way.
 *
 * These are DETERMINISTIC problems: answers are counts / measurements / times
 * (NOT probabilities in [0,1]). The one genuinely rational family (Sharing a
 * Glass, 2/3 & 1/3) is delivered as an integrity flashcard, so numbers here stay
 * in exact integer / half-integer arithmetic and no fraction library is needed.
 */

/* -------------------------------------------------------------------------- */
/*  Small exact combinatorics (values here are small, safe as JS numbers)     */
/* -------------------------------------------------------------------------- */

/** Exact binomial coefficient C(n, k) as a number (n small in this track). */
export function choose(n: number, k: number): number {
  if (k < 0 || k > n || n < 0) return 0;
  k = Math.min(k, n - k);
  let num = 1;
  for (let i = 0; i < k; i++) num = (num * (n - i)) / (i + 1);
  return Math.round(num);
}

/** Exact factorial n! as a number (n ≤ ~15 in this track). */
export function factorial(n: number): number {
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}

/** Multinomial coefficient (Σparts)! / ∏(partᵢ!), arrangements of a multiset. */
export function multinomial(parts: number[]): number {
  const total = parts.reduce((a, b) => a + b, 0);
  let res = factorial(total);
  for (const p of parts) res /= factorial(p);
  return Math.round(res);
}

/* -------------------------------------------------------------------------- */
/*  COUNTING / COMBINATORICS                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Cold-Storage packing: how many s-cubes fit inside an L×W×H box. You must FLOOR
 * each dimension THEN multiply, not divide the volumes. (MQ7: 30³ box, 4-cubes
 * ⇒ ⌊30/4⌋³ = 7³ = 343, NOT ⌊30³/4³⌋ = 421.)
 */
export function packedCubes(dims: [number, number, number], s: number): number {
  return dims.reduce((acc, d) => acc * Math.floor(d / s), 1);
}

/** The volume-division TRAP: ⌊(L·W·H)/s³⌋ (the classic 421-vs-343 error). */
export function volumeTrap(dims: [number, number, number], s: number): number {
  const vol = dims[0] * dims[1] * dims[2];
  return Math.floor(vol / (s * s * s));
}

/** Rectangles on an n×n grid of cells = C(n+1,2)². (MQ29: 8×8 ⇒ 1296.) */
export function gridRectangles(n: number): number {
  const c = choose(n + 1, 2);
  return c * c;
}

/** Axis-aligned SQUARES on an n×n grid of cells = Σ k². (MQ38: 8×8 ⇒ 204.) */
export function gridSquares(n: number): number {
  return (n * (n + 1) * (2 * n + 1)) / 6;
}

/** Round-robin: n teams, each pair meets `meetings` times ⇒ meetings·C(n,2). (MQ13: 380.) */
export function roundRobinGames(n: number, meetings: number): number {
  return meetings * choose(n, 2);
}

/** Single-elimination knockout with n entrants ⇒ n − 1 matches. (MQ18: 127.) */
export function knockoutMatches(n: number): number {
  return n - 1;
}

/* -------------------------------------------------------------------------- */
/*  NUMBER THEORY / SUMMATION / GROWTH                                          */
/* -------------------------------------------------------------------------- */

/** Sum of all integers in [a, b] inclusive. */
export function sumRange(a: number, b: number): number {
  return ((a + b) * (b - a + 1)) / 2;
}

/** Sum of the ODD integers in [a, b] inclusive. (MQ25: odds in 100..200 ⇒ 7500.) */
export function sumOddsInRange(a: number, b: number): number {
  const lo = a % 2 === 0 ? a + 1 : a;
  const hi = b % 2 === 0 ? b - 1 : b;
  if (lo > hi) return 0;
  const count = (hi - lo) / 2 + 1;
  return (count * (lo + hi)) / 2;
}

/** Sum of the EVEN integers in [a, b] inclusive. */
export function sumEvensInRange(a: number, b: number): number {
  return sumRange(a, b) - sumOddsInRange(a, b);
}

/** Count of multiples of d in [lo, hi] inclusive. (MQ22: multiples of 37 in 37000..37999 ⇒ 28.) */
export function countMultiples(lo: number, hi: number, d: number): number {
  return Math.floor(hi / d) - Math.floor((lo - 1) / d);
}

/**
 * Doubling growth: if coverage DOUBLES every `period` days and the surface is
 * fully covered on `fullDay`, then it was covered by a factor 1/2^halvings on
 * day `fullDay − halvings·period`. (MQ27: full known, ¼ ⇒ full − 2·period.)
 */
export function doublingDayForFraction(
  fullDay: number,
  period: number,
  halvings: number,
): number {
  return fullDay - halvings * period;
}

/* -------------------------------------------------------------------------- */
/*  GEOMETRY                                                                    */
/* -------------------------------------------------------------------------- */

/** Angle (degrees) between clock hands at h:mm. (MQ1: 3:15 ⇒ 7.5°.) */
export function clockAngle(h: number, m: number): number {
  const raw = Math.abs(30 * (h % 12) - 5.5 * m);
  return Math.min(raw, 360 - raw);
}

/** The "minute hand only" trap: ignores that the hour hand also creeps (5.5·m → 6·m, 30·h stays). */
export function clockAngleNoHourCreep(h: number, m: number): number {
  const raw = Math.abs(30 * (h % 12) - 6 * m);
  return Math.min(raw, 360 - raw);
}

/**
 * Radius of a circle x² + y² + Dx + Ey + F = 0 (complete the square):
 * r = √((D/2)² + (E/2)² − F). (MQ28: −8x −6y +21 ⇒ r = 2.)
 */
export function circleRadius(D: number, E: number, F: number): number {
  return Math.sqrt((D / 2) ** 2 + (E / 2) ** 2 - F);
}

/**
 * Unfolded-box volume from three linear clues on the edges:
 *   w + h = a,  l + h = b,  2(w + l) = c.
 * ⇒ h = (a + b − c/2)/2, w = a − h, l = b − h, V = l·w·h. (MQ42: 9,17,24 ⇒ 140.)
 */
export function boxFromClues(a: number, b: number, c: number): {
  l: number;
  w: number;
  h: number;
  volume: number;
} {
  const h = (a + b - c / 2) / 2;
  const w = a - h;
  const l = b - h;
  return { l, w, h, volume: l * w * h };
}

/* -------------------------------------------------------------------------- */
/*  ALGEBRA / SYSTEMS / SOLVING UNKNOWNS (scalar answers)                       */
/* -------------------------------------------------------------------------- */

/** nth triangular number n(n+1)/2. (MQ3: 36th ⇒ 666.) */
export function triangular(n: number): number {
  return (n * (n + 1)) / 2;
}

/** Invert a triangular number: the n with n(n+1)/2 = total, or null if none. */
export function triangularIndex(total: number): number | null {
  const n = Math.round((-1 + Math.sqrt(1 + 8 * total)) / 2);
  return triangular(n) === total ? n : null;
}

/**
 * Two-animal heads/legs system: x two-legged + y four-legged, `heads` total
 * animals and `legs` total legs ⇒ fourLegged = (legs − 2·heads)/2. (MQ17/MQ24.)
 */
export function fourLeggedCount(heads: number, legs: number): number {
  return (legs - 2 * heads) / 2;
}

/**
 * Win/loss ledger: each win pays +`win`, each loss costs −`loss`; with `wins`
 * wins and net result `net`, losses = (wins·win − net)/loss, games = wins+losses.
 * (MQ40 Tic Tac Toe.)
 */
export function gamesFromLedger(
  wins: number,
  win: number,
  loss: number,
  net: number,
): { losses: number; games: number } {
  const losses = (wins * win - net) / loss;
  return { losses, games: wins + losses };
}

/**
 * Self-referential fish: head = `head`, tail = head + body/2, body = head + tail.
 * ⇒ body = 4·head, tail = 3·head, total = 8·head. (SU5 Long Fish: head 8 ⇒ 64.)
 */
export function longFishTotal(head: number): number {
  return 8 * head;
}

/**
 * Three unknowns from pairwise products: given WX=ab, WY=bc, XY=ca (here the
 * three products), each variable is √(prod of two ÷ the third); the product of
 * all three is √(WX·WY·XY). (SU6 Product of Unknowns flavour.)
 */
export function tripleFromPairwise(
  wx: number,
  wy: number,
  xy: number,
): { w: number; x: number; y: number; product: number } {
  const w = Math.sqrt((wx * wy) / xy);
  const x = Math.sqrt((wx * xy) / wy);
  const y = Math.sqrt((wy * xy) / wx);
  return { w, x, y, product: Math.sqrt(wx * wy * xy) };
}

/* -------------------------------------------------------------------------- */
/*  RATE / WORK / MOTION                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Net fill time: two inflows and a drain, net rate = f1 + f2 − drain (per min),
 * time = volume / net. (MQ11 Filling a Bathtub: 14+9−12 = 11, 572/11 = 52.)
 */
export function fillTime(
  f1: number,
  f2: number,
  drain: number,
  volume: number,
): number {
  return volume / (f1 + f2 - drain);
}

/**
 * Two-leg equal-distance trip: same distance d each way at speeds a and b, total
 * time T (hours) ⇒ d/a + d/b = T ⇒ d = T·a·b/(a+b). (MQ14: 24 mi.)
 */
export function twoLegDistance(a: number, b: number, hours: number): number {
  return (hours * a * b) / (a + b);
}

/**
 * River length: a raft drifts at the current V covering L in t1 hours (L = t1·V),
 * while a boat with own speed s covers the same L in t2 hours moving with the
 * current at V+s (L = t2·(V+s)). ⇒ V = t2·s/(t1−t2), L = t1·V. (MQ30: 36 m.)
 */
export function riverLength(t1: number, t2: number, s: number): {
  current: number;
  length: number;
} {
  const current = (t2 * s) / (t1 - t2);
  return { current, length: t1 * current };
}

/**
 * Escalator: walking UP you take `up` of your own steps; walking DOWN you take
 * `down`. With escalator fraction-speed S per your step, up = T/(1+S) and
 * down = T/(1−S), so the VISIBLE step count is T = 2·up·down/(up+down). (MQ10: 30.)
 */
export function escalatorSteps(up: number, down: number): number {
  return (2 * up * down) / (up + down);
}

/* -------------------------------------------------------------------------- */
/*  SOLVING UNKNOWNS. Linear Diophantine (A–E a permutation of 1..5)           */
/* -------------------------------------------------------------------------- */

export type DiophantineVars = { A: number; B: number; C: number; D: number; E: number };

/**
 * Brute-force EVERY assignment of {1,2,3,4,5} to (A,B,C,D,E) and return the ones
 * satisfying `constraints`. Used both to VERIFY a hand-authored puzzle has a
 * UNIQUE solution and to reproduce original-dataset tuples as hidden fixtures.
 */
export function solveDiophantine(
  constraints: (v: DiophantineVars) => boolean,
): DiophantineVars[] {
  const digits = [1, 2, 3, 4, 5];
  const out: DiophantineVars[] = [];
  const perm = (rest: number[], acc: number[]) => {
    if (rest.length === 0) {
      const [A, B, C, D, E] = acc;
      const v = { A, B, C, D, E };
      if (constraints(v)) out.push(v);
      return;
    }
    for (let i = 0; i < rest.length; i++) {
      perm([...rest.slice(0, i), ...rest.slice(i + 1)], [...acc, rest[i]]);
    }
  };
  perm(digits, []);
  return out;
}

/** Format a tuple as the canonical "A_ B_ C_ D_ E_" answer string. */
export function tupleString(v: DiophantineVars): string {
  return `A${v.A} B${v.B} C${v.C} D${v.D} E${v.E}`;
}
