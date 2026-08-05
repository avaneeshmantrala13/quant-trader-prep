import { describe, expect, it } from "vitest";
import { PLAYABLE_TRACKS } from "@/content";
import { topicKeyForLevel } from "@/lib/mastery/topicKey";
import { isFlashcardLevel } from "@/types/content";
import {
  DRILL_TOPICS,
  DRILL_TOPIC_KEYS,
  drillTopicByKey,
} from "./vocabulary";
import { parseDrillIntent } from "./parseIntent";

/** Every topicKey that actually has at least one non-flashcard (MCQ-able) level. */
const liveTopicKeys = new Set<string>();
for (const track of PLAYABLE_TRACKS) {
  for (const level of track.levels) {
    if (isFlashcardLevel(level)) continue;
    liveTopicKeys.add(topicKeyForLevel(track.id, level));
  }
}

describe("DRILL_TOPICS — content grounding", () => {
  it("every drill topic resolves to a real, MCQ-able section in live content", () => {
    const orphans = DRILL_TOPICS.filter((t) => !liveTopicKeys.has(t.topicKey));
    expect(
      orphans.map((t) => `${t.label} (${t.topicKey})`),
    ).toEqual([]);
  });

  it("topicKeys are unique", () => {
    const keys = DRILL_TOPICS.map((t) => t.topicKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("DRILL_TOPIC_KEYS mirrors the topic list", () => {
    expect(DRILL_TOPIC_KEYS.size).toBe(
      new Set(DRILL_TOPICS.map((t) => t.topicKey)).size,
    );
    for (const t of DRILL_TOPICS) {
      expect(DRILL_TOPIC_KEYS.has(t.topicKey)).toBe(true);
    }
  });

  it("drillTopicByKey round-trips every topic", () => {
    for (const t of DRILL_TOPICS) {
      expect(drillTopicByKey(t.topicKey)).toBe(t);
    }
    expect(drillTopicByKey("nope::nope")).toBeUndefined();
  });
});

describe("DRILL_TOPICS — alias coverage", () => {
  it("every alias is lowercase and non-empty", () => {
    for (const t of DRILL_TOPICS) {
      for (const a of t.aliases) {
        expect(a).toBe(a.toLowerCase());
        expect(a.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("each topic's own first alias parses back to that topic", () => {
    for (const t of DRILL_TOPICS) {
      const alias = t.aliases[0];
      const spec = parseDrillIntent(alias);
      expect(spec.topicKeys).toContain(t.topicKey);
    }
  });
});
