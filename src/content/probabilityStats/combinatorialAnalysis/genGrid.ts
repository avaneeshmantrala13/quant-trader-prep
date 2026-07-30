import type { Rng } from "@/lib/rng";
import type { NumericQuestion } from "@/types/content";
import {
  F,
  chooseBig,
  decText,
  factorialBig,
  fracText,
  multinomialBig,
  numDp,
  powBig,
} from "./combinatorics";
import { numericErrors } from "./_shared";
import {
  alternatingStepPathsCount,
  divisibleByModProb,
  lightsLineProb,
  multinomialPathsCount,
} from "./solvers";

/**
 * Parametric generators for the Probability & Statistics → **Combinatorial
 * Analysis** subcategory, GRID & LATTICE-COUNTING family (line coverage on a
 * grid, monotone lattice paths in 3-D, alternating-stride up/right paths, and
 * last-digits divisibility of a spun number).
 *
 * Every ground-truth value is produced by the EXACT solver in `./solvers.ts`
 * (`lightsLineProb`, `multinomialPathsCount`, `alternatingStepPathsCount`,
 * `divisibleByModProb`) — never a hardcoded table — and every distractor
 * (`numeric` commonErrors) is a re-derived, NAMED misconception, deduped and
 * kept ≠ the answer at the grading precision by `numericErrors`.
 *
 * Themes are all freshly invented and deliberately avoid the source-dataset
 * titles ("Lights On", "Rooftop Drone", "Running Rabbit", "Wheel of Eights").
 */

const SOURCE = "Combinatorial Analysis · Grid & lattice counting";

/* ========================================================================== */
/* =================  1 — FULL-LINE COVERAGE ON A GRID (prob)  ============= */
/* ========================================================================== */

const LINE_THEME = [
  { grid: "planetarium star panel", cell: "star", lit: "lit" },
  { grid: "pegboard of indicator pins", cell: "pin", lit: "glowing" },
  { grid: "server-rack status board", cell: "LED", lit: "active" },
];

/**
 * On a 4×4 grid, `onCount` cells are lit uniformly at random. P(they include a
 * full line — some row, column, or MAIN diagonal of 4 cells) = lightsLineProb.
 * There are 2n+2 = 10 lines; favorable = 10·C(n²−n, onCount−n). Traps: dropping
 * the two diagonals (2n lines), omitting the free-cell C(n²−n, onCount−n)
 * multiplier, and counting rows only (n lines).
 */
export function genLightsLine(rng: Rng): NumericQuestion {
  const th = rng.pick(LINE_THEME);
  const n = 4;
  const onCount = rng.pick([4, 5, 6]);
  const cells = n * n;
  const lines = 2 * n + 2;

  const value = lightsLineProb(n, onCount);
  const dp = numDp(value);
  const answer = Number(decText(value, dp));

  const total = chooseBig(cells, onCount);
  const free = chooseBig(cells - n, onCount - n);
  const noDiag = F(BigInt(2 * n) * free, total); // 2n lines, no diagonals
  const noMult = F(BigInt(lines), total); // forgot the free-cell multiplier
  const rowsOnly = F(BigInt(n) * free, total); // rows only

  const { errors, push } = numericErrors(answer, dp);
  push(
    noDiag,
    `Using 2n = ${2 * n} lines forgets the two main diagonals; a 4×4 grid has n rows + n columns + 2 diagonals = ${lines} full lines, so favorable = ${lines}·C(${cells - n}, ${onCount - n}) = ${fracText(F(BigInt(lines) * free, total))}.`,
  );
  push(
    noMult,
    `${lines}/C(${cells}, ${onCount}) = ${fracText(noMult)} omits the C(n²−n, onCount−n) = C(${cells - n}, ${onCount - n}) ways to place the remaining ${onCount - n} lit ${th.cell}s off the line.`,
  );
  push(
    rowsOnly,
    `Counting only the n = ${n} rows (ignoring columns and diagonals) undercounts the ${lines} full lines.`,
  );

  const prompt =
    `A ${th.grid} is a ${n}×${n} grid of ${th.cell}s. Exactly ${onCount} of the ${cells} ${th.cell}s are ${th.lit} uniformly at random. ` +
    `What is the probability that the ${th.lit} ${th.cell}s include a full line — a complete row, column, or main diagonal of ${n} ${th.cell}s? (Round to ${dp} decimals.)`;
  const explanation =
    `There are 2n+2 = ${lines} full lines (${n} rows, ${n} columns, 2 main diagonals). For a chosen line, its ${n} ${th.cell}s must all be ${th.lit} and the other ${onCount - n} lit ${th.cell}s can sit anywhere among the remaining ${cells - n} cells — C(${cells - n}, ${onCount - n}) = ${free} ways. With ${onCount} ≤ n+2 two lines can't both be complete, so favorable = ${lines}·${free} = ${lines * Number(free)} out of C(${cells}, ${onCount}) = ${total}. ` +
    `Thus P = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    id: `gen-gridline-${n}-${onCount}`,
    prompt,
    answer,
    decimals: dp,
    difficulty: "medium",
    concept: "Grid line coverage (rows, columns & diagonals)",
    explanation,
    unit: "",
    commonErrors: errors,
    source: SOURCE,
  };
}

/* ========================================================================== */
/* =================  2 — MONOTONE 3-D LATTICE ROUTES (count)  ============= */
/* ========================================================================== */

const PATHS3D_THEME = [
  { actor: "a warehouse picking robot", steps: "aisle, shelf, and lift moves" },
  { actor: "a maintenance bot in a scaffold cube", steps: "east, north, and up moves" },
  { actor: "a delivery quadcopter in a building shaft", steps: "x, y, and z hops" },
];

/**
 * Number of monotone unit-step routes from the origin to a 3-D point (a,b,c) =
 * multinomialPathsCount([a,b,c]) = (a+b+c)!/(a!b!c!). Traps: the 2-D binomial
 * C(a+b+c, a) (treating the other two axes as merged), (a+b+c)! (forgetting to
 * divide by the per-axis factorials), and the multinomial with one axis dropped
 * (collapsing to the (a,b)-plane).
 */
export function genMultinomialPaths(rng: Rng): NumericQuestion {
  const th = rng.pick(PATHS3D_THEME);

  let a = 3;
  let b = 4;
  let c = 5;
  for (let tries = 0; tries < 200; tries++) {
    const ca = rng.int(2, 6);
    const cb = rng.int(2, 6);
    const cc = rng.int(2, 6);
    // Avoid the source multiset {6,4,2} (any ordering → 13860, Rooftop Drone).
    const sorted = [ca, cb, cc].sort((x, y) => x - y).join(",");
    if (ca + cb + cc <= 14 && sorted !== "2,4,6") {
      a = ca;
      b = cb;
      c = cc;
      break;
    }
  }
  const total = a + b + c;

  const count = multinomialPathsCount([a, b, c]);
  const answer = Number(count);

  const binom = chooseBig(total, a); // merged the other two axes
  const factOnly = factorialBig(total); // forgot the per-axis factorials
  const drop2D = multinomialBig([a, b]); // collapsed to the (a,b)-plane

  const { errors, push } = numericErrors(answer, 0);
  push(
    Number(binom),
    `C(${total}, ${a}) = ${binom} is the 2-D count that merges the ${b} and ${c} moves into one "not-a" pool; the b and c directions are separate axes, so divide (${total})! by a!·b!·c!, not just a!·(b+c)!.`,
  );
  push(
    Number(factOnly),
    `(${total})! = ${factOnly} counts every ordering of ${total} distinct moves; identical moves along the same axis are interchangeable, so divide by ${a}!·${b}!·${c}!.`,
  );
  push(
    Number(drop2D),
    `Collapsing to the (a,b)-plane gives (${a + b})!/(${a}!${b}!) = ${drop2D}, which ignores the ${c} moves along the third axis entirely.`,
  );

  const prompt =
    `${th.actor} starts at the origin of a 3-D grid and must reach the point (${a}, ${b}, ${c}) using only unit ${th.steps} (never stepping backward). ` +
    `How many distinct monotone routes reach (${a}, ${b}, ${c})? (Whole number.)`;
  const explanation =
    `A route is an arrangement of ${a} steps in x, ${b} in y, and ${c} in z — a total of ${total} steps. The number of distinct orderings of this multiset is the multinomial (${total})!/(${a}!·${b}!·${c}!) = ${count}. ` +
    `So there are ${answer} monotone routes to (${a}, ${b}, ${c}).`;

  return {
    id: `gen-paths3d-${a}-${b}-${c}`,
    prompt,
    answer,
    difficulty: "medium",
    concept: "3-D lattice paths (multinomial coefficient)",
    explanation,
    unit: "",
    commonErrors: errors,
    source: SOURCE,
  };
}

/* ========================================================================== */
/* =================  3 — ALTERNATING-STRIDE UP/RIGHT PATHS (count)  ======= */
/* ========================================================================== */

const STRIDE_THEME = [
  { actor: "a parkour courier", verb: "vaults" },
  { actor: "a rooftop mail bot", verb: "hops" },
  { actor: "a relay sprinter on a grid track", verb: "bounds" },
];

/** Local mirror of the solver's forced-magnitude sequence (used only to derive
 * distractors — the count itself always comes from the solver). */
function strideSequence(
  X: number,
  Y: number,
  sA: number,
  sB: number,
): number[] | null {
  const total = X + Y;
  const build = (first: number, second: number): number[] | null => {
    const seq: number[] = [];
    let sum = 0;
    let useFirst = true;
    while (sum < total) {
      const step = useFirst ? first : second;
      seq.push(step);
      sum += step;
      useFirst = !useFirst;
    }
    return sum === total ? seq : null;
  };
  return build(sA, sB) ?? build(sB, sA);
}

/**
 * Up/right monotone paths from (0,0) to (X,Y) whose step MAGNITUDES alternate
 * sA, sB, sA, … (the sequence forced by X+Y) = alternatingStepPathsCount. Traps:
 * plain unit-step lattice paths C(X+Y, Y) (ignoring the fixed strides); picking
 * Y of the m strides to be "up" as if each up-stride added 1 to the height
 * (C(m, Y)); and treating every stride as an independent up/right choice (2^m),
 * ignoring that the up-strides must total exactly Y.
 *
 * (The (X,Y)-swapped count is NOT used as a distractor: by up/right symmetry it
 * always equals the answer here, so it would be a degenerate option.)
 */
export function genAlternatingSteps(rng: Rng): NumericQuestion {
  const th = rng.pick(STRIDE_THEME);
  const sA = 1;
  const sB = 3;

  let X = 13;
  let Y = 4;
  let count = alternatingStepPathsCount(X, Y, sA, sB);
  for (let tries = 0; tries < 300; tries++) {
    const cx = rng.int(10, 16);
    const cy = rng.int(3, 6);
    const c = alternatingStepPathsCount(cx, cy, sA, sB);
    // Avoid the source tuple (13,4) → 25 (Running Rabbit).
    if (c > 1n && c < 1000000n && !(cx === 13 && cy === 4)) {
      X = cx;
      Y = cy;
      count = c;
      break;
    }
  }
  const answer = Number(count);

  const seq = strideSequence(X, Y, sA, sB) ?? [];
  const m = seq.length; // number of alternating strides

  const unitPaths = chooseBig(X + Y, Y); // ignored the fixed strides
  const pickUpStrides = chooseBig(m, Y); // each up-stride assumed to add 1
  const freeBinary = powBig(2, m); // every stride an independent up/right

  const { errors, push } = numericErrors(answer, 0);
  push(
    Number(unitPaths),
    `C(${X + Y}, ${Y}) = ${unitPaths} counts ordinary unit-step lattice paths to (${X}, ${Y}); it ignores that the courier moves in fixed strides of ${sA} and ${sB}, so most of those routes are impossible.`,
  );
  push(
    Number(pickUpStrides),
    `Choosing ${Y} of the ${m} strides to go "up" gives C(${m}, ${Y}) = ${pickUpStrides}, but that pretends each up-stride raises the height by 1 — the strides are ${sA} and ${sB}, so the up-strides must SUM to ${Y}.`,
  );
  push(
    Number(freeBinary),
    `Treating each of the ${m} strides as a free up/right choice gives 2^${m} = ${freeBinary}, which ignores the constraint that the up-strides must total exactly ${Y}.`,
  );

  const prompt =
    `${th.actor} ${th.verb} from (0, 0) to (${X}, ${Y}) on a grid, moving only up or right. Its stride LENGTHS must alternate ${sA}, ${sB}, ${sA}, ${sB}, … (each move is entirely up or entirely right, but the magnitudes follow that fixed pattern). ` +
    `How many such up/right routes reach (${X}, ${Y})? (Whole number.)`;
  const explanation =
    `The total distance is X+Y = ${X + Y}, which forces the ${m}-stride magnitude sequence ${seq.join(", ")} (the unique alternation of ${sA} and ${sB} summing to ${X + Y}). Each stride is then labeled up or right; a route is valid exactly when the up-strides sum to Y = ${Y}. ` +
    `Counting those labelings gives ${answer} valid routes to (${X}, ${Y}).`;

  return {
    id: `gen-altstride-${X}-${Y}-${sA}-${sB}`,
    prompt,
    answer,
    difficulty: "medium",
    concept: "Lattice paths with alternating step sizes",
    explanation,
    unit: "",
    commonErrors: errors,
    source: SOURCE,
  };
}

/* ========================================================================== */
/* =================  4 — DIVISIBILITY OF A SPUN NUMBER (prob)  ============ */
/* ========================================================================== */

const DIAL_THEME = [
  { device: "a carnival prize dial", digit: "digit" },
  { device: "a raffle spinner", digit: "number" },
  { device: "an arcade reel", digit: "figure" },
];

/**
 * Spin a 1..faces (=6) dial `spins` times and concatenate the reads into one
 * big number. P(divisible by mod = 2^t) depends only on the last t digits =
 * divisibleByModProb(faces, mod, t). Traps: t/faces (constrained-digits over
 * face-count), 1/faces (one lucky face), and requiring EVERY one of the `spins`
 * digits to be even, (1/2)^spins.
 *
 * (The classic 1/mod "uniform residue" guess and (1/2)^t are NOT used: for
 * faces=6 the true probability equals 1/mod = (1/2)^t exactly, so they coincide
 * with the answer and can't serve as distractors.)
 */
export function genDivisibility(rng: Rng): NumericQuestion {
  const th = rng.pick(DIAL_THEME);
  const faces = 6;
  const mod = rng.pick([4, 8]);
  const t = Math.log2(mod); // 4→2, 8→3
  const spins = rng.pick([4, 5, 6]);

  const value = divisibleByModProb(faces, mod, t);
  const dp = numDp(value);
  const answer = Number(decText(value, dp));

  const tOverFaces = F(t, faces); // constrained digits / faces
  const oneFace = F(1, faces); // one lucky face
  const allEven = F(1, 2 ** spins); // every spun digit even

  const { errors, push } = numericErrors(answer, dp);
  push(
    tOverFaces,
    `t/faces = ${t}/${faces} = ${fracText(tOverFaces)} divides the ${t} constrained digits by the ${faces} faces — that isn't a probability; divisibility by ${mod} is decided by the VALUE of the last ${t} digits.`,
  );
  push(
    oneFace,
    `1/faces = 1/${faces} = ${fracText(oneFace)} guesses "one lucky face", but the event depends on the last ${t} digits jointly, not a single spin.`,
  );
  push(
    allEven,
    `Requiring all ${spins} spun ${th.digit}s to be even gives (1/2)^${spins} = ${fracText(allEven)}; divisibility by ${mod} = 2^${t} only constrains the last ${t} digits (and needs their value ≡ 0, not mere evenness).`,
  );

  const prompt =
    `You spin ${th.device} showing 1–${faces} a total of ${spins} times and write the reads left to right, forming a ${spins}-${th.digit} number. ` +
    `What is the probability that this number is divisible by ${mod}? (Round to ${dp} decimals.)`;
  const explanation =
    `Divisibility by ${mod} = 2^${t} depends only on the last ${t} ${th.digit}s of the number. Enumerating the ${faces}^${t} equally-likely last-${t}-digit combinations (digits 1–${faces}), the ones whose value is a multiple of ${mod} give P = ${fracText(value)} ≈ ${decText(value, dp)}. ` +
    `The earlier ${spins - t} spins don't affect divisibility by ${mod}.`;

  return {
    id: `gen-wheeldiv-${faces}-${mod}-${spins}`,
    prompt,
    answer,
    decimals: dp,
    difficulty: "medium",
    concept: "Last-digits divisibility (mod 2^t)",
    explanation,
    unit: "",
    commonErrors: errors,
    source: SOURCE,
  };
}
