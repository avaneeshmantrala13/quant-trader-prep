import type { GlickoRating, ItemAttempt, TopicMastery } from "@/types/mastery";
import {
  BETA_DECAY_RHO,
  BETA_PRIOR_ALPHA,
  BETA_PRIOR_BETA,
  IRT_BUFFER_CAP,
  IRT_MIN_RESPONSES,
  MASTERY_MODE,
  MISCONCEPTION_DECAY,
} from "./config";
import { seedTierDifficulty, updateElo } from "./elo";
import { betaUpdate } from "./beta";
import { bumpMisconceptions, decayMisconceptions } from "./misconceptions";
import {
  glickoRatingToLogit,
  logitToGlickoRating,
  updateItemDifficulty,
} from "./glicko";
import { estimateAbility2PL, type IrtResponse } from "./irt";

/** Clamp a score into the valid [0,1] range (defensive against bad callers). */
function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/**
 * The pure fold: apply ONE ItemAttempt to (mastery, tierD). Returns fresh copies
 * — the inputs are never mutated (PHASE_1 §4/§8). This is the single place Elo,
 * Beta, and misconception updates are composed; `recordItemAttempt` in
 * ProgressContext is a thin wrapper that persists what this returns.
 *
 * `dExposures` = how many times this (topic,tier) has been seen before, supplied
 * by the caller (it lives in the TierDifficultyMap companion, see topicKey.ts).
 *
 * T12 ADAPTIVE ENGINE (additive, PARALLEL): when the caller passes the prior
 * per-(topic,tier) Glicko difficulty rating (`glickoPrev`), this ALSO folds the
 * outcome into a fresh Glicko difficulty rating (`glicko.ts`) and appends the
 * response to the topic's rolling IRT buffer, re-fitting the 2PL MAP ability
 * (`irt.ts`) once {@link IRT_MIN_RESPONSES} accrue. These extra signals ride
 * alongside — they NEVER change θ/α/β, the misconception fold, the tier Elo `d`,
 * or any gate; a caller that ignores `glicko`/`irtAbility` behaves exactly as
 * before. The returned Glicko rating is what `recordItemAttempt` persists into
 * `UserProgress.glickoDifficulty`.
 */
export function applyItemAttempt(
  prev: TopicMastery | undefined,
  tierD: number | undefined,
  a: ItemAttempt,
  dExposures: number,
  glickoPrev?: GlickoRating,
): { mastery: TopicMastery; tierD: number; glicko: GlickoRating } {
  // Actual score S ∈ [0,1]. When the caller supplies fractional `credit` (the
  // free-response hint-attempt flow), use it directly; otherwise fall back to the
  // binary 0/1 outcome so every existing binary caller is unchanged (PHASE_1).
  const s = clamp01(a.credit ?? (a.correct ? 1 : 0));

  const base: TopicMastery = prev ?? {
    theta: 0,
    n: 0,
    alpha: BETA_PRIOR_ALPHA,
    beta: BETA_PRIOR_BETA,
    lastSeen: a.at,
    misconceptions: {},
  };

  // Tier difficulty: seed on first exposure, else use the stored value. The
  // pre-update value is the difficulty the item was actually SERVED at — the
  // adaptive engine uses it (or the Glicko view of it) as the IRT item `b`.
  let d = tierD ?? seedTierDifficulty(a.tier);
  const dServe = d;
  let theta = base.theta;

  // BACKUP mode "beta" skips the Elo block entirely (PHASE_1 §2/§5); θ and d
  // simply carry through untouched.
  if (MASTERY_MODE === "elo+beta") {
    const stepped = updateElo({
      theta: base.theta,
      d,
      y: s,
      kOptions: a.kOptions,
      n: base.n,
      dExposures,
    });
    theta = stepped.theta;
    d = stepped.d;
  }

  const { alpha, beta } = betaUpdate(base.alpha, base.beta, s, BETA_DECAY_RHO);

  // Misconceptions: fade all flags on a CLEAN full-credit solve (S ≥ 1); bump the
  // tripped keys otherwise, i.e. whenever ANY help was needed or the item was
  // missed (PHASE_1 §5). A partial-credit recovery still demonstrated the
  // misconception on its first wrong attempt, so it must bump — keyed on `s`, not
  // `a.correct`. Caller resolves `a.misconceptions` via topicKey helpers.
  const misconceptions =
    s >= 1
      ? decayMisconceptions(base.misconceptions, MISCONCEPTION_DECAY)
      : bumpMisconceptions(base.misconceptions, a.misconceptions ?? []);

  // --- T12 adaptive engine (additive, parallel) ----------------------------
  // Glicko DIFFICULTY: fold this outcome into the (topic,tier) difficulty rating,
  // rating the item against the learner's PRIOR ability estimate (base.theta) so
  // the just-observed outcome is not double-counted into the "opponent" strength.
  const glicko: GlickoRating = updateItemDifficulty(glickoPrev, {
    correct: a.correct,
    score: a.credit,
    learnerRating: logitToGlickoRating(base.theta),
    at: a.at,
  });

  // IRT ability: append this response (as a 2PL item) to the rolling buffer and
  // re-fit the MAP ability once enough evidence has accrued. The item difficulty
  // `b` is the Glicko-derived logit difficulty when a prior Glicko rating exists
  // (the richer view), else the Elo tier difficulty the item was served at.
  const bServe = glickoPrev
    ? glickoRatingToLogit(glickoPrev.rating)
    : dServe;
  const irtResponses = [...(base.irtResponses ?? []), { b: bServe, s }].slice(
    -IRT_BUFFER_CAP,
  );
  let irtAbility = base.irtAbility;
  let irtAbilitySe = base.irtAbilitySe;
  if (irtResponses.length >= IRT_MIN_RESPONSES) {
    const responses: IrtResponse[] = irtResponses.map((r) => ({
      a: 1,
      b: r.b,
      score: r.s,
    }));
    const est = estimateAbility2PL(responses, { priorSd: 3 });
    irtAbility = est.theta;
    irtAbilitySe = est.se;
  }

  const mastery: TopicMastery = {
    ...base,
    theta,
    n: base.n + 1,
    alpha,
    beta,
    lastSeen: a.at,
    misconceptions,
    irtResponses,
    ...(irtAbility !== undefined ? { irtAbility, irtAbilitySe } : {}),
  };

  return { mastery, tierD: d, glicko };
}

/**
 * Seed a topic's mastery from a diagnostic result (Phase 3 consumer, PHASE_1 §7):
 * α = 1 + successes, β = 1 + failures, θ = thetaSeed ?? 0, n = successes+failures.
 * Preserves any prior misconception flags / review schedule.
 */
export function applyDiagnosticSeed(
  prev: TopicMastery | undefined,
  seed: { successes: number; failures: number; thetaSeed?: number; at?: string },
): TopicMastery {
  const { successes, failures, thetaSeed, at } = seed;
  return {
    theta: thetaSeed ?? 0,
    n: successes + failures,
    alpha: BETA_PRIOR_ALPHA + successes,
    beta: BETA_PRIOR_BETA + failures,
    lastSeen: at ?? prev?.lastSeen ?? new Date(0).toISOString(),
    reviewDue: prev?.reviewDue,
    reviewStep: prev?.reviewStep,
    misconceptions: prev?.misconceptions ?? {},
  };
}

/**
 * Additively persist the SM-2 spaced-review schedule on a topic — the pure fold
 * behind `ProgressContext.setReviewSchedule` (COORDINATION §2.1 `reviewDue` /
 * `reviewStep`). It writes ONLY the two schedule scalars; θ/n/α/β/misconceptions
 * are carried through untouched, and it never touches `LevelProgress.mastered`
 * (the unlock gate) or the migration. When a topic has no mastery yet (a review
 * can be scheduled from remediation climb-back before the first graded item in
 * that topic), a fresh Beta(1,1) entry is created so the schedule has a home.
 * Pure: the input `prev` is never mutated.
 */
export function applyReviewSchedule(
  prev: TopicMastery | undefined,
  reviewDue: string,
  reviewStep: number,
): TopicMastery {
  const base: TopicMastery = prev ?? {
    theta: 0,
    n: 0,
    alpha: BETA_PRIOR_ALPHA,
    beta: BETA_PRIOR_BETA,
    lastSeen: new Date(0).toISOString(),
    misconceptions: {},
  };
  return { ...base, reviewDue, reviewStep };
}
