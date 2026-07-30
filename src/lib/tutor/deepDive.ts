/**
 * Deep-dive composition (pure, deterministic).
 *
 * The "Explain in more detail" action on the lesson-intro / worked-example
 * screen reveals a DEEPER walk-through of the SAME worked example the learner is
 * already looking at. This module composes that walk-through from two sources:
 *
 *   1. SOLVER-GROUNDED material (always available): the fully worked steps, the
 *      exact answer, and the distractor / common-error rationale — all produced
 *      by the level's OWN exact solver/generator. This guarantees the numbers in
 *      the panel can never drift from what the questions test.
 *   2. OPTIONAL authored CONCEPTUAL framing (`level.lesson.deepDive`): the "why
 *      it works" mental model, a general method checklist, and pitfalls in words.
 *
 * The result degrades gracefully: with no authored `deepDive` a quiz/numeric
 * level still yields a rich, accurate panel (key idea + worked steps + solver
 * pitfalls); authored content simply enriches it. Kept pure so the composition
 * is unit-tested and the React layer stays a thin renderer.
 */

import type { DeepDive } from "@/types/content";

export interface DeepDiveInput {
  /** The item/concept label (e.g. "Bayes' theorem"). */
  concept?: string;
  /** The level's one-line thesis (`lesson.keyIdea`). */
  keyIdea?: string;
  /** Authored conceptual enrichment (`lesson.deepDive`). */
  authored?: DeepDive;
  /**
   * Solver-derived worked steps of the on-screen example (already split from the
   * item's exact `explanation`). The concrete, numbers-included walk-through.
   */
  workedSteps?: string[];
  /** Full worked `explanation` prose (used to seed "why it works" if unauthored). */
  workedExplanation?: string;
  /**
   * Solver-grounded pitfalls: the WRONG-option rationale (quiz) or common-error
   * feedback (numeric). These are the item's own misconception taxonomy.
   */
  solverPitfalls?: string[];
  /** The exact answer of the worked example, if shown. */
  answer?: string;
  answerLabel?: string;
  /** Lesson paragraphs — fallback "why it works" for levels with no worked item. */
  fallbackParagraphs?: string[];
}

export interface DeepDiveSection {
  heading: string;
  /** A single prose paragraph, when this section is narrative. */
  body?: string;
  /** An ordered/bulleted list, when this section enumerates. */
  items?: string[];
}

export interface DeepDiveView {
  sections: DeepDiveSection[];
  answer?: string;
  answerLabel?: string;
}

function clean(list: readonly string[] | undefined): string[] {
  if (!list) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of list) {
    const s = (raw ?? "").trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

/**
 * Compose the deep-dive view. Sections with no content are omitted, so the
 * panel is always non-empty for a quiz/numeric level (worked steps + key idea)
 * and enriches when authored content or solver pitfalls are present.
 */
export function buildDeepDive(input: DeepDiveInput): DeepDiveView {
  const sections: DeepDiveSection[] = [];

  // 1. What this tests — the thesis / concept framing.
  const whatBody =
    input.keyIdea?.trim() ||
    (input.concept ? `The core idea: ${input.concept}.` : "");
  if (whatBody) {
    sections.push({ heading: "What this tests", body: whatBody });
  }

  // 2. Why this approach works — authored mental model, else the worked prose.
  const whyBody =
    input.authored?.whyItWorks?.trim() ||
    input.workedExplanation?.trim() ||
    clean(input.fallbackParagraphs)[0] ||
    "";
  if (whyBody) {
    sections.push({ heading: "Why this approach works", body: whyBody });
  }

  // 3. Step by step — the concrete solver walk-through, with the authored general
  // method (when present) leading as a conceptual scaffold.
  const approach = clean(input.authored?.approach);
  const workedSteps = clean(input.workedSteps);
  if (approach.length) {
    sections.push({ heading: "The general method", items: approach });
  }
  if (workedSteps.length) {
    sections.push({ heading: "Step by step on this example", items: workedSteps });
  }

  // 4. Common pitfalls — authored (words) + the solver's own distractor rationale.
  const pitfalls = clean([
    ...(input.authored?.pitfalls ?? []),
    ...(input.solverPitfalls ?? []),
  ]);
  if (pitfalls.length) {
    sections.push({ heading: "Common pitfalls to avoid", items: pitfalls });
  }

  return {
    sections,
    answer: input.answer?.trim() || undefined,
    answerLabel: input.answerLabel,
  };
}

/**
 * True when the composed view carries a genuinely deeper payload than the
 * headline worked example already shows — i.e. there is authored framing, a
 * pitfalls list, or narrative beyond the bare steps. Used to decide whether the
 * "Explain in more detail" affordance is worth offering.
 */
export function hasDeepDive(view: DeepDiveView): boolean {
  return view.sections.length > 0;
}
