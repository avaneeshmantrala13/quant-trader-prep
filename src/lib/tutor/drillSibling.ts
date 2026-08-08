import type { Level } from "@/types/content";
import type { MaterializedNumericItem } from "@/lib/diagnostic/untimedRun";
import { adaptHardOaToFreeResponse } from "@/lib/oa/hardContent/frAdapters";

/**
 * Rung-3 worked-sibling support for the DRILLING loop (Stage 6).
 *
 * The drilling loop serves free-response items straight from the untimed
 * blueprint (`@/lib/diagnostic/untimedRun`), NOT from a `Level`, so the hint
 * ladder had no `Level` to hand `buildWorkedSibling` — and therefore never
 * produced a worked sibling, which is exactly why the rung-3 header rendered
 * with no calculation beneath it in the drilling loop.
 *
 * This helper closes that gap WITHOUT inventing any math. A drill item is one of
 * two kinds:
 *  - `numeric-adapter`: a hard-OA archetype projected to free-response. Its
 *    `family` re-runs the EXACT same verifier-backed generator, so we can wrap it
 *    in a minimal generator-backed `Level`; `buildWorkedSibling` then draws a
 *    genuine same-family instance with DIFFERENT numbers and a real worked
 *    solution (guaranteed different answer, never leaks the current one).
 *  - `numeric-authored` WITH a `generator`: a parametric authored family (e.g.
 *    the combined-rates "two pipes fill a tank" floor). We wrap its OWN
 *    exact-verified generator in a minimal `Level` so `buildWorkedSibling` draws
 *    a genuine same-family instance with DIFFERENT numbers and a real worked
 *    solution — exactly like the adapter case.
 *  - `numeric-authored` WITHOUT a generator: a single fixed authored question
 *    with no parametric variation and no sibling pool, so a "same kind,
 *    different numbers" instance genuinely cannot be produced. We return `null`;
 *    the hint ladder then omits the worked-sibling rung entirely (header ⇔ steps
 *    invariant) and falls back to the next meaningful hint.
 */

/**
 * A throwaway generator-backed `Level` whose `numericGenerator` is the drill
 * item's own verifier-backed family — the hard-OA adapter family for
 * `numeric-adapter` items, or the authored item's attached parametric
 * `generator` — or `null` when the item has no parametric family to regenerate
 * from (a genuinely-unique authored singleton).
 */
export function drillWorkedSiblingLevel(
  item: MaterializedNumericItem,
): Level | null {
  if (item.item.kind === "numeric-adapter") {
    const family = item.item.family;
    return {
      id: `drill-sibling-${family}`,
      title: item.question.concept ?? family,
      subtitle: "",
      blurb: "",
      difficulty: item.tier,
      mode: "numeric",
      masteryThreshold: 0.8,
      // Re-run the EXACT verifier-backed adapter: same family, fresh numbers.
      numericGenerator: (rng) => adaptHardOaToFreeResponse(family, rng).question,
      lesson: { paragraphs: [] },
    };
  }
  if (item.item.kind === "numeric-authored" && item.item.generator) {
    const generator = item.item.generator;
    return {
      id: `drill-sibling-authored-${item.item.subtopic}`,
      title: item.question.concept ?? item.item.subtopic,
      subtitle: "",
      blurb: "",
      difficulty: item.tier,
      mode: "numeric",
      masteryThreshold: 0.8,
      // Re-run the item's OWN exact-verified generator: same family, fresh numbers.
      numericGenerator: generator,
      lesson: { paragraphs: [] },
    };
  }
  return null;
}
