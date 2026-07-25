import type { Question } from "@/types/content";

/**
 * Self-explanation MCQ builder (PHASE_2 §4/§5).
 *
 * Research anchor: Chi, Bassok, Lewis, Reimann & Glaser 1989 / Chi et al. 1994 —
 * the self-explanation effect: prompting learners to explain WHY a step works is
 * the mechanism that turns a worked example into transferable understanding.
 *
 * A faded blank is graded deterministically by asking the learner to pick the
 * correct REASON from the item's own stored rationales (the correct-choice
 * rationale is the right explanation; the distractor rationales are plausible
 * wrong reasons). No LLM: the verifier is the stored `correctIndex`. Phase 7 may
 * later grade a free-text self-explanation, but the flag-OFF path is this MCQ.
 */

export interface SelfExplainMCQ {
  prompt: string;
  options: string[];
  correctIndex: number;
}

/**
 * Build a "why did this step work?" MCQ from an item's `distractorRationale`
 * (parallel to `choices`). Options are the item's own rationales in choice
 * order; `correctIndex` points at the correct-choice rationale. Returns `null`
 * for items lacking usable rationales (fewer than two), so callers skip the
 * self-explanation prompt rather than showing a degenerate question.
 */
export function buildSelfExplainMCQ(question: Question): SelfExplainMCQ | null {
  const rationales = question.distractorRationale;
  if (!rationales || rationales.length < 2) return null;
  if (question.correctIndex < 0 || question.correctIndex >= rationales.length)
    return null;
  if (rationales.some((r) => !r || r.trim().length === 0)) return null;
  return {
    prompt:
      "Why is the correct answer correct? Pick the reasoning that actually justifies it:",
    options: rationales.slice(),
    correctIndex: question.correctIndex,
  };
}
