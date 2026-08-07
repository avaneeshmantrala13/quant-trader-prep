import { describe, expect, it } from "vitest";
import {
  conceptDeck,
  deckCardIds,
  deckForMode,
  factCoreDeck,
  indexDeck,
} from "./deck";
import { isCourseTopic } from "@/lib/mode/courseMap";

describe("SRS deck — determinism + integrity", () => {
  it("is deterministic per mode (same cards, same order)", () => {
    expect(deckForMode("course")).toEqual(deckForMode("course"));
    expect(deckForMode("interview")).toEqual(deckForMode("interview"));
  });

  it("has unique, stable ids within each mode", () => {
    for (const mode of ["course", "interview"] as const) {
      const ids = deckCardIds(mode);
      expect(ids.length).toBeGreaterThan(0);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("indexes a deck by id", () => {
    const deck = factCoreDeck();
    const idx = indexDeck(deck);
    expect(idx[deck[0].id]).toBe(deck[0]);
  });
});

describe("SRS deck — Case A (course) broad concept deck", () => {
  const deck = conceptDeck();

  it("draws only from real course topics and carries a topicKey", () => {
    expect(deck.length).toBeGreaterThan(10);
    for (const card of deck) {
      expect(card.deck).toBe("concept");
      expect(card.topicKey).toBeTruthy();
      expect(isCourseTopic(card.topicKey!)).toBe(true);
      expect(card.front.trim().length).toBeGreaterThan(0);
      expect(card.back.trim().length).toBeGreaterThan(0);
    }
  });

  it("includes key-idea recall and worked-procedure cards", () => {
    expect(deck.some((c) => c.id.endsWith(":idea"))).toBe(true);
    expect(deck.some((c) => c.id.endsWith(":proc"))).toBe(true);
  });
});

describe("SRS deck — Case B (interview) narrow FACT-CORE deck", () => {
  const deck = factCoreDeck();
  const ids = deck.map((c) => c.id);
  const backs = deck.map((c) => c.back).join("\n");

  it("covers exactly the fact-core families from the scoping", () => {
    expect(deck.every((c) => c.deck === "fact-core")).toBe(true);
    // conversions, squares, cubes, powers of 2, primes, anchors, identities,
    // nCk, de-vig — each family present.
    for (const prefix of [
      "fact:conv:",
      "fact:square:",
      "fact:cube:",
      "fact:pow2:",
      "fact:primes:",
      "fact:anchor:",
      "fact:identity:",
      "fact:nck:",
      "fact:devig:",
    ]) {
      expect(ids.some((id) => id.startsWith(prefix))).toBe(true);
    }
  });

  it("contains the specific research-named identities + anchors", () => {
    expect(backs).toContain("Var(X) = E[X²] − E[X]²");
    expect(backs).toContain("P(H|E) = P(E|H)·P(H) / P(E)"); // Bayes
    expect(backs).toContain("C(n + k − 1, k − 1)"); // stars & bars
    expect(backs).toContain("72 / r"); // rule of 72
    expect(backs.toLowerCase()).toContain("normalize to sum 1"); // de-vig
  });

  it("is served MIXED (interleaved), not blocked by family", () => {
    // The first several cards must come from DISTINCT families (round-robin), so
    // no long same-family run at the head of the deck.
    const family = (id: string) => id.split(":").slice(0, 2).join(":");
    const firstFamilies = deck.slice(0, 5).map((c) => family(c.id));
    expect(new Set(firstFamilies).size).toBe(firstFamilies.length);
  });

  it("keeps brainteasers / Fermi / word-problems / live MM OUT of SRS", () => {
    const text = deck.map((c) => `${c.front} ${c.back}`).join("\n").toLowerCase();
    expect(text).not.toContain("brainteaser");
    expect(text).not.toContain("fermi");
    expect(text).not.toContain("estimate the number of");
  });

  it("flags mental-math-able fact cards as arena-ready (Speed Arena linkage)", () => {
    expect(deck.some((c) => c.arenaReady)).toBe(true);
  });
});
