import { describe, expect, it } from "vitest";
import { MISCONCEPTION } from "@/lib/tutor/misconception";
import { misconceptionKey } from "@/lib/mastery/topicKey";
import {
  MISCONCEPTION_LABELS,
  TOPIC_NAMES,
  describeMisconception,
  misconceptionTag,
  topicDisplayName,
} from "./misconceptionLabels";

const TOPIC_KEY = "probability::Conditional Probability";
const TOPIC_NAME = "Conditional Probability & Bayes";

describe("MISCONCEPTION_LABELS coverage", () => {
  it("has a concise description for EVERY canonical content tag", () => {
    // The content generators only ever emit the values of `MISCONCEPTION`
    // (audited across src/content/**) — every one must map to a description.
    for (const tag of Object.values(MISCONCEPTION)) {
      expect(MISCONCEPTION_LABELS[tag], `missing label for "${tag}"`).toBeTruthy();
    }
  });

  it("does not map any deterministic fallback pseudo-tag", () => {
    // `idx:*` / `err:*` are NOT semantic tags — they must fall through to the
    // topic-level phrasing, never be given a bespoke description here.
    for (const key of Object.keys(MISCONCEPTION_LABELS)) {
      expect(key.startsWith("idx:")).toBe(false);
      expect(key.startsWith("err:")).toBe(false);
    }
  });

  it("maps each tag to a short, non-key learner-facing string", () => {
    for (const [tag, label] of Object.entries(MISCONCEPTION_LABELS)) {
      expect(label).not.toContain("::");
      expect(label).not.toBe(tag);
      expect(label.length).toBeLessThanOrEqual(72);
    }
  });
});

describe("misconceptionTag", () => {
  it("strips the namespaced topicKey:: prefix to recover the tag", () => {
    expect(misconceptionTag(misconceptionKey(TOPIC_KEY, "reversed_conditional"))).toBe(
      "reversed_conditional",
    );
    expect(misconceptionTag(`${TOPIC_KEY}::idx:1`)).toBe("idx:1");
  });

  it("returns a bare tag unchanged", () => {
    expect(misconceptionTag("base_rate_neglect")).toBe("base_rate_neglect");
  });
});

describe("topicDisplayName", () => {
  it("returns the curated nice name when the topicKey is known", () => {
    expect(topicDisplayName(TOPIC_KEY, "Conditional Probability")).toBe(TOPIC_NAME);
    expect(TOPIC_NAMES[TOPIC_KEY]).toBe(TOPIC_NAME);
  });

  it("falls back to the caller label for an unknown topicKey", () => {
    expect(topicDisplayName("some-track::Some Section", "Some Section")).toBe(
      "Some Section",
    );
  });
});

describe("describeMisconception", () => {
  it("returns the semantic description for a known tag (namespaced key)", () => {
    const key = misconceptionKey(TOPIC_KEY, MISCONCEPTION.reversedConditional);
    expect(describeMisconception(key, { topicName: TOPIC_NAME })).toBe(
      "Confusing P(A|B) with P(B|A)",
    );
  });

  it("returns the semantic description for a bare tag too", () => {
    expect(
      describeMisconception("base_rate_neglect", { topicName: TOPIC_NAME }),
    ).toBe("Ignoring the base rate");
  });

  const SUBSKILL = "Conditioning on the right event and applying Bayes' rule";

  it("degrades an idx:<i> fallback to the topic's concrete sub-skill (never a raw key, never a bare restatement)", () => {
    const out = describeMisconception(`${TOPIC_KEY}::idx:0`, {
      topicName: TOPIC_NAME,
    });
    expect(out).toBe(SUBSKILL);
    expect(out).not.toContain("idx");
    expect(out).not.toContain("option 0");
    expect(out).not.toContain("::");
    // The useless bare topic restatement is gone.
    expect(out).not.toMatch(/^Recurring mistakes in/);
  });

  it("degrades an err:<value> fallback to the topic's concrete sub-skill", () => {
    const out = describeMisconception(`${TOPIC_KEY}::err:12.5`, {
      topicName: TOPIC_NAME,
    });
    expect(out).toBe(SUBSKILL);
    expect(out).not.toContain("err");
    expect(out).not.toContain("12.5");
  });

  it("degrades an UNKNOWN semantic tag to the topic's concrete sub-skill", () => {
    const out = describeMisconception(`${TOPIC_KEY}::totally_new_tag`, {
      topicName: TOPIC_NAME,
    });
    expect(out).toBe(SUBSKILL);
    expect(out).not.toContain("totally_new_tag");
  });

  it("degrades an unmapped topic to a concrete-but-generic sub-skill, not a bare restatement", () => {
    const out = describeMisconception("some-track::Some Section::idx:1", {
      topicName: "Some Section",
    });
    expect(out).toBe("Core problem-setups in Some Section");
    expect(out).not.toMatch(/^Recurring mistakes in/);
    expect(out).not.toContain("::");
  });

  it("NEVER surfaces a raw key for any resolvable input shape", () => {
    const inputs = [
      misconceptionKey(TOPIC_KEY, MISCONCEPTION.gamblersFallacy),
      `${TOPIC_KEY}::idx:3`,
      `${TOPIC_KEY}::err:7`,
      `${TOPIC_KEY}::unknown_x`,
      "bare_unknown",
    ];
    for (const key of inputs) {
      const out = describeMisconception(key, { topicName: TOPIC_NAME });
      expect(out).not.toContain("::");
      expect(out.startsWith("idx:")).toBe(false);
      expect(out.startsWith("err:")).toBe(false);
    }
  });
});
