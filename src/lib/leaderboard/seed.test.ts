import { describe, expect, it } from "vitest";
import { arenaQuestionStream, streamLength, streamPrompt } from "./seed";
import {
  OPTIVER_DEFAULT,
  ZETAMAC_DEFAULT,
  type ArenaPreset,
} from "@/lib/arena/config";

const custom: ArenaPreset = {
  mode: "custom",
  durationSec: 60,
  penalty: false,
  skipsFree: true,
  ops: ["add", "sub", "mul", "div"],
  packs: ["int"],
  ranges: { add: [2, 100], sub: [2, 100], mul: [2, 12], div: [2, 12] },
};

describe("arenaQuestionStream determinism (the server re-score property)", () => {
  it("same (seed, preset) ⇒ identical items", () => {
    const a = arenaQuestionStream(12345, OPTIVER_DEFAULT);
    const b = arenaQuestionStream(12345, OPTIVER_DEFAULT);
    expect(a).toEqual(b);
  });

  it("different seeds ⇒ different streams", () => {
    const a = arenaQuestionStream(1, OPTIVER_DEFAULT);
    const b = arenaQuestionStream(2, OPTIVER_DEFAULT);
    expect(a).not.toEqual(b);
  });

  it("every item's answer matches its op EXACTLY", () => {
    for (const seed of [1, 2, 3, 99, 1000, 2_000_000_000]) {
      for (const item of arenaQuestionStream(seed, custom)) {
        const expected =
          item.op === "add"
            ? item.a + item.b
            : item.op === "sub"
              ? item.a - item.b
              : item.op === "mul"
                ? item.a * item.b
                : item.a / item.b;
        expect(item.answer).toBe(expected);
        expect(Number.isInteger(item.answer)).toBe(true);
      }
    }
  });

  it("subtraction answers are never negative; division is exact", () => {
    for (const item of arenaQuestionStream(555, custom)) {
      if (item.op === "sub") expect(item.answer).toBeGreaterThanOrEqual(0);
      if (item.op === "div") expect(item.a % item.b).toBe(0);
    }
  });

  it("ids are sequential q0..q{n-1}", () => {
    const s = arenaQuestionStream(7, custom);
    expect(s[0].id).toBe("q0");
    expect(s[s.length - 1].id).toBe(`q${s.length - 1}`);
  });
});

describe("streamLength", () => {
  it("uses the question cap when present (Optiver = 80)", () => {
    expect(streamLength(OPTIVER_DEFAULT)).toBe(80);
  });

  it("uses window × rate when there is no cap (Zetamac 120s)", () => {
    expect(streamLength(ZETAMAC_DEFAULT)).toBe(120 * 3);
  });

  it("clamps to MAX_STREAM_ITEMS on very long windows", () => {
    expect(streamLength({ ...ZETAMAC_DEFAULT, durationSec: 100000 })).toBe(2000);
  });
});

describe("streamPrompt", () => {
  it("renders a human prompt for an item", () => {
    const [first] = arenaQuestionStream(7, custom);
    expect(streamPrompt(first)).toContain(String(first.a));
    expect(streamPrompt(first)).toContain(String(first.b));
    expect(streamPrompt(first)).toContain("= ?");
  });
});
