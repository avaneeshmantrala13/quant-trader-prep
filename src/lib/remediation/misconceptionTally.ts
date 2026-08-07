import { misconceptionTagOf } from "@/content/remediation/prereqDAG";
import { MISCONCEPTION_LABELS } from "@/lib/dashboard/misconceptionLabels";

/**
 * PER-TOPIC REPEATED-MISTAKE tally (ZPD remediation — plain, non-scored
 * feedback).
 *
 * The mastery layer already carries a DECAYED, mastery-facing misconception map
 * (`TopicMastery.misconceptions`) that fades a flag on a later clean solve. That
 * is the wrong signal for telling a learner "you made THIS specific mistake N
 * times" — a fade would hide a genuine recurring error the moment they get one
 * later item right. So this module maintains a SEPARATE, RAW cumulative count in
 * `UserProgress.misconceptionsByTopic` (outer key = topicKey, inner key = the
 * misconception TAG stripped of its `topicKey::` prefix).
 *
 * Everything here is PURE (returns fresh objects, never mutates its inputs) and
 * completely ISOLATED from mastery: bumping the tally NEVER touches θ/α/β, the
 * confident-mastery / unlock bars, or any gate. The targeted re-prep it drives
 * is likewise unscored (it never calls `recordItemAttempt` for the origin
 * topic), so re-prepping a specific mistake can never move mastery.
 *
 * Research: Bloom 1984 (name and drill the SPECIFIC recurring error); the
 * repeated-error count is the additive, decay-free companion to the mastery
 * layer's decayed flag.
 */

/** A tag must recur at least this many times in a topic to be surfaced. */
export const REPEATED_MISTAKE_THRESHOLD = 3;

/** Per-topic raw misconception-frequency map (the `UserProgress` field's shape). */
export type MisconceptionTally = Record<string, Record<string, number>>;

/**
 * Immutably increment the RAW per-topic tally for each namespaced misconception
 * KEY the attempt tripped. The keys are the same `${topicKey}::${tag}` strings
 * fed to `recordItemAttempt`; the `topicKey::` prefix is stripped so the inner
 * key is the bare TAG. An empty `keys` array (a correct answer) returns the
 * tally unchanged (a shallow clone, preserving purity). NEVER decays existing
 * counts — this map is the decay-free record.
 */
export function bumpTopicMisconceptions(
  tally: MisconceptionTally | undefined,
  topicKey: string,
  namespacedKeys: readonly string[] | undefined,
): MisconceptionTally {
  const next: MisconceptionTally = { ...(tally ?? {}) };
  if (!namespacedKeys || namespacedKeys.length === 0) return next;
  const inner: Record<string, number> = { ...(next[topicKey] ?? {}) };
  for (const key of namespacedKeys) {
    const tag = misconceptionTagOf(key);
    if (!tag) continue;
    inner[tag] = (inner[tag] ?? 0) + 1;
  }
  next[topicKey] = inner;
  return next;
}

/** One surfaced repeated mistake: the tag, its count, and a learner-facing label. */
export interface RepeatedMistake {
  /** The bare misconception tag (inner key of the tally). */
  tag: string;
  /** How many times this specific mistake was made in the topic. */
  count: number;
  /**
   * Short, human-readable description of the mistake (from
   * `MISCONCEPTION_LABELS`). A deterministic fallback (`idx:` / `err:`) or an
   * unknown tag has no friendly label and is EXCLUDED from the surfaced list —
   * we only ever plainly name a mistake we can actually describe.
   */
  label: string;
}

/**
 * The repeated mistakes for `topicKey` whose RAW count meets `threshold`,
 * ordered by count (desc), then tag (asc) for stability. ONLY tags with a
 * concrete human-readable {@link MISCONCEPTION_LABELS} description are returned:
 * we never tell a learner "you made mistake `idx:2` 4 times". Pure read.
 */
export function repeatedMistakesForTopic(
  tally: MisconceptionTally | undefined,
  topicKey: string,
  threshold: number = REPEATED_MISTAKE_THRESHOLD,
): RepeatedMistake[] {
  const inner = tally?.[topicKey];
  if (!inner) return [];
  const out: RepeatedMistake[] = [];
  for (const [tag, count] of Object.entries(inner)) {
    if (count < threshold) continue;
    const label = MISCONCEPTION_LABELS[tag];
    if (!label) continue; // only surface describable, semantic mistakes
    out.push({ tag, count, label });
  }
  return out.sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/**
 * A plain sentence naming the repeated mistake, e.g. "Adding for “A or B”
 * without subtracting the overlap — 4 times." Deterministic; the optional LLM
 * reword layer may rephrase it but never changes which mistake is named.
 */
export function describeRepeatedMistake(m: RepeatedMistake): string {
  return `${m.label} — ${m.count} times.`;
}
