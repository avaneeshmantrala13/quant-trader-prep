/**
 * TOPIC GROUPING — turn a track's flat, ordered level array into the list of
 * TOPICS shown by the in-page topic selector on the track map.
 *
 * A "topic" is a maximal CONTIGUOUS run of levels sharing the same `section`
 * value — the exact same boundary rule the per-section locking uses
 * (`@/lib/locking` `isFirstOfSection`) and the map's section-divider banners.
 * Because the content is authored EASIEST → HARDEST in data order, preserving
 * data order here gives the correct difficulty order for free: the topic's
 * position in the returned array (1-based) is its difficulty `rank`, which the
 * selector surfaces as the "Level N — <topic>" label.
 *
 * This is intentionally data-driven: nothing about the specific topics (Core
 * Probability, Combinatorial Analysis, …) is hard-coded, so the selector stays
 * correct if content is added, removed, or reordered later.
 *
 * Tracks whose levels carry NO `section` (Mental Math, Brainteasers, Interview
 * Games) collapse to a single topic — callers hide the selector when there is
 * 0/1 topic, so those tracks render exactly as before.
 */

/** The minimal shape needed to group levels into topics. */
export interface TopicLevel {
  /** Optional subcategory/section label (a maximal contiguous run = one topic). */
  section?: string;
}

/** One topic = a contiguous run of levels sharing the same `section`. */
export interface Topic {
  /** The shared `section` label, or `undefined` for an unlabeled run. */
  section?: string;
  /** Display label: the section name, or a fallback for unlabeled runs. */
  label: string;
  /** 1-based difficulty rank = position in data (curriculum) order. */
  rank: number;
  /** Global index of this topic's FIRST level (inclusive). */
  startIndex: number;
  /** Global index of this topic's LAST level (inclusive). */
  endIndex: number;
  /** Number of levels in the topic. */
  count: number;
  /** Stable, URL-safe id (for `?topic=` persistence). Unique within a track. */
  slug: string;
}

/** Lower-case, hyphenated, URL-safe token from an arbitrary label. */
function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "topic"
  );
}

/**
 * Group an ordered level array into its contiguous-section topics, IN DATA
 * ORDER (which equals difficulty order). Returns one {@link Topic} per maximal
 * run of levels sharing the same `section`. Slugs are guaranteed unique within
 * the returned list.
 */
export function groupLevelsIntoTopics(
  levels: readonly TopicLevel[],
): Topic[] {
  const topics: Topic[] = [];

  levels.forEach((level, i) => {
    const isStart = i === 0 || level.section !== levels[i - 1].section;
    if (isStart) {
      const rank = topics.length + 1;
      topics.push({
        section: level.section,
        label: level.section ?? `Section ${rank}`,
        rank,
        startIndex: i,
        endIndex: i,
        count: 1,
        slug: "", // filled after boundaries are known
      });
    } else {
      const cur = topics[topics.length - 1];
      cur.endIndex = i;
      cur.count += 1;
    }
  });

  // Assign stable, unique slugs (section-name based, so they survive reorders).
  const seen = new Map<string, number>();
  for (const t of topics) {
    let slug = slugify(t.label);
    const dupes = seen.get(slug) ?? 0;
    seen.set(slug, dupes + 1);
    if (dupes > 0) slug = `${slug}-${dupes + 1}`;
    t.slug = slug;
  }

  return topics;
}

/**
 * The default topic to show: the earliest topic that still has an UN-mastered
 * level given the learner's progress (i.e. their current in-progress topic).
 * Falls back to the first topic when everything is mastered (or there are no
 * levels), so a returning power-user simply lands on Level 1.
 */
export function firstIncompleteTopic(
  topics: readonly Topic[],
  isMastered: (levelIndex: number) => boolean,
): Topic | undefined {
  if (topics.length === 0) return undefined;
  for (const t of topics) {
    for (let i = t.startIndex; i <= t.endIndex; i++) {
      if (!isMastered(i)) return t;
    }
  }
  return topics[0];
}
