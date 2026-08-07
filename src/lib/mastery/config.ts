import type { Difficulty } from "@/types/content";

/**
 * All tunable constants for the mastery/calibration layer (Phase 1).
 *
 * Research anchors:
 *  - ~75% on-the-fly target + Elo: Klinkenberg et al. 2011 (Math Garden).
 *  - 85% Rule optimal-difficulty band: Wilson, Shenhav, Straccia & Cohen 2019 (§1.8).
 *  - Beta(1,1) Laplace prior + credible intervals: Bayes Rules! ch.3 (§1.4).
 *  - K_s(n) uncertainty function + tier-difficulty freeze: Pelánek 2016 (§1.3).
 *
 * BACKUP swap (drop Elo, keep Beta): flip MASTERY_MODE to "beta". Every other
 * constant + all Beta/verdict/misconception math is identical in both modes, so
 * the swap is costless (see PHASE_1 §2).
 */
export const MASTERY_MODE: "elo+beta" | "beta" = "elo+beta";

export const P_TARGET = 0.8; // Wilson 85% Rule band centre; band [0.75, 0.85]
export const P_TARGET_BAND: [number, number] = [0.75, 0.85];

export const ELO_A = 1; // learning-rate numerator  K = a/(1+b·n)
export const ELO_B = 0.05; // learning-rate denominator coeff
export const ELO_KD = 0.04; // tier-difficulty learning rate (near-constant)
export const TIER_FREEZE_N = 100; // freeze d[topic,τ] after this many exposures (Pelánek)

export const BETA_PRIOR_ALPHA = 1; // Beta-Laplace uniform base prior
export const BETA_PRIOR_BETA = 1;

export const MASTERY_CI = 0.95; // credible-interval level
export const MASTERY_BAR = 0.8; // topic "mastered" ⇔ CI_low ≥ this
export const CAL_GAP_EPS = 0.1; // reliability-gap threshold for STRONG
export const BETA_DECAY_RHO = 1.0; // recency decay per active day (1.0 = off by default)
export const MISCONCEPTION_DECAY = 0.5; // multiply a flag by this on a later CORRECT in that topic

/** Elo difficulty seeds per Difficulty tier (monotone; logit scale). */
export const TIER_SEED: Record<Difficulty, number> = {
  intro: -1.5,
  easy: -0.5,
  medium: 0.5,
  hard: 1.5,
  expert: 2.5,
};

/**
 * OPTIONAL research extensions, DEFAULT OFF (PHASE_1 §5). Left stubbed so the
 * default fold is the plain guessing-corrected Elo + Beta path; do not wire on
 * without the corresponding math + tests.
 */
export const PFAE_ENABLED = false; // asymmetric θ update (Pelánek PFAE)
export const SPILLOVER = false; // multivariate skill spillover

/**
 * T12 ADAPTIVE ENGINE tuning (additive; PARALLEL signals that never gate content,
 * scoring, the confident-mastery (ciLow ≥ 0.8) bar, or unlock). These govern how
 * the recovered IRT/Glicko/Thompson engine (irt.ts / glicko.ts / thompson.ts) is
 * folded in alongside the plain Elo+Beta path and how it informs probe-tier /
 * next-item selection. The plain fold is unchanged when these are unused.
 */

/**
 * Number of graded responses that must accrue in a topic's rolling IRT buffer
 * before a 2PL MAP ability (`TopicMastery.irtAbility`) is fit. Below this the
 * estimate is too noisy to trust, so it is left absent and selection falls back
 * to the incremental Elo `theta`.
 */
export const IRT_MIN_RESPONSES = 5;

/**
 * Cap on the per-topic rolling IRT response buffer (`TopicMastery.irtResponses`).
 * Keeps the persisted blob cheap while retaining enough recent evidence to
 * re-fit ability; the oldest response is dropped when the cap is exceeded.
 */
export const IRT_BUFFER_CAP = 40;

/**
 * Max standard error at which the fitted `irtAbility` is trusted ENOUGH to inform
 * probe-tier selection in place of the Elo `theta`. Larger SE ⇒ fall back to Elo.
 */
export const IRT_TRUST_SE = 0.9;

/**
 * Max Glicko rating deviation (RD) at which a per-(topic,tier) Glicko DIFFICULTY
 * rating is trusted enough to inform probe-tier selection (converted to a logit
 * difficulty) in place of the frozen Elo tier seed. Above this the estimate is
 * too uncertain, so selection falls back to the Elo `TierDifficultyMap` seed.
 */
export const GLICKO_TRUST_RD = 150;

/**
 * Thompson-sampling pseudo-count strength for probe-tier EXPLORATION. Each
 * candidate tier becomes a Beta arm centred on its predicted success p:
 * Beta(1 + K·p, 1 + K·(1−p)). Larger K ⇒ tighter posteriors ⇒ less exploration
 * (more deterministic argmin); smaller K ⇒ more exploration around the ZPD band.
 */
export const PROBE_EXPLORE_K = 16;
