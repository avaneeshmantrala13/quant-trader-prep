import { describe, expect, it } from "vitest";
import { ANON_SCOPE, scopeId, userScopedKey } from "./userScope";

describe("userScope", () => {
  it("collapses missing / blank ids to the anonymous namespace", () => {
    expect(scopeId(null)).toBe(ANON_SCOPE);
    expect(scopeId(undefined)).toBe(ANON_SCOPE);
    expect(scopeId("")).toBe(ANON_SCOPE);
    expect(scopeId("   ")).toBe(ANON_SCOPE);
  });

  it("normalizes casing / surrounding whitespace to a stable token", () => {
    expect(scopeId("Alice")).toBe("alice");
    expect(scopeId("  Bob  ")).toBe("bob");
    // Same user under different casing must not fork into two scopes.
    expect(scopeId("ALICE")).toBe(scopeId("alice"));
  });

  it("builds a distinct key per user off a shared base", () => {
    expect(userScopedKey("qtp.mock.active.v3", "alice")).toBe(
      "qtp.mock.active.v3::alice",
    );
    expect(userScopedKey("qtp.mock.active.v3", null)).toBe(
      "qtp.mock.active.v3::anon",
    );
    // Two accounts never collide — the property that stops cross-account leaks.
    expect(userScopedKey("k", "alice")).not.toBe(userScopedKey("k", "bob"));
    // Anonymous is its own separate bucket, distinct from any real user.
    expect(userScopedKey("k", null)).not.toBe(userScopedKey("k", "alice"));
  });
});
