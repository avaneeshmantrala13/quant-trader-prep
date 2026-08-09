/**
 * mock/reasoningEval.test.ts — runs the adversarial reasoning-grader evaluation
 * harness over the WHOLE question bank with a DETERMINISTIC mock LLM extractor
 * and asserts the recall / flaw-rejection targets per archetype. It also emits
 * the checked-in metrics summary (`datasets/reasoning-eval-metrics.md`) so the
 * accuracy numbers are reproducible.
 *
 * The extraction (LLM-dependent in production) is MOCKED here; what is tested is
 * the DETERMINISTIC VERIFICATION logic — the part that owns the verdict and makes
 * grading non-jailbreakable.
 */
import { describe, it, expect } from "vitest";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildCorpus,
  mockLlmExtractor,
  runReasoningEval,
  renderReportMarkdown,
  runLocalizationEval,
  renderLocalizationMarkdown,
  runGranularityEval,
  runGateEval,
  runReviewGroundingEval,
  renderQualityMarkdown,
  GATE_CASES,
  LOCALIZATION_CASES,
  REVIEW_GROUNDING_CASES,
  derivationsForQuestion,
  type LabeledDerivation,
} from "./reasoningEval";
import { attachRequiredReasoning, drawArchetype } from "./questionPools";
import { extractClaimsDeterministic, gradeReasoningFromClaims } from "./claims";
import { rubricForId } from "./rubrics";
import { Rng } from "@/lib/rng";
import type { ReasoningInput } from "./reasoning";

const SEEDS = Array.from({ length: 30 }, (_, i) => 1000 + i * 7);

describe("reasoning grader — extract-and-verify evaluation harness", () => {
  it("hits high recall & flaw-rejection across every archetype", () => {
    const corpus = buildCorpus(SEEDS);
    const report = runReasoningEval(corpus, mockLlmExtractor);

    for (const m of report.perArchetype) {
      const recall = m.positives > 0 ? m.positivesAccepted / m.positives : 1;
      const flaw = m.negatives > 0 ? m.negativesRejected / m.negatives : 1;
      // eslint-disable-next-line no-console
      console.log(
        `[eval ${m.archetype.padEnd(16)}] recall=${(recall * 100).toFixed(1)}% ` +
          `flaw-reject=${(flaw * 100).toFixed(1)}% canonFN=${m.canonicalFalseNegatives} ` +
          `(P ${m.positivesAccepted}/${m.positives}, N ${m.negativesRejected}/${m.negatives})`,
      );
    }
    const t = report.totals;
    // eslint-disable-next-line no-console
    console.log(
      `[eval TOTAL] recall=${(t.recall * 100).toFixed(2)}% ` +
        `(${t.positivesAccepted}/${t.positives})  ` +
        `flaw-reject=${(t.flawRejection * 100).toFixed(2)}% ` +
        `(${t.negativesRejected}/${t.negatives})  ` +
        `FN=${(t.falseNegativeRate * 100).toFixed(2)}%  ` +
        `FP=${(t.falsePositiveRate * 100).toFixed(2)}%  ` +
        `canonicalFN=${t.canonicalFalseNegatives}`,
    );

    // ---- Localization metrics: does the review CAPTURE the mistake? ----
    const loc = runLocalizationEval();
    // eslint-disable-next-line no-console
    console.log(
      `[loc] span=${loc.spanCorrect}/${loc.total} why=${loc.whyCorrect}/${loc.total} ` +
        `controlsClean=${loc.controlsClean}/${loc.controls}`,
    );

    // ---- Granularity + feedback specificity, and the strict clarify gate ----
    const gran = runGranularityEval();
    const gate = runGateEval();
    const review = runReviewGroundingEval();
    // eslint-disable-next-line no-console
    console.log(
      `[gran] maxGreenOnCorrect=${(gran.maxGreenCoverageCorrect * 100).toFixed(1)}% ` +
        `maxRedOnFlawed=${(gran.maxRedCoverageFlawed * 100).toFixed(1)}% ` +
        `banned=${gran.bannedPhraseHits.length} falseGreens=${gran.coincidentalGreenHits.length} ` +
        `[gate] ${gate.correct}/${gate.total} [review] ${review.grounded}/${review.total}`,
    );

    // Emit the reproducible, checked-in metrics summary (grader QA + localization
    // + granularity/feedback + strict gate).
    const md =
      renderReportMarkdown(
        report,
        `Corpus: ${corpus.length} labeled derivations over ${SEEDS.length} seeds ` +
          `× the full question bank (probability/EV, sequences, estimation) + pinned ` +
          `firm archetypes.`,
      ) +
      renderLocalizationMarkdown(loc) +
      renderQualityMarkdown(gran, gate, review);
    try {
      writeFileSync(
        resolve(process.cwd(), "datasets/reasoning-eval-metrics.md"),
        md,
        "utf8",
      );
    } catch {
      /* best-effort artifact write; never fails the test */
    }

    // ---- Localization acceptance gates ----
    expect(loc.total).toBe(LOCALIZATION_CASES.length);
    expect(loc.spanCorrect, "every flawed case localizes to its root-cause span").toBe(
      loc.total,
    );
    expect(loc.whyCorrect, "every localized span explains the right misconception").toBe(
      loc.total,
    );
    expect(loc.controlsClean, "correct derivations get NO false red").toBe(loc.controls);

    // ---- Granularity + feedback-specificity acceptance gates ----
    // A CORRECT answer is never a wall of green (only key steps), and never red.
    expect(gran.anyRedOnCorrect, "no red on a correct answer").toBe(false);
    expect(
      gran.maxGreenCoverageCorrect,
      "correct answers are granular green, not blanket",
    ).toBeLessThan(0.8);
    // A FLAWED answer reds ONLY the specific claim — a minority of the text.
    expect(
      gran.maxRedCoverageFlawed,
      "flawed cases red-highlight only the specific claim, not the whole blob",
    ).toBeLessThan(0.85);
    // Feedback is content-referential and free of banned generic phrases.
    expect(
      gran.allFeedbackReferencesContent,
      "every flawed span quotes the candidate's own words",
    ).toBe(true);
    expect(
      gran.bannedPhraseHits,
      `banned generic phrases leaked into feedback:\n${gran.bannedPhraseHits.join("\n")}`,
    ).toEqual([]);
    // NO false-green on a coincidental number (e.g. the "2" in "(n+1)²").
    expect(
      gran.coincidentalGreenHits,
      `false-greens on coincidental numbers:\n${gran.coincidentalGreenHits.join("\n")}`,
    ).toEqual([]);

    // ---- LLM review grounding: the verifier OVERRIDES a hallucinated green ----
    expect(review.total).toBe(REVIEW_GROUNDING_CASES.length);
    expect(
      review.grounded,
      `review grounding failures:\n${review.perCase
        .filter((c) => !c.ok)
        .map((c) => `${c.label}: greenDropped=${c.greenDropped} flawKept=${c.flawKept}`)
        .join("\n")}`,
    ).toBe(review.total);

    // ---- Strict confirm/clarify gate acceptance ----
    expect(gate.total).toBe(GATE_CASES.length);
    expect(
      gate.correct,
      `strict gate mismatches:\n${gate.perCase
        .filter((c) => !c.ok)
        .map((c) => `${c.label}: expected ${c.expect}, got ${c.got}`)
        .join("\n")}`,
    ).toBe(gate.total);

    // ---- Hard acceptance gates (per-archetype and total) ----
    for (const m of report.perArchetype) {
      expect(m.canonicalFalseNegatives, `${m.archetype} canonical FN`).toBe(0);
      const recall = m.positives > 0 ? m.positivesAccepted / m.positives : 1;
      const flaw = m.negatives > 0 ? m.negativesRejected / m.negatives : 1;
      expect(
        recall,
        `${m.archetype} recall too low\n${m.falseNegatives.join("\n")}`,
      ).toBeGreaterThanOrEqual(0.95);
      expect(
        flaw,
        `${m.archetype} flaw-rejection too low\n${m.falsePositives.join("\n")}`,
      ).toBeGreaterThanOrEqual(0.95);
    }
    expect(t.recall).toBeGreaterThanOrEqual(0.98);
    expect(t.flawRejection).toBeGreaterThanOrEqual(0.98);
    expect(t.canonicalFalseNegatives).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/*  Focused invariants of the extract-and-verify verdict                       */
/* -------------------------------------------------------------------------- */

describe("extract-and-verify — verdict is deterministic & non-jailbreakable", () => {
  const optiver = attachRequiredReasoning(
    drawArchetype(new Rng(1), "optiver-quadratic-demo"),
  );

  const inputWith = (reasoning: string, correct = true): ReasoningInput => ({
    prompt: optiver.prompt,
    correctAnswer: String(optiver.answer),
    correct,
    reasoning,
    isMentalMath: false,
    mechanismSignals: optiver.requiredReasoning?.mechanismSignals,
  });

  it("RESCUES an arbitrary-phrasing correct derivation the substring matcher missed", () => {
    // A paraphrase with NO literal mechanism signal → deterministic path is only
    // `partial`/`vague`, but the LLM-extracted mechanism claim proves it sound.
    const reasoning = `The jumps get bigger by the same amount each step, so the answer is ${optiver.answer}.`;
    const det = gradeReasoningFromClaims(
      inputWith(reasoning),
      extractClaimsDeterministic(reasoning, {
        mechanismSignals: optiver.requiredReasoning?.mechanismSignals,
      }),
      rubricForId(optiver.id),
    );
    expect(det.quality).not.toBe("sound"); // substring matcher misses the paraphrase
    const viaClaims = gradeReasoningFromClaims(
      inputWith(reasoning),
      mockLlmExtractor(inputWith(reasoning)),
      rubricForId(optiver.id),
    );
    expect(viaClaims.quality).toBe("sound"); // extract-and-verify accepts it
    expect(viaClaims.source).toBe("ai");
  });

  it("NEVER accepts a correct answer with a FALSE arithmetic step (jailbreak guard)", () => {
    const reasoning = `Second differences are constant; also 10 - 3 = 8, so it's ${optiver.answer}.`;
    const grade = gradeReasoningFromClaims(
      inputWith(reasoning),
      mockLlmExtractor(inputWith(reasoning)),
      rubricForId(optiver.id),
    );
    expect(grade.quality).toBe("flawed");
  });

  it("NEVER accepts a right answer with NO reasoning", () => {
    const reasoning = `${optiver.answer}`;
    const grade = gradeReasoningFromClaims(
      inputWith(reasoning),
      mockLlmExtractor(inputWith(reasoning)),
      rubricForId(optiver.id),
    );
    expect(grade.quality).not.toBe("sound");
  });

  it("NEVER accepts a wrong-family mechanism as establishing this method", () => {
    const reasoning = `By the law of total probability, the answer is ${optiver.answer}.`;
    const grade = gradeReasoningFromClaims(
      inputWith(reasoning),
      mockLlmExtractor(inputWith(reasoning)),
      rubricForId(optiver.id),
    );
    expect(grade.quality).not.toBe("sound");
  });

  it("deterministic ClaimSet reproduces gradeReasoningDeterministic exactly", () => {
    const reasoning = `Second differences are constant at 6, so the next gap is 30 → ${optiver.answer}.`;
    const detClaims = extractClaimsDeterministic(reasoning, {
      mechanismSignals: optiver.requiredReasoning?.mechanismSignals,
    });
    const g = gradeReasoningFromClaims(inputWith(reasoning), detClaims);
    expect(g.source).toBe("deterministic");
    expect(g.quality).toBe("sound");
  });

  it("generates a coherent labeled derivation set per question", () => {
    const ds: LabeledDerivation[] = derivationsForQuestion(optiver);
    expect(ds.some((d) => d.label === "positive" && d.canonical)).toBe(true);
    expect(ds.some((d) => d.label === "negative" && d.category === "false-arith")).toBe(true);
    expect(ds.filter((d) => d.label === "positive").length).toBeGreaterThan(1);
  });
});
