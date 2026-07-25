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
