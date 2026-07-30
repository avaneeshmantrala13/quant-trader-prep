import { describe, it, expect } from "vitest";
import { buildDeepDive, hasDeepDive } from "./deepDive";

describe("buildDeepDive", () => {
  it("is solver-grounded with no authored content: key idea + worked steps + solver pitfalls", () => {
    const view = buildDeepDive({
      concept: "Bayes' theorem",
      keyIdea: "Posterior ∝ likelihood × prior.",
      workedSteps: ["Set up P(A|B) = P(B|A)P(A)/P(B).", "Plug in the numbers."],
      workedExplanation: "The full worked reasoning.",
      solverPitfalls: ["Confusing P(A|B) with P(B|A).", "Ignoring the base rate."],
      answer: "0.25",
      answerLabel: "Answer",
    });
    const headings = view.sections.map((s) => s.heading);
    expect(headings).toContain("What this tests");
    expect(headings).toContain("Step by step on this example");
    expect(headings).toContain("Common pitfalls to avoid");
    // Worked steps come through verbatim from the solver.
    const steps = view.sections.find(
      (s) => s.heading === "Step by step on this example",
    );
    expect(steps?.items).toEqual([
      "Set up P(A|B) = P(B|A)P(A)/P(B).",
      "Plug in the numbers.",
    ]);
    // Solver pitfalls come through verbatim.
    const pit = view.sections.find(
      (s) => s.heading === "Common pitfalls to avoid",
    );
    expect(pit?.items).toContain("Confusing P(A|B) with P(B|A).");
    expect(view.answer).toBe("0.25");
    expect(hasDeepDive(view)).toBe(true);
  });

  it("merges authored conceptual framing ahead of the concrete steps", () => {
    const view = buildDeepDive({
      keyIdea: "Condition on the first step.",
      authored: {
        whyItWorks: "First-step analysis turns a recursion into one equation.",
        approach: ["Define the unknown expectation.", "Condition on step one."],
        pitfalls: ["Forgetting the +1 for the step taken."],
      },
      workedSteps: ["E = 1 + (1/2)E.", "Solve E = 2."],
      solverPitfalls: ["Dropping the self-loop term."],
    });
    const headings = view.sections.map((s) => s.heading);
    // Authored general method precedes the concrete example steps.
    expect(headings.indexOf("The general method")).toBeLessThan(
      headings.indexOf("Step by step on this example"),
    );
    const why = view.sections.find(
      (s) => s.heading === "Why this approach works",
    );
    expect(why?.body).toBe(
      "First-step analysis turns a recursion into one equation.",
    );
    // Pitfalls concatenate authored + solver, deduped and in order.
    const pit = view.sections.find(
      (s) => s.heading === "Common pitfalls to avoid",
    );
    expect(pit?.items).toEqual([
      "Forgetting the +1 for the step taken.",
      "Dropping the self-loop term.",
    ]);
  });

  it("dedupes case-insensitively and drops blanks", () => {
    const view = buildDeepDive({
      keyIdea: "K.",
      solverPitfalls: ["Same trap.", "same trap.", "  ", "Other trap."],
    });
    const pit = view.sections.find(
      (s) => s.heading === "Common pitfalls to avoid",
    );
    expect(pit?.items).toEqual(["Same trap.", "Other trap."]);
  });

  it("falls back to the first lesson paragraph for 'why it works' when nothing else is present", () => {
    const view = buildDeepDive({
      keyIdea: "Thesis.",
      fallbackParagraphs: ["A briefing paragraph.", "Second paragraph."],
    });
    const why = view.sections.find(
      (s) => s.heading === "Why this approach works",
    );
    expect(why?.body).toBe("A briefing paragraph.");
  });

  it("returns an empty view when there is genuinely nothing to show", () => {
    const view = buildDeepDive({});
    expect(view.sections).toHaveLength(0);
    expect(hasDeepDive(view)).toBe(false);
  });
});
