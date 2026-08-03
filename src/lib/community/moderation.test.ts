import { describe, expect, it } from "vitest";
import {
  containsProfanity,
  maskProfanity,
  moderateContent,
} from "./moderation";

describe("containsProfanity", () => {
  it("passes clean, on-topic text", () => {
    expect(
      containsProfanity("Great interview — two rounds of mental math and de-vig."),
    ).toBe(false);
  });

  it("detects plain profanity", () => {
    expect(containsProfanity("what the fuck was that round")).toBe(true);
    expect(containsProfanity("you are a shit trader")).toBe(true);
  });

  it("detects leetspeak / character substitutions", () => {
    expect(containsProfanity("sh1t")).toBe(true); // 1 → i
    expect(containsProfanity("@sshole")).toBe(true); // @ → a
    expect(containsProfanity("b1tch")).toBe(true);
    expect(containsProfanity("sh!t")).toBe(true); // ! → i
  });

  it("detects spaced-out obfuscation across tokens", () => {
    expect(containsProfanity("f u c k")).toBe(true);
    expect(containsProfanity("s-h-i-t")).toBe(true);
  });

  it("detects elongation", () => {
    expect(containsProfanity("shiiit")).toBe(true);
    expect(containsProfanity("fuuuck")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(containsProfanity("ShIt")).toBe(true);
  });

  it("does NOT flag innocent words (no Scunthorpe false positives)", () => {
    expect(containsProfanity("classic pass grass bass")).toBe(false);
    expect(containsProfanity("assess the cockpit at Scunthorpe")).toBe(false);
    expect(containsProfanity("a flame retardant spice rack")).toBe(false);
  });
});

describe("maskProfanity", () => {
  it("masks whole disallowed tokens, preserving length + punctuation", () => {
    expect(maskProfanity("you are a shit trader")).toBe("you are a **** trader");
    expect(maskProfanity("shit.")).toBe("****.");
  });

  it("masks leet + elongated forms at the token level", () => {
    expect(maskProfanity("what a b1tch")).toBe("what a *****");
    expect(maskProfanity("shiiit")).toBe("******");
  });

  it("leaves clean text untouched", () => {
    expect(maskProfanity("clean, on-topic write-up")).toBe(
      "clean, on-topic write-up",
    );
  });
});

describe("moderateContent verdicts", () => {
  it("allows clean text unchanged", () => {
    const r = moderateContent("Two 90s make-a-market rounds, then mental math.");
    expect(r.verdict).toBe("allow");
    expect(r.text).toBe("Two 90s make-a-market rounds, then mental math.");
    expect(r.reasons).toEqual([]);
  });

  it("masks token-level profanity", () => {
    const r = moderateContent("this round was shit");
    expect(r.verdict).toBe("mask");
    expect(r.text).toBe("this round was ****");
    expect(r.reasons).toContain("profanity");
    expect(r.matches).toContain("shit");
  });

  it("blocks slurs entirely", () => {
    const sub = moderateContent("that guy is a nigger");
    expect(sub.verdict).toBe("block");
    expect(sub.reasons).toContain("slur");

    const whole = moderateContent("you are such a retard");
    expect(whole.verdict).toBe("block");
    expect(whole.reasons).toContain("slur");
  });

  it("blocks unsafe / self-harm + threat content", () => {
    expect(moderateContent("kill yourself").verdict).toBe("block");
    expect(moderateContent("kys").reasons).toContain("unsafe-content");
  });

  it("blocks obfuscated (spaced) profanity it cannot cleanly mask", () => {
    const r = moderateContent("you are s h i t");
    expect(r.verdict).toBe("block");
    expect(r.reasons).toContain("obfuscated-profanity");
  });

  it("is deterministic", () => {
    const a = moderateContent("this is shit, plain and simple");
    const b = moderateContent("this is shit, plain and simple");
    expect(a).toEqual(b);
  });
});
