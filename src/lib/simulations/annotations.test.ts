import { describe, expect, it } from "vitest";
import {
  clamp,
  leaderAnchor,
  textAnchorForSide,
  baselineForSide,
  estimateCaptionWidth,
  placeAnnotation,
  arrowHeadPoints,
  type PlotBox,
} from "./annotations";

const BOX: PlotBox = { left: 44, right: 624, top: 12, bottom: 206 };

describe("clamp", () => {
  it("clamps below, inside, and above the range", () => {
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(99, 0, 10)).toBe(10);
  });

  it("returns lo for an inverted range", () => {
    expect(clamp(5, 10, 0)).toBe(10);
  });
});

describe("leaderAnchor", () => {
  const tip = { x: 100, y: 100 };
  it("offsets up/down vertically", () => {
    expect(leaderAnchor(tip, "up", 20)).toEqual({ x: 100, y: 80 });
    expect(leaderAnchor(tip, "down", 20)).toEqual({ x: 100, y: 120 });
  });
  it("offsets left/right horizontally", () => {
    expect(leaderAnchor(tip, "left", 30)).toEqual({ x: 70, y: 100 });
    expect(leaderAnchor(tip, "right", 30)).toEqual({ x: 130, y: 100 });
  });
});

describe("textAnchorForSide", () => {
  it("maps each side to the correct text-anchor", () => {
    expect(textAnchorForSide("left")).toBe("end");
    expect(textAnchorForSide("right")).toBe("start");
    expect(textAnchorForSide("up")).toBe("middle");
    expect(textAnchorForSide("down")).toBe("middle");
  });
});

describe("baselineForSide", () => {
  it("puts text above the anchor for 'up' and below for 'down'", () => {
    expect(baselineForSide("up")).toBe("auto");
    expect(baselineForSide("down")).toBe("hanging");
    expect(baselineForSide("left")).toBe("middle");
    expect(baselineForSide("right")).toBe("middle");
  });
});

describe("estimateCaptionWidth", () => {
  it("scales with text length and font size", () => {
    expect(estimateCaptionWidth("", 10)).toBe(0);
    expect(estimateCaptionWidth("abcd", 10)).toBeCloseTo(24, 5);
    expect(estimateCaptionWidth("abcd", 20)).toBeCloseTo(48, 5);
  });
});

describe("placeAnnotation", () => {
  it("keeps the tip exactly on the target", () => {
    const p = placeAnnotation({
      tip: { x: 300, y: 100 },
      side: "up",
      distance: 24,
      text: "hello",
      fontSize: 10,
      box: BOX,
    });
    expect(p.tip).toEqual({ x: 300, y: 100 });
  });

  it("offsets the anchor by `distance` on the requested side when there is room", () => {
    const p = placeAnnotation({
      tip: { x: 300, y: 100 },
      side: "up",
      distance: 24,
      text: "hi",
      fontSize: 10,
      box: BOX,
    });
    expect(p.anchor.x).toBe(300);
    expect(p.anchor.y).toBe(76); // 100 - 24
    expect(p.textAnchor).toBe("middle");
    expect(p.baseline).toBe("auto");
  });

  it("clamps a 'start'-anchored caption so long text never overflows the right edge", () => {
    const text = "a very long explanatory caption indeed";
    const p = placeAnnotation({
      tip: { x: BOX.right - 5, y: 100 },
      side: "right",
      distance: 24,
      text,
      fontSize: 10,
      box: BOX,
    });
    const width = estimateCaptionWidth(text, 10);
    // start-anchored text extends right, so anchor.x + width must fit inside.
    expect(p.anchor.x + width).toBeLessThanOrEqual(BOX.right - 4 + 1e-6);
    expect(p.textAnchor).toBe("start");
  });

  it("clamps an 'end'-anchored caption so it never overflows the left edge", () => {
    const text = "a very long explanatory caption indeed";
    const p = placeAnnotation({
      tip: { x: BOX.left + 5, y: 100 },
      side: "left",
      distance: 24,
      text,
      fontSize: 10,
      box: BOX,
    });
    const width = estimateCaptionWidth(text, 10);
    // end-anchored text extends left, so anchor.x - width must fit inside.
    expect(p.anchor.x - width).toBeGreaterThanOrEqual(BOX.left + 4 - 1e-6);
  });

  it("clamps the anchor vertically inside the box near the top edge", () => {
    const p = placeAnnotation({
      tip: { x: 300, y: BOX.top + 2 },
      side: "up",
      distance: 40,
      text: "top caption",
      fontSize: 10,
      box: BOX,
    });
    // 'up' baseline is 'auto' (text above), so anchor must leave a font's room.
    expect(p.anchor.y).toBeGreaterThanOrEqual(BOX.top + 4 + 10 - 1e-6);
    expect(p.anchor.y).toBeLessThanOrEqual(BOX.bottom);
  });

  it("clamps the anchor vertically inside the box near the bottom edge", () => {
    const p = placeAnnotation({
      tip: { x: 300, y: BOX.bottom - 2 },
      side: "down",
      distance: 40,
      text: "bottom caption",
      fontSize: 10,
      box: BOX,
    });
    expect(p.anchor.y).toBeLessThanOrEqual(BOX.bottom - 4 - 10 + 1e-6);
    expect(p.anchor.y).toBeGreaterThanOrEqual(BOX.top);
  });

  it("centers a 'middle' caption's clamp bounds symmetrically", () => {
    const text = "mid";
    const p = placeAnnotation({
      tip: { x: BOX.left + 1, y: 100 },
      side: "up",
      distance: 20,
      text,
      fontSize: 10,
      box: BOX,
    });
    const width = estimateCaptionWidth(text, 10);
    expect(p.anchor.x - width / 2).toBeGreaterThanOrEqual(BOX.left + 4 - 1e-6);
  });
});

describe("arrowHeadPoints", () => {
  it("returns three points with the middle one on the tip", () => {
    const s = arrowHeadPoints({ x: 100, y: 100 }, { x: 100, y: 60 }, 6);
    const parts = s.split(" ");
    expect(parts).toHaveLength(3);
    expect(parts[1]).toBe("100,100");
  });

  it("is stable when tip and anchor coincide (no NaN)", () => {
    const s = arrowHeadPoints({ x: 5, y: 5 }, { x: 5, y: 5 }, 6);
    expect(s).not.toContain("NaN");
  });
});
