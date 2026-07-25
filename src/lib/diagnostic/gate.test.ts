import { describe, expect, it } from "vitest";
import { shouldRedirectToDiagnostic } from "./gate";

describe("shouldRedirectToDiagnostic (required-once onboarding gate)", () => {
  it("redirects authed routes to /diagnostic when it has NOT been done", () => {
    expect(shouldRedirectToDiagnostic("/contents", undefined)).toBe(true);
    expect(shouldRedirectToDiagnostic("/track/probability", undefined)).toBe(true);
    expect(
      shouldRedirectToDiagnostic("/track/probability/level/pr-1", undefined),
    ).toBe(true);
    expect(shouldRedirectToDiagnostic("/dashboard", undefined)).toBe(true);
    expect(shouldRedirectToDiagnostic("/arena", undefined)).toBe(true);
  });

  it("does NOT redirect once the diagnostic is done (any non-empty stamp)", () => {
    const at = new Date().toISOString();
    expect(shouldRedirectToDiagnostic("/contents", at)).toBe(false);
    expect(shouldRedirectToDiagnostic("/track/probability", at)).toBe(false);
    expect(shouldRedirectToDiagnostic("/arena", at)).toBe(false);
  });

  it("never redirects the exempt paths, even when not done", () => {
    expect(shouldRedirectToDiagnostic("/diagnostic", undefined)).toBe(false);
    expect(shouldRedirectToDiagnostic("/login", undefined)).toBe(false);
  });
});
