import { describe, expect, it } from "vitest";
import {
  fetchBoard,
  isLeaderboardEnabled,
  requestRankedSeed,
  submitRankedRun,
} from "./client";

/**
 * The leaderboard layer is OFF by default (`VITE_LEADERBOARD` unset in the test
 * env). Every network entry point must be a GRACEFUL NO-OP: return `null`,
 * never throw, never hit the network — so the arena is fully functional with
 * the leaderboard OFF (local PB only). This guards the "Phase 6-backup" swap.
 */
describe("leaderboard client is a graceful no-op when disabled", () => {
  it("isLeaderboardEnabled() is false by default", () => {
    expect(isLeaderboardEnabled()).toBe(false);
  });

  it("requestRankedSeed returns null (no throw)", async () => {
    await expect(requestRankedSeed("zetamac", "cfg")).resolves.toBeNull();
  });

  it("submitRankedRun returns null (no throw)", async () => {
    await expect(
      submitRankedRun({
        board: "optiver",
        configHash: "cfg",
        seed: 1,
        answers: [{ id: "q0", value: 4, rtMs: 1000 }],
        clientElapsedMs: 1000,
      }),
    ).resolves.toBeNull();
  });

  it("fetchBoard returns null for every scope (no throw)", async () => {
    await expect(fetchBoard("zetamac", "cfg", "league")).resolves.toBeNull();
    await expect(fetchBoard("zetamac", "cfg", "friends")).resolves.toBeNull();
    await expect(fetchBoard("zetamac", "cfg", "global")).resolves.toBeNull();
  });
});
