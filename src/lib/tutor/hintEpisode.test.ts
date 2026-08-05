import { describe, expect, it } from "vitest";
import {
  episodeCredit,
  isResolved,
  startEpisode,
  submitAttempt,
  type HintEpisode,
} from "./hintEpisode";

describe("hintEpisode — re-attempt flow", () => {
  it("first-try correct → resolved at rung 0, full credit", () => {
    const ep = submitAttempt(startEpisode(), true);
    expect(ep.status).toBe("correct");
    expect(ep.highestRung).toBe(0);
    expect(isResolved(ep)).toBe(true);
    expect(episodeCredit(ep)).toBe(1);
  });

  it("wrong then correct reveals rung 1 and scores the rung-1 credit", () => {
    let ep = startEpisode();
    ep = submitAttempt(ep, false); // reveal rung 1
    expect(ep.revealed).toBe(1);
    expect(ep.status).toBe("active");
    ep = submitAttempt(ep, true); // correct after rung 1
    expect(ep.status).toBe("correct");
    expect(ep.highestRung).toBe(1);
    expect(episodeCredit(ep)).toBe(0.65);
  });

  it("reveals one rung per wrong answer and tracks the highest rung", () => {
    let ep = startEpisode();
    for (let i = 1; i <= 3; i++) ep = submitAttempt(ep, false);
    expect(ep.revealed).toBe(3);
    expect(ep.highestRung).toBe(3);
    ep = submitAttempt(ep, true);
    expect(episodeCredit(ep)).toBe(0.2); // correct after rung 3
  });

  it("still wrong after all 5 rungs → exhausted, credit 0", () => {
    let ep: HintEpisode = startEpisode();
    // 5 wrong answers reveal rungs 1..5; a 6th wrong exhausts.
    for (let i = 0; i < 5; i++) ep = submitAttempt(ep, false);
    expect(ep.revealed).toBe(5);
    expect(ep.status).toBe("active");
    ep = submitAttempt(ep, false); // wrong again at rung 5
    expect(ep.status).toBe("exhausted");
    expect(episodeCredit(ep)).toBe(0);
  });

  it("correct exactly at rung 5 earns the floor credit", () => {
    let ep = startEpisode();
    for (let i = 0; i < 5; i++) ep = submitAttempt(ep, false);
    ep = submitAttempt(ep, true);
    expect(ep.highestRung).toBe(5);
    expect(episodeCredit(ep)).toBe(0.04);
  });

  it("is idempotent once terminal", () => {
    const ep = submitAttempt(startEpisode(), true);
    const again = submitAttempt(ep, false);
    expect(again).toEqual(ep);
  });
});
