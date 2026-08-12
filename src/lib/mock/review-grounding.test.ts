/**
 * mock/review-grounding.test.ts — the REAL LLM review mode is verifier-GROUNDED.
 *
 * `reviewReasoning` (mode `mock-review-reasoning`) lets an LLM LOCALIZE + explain
 * span-by-span, but the deterministic verifier stays AUTHORITATIVE: every span is
 * reconciled against arithmetic / committed-answer / mechanism checks. These tests
 * mock the LLM (via a stubbed `postAi`) and prove:
 *   (a) the LLM path yields SPECIFIC per-span feedback (the model's `why` survives), and
 *   (b) the verifier OVERRIDES a hallucinated LLM "green" on a WRONG answer — a
 *       coincidental number is dropped, and a false-arithmetic green is FLIPPED.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

// Force the AI layer ON with a non-stub config so reviewReasoning takes the LLM path.
vi.mock("@/lib/aiConfig", () => ({
  readAiConfig: () => ({ stub: false, endpoint: "https://mock", apiKey: "k" }),
}));

// The mocked LLM: `postAi` returns whatever the current test queued.
let nextPayload: Record<string, unknown> | null = null;
vi.mock("@/lib/aiFlavor", () => ({
  env: () => ({}),
  postAi: vi.fn(async () => nextPayload),
}));

import { reviewReasoning, reconcileReviewSpans } from "./aiMock";
import type { ReasoningSpan } from "./annotate";

afterEach(() => {
  nextPayload = null;
});

describe("reviewReasoning — LLM localizes, verifier grounds", () => {
  it("(a) keeps SPECIFIC per-span feedback the model produced", async () => {
    const reasoning =
      "The second difference is constant at 6, so 24 + 6 = 30 and the next term is 95.";
    nextPayload = {
      assessment: "Clean use of the constant second difference.",
      spans: [
        {
          start: reasoning.indexOf("second difference is constant"),
          end:
            reasoning.indexOf("second difference is constant") +
            "second difference is constant at 6".length,
          label: "good",
          why: "You spotted the second difference is constant at 6 — that's the mechanism that pins the quadratic.",
        },
        {
          start: reasoning.indexOf("24 + 6 = 30"),
          end: reasoning.indexOf("24 + 6 = 30") + "24 + 6 = 30".length,
          label: "good",
          why: "24 + 6 = 30 checks out, extending the run correctly.",
        },
      ],
    };

    const res = await reviewReasoning(
      { prompt: "next term of 3, 9, 24, 48, …", correctAnswer: "95", correct: true, reasoning },
      { verifiedAnswer: 95, answerWasWrong: false, mechanismSignals: ["second difference is constant"] },
    );

    expect(res.source).toBe("ai");
    // The model's own specific wording survives grounding (not a template).
    expect(res.spans.some((s) => /second difference is constant at 6/i.test(s.why))).toBe(true);
    expect(res.spans.some((s) => /24 \+ 6 = 30 checks out/i.test(s.why))).toBe(true);
  });

  it("(b) DROPS a hallucinated green on a coincidental number for a WRONG answer", async () => {
    const reasoning = "The sequence is just (n+1)^2, so a, b, c are 1, 2, 1.";
    const gStart = reasoning.indexOf("1, 2, 1");
    const fStart = reasoning.indexOf("(n+1)^2");
    nextPayload = {
      assessment: "Looks right.",
      spans: [
        // Hallucinated: praise a WRONG committed triple because a=2 coincidentally.
        {
          start: gStart,
          end: gStart + "1, 2, 1".length,
          label: "good",
          why: "You correctly found a, b, c are 1, 2, 1.",
        },
      ],
    };

    const res = await reviewReasoning(
      {
        prompt: "The sequence 4, 9, 18, 31, 48 fits a·n² + b·n + c; find a, b, c.",
        correctAnswer: "2",
        correct: false,
        reasoning,
      },
      { verifiedAnswer: 2, answerWasWrong: true },
    );

    // The verifier drops the ungrounded green; nothing survives → deterministic floor.
    expect(res.spans.some((s) => s.label === "good")).toBe(false);
    // And the deterministic floor still reddens the mis-identified closed form.
    const red = res.spans.find((s) => s.label === "flawed");
    expect(red, "closed-form flaw is reddened").toBeTruthy();
    expect(red!.excerpt).toContain("(n+1)^2");
    void fStart;
  });
});

describe("reconcileReviewSpans — deterministic grounding gate", () => {
  it("FLIPS a false-arithmetic green to flawed", () => {
    const text = "Adding them, 1 plus 1 = 3, so the total is 3.";
    const claim = "1 plus 1 = 3";
    const i = text.indexOf(claim);
    const llm: ReasoningSpan[] = [
      {
        start: i,
        end: i + claim.length,
        excerpt: claim,
        label: "good",
        why: "Nice addition.",
      },
    ];
    const out = reconcileReviewSpans(text, llm, { verifiedAnswer: 2, answerWasWrong: true });
    const span = out.find((s) => s.excerpt.includes(claim));
    expect(span, "the false-arithmetic span survives").toBeTruthy();
    expect(span!.label).toBe("flawed");
    expect(span!.why).toMatch(/incorrect step/i);
  });

  it("KEEPS a genuinely grounded green (equation that holds)", () => {
    const text = "Here 24 + 6 = 30, so it grows by 6.";
    const i = text.indexOf("24 + 6 = 30");
    const llm: ReasoningSpan[] = [
      {
        start: i,
        end: i + "24 + 6 = 30".length,
        excerpt: "24 + 6 = 30",
        label: "good",
        why: "This step checks out.",
      },
    ];
    const out = reconcileReviewSpans(text, llm, { verifiedAnswer: 30, answerWasWrong: false });
    expect(out.some((s) => s.label === "good" && s.excerpt.includes("24 + 6 = 30"))).toBe(true);
  });

  it("KEEPS a FULL-CLAUSE mechanism green on a correct answer (no number, no listed signal)", () => {
    // The load-bearing explanation clause has no holding equation and no committed
    // value in it, but it introduces genuine mechanism content ("linear equation")
    // — on a CONFIRMED-correct answer it must be kept WHOLE, not shrunk away.
    const text =
      "Once we know a, the rest is solving a linear equation for b and c which can be done with any two of the three terms.";
    const llm: ReasoningSpan[] = [
      { start: 0, end: text.length, excerpt: text, label: "good", why: "Correct system reasoning." },
    ];
    const out = reconcileReviewSpans(text, llm, {
      verifiedAnswer: 2,
      answerWasWrong: false,
      prompt:
        "Why do just three of the shown terms pin all three coefficients a, b, c down?",
      mechanismSignals: ["second difference", "three equations"],
    });
    expect(
      out.some((s) => s.label === "good" && /linear equation for b and c/i.test(s.excerpt)),
    ).toBe(true);
  });

  it("DROPS a circular 'because it is quadratic' green even on a correct answer", () => {
    const text = "Three terms are enough to get the equation because it is quadratic.";
    const llm: ReasoningSpan[] = [
      { start: 0, end: text.length, excerpt: text, label: "good", why: "Right, it's quadratic." },
    ];
    const out = reconcileReviewSpans(text, llm, {
      verifiedAnswer: 2,
      answerWasWrong: false,
      prompt:
        "Now take a sequence that is also quadratic, aₙ = a·n² + b·n + c — why do just three terms pin all three down?",
      mechanismSignals: ["second difference", "three equations"],
    });
    // A parroted-stem restatement is never greened, even though the answer is right.
    expect(out.some((s) => s.label === "good")).toBe(false);
  });
});
