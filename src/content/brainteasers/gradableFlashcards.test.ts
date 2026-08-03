import { describe, expect, it } from "vitest";
import type { Flashcard } from "@/types/content";
import { parseFreeResponse } from "@/lib/numeric";
import { Rng } from "@/lib/rng";
import { brainteasersTrack } from "./levels";
import { ALL_BRAINTEASER_FAMILIES } from "./generators";
import { ALL_TECHNIQUE_FAMILIES } from "./techniqueGenerators";

/**
 * T7 — objective-grade brainteasers. The `Flashcard` schema gained three
 * OPTIONAL, back-compatible fields (`gradable`, `numericAnswer`, `tolerance`).
 * These tests pin the content contract:
 *   • every closed-form teaser that is `gradable` carries a numeric answer +
 *     tolerance, and its own answer grades correct (fixtures: locker = 10,
 *     bridge = 17);
 *   • every non-gradable (open-ended) teaser carries NO numeric answer /
 *     tolerance, so it can never emit graded evidence;
 *   • the parametric generators respect the same contract across many seeds.
 */

const staticCards: Flashcard[] = brainteasersTrack.levels.flatMap(
  (l) => l.flashcards ?? [],
);

/** Mirror the player's tolerant compare (`@/lib/numeric` parser + tolerance). */
function gradesCorrect(card: Flashcard, raw: string): boolean {
  const value = parseFreeResponse(raw);
  if (value === null || typeof card.numericAnswer !== "number") return false;
  const tol = Math.abs(card.tolerance ?? 0);
  return Math.abs(value - card.numericAnswer) <= tol + 1e-9;
}

const byId = (id: string) => staticCards.find((c) => c.id === id);

describe("gradable brainteaser fixtures grade correctly", () => {
  it("the locker problem (bt-lockers) is gradable with answer 10", () => {
    const locker = byId("bt-lockers");
    expect(locker).toBeDefined();
    expect(locker!.gradable).toBe(true);
    expect(locker!.numericAnswer).toBe(10);
    expect(typeof locker!.tolerance).toBe("number");
    expect(gradesCorrect(locker!, "10")).toBe(true);
    expect(gradesCorrect(locker!, "9")).toBe(false);
    expect(gradesCorrect(locker!, "11")).toBe(false);
  });

  it("the bridge crossing (bt-bridge) is gradable with answer 17 minutes", () => {
    const bridge = byId("bt-bridge");
    expect(bridge).toBeDefined();
    expect(bridge!.gradable).toBe(true);
    expect(bridge!.numericAnswer).toBe(17);
    expect(gradesCorrect(bridge!, "17")).toBe(true);
    expect(gradesCorrect(bridge!, "16")).toBe(false);
    expect(gradesCorrect(bridge!, "20")).toBe(false);
  });

  it("a real-valued teaser (bt-inventory-cap = 1/5) accepts equivalent forms within tolerance", () => {
    const inv = byId("bt-inventory-cap");
    expect(inv).toBeDefined();
    expect(inv!.gradable).toBe(true);
    expect(inv!.numericAnswer).toBeCloseTo(0.2, 10);
    expect((inv!.tolerance ?? 0)).toBeGreaterThan(0);
    expect(gradesCorrect(inv!, "0.2")).toBe(true);
    expect(gradesCorrect(inv!, "1/5")).toBe(true);
    expect(gradesCorrect(inv!, "20%")).toBe(true);
    expect(gradesCorrect(inv!, "0.5")).toBe(false);
  });
});

describe("gradable/non-gradable flashcard schema contract (static pool)", () => {
  it("every gradable static card carries a numeric answer + tolerance and self-grades", () => {
    const gradable = staticCards.filter((c) => c.gradable === true);
    // We converted a substantial set of closed-form teasers.
    expect(gradable.length).toBeGreaterThanOrEqual(12);
    for (const c of gradable) {
      expect(typeof c.numericAnswer).toBe("number");
      expect(Number.isFinite(c.numericAnswer)).toBe(true);
      expect(typeof c.tolerance).toBe("number");
      expect(c.tolerance).toBeGreaterThanOrEqual(0);
      // The card's own exact answer must grade correct.
      expect(gradesCorrect(c, String(c.numericAnswer))).toBe(true);
    }
  });

  it("no non-gradable card carries a numericAnswer or tolerance (never inflates mastery)", () => {
    for (const c of staticCards) {
      if (c.gradable === true) continue;
      expect(c.numericAnswer).toBeUndefined();
      expect(c.tolerance).toBeUndefined();
    }
  });

  it("open-ended puzzles are explicitly non-gradable (e.g. three switches, Monty Hall)", () => {
    expect(byId("bt-switches")!.gradable).toBe(false);
    expect(byId("bt-monty")!.gradable).toBe(false);
    expect(byId("bt-switches")!.numericAnswer).toBeUndefined();
  });
});

describe("parametric generators respect the gradable contract across seeds", () => {
  const SEEDS = Array.from({ length: 40 }, (_, i) => i * 97 + 3);
  const families = [...ALL_BRAINTEASER_FAMILIES, ...ALL_TECHNIQUE_FAMILIES];

  it("every generated card is schema-consistent (gradable ⇒ numeric+tolerance & self-grades)", () => {
    for (const [name, gen] of families) {
      for (const seed of SEEDS) {
        const c = gen(new Rng(seed));
        if (c.gradable === true) {
          expect(typeof c.numericAnswer, name).toBe("number");
          expect(Number.isFinite(c.numericAnswer)).toBe(true);
          expect(typeof c.tolerance, name).toBe("number");
          expect(gradesCorrect(c, String(c.numericAnswer)), `${name} @ ${seed}`).toBe(
            true,
          );
        } else {
          expect(c.numericAnswer, name).toBeUndefined();
          expect(c.tolerance, name).toBeUndefined();
        }
      }
    }
  });

  it("at least one generator family is gradable and at least one is not", () => {
    const draw = (gen: (r: Rng) => Flashcard) => gen(new Rng(7));
    const flags = families.map(([, gen]) => draw(gen).gradable === true);
    expect(flags.some(Boolean)).toBe(true);
    expect(flags.some((f) => !f)).toBe(true);
  });
});
