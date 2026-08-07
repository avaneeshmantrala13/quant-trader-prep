import { getTrack } from "@/content";
import { materializeLevel, materializeNumericLevel } from "@/content/materialize";
import {
  isFlashcardLevel,
  isNumericLevel,
  type Level,
  type NumericQuestion,
  type Question,
} from "@/types/content";
import { topicKeyForLevel } from "@/lib/mastery/topicKey";
import { skillByKey } from "@/lib/roadmap/skillGraph";
import { prereqNode } from "@/content/remediation/prereqDAG";

/**
 * TARGETED REPEATED-MISTAKE re-prep item builder (ZPD; UNSCORED).
 *
 * Given a topic and a specific misconception TAG the learner has repeatedly
 * tripped, this assembles a small set of that topic's OWN questions that can trip
 * EXACTLY that mistake — i.e. items whose authored distractor (quiz) or common
 * error (numeric) carries the tag. The learner drills only that error mode.
 *
 * These items are re-prep ONLY: the caller renders them with the plain
 * `QuizCard`/`NumericCard` and NEVER calls `recordItemAttempt`, so this practice
 * can never move the mastery of any topic (exactly like bonus practice). This
 * module is pure content assembly — it reads the catalog + generators and never
 * touches progress.
 */

export interface TargetedItem {
  level: Level;
  mode: "quiz" | "numeric";
  question?: Question;
  numericQuestion?: NumericQuestion;
}

/** Does a quiz question have a distractor tagged with this misconception? */
function quizHasTag(q: Question, tag: string): boolean {
  return (q.misconceptions ?? []).some((t) => t === tag);
}

/** Does a numeric question have a common-error tagged with this misconception? */
function numericHasTag(q: NumericQuestion, tag: string): boolean {
  return (q.commonErrors ?? []).some((e) => e.misconception === tag);
}

/**
 * The scored (non-flashcard) levels of a topic + its trackId, resolved via the
 * skill graph (preferred, gives the real registered track) with a fallback to
 * the remediation node's `levelRef` track. `undefined` when the topic has no
 * registered scored level (an external drill/game stub).
 */
export function topicScoredLevels(
  topicKey: string,
): { trackId: string; levels: Level[] } | undefined {
  const skill = skillByKey(topicKey);
  const node = prereqNode(topicKey);
  const trackId =
    skill && !skill.external ? skill.trackId : node?.levelRef?.trackId;
  if (!trackId) return undefined;
  const track = getTrack(trackId);
  if (!track) return undefined;
  const levels = track.levels.filter(
    (l) => topicKeyForLevel(track.id, l) === topicKey && !isFlashcardLevel(l),
  );
  return levels.length ? { trackId, levels } : undefined;
}

/**
 * Build up to `count` UNSCORED practice items for `topicKey` that specifically
 * trip `tag`. Deterministic in `seed`: it re-materializes the topic's levels
 * across a few seed offsets and keeps the questions whose authored error modes
 * carry the tag, de-duplicated by prompt. Returns fewer than `count` (possibly
 * empty) when the tag is rare/absent — the caller then degrades gracefully.
 */
export function buildTargetedMistakeItems(
  topicKey: string,
  tag: string,
  seed: number,
  count = 4,
): TargetedItem[] {
  const resolved = topicScoredLevels(topicKey);
  if (!resolved) return [];

  const out: TargetedItem[] = [];
  const seenPrompts = new Set<string>();
  const push = (item: TargetedItem, prompt: string) => {
    if (seenPrompts.has(prompt)) return;
    seenPrompts.add(prompt);
    out.push(item);
  };

  for (let attempt = 0; attempt < 24 && out.length < count; attempt++) {
    const s = (seed + attempt * 100003) % 2_000_000_000;
    for (const level of resolved.levels) {
      if (out.length >= count) break;
      if (isNumericLevel(level)) {
        for (const q of materializeNumericLevel(level, s)) {
          if (numericHasTag(q, tag)) push({ level, mode: "numeric", numericQuestion: q }, q.prompt);
          if (out.length >= count) break;
        }
      } else {
        for (const q of materializeLevel(level, s)) {
          if (quizHasTag(q, tag)) push({ level, mode: "quiz", question: q }, q.prompt);
          if (out.length >= count) break;
        }
      }
    }
  }
  return out.slice(0, count);
}
