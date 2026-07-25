import { describe, expect, it } from "vitest";
import type { Question } from "@/types/content";
import { buildSelfExplainMCQ } from "./selfExplain";

const base: Question = {
  id: "q1",
  prompt: "What is P(A|B)?",
  choices: ["1/3", "1/2", "1/6", "2/3"],
  correctIndex: 0,
  explanation: "It is 1/3 by reduced sample space.",
  difficulty: "easy",
  distractorRationale: [
    "Correct — favorable over survivors.",
    "The reversed conditional trap.",
    "Divided by the full space, ignoring conditioning.",
    "Double-counted the overlap.",
  ],
};

describe("buildSelfExplainMCQ", () => {
  it("uses the item's rationales as options, pointing at the correct one", () => {
    const mcq = buildSelfExplainMCQ(base);
    expect(mcq).not.toBeNull();
    expect(mcq!.options).toEqual(base.distractorRationale);
    expect(mcq!.correctIndex).toBe(base.correctIndex);
    expect(mcq!.options[mcq!.correctIndex]).toContain("Correct");
  });

  it("returns null when the item has no rationales", () => {
    const noRat: Question = { ...base, distractorRationale: undefined };
    expect(buildSelfExplainMCQ(noRat)).toBeNull();
  });

  it("returns null when there are fewer than two rationales", () => {
    const one: Question = { ...base, distractorRationale: ["only one"] };
    expect(buildSelfExplainMCQ(one)).toBeNull();
  });
});
