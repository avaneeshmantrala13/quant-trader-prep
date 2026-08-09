import { describe, expect, it } from "vitest";
import {
  MENTAL_MATH_SPRINT_FORMAT,
  MENTAL_MATH_SPRINT_ITEM_COUNT,
  OA_FORMATS,
} from "./config";
import {
  advanceSprint,
  createOaSession,
  remainingQuestionMs,
  resumeOaSession,
  submitOaSession,
} from "./timedSession";
import {
  buildMentalMathSprintSections,
  drawMentalMathSprint,
  MENTAL_MATH_SPRINT_BUDGETS_MS,
  MENTAL_MATH_SPRINT_SUBTOPICS,
  MM_SPRINT_FAST_FRACTION,
  MM_SPRINT_SLOW_FLOOR,
  mentalMathSpeedCredit,
  mentalMathSprintAttempts,
  mentalMathSprintBudgetsForSession,
  mentalMathSprintSubtopicsForSession,
  scoreMentalMathSprint,
} from "./mentalMathSprint";
import type { OaSessionState } from "./types";
import {
  MENTAL_MATH_SUBTOPICS,
  MENTAL_MATH_TOPIC_KEY,
  mentalMathSubtopicOf,
} from "@/content/mentalMath/subtopics";
import { scoredContentTopicKeys } from "@/lib/pipeline/gates";
import { applyItemAttempt } from "@/lib/mastery/mastery";

const AT = "2026-01-01T00:00:00.000Z";

/** Build a fresh sprint session (per-question budgets threaded through). */
function freshSprint(seed: number): {
  session: OaSessionState;
  subtopics: ReturnType<typeof mentalMathSprintSubtopicsForSession>;
  budgetsMs: number[];
} {
  const draw = drawMentalMathSprint(seed, MENTAL_MATH_SPRINT_ITEM_COUNT);
  const session = createOaSession(MENTAL_MATH_SPRINT_FORMAT, draw.questions, {
    nowTs: 1_000_000,
    questionBudgetsMs: draw.budgetsMs,
  });
  return { session, subtopics: draw.subtopics, budgetsMs: draw.budgetsMs };
}

/** Answer question i (correct or wrong) with a given elapsed time. */
function answer(
  session: OaSessionState,
  i: number,
  correct: boolean,
  elapsedMs: number,
): OaSessionState {
  const q = session.questions[i];
  const chosen = correct
    ? q.correctIndex
    : (q.correctIndex + 1) % q.choices.length;
  const answers = session.answers.map((a, j) =>
    j === i ? { ...a, chosen, elapsedMs } : a,
  );
  return { ...session, answers };
}

describe("mental-math sprint — section exists in the timed diagnostic", () => {
  it("is a sprint-kind format, not a user-pickable /oa preset", () => {
    expect(MENTAL_MATH_SPRINT_FORMAT.kind).toBe("sprint");
    expect(MENTAL_MATH_SPRINT_FORMAT.questionCount).toBe(
      MENTAL_MATH_SPRINT_ITEM_COUNT,
    );
    // Deliberately excluded from the pickable OA formats (like the timed diagnostic).
    expect(OA_FORMATS.some((f) => f.id === MENTAL_MATH_SPRINT_FORMAT.id)).toBe(
      false,
    );
  });

  it("covers EVERY mental-math subtopic and pace each on a ~10–18 s clock", () => {
    // The coverage list is the full canonical taxonomy.
    expect([...MENTAL_MATH_SPRINT_SUBTOPICS].sort()).toEqual(
      Object.keys(MENTAL_MATH_SUBTOPICS).sort(),
    );
    // A full-count draw hits every subtopic at least once.
    const draw = drawMentalMathSprint(4242, MENTAL_MATH_SPRINT_ITEM_COUNT);
    expect(new Set(draw.subtopics).size).toBe(
      MENTAL_MATH_SPRINT_SUBTOPICS.length,
    );
    // Every per-question budget is a sensible per-item shot clock (8–18 s).
    for (const b of Object.values(MENTAL_MATH_SPRINT_BUDGETS_MS)) {
      expect(b).toBeGreaterThanOrEqual(8_000);
      expect(b).toBeLessThanOrEqual(18_000);
    }
    for (const b of draw.budgetsMs) {
      expect(b).toBeGreaterThanOrEqual(8_000);
      expect(b).toBeLessThanOrEqual(18_000);
    }
  });
});

describe("mental-math sprint — deterministic + verifier-backed draw", () => {
  it("same (seed,count) ⇒ byte-identical questions, subtopics and budgets", () => {
    const a = drawMentalMathSprint(777, 12);
    const b = drawMentalMathSprint(777, 12);
    expect(a).toEqual(b);
    // Different seed ⇒ a different draw (at least one prompt differs).
    const c = drawMentalMathSprint(778, 12);
    expect(a.questions.map((q) => q.prompt)).not.toEqual(
      c.questions.map((q) => q.prompt),
    );
  });

  it("each item is a valid MCQ whose correct choice is present, and attributes to its subtopic", () => {
    const draw = drawMentalMathSprint(31337, 12);
    draw.questions.forEach((q, i) => {
      // A real 4-option MCQ with distinct choices and an in-range correct index.
      expect(q.choices.length).toBe(4);
      expect(new Set(q.choices).size).toBe(q.choices.length);
      expect(q.correctIndex).toBeGreaterThanOrEqual(0);
      expect(q.correctIndex).toBeLessThan(q.choices.length);
      expect(q.choices[q.correctIndex]).toBeTruthy();
      // The free-response "(Enter …)" hint is stripped from the MCQ prompt.
      expect(q.prompt).not.toMatch(/\(Enter/i);
      // The item's concept resolves to the plan's subtopic (precise attribution).
      expect(mentalMathSubtopicOf(q.concept)).toBe(draw.subtopics[i]);
    });
  });

  it("the engine ENFORCES the per-question budget on advance + away-skip", () => {
    const { session, budgetsMs } = freshSprint(12321);
    // Advancing gives the NEXT question a clock sized to ITS OWN budget.
    const now = session.startedAtTs + 1_000;
    const advanced = advanceSprint(session, now);
    expect(advanced.index).toBe(1);
    expect(advanced.questionDeadlineTs).toBe(now + budgetsMs[1]);
    expect(remainingQuestionMs(advanced, now)).toBe(budgetsMs[1]);

    // A reload after the FIRST question's budget passed auto-skips exactly it
    // (timeout = miss: chosen stays null, its own budget spent) and seeds q1's
    // fresh clock from q1's budget.
    const afterFirst = session.startedAtTs + budgetsMs[0] + 1;
    const resumed = resumeOaSession(session, afterFirst);
    expect(resumed.index).toBe(1);
    expect(resumed.answers[0].chosen).toBeNull();
    expect(resumed.answers[0].elapsedMs).toBe(budgetsMs[0]);
    expect(resumed.questionDeadlineTs).toBe(afterFirst + budgetsMs[1]);
  });

  it("recovers subtopics + budgets from a persisted session (reload-proof)", () => {
    const { session, subtopics, budgetsMs } = freshSprint(9090);
    expect(mentalMathSprintSubtopicsForSession(session)).toEqual(subtopics);
    expect(mentalMathSprintBudgetsForSession(session)).toEqual(budgetsMs);
    // The engine seeded the FIRST question's clock from its own per-question budget.
    expect(session.questionDeadlineTs).toBe(session.startedAtTs + budgetsMs[0]);
    expect(session.questionBudgetsMs).toEqual(budgetsMs);
  });
});

describe("mental-math sprint — SPEED-WEIGHTED scoring", () => {
  it("fast+correct > slow+correct > wrong/timeout", () => {
    const budget = 10_000;
    const fast = mentalMathSpeedCredit(2_000, budget, true);
    const slow = mentalMathSpeedCredit(9_000, budget, true);
    const wrong = mentalMathSpeedCredit(2_000, budget, false);
    const timeout = mentalMathSpeedCredit(budget, budget, false);
    expect(fast).toBeGreaterThan(slow);
    expect(slow).toBeGreaterThan(wrong);
    expect(wrong).toBe(0);
    expect(timeout).toBe(0);
  });

  it("full credit within the fast fraction; floor at the budget", () => {
    const budget = 10_000;
    expect(mentalMathSpeedCredit(0, budget, true)).toBe(1);
    expect(
      mentalMathSpeedCredit(MM_SPRINT_FAST_FRACTION * budget, budget, true),
    ).toBe(1);
    expect(mentalMathSpeedCredit(budget, budget, true)).toBe(MM_SPRINT_SLOW_FLOOR);
    // Monotonically non-increasing between the fast mark and the budget.
    expect(mentalMathSpeedCredit(6_000, budget, true)).toBeGreaterThan(
      mentalMathSpeedCredit(8_000, budget, true),
    );
  });

  it("scores a finished session per item (timeout = miss = 0)", () => {
    let { session, subtopics, budgetsMs } = freshSprint(555);
    // q0 fast-correct, q1 slow-correct, q2 wrong, the rest unanswered (timeout).
    session = answer(session, 0, true, 0.2 * budgetsMs[0]);
    session = answer(session, 1, true, budgetsMs[1]);
    session = answer(session, 2, false, 0.3 * budgetsMs[2]);
    session = submitOaSession(session, 2_000_000);

    const outcomes = scoreMentalMathSprint(session, subtopics, budgetsMs);
    expect(outcomes[0].credit).toBe(1);
    expect(outcomes[1].credit).toBe(MM_SPRINT_SLOW_FLOOR);
    expect(outcomes[1].correct).toBe(true);
    expect(outcomes[2].credit).toBe(0);
    // Unanswered ⇒ wrong ⇒ zero credit.
    for (let i = 3; i < outcomes.length; i++) {
      expect(outcomes[i].correct).toBe(false);
      expect(outcomes[i].credit).toBe(0);
    }
  });
});

describe("mental-math sprint — mastery + gate/section wiring", () => {
  it("maps every item to the mental-math node with fractional speed credit", () => {
    const { session, subtopics, budgetsMs } = freshSprint(24);
    const done = submitOaSession(
      answer(session, 0, true, 0.1 * budgetsMs[0]),
      2_000_000,
    );
    const outcomes = scoreMentalMathSprint(done, subtopics, budgetsMs);
    const attempts = mentalMathSprintAttempts(outcomes, AT);
    expect(attempts).toHaveLength(outcomes.length);
    for (const a of attempts) {
      expect(a.topicKey).toBe(MENTAL_MATH_TOPIC_KEY);
      expect(a.mode).toBe("quiz");
      expect(a.kOptions).toBe(4);
      expect(a.credit).toBeGreaterThanOrEqual(0);
      expect(a.credit).toBeLessThanOrEqual(1);
    }
  });

  it("a fast-correct sprint drives mastery UP, a slow/missed one drives it DOWN", () => {
    const mean = (alpha: number, beta: number) => alpha / (alpha + beta);
    // All fast-correct.
    let up: ReturnType<typeof applyItemAttempt>["mastery"] | undefined;
    for (let i = 0; i < 12; i++) {
      up = applyItemAttempt(
        up,
        undefined,
        {
          topicKey: MENTAL_MATH_TOPIC_KEY,
          tier: "medium",
          correct: true,
          mode: "quiz",
          kOptions: 4,
          credit: 1,
          at: AT,
        },
        i,
      ).mastery;
    }
    // All missed / timed out.
    let down: ReturnType<typeof applyItemAttempt>["mastery"] | undefined;
    for (let i = 0; i < 12; i++) {
      down = applyItemAttempt(
        down,
        undefined,
        {
          topicKey: MENTAL_MATH_TOPIC_KEY,
          tier: "medium",
          correct: false,
          mode: "quiz",
          kOptions: 4,
          credit: 0,
          at: AT,
        },
        i,
      ).mastery;
    }
    expect(mean(up!.alpha, up!.beta)).toBeGreaterThan(mean(down!.alpha, down!.beta));
    expect(mean(down!.alpha, down!.beta)).toBeLessThan(0.5);
  });

  it("builds ONE speed-weighted aggregate timed section on the mental-math node", () => {
    let { session, subtopics, budgetsMs } = freshSprint(4001);
    session = answer(session, 0, true, 0); // full credit
    session = answer(session, 1, true, budgetsMs[1]); // floor credit
    session = submitOaSession(session, 2_000_000);
    const outcomes = scoreMentalMathSprint(session, subtopics, budgetsMs);
    const sections = buildMentalMathSprintSections(outcomes, AT);
    expect(sections).toHaveLength(1);
    const s = sections[0];
    expect(s.topicKeys).toEqual([MENTAL_MATH_TOPIC_KEY]);
    expect(s.total).toBe(outcomes.length);
    // correct = SUM of speed-weighted credit (fractional), not a raw count.
    const sumCredit = outcomes.reduce((acc, o) => acc + o.credit, 0);
    expect(s.correct).toBeCloseTo(sumCredit, 4);
    expect(s.correct).toBeLessThan(s.total);
  });

  it("mental-math is a scored content node ⇒ a weak sprint feeds drilling", () => {
    // The node the sprint drives is part of the drilled/gated content universe.
    expect(scoredContentTopicKeys()).toContain(MENTAL_MATH_TOPIC_KEY);
  });
});
