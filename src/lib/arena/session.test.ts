import { describe, expect, it } from "vitest";
import {
  answer,
  currentItem,
  finish,
  sessionTotal,
  skip,
  startSession,
  tick,
} from "./session";
import type { ArenaPreset } from "./config";
import { arenaQuestionStream } from "@/lib/leaderboard/seed";

const preset: ArenaPreset = {
  mode: "custom",
  durationSec: 10,
  questionCap: 3,
  penalty: false,
  skipsFree: true,
  ops: ["add", "sub", "mul", "div"],
  packs: ["int"],
  ranges: { add: [2, 100], sub: [2, 100], mul: [2, 12], div: [2, 12] },
};

const stream = arenaQuestionStream(42, preset);

describe("startSession", () => {
  it("starts running at full duration on question 0", () => {
    const s = startSession(preset, stream);
    expect(s.status).toBe("running");
    expect(s.index).toBe(0);
    expect(s.remainingMs).toBe(10_000);
    expect(s.total).toBe(3);
  });

  it("total is the cap bounded by stream length", () => {
    expect(sessionTotal(preset, stream)).toBe(3);
    expect(sessionTotal({ ...preset, questionCap: undefined }, stream)).toBe(
      stream.length,
    );
  });
});

describe("answer", () => {
  it("grades an exact-match answer correct and advances", () => {
    const s0 = startSession(preset, stream);
    const s1 = answer(s0, stream, stream[0].answer, 1200);
    expect(s1.index).toBe(1);
    expect(s1.answered).toHaveLength(1);
    expect(s1.answered[0]).toMatchObject({
      id: stream[0].id,
      correct: true,
      skipped: false,
      rtMs: 1200,
      op: stream[0].op,
    });
  });

  it("grades a wrong value incorrect", () => {
    const s0 = startSession(preset, stream);
    const s1 = answer(s0, stream, stream[0].answer + 1, 900);
    expect(s1.answered[0].correct).toBe(false);
  });
});

describe("skip", () => {
  it("advances without scoring, recording a skipped item", () => {
    const s0 = startSession(preset, stream);
    const s1 = skip(s0, stream, 400);
    expect(s1.index).toBe(1);
    expect(s1.answered[0]).toMatchObject({
      id: stream[0].id,
      correct: false,
      skipped: true,
    });
  });
});

describe("tick", () => {
  it("decrements remaining time", () => {
    const s0 = startSession(preset, stream);
    const s1 = tick(s0, 3000);
    expect(s1.remainingMs).toBe(7000);
    expect(s1.status).toBe("running");
  });

  it("finishes when the clock reaches 0 and clamps", () => {
    const s0 = startSession(preset, stream);
    const s1 = tick(s0, 999999);
    expect(s1.remainingMs).toBe(0);
    expect(s1.status).toBe("finished");
  });

  it("is a no-op once finished", () => {
    const done = finish(startSession(preset, stream));
    expect(tick(done, 1000)).toBe(done);
  });
});

describe("end conditions", () => {
  it("finishes after the question cap is reached", () => {
    let s = startSession(preset, stream);
    s = answer(s, stream, stream[0].answer, 1000);
    s = answer(s, stream, stream[1].answer, 1000);
    expect(s.status).toBe("running");
    s = answer(s, stream, stream[2].answer, 1000);
    expect(s.status).toBe("finished"); // 3rd answer hits the cap of 3
    expect(s.answered).toHaveLength(3);
  });

  it("answering/skipping past the end is a no-op", () => {
    let s = startSession(preset, stream);
    s = answer(s, stream, stream[0].answer, 1);
    s = answer(s, stream, stream[1].answer, 1);
    s = answer(s, stream, stream[2].answer, 1); // finished here
    const after = answer(s, stream, 0, 1);
    expect(after).toBe(s);
    expect(skip(s, stream, 1)).toBe(s);
  });

  it("currentItem reflects position and is undefined when exhausted", () => {
    let s = startSession(preset, stream);
    expect(currentItem(s, stream)).toEqual(stream[0]);
    s = answer(s, stream, stream[0].answer, 1);
    expect(currentItem(s, stream)).toEqual(stream[1]);
  });
});

describe("determinism", () => {
  it("the same seed yields the same stream (drives a reproducible session)", () => {
    expect(arenaQuestionStream(42, preset)).toEqual(stream);
  });
});
