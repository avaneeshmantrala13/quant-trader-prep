import { describe, expect, it } from "vitest";
import { snapToVocabulary } from "./aiIntent";
import { DRILL_TOPICS } from "./vocabulary";
import {
  DRILL_COUNT_MAX,
  DRILL_COUNT_MIN,
  DRILL_COUNT_DEFAULT,
} from "./parseIntent";

/**
 * These exercise the "LLM proposes, code verifies" safety layer: `snapToVocabulary`
 * takes a RAW model proposal and must validate topics against the real vocabulary,
 * clamp the difficulty window + count, and fall back (return `null`) on anything
 * unusable — so the drill can never be silently misconfigured by the model.
 */

const topicKey = (label: string): string => {
  const t = DRILL_TOPICS.find((d) => d.label === label);
  if (!t) throw new Error(`no drill topic labelled "${label}"`);
  return t.topicKey;
};

const MARKOV = topicKey("Markov Chains");
const EV = topicKey("Expected Value");

describe("snapToVocabulary — happy path", () => {
  it("passes a well-formed proposal through, preserving a small count", () => {
    const spec = snapToVocabulary({
      topicKeys: [MARKOV],
      minOrder: 0,
      maxOrder: 4,
      count: 3,
    });
    expect(spec).toEqual({
      topicKeys: [MARKOV],
      minOrder: 0,
      maxOrder: 4,
      count: 3,
    });
  });

  it("dedups repeated topicKeys, keeping first-seen order", () => {
    const spec = snapToVocabulary({
      topicKeys: [EV, MARKOV, EV],
      minOrder: 2,
      maxOrder: 2,
      count: 8,
    });
    expect(spec?.topicKeys).toEqual([EV, MARKOV]);
  });
});

describe("snapToVocabulary — topic validation (never invents topics)", () => {
  it("drops unknown topicKeys but keeps the known ones", () => {
    const spec = snapToVocabulary({
      topicKeys: ["probability::Totally Made Up", MARKOV, 42, null],
      minOrder: 0,
      maxOrder: 4,
      count: 10,
    });
    expect(spec?.topicKeys).toEqual([MARKOV]);
  });

  it("returns null when NO proposed topic is recognized (caller falls back)", () => {
    const spec = snapToVocabulary({
      topicKeys: ["nope::nope", "also::fake"],
      minOrder: 0,
      maxOrder: 4,
      count: 10,
    });
    expect(spec).toBeNull();
  });

  it("returns null when topicKeys is missing/empty", () => {
    expect(snapToVocabulary({ count: 10 })).toBeNull();
    expect(snapToVocabulary({ topicKeys: [], count: 10 })).toBeNull();
  });
});

describe("snapToVocabulary — difficulty clamping", () => {
  it("clamps out-of-range orders into [0, 4]", () => {
    const spec = snapToVocabulary({
      topicKeys: [MARKOV],
      minOrder: -3,
      maxOrder: 99,
      count: 10,
    });
    expect(spec?.minOrder).toBe(0);
    expect(spec?.maxOrder).toBe(4);
  });

  it("swaps an inverted window (min > max)", () => {
    const spec = snapToVocabulary({
      topicKeys: [MARKOV],
      minOrder: 4,
      maxOrder: 1,
      count: 10,
    });
    expect(spec?.minOrder).toBe(1);
    expect(spec?.maxOrder).toBe(4);
  });

  it("rounds fractional orders and defaults missing ones to the full band", () => {
    const spec = snapToVocabulary({ topicKeys: [MARKOV], count: 10 });
    expect(spec?.minOrder).toBe(0);
    expect(spec?.maxOrder).toBe(4);

    const rounded = snapToVocabulary({
      topicKeys: [MARKOV],
      minOrder: 1.6,
      maxOrder: 2.4,
      count: 10,
    });
    expect(rounded?.minOrder).toBe(2);
    expect(rounded?.maxOrder).toBe(2);
  });
});

describe("snapToVocabulary — count clamping", () => {
  it("keeps an in-band count (regression: 3 stays 3)", () => {
    expect(snapToVocabulary({ topicKeys: [MARKOV], count: 3 })?.count).toBe(3);
  });

  it("clamps a too-small count up to MIN", () => {
    expect(snapToVocabulary({ topicKeys: [MARKOV], count: 0 })?.count).toBe(
      DRILL_COUNT_MIN,
    );
  });

  it("clamps a too-large count down to MAX", () => {
    expect(snapToVocabulary({ topicKeys: [MARKOV], count: 9999 })?.count).toBe(
      DRILL_COUNT_MAX,
    );
  });

  it("coerces a numeric string count", () => {
    expect(snapToVocabulary({ topicKeys: [MARKOV], count: "7" })?.count).toBe(7);
  });

  it("falls back to the default for a missing/garbage count", () => {
    expect(snapToVocabulary({ topicKeys: [MARKOV] })?.count).toBe(
      DRILL_COUNT_DEFAULT,
    );
    expect(
      snapToVocabulary({ topicKeys: [MARKOV], count: "abc" })?.count,
    ).toBe(DRILL_COUNT_DEFAULT);
  });
});

describe("snapToVocabulary — unusable payloads → null (deterministic fallback)", () => {
  it("returns null for null / non-object / wrong-typed input", () => {
    expect(snapToVocabulary(null)).toBeNull();
    // The client passes whatever the Lambda returned; anything not an object
    // (or missing usable topics) must degrade to the deterministic parser.
    expect(
      snapToVocabulary(undefined as unknown as Record<string, unknown>),
    ).toBeNull();
  });
});
