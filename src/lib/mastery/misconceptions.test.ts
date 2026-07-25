import { describe, expect, it } from "vitest";
import {
  bumpMisconceptions,
  clearMisconception,
  decayMisconceptions,
  topMisconceptions,
} from "./misconceptions";

describe("bumpMisconceptions", () => {
  it("increments each key immutably, starting from 0", () => {
    const a = {};
    const b = bumpMisconceptions(a, ["t::x", "t::y", "t::x"]);
    expect(b).toEqual({ "t::x": 2, "t::y": 1 });
    expect(a).toEqual({}); // input untouched
  });

  it("no keys → a shallow copy", () => {
    const a = { "t::x": 1 };
    const b = bumpMisconceptions(a, []);
    expect(b).toEqual(a);
    expect(b).not.toBe(a);
  });
});

describe("decayMisconceptions", () => {
  it("halves counts with factor 0.5", () => {
    const a = { "t::x": 2, "t::y": 1 };
    const b = decayMisconceptions(a, 0.5);
    expect(b).toEqual({ "t::x": 1, "t::y": 0.5 });
    expect(a).toEqual({ "t::x": 2, "t::y": 1 });
  });
});

describe("clearMisconception", () => {
  it("removes a key immutably", () => {
    const a = { "t::x": 2, "t::y": 1 };
    const b = clearMisconception(a, "t::x");
    expect(b).toEqual({ "t::y": 1 });
    expect(a).toHaveProperty("t::x");
  });

  it("no-op copy when key absent", () => {
    const a = { "t::y": 1 };
    const b = clearMisconception(a, "t::z");
    expect(b).toEqual(a);
    expect(b).not.toBe(a);
  });
});

describe("topMisconceptions", () => {
  it("returns keys by descending count, capped at n", () => {
    const flags = { "t::a": 1, "t::b": 5, "t::c": 3 };
    expect(topMisconceptions(flags, 2)).toEqual(["t::b", "t::c"]);
  });

  it("ignores zeroed-out (fully decayed) flags", () => {
    expect(topMisconceptions({ "t::a": 0, "t::b": 2 })).toEqual(["t::b"]);
  });
});
