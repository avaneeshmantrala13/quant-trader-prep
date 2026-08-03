/**
 * arena/weakSpot.ts — PURE weak-spot detection + seeded over-sampling for the
 * Speed Arena's "Weak-Spot Trainer" mode (Case B mental-math focus).
 *
 * The idea: a learner's arithmetic errors are rarely uniform. Someone can be
 * fast and accurate on small-operand addition yet reliably miss three-digit
 * multiplication or division by larger divisors. This module buckets attempts by
 * (operation × operand-shape), measures the error rate per bucket, and derives a
 * deterministic over-sampling WEIGHT that biases a drill toward the buckets the
 * learner actually misses — spending practice where it pays off.
 *
 * Everything here is O(n) over the (bounded) attempt history and takes explicit
 * inputs (no clock, no storage, no React). Selection is deterministic given the
 * seeded `Rng`, so a drill is fully reproducible for a given (history, ops, seed)
 * and unit-tested end-to-end. Nothing here affects scoring — it only shapes which
 * questions get drawn, so the existing arena modes stay byte-for-byte unchanged.
 */
import { Rng } from "@/lib/rng";
import type { ArenaOp } from "./config";

/** Operand-magnitude bucket (the "shape" half of a weak-spot bucket). */
export type OperandShape = "small" | "medium" | "large";

/** All shapes, in ascending-magnitude order. */
export const OPERAND_SHAPES: readonly OperandShape[] = [
  "small",
  "medium",
  "large",
] as const;

/** Larger operand ≤ this ⇒ "small" (times-table / single-column range). */
export const SHAPE_SMALL_MAX = 12;
/** Larger operand ≤ this (and > SHAPE_SMALL_MAX) ⇒ "medium" (classic Zetamac). */
export const SHAPE_MEDIUM_MAX = 100;

/**
 * Bucket an item by the magnitude of its LARGER operand. Grouping on the larger
 * operand captures the difficulty driver (a 3-digit × 1-digit is a "large"
 * multiply, not a "small" one). Uses absolute values so signed operands bucket
 * the same as their magnitudes.
 */
export function shapeOfOperands(a: number, b: number): OperandShape {
  const m = Math.max(Math.abs(a), Math.abs(b));
  if (m <= SHAPE_SMALL_MAX) return "small";
  if (m <= SHAPE_MEDIUM_MAX) return "medium";
  return "large";
}

/**
 * Inclusive operand range that a generator should draw from to PRODUCE an item
 * in the given shape bucket. The three ranges tile the magnitude line with no
 * gaps or overlap, so an item drawn from `shapeRange(s)` re-buckets to `s`
 * (for add/sub/mul on the larger operand).
 */
export function shapeRange(shape: OperandShape): [number, number] {
  switch (shape) {
    case "small":
      return [2, SHAPE_SMALL_MAX];
    case "medium":
      return [SHAPE_SMALL_MAX + 1, SHAPE_MEDIUM_MAX];
    case "large":
      return [SHAPE_MEDIUM_MAX + 1, 999];
  }
}

/**
 * One graded attempt, reduced to exactly what the weak-spot analysis needs: the
 * operation, the operand shape, and whether it was right (or skipped). Callers
 * that only have raw operands can build one with `makeAttempt`.
 */
export interface WeakSpotAttempt {
  op: ArenaOp;
  shape: OperandShape;
  correct: boolean;
  /** Skipped attempts are excluded from error rates (no signal either way). */
  skipped?: boolean;
}

/** Build an attempt from raw operands (deriving the shape). */
export function makeAttempt(
  op: ArenaOp,
  a: number,
  b: number,
  correct: boolean,
  skipped = false,
): WeakSpotAttempt {
  return { op, shape: shapeOfOperands(a, b), correct, skipped };
}

/** Stable string key for a bucket, e.g. `"mul:large"`. */
export function bucketId(op: ArenaOp, shape: OperandShape): string {
  return `${op}:${shape}`;
}

/** Inverse of `bucketId`. */
export function parseBucketId(id: string): { op: ArenaOp; shape: OperandShape } {
  const [op, shape] = id.split(":");
  return { op: op as ArenaOp, shape: shape as OperandShape };
}

/** The bucket an attempt belongs to. */
export function attemptBucketId(att: WeakSpotAttempt): string {
  return bucketId(att.op, att.shape);
}

/** Per-bucket aggregate: how many attempts, how many wrong, and the raw rate. */
export interface BucketStat {
  id: string;
  op: ArenaOp;
  shape: OperandShape;
  /** Non-skipped attempts in this bucket. */
  attempts: number;
  /** Non-skipped WRONG attempts in this bucket. */
  wrong: number;
  /** wrong / attempts in [0,1] (0 when nothing attempted). */
  errorRate: number;
}

/**
 * Aggregate an attempt history into per-bucket stats, sorted WEAKEST-FIRST
 * (highest error rate, breaking ties by more attempts then bucket id so the
 * order is fully deterministic). Skipped attempts are ignored. Buckets with no
 * non-skipped attempts are omitted (use `bucketWeights` to score unseen buckets).
 */
export function bucketStats(attempts: readonly WeakSpotAttempt[]): BucketStat[] {
  const acc = new Map<string, { attempts: number; wrong: number }>();
  for (const att of attempts) {
    if (att.skipped) continue;
    const id = attemptBucketId(att);
    const b = acc.get(id) ?? { attempts: 0, wrong: 0 };
    b.attempts += 1;
    if (!att.correct) b.wrong += 1;
    acc.set(id, b);
  }
  const out: BucketStat[] = [];
  for (const [id, b] of acc) {
    const { op, shape } = parseBucketId(id);
    out.push({
      id,
      op,
      shape,
      attempts: b.attempts,
      wrong: b.wrong,
      errorRate: b.attempts ? b.wrong / b.attempts : 0,
    });
  }
  out.sort(
    (x, y) =>
      y.errorRate - x.errorRate ||
      y.attempts - x.attempts ||
      (x.id < y.id ? -1 : x.id > y.id ? 1 : 0),
  );
  return out;
}

/**
 * The learner's weak buckets: `bucketStats` filtered to those with at least
 * `minAttempts` of evidence AND an error rate at/above `minErrorRate`. Still
 * weakest-first. This is the "detection" surface (what the report highlights).
 */
export function weakBuckets(
  attempts: readonly WeakSpotAttempt[],
  opts: { minAttempts?: number; minErrorRate?: number } = {},
): BucketStat[] {
  const minAttempts = opts.minAttempts ?? 1;
  const minErrorRate = opts.minErrorRate ?? Number.EPSILON;
  return bucketStats(attempts).filter(
    (s) => s.attempts >= minAttempts && s.errorRate >= minErrorRate,
  );
}

/** Tunables for the over-sampling weight. See `DEFAULT_WEAK_SPOT_CONFIG`. */
export interface WeakSpotConfig {
  /**
   * Pseudo-count of prior evidence, at `priorErrorRate`, blended into every
   * bucket. Sparse buckets are pulled toward the prior (exploration); buckets
   * with lots of evidence converge to their true rate.
   */
  minAttempts: number;
  /** The assumed error rate for a bucket with no evidence (encourages trying it). */
  priorErrorRate: number;
  /** Baseline weight every bucket gets, so no bucket is ever starved to 0. */
  base: number;
  /** Extra weight per unit of (smoothed) error rate — the over-sampling gain. */
  boost: number;
}

/**
 * Defaults: 4 pseudo-attempts of a 50% prior (an unseen bucket looks "coin-flip"
 * hard until proven easy), a baseline weight of 1 so mastered buckets still
 * appear occasionally, and a boost of 4 so a fully-missed bucket is drawn ~5×
 * as often as a fully-mastered one.
 */
export const DEFAULT_WEAK_SPOT_CONFIG: WeakSpotConfig = {
  minAttempts: 4,
  priorErrorRate: 0.5,
  base: 1,
  boost: 4,
};

/**
 * Laplace-style smoothed error rate: blends the observed (wrong/attempts) with a
 * `priorErrorRate` prior worth `minAttempts` pseudo-attempts. With no evidence it
 * returns the prior; with abundant evidence it returns the empirical rate.
 */
export function smoothedErrorRate(
  wrong: number,
  attempts: number,
  cfg: WeakSpotConfig = DEFAULT_WEAK_SPOT_CONFIG,
): number {
  const priorMass = Math.max(0, cfg.priorErrorRate) * Math.max(0, cfg.minAttempts);
  const denom = attempts + Math.max(0, cfg.minAttempts);
  if (denom <= 0) return Math.max(0, cfg.priorErrorRate);
  return (wrong + priorMass) / denom;
}

/** A candidate bucket paired with its over-sampling weight. */
export interface WeightedBucket {
  id: string;
  op: ArenaOp;
  shape: OperandShape;
  /** Non-negative selection weight (higher ⇒ drawn more often). */
  weight: number;
  /** The smoothed error rate the weight was derived from. */
  errorRate: number;
  /** Non-skipped attempts observed for this bucket. */
  attempts: number;
}

/** Every (op × shape) candidate bucket for the given ops. */
export function enumerateBuckets(
  ops: readonly ArenaOp[],
): { op: ArenaOp; shape: OperandShape }[] {
  const out: { op: ArenaOp; shape: OperandShape }[] = [];
  for (const op of ops) {
    for (const shape of OPERAND_SHAPES) out.push({ op, shape });
  }
  return out;
}

/**
 * Weight every (op × shape) candidate bucket by how weak it looks, given the
 * attempt history. `weight = base + smoothedErrorRate × boost`. Weakest-first
 * (highest weight), tie-broken by bucket id, so the ordering is deterministic.
 * This is the over-sampling distribution; feed it to `selectBucket(Sequence)`.
 */
export function bucketWeights(
  attempts: readonly WeakSpotAttempt[],
  ops: readonly ArenaOp[],
  cfg: WeakSpotConfig = DEFAULT_WEAK_SPOT_CONFIG,
): WeightedBucket[] {
  const stats = new Map(bucketStats(attempts).map((s) => [s.id, s]));
  const out: WeightedBucket[] = [];
  for (const { op, shape } of enumerateBuckets(ops)) {
    const id = bucketId(op, shape);
    const stat = stats.get(id);
    const wrong = stat?.wrong ?? 0;
    const obs = stat?.attempts ?? 0;
    const er = smoothedErrorRate(wrong, obs, cfg);
    out.push({
      id,
      op,
      shape,
      errorRate: er,
      attempts: obs,
      weight: Math.max(0, cfg.base + er * cfg.boost),
    });
  }
  out.sort(
    (x, y) =>
      y.weight - x.weight || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0),
  );
  return out;
}

/**
 * Deterministically pick ONE weighted bucket. Draws `r ∈ [0,total)` from the rng
 * and walks the cumulative weights, so the same (weights, rng seed) always yields
 * the same pick. Falls back to a uniform pick when every weight is ≤ 0. Throws on
 * an empty candidate list.
 */
export function selectBucket(
  weighted: readonly WeightedBucket[],
  rng: Rng,
): WeightedBucket {
  if (weighted.length === 0) {
    throw new Error("selectBucket: weighted must be non-empty");
  }
  const total = weighted.reduce((s, w) => s + Math.max(0, w.weight), 0);
  if (total <= 0) return rng.pick(weighted);
  let r = rng.next() * total;
  for (const w of weighted) {
    r -= Math.max(0, w.weight);
    if (r < 0) return w;
  }
  return weighted[weighted.length - 1];
}

/**
 * Deterministically draw a `count`-long sequence of weighted buckets (sampling
 * WITH replacement — the whole point is to over-drill weak buckets). Fully
 * reproducible given (weighted, rng seed, count).
 */
export function selectBucketSequence(
  weighted: readonly WeightedBucket[],
  rng: Rng,
  count: number,
): WeightedBucket[] {
  const n = Math.max(0, Math.floor(count));
  const out: WeightedBucket[] = [];
  for (let i = 0; i < n; i++) out.push(selectBucket(weighted, rng));
  return out;
}

/**
 * One-shot convenience the UI/tests use: weight the buckets from the history,
 * then draw a seeded `count`-long over-sampled bucket sequence. Deterministic
 * given (attempts, ops, seed, count).
 */
export function weakSpotPlan(
  attempts: readonly WeakSpotAttempt[],
  ops: readonly ArenaOp[],
  seed: number,
  count: number,
  cfg: WeakSpotConfig = DEFAULT_WEAK_SPOT_CONFIG,
): WeightedBucket[] {
  const weighted = bucketWeights(attempts, ops, cfg);
  return selectBucketSequence(weighted, new Rng(seed), count);
}
