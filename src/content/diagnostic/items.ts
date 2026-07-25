import { getLevel } from "@/content";
import { materializeLevel, materializeNumericLevel } from "@/content/materialize";
import { Rng } from "@/lib/rng";
import { isNumericLevel, type NumericQuestion, type Question } from "@/types/content";
import type { DiagnosticSlot } from "./blueprint";

/**
 * Draw a slot's diagnostic items by RE-USING the source level's existing
 * generator/pool (no new question content — PHASE_3 §3). Quiz-mode levels
 * materialize straight to MCQ; numeric-mode levels (e.g. Combinatorial Analysis
 * `ca-1`, Markov `mc-1`) are surfaced as MCQ by turning each item's AUTHORED
 * `commonErrors` (named misconceptions) into the distractors — so the diagnostic
 * stays a single MCQ flow and the traps remain the misconception probes.
 */
export function drawSlotItems(slot: DiagnosticSlot, seed: number): Question[] {
  const found = getLevel(slot.trackId, slot.levelId);
  if (!found) return [];

  if (isNumericLevel(found.level)) {
    return materializeNumericLevel(found.level, seed)
      .map((q, i) => numericToMcq(q, seed + i * 101 + 7))
      .filter((q): q is Question => q !== null)
      .slice(0, slot.itemsPerTopic);
  }

  return materializeLevel(found.level, seed).slice(0, slot.itemsPerTopic);
}

/** Format a numeric answer/distractor for display, respecting decimals + unit. */
function formatValue(value: number, decimals: number | undefined, unit: string): string {
  const num = decimals != null ? value.toFixed(decimals) : String(value);
  return unit ? `${unit}${num}` : num;
}

/**
 * Convert a free-entry `NumericQuestion` into a multiple-choice `Question`:
 * the correct value plus up to three authored `commonErrors` become the
 * choices (shuffled by seed), each `commonError.feedback` becomes its
 * distractor rationale, and any authored `commonError.misconception` tag flows
 * through as `misconceptions[i]`. Returns `null` when there is not enough to
 * form a ≥2-choice MCQ (never happens for the diagnostic's source levels, which
 * always author three named traps).
 */
export function numericToMcq(q: NumericQuestion, seed: number): Question | null {
  const unit = q.unit ?? "";
  const correctText = formatValue(q.answer, q.decimals, unit);

  type Opt = { text: string; rationale?: string; misconception?: string; correct: boolean };
  const opts: Opt[] = [{ text: correctText, correct: true }];
  const seen = new Set<string>([correctText]);
  for (const e of q.commonErrors ?? []) {
    const text = formatValue(e.value, q.decimals, unit);
    if (seen.has(text)) continue;
    seen.add(text);
    opts.push({
      text,
      rationale: e.feedback,
      misconception: e.misconception,
      correct: false,
    });
    if (opts.length >= 4) break;
  }
  if (opts.length < 2) return null;

  const rng = new Rng(seed);
  const order = rng.shuffle(opts.map((_, i) => i));
  const shuffled = order.map((i) => opts[i]);

  return {
    id: `${q.id}-mcq`,
    prompt: q.prompt,
    choices: shuffled.map((o) => o.text),
    correctIndex: shuffled.findIndex((o) => o.correct),
    explanation: q.explanation,
    difficulty: q.difficulty,
    concept: q.concept,
    distractorRationale: shuffled.map((o) => o.rationale ?? ""),
    // Parallel to `choices`: authored trap tag where present, else "" (the run
    // layer falls back to the slot's authored misconception tag on a miss).
    misconceptions: shuffled.map((o) => o.misconception ?? ""),
    source: q.source,
  };
}
