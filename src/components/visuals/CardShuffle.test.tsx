// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

/**
 * CardShuffleIntro must play AT MOST ONCE per full site load. A module-level
 * (in-memory) flag makes it fire on the first mount and suppresses replays on
 * client-side navigation (Landing → Log in). A full reload re-imports the
 * module and plays it exactly once again. Reduced-motion always renders nothing.
 */

let reducedMotion = false;

beforeAll(() => {
  window.matchMedia = ((query: string) => ({
    matches: reducedMotion,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

beforeEach(() => {
  reducedMotion = false;
  vi.resetModules(); // fresh module ⇒ fresh "already played" flag per test
});
afterEach(cleanup);

async function importFresh() {
  const mod = await import("./CardShuffle");
  return mod.CardShuffleIntro;
}

describe("CardShuffleIntro — play once per site load", () => {
  it("plays on the first mount but NOT on subsequent client-side navigations", async () => {
    const CardShuffleIntro = await importFresh();

    // First load (e.g. Landing): the intro overlay mounts and plays.
    const first = render(<CardShuffleIntro />);
    expect(first.queryByTestId("card-shuffle-intro")).toBeTruthy();
    // The intro finishes / the route unmounts.
    first.unmount();

    // Client-side navigation (Landing → Log in) re-mounts a NEW instance from
    // the SAME loaded module — it must not replay.
    const second = render(<CardShuffleIntro />);
    expect(second.queryByTestId("card-shuffle-intro")).toBeNull();

    // And again, e.g. Log in → Landing — still suppressed for this page load.
    const third = render(<CardShuffleIntro />);
    expect(third.queryByTestId("card-shuffle-intro")).toBeNull();
  });

  it("plays again after a full reload (fresh module resets the flag)", async () => {
    const First = await importFresh();
    const first = render(<First />);
    expect(first.queryByTestId("card-shuffle-intro")).toBeTruthy();
    first.unmount();

    // A hard browser reload re-evaluates the module (fresh in-memory flag).
    vi.resetModules();
    const Reloaded = await importFresh();
    const reloaded = render(<Reloaded />);
    expect(reloaded.queryByTestId("card-shuffle-intro")).toBeTruthy();
  });

  it("renders nothing under prefers-reduced-motion", async () => {
    reducedMotion = true;
    const CardShuffleIntro = await importFresh();
    const { queryByTestId } = render(<CardShuffleIntro />);
    expect(queryByTestId("card-shuffle-intro")).toBeNull();
  });
});
