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
 * Builds a drill of EXISTING, exact-verified questions matching a {@link DrillSpec}
 * (topics × difficulty band × count). This is a runtime cousin of the
 * diagnostic's `drawSlotItems`: it never authors new content — it re-runs the
 * matching levels' own generators/pools via `materializeLevel` /
 * `materializeNumericLevel` (numeric → MCQ via `numericToMcq`, so the drill is a
 * uniform MCQ flow). SELF-CONTAINED: pure, deterministic per seed, and it never
 * touches mastery / unlock / resume storage.
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
 * Assemble a drill from the spec. Allocates `count` questions round-robin across
 * the matching levels (so a multi-topic request stays balanced), drawing fresh
 * exact-verified items from each level's own generators. Deterministic for a
 * given `(spec, seed)`.
 */
export function assembleDrill(spec: DrillSpec, seed: number): Question[] {
  const levels = matchingLevels(spec);
  if (levels.length === 0 || spec.count <= 0) return [];

  const rng = new Rng(seed);
  // Shuffle level order so repeated draws with different seeds vary which topic
  // leads, then materialize each level's pool once.
  const ordered = rng.shuffle(levels);
  const pools = ordered.map((c, i) =>
    rng.shuffle(drawFromLevel(c.level, seed + i * 1009 + 13)),
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
