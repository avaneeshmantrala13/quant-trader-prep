import { describe, expect, it } from "vitest";
import { MASTERY_BAR } from "@/lib/mastery/config";
import { skillKeySet } from "@/lib/roadmap/skillGraph";
import { TIMED_GATE } from "@/lib/pipeline/gates";
import { OA_FORMATS, TIMED_DIAGNOSTIC_FORMAT } from "./config";
import {
  createOaSession,
  isDeadlinePassed,
  remainingSectionMs,
  resumeOaSession,
} from "./timedSession";
import type { OaQuestion, OaSessionState } from "./types";
import {
  TIMED_DIAGNOSTIC_PLAN,
  allTimedSectionsPass,
  buildTimedResult,
  drawTimedDiagnostic,
  parseTimedDiagnosticSeed,
  selectTimedDiagnosticPlan,
  timedDiagnosticPasses,
  timedDiagnosticTopics,
  timedSectionPasses,
  timedTopicTallies,
  topicKeysForSession,
} from "./timedDiagnostic";

/* --------------------------------- helpers -------------------------------- */

/** A minimal MCQ with a known correct index (for controlled gate/tally tests). */
function q(id: string, correctIndex = 0): OaQuestion {
  return {
    id,
    prompt: `Q ${id}`,
    choices: ["a", "b", "c", "d"],
    correctIndex,
    explanation: "",
    difficulty: "hard",
  };
}

/**
 * Build a finished section session with explicit correctness: the first
 * `correct` of `total` questions are answered correctly, the rest wrong.
 */
function finishedSession(correct: number, total: number): OaSessionState {
  const questions = Array.from({ length: total }, (_, i) => q(`x-${i}`, 0));
  return {
    id: "timed-diagnostic:1",
    formatId: TIMED_DIAGNOSTIC_FORMAT.id,
    kind: "section",
    startedAtTs: 0,
    deadlineTs: 2_700_000,
    questions,
    answers: questions.map((qq, i) => ({
      questionId: qq.id,
      chosen: i < correct ? 0 : 1, // 0 = correct, 1 = wrong
      elapsedMs: 1000,
    })),
    index: total,
    status: "submitted",
    scoring: { correct: 1, wrong: 0, skip: 0 },
    budgetMs: 90_000,
    hardMode: false,
    completedAtTs: 1,
  };
}

/* ------------------------------ format shape ------------------------------ */

describe("TIMED_DIAGNOSTIC_FORMAT — 30 Q / 45 min section", () => {
  it("is 30 questions on a 45-minute section wall clock (+1/0/0)", () => {
    const f = TIMED_DIAGNOSTIC_FORMAT;
    expect(f.id).toBe("timed-diagnostic");
    expect(f.kind).toBe("section");
    expect(f.questionCount).toBe(30);
    expect(f.sectionSec).toBe(45 * 60);
    expect(f.perQuestionSec).toBeUndefined();
    expect(f.freeNavigation).toBe(true);
    expect(f.autoAdvance).toBe(false);
    expect(f.scoring).toEqual({ correct: 1, wrong: 0, skip: 0 });
    // Per-question fair share = 2700s / 30 = 90s.
    expect(f.budgetMs).toBe(90_000);
  });

  it("is NOT a user-pickable /oa preset (kept out of OA_FORMATS)", () => {
    expect(OA_FORMATS.map((x) => x.id)).not.toContain("timed-diagnostic");
    expect(OA_FORMATS).toHaveLength(7);
    // No stray content pool — it draws its own topic-tagged items.
    expect(TIMED_DIAGNOSTIC_FORMAT.contentPool).toBeUndefined();
  });
});

/* --------------------------- selection + tagging -------------------------- */

describe("question selection — hard, multi-topic, valid topic tags", () => {
  it("every plan entry tags a REAL SKILL_GRAPH node (no orphan tags)", () => {
    const keys = skillKeySet();
    expect(TIMED_DIAGNOSTIC_PLAN.length).toBeGreaterThan(0);
    for (const entry of TIMED_DIAGNOSTIC_PLAN) {
      expect(keys.has(entry.topicKey), entry.family).toBe(true);
    }
  });

  it("spans multiple distinct topics (genuinely multi-topic)", () => {
    expect(timedDiagnosticTopics().length).toBeGreaterThanOrEqual(3);
  });

  it("draws 30 well-formed questions with parallel, valid topic tags", () => {
    const keys = skillKeySet();
    const { questions, topicKeys } = drawTimedDiagnostic(2024, 30);
    expect(questions).toHaveLength(30);
    expect(topicKeys).toHaveLength(30);
    for (let i = 0; i < 30; i++) {
      expect(questions[i].id).toBe(`timed-diag-2024-${i}`);
      expect(questions[i].choices).toHaveLength(4);
      expect(questions[i].correctIndex).toBeGreaterThanOrEqual(0);
      expect(questions[i].correctIndex).toBeLessThan(4);
      expect(questions[i].difficulty).toBe("hard");
      expect(keys.has(topicKeys[i]), topicKeys[i]).toBe(true);
    }
    // Multi-topic within a single 30-question draw.
    expect(new Set(topicKeys).size).toBeGreaterThanOrEqual(3);
  });

  it("is fully deterministic from the seed (questions AND tags)", () => {
    const a = drawTimedDiagnostic(777, 30);
    const b = drawTimedDiagnostic(777, 30);
    expect(a.topicKeys).toEqual(b.topicKeys);
    expect(a.questions.map((x) => x.id)).toEqual(b.questions.map((x) => x.id));
    expect(a.questions.map((x) => x.prompt)).toEqual(
      b.questions.map((x) => x.prompt),
    );
    expect(a.questions.map((x) => x.correctIndex)).toEqual(
      b.questions.map((x) => x.correctIndex),
    );
    // A different seed yields a different (deterministic) draw.
    expect(drawTimedDiagnostic(778, 30).questions.map((x) => x.prompt)).not.toEqual(
      a.questions.map((x) => x.prompt),
    );
  });

  it("recovers per-question topic tags from a persisted session (reload-proof tagging)", () => {
    const seed = 4242;
    const { questions, topicKeys } = drawTimedDiagnostic(seed, 30);
    const session = createOaSession(TIMED_DIAGNOSTIC_FORMAT, questions, {
      nowTs: 1_000_000,
    });
    // Round-trip through JSON to mimic persistence, then recover the tags.
    const revived: OaSessionState = JSON.parse(JSON.stringify(session));
    expect(topicKeysForSession(revived)).toEqual(topicKeys);
    expect(parseTimedDiagnosticSeed(questions[0].id)).toBe(seed);
    expect(parseTimedDiagnosticSeed("not-a-timed-id")).toBeNull();
  });

  it("selectTimedDiagnosticPlan reproduces tags without generating questions", () => {
    const plan = selectTimedDiagnosticPlan(99, 30);
    expect(plan.map((e) => e.topicKey)).toEqual(
      drawTimedDiagnostic(99, 30).topicKeys,
    );
  });
});

/* ------------------------- reload-proof timing (§1) ----------------------- */

describe("reload-proof timing — the 45:00 section deadline persists", () => {
  const { questions } = drawTimedDiagnostic(1, 30);

  it("seeds an absolute deadline 45 min out and survives a JSON round-trip", () => {
    const started = 1_700_000_000_000;
    const session = createOaSession(TIMED_DIAGNOSTIC_FORMAT, questions, {
      nowTs: started,
    });
    expect(session.deadlineTs).toBe(started + 45 * 60 * 1000);

    const revived: OaSessionState = JSON.parse(JSON.stringify(session));
    // The clock does NOT reset on reload — the ABSOLUTE deadline is unchanged,
    // so remaining time is purely `deadline − now`.
    const away = started + 10 * 60 * 1000; // 10 min later
    const resumed = resumeOaSession(revived, away);
    expect(resumed.status).toBe("running");
    expect(resumed.deadlineTs).toBe(session.deadlineTs);
    expect(remainingSectionMs(resumed, away)).toBe(35 * 60 * 1000);
  });

  it("auto-submits (expired) exactly at the deadline when it passed while away", () => {
    const started = 5_000_000;
    const session = createOaSession(TIMED_DIAGNOSTIC_FORMAT, questions, {
      nowTs: started,
    });
    const deadline = session.deadlineTs as number;
    expect(isDeadlinePassed(session, deadline)).toBe(true);

    const resumed = resumeOaSession(session, deadline + 60_000);
    expect(resumed.status).toBe("expired");
    // Completed AT the deadline (the clock kept running while away).
    expect(resumed.completedAtTs).toBe(deadline);
  });
});

/* ----------------------- per-topic tally + 0.90 gate ---------------------- */

describe("scoring — per-topic timed tally (metric b) + 0.90 section gate", () => {
  it("records a per-topic tally that sums to the overall {correct,total}", () => {
    const seed = 31337;
    const { questions, topicKeys } = drawTimedDiagnostic(seed, 30);
    const session = createOaSession(TIMED_DIAGNOSTIC_FORMAT, questions, {
      nowTs: 0,
    });
    // Answer every question correctly.
    const answered: OaSessionState = {
      ...session,
      status: "submitted",
      answers: session.answers.map((a, i) => ({
        ...a,
        chosen: questions[i].correctIndex,
      })),
    };

    const tallies = timedTopicTallies(answered, topicKeys);
    // One tally per distinct topic, each fully correct.
    expect(tallies.length).toBe(new Set(topicKeys).size);
    for (const t of tallies) expect(t.correct).toBe(t.total);

    const result = buildTimedResult(answered, topicKeys, "2026-08-07T00:00:00Z");
    expect(result.total).toBe(30);
    expect(result.correct).toBe(30);
    // Each section carries its topic key + timestamp (spec shape).
    for (const s of result.sections) {
      expect(s.topicKeys).toHaveLength(1);
      expect(skillKeySet().has((s.topicKeys as string[])[0])).toBe(true);
      expect(s.at).toBe("2026-08-07T00:00:00Z");
      expect(s.correct + (s.total - s.correct)).toBe(s.total);
    }
    // Sections sum to the overall tally.
    const sumC = result.sections.reduce((n, s) => n + s.correct, 0);
    const sumT = result.sections.reduce((n, s) => n + s.total, 0);
    expect(sumC).toBe(result.correct);
    expect(sumT).toBe(result.total);
  });

  it("the 0.90 gate passes at ≥90% and fails below it", () => {
    expect(timedSectionPasses({ correct: 9, total: 10 })).toBe(true); // 0.90
    expect(timedSectionPasses({ correct: 8, total: 10 })).toBe(false); // 0.80
    expect(timedSectionPasses({ correct: 27, total: 30 })).toBe(true); // 0.90
    expect(timedSectionPasses({ correct: 26, total: 30 })).toBe(false);

    const pass = buildTimedResult(finishedSession(9, 10), Array(10).fill("k"));
    const fail = buildTimedResult(finishedSession(8, 10), Array(10).fill("k"));
    expect(allTimedSectionsPass(pass)).toBe(true);
    expect(timedDiagnosticPasses(pass)).toBe(true);
    expect(allTimedSectionsPass(fail)).toBe(false);
    expect(timedDiagnosticPasses(fail)).toBe(false);
  });

  it("uses the DEFAULT 0.90 timed bar (TIMED_GATE), not the 0.80 content bar", () => {
    expect(TIMED_GATE).toBe(0.9);
    // 85% clears the 0.80 content bar but NOT the 0.90 timed bar.
    expect(timedSectionPasses({ correct: 85, total: 100 })).toBe(false);
    expect(timedSectionPasses({ correct: 85, total: 100 }, MASTERY_BAR)).toBe(
      true,
    );
  });

  it("takes the threshold as a PARAMETER and never mutates the global 0.80 bar", () => {
    const before = MASTERY_BAR;
    // A 0.80 section: fails at the default 0.90 bar, passes when 0.80 is passed.
    expect(timedSectionPasses({ correct: 8, total: 10 })).toBe(false);
    expect(timedSectionPasses({ correct: 8, total: 10 }, 0.8)).toBe(true);
    const result = buildTimedResult(finishedSession(8, 10), Array(10).fill("k"));
    expect(allTimedSectionsPass(result, 0.8)).toBe(true);
    expect(allTimedSectionsPass(result, 0.9)).toBe(false);
    // The content-mastery constant is untouched by any of the above.
    expect(MASTERY_BAR).toBe(before);
    expect(MASTERY_BAR).toBe(0.8);
  });

  it("no sections ⇒ not cleared", () => {
    const empty = { correct: 0, total: 0, sections: [] };
    expect(allTimedSectionsPass(empty)).toBe(false);
  });
});
