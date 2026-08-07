import { PLAYABLE_TRACKS } from "@/content";
import { materializeLevel, materializeNumericLevel } from "@/content/materialize";
import { numericToMcq } from "@/content/diagnostic/items";
import { Rng } from "@/lib/rng";
import {
  DIFFICULTY_META,
  isFlashcardLevel,
  isNumericLevel,
  type Level,
  type Question,
} from "@/types/content";
import { topicKeyForLevel } from "@/lib/mastery/topicKey";
import type { DrillSpec } from "./parseIntent";

/**
 * Custom Drill Builder — the assembler.
 *
 * Builds a drill of freshly generated, exact-solver-checked questions matching a
 * {@link DrillSpec} (topics × difficulty band × count). This is a runtime cousin
 * of the diagnostic's `drawSlotItems`: it never authors new content — it re-runs
 * the matching levels' own generators/pools via `materializeLevel` /
 * `materializeNumericLevel` (numeric → MCQ via `numericToMcq`, so the drill is a
 * uniform MCQ flow). SELF-CONTAINED: pure, deterministic per seed, and it never
 * touches mastery / unlock / resume storage.
 *
 * A lesson only shows ~`questionCount` items per level, but a drill may ask for
 * many more (e.g. "37 questions on markov"). Since the parametric generators can
 * emit far more unique items than one lesson pass, we re-materialize each level
 * with fresh seeds and dedup by content signature until it either satisfies the
 * request or is exhausted — so a single generator-backed topic can still reach a
 * large count. When a topic genuinely can't produce the full request (e.g. a
 * small static pool), we return every unique item available and let the caller
 * report the honest, smaller count.
 *
 * Flashcard levels are skipped (no MCQ form). If nothing matches, returns `[]`
 * and the caller shows a "no questions matched" hint.
 */

interface CandidateLevel {
  trackId: string;
  level: Level;
}

/** Levels whose topic + difficulty fall inside the spec, in content order. */
function matchingLevels(spec: DrillSpec): CandidateLevel[] {
  const wanted = new Set(spec.topicKeys);
  const out: CandidateLevel[] = [];
  for (const track of PLAYABLE_TRACKS) {
    for (const level of track.levels) {
      if (isFlashcardLevel(level)) continue; // no MCQ form
      const topicKey = topicKeyForLevel(track.id, level);
      if (!wanted.has(topicKey)) continue;
      const order = DIFFICULTY_META[level.difficulty].order;
      if (order < spec.minOrder || order > spec.maxOrder) continue;
      out.push({ trackId: track.id, level });
    }
  }
  return out;
}

/** Materialize one level into MCQ questions (numeric levels are converted). */
function drawFromLevel(level: Level, seed: number): Question[] {
  if (isNumericLevel(level)) {
    return materializeNumericLevel(level, seed)
      .map((q, i) => numericToMcq(q, seed + i * 101 + 7))
      .filter((q): q is Question => q !== null);
  }
  return materializeLevel(level, seed);
}

/**
 * Collect up to `target` UNIQUE questions from a SINGLE level by re-running its
 * generator with fresh seeds and deduping by content signature.
 *
 * `materializeLevel` caps one pass at the level's `questionCount` (~5, sized for
 * a lesson), so to reach a larger drill we pass it repeatedly. A parametric
 * generator keeps yielding new parameterizations; a fixed/static pool is
 * exhausted once every distinct item has been seen. We stop as soon as we hit
 * `target` OR several consecutive passes add nothing new — the latter is the
 * level's TRUE unique capacity, so we never spin and never fabricate content.
 */
function collectFromLevel(
  level: Level,
  baseSeed: number,
  target: number,
): Question[] {
  const out: Question[] = [];
  const seen = new Set<string>();
  // Bound the work: each pass yields ~questionCount items. `stale` short-circuits
  // an exhausted level; MAX_PASSES is a hard backstop for pathological cases.
  const MAX_PASSES = Math.max(60, target * 4);
  const STALE_LIMIT = 15;
  let stale = 0;
  for (let pass = 0; pass < MAX_PASSES && out.length < target && stale < STALE_LIMIT; pass++) {
    const batch = drawFromLevel(level, baseSeed + pass * 7919 + 1);
    let added = 0;
    for (const q of batch) {
      if (out.length >= target) break;
      const sig = `${q.prompt}::${q.correctIndex}`;
      if (seen.has(sig)) continue;
      seen.add(sig);
      out.push(q);
      added++;
    }
    stale = added === 0 ? stale + 1 : 0;
  }
  return out;
}

/**
 * Assemble a drill from the spec. Allocates `count` questions round-robin across
 * the matching levels (so a multi-topic request stays balanced), drawing fresh
 * exact-solver-checked items from each level's own generators. Deterministic for
 * a given `(spec, seed)`. Returns as many UNIQUE questions as the topics can
 * produce, up to `count` — fewer only when the topics are genuinely exhausted.
 */
export function assembleDrill(spec: DrillSpec, seed: number): Question[] {
  const levels = matchingLevels(spec);
  if (levels.length === 0 || spec.count <= 0) return [];

  const rng = new Rng(seed);
  // Shuffle level order so repeated draws with different seeds vary which topic
  // leads, then gather each level's unique items (up to the full request, so a
  // single-level topic can still satisfy a large count).
  const ordered = rng.shuffle(levels);
  const pools = ordered.map((c, i) =>
    rng.shuffle(collectFromLevel(c.level, seed + i * 1009 + 13, spec.count)),
  );

  // Round-robin pull across pools until we hit `count` or exhaust every pool.
  const picked: Question[] = [];
  const seenSig = new Set<string>();
  const cursors = new Array(pools.length).fill(0);
  let progressed = true;
  while (picked.length < spec.count && progressed) {
    progressed = false;
    for (let p = 0; p < pools.length && picked.length < spec.count; p++) {
      const pool = pools[p];
      while (cursors[p] < pool.length) {
        const q = pool[cursors[p]++];
        const sig = `${q.prompt}::${q.correctIndex}`;
        if (seenSig.has(sig)) continue;
        seenSig.add(sig);
        picked.push(q);
        progressed = true;
        break;
      }
    }
  }
  return picked;
}
