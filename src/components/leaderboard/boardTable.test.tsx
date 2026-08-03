// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { BoardTable, formatScore, type BoardRow } from "./BoardTable";

afterEach(cleanup);

describe("formatScore", () => {
  it("formats a plain integer with a unit suffix", () => {
    expect(formatScore(1234, "pts")).toBe("1,234 pts");
  });
  it("formats a dollar score sign-aware", () => {
    expect(formatScore(-500, "$")).toBe("−$500");
    expect(formatScore(2500, "$")).toBe("$2,500");
  });
  it("rounds a float to 2 dp", () => {
    expect(formatScore(12.3456)).toBe("12.35");
  });
});

describe("BoardTable", () => {
  it("renders an honest empty state when there are no rows", () => {
    render(<BoardTable rows={[]} emptyHint="Play a run to be first." />);
    expect(screen.getByText(/No scores yet/i)).toBeTruthy();
    expect(screen.getByText(/Play a run to be first\./i)).toBeTruthy();
  });

  it("renders ranked rows with scores in order", () => {
    const rows: BoardRow[] = [
      { rank: 1, name: "You", score: 980, self: true, source: "local" },
      { rank: 2, name: "deskbot", score: 640, source: "server" },
    ];
    render(<BoardTable rows={rows} scoreUnit="pts" />);
    expect(screen.getByText("You")).toBeTruthy();
    expect(screen.getByText("980 pts")).toBeTruthy();
    expect(screen.getByText("deskbot")).toBeTruthy();
    expect(screen.getByText("640 pts")).toBeTruthy();
    // The server row is tagged as a league entry.
    expect(screen.getByText(/league/i)).toBeTruthy();
  });
});
