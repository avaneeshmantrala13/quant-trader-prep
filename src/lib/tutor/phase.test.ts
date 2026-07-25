import { describe, expect, it } from "vitest";
import {
  INDEPENDENT_THETA_MIN,
  selectTutorPhase,
  WORKED_THETA_MAX,
} from "./phase";

describe("selectTutorPhase", () => {
  it("low θ ⇒ worked", () => {
    expect(selectTutorPhase({ theta: -1, n: 5, recentFailures: 0 })).toBe(
      "worked",
    );
  });

  it("high θ ⇒ independent", () => {
    expect(selectTutorPhase({ theta: 1, n: 5, recentFailures: 0 })).toBe(
      "independent",
    );
  });

  it("mid θ with enough history ⇒ faded", () => {
    expect(selectTutorPhase({ theta: 0, n: 5, recentFailures: 0 })).toBe(
      "faded",
    );
  });

  it("2 recent failures force worked regardless of θ", () => {
    expect(selectTutorPhase({ theta: 2, n: 20, recentFailures: 2 })).toBe(
      "worked",
    );
  });

  it("a new topic (n < 2) forces worked regardless of θ", () => {
    expect(selectTutorPhase({ theta: 2, n: 1, recentFailures: 0 })).toBe(
      "worked",
    );
    expect(selectTutorPhase({ theta: 0, n: 0, recentFailures: 0 })).toBe(
      "worked",
    );
  });

  it("boundaries are inclusive per the constants", () => {
    expect(
      selectTutorPhase({ theta: WORKED_THETA_MAX, n: 5, recentFailures: 0 }),
    ).toBe("worked");
    expect(
      selectTutorPhase({
        theta: INDEPENDENT_THETA_MIN,
        n: 5,
        recentFailures: 0,
      }),
    ).toBe("independent");
  });
});
