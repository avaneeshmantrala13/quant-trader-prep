// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UserProgress } from "@/types/progress";

// Mirror the LocalStorageProvider's write so the re-seed lands at the same
// `qtp.progress.<user>` key regardless of which backend the singleton selects.
vi.mock("@/lib/storage", () => ({
  storage: {
    saveProgress: (u: string, next: UserProgress) => {
      localStorage.setItem(`qtp.progress.${u.toLowerCase()}`, JSON.stringify(next));
    },
  },
}));

// eslint-disable-next-line import/first
import {
  DEV_PROGRESS_RESET_TOKEN,
  maybeRunOneTimeDevReset,
  resetDeveloperProgress,
} from "./devReset";
// eslint-disable-next-line import/first
import { FIRST_STAGE, resolveStage } from "@/lib/pipeline/stateMachine";
// eslint-disable-next-line import/first
import { installMemoryLocalStorage } from "@/test/memoryLocalStorage";

/**
 * The developer demo reset must FULLY wipe the developer namespace (progress,
 * forced stage, and every per-user session store) and re-seed a clean progress
 * doc that resolves to the FIRST pipeline stage — while never touching a real
 * account, a global key, or the dev session flag. The one-time variant wipes
 * exactly once per deploy token, then lets progress persist normally.
 */

const readJSON = (key: string) =>
  JSON.parse(localStorage.getItem(key) as string) as Record<string, unknown>;

beforeEach(() => installMemoryLocalStorage());
afterEach(() => localStorage.clear());

describe("resetDeveloperProgress", () => {
  it("wipes every developer-scoped key and re-seeds a clean progress doc", () => {
    // Developer-scoped demo state across every store.
    localStorage.setItem("qtp.progress.developer", JSON.stringify({ xp: 999 }));
    localStorage.setItem("qtp.dev.forcedStage::developer", "greenlight");
    localStorage.setItem("qtp.mock.active.v3::developer", "{}");
    localStorage.setItem("qtp.fermi.run::developer", "{}");
    localStorage.setItem("qtp.gamesession.makeMarket::developer", "{}");
    // State that MUST survive: a real user, a global key, the dev session flag.
    localStorage.setItem("qtp.progress.alice", JSON.stringify({ xp: 5 }));
    localStorage.setItem("qtp.mock.active.v3::alice", "{}");
    localStorage.setItem("qtp.dev.session", "1");
    localStorage.setItem("qtp.theme", "dark");

    resetDeveloperProgress();

    // Forced-stage override + every developer session store is gone.
    expect(localStorage.getItem("qtp.dev.forcedStage::developer")).toBeNull();
    expect(localStorage.getItem("qtp.mock.active.v3::developer")).toBeNull();
    expect(localStorage.getItem("qtp.fermi.run::developer")).toBeNull();
    expect(
      localStorage.getItem("qtp.gamesession.makeMarket::developer"),
    ).toBeNull();

    // Progress re-seeded to a fresh, empty doc (not the stale xp: 999).
    expect(readJSON("qtp.progress.developer").xp).toBe(0);

    // Real user, global, and the dev session flag are byte-for-byte untouched.
    expect(readJSON("qtp.progress.alice").xp).toBe(5);
    expect(localStorage.getItem("qtp.mock.active.v3::alice")).toBe("{}");
    expect(localStorage.getItem("qtp.dev.session")).toBe("1");
    expect(localStorage.getItem("qtp.theme")).toBe("dark");
  });

  it("re-seeds progress that resolves to the FIRST pipeline stage", () => {
    // A fully-advanced dev pipeline before the reset.
    localStorage.setItem(
      "qtp.progress.developer",
      JSON.stringify({
        pipeline: {
          stage: "greenlight",
          untimedDoneAt: "x",
          timedDoneAt: "x",
          gameOaDoneAt: "x",
          diagnosisComputedAt: "x",
          greenlitAt: "x",
        },
      }),
    );

    resetDeveloperProgress();

    const seeded = readJSON("qtp.progress.developer") as unknown as UserProgress;
    expect(seeded.pipeline).toBeUndefined();
    expect(resolveStage(seeded)).toBe(FIRST_STAGE);
  });

  it("is idempotent and repeatable (a second call is safe)", () => {
    localStorage.setItem("qtp.progress.developer", JSON.stringify({ xp: 12 }));
    resetDeveloperProgress();
    resetDeveloperProgress();
    expect(readJSON("qtp.progress.developer").xp).toBe(0);
  });
});

describe("maybeRunOneTimeDevReset", () => {
  it("resets once per deploy token, then persists later progress (no re-wipe)", () => {
    localStorage.setItem("qtp.progress.developer", JSON.stringify({ xp: 999 }));

    // First call on a new build: wipes and records the token.
    maybeRunOneTimeDevReset();
    expect(readJSON("qtp.progress.developer").xp).toBe(0);
    expect(localStorage.getItem("qtp.dev.resetToken")).toBe(
      DEV_PROGRESS_RESET_TOKEN,
    );

    // Progress accrues DURING the demo — a later call must NOT wipe it again.
    localStorage.setItem("qtp.progress.developer", JSON.stringify({ xp: 42 }));
    maybeRunOneTimeDevReset();
    expect(readJSON("qtp.progress.developer").xp).toBe(42);
  });
});
