import { getLevel } from "@/content";
import { materializeLevel, materializeNumericLevel } from "@/content/materialize";
import { Rng } from "@/lib/rng";
import { isNumericLevel, type NumericQuestion, type Question } from "@/types/content";
import type { DiagnosticSlot } from "./blueprint";

/**
 * Draw a slot's diagnostic items by RE-USING the source level's existing
 * generator/pool (no new question content. PHASE_3 §3). Quiz-mode levels
 * materialize straight to MCQ; numeric-mode levels (e.g. Combinatorial Analysis
 * `ca-1`, Markov `mc-1`) are surfaced as MCQ by turning each item's AUTHORED
 * `commonErrors` (named misconceptions) into the distractors, so the diagnostic
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
 * Plausible, format-aware fallback distractors used ONLY to guarantee a numeric
 * item surfaces as a ≥ 4-option MCQ when its author supplied fewer than three
 * `commonErrors`. Each encodes a real slip (a complement (1 − p), a factor-of-
 * two, an off-by-one in the last place, a decimal-place shift), not a random
 * number. Probability answers stay strictly inside (0, 1) so the correct value
 * is never the lone in-range option; integer answers stay integers.
 */
function syntheticSlips(
  answer: number,
  decimals: number | undefined,
  unit: string,
): { value: number; rationale: string }[] {
  const isInt = decimals == null;
  const dp = decimals ?? 0;
  const f = 10 ** dp;
  const roundTo = (x: number) => Math.round(x * f) / f;
  // A probability lives in [0,1] with no currency/count unit.
  const isProb =
    !isInt && (unit === "" || unit === "prob") && answer >= 0 && answer <= 1;
  const step = isInt ? 1 : 1 / f;

  const raw: { value: number; rationale: string }[] = [];
  if (isProb) {
    raw.push({
      value: roundTo(1 - answer),
      rationale:
        "The complementary probability (1 − p): make sure you answered the event asked, not its complement.",
    });
  }
  raw.push(
    {
      value: isInt ? Math.round(answer * 2) : roundTo(answer * 2),
      rationale:
        "Twice the correct value: a factor-of-two slip (double-counting, or forgetting to halve).",
    },
    {
      value: isInt ? Math.round(answer / 2) : roundTo(answer / 2),
      rationale: "Half the correct value: a dropped factor of 2.",
    },
    {
      value: roundTo(answer + step),
      rationale: "Off by one in the last place: a rounding or boundary slip.",
    },
    {
      value: roundTo(answer - step),
      rationale: "Off by one in the last place: a rounding or boundary slip.",
    },
    {
      value: isInt ? answer * 10 : roundTo(answer * 10),
      rationale: "Off by a factor of ten: a decimal-place (place-value) slip.",
    },
    {
      value: isInt ? Math.round(answer / 10) : roundTo(answer / 10),
      rationale: "Off by a factor of ten: a decimal-place (place-value) slip.",
    },
  );

  const out: { value: number; rationale: string }[] = [];
  const seen = new Set<number>([Math.round(answer * f)]);
  for (const s of raw) {
    if (!Number.isFinite(s.value)) continue;
    if (isProb && (s.value <= 0 || s.value >= 1)) continue;
    if (!isProb && answer > 0 && s.value <= 0) continue;
    const k = Math.round(s.value * f);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
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
  // GUARANTEE ≥ 4 options: if the source authored fewer than three surviving
  // traps, pad with plausible, format-aware slips (see `syntheticSlips`).
  if (opts.length < 4) {
    for (const pad of syntheticSlips(q.answer, q.decimals, unit)) {
      const text = formatValue(pad.value, q.decimals, unit);
      if (seen.has(text)) continue;
      seen.add(text);
      opts.push({ text, rationale: pad.rationale, correct: false });
      if (opts.length >= 4) break;
    }
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
