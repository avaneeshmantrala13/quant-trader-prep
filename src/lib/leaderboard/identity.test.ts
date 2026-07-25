import { describe, expect, it } from "vitest";
import { isoWeekKey, validateDisplayName } from "./identity";

describe("validateDisplayName (opt-in, never email)", () => {
  it("accepts a normal name and normalizes whitespace", () => {
    const r = validateDisplayName("  Ada   Lovelace  ");
    expect(r.ok).toBe(true);
    expect(r.value).toBe("Ada Lovelace");
  });

  it("rejects too-short / too-long names", () => {
    expect(validateDisplayName("ab").reason).toBe("too-short");
    expect(validateDisplayName("a".repeat(21)).reason).toBe("too-long");
  });

  it("rejects disallowed characters (e.g. an email/@)", () => {
    expect(validateDisplayName("me@example.com").reason).toBe("bad-chars");
  });

  it("allows letters, digits, spaces, underscore and hyphen", () => {
    expect(validateDisplayName("Quant_Trader-99").ok).toBe(true);
  });

  it("screens profanity", () => {
    expect(validateDisplayName("shithead").reason).toBe("profanity");
  });
});

describe("isoWeekKey (weekly league bucket, UTC ISO-8601)", () => {
  it("is stable across a week and formatted YYYY-Www", () => {
    // 2026-07-20 is a Monday; the whole week maps to the same key.
    const mon = Date.UTC(2026, 6, 20, 0, 0, 0);
    const sun = Date.UTC(2026, 6, 26, 23, 59, 0);
    const k = isoWeekKey(mon);
    expect(k).toMatch(/^\d{4}-W\d{2}$/);
    expect(isoWeekKey(sun)).toBe(k);
  });

  it("rolls over to a different key the next week", () => {
    const thisWeek = isoWeekKey(Date.UTC(2026, 6, 22));
    const nextWeek = isoWeekKey(Date.UTC(2026, 6, 29));
    expect(nextWeek).not.toBe(thisWeek);
  });

  it("uses the ISO rule where early-January can belong to the prior year's W52/W53", () => {
    // 2027-01-01 is a Friday ⇒ ISO week 53 of 2026.
    expect(isoWeekKey(Date.UTC(2027, 0, 1))).toBe("2026-W53");
  });
});
