import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import { SCENARIO_PACKS, packById } from "./packs";
import { INTERVIEW } from "./config";
import {
  advanceReveal,
  currentFair,
  currentPosteriorSd,
  finishFloor,
  postQuote,
  startFloor,
} from "./engine";
import type { FloorState } from "./types";

/** Auto-drive an honest size-1 session to a finished state. */
function autoPlay<T>(state: FloorState<T>): FloorState<T> {
  let s = state;
  let guard = 0;
  while (s.phase !== "finished" && guard++ < 10_000) {
    if (s.phase === "quoting") {
      s = postQuote(s, {
        mid: currentFair(s),
        half: Math.max(0.02, currentPosteriorSd(s)),
        skew: 0,
        size: 1,
      });
    } else {
      s = advanceReveal(s);
    }
  }
  return s;
}

describe("SCENARIO_PACKS", () => {
  it.each(SCENARIO_PACKS.map((p) => p.id))(
    "pack %s builds a valid, playable scenario",
    (id) => {
      const pack = packById(id);
      const scenario = pack.build(new Rng(2026));
      expect(scenario.rounds).toBeGreaterThan(0);
      expect(scenario.kind).toBe(pack.kind);

      const done = autoPlay(startFloor(scenario, INTERVIEW, 2026));
      expect(done.phase).toBe("finished");
      const result = finishFloor(done);
      expect(result.rounds).toBe(scenario.rounds);
      expect(result.userPnl).toHaveLength(scenario.rounds);
    },
  );
});

describe("packById", () => {
  it("resolves a known pack id", () => {
    expect(packById("running-total").id).toBe("running-total");
  });

  it("falls back to the first (Over/Under) pack for an unknown id", () => {
    expect(packById("nope")).toBe(SCENARIO_PACKS[0]);
  });
});
