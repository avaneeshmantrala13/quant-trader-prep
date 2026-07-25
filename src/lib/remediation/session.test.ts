import { describe, expect, it } from "vitest";
import { DEPTH_CAP } from "./config";
import {
  atDepthCap,
  beginClimb,
  descendTo,
  enterTeaching,
  exitRemediation,
  startRemediation,
} from "./session";

describe("remediation session state machine", () => {
  it("starts at the origin, depth 0, descending", () => {
    const s = startRemediation("origin");
    expect(s.depth).toBe(0);
    expect(s.currentTopicKey).toBe("origin");
    expect(s.path).toEqual(["origin"]);
    expect(s.phase).toBe("descending");
  });

  it("increments depth per descend and records the path", () => {
    let s = startRemediation("A");
    s = descendTo(s, "B");
    expect(s.depth).toBe(1);
    expect(s.currentTopicKey).toBe("B");
    s = descendTo(s, "C");
    expect(s.depth).toBe(2);
    expect(s.path).toEqual(["A", "B", "C"]);
  });

  it("caps depth at DEPTH_CAP (no over-descent)", () => {
    let s = startRemediation("A");
    for (let i = 0; i < DEPTH_CAP + 3; i++) s = descendTo(s, `n${i}`);
    expect(s.depth).toBe(DEPTH_CAP);
    expect(atDepthCap(s)).toBe(true);
  });

  it("does not mutate the input session (pure transitions)", () => {
    const s0 = startRemediation("A");
    const s1 = descendTo(s0, "B");
    expect(s0.depth).toBe(0);
    expect(s0.path).toEqual(["A"]);
    expect(s1).not.toBe(s0);
  });

  it("resets per session", () => {
    let s = startRemediation("A");
    s = descendTo(s, "B");
    const fresh = startRemediation("A");
    expect(fresh.depth).toBe(0);
    expect(fresh.path).toEqual(["A"]);
  });

  it("beginClimb walks one edge up toward the parent", () => {
    let s = startRemediation("A");
    s = descendTo(s, "B");
    s = descendTo(s, "C");
    s = beginClimb(s);
    expect(s.phase).toBe("climbing");
    expect(s.currentTopicKey).toBe("B");
    expect(s.depth).toBe(1);
  });

  it("beginClimb at the origin exits (nowhere to climb)", () => {
    const s = beginClimb(startRemediation("A"));
    expect(s.phase).toBe("exited");
  });

  it("enterTeaching / exitRemediation set the phase", () => {
    expect(enterTeaching(startRemediation("A")).phase).toBe("teaching");
    expect(exitRemediation(startRemediation("A")).phase).toBe("exited");
  });
});
