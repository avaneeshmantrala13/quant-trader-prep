import { getLevel, getTrack } from "@/content";
import { materializeLevel, materializeNumericLevel } from "@/content/materialize";
import {
  DIFFICULTY_META,
  isFlashcardLevel,
  isNumericLevel,
  type Difficulty,
  type Level,
  type NumericQuestion,
  type Question,
} from "@/types/content";
import { topicKeyForLevel } from "@/lib/mastery/topicKey";
import { prereqNode, type PrereqNode } from "@/content/remediation/prereqDAG";

/**
 * Materialize ONE probe / corrective item for a DAG node (PHASE_4 §3).
 * Deterministic in `seed`. Returns the resolved level too so the lesson player
 * can reuse the SAME `QuizCard`/`NumericCard` + Phase-2 hint ladder for the
 * corrective content (PHASE_4 §6). Flashcard levels have no quiz/numeric item ⇒
 * `null` (the flow falls back to a worked-example teach).
 *
 * PROBE TIER (Wilson 85% Rule): when a `probeTier` is supplied — the tier the
 * policy's `probeTierFor` targeted at ~0.85 predicted success — the probe is
 * served from the level in the node's OWN topic (same track+section, so the
 * mastery it writes lands in the node's bucket) whose difficulty is closest to
 * that tier, instead of always materializing the node's fixed easy `levelRef`.
 * If the node has no such tier variant (or the picked level yields nothing) the
 * probe DEGRADES GRACEFULLY to the fixed `levelRef` — it never crashes or serves
 * nothing. Omitting `probeTier` preserves the original `levelRef` behavior.
 */
export interface ProbeItem {
  topicKey: string;
  trackId: string;
  level: Level;
  mode: "quiz" | "numeric";
  question?: Question;
  numericQuestion?: NumericQuestion;
}

export function buildProbeItem(
  topicKey: string,
  seed: number,
  probeTier?: Difficulty,
): ProbeItem | null {
  const node = prereqNode(topicKey);
  if (!node) return null;
  // External drill/game nodes (Speed Arena, Sequences, No-Arbitrage, Fermi, …)
  // have no registered `levelRef`: they exist only to ROUTE a failure down to a
  // real prerequisite, and are never themselves probed in place.
  if (!node.levelRef) return null;

  const tierLevel = resolveProbeLevel(node, probeTier);
  if (tierLevel) {
    const item = materializeProbe(topicKey, node.levelRef.trackId, tierLevel, seed);
    if (item) return item;
  }

  // Graceful degradation: the tier-selected level yielded nothing (or none was
  // resolvable) ⇒ fall back to the node's fixed foundational `levelRef`.
  const base = getLevel(node.levelRef.trackId, node.levelRef.levelId)?.level;
  if (base && base !== tierLevel) {
    return materializeProbe(topicKey, node.levelRef.trackId, base, seed);
  }
  return null;
}

/** Build a ProbeItem from a concrete level, or `null` if it serves no item. */
function materializeProbe(
  topicKey: string,
  trackId: string,
  level: Level,
  seed: number,
): ProbeItem | null {
  const base = { topicKey, trackId, level };
  if (isNumericLevel(level)) {
    const qs = materializeNumericLevel(level, seed);
    if (!qs.length) return null;
    return { ...base, mode: "numeric", numericQuestion: qs[0] };
  }
  if (isFlashcardLevel(level)) return null;
  const qs = materializeLevel(level, seed);
  if (!qs.length) return null;
  return { ...base, mode: "quiz", question: qs[0] };
}

/**
 * Choose the level to draw a probe from for `node` at `probeTier`:
 *  - No `probeTier` ⇒ the node's fixed `levelRef` (original behavior).
 *  - Otherwise the level within the node's OWN topic (same `topicKey`, i.e. same
 *    track+section, and non-flashcard) whose difficulty order is CLOSEST to the
 *    target tier. Ties break to the EASIER tier, then to the earlier level in
 *    track order (Vygotsky: never overshoot the ZPD). `levelRef` is always a
 *    candidate, so this can never return nothing when the base resolves.
 */
function resolveProbeLevel(
  node: PrereqNode,
  probeTier?: Difficulty,
): Level | undefined {
  if (!node.levelRef) return undefined;
  const base = getLevel(node.levelRef.trackId, node.levelRef.levelId)?.level;
  if (!base || !probeTier) return base;

  const track = getTrack(node.levelRef.trackId);
  if (!track) return base;

  const candidates = track.levels.filter(
    (l) =>
      topicKeyForLevel(track.id, l) === node.topicKey && !isFlashcardLevel(l),
  );
  if (!candidates.length) return base;

  const target = DIFFICULTY_META[probeTier].order;
  let best = candidates[0];
  let bestDist = Infinity;
  for (const l of candidates) {
    const dist = Math.abs(DIFFICULTY_META[l.difficulty].order - target);
    const isBetter =
      dist < bestDist ||
      (dist === bestDist &&
        DIFFICULTY_META[l.difficulty].order <
          DIFFICULTY_META[best.difficulty].order);
    if (isBetter) {
      best = l;
      bestDist = dist;
    }
  }
  return best;
}
