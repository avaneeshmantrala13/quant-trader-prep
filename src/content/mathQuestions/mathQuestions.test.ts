import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import { gradeNumeric } from "@/lib/numeric";
import { groupLevelsIntoTopics } from "@/lib/topics";
import type { NumericQuestion, Question } from "@/types/content";
import {
  CONVERTED_NUMERIC_GENERATORS,
  NUMERIC_GENERATORS,
  QUIZ_GENERATORS,
} from "./generators";
import { mathQuestionsTrack } from "./levels";
import { solvingUnknownsFlashcards } from "./flashcards";
import {
  boxFromClues,
  choose,
  circleRadius,
  clockAngle,
  countMultiples,
  doublingDayForFraction,
  escalatorSteps,
  fillTime,
  gridRectangles,
  gridSquares,
  knockoutMatches,
  longFishTotal,
  multinomial,
  packedCubes,
  riverLength,
  roundRobinGames,
  solveDiophantine,
  sumOddsInRange,
  sumRange,
  triangular,
  tripleFromPairwise,
  tupleString,
  twoLegDistance,
  volumeTrap,
  type DiophantineVars,
} from "./solvers";

/* ========================================================================== */
/*  0. Topic structure — the 6 levels collapse into 3 contiguous topics that    */
/*     ramp Easy → Hard, mirroring the probabilityStats subcategory contract.    */
/* ========================================================================== */

describe("Applied Math & Number Puzzles groups into 3 Easy→Hard topics", () => {
  it("collapses the 6 levels into exactly 3 section-labeled topics, in order", () => {
    const topics = groupLevelsIntoTopics(mathQuestionsTrack.levels);
    expect(topics.map((t) => t.label)).toEqual([
      "Rates, Algebra & Word Problems",
      "Number Theory & Counting",
      "Geometry & Derivations",
    ]);
    // Ranks are 1..3 in data (difficulty) order.
    expect(topics.map((t) => t.rank)).toEqual([1, 2, 3]);
    // Each topic bundles exactly two contiguous levels (3 × 2).
    expect(topics.map((t) => t.count)).toEqual([2, 2, 2]);
    // Topics partition the track with no gaps/overlaps.
    expect(topics[0].startIndex).toBe(0);
    expect(topics[topics.length - 1].endIndex).toBe(
      mathQuestionsTrack.levels.length - 1,
    );
    topics.slice(1).forEach((t, i) => {
      expect(t.startIndex).toBe(topics[i].endIndex + 1);
    });
  });

  it("keeps every level id (mq-1..mq-6) in the finalized order", () => {
    expect(mathQuestionsTrack.levels.map((l) => l.id)).toEqual([
      "mq-1",
      "mq-3",
      "mq-4",
      "mq-2",
      "mq-5",
      "mq-6",
    ]);
  });

  it("difficulty is non-decreasing overall and within every topic", () => {
    const order = { intro: 0, easy: 1, medium: 2, hard: 3, expert: 4 } as const;
    const seq = mathQuestionsTrack.levels.map((l) => order[l.difficulty]);
    // Overall Easy → Hard ramp with no inversions.
    for (let i = 1; i < seq.length; i++) {
      expect(seq[i]).toBeGreaterThanOrEqual(seq[i - 1]);
    }
    expect(seq[0]).toBe(order.easy);
    expect(seq[seq.length - 1]).toBe(order.hard);
    // And non-decreasing inside each contiguous topic.
    const topics = groupLevelsIntoTopics(mathQuestionsTrack.levels);
    for (const t of topics) {
      for (let i = t.startIndex + 1; i <= t.endIndex; i++) {
        expect(seq[i]).toBeGreaterThanOrEqual(seq[i - 1]);
      }
    }
  });
});

/* ========================================================================== */
/*  1. Hidden fixtures — the solvers reproduce the ORIGINAL dataset answers.    */
/*     TEST-ONLY ground truth; no user-facing item reuses these verbatim.       */
/* ========================================================================== */

describe("solvers reproduce the original Math Questions dataset answers", () => {
  it("MQ7 Cold Storage: floor-then-multiply 343 (NOT the volume trap 421)", () => {
    expect(packedCubes([30, 30, 30], 4)).toBe(343);
    expect(volumeTrap([30, 30, 30], 4)).toBe(421);
  });
  it("MQ29 Rectangles / MQ38 Squares on a chessboard", () => {
    expect(gridRectangles(8)).toBe(1296); // C(9,2)²
    expect(gridSquares(8)).toBe(204); // Σ k²
  });
  it("MQ25 sum of odds 100..200 = 7500; MQ39 sum 11..20 = 155", () => {
    expect(sumOddsInRange(100, 200)).toBe(7500);
    expect(sumRange(11, 20)).toBe(155);
  });
  it("MQ22 Magic 37: multiples of 37 in [37000, 37999] = 28", () => {
    expect(countMultiples(37000, 37999, 37)).toBe(28);
  });
  it("MQ3 Birthday Candles: 36th triangular number = 666", () => {
    expect(triangular(36)).toBe(666);
  });
  it("MQ1 Analog Clock Angle at 3:15 = 7.5°", () => {
    expect(clockAngle(3, 15)).toBe(7.5);
  });
  it("MQ28 Radius of a Circle x²+y²−8x−6y+21=0 ⇒ r = 2", () => {
    expect(circleRadius(-8, -6, 21)).toBe(2);
  });
  it("MQ42 Unfolded Box (9, 17, 24) ⇒ volume 140", () => {
    const b = boxFromClues(9, 17, 24);
    expect(b).toEqual({ w: 2, l: 10, h: 7, volume: 140 });
  });
  it("MQ27 Patch of Lily Pads: full day 38, doubles every 3 ⇒ ¼ on day 32", () => {
    expect(doublingDayForFraction(38, 3, 2)).toBe(32);
  });
  it("MQ11 Filling a Bathtub: 14+9−12 net ⇒ 572 L in 52 min", () => {
    expect(fillTime(14, 9, 12, 572)).toBe(52);
  });
  it("MQ14 Going to the Beach: 4 & 12 mph over 8 h ⇒ 24 mi", () => {
    expect(twoLegDistance(4, 12, 8)).toBe(24);
  });
  it("MQ30 River Length #1: drift 6 h vs boat (own 3) 4 h ⇒ 36 m", () => {
    expect(riverLength(6, 4, 3)).toEqual({ current: 6, length: 36 });
  });
  it("MQ10 Escalator Steps: 20 up / 60 down ⇒ 30 visible", () => {
    expect(escalatorSteps(20, 60)).toBe(30);
  });
  it("MQ13 Games Played 380; MQ18 Tennis Matches 127", () => {
    expect(roundRobinGames(20, 2)).toBe(380);
    expect(knockoutMatches(128)).toBe(127);
  });
  it("SU5 Long Fish: head 8 ⇒ 64", () => {
    expect(longFishTotal(8)).toBe(64);
  });
  it("SU6 Product of Unknowns: pairwise 35,15,21 ⇒ (W,X,Y) = (5,7,3)", () => {
    const t = tripleFromPairwise(35, 15, 21);
    expect(t.w).toBe(5);
    expect(t.x).toBe(7);
    expect(t.y).toBe(3);
    expect(t.product).toBe(105);
  });
});

/* ========================================================================== */
/*  1b. Independent brute-force cross-checks (a DIFFERENT derivation route).    */
/* ========================================================================== */

describe("solvers agree with an independent brute-force derivation", () => {
  it("grid squares Σk² matches a naive nested count", () => {
    for (const n of [4, 6, 8, 10]) {
      let brute = 0;
      for (let k = 1; k <= n; k++) brute += (n - k + 1) * (n - k + 1);
      expect(gridSquares(n)).toBe(brute);
    }
  });
  it("grid rectangles matches enumerating pairs of grid lines", () => {
    for (const n of [3, 4, 6]) {
      let brute = 0;
      for (let x1 = 0; x1 <= n; x1++)
        for (let x2 = x1 + 1; x2 <= n; x2++)
          for (let y1 = 0; y1 <= n; y1++)
            for (let y2 = y1 + 1; y2 <= n; y2++) brute++;
      expect(gridRectangles(n)).toBe(brute);
    }
  });
  it("countMultiples matches a direct scan", () => {
    for (const [lo, hi, d] of [
      [10, 100, 7],
      [201, 899, 13],
      [1, 50, 6],
    ] as const) {
      let brute = 0;
      for (let x = lo; x <= hi; x++) if (x % d === 0) brute++;
      expect(countMultiples(lo, hi, d)).toBe(brute);
    }
  });
  it("sumOddsInRange matches a direct scan", () => {
    for (const [a, b] of [
      [100, 200],
      [21, 60],
      [50, 130],
    ] as const) {
      let brute = 0;
      for (let x = a; x <= b; x++) if (x % 2 !== 0) brute += x;
      expect(sumOddsInRange(a, b)).toBe(brute);
    }
  });
  it("multiset arrangements = n!/∏(mult!) matches a merged-binomial route", () => {
    // n!/(2!2!1..) equals choosing positions for each repeated group in turn.
    const counts = [2, 2, 1, 1, 1];
    const n = counts.reduce((a, b) => a + b, 0);
    let nested = 1;
    let remaining = n;
    for (const c of counts) {
      nested *= choose(remaining, c);
      remaining -= c;
    }
    expect(multinomial(counts)).toBe(nested);
  });
});

/* ========================================================================== */
/*  2. Generators — determinism, grading round-trips, distractor quality.       */
/* ========================================================================== */

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 137 + 3);

describe("numeric generators: grade, clean commonErrors, determinism", () => {
  for (const [name, gen] of Object.entries(NUMERIC_GENERATORS)) {
    it(`${name} — answer grades; commonErrors finite, distinct, feedback-firing`, () => {
      for (const seed of SEEDS) {
        const q: NumericQuestion = gen(new Rng(seed));
        const dp = q.decimals ?? 0;
        const f = 10 ** dp;
        expect(Number.isFinite(q.answer)).toBe(true);
        if (q.decimals == null) {
          expect(Number.isInteger(q.answer)).toBe(true);
          expect(q.answer).toBeGreaterThan(0);
        } else {
          expect(q.answer).toBeGreaterThan(0);
        }
        // grading round-trips at the level's precision
        const typed = dp === 0 ? String(q.answer) : q.answer.toFixed(dp);
        expect(gradeNumeric(q, typed).correct).toBe(true);
        // determinism
        const q2 = gen(new Rng(seed));
        expect(q2.answer).toBe(q.answer);
        expect(q2.id).toBe(q.id);
        // every commonError: finite, ≠ answer at dp, fires targeted feedback
        for (const ce of q.commonErrors ?? []) {
          expect(Number.isFinite(ce.value)).toBe(true);
          expect(ce.value).toBeGreaterThanOrEqual(0);
          expect(Math.round(ce.value * f)).not.toBe(Math.round(q.answer * f));
          const g = gradeNumeric(q, dp === 0 ? String(ce.value) : ce.value.toFixed(dp));
          expect(g.correct).toBe(false);
          expect(g.matchedError?.feedback).toBeTruthy();
        }
        const keys = (q.commonErrors ?? []).map((e) => Math.round(e.value * f));
        expect(new Set(keys).size).toBe(keys.length); // mutually distinct
        expect(q.explanation.trim().length).toBeGreaterThan(40);
      }
    });
  }
});

describe("converted (mq-2/mq-4) free-response families carry tagged error modes", () => {
  for (const [name, gen] of Object.entries(CONVERTED_NUMERIC_GENERATORS)) {
    it(`${name} — every commonError has a snake_case misconception tag; answer whole`, () => {
      const tagsSeen = new Set<string>();
      for (const seed of SEEDS) {
        const q: NumericQuestion = gen(new Rng(seed));
        // The conversion is only eligible for clean whole-number answers.
        expect(q.decimals ?? 0).toBe(0);
        expect(Number.isInteger(q.answer)).toBe(true);
        expect(q.answer).toBeGreaterThan(0);
        // Free-response prompt + at least one authored error mode.
        expect(q.prompt).toContain("Enter a whole number");
        expect((q.commonErrors ?? []).length).toBeGreaterThanOrEqual(1);
        for (const ce of q.commonErrors ?? []) {
          expect(ce.misconception, `${name} error mode ${ce.value} untagged`).toBeTruthy();
          expect(ce.misconception).toMatch(/^[a-z][a-z0-9_]*$/);
          expect(ce.feedback.trim().length).toBeGreaterThan(20);
          // Rung-1 coaching must NEVER hand over the answer outright (i.e. no
          // "= <answer>" style reveal — incidental digit overlaps are fine).
          expect(ce.feedback).not.toContain(`= ${q.answer}`);
          expect(ce.feedback).not.toContain(`is ${q.answer}`);
          // Ends with a leading question rather than a stated result.
          expect(ce.feedback.trim().endsWith("?")).toBe(true);
          tagsSeen.add(ce.misconception!);
        }
      }
      expect(tagsSeen.size).toBeGreaterThanOrEqual(1);
    });
  }
});

describe("quiz generators: valid index, distinct + aligned choices", () => {
  for (const [name, gen] of Object.entries(QUIZ_GENERATORS)) {
    it(`${name} — options clean, rationale aligned, deterministic`, () => {
      for (const seed of SEEDS) {
        const q: Question = gen(new Rng(seed));
        expect(q.choices.length).toBeGreaterThanOrEqual(2);
        expect(new Set(q.choices).size).toBe(q.choices.length); // no dup options
        expect(q.correctIndex).toBeGreaterThanOrEqual(0);
        expect(q.correctIndex).toBeLessThan(q.choices.length);
        expect(q.choices[q.correctIndex]).toBeTruthy();
        expect(q.distractorRationale?.length).toBe(q.choices.length);
        expect(q.explanation.trim().length).toBeGreaterThan(40);
        // determinism
        const q2 = gen(new Rng(seed));
        expect(q2.choices).toEqual(q.choices);
        expect(q2.correctIndex).toBe(q.correctIndex);
      }
    });
  }
});

/* ========================================================================== */
/*  3. Diophantine flashcards — the NEW puzzles are UNIQUE and correct.          */
/* ========================================================================== */

describe("Solving-Unknowns Diophantine puzzles have unique, correct tuples", () => {
  const cases: { id: string; constraints: (v: DiophantineVars) => boolean; answer: string }[] = [
    {
      id: "mq-su-diophantine-1",
      constraints: ({ A, B, C, D, E }) =>
        A + E === C && B === D + E && A === 2 * D && E > A,
      answer: "A2 B4 C5 D1 E3",
    },
    {
      id: "mq-su-diophantine-2",
      constraints: ({ A, B, C, D, E }) =>
        B === A + C && A + E === D && B === 5 * E,
      answer: "A3 B5 C2 D4 E1",
    },
    {
      id: "mq-su-diophantine-3",
      constraints: ({ A, B, C, D, E }) =>
        A === 2 * B && E === A + C && D === B + C && A > D,
      answer: "A4 B2 C1 D3 E5",
    },
  ];

  for (const c of cases) {
    it(`${c.id} — exactly one solution = ${c.answer}`, () => {
      const sols = solveDiophantine(c.constraints);
      expect(sols.length).toBe(1);
      expect(tupleString(sols[0])).toBe(c.answer);
      // The revealed flashcard answer names that exact tuple.
      const fc = solvingUnknownsFlashcards.find((f) => f.id === c.id)!;
      const nums = c.answer.match(/\d/g)!.join("");
      const inCard = (fc.answer.match(/=\s*(\d)/g) ?? []).map((s) => s.replace(/\D/g, "")).join("");
      expect(inCard).toBe(nums);
    });
  }
});

/* ========================================================================== */
/*  4. Derivation flashcards — the revealed numbers are verifier-checked.        */
/* ========================================================================== */

describe("derivation flashcards reveal verifier-checked numbers", () => {
  it("Boats on a River: width = 3a − b = 3·700 − 300 = 1800 m", () => {
    const a = 700;
    const b = 300;
    expect(3 * a - b).toBe(1800);
    const fc = solvingUnknownsFlashcards.find((f) => f.id === "mq-su-boats-river")!;
    expect(fc.answer).toContain("1800");
  });
  it("Sheep optimum: x=18, field 30 m, total time 8 s (Snell x/√(a²+x²)=vf/vr)", () => {
    const a = 24;
    const vr = 10;
    const vf = 6;
    const L = 48;
    // Snell/refraction optimum: x/√(a²+x²) = vf/vr.
    const x = 18;
    expect(Math.abs(x / Math.sqrt(a * a + x * x) - vf / vr)).toBeLessThan(1e-9);
    const field = Math.sqrt(a * a + x * x);
    expect(field).toBe(30);
    expect((L - x) / vr + field / vf).toBe(8);
    const fc = solvingUnknownsFlashcards.find((f) => f.id === "mq-su-sheep-optimum")!;
    expect(fc.answer).toContain("8 seconds");
  });
  it("System of Weights: 4 orbs = 24 g ⇒ orb 6 g ⇒ pyramid = 2·6 = 12 g", () => {
    const orb = 24 / 4;
    expect(2 * orb).toBe(12);
    const fc = solvingUnknownsFlashcards.find((f) => f.id === "mq-su-weights")!;
    expect(fc.answer).toContain("12");
  });
  it("Sharing a Glass: alternating halving totals 2/3 and 1/3", () => {
    let a = 0;
    let b = 0;
    let rem = 1;
    for (let i = 0; i < 60; i++) {
      const sip = rem / 2;
      if (i % 2 === 0) a += sip;
      else b += sip;
      rem -= sip;
    }
    expect(Math.abs(a - 2 / 3)).toBeLessThan(1e-9);
    expect(Math.abs(b - 1 / 3)).toBeLessThan(1e-9);
  });
});

/* ========================================================================== */
/*  5. No original dataset title/wording leaks into generated content.          */
/* ========================================================================== */

const FINGERPRINTS = [
  "Cold Storage", "Rectangles On Chessboard", "Squares On Chessboard",
  "Interview Permutations", "Choosing Blocks", "Games Played",
  "Tennis Matches", "Odd Numbers", "Summing 11 to 20", "Magic 37",
  "Patch of Lily Pads", "Analog Clock Angle", "Painting Walls",
  "Unfolded Box", "Radius of a Circle", "Filling a Bathtub",
  "Going to the Beach", "River Length", "Escalator Steps",
  "Birthday Candles", "How Many Spiders", "Number of Pigs",
  "Tic Tac Toe", "Long Fish", "Product of Unknowns", "Sharing a Glass",
  "Boats on a River", "Sheep Runs Home", "System of Weights",
];

describe("no source-dataset title/wording leaks into generated prompts", () => {
  it("generated prompts never contain a verbatim dataset fingerprint", () => {
    const gens = [
      ...Object.values(NUMERIC_GENERATORS),
      ...Object.values(QUIZ_GENERATORS),
    ] as ((rng: Rng) => { prompt: string })[];
    for (const seed of SEEDS) {
      for (const gen of gens) {
        const q = gen(new Rng(seed));
        for (const fp of FINGERPRINTS) expect(q.prompt).not.toContain(fp);
      }
    }
  });
});

/* ========================================================================== */
/*  6. Flashcards well-formed (unique ids, substantive text).                   */
/* ========================================================================== */

describe("Solving-Unknowns flashcards are well-formed", () => {
  it("unique ids, non-empty prompts/answers, substantive explanations", () => {
    const ids = new Set(solvingUnknownsFlashcards.map((c) => c.id));
    expect(ids.size).toBe(solvingUnknownsFlashcards.length);
    for (const c of solvingUnknownsFlashcards) {
      expect(c.prompt.trim().length).toBeGreaterThan(5);
      expect(c.answer.trim().length).toBeGreaterThan(0);
      expect(c.explanation.trim().length).toBeGreaterThan(40);
    }
  });
  it("includes the two-part Sharing-a-Glass split (2/3 and 1/3)", () => {
    const fc = solvingUnknownsFlashcards.find((c) => c.id === "mq-su-sharing-glass")!;
    expect(fc.answer).toContain("2/3");
    expect(fc.answer).toContain("1/3");
  });
});
