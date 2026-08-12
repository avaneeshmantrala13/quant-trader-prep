/**
 * mock/annotate.test.ts — SPAN-LEVEL good/flawed annotation suite.
 *
 * Proves the annotator marks the RIGHT parts of a candidate's own words green
 * (correct step / valid mechanism / reaches the verified answer) vs red (false
 * arithmetic / contradiction / hedge), with accurate char offsets the UI can
 * highlight, and that the deterministic checks can never be gamed.
 */
import { describe, expect, it } from "vitest";
import {
  annotateReasoning,
  annotateReasoningForAnswer,
  snapSpanToWordBoundaries,
  type ReasoningSpan,
} from "./annotate";

describe("snapSpanToWordBoundaries — clean highlights on word boundaries", () => {
  const span = (text: string, start: number, end: number): ReasoningSpan => ({
    start,
    end,
    excerpt: text.slice(start, end),
    label: "flawed",
    why: "test",
  });

  it("advances a MID-WORD start so it snaps to the next token (the reported bleed)", () => {
    // The exact reported case: the span START grabbed the trailing "n" of "than"
    // and painted "n 3n^2" — it must normalize to cover exactly "3n^2".
    const text = "the actual answer is more than 3n^2, so it grows fast";
    const start = text.indexOf("than") + 3; // the trailing "n" of "than"
    const end = text.indexOf("3n^2") + "3n^2".length; // through the "2"
    expect(text.slice(start, end)).toBe("n 3n^2"); // sanity: the buggy span
    const out = snapSpanToWordBoundaries(text, span(text, start, end));
    expect(out.excerpt).toBe("3n^2");
    expect(text.slice(out.start, out.end)).toBe("3n^2");
  });

  it("retracts a MID-WORD end to the previous token", () => {
    const text = "the total is 42 apples in all";
    const start = text.indexOf("42");
    const end = text.indexOf("apples") + 4; // ends inside "appl|es"
    expect(text.slice(start, end)).toBe("42 appl"); // sanity: the buggy span
    const out = snapSpanToWordBoundaries(text, span(text, start, end));
    expect(out.excerpt).toBe("42");
  });

  it("leaves an ALREADY-CLEAN span unchanged", () => {
    const text = "the actual answer is more than 3n^2, so it grows";
    const start = text.indexOf("3n^2");
    const end = start + "3n^2".length;
    const out = snapSpanToWordBoundaries(text, span(text, start, end));
    expect(out.start).toBe(start);
    expect(out.end).toBe(end);
    expect(out.excerpt).toBe("3n^2");
  });

  it("trims leading/trailing whitespace and dangling punctuation", () => {
    const text = "so the answer is  3n^2,  and we move on";
    const start = text.indexOf("  3n^2"); // leading spaces
    const end = text.indexOf(",  and") + 1; // include the trailing comma
    const out = snapSpanToWordBoundaries(text, span(text, start, end));
    expect(out.excerpt).toBe("3n^2");
  });

  it("preserves meaningful leading brackets (does not strip '(' from '(n+1)^2')", () => {
    const text = "the closed form is (n+1)^2, which is wrong";
    const start = text.indexOf("(n+1)^2");
    const end = start + "(n+1)^2".length;
    const out = snapSpanToWordBoundaries(text, span(text, start, end));
    expect(out.excerpt).toBe("(n+1)^2");
  });

  it("keeps the (trimmed) original when snapping would erase everything", () => {
    // A span that is a strict prefix of a longer word ("differ" in "difference")
    // must not collapse to empty — the trimmed original range is kept.
    const text = "note the difference here";
    const start = text.indexOf("differ");
    const end = start + "differ".length;
    const out = snapSpanToWordBoundaries(text, span(text, start, end));
    expect(out.end).toBeGreaterThan(out.start);
    expect(out.excerpt).toBe("differ");
  });
});

describe("annotateReasoning — GOOD (green) spans", () => {
  it("marks a correct stated computation as good", () => {
    const text = "The second difference is constant at 6. 24 + 6 = 30, so the next term is 95.";
    const spans = annotateReasoning(text, {
      verifiedAnswer: 95,
      mechanismSignals: ["second difference is constant"],
    });
    const good = spans.filter((s) => s.label === "good");
    expect(good.length).toBeGreaterThanOrEqual(2);
    // The mechanism clause and a correct step/committed value are both green.
    expect(good.some((s) => /mechanism/i.test(s.why))).toBe(true);
    expect(
      good.some((s) => /checks out|correct answer|correct value|arithmetic/i.test(s.why)),
    ).toBe(true);
  });

  it("marks a clause that reaches the verified answer as good", () => {
    const spans = annotateReasoning("Therefore it is 0.5.", { verifiedAnswer: 0.5 });
    expect(spans).toHaveLength(1);
    expect(spans[0].label).toBe("good");
  });

  it("does NOT green a coincidental number on a WRONG answer (no false-green)", () => {
    // The reported (n+1)² repro: a = 2 (verified), but the "2" is coincidental —
    // it must NEVER be greened, because the committed answer is wrong.
    const text = "The sequence is just (n+1)^2, so a, b, c are 1, 2, 1.";
    const spans = annotateReasoning(text, {
      prompt:
        "The sequence 4, 9, 18, 31, 48 fits a quadratic a·n² + b·n + c; find a, b, c.",
      verifiedAnswer: 2,
      answerWasWrong: true,
    });
    expect(spans.some((s) => s.label === "good")).toBe(false);
    // The mis-identified closed form "(n+1)^2" is reddened with a real reason.
    const red = spans.find((s) => s.label === "flawed");
    expect(red, "a red closed-form span is present").toBeTruthy();
    expect(red!.excerpt).toContain("(n+1)^2");
    expect(red!.why).toMatch(/gives|closed form|doesn.t fit/i);
    expect(red!.why.toLowerCase()).not.toContain("load-bearing");
  });

  it("does NOT falsely redden a CORRECT multi-coefficient commit (verifier-confirmed)", () => {
    // The reported clarify repro: the adversarial grades on `a` (verified 2), but
    // the answer legitimately also states b = −1 and c = 3, so the LAST value (3)
    // isn't the graded target. With the verifier CONFIRMING the answer correct
    // (`answerWasWrong: false`), the correct coefficients must never be reddened
    // with a nonsensical "steers the chain to 3 instead of 2" — and the graded
    // coefficient (2) is greened even though it's stated mid-sentence.
    const text =
      "a is 2, b is -1, and c is 3. You only need three terms because that is enough information.";
    const spans = annotateReasoning(text, {
      prompt:
        "Now take a DIFFERENT sequence: 4, 9, 18, 31, 48, … aₙ = a·n² + b·n + c. What are a, b, and c — and why do just three of the shown terms pin all three down?",
      verifiedAnswer: 2,
      mechanismSignals: ["three points", "three equations", "system"],
      answerWasWrong: false,
    });
    // No red at all on a verifier-confirmed correct commit.
    expect(spans.some((s) => s.label === "flawed")).toBe(false);
    // No "3 instead of 2" nonsense anywhere.
    for (const s of spans) {
      expect(s.why).not.toMatch(/instead of/i);
    }
    // The graded coefficient (2) is greened where it's stated ("a is 2").
    const green = spans.find((s) => s.label === "good");
    expect(green, "the correct coefficient is greened").toBeTruthy();
    expect(green!.excerpt).toContain("2");
  });
});

describe("annotateReasoning — FLAWED (red) spans", () => {
  it("marks a demonstrably false stated computation as flawed", () => {
    const text = "1 divided by 2 is 5, so the probability is 5.";
    const spans = annotateReasoning(text, { verifiedAnswer: 0.5 });
    const flawed = spans.filter((s) => s.label === "flawed");
    expect(flawed.length).toBeGreaterThanOrEqual(1);
    expect(flawed[0].why).toMatch(/incorrect step/i);
  });

  it("marks a hedge as flawed (points both ways), quoting the hedge phrase", () => {
    const spans = annotateReasoning("It could be either the same or different.", {});
    const hedge = spans.find((s) => s.label === "flawed");
    expect(hedge, "a red hedge span is present").toBeTruthy();
    // Granular: the red span is the hedge PHRASE, not the whole sentence.
    expect(hedge!.excerpt.length).toBeLessThan(
      "It could be either the same or different.".length,
    );
    // Content-referential + human, not a template.
    expect(hedge!.why).toMatch(/hedge|both ways/i);
    expect(hedge!.why).toContain(hedge!.excerpt.trim());
  });

  it("marks an internally-inconsistent equality as flawed", () => {
    const spans = annotateReasoning("3 * 1/2 = 3/8 here.", {});
    expect(spans.some((s) => s.label === "flawed")).toBe(true);
  });
});

describe("annotateReasoning — offsets & structure", () => {
  it("every span's excerpt matches the original text slice", () => {
    const text = "24 + 6 = 30. Then 30 + 41 = 71. So the answer is 95.";
    const spans = annotateReasoning(text, { verifiedAnswer: 95 });
    for (const s of spans) {
      expect(text.slice(s.start, s.end)).toBe(s.excerpt);
    }
  });

  it("spans are disjoint and ordered by position", () => {
    const text = "1 divided by 2 is 5. The answer is 0.5.";
    const spans = annotateReasoning(text, { verifiedAnswer: 0.5 });
    for (let i = 1; i < spans.length; i++) {
      expect(spans[i].start).toBeGreaterThanOrEqual(spans[i - 1].end);
    }
  });

  it("garbled / empty text yields no spans", () => {
    expect(annotateReasoning("", {})).toHaveLength(0);
    expect(annotateReasoning("zxcvbnm qwrtp hjkl sdfgh", {})).toHaveLength(0);
  });
});

describe("annotateReasoningForAnswer — string answer convenience", () => {
  it("parses a string answer and highlights the reaching clause", () => {
    const spans = annotateReasoningForAnswer("So it comes out to 0.1667.", "0.1667");
    expect(spans.some((s) => s.label === "good")).toBe(true);
  });
});

describe("annotateReasoning — ROOT-CAUSE localization (premise flaws)", () => {
  const DICE_PROMPT =
    "Two fair six-sided dice are rolled. What is the expected value of the LARGER of the two (the maximum)?";
  const DICE_REASONING =
    "There is a 50% chance that one die is 3 or less. This means the larger is just the EV of the next die, which is 3.5. The other 50% chance is that the die rolls 4, 5, or 6 which averages to 5 so the answer is 0.5(3.5) + 0.5(5) = 4.25.";

  it("localizes the dice-max mistake to the FIRST sentence with a correct explanation", () => {
    const spans = annotateReasoning(DICE_REASONING, {
      prompt: DICE_PROMPT,
      verifiedAnswer: 4.4722,
      answerWasWrong: true,
    });
    const flawed = spans.filter((s) => s.label === "flawed");
    expect(flawed.length).toBeGreaterThanOrEqual(1);
    // The red span COVERS the first sentence (the imposed sequential ordering).
    const root = flawed.find((s) =>
      s.excerpt.includes("There is a 50% chance that one die is 3 or less"),
    );
    expect(root, "root cause is the first sentence").toBeTruthy();
    // The explanation names the sequential-ordering error AND the 4.25-vs-4.4722 gap.
    expect(root!.why).toMatch(/sequential|ordering|next die|both dice|jointly/i);
    expect(root!.why).toMatch(/4\.25/);
    expect(root!.why).toMatch(/4\.4722/);
  });

  it("does NOT falsely redden a CORRECT order-statistics derivation (green, no red)", () => {
    const spans = annotateReasoning(
      "By order statistics, P(max = m) = (2m − 1)/36, so E[max] = Σ m·(2m − 1)/36 = 161/36 ≈ 4.4722.",
      {
        prompt: DICE_PROMPT,
        verifiedAnswer: 4.4722,
        mechanismSignals: ["order statistic", "2m-1"],
        answerWasWrong: false,
      },
    );
    expect(spans.some((s) => s.label === "flawed")).toBe(false);
    expect(spans.some((s) => s.label === "good")).toBe(true);
  });

  it("localizes the 'sequence is just n²' oversimplified pattern to that premise", () => {
    const spans = annotateReasoning(
      "The sequence is just n\u00b2, so the next term is 6\u00b2 = 36.",
      {
        prompt: "The sequence begins 5, 11, 23, 41, 65, … What is the next term?",
        verifiedAnswer: 95,
        answerWasWrong: true,
      },
    );
    const red = spans.find((s) => s.label === "flawed");
    expect(red, "the n² premise is reddened").toBeTruthy();
    // Granular: the red span is the premise phrase, not the whole sentence.
    expect(red!.excerpt).toContain("n\u00b2");
    expect(red!.excerpt.length).toBeLessThan(
      "The sequence is just n\u00b2, so the next term is 6\u00b2 = 36.".length,
    );
    // Content-referential: quotes the user's own words, nudges without the answer.
    expect(red!.why).toContain("n\u00b2");
    expect(red!.why).not.toContain("95");
    expect(red!.why.toLowerCase()).not.toContain("load-bearing");
  });

  it("localizes an independence-abuse premise on a without-replacement problem", () => {
    const spans = annotateReasoning(
      "The draws are independent, so P(both red) = p × p = (5/8)(5/8) = 25/64.",
      {
        prompt:
          "An urn has 5 red and 3 blue balls. Two are drawn WITHOUT replacement. What is P(both red)?",
        verifiedAnswer: 0.3571,
        answerWasWrong: true,
      },
    );
    const flawed = spans.filter((s) => s.label === "flawed");
    expect(flawed.length).toBeGreaterThanOrEqual(1);
    expect(flawed.some((s) => /independent|dependent|without replacement/i.test(s.why))).toBe(
      true,
    );
  });
});

describe("annotateReasoning — GRANULAR highlighting, not blanket (Problem 1)", () => {
  it("a thorough CORRECT derivation → tight green on key steps only, zero red", () => {
    const text =
      "First I look at the gaps between the terms. The first differences are 6, 12, 18, 24, a constant second difference of 6, so the pattern is quadratic. Adding the next gap of 30 gives 65 + 30 = 95, so the next term is 95.";
    const spans = annotateReasoning(text, {
      verifiedAnswer: 95,
      mechanismSignals: ["second difference", "quadratic", "first difference"],
    });
    expect(spans.some((s) => s.label === "flawed")).toBe(false);
    const green = spans.filter((s) => s.label === "good");
    expect(green.length).toBeGreaterThan(0);
    const covered = green.reduce((n, s) => n + (s.end - s.start), 0);
    // NOT a wall of green — only the load-bearing bits are colored.
    expect(covered / text.length).toBeLessThan(0.6);
  });

  it("a wrong-premise answer → red only on the specific claim (a minority)", () => {
    const text = "The sequence is just n\u00b2, so the next term is 6\u00b2 = 36.";
    const spans = annotateReasoning(text, {
      prompt: "The sequence begins 5, 11, 23, 41, 65, … What is the next term?",
      verifiedAnswer: 95,
      answerWasWrong: true,
    });
    const red = spans.filter((s) => s.label === "flawed");
    expect(red.length).toBeGreaterThanOrEqual(1);
    const covered = red.reduce((n, s) => n + (s.end - s.start), 0);
    expect(covered / text.length).toBeLessThan(0.7); // not the whole blob
  });
});

describe("annotateReasoning — feedback has no banned generic phrases (Problem 2)", () => {
  const BANNED = ["load-bearing", "load bearing", "locate the broken step"];
  it("never emits a banned template phrase across good & flawed spans", () => {
    const samples: [string, Parameters<typeof annotateReasoning>[1]][] = [
      [
        "There is a 50% chance that one die is 3 or less. So the answer is 4.25.",
        {
          prompt:
            "Two fair six-sided dice are rolled. Expected value of the LARGER (the maximum)?",
          verifiedAnswer: 4.4722,
          answerWasWrong: true,
        },
      ],
      [
        "The two dice are independent so I'll just guess the answer is 5.",
        {
          prompt: "Use E[max] + E[min] = E[sum] to check — state E[max] + E[min].",
          verifiedAnswer: 7,
          answerWasWrong: true,
        },
      ],
      [
        "24 + 6 = 30, so the next term is 95.",
        { verifiedAnswer: 95, mechanismSignals: ["second difference"] },
      ],
    ];
    for (const [text, opts] of samples) {
      for (const s of annotateReasoning(text, opts)) {
        for (const b of BANNED) {
          expect(s.why.toLowerCase(), `"${s.why}"`).not.toContain(b);
        }
      }
    }
  });
});
