import { describe, expect, it } from "vitest";
import {
  parseDrillIntent,
  bandLabel,
  DRILL_COUNT_MIN,
  DRILL_COUNT_MAX,
  DRILL_COUNT_DEFAULT,
} from "./parseIntent";
import { DRILL_TOPICS } from "./vocabulary";

const topicKey = (label: string): string => {
  const t = DRILL_TOPICS.find((d) => d.label === label);
  if (!t) throw new Error(`no drill topic labelled "${label}"`);
  return t.topicKey;
};

describe("parseDrillIntent — topic matching", () => {
  it("maps a single alias to its canonical topicKey", () => {
    const spec = parseDrillIntent("bayes");
    expect(spec.topicKeys).toEqual([topicKey("Conditional Probability")]);
  });

  it("maps distinct aliases of the SAME topic to one key (deduped)", () => {
    const spec = parseDrillIntent("bayes and posterior and monty hall");
    expect(spec.topicKeys).toEqual([topicKey("Conditional Probability")]);
  });

  it("collects every matched topic (order follows the vocabulary, deterministic)", () => {
    const spec = parseDrillIntent("ev then combinatorics");
    // The parser scans the vocabulary in order, so both matched topics are
    // present in DRILL_TOPICS order (Combinatorial Analysis precedes Expected
    // Value in the vocabulary) regardless of where they appear in the text.
    expect(new Set(spec.topicKeys)).toEqual(
      new Set([topicKey("Expected Value"), topicKey("Combinatorial Analysis")]),
    );
    expect(spec.topicKeys).toEqual([
      topicKey("Combinatorial Analysis"),
      topicKey("Expected Value"),
    ]);
  });

  it("returns no topics when nothing matches", () => {
    const spec = parseDrillIntent("something totally unrelated zzzz");
    expect(spec.topicKeys).toEqual([]);
  });

  it("is deterministic — same input, same spec", () => {
    expect(parseDrillIntent("kelly betting, hard, 8")).toEqual(
      parseDrillIntent("kelly betting, hard, 8"),
    );
  });
});

describe("parseDrillIntent — difficulty band", () => {
  it("defaults to the full range when no band keyword is present", () => {
    const spec = parseDrillIntent("bayes");
    expect(spec.minOrder).toBe(0);
    expect(spec.maxOrder).toBe(4);
  });

  it("pins a single mid band", () => {
    const spec = parseDrillIntent("ev, medium");
    expect(spec.minOrder).toBe(2);
    expect(spec.maxOrder).toBe(2);
  });

  it("unions across bands (min of mins, max of maxes)", () => {
    const spec = parseDrillIntent("combinatorics, easy to hard");
    expect(spec.minOrder).toBe(1);
    expect(spec.maxOrder).toBe(3);
  });

  it("recognizes 'expert' as the top band", () => {
    const spec = parseDrillIntent("markov, expert");
    expect(spec.maxOrder).toBe(4);
  });
});

describe("parseDrillIntent — count", () => {
  it("uses the default when no number is given", () => {
    expect(parseDrillIntent("bayes").count).toBe(DRILL_COUNT_DEFAULT);
  });

  it("parses an explicit count", () => {
    expect(parseDrillIntent("bayes, 12 questions").count).toBe(12);
  });

  it("clamps below the minimum", () => {
    expect(parseDrillIntent("bayes, 1 question").count).toBe(DRILL_COUNT_MIN);
  });

  it("clamps above the maximum", () => {
    expect(parseDrillIntent("bayes, 999 questions").count).toBe(
      DRILL_COUNT_MAX,
    );
  });
});

describe("bandLabel", () => {
  it("labels the full range as 'all levels'", () => {
    expect(bandLabel(0, 4)).toBe("all levels");
  });

  it("labels a single tier by its DIFFICULTY_META label", () => {
    expect(bandLabel(2, 2)).toBeTypeOf("string");
    expect(bandLabel(2, 2).length).toBeGreaterThan(0);
  });

  it("labels a spanning band as 'lo–hi'", () => {
    expect(bandLabel(1, 3)).toContain("–");
  });
});
