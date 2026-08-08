import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import { gradeFreeResponse, parseFreeResponse } from "@/lib/numeric";
import { HARD_OA_BUILDERS, valueOf } from "@/lib/oa/hardContent/generators";
import {
  FR_ADAPTER_FAMILIES,
  adaptHardOaToFreeResponse,
} from "@/lib/oa/hardContent/frAdapters";

/**
 * P3 §5.2 — the free-response adapters must reuse each hard MCQ generator's EXACT
 * verifier answer (no new math) and its distractors as `commonErrors`.
 */
describe("frAdapters: hard OA MCQ → free-response NumericQuestion", () => {
  const SEEDS = [1, 7, 42, 101, 2024];

  it("exposes every hard OA family", () => {
    expect(FR_ADAPTER_FAMILIES.length).toBe(Object.keys(HARD_OA_BUILDERS).length);
    expect(FR_ADAPTER_FAMILIES.length).toBeGreaterThan(5);
  });

  for (const family of Object.keys(HARD_OA_BUILDERS)) {
    it(`${family}: adapter answer === verifier answer (+ MC cross-check)`, () => {
      for (const seed of SEEDS) {
        // Rebuild the SAME MCQ deterministically to recover the verifier answer.
        const built = HARD_OA_BUILDERS[family](new Rng(seed));
        const verifierAnswer = valueOf(built.answer);

        const { question, answer, mcq } = adaptHardOaToFreeResponse(
          family,
          new Rng(seed),
        );

        // The adapter reuses the EXACT verifier answer — no new math.
        expect(answer).toBe(verifierAnswer);
        expect(question.answer).toBe(verifierAnswer);
        expect(Number.isFinite(question.answer)).toBe(true);

        // MC cross-check: the correct MCQ choice parses to the same value.
        const correctText = mcq.choices[mcq.correctIndex];
        const parsedCorrect = parseFreeResponse(correctText);
        if (parsedCorrect !== null && Number.isFinite(parsedCorrect)) {
          const tol = Number.isInteger(verifierAnswer) ? 1e-6 : 5e-3;
          expect(Math.abs(parsedCorrect - verifierAnswer)).toBeLessThanOrEqual(tol);
        }

        // commonErrors are drawn from the (wrong) distractors, never the answer.
        for (const ce of question.commonErrors ?? []) {
          expect(ce.value).not.toBe(verifierAnswer);
          expect(typeof ce.feedback).toBe("string");
        }

        // The prompt/metadata carry through for attribution.
        expect(question.prompt).toBe(mcq.prompt);
        expect(question.id).toContain(mcq.id);
      }
    });
  }

  it("a correct free-response entry grades correct through @/lib/numeric", () => {
    for (const family of Object.keys(HARD_OA_BUILDERS)) {
      const { question } = adaptHardOaToFreeResponse(family, new Rng(9));
      const typed =
        question.decimals != null
          ? question.answer.toFixed(question.decimals)
          : String(question.answer);
      expect(gradeFreeResponse(question, typed).correct).toBe(true);
    }
  });

  it("throws on an unknown family", () => {
    expect(() => adaptHardOaToFreeResponse("nope", new Rng(1))).toThrow();
  });
});
