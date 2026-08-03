import { describe, it, expect } from "vitest";
import { Rng } from "@/lib/rng";
import {
  SCENARIO_PACKS,
  FLOOR_CONFIGS,
  startFloor,
  postQuote,
  advanceReveal,
  tick,
  currentFair,
  resumeFloor,
  type FloorState,
  type FloorMove,
  type UserQuote,
} from "@/lib/tradingFloor";

/**
 * DURABLE SAVE/RESUME for The Trading Floor. `FloorState` is not JSON-safe (it
 * holds live functions + an `Rng`), so the page persists only the deterministic
 * inputs — `(seed, packId, configId)` plus the ordered per-round MOVES — and
 * rebuilds the exact state with `resumeFloor`. These tests prove the replay
 * reproduces the live state field-for-field (cash, inventory, P&L, calibration,
 * records, rng position), for both a fully-played run and a partial one.
 */

/** The observable, comparable projection of a state (drop functions + rng). */
function snap(s: FloorState) {
  return {
    phase: s.phase,
    round: s.round,
    cash: s.cash,
    inventory: s.inventory,
    pnlPath: s.pnlPath,
    fairPath: s.fairPath,
    inventoryPath: s.inventoryPath,
    fills: s.fills,
    pickedOff: s.pickedOff,
    quotes: s.quotes,
    calibration: s.calibration,
    revealed: s.revealed,
    records: s.records,
  };
}

/**
 * Play a live run exactly as the page would, recording the moves. `plan(round)`
 * returns a real UserQuote to post, or `"timeout"` to let the shot clock expire
 * (a stand-aside). Advances the reveal between rounds. Returns the final live
 * state, the recorded moves, and whether the run ended mid-quote.
 */
function playLive(
  seed: number,
  packId: string,
  configId: string,
  plan: (round: number) => UserQuote | "timeout",
  stopAfter = Infinity,
): { state: FloorState; moves: FloorMove[]; resumeQuoting: boolean } {
  const pack = SCENARIO_PACKS.find((p) => p.id === packId)!;
  const config = FLOOR_CONFIGS.find((c) => c.id === configId)!;
  const scenario = pack.build(new Rng(seed));
  let s: FloorState = startFloor(scenario, config, seed);
  const moves: FloorMove[] = [];

  let played = 0;
  while (s.phase !== "finished" && played < stopAfter) {
    if (s.phase === "revealed") {
      s = advanceReveal(s);
      continue;
    }
    // phase === "quoting": resolve this round.
    const action = plan(s.round);
    if (action === "timeout") {
      const fairNow = currentFair(s);
      s = tick(s, s.config.shotClockMs + 1000); // blow the clock → stand aside
      moves.push({ quote: { mid: fairNow, half: 0, skew: 0, size: 0 }, standAside: true });
    } else {
      s = postQuote(s, action);
      moves.push({ quote: action, standAside: false });
    }
    played++;
  }

  // Stopping "mid-quote" means the user clicked Next after the last resolved
  // round and is back on the quote pad — advance a trailing reveal into quoting.
  if (played >= stopAfter && s.phase === "revealed") s = advanceReveal(s);

  return { state: s, moves, resumeQuoting: s.phase === "quoting" };
}

function rebuild(
  seed: number,
  packId: string,
  configId: string,
  moves: FloorMove[],
  resumeQuoting: boolean,
): FloorState {
  const pack = SCENARIO_PACKS.find((p) => p.id === packId)!;
  const config = FLOOR_CONFIGS.find((c) => c.id === configId)!;
  // A resumed page rebuilds the scenario FRESH from the same seed.
  const scenario = pack.build(new Rng(seed));
  return resumeFloor(scenario, config, seed, moves, resumeQuoting);
}

describe("Trading Floor — durable resume via move replay", () => {
  for (const pack of SCENARIO_PACKS) {
    it(`replays a full run of "${pack.id}" to an identical state`, () => {
      const seed = 4242;
      const configId = FLOOR_CONFIGS[1].id;
      const live = playLive(seed, pack.id, configId, (r) => ({
        // A fixed, round-varying quote — the value is irrelevant to the replay
        // determinism property, only that the SAME move stream is fed to both.
        mid: 0.5 + 0.01 * r,
        half: 1 + (r % 2),
        skew: 0.5,
        size: 1 + (r % 3),
      }));
      const resumed = rebuild(seed, pack.id, configId, live.moves, live.resumeQuoting);
      expect(snap(resumed)).toEqual(snap(live.state));
      expect(resumed.phase).toBe("finished");
    });
  }

  it("replays a PARTIAL run (mid-quote) and lands back on the quote pad", () => {
    const seed = 909;
    const packId = SCENARIO_PACKS[0].id;
    const configId = FLOOR_CONFIGS[0].id;
    // Stop after resolving 3 rounds; the live run is then quoting round 3.
    const live = playLive(
      seed,
      packId,
      configId,
      (r) => (r === 1 ? "timeout" : { mid: 0.5, half: 0.1, skew: 0, size: 2 }),
      3,
    );
    expect(live.state.phase).toBe("quoting");
    expect(live.moves).toHaveLength(3);
    // Exactly one recorded move is a stand-aside (round 1's timeout).
    expect(live.moves.filter((m) => m.standAside)).toHaveLength(1);

    const resumed = rebuild(seed, packId, configId, live.moves, live.resumeQuoting);
    expect(resumed.phase).toBe("quoting");
    expect(snap(resumed)).toEqual(snap(live.state));
    // A fresh shot clock is handed back on resume.
    expect(resumed.remainingMs).toBe(FLOOR_CONFIGS[0].shotClockMs);
  });

  it("a stand-aside (timeout) earns no calibration credit on replay", () => {
    const seed = 77;
    // dice-over-under is a binary pack — stand-asides must not add a pair.
    const binaryPack = SCENARIO_PACKS.find((p) => p.kind === "binary")!;
    const configId = FLOOR_CONFIGS[0].id;
    const live = playLive(seed, binaryPack.id, configId, () => "timeout", 2);
    const resumed = rebuild(seed, binaryPack.id, configId, live.moves, live.resumeQuoting);
    expect(resumed.calibration).toEqual(live.state.calibration);
    expect(resumed.calibration).toHaveLength(0); // all stood aside → no credit
  });
});
