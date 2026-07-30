/**
 * Deterministic, learner-facing labels for the mastery dashboard (Task 1).
 *
 * The mastery layer stores misconceptions as NAMESPACED keys
 * `${topicKey}::${tag}` (see `@/lib/mastery/topicKey`), where `tag` is either a
 * canonical SEMANTIC tag authored by the content generators (the values of
 * `MISCONCEPTION` in `@/lib/tutor/misconception`) or a deterministic FALLBACK
 * `idx:<i>` (quiz) / `err:<value>` (numeric) when a distractor was untagged.
 *
 * The dashboard must NEVER surface those raw keys ("option 0", "idx:1",
 * "<topicKey>::option 0"). This module is the single, pure, tested source of
 * SHORT human-readable descriptions of the concept a learner struggles with.
 *
 * Everything here is deterministic and side-effect free. The optional LLM
 * reword (`misconceptionReword.ts`) only ever REPHRASES these strings — it never
 * changes WHICH misconception/topic is shown.
 */

/**
 * Canonical SEMANTIC misconception tag → concise learner-facing description.
 *
 * Keys are exactly the values of `MISCONCEPTION` in
 * `@/lib/tutor/misconception` — the full set of tags actually emitted by the
 * content generators (audited across `src/content/**` — every authored
 * `Question.misconceptions` / `commonErrors[].misconception` resolves to one of
 * these constants; no other literal tags exist). Keep this map in lockstep with
 * that constant object; `misconceptionLabels.test.ts` asserts full coverage.
 */
export const MISCONCEPTION_LABELS: Record<string, string> = {
  reversed_conditional: "Confusing P(A|B) with P(B|A)",
  base_rate_neglect: "Ignoring the base rate",
  likelihood_as_posterior: "Reading the test's hit-rate as the answer",
  ordered_vs_unordered: "Counting ordered vs. unordered arrangements",
  faces_not_objects: "Counting faces instead of objects",
  equal_weight_mixture: "Averaging outcomes without weighting by probability",
  memoryless_uniform: "Assuming a memoryless process is uniform",
  outcome_approach: "Judging probability by a single outcome",
  gamblers_fallacy: "Expecting past results to “balance out”",
  conjunction_fallacy: "Rating a joint event as more likely than one part",
  and_means_add: "Adding probabilities for “A and B” instead of multiplying",
  or_means_add_no_overlap: "Adding for “A or B” without subtracting the overlap",
  complement_confusion: "Reporting the complement (1 − p) instead of p",
  at_least_one_naive: "Using n·p instead of 1 − (1 − p)ⁿ for “at least one”",
  n_vs_n_minus_one: "Dividing by n instead of n − 1",
  forgot_divide_by_two: "Forgetting to divide by 2 (ordered vs. unordered)",

  // ── Phase-2 conversion tags (per-family error modes authored by the section
  //    sub-workers). Additive: these give the dashboard specific labels; the
  //    coverage test only enforces the MISCONCEPTION enum, so extra keys are safe.
  // Conditional Probability & Bayes
  ignored_conditioning: "Not restricting to the conditioning event",
  conditioning_event_prob: "Using P(condition) as the denominator wrongly",
  naive_independent_second: "Treating a dependent second draw as independent",
  unconditional_joint: "Reporting the joint P(A∩B) instead of the conditional",
  double_counted_outcome: "Double-counting a shared outcome",
  single_favorable_miscount: "Miscounting the favorable outcomes",
  must_be_half: "Assuming the answer “must be” ½",
  naive_one_over_n: "Defaulting to 1/n without conditioning",
  wrong_conditioning_correction: "Applying the wrong conditioning correction",
  specificity_as_posterior: "Reading specificity as the posterior",
  joint_not_posterior: "Reporting a joint probability, not the posterior",
  prior_ignored_evidence: "Sticking with the prior, ignoring the evidence",
  swapped_bayes_numerator: "Swapping the numerator terms in Bayes’ rule",
  weighted_by_win_not_loss: "Weighting by the wrong branch",
  likelihood_not_normalized: "Forgetting to normalize by total evidence",
  // Expected Value
  specified_both_faces: "Fixing both faces instead of one free face",
  doubled_match_prob: "Double-counting the matching outcomes",
  excluded_first_face: "Excluding the free first outcome",
  first_roll_not_free: "Treating the first roll as constrained",
  even_odds_guess: "Guessing even odds instead of computing",
  single_all_same_run: "Counting one run instead of all",
  single_flip_prob: "Using a single-flip probability",
  overcounted_flips: "Over-counting the flips",
  ignored_loss_branch: "Ignoring the losing branch in E[X]",
  best_case_only: "Using the best case instead of the mean",
  ignored_tie_zero: "Ignoring the zero-payoff tie branch",
  single_die_mean: "Using one die’s mean instead of the max",
  top_face_only: "Considering only the top face",
  mean_squared_not_second_moment: "Using (E[X])² instead of E[X²]",
  variance_not_second_moment: "Reporting the variance, not E[X²]",
  first_moment_not_second: "Reporting E[X] instead of E[X²]",
  product_of_means_dependent: "Multiplying means of dependent variables",
  off_by_factor_two: "Off by a factor of 2",
  overscaled_product: "Over-scaling the product",
  forgot_factor_two_exp: "Dropping the factor of 2 in E[X²] for Exp",
  mean_not_second_moment_exp: "Using the mean, not E[X²], for Exp",
  wrong_lambda_power: "Using the wrong power of λ",
  forgot_multiply_by_count: "Forgetting to multiply by the count",
  uniform_mean_is_full_L: "Taking the uniform mean as L, not L/2",
  single_draw_value: "Using one draw instead of the sum",
  subtracted_variances: "Subtracting variances instead of adding",
  one_variance_only: "Including only one variance term",
  other_variance_only: "Including only the other variance term",
  // Combinatorial Analysis
  forgot_suit_combo: "Forgetting the suit-combination factor",
  forgot_kicker_card: "Forgetting the kicker-card choices",
  overcount_committed_cards: "Over-counting already-committed cards",
  invented_suit_choice: "Inventing an extra suit choice",
  wrong_kicker_count: "Miscounting the kickers",
  suit_vs_colour: "Confusing suits with colors",
  counts_with_replacement: "Counting with replacement when there is none",
  naive_product: "Using a naive product instead of a combination",
  forgot_replacement: "Forgetting replacement is allowed",
  unordered_with_replacement: "Treating an ordered choice as unordered",
  strict_vs_nondecreasing: "Confusing strict vs. non-decreasing order",
  assume_all_distinct: "Assuming all items are distinct",
  wrong_denominator: "Using the wrong denominator",
  distinct_not_order: "Counting distinctness instead of order",
  forgot_face_cap: "Ignoring the per-die face cap",
  forgot_die_minimum: "Ignoring the per-die minimum",
  off_by_one_target: "Off by one on the target total",
  // Markov Chains
  pattern_overlap_as_run: "Treating a pattern wait like a max-overlap run",
  pattern_as_independent_block: "Treating a pattern as one fixed block",
  sum_independent_single_waits: "Summing independent single-symbol waits",
  pattern_race_naive_half: "Guessing ½ for a pattern race",
  race_by_speed_ratio: "Weighting a race by expected-wait ratio",
  // Game Theory
  corner_always_participate: "Choosing a corner (always/never) instead of optimizing",
  naive_participation_half: "Assuming ½ participation without optimizing",
  derivative_algebra_slip: "Algebra slip when differentiating the objective",
  reported_value_not_argmax: "Reporting the value instead of the optimal p",
  reported_one_participant_rate: "Using the one-participant rate",
  reported_both_participate_rate: "Using the both-participate rate",
  reported_argmax_not_value: "Reporting where the optimum is, not its value",
  multiplied_success_rates: "Multiplying success rates incorrectly",
  // Math Questions (counting / number theory)
  volume_division_pack: "Dividing volumes instead of packing by dimension",
  ceil_not_floor: "Rounding up instead of down when packing",
  dropped_third_dimension: "Dropping the third dimension",
  squares_not_rectangles: "Counting squares instead of all rectangles",
  one_dimension_only: "Counting choices in one dimension only",
  unit_cells_only: "Counting unit cells only",
  ignored_repeats: "Ignoring repeated letters in arrangements",
  one_repeat_only: "Dividing by only one repeat group",
  over_divided_repeats: "Over-dividing by the repeats",
  forgot_meetings: "Forgetting the number of meetings/rounds",
  included_self_pairs: "Including self-pairings",
  ordered_pairs_double_count: "Double-counting ordered pairs",
  summed_all_integers: "Summing all integers, not just the odds",
  summed_evens_instead: "Summing the evens instead of the odds",
  n_squared_misapplied: "Misapplying the n² odd-sum shortcut",
  forgot_lower_bound: "Ignoring the lower bound of the range",
  dropped_last_term: "Dropping the last term of the sum",
  multiplied_endpoints: "Multiplying the endpoints instead of summing",
  span_over_d: "Using span/d without the endpoint correction",
  forgot_lower_cutoff: "Ignoring the lower cutoff for multiples",
  up_to_start_only: "Counting only up to the start value",
  one_period_only: "Counting a single period only",
  fraction_of_time_fallacy: "Treating coverage as a fraction of time",
  days_not_periods: "Confusing days with doubling periods",

  // ── Batch-2 conversion tags (Core Probability, Mental Math, Interview Games) ──
  // Core Probability
  or_means_multiply: "Multiplying for “A or B” instead of adding",
  reported_overlap_only: "Reporting only the overlap P(A∩B)",
  reported_one_event_only: "Reporting just one event’s probability",
  computed_union_not_intersection: "Computing the union instead of the intersection",
  took_min_probability: "Taking the smaller probability for “and”",
  counted_with_replacement: "Counting with replacement when there is none",
  multiplied_n_times_k: "Using n·k instead of a combination",
  reported_joint_not_conditional: "Reporting the joint, not the conditional",
  forgot_normalization: "Forgetting to normalize by total evidence",
  reported_prior_only: "Sticking with the prior only",
  computed_all_not_at_least_one: "Computing “all” instead of “at least one”",
  complement_of_all_not_none: "Complementing “all” instead of “none”",
  summed_payouts_no_weight: "Summing payouts without probability weights",
  forgot_divide_by_total: "Forgetting to divide by the total",
  forgot_binomial_coefficient: "Dropping the C(n,k) binomial coefficient",
  naive_ratio_k_over_n: "Using k/n instead of the binomial probability",
  ignored_other_flips: "Ignoring the other flips’ outcomes",
  count_not_probability: "Reporting a count instead of a probability",
  reported_p_not_reciprocal: "Reporting p instead of 1/p for the mean",
  used_failure_probability: "Using the failure probability by mistake",
  counted_failures_not_trials: "Counting failures instead of trials",
  // Mental Math (arithmetic slips)
  off_by_carry: "Dropped a carry/borrow between columns",
  place_value_slip: "Off by a power of ten",
  off_by_one: "Off by one",
  swapped_operands: "Subtracted/divided in the wrong order",
  operation_confused: "Used the wrong operation",
  dropped_cross_term: "Missed a cross-term in the product",
  percent_as_whole: "Used p instead of p/100",
  inverted_fraction: "Inverted the fraction",
  odds_direction_flipped: "Flipped the odds direction",
  odds_ratio_as_prob: "Reported the odds ratio as a probability",
  // Interview Games (optimal stopping / fair value)
  ignored_option_value: "Ignoring the option value of re-rolling",
  keep_region_only: "Averaging only the kept outcomes",
  suboptimal_threshold: "Using a sub-optimal stopping threshold",
  inverted_stopping_rule: "Inverting the keep/re-roll rule",
  forgot_plus_one: "Using N/2 instead of (N+1)/2",
  max_not_mean: "Naming the maximum instead of the mean",
  off_by_one_inclusive: "Off by one on an inclusive range",

  // ── Tri-mode conversions ──
  // Markov Chains (mc-5 gambler's ruin / bold play)
  ruin_symmetric_fair: "Assuming a fair symmetric ½ instead of using the odds ratio",
  ruin_inverted_odds: "Inverting the win/loss odds ratio (p/q vs q/p)",
  timid_not_bold: "Using timid play instead of the bold-play optimum",
  single_round_prob: "Reporting a single-round probability, not the ruin probability",
  // Variance / Covariance / CLT (vc-1)
  added_sds_not_variances: "Adding standard deviations instead of variances",
  affine_ignored_sign: "Ignoring the sign of the affine slope",
  arithmetic_not_geometric_mean: "Using the arithmetic instead of geometric mean",
  correlation_not_scale_free: "Treating correlation as scale-dependent",
  difference_variance_not_doubled: "Not doubling the variance for a difference of i.i.d. terms",
  forgot_sqrt: "Forgetting the square root",
  forgot_sqrt_variance: "Reporting the variance instead of its square root (SD)",
  reported_variance_not_sd: "Reporting the variance instead of the standard deviation",
  scaled_and_ignored_sign: "Scaling correctly but dropping the sign",
  sign_error: "Sign error",
  single_not_sum_sd: "Using one term's SD instead of the sum's SD",
  used_means_not_deviations: "Using the means instead of the deviations",

  // ── Static-pool per-item error modes ──
  // Core Probability (pr-4 / pr-5)
  ht_treated_like_hh: "Treating the HT wait like the slower HH wait",
  guessed_pattern_length: "Guessing near the pattern length instead of computing the wait",
  single_symbol_wait_only: "Counting only the wait for a single symbol",
  hh_treated_like_ht: "Treating the HH wait like the faster HT wait",
  reset_cost_ignored: "Ignoring the reset cost after a wrong flip",
  overestimated_reset_cost: "Overestimating the reset cost",
  graph_distance_times_two: "Using graph distance × 2 instead of the hitting-time equations",
  ignored_backtracking: "Ignoring back-tracking in the random walk",
  overestimated_hitting_time: "Overestimating the hitting time",
  ignored_start_position: "Ignoring the starting position in gambler's ruin",
  misplaced_decimal: "Misplaced decimal point",
  ignored_one_triangle_inequality: "Forgetting one of the triangle inequalities",
  false_symmetry_thirds: "Assuming a false 1/3 symmetry",
  double_counted_excluded_region: "Double-counting the excluded region",
  pairs_vs_people: "Comparing people to a fixed date instead of all pairs",
  birthday_overguess: "Over-guessing the birthday threshold",
  birthday_underguess: "Under-guessing the birthday threshold",
  multiplied_coordinates: "Multiplying the coordinates instead of using a combination",
  added_coordinates: "Adding the coordinates instead of using a combination",
  ordered_with_replacement: "Counting ordered-with-replacement instead of a combination",
  final_share_not_ballot: "Using the final vote share instead of the ballot formula",
  miscounted_favorable_orderings: "Miscounting the favorable orderings",
  all_paths_ignore_diagonal: "Counting all paths, ignoring the diagonal constraint",
  catalan_miscount: "Miscounting the Catalan number",
  wrong_catalan_index: "Using the wrong Catalan index",
  count_faces_not_wait: "Counting faces instead of the coupon-collector wait",
  summed_1_to_n: "Summing 1..n instead of the coupon-collector formula",
  n_squared_overcount: "Using n² — an over-count",
  uniform_midpoint_assumption: "Assuming a uniform midpoint distribution",
  center_meeting_only: "Counting only the center-vs-center meeting",
  single_corner_only: "Counting only one corner meeting",
  // Interview Games (ig-1 fair value / EV)
  dropped_loss_sign: "Adding the losing payoff instead of subtracting it",
  summed_magnitudes: "Summing raw payoff sizes, ignoring probability and sign",
  near_peak_not_mode: "Picking a near-peak total instead of the mode",
  min_not_mode: "Picking the least likely value instead of the mode",
  guessed_midpoint: "Guessing a round midpoint instead of computing E[X]",
};

/**
 * Nice, human-readable TOPIC names keyed by the canonical topicKey
 * (`${trackId}::${section}`). Aligned with the labels in the remediation
 * prerequisite DAG (`@/content/remediation/prereqDAG`) so the dashboard, the
 * hint ladder, and the remediation flow all name the same topic identically —
 * but kept display-clean here (no "(L0)/(L1)" scaffolding suffixes).
 *
 * A topicKey NOT in this map falls back to the caller-supplied label (the
 * section name, or the track title for section-less tracks), which is already
 * human-readable — so this map only needs the topics that benefit from a nicer
 * name than their raw section string.
 */
export const TOPIC_NAMES: Record<string, string> = {
  "mental-math::_core": "Mental Arithmetic",
  "probability::Core Probability": "Meaning of Probability & Sample Space",
  "probability::Combinatorial Analysis": "Counting & Combinatorics",
  "probability::Conditional Probability": "Conditional Probability & Bayes",
  "probability::Expected Value": "Expected Value",
};

/**
 * Resolve a nice display name for a topic. Returns the curated {@link TOPIC_NAMES}
 * entry when one exists, else the caller's already-human-readable fallback
 * (section name / track title). Never returns a raw key.
 */
export function topicDisplayName(topicKey: string, fallback: string): string {
  return TOPIC_NAMES[topicKey] ?? fallback;
}

/**
 * Strip the `${topicKey}::` prefix from a namespaced misconception KEY to
 * recover its TAG. A bare tag (no `::`) is returned unchanged. Mirrors
 * `misconceptionTagOf` in `@/content/remediation/prereqDAG` but kept local so
 * the dashboard layer has no dependency on the content layer.
 */
export function misconceptionTag(key: string): string {
  const idx = key.lastIndexOf("::");
  return idx >= 0 ? key.slice(idx + 2) : key;
}

/**
 * Resolve a namespaced misconception KEY (or bare tag) to a SHORT, human-readable
 * description of the concept the learner struggles with. The core Task-1 ask.
 *
 *  - A canonical SEMANTIC tag returns its {@link MISCONCEPTION_LABELS} description.
 *  - Anything else — a deterministic `idx:<i>` / `err:<value>` fallback key, or
 *    an unknown tag — degrades to a topic-level phrasing
 *    ("Recurring mistakes in {topicName}").
 *
 * It NEVER surfaces a raw key ("option 0", "idx:1", "<topicKey>::option 0").
 */
export function describeMisconception(
  key: string,
  opts: { topicName: string },
): string {
  const tag = misconceptionTag(key);
  return MISCONCEPTION_LABELS[tag] ?? `Recurring mistakes in ${opts.topicName}`;
}
