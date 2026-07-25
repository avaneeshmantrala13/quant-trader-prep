/**
 * Misconception-flag bookkeeping (PHASE_1 §5). On a WRONG answer the resolved
 * misconception keys are bumped; on a CORRECT answer in the topic all flags
 * decay (fading stale mistakes); remediation (Phase 4) clears a key after a
 * passed spaced-review. All functions are PURE — they return new objects and
 * never mutate the input map.
 */

/** flags[key] += 1 for each key (immutably). */
export function bumpMisconceptions(
  flags: Record<string, number>,
  keys: string[],
): Record<string, number> {
  if (keys.length === 0) return { ...flags };
  const next = { ...flags };
  for (const key of keys) {
    next[key] = (next[key] ?? 0) + 1;
  }
  return next;
}

/** Multiply every flag by `factor` (recency fade on a later correct answer). */
export function decayMisconceptions(
  flags: Record<string, number>,
  factor: number,
): Record<string, number> {
  const next: Record<string, number> = {};
  for (const [key, value] of Object.entries(flags)) {
    next[key] = value * factor;
  }
  return next;
}

/** Remove one key entirely (remediation climb-back pass). */
export function clearMisconception(
  flags: Record<string, number>,
  key: string,
): Record<string, number> {
  if (!(key in flags)) return { ...flags };
  const next = { ...flags };
  delete next[key];
  return next;
}

/** The `n` misconception keys with the highest decayed counts (desc). */
export function topMisconceptions(
  flags: Record<string, number>,
  n = 3,
): string[] {
  return Object.entries(flags)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([key]) => key);
}
