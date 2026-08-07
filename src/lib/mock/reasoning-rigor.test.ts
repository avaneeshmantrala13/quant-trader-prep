import { describe, expect, it } from "vitest";
import {
  findFalseArithmetic,
  gradeReasoningDeterministic,
  normalizeReasoningPayload,
} from "./reasoning";

/* -------------------------------------------------------------------------- */
/*  Reasoning-grader RIGOR — a correct answer via a FALSE/nonsensical step is  */
/*  rated `flawed`, never `sound`. Correctness is never flipped by reasoning.  */
/* -------------------------------------------------------------------------- */

describe("findFalseArithmetic — verifies STATED arithmetic (words + symbols)", () => {
  it("catches a false word-form division: '1 divided by 2 is 5'", () => {
    const f = findFalseArithmetic("1 divided by 2 is 5 so add a decimal and get 0.5");
    expect(f).not.toBeNull();
    expect(f?.correct).toBeCloseTo(0.5, 10);
    expect(f?.stated).toBe(5);
    // Feedback names the exact false clause and the real result.
    expect(f?.message).toMatch(/1 divided by 2 is 5/);
    expect(f?.message).toMatch(/0\.5/);
  });

  it("catches a false word-form multiplication: '3 times 4 equals 11'", () => {
    const f = findFalseArithmetic("we have 3 times 4 equals 11 here");
    expect(f).not.toBeNull();
    expect(f?.correct).toBe(12);
    expect(f?.stated).toBe(11);
  });

  it("catches a false symbol-form step: '3 × 1/2 = 3/8'", () => {
    const f = findFalseArithmetic("independent, so 3 × 1/2 = 3/8");
    expect(f).not.toBeNull();
    expect(f?.correct).toBeCloseTo(1.5, 10);
  });

  it("does NOT flag a correct stated computation", () => {
    expect(findFalseArithmetic("2 times 3 is 6, then 6 plus 4 is 10")).toBeNull();
    expect(findFalseArithmetic("12 times 12 is 144")).toBeNull();
    expect(findFalseArithmetic("1 over 2 is 0.5")).toBeNull();
  });

  it("tolerates reasonable rounding (does not flag honest approximations)", () => {
    // 1 ÷ 3 = 0.333…; writing 0.33 is an approximation, not a blunder.
    expect(findFalseArithmetic("1 divided by 3 is 0.33")).toBeNull();
    expect(findFalseArithmetic("10 divided by 3 is 3.33")).toBeNull();
  });

  it("returns null when there is no stated equality", () => {
    expect(findFalseArithmetic("Three of eight outcomes have two heads, so 3/8.")).toBeNull();
    expect(findFalseArithmetic("")).toBeNull();
  });
});

describe("gradeReasoningDeterministic — the '1 ÷ 2 is 5 … 0.5' bug is FLAWED", () => {
  const BUG = {
    prompt: "Express 1/2 as a decimal.",
    correctAnswer: "0.5",
    correct: true, // the numeric verifier already marked the ANSWER correct
    reasoning: "1 divided by 2 is 5 so add a decimal in the beginning and get 0.5",
    isMentalMath: true,
  };

  it("rates the nonsensical-but-correct reasoning as flawed (not sound)", () => {
    const g = gradeReasoningDeterministic(BUG);
    expect(g.quality).toBe("flawed");
    expect(g.quality).not.toBe("sound");
  });

  it("gives specific feedback naming the false step and the correct value", () => {
    const g = gradeReasoningDeterministic(BUG);
    const joined = g.issues.join(" ");
    expect(joined).toMatch(/1 divided by 2 is 5/);
    expect(joined).toMatch(/0\.5/);
  });

  it("NEVER flips answer-correctness (grade carries no correctness field)", () => {
    const g = gradeReasoningDeterministic(BUG);
    // The grade only reports quality/issues/probe/source — nothing that could
    // override the verifier's `correct` verdict.
    expect(Object.keys(g).sort()).toEqual(["issues", "probe", "quality", "source"]);
    // Even with a WRONG answer, the same flawed step is still flawed.
    const wrong = gradeReasoningDeterministic({ ...BUG, correct: false });
    expect(wrong.quality).toBe("flawed");
  });

  it("still flags flawed for a false step even when it is NOT mental math", () => {
    const g = gradeReasoningDeterministic({ ...BUG, isMentalMath: false });
    expect(g.quality).toBe("flawed");
  });
});

describe("gradeReasoningDeterministic — genuine reasoning is still sound", () => {
  it("keeps a correct, well-justified explanation sound", () => {
    const g = gradeReasoningDeterministic({
      prompt: "A fair coin is flipped 3 times. P(exactly 2 heads)?",
      correctAnswer: "3/8",
      correct: true,
      reasoning:
        "Three of the eight equally likely outcomes have exactly two heads, so P = 3/8.",
      isMentalMath: false,
    });
    expect(g.quality).toBe("sound");
  });

  it("keeps terse-but-correct mental math sound (brevity never punished)", () => {
    const g = gradeReasoningDeterministic({
      prompt: "12 × 12 = ?",
      correctAnswer: "144",
      correct: true,
      reasoning: "144",
      isMentalMath: true,
    });
    expect(g.quality).toBe("sound");
  });

  it("keeps a correct STATED mental-math step sound", () => {
    const g = gradeReasoningDeterministic({
      prompt: "12 × 12 = ?",
      correctAnswer: "144",
      correct: true,
      reasoning: "12 times 12 is 144",
      isMentalMath: true,
    });
    expect(g.quality).toBe("sound");
  });
});

describe("normalizeReasoningPayload — accepts the new 'flawed' quality", () => {
  it("passes through a valid 'flawed' verdict from the AI grader", () => {
    const g = normalizeReasoningPayload({
      reasoningQuality: "flawed",
      issues: ["you wrote '1 divided by 2 is 5' — that's wrong; 1 ÷ 2 = 0.5"],
      probe: "",
    });
    expect(g.quality).toBe("flawed");
    expect(g.issues.length).toBe(1);
    expect(g.source).toBe("ai");
  });
});
