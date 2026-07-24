import { Rng } from "@/lib/rng";
import type { Level, NumericQuestion, Question } from "@/types/content";
import { singleFamilyId } from "./mixFamilies";

/** Shuffle a static question's choices, remapping correctIndex + rationale. */
function shuffleChoices(q: Question, rng: Rng): Question {
  const order = rng.shuffle(q.choices.map((_, i) => i));
  const choices = order.map((i) => q.choices[i]);
  const correctIndex = order.indexOf(q.correctIndex);
  const distractorRationale = q.distractorRationale
    ? order.map((i) => q.distractorRationale![i])
    : undefined;
  return { ...q, choices, correctIndex, distractorRationale };
}

/**
 * Produce the concrete question set for a level attempt from a seed. Generator
 * levels yield fresh, exact items; static levels are sampled and choice-shuffled
 * so answer positions never leak. The seed makes this reproducible for
 * save/resume.
 */
export function materializeLevel(level: Level, seed: number): Question[] {
  const rng = new Rng(seed);

  if (level.generator) {
    const count = level.questionCount ?? 5;
    // Mix generators stamp `family` themselves; a raw single generator does not,
    // so derive its one stable family id and stamp it here. This lets the quiz
    // player pass the current item's family to "Generate another like this".
    const singleFam = singleFamilyId(level.generator);
    const stamp = (q: Question): Question =>
      q.family || !singleFam ? q : { ...q, family: singleFam };
    const out: Question[] = [];
    const seen = new Set<string>();
    let guard = 0;
    while (out.length < count && guard < count * 20) {
      guard++;
      const q = stamp(level.generator(rng));
      if (seen.has(q.id)) continue;
      seen.add(q.id);
      out.push({ ...q, id: `${q.id}-${out.length}` });
    }
    // If uniqueness couldn't fill the count (tiny param space), allow repeats.
    while (out.length < count) {
      const q = stamp(level.generator(rng));
      out.push({ ...q, id: `${q.id}-${out.length}` });
    }
    return out;
  }

  if (level.questions) {
    const pool = rng.shuffle(level.questions);
    const drawn =
      level.drawCount && level.drawCount < pool.length
        ? pool.slice(0, level.drawCount)
        : pool;
    return drawn.map((q) => shuffleChoices(q, rng));
  }

  return [];
}

/**
 * Produce the concrete numeric question set for a `"numeric"` level attempt.
 * Mirrors `materializeLevel` for the free-entry (Kelly) mode: generator levels
 * yield fresh, exact items with unique ids; static pools are sampled. The seed
 * makes this reproducible for save/resume.
 */
export function materializeNumericLevel(
  level: Level,
  seed: number,
): NumericQuestion[] {
  const rng = new Rng(seed);

  if (level.numericGenerator) {
    const count = level.questionCount ?? 5;
    const singleFam = singleFamilyId(level.numericGenerator);
    const stamp = (q: NumericQuestion): NumericQuestion =>
      q.family || !singleFam ? q : { ...q, family: singleFam };
    const out: NumericQuestion[] = [];
    const seen = new Set<string>();
    let guard = 0;
    while (out.length < count && guard < count * 40) {
      guard++;
      const q = stamp(level.numericGenerator(rng));
      if (seen.has(q.id)) continue;
      seen.add(q.id);
      out.push({ ...q, id: `${q.id}-${out.length}` });
    }
    while (out.length < count) {
      const q = stamp(level.numericGenerator(rng));
      out.push({ ...q, id: `${q.id}-${out.length}` });
    }
    return out;
  }

  if (level.numericQuestions) {
    const pool = rng.shuffle(level.numericQuestions);
    return level.drawCount && level.drawCount < pool.length
      ? pool.slice(0, level.drawCount)
      : pool;
  }

  return [];
}
