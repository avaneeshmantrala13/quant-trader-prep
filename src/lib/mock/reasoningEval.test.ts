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
  LOCALIZATION_CASES,
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

    // Emit the reproducible, checked-in metrics summary (grader QA + localization).
    const md =
      renderReportMarkdown(
        report,
        `Corpus: ${corpus.length} labeled derivations over ${SEEDS.length} seeds ` +
          `× the full question bank (probability/EV, sequences, estimation) + pinned ` +
          `firm archetypes.`,
      ) + renderLocalizationMarkdown(loc);
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
