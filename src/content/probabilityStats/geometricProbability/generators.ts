import type { Rng } from "@/lib/rng";
import type { Difficulty, NumericQuestion, Question } from "@/types/content";
import {
  F,
  decText,
  diskInnerProb,
  diskOuterProb,
  fracText,
  glanceCatchProb,
  meetingProb,
  tileFitProb,
} from "../coreSolvers";
import { type Choice, assembleChoices, numDp, numericErrors } from "../coreScaffold";

/**
 * Parametric generators for the Probability & Statistics → **Geometric
 * Probability** subcategory: area / length-ratio reasoning (re-homed from the
 * former "General" set). Every correct value is produced ONLY by the exact
 * solvers in `../coreSolvers`; every distractor is a re-derived, NAMED
 * misconception guaranteed ≠ the answer and distinct.
 *
 * Modes:
 *   • quiz    — genGeoArea (the r-vs-r² area trap)
 *   • numeric — genTileFit, genMeeting, genGlance
 */

/* ========================================================================== */
/* ===============  1 — AREA-vs-LINEAR DISK TRAP (quiz)  =================== */
/* ========================================================================== */

const DISK_THEME = [
  { noun: "a sensor ping", surface: "a circular radar screen" },
  { noun: "a raindrop", surface: "a round drum head" },
  { noun: "a stray photon", surface: "a circular detector plate" },
];

/**
 * A point lands uniformly on a radius-`R` disk. P(within radius r) = r²/R²
 * (inner) or P(farther than r) = 1 − r²/R² (outer). The headline trap is
 * LINEAR-vs-QUADRATIC: distance is NOT uniform — P(ρ ≤ x) grows like x² (area),
 * not x, because outer rings hold more area.
 */
export function buildGeoAreaInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: string; question: Question } {
  const th = rng.pick(DISK_THEME);
  const R = rng.pick([4, 5, 6, 8, 10]);
  const r = rng.int(2, R - 1);
  const outer = rng.chance(0.5);

  const inner = diskInnerProb(r, R); // r²/R²
  const outerP = diskOuterProb(r, R); // 1 − r²/R²
  const value = outer ? outerP : inner;

  const linear = outer ? F(R - r, R) : F(r, R); // 1 − r/R  or  r/R
  const complement = outer ? inner : outerP;
  const dimSlip = F(r * r, R); // r²/R

  const event = outer
    ? `lands FARTHER than ${r} units from the centre`
    : `lands WITHIN ${r} units of the centre`;

  const correct: Choice = {
    text: fracText(value),
    rationale: `Correct — P(ρ ≤ x) = x²/R² scales with AREA, so P(${event.includes("WITHIN") ? "within" : "farther"}) = ${fracText(value)}.`,
  };
  const distractors: Choice[] = [
    {
      text: fracText(linear),
      rationale: `The linear-vs-quadratic mistake: distance is NOT uniform. P(ρ ≤ x) = x²/R² grows like the AREA (x²), not linearly, because outer rings hold more area. Using ${outer ? "1 − r/R" : "r/R"} treats radius as uniform.`,
    },
    {
      text: fracText(complement),
      rationale: `That's the complement — you answered the OPPOSITE event (P = ${fracText(complement)}).`,
    },
    {
      text: fracText(dimSlip),
      rationale: `Dimensional slip: you squared the radius in the numerator (r²) but left the denominator linear (R), giving r²/R. Both must be squared: r²/R².`,
    },
  ];

  const prompt =
    `${th.noun.charAt(0).toUpperCase() + th.noun.slice(1)} strikes a uniformly-random spot on ${th.surface} of radius ${R}. ` +
    `What is the probability it ${event}?`;
  const explanation =
    `For a uniform point on a radius-${R} disk, P(distance ≤ x) = x²/R² — the AREA ratio, quadratic in x. ` +
    `Here the answer is ${fracText(value)}. The seductive ${fracText(linear)} comes from treating distance as uniform (linear r/R); it ignores that a thin ring at radius x has area ∝ x, so probability accumulates like x².`;

  return {
    answer: fracText(value),
    question: {
      id: `gen-geoarea-${outer ? "out" : "in"}-${R}-${r}`,
      prompt,
      explanation,
      difficulty,
      concept: "Geometric probability (area ratio r²/R², not r/R)",
      source: "Geometric Probability · area ratio",
      ...assembleChoices(rng, correct, distractors),
    },
  };
}

/* ========================================================================== */
/* ====================  2 — TILE FIT (numeric)  =========================== */
/* ========================================================================== */

/**
 * P(a disk of radius `rad`, dropped with centre uniform on one `tile`×`tile`
 * cell, lands entirely inside that cell) = ((tile − 2·rad)/tile)². The centre
 * must stay ≥ rad from ALL FOUR edges, so the admissible square shrinks by
 * 2·rad on the side and the probability is an AREA (squared) ratio.
 */
export function buildTileFitInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const tile = rng.pick([5, 6, 8, 10]);
  const rad = rng.pick([1, 2].filter((x) => tile - 2 * x >= 1));
  const value = tileFitProb(tile, rad);
  const dp = numDp(value);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    F((tile - rad) * (tile - rad), tile * tile),
    `You shrank the cell by only ONE radius. The centre must stay ≥ ${rad} from ALL FOUR edges, so each side loses 2·${rad}, not ${rad}.`,
  );
  push(
    F(tile - 2 * rad, tile),
    `That's a 1-D length ratio. The centre roams a 2-D square, so square the shrunken side: ((${tile}−2·${rad})/${tile})².`,
  );
  push(
    F(1).sub(value),
    `That's the complement — the probability the disk DOES poke across a cell boundary.`,
  );

  const prompt =
    `A round sticker of radius ${rad} is pressed down with its centre landing uniformly at random inside one ${tile}×${tile} floor cell. ` +
    `What is the probability the sticker lies entirely within that single cell? (Round to ${dp} decimals.)`;
  const explanation =
    `The centre must sit ≥ ${rad} from every edge, confining it to a (${tile}−2·${rad})×(${tile}−2·${rad}) = ${tile - 2 * rad}×${tile - 2 * rad} square. ` +
    `The probability is the AREA ratio ((${tile}−2·${rad})/${tile})² = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `gen-tilefit-${tile}-${rad}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Geometric probability (fit-inside-cell area ratio)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Geometric Probability · area ratio",
    },
  };
}

/* ========================================================================== */
/* ===================  3 — OVERLAP WINDOW (numeric)  ====================== */
/* ========================================================================== */

const OVERLAP_THEME = [
  { a: "Two colleagues", place: "the espresso counter" },
  { a: "Two traders", place: "the trading desk" },
  { a: "Two hikers", place: "the trailhead" },
];

/**
 * Two people arrive independently and uniformly in [0, `T`] minutes; each waits
 * `w` minutes. P(they overlap) = (T² − (T−w)²)/T². The favourable band
 * |x − y| ≤ w is the T×T square minus two corner triangles of legs (T−w).
 */
export function buildMeetingInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(OVERLAP_THEME);
  const T = rng.pick([30, 45, 60, 90]);
  const w = rng.pick([5, 10, 15].filter((x) => x < T));
  const value = meetingProb(T, w);
  const dp = numDp(value);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    F(w, T),
    `A linear guess. The favourable set is an AREA — the band |x−y| ≤ ${w} inside the ${T}×${T} square — not a single length ratio ${w}/${T}.`,
  );
  push(
    F((T - w) * (T - w), T * T),
    `That's P(they MISS): the two corner triangles of legs (${T}−${w}). Take the complement.`,
  );
  push(
    F(2 * w, T),
    `Double-counts the window and still treats the problem as 1-D. The overlap lives in the 2-D arrival square.`,
  );

  const prompt =
    `${th.a} each show up at ${th.place} at a uniformly-random time within a ${T}-minute window, independently, and each lingers exactly ${w} minutes before leaving. ` +
    `What is the probability their visits overlap? (Round to ${dp} decimals.)`;
  const explanation =
    `Plot the two arrival times in a ${T}×${T} square. They overlap when |x−y| ≤ ${w}; the complement is two right triangles of legs (${T}−${w}). ` +
    `So P = (${T}² − (${T}−${w})²)/${T}² = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `gen-overlap-${T}-${w}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Geometric probability (overlap-window area)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Geometric Probability · overlap area",
    },
  };
}

/* ========================================================================== */
/* ====================  4 — GLANCE CATCH (numeric)  ======================= */
/* ========================================================================== */

const GLANCE_THEME = [
  { obj: "a rotating beacon", inst: "colour-change flashes" },
  { obj: "a status lamp", inst: "state switches" },
  { obj: "a harbour light", inst: "colour flips" },
];

/**
 * A cycle of period `P` seconds has `changes` instantaneous events; a glance of
 * length `g` starts uniformly in the period. With the `g`-length pre-windows
 * disjoint (changes·g ≤ P), P(the glance catches at least one event) =
 * changes·g / P.
 */
export function buildGlanceInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(GLANCE_THEME);
  const changes = rng.pick([2, 3]);
  const g = rng.pick([3, 4, 5]);
  const P = rng.pick([60, 80, 100].filter((p) => changes * g <= p));
  const value = glanceCatchProb(changes, g, P);
  const dp = numDp(value);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    F(g, P),
    `That's the catch-window for ONE event. There are ${changes} disjoint events in the period, so the favourable length is ${changes}·${g}.`,
  );
  push(
    F(changes, P),
    `You dropped the glance length ${g}. The favourable length is ${changes}·${g}, not ${changes}.`,
  );
  push(
    F(changes * g, P - g),
    `Wrong denominator: the glance's START time is uniform over the full period ${P}, not ${P}−${g}.`,
  );

  const prompt =
    `${th.obj.charAt(0).toUpperCase() + th.obj.slice(1)} runs on a ${P}-second cycle during which it produces ${changes} evenly-spaced ${th.inst}, each instantaneous. ` +
    `You look at it for a single ${g}-second glance beginning at a uniformly-random moment in the cycle. ` +
    `What is the probability your glance catches at least one ${th.inst.slice(0, -2)}? (Round to ${dp} decimals.)`;
  const explanation =
    `Your glance catches an event iff it starts within the ${g} seconds BEFORE that event. Those ${changes} pre-windows (each length ${g}) are disjoint, covering ${changes}·${g} = ${changes * g} favourable seconds out of ${P}. ` +
    `So P = ${changes}·${g}/${P} = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `gen-glance-${changes}-${g}-${P}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Geometric probability (uniform glance catch)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Geometric Probability · length ratio",
    },
  };
}

/* ========================================================================== */
/*  Named generators (adapters)                                                */
/* ========================================================================== */

export const genGeoArea = (rng: Rng): Question => buildGeoAreaInstance(rng, "easy").question;
export const genTileFit = (rng: Rng): NumericQuestion => buildTileFitInstance(rng, "medium").numeric;
export const genMeeting = (rng: Rng): NumericQuestion => buildMeetingInstance(rng, "medium").numeric;
export const genGlance = (rng: Rng): NumericQuestion => buildGlanceInstance(rng, "medium").numeric;
