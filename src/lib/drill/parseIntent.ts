import { DIFFICULTY_META, type Difficulty } from "@/types/content";
import { DRILL_TOPICS, type DrillTopic } from "./vocabulary";

/**
 * Custom Drill Builder — deterministic intent parser (the backbone).
 *
 * Pure and offline: turns free text like "bayes and EV problems, mid-level, 15
 * questions" into a structured {@link DrillSpec}. The optional LLM parser
 * (`aiIntent.ts`) is layered ON TOP and its output is snapped back onto this
 * same vocabulary — so this file is the single source of truth for what a spec
 * can contain. No question content is touched here; the assembler consumes the
 * spec.
 */
export interface DrillSpec {
  /** Canonical `topicKey`s the drill draws from. Empty ⇒ "no match". */
  topicKeys: string[];
  /** Inclusive difficulty band as `DIFFICULTY_META.order` (0=intro … 4=expert). */
  minOrder: number;
  maxOrder: number;
  /** Number of questions requested (already clamped to [MIN, MAX]). */
  count: number;
}

export const DRILL_COUNT_MIN = 5;
export const DRILL_COUNT_MAX = 25;
export const DRILL_COUNT_DEFAULT = 10;

const MAX_ORDER = DIFFICULTY_META.expert.order; // 4

/** Normalize to lowercase with runs of non-alphanumerics collapsed to spaces. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Difficulty band keywords → an inclusive `[minOrder, maxOrder]` window. When
 * several bands are mentioned we take the union (min of mins, max of maxes) so
 * "easy to hard" spans the whole range. No band keyword ⇒ full range.
 */
const BAND_KEYWORDS: { words: string[]; min: number; max: number }[] = [
  { words: ["intro", "beginner", "starter", "warm up", "warmup", "basic", "easiest"], min: 0, max: 1 },
  { words: ["easy", "simple", "gentle"], min: 1, max: 1 },
  {
    words: ["mid", "medium", "intermediate", "moderate", "mid level", "mid tier"],
    min: 2,
    max: 2,
  },
  { words: ["hard", "tough", "challenging", "difficult", "advanced"], min: 3, max: 3 },
  { words: ["expert", "hardest", "brutal", "insane", "extreme"], min: 4, max: 4 },
];

function parseDifficultyBand(norm: string): { minOrder: number; maxOrder: number } {
  const hits = BAND_KEYWORDS.filter((b) =>
    b.words.some((w) => norm.includes(w)),
  );
  if (hits.length === 0) return { minOrder: 0, maxOrder: MAX_ORDER };
  return {
    minOrder: Math.min(...hits.map((h) => h.min)),
    maxOrder: Math.max(...hits.map((h) => h.max)),
  };
}

/** First standalone integer in the text (e.g. "15 questions" → 15), if any. */
function parseCount(norm: string): number {
  const m = norm.match(/\b(\d{1,3})\b/);
  if (!m) return DRILL_COUNT_DEFAULT;
  const n = parseInt(m[1], 10);
  if (!Number.isFinite(n)) return DRILL_COUNT_DEFAULT;
  return Math.max(DRILL_COUNT_MIN, Math.min(DRILL_COUNT_MAX, n));
}

/** Every topic whose alias (or label) appears as a substring of the text. */
function matchTopics(norm: string): DrillTopic[] {
  const matched: DrillTopic[] = [];
  for (const t of DRILL_TOPICS) {
    const needles = [normalize(t.label), ...t.aliases.map(normalize)];
    if (needles.some((n) => n.length > 0 && norm.includes(n))) {
      matched.push(t);
    }
  }
  return matched;
}

/**
 * Parse a free-text drill request into a {@link DrillSpec}. Deterministic —
 * same input always yields the same spec. Returns `topicKeys: []` when nothing
 * matched (the UI then shows a "no topics matched" hint); the difficulty band
 * and count are still parsed so a retype only needs the topic fixed.
 */
export function parseDrillIntent(text: string): DrillSpec {
  const norm = normalize(text ?? "");
  const topics = matchTopics(norm);
  const { minOrder, maxOrder } = parseDifficultyBand(norm);
  const count = parseCount(norm);
  // Dedup topicKeys while preserving first-seen order.
  const seen = new Set<string>();
  const topicKeys: string[] = [];
  for (const t of topics) {
    if (!seen.has(t.topicKey)) {
      seen.add(t.topicKey);
      topicKeys.push(t.topicKey);
    }
  }
  return { topicKeys, minOrder, maxOrder, count };
}

/** Human-readable band label for the resolved-spec confirmation. */
export function bandLabel(minOrder: number, maxOrder: number): string {
  const order = (o: number): Difficulty =>
    (Object.keys(DIFFICULTY_META) as Difficulty[]).find(
      (d) => DIFFICULTY_META[d].order === o,
    ) ?? "medium";
  if (minOrder <= 0 && maxOrder >= MAX_ORDER) return "all levels";
  if (minOrder === maxOrder) return DIFFICULTY_META[order(minOrder)].label;
  return `${DIFFICULTY_META[order(minOrder)].label}–${DIFFICULTY_META[order(maxOrder)].label}`;
}
