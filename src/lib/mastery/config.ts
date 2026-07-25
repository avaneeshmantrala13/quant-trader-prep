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
