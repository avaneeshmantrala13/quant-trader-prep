import type { Rng } from "@/lib/rng";
import type { Difficulty, NumericQuestion } from "@/types/content";
import { F, decText, fracText } from "../coreSolvers";
import { numDp, numericErrors } from "../coreScaffold";
import {
  condMeanGivenY,
  mixtureExpectation,
  randomSumMean,
  randomSumVar,
  towerMeanFromTable,
} from "./condExp";

/**
 * Parametric numeric generators for **Conditional Expectation & the Tower Rule**.
 * Every correct value comes ONLY from `./condExp.ts`; every `commonError` is a
 * re-derived, NAMED misconception, distinct and ≠ the answer at grading
 * precision (asserted in `./condExp.test.ts`).
 */

const X_VALS = [1, 2, 3];

/**
 * Curated 3×2 joint weight tables (rows X=1,2,3; cols Y=A,B), all with UNEQUAL
 * column totals so the tower-rule mean is never the naive average of the two
 * conditional means. Small integer counts keep the pmf exact and readable.
 */
const TABLES: number[][][] = [
  [
    [2, 1],
    [3, 2],
    [1, 4],
  ],
  [
    [4, 1],
    [2, 3],
    [1, 1],
  ],
  [
    [1, 2],
    [4, 1],
    [2, 3],
  ],
  [
    [3, 1],
    [1, 4],
    [2, 2],
  ],
  [
    [2, 3],
    [3, 1],
    [4, 1],
  ],
];

const Y_LABELS = ["A", "B"] as const;

/** Render the joint table as equally-likely counts out of N. */
function renderTable(weights: number[][]): { text: string; total: number } {
  const total = weights.reduce((a, r) => a + r[0] + r[1], 0);
  const cells: string[] = [];
  for (let j = 0; j < 2; j++)
    for (let i = 0; i < 3; i++)
      cells.push(`(X=${X_VALS[i]}, Y=${Y_LABELS[j]}) → ${weights[i][j]}`);
  return { text: cells.join("; "), total };
}

/* ========================================================================== */
/*  Family A. E[X | Y = y] from a joint table (conditioning renormalises)     */
/* ========================================================================== */

export function buildCondMeanInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const weights = rng.pick(TABLES);
  const col = rng.int(0, 1);
  const value = condMeanGivenY(weights, X_VALS, col);
  const dp = numDp(value, 2, 4);
  const answer = Number(decText(value, dp));

  const colNum = X_VALS.reduce((a, x, i) => a + x * weights[i][col], 0);
  const colSum = weights.reduce((a, r) => a + r[col], 0);
  const { text, total } = renderTable(weights);

  const { errors, push } = numericErrors(answer, dp);
  // Forgot to condition, reported the unconditional E[X].
  push(
    towerMeanFromTable(weights, X_VALS),
    `${decText(towerMeanFromTable(weights, X_VALS), dp)} is the UNCONDITIONAL E[X]. Conditioning on Y=${Y_LABELS[col]} restricts to that column and renormalises by its total.`,
  );
  // Divided by the grand total N instead of the column total (didn't renormalise).
  push(
    F(colNum, total),
    `${decText(F(colNum, total), dp)} divides by the grand total N=${total} instead of the column total ${colSum}. A conditional mean must renormalise to P(Y=${Y_LABELS[col]}).`,
  );
  // Plain unweighted average of the x-values (ignored the pmf entirely).
  push(
    F(X_VALS.reduce((a, x) => a + x, 0), X_VALS.length),
    `${decText(F(X_VALS.reduce((a, x) => a + x, 0), X_VALS.length), dp)} is the plain average of 1, 2, 3, it ignores how the probability mass is spread across the column.`,
  );

  const prompt =
    `A pair (X, Y) is drawn from a joint distribution. Out of N = ${total} equally-likely outcomes, the counts are: ${text}. ` +
    `What is E[X | Y = ${Y_LABELS[col]}]? (Round to ${dp} decimals.)`;
  const explanation =
    `Condition on Y=${Y_LABELS[col]}: keep only that column (total ${colSum}) and renormalise. ` +
    `E[X|Y=${Y_LABELS[col]}] = (Σ x·count)/(column total) = ${colNum}/${colSum} = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `gen-condexp-cmean-${weights.flat().join("")}-${col}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Conditional mean E[X|Y=y] renormalises to the column",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Conditional Expectation · E[X|Y=y]",
    },
  };
}

/* ========================================================================== */
/*  Family B. Law of total expectation (two-branch mixture)                   */
/* ========================================================================== */

const MIX_THEME = [
  {
    setup: (p: string, a: number, b: number) =>
      `A support ticket is "simple" with probability ${p} (mean handling time ${a} minutes) and otherwise "complex" (mean ${b} minutes).`,
    ask: "What is the overall expected handling time?",
    unit: "minutes",
  },
  {
    setup: (p: string, a: number, b: number) =>
      `A trade routes to venue 1 with probability ${p} (mean fill size ${a} lots) and otherwise to venue 2 (mean ${b} lots).`,
    ask: "What is the overall expected fill size?",
    unit: "lots",
  },
  {
    setup: (p: string, a: number, b: number) =>
      `A part comes from line A with probability ${p} (mean ${a} defects) and otherwise line B (mean ${b} defects).`,
    ask: "What is the overall expected number of defects?",
    unit: "defects",
  },
];

const MIX_P: [number, number][] = [
  [1, 4],
  [3, 4],
  [1, 3],
  [2, 3],
  [2, 5],
  [3, 5],
];

export function buildMixtureInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(MIX_THEME);
  const [pn, pd] = rng.pick(MIX_P);
  const p = F(pn, pd);
  const q = F(1).sub(p);
  // Distinct branch means (a ≠ b) so the swapped-weight distractor never collides.
  const a = rng.pick([2, 4, 6, 8]);
  let b = rng.pick([3, 5, 9, 12]);
  while (b === a) b = rng.pick([3, 5, 9, 12]);

  const value = mixtureExpectation([p, q], [F(a), F(b)]);
  const dp = numDp(value, 2, 4);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  // Unweighted average of the two branch means.
  push(
    F(a + b, 2),
    `${decText(F(a + b, 2), dp)} averages the two means equally. Weight each by its probability: ${fracText(p)}·${a} + ${fracText(q)}·${b}.`,
  );
  // Swapped the two weights.
  push(
    mixtureExpectation([p, q], [F(b), F(a)]),
    `${decText(mixtureExpectation([p, q], [F(b), F(a)]), dp)} swaps the weights, it attaches ${fracText(p)} to the wrong branch mean.`,
  );
  // Reported only the first branch's mean.
  push(
    F(a),
    `${a} is only the first branch's mean; total expectation blends BOTH branches by their probabilities.`,
  );

  const prompt =
    `${th.setup(fracText(p), a, b)} ${th.ask} (Round to ${dp} decimals.)`;
  const explanation =
    `Law of total expectation: E[X] = P(branch 1)·E[X|1] + P(branch 2)·E[X|2] = ${fracText(p)}·${a} + ${fracText(q)}·${b} = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `gen-condexp-mix-${pn}_${pd}-${a}-${b}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Law of total expectation E[X]=Σ P(Y=y)E[X|Y=y]",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Conditional Expectation · total expectation",
    },
  };
}

/* ========================================================================== */
/*  Family C. Random sum (Wald): E[S] = E[N]·E[X]                             */
/* ========================================================================== */

const SUM_THEME = [
  {
    setup: (en: number, ex: string) =>
      `The number of customers who visit a stall in a day has mean ${en}, and each customer independently spends on average $${ex}.`,
    ask: "What is the expected total daily revenue (in dollars)?",
    unit: "$",
  },
  {
    setup: (en: number, ex: string) =>
      `A gambler plays a mean of ${en} rounds per night, and each round has a mean net win of ${ex}.`,
    ask: "What is the expected total net win?",
    unit: "",
  },
  {
    setup: (en: number, ex: string) =>
      `A file arrives with a mean of ${en} packets, and each packet independently carries on average ${ex} kB.`,
    ask: "What is the expected total size (in kB)?",
    unit: "kB",
  },
];

const EX_POOL: [number, number][] = [
  [3, 2],
  [5, 2],
  [7, 2],
  [3, 1],
  [4, 1],
  [5, 1],
];

export function buildRandomSumMeanInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(SUM_THEME);
  const EN = rng.pick([4, 6, 8, 10, 12]);
  const [exn, exd] = rng.pick(EX_POOL);
  const EX = F(exn, exd);
  const value = randomSumMean(F(EN), EX);
  const dp = numDp(value, 2, 4);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  // Added instead of multiplied.
  push(
    F(EN).add(EX),
    `${decText(F(EN).add(EX), dp)} ADDS E[N] and E[X]. Wald's identity MULTIPLIES: E[S] = E[N]·E[X].`,
  );
  // Used only the count.
  push(
    F(EN),
    `${EN} is only E[N], the expected COUNT. Each of the ${EN} carries E[X]=${fracText(EX)} on average, so multiply.`,
  );
  // Used only the per-item mean.
  push(
    EX,
    `${fracText(EX)} is only E[X] per item; scale it up by the expected count E[N]=${EN}.`,
  );

  const prompt = `${th.setup(EN, fracText(EX))} ${th.ask} (Round to ${dp} decimals.)`;
  const explanation =
    `By the tower rule E[S] = E[E[S|N]] = E[N·E[X]] = E[N]·E[X] = ${EN}·${fracText(EX)} = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `gen-condexp-rsum-${EN}-${exn}_${exd}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Random sum (Wald): E[S]=E[N]E[X]",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Conditional Expectation · random sum mean",
    },
  };
}

/* ========================================================================== */
/*  Family D. Law of total variance for a random sum                          */
/* ========================================================================== */

export function buildRandomSumVarInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const EN = rng.pick([5, 6, 8, 10]);
  const VN = rng.pick([2, 3, 4, 6]);
  const EX = rng.pick([2, 3, 4]); // ≥ 2 so E[X]² ≠ E[X] (square-vs-linear trap is live)
  const VX = rng.pick([1, 2, 3, 5]);
  const value = randomSumVar(F(EN), F(VN), F(EX), F(VX));
  const dp = 0;
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  // Forgot the Var(N)·E[X]² term.
  push(
    F(EN * VX),
    `${EN * VX} = E[N]·Var(X) drops the Var(N)·E[X]² term, the count itself is random, which adds variance.`,
  );
  // Forgot the E[N]·Var(X) term.
  push(
    F(VN * EX * EX),
    `${VN * EX * EX} = Var(N)·E[X]² drops the E[N]·Var(X) term from the within-batch spread.`,
  );
  // Forgot to SQUARE E[X].
  push(
    F(EN * VX + VN * EX),
    `${EN * VX + VN * EX} uses Var(N)·E[X] instead of Var(N)·E[X]², the second term squares the mean.`,
  );

  const prompt =
    `A random number N of claims arrives, with E[N] = ${EN} and Var(N) = ${VN}. Each claim size is independent with mean E[X] = ${EX} and variance Var(X) = ${VX}. ` +
    `What is the variance of the total S = X₁ + … + X_N? (Whole number.)`;
  const explanation =
    `Law of total variance: Var(S) = E[N]·Var(X) + Var(N)·E[X]² = ${EN}·${VX} + ${VN}·${EX}² = ${EN * VX} + ${VN * EX * EX} = ${value}.`;

  return {
    answer,
    numeric: {
      id: `gen-condexp-rsumvar-${EN}-${VN}-${EX}-${VX}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Law of total variance Var(S)=E[N]Var(X)+Var(N)E[X]²",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Conditional Expectation · total variance",
    },
  };
}

/* ========================================================================== */
/*  Family E. Tower rule: recover E[X] from a joint table                      */
/* ========================================================================== */

export function buildTowerTableInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const weights = rng.pick(TABLES);
  const value = towerMeanFromTable(weights, X_VALS);
  const dp = numDp(value, 2, 4);
  const answer = Number(decText(value, dp));

  const c0 = condMeanGivenY(weights, X_VALS, 0);
  const c1 = condMeanGivenY(weights, X_VALS, 1);
  const col0 = weights.reduce((a, r) => a + r[0], 0);
  const col1 = weights.reduce((a, r) => a + r[1], 0);
  const { text, total } = renderTable(weights);

  const { errors, push } = numericErrors(answer, dp);
  // Averaged the two conditional means with EQUAL weights (ignored P(Y)).
  push(
    c0.add(c1).div(2),
    `${decText(c0.add(c1).div(2), dp)} averages E[X|Y=A] and E[X|Y=B] equally. The tower rule weights them by P(Y=A)=${fracText(F(col0, total))} and P(Y=B)=${fracText(F(col1, total))}.`,
  );
  // Reported just one conditional mean.
  push(
    c0,
    `${decText(c0, dp)} is only E[X|Y=A]. Iterated expectation blends BOTH conditional means by P(Y=y).`,
  );
  // Plain unweighted x-average.
  push(
    F(X_VALS.reduce((a, x) => a + x, 0), X_VALS.length),
    `${decText(F(X_VALS.reduce((a, x) => a + x, 0), X_VALS.length), dp)} is the plain average of 1, 2, 3, it ignores the joint pmf.`,
  );

  const prompt =
    `A pair (X, Y) is drawn. Out of N = ${total} equally-likely outcomes, the counts are: ${text}. ` +
    `Use the tower rule E[X] = Σ_y P(Y=y)·E[X|Y=y] to find E[X]. (Round to ${dp} decimals.)`;
  const explanation =
    `E[X|Y=A] = ${fracText(c0)}, E[X|Y=B] = ${fracText(c1)}, with P(Y=A) = ${fracText(F(col0, total))}, P(Y=B) = ${fracText(F(col1, total))}. ` +
    `E[X] = ${fracText(F(col0, total))}·${fracText(c0)} + ${fracText(F(col1, total))}·${fracText(c1)} = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `gen-condexp-tower-${weights.flat().join("")}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Tower rule E[X]=E[E[X|Y]] from a joint table",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Conditional Expectation · tower rule",
    },
  };
}

/* ========================================================================== */
/*  Named generators (adapters)                                                */
/* ========================================================================== */

export const genCondMean = (rng: Rng): NumericQuestion =>
  buildCondMeanInstance(rng, "medium").numeric;
export const genMixture = (rng: Rng): NumericQuestion =>
  buildMixtureInstance(rng, "medium").numeric;
export const genRandomSumMean = (rng: Rng): NumericQuestion =>
  buildRandomSumMeanInstance(rng, "medium").numeric;
export const genRandomSumVar = (rng: Rng): NumericQuestion =>
  buildRandomSumVarInstance(rng, "hard").numeric;
export const genTowerTable = (rng: Rng): NumericQuestion =>
  buildTowerTableInstance(rng, "hard").numeric;
