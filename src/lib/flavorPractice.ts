/**
 * flavorPractice.ts — the tiny, pure composition glue between the parametric
 * "Generate another like this" path (`regenerate.ts`) and the optional LLM
 * FLAVOR layer (`aiFlavor.ts`), used by the "✨ Fresh variant" bonus-practice
 * control in `LessonPage`.
 *
 * The ONLY correctness property that matters here is the graceful fallback: an
 * AI/stub reskin (`source: "ai" | "stub"`) swaps in the reskinned question,
 * while a `null` result (layer off / unconfigured) or a guardrail-rejected
 * `source: "fallback"` keeps the ORIGINAL fresh parametric item verbatim. The
 * fresh item's solver answer/options/explanation are ALWAYS the source of truth
 * — the flavor layer can only ever change the surface `prompt`.
 *
 * Note: `requestFlavoredVariant` already returns the original item unchanged on
 * the fallback/stub paths, so this helper is deliberately defensive/explicit
 * rather than clever: given ANY variant result it can never surface something
 * other than the fresh parametric item unless the AI reskin genuinely passed.
 */
import type { NumericQuestion, Question } from "@/types/content";
import type { FlavoredVariant } from "./aiFlavor";

/**
 * Pick the question to present from a fresh parametric item and an optional
 * flavor result. Returns the reskinned question ONLY when the flavor layer
 * produced a verified/stubbed variant; otherwise returns the fresh parametric
 * item unchanged (safe graceful degrade — never blocks, never errors).
 */
export function resolveFlavoredItem<Q extends Question | NumericQuestion>(
  fresh: Q,
  variant: FlavoredVariant<Q> | null,
): Q {
  if (variant && (variant.source === "ai" || variant.source === "stub")) {
    return variant.question;
  }
  return fresh;
}
