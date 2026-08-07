import type { Rng } from "@/lib/rng";
import type {
  Difficulty,
  Flashcard,
  NumericQuestion,
  NumericQuestionGenerator,
  Question,
  QuestionGenerator,
} from "@/types/content";
import {
  F,
  decText,
  fracText,
  beautyLevelLadder,
  hotellingShare,
  isPrisonersDilemma,
  saddleValue2x2,
  solveDominance3x2,
  solveEntryGame,
  solveMixed2x2,
  solveVolunteer,
  type EntryGame,
  type PdPayoffs,
  type ZeroSum2x2,
  type ZeroSum3x2,
} from "./games";
import { mixNumericGenerators, mixQuestionGenerators } from "../../mixFamilies";

/**
 * Parametric generators + per-family misconception taxonomies for the Game
 * Theory subcategory. Each family has its own solution method (unlike the
 * single Kelly formula), so the generators are grouped by family, every scalar
 * is produced by the exact solver in `games.ts`, and every distractor is a
 * re-derived, named misconception.
 *
 * Mode per family (see the level file for the justification):
 *   • Prisoner's Dilemma, backward induction, Hotelling, beauty contest →
 *     `quiz` (the teaching point is NAMING the misconception behind each wrong
 *     payoff, so multiple-choice with distractor rationale is strictly better).
 *   • zero-sum 2×2 / 3×2 mixed VALUE and Volunteer's Dilemma probability →
 *     `numeric` free-entry (a clean exact scalar the learner computes).
 *   • coordination / stag hunt, non-credible threat, repeated game / folk
 *     theorem → `flashcard` (no single scalar; reason-then-reveal).
 */

/* -------------------------------------------------------------------------- */
/*  Shared helpers                                                             */
/* -------------------------------------------------------------------------- */

interface Choice {
  text: string;
  rationale: string;
}

/** Assemble + shuffle MC choices so the answer position never leaks. */
function assembleChoices(
  rng: Rng,
  correct: Choice,
  distractors: Choice[],
): Pick<Question, "choices" | "correctIndex" | "distractorRationale"> {
  const all = [correct, ...distractors];
  const order = rng.shuffle(all.map((_, i) => i));
  const shuffled = order.map((i) => all[i]);
  return {
    choices: shuffled.map((c) => c.text),
    correctIndex: order.indexOf(0),
    distractorRationale: shuffled.map((c) => c.rationale),
  };
}

/** Combine several Question generators into one that picks per call (family-tagged). */
export const mixQuiz = (pool: QuestionGenerator[]): QuestionGenerator =>
  mixQuestionGenerators(pool);

/** Combine several numeric generators into one that picks per call (family-tagged). */
export const mixNumeric = (
  pool: NumericQuestionGenerator[],
): NumericQuestionGenerator => mixNumericGenerators(pool);

const uniqueInts = (a: number[]): boolean => new Set(a).size === a.length;

/* ========================================================================== */
/*  FAMILY 1. Prisoner's Dilemma / dominant strategy  (quiz)                 */
/* ========================================================================== */

const PD_SCENARIOS: {
  actors: string;
  coop: string;
  defect: string;
  unit: string;
  story: string;
}[] = [
  {
    actors: "You and a rival market-maker",
    coop: "Quote Wide",
    defect: "Undercut",
    unit: "profit units",
    story:
      "Undercutting grabs flow today but drags you both to a thin-spread grind.",
  },
  {
    actors: "You and a co-founder",
    coop: "Reinvest",
    defect: "Cash Out",
    unit: "equity points",
    story: "Cashing out looks smart alone but tanks the company if you both do it.",
  },
  {
    actors: "Two neighbouring cafés",
    coop: "Hold Price",
    defect: "Slash Price",
    unit: "weekly profit",
    story: "A price war is individually tempting but jointly ruinous.",
  },
  {
    actors: "You and a rival trading desk",
    coop: "Share Research",
    defect: "Hoard",
    unit: "alpha units",
    story: "Hoarding dominates but leaves both desks worse off.",
  },
];

export interface PdInstance {
  scenario: (typeof PD_SCENARIOS)[number];
  payoffs: PdPayoffs;
  answer: number;
  question: Question;
}

export function buildPdInstance(rng: Rng, difficulty: Difficulty): PdInstance {
  for (let attempt = 0; attempt < 200; attempt++) {
    // Build a strict PD: T > R > P > S with distinct integers.
    const S = rng.int(0, 3);
    const P = S + rng.int(1, 3);
    const R = P + rng.int(1, 3);
    const T = R + rng.int(1, 3);
    const payoffs: PdPayoffs = { R, S, T, P };
    if (!isPrisonersDilemma(payoffs)) continue;
    if (!uniqueInts([R, S, T, P])) continue;
    // Originality: never emit a source-dataset payoff tuple (GT1 "Whose Turn Is
    // It" is the only one reachable from these ranges). Skip it so no user-facing
    // item reuses the source's exact incidental numbers.
    if (R === 4 && S === 1 && T === 5 && P === 2) continue;
    const sc = rng.pick(PD_SCENARIOS);
    const answer = P; // (Defect, Defect) is the unique NE.

    const prompt =
      `${sc.actors} simultaneously choose ${sc.coop} or ${sc.defect} (${sc.unit}, your payoff shown). ` +
      `Both-${sc.coop} = ${R}; you ${sc.coop}/they ${sc.defect} = ${S}; ` +
      `you ${sc.defect}/they ${sc.coop} = ${T}; both-${sc.defect} = ${P}. ` +
      `The game is symmetric. What is YOUR payoff in the unique Nash equilibrium?`;

    const explanation =
      `${sc.defect} strictly dominates: it beats ${sc.coop} whether they ${sc.coop} ` +
      `(${T} > ${R}) or ${sc.defect} (${P} > ${S}). By symmetry both ${sc.defect}, so the unique ` +
      `Nash equilibrium is (${sc.defect}, ${sc.defect}) paying ${P} each. Both-${sc.coop} pays ${R} ` +
      `(better for both!) but is unstable, either side deviates to ${sc.defect} for ${T}. ` +
      `That trap is the Prisoner's Dilemma. ${sc.story}`;

    const correct: Choice = {
      text: String(P),
      rationale: `Correct, (${sc.defect}, ${sc.defect}) is the unique NE; the dominant strategy yields the punishment payoff ${P}.`,
    };
    const distractors: Choice[] = [
      {
        text: String(R),
        rationale: `The cooperative payoff (both ${sc.coop}). It's Pareto-better but NOT an equilibrium, each side can deviate to ${sc.defect} and gain.`,
      },
      {
        text: String(T),
        rationale: `The temptation payoff, what you'd get defecting while they cooperate. But a rational opponent also defects, so this isn't sustained.`,
      },
      {
        text: String(S),
        rationale: `The sucker payoff, you'd only earn this by cooperating while they defect, which no rational player accepts.`,
      },
    ];

    return {
      scenario: sc,
      payoffs,
      answer,
      question: {
        id: `gt-pd-${R}-${S}-${T}-${P}`,
        prompt,
        explanation,
        difficulty,
        concept: "Prisoner's Dilemma (dominant strategy)",
        source: "Game Theory · dominant strategy",
        ...assembleChoices(rng, correct, distractors),
      },
    };
  }
  throw new Error("failed to build a PD instance");
}

/* ========================================================================== */
/*  FAMILY 2. Sequential / backward induction  (quiz)                        */
/* ========================================================================== */

const ENTRY_SCENARIOS: {
  challenger: string;
  incumbent: string;
  market: string;
}[] = [
  { challenger: "a startup fund", incumbent: "the incumbent desk", market: "a new options market" },
  { challenger: "a challenger exchange", incumbent: "the dominant venue", market: "listed futures" },
  { challenger: "an upstart broker", incumbent: "the established broker", market: "retail flow" },
];

export interface EntryInstance {
  game: EntryGame;
  answer: number;
  question: Question;
}

export function buildEntryInstance(
  rng: Rng,
  difficulty: Difficulty,
): EntryInstance {
  for (let attempt = 0; attempt < 300; attempt++) {
    const cOut = rng.int(0, 2);
    const iOut = rng.int(8, 12);
    const cFight = -rng.int(2, 5); // entering a price war hurts the challenger
    const iFight = -rng.int(1, 4); // fighting also hurts the incumbent
    const cHold = rng.int(2, 4);
    const iHold = rng.int(4, 7);
    const cExpand = cHold + rng.int(1, 4); // expand beats hold for challenger
    const iExpand = rng.int(1, 3); // incumbent gets squeezed but still positive

    const game: EntryGame = {
      cOut,
      iOut,
      cFight,
      iFight,
      cHold,
      iHold,
      cExpand,
      iExpand,
    };
    const sol = solveEntryGame(game);
    // We want the canonical teaching case: enter → accommodate → expand, with a
    // non-credible fight threat that would deter entry if it were believed.
    if (sol.firstMove !== "Enter") continue;
    if (sol.incumbentMove !== "Accommodate") continue;
    if (sol.lastMove !== "Expand") continue;
    if (!(cFight < cOut)) continue; // believed threat would deter → makes it a real trap
    const payoffSet = [cExpand, cHold, cOut, cFight];
    if (!uniqueInts(payoffSet)) continue;
    // Originality: never emit the source GT4 "Challenger's Gambit" tuple exactly.
    if (
      cOut === 0 &&
      iOut === 10 &&
      cFight === -4 &&
      iFight === -2 &&
      cHold === 3 &&
      iHold === 5 &&
      cExpand === 6 &&
      iExpand === 1
    )
      continue;

    const sc = rng.pick(ENTRY_SCENARIOS);
    const answer = cExpand;

    const prompt =
      `Sequential entry into ${sc.market}, payoffs (challenger, ${sc.incumbent}). ` +
      `${sc.challenger} first Stays Out → (${cOut}, ${iOut}) or Enters. ` +
      `If it Enters, ${sc.incumbent} Fights → (${cFight}, ${iFight}) or Accommodates. ` +
      `If accommodated, ${sc.challenger} then Holds → (${cHold}, ${iHold}) or Expands → (${cExpand}, ${iExpand}). ` +
      `All rational, common knowledge. What payoff does ${sc.challenger} earn at the rational (subgame-perfect) outcome?`;

    const explanation =
      `Backward induction. Last move: ${sc.challenger} Expands (${cExpand} > ${cHold}). ` +
      `Knowing that, ${sc.incumbent} Accommodates (${iExpand} > ${iFight}). Fighting pays only ${iFight}. ` +
      `So ${sc.challenger} Enters (${cExpand} > ${cOut} from staying out). Path: Enter → Accommodate → Expand, ` +
      `challenger earns ${cExpand}. The "I'll fight a price war" threat is NON-CREDIBLE: once entry happens, ` +
      `fighting (${iFight}) is worse for the incumbent than accommodating (${iExpand}), so a rational incumbent never fights.`;

    const correct: Choice = {
      text: String(cExpand),
      rationale: `Correct. Enter → Accommodate → Expand pays the challenger ${cExpand}.`,
    };
    const distractors: Choice[] = [
      {
        text: String(cHold),
        rationale: `Assumes the challenger politely Holds after being accommodated. But Expand (${cExpand}) beats Hold (${cHold}), anticipate the opponent's ACTUAL last move.`,
      },
      {
        text: String(cOut),
        rationale: `The stay-out payoff, correct only if the challenger believed the non-credible "fight" threat and never entered.`,
      },
      {
        text: String(cFight),
        rationale: `The price-war payoff, what happens only if the incumbent actually Fights, which it never rationally does (${iExpand} > ${iFight}).`,
      },
    ];

    return {
      game,
      answer,
      question: {
        id: `gt-entry-${cOut}-${cFight}-${cHold}-${cExpand}-${iFight}-${iExpand}`,
        prompt,
        explanation,
        difficulty,
        concept: "Backward induction / credible threat",
        source: "Game Theory · sequential",
        ...assembleChoices(rng, correct, distractors),
      },
    };
  }
  throw new Error("failed to build an entry-game instance");
}

/* ========================================================================== */
/*  FAMILY 3. Spatial competition / Hotelling  (quiz)                        */
/* ========================================================================== */

// NOTE: deliberately avoids the source GT6 "Beach Carts" framing (beach /
// sunbathers / ice-cream carts) so no user-facing item echoes that named
// scenario. These are distinct Hotelling contexts.
const HOTELLING_SCENARIOS: { place: string; buyers: string; vendor: string }[] =
  [
    { place: "a subway platform", buyers: "commuters", vendor: "newsstand" },
    { place: "a single avenue", buyers: "shoppers", vendor: "coffee kiosk" },
    { place: "a long pier", buyers: "tourists", vendor: "food stall" },
  ];

export interface HotellingInstance {
  customers: number;
  answer: number;
  question: Question;
}

export function buildHotellingInstance(
  rng: Rng,
  difficulty: Difficulty,
): HotellingInstance {
  // Even count in [40, 200] EXCLUDING 100 (the source GT6 "Beach Carts"
  // count, whose N/2 = 50 answer we must not reproduce).
  let customers = rng.int(20, 100) * 2;
  while (customers === 100) customers = rng.int(20, 100) * 2;
  const answer = hotellingShare(customers);
  const sc = rng.pick(HOTELLING_SCENARIOS);
  const whole = customers;
  const quarter = customers / 4;
  const threeQuarter = (3 * customers) / 4;

  const prompt =
    `Along ${sc.place}, ${customers} ${sc.buyers} are spread perfectly evenly. ` +
    `You and a rival each place one ${sc.vendor} simultaneously; every buyer goes to the nearer cart ` +
    `(ties split evenly). In the unique Nash equilibrium, how many of the ${customers} ${sc.buyers} do YOU serve?`;

  const explanation =
    `Best response is to crowd just beside the rival on the larger side, grabbing more than half, so any ` +
    `off-centre pair is unstable. The only equilibrium is BOTH carts at the median (the centre), splitting the ` +
    `market: you serve ${customers}/2 = ${answer}. This is the median-voter / minimum-differentiation result. ` +
    `Note 25%/75% positions (${quarter} and ${threeQuarter}) would minimise walking but are NOT an equilibrium, ` +
    `either vendor jumps beside the other to seize the bigger side.`;

  const correct: Choice = {
    text: String(answer),
    rationale: `Correct, both locate at the median and split evenly, so you serve ${customers}/2 = ${answer}.`,
  };
  const distractors: Choice[] = [
    {
      text: String(whole),
      rationale: `That's the whole market. You only capture everyone if the rival abandons the beach, against a rational rival you split it.`,
    },
    {
      text: String(threeQuarter),
      rationale: `Assumes you grab the larger side against a rival stuck at the quarter point, but the rival won't sit there; both converge to the centre.`,
    },
    {
      text: String(quarter),
      rationale: `The socially-efficient 25%/75% spread. It minimises total walking but isn't stable, so it isn't the equilibrium share.`,
    },
  ];

  return {
    customers,
    answer,
    question: {
      id: `gt-hotelling-${customers}`,
      prompt,
      explanation,
      difficulty,
      concept: "Hotelling / median voter",
      source: "Game Theory · spatial competition",
      ...assembleChoices(rng, correct, distractors),
    },
  };
}

/* ========================================================================== */
/*  FAMILY 4. Beauty contest / iterated dominance  (quiz)                    */
/* ========================================================================== */

export interface BeautyInstance {
  max: number;
  targetLabel: string;
  answer: number;
  question: Question;
}

export function buildBeautyInstance(
  rng: Rng,
  difficulty: Difficulty,
): BeautyInstance {
  // Avoid max = 100: the source GT7 "Half the Average" uses the 0–100 range,
  // so we draw from other ceilings to keep both wording and numbers distinct.
  const max = rng.pick([80, 80, 60, 90]);
  const useHalf = rng.chance(0.5);
  const target = useHalf ? F(1, 2) : F(2, 3);
  const targetLabel = useHalf ? "half" : "two-thirds";
  const ladder = beautyLevelLadder(max, target, 2); // L0, L1, L2
  const L0 = ladder[0];
  const L1 = ladder[1];
  const L2 = ladder[2];
  const targetOfMax = Math.round(target.valueOf() * max);
  const answer = 0; // iterated dominance equilibrium

  // Build three DISTINCT non-zero distractors. `targetOfMax` collides with L0
  // when the target is exactly half (½·max = max/2 = L0), so fall back to the
  // level-2 guess to keep all options distinct.
  const thirdText = targetOfMax !== L0 && targetOfMax !== L1 ? targetOfMax : L2;
  const thirdRationale =
    thirdText === targetOfMax
      ? `${targetLabel} of the MAXIMUM (${max}), not of the average. The target is a fraction of the average, which keeps shrinking to 0.`
      : `The level-2 guess. Deeper than L1 but still not the equilibrium, iterated dominance runs all the way to 0.`;

  const prompt =
    `Many analysts each secretly write a whole number from 0 to ${max}. The winner is whoever is closest to ` +
    `${targetLabel} of the average of all submissions. Assuming everyone is rational and this is common knowledge, ` +
    `what is the unique Nash-equilibrium number?`;

  const explanation =
    `Iterated elimination of dominated strategies: ${targetLabel} of an average ≤ ${max} can't exceed ${targetOfMax}, ` +
    `so any guess above that is dominated; delete it, the ceiling falls again, and again, the only number surviving ` +
    `is 0. So the unique Nash equilibrium is 0. (Winning MONEY is different: real rooms play level-k. L0 ≈ ${L0}, ` +
    `L1 ≈ ${L1}, so the winning guess is small but positive, "one level deeper than the room.")`;

  const correct: Choice = {
    text: "0",
    rationale: `Correct, iterated dominance collapses the game to the unique equilibrium 0.`,
  };
  const distractors: Choice[] = [
    {
      text: String(L0),
      rationale: `The level-0 "midpoint" guess (${max}/2). It anchors the ladder but is not an equilibrium, best-respond and go lower.`,
    },
    {
      text: String(L1),
      rationale: `The level-1 guess: ${targetLabel} of the midpoint. Better, but rational players iterate all the way down to 0.`,
    },
    {
      text: String(thirdText),
      rationale: thirdRationale,
    },
  ];

  return {
    max,
    targetLabel,
    answer,
    question: {
      id: `gt-beauty-${max}-${useHalf ? "half" : "twothirds"}`,
      prompt,
      explanation,
      difficulty,
      concept: "Beauty contest / level-k",
      source: "Game Theory · iterated dominance",
      ...assembleChoices(rng, correct, distractors),
    },
  };
}

/* ========================================================================== */
/*  FAMILY 5. Zero-sum 2×2 mixed strategy VALUE  (numeric)                    */
/* ========================================================================== */

const VALUE_DP = 2; // dataset convention: "round to 2 decimals"

/** Distinct wrong values (rounded to 2dp, ≠ answer) for a 2×2 value item. */
function zeroSum2x2Errors(
  m: ZeroSum2x2,
  value: number,
): { value: number; feedback: string }[] {
  const f = 10 ** VALUE_DP;
  const key = Math.round(value * f);
  const out: { value: number; feedback: string }[] = [];
  const seen = new Set<number>([key]);
  const push = (raw: number, feedback: string) => {
    const rounded = Math.round(raw * f) / f;
    const k = Math.round(rounded * f);
    if (!Number.isFinite(rounded) || seen.has(k)) return;
    seen.add(k);
    out.push({ value: rounded, feedback });
  };

  const maximin = Math.max(Math.min(m.a, m.b), Math.min(m.c, m.d));
  const minimax = Math.min(Math.max(m.a, m.c), Math.max(m.b, m.d));
  push(
    maximin,
    "You played the safe pure row (maximin). Committing to one row only guarantees the maximin, which is strictly below the game's mixed value, randomising buys the edge.",
  );
  push(
    minimax,
    "That's the pure minimax ceiling, what the opponent could hold you to if they picked one column and you read it. Optimal mixing lands strictly below it, at the value.",
  );
  push(
    (m.a + m.b + m.c + m.d) / 4,
    "You averaged all four cells. The value is NOT the flat matrix average, it comes from the indifference mix, which weights rows/columns unequally.",
  );
  // Naive 50/50 row mix, opponent best-responds to the weaker column.
  const half = Math.min((m.a + m.c) / 2, (m.b + m.d) / 2);
  push(
    half,
    "You mixed 50/50 instead of solving the indifference condition, so the opponent leans on your weaker column and holds you below the value.",
  );
  return out;
}

export interface ValueInstance {
  matrix: ZeroSum2x2;
  value: number;
  numeric: NumericQuestion;
}

export function buildZeroSum2x2Instance(
  rng: Rng,
  difficulty: Difficulty,
): ValueInstance {
  for (let attempt = 0; attempt < 400; attempt++) {
    const a = rng.int(1, 9);
    const b = rng.int(0, 9);
    const c = rng.int(0, 9);
    const d = rng.int(1, 9);
    const m: ZeroSum2x2 = { a, b, c, d };
    // Originality: never emit the source GT8 "Quoting Duel" matrix (4,1,2,4).
    if (a === 4 && b === 1 && c === 2 && d === 4) continue;
    if (saddleValue2x2(m) !== null) continue; // must genuinely require mixing
    const sol = solveMixed2x2(m);
    if (sol.pTop.valueOf() <= 0 || sol.pTop.valueOf() >= 1) continue;
    if (sol.qLeft.valueOf() <= 0 || sol.qLeft.valueOf() >= 1) continue;
    const value = sol.value.valueOf();
    if (value <= 0) continue;
    const errors = zeroSum2x2Errors(m, value);
    if (errors.length < 3) continue;

    const prompt =
      `Two traders play a zero-sum game. You pick a row (Top/Bottom), the opponent a column (Left/Right), ` +
      `simultaneously; the cell is YOUR payoff (theirs is the negative). ` +
      `Top: Left ${a}, Right ${b}. Bottom: Left ${c}, Right ${d}. ` +
      `Both play optimally, randomising if it helps. What is the value of the game? (Round to ${VALUE_DP} decimals.)`;

    const explanation =
      `No pure equilibrium (best responses cycle), so mix. Indifference: play Top with probability ` +
      `p = (d − c)/(a − b − c + d) = ${fracText(sol.pTop)}. The value is ` +
      `V = (a·d − b·c)/(a − b − c + d) = ${fracText(sol.value)} ≈ ${decText(sol.value, VALUE_DP)}. ` +
      `(Opponent's optimal Left-probability q = ${fracText(sol.qLeft)}.) This is von Neumann's minimax value; ` +
      `the safe pure row only guarantees the strictly-smaller maximin.`;

    return {
      matrix: m,
      value,
      numeric: {
        id: `gt-value2-${a}-${b}-${c}-${d}`,
        prompt,
        answer: Number(decText(sol.value, VALUE_DP)),
        decimals: VALUE_DP,
        difficulty,
        concept: "Zero-sum mixed strategy (minimax value)",
        explanation,
        unit: "",
        commonErrors: errors,
        source: "Game Theory · zero-sum 2×2",
      },
    };
  }
  throw new Error("failed to build a 2×2 zero-sum instance");
}

/* ========================================================================== */
/*  FAMILY 6. Zero-sum 3×2 (dominated row + mix) VALUE  (numeric)             */
/* ========================================================================== */

export interface Dominance3x2Instance {
  game: ZeroSum3x2;
  value: number;
  numeric: NumericQuestion;
}

export function buildZeroSum3x2Instance(
  rng: Rng,
  difficulty: Difficulty,
): Dominance3x2Instance {
  for (let attempt = 0; attempt < 500; attempt++) {
    // Build a saddle-free 2×2 core, then insert a strictly dominated middle row.
    const core: ZeroSum2x2 = {
      a: rng.int(3, 9),
      b: rng.int(0, 4),
      c: rng.int(0, 4),
      d: rng.int(3, 9),
    };
    if (saddleValue2x2(core) !== null) continue;
    let sol;
    try {
      sol = solveMixed2x2(core);
    } catch {
      continue;
    }
    if (sol.pTop.valueOf() <= 0 || sol.pTop.valueOf() >= 1) continue;
    if (sol.qLeft.valueOf() <= 0 || sol.qLeft.valueOf() >= 1) continue;
    const value = sol.value.valueOf();
    if (value <= 0) continue;

    // Dominated middle row: strictly below the TOP row in both columns.
    const midL = core.a - rng.int(1, 2);
    const midR = core.b - rng.int(1, 2);
    if (midL < 0 || midR < 0) continue;
    if (!(core.a > midL && core.b > midR)) continue;

    const g: ZeroSum3x2 = {
      rows: [
        [core.a, core.b],
        [midL, midR],
        [core.c, core.d],
      ],
    };
    // Originality: never emit the source GT9 "Redundant Quote" matrix
    // (Top 5,1 · Middle 3,0 · Bottom 0,4).
    if (
      core.a === 5 &&
      core.b === 1 &&
      midL === 3 &&
      midR === 0 &&
      core.c === 0 &&
      core.d === 4
    )
      continue;
    let dom;
    try {
      dom = solveDominance3x2(g);
    } catch {
      continue;
    }
    if (dom.deletedRow !== 1) continue; // we designed the middle row to be the dominated one
    if (Math.abs(dom.value.valueOf() - value) > 1e-9) continue;

    const f = 10 ** VALUE_DP;
    const key = Math.round(value * f);
    const errors: { value: number; feedback: string }[] = [];
    const seen = new Set<number>([key]);
    const push = (raw: number, feedback: string) => {
      const rounded = Math.round(raw * f) / f;
      const k = Math.round(rounded * f);
      if (!Number.isFinite(rounded) || seen.has(k)) return;
      seen.add(k);
      errors.push({ value: rounded, feedback });
    };
    // Kept the dominated row and (wrongly) played it against the optimal opponent mix.
    push(
      dom.deletedRowValue.valueOf(),
      "You kept the dominated Middle row. Against the opponent's optimal mix it pays strictly less than the value, that's exactly why a rational player deletes it first.",
    );
    // Deleted the WRONG row (kept Middle + Bottom instead of Top + Bottom).
    try {
      const wrong: ZeroSum2x2 = {
        a: midL,
        b: midR,
        c: core.c,
        d: core.d,
      };
      if (saddleValue2x2(wrong) === null) {
        push(
          solveMixed2x2(wrong).value.valueOf(),
          "You deleted the wrong row and mixed over Middle + Bottom. Middle is strictly dominated by Top, so it should be removed, mix over Top + Bottom.",
        );
      }
    } catch {
      /* skip if that pair has a saddle */
    }
    // Flat average of all six cells.
    push(
      (core.a + core.b + midL + midR + core.c + core.d) / 6,
      "You averaged the whole 3×2 matrix. The value comes from the reduced 2×2 indifference mix after deleting the dominated row, not a flat average.",
    );
    if (errors.length < 3) continue;

    const prompt =
      `Zero-sum game: you pick Top/Middle/Bottom, the opponent picks Left/Right, simultaneously; each cell is ` +
      `YOUR payoff. Top: Left ${core.a}, Right ${core.b}. Middle: Left ${midL}, Right ${midR}. ` +
      `Bottom: Left ${core.c}, Right ${core.d}. Both play optimally. What is the value of the game? (Round to ${VALUE_DP} decimals.)`;

    const explanation =
      `First prune: Middle is strictly dominated by Top (${core.a} > ${midL} and ${core.b} > ${midR}), so delete it. ` +
      `The surviving 2×2 (Top, Bottom) has no pure equilibrium → mix: p(Top) = ${fracText(sol.pTop)}, ` +
      `value V = (a·d − b·c)/(a − b − c + d) = ${fracText(sol.value)} ≈ ${decText(sol.value, VALUE_DP)}. ` +
      `Check: against the opponent's optimal mix the discarded Middle row would have paid ` +
      `${fracText(dom.deletedRowValue)} ≈ ${decText(dom.deletedRowValue, VALUE_DP)} < ${decText(sol.value, VALUE_DP)}, ` +
      `confirming deleting it cost nothing.`;

    return {
      game: g,
      value,
      numeric: {
        id: `gt-value3-${core.a}-${core.b}-${midL}-${midR}-${core.c}-${core.d}`,
        prompt,
        answer: Number(decText(sol.value, VALUE_DP)),
        decimals: VALUE_DP,
        difficulty,
        concept: "Dominated-row elimination + mixed strategy",
        explanation,
        unit: "",
        commonErrors: errors,
        source: "Game Theory · zero-sum 3×2",
      },
    };
  }
  throw new Error("failed to build a 3×2 zero-sum instance");
}

/* ========================================================================== */
/*  FAMILY 7. Volunteer's Dilemma probability  (numeric)                     */
/* ========================================================================== */

/** Smallest decimal places d (≤ cap) making f·10^d an exact integer. */
function exactDecimals(f: ReturnType<typeof F>, cap = 6): number {
  for (let d = 0; d <= cap; d++) {
    if (Number(f.mul(10 ** d).d) === 1) return d;
  }
  return cap;
}

export interface VolunteerInstance {
  N: number;
  b: number;
  c: number;
  pNobody: number;
  numeric: NumericQuestion;
}

// NOTE: deliberately avoids the source GT11 "Who Calls the Landlord" framing
// (tenants / phone the landlord / boiler) so no user-facing item echoes that
// named scenario.
const VOLUNTEER_SCENARIOS: { actors: string; action: string; good: string }[] =
  [
    { actors: "open-source maintainers", action: "ship the security patch", good: "the vulnerability is closed" },
    { actors: "teammates on a desk", action: "stay late to file the report", good: "the report is filed" },
    { actors: "neighbours", action: "call the council", good: "the pothole is fixed" },
  ];

export function buildVolunteerInstance(
  rng: Rng,
  difficulty: Difficulty,
): VolunteerInstance {
  // Keep the ground truth exact: 1 − p = 1/2, so c/b = (1/2)^(N−1) and
  // P(nobody) = (1/2)^N is a terminating decimal.
  const m = 2;
  const N = rng.pick([3, 4, 5]);
  // Exclude b = 80: the source GT11 uses (N=4, b=80, c=10). All values below
  // yield integer costs for N ∈ {3,4,5} and never reproduce that tuple.
  const b = rng.pick([96, 64, 128]);
  let sol;
  try {
    sol = solveVolunteer({ N, m, b });
  } catch {
    // Fall back to an N=4, b=64 (c=8) item (never the source's b=80).
    sol = solveVolunteer({ N: 4, m: 2, b: 64 });
  }
  const c = sol.c;
  const net = b - c;
  const dp = exactDecimals(sol.pNobody);
  const pNobody = Number(decText(sol.pNobody, dp));
  const sc = rng.pick(VOLUNTEER_SCENARIOS);

  const f = 10 ** dp;
  const key = Math.round(pNobody * f);
  const errors: { value: number; feedback: string }[] = [];
  const seen = new Set<number>([key]);
  const push = (raw: number, feedback: string) => {
    const rounded = Math.round(raw * f) / f;
    const k = Math.round(rounded * f);
    if (!Number.isFinite(rounded) || seen.has(k)) return;
    seen.add(k);
    errors.push({ value: rounded, feedback });
  };
  push(
    sol.ratio.valueOf(),
    `That's (1−p)^(N−1) = c/b, the probability the OTHER ${N - 1} stay silent, the indifference condition itself. P(nobody) raises it to the full exponent N (include yourself).`,
  );
  push(
    sol.p.pow(N).valueOf(),
    "That's P(everyone volunteers) = p^N, the opposite tail. You want P(all N stay silent) = (1−p)^N.",
  );
  push(
    F(1, m).valueOf(),
    "That's 1−p, the per-person probability of staying silent, not the JOINT probability that all N stay silent.",
  );

  const prompt =
    `${N} ${sc.actors} each independently decide whether to ${sc.action}. If anyone does, ${sc.good}, worth ${b} to everyone, ` +
    `but the volunteer pays a cost ${c} (net ${net}); if nobody acts, everyone gets 0. In the symmetric mixed equilibrium ` +
    `where each volunteers with the same probability, what is the probability that NOBODY volunteers? (Round to ${dp} decimals.)`;

  const explanation =
    `Indifference: volunteering pays a sure net ${net}; waiting pays ${b} if at least one of the other ${N - 1} volunteers. ` +
    `Set ${net} = ${b}·(1 − (1−p)^${N - 1}) ⟹ (1−p)^${N - 1} = c/b = ${fracText(sol.ratio)} ⟹ 1−p = ${fracText(F(1, m))}, ` +
    `so p = ${fracText(sol.p)}. P(nobody volunteers) = (1−p)^${N} = ${fracText(sol.pNobody)} ≈ ${decText(sol.pNobody, dp)}. ` +
    `(Counterintuitively, more potential volunteers makes collective failure MORE likely, diffusion of responsibility.)`;

  return {
    N,
    b,
    c,
    pNobody,
    numeric: {
      id: `gt-volunteer-${N}-${b}-${c}`,
      prompt,
      answer: pNobody,
      decimals: dp,
      difficulty,
      concept: "Volunteer's Dilemma (symmetric mixed equilibrium)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Game Theory · Volunteer's Dilemma",
    },
  };
}

/* ========================================================================== */
/*  Named generators (adapters used by the levels + verification tests)        */
/* ========================================================================== */

export const genPd = (rng: Rng): Question =>
  buildPdInstance(rng, "easy").question;
export const genEntry = (rng: Rng): Question =>
  buildEntryInstance(rng, "medium").question;
export const genHotelling = (rng: Rng): Question =>
  buildHotellingInstance(rng, "easy").question;
export const genBeauty = (rng: Rng): Question =>
  buildBeautyInstance(rng, "medium").question;

export const genValue2x2 = (rng: Rng): NumericQuestion =>
  buildZeroSum2x2Instance(rng, "medium").numeric;
export const genValue3x2 = (rng: Rng): NumericQuestion =>
  buildZeroSum3x2Instance(rng, "hard").numeric;
export const genVolunteer = (rng: Rng): NumericQuestion =>
  buildVolunteerInstance(rng, "hard").numeric;

/* ========================================================================== */
/*  FAMILIES 8–10. Reasoning-only (flashcards)                                */
/*  Coordination / stag hunt · non-credible threat · repeated game / folk      */
/* ========================================================================== */

/**
 * The three reasoning-only families have NO single scalar (the dataset flags
 * them as "no single answer"). They become integrity-based flashcards: a
 * freshly-framed scenario, a strong revealed explanation, self-assessment.
 * Where a scalar IS exact (the stag-hunt mixing probability, the folk-theorem
 * discount threshold δ*), the reveal states it precisely so the card is still
 * exact-verified, but there is no forced numeric answer.
 */

export const gameTheoryFlashcards: Flashcard[] = [
  // ---- Coordination / stag hunt ----
  {
    id: "gt-fc-coord-1",
    prompt:
      "Two venture funds independently decide whether to Anchor a new co-investment (commit lead capital) or Pass. If BOTH anchor, the deal closes and each earns 8; a lone anchor is left stranded and earns 0; a fund that Passes keeps a safe 5 either way. You can't communicate. What do you do, and why is there no single forced answer?",
    answer:
      "A stag hunt: two pure Nash equilibria, (Anchor, Anchor)=8 (payoff-dominant) and (Pass, Pass)=5 (risk-dominant), plus a mixed NE where each Anchors with probability m = 5/8. No dominant strategy; the outcome depends on trust / a focal point.",
    explanation:
      "Best-response is to MATCH the rival (Anchor if they Anchor, Pass if they don't), so both matched profiles are equilibria. (Anchor,Anchor) is better for both (8 > 5), payoff dominance, but anchoring alone collapses to 0, while Pass guarantees 5 regardless. Against a coin-flip rival, Anchor averages ½·8+½·0 = 4 < 5, so Pass is RISK-dominant. The mixed NE makes the rival indifferent: 8m = 5 ⟹ m = 5/8. Nothing in the matrix selects among them: a focal point (reputation, convention, a public commitment signal) is what tips players to the good equilibrium. That's why the honest answer is 'it depends on trust,' not a number.",
    difficulty: "medium",
    concept: "Coordination / stag hunt (payoff- vs risk-dominance)",
    source: "Game Theory · coordination (reasoning-only)",
  },
  {
    id: "gt-fc-coord-2",
    prompt:
      "Two tech firms each choose a standard: adopt the New format together and both earn 10, but if only one adopts it while the other keeps the Old format, the lone adopter earns 0 and the laggard earns 7 (Old-Old pays 7 each). Is adopting the New format 'obviously' correct? Explain.",
    answer:
      "No. This is a coordination game with two pure equilibria (New,New)=10 and (Old,Old)=7. New is payoff-dominant, Old is risk-dominant (guarantees 7 vs. a risky 0). The 'right' move depends on beliefs about the other firm, not on dominance.",
    explanation:
      "There is no dominant strategy: your best reply is whatever you expect the rival to do. (New,New) Pareto-dominates (Old,Old), 10 > 7, but adopting New alone yields 0, whereas Old guarantees 7. Measuring risk against a 50/50 rival: New gives ½·10+½·0 = 5 < 7, so Old is risk-dominant. Real coordination is solved by a focal point (an announced industry standard, first-mover signalling, a dominant player's lead). The interviewer wants you to (1) find both equilibria, (2) distinguish payoff- vs risk-dominance, and (3) note that resolution requires information outside the matrix.",
    difficulty: "medium",
    concept: "Coordination / stag hunt (payoff- vs risk-dominance)",
    source: "Game Theory · coordination (reasoning-only)",
  },
  // ---- Non-credible threat / commitment ----
  {
    id: "gt-fc-threat-1",
    prompt:
      "A manager tells a star analyst: 'Ask for a raise and I'll fire you on the spot.' Firing the analyst would cost the desk far more than the raise. The analyst asks anyway. Treat this as a sequential game, is the threat credible, and what would make it credible?",
    answer:
      "The threat is NON-CREDIBLE. By backward induction, once the analyst has asked, firing hurts the manager more than granting the raise, so a rational manager won't fire, the analyst foresees this and asks. Credibility needs a commitment device, reputation, or a punishment that's actually cheap to execute.",
    explanation:
      "Solve from the last move: at the moment of decision, carrying out the threat (firing a valuable analyst) is strictly worse for the manager than backing down (granting the raise). Backward induction strips out threats you'd never want to execute, so the bare words change nothing. To make a threat bite you must alter the game so following through becomes your genuine best response: (1) a commitment device that removes your ability to back down (a public, binding policy); (2) reputation across repeated interactions, where following through once deters everyone later; (3) choosing a punishment that's cheap for YOU to carry out; or (4) emotion/precommitment that guarantees you won't coolly optimise your way out. Naming the non-credibility AND the fixes is the whole answer.",
    difficulty: "medium",
    concept: "Non-credible threat / commitment device",
    source: "Game Theory · sequential commitment (reasoning-only)",
  },
  {
    id: "gt-fc-threat-2",
    prompt:
      "A country announces: 'Any tariff on our goods and we cut off ALL trade', but cutting off all trade would devastate its own economy too. A partner imposes a small tariff. Using backward induction, is the retaliation threat credible, and how could the country make it credible?",
    answer:
      "Non-credible: total cut-off is self-harming, so at the decision node the country won't follow through, and the partner (anticipating this) tariffs anyway. Make it credible via a commitment device (a law auto-triggering retaliation), reputation, or a proportionate response that's genuinely cheap to impose.",
    explanation:
      "At the final decision node, executing 'cut off all trade' costs the threatener more than tolerating a small tariff, so backward induction predicts they won't do it, the grand threat is empty. Fixes are the classic commitment toolkit: pass legislation that AUTOMATICALLY retaliates (burning your bridges so you can't back down), build a reputation for following through across repeated disputes, or pre-commit to a measured, low-cost counter-tariff that you'd actually be willing to levy. The lesson mirrors the parenting 'we'll turn the car around' bluff: a threat works only if carrying it out is in your interest when the time comes.",
    difficulty: "hard",
    concept: "Non-credible threat / commitment device",
    source: "Game Theory · sequential commitment (reasoning-only)",
  },
  // ---- Repeated game / folk theorem ----
  {
    id: "gt-fc-repeated-1",
    prompt:
      "Two airlines fly the same route every season, indefinitely. Each season: both keep fares High (Cooperate) = 9 each; one Discounts while the other holds High = 14 (discounter) / 3; both Discount = 5 each. A profit t seasons out is worth δᵗ. Can they sustain cooperation, and with what strategy?",
    answer:
      "One-shot, Discount dominates → both grind to 5. With indefinite repetition and a grim-trigger strategy, cooperation is sustainable when δ ≥ (T−R)/(T−P) = (14−9)/(14−5) = 5/9 ≈ 0.56. It's an equilibrium, not the ONLY one (folk theorem), perpetual discounting is also an equilibrium.",
    explanation:
      "A single season is a Prisoner's Dilemma (14>9 and 5>3, so Discount dominates; both earn 5). Repetition lets you punish: grim trigger = 'hold High until they Discount, then Discount forever.' One-shot-deviation check: cooperating forever earns R/(1−δ); deviating earns T + δP/(1−δ). Cooperation survives when R/(1−δ) ≥ T + δP/(1−δ) ⟹ δ ≥ (T−R)/(T−P) = (14−9)/(14−5) = 5/9 ≈ 0.56. So if each values next season at least ~56% as much as this one, the high-fare truce holds. Caveats the interviewer wants: (1) the folk theorem, many equilibria exist, so cooperation isn't guaranteed; (2) a KNOWN end date unravels it by backward induction; (3) in a noisy market, forgiving tit-for-tat survives mistakes better than unforgiving grim trigger.",
    difficulty: "hard",
    concept: "Repeated game / folk theorem / grim trigger",
    source: "Game Theory · repeated game (reasoning-only)",
  },
  {
    id: "gt-fc-repeated-2",
    prompt:
      "Two gas stations across the street set prices each day indefinitely. Holding a high price = 20 each; one cuts while the other holds = 26 (cutter) / 8; both cut = 12 each. Future days discounted by δ. When is a high-price truce sustainable, and what breaks it?",
    answer:
      "High prices are sustainable under grim trigger when δ ≥ (T−R)/(T−P) = (26−20)/(26−12) = 6/14 = 3/7 ≈ 0.43. It's one of many equilibria (folk theorem). A fixed, known closing date unravels cooperation via backward induction.",
    explanation:
      "The stage game is a Prisoner's Dilemma: cutting dominates (26>20, 12>8), so one-shot play collapses to (12,12). With indefinite repetition and grim trigger, deviating earns 26 today then 12 forever; cooperating earns 20 forever. Cooperation holds iff 20/(1−δ) ≥ 26 + δ·12/(1−δ) ⟹ δ ≥ (26−20)/(26−12) = 3/7. The more tempting the one-day cut (larger T−R) or the milder the punishment (smaller T−P), the more patient the players must be. Threats to price-war forever are credible here precisely BECAUSE (12,12) is itself an equilibrium. What breaks it: a known final day (backward induction cascades defection back to today), too low a δ, or a player who doesn't value the future.",
    difficulty: "hard",
    concept: "Repeated game / folk theorem / grim trigger",
    source: "Game Theory · repeated game (reasoning-only)",
  },
];
