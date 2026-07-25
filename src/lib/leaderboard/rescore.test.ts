import { describe, expect, it } from "vitest";
import {
  checkPlausibility,
  gradeRankedAnswers,
  PLAUSIBILITY,
  rescore,
  type RankedAnswer,
  type RescoreInput,
} from "./rescore";
import { arenaQuestionStream } from "./seed";
import type { ArenaPreset } from "@/lib/arena/config";
import { OPTIVER_DEFAULT } from "@/lib/arena/config";
// The SHARED fixture the Lambda's scoring.mjs is generated from. Asserting the
// TypeScript implementation reproduces it proves the client + server re-score
// identically (they can never silently drift).
import fixture from "../../../infra/lambda/leaderboard/scoring.fixture.json";

const fixturePreset = fixture.input.preset as unknown as ArenaPreset;
const fixtureInput = fixture.input as unknown as RescoreInput;

describe("shared fixture: client TS agrees with the Lambda source of truth", () => {
  it("regenerates the EXACT question stream from (seed, preset)", () => {
    const stream = arenaQuestionStream(fixture.input.seed, fixturePreset);
    expect(stream).toEqual(fixture.expected.stream);
  });

  it("re-scores to the EXACT authoritative result", () => {
    const result = rescore(fixtureInput);
    expect(result).toEqual(fixture.expected.result);
  });
});

describe("gradeRankedAnswers", () => {
  const preset: ArenaPreset = { ...OPTIVER_DEFAULT, questionCap: 6 };
  const stream = arenaQuestionStream(2024, preset);

  it("grades by exact match against the regenerated stream", () => {
    const answers: RankedAnswer[] = [
      { id: stream[0].id, value: stream[0].answer, rtMs: 2000 },
      { id: stream[1].id, value: stream[1].answer + 1, rtMs: 2000 },
      { id: stream[2].id, value: null, rtMs: 500 },
    ];
    const graded = gradeRankedAnswers(2024, preset, answers);
    expect(graded[0]).toMatchObject({ correct: true, skipped: false });
    expect(graded[1]).toMatchObject({ correct: false, skipped: false });
    expect(graded[2]).toMatchObject({ correct: false, skipped: true });
  });

  it("ignores answers with an unknown id (can't be trusted)", () => {
    const graded = gradeRankedAnswers(2024, preset, [
      { id: "does-not-exist", value: 1, rtMs: 1000 },
    ]);
    expect(graded).toHaveLength(0);
  });
});

describe("rescore honesty (server-authoritative)", () => {
  const preset: ArenaPreset = { ...OPTIVER_DEFAULT, questionCap: 4 };
  const stream = arenaQuestionStream(77, preset);
  const allCorrect: RankedAnswer[] = stream.map((q) => ({
    id: q.id,
    value: q.answer,
    rtMs: 3000,
  }));

  it("computes the authoritative score from the answers alone", () => {
    const res = rescore({
      board: "optiver",
      seed: 77,
      preset,
      answers: allCorrect,
      clientElapsedMs: 12000,
    });
    expect(res.ok).toBe(true);
    expect(res.score).toBe(4); // +1 each of 4 correct
    expect(res.correct).toBe(4);
    expect(res.attempts).toBe(4);
  });
});

describe("plausibility caps", () => {
  const preset: ArenaPreset = { ...OPTIVER_DEFAULT, questionCap: 40 };
  const stream = arenaQuestionStream(9, preset);

  it("rejects a run whose elapsed exceeds the window", () => {
    const res = rescore({
      board: "optiver",
      seed: 9,
      preset,
      answers: [{ id: stream[0].id, value: stream[0].answer, rtMs: 1000 }],
      clientElapsedMs: preset.durationSec * 1000 * 2, // 2× the window
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("elapsed>window");
  });

  it("rejects superhuman sustained throughput (> MAX_QPS)", () => {
    const answers = stream.map((q) => ({
      id: q.id,
      value: q.answer,
      rtMs: 100,
    }));
    // 40 attempts in 1s ⇒ 40 q/s ≫ MAX_QPS
    const res = rescore({
      board: "optiver",
      seed: 9,
      preset,
      answers,
      clientElapsedMs: 1000,
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("qps>max");
  });

  it("rejects impossible accuracy at impossible speed", () => {
    const answers = stream.map((q) => ({ id: q.id, value: q.answer, rtMs: 50 }));
    const graded = gradeRankedAnswers(9, preset, answers);
    // Pass a generous elapsed so the qps cap doesn't trip first.
    const reason = checkPlausibility(graded, {
      board: "optiver",
      seed: 9,
      preset,
      answers,
      clientElapsedMs: 60000,
    });
    expect(reason).toBe("speed-accuracy");
    expect(PLAUSIBILITY.IMPLAUSIBLE_MEDIAN_MS).toBe(250);
  });

  it("rejects large client/server elapsed divergence", () => {
    const res = rescore({
      board: "optiver",
      seed: 9,
      preset,
      answers: [{ id: stream[0].id, value: stream[0].answer, rtMs: 3000 }],
      clientElapsedMs: 5000,
      serverElapsedMs: 20000, // 15s apart > tolerance
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("elapsed-divergence");
  });

  it("accepts a normal, human-paced run", () => {
    const answers = stream
      .slice(0, 20)
      .map((q, i) => ({
        id: q.id,
        value: i % 3 === 0 ? q.answer + 1 : q.answer,
        rtMs: 4000,
      }));
    const res = rescore({
      board: "optiver",
      seed: 9,
      preset,
      answers,
      clientElapsedMs: 90000,
    });
    expect(res.ok).toBe(true);
  });
});
