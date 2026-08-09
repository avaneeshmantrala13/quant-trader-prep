/**
 * lib/oa/hardContent/generators.ts — SEEDABLE `QuestionGenerator`s for the hard,
 * firm-accurate Timed-OA archetypes. Every generator draws its parameters from a
 * seeded `Rng` and computes its CORRECT answer via the EXACT verifiers in
 * `./solvers.ts` (never a hardcoded per-instance answer), so each question is
 * correct-by-construction and fully reproducible from its seed alone.
 *
 * Each generator:
 *   • returns a well-formed MCQ `Question` (clear prompt, exactly 4 unique
 *     choices, exactly one correct, a worked `explanation`, a `concept`, a
 *     `difficulty` of "hard", and a distinct stable `family`);
 *   • builds DISTRACTORS from realistic wrong reasoning (parity trap, off-by-one,
 *     forgetting a term, using the fair-game / iid shortcut, …) rather than noise;
 *   • is fully deterministic given the rng seed.
 *
 * The flagship is the lattice path-intersection archetype (`hardPathIntersect`,
 * anchor `pathIntersectProb(3,4) = 3273/4096`) whose signature distractor is the
 * same-time meeting (parity) trap.
 *
 * The paired `build*` helpers additionally return the exact `answer` (the raw
 * verifier output) so the tests can assert the marked-correct choice equals the
 * verifier's exact answer; the exported thin `(rng) => Question` generators are
 * what the OA question pool consumes.
 */
import type Fraction from "fraction.js";
import type { Question, QuestionGenerator } from "@/types/content";
import { Rng } from "@/lib/rng";
import { MISCONCEPTION } from "@/lib/tutor/misconception";
import {
  F,
  basketArbProfit,
  basketNav,
  binom,
  bookOverround,
  coinBiasPosterior,
  completeGraph,
  couponCollectorEV,
  cycleGraph,
  cycleMeetingTime,
  deVigFairProb,
  expectedHittingTime,
  expectedWaitForPattern,
  fracExact,
  hiddenCompositionNextSame,
  informedLiftPosteriorMean,
  keepHigherOfTwoEV,
  kellyFraction,
  makeMarketPickoffLoss,
  maxOfDiceEV,
  minOfDiceEV,
  nextCardRedProb,
  oneRerollEV,
  pathIntersectProb,
  pickoffTradeCount,
  resetCollectorEV,
  ruinExpectedDuration,
  sameTimeMeetProb,
  secretaryOptimal,
  stepLandingProb,
} from "./solvers";

/* ========================================================================== */
/*  Shared value + choice helpers                                             */
/* ========================================================================== */

/** A scalar answer is either an exact rational (`Fraction`) or an integer. */
type Value = Fraction | number;

/** Numeric value of an answer (for tolerant compares in tests / dedupe). */
export function valueOf(v: Value): number {
  return typeof v === "number" ? v : v.valueOf();
}

/** Canonical display of a `Value`: an exact "a/b" (or integer) string. */
export function fmt(v: Value): string {
  return typeof v === "number" ? String(v) : fracExact(v);
}

/** Coerce a `Value` to an exact `Fraction` (for building fallback distractors). */
function asFrac(v: Value): Fraction {
  return typeof v === "number" ? F(v) : v;
}

interface Choice {
  text: string;
  rationale: string;
  /**
   * Optional machine-readable misconception TAG for this distractor (V3/V4). When
   * ANY choice carries one, {@link assembleFour} emits a `misconceptions[]` array
   * aligned with the shuffled `choices`, so BOTH the timed MCQ diagnostic and the
   * free-response `frAdapters` projection trip the same rung-1 nudge / rung-4
   * confront / mastery fold. Untagged choices stay `""` (a placeholder).
   */
  misconception?: string;
}

/** The MCQ fields an assembled question carries. */
type Assembled = Pick<
  Question,
  "choices" | "correctIndex" | "distractorRationale" | "misconceptions"
>;

/**
 * Assemble EXACTLY four unique MC choices from the correct answer plus a list of
 * realistic distractors, shuffled so the answer position never leaks. Distractors
 * are de-duplicated (and dropped if they collide with the correct answer); if
 * fewer than four survive, deterministic arithmetic-slip fillers (answer + k) top
 * it up so the set is always well-formed. Uses the SAME `rng` so ordering is
 * reproducible from the seed.
 */
function assembleFour(
  rng: Rng,
  answer: Value,
  correctRationale: string,
  distractors: Choice[],
): Assembled {
  const correctText = fmt(answer);
  const chosen: Choice[] = [{ text: correctText, rationale: correctRationale }];
  const seen = new Set<string>([correctText]);
  for (const d of distractors) {
    if (chosen.length >= 4) break;
    if (seen.has(d.text)) continue;
    seen.add(d.text);
    chosen.push(d);
  }
  // Guaranteed-distinct fillers when genuine distractors coincided.
  let k = 1;
  const base = asFrac(answer);
  while (chosen.length < 4) {
    const text = fmt(base.add(F(k)));
    k++;
    if (seen.has(text)) continue;
    seen.add(text);
    chosen.push({
      text,
      rationale:
        "An arithmetic slip that adds a spurious whole unit to the true value.",
    });
  }
  const order = rng.shuffle(chosen.map((_, i) => i));
  const shuffled = order.map((i) => chosen[i]);
  // Only emit `misconceptions` when at least one choice was tagged, so untagged
  // families keep their exact prior question shape (no empty array added).
  const misconceptions = shuffled.map((c) => c.misconception ?? "");
  const anyTagged = misconceptions.some((t) => t.length > 0);
  return {
    choices: shuffled.map((c) => c.text),
    correctIndex: order.indexOf(0),
    distractorRationale: shuffled.map((c) => c.rationale),
    ...(anyTagged ? { misconceptions } : {}),
  };
}

/** A `build*` result: the exact verifier answer plus the materialized question. */
export interface Built {
  answer: Value;
  question: Question;
}

/* ========================================================================== */
/*  Flagship — lattice random-walk PATH INTERSECTION (parity trap)            */
/* ========================================================================== */

const PATH_PAIRS: [number, number][] = [
  [3, 4],
  [2, 3],
  [1, 4],
  [2, 4],
  [3, 3],
  [2, 5],
  [3, 2],
  [4, 3],
  [2, 2],
  [1, 3],
];

/**
 * FLAGSHIP. Two monotone lattice walks: A from (0,0) stepping right/up, B from
 * (bx,by) stepping left/down, each direction ½. Exact P(they EVER share a
 * vertex) = `pathIntersectProb(bx,by)` (anchor (3,4) → 3273/4096). The signature
 * distractor is the SAME-TIME meeting (parity) trap: conflating "share a vertex"
 * with "occupy the same vertex at the same step" gives `sameTimeMeetProb`, which
 * is 0 whenever bx+by is odd.
 */
export function buildPathIntersect(rng: Rng): Built {
  const [bx, by] = rng.pick(PATH_PAIRS);
  const s = bx + by;
  const answer = pathIntersectProb(bx, by);
  const sameTime = sameTimeMeetProb(bx, by); // parity trap (0 when s is odd)
  const complement = F(1).sub(answer);
  const naive = F(binom(s, bx), 1 << s); // same-time formula IGNORING parity

  const distractors: Choice[] = [
    {
      text: fmt(sameTime),
      rationale:
        s % 2 === 0
          ? `Same-TIME meeting P = C(${s},${bx})/2^${s} = ${fmt(sameTime)}: the chance they occupy the same vertex on the same step. But "ever share a vertex" also counts crossings where one arrives earlier, so it is larger.`
          : `The parity trap: since bx+by = ${s} is odd, the two walkers can NEVER be at the same vertex on the same step, so the same-time meeting probability is 0. But they can still SHARE a vertex at different times (a crossing), so the true probability is far from 0.`,
    },
    {
      text: fmt(complement),
      rationale: `That is P(they never share a vertex) = 1 − ${fmt(answer)}. The question asks for the complement.`,
    },
    {
      text: fmt(naive),
      rationale: `C(${s},${bx})/2^${s} = ${fmt(naive)} counts same-step collisions ignoring parity; it neither restricts to a valid meeting step nor counts staggered crossings.`,
    },
  ];

  const question: Question = {
    id: `hard-pathIntersect-${bx}-${by}`,
    prompt:
      `Walker A starts at (0,0) and each step moves right or up with equal probability. ` +
      `Walker B starts at (${bx},${by}) and each step moves left or down with equal probability. ` +
      `Both take exactly ${s} steps. What is the probability that their paths ever pass through a common lattice point?`,
    explanation:
      `Enumerate the two walks over the ${s} shared anti-diagonals: on diagonal k, A and B occupy the same vertex iff they have the same x-coordinate there. Counting step-sequence pairs that coincide on some diagonal over the 4^${s} total gives P = ${fmt(answer)}. ` +
      `The classic trap is answering the same-time meeting probability, which is ${fmt(sameTime)} here (0 when bx+by is odd, by parity) — but "ever share a vertex" also counts staggered crossings.`,
    difficulty: "hard",
    concept: "Lattice random-walk path intersection (parity trap)",
    source: "Hard OA · Lattice path intersection",
    family: "hardPathIntersect",
    ...assembleFour(
      rng,
      answer,
      `Exact enumeration of both walks over the shared diagonals gives P(ever share a vertex) = ${fmt(answer)}.`,
      distractors,
    ),
  };
  return { answer, question };
}

/* ========================================================================== */
/*  Biased gambler's ruin — expected duration                                 */
/* ========================================================================== */

const RUIN_P: [number, number][] = [
  [9, 19],
  [1, 3],
  [2, 5],
  [1, 4],
  [3, 7],
  [4, 9],
];

/**
 * Biased ±1 walk started at `a` (win prob p < ½), absorbed at 0 or N. Exact
 * expected number of steps = `ruinExpectedDuration(a,N,p)`. Distractors: the
 * FAIR formula a(N−a), the inverted-bias duration, and the first term a/(q−p)
 * alone (dropping the boundary correction).
 */
export function buildRuinDuration(rng: Rng): Built {
  const [pn, pd] = rng.pick(RUIN_P);
  const p = F(pn, pd);
  const N = rng.pick([5, 6, 8, 10]);
  const a = rng.int(1, N - 1);
  const q = F(1).sub(p);
  const answer = ruinExpectedDuration(a, N, p);
  const fair = a * (N - a);
  const inverted = ruinExpectedDuration(a, N, q); // swapped edge
  const firstTerm = F(a).div(q.sub(p)); // a/(q−p), boundary term dropped

  const distractors: Choice[] = [
    {
      text: fmt(fair),
      rationale: `a(N−a) = ${fair} is the FAIR-game (p = ½) expected duration. With a per-round edge (p = ${fmt(p)} ≠ ½) the walk drifts, so the biased formula applies.`,
    },
    {
      text: fmt(inverted),
      rationale: `That is the duration with the edge flipped (win prob ${fmt(q)} instead of ${fmt(p)}). The drift direction changes the answer.`,
    },
    {
      text: fmt(firstTerm),
      rationale: `a/(q−p) = ${fmt(firstTerm)} keeps only the drift term and drops the boundary correction (N/(q−p))·P(reach N).`,
    },
  ];

  const question: Question = {
    id: `hard-ruinDuration-${a}-${N}-${pn}-${pd}`,
    prompt:
      `You start with ${a} chip(s) and stake one chip per round, winning each round with probability ${fmt(p)} (else you lose the chip). ` +
      `You stop at ${N} chips or at 0. What is the EXPECTED number of rounds until you stop?`,
    explanation:
      `For a biased walk with q = 1−p and r = q/p, the expected duration from a is a/(q−p) − (N/(q−p))·(1−r^a)/(1−r^N) = ${fmt(answer)}. ` +
      `The fair-game shortcut a(N−a) = ${fair} only holds when p = ½.`,
    difficulty: "hard",
    concept: "Biased gambler's ruin (expected absorption time)",
    source: "Hard OA · Gambler's ruin",
    family: "hardRuinDuration",
    ...assembleFour(
      rng,
      answer,
      `The biased-ruin duration formula gives ${fmt(answer)} rounds.`,
      distractors,
    ),
  };
  return { answer, question };
}

/* ========================================================================== */
/*  Expected wait for a symbol pattern (Conway; self-overlap)                  */
/* ========================================================================== */

const PATTERN_ALPHABETS: Record<number, string[]> = {
  2: ["H", "T"],
  3: ["A", "B", "C"],
};

/**
 * Expected fair m-symbol trials until the length-3 pattern `xyx` first appears
 * (x ≠ y), via Conway's correlation identity `E = Σ m^i over self-overlaps`.
 * Here the overlaps are i = 1 and i = 3, so E = m + m³. Distractors: the
 * maximal-overlap "run" value m + m² + m³ (treating it like xxx), the single
 * fixed-block value m³, and the sum-of-singles 3m.
 */
export function buildPatternWait(rng: Rng): Built {
  const m = rng.pick([2, 3]);
  const alpha = PATTERN_ALPHABETS[m];
  const xi = rng.int(0, m - 1);
  let yi = rng.int(0, m - 1);
  while (yi === xi) yi = rng.int(0, m - 1);
  const pattern = [xi, yi, xi]; // shape x y x
  const patStr = pattern.map((i) => alpha[i]).join("");
  const answer = expectedWaitForPattern(pattern, m); // m + m^3
  const runTrap = m + m * m + m * m * m; // as if xxx (full self-overlap)
  const block = m * m * m; // one fixed 3-window
  const singles = 3 * m; // sum of three single-symbol waits

  const distractors: Choice[] = [
    {
      text: fmt(runTrap),
      rationale: `${runTrap} treats ${patStr} like a run of three identical symbols (overlaps at i = 1, 2, 3). But ${patStr} does not overlap itself at length 2, so a near-miss keeps some progress and the wait is shorter.`,
    },
    {
      text: fmt(block),
      rationale: `m³ = ${block} is the reciprocal chance a single fixed 3-window equals ${patStr}. Overlapping windows and partial progress make the true wait longer.`,
    },
    {
      text: fmt(singles),
      rationale: `3·m = ${singles} adds three independent single-symbol waits, ignoring that the symbols must land CONSECUTIVELY in order.`,
    },
  ];

  const question: Question = {
    id: `hard-patternWait-${m}-${xi}-${yi}`,
    prompt:
      `A fair ${m}-sided symbol source emits letters from {${alpha.join(", ")}} independently. ` +
      `What is the expected number of emissions until the pattern ${patStr} first appears?`,
    explanation:
      `By Conway's correlation rule, E = Σ m^i over each i where ${patStr}'s first i symbols equal its last i. For ${patStr} those are i = 1 and i = 3, so E = m + m³ = ${answer}. ` +
      `Treating it like a run of three identical symbols would wrongly give m + m² + m³ = ${runTrap}.`,
    difficulty: "hard",
    concept: "Expected pattern wait (Conway; self-overlap ≠ run)",
    source: "Hard OA · Pattern waiting times",
    family: "hardPatternWait",
    ...assembleFour(
      rng,
      answer,
      `Conway's rule gives E = m + m³ = ${answer}.`,
      distractors,
    ),
  };
  return { answer, question };
}

/* ========================================================================== */
/*  Secretary / best-choice — optimal win probability                         */
/* ========================================================================== */

/**
 * Best-choice (secretary) problem for `n` candidates under the optimal
 * reject-first-r threshold rule. Exact optimal win probability =
 * `secretaryOptimal(n).prob`. Distractors: 1/n (take the first candidate), ½
 * (naive coin-flip), and r/n (the reject FRACTION mistaken for the win prob).
 */
export function buildSecretary(rng: Rng): Built {
  const n = rng.pick([4, 5, 6, 7, 8, 9]);
  const { r, prob } = secretaryOptimal(n);
  const answer = prob;

  const distractors: Choice[] = [
    {
      text: fmt(F(1, n)),
      rationale: `1/${n} is the win probability if you simply take the FIRST candidate (no sampling phase). The look-then-leap rule does much better.`,
    },
    {
      text: fmt(F(1, 2)),
      rationale: `½ assumes a coin-flip. The optimal best-choice probability is a specific value that tends to 1/e ≈ 0.368, not ½.`,
    },
    {
      text: fmt(F(r, n)),
      rationale: `${fmt(F(r, n))} is the optimal reject FRACTION r/n, not the probability of ending up with the best candidate.`,
    },
  ];

  const question: Question = {
    id: `hard-secretary-${n}`,
    prompt:
      `${n} candidates are interviewed in random order; you must accept or reject each on the spot and can never recall a rejected one. ` +
      `Using the optimal "reject the first r, then take the first who beats them all" rule, what is your probability of hiring the single best candidate?`,
    explanation:
      `The rule P(r) = (r/n)·Σ_{j=r}^{n−1} 1/j is maximized at r = ${r}, giving P = ${fmt(answer)}. As n grows this converges to 1/e ≈ 0.368.`,
    difficulty: "hard",
    concept: "Secretary problem (optimal threshold win probability)",
    source: "Hard OA · Optimal stopping",
    family: "hardSecretary",
    ...assembleFour(
      rng,
      answer,
      `Optimizing the threshold rule over r gives win probability ${fmt(answer)} (at r = ${r}).`,
      distractors,
    ),
  };
  return { answer, question };
}

/* ========================================================================== */
/*  Expected hitting time on a graph (exact linear solve)                      */
/* ========================================================================== */

/**
 * Expected steps for a uniform random walk to first reach a target on one of
 * three vertex-transitive graphs (cube antipode, complete graph, cycle),
 * computed by an exact rational linear solve. Distractors are the graph distance
 * (minimum steps), the vertex count, and a nearby off-by-one/step guess.
 */
/**
 * Adjacency list of the `d`-dimensional hypercube `Q_d` (2^d vertices; vertex 0
 * and 2^d − 1 are antipodal). Generalises the 3-cube so the hitting-time cube
 * branch can VARY its dimension (M7 anti-duplication). Each vertex connects to
 * the `d` vertices reachable by flipping one bit.
 */
function hypercubeGraph(d: number): number[][] {
  const n = 1 << d;
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (let v = 0; v < n; v++) {
    for (let bit = 0; bit < d; bit++) adj[v].push(v ^ (1 << bit));
  }
  return adj;
}

export function buildGraphHitting(rng: Rng): Built {
  const kind = rng.pick(["cube", "complete", "cycle"] as const);

  if (kind === "cube") {
    // Parametrized over the hypercube dimension d (M7: the cube branch used to be
    // parameter-free, so a repeated draw rendered the identical prompt). d = 3 is
    // the classic 8-corner cube (answer 10); d = 4 is the 16-corner tesseract.
    // Every value is an EXACT rational linear solve on Q_d — nothing hardcoded.
    const d = rng.pick([3, 4] as const);
    const g = hypercubeGraph(d);
    const nVerts = 1 << d;
    const antipode = nVerts - 1;
    const answer = expectedHittingTime(g, 0, [antipode]);
    // Vertex 1 (one bit set) is a neighbour of the start 0; its hitting time is
    // the "from an adjacent corner" distractor (9 for the classic cube).
    const adjacent = expectedHittingTime(g, 1, [antipode]);
    const cubeWord = d === 3 ? "cube" : `${d}-dimensional hypercube`;
    const distractors: Choice[] = [
      { text: fmt(d), rationale: `${d} is the graph distance (min edges) between opposite corners, not the expected random-walk time.` },
      { text: fmt(nVerts), rationale: `${nVerts} is the number of corners, not a hitting time.` },
      { text: fmt(adjacent), rationale: `${fmt(adjacent)} is the expected time from an ADJACENT corner (distance 1); from the start it is more.` },
    ];
    const question: Question = {
      id: `hard-graphHitting-cube-${d}`,
      prompt:
        `A bug does a random walk on the ${nVerts} corners of a ${cubeWord}, each second stepping to a uniformly random adjacent corner. ` +
        `Starting at one corner, what is the expected number of steps to first reach the diagonally opposite corner?`,
      explanation:
        `An exact linear solve of the distance-class hitting-time equations on the ${cubeWord} (${nVerts} corners, antipode absorbing) gives E = ${fmt(answer)} steps (the adjacent-corner time is ${fmt(adjacent)}).`,
      difficulty: "hard",
      concept: "Expected hitting time on a graph (hypercube antipode)",
      source: "Hard OA · Random walks on graphs",
      family: "hardGraphHitting",
      ...assembleFour(rng, answer, `The exact linear solve gives ${fmt(answer)} steps.`, distractors),
    };
    return { answer, question };
  }

  if (kind === "complete") {
    const n = rng.pick([4, 5, 6]);
    const answer = expectedHittingTime(completeGraph(n), 0, [1]);
    const distractors: Choice[] = [
      { text: fmt(1), rationale: `1 is the graph distance (every pair is adjacent), but the walk often steps to one of the OTHER n−2 vertices first.` },
      { text: fmt(n), rationale: `${n} is the vertex count, off by one from the hitting time.` },
      { text: fmt(2 * (n - 1)), rationale: `${2 * (n - 1)} double-counts; the geometric wait to pick a specific neighbour out of n−1 is n−1.` },
    ];
    const question: Question = {
      id: `hard-graphHitting-complete-${n}`,
      prompt:
        `On the complete graph K${n} (every one of ${n} vertices adjacent to every other), a walker steps each second to a uniformly random neighbour. ` +
        `What is the expected number of steps to first reach one specific target vertex?`,
      explanation:
        `Each step reaches the target with probability 1/(n−1) = 1/${n - 1}, a geometric wait with mean n−1 = ${fmt(answer)}.`,
      difficulty: "hard",
      concept: "Expected hitting time on a graph (complete graph)",
      source: "Hard OA · Random walks on graphs",
      family: "hardGraphHitting",
      ...assembleFour(rng, answer, `The geometric wait gives n−1 = ${fmt(answer)} steps.`, distractors),
    };
    return { answer, question };
  }

  // cycle
  const n = rng.pick([5, 6, 7, 8]);
  const d = rng.int(1, n - 1);
  const answer = expectedHittingTime(cycleGraph(n), 0, [d]);
  const dist = Math.min(d, n - d);
  const distractors: Choice[] = [
    { text: fmt(dist), rationale: `${dist} is the graph distance (fewest edges) to the target, the minimum, not the expected time with back-steps.` },
    { text: fmt(n), rationale: `${n} is the number of vertices on the cycle, not a hitting time.` },
    { text: fmt(2 * d), rationale: `2·${d} = ${2 * d} guesses "twice the offset"; the exact hitting time on a cycle is d(n−d).` },
  ];
  const question: Question = {
    id: `hard-graphHitting-cycle-${n}-${d}`,
    prompt:
      `On a cycle of ${n} vertices, a walker steps left or right with equal probability each second. ` +
      `Starting at a vertex, what is the expected number of steps to first reach the vertex ${d} position(s) clockwise from it?`,
    explanation:
      `On an n-cycle the expected hitting time to a vertex at offset d is d(n−d) = ${d}·${n - d} = ${fmt(answer)} (solve E_x = 1 + ½E_{x−1} + ½E_{x+1} with the target absorbing).`,
    difficulty: "hard",
    concept: "Expected hitting time on a graph (cycle)",
    source: "Hard OA · Random walks on graphs",
    family: "hardGraphHitting",
    ...assembleFour(rng, answer, `The exact linear solve gives d(n−d) = ${fmt(answer)} steps.`, distractors),
  };
  return { answer, question };
}

/* ========================================================================== */
/*  Coupon collector with a fragile last face (reset)                          */
/* ========================================================================== */

/**
 * Roll a fair `n`-face die; once n−1 distinct faces are collected, any repeat
 * RESETS progress to zero. Exact expected rolls = `resetCollectorEV(n)`.
 * Distractors: the plain coupon-collector n·H_n (no reset), the face count n,
 * and the reset value with the leading +1 dropped.
 */
export function buildResetCollector(rng: Rng): Built {
  const n = rng.pick([4, 5, 6, 7]);
  const answer = resetCollectorEV(n);
  const plain = couponCollectorEV(n);
  let a = F(0);
  for (let k = 0; k <= n - 2; k++) a = a.add(F(n, n - k));
  const droppedPlusOne = a.mul(n); // forgot the (+1) before multiplying by n

  const distractors: Choice[] = [
    {
      text: fmt(plain),
      rationale: `n·H_n = ${fmt(plain)} is the PLAIN coupon-collector expectation with no reset. The fragile last face inflates this dramatically.`,
    },
    { text: fmt(n), rationale: `${n} is just the number of faces, not the expected number of rolls.` },
    {
      text: fmt(droppedPlusOne),
      rationale: `${fmt(droppedPlusOne)} drops the leading +1 in n·(a+1); the extra term counts the final winning roll.`,
    },
  ];

  const question: Question = {
    id: `hard-resetCollector-${n}`,
    prompt:
      `You roll a fair ${n}-sided die repeatedly to collect all ${n} faces. But it is fragile: once you have ${n - 1} distinct faces, rolling any face you have already seen RESETS your progress to zero. ` +
      `What is the expected number of rolls to finally collect all ${n} faces?`,
    explanation:
      `With a = Σ_{k=0}^{n−2} n/(n−k), the expected rolls are n·(a + 1) = ${fmt(answer)}. Compare the plain no-reset value n·H_n = ${fmt(plain)}: the reset near the finish line multiplies the effort.`,
    difficulty: "hard",
    concept: "Coupon collector with a fragile last face (reset)",
    source: "Hard OA · Coupon collector",
    family: "hardResetCollector",
    ...assembleFour(rng, answer, `The reset recurrence gives n·(a+1) = ${fmt(answer)} rolls.`, distractors),
  };
  return { answer, question };
}

/* ========================================================================== */
/*  Hidden-composition Bayes (Citadel)                                         */
/* ========================================================================== */

/**
 * A bag of N stones, the number black uniform on {0..N}. After drawing m black
 * without replacement, the posterior predictive P(next is black) =
 * `hiddenCompositionNextSame(N,m)`. Distractors: ½ (iid-fair trap), m/N
 * (empirical fraction drawn), and Laplace's (m+1)/(N+1).
 */
export function buildHiddenComposition(rng: Rng): Built {
  const N = rng.pick([4, 5, 6, 8]);
  const m = rng.int(1, N - 1);
  const answer = hiddenCompositionNextSame(N, m);

  const distractors: Choice[] = [
    { text: fmt(F(1, 2)), rationale: `½ is the iid-fair answer (each stone independently black w.p. ½). Here the composition is UNKNOWN, so black draws are evidence the bag is black-heavy.`, misconception: MISCONCEPTION.baseRateNeglect },
    { text: fmt(F(m, N)), rationale: `${fmt(F(m, N))} = m/N is the fraction of the bag you have drawn black, not the posterior predictive for the next draw.`, misconception: "posterior_predictive_confusion" },
    { text: fmt(F(m + 1, N + 1)), rationale: `${fmt(F(m + 1, N + 1))} is Laplace's rule of succession, which is the answer for a different (Beta-Bernoulli) prior, not the uniform-count model here.`, misconception: "confused_posterior_prior_model" },
  ];

  const question: Question = {
    id: `hard-hiddenComposition-${N}-${m}`,
    prompt:
      `A bag holds ${N} stones, each black or white; the number of black stones is equally likely to be any of 0,1,…,${N}. ` +
      `You draw ${m} stones without replacement and all ${m} are black. What is the probability the NEXT stone drawn is also black?`,
    explanation:
      `Weight each possible composition K by its likelihood of the ${m} black draws, then average (K−${m})/(${N}−${m}). This posterior predictive equals ${fmt(answer)} — larger than ½ because the black run is evidence for a black-heavy bag.`,
    difficulty: "hard",
    concept: "Hidden-composition Bayesian updating",
    source: "Hard OA · Bayesian inference",
    family: "hardHiddenComposition",
    ...assembleFour(rng, answer, `The posterior predictive probability is ${fmt(answer)}.`, distractors),
  };
  return { answer, question };
}

/* ========================================================================== */
/*  Bayesian fair-vs-biased coin (Optiver)                                     */
/* ========================================================================== */

const COIN_PB: [number, number][] = [
  [3, 4],
  [2, 3],
  [4, 5],
  [3, 5],
];

/**
 * A coin is fair or biased (P(H) = pB), 50/50 a priori. After k heads in a row,
 * the predictive P(next head) = `coinBiasPosterior(pB,k).predictiveHead`.
 * Distractors: pB (assume it's the biased coin), ½ (assume fair), and the
 * posterior P(biased) itself (confusing it with the predictive).
 */
export function buildCoinBias(rng: Rng): Built {
  const [pn, pd] = rng.pick(COIN_PB);
  const pB = F(pn, pd);
  const k = rng.pick([2, 3, 4]);
  const { posteriorBiased, predictiveHead } = coinBiasPosterior(pB, k);
  const answer = predictiveHead;

  const distractors: Choice[] = [
    { text: fmt(pB), rationale: `${fmt(pB)} assumes the coin is CERTAINLY the biased one. After only ${k} heads there is still meaningful posterior weight on the fair coin.`, misconception: MISCONCEPTION.likelihoodAsPosterior },
    { text: fmt(F(1, 2)), rationale: `½ ignores the update; ${k} heads in a row shifts weight toward the biased coin, raising the predictive above ½.`, misconception: MISCONCEPTION.baseRateNeglect },
    { text: fmt(posteriorBiased), rationale: `${fmt(posteriorBiased)} is the posterior P(biased | ${k} heads), not the predictive P(next head).`, misconception: "posterior_not_predictive" },
  ];

  const question: Question = {
    id: `hard-coinBias-${pn}-${pd}-${k}`,
    prompt:
      `A coin is equally likely to be fair (P(heads) = ½) or biased with P(heads) = ${fmt(pB)}. ` +
      `You flip it ${k} times and get ${k} heads. What is the probability the NEXT flip is heads?`,
    explanation:
      `Posterior P(biased) = pB^${k} / (pB^${k} + (½)^${k}) = ${fmt(posteriorBiased)}. Then P(next head) = P(fair)·½ + P(biased)·pB = ${fmt(answer)}.`,
    difficulty: "hard",
    concept: "Bayesian update, fair vs biased coin (predictive)",
    source: "Hard OA · Bayesian inference",
    family: "hardCoinBias",
    ...assembleFour(rng, answer, `The predictive next-head probability is ${fmt(answer)}.`, distractors),
  };
  return { answer, question };
}

/* ========================================================================== */
/*  Dice order statistics — E[max] / E[min]                                    */
/* ========================================================================== */

/**
 * E[max] or E[min] of `m` fair `f`-sided dice, exact. Distractors: the
 * single-die mean (f+1)/2, the relevant extreme (f for max, 1 for min), and the
 * OPPOSITE order statistic.
 */
export function buildDiceOrderStat(rng: Rng): Built {
  const wantMax = rng.chance(0.5);
  const f = rng.pick([4, 6, 8]);
  const m = rng.pick([2, 3]);
  const answer = wantMax ? maxOfDiceEV(m, f) : minOfDiceEV(m, f);
  const other = wantMax ? minOfDiceEV(m, f) : maxOfDiceEV(m, f);
  const mean = F(f + 1, 2);
  const extreme = wantMax ? f : 1;
  const word = wantMax ? "maximum" : "minimum";

  const distractors: Choice[] = [
    { text: fmt(mean), rationale: `(f+1)/2 = ${fmt(mean)} is the mean of a SINGLE die; the ${word} of ${m} dice is pulled toward the extreme.` },
    { text: fmt(extreme), rationale: `${extreme} is the largest possible ${word === "maximum" ? "value" : "value"}, achieved only rarely, not the expected ${word}.` },
    { text: fmt(other), rationale: `${fmt(other)} is the expected ${wantMax ? "MINIMUM" : "MAXIMUM"} of the ${m} dice — the opposite order statistic.` },
  ];

  const question: Question = {
    id: `hard-diceOrderStat-${wantMax ? "max" : "min"}-${m}-${f}`,
    prompt:
      `You roll ${m} fair ${f}-sided dice. What is the expected value of the ${word} of the ${m} rolls?`,
    explanation:
      `Using P(${word} ${wantMax ? "≤" : "≥"} k) from the ${m}-fold product, E[${word}] = Σ k·P(${word} = k) = ${fmt(answer)}.`,
    difficulty: "hard",
    concept: `Order statistics of dice (E[${word}])`,
    source: "Hard OA · Dice order statistics",
    family: "hardDiceOrderStat",
    ...assembleFour(rng, answer, `The exact order-statistic expectation is ${fmt(answer)}.`, distractors),
  };
  return { answer, question };
}

/* ========================================================================== */
/*  Informed-lift posterior mean (IMC order-flow)                              */
/* ========================================================================== */

/**
 * A market-maker quotes an ask on the sum of 2 fair f-sided dice; a fully
 * informed counterparty lifts iff sum > ask. Posterior mean E[sum | sum > ask] =
 * `informedLiftPosteriorMean(2,f,ask)`. Distractors: the UNconditional mean
 * (f+1), ask+1, and the maximum possible sum 2f.
 */
export function buildInformedLift(rng: Rng): Built {
  const f = rng.pick([6, 8]);
  const ask = f === 6 ? rng.pick([7, 8, 9]) : rng.pick([9, 10, 12]);
  const answer = informedLiftPosteriorMean(2, f, ask);
  const uncond = f + 1; // E[sum] of two dice = 2·(f+1)/2
  const maxSum = 2 * f;

  const distractors: Choice[] = [
    { text: fmt(uncond), rationale: `${uncond} is the UNconditional mean of the two-dice sum. Conditioning on "sum > ${ask}" (adverse selection) raises it.` },
    { text: fmt(ask + 1), rationale: `${ask + 1} is just one above the ask; the counterparty lifts on a whole distribution of higher sums, so the mean is larger.` },
    { text: fmt(maxSum), rationale: `${maxSum} is the maximum possible sum; the conditional mean is well below the ceiling.` },
  ];

  const question: Question = {
    id: `hard-informedLift-${f}-${ask}`,
    prompt:
      `You quote an ask of ${ask} on the sum of two fair ${f}-sided dice. A fully informed counterparty lifts your offer only when the true sum exceeds ${ask}. ` +
      `Given that they lift, what is the expected value of the dice sum?`,
    explanation:
      `Restrict the sum distribution to values > ${ask} and take its (count-weighted) mean: E[sum | sum > ${ask}] = ${fmt(answer)}. This adverse-selection premium is why the informed lift is bad news for the maker.`,
    difficulty: "hard",
    concept: "Order-flow adverse selection (conditional mean)",
    source: "Hard OA · Market-making Bayes",
    family: "hardInformedLift",
    ...assembleFour(rng, answer, `The conditional mean E[sum | sum > ${ask}] is ${fmt(answer)}.`, distractors),
  };
  return { answer, question };
}

/* ========================================================================== */
/*  One optional reroll — game value (SIG)                                     */
/* ========================================================================== */

/**
 * Draw uniform on {1..n}; you may reroll ONCE (then must keep the second), and
 * you optimally reroll iff the first draw is below the mean. Exact game value =
 * `oneRerollEV(n)`. Distractors: the plain mean (n+1)/2 (never reroll), the
 * best-of-two E[max] (as if you keep the higher), and n (keep the max).
 */
export function buildOneReroll(rng: Rng): Built {
  const n = rng.pick([6, 8, 10, 13, 20]);
  const answer = oneRerollEV(n);
  const mean = F(n + 1, 2);
  const bestTwo = keepHigherOfTwoEV(n);

  const distractors: Choice[] = [
    { text: fmt(mean), rationale: `(n+1)/2 = ${fmt(mean)} is the value of NEVER rerolling. The option to reroll a low first draw is worth strictly more.` },
    { text: fmt(bestTwo), rationale: `${fmt(bestTwo)} is E[max of two draws], i.e. always drawing twice and keeping the higher. But you must DECIDE to reroll before seeing the second, and you commit to it.` },
    { text: fmt(n), rationale: `${n} is the maximum value; you cannot guarantee the top roll.` },
  ];

  const question: Question = {
    id: `hard-oneReroll-${n}`,
    prompt:
      `You draw a number uniformly from 1 to ${n}. You may either keep it or reroll ONCE, in which case you must keep the second draw. ` +
      `Playing optimally, what is the expected value of your final number?`,
    explanation:
      `Reroll iff the first draw is below the mean (n+1)/2. The value is P(first high)·E[first | high] + P(first low)·E[fresh draw] = ${fmt(answer)}.`,
    difficulty: "hard",
    concept: "Optimal one-reroll game value",
    source: "Hard OA · Optimal stopping / EV",
    family: "hardOneReroll",
    ...assembleFour(rng, answer, `The optimal-reroll game value is ${fmt(answer)}.`, distractors),
  };
  return { answer, question };
}

/* ========================================================================== */
/*  Coin-driven step-landing recurrence (DRW)                                  */
/* ========================================================================== */

/**
 * A walker advances +1 (heads, ½) or +2 (tails, ½). Exact P(it ever lands
 * exactly on step n) = `stepLandingProb(n)` = 2/3 + (1/3)(−½)^n. Distractors:
 * the 2/3 limit, ½ (naive), and the complement 1 − p.
 */
export function buildStepLanding(rng: Rng): Built {
  const n = rng.pick([4, 5, 6, 8, 10]);
  const answer = stepLandingProb(n);

  const distractors: Choice[] = [
    { text: fmt(F(2, 3)), rationale: `2/3 is the LIMIT of the landing probability as n → ∞; for finite n it oscillates around 2/3.` },
    { text: fmt(F(1, 2)), rationale: `½ guesses a coin-flip. The recurrence p_n = ½p_{n−1} + ½p_{n−2} gives a value near 2/3, not ½.` },
    { text: fmt(F(1).sub(answer)), rationale: `${fmt(F(1).sub(answer))} is the probability of SKIPPING step n (jumping over it), the complement.` },
  ];

  const question: Question = {
    id: `hard-stepLanding-${n}`,
    prompt:
      `A token starts at 0. Each move it advances 1 step on heads or 2 steps on tails (a fair coin). ` +
      `What is the probability it ever lands exactly on position ${n}?`,
    explanation:
      `Let p_k = P(land on k). Then p_k = ½p_{k−1} + ½p_{k−2}, p_0 = 1, p_1 = ½, with closed form 2/3 + (1/3)(−½)^k. So p_${n} = ${fmt(answer)}.`,
    difficulty: "hard",
    concept: "Coin-driven step-landing recurrence",
    source: "Hard OA · Recurrences",
    family: "hardStepLanding",
    ...assembleFour(rng, answer, `The recurrence gives p_${n} = ${fmt(answer)}.`, distractors),
  };
  return { answer, question };
}

/* ========================================================================== */
/*  Kelly bet sizing (SIG)                                                     */
/* ========================================================================== */

const KELLY_COMBOS: { p: [number, number]; b: number }[] = [
  { p: [3, 5], b: 2 },
  { p: [2, 3], b: 2 },
  { p: [3, 4], b: 2 },
  { p: [3, 5], b: 3 },
  { p: [7, 10], b: 2 },
  { p: [2, 3], b: 3 },
  { p: [3, 4], b: 3 },
];

/**
 * Kelly-optimal fraction for a bet paying net odds b:1 with win prob p:
 * f* = (p(b+1) − 1)/b = `kellyFraction(p,b)`. Distractors: p (bet your win
 * prob), the edge 2p−1, and p(b+1)−1 (forgot to divide by b).
 */
export function buildKelly(rng: Rng): Built {
  const { p: pp, b } = rng.pick(KELLY_COMBOS);
  const p = F(pp[0], pp[1]);
  const answer = kellyFraction(p, b);
  const edge = F(2).mul(p).sub(1);
  const forgotDivide = p.mul(F(b + 1)).sub(1);

  const distractors: Choice[] = [
    { text: fmt(p), rationale: `${fmt(p)} bets your win probability itself, ignoring the payout odds and your losing probability.` },
    { text: fmt(edge), rationale: `2p−1 = ${fmt(edge)} is the even-money edge; with net odds ${b}:1 the Kelly fraction is (p(b+1)−1)/b.` },
    { text: fmt(forgotDivide), rationale: `${fmt(forgotDivide)} = p(b+1)−1 is the numerator only; you must divide by the net odds b = ${b}.` },
  ];

  const question: Question = {
    id: `hard-kelly-${pp[0]}-${pp[1]}-${b}`,
    prompt:
      `A bet pays net odds ${b}:1 (win ${b} for each 1 staked) and you win with probability ${fmt(p)}. ` +
      `What fraction of your bankroll does the Kelly criterion tell you to stake?`,
    explanation:
      `Kelly f* = (p(b+1) − 1)/b = (${fmt(p)}·${b + 1} − 1)/${b} = ${fmt(answer)}.`,
    difficulty: "hard",
    concept: "Kelly criterion bet sizing",
    source: "Hard OA · Bet sizing",
    family: "hardKelly",
    ...assembleFour(rng, answer, `The Kelly fraction is (p(b+1)−1)/b = ${fmt(answer)}.`, distractors),
  };
  return { answer, question };
}

/* ========================================================================== */
/*  Two walkers meeting on a cycle (parity trap)                               */
/* ========================================================================== */

const CYCLE_MEET: [number, number][] = [
  [8, 4],
  [8, 2],
  [12, 6],
  [12, 4],
  [10, 4],
  [6, 2],
  [10, 2],
];

/**
 * Two symmetric walkers on an n-cycle start an even gap g apart; the gap changes
 * by ±2 (¼ each) or 0 (½), so its parity is invariant. Exact expected ticks to
 * meet = `cycleMeetingTime(n,g)`. Distractors: "They never meet" (the parity
 * trap, wrong here since g is even), the opposite-start formula n²/8, and half
 * the cycle n/2.
 */
export function buildCycleMeeting(rng: Rng): Built {
  const [n, g] = rng.pick(CYCLE_MEET);
  const answer = cycleMeetingTime(n, g) as Fraction; // even gap ⇒ finite

  const distractors: Choice[] = [
    {
      text: "They never meet",
      rationale: `Parity trap: the gap only moves by ±2, so its parity is fixed — but here the starting gap ${g} is EVEN, so the walkers CAN reach gap 0 and meet.`,
    },
    { text: fmt(F(n * n, 8)), rationale: `n²/8 = ${fmt(F(n * n, 8))} is the meeting time for walkers starting at OPPOSITE ends (gap n/2); it only matches when g = n/2.` },
    { text: fmt(F(n, 2)), rationale: `n/2 = ${fmt(F(n, 2))} is half the cycle length, not an expected meeting time.` },
  ];

  const question: Question = {
    id: `hard-cycleMeeting-${n}-${g}`,
    prompt:
      `Two tokens sit on a cycle of ${n} positions, ${g} steps apart. Each tick, each token independently moves one step clockwise or counter-clockwise with equal probability. ` +
      `What is the expected number of ticks until they occupy the same position?`,
    explanation:
      `Track the gap: it moves +2 or −2 (¼ each) or stays (½), so its parity never changes. Since ${g} is even, solve the absorbing chain on even gaps to get expected ticks = ${fmt(answer)}. (An ODD starting gap would make meeting impossible.)`,
    difficulty: "hard",
    concept: "Meeting time of two walkers on a cycle (parity)",
    source: "Hard OA · Random walks on graphs",
    family: "hardCycleMeeting",
    ...assembleFour(rng, answer, `Solving the even-gap absorbing chain gives ${fmt(answer)} ticks.`, distractors),
  };
  return { answer, question };
}

/* ========================================================================== */
/*  Net-new — Next-card conditional fair value (info in the order)             */
/* ========================================================================== */

/** Curated (red, black, revealed, revealed-red) decks with clean, distinct math. */
const NEXT_CARD: { r: number; b: number; k: number; j: number }[] = [
  { r: 5, b: 5, k: 4, j: 3 },
  { r: 6, b: 4, k: 3, j: 1 },
  { r: 8, b: 4, k: 5, j: 3 },
  { r: 7, b: 5, k: 4, j: 2 },
  { r: 5, b: 7, k: 5, j: 1 },
  { r: 4, b: 6, k: 3, j: 2 },
];

/**
 * Next-card conditional fair value: a deck of r red + b black; k cards have been
 * revealed, j of them red. Fair P(next card is red) = (r−j)/((r+b)−k) =
 * `nextCardRedProb`. Distractors: the UNCONDITIONAL r/(r+b) (ignoring the reveal),
 * the empirical j/k (only the seen frequency), and (r−j)/(r+b) (updated the reds
 * but forgot to shrink the deck).
 */
export function buildNextCard(rng: Rng): Built {
  const { r, b, k, j } = rng.pick(NEXT_CARD);
  const answer = nextCardRedProb(r, b, j, k);
  const uncond = F(r, r + b);
  const empirical = F(j, k);
  const forgotDenom = F(r - j, r + b);

  const distractors: Choice[] = [
    {
      text: fmt(uncond),
      rationale: `${fmt(uncond)} = r/(r+b) is the fair value for a FRESH deck. It ignores that ${k} cards (including ${j} red) are already gone, which shifts the odds.`,
    },
    {
      text: fmt(empirical),
      rationale: `${fmt(empirical)} = ${j}/${k} is just the observed red frequency among the revealed cards, not the composition of what REMAINS in the deck.`,
    },
    {
      text: fmt(forgotDenom),
      rationale: `${fmt(forgotDenom)} = (r−j)/(r+b) correctly removes the ${j} seen reds from the numerator but forgets to shrink the denominator to the ${r + b - k} cards left.`,
    },
  ];

  const question: Question = {
    id: `hard-nextCard-${r}-${b}-${k}-${j}`,
    prompt:
      `A shuffled deck has ${r} red and ${b} black cards. ${k} cards have been turned over one by one, and ${j} of them were red. ` +
      `A fair price is quoted on whether the NEXT card is red. What is the probability that the next card is red?`,
    explanation:
      `Only the cards still in the deck matter: ${r - j} red remain out of ${r + b - k} total, so P(next red) = (r−j)/((r+b)−k) = ${r - j}/${r + b - k} = ${fmt(answer)}. ` +
      `The unconditional r/(r+b) = ${fmt(uncond)} ignores the reveal; the empirical ${j}/${k} confuses "what was seen" with "what is left".`,
    difficulty: "hard",
    concept: "Next-card conditional fair value (sampling without replacement)",
    source: "Hard OA · Next-card pricing",
    family: "hardNextCard",
    ...assembleFour(
      rng,
      answer,
      `Red remaining over cards remaining: (r−j)/((r+b)−k) = ${fmt(answer)}.`,
      distractors,
    ),
  };
  return { answer, question };
}

/* ========================================================================== */
/*  Net-new — De-vig (remove the overround to a fair leg probability)          */
/* ========================================================================== */

/** Curated two-leg books (decimal odds n/d each) with a positive overround. */
const DEVIG_BOOKS: { n0: number; d0: number; n1: number; d1: number }[] = [
  { n0: 3, d0: 2, n1: 5, d1: 2 }, // 1.5 & 2.5 ⇒ fair0 5/8
  { n0: 5, d0: 2, n1: 3, d1: 2 }, // 2.5 & 1.5 ⇒ fair0 3/8
  { n0: 3, d0: 2, n1: 2, d1: 1 }, // 1.5 & 2.0 ⇒ fair0 4/7
  { n0: 2, d0: 1, n1: 3, d1: 2 }, // 2.0 & 1.5 ⇒ fair0 3/7
];

/** Render decimal odds n/d as a short number string (all curated books terminate). */
function oddsStr(n: number, d: number): string {
  return String(n / d);
}

/**
 * De-vig: a two-outcome book quotes decimal odds o0, o1 whose implied
 * probabilities sum to more than 1 (the overround). The fair probability of
 * outcome A, after removing the vig, is (1/o0)/(1/o0 + 1/o1) = `deVigFairProb`.
 * Distractors: the RAW implied 1/o0 (keeps the vig), the OTHER leg's fair prob
 * (1 − answer), and 1 − (1/o1) (complement of B's raw implied, un-normalized).
 */
export function buildDeVig(rng: Rng): Built {
  const { n0, d0, n1, d1 } = rng.pick(DEVIG_BOOKS);
  const answer = deVigFairProb([n0, n1], [d0, d1]);
  const rawImplied0 = F(d0, n0); // 1/o0, includes the vig
  const otherFair = F(1).sub(answer); // fair prob of the OTHER leg
  const complementRawB = F(1).sub(F(d1, n1)); // 1 − raw implied of B
  const overround = bookOverround([n0, n1], [d0, d1]);

  const distractors: Choice[] = [
    {
      text: fmt(rawImplied0),
      rationale: `${fmt(rawImplied0)} = 1/${oddsStr(n0, d0)} is the RAW implied probability, which still contains the bookmaker's margin (overround ${fmt(overround)}). You must divide by the booksum to remove it.`,
    },
    {
      text: fmt(otherFair),
      rationale: `${fmt(otherFair)} is the fair probability of the OTHER outcome (1 − the answer). Read the wrong leg.`,
    },
    {
      text: fmt(complementRawB),
      rationale: `${fmt(complementRawB)} = 1 − 1/${oddsStr(n1, d1)} takes one minus B's raw implied probability, which is not the same as normalizing away the vig.`,
    },
  ];

  const question: Question = {
    id: `hard-deVig-${n0}-${d0}-${n1}-${d1}`,
    prompt:
      `A bookmaker offers a two-outcome market at decimal odds ${oddsStr(n0, d0)} on outcome A and ${oddsStr(n1, d1)} on outcome B. ` +
      `The implied probabilities sum to more than 1 (the overround). After removing the vig, what is the fair probability of outcome A?`,
    explanation:
      `Raw implied probs are 1/${oddsStr(n0, d0)} and 1/${oddsStr(n1, d1)}, summing to 1 + ${fmt(overround)}. Renormalize: fair P(A) = (1/o_A)/(1/o_A + 1/o_B) = ${fmt(answer)}.`,
    difficulty: "hard",
    concept: "De-vig / overround removal (fair leg probability)",
    source: "Hard OA · Vig removal",
    family: "hardDeVig",
    ...assembleFour(
      rng,
      answer,
      `Normalizing the implied probs removes the vig: fair P(A) = ${fmt(answer)}.`,
      distractors,
    ),
  };
  return { answer, question };
}

/* ========================================================================== */
/*  Net-new — Basket / NAV (ETF) creation-redemption arbitrage                 */
/* ========================================================================== */

/** Curated baskets: integer share counts + prices, plus a quoted ETF price. */
const BASKETS: { shares: number[]; prices: number[]; etf: number; names: string[] }[] = [
  { shares: [2, 3], prices: [30, 20], etf: 125, names: ["X", "Y"] },
  { shares: [1, 4], prices: [50, 10], etf: 84, names: ["X", "Y"] },
  { shares: [3, 2], prices: [15, 25], etf: 100, names: ["X", "Y"] },
  { shares: [1, 2, 1], prices: [20, 10, 30], etf: 76, names: ["X", "Y", "Z"] },
];

/**
 * Basket / NAV creation-redemption arbitrage: an ETF unit holds the given shares
 * of each underlying at the given prices, while the ETF itself trades at `etf`.
 * The risk-free profit per unit is |NAV − price| = `basketArbProfit`. Distractors:
 * the NAV itself (the fair value, not the edge), the quoted ETF price, and the
 * UNWEIGHTED price sum vs the quote (forgot the share counts).
 */
export function buildBasketNav(rng: Rng): Built {
  const { shares, prices, etf, names } = rng.pick(BASKETS);
  const nav = basketNav(shares, prices);
  const answer = basketArbProfit(shares, prices, etf);
  const unweighted = prices.reduce((s, p) => s + p, 0);
  const unweightedArb = Math.abs(unweighted - etf);

  const holdings = shares
    .map((s, i) => `${s} share(s) of ${names[i]} at $${prices[i]}`)
    .join(", ");

  const distractors: Choice[] = [
    {
      text: fmt(nav),
      rationale: `$${nav} is the basket's NAV (fair value), not the ARBITRAGE profit. The edge is the gap between NAV and the quoted price.`,
    },
    {
      text: fmt(etf),
      rationale: `$${etf} is just the quoted ETF price. The profit is how far it sits from the $${nav} NAV.`,
    },
    {
      text: fmt(unweightedArb),
      rationale: `$${unweightedArb} = |(Σ prices) − price| adds the share prices WITHOUT their unit counts, so it misprices the basket.`,
    },
  ];

  const question: Question = {
    id: `hard-basketNav-${shares.join("_")}-${prices.join("_")}-${etf}`,
    prompt:
      `An ETF creation unit holds ${holdings}. The ETF trades at $${etf} per unit. ` +
      `What is the risk-free arbitrage profit per unit from creating or redeeming against the underlying?`,
    explanation:
      `NAV = Σ shares·price = ${shares.map((s, i) => `${s}·${prices[i]}`).join(" + ")} = $${nav}. The ETF quote is $${etf}, so the create/redeem edge is |NAV − price| = $${fmt(answer)}.`,
    difficulty: "hard",
    concept: "Basket/NAV creation-redemption arbitrage (ETF pricing)",
    source: "Hard OA · Basket/NAV pricing",
    family: "hardBasketNav",
    ...assembleFour(
      rng,
      answer,
      `The arbitrage edge is |NAV − price| = |${nav} − ${etf}| = ${fmt(answer)}.`,
      distractors,
    ),
  };
  return { answer, question };
}

/* ========================================================================== */
/*  Net-new — Make-a-market expected pick-off loss (informed flow)             */
/* ========================================================================== */

/** Curated (die faces n, bid, ask) with a two-sided pick-off and clean loss. */
const MAKE_MARKET: { n: number; bid: number; ask: number }[] = [
  { n: 6, bid: 2, ask: 4 },
  { n: 8, bid: 3, ask: 6 },
  { n: 10, bid: 4, ask: 8 },
  { n: 8, bid: 4, ask: 5 },
  { n: 6, bid: 2, ask: 5 },
];

/**
 * Make-a-market pick-off P&L: the true value is uniform on {1..n}; you post a
 * two-sided market (bid, ask), and a fully informed counterparty lifts your ask
 * when V > ask (you lose V − ask) and hits your bid when V < bid (you lose
 * bid − V). Expected loss per quote = `makeMarketPickoffLoss`. Distractors: only
 * the upside pick-off (forgot the bid side), the trade FREQUENCY (counts trades
 * but ignores magnitude), and half the loss (a scaling slip).
 */
export function buildMakeMarket(rng: Rng): Built {
  const { n, bid, ask } = rng.pick(MAKE_MARKET);
  const values = Array.from({ length: n }, (_, i) => i + 1);
  const answer = makeMarketPickoffLoss(values, bid, ask);
  let upside = F(0);
  for (const v of values) if (v > ask) upside = upside.add(F(v - ask, 1));
  const oneSide = upside.div(n);
  const tradeFreq = F(pickoffTradeCount(values, bid, ask), n);
  const half = answer.div(2);

  const distractors: Choice[] = [
    {
      text: fmt(oneSide),
      rationale: `${fmt(oneSide)} counts only the ask-side pick-offs (V > ${ask}). The informed trader ALSO hits your bid when V < ${bid}, and that loss must be added.`,
    },
    {
      text: fmt(tradeFreq),
      rationale: `${fmt(tradeFreq)} is the probability a trade happens at all, ignoring HOW FAR in-the-money it is. A pick-off 3 away hurts more than one 1 away.`,
    },
    {
      text: fmt(half),
      rationale: `${fmt(half)} halves the true expected loss — a scaling slip (e.g. averaging the two sides instead of summing them).`,
    },
    {
      text: fmt(F(0)),
      rationale: `0 assumes a symmetric quote is safe. Against a FULLY informed counterparty every quote is adversely selected, so the expected loss is strictly positive.`,
    },
  ];

  const question: Question = {
    id: `hard-makeMarket-${n}-${bid}-${ask}`,
    prompt:
      `A security's true value is equally likely to be any integer from 1 to ${n}. You must quote a two-sided market: bid ${bid}, ask ${ask}. ` +
      `A fully informed counterparty buys at your ask whenever the value exceeds ${ask} and sells at your bid whenever it is below ${bid}. What is your expected pick-off loss per quote?`,
    explanation:
      `Sum the adverse trades: E[loss] = (1/${n})·[Σ_{V>${ask}}(V−${ask}) + Σ_{V<${bid}}(${bid}−V)] = ${fmt(answer)}. Only the magnitude of each in-the-money pick-off counts, not merely how often a trade occurs.`,
    difficulty: "hard",
    concept: "Make-a-market pick-off loss vs informed flow",
    source: "Hard OA · Make-a-market",
    family: "hardMakeMarket",
    ...assembleFour(
      rng,
      answer,
      `Summing both sides' magnitude-weighted pick-offs gives ${fmt(answer)}.`,
      distractors,
    ),
  };
  return { answer, question };
}

/* ========================================================================== */
/*  Registry — the exported seedable generators                               */
/* ========================================================================== */

/** All hard `build*` helpers, keyed by their stable `family` id. */
export const HARD_OA_BUILDERS: Record<string, (rng: Rng) => Built> = {
  hardPathIntersect: buildPathIntersect,
  hardRuinDuration: buildRuinDuration,
  hardPatternWait: buildPatternWait,
  hardSecretary: buildSecretary,
  hardGraphHitting: buildGraphHitting,
  hardResetCollector: buildResetCollector,
  hardHiddenComposition: buildHiddenComposition,
  hardCoinBias: buildCoinBias,
  hardDiceOrderStat: buildDiceOrderStat,
  hardInformedLift: buildInformedLift,
  hardOneReroll: buildOneReroll,
  hardStepLanding: buildStepLanding,
  hardKelly: buildKelly,
  hardCycleMeeting: buildCycleMeeting,
  hardNextCard: buildNextCard,
  hardDeVig: buildDeVig,
  hardBasketNav: buildBasketNav,
  hardMakeMarket: buildMakeMarket,
};

/** The exported OA `QuestionGenerator`s (thin `(rng) => Question` adapters). */
export const HARD_OA_GENERATORS: Record<string, QuestionGenerator> =
  Object.fromEntries(
    Object.entries(HARD_OA_BUILDERS).map(([family, build]) => [
      family,
      (rng: Rng) => build(rng).question,
    ]),
  );
