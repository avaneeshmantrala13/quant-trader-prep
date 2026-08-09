import type { NumericQuestion } from "@/types/content";
import { Rng } from "@/lib/rng";
import {
  HARD_OA_BUILDERS,
  valueOf,
  type Built,
} from "@/lib/oa/hardContent/generators";
import { parseFreeResponse } from "@/lib/numeric";

/**
 * FREE-RESPONSE ADAPTERS for the hard OA archetypes (spec §5.1 "Gap for the
 * pipeline", P3 bullet 2).
 *
 * The untimed diagnostic (Stage 2) is FREE-RESPONSE, but every hard OA archetype
 * in `./generators.ts` emits an MCQ (`choices` / `correctIndex`). Rather than
 * author any new math, this module is a THIN, additive adapter: it runs an
 * existing `build*` helper (whose answer is already computed by the EXACT
 * verifier in `./solvers.ts`) and re-shapes the result as a
 * {@link NumericQuestion} that the free-response numeric grader
 * (`numericMatches` / `gradeFreeResponse` in `@/lib/numeric`) can grade:
 *
 *   • `answer`   = the generator's EXACT verifier answer (`valueOf(built.answer)`),
 *                  the SAME value the marked-correct MCQ choice carries.
 *   • `commonErrors` = the generator's own DISTRACTORS (parsed from the non-correct
 *                  MCQ choices), each keeping its authored `distractorRationale`
 *                  as the misconception feedback, so a learner who types a
 *                  classic wrong value still gets the trap explained.
 *
 * No verifier is re-implemented and no answer is hardcoded — the adapter is a
 * pure re-projection of `build*`'s output. `frAdapters.test.ts` cross-checks
 * that the adapted answer equals both the verifier answer AND the value of the
 * marked-correct MCQ choice for every family (incl. the probabilistic ones).
 */

/**
 * Grading precision for a NON-INTEGER adapted answer. The exact verifier answers
 * are rationals (probabilities, EVs, hitting times); we grade at 4 dp so an
 * exact fraction entry (`"3273/4096"`), the 4-dp decimal, and the 3-dp rounded
 * decimal (via `gradeFreeResponse`'s thousandth fallback) all match, while the
 * generator's realistic distractors stay distinct. Integer answers keep the
 * strict exact-match path (`decimals` omitted).
 */
export const FR_DECIMALS = 4;

/** The exact verifier answer's grading precision: integer ⇒ exact, else 4 dp. */
export function frDecimalsFor(answer: number): number | undefined {
  return Number.isInteger(answer) ? undefined : FR_DECIMALS;
}

/** Do two values agree at the adapter's grading precision (for distractor dedupe)? */
function sameAtPrecision(a: number, b: number, decimals: number | undefined): boolean {
  if (decimals == null) return a === b;
  const f = 10 ** decimals;
  return Math.round(a * f) === Math.round(b * f);
}

/** The result of adapting one hard MCQ archetype to a free-response item. */
export interface FrAdapterResult {
  /** The free-response question the diagnostic serves + grades. */
  question: NumericQuestion;
  /** The EXACT verifier answer (=== `question.answer`), for tests/audits. */
  answer: number;
  /** The underlying MCQ (for the MC cross-check in tests). */
  mcq: Built["question"];
}

/** Every hard OA family the adapter can project (the `HARD_OA_BUILDERS` keys). */
export const FR_ADAPTER_FAMILIES: readonly string[] = Object.keys(HARD_OA_BUILDERS);

/**
 * Adapt ONE hard OA archetype (`family`) to a free-response {@link NumericQuestion}
 * using a seeded `Rng`. Deterministic given the seed. Throws on an unknown family
 * so a typo in the blueprint fails loudly rather than silently dropping an item.
 */
export function adaptHardOaToFreeResponse(
  family: string,
  rng: Rng,
): FrAdapterResult {
  const build = HARD_OA_BUILDERS[family];
  if (!build) {
    throw new Error(
      `frAdapters: unknown hard OA family "${family}" (known: ${FR_ADAPTER_FAMILIES.join(", ")})`,
    );
  }
  const built = build(rng);
  const q = built.question;
  const answer = valueOf(built.answer);
  const decimals = frDecimalsFor(answer);

  // Reuse the generator's DISTRACTORS as commonErrors: parse each non-correct
  // MCQ choice; keep the numeric ones (skip prose distractors like "They never
  // meet"), drop any that collide with the answer at grading precision, dedupe.
  const commonErrors: NonNullable<NumericQuestion["commonErrors"]> = [];
  const seen = new Set<number>();
  q.choices.forEach((choice, i) => {
    if (i === q.correctIndex) return;
    const value = parseFreeResponse(choice);
    if (value === null || !Number.isFinite(value)) return;
    if (sameAtPrecision(value, answer, decimals)) return;
    if (seen.has(value)) return;
    seen.add(value);
    // V3/V4: carry the MCQ's machine-readable misconception TAG for choice `i`
    // (when authored) onto the projected numeric commonError, so a typed wrong
    // value trips the SAME rung-1 directional nudge + rung-4 confront + mastery
    // fold as the MCQ distractor would. Falls back to the deterministic
    // `err:<value>` tag (no `misconception`) when the generator left it untagged.
    const tag = q.misconceptions?.[i];
    commonErrors.push({
      value,
      feedback:
        q.distractorRationale?.[i] ??
        "A plausible but incorrect approach to this problem.",
      ...(tag && tag.trim().length > 0 ? { misconception: tag } : {}),
    });
  });

  const question: NumericQuestion = {
    id: `fr-${q.id}`,
    prompt: q.prompt,
    answer,
    ...(decimals != null ? { decimals } : {}),
    difficulty: q.difficulty,
    concept: q.concept,
    explanation: q.explanation,
    commonErrors,
    source: q.source,
    family: q.family,
  };

  return { question, answer, mcq: q };
}
