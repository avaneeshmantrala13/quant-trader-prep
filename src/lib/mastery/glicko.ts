import type { GlickoRating } from "@/types/mastery";
import type { ItemAttempt } from "@/types/mastery";

/**
 * Glicko-1 rating + rating deviation (RD) for per-(topic,tier) item DIFFICULTY
 * (T12 adaptive engine — additive).
 *
 * Glickman's Glicko system (Glickman 1999, *Parameter estimation in large
 * dynamic paired comparison experiments*) extends Elo with an explicit
 * uncertainty, the rating deviation. We rate the DIFFICULTY of a (topic,tier)
 * item bucket by treating each graded attempt as a "match" between the item and
 * the learner: when the learner answers CORRECTLY the item "loses" (evidence it
 * is easier), when the learner MISSES the item "wins" (evidence it is harder).
 * RD shrinks as evidence accrues and re-inflates over idle time, so a
 * long-dormant difficulty estimate is correctly treated as less certain again.
 *
 * This is a PARALLEL, richer companion to the plain Elo `TierDifficultyMap`
 * (which freezes at TIER_FREEZE_N). It NEVER replaces that map and NEVER gates
 * content, scoring, the confident-mastery (ciLow ≥ 0.8) bar, or unlock. Pure:
 * inputs are never mutated; every function returns fresh values.
 */

/** Classic Glicko constants (400-scale; 1500-centered). */
export const GLICKO_SCALE = 400;
export const GLICKO_DEFAULT_RATING = 1500;
/** Initial RD for an unrated item (classic default). */
export const GLICKO_INITIAL_RD = 350;
/** Floor on RD after an update (an item never becomes "perfectly known"). */
export const GLICKO_MIN_RD = 30;
/** Ceiling on RD when re-inflating over idle time. */
export const GLICKO_MAX_RD = 350;
/**
 * RD-inflation rate `c` per idle day: RD ← min(√(RD² + c²·t), RD_MAX). Chosen so
 * a fully-settled item (RD≈30) drifts back toward maximal uncertainty over a few
 * hundred idle days (classic tuning).
 */
export const GLICKO_C = 34.6;

const Q = Math.LN10 / GLICKO_SCALE; // ln(10)/400 ≈ 0.0057565

/** A fresh, maximally-uncertain difficulty rating. */
export function initialGlicko(rating = GLICKO_DEFAULT_RATING): GlickoRating {
  return { rating, rd: GLICKO_INITIAL_RD };
}

/** g(RD): the RD-attenuation factor that shrinks a noisy opponent's influence. */
export function gFactor(rd: number): number {
  return 1 / Math.sqrt(1 + (3 * Q * Q * rd * rd) / (Math.PI * Math.PI));
}

/**
 * Expected score of a player rated `r` (RD-free) against an opponent rated `rj`
 * with deviation `rdj`: E = 1 / (1 + 10^(−g(rdj)·(r − rj)/400)).
 */
export function expectedScore(r: number, rj: number, rdj: number): number {
  return 1 / (1 + Math.pow(10, (-gFactor(rdj) * (r - rj)) / GLICKO_SCALE));
}

/** One paired-comparison observation for the rated player. */
export interface GlickoMatch {
  /** Opponent rating. */
  rating: number;
  /** Opponent rating deviation. */
  rd: number;
  /** Score for the RATED player ∈ [0,1] (1 = rated player won). */
  score: number;
}

/**
 * Re-inflate RD for `idleDays` of inactivity (Glicko "onset of a rating
 * period"): RD ← min(√(RD² + c²·t), RD_MAX). `idleDays ≤ 0` is a no-op.
 */
export function inflateRd(rd: number, idleDays: number, c = GLICKO_C): number {
  if (!(idleDays > 0)) return Math.min(rd, GLICKO_MAX_RD);
  return Math.min(Math.sqrt(rd * rd + c * c * idleDays), GLICKO_MAX_RD);
}

/**
 * Core Glicko-1 update: fold a batch of matches into a rating. Returns the new
 * rating + RD (RD floored at {@link GLICKO_MIN_RD}). With no matches the rating
 * is unchanged (only prior RD inflation, applied by the caller, matters).
 */
export function updateGlicko(
  prior: GlickoRating,
  matches: GlickoMatch[],
): GlickoRating {
  if (matches.length === 0) {
    return { ...prior, rd: Math.min(prior.rd, GLICKO_MAX_RD) };
  }
  const { rating, rd } = prior;

  // dSquared = 1 / (q² · Σ g(RDj)²·E·(1−E)).
  let invDSq = 0;
  let ratingDelta = 0;
  for (const m of matches) {
    const g = gFactor(m.rd);
    const e = expectedScore(rating, m.rating, m.rd);
    invDSq += g * g * e * (1 - e);
    ratingDelta += g * (m.score - e);
  }
  invDSq *= Q * Q;

  const invRdSq = 1 / (rd * rd);
  const denom = invRdSq + invDSq;
  const newRating = rating + (Q / denom) * ratingDelta;
  const newRd = Math.max(GLICKO_MIN_RD, Math.sqrt(1 / denom));

  return { rating: newRating, rd: newRd };
}

/** Days between two ISO timestamps (0 if either is missing or order is reversed). */
function daysBetween(a: string | undefined, b: string | undefined): number {
  if (!a || !b) return 0;
  const t0 = Date.parse(a);
  const t1 = Date.parse(b);
  if (!Number.isFinite(t0) || !Number.isFinite(t1)) return 0;
  const d = (t1 - t0) / 86_400_000;
  return d > 0 ? d : 0;
}

/**
 * Update a (topic,tier) DIFFICULTY rating from ONE graded outcome, treating the
 * learner as the opponent. The item's score is (1 − learner score): the item
 * "wins" (gets harder-evidence) when the learner misses, and "loses" (easier
 * evidence) when the learner succeeds. Fractional partial credit flows straight
 * through as a soft score.
 *
 * Pure. `prev` undefined ⇒ start from a fresh {@link initialGlicko}. RD is first
 * re-inflated for any idle days since the item's `lastAt`, then updated.
 */
export function updateItemDifficulty(
  prev: GlickoRating | undefined,
  args: {
    /** Whether the LEARNER answered correctly. */
    correct: boolean;
    /** Optional fractional learner score ∈ [0,1]; defaults from `correct`. */
    score?: number;
    /** Learner ability on the Glicko scale (opponent rating). */
    learnerRating: number;
    /** Learner rating deviation (default {@link GLICKO_INITIAL_RD}/2). */
    learnerRd?: number;
    /** ISO timestamp of this attempt (drives RD re-inflation + `lastAt`). */
    at?: string;
  },
): GlickoRating {
  const base = prev ?? initialGlicko();
  const learnerRd = args.learnerRd ?? GLICKO_INITIAL_RD / 2;
  const learnerScore =
    args.score !== undefined
      ? Math.min(1, Math.max(0, args.score))
      : args.correct
        ? 1
        : 0;
  // Item's outcome is the complement of the learner's.
  const itemScore = 1 - learnerScore;

  const idle = daysBetween(base.lastAt, args.at);
  const inflated: GlickoRating = { ...base, rd: inflateRd(base.rd, idle) };

  const updated = updateGlicko(inflated, [
    { rating: args.learnerRating, rd: learnerRd, score: itemScore },
  ]);
  return { ...updated, lastAt: args.at ?? base.lastAt };
}

/**
 * Convenience: map an `ItemAttempt` outcome onto {@link updateItemDifficulty}.
 * `learnerRating` is the learner's ability on the Glicko scale (see
 * {@link logitToGlickoRating} for converting an Elo/IRT θ). Additive helper —
 * the mastery fold does NOT call this; it exists for callers that opt into the
 * Glicko difficulty view.
 */
export function updateItemDifficultyFromAttempt(
  prev: GlickoRating | undefined,
  a: ItemAttempt,
  learnerRating: number,
  learnerRd?: number,
): GlickoRating {
  return updateItemDifficulty(prev, {
    correct: a.correct,
    score: a.credit,
    learnerRating,
    learnerRd,
    at: a.at,
  });
}

/**
 * Map an Elo/IRT ability θ (logit scale) onto the Glicko rating scale so the
 * learner can act as an opponent for item-difficulty updates:
 *   rating = 1500 + θ · (400 / ln 10).
 * The factor 400/ln10 is the logit→Glicko scale conversion (inverse of `Q`).
 */
export function logitToGlickoRating(theta: number): number {
  return GLICKO_DEFAULT_RATING + theta / Q;
}

/** Inverse of {@link logitToGlickoRating}: Glicko rating → logit θ. */
export function glickoRatingToLogit(rating: number): number {
  return (rating - GLICKO_DEFAULT_RATING) * Q;
}
