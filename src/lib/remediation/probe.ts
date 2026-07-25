import { getLevel } from "@/content";
import { materializeLevel, materializeNumericLevel } from "@/content/materialize";
import {
  isNumericLevel,
  type Level,
  type NumericQuestion,
  type Question,
} from "@/types/content";
import { prereqNode } from "@/content/remediation/prereqDAG";

/**
 * Materialize ONE probe / corrective item for a DAG node from its `levelRef`
 * (PHASE_4 §3). Deterministic in `seed`. Returns the resolved level too so the
 * lesson player can reuse the SAME `QuizCard`/`NumericCard` + Phase-2 hint
 * ladder for the corrective content (PHASE_4 §6). Flashcard levels have no
 * quiz/numeric item ⇒ `null` (the flow falls back to a worked-example teach).
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
): ProbeItem | null {
  const node = prereqNode(topicKey);
  if (!node) return null;
  const resolved = getLevel(node.levelRef.trackId, node.levelRef.levelId);
  if (!resolved) return null;
  const { level } = resolved;
  const base = { topicKey, trackId: node.levelRef.trackId, level };

  if (isNumericLevel(level)) {
    const qs = materializeNumericLevel(level, seed);
    if (!qs.length) return null;
    return { ...base, mode: "numeric", numericQuestion: qs[0] };
  }
  const qs = materializeLevel(level, seed);
  if (!qs.length) return null;
  return { ...base, mode: "quiz", question: qs[0] };
}
