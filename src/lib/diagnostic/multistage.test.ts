import { describe, expect, it } from "vitest";
import { nextTier } from "./multistage";

describe("nextTier", () => {
  it("bumps up one tier on a correct answer", () => {
    expect(nextTier("medium", true)).toBe("hard");
    expect(nextTier("easy", true)).toBe("medium");
    expect(nextTier("intro", true)).toBe("easy");
    expect(nextTier("hard", true)).toBe("expert");
  });

  it("bumps down one tier on a miss", () => {
    expect(nextTier("medium", false)).toBe("easy");
    expect(nextTier("hard", false)).toBe("medium");
    expect(nextTier("expert", false)).toBe("hard");
    expect(nextTier("easy", false)).toBe("intro");
  });

  it("clamps at the ends of the ladder", () => {
    expect(nextTier("expert", true)).toBe("expert");
    expect(nextTier("intro", false)).toBe("intro");
  });
});
