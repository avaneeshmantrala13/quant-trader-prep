import { describe, expect, it } from "vitest";
import { leaderboardEnabled, readLeaderboardConfig } from "./config";

describe("leaderboard config flag parsing (OFF by default)", () => {
  it("leaderboardEnabled defaults false and is case-insensitive", () => {
    expect(leaderboardEnabled({})).toBe(false);
    expect(leaderboardEnabled({ VITE_LEADERBOARD: "off" })).toBe(false);
    expect(leaderboardEnabled({ VITE_LEADERBOARD: "on" })).toBe(true);
    expect(leaderboardEnabled({ VITE_LEADERBOARD: "ON" })).toBe(true);
  });

  it("readLeaderboardConfig returns null when the layer is off", () => {
    expect(readLeaderboardConfig({})).toBeNull();
    expect(
      readLeaderboardConfig({ VITE_LEADERBOARD_ENDPOINT: "https://x" }),
    ).toBeNull();
  });

  it("returns null when on but no endpoint is configured", () => {
    expect(readLeaderboardConfig({ VITE_LEADERBOARD: "on" })).toBeNull();
  });

  it("parses a dedicated endpoint and trims trailing slashes", () => {
    const cfg = readLeaderboardConfig({
      VITE_LEADERBOARD: "on",
      VITE_LEADERBOARD_ENDPOINT: "https://lb.example.com/",
    });
    expect(cfg?.endpoint).toBe("https://lb.example.com");
  });

  it("falls back to VITE_API_BASE_URL when no dedicated endpoint", () => {
    const cfg = readLeaderboardConfig({
      VITE_LEADERBOARD: "on",
      VITE_API_BASE_URL: "https://api.example.com",
    });
    expect(cfg?.endpoint).toBe("https://api.example.com");
  });
});
