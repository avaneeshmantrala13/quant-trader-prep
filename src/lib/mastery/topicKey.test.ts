import { describe, expect, it } from "vitest";
import {
  misconceptionKey,
  tierDifficultyKey,
  tierExposureKey,
  topicKeyForLevel,
  topicKeyOf,
} from "./topicKey";

describe("topicKeyOf / topicKeyForLevel", () => {
  it("section-less levels collapse to `${trackId}::_core`", () => {
    expect(topicKeyOf("mentalMath")).toBe("mentalMath::_core");
    expect(topicKeyForLevel("mentalMath", { id: "mm-1" })).toBe(
      "mentalMath::_core",
    );
  });

  it("labeled sections yield `${trackId}::${section}`", () => {
    expect(topicKeyOf("probability", "Betting & Sizing")).toBe(
      "probability::Betting & Sizing",
    );
    expect(
      topicKeyForLevel("probability", { id: "p-3", section: "Game Theory" }),
    ).toBe("probability::Game Theory");
  });
});

describe("misconceptionKey", () => {
  it("composes a namespaced string", () => {
    expect(misconceptionKey("probability::_core", "idx:2")).toBe(
      "probability::_core::idx:2",
    );
  });
});

describe("tier companion keys", () => {
  it("difficulty and exposure keys are distinct and never collide", () => {
    const topic = "probability::Game Theory";
    expect(tierDifficultyKey(topic, "medium")).toBe(
      "probability::Game Theory#medium",
    );
    expect(tierExposureKey(topic, "medium")).toBe(
      "probability::Game Theory#medium#n",
    );
    expect(tierDifficultyKey(topic, "medium")).not.toBe(
      tierExposureKey(topic, "medium"),
    );
  });
});
