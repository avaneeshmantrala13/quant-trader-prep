import type { Rng } from "@/lib/rng";
import type {
  NumericQuestion,
  NumericQuestionGenerator,
  Question,
  QuestionGenerator,
} from "@/types/content";
import { assembleDistinct, fmt } from "../shared";
import { mixNumericGenerators, mixQuestionGenerators } from "../mixFamilies";
import {
  boxFromClues,
  choose,
  circleRadius,
  clockAngle,
  clockAngleNoHourCreep,
  countMultiples,
  doublingDayForFraction,
  escalatorSteps,
  factorial,
  fourLeggedCount,
  gamesFromLedger,
  gridRectangles,
  gridSquares,
  longFishTotal,
  multinomial,
  packedCubes,
  riverLength,
  roundRobinGames,
  sumEvensInRange,
  sumOddsInRange,
  sumRange,
  triangular,
  tripleFromPairwise,
  twoLegDistance,
  volumeTrap,
} from "./solvers";

/**
 * Parametric generators for the **Math Questions** track. Every ground-truth
 * answer is produced by the exact solvers in `./solvers.ts` (never a hardcoded
 * table), and every distractor / `commonError` is a NAMED misconception drawn
 * from the source dataset's own error taxonomy (e.g. Cold Storage's volume-
 * division 421 vs the correct floor-then-multiply 343; permutations vs
 * combinations; rectangles C(9,2)² vs squares Σk²; the doubling "half-in-time"
 * trap). No original dataset question is reused verbatim, the numbers, themes,
 * and framings are all freshly drawn per seed.
 */

/* -------------------------------------------------------------------------- */
/*  Local helpers                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Deduping accumulator for numeric `commonErrors` (rounded to `dp`, ≠ answer).
 *
 * `push` accepts an OPTIONAL machine-readable `misconception` tag (PHASE_1/2
 * error-mode catalogs): when supplied it is carried onto the `commonErrors`
 * entry so the mastery layer folds `misconceptionKey(topicKey, tag)` and the
 * hint ladder keys rung-1 coaching / the confront strategy off it. Omitting it
 * stays byte-compatible with the pre-conversion numeric families.
 */
function numericErrors(answer: number, dp: number) {
  const f = 10 ** dp;
  const seen = new Set<number>([Math.round(answer * f)]);
  const errors: { value: number; feedback: string; misconception?: string }[] =
    [];
  const push = (raw: number, feedback: string, misconception?: string) => {
    if (!Number.isFinite(raw) || raw < 0) return;
    const rounded = Math.round(raw * f) / f;
    const key = Math.round(rounded * f);
    if (seen.has(key)) return;
    seen.add(key);
    errors.push({
      value: rounded,
      feedback,
      ...(misconception ? { misconception } : {}),
    });
  };
  return { errors, push };
}

/* ========================================================================== */
/*  FAMILY 1. RATE, WORK & MOTION  (numeric free-entry, clean scalars)         */
/* ========================================================================== */

const TANK_THEME = [
  { vessel: "reservoir", unitV: "liters", a: "the north inlet", b: "the south inlet", d: "the outflow valve" },
  { vessel: "holding tank", unitV: "gallons", a: "pump A", b: "pump B", d: "the relief drain" },
  { vessel: "cistern", unitV: "liters", a: "the spring feed", b: "the rain pipe", d: "the seepage crack" },
];

/** Combined fill with a competing drain: net rate = f1 + f2 − drain. (MQ11.) */
export function genFillDrainTank(rng: Rng): NumericQuestion {
  const th = rng.pick(TANK_THEME);
  const f1 = rng.int(8, 16);
  const f2 = rng.int(5, 12);
  const drain = rng.int(3, Math.min(f1 + f2 - 2, 10));
  const net = f1 + f2 - drain;
  const minutes = rng.int(20, 60);
  const volume = net * minutes;
  const answer = minutes; // = fillTime(f1, f2, drain, volume)

  const { errors, push } = numericErrors(answer, 0);
  push(
    volume / (f1 + f2),
    `That ignores ${th.d}. The NET fill rate is ${f1} + ${f2} − ${drain} = ${net} ${th.unitV}/min, not ${f1 + f2}.`,
  );
  push(
    volume / (f1 + f2 + drain),
    `You ADDED the drain instead of subtracting it. ${th.d} removes ${th.vessel === "cistern" ? "water" : "fluid"}, so net = ${f1} + ${f2} − ${drain} = ${net}.`,
  );
  push(
    volume / f1,
    `You used only ${th.a}. Both inlets run together against the drain: net = ${f1} + ${f2} − ${drain} = ${net} ${th.unitV}/min.`,
  );

  const prompt =
    `A ${th.vessel} holds ${fmt(volume)} ${th.unitV}. ${cap(th.a)} adds ${f1} ${th.unitV}/min and ${th.b} adds ${f2} ${th.unitV}/min, ` +
    `while ${th.d} lets ${drain} ${th.unitV}/min escape. Starting empty, how many minutes until it is full?`;
  const explanation =
    `Net fill rate = ${f1} + ${f2} − ${drain} = ${net} ${th.unitV}/min. Time = volume ÷ net rate = ${fmt(volume)} ÷ ${net} = ${answer} minutes.`;

  return {
    id: `mq-tank-${f1}-${f2}-${drain}-${minutes}`,
    prompt,
    answer,
    difficulty: "easy",
    concept: "Combined work with a competing rate",
    explanation,
    unit: "min",
    commonErrors: errors,
    source: "Math Questions · Rate & Work",
  };
}

const TRIP_THEME = [
  { who: "A courier", out: "cycles", back: "drives back", u: "km" },
  { who: "A hiker", out: "walks", back: "rides a shuttle back", u: "mi" },
  { who: "A runner", out: "jogs", back: "takes a bus back", u: "mi" },
];

/** Equal-distance two-leg trip: d/a + d/b = T ⇒ d = T·a·b/(a+b). (MQ14.) */
export function genTwoLegTrip(rng: Rng): NumericQuestion {
  const th = rng.pick(TRIP_THEME);
  let a = 4;
  let b = 12;
  let hours = 8;
  let d = twoLegDistance(a, b, hours);
  for (let t = 0; t < 300; t++) {
    const ca = rng.pick([3, 4, 5, 6, 8]);
    const cb = rng.pick([10, 12, 15, 18, 20]);
    const ch = rng.int(3, 9);
    const cd = twoLegDistance(ca, cb, ch);
    if (Number.isInteger(cd) && cd >= 10 && cd <= 90 && ca < cb) {
      a = ca;
      b = cb;
      hours = ch;
      d = cd;
      break;
    }
  }
  const answer = d;

  const { errors, push } = numericErrors(answer, 0);
  push(
    hours * a,
    `That assumes the whole ${hours} h was spent at ${a} ${th.u}/h. Each LEG is the same distance d, split between the two speeds: d/${a} + d/${b} = ${hours}.`,
  );
  push(
    hours * b,
    `That assumes the whole ${hours} h was spent at ${b} ${th.u}/h. Only the return leg is that fast; solve d/${a} + d/${b} = ${hours}.`,
  );
  push(
    2 * d,
    `That is the ROUND-TRIP distance (${d} + ${d}). The question asks the one-way distance d.`,
  );

  const prompt =
    `${th.who} ${th.out} to a spot at ${a} ${th.u}/h and ${th.back} along the same route at ${b} ${th.u}/h. ` +
    `The whole round trip takes ${hours} hours. How far away (one way) is the spot?`;
  const explanation =
    `Same distance d each way: d/${a} + d/${b} = ${hours}. So d·(${a}+${b})/(${a}·${b}) = ${hours} ⇒ d = ${hours}·${a}·${b}/${a + b} = ${answer} ${th.u}.`;

  return {
    id: `mq-trip-${a}-${b}-${hours}`,
    prompt,
    answer,
    difficulty: "easy",
    concept: "Two-leg equal-distance rate problem",
    explanation,
    unit: th.u,
    commonErrors: errors,
    source: "Math Questions · Rate & Work",
  };
}

const RIVER_THEME = [
  { drifter: "a log", craft: "a motorboat" },
  { drifter: "a raft", craft: "a launch" },
  { drifter: "a buoy", craft: "a skiff" },
];

/** River length: L = t1·V (drift) = t2·(V+s) (powered downstream). (MQ30.) */
export function genRiverDrift(rng: Rng): NumericQuestion {
  const th = rng.pick(RIVER_THEME);
  let t1 = 6;
  let t2 = 4;
  let s = 3;
  let sol = riverLength(t1, t2, s);
  for (let t = 0; t < 400; t++) {
    const ct1 = rng.pick([6, 8, 9, 10, 12]);
    const ct2 = rng.pick([3, 4, 5, 6]);
    const cs = rng.pick([2, 3, 4, 5]);
    if (ct1 <= ct2) continue;
    const cand = riverLength(ct1, ct2, cs);
    if (
      Number.isInteger(cand.current) &&
      Number.isInteger(cand.length) &&
      cand.current > 0 &&
      cand.length >= 20 &&
      cand.length <= 400
    ) {
      t1 = ct1;
      t2 = ct2;
      s = cs;
      sol = cand;
      break;
    }
  }
  const answer = sol.length;
  const V = sol.current;

  const { errors, push } = numericErrors(answer, 0);
  push(V, `That is the CURRENT speed V = ${V} m/h, not the river length. The length is t₁·V = ${t1}·${V} = ${answer} m.`);
  push(
    t1 * s,
    `That multiplies ${th.craft}'s own speed (${s} m/h) by the drift time, ignoring the current. Solve ${t1}·V = ${t2}·(V+${s}) for V first.`,
  );
  push(
    (V + s) * t1,
    `That uses the powered speed (V+${s}) over the DRIFT time ${t1}. ${cap(th.craft)} only runs for ${t2} h; the length is ${t1}·V = ${answer} m.`,
  );

  const prompt =
    `${cap(th.drifter)} drifting with the current covers a straight river stretch in ${t1} hours. ` +
    `${cap(th.craft)} whose own speed in still water is ${s} m/h covers the same stretch downstream in ${t2} hours. ` +
    `How long is the stretch (in meters)?`;
  const explanation =
    `Let V be the current. Drift: L = ${t1}·V. Powered downstream: L = ${t2}·(V+${s}). Setting equal, ${t1}V = ${t2}V + ${t2 * s} ⇒ V = ${t2 * s}/${t1 - t2} = ${V} m/h. Then L = ${t1}·${V} = ${answer} m.`;

  return {
    id: `mq-river-${t1}-${t2}-${s}`,
    prompt,
    answer,
    difficulty: "medium",
    concept: "River length via current-adjusted speeds",
    explanation,
    unit: "m",
    commonErrors: errors,
    source: "Math Questions · Rate & Work",
  };
}

/** Escalator: visible steps T = 2·up·down/(up+down) from walk-up / walk-down counts. (MQ10.) */
export function genEscalatorSteps(rng: Rng): NumericQuestion {
  let up = 20;
  let down = 60;
  let T = escalatorSteps(up, down);
  for (let t = 0; t < 400; t++) {
    const cu = rng.int(12, 30);
    const cd = rng.int(cu + 10, 90);
    const cand = escalatorSteps(cu, cd);
    if (Number.isInteger(cand) && cand > cu && cand < cd) {
      up = cu;
      down = cd;
      T = cand;
      break;
    }
  }
  const answer = T;

  const { errors, push } = numericErrors(answer, 0);
  push(up + down, `That just adds the two step counts. The escalator's motion helps you going up and fights you coming down; solve ${up} = T/(1+S) and ${down} = T/(1−S).`);
  push(up, `That is only the walking-UP count. The visible step count T also has to satisfy the walking-DOWN trip (${down} steps).`);
  push((up + down) / 2, `Averaging the two counts ignores that the escalator adds steps one way and removes them the other. T = 2·${up}·${down}/(${up}+${down}) = ${answer}.`);

  const prompt =
    `Walking UP a moving escalator at a steady pace you take ${up} steps to reach the top; walking DOWN the same escalator (against its motion) you take ${down} steps. ` +
    `How many steps are visible on the escalator when it is stopped?`;
  const explanation =
    `Let T be the visible steps and S the escalator's speed in your steps-per-step. Up: ${up} = T/(1+S). Down: ${down} = T/(1−S). Eliminating S gives T = 2·${up}·${down}/(${up}+${down}) = ${answer} steps.`;

  return {
    id: `mq-escalator-${up}-${down}`,
    prompt,
    answer,
    difficulty: "medium",
    concept: "Escalator step-count system",
    explanation,
    unit: "steps",
    commonErrors: errors,
    source: "Math Questions · Rate & Work",
  };
}

/* ========================================================================== */
/*  FAMILY 2. COUNTING & ARRANGEMENTS  (quiz, misconception-rich distractors)  */
/* ========================================================================== */

const COLD_THEME = [
  { box: "cold-storage crate", item: "ice cube" },
  { box: "shipping container", item: "packing cube" },
  { box: "display case", item: "gift box" },
];

/** Cold Storage: ⌊L/s⌋·⌊W/s⌋·⌊H/s⌋ cubes fit. FLOOR then multiply (343 not 421). (MQ7.) */
export function genColdStorage(rng: Rng): Question {
  return assembleDistinct(rng, (r) => {
    const th = r.pick(COLD_THEME);
    const s = r.pick([3, 4, 5]);
    const dim = () => {
      let d = r.int(20, 40);
      if (d % s === 0) d += 1; // ensure flooring actually bites
      return d;
    };
    const L = dim();
    const W = dim();
    const H = dim();
    const correct = packedCubes([L, W, H], s);
    const trap = volumeTrap([L, W, H], s); // divided the volumes (the 421 trap)
    const ceilProduct =
      Math.ceil(L / s) * Math.ceil(W / s) * Math.ceil(H / s); // rounded each up
    const twoDims = Math.floor(L / s) * Math.floor(W / s); // forgot the height
    return {
      id: `mq-cold-${L}-${W}-${H}-${s}`,
      prompt: `A ${th.box} measures ${L}×${W}×${H} cm. How many solid ${s}×${s}×${s} cm ${th.item}s can be packed inside (no cutting, axis-aligned)?`,
      correct: fmt(correct),
      distractors: [fmt(trap), fmt(ceilProduct), fmt(twoDims)],
      explanation: `You can fit ⌊${L}/${s}⌋=${Math.floor(L / s)} along one edge, ⌊${W}/${s}⌋=${Math.floor(W / s)} along another, and ⌊${H}/${s}⌋=${Math.floor(H / s)} along the last. Multiply: ${Math.floor(L / s)}·${Math.floor(W / s)}·${Math.floor(H / s)} = ${fmt(correct)}. You must FLOOR each dimension first, because leftover space on an edge can't hold another cube.`,
      difficulty: "medium" as const,
      concept: "Packing count (floor per dimension, then multiply)",
      distractorRationaleByValue: {
        [fmt(trap)]: `Dividing the VOLUMES, ⌊${fmt(L * W * H)}/${s ** 3}⌋ = ${fmt(trap)}, pretends the wasted edge space can be reused elsewhere, the classic over-count.`,
        [fmt(ceilProduct)]: `Rounding each edge UP counts cubes that would stick out past the walls.`,
        [fmt(twoDims)]: `That multiplies only two dimensions and forgets the ${Math.floor(H / s)} layers in the third.`,
      },
      source: "Math Questions · Counting",
    };
  });
}

const GRID_THEME = [
  { grid: "chessboard", cell: "square" },
  { grid: "window lattice", cell: "pane" },
  { grid: "tiled floor", cell: "tile" },
];

/** Rectangles on an n×n grid = C(n+1,2)²; squares = Σk². QUIZ pits them against each other. (MQ29/38.) */
export function genGridRectangles(rng: Rng): Question {
  return assembleDistinct(rng, (r) => {
    const th = r.pick(GRID_THEME);
    const n = r.pick([6, 7, 8, 9, 10]);
    const correct = gridRectangles(n);
    const squares = gridSquares(n);
    const lines = choose(n + 1, 2); // one dimension only
    const cells = n * n; // counted unit cells
    return {
      id: `mq-rects-${n}`,
      prompt: `On an ${n}×${n} ${th.grid} (a grid of ${n}×${n} ${th.cell}s), how many rectangles of any size can be traced along the grid lines?`,
      correct: fmt(correct),
      distractors: [fmt(squares), fmt(lines), fmt(cells)],
      explanation: `A rectangle is fixed by choosing 2 of the ${n + 1} vertical lines and 2 of the ${n + 1} horizontal lines: C(${n + 1},2)·C(${n + 1},2) = ${lines}² = ${fmt(correct)}.`,
      difficulty: "medium" as const,
      concept: "Rectangles on a grid = C(n+1,2)²",
      distractorRationaleByValue: {
        [fmt(squares)]: `Σk² = ${fmt(squares)} counts only the SQUARES; a rectangle need not have equal sides.`,
        [fmt(lines)]: `C(${n + 1},2) = ${lines} chooses just one pair of lines (one dimension); you must choose a pair in BOTH directions.`,
        [fmt(cells)]: `${cells} counts only the smallest unit ${th.cell}s, not larger rectangles.`,
      },
      source: "Math Questions · Counting",
    };
  });
}

const WORD_THEME = [
  { label: "access code", unit: "code" },
  { label: "call sign", unit: "sign" },
  { label: "tile rack", unit: "rack" },
];

/** Distinct arrangements of a multiset with two doubled letters = n!/(2!·2!). (MQ20 style.) */
export function genWordArrangements(rng: Rng): Question {
  return assembleDistinct(rng, (r) => {
    const th = r.pick(WORD_THEME);
    const singles = r.int(3, 5); // number of distinct single letters
    const n = singles + 4; // + two letters that each appear twice
    const alphabet = "MKPRTLNS".split("");
    const chosen = r.shuffle(alphabet).slice(0, singles + 2);
    const letters: string[] = [];
    letters.push(chosen[0], chosen[0], chosen[1], chosen[1]);
    for (let i = 2; i < chosen.length; i++) letters.push(chosen[i]);
    const word = r.shuffle(letters).join("");
    const correct = multinomial([2, 2, ...Array(singles).fill(1)]); // n!/(2!2!)
    const allDistinct = factorial(n); // n!
    const oneRepeat = factorial(n) / 2; // divided by 2! once
    const overDivide = factorial(n) / 8; // divided by an extra 2!
    return {
      id: `mq-word-${word}`,
      prompt: `How many DISTINCT arrangements are there of the ${n} characters in the ${th.label} "${word}" (two characters each appear twice)?`,
      correct: fmt(correct),
      distractors: [fmt(allDistinct), fmt(oneRepeat), fmt(overDivide)],
      explanation: `There are ${n}! orderings, but each repeated pair is interchangeable, so divide by 2! for EACH doubled character: ${n}!/(2!·2!) = ${fmt(factorial(n))}/4 = ${fmt(correct)}.`,
      difficulty: "medium" as const,
      concept: "Permutations of a multiset (repeated letters)",
      distractorRationaleByValue: {
        [fmt(allDistinct)]: `${n}! = ${fmt(allDistinct)} treats all characters as distinct, ignoring the repeats.`,
        [fmt(oneRepeat)]: `Dividing by a single 2! corrects for only ONE of the two doubled characters.`,
        [fmt(overDivide)]: `Dividing by an extra 2! over-corrects, there are only two doubled characters, so divide by 2!·2!, not 2!·2!·2!.`,
      },
      source: "Math Questions · Counting",
    };
  });
}

const LEAGUE_THEME = [
  { comp: "league", side: "team" },
  { comp: "tournament", side: "club" },
  { comp: "conference", side: "squad" },
];

/** Round-robin where each pair meets `meetings` times ⇒ meetings·C(n,2). (MQ13.) */
export function genRoundRobin(rng: Rng): Question {
  return assembleDistinct(rng, (r) => {
    const th = r.pick(LEAGUE_THEME);
    const n = r.int(5, 12);
    const meetings = r.pick([2, 3]);
    const correct = roundRobinGames(n, meetings);
    const once = choose(n, 2); // each pair once
    const withSelf = n * n; // included self-matchups
    const ordered = meetings * n * (n - 1); // treated ordered pairs as distinct games
    return {
      id: `mq-league-${n}-${meetings}`,
      prompt: `A ${th.comp} has ${n} ${th.side}s. Every pair of ${th.side}s plays each other exactly ${meetings} times. How many games are played in total?`,
      correct: fmt(correct),
      distractors: [fmt(once), fmt(withSelf), fmt(ordered)],
      explanation: `There are C(${n},2) = ${once} distinct pairings, and each is played ${meetings} times: ${meetings}·${once} = ${fmt(correct)}.`,
      difficulty: "medium" as const,
      concept: "Round-robin scheduling (combinations × meetings)",
      distractorRationaleByValue: {
        [fmt(once)]: `C(${n},2) = ${once} counts each matchup only once, it forgets the ${meetings} meetings per pair.`,
        [fmt(withSelf)]: `${n}² = ${withSelf} counts every ordered pairing including a ${th.side} against itself.`,
        [fmt(ordered)]: `${meetings}·${n}·(${n}−1) = ${fmt(ordered)} double-counts each game by treating "A hosts B" and "B hosts A" as separate.`,
      },
      source: "Math Questions · Counting",
    };
  });
}

/* ========================================================================== */
/*  FAMILY 3. ALGEBRA & SYSTEMS  (numeric free-entry, clean scalars)           */
/* ========================================================================== */

const STACK_THEME = [
  { obj: "logs", shape: "triangular stack", row: "row" },
  { obj: "cans", shape: "pyramid display", row: "tier" },
  { obj: "bricks", shape: "stepped wall", row: "course" },
];

/** Triangular number inversion: rows n where n(n+1)/2 = total. (MQ3.) */
export function genTriangularTotal(rng: Rng): NumericQuestion {
  const th = rng.pick(STACK_THEME);
  const n = rng.int(12, 40);
  const total = triangular(n);
  const answer = n;

  const { errors, push } = numericErrors(answer, 0);
  push(Math.round(Math.sqrt(2 * total)), `√(2·${fmt(total)}) ≈ ${Math.round(Math.sqrt(2 * total))} drops the "+½": n(n+1)/2 = ${fmt(total)} solves to n = ${n}, not √(2·total).`);
  push(Math.round(Math.sqrt(total)), `√${fmt(total)} ≈ ${Math.round(Math.sqrt(total))} would be right for a SQUARE (n²), but a triangular stack totals n(n+1)/2.`);
  push(n - 1, `Off by one, check the endpoints: rows 1..${n} give 1+2+…+${n} = ${fmt(total)}.`);

  const prompt =
    `A ${th.shape} of ${th.obj} has 1 in the top ${th.row}, 2 in the next, 3 in the next, and so on. ` +
    `If it uses ${fmt(total)} ${th.obj} in total, how many ${th.row}s are there?`;
  const explanation =
    `The total is the triangular number n(n+1)/2 = ${fmt(total)}. Solving n(n+1) = ${fmt(2 * total)} gives n = ${n} (since ${n}·${n + 1} = ${fmt(n * (n + 1))}).`;

  return {
    id: `mq-triangular-${n}`,
    prompt,
    answer,
    difficulty: "easy",
    concept: "Triangular numbers (invert n(n+1)/2)",
    explanation,
    unit: "",
    commonErrors: errors,
    source: "Math Questions · Algebra & Systems",
  };
}

const FARM_THEME = [
  { two: "chickens", four: "cows", legs2: 2, legs4: 4, unit: "legs" },
  { two: "ostriches", four: "goats", legs2: 2, legs4: 4, unit: "legs" },
  { two: "clerks", four: "desks", legs2: 2, legs4: 4, unit: "legs" },
];

/** Heads/legs system: fourLegged = (legs − 2·heads)/2. (MQ17/MQ24.) */
export function genHeadsLegs(rng: Rng): NumericQuestion {
  const th = rng.pick(FARM_THEME);
  const four = rng.int(6, 20);
  const two = rng.int(5, 20);
  const heads = four + two;
  const legs = th.legs2 * two + th.legs4 * four;
  const answer = fourLeggedCount(heads, legs); // = four

  const { errors, push } = numericErrors(answer, 0);
  push(Math.round(legs / th.legs4), `Dividing all ${legs} ${th.unit} by ${th.legs4} assumes EVERY animal is a ${th.four.slice(0, -1)}; but ${th.two} have only ${th.legs2} ${th.unit}.`);
  push(two, `That is the number of ${th.two} (the other unknown), found from ${heads} − ${four}.`);
  push(Math.round(heads / 2), `Splitting the ${heads} heads evenly ignores the leg count entirely.`);

  const prompt =
    `A pen holds ${th.two} (${th.legs2} ${th.unit} each) and ${th.four} (${th.legs4} ${th.unit} each). ` +
    `There are ${heads} heads and ${legs} ${th.unit} in all. How many ${th.four} are there?`;
  const explanation =
    `Let f = ${th.four}, and heads give (${th.two} count) = ${heads} − f. Legs: ${th.legs2}(${heads} − f) + ${th.legs4}f = ${legs} ⇒ ${th.legs2}·${heads} + ${th.legs4 - th.legs2}f = ${legs} ⇒ f = (${legs} − ${th.legs2 * heads})/${th.legs4 - th.legs2} = ${answer}.`;

  return {
    id: `mq-legs-${four}-${two}`,
    prompt,
    answer,
    difficulty: "easy",
    concept: "Two-variable heads/legs system",
    explanation,
    unit: "",
    commonErrors: errors,
    source: "Math Questions · Algebra & Systems",
  };
}

const LEDGER_THEME = [
  { game: "coin-flip bets", win: "wins", loss: "loses" },
  { game: "arcade rounds", win: "clears", loss: "busts" },
  { game: "chess games", win: "wins", loss: "loses" },
];

/** Win/loss ledger: losses = (wins·win − net)/loss; games = wins + losses. (MQ40.) */
export function genGamesNet(rng: Rng): NumericQuestion {
  const th = rng.pick(LEDGER_THEME);
  const winAmt = rng.pick([2, 3, 5]);
  const lossAmt = rng.pick([2, 3, 4]);
  const wins = rng.int(8, 25);
  const losses = rng.int(8, 30);
  const net = wins * winAmt - losses * lossAmt;
  const { games } = gamesFromLedger(wins, winAmt, lossAmt, net);
  const answer = games;
  const netTxt = net >= 0 ? `up €${net}` : `down €${-net}`;

  const { errors, push } = numericErrors(answer, 0);
  push(wins, `That counts only the ${wins} ${th.win}. Each loss costs €${lossAmt}, so losses = (${wins}·${winAmt} − (${net})) / ${lossAmt} = ${losses}; total = ${wins} + ${losses}.`);
  push(wins + Math.abs(wins * winAmt - net), `Forgetting to divide the €${wins * winAmt - net} point deficit by €${lossAmt} per loss over-counts the losses.`);
  push(wins + Math.round(Math.abs(net) / lossAmt), `Using the NET €${Math.abs(net)} instead of the gross loss total ignores the €${wins * winAmt} won.`);

  const prompt =
    `A player ${th.win} ${wins} times (each win is worth +€${winAmt}) and ${th.loss} some number of times (each loss is −€${lossAmt}). ` +
    `They finish ${netTxt}. How many games did they play in total?`;
  const explanation =
    `Wins bring +€${wins * winAmt}. To finish at €${net}, losses must total €${wins * winAmt - net}, i.e. ${losses} losses at €${lossAmt} each. Total games = ${wins} + ${losses} = ${answer}.`;

  return {
    id: `mq-ledger-${wins}-${losses}-${winAmt}-${lossAmt}`,
    prompt,
    answer,
    difficulty: "medium",
    concept: "Win/loss point ledger",
    explanation,
    unit: "",
    commonErrors: errors,
    source: "Math Questions · Algebra & Systems",
  };
}

const FISH_THEME = [
  { animal: "fish", p1: "head", p2: "tail", p3: "body" },
  { animal: "rocket", p1: "nose", p2: "fin", p3: "fuselage" },
  { animal: "totem", p1: "cap", p2: "base", p3: "trunk" },
];

/** Self-referential Long Fish: total = 8·head. (SU5.) */
export function genLongFish(rng: Rng): NumericQuestion {
  const th = rng.pick(FISH_THEME);
  const head = rng.int(5, 14);
  const answer = longFishTotal(head); // 8·head
  const body = 4 * head;
  const tail = 3 * head;

  const { errors, push } = numericErrors(answer, 0);
  push(body, `${body} is just the ${th.p3} (= 4·${head}). The whole ${th.animal} is ${th.p1} + ${th.p3} + ${th.p2}.`);
  push(tail, `${tail} is just the ${th.p2} (= 3·${head}).`);
  push(body + tail, `${body + tail} adds ${th.p3} + ${th.p2} but forgets the ${head}-unit ${th.p1}. Total = ${head} + ${body} + ${tail} = ${answer}.`);

  const prompt =
    `A ${th.animal}'s ${th.p1} is ${head} units long. Its ${th.p2} is as long as the ${th.p1} plus half the ${th.p3}, ` +
    `and its ${th.p3} is as long as the ${th.p1} plus the ${th.p2}. How long is the whole ${th.animal}?`;
  const explanation =
    `Let the ${th.p3} = c. Then ${th.p2} = ${head} + c/2 and c = ${head} + (${head} + c/2) ⇒ c/2 = ${2 * head} ⇒ ${th.p3} = ${body}, ${th.p2} = ${tail}. Total = ${head} + ${body} + ${tail} = ${answer}.`;

  return {
    id: `mq-fish-${head}`,
    prompt,
    answer,
    difficulty: "medium",
    concept: "Self-referential length system",
    explanation,
    unit: "",
    commonErrors: errors,
    source: "Math Questions · Algebra & Systems",
  };
}

const PAIR_THEME = [
  { ctx: "three gears mesh in pairs", noun: "tooth-counts" },
  { ctx: "three chemicals react in pairs", noun: "yields" },
  { ctx: "three traders quote in pairs", noun: "spreads" },
];

/** Pairwise products → product of all three = √(wx·wy·xy). (SU6.) */
export function genPairwiseProducts(rng: Rng): NumericQuestion {
  const th = rng.pick(PAIR_THEME);
  let w = 3;
  let x = 5;
  let y = 7;
  for (let t = 0; t < 200; t++) {
    const cw = rng.int(2, 9);
    const cx = rng.int(2, 9);
    const cy = rng.int(2, 9);
    if (cw !== cx && cx !== cy && cw !== cy && cw * cx !== cw * cy && cw * cx !== cx * cy && cw * cy !== cx * cy) {
      w = cw;
      x = cx;
      y = cy;
      break;
    }
  }
  const wx = w * x;
  const wy = w * y;
  const xy = x * y;
  const sol = tripleFromPairwise(wx, wy, xy);
  const answer = sol.product; // w·x·y

  const { errors, push } = numericErrors(answer, 0);
  push(wx * wy * xy, `Multiplying the three pairwise ${th.noun} gives (w·x·y)² = ${fmt(wx * wy * xy)}; you forgot to take the square root.`);
  push(wx + wy + xy, `Adding the three pairwise ${th.noun} (${wx}+${wy}+${xy}) is not the product of the three values.`);
  push(wx, `${wx} is just one pairwise product, not the product of all three.`);

  const prompt =
    `When ${th.ctx}, the pairwise products are ${wx}, ${wy}, and ${xy}. ` +
    `What is the product of all three individual values?`;
  const explanation =
    `Multiplying all three pairwise products gives (w·x·y)² = ${wx}·${wy}·${xy} = ${fmt(wx * wy * xy)}, so w·x·y = √${fmt(wx * wy * xy)} = ${answer}. (Here w=${w}, x=${x}, y=${y}.)`;

  return {
    id: `mq-pairwise-${w}-${x}-${y}`,
    prompt,
    answer,
    difficulty: "medium",
    concept: "Solving unknowns from pairwise products",
    explanation,
    unit: "",
    commonErrors: errors,
    source: "Math Questions · Algebra & Systems",
  };
}

/* ========================================================================== */
/*  FAMILY 4. NUMBER THEORY & GROWTH  (quiz, misconception-rich distractors)   */
/* ========================================================================== */

/** Sum of odd integers in a range. (MQ25.) */
export function genSumOddsRange(rng: Rng): Question {
  return assembleDistinct(rng, (r) => {
    const a = r.pick([20, 40, 50, 60, 100]);
    const span = r.pick([50, 60, 80, 100]);
    const b = a + span;
    const correct = sumOddsInRange(a, b);
    const all = sumRange(a, b);
    const evens = sumEvensInRange(a, b);
    const lo = a % 2 === 0 ? a + 1 : a;
    const hi = b % 2 === 0 ? b - 1 : b;
    const count = (hi - lo) / 2 + 1;
    const nSquared = count * count; // "sum of first n odds = n²" misapplied
    return {
      id: `mq-sumodds-${a}-${b}`,
      prompt: `What is the sum of all ODD integers from ${a} to ${b} inclusive?`,
      correct: fmt(correct),
      distractors: [fmt(all), fmt(evens), fmt(nSquared)],
      explanation: `The odd integers run ${lo}, ${lo + 2}, …, ${hi}, that's ${count} terms averaging (${lo}+${hi})/2 = ${(lo + hi) / 2}. Sum = ${count}·${(lo + hi) / 2} = ${fmt(correct)}.`,
      difficulty: "medium" as const,
      concept: "Arithmetic series of odd numbers",
      distractorRationaleByValue: {
        [fmt(all)]: `${fmt(all)} sums EVERY integer in the range, not just the odd ones.`,
        [fmt(evens)]: `${fmt(evens)} sums the EVEN integers instead.`,
        [fmt(nSquared)]: `${count}² = ${fmt(nSquared)} misapplies "the sum of the first n odds is n²", that only holds for 1,3,5,… starting at 1.`,
      },
      source: "Math Questions · Number Theory",
    };
  });
}

/** Sum of a contiguous integer range a..b. (MQ39.) */
export function genSumRange(rng: Rng): Question {
  return assembleDistinct(rng, (r) => {
    const a = r.int(6, 16);
    const b = a + r.int(8, 20);
    const correct = sumRange(a, b);
    const forgotLower = sumRange(1, b); // b(b+1)/2
    const droppedLast = correct - b; // summed a..(b−1) (off-by-one, dropped the last term)
    const product = a * b;
    return {
      id: `mq-sumrange-${a}-${b}`,
      prompt: `What is the sum of the consecutive integers from ${a} to ${b} inclusive?`,
      correct: fmt(correct),
      distractors: [fmt(forgotLower), fmt(droppedLast), fmt(product)],
      explanation: `Sum(${a}..${b}) = Sum(1..${b}) − Sum(1..${a - 1}) = ${fmt(forgotLower)} − ${fmt(sumRange(1, a - 1))} = ${fmt(correct)}. (Equivalently ${b - a + 1} terms × average ${(a + b) / 2}.)`,
      difficulty: "easy" as const,
      concept: "Sum of a contiguous integer range",
      distractorRationaleByValue: {
        [fmt(forgotLower)]: `${fmt(forgotLower)} = ${b}(${b}+1)/2 sums from 1, forgetting to remove 1..${a - 1}.`,
        [fmt(droppedLast)]: `${fmt(droppedLast)} stops at ${b - 1}, an off-by-one that drops the final term ${b}.`,
        [fmt(product)]: `${a}·${b} = ${fmt(product)} just multiplies the endpoints.`,
      },
      source: "Math Questions · Number Theory",
    };
  });
}

const MULT_THEME = [
  { thing: "raffle tickets", id: "ticket number" },
  { thing: "lockers", id: "locker number" },
  { thing: "seats", id: "seat number" },
];

/** Count multiples of d in [lo,hi]. (MQ22 Magic 37.) */
export function genCountMultiples(rng: Rng): Question {
  return assembleDistinct(rng, (r) => {
    const th = r.pick(MULT_THEME);
    const d = r.pick([7, 9, 11, 13, 37]);
    const lo = r.int(2, 6) * 100 + 1;
    const hi = lo - 1 + r.pick([300, 500, 700, 900]);
    const correct = countMultiples(lo, hi, d);
    const spanOverD = Math.floor((hi - lo) / d); // range length / d
    const hiOverD = Math.floor(hi / d); // forgot the lower bound
    const loOverD = Math.floor(lo / d); // multiples up to the lower endpoint
    return {
      id: `mq-mult-${d}-${lo}-${hi}`,
      prompt: `Among the ${th.thing} numbered ${fmt(lo)} through ${fmt(hi)}, how many have a ${th.id} that is a multiple of ${d}?`,
      correct: fmt(correct),
      distractors: [fmt(spanOverD), fmt(hiOverD), fmt(loOverD)],
      explanation: `Multiples of ${d} up to ${fmt(hi)}: ⌊${fmt(hi)}/${d}⌋ = ${hiOverD}. Below ${fmt(lo)}: ⌊${fmt(lo - 1)}/${d}⌋ = ${Math.floor((lo - 1) / d)}. Difference = ${hiOverD} − ${Math.floor((lo - 1) / d)} = ${fmt(correct)}.`,
      difficulty: "medium" as const,
      concept: "Counting multiples in an interval",
      distractorRationaleByValue: {
        [fmt(spanOverD)]: `⌊(${fmt(hi)}−${fmt(lo)})/${d}⌋ = ${spanOverD} uses the span but drops a boundary multiple.`,
        [fmt(hiOverD)]: `⌊${fmt(hi)}/${d}⌋ = ${hiOverD} counts multiples from 1, forgetting the ${fmt(lo)} lower cutoff.`,
        [fmt(loOverD)]: `⌊${fmt(lo)}/${d}⌋ = ${loOverD} counts multiples only up to the START of the range.`,
      },
      source: "Math Questions · Number Theory",
    };
  });
}

const POND_THEME = [
  { surface: "pond", grower: "a mat of duckweed" },
  { surface: "petri dish", grower: "a bacterial film" },
  { surface: "lake", grower: "an algae bloom" },
];

/** Doubling growth: 1/2^m coverage day = fullDay − m·period. (MQ27.) */
export function genDoublingCoverage(rng: Rng): Question {
  return assembleDistinct(rng, (r) => {
    const th = r.pick(POND_THEME);
    const period = r.pick([2, 3]);
    const m = r.pick([2, 3]);
    const fullDay = r.int(30, 48);
    const correct = doublingDayForFraction(fullDay, period, m); // fullDay − m·period
    const frac = `1/${2 ** m}`;
    const oneStep = fullDay - period; // stepped back one period only
    const timeFallacy = Math.round(fullDay / 2 ** m); // "fraction of the days"
    const daysNotPeriods = fullDay - m; // stepped back m DAYS, not m periods
    return {
      id: `mq-pond-${fullDay}-${period}-${m}`,
      prompt: `In a ${th.surface}, ${th.grower} spreads so that the area it occupies doubles every ${period} days. The ${th.surface} is entirely blanketed on day ${fullDay}. On which earlier day did it occupy just ${frac} of the surface?`,
      correct: fmt(correct),
      distractors: [fmt(oneStep), fmt(timeFallacy), fmt(daysNotPeriods)],
      explanation: `Each ${period}-day period doubles the coverage, so going from full to ${frac} means halving ${m} times: day ${fullDay} − ${m}·${period} = day ${fmt(correct)}.`,
      difficulty: "medium" as const,
      concept: "Doubling growth (work backward by periods)",
      distractorRationaleByValue: {
        [fmt(oneStep)]: `Day ${fmt(oneStep)} steps back only ONE ${period}-day period (that's the ½-covered day), not ${m}.`,
        [fmt(timeFallacy)]: `Day ${fmt(timeFallacy)} ≈ ${fullDay}/${2 ** m} applies the fraction to the DAY number, the "${frac} of the time" fallacy.`,
        [fmt(daysNotPeriods)]: `Day ${fmt(daysNotPeriods)} steps back ${m} DAYS instead of ${m} periods of ${period} days.`,
      },
      source: "Math Questions · Number Theory",
    };
  });
}

/* ========================================================================== */
/*  FAMILY 5. GEOMETRY  (numeric free-entry)                                   */
/* ========================================================================== */

/** Clock-hand angle at h:mm = |30h − 5.5m| (mod, minor arc). (MQ1.) */
export function genClockAngle(rng: Rng): NumericQuestion {
  let h = 3;
  let m = 15;
  let value = clockAngle(h, m);
  for (let t = 0; t < 200; t++) {
    const ch = rng.int(1, 12);
    const cm = rng.pick([5, 10, 15, 20, 24, 25, 35, 40, 48, 50]);
    const v = clockAngle(ch, cm);
    if (v > 2 && v < 180) {
      h = ch;
      m = cm;
      value = v;
      break;
    }
  }
  const dp = Number.isInteger(value) ? 0 : 1;
  const answer = value;
  const noCreep = clockAngleNoHourCreep(h, m);

  const { errors, push } = numericErrors(answer, dp);
  push(noCreep, `That treats the minute hand as 6°/min but forgets the HOUR hand also creeps (0.5°/min). Use |30·h − 5.5·m|.`);
  push(30 * (h % 12), `${30 * (h % 12)}° is the hour position at the top of the hour, ignoring the ${m} minutes entirely.`);
  push(6 * m, `${6 * m}° is only the minute hand's angle from 12, not the angle BETWEEN the hands.`);

  const mm = String(m).padStart(2, "0");
  const prompt = `What is the (smaller) angle between the hour and minute hands of a clock at ${h}:${mm}? (Answer in degrees.)`;
  const explanation =
    `The hour hand sits at 30·${h % 12} + 0.5·${m} = ${30 * (h % 12) + 0.5 * m}°; the minute hand at 6·${m} = ${6 * m}°. The gap is |${30 * (h % 12) + 0.5 * m} − ${6 * m}| = ${answer}° (the minor arc).`;

  return {
    id: `mq-clock-${h}-${m}`,
    prompt,
    answer,
    decimals: dp,
    difficulty: "medium",
    concept: "Clock-hand angle",
    explanation,
    unit: "°",
    commonErrors: errors,
    source: "Math Questions · Geometry",
  };
}

const PAINT_THEME = [
  { room: "hall", cover: "wall", paint: "paint", canUnit: "can" },
  { room: "studio", cover: "panel", paint: "sealant", canUnit: "tin" },
  { room: "gallery", cover: "surface", paint: "primer", canUnit: "pot" },
];

/** Paint pots with ROUND-UP: ⌈area / coverage⌉. (MQ26.) */
export function genPaintPots(rng: Rng): NumericQuestion {
  const th = rng.pick(PAINT_THEME);
  const coverage = rng.pick([15, 18, 20, 22, 25]);
  const pots = rng.int(3, 7);
  // Area lands strictly inside (pots−1, pots]·coverage so the ceiling is `pots`.
  const area = (pots - 1) * coverage + rng.int(1, coverage - 1);
  const answer = Math.ceil(area / coverage); // = pots

  const { errors, push } = numericErrors(answer, 0);
  push(Math.floor(area / coverage), `Rounding DOWN leaves part of the ${th.cover} bare, you must round UP: ⌈${area}/${coverage}⌉ = ${answer}.`);
  push(answer + 1, `Buying ${answer + 1} is one more than needed, ${answer} ${th.canUnit}s cover ${answer * coverage} m² ≥ ${area} m².`);
  push(area, `${area} is the AREA in m², not the number of ${th.canUnit}s; divide by the ${coverage} m² each ${th.canUnit} covers, then round up.`);

  const prompt =
    `A ${th.room} has ${area} m² of ${th.cover} to cover. One ${th.canUnit} of ${th.paint} covers ${coverage} m². ` +
    `How many ${th.canUnit}s must be bought?`;
  const explanation =
    `${area} ÷ ${coverage} = ${(area / coverage).toFixed(2)} ${th.canUnit}s' worth. Since paint is sold in whole ${th.canUnit}s, round UP: ⌈${(area / coverage).toFixed(2)}⌉ = ${answer}.`;

  return {
    id: `mq-paint-${area}-${coverage}`,
    prompt,
    answer,
    difficulty: "easy",
    concept: "Ceiling division (round up whole units)",
    explanation,
    unit: th.canUnit + "s",
    commonErrors: errors,
    source: "Math Questions · Geometry",
  };
}

/** Unfolded-box volume from three edge clues (w+h, l+h, 2(w+l)). (MQ42.) */
export function genUnfoldedBox(rng: Rng): NumericQuestion {
  let l = 10;
  let w = 2;
  let h = 7;
  for (let t = 0; t < 200; t++) {
    const cw = rng.int(2, 6);
    const ch = rng.int(3, 8);
    const cl = rng.int(cw + 2, 12);
    if (cl !== cw && cl !== ch && cw !== ch) {
      l = cl;
      w = cw;
      h = ch;
      break;
    }
  }
  const a = w + h;
  const b = l + h;
  const c = 2 * (w + l);
  const sol = boxFromClues(a, b, c);
  const answer = sol.volume;

  const { errors, push } = numericErrors(answer, 0);
  push(a + b + c, `${a + b + c} adds the three clue numbers; you must first solve for the edges l=${l}, w=${w}, h=${h}, then multiply.`);
  push(2 * (l * w + l * h + w * h), `That is the SURFACE AREA (2(lw+lh+wh)); volume is l·w·h = ${answer}.`);
  push(l + w + h, `${l + w + h} sums the three edge lengths; volume multiplies them: ${l}·${w}·${h} = ${answer}.`);

  const prompt =
    `A rectangular box has a width and height summing to ${a}, a length and height summing to ${b}, ` +
    `and a base perimeter (twice width plus twice length) of ${c}. What is the box's volume?`;
  const explanation =
    `From w+h=${a}, l+h=${b}, and w+l=${c / 2}: adding the first two and subtracting the third gives 2h=${a}+${b}−${c / 2}=${2 * h} ⇒ h=${h}. Then w=${w}, l=${l}. Volume = ${l}·${w}·${h} = ${answer}.`;

  return {
    id: `mq-box-${l}-${w}-${h}`,
    prompt,
    answer,
    difficulty: "hard",
    concept: "Solve linear edge system, then volume",
    explanation,
    unit: "",
    commonErrors: errors,
    source: "Math Questions · Geometry",
  };
}

/** Circle radius from x²+y²+Dx+Ey+F=0 (complete the square). (MQ28.) */
export function genCircleRadius(rng: Rng): NumericQuestion {
  const cx = rng.int(2, 6);
  const cy = rng.int(1, 6);
  let rr = rng.int(2, 6);
  if (cx * cx + cy * cy - rr * rr === 0) rr = rr === 2 ? 3 : rr - 1; // keep F ≠ 0
  const D = -2 * cx;
  const E = -2 * cy;
  const F = cx * cx + cy * cy - rr * rr;
  const answer = circleRadius(D, E, F); // = rr

  const sgn = (k: number) => (k >= 0 ? `+ ${k}` : `− ${-k}`);
  const { errors, push } = numericErrors(answer, 0);
  push(Math.sqrt(Math.abs(F)), `Taking √|${F}| uses the constant term alone; the radius is √((D/2)²+(E/2)²−F) = √(${cx * cx}+${cy * cy}−${F}).`);
  push(cx * cx + cy * cy - F, `${cx * cx + cy * cy - F} is r² = (D/2)²+(E/2)²−F; you forgot the square root (r=${answer}).`);
  push(Math.round(Math.sqrt(cx * cx + cy * cy)), `√((D/2)²+(E/2)²) forgets to subtract the constant F=${F}.`);

  const prompt =
    `A circle in the xy-plane is described by the general-form equation x² + y² ${sgn(D)}x ${sgn(E)}y ${sgn(F)} = 0. What is the length of its radius?`;
  const explanation =
    `Complete the square: centre (${cx}, ${cy}), and r² = (${-D}/2)² + (${-E}/2)² − (${F}) = ${cx * cx} + ${cy * cy} − ${F} = ${rr * rr}. So r = ${answer}.`;

  return {
    id: `mq-circle-${cx}-${cy}-${rr}`,
    prompt,
    answer,
    difficulty: "hard",
    concept: "Circle radius by completing the square",
    explanation,
    unit: "",
    commonErrors: errors,
    source: "Math Questions · Geometry",
  };
}

/* ========================================================================== */
/*  MCQ → FREE-RESPONSE (numeric) CONVERSIONS  (PHASE_1/2)                      */
/*                                                                             */
/*  The COUNTING (mq-2) and NUMBER_THEORY (mq-4) families all answer with a    */
/*  clean WHOLE-NUMBER count/sum/day, so they are eligible for free-response.  */
/*  Each `gen<Family>Numeric` reuses the SAME exact solver as its quiz twin    */
/*  (kept above, unchanged, so existing tests keep passing) and re-expresses   */
/*  the quiz's genuine distractors as a parametric error-mode catalog: a wrong */
/*  value + a snake_case misconception tag + an encouraging rung-1 coaching    */
/*  line that NAMES the slip and asks a leading question WITHOUT the answer.    */
/* ========================================================================== */

/* ---- FAMILY 2 (mq-2). COUNTING & ARRANGEMENTS → numeric ----------------- */

/** Free-response twin of {@link genColdStorage}: ⌊L/s⌋·⌊W/s⌋·⌊H/s⌋ cubes. */
export function genColdStorageNumeric(rng: Rng): NumericQuestion {
  const th = rng.pick(COLD_THEME);
  const s = rng.pick([3, 4, 5]);
  const dim = () => {
    let d = rng.int(20, 40);
    if (d % s === 0) d += 1; // ensure flooring actually bites
    return d;
  };
  const L = dim();
  const W = dim();
  const H = dim();
  const fL = Math.floor(L / s);
  const fW = Math.floor(W / s);
  const fH = Math.floor(H / s);
  const answer = packedCubes([L, W, H], s);

  const { errors, push } = numericErrors(answer, 0);
  push(
    volumeTrap([L, W, H], s),
    `Careful, that's the whole VOLUME ${fmt(L * W * H)} divided by ${s}³. Leftover space along an edge can't be pooled to hold another cube. Should you floor each edge first, or divide the volumes?`,
    "volume_division_pack",
  );
  push(
    Math.ceil(L / s) * Math.ceil(W / s) * Math.ceil(H / s),
    `Close, but rounding each edge UP counts cubes that would poke out past the walls. When a whole cube must fit inside, which way do you round each edge?`,
    "ceil_not_floor",
  );
  push(
    fL * fW,
    `You multiplied only two edges. What about the ${fH} layers stacked along the third dimension?`,
    "dropped_third_dimension",
  );

  const prompt =
    `A ${th.box} measures ${L}×${W}×${H} cm. How many solid ${s}×${s}×${s} cm ${th.item}s can be packed inside (no cutting, axis-aligned)? (Enter a whole number.)`;
  const explanation =
    `Fit ⌊${L}/${s}⌋=${fL} along one edge, ⌊${W}/${s}⌋=${fW} along another, and ⌊${H}/${s}⌋=${fH} along the last, then multiply: ${fL}·${fW}·${fH} = ${fmt(answer)}. You must FLOOR each dimension first, because the leftover on an edge can't hold another cube.`;

  return {
    id: `mq-cold-num-${L}-${W}-${H}-${s}`,
    prompt,
    answer,
    difficulty: "medium",
    concept: "Packing count (floor per dimension, then multiply)",
    explanation,
    unit: "",
    commonErrors: errors,
    source: "Math Questions · Counting",
  };
}

/** Free-response twin of {@link genGridRectangles}: C(n+1,2)² rectangles. */
export function genGridRectanglesNumeric(rng: Rng): NumericQuestion {
  const th = rng.pick(GRID_THEME);
  const n = rng.pick([6, 7, 8, 9, 10]);
  const lines = choose(n + 1, 2);
  const answer = gridRectangles(n);

  const { errors, push } = numericErrors(answer, 0);
  push(
    gridSquares(n),
    `That counts only the equal-sided SQUARES. A rectangle traced on the grid lines need not have equal sides, must every rectangle be a square?`,
    "squares_not_rectangles",
  );
  push(
    lines,
    `You picked one pair of lines (${lines} ways) in a single direction. A rectangle fixes a pair of lines in BOTH directions, how do two independent choices combine?`,
    "one_dimension_only",
  );
  push(
    n * n,
    `${fmt(n * n)} counts just the smallest unit ${th.cell}s. What about the larger rectangles that span several ${th.cell}s at once?`,
    "unit_cells_only",
  );

  const prompt =
    `On an ${n}×${n} ${th.grid} (a grid of ${n}×${n} ${th.cell}s), how many rectangles of any size can be traced along the grid lines? (Enter a whole number.)`;
  const explanation =
    `A rectangle is fixed by choosing 2 of the ${n + 1} vertical lines and 2 of the ${n + 1} horizontal lines: C(${n + 1},2)·C(${n + 1},2) = ${lines}² = ${fmt(answer)}.`;

  return {
    id: `mq-rects-num-${n}`,
    prompt,
    answer,
    difficulty: "medium",
    concept: "Rectangles on a grid = C(n+1,2)²",
    explanation,
    unit: "",
    commonErrors: errors,
    source: "Math Questions · Counting",
  };
}

/** Free-response twin of {@link genWordArrangements}: n!/(2!·2!). */
export function genWordArrangementsNumeric(rng: Rng): NumericQuestion {
  const th = rng.pick(WORD_THEME);
  const singles = rng.int(3, 5);
  const n = singles + 4; // + two letters that each appear twice
  const alphabet = "MKPRTLNS".split("");
  const chosen = rng.shuffle(alphabet).slice(0, singles + 2);
  const letters: string[] = [];
  letters.push(chosen[0], chosen[0], chosen[1], chosen[1]);
  for (let i = 2; i < chosen.length; i++) letters.push(chosen[i]);
  const word = rng.shuffle(letters).join("");
  const answer = multinomial([2, 2, ...Array(singles).fill(1)]); // n!/(2!2!)

  const { errors, push } = numericErrors(answer, 0);
  push(
    factorial(n),
    `${n}! treats every character as distinct, but two of them repeat. When two identical letters swap places, do you get a genuinely NEW arrangement?`,
    "ignored_repeats",
  );
  push(
    factorial(n) / 2,
    `You divided by 2! for only ONE of the doubled characters. How many characters appear twice, and does each need its own correction?`,
    "one_repeat_only",
  );
  push(
    factorial(n) / 8,
    `That divides by one 2! too many. There are exactly two doubled characters, should you divide by 2!·2! or by 2!·2!·2!?`,
    "over_divided_repeats",
  );

  const prompt =
    `How many DISTINCT arrangements are there of the ${n} characters in the ${th.label} "${word}" (two characters each appear twice)? (Enter a whole number.)`;
  const explanation =
    `There are ${n}! orderings, but each repeated pair is interchangeable, so divide by 2! for EACH doubled character: ${n}!/(2!·2!) = ${fmt(factorial(n))}/4 = ${fmt(answer)}.`;

  return {
    id: `mq-word-num-${word}`,
    prompt,
    answer,
    difficulty: "medium",
    concept: "Permutations of a multiset (repeated letters)",
    explanation,
    unit: "",
    commonErrors: errors,
    source: "Math Questions · Counting",
  };
}

/** Free-response twin of {@link genRoundRobin}: meetings·C(n,2) games. */
export function genRoundRobinNumeric(rng: Rng): NumericQuestion {
  const th = rng.pick(LEAGUE_THEME);
  const n = rng.int(5, 12);
  const meetings = rng.pick([2, 3]);
  const once = choose(n, 2);
  const answer = roundRobinGames(n, meetings);

  const { errors, push } = numericErrors(answer, 0);
  push(
    once,
    `That counts each matchup only once. But every pair of ${th.side}s meets ${meetings} times, how should that scale the total?`,
    "forgot_meetings",
  );
  push(
    n * n,
    `${fmt(n * n)} = ${n}² counts ordered pairs, including a ${th.side} paired with itself. Should a ${th.side} face itself, and does the order within a matchup matter?`,
    "included_self_pairs",
  );
  push(
    meetings * n * (n - 1),
    `That treats "A hosts B" and "B hosts A" as different games. For an unordered matchup, what must ${n}·(${n}−1) be divided by?`,
    "ordered_pairs_double_count",
  );

  const prompt =
    `A ${th.comp} has ${n} ${th.side}s. Every pair of ${th.side}s plays each other exactly ${meetings} times. How many games are played in total? (Enter a whole number.)`;
  const explanation =
    `There are C(${n},2) = ${once} distinct pairings, and each is played ${meetings} times: ${meetings}·${once} = ${fmt(answer)}.`;

  return {
    id: `mq-league-num-${n}-${meetings}`,
    prompt,
    answer,
    difficulty: "medium",
    concept: "Round-robin scheduling (combinations × meetings)",
    explanation,
    unit: "",
    commonErrors: errors,
    source: "Math Questions · Counting",
  };
}

/* ---- FAMILY 4 (mq-4). NUMBER THEORY & GROWTH → numeric ------------------ */

/** Free-response twin of {@link genSumOddsRange}: sum of odds in [a,b]. */
export function genSumOddsRangeNumeric(rng: Rng): NumericQuestion {
  const a = rng.pick([20, 40, 50, 60, 100]);
  const span = rng.pick([50, 60, 80, 100]);
  const b = a + span;
  const answer = sumOddsInRange(a, b);
  const lo = a % 2 === 0 ? a + 1 : a;
  const hi = b % 2 === 0 ? b - 1 : b;
  const count = (hi - lo) / 2 + 1;

  const { errors, push } = numericErrors(answer, 0);
  push(
    sumRange(a, b),
    `That sums EVERY integer in the range, not only the odd ones. Which half of the numbers should be left out?`,
    "summed_all_integers",
  );
  push(
    sumEvensInRange(a, b),
    `That's the sum of the EVEN integers instead. Which parity did the question actually ask for?`,
    "summed_evens_instead",
  );
  push(
    count * count,
    `Looks like "the first n odds sum to n²", but that identity only holds for 1,3,5,… starting at 1. Does this range start at 1?`,
    "n_squared_misapplied",
  );

  const prompt = `What is the sum of all ODD integers from ${a} to ${b} inclusive? (Enter a whole number.)`;
  const explanation =
    `The odd integers run ${lo}, ${lo + 2}, …, ${hi}, that's ${count} terms averaging (${lo}+${hi})/2 = ${(lo + hi) / 2}. Sum = ${count}·${(lo + hi) / 2} = ${fmt(answer)}.`;

  return {
    id: `mq-sumodds-num-${a}-${b}`,
    prompt,
    answer,
    difficulty: "medium",
    concept: "Arithmetic series of odd numbers",
    explanation,
    unit: "",
    commonErrors: errors,
    source: "Math Questions · Number Theory",
  };
}

/** Free-response twin of {@link genSumRange}: sum of a contiguous range. */
export function genSumRangeNumeric(rng: Rng): NumericQuestion {
  const a = rng.int(6, 16);
  const b = a + rng.int(8, 20);
  const answer = sumRange(a, b);

  const { errors, push } = numericErrors(answer, 0);
  push(
    sumRange(1, b),
    `That sums from 1 up to ${b}. The range starts at ${a}, what do you subtract to drop the 1..${a - 1} head?`,
    "forgot_lower_bound",
  );
  push(
    answer - b,
    `Looks like an off-by-one that stops at ${b - 1}. Is the final endpoint ${b} included when the range is "inclusive"?`,
    "dropped_last_term",
  );
  push(
    a * b,
    `${a}·${b} just multiplies the endpoints. A run of consecutive integers is (#terms)×(average), how many terms are there, and what's their average?`,
    "multiplied_endpoints",
  );

  const prompt = `What is the sum of the consecutive integers from ${a} to ${b} inclusive? (Enter a whole number.)`;
  const explanation =
    `Sum(${a}..${b}) = ${b - a + 1} terms × average ${(a + b) / 2} = ${fmt(answer)}. (Equivalently Sum(1..${b}) − Sum(1..${a - 1}).)`;

  return {
    id: `mq-sumrange-num-${a}-${b}`,
    prompt,
    answer,
    difficulty: "easy",
    concept: "Sum of a contiguous integer range",
    explanation,
    unit: "",
    commonErrors: errors,
    source: "Math Questions · Number Theory",
  };
}

/** Free-response twin of {@link genCountMultiples}: ⌊hi/d⌋−⌊(lo−1)/d⌋. */
export function genCountMultiplesNumeric(rng: Rng): NumericQuestion {
  const th = rng.pick(MULT_THEME);
  const d = rng.pick([7, 9, 11, 13, 37]);
  const lo = rng.int(2, 6) * 100 + 1;
  const hi = lo - 1 + rng.pick([300, 500, 700, 900]);
  const answer = countMultiples(lo, hi, d);

  const { errors, push } = numericErrors(answer, 0);
  push(
    Math.floor((hi - lo) / d),
    `That divides the SPAN ${fmt(hi - lo)} by ${d}, which can miss a boundary multiple. Counting multiples in [${fmt(lo)}, ${fmt(hi)}] is a difference of two floor-divisions, which two?`,
    "span_over_d",
  );
  push(
    Math.floor(hi / d),
    `That counts multiples of ${d} from 1 up to ${fmt(hi)}, forgetting the ${fmt(lo)} lower cutoff. What should you subtract for the numbers below ${fmt(lo)}?`,
    "forgot_lower_cutoff",
  );
  push(
    Math.floor(lo / d),
    `That only reaches the START of the range. Shouldn't you count multiples all the way up to ${fmt(hi)}, not just up to ${fmt(lo)}?`,
    "up_to_start_only",
  );

  const prompt =
    `Among the ${th.thing} numbered ${fmt(lo)} through ${fmt(hi)}, how many have a ${th.id} that is a multiple of ${d}? (Enter a whole number.)`;
  const explanation =
    `Multiples of ${d} up to ${fmt(hi)}: ⌊${fmt(hi)}/${d}⌋ = ${Math.floor(hi / d)}. Below ${fmt(lo)}: ⌊${fmt(lo - 1)}/${d}⌋ = ${Math.floor((lo - 1) / d)}. Difference = ${fmt(answer)}.`;

  return {
    id: `mq-mult-num-${d}-${lo}-${hi}`,
    prompt,
    answer,
    difficulty: "medium",
    concept: "Counting multiples in an interval",
    explanation,
    unit: "",
    commonErrors: errors,
    source: "Math Questions · Number Theory",
  };
}

/** Free-response twin of {@link genDoublingCoverage}: fullDay − m·period. */
export function genDoublingCoverageNumeric(rng: Rng): NumericQuestion {
  const th = rng.pick(POND_THEME);
  const period = rng.pick([2, 3]);
  const m = rng.pick([2, 3]);
  const fullDay = rng.int(30, 48);
  const answer = doublingDayForFraction(fullDay, period, m); // fullDay − m·period
  const frac = `1/${2 ** m}`;

  const { errors, push } = numericErrors(answer, 0);
  push(
    fullDay - period,
    `Day ${fullDay - period} steps back only ONE ${period}-day period, that's the HALF-covered day. To reach ${frac}, how many times must the coverage halve?`,
    "one_period_only",
  );
  push(
    Math.round(fullDay / 2 ** m),
    `That applies the fraction ${frac} to the DAY NUMBER. Doubling scales the AREA each period, not the calendar day, should you divide the day, or step back whole periods?`,
    "fraction_of_time_fallacy",
  );
  push(
    fullDay - m,
    `You stepped back ${m} DAYS, but coverage halves once per ${period}-day PERIOD. How many days is ${m} whole periods?`,
    "days_not_periods",
  );

  const prompt =
    `In a ${th.surface}, ${th.grower} spreads so that the area it occupies doubles every ${period} days. The ${th.surface} is entirely blanketed on day ${fullDay}. On which earlier day did it occupy just ${frac} of the surface? (Enter a whole number.)`;
  const explanation =
    `Each ${period}-day period doubles the coverage, so going from full back to ${frac} means halving ${m} times: day ${fullDay} − ${m}·${period} = day ${fmt(answer)}.`;

  return {
    id: `mq-pond-num-${fullDay}-${period}-${m}`,
    prompt,
    answer,
    difficulty: "medium",
    concept: "Doubling growth (work backward by periods)",
    explanation,
    unit: "",
    commonErrors: errors,
    source: "Math Questions · Number Theory",
  };
}

/* -------------------------------------------------------------------------- */
/*  Helpers + family pools + mix wrappers                                       */
/* -------------------------------------------------------------------------- */

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Combine several quiz generators into one family-tagged mixer. */
export const mixQuiz = (pool: QuestionGenerator[]): QuestionGenerator =>
  mixQuestionGenerators(pool);

/** Combine several numeric generators into one family-tagged mixer. */
export const mixNumeric = (
  pool: NumericQuestionGenerator[],
): NumericQuestionGenerator => mixNumericGenerators(pool);

export const RATE_WORK = [
  genFillDrainTank,
  genTwoLegTrip,
  genRiverDrift,
  genEscalatorSteps,
];

export const COUNTING = [
  genColdStorage,
  genGridRectangles,
  genWordArrangements,
  genRoundRobin,
];

/** Free-response (numeric) forms of the COUNTING families, mq-2 conversion. */
export const COUNTING_NUMERIC = [
  genColdStorageNumeric,
  genGridRectanglesNumeric,
  genWordArrangementsNumeric,
  genRoundRobinNumeric,
];

export const ALGEBRA_SYSTEMS = [
  genTriangularTotal,
  genHeadsLegs,
  genGamesNet,
  genLongFish,
  genPairwiseProducts,
];

export const NUMBER_THEORY = [
  genSumOddsRange,
  genSumRange,
  genCountMultiples,
  genDoublingCoverage,
];

/** Free-response (numeric) forms of the NUMBER_THEORY families, mq-4 conversion. */
export const NUMBER_THEORY_NUMERIC = [
  genSumOddsRangeNumeric,
  genSumRangeNumeric,
  genCountMultiplesNumeric,
  genDoublingCoverageNumeric,
];

export const GEOMETRY = [
  genClockAngle,
  genPaintPots,
  genUnfoldedBox,
  genCircleRadius,
];

/**
 * MCQ→free-response conversions (PHASE_1/2): the numeric twins of the mq-2
 * COUNTING and mq-4 NUMBER_THEORY families, each carrying a tagged parametric
 * error-mode catalog. Split out so the test can additionally assert every
 * `commonError` on these families is tagged with a `misconception`.
 */
export const CONVERTED_NUMERIC_GENERATORS = {
  genColdStorageNumeric,
  genGridRectanglesNumeric,
  genWordArrangementsNumeric,
  genRoundRobinNumeric,
  genSumOddsRangeNumeric,
  genSumRangeNumeric,
  genCountMultiplesNumeric,
  genDoublingCoverageNumeric,
};

/** All numeric generators, for the verification test harness. */
export const NUMERIC_GENERATORS = {
  genFillDrainTank,
  genTwoLegTrip,
  genRiverDrift,
  genEscalatorSteps,
  genTriangularTotal,
  genHeadsLegs,
  genGamesNet,
  genLongFish,
  genPairwiseProducts,
  genClockAngle,
  genPaintPots,
  genUnfoldedBox,
  genCircleRadius,
  ...CONVERTED_NUMERIC_GENERATORS,
};

/**
 * The ORIGINAL quiz generators for the mq-2 / mq-4 families. Kept exported +
 * tested even though those levels now route to their numeric twins above, the
 * multiple-choice items remain valid and the existing round-trip/fingerprint
 * tests exercise them.
 */
export const QUIZ_GENERATORS = {
  genColdStorage,
  genGridRectangles,
  genWordArrangements,
  genRoundRobin,
  genSumOddsRange,
  genSumRange,
  genCountMultiples,
  genDoublingCoverage,
};
