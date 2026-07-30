import { describe, expect, it } from "vitest";
import {
  COACHMARK_ARROW_INSET,
  COACHMARK_MARGIN,
  computeCoachmarkPlacement,
  tourTargetSelector,
  type Rect,
  type Size,
} from "./anchor";

const VIEWPORT: Size = { width: 1000, height: 800 };
const BOX: Size = { width: 320, height: 200 };

describe("tourTargetSelector", () => {
  it("builds a data-tour attribute selector", () => {
    expect(tourTargetSelector("dashboard")).toBe('[data-tour="dashboard"]');
    expect(tourTargetSelector("contents")).toBe('[data-tour="contents"]');
  });
});

describe("computeCoachmarkPlacement — fallback", () => {
  it("centers the box when there is no target (graceful fallback)", () => {
    const p = computeCoachmarkPlacement(null, VIEWPORT, BOX);
    expect(p.side).toBe("center");
    expect(p.top).toBe((VIEWPORT.height - BOX.height) / 2);
    expect(p.left).toBe((VIEWPORT.width - BOX.width) / 2);
  });

  it("pins a centered box to the margin when it is wider than the viewport", () => {
    const narrow: Size = { width: 300, height: 800 };
    const p = computeCoachmarkPlacement(null, narrow, BOX);
    expect(p.side).toBe("center");
    // BOX (320) is wider than the viewport (300) → clamp to the start margin.
    expect(p.left).toBe(COACHMARK_MARGIN);
  });
});

describe("computeCoachmarkPlacement — side selection", () => {
  it("places the box BELOW a top-of-page nav target with the arrow on top", () => {
    const target: Rect = { top: 40, left: 400, width: 120, height: 30 };
    const p = computeCoachmarkPlacement(target, VIEWPORT, BOX);
    expect(p.side).toBe("bottom");
    expect(p.top).toBe(40 + 30 + 12); // below target + gap
    expect(p.left).toBe(460 - BOX.width / 2); // centered under target
    expect(p.arrowTop).toBe(0); // arrow rides the top edge
    expect(p.arrowLeft).toBe(460 - p.left); // points at target center
  });

  it("flips ABOVE when there is no room below but room above", () => {
    const target: Rect = { top: 760, left: 400, width: 120, height: 30 };
    const p = computeCoachmarkPlacement(target, VIEWPORT, BOX);
    expect(p.side).toBe("top");
    expect(p.top).toBe(760 - 12 - BOX.height);
    expect(p.arrowTop).toBe(BOX.height); // arrow rides the bottom edge
  });

  it("falls to the RIGHT when neither below nor above fits", () => {
    const shortVp: Size = { width: 1000, height: 200 };
    const target: Rect = { top: 0, left: 0, width: 50, height: 200 };
    const p = computeCoachmarkPlacement(target, shortVp, BOX);
    expect(p.side).toBe("right");
    expect(p.left).toBe(50 + 12);
    expect(p.arrowLeft).toBe(0); // arrow rides the left edge
  });

  it("falls to the LEFT when below/above/right don't fit", () => {
    const shortVp: Size = { width: 400, height: 200 };
    const target: Rect = { top: 0, left: 350, width: 50, height: 200 };
    const p = computeCoachmarkPlacement(target, shortVp, BOX);
    expect(p.side).toBe("left");
    expect(p.left).toBe(350 - 12 - BOX.width);
    expect(p.arrowLeft).toBe(BOX.width); // arrow rides the right edge
  });
});

describe("computeCoachmarkPlacement — clamping", () => {
  it("keeps the box on-screen and clamps the arrow near the right corner", () => {
    const target: Rect = { top: 40, left: 960, width: 30, height: 30 };
    const p = computeCoachmarkPlacement(target, VIEWPORT, BOX);
    expect(p.side).toBe("bottom");
    // Box would overflow right; clamp to viewport - box - margin.
    expect(p.left).toBe(VIEWPORT.width - BOX.width - COACHMARK_MARGIN);
    // Arrow can't pass the box's corner inset.
    expect(p.arrowLeft).toBe(BOX.width - COACHMARK_ARROW_INSET);
  });

  it("keeps the box on-screen and clamps the arrow near the left corner", () => {
    const target: Rect = { top: 40, left: 0, width: 30, height: 30 };
    const p = computeCoachmarkPlacement(target, VIEWPORT, BOX);
    expect(p.side).toBe("bottom");
    expect(p.left).toBe(COACHMARK_MARGIN);
    expect(p.arrowLeft).toBe(COACHMARK_ARROW_INSET);
  });
});
