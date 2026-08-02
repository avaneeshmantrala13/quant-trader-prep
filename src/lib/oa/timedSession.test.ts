import { describe, expect, it } from "vitest";
import {
  advanceSprint,
  createOaSession,
  currentQuestion,
  isDeadlinePassed,
  navigateTo,
  recordAnswer,
  remainingQuestionMs,
  remainingSectionMs,
  resumeOaSession,
  sessionCount,
  submitOaSession,
} from "./timedSession";
import {
  BLITZ_FORMAT,
  DEEP_SET_FORMAT,
  DERIVATION_FORMAT,
  MEASURED_FORMAT,
  RAPID_BATTERY_FORMAT,
  SECTION_FORMAT,
  SPRINT_FORMAT,
  oaFormatById,
} from "./config";
import type { OaQuestion } from "./types";

const T0 = 1_000_000; // arbitrary fixed epoch-ms base for determinism.

/** Build `n` tiny valid OaQuestions. */
function makeQuestions(n: number): OaQuestion[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `q${i}`,
    prompt: `Prompt ${i}`,
    choices: ["a", "b", "c", "d"],
    correctIndex: i % 4,
    explanation: `because ${i}`,
    difficulty: "medium" as const,
  }));
}

describe("createOaSession", () => {
  it("seeds a section session with a section deadline (no per-question clock)", () => {
    const qs = makeQuestions(SECTION_FORMAT.questionCount);
    const s = createOaSession(SECTION_FORMAT, qs, { nowTs: T0 });

    expect(s.id).toBe(`${SECTION_FORMAT.id}:${T0}`);
    expect(s.formatId).toBe(SECTION_FORMAT.id);
    expect(s.kind).toBe("section");
    expect(s.startedAtTs).toBe(T0);
    expect(s.status).toBe("running");
    expect(s.index).toBe(0);
    expect(s.budgetMs).toBe(SECTION_FORMAT.budgetMs);
    expect(s.deadlineTs).toBe(T0 + (SECTION_FORMAT.sectionSec as number) * 1000);
    expect(s.questionDeadlineTs).toBeUndefined();
    expect(s.completedAtTs).toBeUndefined();
  });

  it("seeds a sprint session with a per-question deadline (no section clock)", () => {
    const qs = makeQuestions(SPRINT_FORMAT.questionCount);
    const s = createOaSession(SPRINT_FORMAT, qs, { nowTs: T0 });

    expect(s.kind).toBe("sprint");
    expect(s.deadlineTs).toBeUndefined();
    expect(s.questionDeadlineTs).toBe(
      T0 + (SPRINT_FORMAT.perQuestionSec as number) * 1000,
    );
    expect(s.budgetMs).toBe(SPRINT_FORMAT.budgetMs);
  });

  it("seeds a measured session with neither deadline", () => {
    const qs = makeQuestions(MEASURED_FORMAT.questionCount);
    const s = createOaSession(MEASURED_FORMAT, qs, { nowTs: T0 });

    expect(s.kind).toBe("measured");
    expect(s.deadlineTs).toBeUndefined();
    expect(s.questionDeadlineTs).toBeUndefined();
    expect(s.status).toBe("running");
  });

  it("initializes one blank answer per question, parallel by position", () => {
    const qs = makeQuestions(3);
    const s = createOaSession(SECTION_FORMAT, qs, { nowTs: T0 });
    expect(s.answers).toHaveLength(3);
    expect(sessionCount(s)).toBe(3);
    s.answers.forEach((a, i) => {
      expect(a).toEqual({ questionId: qs[i].id, chosen: null, elapsedMs: 0 });
    });
  });

  it("resolves hardMode scoring for section (wrong === -1 vs 0)", () => {
    const qs = makeQuestions(2);
    const hard = createOaSession(SECTION_FORMAT, qs, {
      nowTs: T0,
      hardMode: true,
    });
    const soft = createOaSession(SECTION_FORMAT, qs, {
      nowTs: T0,
      hardMode: false,
    });
    expect(hard.hardMode).toBe(true);
    expect(hard.scoring.wrong).toBe(-1);
    expect(soft.hardMode).toBe(false);
    expect(soft.scoring.wrong).toBe(0);
    expect(soft.scoring.correct).toBe(1);
  });

  it("an empty question set yields a valid but already-submitted session", () => {
    const s = createOaSession(SECTION_FORMAT, [], { nowTs: T0 });
    expect(s.status).toBe("submitted");
    expect(s.completedAtTs).toBe(T0);
    expect(s.answers).toEqual([]);
    expect(currentQuestion(s)).toBeUndefined();
  });
});

describe("remaining time math", () => {
  it("remainingSectionMs decreases, clamps at 0, and is null off-kind", () => {
    const s = createOaSession(SECTION_FORMAT, makeQuestions(3), { nowTs: T0 });
    const full = (SECTION_FORMAT.sectionSec as number) * 1000;
    expect(remainingSectionMs(s, T0)).toBe(full);
    expect(remainingSectionMs(s, T0 + 60_000)).toBe(full - 60_000);
    expect(remainingSectionMs(s, T0 + full + 5_000)).toBe(0);

    const sprint = createOaSession(SPRINT_FORMAT, makeQuestions(3), {
      nowTs: T0,
    });
    expect(remainingSectionMs(sprint, T0)).toBeNull();
  });

  it("remainingQuestionMs decreases, clamps at 0, and is null off-kind", () => {
    const s = createOaSession(SPRINT_FORMAT, makeQuestions(3), { nowTs: T0 });
    const full = (SPRINT_FORMAT.perQuestionSec as number) * 1000;
    expect(remainingQuestionMs(s, T0)).toBe(full);
    expect(remainingQuestionMs(s, T0 + 10_000)).toBe(full - 10_000);
    expect(remainingQuestionMs(s, T0 + full + 1)).toBe(0);

    const section = createOaSession(SECTION_FORMAT, makeQuestions(3), {
      nowTs: T0,
    });
    expect(remainingQuestionMs(section, T0)).toBeNull();
  });

  it("isDeadlinePassed is true only at/after a section deadline", () => {
    const s = createOaSession(SECTION_FORMAT, makeQuestions(3), { nowTs: T0 });
    const dl = s.deadlineTs as number;
    expect(isDeadlinePassed(s, dl - 1)).toBe(false);
    expect(isDeadlinePassed(s, dl)).toBe(true);
    expect(isDeadlinePassed(s, dl + 1000)).toBe(true);

    const measured = createOaSession(MEASURED_FORMAT, makeQuestions(3), {
      nowTs: T0,
    });
    expect(isDeadlinePassed(measured, T0 + 10_000_000)).toBe(false);
  });
});

describe("recordAnswer", () => {
  it("sets chosen and accumulates elapsed without advancing or mutating", () => {
    const s0 = createOaSession(SECTION_FORMAT, makeQuestions(3), { nowTs: T0 });
    const s1 = recordAnswer(s0, 1, 2, 5_000, T0 + 5_000);
    expect(s1.answers[1].chosen).toBe(2);
    expect(s1.answers[1].elapsedMs).toBe(5_000);
    expect(s1.index).toBe(0); // no advance
    expect(s1.deadlineTs).toBe(s0.deadlineTs); // no deadline change

    const s2 = recordAnswer(s1, 1, 3, 2_500, T0 + 7_500);
    expect(s2.answers[1].chosen).toBe(3);
    expect(s2.answers[1].elapsedMs).toBe(7_500); // accumulated

    // Purity: original untouched, new object refs on the changed path.
    expect(s0.answers[1].chosen).toBeNull();
    expect(s0.answers[1].elapsedMs).toBe(0);
    expect(s1).not.toBe(s0);
    expect(s1.answers).not.toBe(s0.answers);
    expect(s1.answers[1]).not.toBe(s0.answers[1]);
  });

  it("ignores negative elapsed deltas (clamped at 0)", () => {
    const s0 = createOaSession(SECTION_FORMAT, makeQuestions(2), { nowTs: T0 });
    const s1 = recordAnswer(s0, 0, 1, -9999, T0);
    expect(s1.answers[0].elapsedMs).toBe(0);
    expect(s1.answers[0].chosen).toBe(1);
  });

  it("is a no-op for out-of-range index and terminal sessions", () => {
    const s0 = createOaSession(SECTION_FORMAT, makeQuestions(2), { nowTs: T0 });
    expect(recordAnswer(s0, -1, 0, 100, T0)).toBe(s0);
    expect(recordAnswer(s0, 2, 0, 100, T0)).toBe(s0);

    const done = submitOaSession(s0, T0 + 1);
    expect(recordAnswer(done, 0, 1, 100, T0 + 2)).toBe(done);
  });
});

describe("advanceSprint", () => {
  it("advances index and refreshes the per-question deadline", () => {
    const s0 = createOaSession(SPRINT_FORMAT, makeQuestions(3), { nowTs: T0 });
    const at = T0 + 30_000;
    const s1 = advanceSprint(s0, at);
    expect(s1.index).toBe(1);
    expect(s1.status).toBe("running");
    expect(s1.questionDeadlineTs).toBe(at + s0.budgetMs);
    expect(s1).not.toBe(s0);
  });

  it("submits after advancing past the last question", () => {
    let s = createOaSession(SPRINT_FORMAT, makeQuestions(2), { nowTs: T0 });
    s = advanceSprint(s, T0 + 10_000); // -> index 1
    expect(s.status).toBe("running");
    s = advanceSprint(s, T0 + 20_000); // -> index 2 (past last)
    expect(s.index).toBe(2);
    expect(s.status).toBe("submitted");
    expect(s.completedAtTs).toBe(T0 + 20_000);
    expect(s.questionDeadlineTs).toBeUndefined();
  });

  it("is a no-op for non-sprint kinds and terminal sessions", () => {
    const section = createOaSession(SECTION_FORMAT, makeQuestions(3), {
      nowTs: T0,
    });
    expect(advanceSprint(section, T0 + 1000)).toBe(section);

    const sprint = createOaSession(SPRINT_FORMAT, makeQuestions(1), {
      nowTs: T0,
    });
    const done = submitOaSession(sprint, T0 + 1);
    expect(advanceSprint(done, T0 + 2)).toBe(done);
  });
});

describe("navigateTo", () => {
  it("moves the index for section without touching deadlines", () => {
    const s0 = createOaSession(SECTION_FORMAT, makeQuestions(5), { nowTs: T0 });
    const s1 = navigateTo(s0, 3);
    expect(s1.index).toBe(3);
    expect(s1.deadlineTs).toBe(s0.deadlineTs);
    expect(s1).not.toBe(s0);
    // measured navigates too
    const m = createOaSession(MEASURED_FORMAT, makeQuestions(5), { nowTs: T0 });
    expect(navigateTo(m, 4).index).toBe(4);
  });

  it("is a no-op for sprint (no going back) and out-of-range", () => {
    const sprint = createOaSession(SPRINT_FORMAT, makeQuestions(5), {
      nowTs: T0,
    });
    expect(navigateTo(sprint, 2)).toBe(sprint);

    const section = createOaSession(SECTION_FORMAT, makeQuestions(5), {
      nowTs: T0,
    });
    expect(navigateTo(section, -1)).toBe(section);
    expect(navigateTo(section, 5)).toBe(section);
  });
});

describe("submitOaSession", () => {
  it("marks submitted/expired with completion timestamp and is idempotent", () => {
    const s0 = createOaSession(SECTION_FORMAT, makeQuestions(3), { nowTs: T0 });
    const submitted = submitOaSession(s0, T0 + 100);
    expect(submitted.status).toBe("submitted");
    expect(submitted.completedAtTs).toBe(T0 + 100);

    const expired = submitOaSession(s0, T0 + 200, "expired");
    expect(expired.status).toBe("expired");
    expect(expired.completedAtTs).toBe(T0 + 200);

    // idempotent: already terminal returns the same reference.
    expect(submitOaSession(submitted, T0 + 999)).toBe(submitted);
    expect(submitOaSession(expired, T0 + 999, "submitted")).toBe(expired);
  });
});

describe("resumeOaSession — section", () => {
  it("normal resume before the deadline returns running with correct remaining", () => {
    const s0 = createOaSession(SECTION_FORMAT, makeQuestions(3), { nowTs: T0 });
    const at = T0 + 60_000;
    const s1 = resumeOaSession(s0, at);
    expect(s1).toBe(s0); // unchanged
    expect(s1.status).toBe("running");
    expect(remainingSectionMs(s1, at)).toBe(
      (SECTION_FORMAT.sectionSec as number) * 1000 - 60_000,
    );
  });

  it("expiring while away marks expired AT the deadline (clock did not pause)", () => {
    const s0 = createOaSession(SECTION_FORMAT, makeQuestions(3), { nowTs: T0 });
    const dl = s0.deadlineTs as number;
    const wayLater = dl + 10_000_000; // long gone
    const s1 = resumeOaSession(s0, wayLater);
    expect(s1.status).toBe("expired");
    expect(s1.completedAtTs).toBe(dl); // exactly at deadline, not `wayLater`
  });

  it("resuming EXACTLY at the deadline expires", () => {
    const s0 = createOaSession(SECTION_FORMAT, makeQuestions(3), { nowTs: T0 });
    const dl = s0.deadlineTs as number;
    const s1 = resumeOaSession(s0, dl);
    expect(s1.status).toBe("expired");
    expect(s1.completedAtTs).toBe(dl);
  });
});

describe("resumeOaSession — sprint", () => {
  it("returning within the current clock leaves the session unchanged", () => {
    const s0 = createOaSession(SPRINT_FORMAT, makeQuestions(3), { nowTs: T0 });
    const within = (s0.questionDeadlineTs as number) - 1;
    expect(resumeOaSession(s0, within)).toBe(s0);
  });

  it("auto-skips the timed-out question and gives the next a fresh clock", () => {
    const s0 = createOaSession(SPRINT_FORMAT, makeQuestions(3), { nowTs: T0 });
    // Return just past q0's deadline but within a fresh budget for q1.
    const at = (s0.questionDeadlineTs as number) + 1_000;
    const s1 = resumeOaSession(s0, at);

    expect(s1.index).toBe(1);
    expect(s1.status).toBe("running");
    // q0 recorded skipped: chosen null, full budget spent.
    expect(s1.answers[0].chosen).toBeNull();
    expect(s1.answers[0].elapsedMs).toBe(s0.budgetMs);
    // q1 shown now ⇒ fresh full clock from `at`.
    expect(s1.questionDeadlineTs).toBe(at + s0.budgetMs);
    // purity
    expect(s1).not.toBe(s0);
    expect(s0.answers[0].elapsedMs).toBe(0);
  });

  it("timing out on the LAST question submits (completed at the timeout moment)", () => {
    let s = createOaSession(SPRINT_FORMAT, makeQuestions(2), { nowTs: T0 });
    // Advance to the last question (index 1) with a known fresh deadline.
    s = advanceSprint(s, T0 + 5_000);
    const qDl = s.questionDeadlineTs as number;
    const s1 = resumeOaSession(s, qDl + 500);
    expect(s1.index).toBe(2);
    expect(s1.status).toBe("submitted");
    expect(s1.answers[1].chosen).toBeNull();
    expect(s1.answers[1].elapsedMs).toBe(s.budgetMs);
    expect(s1.completedAtTs).toBe(qDl); // the moment it timed out
    expect(s1.questionDeadlineTs).toBeUndefined();
  });

  it("uses the sprint budget as the per-question window (matches config)", () => {
    const s0 = createOaSession(SPRINT_FORMAT, makeQuestions(3), { nowTs: T0 });
    expect(s0.budgetMs).toBe(oaFormatById(s0.formatId)?.budgetMs);
    expect(s0.budgetMs).toBe((SPRINT_FORMAT.perQuestionSec as number) * 1000);
  });
});

describe("resumeOaSession — measured & terminal", () => {
  it("measured has no clocks to reconcile (unchanged even far in the future)", () => {
    const s0 = createOaSession(MEASURED_FORMAT, makeQuestions(3), { nowTs: T0 });
    expect(resumeOaSession(s0, T0 + 100_000_000)).toBe(s0);
  });

  it("terminal sessions are returned unchanged", () => {
    const s0 = createOaSession(SECTION_FORMAT, makeQuestions(3), { nowTs: T0 });
    const done = submitOaSession(s0, T0 + 1);
    expect(resumeOaSession(done, T0 + 10_000_000)).toBe(done);
  });
});

describe("reload round-trip (plain-serializable, deadline-based time)", () => {
  it("section resume behaves identically after a JSON round-trip", () => {
    const s0 = createOaSession(SECTION_FORMAT, makeQuestions(3), { nowTs: T0 });
    const wayLater = (s0.deadlineTs as number) + 5_000_000;

    const direct = resumeOaSession(s0, wayLater);
    const rehydrated = JSON.parse(JSON.stringify(s0));
    const roundTrip = resumeOaSession(rehydrated, wayLater);

    expect(roundTrip).toEqual(direct);
    expect(roundTrip.status).toBe("expired");
    expect(roundTrip.completedAtTs).toBe(s0.deadlineTs);
  });

  it("sprint resume behaves identically after a JSON round-trip", () => {
    const s0 = createOaSession(SPRINT_FORMAT, makeQuestions(3), { nowTs: T0 });
    const at = (s0.questionDeadlineTs as number) + 1_000;

    const direct = resumeOaSession(s0, at);
    const rehydrated = JSON.parse(JSON.stringify(s0));
    const roundTrip = resumeOaSession(rehydrated, at);

    expect(roundTrip).toEqual(direct);
  });
});

/* -------------------------------------------------------------------------- */
/*  Research-derived formats — new-format engine behavior                     */
/* -------------------------------------------------------------------------- */

describe("createOaSession — module-lock flag (noBack)", () => {
  it("seeds noBack ONLY for the module-locked section (Derivation)", () => {
    const derivation = createOaSession(
      DERIVATION_FORMAT,
      makeQuestions(DERIVATION_FORMAT.questionCount),
      { nowTs: T0 },
    );
    expect(derivation.kind).toBe("section");
    expect(derivation.noBack).toBe(true);
    // It still runs on ONE section clock (no per-question deadline).
    expect(derivation.deadlineTs).toBe(
      T0 + (DERIVATION_FORMAT.sectionSec as number) * 1000,
    );
    expect(derivation.questionDeadlineTs).toBeUndefined();
  });

  it("does NOT seed noBack for free-nav sections or sprint/measured", () => {
    const blitz = createOaSession(BLITZ_FORMAT, makeQuestions(4), { nowTs: T0 });
    const deep = createOaSession(DEEP_SET_FORMAT, makeQuestions(4), { nowTs: T0 });
    const rapid = createOaSession(RAPID_BATTERY_FORMAT, makeQuestions(4), {
      nowTs: T0,
    });
    const section = createOaSession(SECTION_FORMAT, makeQuestions(4), { nowTs: T0 });
    const measured = createOaSession(MEASURED_FORMAT, makeQuestions(4), { nowTs: T0 });
    for (const s of [blitz, deep, rapid, section, measured]) {
      expect(s.noBack).toBeUndefined();
    }
  });

  it("Rapid Mixed Battery is a sprint with a fresh per-question clock", () => {
    const rapid = createOaSession(RAPID_BATTERY_FORMAT, makeQuestions(5), {
      nowTs: T0,
    });
    expect(rapid.kind).toBe("sprint");
    expect(rapid.budgetMs).toBe(15_000);
    expect(rapid.questionDeadlineTs).toBe(T0 + 15_000);
    // Auto-advance refreshes the per-question clock, never going back.
    const next = advanceSprint(rapid, T0 + 4_000);
    expect(next.index).toBe(1);
    expect(next.questionDeadlineTs).toBe(T0 + 4_000 + 15_000);
  });
});

describe("navigateTo — module-lock is forward-only", () => {
  it("blocks going back but allows moving forward in a module-locked section", () => {
    const s0 = createOaSession(DERIVATION_FORMAT, makeQuestions(5), { nowTs: T0 });
    const atIndex2 = navigateTo(navigateTo(s0, 1), 2);
    expect(atIndex2.index).toBe(2);
    // Going back to an earlier (or the same) question is a no-op.
    expect(navigateTo(atIndex2, 1)).toBe(atIndex2);
    expect(navigateTo(atIndex2, 0)).toBe(atIndex2);
    expect(navigateTo(atIndex2, 2)).toBe(atIndex2);
    // Forward still works.
    expect(navigateTo(atIndex2, 4).index).toBe(4);
  });

  it("a FREE-nav section (Deep Set) still jumps anywhere, including backward", () => {
    const s0 = createOaSession(DEEP_SET_FORMAT, makeQuestions(6), { nowTs: T0 });
    const fwd = navigateTo(s0, 4);
    expect(fwd.index).toBe(4);
    expect(navigateTo(fwd, 1).index).toBe(1); // backward allowed
  });
});

describe("resumeOaSession — new section formats auto-submit at the section deadline", () => {
  it("module-locked Derivation expires exactly at its 36-min deadline", () => {
    const s0 = createOaSession(DERIVATION_FORMAT, makeQuestions(3), { nowTs: T0 });
    const dl = s0.deadlineTs as number;
    expect(dl).toBe(T0 + 36 * 60 * 1000);
    const resumed = resumeOaSession(s0, dl + 5_000_000);
    expect(resumed.status).toBe("expired");
    expect(resumed.completedAtTs).toBe(dl);
    // noBack survives the reconcile.
    expect(resumed.noBack).toBe(true);
  });

  it("free-nav Blitz expires at its 16-min deadline", () => {
    const s0 = createOaSession(BLITZ_FORMAT, makeQuestions(3), { nowTs: T0 });
    const dl = s0.deadlineTs as number;
    expect(dl).toBe(T0 + 16 * 60 * 1000);
    expect(resumeOaSession(s0, dl).status).toBe("expired");
  });

  it("module-locked resume is identical after a JSON round-trip (noBack persists)", () => {
    const s0 = createOaSession(DERIVATION_FORMAT, makeQuestions(3), { nowTs: T0 });
    const at = (s0.deadlineTs as number) + 1_000;
    const direct = resumeOaSession(s0, at);
    const roundTrip = resumeOaSession(JSON.parse(JSON.stringify(s0)), at);
    expect(roundTrip).toEqual(direct);
    expect(roundTrip.noBack).toBe(true);
  });
});
