/**
 * ============================================================================
 *  SHAPE SHIFT — mental-rotation / spatial pattern mini-game (pure engine)
 * ============================================================================
 * Mimics the Optiver "Shape Shift" Zap-N mini-game: a spatial-reasoning drill.
 * A small asymmetric shape is shown; you pick, from five options, the shape
 * after a stated transform (rotate 90° CW/CCW, rotate 180°, mirror, or a
 * compose). Distractors are the shape's OTHER orientations, so only true mental
 * rotation — not elimination — wins.
 *
 * Shapes are asymmetric pentominoes whose dihedral orbit has 8 distinct
 * orientations, guaranteeing a unique correct answer and four genuine traps.
 * Pure, deterministic, seedable; brand-new module.
 */
import { Rng } from "@/lib/rng";

/* ========================================================================== */
/*  Cells + transforms                                                         */
/* ========================================================================== */

export interface Cell {
  r: number;
  c: number;
}

/** A shape ready to render: normalized cells + its bounding-box dimensions. */
export interface Shape {
  cells: Cell[];
  rows: number;
  cols: number;
}

/** Asymmetric pentominoes (orbit size 8) — every orientation is distinct. */
const BASE_SHAPES: Cell[][] = [
  // F-pentomino
  [
    { r: 0, c: 1 }, { r: 0, c: 2 }, { r: 1, c: 0 }, { r: 1, c: 1 }, { r: 2, c: 1 },
  ],
  // L-pentomino
  [
    { r: 0, c: 0 }, { r: 1, c: 0 }, { r: 2, c: 0 }, { r: 3, c: 0 }, { r: 3, c: 1 },
  ],
  // N-pentomino
  [
    { r: 0, c: 1 }, { r: 1, c: 1 }, { r: 2, c: 0 }, { r: 2, c: 1 }, { r: 3, c: 0 },
  ],
  // Y-pentomino
  [
    { r: 0, c: 1 }, { r: 1, c: 0 }, { r: 1, c: 1 }, { r: 2, c: 1 }, { r: 3, c: 1 },
  ],
  // P-pentomino
  [
    { r: 0, c: 0 }, { r: 0, c: 1 }, { r: 1, c: 0 }, { r: 1, c: 1 }, { r: 2, c: 0 },
  ],
];

/** Translate cells so the min row/col is 0, and return a sorted, keyed Shape. */
export function normalize(cells: Cell[]): Shape {
  const minR = Math.min(...cells.map((c) => c.r));
  const minC = Math.min(...cells.map((c) => c.c));
  const shifted = cells.map((c) => ({ r: c.r - minR, c: c.c - minC }));
  shifted.sort((a, b) => a.r - b.r || a.c - b.c);
  const rows = Math.max(...shifted.map((c) => c.r)) + 1;
  const cols = Math.max(...shifted.map((c) => c.c)) + 1;
  return { cells: shifted, rows, cols };
}

/** A stable string key for a shape's normalized cell set. */
export function shapeKey(shape: Shape): string {
  return shape.cells.map((c) => `${c.r},${c.c}`).join("|");
}

export function rotateCW(cells: Cell[]): Cell[] {
  // (r, c) -> (c, -r), normalized afterwards by callers.
  return cells.map((p) => ({ r: p.c, c: -p.r }));
}

export function rotate180(cells: Cell[]): Cell[] {
  return cells.map((p) => ({ r: -p.r, c: -p.c }));
}

export function rotateCCW(cells: Cell[]): Cell[] {
  return cells.map((p) => ({ r: -p.c, c: p.r }));
}

/** Mirror left↔right (reflect across the vertical axis). */
export function mirrorH(cells: Cell[]): Cell[] {
  return cells.map((p) => ({ r: p.r, c: -p.c }));
}

export type Transform =
  | "rotate-cw"
  | "rotate-ccw"
  | "rotate-180"
  | "mirror"
  | "mirror-then-cw";

export const TRANSFORM_LABEL: Record<Transform, string> = {
  "rotate-cw": "Rotate 90° clockwise",
  "rotate-ccw": "Rotate 90° counter-clockwise",
  "rotate-180": "Rotate 180°",
  mirror: "Mirror left ↔ right",
  "mirror-then-cw": "Mirror, then rotate 90° clockwise",
};

/** Apply a transform to a shape's cells and return the normalized result. */
export function applyTransform(shape: Shape, t: Transform): Shape {
  const cells = shape.cells;
  switch (t) {
    case "rotate-cw":
      return normalize(rotateCW(cells));
    case "rotate-ccw":
      return normalize(rotateCCW(cells));
    case "rotate-180":
      return normalize(rotate180(cells));
    case "mirror":
      return normalize(mirrorH(cells));
    case "mirror-then-cw":
      return normalize(rotateCW(mirrorH(cells)));
  }
}

/** All 8 dihedral orientations of a shape, de-duplicated by key. */
export function orbit(shape: Shape): Shape[] {
  const seen = new Map<string, Shape>();
  const base = shape.cells;
  const variants = [
    base,
    rotateCW(base),
    rotate180(base),
    rotateCCW(base),
    mirrorH(base),
    rotateCW(mirrorH(base)),
    rotate180(mirrorH(base)),
    rotateCCW(mirrorH(base)),
  ].map(normalize);
  for (const v of variants) {
    const k = shapeKey(v);
    if (!seen.has(k)) seen.set(k, v);
  }
  return [...seen.values()];
}

/* ========================================================================== */
/*  Items                                                                       */
/* ========================================================================== */

export interface ShapeShiftItem {
  id: number;
  /** The shape the solver is shown. */
  base: Shape;
  transform: Transform;
  transformLabel: string;
  /** Five candidate shapes (shuffled); one equals the true transform. */
  options: Shape[];
  correctIndex: number;
  tier: 1 | 2 | 3;
}

const TIER_TRANSFORMS: Record<1 | 2 | 3, Transform[]> = {
  1: ["rotate-180", "mirror"],
  2: ["rotate-cw", "rotate-ccw"],
  3: ["rotate-cw", "rotate-ccw", "mirror-then-cw"],
};

export function ssTierForIndex(idx: number, count: number): 1 | 2 | 3 {
  const frac = idx / Math.max(1, count - 1);
  if (frac < 0.34) return 1;
  if (frac < 0.68) return 2;
  return 3;
}

/**
 * Build one item: pick a base shape + a random display orientation, choose a
 * tier-appropriate transform, and assemble five distinct options (the true
 * result + four other orientations from the orbit). Deterministic given rng.
 */
export function buildShapeShiftItem(
  rng: Rng,
  id: number,
  tier: 1 | 2 | 3,
): ShapeShiftItem {
  const raw = rng.pick(BASE_SHAPES);
  // Randomize the shown orientation so the same base looks fresh each time.
  const shownVariants = orbit(normalize(raw));
  const base = rng.pick(shownVariants);

  const transform = rng.pick(TIER_TRANSFORMS[tier]);
  const correct = applyTransform(base, transform);
  const correctKey = shapeKey(correct);

  // Distractors: other distinct orientations of the base (never the answer).
  const pool = orbit(base).filter((s) => shapeKey(s) !== correctKey);
  const distractors = rng.shuffle(pool).slice(0, 4);
  const optionShapes = rng.shuffle([correct, ...distractors]);
  const correctIndex = optionShapes.findIndex(
    (s) => shapeKey(s) === correctKey,
  );

  return {
    id,
    base,
    transform,
    transformLabel: TRANSFORM_LABEL[transform],
    options: optionShapes,
    correctIndex,
    tier,
  };
}

export const DEFAULT_SHAPESHIFT_COUNT = 15;
/** ~2 minutes of rapid spatial rounds. */
export const DEFAULT_SHAPESHIFT_BUDGET_MS = 120 * 1000;

export function buildShapeShiftPaper(
  seed: number,
  count: number = DEFAULT_SHAPESHIFT_COUNT,
): ShapeShiftItem[] {
  const rng = new Rng(seed);
  const out: ShapeShiftItem[] = [];
  for (let i = 0; i < count; i++) {
    out.push(buildShapeShiftItem(rng, i, ssTierForIndex(i, count)));
  }
  return out;
}

/* ========================================================================== */
/*  Session                                                                    */
/* ========================================================================== */

export interface ShapeShiftSession {
  seed: number;
  count: number;
  deadlineTs: number;
  index: number;
  answers: (number | null)[];
  status: "running" | "finished";
}

export function createShapeShiftSession(opts: {
  seed: number;
  nowTs: number;
  count?: number;
  budgetMs?: number;
}): ShapeShiftSession {
  const count = opts.count ?? DEFAULT_SHAPESHIFT_COUNT;
  return {
    seed: opts.seed,
    count,
    deadlineTs: opts.nowTs + (opts.budgetMs ?? DEFAULT_SHAPESHIFT_BUDGET_MS),
    index: 0,
    answers: Array.from({ length: count }, () => null),
    status: "running",
  };
}

export function answerShapeShift(
  s: ShapeShiftSession,
  choiceIndex: number,
): ShapeShiftSession {
  if (s.status !== "running") return s;
  const answers = s.answers.slice();
  answers[s.index] = choiceIndex;
  return { ...s, answers };
}

export function advanceShapeShift(
  s: ShapeShiftSession,
  nowTs: number,
): ShapeShiftSession {
  if (s.status !== "running") return s;
  const next = s.index + 1;
  if (next >= s.count || nowTs >= s.deadlineTs) {
    return { ...s, status: "finished" };
  }
  return { ...s, index: next };
}

export function isShapeShiftExpired(
  s: ShapeShiftSession,
  nowTs: number,
): boolean {
  return nowTs >= s.deadlineTs;
}

export function remainingMs(s: ShapeShiftSession, nowTs: number): number {
  return Math.max(0, s.deadlineTs - nowTs);
}

/* ========================================================================== */
/*  Scoring                                                                    */
/* ========================================================================== */

export interface ShapeShiftSummary {
  total: number;
  answered: number;
  correct: number;
  score: number;
  maxScore: number;
  accuracyPct: number;
}

export function summarizeShapeShift(
  s: ShapeShiftSession,
  items: ShapeShiftItem[] = buildShapeShiftPaper(s.seed, s.count),
): ShapeShiftSummary {
  let correct = 0;
  let answered = 0;
  let score = 0;
  let maxScore = 0;
  items.forEach((it, i) => {
    maxScore += it.tier;
    const a = s.answers[i];
    if (a == null) return;
    answered += 1;
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
