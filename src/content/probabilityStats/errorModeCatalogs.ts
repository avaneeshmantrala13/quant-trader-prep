import type { ErrorModeCatalog } from "@/lib/tutor/errorModes";
import { MISCONCEPTION } from "@/lib/tutor/misconception";

/**
 * WORKED reference error-mode catalogs (PHASE_1/2). These are the exact pattern a
 * per-section content sub-worker replicates: a per-family `ErrorModeCatalog<P>`
 * of parametric error modes (each a tiny solver computing the WRONG value for ANY
 * parameterization), keyed to a `MISCONCEPTION.*` tag + an encouraging rung-1
 * coaching sentence that names the mistake and asks a leading question WITHOUT
 * stating the answer.
 *
 * Usage in a generator (generation time):
 *   const commonErrors = buildCommonErrors(INDEPENDENT_AND_ERRORS, { pa, pb },
 *     pa * pb, { decimals: 4 });
 * and the free-response player + `gradeFreeResponse` match a wrong entry against
 * these at grade time, surfacing the coaching as hint rung 1.
 *
 * Enumerate GENUINE modes only (typically 5–15 per family; cap 50; never pad with
 * implausible mistakes). Coaching sentences must never reveal the answer.
 */

/* ── Family: P(A and B) for INDEPENDENT events. Correct = pa·pb. ───────────── */
export interface IndependentAndParams {
  pa: number;
  pb: number;
}

export const INDEPENDENT_AND_ERRORS: ErrorModeCatalog<IndependentAndParams> = [
  {
    id: "added_instead_of_multiplied",
    misconception: MISCONCEPTION.andMeansAdd,
    compute: ({ pa, pb }) => pa + pb,
    coach: `It looks like you added the two probabilities here. Re-read what the wording is actually asking you to combine.`,
  },
  {
    id: "took_the_larger",
    misconception: "and_is_max",
    compute: ({ pa, pb }) => Math.max(pa, pb),
    coach: `You seem to have kept the larger of the two chances here. Re-read whether the question wants both events together or just one of them.`,
  },
  {
    id: "used_the_union",
    misconception: MISCONCEPTION.orMeansAddNoOverlap,
    compute: ({ pa, pb }) => pa + pb - pa * pb,
    coach: `That's the chance of A OR B, at least one of them. Re-read whether the question asks for at least one or for both together.`,
  },
];

/* ── Family: P(at least one) in n independent trials, each prob p.
   Correct = 1 − (1−p)^n. ──────────────────────────────────────────────────── */
export interface AtLeastOneParams {
  p: number;
  n: number;
}

export const AT_LEAST_ONE_ERRORS: ErrorModeCatalog<AtLeastOneParams> = [
  {
    id: "linear_np",
    misconception: MISCONCEPTION.atLeastOneNaive,
    compute: ({ p, n }) => n * p,
    coach: `It looks like you multiplied the per-trial probability by the number of trials here. Re-read what "at least one" is really asking for.`,
  },
  {
    id: "all_n",
    misconception: "at_least_one_is_all",
    compute: ({ p, n }) => p ** n,
    coach: `That's the chance it happens on EVERY one of the trials, not the chance it happens at least once.`,
  },
  {
    id: "complement_of_answer",
    misconception: MISCONCEPTION.complementConfusion,
    compute: ({ p, n }) => (1 - p) ** n,
    coach: `You found the chance it never happens on any trial, which isn't the event the question is asking about.`,
  },
];

/* ── Family: Bayes posterior P(H | E) from prior, sensitivity, false-positive.
   Correct = (prior·sens) / (prior·sens + (1−prior)·fpr). ─────────────────────
   Params carried so the reversed-conditional and base-rate modes are exact. */
export interface BayesParams {
  prior: number;
  sens: number; // P(E | H)
  fpr: number; // P(E | ¬H)
}

function bayesPosterior({ prior, sens, fpr }: BayesParams): number {
  const num = prior * sens;
  const den = num + (1 - prior) * fpr;
  return den === 0 ? 0 : num / den;
}

export const BAYES_POSTERIOR_ERRORS: ErrorModeCatalog<BayesParams> = [
  {
    id: "likelihood_as_posterior",
    misconception: MISCONCEPTION.likelihoodAsPosterior,
    compute: ({ sens }) => sens,
    coach: `It looks like you reported the test's hit rate as your answer here. Re-read exactly which quantity the question is asking for.`,
  },
  {
    id: "base_rate_neglect",
    misconception: MISCONCEPTION.baseRateNeglect,
    compute: ({ sens, fpr }) => (sens + fpr === 0 ? 0 : sens / (sens + fpr)),
    coach: `You compared the two test rates and left out how rare the condition is to begin with.`,
  },
  {
    id: "reversed_conditional",
    misconception: MISCONCEPTION.reversedConditional,
    compute: ({ prior, sens, fpr }) => {
      // Swapped numerator/denominator roles: P(E)·? — a common inversion.
      const pe = prior * sens + (1 - prior) * fpr;
      return pe === 0 ? 0 : prior / pe;
    },
    coach: `It looks like you swapped P(A|B) and P(B|A) here, conditioning on the wrong event.`,
  },
];

/** Exported for tests / generators that want the exact solver. */
export const bayes = { posterior: bayesPosterior };
