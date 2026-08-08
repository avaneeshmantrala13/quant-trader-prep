// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEV_PASSWORD,
  DEV_USERNAME,
  DEV_USER_ID,
  endDevSession,
  isDevSessionActive,
  isDeveloperCredentials,
  startDevSession,
} from "./devAccount";
import { installMemoryLocalStorage } from "@/test/memoryLocalStorage";

/**
 * The developer demo account is a hardcoded, client-side escape hatch. These
 * tests pin the credential check (the ONLY gate to developer mode) and the
 * reload-proof session flag.
 */

describe("isDeveloperCredentials", () => {
  it("accepts the exact developer credentials", () => {
    expect(isDeveloperCredentials(DEV_USERNAME, DEV_PASSWORD)).toBe(true);
    expect(isDeveloperCredentials("developer", "123456")).toBe(true);
  });

  it("is case-insensitive on the username and trims surrounding space", () => {
    expect(isDeveloperCredentials("Developer", "123456")).toBe(true);
    expect(isDeveloperCredentials("  DEVELOPER  ", "123456")).toBe(true);
  });

  it("rejects the wrong password (exact match required, no trimming)", () => {
    expect(isDeveloperCredentials("developer", "1234567")).toBe(false);
    expect(isDeveloperCredentials("developer", " 123456")).toBe(false);
    expect(isDeveloperCredentials("developer", "")).toBe(false);
  });

  it("rejects any other username", () => {
    expect(isDeveloperCredentials("dev", "123456")).toBe(false);
    expect(isDeveloperCredentials("developer1", "123456")).toBe(false);
    expect(isDeveloperCredentials("", "123456")).toBe(false);
  });

  it("names its own stable userId namespace", () => {
    expect(DEV_USER_ID).toBe("developer");
  });
});

describe("developer session flag", () => {
  beforeEach(() => installMemoryLocalStorage());
  afterEach(() => localStorage.clear());

  it("starts inactive, then persists and clears", () => {
    expect(isDevSessionActive()).toBe(false);
    startDevSession();
    expect(isDevSessionActive()).toBe(true);
    endDevSession();
    expect(isDevSessionActive()).toBe(false);
  });
});
